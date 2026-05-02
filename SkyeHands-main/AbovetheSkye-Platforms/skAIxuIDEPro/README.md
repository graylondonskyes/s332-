# skAIxuIDEPro

`skAIxuIDEPro` is a launcher-heavy local suite with a static server, Netlify function set, and browser smoke harnesses.

What is proven locally:

- the static launcher shell and `skAIxuide` IDE surface
- the local workspace inventory lane returns real read-only launcher entries instead of placeholder names
- degraded-mode behavior when vendor assets fail
- Netlify function auth gating before database/runtime work
- static server behavior with remote gateway proxy disabled by default unless explicitly configured
- static file serving stays inside the app root and rejects traversal attempts

What is not proven here:

- live Netlify Identity tenancy in deployment
- live provider-backed AI execution
- live remote gateway health
- production database state

## Local Proof Lanes

```bash
node scripts/smoke-proof-contract.mjs
node scripts/smoke-server.mjs
node scripts/smoke-functions.mjs
node scripts/smoke-interactions-playwright.mjs <local-runtime-url>
```

## Honest Runtime Boundaries

This suite should be described as a local launcher/runtime plus proof harness. The static server only proxies remote AI traffic when `KAIXU_GATEWAY_URL` is explicitly set. By default it serves local assets, exposes a read-only local workspace catalog for launcher surfaces, rejects out-of-root path traversal, and returns a disabled response for remote gateway routes.
