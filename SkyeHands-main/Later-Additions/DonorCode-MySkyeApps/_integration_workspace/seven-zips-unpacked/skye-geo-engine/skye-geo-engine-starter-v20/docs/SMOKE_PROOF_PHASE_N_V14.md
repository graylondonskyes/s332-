# SMOKE PROOF — PHASE N / V14

As of 2026-04-08 (America/Phoenix)

## Commands run

- `npm run check`
- `npm run smoke`

## New smoke-backed lane in V14

### Release gate / drift / release-pack

Proved by:

- `scripts/smoke-release.mjs`
- `scripts/smoke-browser-ui.mjs`
- `scripts/smoke-real-browser.py`
- `scripts/scan-routes.mjs`
- `scripts/scan-ui.mjs`

## What the new smoke proves

- `GET /v1/release/gate` returns a real release-gate verdict from workspace evidence
- `GET /v1/release/drift` returns a real drift report with severity, lane, and next actions
- `POST /v1/release/export` persists a release-pack export and generates HTML
- the shipped operator UI exposes real release controls
- the headless DOM smoke drives those controls end to end
- the real Chromium smoke drives those controls end to end

## Smoke notes

- release-gate verdict is expected to remain blocked or conditional while live Neon proof and live remote CMS proof remain blank
- this is not a failure of the smoke; it is the truthful product state
