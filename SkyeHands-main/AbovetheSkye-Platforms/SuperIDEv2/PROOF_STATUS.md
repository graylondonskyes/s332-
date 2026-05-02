# SuperIDEv2 Proof Status

## Proven Locally

- Vite/React launcher shell and mounted public surfaces exist in this folder.
- Surface sync scripts for Neural, SkyDex, SkyeDocxPro, SkyeBlog, and SovereignVariables are present.
- Smokehouse snapshot verification exists via `node scripts/check-smoke-snapshot.js`.
- Browser smoke exists for launcher/runtime behavior and authenticated Neural behavior.
- Static/runtime guard checks exist for gateway-only mode, provider strings, secure defaults, protected apps, and schema contracts.

## Proof Commands

```bash
node scripts/smoke-proof-contract.mjs
node scripts/check-smoke-snapshot.js
node scripts/smoke-interactions-playwright.mjs <local-runtime-url>
node scripts/smoke-neural-authenticated-playwright.mjs <local-runtime-url>
```

## Not Proven Here

- deployed Netlify runtime
- deployed Cloudflare Worker runtime
- live Neon/Postgres data
- live provider-backed AI execution
- live GitHub App push, Netlify deploy, or R2 evidence export

## Remaining Blockers

- Browser smokes still require a running local runtime and Playwright environment.
- Hosted auth, provider, database, and worker behavior remain external to this folder.
- Any enterprise/commercial claims beyond the local shell and proof tooling still need deployment-backed evidence.
