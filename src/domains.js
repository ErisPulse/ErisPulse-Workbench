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
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>
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
