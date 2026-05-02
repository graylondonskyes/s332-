# SuperIDEv3 Merge Order

Purpose: record implementation order only.

Canonical status owner:
- `SuperIDEv3-integration.md`

This file should not carry overall completion claims or route/smoke ownership.

## Phase 1: Protect Source Lanes

1. Preserve Dynasty donor lane as read-only reference.
2. Preserve 3.3.0 donor lane as read-only reference.
3. Preserve standalone `SkyeDocxMax` as read-only reference.
4. Create `SuperIDEv3.8/`.
5. Create `SuperIDEv3.8/source-lanes/README.md`.
6. Record donor paths and mounts.

## Phase 2: Create Canonical Shell

1. Choose final runtime stack.
2. Create final app shell.
3. Create final server entry.
4. Create final package scripts.
5. Create final navigation registry.
6. Create final route registry.
7. Create final shared theme/brand layer.
8. Create final shared persistence adapter.
9. Create final shared API client.

## Phase 3: Restore Dynasty Product Surfaces

1. Mount Neural Space Pro.
2. Mount SkyeChat.
3. Keep standalone `SkyeDocxMax` intact.
4. Mount embedded `SkyeDocxMax`.
5. Convert final labels and routes from `SkyeDocxPro` to `SkyeDocxMax` only after parity proof.
6. Mount SkyeBlog.
7. Mount SkyDex4.6.
8. Mount SovereignVariables.

## Phase 4: Lift 3.3.0 Backend Lanes

1. Mount server auth.
2. Mount runtime journal.
3. Mount commerce/payment lane.
4. Mount publishing package emitter.
5. Mount publishing binary writer.
6. Mount submission job routes.
7. Mount portal automation boundary.
8. Mount evidence and release-gate routes.

## Phase 5: Connect UI To Backend

1. Connect operator gate to final auth.
2. Connect publishing UI to final publishing APIs.
3. Connect commerce UI to final payment APIs.
4. Connect catalog UI to final persistence.
5. Connect release history UI to final records.
6. Connect submissions UI to final submission APIs.
7. Connect evidence UI to final smoke/artifact APIs.
8. Connect Neural Space Pro and SkyeChat to the final session/persistence layer.
9. Connect standalone and embedded `SkyeDocxMax` to final typed contracts where shared behavior is required.

## Phase 6: Prove Parity Before Cleanup

1. Compare merged features to donor features.
2. Compare merged routes to `ROUTE_MAP.md`.
3. Compare merged smoke to `SMOKE_PLAN.md`.
4. Compare embedded and standalone `SkyeDocxMax` to donor behavior before retiring donor labels.
5. Remove duplicate runtime copies only after parity proof.
6. Keep original source lanes archived.

## Phase 7: Final Proof

1. Run full UI smoke.
2. Run full API smoke.
3. Run artifact freshness checks.
4. Run protected hash checks.
5. Run no-theater checks.
6. Generate release artifacts.
7. Generate final completion status from current smoke evidence.
