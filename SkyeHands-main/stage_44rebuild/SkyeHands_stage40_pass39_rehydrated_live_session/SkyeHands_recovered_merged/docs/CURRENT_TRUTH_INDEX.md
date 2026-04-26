# Current Truth Index

This index defines the current production-facing truth surface for SkyeHands / SkyeQuantaCore.

Use these files for operator handoff, procurement review, security review, and deployment packaging.

## Canonical operator and deployment docs

- `docs/NONEXPERT_OPERATOR_QUICKSTART.md`
- `docs/DEPLOYMENT_MODES.md`
- `docs/GATE_RUNTIME_MODES.md`
- `docs/CANONICAL_RUNTIME_PATHS.md`
- `docs/CANONICAL_OPERATOR_SURFACE.md`
- `docs/FIRST_RUN_OPERATOR_CHECKLIST.md`
- `docs/LAUNCH_READINESS.md`
- `docs/PROCUREMENT_PACKET_INDEX.md`
- `docs/ARCHITECTURE_OVERVIEW.html`
- `docs/CLAIMS_REGISTER.md`
- `docs/VERSION_STAMP.json`
- `docs/templates/INVESTOR_AUDIT_WEBSITE_BASE_TEMPLATE.html`

## Canonical hardening docs

- `docs/hardening/SKYEHANDS_SKEPTIC_PROOF_HARDENING_DIRECTIVE.md`
- `docs/hardening/SECTION_38_PRODUCTION_HARDENING_PLUS_DIRECTIVE.md`
- `docs/hardening/SECTION_39_RUNTIME_ISOLATION_AND_TENANT_PROOF_DIRECTIVE.md`
- `docs/hardening/SECTION_40_RUNTIME_RECOVERY_AND_DR_DIRECTIVE.md`
- `docs/hardening/SECTION_41_ROOTLESS_NAMESPACE_AND_DEPLOY_TRUST_DIRECTIVE.md`
- `docs/hardening/SECTION_42_KERNEL_CONTAINMENT_AND_ARTIFACT_IDENTITY_DIRECTIVE.md`
- `docs/hardening/SECTION_43_LIVE_SURFACE_IDENTITY_AND_LSM_POLICY_DIRECTIVE.md`
- `docs/hardening/SECTION_44_EXECUTION_ATTESTATION_AND_KILLPATH_DIRECTIVE.md`
- `docs/hardening/SECTION_45_APPARMOR_AND_DELEGATED_CONTROLLER_DIRECTIVE.md`
- `docs/hardening/SKYEHANDS_CATEGORY_OF_ONE_EXPANSION_DIRECTIVE_SECTIONS_46_57.md`
- `docs/hardening/SECTION_46_SKYE_MEMORY_FABRIC_DIRECTIVE.md`
- `docs/hardening/SECTION_47_SKYE_REPLAY_DIRECTIVE.md`
- `docs/hardening/SECTION_48_KAIXU_COUNCIL_DIRECTIVE.md`
- `docs/hardening/SECTION_49_PROOFOPS_DIRECTIVE.md`
- `docs/hardening/SECTION_50_SKYE_SOVEREIGN_RUNTIME_DIRECTIVE.md`
- `docs/hardening/SECTION_51_COSTBRAIN_DIRECTIVE.md`
- `docs/hardening/SECTION_52_COMPLIANCE_NATIVE_MODES_DIRECTIVE.md`
- `docs/hardening/SECTION_55_SKYE_FOUNDRY_DIRECTIVE.md`
- `docs/hardening/SECTION_56_AUTONOMOUS_MAINTENANCE_MODE_DIRECTIVE.md`
- `docs/hardening/SECTION_57_DEAL_OWNERSHIP_AWARE_GENERATION_DIRECTIVE.md`
- `docs/hardening/SECTION_58_DEVGLOW_DIRECTIVE.md`
- `docs/hardening/SECTION_59_DEEP_SCAN_MODE_DIRECTIVE.md`
- `docs/hardening/SECTION_60_VALUATION_AUDIT_MODE_DIRECTIVE.md`
- `docs/hardening/SECTION_61_PLATFORM_LAUNCHPAD_AND_IMPORT_MESH_DIRECTIVE.md`
- `docs/hardening/CATEGORY_OF_ONE_CARRY_FORWARD_OPEN_BOARD.md`
- `docs/hardening/CATEGORY_OF_ONE_STAGE_README.md`
- `docs/SKYEHANDS_BRIDGE_RUNTIME_CLOSURE_DIRECTIVE.md`
- `docs/SKYEHANDS_SOVEREIGN_PROVIDER_BINDINGS_IMPLEMENTATION_DIRECTIVE.md`
- `docs/ARTIFACT_MANIFEST_SPEC.md`
- `docs/VENDOR_DETACHMENT.md`

