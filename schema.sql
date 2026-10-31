-- ErisPulse Workbench D1 Schema
-- 执行：wrangler d1 execute erispulse-workbench --remote --file=schema.sql

PRAGMA foreign_keys = ON;

-- ── 账户与身份 ──
CREATE TABLE IF NOT EXISTS users (
    uid          TEXT PRIMARY KEY,             -- 'u_' + 12 hex
    username     TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role         TEXT NOT NULL DEFAULT 'user', -- admin | mod | user
    status       TEXT NOT NULL DEFAULT 'ok',   -- ok | banned
    avatar_url   TEXT,
    avatar_blob  TEXT,
    avatar_mime  TEXT,
    bio          TEXT NOT NULL DEFAULT '',
    email        TEXT UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0,
    password_hash TEXT,                        -- pbkdf2$iter$salt$hash（可空=仅验证码/OAuth）
    verify_code_hash TEXT,
    verify_expires_at TEXT,
    totp_secret  TEXT,                         -- base32，NULL=未初始化
    totp_enabled INTEGER NOT NULL DEFAULT 0,   -- 1=两步验证已开启
    totp_last_ok TEXT,                         -- 最近一次动态码验证时间（宽限窗口起点）
    created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identities (
    provider     TEXT NOT NULL,                -- github | codeberg | yunhu
    provider_uid TEXT NOT NULL,
    uid          TEXT NOT NULL REFERENCES users(uid),
    PRIMARY KEY (provider, provider_uid)
);
CREATE INDEX IF NOT EXISTS idx_identities_uid ON identities(uid);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    uid        TEXT NOT NULL REFERENCES users(uid),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_uid ON sessions(uid);

-- ── OAuth Provider（工作台作为身份源，供生态服务接入）──
CREATE TABLE IF NOT EXISTS oauth_clients (
    client_id     TEXT PRIMARY KEY,
    client_secret_hash TEXT NOT NULL,
    name          TEXT NOT NULL,
    redirect_uris TEXT NOT NULL,               -- JSON 数组字符串
    created_by    TEXT,
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_codes (
    code_hash  TEXT PRIMARY KEY,
    client_id  TEXT NOT NULL REFERENCES oauth_clients(client_id),
    uid        TEXT NOT NULL,
    redirect_uri TEXT NOT NULL,
    scope      TEXT NOT NULL DEFAULT 'identity',
    expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
    token_hash TEXT PRIMARY KEY,
    client_id  TEXT NOT NULL,
    uid        TEXT NOT NULL,
    scope      TEXT NOT NULL DEFAULT 'identity',
    expires_at TEXT NOT NULL,
    revoked    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tokens_uid ON oauth_tokens(uid);

-- ── 配置与审计 ──
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_uid  TEXT,
    action     TEXT NOT NULL,
    target     TEXT,
    detail     TEXT,
    created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
    ('allow_register', 'on');

-- 访问令牌（开放 API / CLI epsdk push / 外部工具链，epat_ 前缀）
CREATE TABLE IF NOT EXISTS personal_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    uid         TEXT NOT NULL REFERENCES users(uid),
    name        TEXT NOT NULL,
    token_hash  TEXT NOT NULL UNIQUE,
    prefix      TEXT NOT NULL,
    skip_2fa    INTEGER NOT NULL DEFAULT 0,    -- 1=该令牌调用敏感接口免动态码
    created_at  TEXT NOT NULL,
    last_used_at TEXT,
    revoked     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pt_uid ON personal_tokens(uid);

-- 两步验证登录挑战（一次性票据，5 分钟有效）
CREATE TABLE IF NOT EXISTS twofa_challenges (
    token_hash TEXT PRIMARY KEY,
    uid        TEXT NOT NULL REFERENCES users(uid),
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

-- 注册邮箱验证码（注册前邮箱所有权验证；注册成功后删除）
CREATE TABLE IF NOT EXISTS email_codes (
    email      TEXT PRIMARY KEY,
    code_hash  TEXT NOT NULL,
    purpose    TEXT NOT NULL DEFAULT 'register',
    expires_at TEXT NOT NULL
);

-- 模块归属认领
CREATE TABLE IF NOT EXISTS module_claims (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    uid         TEXT NOT NULL,
    module_name TEXT NOT NULL,
    module_type TEXT NOT NULL,
    reason      TEXT NOT NULL DEFAULT '',
    status      TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
    created_at  TEXT NOT NULL,
    handled_at  TEXT,
    handled_by  TEXT
);
CREATE INDEX IF NOT EXISTS idx_claims_status ON module_claims(status);
