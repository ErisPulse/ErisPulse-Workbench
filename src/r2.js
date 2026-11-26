// R2 上传托管机械层：桶/对象/自定义域 API + 零依赖 zip 解包
// 业务流（申请/重传/删除的状态流转）在 worker.js；本模块只做 API 调用与文件解压。
// token 需 Account.Workers R2 Storage Edit；账户 ID 经 env.R2_ACCOUNT_ID 注入。

import { MIME_EXT } from './domains.js';

export const R2_MAX_ZIP = 5 * 1024 * 1024;         // 上传包 ≤5MB
export const R2_MAX_RAW = 20 * 1024 * 1024;        // 解压后总量 ≤20MB
export const R2_MAX_FILES = 500;                   // 解压后文件数上限
export const R2_TOTAL_LIMIT = 9 * 1024 * 1024 * 1024;  // 全局存储护栏 9GB（免费 10GB）

const R2_ERR = (reason, message) => Object.assign(new Error(message), { reason });

/** R2 JSON API */
async function r2Api(env, method, path, body) {
    const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.R2_ACCOUNT_ID}/r2${path}`, {
        method,
        headers: { Authorization: 'Bearer ' + env.CF_DNS_TOKEN, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    const d = await resp.json().catch(() => ({}));
    if (!resp.ok || !d.success) {
        const msg = d.errors && d.errors[0] ? `${d.errors[0].code} ${d.errors[0].message}` : 'HTTP ' + resp.status;
        throw R2_ERR('upstream_fail', 'R2 API: ' + msg);
    }
    return d.result;
}

/** 传对象：Content-Type 决定访客看到的 MIME */
export async function r2PutObject(env, bucket, key, bytes, contentType) {
    const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.R2_ACCOUNT_ID}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + env.CF_DNS_TOKEN, 'Content-Type': contentType },
        body: bytes,
    });
    if (!resp.ok) throw R2_ERR('upstream_fail', 'R2 object PUT failed: HTTP ' + resp.status);
}

export async function r2DeleteObject(env, bucket, key) {
    const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.R2_ACCOUNT_ID}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + env.CF_DNS_TOKEN },
    });
    if (!resp.ok && resp.status !== 404) throw R2_ERR('upstream_fail', 'R2 object DELETE failed: HTTP ' + resp.status);
}

export async function r2ListObjects(env, bucket) {
    const out = [];
    let cursor = '';
    do {
        const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.R2_ACCOUNT_ID}/r2/buckets/${bucket}/objects?per_page=200${cursor ? '&cursor=' + cursor : ''}`, {
            headers: { Authorization: 'Bearer ' + env.CF_DNS_TOKEN },
        });
        const d = await resp.json().catch(() => ({}));
        if (!resp.ok || !d.success) throw R2_ERR('upstream_fail', 'R2 object list failed: HTTP ' + resp.status);
        for (const o of (d.result || [])) out.push({ key: o.key, size: o.size });
        cursor = (d.result_info && d.result_info.cursor) || '';
    } while (cursor);
    return out;
}

/** 挂自定义域（API 挂载默认 enabled=false，必须显式开启） */
export async function r2AttachDomain(env, bucket, fqdn, zoneName) {
    await r2Api(env, 'POST', `/buckets/${bucket}/domains/custom`, { domain: fqdn, zoneId: env.CF_ZONE_ID, zoneName });
    await r2Api(env, 'PUT', `/buckets/${bucket}/domains/custom/${fqdn}`, { enabled: true });
}

export async function r2SetDomainEnabled(env, bucket, fqdn, enabled) {
    await r2Api(env, 'PUT', `/buckets/${bucket}/domains/custom/${fqdn}`, { enabled });
}

export async function r2DetachDomain(env, bucket, fqdn) {
    await r2Api(env, 'DELETE', `/buckets/${bucket}/domains/custom/${fqdn}`);
}

export async function r2CreateBucket(env, bucket) {
    await r2Api(env, 'POST', '/buckets', { name: bucket, location: 'auto' });
}

export async function r2DeleteBucket(env, bucket) {
    await r2Api(env, 'DELETE', `/buckets/${bucket}`);
}

