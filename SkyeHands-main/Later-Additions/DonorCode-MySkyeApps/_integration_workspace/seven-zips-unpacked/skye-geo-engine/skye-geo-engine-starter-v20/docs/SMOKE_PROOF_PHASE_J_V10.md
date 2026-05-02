# SMOKE PROOF — PHASE J / V10

As of 2026-04-08 (America/Phoenix)

## Commands run

- `npm run check`
- `npm run smoke`

## Result

Both commands passed. The readiness / contract-truth lane is now part of the full smoke chain and is also exercised from the shipped UI in both the DOM-driven smoke and the real Chromium smoke.

## New smoke-backed proof in V10

- runtime-aware readiness run generation
- persisted readiness evidence listing
- claim-catalog generation from the live capability graph plus runtime state
- contract-pack export
- readiness controls in the shipped operator UI
- readiness data included in report summaries and report-site generation

## Key observed proof outputs

- `smoke:truth` observed `modules=12`, `walkthroughSteps=35`, `checkedRoutes=57`, `checkedControls=50`
- `smoke:readiness` observed `claimCount=12`, `readinessModules=12`, and persisted a readiness export record
- `smoke:reporting` observed `reportModules=12`, `walkthroughModules=12`, and generated report HTML length above 16k characters
- `smoke:browser-ui` and `smoke:real-browser` both exercised the readiness card end to end and observed `claimCatalogClaims=12` plus `contractPackClaims=12`

## What this proves

The platform can now explain not only what modules exist, but which claims are locally proved, which are conditional, and which still depend on stronger live-runtime proof. That truth layer is no longer just descriptive copy; it is a smoke-backed runtime surface tied to the real workspace ledger.

## What remains blank

- live Neon proof against a real external Neon target
- live remote CMS publish proof against a real external provider target
