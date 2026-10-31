# OAuth 接入

工作台是標準 OAuth 2.0 Provider。任何生態服務都可以把「登入」交給它，使用者只需一個 ErisPulse 帳戶。

## 1. 登記應用

「接入應用」頁 → 填寫應用名稱與回呼位址（必須 `https://`，每行一個，最多 5 個）。

登記成功回傳：

```json
{ "client_id": "ep_…", "client_secret": "eps_…" }
```

> `client_secret` 僅顯示一次。洩露後在應用清單點「重設密鑰」。

每個帳戶最多登記 5 個應用；管理員可查看全部應用。

## 2. 引導使用者授權

```
GET https://workbench.erisdev.com/oauth/authorize
    ?client_id=<client_id>
    &redirect_uri=<登記過的回呼位址>
    &state=<隨機字串>
```

使用者登入並點「允許」後跳回 `redirect_uri?code=…&state=…`。`code` 10 分鐘有效、一次性。

## 3. 兌換存取權杖

```http
POST https://workbench.erisdev.com/oauth/token
Content-Type: application/json

{
  "client_id": "<client_id>",
  "client_secret": "<client_secret>",
  "code": "<上一步的 code>",
  "redirect_uri": "<與授權時完全一致>"
}
```

回應：

```json
{ "access_token": "…", "token_type": "Bearer", "expires_in": 2592000 }
```

## 4. 取得使用者資訊

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

| 欄位 | 說明 |
| --- | --- |
| `uid` | 全生態唯一使用者 ID |
| `role` | `admin` / `mod` / `user`，所有接入方一致 |
| `avatar_url` | 頭像直鏈，無頭像時為空字串 |
| `email` | 僅驗證過時回傳 |

## 5. 頭像 URL

```http
GET https://workbench.erisdev.com/api/avatar/<uid>
```

- 無需認證，可直接用於 `<img>`
- 有頭像回傳圖片（快取 10 分鐘），無頭像回傳 404
- 頭像更新後 10 分鐘內全網生效

## 常見錯誤

| 回應 | 原因 |
| --- | --- |
| `invalid client or redirect_uri` | 回呼位址與登記值不一致 |
| `invalid_grant` | code 已使用、過期，或 redirect_uri 不符 |
| `AUTH_REQUIRED` | access_token 缺失或過期 |
