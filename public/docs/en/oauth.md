# OAuth Integration

The Workbench is a standard OAuth 2.0 provider. Any ecosystem service can delegate sign-in to it.

## 1. Register an application

"Applications" page → enter app name and redirect URIs (`https://` only, up to 5).

Response:

```json
{ "client_id": "ep_…", "client_secret": "eps_…" }
```

> `client_secret` is shown once. If leaked, use "Reset secret" in the app list.

Each account can register up to 5 applications; admins can see all of them.

## 2. Send the user to authorization

```
GET https://workbench.erisdev.com/oauth/authorize
    ?client_id=<client_id>
    &redirect_uri=<registered redirect URI>
    &state=<random string>
```

After the user signs in and clicks "Allow", the browser returns to `redirect_uri?code=…&state=…`. The `code` is valid for 10 minutes and single-use.

## 3. Exchange for a token

```http
POST https://workbench.erisdev.com/oauth/token
Content-Type: application/json

{
  "client_id": "<client_id>",
  "client_secret": "<client_secret>",
  "code": "<code from the previous step>",
  "redirect_uri": "<exactly the same as authorization>"
}
```

```json
{ "access_token": "…", "token_type": "Bearer", "expires_in": 2592000 }
```

## 4. Fetch user info

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

| Field | Meaning |
| --- | --- |
| `uid` | Ecosystem-wide unique ID |
| `role` | `admin` / `mod` / `user`, consistent for all consumers |
| `avatar_url` | Direct avatar URL; empty string when no avatar uploaded |
| `email` | Returned only when verified |

## 5. Avatar URL

```http
GET https://workbench.erisdev.com/api/avatar/<uid>
```

- No authentication required; safe in `<img>`
- Returns the image (10-minute cache) or 404 when no avatar
- Updates propagate within 10 minutes

## Common errors

| Response | Cause |
| --- | --- |
| `invalid client or redirect_uri` | Redirect URI differs from the registered value |
| `invalid_grant` | Code already used, expired, or redirect mismatch |
| `AUTH_REQUIRED` | Missing or expired access_token |
