# Launch Readiness

Generated: 2026-04-06

## Current launch posture

- Canonical runtime path: locked to apps/skyequanta-shell.
- Runtime authority: remote executor default path with durable workspace isolation.
- Deployment readiness: not passing based on Stage 9 artifact.
- Regression status: not passing based on Stage 11 artifact.
- Operator handoff package, env template pack, redacted support dump, OPEN_ME_FIRST surface, and hashed artifact manifest are emitted by the canonical ship-candidate command.

## Recommended launch gate

Proceed from the canonical ship-candidate path only after the current proof window is still fresh, the operator-green lane is green, and the operator handoff archive is regenerated for the target environment.
