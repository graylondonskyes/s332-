# skAIxuIDEPro Proof Status

## Proven Locally

- `node scripts/smoke-server.mjs` proves the local server exposes a structured read-only workspace catalog and blocks static path traversal outside `skAIxuIDEPro`.
- `node scripts/smoke-functions.mjs` proves auth-gated Netlify functions fail closed before DB/runtime work.
- `node scripts/smoke-interactions-playwright.mjs <local-runtime-url>` proves launcher and `skAIxuide` browser surfaces load in both normal and degraded vendor-asset modes.
- `server.js` serves local static assets and keeps remote gateway proxying disabled unless `KAIXU_GATEWAY_URL` is explicitly set.

## Proof Commands

```bash
node scripts/smoke-proof-contract.mjs
node scripts/smoke-server.mjs
node scripts/smoke-functions.mjs
node scripts/smoke-interactions-playwright.mjs <local-runtime-url>
```

## Not Proven Here

- live deployment auth behavior
- live provider-backed AI execution
- remote gateway health
- production database contents

## Remaining Blockers

- Browser smoke still requires a served local runtime and Playwright.
- Hosted identity and provider execution remain external to this folder.
- Many nested static app surfaces are launcher-accessible, but not all of them have their own deep local proof lanes yet.
- App-state sync is now bounded and normalized, but live persistence still depends on deployed auth + database wiring.
