// 模块托管域名站点服务（plugin-<label>.erisdev.com，单层 + 固定前缀）
// 注册表即共享 D1 的 module_domains 表；与主 Worker 同一入口部署，按 hostname 分流。
//   git      → 拉取 GitHub/Codeberg/自建 Gitea·Forgejo/GitLab 分支文件，按扩展名给 MIME，版本化边缘缓存
//   redirect → 301 到登记的 https 目标
//   dns      → fetch(request) 原样回源（CNAME/A/AAAA 记录由 Workbench 经 CF API 代建）
// TLS 由 *.erisdev.com 免费通配符覆盖；每个域名经精确 Worker 路由接入，不影响其他子域。
// 未注册的主机不会解析（无 DNS 记录）；plugin.erisdev.com 作为固定引导页主机。

const DOMAIN_BASE = 'erisdev.com';
const DOMAIN_PREFIX = 'plugin-';
const DOMAIN_RE = new RegExp('^' + DOMAIN_PREFIX + '([a-z0-9]([a-z0-9-]{0,61}[a-z0-9]))\\.' + DOMAIN_BASE.replace(/\./g, '\\.') + '$');
const GATE_HOST = DOMAIN_PREFIX.slice(0, -1) + '.' + DOMAIN_BASE;   // plugin.erisdev.com → 引导页
// 免费额度护栏：免费版 Workers 10 万次/天为账号级共享额度，插件域名流量单独设日预算，
// 超限只降级插件域名站点页，保证工作台主服务不被挤占。抽样 2% 计数（×50 估算）
const DOMAIN_DAILY_BUDGET = 50000;
const QUOTA_SAMPLE_RATE = 0.02;
const CACHE_TTL_S = 600;   // 本地缓存：分支内容更新/清理后最长 10 分钟
const RAW_TTL_S = 60;      // raw 上游边缘缓存：兜底上游抖动
const PATH_MAX = 512;
const MIME_EXT = {
    html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
    json: 'application/json', map: 'application/json',
    txt: 'text/plain; charset=utf-8', md: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8',
    xml: 'application/xml', pdf: 'application/pdf', wasm: 'application/wasm',
    svg: 'image/svg+xml', ico: 'image/x-icon',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp',
    mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
    woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', eot: 'application/vnd.ms-fontobject',
};

export const isDomainHost = host => DOMAIN_RE.test(host);
export { MIME_EXT };
export const isDomainGate = host => host === GATE_HOST;

