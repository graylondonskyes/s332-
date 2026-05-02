# SMOKE PROOF — PHASE I / V9

As of 2026-04-07 (America/Phoenix)

## What was proven in this pass

The new reporting / explainability lane is not theoretical. It is smoke-backed.

### `npm run check`

Passed.

### `npm run smoke`

Passed.

That full chain now includes these reporting proofs:

- `scripts/smoke-reporting.mjs`
  - creates a workspace and project
  - runs a live audit against the fixture page
  - exports audit evidence
  - ingests source-ledger inputs
  - creates a brief and draft
  - executes a publish run successfully
  - creates prompt-pack and replay evidence
  - creates agency keys/settings/seats/clients/invoice export
  - creates backlink site + placement + reconciliation
  - exports a workspace bundle
  - generates `GET /v1/proof/matrix`
  - generates `GET /v1/walkthrough-runs`
  - generates `GET /v1/reports/summary`
  - generates `POST /v1/reports/site`
  - exports `POST /v1/reports/export`

- `scripts/smoke-browser-ui.mjs`
  - drives the real shipped operator UI in the DOM harness
  - proves proof-matrix loading from the UI
  - proves walkthrough-completion loading from the UI
  - proves report summary loading from the UI
  - proves report-site generation from the UI
  - proves report export from the UI

- `scripts/smoke-real-browser.py`
  - drives the actual shipped UI in Chromium
  - proves the reporting controls are present in the real browser DOM
  - proves proof-matrix loading in-browser
  - proves walkthrough-completion loading in-browser
  - proves investor report summary generation in-browser
  - proves report-site HTML generation in-browser
  - proves stored report export evidence in-browser

### Route / UI scan proof

- `scripts/scan-routes.mjs` now checks:
  - `GET /v1/proof/matrix`
  - `GET /v1/walkthrough-runs`
  - `GET /v1/reports/summary`
  - `POST /v1/reports/site`
  - `POST /v1/reports/export`

- `scripts/scan-ui.mjs` now checks:
  - `load-proof-matrix`
  - `load-walkthrough-run`
  - `load-report-summary`
  - `generate-report-site`
  - `export-report-site`

## Smoke-backed outcome

The platform can now do these real things with no theater:

- explain purpose from the real capability graph
- show detailed module walkthroughs
- validate no-theater claim alignment
- score workspace walkthrough completion from real activity
- generate a workspace proof matrix from real module + ledger coverage
- generate a detailed client / investor / operator report site from actual workspace history
- export that report site as retained evidence

## What remains blank

These are still not marked complete:

- live Neon target proof
- live remote CMS provider proof
