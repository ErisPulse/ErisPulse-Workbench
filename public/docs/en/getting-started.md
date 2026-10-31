# Getting Started

The Workbench is the ErisPulse identity center: one account signs in to every ecosystem service and manages module ownership.

## Sign-in

Three independent methods, one account:

| Method | Flow |
| --- | --- |
| Code | Username or email → receive code → sign in |
| Password | Username or email + password |
| OAuth | GitHub / Codeberg / Yunhu one-click |

OAuth buttons sit below the form; a grey button means that provider is not configured. OAuth accounts can add an email later in Account Settings to enable code/password sign-in.

## Sign-up

Email verification is required:

1. Enter username, email, password
2. Click "Send Code" and enter the 6-digit code
3. "Sign Up & Log In"

Codes are valid for 10 minutes, sent from `erisdev@88.com` — check spam if it does not arrive.

## Account Settings

Top-right avatar → Account Settings:

- **Display name**: shown across all services
- **Avatar**: compressed on upload; shared by every service trusting Workbench identity
- **Password**: set or reset to enable password sign-in
- **Email**: bind or change (a new address requires a new code)
- **Linked identities**: GitHub / Codeberg / Yunhu

## Two-Factor Authentication

Account Settings → "2FA" → Enable, then scan the QR code with your authenticator app (or enter the secret manually) and confirm with a 6-digit code.

Once enabled:

- Code and password sign-in require a second-factor code
- Submitting / editing / deleting modules requires a code (in-page dialog; API calls include `totp_code`)
- OAuth sign-in is not additionally challenged

Disable: enter the current code on the same card. **Losing the secret means losing access** — back it up.