/** 状态页：与 Workbench 同风格的极简玻璃卡片 */
function page(title, body, status = 200) {
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <link rel="icon" href="data:image/png;base64,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"><title>${title}</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:#f6f7f9;color:#0f1419;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{background:rgba(255,255,255,.82);backdrop-filter:blur(20px);border:1px solid #e5e8ec;border-radius:20px;box-shadow:0 24px 64px -24px rgba(15,23,42,.3);padding:2.2rem 2.4rem;max-width:420px;text-align:center}
h1{font-size:1.15rem;margin:0 0 .6rem}p{font-size:.9rem;color:#5f6b7a;margin:.4rem 0;line-height:1.7}b{color:#3a94d0}
a{color:#3a94d0;text-decoration:none}code{background:rgba(58,148,208,.1);border-radius:6px;padding:2px 8px;font-size:.85em}
</style></head><body><div class="box"><h1>${title}</h1>${body}</div></body></html>`;
    return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

/** 平台 → raw 文件 URL：github 走 CDN 域；gitea 风格（codeberg / 自建 Gitea·Forgejo）；gitlab 风格（自建 GitLab） */
function rawUrl(host, base, owner, repo, branch, path) {
    if (host === 'github') return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    if (host === 'gitlab') return `${base}/${owner}/${repo}/-/raw/${branch}/${path}`;
    return `${base || 'https://codeberg.org'}/${owner}/${repo}/raw/branch/${branch}/${path}`;
}

/** 路径规范化：拒绝穿越段与控制字符；通过返回段数组，否则 null */
function normalizePath(pathname) {
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch (e) { return null; }
    if (decoded.length > PATH_MAX || /[\u0000-\u001f\\]/.test(decoded)) return null;
    const segs = decoded.split('/').filter(Boolean);
    if (segs.some(s => s === '.' || s === '..')) return null;
    return segs;
}

/** dns 模式回源：源站不可达时给可读错误页，避免裸 1101 */
function originFetch(request) {
    return fetch(request).catch(() => page('源站无法连接 · Origin unreachable', '<p>源站暂时无法连接，请稍后重试；若持续失败请联系站点所有者。</p><p>The origin server could not be reached. Try again later, or contact the site owner if this persists.</p>', 502));
}

/** 分支文件 → 正确 MIME + nosniff 的响应，GET 时写入版本化缓存 */
function serveBranchFile(upstream, filePath, cacheKey, cache, ctx, doCache) {
    const ext = filePath.includes('.') ? filePath.split('.').pop().toLowerCase() : '';
    const headers = {
        'Content-Type': MIME_EXT[ext] || 'application/octet-stream',
        'Cache-Control': `public, max-age=${CACHE_TTL_S}`,
        'X-Content-Type-Options': 'nosniff',
    };
    const resp = new Response(upstream.body, { status: 200, headers });
    if (doCache) ctx.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
}

export async function handleDomainRequest(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();

    // ── 免费额度护栏：抽样计数 + 预算检查（统计失败不拦正常流量）──
    if (isDomainHost(host)) {
        try {
            const day = new Date().toISOString().slice(0, 10);
            if (Math.random() < QUOTA_SAMPLE_RATE) {
                await env.DB.prepare('INSERT INTO domain_quota (day, n) VALUES (?1, 50) ON CONFLICT(day) DO UPDATE SET n = n + 50').bind(day).run();
            }
            const q = await env.DB.prepare('SELECT n FROM domain_quota WHERE day = ?1').bind(day).first();
            if (q && q.n > DOMAIN_DAILY_BUDGET) {
                return page('站点服务暂时不可用 · Temporarily unavailable', '<p>今日免费请求额度已达预算上限，站点服务已临时降级以保护主服务。</p><p>Daily free-tier request budget reached; site serving is temporarily throttled to protect the main service. Please try again tomorrow (UTC).</p>', 429);
            }
        } catch (e) { /* 护栏统计失败不拦流量 */ }
    }

    // ── 缓存清理：版本 +1，旧缓存条目自然淘汰 ──
    const pm = url.pathname.match(/^\/purge-cache\/([a-z0-9.-]+)\/([\w-]+)$/);
    if (pm && request.method === 'POST') {
        const want = env.PURGE_PASSWORD
            || ((await env.DB.prepare("SELECT value FROM settings WHERE key = 'purge_password'").first().catch(() => null)) || {}).value;
        if (!want || pm[2] !== want) return new Response('forbidden', { status: 403 });
        const r = await env.DB.prepare('UPDATE module_domains SET version = version + 1, updated_at = ?1 WHERE fqdn = ?2')
            .bind(new Date().toISOString(), pm[1]).run();
        if (!r.meta.changes) return new Response('unknown host', { status: 404 });
        return new Response('ok');
    }

    // ── 非托管主机（含 plugin.erisdev.com 引导页主机）→ 引导页 ──
    if (!isDomainHost(host)) {
        return page('ErisPulse 模块托管域名 · Hosted Domains', `<p>这里为生态模块提供免费子域名托管，形如 <code>plugin-模块名.erisdev.com</code>。</p><p>Free subdomains for ecosystem modules — sign in at <a href="https://workbench.erisdev.com/">workbench.erisdev.com</a> → 「托管域名 / Hosted Domains」 to claim one for your module.</p>`);
    }

    // ── 查注册表 ──
    let row = null;
    try {
        row = await env.DB.prepare('SELECT * FROM module_domains WHERE fqdn = ?1').bind(host).first();
    } catch (e) { /* D1 不可用时按未注册处理 */ }

    if (!row) {
        return page('域名尚未注册 · Not registered', `<p><b>${host}</b> 尚未在 ErisPulse Workbench 注册。</p><p>This label is not registered yet — sign in at workbench.erisdev.com to claim it for free.</p>`, 404);
    }

    // ── dns 模式：原样回源（disabled 拦截；verifying 也透传，源站要提供验证文件）──
    if (row.mode === 'dns') {
        if (row.status === 'disabled') return page('域名已被停用 · Disabled', '<p>该域名已被管理员停用。如认为存在误会，请联系 ErisPulse 团队。</p><p>This domain has been disabled by an admin. Contact the ErisPulse team if you believe this is a mistake.</p>', 403);
        if (row.status === 'paused') return page('域名已暂停 · Paused', '<p>所有者已暂停该站点。</p><p>This site has been paused by its owner.</p>', 503);
        // 验证期只放行验证文件路径，其余拦截（未验证的源站内容不得对外暴露）
        if (row.status === 'reviewing') return page('等待管理员审核 · Pending review', '<p>该模块已有域名在用，本次申请需管理员审核。</p><p>This module already has a domain — the new one awaits admin approval.</p>', 503);
        if (row.status === 'verifying') {
            if (url.pathname === '/.well-known/erisdev-verify.txt') return originFetch(request);
            return page('等待所有权验证 · Pending verification', '<p>该域名正在等待所有权验证。</p><p>在 workbench.erisdev.com「托管域名」页完成验证后即可访问。</p><p>Ownership verification is pending — the site goes live once verified on the Hosted Domains page at workbench.erisdev.com.</p>', 503);
        }
        return originFetch(request);
    }

    if (row.status === 'disabled') return page('域名已被停用 · Disabled', '<p>该域名已被管理员停用。如认为存在误会，请联系 ErisPulse 团队。</p><p>This domain has been disabled by an admin. Contact the ErisPulse team if you believe this is a mistake.</p>', 403);
    if (row.status === 'paused') return page('域名已暂停 · Paused', '<p>所有者已暂停该站点。</p><p>This site has been paused by its owner.</p>', 503);
    if (row.status === 'verifying') return page('等待所有权验证 · Pending verification', '<p>该域名正在等待所有权验证。</p><p>在 workbench.erisdev.com「托管域名」页完成验证后即可访问。</p><p>Ownership verification is pending — the site goes live once verified on the Hosted Domains page at workbench.erisdev.com.</p>', 503);

    // ── redirect 模式 ──
    if (row.mode === 'redirect') {
        return new Response(null, { status: 301, headers: { Location: row.target_url, 'Cache-Control': 'public, max-age=86400' } });
    }

    // ── git 模式 ──
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('method not allowed', { status: 405 });
    }
    const segs = normalizePath(url.pathname);
    if (!segs) return page('非法路径 · Invalid path', '', 400);
    const [owner, repo] = String(row.git_repo || '').split('/');
    if (!owner || !repo || !row.git_branch) return page('站点配置不完整 · Misconfigured site', '', 503);
    const filePath = segs.length ? segs.join('/') : 'index.html';

    // 版本化缓存键：清理 = version +1，旧键自然淘汰，无需逐 URL 删除
    const cacheKey = new Request(`https://${host}/__v${row.version}/${filePath}`, { method: 'GET' });
    const cache = caches.default;
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    const upstream = await fetch(rawUrl(row.git_host, row.git_base || '', owner, repo, row.git_branch, filePath), {
        cf: { cacheTtl: RAW_TTL_S, cacheEverything: true },
        headers: { 'User-Agent': 'ErisPulse-PluginDomains' },
    });
    if (!upstream.ok) {
        // 目录访问没有尾斜杠时按目录补 index.html 再试一次
        if (upstream.status === 404 && segs.length) {
            const withIndex = await fetch(rawUrl(row.git_host, row.git_base || '', owner, repo, row.git_branch, filePath + '/index.html'), {
                cf: { cacheTtl: RAW_TTL_S, cacheEverything: true },
                headers: { 'User-Agent': 'ErisPulse-PluginDomains' },
            });
            if (withIndex.ok) return serveBranchFile(withIndex, filePath + '/index.html', cacheKey, cache, ctx, request.method === 'GET');
        }
        return page('404', `<p>分支 ${row.git_branch} 上不存在 <code>${filePath.replace(/[<>&"]/g, '')}</code>。</p><p>Not found on branch ${row.git_branch}.</p>`, 404);
    }
    return serveBranchFile(upstream, filePath, cacheKey, cache, ctx, request.method === 'GET');
}
