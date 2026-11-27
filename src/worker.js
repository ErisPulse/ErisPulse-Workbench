// ErisPulse Workbench —— 统一身份中心 + 创作者工作台
// 架构：Cloudflare Worker（本文件）+ D1 + 静态前端（public/）
// 完全开源，接受社区监督。


import { R2_MAX_ZIP, R2_TOTAL_LIMIT, r2PutObject, r2DeleteObject, r2ListObjects, r2AttachDomain, r2SetDomainEnabled, r2DetachDomain, r2CreateBucket, r2DeleteBucket, r2AddBytes, r2GetTotalBytes, r2EmptyBucket, extractZip, mimeOf } from './r2.js';

// ── OAuth 上游（作为客户端登录）──
const OAUTH_UPSTREAM = {
    github: {
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userInfoUrl: 'https://api.github.com/user',
        envId: 'GITHUB_CLIENT_ID', envSecret: 'GITHUB_CLIENT_SECRET',
        authStyle: 'token',
        mapUser: d => ({ provider_uid: String(d.id), username: d.login, display_name: d.name || d.login, avatar_url: d.avatar_url || '', email: d.email || '' }),
    },
    codeberg: {
        tokenUrl: 'https://codeberg.org/login/oauth/access_token',
        userInfoUrl: 'https://codeberg.org/api/v1/user',
        envId: 'CODEBERG_CLIENT_ID', envSecret: 'CODEBERG_CLIENT_SECRET',
        authStyle: 'token',
        mapUser: d => ({ provider_uid: String(d.id), username: d.login, display_name: d.full_name || d.login, avatar_url: d.avatar_url || '', email: d.email || '' }),
    },
    yunhu: {
        tokenUrl: 'https://oauth2.jwzhd.com/oauth/token',
        userInfoUrl: 'https://oauth2.jwzhd.com/api/user/me',
        envId: 'YUNHU_CLIENT_ID', envSecret: 'YUNHU_CLIENT_SECRET',
        authStyle: 'bearer',
        mapUser: d => ({ provider_uid: String(d.user_id), username: d.nickname || String(d.user_id), display_name: d.nickname || String(d.user_id), avatar_url: d.avatar_url || '', email: '' }),
    },
};

const SESSION_TTL_S = 30 * 86400;
const CODE_TTL_MS = 10 * 60 * 1000;
const OAUTH_TOKEN_TTL_S = 30 * 86400;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const AVATAR_MAX = 1024 * 1024;

// ── 模块托管域名（plugin-<label>.erisdev.com 单层 + 固定前缀；TLS 由 *.erisdev.com 免费通配符覆盖）──
const DOMAIN_PREFIX = 'plugin-';
const DOMAIN_BASE = 'erisdev.com';
const DOMAIN_LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const DOMAIN_BRANCH_RE = /^[A-Za-z0-9._\-/]{1,120}$/;
const DOMAIN_LIMIT_PER_MODULE = 2;
const DOMAIN_VERIFY_EXPIRE_DAYS = 7;            // 验证期上限：超时自动释放前缀供他人申请
// 每模块第 1 个域名直接生效，第 2 个起进入审核（DOMAIN_LIMIT_PER_MODULE 仍为硬上限）
const DOMAIN_LIMIT_PER_USER = 10;
// 保留名：前缀已隔离官方子域，此表仅防易混淆命名
const DOMAIN_RESERVED = new Set(['www', 'api', 'admin', 'mail', 'smtp', 'imap', 'pop', 'ns1', 'ns2',
    'blog', 'docs', 'cdn', 'static', 'assets', 'oauth', 'app', 'dev', 'test', 'demo', 'help',
    'status', 'forum', 'wiki', 'shop', 'store', 'pay', 'vpn', 'git', 'ftp', 'mx', 'erispulse', 'workbench']);

// ── 工具 ──
function json(data, status = 200, extra = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...extra },
    });
}
const fail = (code, status, message) => json({ error: code, message: message || '' }, status);
// 域名端点专用：附机读 reason 键（API 层 i18n 键），message 恒为英文；前端按 reason 查字典翻译
const freason = (code, status, reason, message) => json({ error: code, reason: reason || '', message: message || '' }, status);
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

// ── 编码体检 ──
// Windows 终端默认 GBK：中文会以 GBK 字节发上来，JSON.parse 只会得到不可逆的 U+FFFD，
// 一旦入库/入索引就再也还原不回来。所以写入前必须在字节层拦截，而不是事后修。
const MOJIBAKE_RE = /\ufffd|锟斤拷|ï¿½/;
const ENCODING_HINT = '请求体必须是 UTF-8，检测到 GBK 等非 UTF-8 字节。Windows 终端请先执行 chcp 65001，'
    + '或将文件/参数以 UTF-8 保存后重试。 Request body must be UTF-8 (invalid UTF-8 / GBK bytes detected).';

/** 严格解码一段字节：非 UTF-8 直接抛错，绝不静默替换成 U+FFFD */
function decodeUtf8Strict(buf) {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    if (MOJIBAKE_RE.test(text)) throw new Error('mojibake');
    return text;
}

/** 写请求体检：用 clone() 读，不消耗原 body；返回 Response 表示拒绝，null 表示放行 */
async function rejectBadEncoding(request) {
    const ct = (request.headers.get('Content-Type') || '').toLowerCase();
    if (ct && !ct.includes('json')) return null;
    let buf;
    try { buf = await request.clone().arrayBuffer(); } catch (e) { return null; }
    if (buf.byteLength > 2 * 1024 * 1024) return null;
    let text;
    try { text = decodeUtf8Strict(buf); }
    catch (e) {
        const fm = new TextDecoder('utf-8').decode(buf).match(/"([A-Za-z0-9_]+)"\s*:\s*"[^"]*[\ufffd]/);
        return fail('ENCODING_INVALID', 415, ENCODING_HINT + (fm ? ' （字段 ' + fm[1] + '）' : ''));
    }
    return null;
}

/** 上游 packages.json 严格解码：仓库里混进 GBK 时宁可不缓存，也不污染快照 */
async function readPackages(resp) {
    return JSON.parse(decodeUtf8Strict(await resp.arrayBuffer()));
}

function randomHex(bytes) {
    const a = new Uint8Array(bytes);
    crypto.getRandomValues(a);
    return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function sha256(text) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uDecode = t => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((t.length + 3) % 4)), c => c.charCodeAt(0));

