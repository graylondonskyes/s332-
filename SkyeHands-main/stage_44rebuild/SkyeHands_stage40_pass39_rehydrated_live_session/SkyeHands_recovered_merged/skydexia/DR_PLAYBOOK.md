# SkyDexia Disaster Recovery Playbook

Generated: 2026-04-16T12:33:34.166Z

## Scope
- CDE runtime and directive controls
- AE command surfaces and smoke gates
- SkyDexia knowledge updates and alerting state

## Recovery Steps
1. Validate directive integrity via `npm run directive:validate --silent`.
2. Create a fresh snapshot via `node ./scripts/skydexia-snapshot-state.mjs`.
3. If knowledge sync fails, execute rollback via `node ./scripts/skydexia-rollback-from-snapshot.mjs`.
4. Verify rollback and operational readiness via `node ./scripts/skydexia-rollback-verify.mjs`.
5. Regenerate alerting outputs via `node ./scripts/skydexia-admin-notification-service.mjs` and `node ./scripts/skydexia-alert-audit-trail.mjs`.

## Required Evidence
- Snapshot manifest: `skydexia/snapshots/*/manifest.json`
- Rollback state: `skydexia/snapshots/rollback-last.json`
- Rollback verification: `skydexia/snapshots/rollback-verify.json`
- Alert delivery log: `skydexia/alerts/delivery-log.json`
