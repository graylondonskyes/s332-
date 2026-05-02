# SMOKE PROOF — PHASE T / V20

As of 2026-04-09 (America/Phoenix)

Passed on the real repo:

- `npm run check`
- `npm run smoke:remediate`
- `npm run scan:routes`
- `npm run scan:ui`
- `npm run smoke:browser-ui`
- `python scripts/smoke-real-browser.py`
- full `npm run smoke`

What V20 proves:

- article remediation generation endpoint
- article remediation export endpoint
- article remediation history endpoint
- corrective remediation actions for stored articles
- stronger publish-candidate article body generation for stored articles
- predicted enrichment generation for remediated articles
- predicted review generation with score delta and gate prediction for remediated articles
- article remediation controls in the shipped UI
- article remediation controls in headless DOM smoke
- article remediation controls in real Chromium smoke
- critical UI controls are asserted to exist inside visible viewport margins in real-browser smoke before the scenario runs
- remediation generation and remediation export are actually clicked and verified in real-browser smoke rather than only being discovered
- article remediation lane included in route and UI scanners
- article remediation lane included in the full smoke chain
- proof-matrix and walkthrough accounting now observe stored article-remediation evidence instead of leaving the corrective writing step invisible

Command highlights observed during proof:

- `npm run smoke:remediate` returned `ok: true` with `baselineScore: 86` and `predictedScore: 95`
- `npm run smoke:browser-ui` returned `ok: true` with `articleRemediationScoreDelta: 3`, `articleRemediationPredictedScore: 91`, `articleRemediationPredictedGate: "ready"`, and `articleRemediationHtmlLength: 10395`
- `python scripts/smoke-real-browser.py` returned `ok: true`, reported `controlsPresent: true`, showed the `Article remediation candidate` section in the visible UI, and completed the remediation generate/export path in a real browser session
