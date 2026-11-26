# Hosted Domains

Request a free subdomain for your published module: `plugin-<label>.erisdev.com`. DNS is managed by the Workbench — no manual DNS work needed.

## Limits

- Up to **2** domains per module
- Up to **10** domains per account

## Integration Modes

| Mode | Description | Use case |
|------|-------------|----------|
| **Upload static site** (zip ≤5MB) | Upload a zip (≤20MB decompressed), hosted directly on platform R2 — no server needed; use "Re-upload" in the row to update content | Pure static pages without any server or Pages setup |
| **Repo branch** (recommended) | Serve a git repo branch directly as the site; GitHub, Codeberg and self-hosted Gitea/Forgejo/GitLab instances supported (must be publicly reachable over HTTPS) | Module docs and demos live in your repo |
| **Redirect** | 301-redirect visitors to an https URL you provide | Content is hosted elsewhere; you just want a memorable entry |
| **Own server** (advanced) | The platform creates a proxied DNS record (CNAME / A / AAAA) to your server; traffic goes through Cloudflare | Self-hosted servers and deployments |

## How to Apply

Hosted Domains page (or a module detail page → Hosted Domains button) → select module → enter label → pick a mode → submit.

- **Label rules**: 2-63 lowercase letters, digits or inner hyphens; official reserved names (www, api, admin, …) are unavailable
- **Repo branch mode**: if the repo matches the module's registered repository, it activates immediately; otherwise a verification file is required (see below)
- **Redirect mode**: active as soon as submitted

## Ownership Verification

**Repo branch mode (different repo)**: place `erisdev-site-verify.txt` at the **root of the branch** with the verification code shown at application time, then click Verify in the Workbench.

**Own server mode**: make your server return the verification code at `https://<your-domain>/.well-known/erisdev-verify.txt` (the server must answer requests whose Host is this domain), then click Verify.

Verification can be retried any time; the domain activates as soon as it passes.

## Management

- **Pause / Resume / Delete**: from the domain list; accounts with two-step verification need a TOTP code
- Deleting an own-server domain also removes the managed DNS record
- Changing the repo or branch requires re-verification (same-repo case excepted)

## Usage Policy and Abuse

Hosted domains are tied to module ownership and content should relate to the module. Phishing, malware or other abusive content will be disabled by admins without notice. Report abuse via the contact channel in the workbench.erisdev.com footer.
