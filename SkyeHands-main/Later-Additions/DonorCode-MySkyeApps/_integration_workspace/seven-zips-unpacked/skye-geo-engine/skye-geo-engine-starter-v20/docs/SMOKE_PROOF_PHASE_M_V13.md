# SMOKE PROOF PHASE M — V13

As of 2026-04-08 (America/Phoenix)

## What changed in this pass

This pass added a real runtime-contract / provider-contract / claim-evidence / proof-site lane and wired it through routes, UI, scanners, headless DOM smoke, and real Chromium smoke.

Smoke-backed changes in V13:

- `src/lib/runtimeContracts.ts` now builds runtime contracts, validates provider targets, builds claim evidence graphs, and renders proof-site HTML.
- `src/routes/v1/runtime.ts` now serves `GET /v1/runtime/contracts`, `POST /v1/providers/validate`, `GET /v1/claims/evidence`, and `POST /v1/proof/site`.
- `src/index.ts` now routes the new runtime/provider/claim-evidence/proof-site surfaces.
- `src/lib/capabilities.ts` now includes the new routes, controls, proof points, and walkthrough steps in the truth/readiness/reporting graph.
- `src/ui/app.ts` now exposes runtime contracts, provider validation, claim evidence, and proof-site generation through live controls.
- `scripts/scan-routes.mjs` and `scripts/scan-ui.mjs` now fail if those surfaces disappear.
- `scripts/smoke-runtime-contracts.mjs` proves the lane end to end.
- `scripts/smoke-browser-ui.mjs` proves the lane through the shipped inline operator UI.
- `scripts/smoke-real-browser.py` proves the lane through a real Chromium browser session.

## Commands run

- `npm run check`
- `npm run smoke:runtime-contracts`
- `npm run smoke:browser-ui`
- `npm run smoke:real-browser`
- `npm run smoke`

## Result

All commands passed.

## What is now proven

- Runtime contracts can be loaded from the live app surface.
- Provider contract validation can truthfully classify a target before publish.
- Claim evidence graphs can be generated from the real workspace ledger.
- Proof-site HTML can be generated and stored as evidence.
- Route and UI scanners hard-fail if the new truth surfaces disappear.
- The shipped operator UI and the real browser both exercise the new lane successfully.

## Remaining blank items

- Live Neon proof against a real external Neon target
- Live remote CMS publish proof against a real external provider target
