# JobPing Walkthrough + Support Transparency Pass

Implemented code-owned transparency upgrades:

- Added `/walkthrough` authenticated screen with a real changing step-by-step operator walkthrough.
- Added `/help` authenticated help center with operational explanations and failure-state guidance.
- Added support email configuration through `JOBPING_SUPPORT_EMAIL` and optional `NEXT_PUBLIC_SUPPORT_EMAIL`.
- Added `/api/support/meta` so client or external UI can read the configured support identity.
- Added Support/Walkthrough links to the app shell.
- Added mailto support entry points without hardcoding the operator inbox.

This is intentionally not a fake tutorial overlay. The walkthrough changes its screen content, tracks progress, explains the working surface, and links to the actual app pages that execute those workflows.

Remaining live-only requirement:

- Set `JOBPING_SUPPORT_EMAIL` / `NEXT_PUBLIC_SUPPORT_EMAIL` to the inbox the operator wants customers to use.
