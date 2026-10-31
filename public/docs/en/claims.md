# Ownership Claims

Ownership decides who may edit or delete a module.

## Automatic

| Scenario | Ownership |
| --- | --- |
| Signed in via GitHub / Codeberg OAuth | Matched by historical submitter uid (legacy data recorded as `github:<id>`) |
| Submitted inside the Workbench | Owned by `wb:<your uid>` |

## Manual

When automatic matching fails (e.g. Yunhu-era submissions):

1. Open the module detail
2. Click "Claim this module"
3. Provide a reason (prove you develop it; repo/package links help)
4. Wait for an admin review

After approval, ownership transfers and you can edit or delete it. Duplicate claims are rejected; track progress under "My Claims".
