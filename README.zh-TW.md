[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [日本語](README.ja.md) | [Русский](README.ru.md)

<div align="center">

<img src="https://raw.githubusercontent.com/ErisPulse/ErisPulse/main/.github/assets/ErisPulseLogo.png" width="180" alt="ErisPulse-Workbench" />

# ErisPulse-Workbench

**ErisPulse 統一身分中心（OAuth Provider）與創作者工作台**

<p>
  <a href="https://github.com/ErisPulse/ErisPulse/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License"></a>
  <img src="https://raw.githubusercontent.com/ErisPulse/.github/main/assets/badges/ecosystem.svg" alt="ErisPulse">
</p>

</div>

---

## 部署

```bash
wrangler login
wrangler d1 create erispulse-workbench   # database_id 填入 wrangler.toml
wrangler d1 execute erispulse-workbench --remote --file=schema.sql
wrangler deploy
```

首个注册账户为 admin。

## 环境变量（可选）

| 变量 | 用途 |
| --- | --- |
| `GITHUB_CLIENT_ID/SECRET` | GitHub OAuth 登录 |
| `CODEBERG_CLIENT_ID/SECRET` | Codeberg OAuth 登录 |
| `YUNHU_CLIENT_ID/SECRET` | 云湖 OAuth 登录 |
| `SMTP_HOST/PORT/USER/PASS`、`MAIL_FROM` | 邮箱验证码 |
| `MODULE_REPO_TOKEN` | 向 ModuleRepo 下发模块管理操作 |

未配置的登录方式自动隐藏。

## OAuth 接入

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/oauth/authorize` | GET | 授权入口，参数 `client_id` `redirect_uri` `state` |
| `/oauth/token` | POST | code + client_secret 换 access_token |
| `/api/userinfo` | GET | Bearer，返回 uid/username/display_name/role |

各登录方式需先在对应平台创建 OAuth 应用，回调地址填 `https://<你的域名>/`（与登录入口同源）。任何登录用户都可以在「接入应用」页自助登记 client（client_secret 仅生成时显示一次）。

## 结构

```
public/          前端（静态）
public/vendor/   第三方单文件库（qrcode-generator, MIT）
src/worker.js    Worker 后端
schema.sql       D1 表结构
```

## License

MIT（`public/vendor/qrcode.js` 来自 qrcode-generator，MIT）
