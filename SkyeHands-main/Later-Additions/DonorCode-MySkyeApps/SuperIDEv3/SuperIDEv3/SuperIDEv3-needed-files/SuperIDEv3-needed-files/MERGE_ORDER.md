# SuperIDEv3 Merge Order

Purpose: stop random merging. Build SuperIDEv3 in this order only.

## Phase 1: Protect Source Lanes

✅ Dynasty lane is preserved as a source lane.
✅ 3.3.0 lane is preserved as a source lane.
☐ Create `SuperIDEv3.8/`.
☐ Create `SuperIDEv3.8/source-lanes/README.md` documenting donor paths.
☐ Document SkyeDocxPro donor paths, including Dynasty `SkyeDocxPro/`, `public/SkyeDocxPro/`, `dist/SkyeDocxPro/`, and `SuperIDEv3/SkyeDocxPro-v13`.
☐ Create `SuperIDEv3.8/docs/LOSS_MAP.md` copied from root.
☐ Create `SuperIDEv3.8/docs/ROUTE_MAP.md` copied from root.
☐ Create `SuperIDEv3.8/docs/SMOKE_PLAN.md` copied from root.

## Phase 2: Create Canonical Shell

☐ Choose final runtime stack.
☐ Create final app shell.
☐ Create final server entry.
☐ Create final package scripts.
☐ Create final navigation registry.
☐ Create final route registry.
☐ Create final shared theme/brand layer.
☐ Create final shared persistence adapter.
☐ Create final shared API client.

## Phase 3: Restore Dynasty Product Surfaces

☐ Mount Neural Space Pro.
☐ Smoke Neural Space Pro route.
☐ Mount SkyeChat.
☐ Smoke SkyeChat route.
☐ Build standalone SkyeDocxMax from the SkyeDocxPro donor sources.
☐ Smoke standalone SkyeDocxMax editor route.
☐ Mount embedded SkyeDocxMax inside SuperIDEv3.
☐ Smoke embedded SkyeDocxMax editor route.
☐ Convert SkyeDocxPro final navigation, manifests, sync scripts, and route labels to SkyeDocxMax after parity proof.
☐ Mount SkyeBlog.
☐ Smoke SkyeBlog route.
☐ Mount SkyDex4.6.
☐ Smoke SkyDex route.
☐ Mount SovereignVariables.
☐ Smoke SovereignVariables route.

## Phase 4: Lift 3.3.0 Backend Lanes

☐ Mount server auth.
☐ Smoke server auth.
☐ Mount runtime journal.
☐ Smoke runtime journal.
☐ Mount commerce/payment lane.
☐ Smoke checkout session boundary.
☐ Smoke webhook boundary.
☐ Mount publishing package emitter.
☐ Smoke publishing package output.
☐ Mount publishing binary writer.
☐ Smoke binary output.
☐ Mount submission job routes.
☐ Smoke submission job lifecycle.
☐ Mount portal automation boundary.
☐ Smoke portal boundary failure and configured path.

## Phase 5: Connect UI To Backend

☐ Operator Gate uses final auth.
☐ Publishing UI calls final publishing API.
☐ Commerce UI calls final commerce/payment API.
☐ Catalog UI calls final catalog persistence.
☐ Release History UI reads final release records.
☐ Submissions UI calls final submission API.
☐ Evidence UI reads final smoke/artifacts.
☐ Neural Space Pro uses final persistence/session layer.
☐ SkyeChat uses final message/session layer.
☐ Standalone SkyeDocxMax uses final document persistence/export layer.
☐ Embedded SkyeDocxMax uses final document persistence/export layer.
☐ SkyeDocxMax communicates with SuperIDEv3 auth, storage, publishing, catalog, chat, blog, and evidence lanes through typed contracts.

## Phase 6: Remove Duplication Only After Parity

☐ Compare final route map to source-lane routes.
☐ Compare final features to loss map.
☐ Compare final UI controls to smoke plan.
☐ Compare SkyeDocxMax standalone and embedded behavior to every SkyeDocxPro donor behavior before retiring donor labels.
☐ Remove duplicate runtime copies only after parity proof.
☐ Keep original source lanes archived.

## Phase 7: Final Proof

☐ Run full UI smoke.
☐ Run full API smoke.
☐ Run artifact freshness check.
☐ Run protected hash check.
☐ Run no-theater check.
☐ Generate release artifacts.
☐ Generate final completion status.
☐ Create final SuperIDEv3 release ZIP only after all required smoke passes.
