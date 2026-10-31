# OAuth 接入

工作台是标准 OAuth 2.0 Provider。任何生态服务都可以把「登录」交给它，用户只需一个 ErisPulse 账户。

## 1. 登记应用

「接入应用」页 → 填写应用名称与回调地址（必须 `https://`，每行一个，最多 5 个）。

登记成功返回：

```json
{ "client_id": "ep_…", "client_secret": "eps_…" }
```

> `client_secret` 仅显示一次。泄露后在应用列表点「重置密钥」。

每个账户最多登记 5 个应用；管理员可查看全部应用。

## 2. 引导用户授权

```
GET https://workbench.erisdev.com/oauth/authorize
    ?client_id=<client_id>
    &redirect_uri=<登记过的回调地址>
    &state=<随机字符串>
```

用户登录并点「允许」后跳回 `redirect_uri?code=…&state=…`。`code` 10 分钟有效、一次性。

## 3. 兑换访问令牌

```http
POST https://workbench.erisdev.com/oauth/token
Content-Type: application/json

{
  "client_id": "<client_id>",
  "client_secret": "<client_secret>",
  "code": "<上一步的 code>",
  "redirect_uri": "<与授权时完全一致>"
}
```

响应：

```json
{ "access_token": "…", "token_type": "Bearer", "expires_in": 2592000 }
```

## 4. 获取用户信息

```http
GET https://workbench.erisdev.com/api/userinfo
Authorization: Bearer <access_token>
```

```json
{
  "uid": "u_…",
  "username": "yingxinche",
  "display_name": "YingXinche",
  "role": "user",
  "avatar_url": "https://workbench.erisdev.com/api/avatar/u_…",
  "email": "you@example.com"
}
```

| 字段 | 说明 |
| --- | --- |
| `uid` | 全生态唯一用户 ID |
| `role` | `admin` / `mod` / `user`，所有接入方一致 |
| `avatar_url` | 头像直链，无头像时为空字符串 |
| `email` | 仅已验证时返回 |

## 5. 头像 URL

```http
GET https://workbench.erisdev.com/api/avatar/<uid>
```

- 无需认证，可直接用于 `<img>`
- 有头像返回图片（缓存 10 分钟），无头像返回 404
- 头像更新后 10 分钟内全网生效

## 常见错误

| 返回 | 原因 |
| --- | --- |
| `invalid client or redirect_uri` | 回调地址与登记值不一致 |
| `invalid_grant` | code 已使用、过期，或 redirect_uri 不符 |
| `AUTH_REQUIRED` | access_token 缺失或过期 |
