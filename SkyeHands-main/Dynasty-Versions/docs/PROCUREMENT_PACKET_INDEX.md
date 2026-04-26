# Procurement Packet Index

Generated: 2026-04-06

## Core packet

- [Deep Scan Report](../DEEP_SCAN_REPORT.md)
- [Client handoff for procurement](../client-handoff-for-procurement.html)
- [Board investor one-pager](./BOARD_INVESTOR_ONE_PAGER.html)
- [Current-build investor valuation memo](./INVESTOR_VALUATION_2026-04-07_SECTION49.md)
- [Category-of-one investor brief](./CATEGORY_OF_ONE_INVESTOR_BRIEF.html)
- [Launch readiness](./LAUNCH_READINESS.md)
- [Smoke contract matrix](./SMOKE_CONTRACT_MATRIX.md)
- [Architecture overview](./ARCHITECTURE_OVERVIEW.html)
- [Proof center](./PROOF_CENTER.html)
- [Public pricing/spec page](../public/pricing-spec.html)
- [Investor smoke report](./INVESTOR_SMOKE_REPORT_2026-04-06.md)

## Binding evidence

- [Release provenance manifest](../dist/release-provenance/section38/RELEASE_PROVENANCE_MANIFEST.json)
- [Release SBOM](../dist/release-provenance/section38/RELEASE_SBOM.json)
- [Release provenance attestation](../dist/release-provenance/section38/RELEASE_PROVENANCE_ATTESTATION.json)
- [Deployment attestation bundle](../dist/section41/deployment-attestation/DEPLOYMENT_ATTESTATION.json)
- [Deployment attestation verification](../dist/section41/deployment-attestation/DEPLOYMENT_ATTESTATION_VERIFY.json)
- [Artifact attestation bundle](../dist/section42/artifact-attestation/ARTIFACT_ATTESTATION.json)
- [Artifact attestation verification](../dist/section42/artifact-attestation/ARTIFACT_ATTESTATION_VERIFY.json)
- [Section 43 proof packet](./proof/SECTION_43_LIVE_SURFACE_IDENTITY_AND_LSM_POLICY.json)
- [Section 44 proof packet](./proof/SECTION_44_EXECUTION_ATTESTATION_AND_KILLPATH.json)
- [Section 47 proof packet](./proof/SECTION_47_SKYE_REPLAY.json)
- [Section 49 proof packet](./proof/SECTION_49_PROOFOPS.json)

- [Master proof ledger](./proof/MASTER_PROOF_LEDGER.json)
- [Proof artifact hashes](./proof/PROOF_ARTIFACT_HASHES.json)
- [Deployment readiness report](./proof/DEPLOYMENT_READINESS_REPORT.json)

- Section 39 runtime hardening packet: OS-user isolation, runtime egress controls, tenant isolation matrix, and scoped session revoke-all proof.

- Section 39 proof: runtime isolation, runtime egress enforcement, tenant isolation matrix, and revoke-all containment.
- Section 40 proof: startup locks, runtime reconciliation, orphan reaping, encrypted backup verification, corruption detection, and recovery timing.
- Section 41 proof: rootless namespace launch, live resource ceilings, signed deployment attestation, and rollback timing.

- Section 42 proof: rootfs pivot execution root, kernel cgroup controller placement, basic seccomp filtering, and artifact-bound attestation.

- Section 43 proof: live HTTP surface identity bound to the shipped release artifact and AppArmor profile-bundle / fail-closed runtime policy proof.

- Section 44 proof: signed runtime execution receipts, remote surface verification against the artifact attestation bundle, and universal CPU kill-path enforcement.

- Section 45 proof: real AppArmor profile-load gating and v1/v2 delegated-controller planning with concrete quota/attachment commands.

- Section 47 proof: replay event capture, checkpoint snapshots plus diffs, time-travel reconstruction, replay export bundle, checkpoint rerun, fork divergence, and tamper-evident replay verification.

- Section 49 proof: evidence-pack generation, signed change-set attestation, procurement-safe redaction, trust-surface output, and hostile validation failures.
