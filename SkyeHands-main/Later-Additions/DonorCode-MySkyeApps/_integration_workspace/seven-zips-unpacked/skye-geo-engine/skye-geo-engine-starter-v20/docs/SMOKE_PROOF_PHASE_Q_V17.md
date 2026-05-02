# SMOKE PROOF — PHASE Q / V17

As of 2026-04-08 (America/Phoenix)

Passed on the real repo:

- `npm run check`
- `npm run smoke:rollback`
- `npm run scan:routes`
- `npm run scan:ui`
- `npm run smoke:browser-ui`
- `python scripts/smoke-real-browser.py`
- full `npm run smoke`

What V17 proves:

- rollback summary endpoint
- rollback run endpoint
- rollback history endpoint
- rollback pack export endpoint
- rollback controls in the shipped UI
- rollback controls in headless DOM smoke
- rollback controls in real Chromium smoke
- rollback lane included in route and UI scanners
