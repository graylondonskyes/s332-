# Launch Readiness

Generated: 2026-04-08

## Current launch posture

- Canonical runtime path: locked to `apps/skyequanta-shell`.
- Root shipped operator entrypoints are now physically present: `./START_HERE.sh`, `./skyequanta`, root `package.json`, and root `Makefile`.
- Platform launchpad proof is present through Section 61.
- Platform power mesh proof is present through Section 62.
- Agent-core runtime bundle proof is present through Section 63.
- Deployment readiness is still conservative until Stage 9 is rerun green in the current artifact chain.
- Regression status is still conservative until Stage 11 is rerun green in the current artifact chain.

## Honest gate

- Bridge lifecycle smoke now has a manager-backed fallback lane proved in `docs/proof/STAGE_9_BRIDGE_LIFECYCLE_FALLBACK.json`, reducing stage9 brittleness while the full current-chain rerun remains open.
The surviving package is stronger and more converged than pass34, but diligence should still treat these rerun surfaces as open until refreshed: Stage 9 deployment readiness, Stage 10 multi-workspace stress, Stage 11 regression proof, Ship-candidate packaging, Section 42 portable hostile-environment rerun.
