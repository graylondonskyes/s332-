# skAIxuIDEpro · server-side AI + auth + persistence hardening

This package now routes the AI lane through Netlify Functions only and keeps provider keys out of browser code.

## Implemented in this build
- `OPENAI_API_KEY` is server-side only.
- Public AI identity is `kAIxU` under `SKYES OVER LONDON` only.
- Production IDE usage is gated behind Netlify Identity login.
- Neon persists member records, workspace snapshots, AI usage, activity, and logs.
- Request/token caps are enforced per member account inside the gateway functions.
- Admin dashboard can review members, tune caps, suspend users, and inspect usage/workspace footprint.
- Netlify Blobs stores sitewide operator config / announcement state.
- Netlify Forms captures access / support submissions from the auth gate.
- The oversized s0l26 0s footer menu is now collapsible by default.

## Main files added
- `netlify/functions/_lib/kaixu-platform.js`
- `netlify/functions/auth-me.js`
- `netlify/functions/workspace-sync.js`
- `netlify/functions/admin-overview.js`
- `netlify/functions/admin-user-update.js`
- `netlify/functions/site-config.js`
- `netlify/functions/runtime-status.js`
- `netlify/functions/db-setup.js`
- `netlify/functions/identity-signup.js`
- `netlify/functions/identity-login.js`
- `skAIxuide/s0l26-cloud.js`
- `DEPLOY_NETLIFY_MANUAL_CLI.md`

## Main files patched
- `netlify/functions/gateway-chat.js`
- `netlify/functions/gateway-stream.js`
- `netlify/functions/_lib/kaixu-openai.js`
- `netlify/functions/logs.js`
- `netlify/functions/logs-setup.js`
- `skAIxuide/index.html`
- `skAIxuide/admin_panel.html`
- `package.json`
- `.env.example`

## Required deploy-side setup
- Set Netlify env vars from `.env.example`.
- Enable Netlify Identity on the target site.
- Run `npm run build` before `netlify deploy --prod` if you want the `@netlify/neon` auto-provision lane available in CLI workflow.
- After deploy, hit `/.netlify/functions/db-setup` once or simply log in and use the IDE/admin surface.
