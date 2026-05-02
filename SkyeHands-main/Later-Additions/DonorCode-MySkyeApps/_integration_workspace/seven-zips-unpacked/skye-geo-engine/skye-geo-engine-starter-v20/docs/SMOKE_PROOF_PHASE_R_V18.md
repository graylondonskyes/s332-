# SMOKE PROOF — PHASE R / V18

As of 2026-04-09 (America/Phoenix)

Passed on the real repo:

- `npm run check`
- `npm run smoke:enrich`
- `npm run scan:routes`
- `npm run scan:ui`
- `npm run smoke:browser-ui`
- `python scripts/smoke-real-browser.py`
- full `npm run smoke`

What V18 proves:

- article enrichment generation endpoint
- article enrichment export endpoint
- article enrichment history endpoint
- schema-graph generation for stored articles
- internal-link planning for stored articles
- metadata pack generation for stored articles
- article enrichment controls in the shipped UI
- article enrichment controls in headless DOM smoke
- article enrichment controls in real Chromium smoke
- article enrichment lane included in route and UI scanners
- article enrichment lane included in the full smoke chain
