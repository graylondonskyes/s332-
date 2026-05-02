# SMOKE PROOF PHASE L — V12

As of 2026-04-08 (America/Phoenix)

## What changed in this pass

This pass removed shipped demo residue and smoke-scaffolding residue from the core operator surface and the core smoke lanes.

Smoke-backed changes in V12:

- `src/ui/app.ts` no longer ships seeded `demo-org`, `example.com`, or seeded example email/CDN values in the live operator surface.
- `scripts/smoke-api.mjs` runs against a live local fixture server instead of inline fetch stubs.
- `scripts/smoke-replay.mjs` runs against a live local fixture server instead of inline fetch stubs.
- `scripts/smoke-publish.mjs` runs against a live local fixture/publisher server instead of inline fetch stubs.
- `scripts/smoke-agency.mjs` runs against a live local fixture server instead of inline fetch stubs.
- `scripts/smoke-reporting.mjs` runs against a live local fixture/publisher server instead of inline `mockFetch`.
- `scripts/smoke-readiness.mjs` runs against a live local fixture/publisher server instead of inline `mockFetch`.
- `scripts/smoke-strategy.mjs` runs against a live local fixture/publisher server instead of inline `mockFetch`.
- `scripts/scan-no-demo-residue.mjs` hard-fails the smoke chain if banned demo/example literals or `mockFetch` residue are present in the shipped UI defaults or core smoke scripts.
- `scripts/helpers/test-server.mjs` and `scripts/helpers/persistent-test-server.mjs` now emit fixture pages with port-correct canonical URLs, keeping replay citation proof coherent with the actual runtime under smoke.

## Commands run

- `npm run check`
- `npm run smoke`

## Result

Both commands passed.

## What is now proven

- The shipped operator UI is not seeded with demo/example defaults.
- The smoke chain hard-fails on banned demo/example residue in the shipped UI defaults and core smoke scripts.
- Core audit/research/publish/reporting/readiness/strategy smoke lanes run against a live local fixture server rather than inline fetch stubs.
- The full smoke chain still passes after the cleanup.

## Remaining blank items

- Live Neon proof against a real external Neon target
- Live remote CMS publish proof against a real external provider target
