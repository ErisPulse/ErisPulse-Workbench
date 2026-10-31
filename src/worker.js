// ErisPulse Workbench —— 统一身份中心 + 创作者工作台
// 架构：Cloudflare Worker（本文件）+ D1 + 静态前端（public/）
// 完全开源，接受社区监督。

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

// ── 工具 ──
function json(data, status = 200, extra = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...extra },
    });
}
const fail = (code, status, message) => json({ error: code, message: message || '' }, status);
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

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
    const count = (await db.prepare('SELECT COUNT(*) AS n FROM users').first()).n;
    const uid = 'u_' + randomHex(6);
    let username = sanitizeUsername(ident.username);
    if (username.length < 2) username = 'user';
    for (let i = 0; i < 8; i++) {
        if (!(await db.prepare('SELECT 1 FROM users WHERE username=?1').bind(username).first())) break;
        username = (username + '_' + randomHex(2)).slice(0, 24);
    }
    await db.prepare('INSERT INTO users (uid, username, display_name, role, avatar_url, email, email_verified, created_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(uid, username, ident.display_name || username, count === 0 ? 'admin' : 'user', ident.avatar_url, ident.email || null, ident.email ? 1 : 0, now()).run();
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
async function reconcilePending(db) {
    const pending = await db.prepare("SELECT * FROM module_ops WHERE status IN ('pending','stale') ORDER BY id ASC LIMIT 200").all();
    const ops = pending.results || [];
    if (!ops.length) return;
    let packages = null;
    const last = await db.prepare("SELECT updated_at FROM repo_cache WHERE key = 'packages'").first();
    const fresh = last && Date.now() - new Date(last.updated_at).getTime() < 15000;
    if (fresh) {
        const row = await db.prepare("SELECT value FROM repo_cache WHERE key = 'packages'").first();
        try { packages = JSON.parse(row.value); } catch (e) { packages = null; }
    }
    if (!packages) {
        try {
            const resp = await fetch(packagesUrl(), { cf: { cacheTtl: 0 } });
            if (!resp.ok) return;
            packages = await resp.json();
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
    if (row) {
        try { return { packages: JSON.parse(row.value), fromCache: true }; } catch (e) {}
    }
    const resp = await fetch('https://raw.githubusercontent.com/ErisPulse/ErisPulse-ModuleRepo/2x/packages.json', { cf: { cacheTtl: 30 } });
    if (!resp.ok) return { packages: null, fromCache: false };
    const packages = await resp.json();
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
                const packages = await resp.json();
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
    await reconcilePending(db);   // 刷新即对账：pending op 达标则结清，避免刷新后状态「回退」
    let packages = null;
    let stale = false;
    const cached = await getCachedPackages(db);
    if (cached.packages) { packages = cached.packages; stale = cached.fromCache; }
    else return { error: fail('UPSTREAM', 502, 'packages.json 获取失败') };

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
                    ],
                    authed: [
                        ['GET', '/api/me'], ['PATCH', '/api/me'],
                        ['POST', '/api/modules/submit', 'totp_code（2FA 宽限/免码令牌除外）'],
                        ['POST', '/api/modules/manage'], ['POST', '/api/modules/batch'],
                        ['GET', '/api/modules/ops', '?name=&type= 或缺省查自己'],
                        ['POST', '/api/modules/claim'], ['GET', '/api/modules/claims'],
                        ['GET', '/api/ecosystem'], ['GET', '/api/release'],
                        ['GET', '/api/tokens'], ['POST', '/api/tokens', '{name, skip_2fa, totp_code?}'],
                        ['POST', '/api/tokens/:id/revoke'],
                        ['GET', '/api/clients'], ['POST', '/api/clients'], ['POST', '/api/clients/:id/(delete|secret)'],
                    ],
                    errors: { TOTP_REQUIRED: 428, AUTH_REQUIRED: 401, FORBIDDEN: 403 },
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
                    const { user } = await findOrCreateUser(db, m[1], ident);
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
                    const mod = (await listModules(env, request).then(r => r.json().catch(() => ({})))).modules || [];
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
