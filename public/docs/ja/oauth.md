# OAuth 連携

Workbench は標準 OAuth 2.0 プロバイダーです。あらゆるサービスがログインを委譲できます。

## 1. アプリを登録

「接続アプリ」ページ → アプリ名とリダイレクト URI（`https://` のみ、最大 5 件）。

```json
{ "client_id": "ep_…", "client_secret": "eps_…" }
```

> `client_secret` は 1 度だけ表示されます。漏洩したらアプリ一覧の「シークレット再発行」を使います。

1 アカウント最大 5 件。管理者はすべて閲覧できます。

## 2. 認証へ誘導

```
GET https://workbench.erisdev.com/oauth/authorize
    ?client_id=<client_id>
    &redirect_uri=<登録した URI>
    &state=<ランダム文字列>
```

ユーザーが「許可」を押すと `redirect_uri?code=…&state=…` に戻ります。`code` は 10 分・1 回限り。

## 3. トークンと交換

```http
POST https://workbench.erisdev.com/oauth/token
Content-Type: application/json

{
  "client_id": "<client_id>",
  "client_secret": "<client_secret>",
  "code": "<前ステップの code>",
  "redirect_uri": "<認証時と完全に同一>"
}
```

```json
{ "access_token": "…", "token_type": "Bearer", "expires_in": 2592000 }
```

## 4. ユーザー情報

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

| フィールド | 説明 |
| --- | --- |
| `uid` | エコシステム全体で一意 |
| `role` | `admin` / `mod` / `user`、全サービス共通 |
| `avatar_url` | アバター直 URL。未設定なら空文字列 |
| `email` | 検証済みのみ返却 |

## 5. アバター URL

```http
GET https://workbench.erisdev.com/api/avatar/<uid>
```

- 認証不要、`<img>` でそのまま利用可
- 画像（10 分キャッシュ）または 404
- 更新は 10 分以内に反映

## よくあるエラー

| 応答 | 原因 |
| --- | --- |
| `invalid client or redirect_uri` | リダイレクト URI が登録値と不一致 |
| `invalid_grant` | code の使用済み・期限切れ・URI 不一致 |
| `AUTH_REQUIRED` | access_token の欠落・期限切れ |