/** 全局存储护栏：settings 表累计字节数（db 传入避免与主模块循环依赖） */
export async function r2AddBytes(db, delta) {
    const row = await db.prepare("SELECT value FROM settings WHERE key = 'r2_total_bytes'").first();
    const cur = row ? parseInt(row.value, 10) || 0 : 0;
    const next = Math.max(0, cur + delta);
    await db.prepare("INSERT INTO settings (key, value) VALUES ('r2_total_bytes', ?1) ON CONFLICT(key) DO UPDATE SET value = ?1")
        .bind(String(next)).run();
    return next;
}

export async function r2GetTotalBytes(db) {
    const row = await db.prepare("SELECT value FROM settings WHERE key = 'r2_total_bytes'").first();
    return row ? parseInt(row.value, 10) || 0 : 0;
}

/** 清空桶内全部对象并累计回收字节数 */
export async function r2EmptyBucket(env, db, bucket) {
    const objs = await r2ListObjects(env, bucket);
    let freed = 0;
    for (const o of objs) {
        await r2DeleteObject(env, bucket, o.key);
        freed += o.size;
    }
    if (freed) await r2AddBytes(db, -freed);
    return objs.length;
}

/**
 * 零依赖 zip 解包：仅支持 STORED/DEFLATE（DecompressionStream('deflate-raw')）。
 * 返回 [{name, bytes}]，已剥公共顶层目录、跳过目录与 __MACOSX/.DS_Store；超限抛 {reason}。
 */
export async function extractZip(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(u8.buffer);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) {
        if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw R2_ERR('zip_bad', 'not a zip file');
    const count = dv.getUint16(eocd + 10, true);
    let off = dv.getUint32(eocd + 16, true);
    if (count > R2_MAX_FILES) throw R2_ERR('zip_size', 'too many entries');
    const td = new TextDecoder();
    const out = [];
    let total = 0;
    for (let k = 0; k < count; k++) {
        if (off + 46 > u8.length || dv.getUint32(off, true) !== 0x02014b50) throw R2_ERR('zip_bad', 'corrupt central directory');
        const method = dv.getUint16(off + 10, true);
        const csize = dv.getUint32(off + 20, true);
        const usize = dv.getUint32(off + 24, true);
        const nlen = dv.getUint16(off + 28, true);
        const elen = dv.getUint16(off + 30, true);
        const clen = dv.getUint16(off + 32, true);
        const lho = dv.getUint32(off + 42, true);
        const name = td.decode(u8.subarray(off + 46, off + 46 + nlen));
        off += 46 + nlen + elen + clen;
        if (name.endsWith('/') || name.includes('__MACOSX/') || name.endsWith('.DS_Store')) continue;
        if (lho + 30 > u8.length || dv.getUint32(lho, true) !== 0x04034b50) throw R2_ERR('zip_bad', 'corrupt local header');
        const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
        if (start + csize > u8.length) throw R2_ERR('zip_bad', 'corrupt entry data');
        const comp = u8.subarray(start, start + csize);
        let bytes;
        if (method === 0) bytes = comp;
        else if (method === 8) {
            const resp = new Response(new Blob([comp]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
            bytes = new Uint8Array(await resp.arrayBuffer());
        } else throw R2_ERR('zip_bad', 'unsupported compression method');
        if (bytes.length !== usize) throw R2_ERR('zip_bad', 'size mismatch');
        const clean = name.replace(/\\/g, '/');
        if (clean.split('/').includes('..')) throw R2_ERR('zip_bad', 'unsafe path');
        total += bytes.length;
        if (total > R2_MAX_RAW || out.length >= R2_MAX_FILES) throw R2_ERR('zip_size', 'site exceeds decompressed limits');
        out.push({ name: clean, bytes });
    }
    if (!out.length) throw R2_ERR('zip_bad', 'zip is empty');
    // 剥公共顶层目录（GitHub 形 zip 的 site/ 前缀）
    const first = out[0].name.split('/');
    let strip = first.length > 1 ? first[0] + '/' : '';
    for (const f of out) { if (!f.name.startsWith(strip)) { strip = ''; break; } }
    return strip ? out.map(f => ({ name: f.name.slice(strip.length), bytes: f.bytes })) : out;
}

/** 扩展名 → MIME（复用站点服务同一张表） */
export function mimeOf(name) {
    const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    return MIME_EXT[ext] || 'application/octet-stream';
}
