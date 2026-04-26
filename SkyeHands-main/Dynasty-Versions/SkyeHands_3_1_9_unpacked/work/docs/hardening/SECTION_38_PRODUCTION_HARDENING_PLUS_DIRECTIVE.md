# SECTION 38 · PRODUCTION HARDENING PLUS DIRECTIVE

Generated: 2026-04-06
Scope: skeptic-proof production hardening follow-on pass after Section 37

## Current implementation board

- ✅ Release provenance lane now exists with manifest, SBOM-style dependency inventory, and signed attestation support.
- ✅ Provider probe outbound network policy now blocks localhost, metadata-service targets, private-network targets, and hostnames outside the allowed policy.
- ✅ Encrypted backup export and restore lane now exists for critical `.skyequanta` state artifacts.
- ✅ Chaos recovery proof lane now exists for hard-killed workspace runtime recovery.
- ☐ Full per-workspace OS-user isolation / rootless container lane
- ☐ cgroup quota enforcement / seccomp / AppArmor lane
- ☐ Explicit tenant-isolation API proof packet across every mutating bridge surface
- ☐ Signed deployment attestation bound to live deploy metadata
- ☐ Egress policy enforcement inside hostile user code execution runtime itself
- ☐ Full disaster-recovery timing packet with rollback SLA proof

## What this pass added

### 1. Release provenance
- `apps/skyequanta-shell/bin/release-provenance.mjs`
- `apps/skyequanta-shell/lib/release-provenance.mjs`

This lane generates:
- source manifest with per-file SHA-256
- SBOM-style dependency inventory for npm and Python manifests
- signed attestation support with Ed25519
- verification output proving the attestation matches the generated bundle

### 2. Outbound network policy for provider probes
- `apps/skyequanta-shell/lib/network-policy.mjs`
- hardened provider probe fetch path in `apps/skyequanta-shell/lib/provider-connectors.mjs`

This lane blocks:
- localhost
- metadata-service targets
- private-network IPv4/IPv6 targets
- provider targets outside the configured allow-host policy

### 3. Encrypted backup / restore
- `apps/skyequanta-shell/bin/backup-export.mjs`
- `apps/skyequanta-shell/bin/backup-restore.mjs`
- `apps/skyequanta-shell/lib/backup-bundle.mjs`

This lane provides:
- encrypted backup bundle export for critical `.skyequanta` runtime state
- restore into a clean destination root
- path-safety enforcement during restore

### 4. Chaos recovery proof
- `apps/skyequanta-shell/bin/workspace-proof-section38-hardening-plus.mjs`
- `scripts/smoke-section38-hardening-plus.sh`

This proof exercises:
- outbound policy block
- provenance bundle generation and attestation verification
- encrypted backup export/restore
- hard-kill workspace recovery via executor recover restart

## Smoke commands
- `npm run release:provenance`
- `npm run backup:export -- --passphrase <strong-secret>`
- `npm run backup:restore -- --input <bundle> --passphrase <strong-secret>`
- `npm run workspace:proof:section38`
- `bash scripts/smoke-section38-hardening-plus.sh`

## Truth condition
The Section 38 items above are only marked complete because code paths now exist and the dedicated smoke/proof lane exercises them. Remaining blanks stay blank until the runtime itself is hardened further and the proof packet exists.
