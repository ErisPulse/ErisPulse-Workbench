// 通用图床机械层：图片校验 + R2 对象读写。
// 运行时无图片编解码能力：WebP 转码由前端完成，本层校验落盘字节确为 WebP（RIFF/WEBP 文件头）。
// token 需 Account.Workers R2 Storage Edit；账户 ID 经 env.R2_ACCOUNT_ID 注入。

import { r2PutObject, r2DeleteObject } from './r2.js';

/** 单张图片字节上限（压缩后） */
export const IMAGE_MAX_BYTES = 256 * 1024;
/** 允许的图片用途 → 对象键前缀与最长边；未知用途一律拒绝 */
export const IMAGE_KINDS = {
    logo: { prefix: 'logo', maxSide: 256 },
    // 提交新模块时的预上传：与 logo 同前缀，模块进索引后地址无需变更（权限校验在调用方）
    'logo-pending': { prefix: 'logo', maxSide: 256 },
    avatar: { prefix: 'avatar', maxSide: 256 },
    cover: { prefix: 'cover', maxSide: 1280 },
};

const IMG_ERR = (reason, message) => Object.assign(new Error(message), { reason });

/** base64 → 字节 */
function b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

const ascii = (u8, from, len) => String.fromCharCode(...u8.subarray(from, from + len));

/**
 * 校验图片字节为 WebP 并返回其像素尺寸。
 * @param {Uint8Array} bytes
 * @returns {{width:number,height:number}|null} 非 WebP 或格式无法识别时为 null
 */
export function inspectWebp(bytes) {
    if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null;
    const chunk = ascii(bytes, 12, 4);
    // VP8 有损：帧头第 6-9 字节为宽高（14 位，低 2 位为缩放标志）
    if (chunk === 'VP8 ') {
        return { width: bytes[26] | (bytes[27] << 8) & 0x3fff, height: bytes[28] | (bytes[29] << 8) & 0x3fff };
    }
    // VP8L 无损：28 位打包的宽高
    if (chunk === 'VP8L') {
        const b = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    return null;
}

/**
 * 解析并校验前端提交的图片数据。
 * @param {string} dataUrl 形如 data:image/webp;base64,....
 * @param {string} kind IMAGE_KINDS 中的用途
 * @returns {{bytes:Uint8Array, width:number, height:number}}
 * @throws {Error} reason: img_bad | img_not_webp | img_size | img_dims | img_kind
 */
export function parseImageUpload(dataUrl, kind) {
    const spec = IMAGE_KINDS[kind];
    if (!spec) throw IMG_ERR('img_kind', 'unknown image kind');
    const m = String(dataUrl || '').match(/^data:image\/webp;base64,([A-Za-z0-9+/=]+)$/);
    if (!m) throw IMG_ERR('img_bad', 'image must be a base64 webp data URL');
    const bytes = b64ToBytes(m[1]);
    if (bytes.length > IMAGE_MAX_BYTES) throw IMG_ERR('img_size', 'image must be ≤256KB');
    const dims = inspectWebp(bytes);
    if (!dims) throw IMG_ERR('img_not_webp', 'image bytes are not valid WebP');
    if (dims.width > spec.maxSide || dims.height > spec.maxSide) throw IMG_ERR('img_dims', `image must be ≤${spec.maxSide}px on the long side`);
    return { bytes, ...dims };
}

/**
 * 对象键：仅允许小写字母、数字、连字符，防止路径穿越。
 * @param {string} name
 * @returns {string|null}
 */
export function safeObjectName(name) {
    const s = String(name || '').toLowerCase();
    return /^[a-z0-9][a-z0-9-]{0,62}$/.test(s) ? s : null;
}

/**
 * 写入图片，返回公开访问地址。同名覆盖。
 * 地址带内容哈希作为版本参数：对象路径固定，覆盖后地址随之变化，访问方与边缘缓存不会命中旧图。
 * @param {object} env
 * @param {string} bucket
 * @param {string} publicBase 形如 https://img.erisdev.com
 * @param {string} kind IMAGE_KINDS 中的用途
 * @param {string} name 对象名（不含扩展名）
 * @param {Uint8Array} bytes 已通过 parseImageUpload 的 WebP 字节
 * @returns {Promise<string>} 访问地址
 */
export async function putImage(env, bucket, publicBase, kind, name, bytes) {
    const spec = IMAGE_KINDS[kind];
    const safe = safeObjectName(name);
    if (!spec || !safe) throw IMG_ERR('img_kind', 'invalid image kind or name');
    const key = `${spec.prefix}/${safe}.webp`;
    await r2PutObject(env, bucket, key, bytes, 'image/webp');
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const version = [...new Uint8Array(digest)].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${publicBase.replace(/\/$/, '')}/${key}?v=${version}`;
}

/**
 * 删除图片；对象不存在时视为成功。
 * @param {object} env
 * @param {string} bucket
 * @param {string} kind
 * @param {string} name
 */
export async function deleteImage(env, bucket, kind, name) {
    const safe = safeObjectName(name);
    if (!IMAGE_KINDS[kind] || !safe) return;
    await r2DeleteObject(env, bucket, `${IMAGE_KINDS[kind].prefix}/${safe}.webp`).catch(() => {});
}