## Release packaging rule

Current-truth production bundles must exclude:

- `.git/`
- `.skyequanta/`
- runtime logs
- generated reports
- `docs/proof/`
- `dist/`
- workspace runtime state under `workspace/`
- historical stage `.docx` files and older implementation archive material

## Historical material

Historical stage docs, proof residue, and internal build artifacts remain valuable for internal engineering continuity, but they are not part of the current-truth production handoff lane.

- `docs/proof/SECTION_39_RUNTIME_ISOLATION_AND_TENANT_PROOF.json` — proof-backed packet for OS-user isolation, runtime egress blocking, tenant-isolation API, and session revoke-all.
- `docs/hardening/SECTION_39_RUNTIME_ISOLATION_AND_TENANT_PROOF_DIRECTIVE.md` — current truth directive for the Section 39 hardening lane.

- Section 40 is current truth for runtime recovery, orphan reaping, encrypted backup verification, corruption detection, and disaster-recovery timing proof.

- `docs/proof/SECTION_41_ROOTLESS_NAMESPACE_AND_DEPLOY_TRUST.json` — proof-backed packet for rootless namespaces, live resource ceilings, deploy attestation, and rollback timing.

- `docs/hardening/SECTION_41_ROOTLESS_NAMESPACE_AND_DEPLOY_TRUST_DIRECTIVE.md` — current truth directive for the Section 41 hardening lane.

- `docs/proof/SECTION_42_KERNEL_CONTAINMENT_AND_ARTIFACT_IDENTITY.json` — proof-backed packet for rootfs pivot, kernel cgroup placement, basic seccomp filtering, and artifact-bound attestation.

- `docs/hardening/SECTION_42_KERNEL_CONTAINMENT_AND_ARTIFACT_IDENTITY_DIRECTIVE.md` — current truth directive for the Section 42 hardening lane.

- `docs/proof/SECTION_43_LIVE_SURFACE_IDENTITY_AND_LSM_POLICY.json` — proof-backed packet for live surface identity binding and AppArmor profile bundle / fail-closed runtime policy.

- `docs/hardening/SECTION_43_LIVE_SURFACE_IDENTITY_AND_LSM_POLICY_DIRECTIVE.md` — current truth directive for the Section 43 hardening lane.

- `docs/proof/SECTION_44_EXECUTION_ATTESTATION_AND_KILLPATH.json` — proof-backed packet for signed runtime execution receipts, remote surface verification against artifact attestation, and universal CPU kill-path enforcement.

- `docs/hardening/SECTION_44_EXECUTION_ATTESTATION_AND_KILLPATH_DIRECTIVE.md` — current truth directive for the Section 44 hardening lane.

- `docs/proof/SECTION_45_APPARMOR_AND_DELEGATED_CONTROLLER.json` — proof-backed packet for real AppArmor profile-load gating, self-verifying AppArmor host proof pack generation, manifest-bound host proof attestation intake with tamper denial, v1/v2 delegated-controller planning, and live delegated controller attachment / kill / cleanup proof on the current host kernel.

- `docs/hardening/SECTION_45_APPARMOR_AND_DELEGATED_CONTROLLER_DIRECTIVE.md` — current truth directive for the Section 45 hardening lane.


