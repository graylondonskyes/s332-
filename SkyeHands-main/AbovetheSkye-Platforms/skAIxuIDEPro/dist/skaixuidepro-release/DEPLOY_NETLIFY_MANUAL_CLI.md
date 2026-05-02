# skAIxuIDEpro · Manual Netlify CLI Deploy

## Required env vars
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, default `gpt-4.1-mini`)
- `OPENAI_FALLBACK_MODEL` (optional, default `gpt-4o-mini`)
- `NEON_DATABASE_URL`
- `ADMIN_EMAILS` (optional, comma-separated)
- `DEFAULT_MONTHLY_REQUEST_CAP` (optional)
- `DEFAULT_MONTHLY_TOKEN_CAP` (optional)
- `ALLOW_PUBLIC_LOG_INGEST` (optional, default `false`)
- `KAIXU_GATEWAY_URL` (optional; only set if you intentionally want remote proxy mode for the helper server)

## Terminal flow
```bash
cd ~/skAIxuIDEpro-deploy
rm -f .env
npm install
netlify link
netlify env:set OPENAI_API_KEY "YOUR_REAL_OPENAI_KEY" --context production --scope functions --secret
netlify env:set NEON_DATABASE_URL "YOUR_REAL_NEON_URL" --context production --scope functions --secret
netlify env:set OPENAI_MODEL "gpt-4.1-mini" --context production --scope functions
netlify env:set OPENAI_FALLBACK_MODEL "gpt-4o-mini" --context production --scope functions
netlify env:set ADMIN_EMAILS "SkyesOverLondonLC@SOLEnterprises.org,SkyesOverLondon@gmail.com" --context production --scope functions
netlify env:set DEFAULT_MONTHLY_REQUEST_CAP "250" --context production --scope functions
netlify env:set DEFAULT_MONTHLY_TOKEN_CAP "250000" --context production --scope functions
netlify env:set ALLOW_PUBLIC_LOG_INGEST "false" --context production --scope functions
npm run verify:release
npm run build
netlify deploy --prod
```

## First-run bootstrap
After deploy, enable Netlify Identity for the site and set registration to **Open** if you want self-signup to work immediately. Then open:
- `/.netlify/functions/db-setup`
- the IDE and create/login with Identity
- `/skAIxuide/admin_panel.html` for admin controls

## What this build now does
- AI requests route through server-side Netlify Functions only.
- Browser never stores provider API keys.
- Identity login is required in production before AI use.
- Neon stores workspace state, AI usage, activity, and member caps.
- Netlify Blobs stores sitewide operator config / announcement state.
- Netlify Forms captures access requests from the auth gate.


Archive normalization notes:
- Every HTML app now loads `/s0l26/shared-runtime.js`.
- Browser key entry is disabled across the archive; kAIxU requests are routed to `/.netlify/functions/gateway-chat` or `/.netlify/functions/gateway-stream`.
- Generic per-app Neon backup uses `/.netlify/functions/app-state`.
- Internal launcher catalog: `/s0l26/catalog.html`.
