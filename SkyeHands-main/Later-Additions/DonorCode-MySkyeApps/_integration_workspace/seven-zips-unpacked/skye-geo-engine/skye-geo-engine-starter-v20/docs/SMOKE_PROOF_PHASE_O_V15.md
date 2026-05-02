# SMOKE PROOF — PHASE O / V15

As of 2026-04-08 (America/Phoenix)

## Commands run

- `npm run check`
- `npm run smoke:targets`
- `npm run smoke`

## What this pass proved

### New target-probe lane

- `GET /v1/targets/summary` returns a real summary from workspace evidence
- `POST /v1/targets/probe` runs a real network probe and persists the result
- `GET /v1/targets/probes` returns stored probe history
- `POST /v1/targets/export` returns a real HTML export plus a stored evidence record
- generic provider targets can be probed and stored
- `neon-http` targets can be probed and stored as contract/reachability evidence
- target probes do not upgrade themselves into live proof; the lane preserves that distinction instead of faking it

### Shipped UI proof

- the shipped operator UI exposes target-summary, target-probe, target-probe history, and target-pack controls
- headless DOM smoke drives that target lane through the shipped UI
- real Chromium smoke sees the live target-probe card and drives the probe flow through actual visible controls
- route and UI scanners fail if the target-probe routes or controls disappear

### Release / drift proof

- release logic now surfaces missing target probes as real drift instead of silently assuming blocker understanding
- proof matrix and walkthrough completion now observe target-probe evidence so the lane contributes to real proof state

## Smoke-backed outputs observed

- dedicated target-probe smoke completed with at least 2 stored probes and 1 export
- full smoke chain completed cleanly after the V15 changes
- shipped UI smoke completed cleanly after the V15 changes
- real Chromium smoke completed cleanly after the V15 changes

## Not marked complete in this pass

- live Neon proof against a real external Neon target
- live remote CMS publish proof against a real external provider target

Those remain blank and were not promoted by this pass.
