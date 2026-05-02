# SMOKE PROOF — PHASE P / V16

As of 2026-04-08 (America/Phoenix)

Passed on the real repo build:

- `npm run check`
- `npm run smoke:cutover`
- `npm run scan:routes`
- `npm run scan:ui`
- `npm run smoke:browser-ui`
- `python scripts/smoke-real-browser.py`
- full `npm run smoke`

What V16 smoke proves:

- cutover summary endpoint works
- cutover run endpoint works
- cutover history endpoint works
- cutover-pack export endpoint works
- shipped operator UI exposes real cutover controls
- headless DOM UI smoke drives the cutover lane end to end
- real Chromium browser smoke sees the cutover surface in the shipped product

Truth note:

V16 does **not** claim live Neon proof or live remote CMS publish proof. Those remain blank in the directive.
