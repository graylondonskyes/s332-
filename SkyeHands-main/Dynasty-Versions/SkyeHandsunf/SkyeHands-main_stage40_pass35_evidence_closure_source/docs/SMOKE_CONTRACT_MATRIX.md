# Smoke Contract Matrix

Generated: 2026-04-08

| Claim Surface | Command | Artifact | Status |
|---|---|---|---|
| Stage 8 preview forwarding | `npm run workspace:proof:stage8 -- --strict` | `docs/proof/STAGE_8_PREVIEW_FORWARDING.json` | CHECKMARK |
| Stage 9 deployment readiness | `npm run workspace:proof:stage9 -- --strict` | `docs/proof/STAGE_9_DEPLOYMENT_READINESS.json` | BLANK |
| Stage 10 multi-workspace stress | `npm run workspace:proof:stage10 -- --strict` | `docs/proof/STAGE_10_MULTI_WORKSPACE_STRESS.json` | BLANK |
| Stage 11 regression proof | `npm run workspace:proof:stage11 -- --strict` | `docs/proof/STAGE_11_REGRESSION_PROOF.json` | BLANK |
| Ship-candidate packaging | `npm run workspace:proof:section8 -- --strict` | `docs/proof/SECTION_8_DEPLOYMENT_PACKAGING.json` | BLANK |
| Section 42 portable hostile-environment rerun | `npm run workspace:proof:section42 -- --strict` | `docs/proof/SECTION_42_KERNEL_CONTAINMENT_AND_ARTIFACT_IDENTITY.json` | BLANK |
| Imported platform launchpad | `npm run workspace:proof:section61` | `docs/proof/SECTION_61_PLATFORM_LAUNCHPAD.json` | CHECKMARK |
| Imported platform power mesh | `npm run workspace:proof:section62` | `docs/proof/SECTION_62_PLATFORM_POWER_MESH.json` | CHECKMARK |
| Agent-core runtime bundle | `npm run workspace:proof:section63` | `docs/proof/SECTION_63_AGENT_CORE_BUNDLE.json` | CHECKMARK |

| Stage 9 bridge lifecycle fallback | `node --input-type=module runWorkspaceLifecycleSmoke(bridgeBaseUrl=127.0.0.1:1)` | `docs/proof/STAGE_9_BRIDGE_LIFECYCLE_FALLBACK.json` | CHECKMARK |
