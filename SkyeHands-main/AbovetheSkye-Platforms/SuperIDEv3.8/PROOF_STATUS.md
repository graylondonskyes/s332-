# SuperIDEv3.8 Proof Status

## Proven Locally

- Canonical Vite/React runtime exists in this folder.
- Local API server smoke exists via `node scripts/smoke-api.cjs`.
- Embedded SkyeDocxMax browser smoke exists via `node scripts/smoke-skydocxmax-embedded.mjs <local-runtime-url>`.
- Standalone platform sync logic exists for SkyeMail and SkyeDocxMax.
- Auth is wired as a bridge to `SkyeGateFS13`, not as an isolated secret-bearing browser surface.

## Proof Commands

```bash
node scripts/smoke-proof-contract.cjs
node scripts/smoke-api.cjs
node scripts/smoke-skydocxmax-embedded.mjs <local-runtime-url>
```

## Not Proven Here

- deployed SkyeGateFS13 auth behavior
- live provider execution
- live Stripe or publisher integrations
- deployed storage or evidence chains
- production submission endpoints

## Remaining Blockers

- Browser smokes still need a running local runtime plus Playwright.
- External auth, provider, and delivery systems remain outside this folder's local proof.
- Embedded SkyeDocxMax proof is strong locally, but deployment and third-party service behavior still need external evidence.
