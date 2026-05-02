# SkyeMail Standalone Platform

This directory is now the canonical standalone source for `SkyeMail` under `AbovetheSkye-Platforms`.

What lives here:
- `suite/`: the self-contained multi-surface SkyeMail platform shell
- `dist/SkyeMail/`: generated route-safe sync output for hosts that expect a flat `/SkyeMail/...` tree
- `netlify/functions/`: the deeper standalone mail service implementation, including auth, mailbox state, drafts, contacts, Gmail OAuth, Gmail sync, inbound handlers, outbound send, and watch/webhook lanes
- `sql/schema.sql`: the standalone database contract for the service implementation
- `.env.template`: the provider/runtime contract, intended to be the only missing layer before live deployment

Operational reality:
- The root pages (`dashboard.html`, `compose.html`, `settings.html`, `contacts.html`, and related pages) are the real standalone mail surfaces.
- The suite now wraps those real surfaces instead of depending on external shared auth or dead `/api/skymail-*` routes.
- When deployed Functions are absent, the same pages fall back to a browser-local demo account/mailbox runtime so the product remains honestly usable on a workstation.
- `_redirects` maps `/SkyeMail/...` requests into `suite/` so subpath deployment works without touching other platforms.
- `npm run build:suite` copies `suite/` into `dist/SkyeMail/` for flat route-safe syncs into another host tree.
- The service implementation is the fuller standalone mail backend.
- The remaining gap to live use is provider/runtime configuration, not missing code files.

Provider note:
- The service layer in this folder is still provider-backed. It contains the code lanes for a serious standalone mail platform surface, but live operation still depends on real provider credentials and webhook/runtime setup from `.env.template`.

Suite/runtime note:
- The suite keeps local drafts, campaign notes, ops notes, and delivery summaries in browser storage.
- The embedded suite surfaces load the actual standalone pages from this same folder, so once provider vars exist the suite rides the real app instead of a mock layer.
- The standalone pages can also self-host a local demo mailbox/account lane in browser storage, covering signup, login, inbox, drafts, compose, contacts, settings, thread view, and key rotation/export surfaces without needing deployed Functions.

Proof coverage:
- Run `npm run smoke:standalone-proof` for the bounded local proof.
- That proof covers the standalone page tree, suite mounts, key backend source lanes, browser-local demo-runtime markers, and `dist/SkyeMail` regeneration.
- It does not certify live Gmail OAuth, deployed Functions, inbound mail bridges, or delivery to provider-backed inboxes.
