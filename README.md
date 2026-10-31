[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Русский](README.ru.md)

<div align="center">

<img src="https://raw.githubusercontent.com/ErisPulse/ErisPulse/main/.github/assets/ErisPulseLogo.png" width="180" alt="ErisPulse-Workbench" />

# ErisPulse-Workbench

**ErisPulse unified identity center (OAuth Provider) & creator workbench**

<p>
  <a href="https://github.com/ErisPulse/ErisPulse/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License"></a>
  <img src="https://raw.githubusercontent.com/ErisPulse/.github/main/assets/badges/ecosystem.svg" alt="ErisPulse">
</p>

</div>

---

## Deploy

```bash
wrangler login
wrangler d1 create erispulse-workbench   # put database_id into wrangler.toml
wrangler d1 execute erispulse-workbench --remote --file=schema.sql
wrangler deploy
```

The first registered account becomes admin.

## Environment variables (optional)

| Variable | Purpose |
| --- | --- |
| `GITHUB_CLIENT_ID/SECRET` | GitHub OAuth login |
| `CODEBERG_CLIENT_ID/SECRET` | Codeberg OAuth login |
| `YUNHU_CLIENT_ID/SECRET` | Yunhu OAuth login |
| `SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM` | Email verification codes |
| `MODULE_REPO_TOKEN` | Dispatch module-management operations to ModuleRepo |

Unconfigured login methods are hidden automatically.

## OAuth integration

| Endpoint | Method | Description |
| --- | --- | --- |
| `/oauth/authorize` | GET | Authorization entry, params `client_id` `redirect_uri` `state` |
| `/oauth/token` | POST | Exchange code + client_secret for access_token |
| `/api/userinfo` | GET | Bearer; returns uid/username/display_name/role |

Each login method requires an OAuth app on the corresponding platform, with the callback set to `https://<your-domain>/` (same origin as the login entry). Any logged-in user can register a client on the "Connected apps" page (the client_secret is shown only once at generation).

## Structure

```
public/          Frontend (static)
public/vendor/   Third-party single-file libs (qrcode-generator, MIT)
src/worker.js    Worker backend
schema.sql       D1 schema
```

## License

MIT (`public/vendor/qrcode.js` from qrcode-generator, MIT)
