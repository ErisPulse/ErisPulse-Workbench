# Tokens & Open API

Access tokens (PAT) are for CLI, CI and external tooling — anything non-browser.

## Create a token

"Access Tokens" page → name it → "Generate Token". Format: `epat_` + 40 hex chars, up to 10 per user.

> Shown once. It cannot be retrieved later.

**Skip-2FA token (recommended for CLI/CI)**: accounts with 2FA enabled can tick "Skip 2FA for this token". A live code is required once at creation; afterwards the token calls sensitive endpoints (submit / manage / batch) without `totp_code`. The list shows a "no-2FA" badge.

## Calling convention

```http
Authorization: Bearer epat_…
Content-Type: application/json
```

A token carries exactly your signed-in permissions.

## Endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/modules` | GET | Module index (ownership, verification) |
| `/api/modules/submit` | POST | Submit a module / adapter |
| `/api/modules/manage` | POST | Edit / verify / delete (single) |
| `/api/modules/batch` | POST | Batch verify / unverify / delete |
| `/api/me` | GET | Account info and linked identities |
| `/api/userinfo` | GET | User info (includes `avatar_url`) |
| `/api/modules/ops` | GET | Operation status: `?name=&type=` for one module's recent ops (owner/admin); omit for your own recent ops |
| `GET /api/health` | — | Health check (public) |
| `GET /api/meta` | — | Self-describing API directory (public) |
| `GET /api/modules/stats` | — | Ecosystem stats (public) |
| `GET /api/modules?q=term` | — | Fuzzy search (name/package/description/tags) |

## Example

```bash
curl -X POST https://workbench.erisdev.com/api/modules/submit   -H "Authorization: Bearer epat_…"   -H "Content-Type: application/json"   -d '{
    "name": "MyModule",
    "type": "module",
    "package": "ErisPulse-MyModule",
    "description": "Description, at least 10 characters",
    "author": "Your Name",
    "repository": "https://github.com/you/MyModule",
    "category": 1,
    "tags": ["tool"],
    "i18n": ["zh", "en"],
    "min_sdk_version": ">=2.7.0"
  }'
```

Batch:

```json
{
  "action": "verify",
  "items": [{ "name": "MyModule", "type": "module" }],
  "totp_code": "123456"
}
```

When 2FA is enabled, submit/manage endpoints require `totp_code`.

## 428 与宽限

When 2FA is required but missing/expired, endpoints return `428 TOTP_REQUIRED`; the web UI prompts automatically — API callers should retry with `totp_code`. After one successful verification the **web session has a 10-minute grace window** (PATs are excluded unless marked skip-2FA).
