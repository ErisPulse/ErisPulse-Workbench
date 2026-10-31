# Modules

## Submitting

"Submit Module" → fill the form → submit. The Workbench dispatches to ErisPulse-ModuleRepo; the module appears in the store once the workflow finishes.

| Field | Required | Notes |
| --- | --- | --- |
| `name` | ✓ | letters / digits / `_` / `-` |
| `type` | ✓ | `module` or `adapter` |
| `package` | ✓ | PyPI package name |
| `description` | ✓ | ≥10 chars, languages separated by `|` |
| `author` | ✓ | Author name |
| `repository` | ✓ | github.com / codeberg.org |
| `category` | ✓ | 1 Tools / 2 Fun / 3 Admin / 4 Notify / 5 AI / 6 Platform / 7 Analytics |
| `tags` | | array |
| `i18n` | | UI languages |
| `min_sdk_version` | | minimum SDK version |
| `logo` | | https or data:image, ≤100KB |

## Editing

Module detail → change any field → "Save Changes". Owners can edit every field; `verified` is admin-only.

Logos can be pasted directly; the frontend compresses them to ≤100KB.

## Batch operations

Click "Select" on the list page:

- Tick multiple modules, then "Verify selected / Unverify selected / Delete selected" (max 50)
- One 2FA check and one dispatch — much faster than one-by-one
- "Cancel" leaves selection mode

## Status markers

| Badge | Meaning |
| --- | --- |
| Verify processing | Dispatched, workflow running |
| Verify awaiting confirm | Not effective after 30 minutes; retry or check the workflow |
| Verified / Unverified | Actual state in the repository index |

The list reconciles on every refresh: an operation only completes when the snapshot really reflects its target state.

## Permissions

| Role | Can do |
| --- | --- |
| Owner | Edit all fields of their modules, delete, request ownership |
| admin / mod | Additionally verify any module, review claims, batch operations |

## Sync latency

Usually effective within 10 seconds, a few minutes at most. If it stays "awaiting confirm", check ErisPulse-ModuleRepo Actions.
