# Интеграция OAuth

Workbench — стандартный OAuth 2.0 провайдер. Любой сервис может делегировать ему вход.

## 1. Регистрация приложения

Страница «Приложения» → название и redirect URI (только `https://`, до 5).

```json
{ "client_id": "ep_…", "client_secret": "eps_…" }
```

> `client_secret` показывается один раз. При утечке используйте «Сменить секрет».

До 5 приложений на аккаунт; администраторы видят все.

## 2. Отправка пользователя на авторизацию

```
GET https://workbench.erisdev.com/oauth/authorize
    ?client_id=<client_id>
    &redirect_uri=<зарегистрированный URI>
    &state=<случайная строка>
```

После «Разрешить» браузер вернётся на `redirect_uri?code=…&state=…`. Код действует 10 минут и одноразовый.

## 3. Обмен на токен

```http
POST https://workbench.erisdev.com/oauth/token
Content-Type: application/json

{
  "client_id": "<client_id>",
  "client_secret": "<client_secret>",
  "code": "<код из предыдущего шага>",
  "redirect_uri": "<точно такой же, как при авторизации>"
}
```

```json
{ "access_token": "…", "token_type": "Bearer", "expires_in": 2592000 }
```

## 4. Информация о пользователе

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

| Поле | Значение |
| --- | --- |
| `uid` | Уникальный ID во всей экосистеме |
| `role` | `admin` / `mod` / `user`, одинаков для всех |
| `avatar_url` | Прямая ссылка; пустая строка, если аватара нет |
| `email` | Возвращается только после подтверждения |

## 5. URL аватара

```http
GET https://workbench.erisdev.com/api/avatar/<uid>
```

- Без аутентификации, подходит для `<img>`
- Изображение (кэш 10 минут) или 404
- Обновления применяются в течение 10 минут

## Частые ошибки

| Ответ | Причина |
| --- | --- |
| `invalid client or redirect_uri` | redirect URI не совпадает с зарегистрированным |
| `invalid_grant` | Код использован, истёк или redirect не совпал |
| `AUTH_REQUIRED` | Нет access_token или он истёк |