- `docs/proof/SECTION_49_PROOFOPS.json` — proof-backed packet for ProofOps evidence-pack generation, signed change-set attestation, procurement-safe redaction, trust surface output, and negative-case validation.

- `docs/hardening/SECTION_47_SKYE_REPLAY_DIRECTIVE.md`
- `docs/hardening/SECTION_48_KAIXU_COUNCIL_DIRECTIVE.md`
- `docs/hardening/SECTION_49_PROOFOPS_DIRECTIVE.md` — current truth directive for the Section 49 category-of-one proof lane.


- `docs/proof/SECTION_47_SKYE_REPLAY.json` — proof-backed packet for replay event capture, checkpoint snapshots/diffs, time-travel reconstruction, checkpoint rerun, fork divergence, and tamper-evident replay verification.

- `docs/hardening/SECTION_47_SKYE_REPLAY_DIRECTIVE.md` — current truth directive for the Section 47 category-of-one replay lane.


- `docs/proof/SECTION_46_SKYE_MEMORY_FABRIC.json` — proof-backed packet for durable engineering memory graph persistence, retrieval queries, context injection, contradiction precedence, dedupe, and tamper-evident graph verification.

- `docs/hardening/SECTION_46_SKYE_MEMORY_FABRIC_DIRECTIVE.md` — current truth directive for the Section 46 category-of-one memory lane.




- `docs/proof/SECTION_50_SKYE_SOVEREIGN_RUNTIME.json` — proof-backed packet for policy-aware sovereign provider graph routing, failover, explanation surfaces, cost-cap denial, and trust-policy denial.

- `docs/hardening/SECTION_50_SKYE_SOVEREIGN_RUNTIME_DIRECTIVE.md` — current truth directive for the Section 50 sovereign runtime lane.

- `docs/proof/SECTION_51_COSTBRAIN.json` — proof-backed packet for live economic intelligence, provider/runtime cost modeling, budget-aware planning, over-budget denial, human override, and price-spike rerouting.

- `docs/hardening/SECTION_51_COSTBRAIN_DIRECTIVE.md` — current truth directive for the Section 51 category-of-one cost lane.

## Latest directive expansion

- Category-of-one directive now carries Sections 46–60, and Sections 46–60 are now fully smoke-backed current-truth lanes.
- Sections 55–58 now interlink with Sections 59 and 60 so Deep Scan and Valuation can carry foundry posture, maintenance evidence, commercial boundary posture, and DevGlow path intelligence into proof surfaces.
- Section 45 now also carries a manifest-bound AppArmor host proof attestation intake lane so remote host execution evidence can be imported, signed, and denied on tamper before procurement or valuation carry-forward.
- Deep Scan and Valuation lanes now also carry the integrated Skye Reader dossier path using `apps/skye-reader-hardened/server.js` and `apps/skyequanta-shell/lib/skye-reader-bridge.mjs`.
- `docs/templates/INVESTOR_AUDIT_WEBSITE_BASE_TEMPLATE.html` is now the base template surface for generated valuation audit websites.
- Proof JSON requirements now explicitly track model version, runtime version, and directive version.


- `docs/proof/SECTION_48_KAIXU_COUNCIL.json` — proof-backed packet for council orchestration graph, disagreement handling, security veto, budget exhaustion, recovery, tie-break, and human override.

- `docs/hardening/SECTION_48_KAIXU_COUNCIL_DIRECTIVE.md` — current truth directive for the Section 48 kAIxU Council lane.

- `docs/proof/SECTION_52_COMPLIANCE_NATIVE_MODES.json` — proof-backed packet for finance, healthcare, government, education, and air-gapped development modes with policy-bound routing, retention/export posture, and denial surfaces.

- `docs/hardening/SECTION_52_COMPLIANCE_NATIVE_MODES_DIRECTIVE.md` — current truth directive for the Section 52 compliance-native modes lane.


- `docs/proof/SECTION_59_DEEP_SCAN_MODE.json` — proof-backed packet for zip/project ingestion, environment reconstruction, deployed-style launch, live route probes, end-to-end action checks, replay linkage, and valuation-ready posture.

