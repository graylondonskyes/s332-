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

## Canonical hardening docs

- `docs/hardening/SKYEHANDS_SKEPTIC_PROOF_HARDENING_DIRECTIVE.md`
- `docs/hardening/SECTION_38_PRODUCTION_HARDENING_PLUS_DIRECTIVE.md`
- `docs/hardening/SECTION_39_RUNTIME_ISOLATION_AND_TENANT_PROOF_DIRECTIVE.md`
- `docs/hardening/SECTION_40_RUNTIME_RECOVERY_AND_DR_DIRECTIVE.md`
- `docs/hardening/SECTION_41_ROOTLESS_NAMESPACE_AND_DEPLOY_TRUST_DIRECTIVE.md`
- `docs/hardening/SECTION_42_KERNEL_CONTAINMENT_AND_ARTIFACT_IDENTITY_DIRECTIVE.md`
- `docs/hardening/SECTION_43_LIVE_SURFACE_IDENTITY_AND_LSM_POLICY_DIRECTIVE.md`
- `docs/hardening/SECTION_44_EXECUTION_ATTESTATION_AND_KILLPATH_DIRECTIVE.md`
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