// PBKDF2 密码（pbkdf2$iter$salt$hash）
async function hashPassword(pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
    return 'pbkdf2$100000$' + b64u(salt) + '$' + b64u(new Uint8Array(bits));
}
async function verifyPassword(pw, stored) {
    try {
        const seg = String(stored).split('$');
        const salt = b64uDecode(seg[2]), expected = b64uDecode(seg[3]);
        const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
        const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: +seg[1], hash: 'SHA-256' }, key, expected.length * 8));
        let diff = 0;
        for (let i = 0; i < expected.length; i++) diff |= bits[i] ^ expected[i];
        return diff === 0;
    } catch (e) { return false; }
}
const sanitizeUsername = n => String(n || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
const isStaff = u => u && (u.role === 'admin' || u.role === 'mod');

// ── TOTP 两步验证（RFC 6238，SHA-1 / 6 位 / 30s，±1 窗口容错）──
const TOTP_STEP_S = 30, TOTP_WINDOW = 1, TOTP_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const TOTP_GRACE_MS = 10 * 60 * 1000;   // 敏感操作验证通过后的免码宽限（会话/PAT 通用）
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(bytes) {
    let out = '', bits = 0, val = 0;
    for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
    if (bits > 0) out += B32[(val << (5 - bits)) & 31];
    return out;
}
function base32Decode(s) {
    let bits = 0, val = 0; const out = [];
    for (const c of String(s || '').toUpperCase().replace(/=+$/, '')) {
        const i = B32.indexOf(c); if (i < 0) continue;
        val = (val << 5) | i; bits += 5;
        if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
    }
    return new Uint8Array(out);
}
async function totpAt(secretB32, unixSec) {
    const key = base32Decode(secretB32);
    const msg = new ArrayBuffer(8);
    new DataView(msg).setUint32(4, Math.floor(unixSec / TOTP_STEP_S));
    const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const h = new Uint8Array(await crypto.subtle.sign('HMAC', k, msg));
    const off = h[19] & 0xf;
    return String(((h[off] & 0x7f) << 24 | h[off + 1] << 16 | h[off + 2] << 8 | h[off + 3]) % 1000000).padStart(6, '0');
}
async function verifyTotp(secretB32, code) {
    if (!secretB32 || !/^\d{6}$/.test(String(code || '').trim())) return false;
    const t = Math.floor(Date.now() / 1000), want = String(code).trim();
    for (let w = -TOTP_WINDOW; w <= TOTP_WINDOW; w++) {
        if (await totpAt(secretB32, t + w * TOTP_STEP_S) === want) return true;
    }
    return false;
}

/**
 * 敏感操作的 2FA 判定（统一入口）：
 *  - 未开启 2FA / 免码 PAT：放行
 *  - 宽限期内（上次验证 < 10 分钟）：放行
 *  - 携带正确动态码：放行并刷新宽限
 *  - 否则返回 428 TOTP_REQUIRED（客户端补码重试）
 */
async function requireTotp(db, me, body) {
    if (!me.totp_enabled || me.pat_skip_2fa) return null;
    // 宽限只对网页会话生效：PAT 是长期凭证，要么声明 skip_2fa，要么每次带码
    if (!me.pat_is_pat && me.totp_last_ok && Date.now() - new Date(me.totp_last_ok).getTime() < TOTP_GRACE_MS) return null;
    if (await verifyTotp(me.totp_secret, body && body.totp_code)) {
        db.prepare('UPDATE users SET totp_last_ok=?1 WHERE uid=?2').bind(now(), me.uid).run().catch(() => {});
        return null;
    }
    return fail('TOTP_REQUIRED', 428, '需要两步验证动态码（或稍后在宽限期内重试）');
}

async function audit(db, actorUid, action, target, detail) {
    db.prepare('INSERT INTO audit_log (actor_uid, action, target, detail, created_at) VALUES (?1,?2,?3,?4,?5)')
        .bind(actorUid || '', action, target || '', detail || '', now()).run().catch(() => {});
}

// ── 会话 ──
async function createSession(db, uid) {
    const token = randomHex(24);
    await db.prepare('INSERT INTO sessions (token_hash, uid, created_at, expires_at) VALUES (?,?,?,?)')
        .bind(await sha256(token), uid, now(), new Date(Date.now() + SESSION_TTL_S * 1000).toISOString()).run();
    return token;
}
async function currentUser(db, request) {
    const m = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
    if (!m) return null;
    const raw = m[1].trim();
    const hash = await sha256(raw);
    // 访问令牌（epat_ 前缀）：开放 API / CLI / 外部工具链与登录会话同一 Bearer 语义
    if (raw.startsWith('epat_')) {
        const u = await db.prepare(
            'SELECT u.*, pt.skip_2fa AS pat_skip_2fa, 1 AS pat_is_pat FROM personal_tokens pt JOIN users u ON u.uid = pt.uid WHERE pt.token_hash = ?1 AND pt.revoked = 0'
        ).bind(hash).first();
        if (u) db.prepare('UPDATE personal_tokens SET last_used_at = ?1 WHERE token_hash = ?2').bind(now(), hash).run().catch(() => {});
        return u || null;
    }
    return await db.prepare(
        'SELECT u.* FROM sessions s JOIN users u ON u.uid = s.uid WHERE s.token_hash = ?1 AND s.expires_at > ?2'
    ).bind(hash, now()).first();
}
const publicUser = u => u ? {
    uid: u.uid, username: u.username, display_name: u.display_name, role: u.role,
    avatar_url: u.avatar_blob ? '' : (u.avatar_url || ''), has_avatar_blob: !!u.avatar_blob,
    email: u.email, email_verified: !!u.email_verified, bio: u.bio, created_at: u.created_at,
    totp_enabled: !!u.totp_enabled,
    // 宽限中：敏感操作可直接调用（服务端同样校验，此字段仅作 UI 提示）
    totp_grace: !!(u.totp_enabled && u.totp_last_ok && Date.now() - new Date(u.totp_last_ok).getTime() < TOTP_GRACE_MS && !u.pat_skip_2fa),
} : null;

// 登录第二因子：已开启 TOTP 的账户先发一次性挑战票据，验码通过才发会话
async function startTwofaChallenge(db, uid) {
    const token = randomHex(24);
    await db.prepare('INSERT INTO twofa_challenges (token_hash, uid, created_at, expires_at) VALUES (?,?,?,?)')
        .bind(await sha256(token), uid, now(), new Date(Date.now() + TOTP_CHALLENGE_TTL_MS).toISOString()).run();
    return token;
}

// ── SMTP（cloudflare:sockets 直连；未配置时验证码功能隐藏）──
import { connect } from 'cloudflare:sockets';
async function smtpSend(env, to, subject, text) {
    const host = env.SMTP_HOST, user = env.SMTP_USER, pass = env.SMTP_PASS;
    if (!host || !user || !pass) return false;
    const port = parseInt(env.SMTP_PORT || '465', 10) || 465;
    const socket = connect({ hostname: host, port }, { secureTransport: 'on' });
    const w = socket.writable.getWriter(), r = socket.readable.getReader();
    const enc = new TextEncoder();
    const send = async line => { await w.write(enc.encode(line + '\r\n')); };
    const readCode = async code => {
        const dec = new TextDecoder(); let buf = '';
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            const { value, done } = await r.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split('\r\n');
            for (const line of lines) {
                const m = line.match(/^(\d{3})([ -])/);
                if (m && m[2] === ' ') { if (m[1] === code) return true; if (m[1][0] === '5') throw new Error('SMTP ' + line); }
            }
            buf = lines[lines.length - 1] ?? '';
        }
        throw new Error('SMTP timeout');
    };
    const b64 = t => btoa(String.fromCharCode(...new TextEncoder().encode(t)));
    try {
        await readCode('220'); await send('EHLO workbench.erisdev.com'); await readCode('250');
        await send('AUTH LOGIN'); await readCode('334');
        await send(b64(user)); await readCode('334');
        await send(b64(pass)); await readCode('235');
        const from = env.MAIL_FROM || user;
        await send('MAIL FROM:<' + from + '>'); await readCode('250');
        await send('RCPT TO:<' + to + '>'); await readCode('250');
        await send('DATA'); await readCode('354');
        await send('From: ErisPulse Workbench <' + from + '>\r\nTo: <' + to + '>\r\nSubject: =?UTF-8?B?' + b64(subject) + '?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + b64(text).replace(/(.{76})/g, '$1\r\n') + '\r\n.');
        await readCode('250');
        await send('QUIT');
        return true;
    } finally {
        try { await w.close(); } catch (e) {}
        try { socket.close(); } catch (e) {}
    }
}

// ── 模块状态变更邮件通知 ──
// op 真实生效（applied）后通知模块所有者；target_uid 为操作时快照的所有者 uid
async function notifyModuleApplied(env, db, op) {
    try {
        if (!op || !op.target_uid) return;
        const action = op.action || '';
        let subject = '', text = '';
        const base = 'ErisPulse 模块商店';
        if (action === 'delete') {
            subject = `[${base}] 模块已删除：${op.name}`;
            text = `你的${op.type === 'adapter' ? '适配器' : '模块'}「${op.name}」已从商店删除。\n如非本人操作或存在疑问，请联系管理员。`;
        } else if (action === 'submit') {
            subject = `[${base}] 模块已收录：${op.name}`;
            text = `你提交的${op.type === 'adapter' ? '适配器' : '模块'}「${op.name}」已进入商店索引（当前为待验证状态）。\n管理员审核通过后会再次邮件通知。`;
        } else if (action === 'verify') {
            if (op.verified) {
                subject = `[${base}] 模块已转正：${op.name}`;
                text = `恭喜！你的${op.type === 'adapter' ? '适配器' : '模块'}「${op.name}」已通过审核，成为商店已验证条目。`;
            } else {
                subject = `[${base}] 模块已取消验证：${op.name}`;
                text = `你的${op.type === 'adapter' ? '适配器' : '模块'}「${op.name}」已被取消验证。\n如有疑问请联系管理员。`;
            }
        } else return; // edit 等字段修改不属状态变更
        const u = await db.prepare('SELECT email, display_name FROM users WHERE uid = ?1').bind(op.target_uid).first();
        if (!u || !u.email) return;
        text += `\n\n—— ErisPulse Workbench（workbench.erisdev.com）`;
        await smtpSend(env, u.email, subject, `${u.display_name || '开发者'}，你好：\n\n${text}`);
    } catch (e) { /* 通知失败不影响对账 */ }
}

// 从缓存索引解析模块所有者 uid（submitted_by_uid 形如 wb:<uid>）
async function ownerUidOf(db, type, name) {
    try {
        const cached = await getCachedPackages(db);
        if (!cached.packages) return null;
        const info = containerOf(cached.packages, type)[name];
        if (!info) return null;
        const sub = String(info.submitted_by_uid || '');
        return sub.startsWith('wb:') ? sub.slice(3) : null;
    } catch (e) { return null; }
}

// ═══════════ 模块托管域名（plugin-<label>.erisdev.com）═══════════
const domainFqdn = label => DOMAIN_PREFIX + label + '.' + DOMAIN_BASE;

/** 仓库输入归一化：按平台解析 → {host, base, owner, repo}；github/codeberg 的 URL 自动纠正平台，其余按 gitea/gitlab 风格接受任意 https 实例 */
function parseGitRepo(input, platform) {
    const url = String(input || '').trim().replace(/\.git$/i, '').replace(/\/+$/, '');
    const gh = url.match(/^https:\/\/(?:www\.)?github\.com\/(.+)$/i);
    if (gh) return ownerRepoOf('github', '', gh[1]);
    const cb = url.match(/^https:\/\/(?:www\.)?codeberg\.org\/(.+)$/i);
    if (cb) return ownerRepoOf('codeberg', '', cb[1]);
    if (platform === 'github' || platform === 'codeberg') return null; // 平台明确但 URL 不符
    const m = url.match(/^https:\/\/([a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?)\/(.+)$/i);
    if (!m) return null;
    if (m[1].toLowerCase().endsWith('.erisdev.com')) return null; // 指向自身域会造成解析回环
    return ownerRepoOf(platform === 'gitlab' ? 'gitlab' : 'gitea', 'https://' + m[1].toLowerCase(), m[4]);
}
function ownerRepoOf(host, base, rest) {
    const [owner, repo] = String(rest).split('/');
    if (!/^[\w.-]{1,100}$/.test(owner || '') || !/^[\w.-]{1,100}$/.test(repo || '')) return null;
    return { host, base, owner, repo };
}

/** 仓库与模块登记 repository 同源即视为已证明控制权（模块提交时已绑定） */
function repoMatchesModule(gitHost, owner, repo, moduleRepository) {
    const m = String(moduleRepository || '').match(/^https:\/\/(github\.com|codeberg\.org)\/([\w.-]+)\/([\w.-]+?)(\.git)?(\/.*)?$/i);
    if (!m) return false;
    return m[1].split('.')[0].toLowerCase() === gitHost
        && m[2].toLowerCase() === owner.toLowerCase()
        && m[3].toLowerCase() === repo.toLowerCase();
}

/** 平台 → raw 文件 URL：github 走 CDN 域；gitea 风格（codeberg / 自建 Gitea·Forgejo）；gitlab 风格（自建 GitLab） */
function gitRawUrl(host, base, owner, repo, branch, path, bust) {
    const q = bust ? '?t=' + Date.now() : '';
    if (host === 'github') return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}${q}`;
    if (host === 'gitlab') return `${base}/${owner}/${repo}/-/raw/${branch}/${path}${q}`;
    return `${base || 'https://codeberg.org'}/${owner}/${repo}/raw/branch/${branch}/${path}${q}`;
}

/** label 校验：非法 / 保留 / 已占用分别返回提示文案（API 层英文），通过返回 '' */
async function checkDomainLabel(db, label) {
    if (!DOMAIN_LABEL_RE.test(label) || label.length < 2) return ['label_invalid', 'label must be 2-63 lowercase letters, digits or inner hyphens'];
    if (DOMAIN_RESERVED.has(label)) return ['label_reserved', 'this label is reserved'];
    if (await db.prepare('SELECT 1 FROM module_domains WHERE fqdn = ?1').bind(domainFqdn(label)).first()) return ['label_taken', 'this label is already taken'];
    return null;
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HOSTNAME_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** DNS 记录值校验：拒绝指向自身域与保留/私有地址，通过返回 ''（API 层英文） */
function checkDnsValue(type, value) {
    const v = String(value || '').trim().toLowerCase();
    if (type === 'CNAME') {
        if (!HOSTNAME_RE.test(v)) return 'CNAME target must be a valid hostname';
        if (v === DOMAIN_BASE || v.endsWith('.erisdev.com')) return 'CNAME target must not point to erisdev.com itself';
        return '';
    }
    if (type === 'AAAA') {
        if (!/^[0-9a-f:]{2,45}$/.test(v) || !v.includes(':')) return 'AAAA must be a valid IPv6 address';
        const h = v.split(':')[0];
        if (v === '::' || v === '::1' || /^[fF][cCdD]/.test(h) || /^fe[89ab]/.test(h) || /^ff/.test(h) || h === '100') return 'this IPv6 address is a reserved/private range';
        return '';
    }
    if (type === 'A') {
        const m = v.match(IPV4_RE);
        if (!m || m.slice(1).some(x => +x > 255)) return 'A must be a valid IPv4 address';
        const [a, b, c] = [+m[1], +m[2], +m[3]];
        const bad = a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31
            || a === 100 && b >= 64 && b <= 127 || a === 192 && (b === 168 || b === 0 && (c === 0 || c === 2))
            || a === 198 && b === 51 && c === 100 || a === 203 && b === 0 && c === 113 || a >= 224;
        if (bad) return 'this IPv4 address is a reserved/private range';
        return '';
    }
    return 'record type must be CNAME, A or AAAA';
}

/** Cloudflare DNS API（zone 级 token：Zone.DNS Edit）；失败抛错，调用方转 502 */
async function cfDnsApi(env, method, body, recordId) {
    const url = `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/dns_records${recordId ? '/' + recordId : ''}`;
    const resp = await fetch(url, {
        method,
        headers: { Authorization: 'Bearer ' + env.CF_DNS_TOKEN, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    const d = await resp.json().catch(() => ({}));
    if (!resp.ok || !d.success) {
        const msg = d.errors && d.errors[0] ? `${d.errors[0].code} ${d.errors[0].message}` : 'HTTP ' + resp.status;
        throw new Error('Cloudflare API: ' + msg);
    }
    return d.result;
}

/** 按名称查 DNS 记录（半创建残留收编用） */
async function cfFindDnsRecord(env, name) {
    const url = `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/dns_records?name=${encodeURIComponent(name)}&per_page=5`;
    const resp = await fetch(url, { headers: { Authorization: 'Bearer ' + env.CF_DNS_TOKEN } });
    const d = await resp.json().catch(() => ({}));
    if (!resp.ok || !d.success) throw new Error('Cloudflare API: HTTP ' + resp.status);
    return (d.result || []).find(x => x.name === name) || null;
}

/** Worker 路由（token 需 Zone.Workers Routes Edit）：精确 hostname/* 模式，互不影响其他子域 */
async function cfRouteApi(env, method, body, routeId) {
    const url = `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/workers/routes${routeId ? '/' + routeId : ''}`;
    const resp = await fetch(url, {
        method,
        headers: { Authorization: 'Bearer ' + env.CF_DNS_TOKEN, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    const d = await resp.json().catch(() => ({}));
    if (!resp.ok || !d.success) {
        const msg = d.errors && d.errors[0] ? `${d.errors[0].code} ${d.errors[0].message}` : 'HTTP ' + resp.status;
        throw new Error('Cloudflare Route API: ' + msg);
    }
    return d.result;
}

/** 域名状态变更邮件（中英双语；静默失败，不影响主流程） */
async function notifyDomainEvent(env, db, uid, subject, textZh, textEn) {
    try {
        const u = await db.prepare('SELECT email, display_name FROM users WHERE uid = ?1').bind(uid).first();
        if (!u || !u.email) return;
        const body = `${u.display_name || '开发者'}，你好：\n\n${textZh}\n\n—— ErisPulse Workbench（workbench.erisdev.com）\n\nEnglish: ${textEn}`;
        await smtpSend(env, u.email, subject, body);
    } catch (e) { /* 通知失败不影响主流程 */ }
}

// ── 上游 OAuth 登录 ──
async function upstreamIdentity(env, provider, codeOrToken, isToken) {
    const cfg = OAUTH_UPSTREAM[provider];
    if (!cfg || !env[cfg.envId] || !env[cfg.envSecret]) return null;
    let accessToken = isToken ? codeOrToken : null;
    if (!accessToken) {
        const redirectUri = env.OAUTH_REDIRECT || new URL('https://workbench.erisdev.com/').origin + '/';
        const payload = { grant_type: 'authorization_code', code: codeOrToken, client_id: env[cfg.envId], client_secret: env[cfg.envSecret], redirect_uri: redirectUri };
        // Gitea/Codeberg 的 token 端点只解析 form-urlencoded；GitHub 两种都接受
        const asForm = provider === 'codeberg';
        const resp = await fetch(cfg.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': asForm ? 'application/x-www-form-urlencoded' : 'application/json',
                'Accept': 'application/json',
            },
            body: asForm ? new URLSearchParams(payload).toString() : JSON.stringify(payload),
        });
        const text = await resp.text();
        let d; try { d = JSON.parse(text); } catch (e) { d = Object.fromEntries(new URLSearchParams(text)); }
        accessToken = d.access_token;
        if (!accessToken) throw new Error('upstream token exchange failed: HTTP ' + resp.status + ' ' + text.slice(0, 200));
    }
    const headers = { 'Accept': 'application/json', 'User-Agent': 'ErisPulse-Workbench' };
    headers.Authorization = (cfg.authStyle === 'bearer' ? 'Bearer ' : 'token ') + accessToken;
    const resp = await fetch(cfg.userInfoUrl, { headers });
    if (!resp.ok) throw new Error('upstream userinfo failed: ' + resp.status);
    const ident = cfg.mapUser(await resp.json());
    if (!ident.provider_uid) throw new Error('upstream userinfo missing id');
    return ident;
}

async function findOrCreateUser(db, provider, ident) {
    const linked = await db.prepare('SELECT uid FROM identities WHERE provider=?1 AND provider_uid=?2').bind(provider, ident.provider_uid).first();
    if (linked) {
        const u = await db.prepare('SELECT * FROM users WHERE uid=?1').bind(linked.uid).first();
        if (!u) throw new Error('identity points to missing user');
        return { user: u, created: false };
    }
    // 同邮箱既有账户：不建新号，把当前身份绑定过去（否则撞 users.email
    // UNIQUE 报 D1_ERROR）。上游 OAuth 邮箱经 provider 验证；既有账户的邮箱
    // 须已验证才自动绑定——未验证邮箱归属不明，返回 conflict 由调用方提示
    // 用户先用原方式登录再手动绑定
    if (ident.email) {
        const sameEmail = await db.prepare('SELECT * FROM users WHERE email=?1').bind(ident.email).first();
        if (sameEmail) {
            if (sameEmail.email_verified) {
                await db.prepare('INSERT INTO identities (provider, provider_uid, uid) VALUES (?,?,?)').bind(provider, ident.provider_uid, sameEmail.uid).run();
                await audit(db, sameEmail.uid, 'identity_link', sameEmail.uid, provider);
                return { user: sameEmail, created: false };
            }
            return { conflict: true };
        }
    }
    const count = (await db.prepare('SELECT COUNT(*) AS n FROM users').first()).n;
    const uid = 'u_' + randomHex(6);
    let username = sanitizeUsername(ident.username);
    if (username.length < 2) username = 'user';
    for (let i = 0; i < 8; i++) {
        if (!(await db.prepare('SELECT 1 FROM users WHERE username=?1').bind(username).first())) break;
        username = (username + '_' + randomHex(2)).slice(0, 24);
    }
    try {
        await db.prepare('INSERT INTO users (uid, username, display_name, role, avatar_url, email, email_verified, created_at) VALUES (?,?,?,?,?,?,?,?)')
            .bind(uid, username, ident.display_name || username, count === 0 ? 'admin' : 'user', ident.avatar_url, ident.email || null, ident.email ? 1 : 0, now()).run();
    } catch (e) {
        // 并发首登同邮箱竞态：另一请求已抢先建号（UNIQUE 冲突）→ 改走绑定
        if (ident.email && /UNIQUE constraint failed: users\.email/i.test(String(e.message || e))) {
            const winner = await db.prepare('SELECT * FROM users WHERE email=?1').bind(ident.email).first();
            if (winner && winner.email_verified) {
                await db.prepare('INSERT OR IGNORE INTO identities (provider, provider_uid, uid) VALUES (?,?,?)').bind(provider, ident.provider_uid, winner.uid).run();
                await audit(db, winner.uid, 'identity_link', winner.uid, provider);
                return { user: winner, created: false };
            }
        }
        throw e;
    }
    await db.prepare('INSERT INTO identities (provider, provider_uid, uid) VALUES (?,?,?)').bind(provider, ident.provider_uid, uid).run();
    return { user: await db.prepare('SELECT * FROM users WHERE uid=?1').bind(uid).first(), created: true };
}

// ═══════════════ 实时性：仓库快照 + 操作投影 + Actions 轮询 ═══════════════
// dispatch 后 GitHub workflow 约 15-30s 才写回 packages.json；
// 期间 /api/modules 用「快照 + pending ops 投影」立即呈现目标状态，
// 并由 ctx.waitUntil 轮询 Actions run（≤90s），成功后刷新快照、结清 ops。

let _tablesReady = false;
async function ensureTables(db) {
    if (_tablesReady) return;
    _tablesReady = true;
    await db.prepare(`CREATE TABLE IF NOT EXISTS module_ops (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, type TEXT NOT NULL,
        action TEXT NOT NULL, verified INTEGER, edit_data TEXT,
        owner_uid TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL
    )`).run().catch(() => {});
    await db.prepare('ALTER TABLE module_ops ADD COLUMN owner_uid TEXT').run().catch(() => {});
    await db.prepare('ALTER TABLE module_ops ADD COLUMN target_uid TEXT').run().catch(() => {});
    await db.prepare('CREATE TABLE IF NOT EXISTS repo_cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)').run().catch(() => {});
    await db.prepare(`CREATE TABLE IF NOT EXISTS module_domains (
        fqdn TEXT PRIMARY KEY, label TEXT NOT NULL, uid TEXT NOT NULL,
        module_name TEXT NOT NULL, module_type TEXT NOT NULL,
        mode TEXT NOT NULL,
        git_repo TEXT NOT NULL DEFAULT '', git_host TEXT NOT NULL DEFAULT '', git_branch TEXT NOT NULL DEFAULT '',
        target_url TEXT NOT NULL DEFAULT '',
        dns_type TEXT NOT NULL DEFAULT '', dns_value TEXT NOT NULL DEFAULT '', dns_record_id TEXT NOT NULL DEFAULT '',
        verify_code TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'verifying',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`).run().catch(() => {});
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_domains_uid ON module_domains(uid)').run().catch(() => {});
    await db.prepare('ALTER TABLE module_domains ADD COLUMN git_base TEXT').run().catch(() => {});
    await db.prepare('ALTER TABLE module_domains ADD COLUMN route_id TEXT').run().catch(() => {});
    await db.prepare('ALTER TABLE module_domains ADD COLUMN r2_bucket TEXT').run().catch(() => {});
    await db.prepare('ALTER TABLE module_domains ADD COLUMN r2_bytes INTEGER').run().catch(() => {});
    await db.prepare('ALTER TABLE module_domains ADD COLUMN review INTEGER').run().catch(() => {});
    // 插件域名流量预算表（护栏用，抽样计数）
    await db.prepare('CREATE TABLE IF NOT EXISTS domain_quota (day TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)').run().catch(() => {});
}

// raw.githubusercontent 的 CDN 会缓存旧内容：查询串变化即视为不同资源，用于拿到刚提交后的快照
const packagesUrl = () => 'https://raw.githubusercontent.com/ErisPulse/ErisPulse-ModuleRepo/2x/packages.json?t=' + Date.now();
const containerOf = (packages, type) => (type === 'adapter' ? packages.adapters : packages.modules) || {};

// 快照是否已体现该操作的目标状态（用于「确认生效后才结清」）
function opTargetMet(packages, op) {
    const entry = containerOf(packages, op.type)[op.name];
    if (op.action === 'delete') return !entry;
    if (!entry) return false;
    if (op.action === 'submit') return true;
    if (op.action === 'verify') return (entry.verified !== false) === !!op.verified;
    if (op.action === 'edit') {
        let ed = {}; try { ed = JSON.parse(op.edit_data || '{}'); } catch (e) {}
        for (const k of ['package', 'author', 'description', 'repository', 'min_sdk_version']) {
            if (ed[k] !== undefined && ed[k] !== '' && String(entry[k] || '') !== String(ed[k])) return false;
        }
        if (ed.category !== undefined && Number(entry.category || 0) !== Number(ed.category)) return false;
        if (Array.isArray(ed.tags) && JSON.stringify(entry.tags || []) !== JSON.stringify(ed.tags)) return false;
        if (ed.verified !== undefined && (entry.verified !== false) !== !!ed.verified) return false;
        if (typeof ed.logo === 'string' && ed.logo && String(entry.logo || '') !== ed.logo) return false;
        return true;
    }
    return true;
}

/**
 * 对账：拉最新快照，把已达标的 pending op 结清；超 30 分钟仍未体现的标 stale。
 * 有 15 秒节流，避免每次列表请求都打 GitHub。
 */
async function reconcilePending(env) {
    const db = env.DB;
    const pending = await db.prepare("SELECT * FROM module_ops WHERE status IN ('pending','stale') ORDER BY id ASC LIMIT 200").all();
    const ops = pending.results || [];
    if (!ops.length) return;
    let packages = null;
    const last = await db.prepare("SELECT updated_at FROM repo_cache WHERE key = 'packages'").first();
    const fresh = last && Date.now() - new Date(last.updated_at).getTime() < 15000;
    if (fresh) {
        const row = await db.prepare("SELECT value FROM repo_cache WHERE key = 'packages'").first();
        try {
            if (!MOJIBAKE_RE.test(row.value)) packages = JSON.parse(row.value);
        } catch (e) { packages = null; }
    }
    if (!packages) {
        try {
            const resp = await fetch(packagesUrl(), { cf: { cacheTtl: 0 } });
            if (!resp.ok) return;
            packages = await readPackages(resp);
            await db.prepare("INSERT INTO repo_cache (key, value, updated_at) VALUES ('packages', ?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2")
                .bind(JSON.stringify(packages), now()).run();
        } catch (e) { return; }
    }
    for (const op of ops) {
        if (opTargetMet(packages, op)) {
            await db.prepare("UPDATE module_ops SET status='applied' WHERE id=?1").bind(op.id).run();
            await notifyModuleApplied(env, db, op);
        } else if (op.status === 'pending' && Date.now() - new Date(op.created_at).getTime() > 30 * 60 * 1000) {
            await db.prepare("UPDATE module_ops SET status='stale' WHERE id=?1").bind(op.id).run();
        } else if (op.status === 'stale' && Date.now() - new Date(op.created_at).getTime() > 24 * 3600 * 1000) {
            // 超过 24 小时仍未生效：归档为 expired，不再出现在列表标记里
            await db.prepare("UPDATE module_ops SET status='expired' WHERE id=?1").bind(op.id).run();
        }
    }
}

async function getCachedPackages(db) {
    const row = await db.prepare("SELECT value FROM repo_cache WHERE key = 'packages'").first();
    if (row && !MOJIBAKE_RE.test(row.value)) {
        try { return { packages: JSON.parse(row.value), fromCache: true }; } catch (e) {}
    }
    // 缓存缺失或已损坏（历史 GBK 数据）：回源，坏快照绝不继续下发
    const resp = await fetch('https://raw.githubusercontent.com/ErisPulse/ErisPulse-ModuleRepo/2x/packages.json', { cf: { cacheTtl: 30 } });
    if (!resp.ok) return { packages: null, fromCache: false, reason: 'failed to fetch packages.json (HTTP ' + resp.status + ')' };
    let packages;
    try { packages = await readPackages(resp); }
    catch (e) { return { packages: null, fromCache: false, reason: 'packages.json is not valid UTF-8 (mojibake detected); refusing to cache' }; }
    await db.prepare("INSERT INTO repo_cache (key, value, updated_at) VALUES ('packages', ?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2")
        .bind(JSON.stringify(packages), now()).run().catch(() => {});
    return { packages: packages, fromCache: false };
}

/** dispatch 成功后：记录 op → 后台轮询 Actions run 状态（≤90s），成功后刷新快照并结清 ops */
function scheduleSync(env, ctx, me, ops) {
    const db = env.DB;
    if (!db || !env.MODULE_REPO_TOKEN) return;
    ctx.waitUntil((async () => {
        const started = Date.now();
        let runOk = null;
        // 轮询最新 workflow run（handle-submission / handle-management）
        while (Date.now() - started < 90000) {
            await new Promise(r => setTimeout(r, 4000));
            try {
                const resp = await fetch(
                    'https://api.github.com/repos/ErisPulse/ErisPulse-ModuleRepo/actions/runs?per_page=3',
                    { headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + env.MODULE_REPO_TOKEN, 'User-Agent': 'ErisPulse-Workbench' } });
                if (!resp.ok) continue;
                const d = await resp.json();
                const run = (d.workflow_runs || []).find(r => ['handle-submission.yml', 'handle-management.yml'].some(w => (r.path || '').endsWith(w)) && new Date(r.created_at).getTime() > started - 15000);
                if (run) {
                    if (run.status === 'completed') { runOk = run.conclusion === 'success'; break; }
                }
            } catch (e) { /* 继续轮询 */ }
        }
        // 结清规则：快照确实体现目标状态才 applied；workflow 明确失败才 failed；
        // 其余（raw 缓存滞后 / run 仍在排队）保持 pending，由列表请求继续对账
        try {
            const resp = await fetch(packagesUrl(), { cf: { cacheTtl: 0 } });
            if (resp.ok) {
                const packages = await readPackages(resp);
                await db.prepare("INSERT INTO repo_cache (key, value, updated_at) VALUES ('packages', ?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2")
                    .bind(JSON.stringify(packages), now()).run();
                for (const op of ops) {
                    const row = await db.prepare('SELECT * FROM module_ops WHERE id = ?1').bind(op.id).first();
                    if (!row) continue;
                    if (opTargetMet(packages, row)) {
                        await db.prepare("UPDATE module_ops SET status='applied' WHERE id=?1").bind(op.id).run();
                        await notifyModuleApplied(env, db, row);
                    } else if (runOk === false) {
                        await db.prepare("UPDATE module_ops SET status='failed' WHERE id=?1").bind(op.id).run();
                    }
                }
            }
        } catch (e) { /* 快照刷新失败不影响主流程 */ }
    })());
}

async function listModules(env, request) {
    const db = env.DB;
    await ensureTables(db);
    await reconcilePending(env);   // 刷新即对账：pending op 达标则结清，避免刷新后状态「回退」
    let packages = null;
    let stale = false;
    const cached = await getCachedPackages(db);
    if (cached.packages) { packages = cached.packages; stale = cached.fromCache; }
    else return { error: fail('UPSTREAM', 502, cached.reason || 'packages.json 获取失败') };

    // pending/stale ops 投影：目标状态立即呈现，并标记「处理中/待确认」
    const pending = await db.prepare("SELECT * FROM module_ops WHERE status IN ('pending','stale') ORDER BY id ASC LIMIT 100").all();
    const opByKey = new Map();
    for (const op of (pending.results || [])) opByKey.set(op.type + ':' + op.name, op);
    const user = await currentUser(db, request);
    const uids = user ? new Set([...(await db.prepare('SELECT provider, provider_uid FROM identities WHERE uid=?1').bind(user.uid).all().then(r => r.results || []).catch(() => []))
        .map(r => r.provider + ':' + r.provider_uid), 'wb:' + user.uid]) : new Set();

    const containers = { modules: packages.modules || {}, adapters: packages.adapters || {} };
    for (const op of (pending.results || [])) {
        // stale（超时未确认）只打标记不投影：避免把未生效的变更显示成已生效
        if (op.status !== 'pending') continue;
        const container = containers[op.type === 'adapter' ? 'adapters' : 'modules'];
        if (op.action === 'submit') {
            // 提交：工作台本地构造条目（workflow 完成前先展示）
            if (!container[op.name]) {
                let ed = {}; try { ed = JSON.parse(op.edit_data || '{}'); } catch (e) {}
                container[op.name] = {
                    package: ed.package || '', version: '', author: ed.author || '', description: ed.description || '',
                    repository: ed.repository || '', official: false, verified: false,
                    submitted_by: ed.submitter_name || '', submitted_by_uid: ed.owner_uid || '',
                    submitted_at: op.created_at, category: ed.category || 0, tags: ed.tags || [], i18n: ed.i18n || [],
                    logo: ed.logo || '', min_sdk_version: ed.min_sdk_version || '',
                };
            }
        } else if (op.action === 'edit') {
            let ed = {}; try { ed = JSON.parse(op.edit_data || '{}'); } catch (e) {}
            const entry = container[op.name];
            if (entry) {
                for (const k of ['package', 'author', 'description', 'repository', 'min_sdk_version', 'logo', 'category', 'version']) {
                    if (ed[k] !== undefined && ed[k] !== '') entry[k] = ed[k];
                }
                if (Array.isArray(ed.tags)) entry.tags = ed.tags;
                if (Array.isArray(ed.i18n)) entry.i18n = ed.i18n;
                if (ed.verified !== undefined) entry.verified = !!ed.verified;
                if (ed.submitter_uid) { entry.submitted_by = ed.submitter_name || entry.submitted_by; entry.submitted_by_uid = ed.submitter_uid; }
            }
        } else if (op.action === 'verify') {
            const entry = container[op.name];
            if (entry) entry.verified = !!op.verified;
        } else if (op.action === 'delete') {
            delete container[op.name];
        }
    }

    // 查询参数过滤（CLI 友好）：?name= 精确单条 / ?q= 模糊搜索 / ?type=module|adapter / ?verified=0|1
    const sp = request.url ? new URL(request.url).searchParams : new URLSearchParams();
    const qName = sp.get('name');
    const qText = (sp.get('q') || '').toLowerCase().trim();
    const qType = sp.get('type');
    const qVerified = sp.get('verified');

    const out = [];
    for (const [cat, dict] of Object.entries(containers)) {
        for (const [name, info] of Object.entries(dict)) {
            const type = cat === 'adapters' ? 'adapter' : 'module';
            if (qType && type !== qType) continue;
            if (qName && name !== qName) continue;
            if (qText) {
                const hay = (name + ' ' + (info.package || '') + ' ' + (info.description || '') + ' ' + (Array.isArray(info.tags) ? info.tags.join(' ') : '') + ' ' + (info.author || '')).toLowerCase();
                if (!hay.includes(qText)) continue;
            }
            const isVerified = info.verified !== false;
            if (qVerified !== null && qVerified !== '' && isVerified !== (qVerified === '1')) continue;
            const op = opByKey.get(type + ':' + name);
            out.push({
                name: name, type: type,
                package: info.package, description: info.description, repository: info.repository || '',
                author: info.author || '', version: info.version || '', logo: info.logo || '',
                verified: info.verified !== false, official: !!info.official,
                category: info.category || 0, tags: info.tags || [], i18n: info.i18n || [],
                min_sdk_version: info.min_sdk_version || '',
                submitted_by: info.submitted_by || '', submitted_by_uid: info.submitted_by_uid || '',
                mine: user ? uids.has(info.submitted_by_uid || '') : false,
                pending: op ? { action: op.action, status: op.status, at: op.created_at } : null,
            });
        }
    }
    return json({ modules: out, syncing: (pending.results || []).length > 0 });
}

// ═══ R2 上传模式业务流（机械层在 r2.js）═══
async function domainUploadCommonChecks(db, env, me, body, file) {
    const labelErr = await checkDomainLabel(db, body.label);
    if (labelErr) return freason('VALIDATION', 400, labelErr[0], labelErr[1]);
    const cached = await getCachedPackages(db);
    if (!cached.packages) return fail('UPSTREAM', 502, cached.reason || 'failed to fetch packages.json');
    const info = containerOf(cached.packages, body.module_type)[body.module_name];
    if (!info) return freason('NOT_FOUND', 404, 'module_missing', 'module not found');
    if (!isStaff(me)) {
        const uids = await myUids();
        if (!uids.has(info.submitted_by_uid || '')) return freason('FORBIDDEN', 403, 'not_owner', 'only the module owner can request a hosted domain');
    }
    const modCnt = (await db.prepare('SELECT COUNT(*) AS n FROM module_domains WHERE module_name = ?1 AND module_type = ?2').bind(body.module_name, body.module_type).first()).n;
    if (modCnt >= DOMAIN_LIMIT_PER_MODULE) return { err: freason('LIMIT', 429, 'limit_module', 'module domain limit reached (' + DOMAIN_LIMIT_PER_MODULE + ')') };
    const userCnt = (await db.prepare('SELECT COUNT(*) AS n FROM module_domains WHERE uid = ?1').bind(me.uid).first()).n;
    if (userCnt >= DOMAIN_LIMIT_PER_USER) return { err: freason('LIMIT', 429, 'limit_user', 'account domain limit reached (' + DOMAIN_LIMIT_PER_USER + ')') };
    if (!file || typeof file === 'string') return { err: freason('VALIDATION', 400, 'zip_bad', 'zip file field missing') };
    if (file.size > R2_MAX_ZIP) return { err: freason('VALIDATION', 400, 'zip_size', 'zip must be ≤5MB') };
    const totalNow = await r2GetTotalBytes(db);
    if (totalNow + R2_MAX_ZIP * 20 > R2_TOTAL_LIMIT) return { err: freason('LIMIT', 429, 'storage_limit', 'global R2 storage budget reached') };
    return { modCnt };
}

async function handleDomainUpload(request, env, db, me) {
    try {
        return await handleDomainUploadInner(request, env, db, me);
    } catch (e) {
        return freason('ERROR', 500, 'upload_error', (e && e.stack || String(e)).slice(0, 400));
    }
}

async function handleDomainUploadInner(request, env, db, me) {
    await ensureTables(db);
    // 上传模式暂未开放：仅管理员可先内测
    if (!isStaff(me)) return freason('FORBIDDEN', 403, 'not_released', 'upload mode is not released yet');
    const b = await request.formData().catch(() => null);
    if (!b) return freason('VALIDATION', 400, 'bad_form', 'multipart form required');
    const file = b.get('file');
    const body = {
        module_name: String(b.get('module_name') || ''), module_type: String(b.get('module_type') || 'module'),
        label: String(b.get('label') || '').trim().toLowerCase(), totp_code: String(b.get('totp_code') || ''),
    };
    const totpErr = await requireTotp(db, me, body);
    if (totpErr) return totpErr;
    if (!env.CF_DNS_TOKEN || !env.R2_ACCOUNT_ID) return freason('UNCONFIGURED', 503, 'not_configured', 'hosted domains not configured (CF_DNS_TOKEN / R2_ACCOUNT_ID missing)');
    const check = await domainUploadCommonChecks(db, env, me, body, file);
    if (check.err) return check.err;
    let extracted;
    try {
        extracted = await extractZip(await file.arrayBuffer());
    } catch (e) {
        return freason('VALIDATION', 400, e.reason || 'zip_bad', e.message);
    }


    const fqdn = domainFqdn(body.label);
    const bucket = ('ep-' + body.label.slice(0, 58)).toLowerCase();
    // 与 JSON 流同语义：每模块第 1 个直接生效，第 2 个起需管理员审核
    const needsReview = check.modCnt >= 1 && !isStaff(me);
    const status = needsReview ? 'reviewing' : 'active';
    let rawTotal = 0;
    try {
        await r2CreateBucket(env, bucket);
        await r2AttachDomain(env, bucket, fqdn, DOMAIN_BASE);
        for (const f of extracted) { await r2PutObject(env, bucket, f.name, f.bytes, mimeOf(f.name)); rawTotal += f.bytes.length; }
        await r2AddBytes(db, rawTotal);
        if (status === 'reviewing') await r2SetDomainEnabled(env, bucket, fqdn, false);
    } catch (e) {
        // 半创建回滚：摘域/清桶/删桶
        try { await r2DetachDomain(env, bucket, fqdn); } catch (e2) { /* 尽力 */ }
        try { await r2EmptyBucket(env, db, bucket); } catch (e2) { /* 尽力 */ }
        try { await r2DeleteBucket(env, bucket); } catch (e2) { /* 尽力 */ }
        return freason('UPSTREAM', 502, e.reason || 'upstream_fail', String(e.message || e).slice(0, 200));
    }
    await db.prepare("INSERT INTO module_domains (fqdn, label, uid, module_name, module_type, mode, r2_bucket, r2_bytes, verify_code, version, review, status, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,'upload',?6,?7,'',1,?8,?9,?10,?10)")
        .bind(fqdn, body.label, me.uid, body.module_name, body.module_type, bucket, rawTotal, needsReview ? 1 : 0, status, now()).run();
    await audit(db, me.uid, 'domain.apply', fqdn, 'upload');
    notifyDomainEvent(env, db, me.uid,
        status === 'reviewing'
            ? '[ErisPulse] 托管域名待管理员审核 / Domain pending review: ' + fqdn
            : '[ErisPulse] 托管域名已生效 / Domain active: ' + fqdn,
        status === 'reviewing'
            ? '你上传的静态站点已受理，因该模块已有域名在用，需管理员审核后生效。'
            : '你上传的静态站点已部署，现在可以通过 https://' + fqdn + ' 访问。',
        status === 'reviewing'
            ? 'Your uploaded static site was received and awaits admin approval (this module already has a domain).'
            : 'Your uploaded static site is now live at https://' + fqdn + '.');
    return json({ ok: true, fqdn, status: 'active', files: extracted.length, bytes: rawTotal });
}

// ═══════════════════════ 路由 ═══════════════════════

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;
        const db = env.DB;

        // 静态资源（ASSETS binding）
        if (!path.startsWith('/api/') && path !== '/oauth') {
            return env.ASSETS.fetch(request);
        }

        try {
            // ── 编码闸门：所有写请求先按严格 UTF-8 体检（GBK 字节直接 415）──
            if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
                const bad = await rejectBadEncoding(request);
                if (bad) return bad;
            }

            // ── 公开元端点（无需登录；供生态服务与健康检查使用）──
            if (path === '/api/health' && method === 'GET') {
                let dbOk = false;
                try { await db.prepare('SELECT 1').first(); dbOk = true; } catch (e) {}
                return json({ status: dbOk ? 'ok' : 'degraded', db: dbOk, time: now() }, dbOk ? 200 : 503);
            }
            if (path === '/api/meta' && method === 'GET') {
                // 自描述 API 目录：端点清单 + 认证方式，第三方集成的入口文档
                return json({
                    name: 'ErisPulse Workbench API', version: 2,
                    auth: { type: 'Bearer', session: '登录会话', pat: 'epat_ 前缀访问令牌', oauth: 'GET /oauth/authorize → POST /oauth/token' },
                    public: [
                        ['GET', '/api/health'], ['GET', '/api/meta'], ['GET', '/api/config'],
                        ['GET', '/api/modules', '支持 ?q= 模糊搜索 / ?name= / ?type= / ?verified='],
                        ['GET', '/api/modules/stats'], ['GET', '/api/userinfo', 'OAuth token'],
                        ['GET', '/api/avatar/:uid'],
                        ['GET', '/api/public/domains', 'active hosted domains per module (?module=, public display)'],
                    ],
                    authed: [
                        ['GET', '/api/me'], ['PATCH', '/api/me'],
                        ['POST', '/api/modules/submit', 'totp_code（2FA 宽限/免码令牌除外）'],
                        ['POST', '/api/modules/manage'], ['POST', '/api/modules/batch'],
                        ['GET', '/api/modules/ops', '?name=&type= 或缺省查自己'],
                        ['POST', '/api/modules/claim'], ['GET', '/api/modules/claims'],
                        ['GET', '/api/domains', 'my hosted domains; staff can pass ?all=1'],
                        ['GET', '/api/domains/check', 'label availability via ?label='],
                        ['POST', '/api/domains', 'request a hosted domain {module_name, module_type, mode: git|redirect|dns, ...}'],
                        ['POST', '/api/domains/:label/verify'], ['POST', '/api/domains/:label/manage', 'action: pause/resume/delete/update'],
                        ['GET', '/api/ecosystem'], ['GET', '/api/release'],
                        ['GET', '/api/tokens'], ['POST', '/api/tokens', '{name, skip_2fa, totp_code?}'],
                        ['POST', '/api/tokens/:id/revoke'],
                        ['GET', '/api/clients'], ['POST', '/api/clients'], ['POST', '/api/clients/:id/(delete|secret)'],
                    ],
                    errors: { TOTP_REQUIRED: 428, AUTH_REQUIRED: 401, FORBIDDEN: 403, ENCODING_INVALID: 415 },
                });
            }
            const mu = path.match(/^\/api\/users\/(u_[a-f0-9]+)$/);
            if (mu && method === 'GET') {
                // 公开用户资料（身份集成场景）：不含邮箱
                const u = await db.prepare("SELECT uid, username, display_name, role, avatar_url, avatar_blob, bio, created_at FROM users WHERE uid=?1 AND status != 'banned'").bind(mu[1]).first();
                if (!u) return fail('NOT_FOUND', 404, '用户不存在');
                return json({ user: publicUser(u) });
            }
            if (path === '/api/modules/stats' && method === 'GET') {
                // 生态统计：总数/验证分布/类型分布/分类分布/热门标签（面板与第三方可用）
                const r = await listModules(env, request);
                if (r.error) return r.error;
                const data = await r.json().catch(() => ({}));
                const mods = data.modules || [];
                const byType = {}, byCat = {}, tagCount = {};
                for (const x of mods) {
                    byType[x.type] = (byType[x.type] || 0) + 1;
                    byCat[x.category] = (byCat[x.category] || 0) + 1;
                    for (const tg of (x.tags || [])) tagCount[tg] = (tagCount[tg] || 0) + 1;
                }
                const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 12)
                    .map(([tag, n]) => ({ tag, count: n }));
                return json({
                    total: mods.length,
                    verified: mods.filter(x => x.verified).length,
                    unverified: mods.filter(x => !x.verified).length,
                    by_type: byType, by_category: byCat, top_tags: topTags,
                });
            }

            // ── 登录方式可用性（前端据此渲染）──
            if (path === '/api/config' && method === 'GET') {
                return json({
                    oauth: Object.fromEntries(Object.entries(OAUTH_UPSTREAM).map(([k, c]) => [k, !!(env[c.envId] && env[c.envSecret])])),
                    oauthClientIds: Object.fromEntries(Object.entries(OAUTH_UPSTREAM).map(([k, c]) => [k, env[c.envId] || ''])),
                    smtp: !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
                });
            }

            // ── 注册前发送邮箱验证码（邮箱所有权必须验证）──
            if (path === '/api/auth/email/register/code' && method === 'POST') {
                const b = await request.json().catch(() => ({}));
                const email = String(b.email || '').trim().toLowerCase();
                if (!EMAIL_RE.test(email)) return fail('VALIDATION', 400, '邮箱格式不正确');
                if (await db.prepare('SELECT 1 FROM users WHERE email=?1').bind(email).first()) return fail('CONFLICT', 409, '邮箱已注册，请直接登录');
                const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
                const sent = await smtpSend(env, email, 'ErisPulse Workbench 注册验证码 / sign-up code: ' + code,
                    '你的注册验证码 / Your sign-up code: ' + code + '（10 分钟内有效 / valid for 10 minutes）');
                if (!sent) return fail('EMAIL_UNAVAILABLE', 503, '邮件服务未配置，暂时无法注册');
                await db.prepare(
                    "INSERT INTO email_codes (email, code_hash, purpose, expires_at) VALUES (?1,?2,'register',?3) " +
                    "ON CONFLICT(email) DO UPDATE SET code_hash=?2, purpose='register', expires_at=?3"
                ).bind(email, await sha256(email + ':' + code), new Date(Date.now() + CODE_TTL_MS).toISOString()).run();
                return json({ ok: true });
            }

            // ── 邮箱注册：username + email + password + 邮箱验证码（验证通过才建号）──
            if (path === '/api/auth/email/register' && method === 'POST') {
                const b = await request.json().catch(() => ({}));
                const username = sanitizeUsername(b.username);
                const email = String(b.email || '').trim().toLowerCase();
                if (!username) return fail('VALIDATION', 400, '用户名需 2-24 位字母/数字/_/-');
                if (!EMAIL_RE.test(email)) return fail('VALIDATION', 400, '邮箱格式不正确');
                if (!b.password || String(b.password).length < 8) return fail('VALIDATION', 400, '密码至少 8 位');
                if (await db.prepare('SELECT 1 FROM users WHERE username=?1').bind(username).first()) return fail('CONFLICT', 409, '用户名已被占用');
                if (await db.prepare('SELECT 1 FROM users WHERE email=?1').bind(email).first()) return fail('CONFLICT', 409, '邮箱已注册，请直接登录');
                const ec = await db.prepare("SELECT * FROM email_codes WHERE email=?1 AND purpose='register'").bind(email).first();
                if (!ec || ec.expires_at < now()) return fail('CODE_EXPIRED', 400, '请先获取邮箱验证码');
                if (await sha256(email + ':' + String(b.code || '').trim()) !== ec.code_hash) return fail('CODE_WRONG', 400, '验证码不正确');
                const count = (await db.prepare('SELECT COUNT(*) AS n FROM users').first()).n;
                const uid = 'u_' + randomHex(6);
                await db.prepare('INSERT INTO users (uid, username, display_name, role, email, email_verified, password_hash, created_at) VALUES (?,?,?,?,?,1,?,?)')
                    .bind(uid, username, username, count === 0 ? 'admin' : 'user', email, await hashPassword(String(b.password)), now()).run();
                await db.prepare('DELETE FROM email_codes WHERE email=?1').bind(email).run();
                const token = await createSession(db, uid);
                await audit(db, uid, 'register', uid, 'email');
                return json({ token, user: publicUser(await db.prepare('SELECT * FROM users WHERE uid=?1').bind(uid).first()) });
            }

            // ── 邮箱登录：identifier（用户名或邮箱）+ 密码直登；无密码则发验证码 ──
            if (path === '/api/auth/email/login' && method === 'POST') {
                const b = await request.json().catch(() => ({}));
                const ident = String(b.identifier || b.email || '').trim();
                let u;
                if (ident.includes('@')) {
                    const email = ident.toLowerCase();
                    if (!EMAIL_RE.test(email)) return fail('VALIDATION', 400, '邮箱格式不正确');
                    u = await db.prepare('SELECT * FROM users WHERE email=?1').bind(email).first();
                } else {
                    const username = sanitizeUsername(ident);
                    if (!username) return fail('VALIDATION', 400, '请输入用户名或邮箱');
                    u = await db.prepare('SELECT * FROM users WHERE username=?1').bind(username).first();
                }
                if (!u) return fail('NOT_FOUND', 404, '账户不存在，请先注册');
                if (u.status === 'banned') return fail('BANNED', 403, '账户已被封禁');
                if (b.password) {
                    if (!u.password_hash) return fail('NO_PASSWORD', 400, '该账户未设置密码，请用验证码或 OAuth 登录');
                    if (!(await verifyPassword(String(b.password), u.password_hash))) return fail('BAD_CREDENTIALS', 401, '账号或密码不正确');
                    if (u.totp_enabled) return json({ twofa_required: true, challenge: await startTwofaChallenge(db, u.uid) });
                    return json({ token: await createSession(db, u.uid), user: publicUser(u) });
                }
                // 验证码模式：验证码发到账户绑定邮箱
                if (!u.email) return fail('NO_EMAIL', 400, '该账户未绑定邮箱，请先在账号设置中绑定，或改用密码 / OAuth 登录');
                const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
                const sent = await smtpSend(env, u.email, 'ErisPulse Workbench 验证码 / verification code: ' + code,
                    '你的验证码 / Your code: ' + code + '（10 分钟内有效 / valid for 10 minutes）');
                if (!sent) return fail('EMAIL_UNAVAILABLE', 503, '邮件服务未配置，请使用密码或 OAuth 登录');
                await db.prepare('UPDATE users SET verify_code_hash=?, verify_expires_at=? WHERE uid=?')
                    .bind(await sha256(u.email + ':' + code), new Date(Date.now() + CODE_TTL_MS).toISOString(), u.uid).run();
                return json({ ok: true, verify_required: true });
            }

            // ── 验证码校验登录：identifier 定位账户，验证码与账户绑定邮箱配对 ──
            if (path === '/api/auth/email/verify' && method === 'POST') {
                const b = await request.json().catch(() => ({}));
                const ident = String(b.identifier || b.email || '').trim();
                const u = ident.includes('@')
                    ? await db.prepare('SELECT * FROM users WHERE email=?1').bind(ident.toLowerCase()).first()
                    : await db.prepare('SELECT * FROM users WHERE username=?1').bind(sanitizeUsername(ident)).first();
                if (!u || !u.verify_code_hash || u.verify_expires_at < now()) return fail('CODE_EXPIRED', 400, '验证码已过期，请重新发送');
                if (await sha256(u.email + ':' + String(b.code || '').trim()) !== u.verify_code_hash) return fail('CODE_WRONG', 400, '验证码不正确');
                await db.prepare('UPDATE users SET email_verified=1, verify_code_hash=NULL, verify_expires_at=NULL WHERE uid=?').bind(u.uid).run();
                if (u.totp_enabled) return json({ twofa_required: true, challenge: await startTwofaChallenge(db, u.uid) });
                return json({ token: await createSession(db, u.uid), user: publicUser(u) });
            }

            // ── 两步验证：挑战票据 + TOTP 码 → 换正式会话 ──
            if (path === '/api/auth/email/2fa' && method === 'POST') {
                const b = await request.json().catch(() => ({}));
                const ch = b.challenge ? await db.prepare('SELECT * FROM twofa_challenges WHERE token_hash=?1').bind(await sha256(String(b.challenge))).first() : null;
                if (!ch || ch.expires_at < now()) return fail('CHALLENGE_EXPIRED', 400, '验证会话已过期，请重新登录');
                const u = await db.prepare('SELECT * FROM users WHERE uid=?1').bind(ch.uid).first();
                if (!u || !u.totp_enabled) return fail('VALIDATION', 400, '该账户未开启两步验证');
                if (!(await verifyTotp(u.totp_secret, b.code))) return fail('CODE_WRONG', 400, '动态码不正确');
                await db.prepare('DELETE FROM twofa_challenges WHERE token_hash=?1').bind(ch.token_hash).run();
                return json({ token: await createSession(db, u.uid), user: publicUser(u) });
            }

            // ── 上游 OAuth 登录（access_token 直登或 code 兑换）──
            let m = path.match(/^\/api\/auth\/oauth\/(github|codeberg|yunhu)\/login$/);
            if (m && method === 'POST') {
                const b = await request.json().catch(() => ({}));
                if (!b.access_token && !b.code) return fail('VALIDATION', 400, '缺少 code 或 access_token');
                try {
                    const ident = await upstreamIdentity(env, m[1], b.access_token || b.code, !!b.access_token);
                    if (!ident) return fail('OAUTH_UNCONFIGURED', 503, '该登录方式未配置');
                    const res = await findOrCreateUser(db, m[1], ident);
                    if (res.conflict) return fail('EMAIL_TAKEN', 409, '该邮箱已属于其他账户且未验证——请先用原方式登录，再在「账号设置」中绑定当前登录方式');
                    const { user } = res;
                    await audit(db, user.uid, 'login', user.uid, m[1]);
                    return json({ token: await createSession(db, user.uid), user: publicUser(user) });
                } catch (e) {
                    return fail('OAUTH_FAILED', 502, String(e.message || e).slice(0, 200));
                }
            }

            // ── OAuth Provider：授权入口 / 决策 / 换令牌 / userinfo ──
            if (path === '/oauth/authorize' && method === 'GET') {
                const client = await db.prepare('SELECT * FROM oauth_clients WHERE client_id=?1').bind(url.searchParams.get('client_id') || '').first();
                const redirectUri = url.searchParams.get('redirect_uri') || '';
                if (!client || !JSON.parse(client.redirect_uris).includes(redirectUri)) {
                    return new Response('invalid client or redirect_uri', { status: 400 });
                }
                const user = await currentUser(db, request);
                // 未登录：跳回前端登录页，携授权参数（前端登录成功后回跳本入口）
                if (!user) {
                    const back = url.origin + url.pathname + url.searchParams.toString();
                    return Response.redirect(url.origin + '/#login?next=' + encodeURIComponent(back), 302);
                }
                // 已登录：返回确认页（内联极简 HTML，与前端同风格）
                const state = url.searchParams.get('state') || '';
                const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>授权确认</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:#f6f7f9;color:#0f1419;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{background:rgba(255,255,255,.82);backdrop-filter:blur(20px);border:1px solid #e5e8ec;border-radius:20px;box-shadow:0 24px 64px -24px rgba(15,23,42,.3);padding:2.2rem 2.4rem;max-width:380px;text-align:center}
h1{font-size:1.15rem;margin:0 0 .5rem}p{font-size:.9rem;color:#5f6b7a;margin:0 0 1.4rem;line-height:1.6}
b{color:#4aa3dd}
button{border:none;border-radius:999px;padding:.7rem 1.6rem;font-size:.95rem;font-weight:600;cursor:pointer;margin:0 .35rem}
.ok{background:#3a94d0;color:#fff}.no{background:#eef0f3;color:#5f6b7a}
</style></head><body><div class="box"><h1>授权登录确认</h1>
<p><b>${client.name}</b> 请求以 <b>@${user.username}</b> 的身份访问你的 ErisPulse 账户信息（用户名、昵称、角色）。</p>
<div><button class="ok" onclick="go(1)">允许</button><button class="no" onclick="go(0)">拒绝</button></div></div>
<script>function go(allow){fetch('/oauth/authorize/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_id:'${client.client_id}',redirect_uri:'${redirectUri.replace(/'/g, "\\'")}',state:'${state.replace(/'/g, "\\'")}',allow})}).then(r=>r.json()).then(d=>{if(d.redirect)location.href=d.redirect;else alert(d.message||'failed')})}</script>
</body></html>`;
                return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
            }

            if (path === '/oauth/authorize/decision' && method === 'POST') {
                const user = await currentUser(db, request);
                if (!user) return fail('AUTH_REQUIRED', 401, '请先登录');
                const b = await request.json().catch(() => ({}));
                const client = await db.prepare('SELECT * FROM oauth_clients WHERE client_id=?1').bind(b.client_id || '').first();
                if (!client || !JSON.parse(client.redirect_uris).includes(b.redirect_uri || '')) return fail('VALIDATION', 400, 'invalid client');
                const u = new URL(b.redirect_uri);
                if (!b.allow) { u.searchParams.set('error', 'access_denied'); return json({ redirect: u.toString() }); }
                const code = randomHex(20);
                await db.prepare('INSERT INTO oauth_codes (code_hash, client_id, uid, redirect_uri, expires_at) VALUES (?,?,?,?,?)')
                    .bind(await sha256(code), client.client_id, user.uid, b.redirect_uri, new Date(Date.now() + 600000).toISOString()).run();
                await audit(db, user.uid, 'oauth.authorize', client.client_id, '');
                u.searchParams.set('code', code);
                if (b.state) u.searchParams.set('state', b.state);
                return json({ redirect: u.toString() });
            }

            if (path === '/oauth/token' && method === 'POST') {
                const b = await request.json().catch(() => ({}));
                const client = await db.prepare('SELECT * FROM oauth_clients WHERE client_id=?1').bind(b.client_id || '').first();
                if (!client || await sha256(b.client_secret || '') !== client.client_secret_hash) return fail('BAD_CLIENT', 401, 'client 凭证不正确');
                const row = await db.prepare('SELECT * FROM oauth_codes WHERE code_hash=?1 AND client_id=?2').bind(await sha256(b.code || ''), client.client_id).first();
                if (!row || row.expires_at < now()) return fail('CODE_EXPIRED', 400, 'code 无效或已过期');
                await db.prepare('DELETE FROM oauth_codes WHERE code_hash=?1').bind(row.code_hash).run();
                const token = randomHex(24);
                await db.prepare('INSERT INTO oauth_tokens (token_hash, client_id, uid, expires_at) VALUES (?,?,?,?)')
                    .bind(await sha256(token), client.client_id, row.uid, new Date(Date.now() + OAUTH_TOKEN_TTL_S * 1000).toISOString()).run();
                return json({ access_token: token, token_type: 'Bearer', expires_in: OAUTH_TOKEN_TTL_S });
            }

            if (path === '/api/userinfo' && method === 'GET') {
                const m2 = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
                if (!m2) return fail('AUTH_REQUIRED', 401);
                const t = await db.prepare('SELECT * FROM oauth_tokens WHERE token_hash=?1 AND revoked=0 AND expires_at>?2').bind(await sha256(m2[1]), now()).first();
                if (!t) return fail('AUTH_REQUIRED', 401, '令牌无效');
                const u = await db.prepare('SELECT * FROM users WHERE uid=?1').bind(t.uid).first();
                const origin = new URL(request.url).origin;
                const avatarUrl = u.avatar_blob ? (origin + '/api/avatar/' + u.uid) : (u.avatar_url || '');
                return json({ uid: u.uid, username: u.username, display_name: u.display_name, role: u.role, avatar_url: avatarUrl, email: u.email_verified ? u.email : null });
            }

            // ── 头像公开读取（img 标签无法携带 Authorization；头像非敏感信息）──
            m = path.match(/^\/api\/avatar\/([\w]+)$/);
            if (m && method === 'GET') {
                const u = await db.prepare('SELECT avatar_blob, avatar_mime FROM users WHERE uid = ?1').bind(m[1]).first();
                if (!u || !u.avatar_blob) return fail('NOT_FOUND', 404);
                return new Response(Uint8Array.from(atob(u.avatar_blob), c => c.charCodeAt(0)), {
                    headers: { 'Content-Type': u.avatar_mime || 'image/webp', 'Cache-Control': 'public, max-age=600' },
                });
            }

            // ── 公开：模块托管域名（仅 active；市场/生态展示用，无需登录）──
            if (path === '/api/public/domains' && method === 'GET') {
                await ensureTables(db);
                const mod = url.searchParams.get('module') || '';
                let sql = "SELECT fqdn, label, module_name, module_type FROM module_domains WHERE status = 'active'";
                if (mod) sql += ' AND module_name = ?1';
                sql += ' LIMIT 100';
                const q = mod ? db.prepare(sql).bind(mod) : db.prepare(sql);
                const rows = await q.all();
                return json({ domains: rows.results });
            }

            // ═══ 以下需要登录 ═══
            const me = await currentUser(db, request);
            if (!me) return fail('AUTH_REQUIRED', 401, '请先登录');
            if (me.status === 'banned') return fail('BANNED', 403);

            if (path === '/api/auth/logout' && method === 'POST') {
                const m3 = (request.headers.get('Authorization') || '').match(/^Bearer\s+(.+)$/i);
                if (m3) await db.prepare('DELETE FROM sessions WHERE token_hash=?1').bind(await sha256(m3[1])).run();
                return json({ ok: true });
            }

            if (path === '/api/me' && method === 'GET') {
                const idents = await db.prepare('SELECT provider, provider_uid FROM identities WHERE uid=?1').bind(me.uid).all();
                return json({ user: publicUser(me), identities: idents.results });
            }
            if (path === '/api/me' && method === 'PATCH') {
                const b = await request.json().catch(() => ({}));
                if (b.display_name !== undefined) {
                    const dn = String(b.display_name).trim().slice(0, 40);
                    if (!dn) return fail('VALIDATION', 400, '昵称不能为空');
                    await db.prepare('UPDATE users SET display_name=?1 WHERE uid=?2').bind(dn, me.uid).run();
                }
                if (b.password && (!b.old_password || !me.password_hash || await verifyPassword(String(b.old_password), me.password_hash))) {
                    if (String(b.password).length < 8) return fail('VALIDATION', 400, '新密码至少 8 位');
                    await db.prepare('UPDATE users SET password_hash=?1 WHERE uid=?2').bind(await hashPassword(String(b.password)), me.uid).run();
                } else if (b.password) return fail('BAD_CREDENTIALS', 401, '当前密码不正确');
                return json({ ok: true });
            }
            if (path === '/api/me/avatar' && method === 'POST') {
                const b = await request.json().catch(() => ({}));
                const m4 = String(b.data_url || '').match(/^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
                if (!m4) return fail('VALIDATION', 400, '仅支持 webp/jpeg/png');
                if (m4[2].length * 3 / 4 > AVATAR_MAX) return fail('TOO_LARGE', 413, '头像需 ≤1MB');
                await db.prepare('UPDATE users SET avatar_blob=?, avatar_mime=? WHERE uid=?').bind(m4[2], m4[1], me.uid).run();
                return json({ ok: true });
            }

            // ── 两步验证管理：初始化（不生效）/ 确认开启 / 关闭 ──
            if (path === '/api/me/totp/setup' && method === 'POST') {
                if (me.totp_enabled) return fail('CONFLICT', 409, '两步验证已开启，如需重置请先关闭');
                const secret = base32Encode(crypto.getRandomValues(new Uint8Array(20)));
                await db.prepare('UPDATE users SET totp_secret=?1, totp_enabled=0 WHERE uid=?2').bind(secret, me.uid).run();
                const label = encodeURIComponent('ErisPulse Workbench:' + me.username);
                return json({ secret, otpauth: 'otpauth://totp/' + label + '?issuer=ErisPulse%20Workbench&secret=' + secret });
            }
            if (path === '/api/me/totp/enable' && method === 'POST') {
                const b = await request.json().catch(() => ({}));
                if (!me.totp_secret) return fail('VALIDATION', 400, '请先获取密钥');
                if (!(await verifyTotp(me.totp_secret, b.code))) return fail('CODE_WRONG', 400, '动态码不正确，请确认认证器时间同步');
                await db.prepare('UPDATE users SET totp_enabled=1 WHERE uid=?1').bind(me.uid).run();
                await audit(db, me.uid, 'totp.enable', me.uid, '');
                return json({ ok: true });
            }
            if (path === '/api/me/totp/disable' && method === 'POST') {
                const b = await request.json().catch(() => ({}));
                if (!me.totp_enabled) return fail('VALIDATION', 400, '两步验证未开启');
                if (!(await verifyTotp(me.totp_secret, b.code))) return fail('CODE_WRONG', 400, '动态码不正确');
                await db.prepare('UPDATE users SET totp_secret=NULL, totp_enabled=0 WHERE uid=?1').bind(me.uid).run();
                await audit(db, me.uid, 'totp.disable', me.uid, '');
                return json({ ok: true });
            }
            // ═══ 访问令牌（开放 API / CLI）═══
            if (path === '/api/tokens' && method === 'GET') {
                const rows = await db.prepare(
                    'SELECT id, name, prefix, skip_2fa, created_at, last_used_at FROM personal_tokens WHERE uid = ?1 AND revoked = 0 ORDER BY id DESC'
                ).bind(me.uid).all();
                return json({ tokens: rows.results });
            }
            if (path === '/api/tokens' && method === 'POST') {
                const b = await request.json().catch(() => ({}));
                const name = String(b.name || '').trim().slice(0, 40) || 'token';
                const count = (await db.prepare('SELECT COUNT(*) AS n FROM personal_tokens WHERE uid = ?1 AND revoked = 0').bind(me.uid).first()).n;
                if (count >= 10) return fail('LIMIT', 400, '最多 10 个有效令牌');
                // 免码令牌 = 高权限凭证：开启 2FA 的账户必须当场验证一次动态码（宽限不适用）
                const skip2fa = b.skip_2fa ? 1 : 0;
                if (skip2fa && me.totp_enabled && !(await verifyTotp(me.totp_secret, b.totp_code))) {
                    return fail('TOTP_REQUIRED', 428, '开启免码令牌需要当场验证动态码');
                }
                const token = 'epat_' + randomHex(20);
                await db.prepare('INSERT INTO personal_tokens (uid, name, token_hash, prefix, skip_2fa, created_at) VALUES (?,?,?,?,?,?)')
                    .bind(me.uid, name, await sha256(token), token.slice(0, 12) + '…', skip2fa, now()).run();
                if (skip2fa && me.totp_enabled) {
                    await db.prepare('UPDATE users SET totp_last_ok=?1 WHERE uid=?2').bind(now(), me.uid).run().catch(() => {});
                }
                await audit(db, me.uid, 'token.create', name, skip2fa ? 'skip_2fa' : '');
                return json({ token: token, name: name, skip_2fa: !!skip2fa });
            }
            let tm = path.match(/^\/api\/tokens\/(\d+)\/revoke$/);
            if (tm && method === 'POST') {
                await db.prepare('UPDATE personal_tokens SET revoked = 1 WHERE id = ?1 AND uid = ?2').bind(+tm[1], me.uid).run();
                await audit(db, me.uid, 'token.revoke', tm[1], '');
                return json({ ok: true });
            }

            // ═══ 模块归属认领 ═══
            if (path === '/api/modules/claim' && method === 'POST') {
                const b = await request.json().catch(() => ({}));
                if (!b.name || !b.type) return fail('VALIDATION', 400, '参数不完整');
                // 已是所有者（含 OAuth 自动认领）则无需申请
                const pkgResp = await fetch('https://raw.githubusercontent.com/ErisPulse/ErisPulse-ModuleRepo/2x/packages.json', { cf: { cacheEverything: true, cacheTtl: 120 } });
                if (!pkgResp.ok) return fail('UPSTREAM', 502, 'packages.json 获取失败');
                const packages = await pkgResp.json();
                const container = b.type === 'adapter' ? 'adapters' : 'modules';
                const info = (packages[container] || {})[b.name];
                if (!info) return fail('NOT_FOUND', 404, '模块不存在');
                const uids = await myUids();
                if (uids.has(info.submitted_by_uid || '')) return fail('ALREADY_OWNER', 400, '你已是该模块的所有者');
                // 同一模块同一用户仅一条进行中申请
                const dup = await db.prepare(
                    "SELECT 1 FROM module_claims WHERE uid = ?1 AND module_name = ?2 AND status = 'pending'"
                ).bind(me.uid, b.name).first();
                if (dup) return fail('DUP', 409, '已有进行中的认领申请');
                await db.prepare('INSERT INTO module_claims (uid, module_name, module_type, reason, created_at) VALUES (?,?,?,?,?)')
                    .bind(me.uid, b.name, b.type, String(b.reason || '').slice(0, 500), now()).run();
                await audit(db, me.uid, 'claim.submit', b.name, '');
                return json({ ok: true });
            }
            if (path === '/api/modules/claims' && method === 'GET') {
                const rows = await db.prepare(
                    'SELECT c.id, c.module_name, c.module_type, c.reason, c.status, c.created_at, u.username FROM module_claims c JOIN users u ON u.uid = c.uid WHERE c.uid = ?1 ORDER BY c.id DESC LIMIT 20'
                ).bind(me.uid).all();
                return json({ claims: rows.results });
            }

            // ═══ 生态动态（GitHub 匿名 + 边缘缓存）═══
            if (path === '/api/ecosystem' && method === 'GET') {
                const gh = (u) => fetch(u, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ErisPulse-Workbench' }, cf: { cacheEverything: true, cacheTtl: 1800 } });
                const [rel, iss] = await Promise.all([
                    gh('https://api.github.com/repos/ErisPulse/ErisPulse/releases?per_page=5').then(r => r.ok ? r.json() : []).catch(() => []),
                    gh('https://api.github.com/repos/ErisPulse/ErisPulse/issues?state=open&per_page=8').then(r => r.ok ? r.json() : []).catch(() => []),
                ]);
                return json({
                    releases: (rel || []).map(r => ({ tag: r.tag_name, name: r.name, url: r.html_url, date: (r.published_at || '').slice(0, 10) })),
                    issues: (iss || []).filter(i => !i.pull_request).map(i => ({ number: i.number, title: i.title, url: i.html_url, comments: i.comments, updated: (i.updated_at || '').slice(0, 10) })),
                });
            }

            // ═══ OAuth 接入应用（所有登录用户自助登记；staff 可见全部）═══
            if (path === '/api/clients' && method === 'GET') {
                const staffView = isStaff(me);
                const rows = staffView
                    ? await db.prepare('SELECT client_id, name, redirect_uris, created_by, created_at FROM oauth_clients ORDER BY created_at DESC LIMIT 200').all()
                    : await db.prepare('SELECT client_id, name, redirect_uris, created_by, created_at FROM oauth_clients WHERE created_by = ?1 ORDER BY created_at DESC LIMIT 50').bind(me.uid).all();
                return json({ clients: rows.results, is_staff: staffView });
            }
            if (path === '/api/clients' && method === 'POST') {
                const b = await request.json().catch(() => ({}));
                const name = String(b.name || '').trim().slice(0, 60);
                const uris = (Array.isArray(b.redirect_uris) ? b.redirect_uris : []).map(u => String(u).trim()).filter(u => /^https:\/\/[^\s]+$/.test(u)).slice(0, 5);
                if (!name) return fail('VALIDATION', 400, '请填写应用名称');
                if (!uris.length) return fail('VALIDATION', 400, '至少一个 https:// 回调地址');
                const cnt = (await db.prepare('SELECT COUNT(*) AS n FROM oauth_clients WHERE created_by = ?1').bind(me.uid).first()).n;
                if (cnt >= 5) return fail('LIMIT', 429, '每个账户最多登记 5 个应用');
                const clientId = 'ep_' + randomHex(8);
                const clientSecret = 'eps_' + randomHex(20);
                await db.prepare('INSERT INTO oauth_clients (client_id, client_secret_hash, name, redirect_uris, created_by, created_at) VALUES (?,?,?,?,?,?)')
                    .bind(clientId, await sha256(clientSecret), name, JSON.stringify(uris), me.uid, now()).run();
                await audit(db, me.uid, 'client.create', clientId, name);
                return json({ client_id: clientId, client_secret: clientSecret }); // secret 仅此一次返回
            }
            m = path.match(/^\/api\/clients\/([\w]+)\/(delete|secret)$/);
            if (m && method === 'POST') {
                const c = await db.prepare('SELECT * FROM oauth_clients WHERE client_id=?1').bind(m[1]).first();
                if (!c) return fail('NOT_FOUND', 404, '应用不存在');
                if (c.created_by !== me.uid && !isStaff(me)) return fail('FORBIDDEN', 403, '无权操作该应用');
                if (m[2] === 'delete') {
                    await db.prepare('DELETE FROM oauth_clients WHERE client_id=?1').bind(m[1]).run();
                    await db.prepare('DELETE FROM oauth_tokens WHERE client_id=?1').bind(m[1]).run();
                    await audit(db, me.uid, 'client.delete', m[1], c.name);
                    return json({ ok: true });
                }
                const secret = 'eps_' + randomHex(20);
                await db.prepare('UPDATE oauth_clients SET client_secret_hash=?1 WHERE client_id=?2').bind(await sha256(secret), m[1]).run();
                await audit(db, me.uid, 'client.secret', m[1], c.name);
                return json({ client_secret: secret }); // 新 secret 仅此一次返回
            }

            // ═══ 管理员 ═══
            if (path.startsWith('/api/admin/')) {
                if (!isStaff(me)) return fail('FORBIDDEN', 403, '仅管理员可用');

                if (path === '/api/admin/users' && method === 'GET') {
                    const rows = await db.prepare('SELECT uid, username, display_name, role, status, email, email_verified, created_at FROM users ORDER BY created_at DESC LIMIT 200').all();
                    return json({ users: rows.results });
                }
                m = path.match(/^\/api\/admin\/users\/([\w]+)\/(role|ban)$/);
                if (m && method === 'POST') {
                    const b = await request.json().catch(() => ({}));
                    if (m[2] === 'role') {
                        if (!['admin', 'mod', 'user'].includes(b.role)) return fail('VALIDATION', 400, '非法角色');
                        if (m[1] === me.uid && b.role !== 'admin') return fail('VALIDATION', 400, '不能降级自己');
                        await db.prepare('UPDATE users SET role=?1 WHERE uid=?2').bind(b.role, m[1]).run();
                        await audit(db, me.uid, 'user.role', m[1], b.role);
                    } else {
                        if (m[1] === me.uid) return fail('VALIDATION', 400, '不能封禁自己');
                        await db.prepare('UPDATE users SET status=?1 WHERE uid=?2').bind(b.banned ? 'banned' : 'ok', m[1]).run();
                        if (b.banned) await db.prepare('DELETE FROM sessions WHERE uid=?1').bind(m[1]).run();
                        await audit(db, me.uid, 'user.ban', m[1], String(!!b.banned));
                    }
                    return json({ ok: true });
                }

                // OAuth 接入应用登记
                if (path === '/api/admin/clients' && method === 'GET') {
                    const rows = await db.prepare('SELECT client_id, name, redirect_uris, created_at FROM oauth_clients ORDER BY created_at DESC').all();
                    return json({ clients: rows.results });
                }
                if (path === '/api/admin/clients' && method === 'POST') {
                    const b = await request.json().catch(() => ({}));
                    const name = String(b.name || '').trim().slice(0, 40);
                    const uris = (Array.isArray(b.redirect_uris) ? b.redirect_uris : []).filter(u => /^https:\/\//.test(u)).slice(0, 5);
                    if (!name || !uris.length) return fail('VALIDATION', 400, '需要名称与 https 回调地址');
                    const clientId = 'ep_' + randomHex(8);
                    const clientSecret = 'eps_' + randomHex(20);
                    await db.prepare('INSERT INTO oauth_clients (client_id, client_secret_hash, name, redirect_uris, created_by, created_at) VALUES (?,?,?,?,?,?)')
                        .bind(clientId, await sha256(clientSecret), name, JSON.stringify(uris), me.uid, now()).run();
                    await audit(db, me.uid, 'client.create', clientId, name);
                    return json({ client_id: clientId, client_secret: clientSecret }); // secret 仅此一次返回
                }

                // 认领审核
                if (path === '/api/admin/claims' && method === 'GET') {
                    const rows = await db.prepare(
                        "SELECT c.id, c.uid, c.module_name, c.module_type, c.reason, c.status, c.created_at, u.username, u.email FROM module_claims c JOIN users u ON u.uid = c.uid WHERE c.status = 'pending' ORDER BY c.id ASC LIMIT 50"
                    ).all();
                    return json({ claims: rows.results });
                }
                let cm = path.match(/^\/api\/admin\/claims\/(\d+)\/(approve|reject)$/);
                if (cm && method === 'POST') {
                    const claim = await db.prepare('SELECT * FROM module_claims WHERE id = ?1').bind(+cm[1]).first();
                    if (!claim || claim.status !== 'pending') return fail('NOT_FOUND', 404, '申请不存在或已处理');
                    if (cm[2] === 'approve') {
                        // 所有权转移：submitter 改绑到申请人的工作台 uid
                        const claimer = await db.prepare('SELECT * FROM users WHERE uid = ?1').bind(claim.uid).first();
                        const token = env.MODULE_REPO_TOKEN;
                        if (!token) return fail('UNCONFIGURED', 503, '未配置 MODULE_REPO_TOKEN');
                        const resp = await fetch('https://api.github.com/repos/ErisPulse/ErisPulse-ModuleRepo/dispatches', {
                            method: 'POST',
                            headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'ErisPulse-Workbench' },
                            body: JSON.stringify({
                                event_type: 'manage_module',
                                client_payload: {
                                    action: 'edit', name: claim.module_name, type: claim.module_type, uids: await myUidsJson(), staff: 1,
                                    edit_data: JSON.stringify({ submitter: JSON.stringify({ name: claimer.display_name || claimer.username, uid: 'wb:' + claimer.uid, provider: 'workbench' }) }),
                                },
                            }),
                        });
                        if (!resp.ok) return fail('UPSTREAM', 502, 'dispatch 失败: ' + resp.status);
                    }
                    await db.prepare('UPDATE module_claims SET status = ?1, handled_at = ?2, handled_by = ?3 WHERE id = ?4')
                        .bind(cm[2] === 'approve' ? 'approved' : 'rejected', now(), me.uid, claim.id).run();
                    await audit(db, me.uid, 'claim.' + cm[2], claim.module_name, claim.uid);
                    return json({ ok: true });
                }

                // 托管域名审核：approve 生效（dns 模式撤路由）；reject 清理全部资源并删行
                let dmr = path.match(/^\/api\/admin\/domains\/([a-z0-9-]{1,63})\/(approve|reject)$/);
                if (dmr && method === 'POST') {
                    const row = await db.prepare('SELECT * FROM module_domains WHERE fqdn = ?1').bind(domainFqdn(dmr[1])).first();
                    if (!row) return freason('NOT_FOUND', 404, 'domain_missing', 'domain not found');
                    if (row.status !== 'reviewing') return freason('VALIDATION', 400, 'bad_state', 'domain is not pending review');
                    if (dmr[2] === 'approve') {
                        // dns 模式：生效即撤路由（流量直达源站）
                        if (row.mode === 'dns' && row.route_id) {
                            try { await cfRouteApi(env, 'DELETE', null, row.route_id); await db.prepare('UPDATE module_domains SET route_id = ?1 WHERE fqdn = ?2').bind('', row.fqdn).run(); } catch (e) { /* 忽略 */ }
                        }
                        // upload 模式：开启公开访问
                        if (row.mode === 'upload' && row.r2_bucket) {
                            try { await r2SetDomainEnabled(env, row.r2_bucket, row.fqdn, true); } catch (e) { /* 忽略 */ }
                        }
                        await db.prepare("UPDATE module_domains SET status = 'active', updated_at = ?1 WHERE fqdn = ?2").bind(now(), row.fqdn).run();
                        await audit(db, me.uid, 'domain.approve', row.fqdn, row.uid);
                        notifyDomainEvent(env, db, row.uid, '[ErisPulse] 托管域名已通过审核 / Domain approved: ' + row.fqdn,
                            '你的模块「' + row.module_name + '」的托管域名已通过审核并生效，现在可以通过 https://' + row.fqdn + ' 访问。',
                            'The hosted domain for your module "' + row.module_name + '" was approved and is now live at https://' + row.fqdn + '.');
                        return json({ ok: true, status: 'active' });
                    }
                    // reject：按模式清理资源
                    if (env.CF_DNS_TOKEN) {
                        if (row.route_id) { try { await cfRouteApi(env, 'DELETE', null, row.route_id); } catch (e) { /* 忽略 */ } }
                        if (row.dns_record_id) { try { await cfDnsApi(env, 'DELETE', null, row.dns_record_id); } catch (e) { /* 忽略 */ } }
                    }
                    if (row.mode === 'upload' && row.r2_bucket) {
                        try { await r2DetachDomain(env, row.r2_bucket, row.fqdn); } catch (e) { /* 忽略 */ }
                        try { await r2EmptyBucket(env, db, row.r2_bucket); } catch (e) { /* 忽略 */ }
                        try { await r2DeleteBucket(env, row.r2_bucket); } catch (e) { /* 忽略 */ }
                    }
                    await db.prepare('DELETE FROM module_domains WHERE fqdn = ?1').bind(row.fqdn).run();
                    await audit(db, me.uid, 'domain.reject', row.fqdn, row.uid);
                    notifyDomainEvent(env, db, row.uid, '[ErisPulse] 托管域名未通过审核 / Domain rejected: ' + row.fqdn,
                        '你的模块「' + row.module_name + '」申请的托管域名未通过审核，相关资源已回收。如需再次申请请调整后重新提交。',
                        'The hosted domain request for your module "' + row.module_name + '" was rejected and its resources were released.');
                    return json({ ok: true, status: 'rejected' });
                }

                // 托管域名处置：disable 立即下线；enable 恢复为 paused（所有者自行恢复）
                let dma = path.match(/^\/api\/admin\/domains\/([a-z0-9-]{1,63})\/(disable|enable)$/);
                if (dma && method === 'POST') {
                    const row = await db.prepare('SELECT * FROM module_domains WHERE fqdn = ?1').bind(domainFqdn(dma[1])).first();
                    if (!row) return freason('NOT_FOUND', 404, 'domain_missing', 'domain not found');
                    const newStatus = dma[2] === 'disable' ? 'disabled' : 'paused';
                    // dns 模式停用时同步摘除 DNS 记录（无路由可拦，记录在即源站可达）
                    if (dma[2] === 'disable' && row.mode === 'dns' && row.dns_record_id && env.CF_DNS_TOKEN) {
                        try { await cfDnsApi(env, 'DELETE', null, row.dns_record_id); } catch (e) { /* 忽略 */ }
                        await db.prepare('UPDATE module_domains SET dns_record_id = ?1 WHERE fqdn = ?2').bind('', row.fqdn).run();
                    }
                    // upload 模式停用：关闭公开访问
                    if (dma[2] === 'disable' && row.mode === 'upload' && row.r2_bucket) {
                        try { await r2SetDomainEnabled(env, row.r2_bucket, row.fqdn, false); } catch (e) { /* 忽略 */ }
                    }
                    await db.prepare('UPDATE module_domains SET status = ?1, version = version + 1, updated_at = ?2 WHERE fqdn = ?3').bind(newStatus, now(), row.fqdn).run();
                    await audit(db, me.uid, 'domain.' + dma[2], row.fqdn, row.uid);
                    if (dma[2] === 'disable') {
                        notifyDomainEvent(env, db, row.uid, '[ErisPulse] 托管域名已被停用 / Domain disabled: ' + row.fqdn,
                            '你的模块「' + row.module_name + '」托管域名已被管理员停用。如认为存在误会，请联系管理员。',
                            'The hosted domain for your module "' + row.module_name + '" has been disabled by an admin. Contact the team if you believe this is a mistake.');
                    }
                    return json({ ok: true, status: newStatus });
                }

                if (path === '/api/admin/audit' && method === 'GET') {
                    const rows = await db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 100').all();
                    return json({ log: rows.results });
                }
            }

            // ═══ 模块管理（对接 ErisPulse-ModuleRepo）═══
            // 所有权：legacy 条目用 oauth uid（github:123），工作台提交用 wb:<uid>
            async function myUids() {
                const idents = await db.prepare('SELECT provider, provider_uid FROM identities WHERE uid=?1').bind(me.uid).all();
                return new Set([...(idents.results || []).map(r => r.provider + ':' + r.provider_uid), 'wb:' + me.uid]);
            }
            // 归属身份集合（数组形态，随 dispatch 下发）：同人 github:<id> 与 wb:<uid> 互通
            const myUidsJson = async () => JSON.stringify([...(await myUids())]);

            if (path === '/api/modules' && method === 'GET') {
                return await listModules(env, request);
            }

            // 操作状态查询：?name=&type= 查单个模块最近操作；缺省返回自己的最近操作
            if (path === '/api/modules/ops' && method === 'GET') {
                const name = url.searchParams.get('name');
                const type = url.searchParams.get('type') === 'adapter' ? 'adapter' : 'module';
                let rows;
                if (name) {
                    const r = await listModules(env, request);
                    if (r.error) return r.error;
                    const mod = (await r.json().catch(() => ({}))).modules || [];
                    const hit = mod.find(m => m.name === name && m.type === type);
                    if (!hit) return fail('NOT_FOUND', 404, '模块不存在');
                    if (!hit.mine && !isStaff(me)) return fail('FORBIDDEN', 403, '仅所有者或管理员可查看该模块的操作记录');
                    rows = await db.prepare('SELECT id, name, type, action, status, created_at FROM module_ops WHERE name=?1 AND type=?2 ORDER BY id DESC LIMIT 10')
                        .bind(name, type).all();
                } else {
                    rows = await db.prepare('SELECT id, name, type, action, status, created_at FROM module_ops WHERE owner_uid=?1 ORDER BY id DESC LIMIT 20')
                        .bind(me.uid).all();
                }
                return json({ ops: rows.results });
            }

            // ═══ 模块托管域名（<label>.plugin.erisdev.com）═══
            // git/redirect 模式只写 D1 即生效，dns 模式另经 Cloudflare API 建 proxied 记录

            // 可用性即时查询（前端输入框防抖调用）
            if (path === '/api/domains/check' && method === 'GET') {
                const label = String(url.searchParams.get('label') || '').trim().toLowerCase();
                if (!label) return json({ label, available: false, reason: '', message: '' });
                const err = await checkDomainLabel(db, label);
                return json({ label, fqdn: domainFqdn(label), available: !err, reason: err ? err[0] : '', message: err ? err[1] : '' });
            }

            // 我的域名列表；staff 可 ?all=1 查全部（滥用处置前先看全局）
            if (path === '/api/domains' && method === 'GET') {
                await ensureTables(db);
                // 验证过期懒清扫：超期未验证的行直接释放（CF 记录/路由一并回收），前缀重新可申请
                {
                    const cutoff = new Date(Date.now() - DOMAIN_VERIFY_EXPIRE_DAYS * 86400 * 1000).toISOString();
                    const stale = await db.prepare("SELECT * FROM module_domains WHERE status = 'verifying' AND created_at < ?1 LIMIT 50").bind(cutoff).all();
                    for (const row of (stale.results || [])) {
                        if (row.route_id && env.CF_DNS_TOKEN) { try { await cfRouteApi(env, 'DELETE', null, row.route_id); } catch (e) { /* 忽略 */ } }
                        if (row.dns_record_id && env.CF_DNS_TOKEN) { try { await cfDnsApi(env, 'DELETE', null, row.dns_record_id); } catch (e) { /* 忽略 */ } }
                        await db.prepare('DELETE FROM module_domains WHERE fqdn = ?1').bind(row.fqdn).run();
                        await audit(db, null, 'domain.expire', row.fqdn, row.uid);
                    }
                }
                if (url.searchParams.get('all') === '1' && isStaff(me)) {
                    const rows = await db.prepare('SELECT d.*, u.username AS owner_username FROM module_domains d LEFT JOIN users u ON u.uid = d.uid ORDER BY d.created_at DESC LIMIT 200').all();
                    return json({ domains: rows.results, all: true });
                }
                const rows = await db.prepare('SELECT * FROM module_domains WHERE uid = ?1 ORDER BY created_at DESC LIMIT 50').bind(me.uid).all();
                return json({ domains: rows.results, limits: { per_module: DOMAIN_LIMIT_PER_MODULE, per_user: DOMAIN_LIMIT_PER_USER } });
            }

            // 申请：登录 + TOTP + 模块所有权 + 限额（每模块 2 个 / 每用户 10 个）
            if (path === '/api/domains' && method === 'POST') {
                // 上传模式走 multipart（zip 包），其余模式为 JSON
                if ((request.headers.get('Content-Type') || '').includes('multipart/form-data')) {
                    return handleDomainUpload(request, env, db, me);
                }
                const b = await request.json().catch(() => ({}));
                const totpErr = await requireTotp(db, me, b);
                if (totpErr) return totpErr;
                if (!env.CF_DNS_TOKEN || !env.CF_ZONE_ID) return fail('UNCONFIGURED', 503, 'hosted domains not configured (CF_DNS_TOKEN / CF_ZONE_ID missing)');
                const mode = String(b.mode || 'git');
                if (!['git', 'redirect', 'dns'].includes(mode)) return freason('VALIDATION', 400, 'bad_mode', 'mode must be git, redirect or dns');
                if (!b.module_name || !['module', 'adapter'].includes(b.module_type)) return freason('VALIDATION', 400, 'module_missing', 'missing module_name or module_type');
                const label = String(b.label || '').trim().toLowerCase();
                const labelErr = await checkDomainLabel(db, label);
                if (labelErr) return freason('VALIDATION', 400, labelErr[0], labelErr[1]);

                // 模块存在 + 所有权（与模块管理同一所有权模型）
                const cached = await getCachedPackages(db);
                if (!cached.packages) return fail('UPSTREAM', 502, cached.reason || 'failed to fetch packages.json');
                const info = containerOf(cached.packages, b.module_type)[b.module_name];
                if (!info) return freason('NOT_FOUND', 404, 'module_missing', 'module not found');
                if (!isStaff(me)) {
                    const uids = await myUids();
                    if (!uids.has(info.submitted_by_uid || '')) return freason('FORBIDDEN', 403, 'not_owner', 'only the module owner can request a hosted domain');
                }
                const modCnt = (await db.prepare('SELECT COUNT(*) AS n FROM module_domains WHERE module_name = ?1 AND module_type = ?2').bind(b.module_name, b.module_type).first()).n;
                if (modCnt >= DOMAIN_LIMIT_PER_MODULE) return freason('LIMIT', 429, 'limit_module', 'module domain limit reached (' + DOMAIN_LIMIT_PER_MODULE + ')');
                const userCnt = (await db.prepare('SELECT COUNT(*) AS n FROM module_domains WHERE uid = ?1').bind(me.uid).first()).n;
                if (userCnt >= DOMAIN_LIMIT_PER_USER) return freason('LIMIT', 429, 'limit_user', 'account domain limit reached (' + DOMAIN_LIMIT_PER_USER + ')');

                const fqdn = domainFqdn(label);
                const verifyCode = randomHex(8);
                // 每模块第 1 个直接生效；第 2 个起（非管理员）需管理员审核
                const needsReview = modCnt >= 1 && !isStaff(me);
                let status = needsReview ? 'reviewing' : 'active';
                let verifyFile = '';
                const vals = {
                    git_repo: '', git_host: '', git_base: '', git_branch: '', target_url: '',
                    dns_type: '', dns_value: '', dns_record_id: '', route_id: '', verify_code: verifyCode,
                };

                if (mode === 'git') {
                    const g = parseGitRepo(b.repo, String(b.platform || '').toLowerCase());
                    if (!g) return freason('VALIDATION', 400, 'bad_repo', 'repo must be a full https URL of the selected platform');
                    const branch = String(b.branch || '').trim();
                    if (!DOMAIN_BRANCH_RE.test(branch) || branch.startsWith('/') || branch.endsWith('/')) return freason('VALIDATION', 400, 'bad_branch', 'invalid branch name');
                    vals.git_repo = g.owner + '/' + g.repo;
                    vals.git_host = g.host;
                    vals.git_base = g.base;
                    vals.git_branch = branch;
                    // 仓库与模块登记 repository 同源 → 模块提交时已证明控制权，免文件验证直接生效
                    if (!repoMatchesModule(g.host, g.owner, g.repo, info.repository)) {
                        status = 'verifying';
                        verifyFile = 'erisdev-site-verify.txt';
                    }
                    if (needsReview && status === 'active') status = 'reviewing';
                } else if (mode === 'redirect') {
                    const t = String(b.target_url || '').trim();
                    if (!/^https:\/\/[^\s]{1,500}$/.test(t)) return freason('VALIDATION', 400, 'bad_target', 'target_url must be an https:// URL');
                    vals.target_url = t;
                } else {
                    const dnsType = String(b.dns_type || '').toUpperCase();
                    const valErr = checkDnsValue(dnsType, b.dns_value);
                    if (valErr) return fail('VALIDATION', 400, valErr);
                    vals.dns_type = dnsType;
                    vals.dns_value = String(b.dns_value).trim().toLowerCase();
                    status = 'verifying';
                    verifyFile = '.well-known/erisdev-verify.txt';
                }

                // DNS 记录 + 精确路由：git/redirect 用占位 AAAA 100:: 并接 Worker 路由（流量过 Worker）；
                // dns 模式不建路由——流量经 CF 边缘直达用户源站，零 Worker 请求
                //（单层子域 TLS 由 *.erisdev.com 免费通配符覆盖；精确路由互不影响其他子域）
                // 幂等：同名记录/路由已存在（上次半创建残留）时收编复用，不报错
                try {
                    let rec;
                    try {
                        rec = await cfDnsApi(env, 'POST', {
                            type: mode === 'dns' ? vals.dns_type : 'AAAA',
                            name: fqdn,
                            content: mode === 'dns' ? vals.dns_value : '100::',
                            proxied: true, ttl: 1,
                            comment: 'ErisPulse module domain: ' + b.module_name,
                        });
                    } catch (e) {
                        if (!/81058/.test(String(e.message || e))) throw e;
                        rec = await cfFindDnsRecord(env, fqdn);
                        if (!rec) throw e;
                    }
                    vals.dns_record_id = rec.id;
                    {
                        let route;
                        try {
                            route = await cfRouteApi(env, 'POST', { pattern: fqdn + '/*', script: 'erispulse-plugin-domains' });
                        } catch (e) {
                            if (!/already exists/i.test(String(e.message || e))) throw e;
                            const list = await cfRouteApi(env, 'GET');
                            route = (list || []).find(x => x.pattern === fqdn + '/*');
                            if (!route) throw e;
                        }
                        vals.route_id = route.id;
                    }
                } catch (e) {
                    // 全新创建失败才回滚；收编成功的不动
                    if (!vals.route_id && !/already exists/i.test(String(e.message || e)) && vals.dns_record_id) {
                        try { await cfDnsApi(env, 'DELETE', null, vals.dns_record_id); } catch (e2) { /* 尽力回滚 */ }
                    }
                    return fail('UPSTREAM', 502, String(e.message || e).slice(0, 200));
                }

                await db.prepare(`INSERT INTO module_domains (fqdn, label, uid, module_name, module_type, mode, git_repo, git_host, git_base, git_branch, target_url, dns_type, dns_value, dns_record_id, route_id, verify_code, version, review, status, created_at, updated_at)
                    VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,1,?17,?18,?19,?19)`)
                    .bind(fqdn, label, me.uid, String(b.module_name), b.module_type, mode, vals.git_repo, vals.git_host, vals.git_base, vals.git_branch, vals.target_url, vals.dns_type, vals.dns_value, vals.dns_record_id, vals.route_id, vals.verify_code, needsReview ? 1 : 0, status, now()).run();
                await audit(db, me.uid, 'domain.apply', fqdn, mode);
                if (status === 'active') {
                    notifyDomainEvent(env, db, me.uid, '[ErisPulse] 托管域名已生效 / Domain active: ' + fqdn,
                        '你的模块「' + b.module_name + '」托管域名已生效，现在可以通过 https://' + fqdn + ' 访问。',
                        'The hosted domain for your module "' + b.module_name + '" is now live at https://' + fqdn + '.');
                } else {
                    notifyDomainEvent(env, db, me.uid, '[ErisPulse] 托管域名待验证 / Domain pending verification: ' + fqdn,
                        mode === 'git'
                            ? '请在仓库 ' + vals.git_repo + ' 的 ' + vals.git_branch + ' 分支根目录放置 erisdev-site-verify.txt，内容为：' + verifyCode + '，然后到工作台「托管域名」页点击验证。'
                            : '请在你服务器上为 ' + fqdn + ' 提供 https://' + fqdn + '/.well-known/erisdev-verify.txt，内容为：' + verifyCode + '，然后到工作台「托管域名」页点击验证。',
                        mode === 'git'
                            ? 'Place erisdev-site-verify.txt (content: ' + verifyCode + ') at the root of branch ' + vals.git_branch + ' in ' + vals.git_repo + ', then click Verify on the Hosted Domains page.'
                            : 'Serve the content "' + verifyCode + '" at https://' + fqdn + '/.well-known/erisdev-verify.txt on your server, then click Verify on the Hosted Domains page.');
                }
                return json({ ok: true, fqdn, status, verify_code: status === 'active' ? '' : verifyCode, verify_file: verifyFile });
            }

            // 重新验证（git 模式查分支根验证文件；dns 模式经本域名回源查 .well-known）
            let dm = path.match(/^\/api\/domains\/([a-z0-9-]{1,63})\/verify$/);
            if (dm && method === 'POST') {
                const row = await db.prepare('SELECT * FROM module_domains WHERE fqdn = ?1').bind(domainFqdn(dm[1])).first();
                if (!row) return freason('NOT_FOUND', 404, 'domain_missing', 'domain not found');
                if (row.uid !== me.uid && !isStaff(me)) return freason('FORBIDDEN', 403, 'not_owner', 'only the owner can manage this domain');
                if (row.status === 'active') return freason('VALIDATION', 400, 'already_active', 'domain is already active');
                if (row.status === 'disabled') return freason('FORBIDDEN', 403, 'disabled_domain', 'this domain has been disabled by an admin');
                if (row.mode === 'redirect') return freason('VALIDATION', 400, 'no_verify_needed', 'redirect domains do not need verification');
                let ok = false;
                try {
                    const resp = row.mode === 'git'
                        ? await fetch(gitRawUrl(row.git_host, row.git_base || '', row.git_repo.split('/')[0], row.git_repo.split('/')[1], row.git_branch, 'erisdev-site-verify.txt', true), { cf: { cacheTtl: 0 } })
                        : await fetch('https://' + row.fqdn + '/.well-known/erisdev-verify.txt?t=' + Date.now(), { cf: { cacheTtl: 0 } });
                    ok = resp.ok && String(await resp.text()).trim() === row.verify_code;
                } catch (e) { ok = false; }
                if (!ok) return freason('VERIFY_FAILED', 400, 'verify_failed', 'verification file not found or content mismatched; check its location and content');
                const newStatus = row.review ? 'reviewing' : 'active';
                await db.prepare('UPDATE module_domains SET status = ?1, version = version + 1, updated_at = ?2 WHERE fqdn = ?3').bind(newStatus, now(), row.fqdn).run();
                // dns 模式生效后撤销路由：流量此后直达源站，不再占 Worker
                if (row.mode === 'dns' && row.route_id) {
                    try { await cfRouteApi(env, 'DELETE', null, row.route_id); await db.prepare('UPDATE module_domains SET route_id = ?1 WHERE fqdn = ?2').bind('', row.fqdn).run(); } catch (e) { /* 路由残留无害，删除域名时再清 */ }
                }
                await audit(db, me.uid, 'domain.verify', row.fqdn, '');
                notifyDomainEvent(env, db, row.uid,
                    newStatus === 'reviewing'
                        ? '[ErisPulse] 托管域名验证通过，待管理员审核 / Verified, pending review: ' + row.fqdn
                        : '[ErisPulse] 托管域名已生效 / Domain active: ' + row.fqdn,
                    '你的模块「' + row.module_name + '」托管域名验证通过' + (newStatus === 'reviewing' ? '，因该模块已有域名在用，需管理员审核后生效。' : '并已生效，现在可以通过 https://' + row.fqdn + ' 访问。'),
                    newStatus === 'reviewing'
                        ? 'Verification passed for module "' + row.module_name + '", but the domain needs admin approval because this module already has a domain.'
                        : 'The hosted domain for your module "' + row.module_name + '" is now live at https://' + row.fqdn + '.');
                return json({ ok: true, status: newStatus });
            }

            // 重传（upload 模式）：multipart zip，覆盖桶内容
            let du = path.match(/^\/api\/domains\/([a-z0-9-]{1,63})\/reupload$/);
            if (du && method === 'POST') {
                const row = await db.prepare('SELECT * FROM module_domains WHERE fqdn = ?1').bind(domainFqdn(du[1])).first();
                if (!row) return freason('NOT_FOUND', 404, 'domain_missing', 'domain not found');
                if (!isStaff(me)) return freason('FORBIDDEN', 403, 'not_released', 'upload mode is not released yet');
                if (row.mode !== 'upload' || !row.r2_bucket) return freason('VALIDATION', 400, 'bad_mode', 'reupload applies to uploaded sites only');
                if (row.uid !== me.uid && !isStaff(me)) return freason('FORBIDDEN', 403, 'not_owner', 'only the owner can manage this domain');
                if (row.status === 'disabled') return freason('FORBIDDEN', 403, 'disabled_domain', 'this domain has been disabled by an admin');
                await ensureTables(db);
                const b = await request.formData().catch(() => null);
                if (!b) return freason('VALIDATION', 400, 'bad_form', 'multipart form required');
                const totpErr = await requireTotp(db, me, { totp_code: String(b.get('totp_code') || '') });
                if (totpErr) return totpErr;
                const file = b.get('file');
                if (!file || typeof file === 'string') return freason('VALIDATION', 400, 'zip_bad', 'zip file field missing');
                if (file.size > R2_MAX_ZIP) return freason('VALIDATION', 400, 'zip_size', 'zip must be ≤5MB');
                const totalNow = await r2GetTotalBytes(db);
                if (totalNow + R2_MAX_ZIP * 20 > R2_TOTAL_LIMIT) return freason('LIMIT', 429, 'storage_limit', 'global R2 storage budget reached');
                let extracted;
                try {
                    extracted = await extractZip(await file.arrayBuffer());
                } catch (e) {
                    return freason('VALIDATION', 400, e.reason || 'zip_bad', e.message);
                }

                const oldObjs = await r2ListObjects(env, row.r2_bucket);
                let freed = 0;
                for (const o of oldObjs) { await r2DeleteObject(env, row.r2_bucket, o.key); freed += o.size; }
                let rawTotal = 0;
                for (const f of extracted) { await r2PutObject(env, row.r2_bucket, f.name, f.bytes, mimeOf(f.name)); rawTotal += f.bytes.length; }
                await r2AddBytes(db, rawTotal - freed);
                await db.prepare('UPDATE module_domains SET r2_bytes = ?1, updated_at = ?2 WHERE fqdn = ?3').bind(rawTotal, now(), row.fqdn).run();
                await audit(db, me.uid, 'domain.reupload', row.fqdn, '');
                return json({ ok: true, files: extracted.length, bytes: rawTotal });
            }

            // 管理：pause / resume / delete / update（update 改目标后回待验证，dns 模式同步 CF 记录）
            let dmm = path.match(/^\/api\/domains\/([a-z0-9-]{1,63})\/manage$/);
            if (dmm && method === 'POST') {
                const b = await request.json().catch(() => ({}));
                const totpErr = await requireTotp(db, me, b);
                if (totpErr) return totpErr;
                const row = await db.prepare('SELECT * FROM module_domains WHERE fqdn = ?1').bind(domainFqdn(dmm[1])).first();
                if (!row) return freason('NOT_FOUND', 404, 'domain_missing', 'domain not found');
                if (row.uid !== me.uid && !isStaff(me)) return freason('FORBIDDEN', 403, 'not_owner', 'only the owner can manage this domain');
                const action = String(b.action || '');

                if (action === 'pause') {
                    if (row.status !== 'active') return freason('VALIDATION', 400, 'bad_state', 'only active domains can be paused');
                    // dns 模式无 Worker 路由：暂停 = 摘除 DNS 记录（resume 时按存档重建）
                    if (row.mode === 'dns' && row.dns_record_id && env.CF_DNS_TOKEN) {
                        try { await cfDnsApi(env, 'DELETE', null, row.dns_record_id); } catch (e) { /* 忽略 */ }
                        await db.prepare('UPDATE module_domains SET dns_record_id = ?1 WHERE fqdn = ?2').bind('', row.fqdn).run();
                    }
                    // upload 模式：关闭自定义域公开访问（桶与内容保留）
                    if (row.mode === 'upload' && row.r2_bucket) {
                        try { await r2SetDomainEnabled(env, row.r2_bucket, row.fqdn, false); } catch (e) { /* 忽略 */ }
                    }
                    await db.prepare("UPDATE module_domains SET status = 'paused', version = version + 1, updated_at = ?1 WHERE fqdn = ?2").bind(now(), row.fqdn).run();
                } else if (action === 'resume') {
                    if (row.status !== 'paused') return freason('VALIDATION', 400, 'bad_state', 'only paused domains can be resumed');
                    // dns 模式恢复：重建 DNS 记录
                    if (row.mode === 'dns' && env.CF_DNS_TOKEN) {
                        const rec = await cfDnsApi(env, 'POST', {
                            type: row.dns_type, name: row.fqdn, content: row.dns_value, proxied: true, ttl: 1,
                            comment: 'ErisPulse module domain: ' + row.module_name,
                        }).catch(() => null);
                        if (!rec) return fail('UPSTREAM', 502, 'failed to recreate the DNS record');
                        await db.prepare('UPDATE module_domains SET dns_record_id = ?1 WHERE fqdn = ?2').bind(rec.id, row.fqdn).run();
                    }
                    // upload 模式恢复：重新开启公开访问
                    if (row.mode === 'upload' && row.r2_bucket) {
                        try { await r2SetDomainEnabled(env, row.r2_bucket, row.fqdn, true); } catch (e) { /* 忽略 */ }
                    }
                    await db.prepare("UPDATE module_domains SET status = 'active', version = version + 1, updated_at = ?1 WHERE fqdn = ?2").bind(now(), row.fqdn).run();
                } else if (action === 'delete') {
                    // 撤路由 + 撤记录，均已不存在时忽略
                    if (env.CF_DNS_TOKEN) {
                        if (row.route_id) { try { await cfRouteApi(env, 'DELETE', null, row.route_id); } catch (e) { /* 忽略 */ } }
                        if (row.dns_record_id) { try { await cfDnsApi(env, 'DELETE', null, row.dns_record_id); } catch (e) { /* 忽略 */ } }
                    }
                    if (row.mode === 'upload' && row.r2_bucket) {
                        try { await r2DetachDomain(env, row.r2_bucket, row.fqdn); } catch (e) { /* 忽略 */ }
                        try { await r2EmptyBucket(env, db, row.r2_bucket); } catch (e) { /* 忽略 */ }
                        try { await r2DeleteBucket(env, row.r2_bucket); } catch (e) { /* 忽略 */ }
                    }
                    await db.prepare('DELETE FROM module_domains WHERE fqdn = ?1').bind(row.fqdn).run();
                } else if (action === 'update') {
                    if (row.status === 'disabled') return freason('FORBIDDEN', 403, 'disabled_domain', 'this domain has been disabled by an admin');
                    if (row.mode === 'git') {
                        const g = parseGitRepo(b.repo, String(b.platform || '').toLowerCase());
                        if (!g) return freason('VALIDATION', 400, 'bad_repo', 'repo must be a full https URL of the selected platform');
                        const branch = String(b.branch || '').trim();
                        if (!DOMAIN_BRANCH_RE.test(branch) || branch.startsWith('/') || branch.endsWith('/')) return freason('VALIDATION', 400, 'bad_branch', 'invalid branch name');
                        // 换仓库/分支后重新判定：同源仓库免验证，其余回待验证
                        const cached = await getCachedPackages(db);
                        const info = cached.packages ? containerOf(cached.packages, row.module_type)[row.module_name] : null;
                        const same = info ? repoMatchesModule(g.host, g.owner, g.repo, info.repository) : false;
                        await db.prepare('UPDATE module_domains SET git_repo = ?1, git_host = ?2, git_base = ?3, git_branch = ?4, status = ?5, version = version + 1, updated_at = ?6 WHERE fqdn = ?7')
                            .bind(g.owner + '/' + g.repo, g.host, g.base, branch, same ? 'active' : 'verifying', now(), row.fqdn).run();
                    } else if (row.mode === 'redirect') {
                        const t = String(b.target_url || '').trim();
                        if (!/^https:\/\/[^\s]{1,500}$/.test(t)) return freason('VALIDATION', 400, 'bad_target', 'target_url must be an https:// URL');
                        await db.prepare('UPDATE module_domains SET target_url = ?1, version = version + 1, updated_at = ?2 WHERE fqdn = ?3').bind(t, now(), row.fqdn).run();
                    } else {
                        // dns 模式仅允许改记录值（改类型需 CF 上先删旧记录，故不接受）
                        const valErr = checkDnsValue(row.dns_type, b.dns_value);
                        if (valErr) return fail('VALIDATION', 400, valErr);
                        const newValue = String(b.dns_value).trim().toLowerCase();
                        try {
                            if (row.dns_record_id) {
                                await cfDnsApi(env, 'PATCH', { content: newValue, ttl: 1 }, row.dns_record_id);
                            } else {
                                const rec = await cfDnsApi(env, 'POST', { type: row.dns_type, name: row.fqdn, content: newValue, proxied: true, ttl: 1, comment: 'ErisPulse module domain: ' + row.module_name });
                                await db.prepare('UPDATE module_domains SET dns_record_id = ?1 WHERE fqdn = ?2').bind(rec.id, row.fqdn).run();
                            }
                        } catch (e) {
                            return fail('UPSTREAM', 502, String(e.message || e).slice(0, 200));
                        }
                        await db.prepare('UPDATE module_domains SET dns_value = ?1, version = version + 1, updated_at = ?2 WHERE fqdn = ?3').bind(newValue, now(), row.fqdn).run();
                    }
                } else {
                    return freason('VALIDATION', 400, 'unknown_action', 'unknown action');
                }
                await audit(db, me.uid, 'domain.' + action, row.fqdn, '');
                return json({ ok: true });
            }

            // 批量管理：一次 2FA 校验 + 一次 dispatch（ModuleRepo 脚本支持 items 数组）
            if (path === '/api/modules/batch' && method === 'POST') {
                const token = env.MODULE_REPO_TOKEN;
                if (!token) return fail('UNCONFIGURED', 503, '未配置 MODULE_REPO_TOKEN');
                const b = await request.json().catch(() => ({}));
                const totpErr = await requireTotp(db, me, b);
                if (totpErr) return totpErr;
                const action = b.action;
                if (!['verify', 'unverify', 'delete'].includes(action)) return fail('VALIDATION', 400, '批量仅支持 verify / unverify / delete');
                if (action !== 'delete' && !isStaff(me)) return fail('FORBIDDEN', 403, '仅管理员可验证模块');
                const items = (Array.isArray(b.items) ? b.items : [])
                    .filter(it => it && it.name && it.type)
                    .slice(0, 50);
                if (!items.length) return fail('VALIDATION', 400, '请选择要操作的模块');
                if (new Set(items.map(it => it.type + ':' + it.name)).size !== items.length) return fail('VALIDATION', 400, '存在重复模块');

                // 非 staff 删除：校验所有权
                if (action === 'delete' && !isStaff(me)) {
                    const pkgResp = await fetch(packagesUrl(), { cf: { cacheTtl: 30 } });
                    if (!pkgResp.ok) return fail('UPSTREAM', 502, 'packages.json 获取失败');
                    const packages = await pkgResp.json();
                    const uids = await myUids();
                    for (const it of items) {
                        const info = containerOf(packages, it.type)[it.name];
                        if (!info) return fail('NOT_FOUND', 404, '模块不存在: ' + it.name);
                        if (!uids.has(info.submitted_by_uid || '')) return fail('FORBIDDEN', 403, '无权删除: ' + it.name);
                    }
                }

                const uidsJson = await myUidsJson();
                const staffFlag = isStaff(me) ? 1 : 0;
                const payloadItems = items.map(it => action === 'delete'
                    ? { action: 'delete', name: String(it.name), type: it.type, uids: uidsJson, staff: staffFlag }
                    : { action: 'edit', name: String(it.name), type: it.type, uids: uidsJson, staff: staffFlag, edit_data: JSON.stringify({ verified: action === 'verify' }) });

                const resp = await fetch('https://api.github.com/repos/ErisPulse/ErisPulse-ModuleRepo/dispatches', {
                    method: 'POST',
                    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'ErisPulse-Workbench' },
                    body: JSON.stringify({ event_type: 'manage_module', client_payload: { items: payloadItems } }),
                });
                if (!resp.ok) return fail('UPSTREAM', 502, 'dispatch 失败: ' + resp.status);

                const opIds = [];
                for (const it of payloadItems) {
                    const isDelete = it.action === 'delete';
                    const targetUid = await ownerUidOf(db, it.type, it.name);
                    const r = await db.prepare("INSERT INTO module_ops (name, type, action, verified, edit_data, owner_uid, target_uid, status, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,'pending',?8)")
                        .bind(it.name, it.type, isDelete ? 'delete' : 'verify', isDelete ? null : (action === 'verify' ? 1 : 0), isDelete ? null : it.edit_data, me.uid, targetUid, now()).run();
                    opIds.push(r.meta.last_row_id);
                }
                await audit(db, me.uid, 'module.batch.' + action, String(items.length), '');
                scheduleSync(env, ctx, me, opIds.map(id => ({ id })));
                return json({ ok: true, count: opIds.length, syncing: true });
            }

            // logo 校验：https URL 或 ≤100KB data:image
            function checkLogo(logo) {
                const v = String(logo || '');
                if (!v) return null;
                if (!(v.startsWith('https://') || v.startsWith('data:image/'))) return 'logo 需为 https URL 或 data:image URL';
                if (v.startsWith('data:image/') && v.length > 140 * 1024) return 'logo 超过 100KB';
                return null;
            }

            // 提交新模块（任何登录用户；开启两步验证的用户需附 TOTP 动态码）
            if (path === '/api/modules/submit' && method === 'POST') {
                const token = env.MODULE_REPO_TOKEN;
                if (!token) return fail('UNCONFIGURED', 503, '未配置 MODULE_REPO_TOKEN');
                const b = await request.json().catch(() => ({}));
                const totpErr = await requireTotp(db, me, b);
                if (totpErr) return totpErr;
                const required = ['name', 'package', 'description', 'author', 'repository', 'category', 'type'];
                for (const k of required) if (!b[k]) return fail('VALIDATION', 400, '缺少字段: ' + k);
                if (!/^[a-zA-Z0-9_-]+$/.test(String(b.name))) return fail('VALIDATION', 400, '模块名格式不合法');
                if (String(b.description).length < 10) return fail('VALIDATION', 400, '描述至少 10 字符');
                if (!/^https:\/\/(github\.com|codeberg\.org)\//.test(String(b.repository))) return fail('VALIDATION', 400, '仓库地址需为 github/codeberg');
                const catId = parseInt(b.category, 10);
                if (![1, 2, 3, 4, 5, 6, 7].includes(catId)) return fail('VALIDATION', 400, '分类编号 1-7');
                if (!['module', 'adapter'].includes(b.type)) return fail('VALIDATION', 400, '类型为 module/adapter');
                const logoErr = checkLogo(b.logo);
                if (logoErr) return fail('VALIDATION', 400, logoErr);

                // GitHub dispatch 的 client_payload 顶层最多 10 键：
                // category/tags/i18n/min_sdk_version 统一打包进 data（脚本端解包），顶层控制在 9 键内
                const payload = {
                    event_type: 'submit_module',
                    client_payload: {
                        name: String(b.name), package: String(b.package), type: b.type,
                        description: String(b.description), author: String(b.author),
                        repository: String(b.repository),
                        ...(b.logo ? { logo: String(b.logo) } : {}),
                        submitter: JSON.stringify({ name: me.display_name || me.username, uid: 'wb:' + me.uid, provider: 'workbench' }),
                        data: JSON.stringify({
                            category: catId,
                            tags: JSON.stringify(Array.isArray(b.tags) ? b.tags : []),
                            i18n: JSON.stringify(Array.isArray(b.i18n) ? b.i18n : []),
                            ...(b.min_sdk_version ? { min_sdk_version: String(b.min_sdk_version) } : {}),
                        }),
                    },
                };
                const resp = await fetch('https://api.github.com/repos/ErisPulse/ErisPulse-ModuleRepo/dispatches', {
                    method: 'POST',
                    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'ErisPulse-Workbench' },
                    body: JSON.stringify(payload),
                });
                if (!resp.ok) {
                    const errText = await resp.text().catch(() => '');
                    return fail('UPSTREAM', 502, 'dispatch 失败: ' + resp.status + ' ' + errText.slice(0, 200));
                }
                await audit(db, me.uid, 'module.submit', b.name, b.type);
                await db.prepare("INSERT INTO module_ops (name, type, action, edit_data, owner_uid, target_uid, status, created_at) VALUES (?1,?2,'submit',?3,?4,?5,'pending',?6)")
                    .bind(String(b.name), b.type, JSON.stringify({
                        package: String(b.package), description: String(b.description), author: String(b.author),
                        repository: String(b.repository), category: catId, type: b.type,
                        tags: Array.isArray(b.tags) ? b.tags : [], i18n: Array.isArray(b.i18n) ? b.i18n : [],
                        logo: b.logo || '', min_sdk_version: b.min_sdk_version || '',
                        submitter_name: me.display_name || me.username,
                        owner_uid: me.uid,
                    }), me.uid, me.uid, now()).run();
                const opRow = await db.prepare("SELECT id FROM module_ops WHERE name = ?1 AND action = 'submit' AND status = 'pending' ORDER BY id DESC LIMIT 1").bind(String(b.name)).first();
                scheduleSync(env, ctx, me, [{ id: opRow.id }]);
                return json({ ok: true, syncing: true });
            }

            // 管理：编辑（全字段）/ 删除 / 转正 —— 所有者或管理员；开启两步验证的用户需附 TOTP 动态码
            if (path === '/api/modules/manage' && method === 'POST') {
                const token = env.MODULE_REPO_TOKEN;
                if (!token) return fail('UNCONFIGURED', 503, '未配置 MODULE_REPO_TOKEN');
                const b = await request.json().catch(() => ({}));
                const totpErr = await requireTotp(db, me, b);
                if (totpErr) return totpErr;
                if (!b.name || !b.type || !b.action) return fail('VALIDATION', 400, '参数不完整');

                // 所有权：非 staff 必须是模块所有者
                if (!isStaff(me)) {
                    const pkgResp = await fetch('https://raw.githubusercontent.com/ErisPulse/ErisPulse-ModuleRepo/2x/packages.json', { cf: { cacheEverything: true, cacheTtl: 120 } });
                    if (!pkgResp.ok) return fail('UPSTREAM', 502, 'packages.json 获取失败');
                    const packages = await pkgResp.json();
                    const container = b.type === 'adapter' ? 'adapters' : 'modules';
                    const info = (packages[container] || {})[b.name];
                    if (!info) return fail('NOT_FOUND', 404, '模块不存在');
                    const uids = await myUids();
                    if (!uids.has(info.submitted_by_uid || '')) return fail('FORBIDDEN', 403, '仅所有者或管理员可管理该模块');
                }

                let client_payload;
                if (b.action === 'delete') {
                    client_payload = { action: 'delete', name: b.name, type: b.type, uids: await myUidsJson(), staff: isStaff(me) ? 1 : 0 };
                } else if (b.action === 'verify') {
                    if (!isStaff(me)) return fail('FORBIDDEN', 403, '仅管理员可验证模块');
                    client_payload = { action: 'edit', name: b.name, type: b.type, uids: await myUidsJson(), staff: isStaff(me) ? 1 : 0, edit_data: JSON.stringify({ verified: !!b.verified }) };
                } else if (b.action === 'edit') {
                    const e = b.edit_data || {};
                    if (e.logo !== undefined) {
                        const logoErr = checkLogo(e.logo);
                        if (logoErr) return fail('VALIDATION', 400, logoErr);
                    }
                    if (e.description !== undefined && String(e.description).length < 10) return fail('VALIDATION', 400, '描述至少 10 字符');
                    if (e.category !== undefined && ![1, 2, 3, 4, 5, 6, 7].includes(parseInt(e.category, 10))) return fail('VALIDATION', 400, '分类编号 1-7');
                    client_payload = { action: 'edit', name: b.name, type: b.type, uids: await myUidsJson(), staff: isStaff(me) ? 1 : 0, edit_data: JSON.stringify(e) };
                } else {
                    return fail('VALIDATION', 400, '未知 action');
                }

                const resp = await fetch('https://api.github.com/repos/ErisPulse/ErisPulse-ModuleRepo/dispatches', {
                    method: 'POST',
                    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'ErisPulse-Workbench' },
                    body: JSON.stringify({ event_type: 'manage_module', client_payload: client_payload }),
                });
                if (!resp.ok) return fail('UPSTREAM', 502, 'dispatch 失败: ' + resp.status);
                await audit(db, me.uid, 'module.' + b.action, b.name, b.action === 'verify' ? String(!!b.verified) : '');
                let opEdit = null;
                if (b.action === 'verify') opEdit = JSON.stringify({ verified: !!b.verified });
                if (b.action === 'edit') opEdit = client_payload.edit_data;
                const targetUid = await ownerUidOf(db, b.type, b.name);
                await db.prepare("INSERT INTO module_ops (name, type, action, verified, edit_data, owner_uid, target_uid, status, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,'pending',?8)")
                    .bind(b.name, b.type, b.action, b.action === 'verify' ? (b.verified ? 1 : 0) : null, opEdit, me.uid, targetUid, now()).run();
                const opRow = await db.prepare("SELECT id FROM module_ops WHERE name = ?1 AND status = 'pending' ORDER BY id DESC LIMIT 1").bind(b.name).first();
                scheduleSync(env, ctx, me, [{ id: opRow.id }]);
                return json({ ok: true, syncing: true });
            }

            // 总览补充：最新 Release
            if (path === '/api/release' && method === 'GET') {
                const resp = await fetch('https://api.github.com/repos/ErisPulse/ErisPulse/releases/latest', {
                    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'ErisPulse-Workbench' },
                    cf: { cacheEverything: true, cacheTtl: 3600 },
                });
                if (!resp.ok) return json({ release: null });
                const r = await resp.json();
                return json({ release: { tag: r.tag_name, name: r.name, url: r.html_url, date: (r.published_at || '').slice(0, 10) } });
            }

            return fail('NOT_FOUND', 404, '未知接口');
        } catch (e) {
            return fail('ERROR', 500, String(e && e.message || e).slice(0, 200));
        }
    },
};