- `docs/hardening/SECTION_59_DEEP_SCAN_MODE_DIRECTIVE.md` — current truth directive for the Section 59 deep scan lane.

- `docs/proof/SECTION_60_VALUATION_AUDIT_MODE.json` — proof-backed packet for deterministic valuation generation, investor-ready audit website creation from the base template, replay linkage, and ProofOps-backed evidence-pack validation and attestation.

- `docs/hardening/SECTION_60_VALUATION_AUDIT_MODE_DIRECTIVE.md` — current truth directive for the Section 60 valuation audit lane.


- `docs/proof/SECTION_53_AUTONOMY_GRADIENT.json` — proof-backed packet for scope-bound autonomy controls, review gates, forbidden escalation denial, and continuous maintenance posture.

- `docs/hardening/SECTION_53_AUTONOMY_GRADIENT_DIRECTIVE.md` — current truth directive for the Section 53 autonomy gradient lane.

- `docs/proof/SECTION_54_ENVIRONMENT_MIRROR.json` — proof-backed packet for external project ingestion, environment reconstruction, gap honesty, template export, and launchable mirror posture.

- `docs/hardening/SECTION_54_ENVIRONMENT_MIRROR_DIRECTIVE.md` — current truth directive for the Section 54 environment mirror lane.

- `docs/proof/SECTION_55_SKYE_FOUNDRY.json` — proof-backed packet for white-label foundry tenant provisioning, tenant-scoped provider/policy posture, export packaging, and cross-tenant bleed denial.

- `docs/hardening/SECTION_55_SKYE_FOUNDRY_DIRECTIVE.md` — current truth directive for the Section 55 SkyeFoundry lane.

- `docs/proof/SECTION_56_AUTONOMOUS_MAINTENANCE_MODE.json` — proof-backed packet for persistent maintenance scheduling, unattended policy gating, evidence-ledger output, retry/rollback, and recurring-issue reopening.

- `docs/hardening/SECTION_56_AUTONOMOUS_MAINTENANCE_MODE_DIRECTIVE.md` — current truth directive for the Section 56 autonomous maintenance lane.

- `docs/proof/SECTION_57_DEAL_OWNERSHIP_AWARE_GENERATION.json` — proof-backed packet for commercial-profile-aware generation, founder-only/export restrictions, white-label-safe packaging, and tamper detection.

- `docs/hardening/SECTION_57_DEAL_OWNERSHIP_AWARE_GENERATION_DIRECTIVE.md` — current truth directive for the Section 57 commercial boundary lane.

- `docs/proof/SECTION_58_DEVGLOW.json` — proof-backed packet for exact live path resolution, keyboard/terminal command registry, clipboard/bug-log capture, redaction, and tamper-evident DevGlow event logging.

- `docs/hardening/SECTION_58_DEVGLOW_DIRECTIVE.md` — current truth directive for the Section 58 DevGlow lane.

- `apps/skye-reader-hardened/server.js` now exposes searchable library and summary endpoints, and `apps/skye-reader-hardened/scripts/smoke.mjs` proves those endpoints against the live reader runtime.

- `docs/proof/SECTION_61_PLATFORM_LAUNCHPAD.json` — proof-backed packet for canonical imported-platform intake, manifest + registry generation, honest launch-profile denial, real static launch execution, and AE CommandHub integration.
## 2026-04-08 Evidence Closure Additions

- Root operator entrypoints now physically exist at the shipped root: `README.md`, `START_HERE.sh`, `skyequanta`, `skyequanta.mjs`, root `package.json`, and root `Makefile`.
- Section 62 is rebuilt into the surviving artifact chain and writes `platform/user-platforms/skye-account-executive-commandhub-s0l26-0s/skyehands.power.json`, `platform/user-platforms/POWER_MESH_REGISTRY.json`, and `.skyequanta/platform-launchpad/power-mesh-registry.json`.
- Section 63 ships a concrete agent-core runtime bundle at `platform/agent-core/runtime/` and writes `docs/proof/SECTION_63_AGENT_CORE_BUNDLE.json`.
