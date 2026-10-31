# FAQ

| Question | Answer |
| --- | --- |
| Code email not arriving | Check spam; sender is `erisdev@88.com`; resend after 10 minutes |
| "Get an email code first" on sign-up | Click "Send Code" on the sign-up card |
| OAuth button is grey | Provider not configured; use code/password or ask an admin to set credentials |
| Forgot password | Sign in with a code → Account Settings → set a new password |
| 2FA codes always wrong | Ensure the phone clock is network-synced; authenticators are timezone-independent but need accurate time |
| Lost the 2FA secret | Cannot self-recover; an admin must clear `totp_secret` for the account in D1 |
| Lost a token | Not recoverable — revoke and create a new one |
| List unchanged after submit | See status markers under Modules; usually effective within 10 seconds |
| "Admins only" when verifying | Verification is an admin action; users may only edit their own modules |
| Avatar not updating | Avatar URLs cache for 10 minutes; wait or add a cache-busting parameter |
