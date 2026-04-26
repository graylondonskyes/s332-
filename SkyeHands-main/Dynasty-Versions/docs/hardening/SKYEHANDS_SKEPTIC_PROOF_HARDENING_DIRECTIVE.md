# SKYEHANDS SKEPTIC-PROOF HARDENING DIRECTIVE

## Hardening ledger

- ✅ H1. Production release sanitization lane implemented
- ✅ H2. Control-plane API request hardening implemented
- ☐ H3. Full hostile-machine runtime isolation via dedicated users or rootless containers
- ✅ H4. Tamper-evident audit chain implemented
- ✅ H5. Provider-vault unlock policy hardening implemented
- ✅ H6. Hostile path / symlink / large-file boundary hardening implemented
- ✅ H7. Full release provenance lane with SBOM + signed artifact attestations
- ✅ H8. Chaos recovery / bridge kill / executor kill / replay proof lane
- ✅ H9. Tenant isolation matrix proof lane
- ✅ H10. Egress allowlists / SSRF / local-network blocking lane
- ✅ H11. Backup / restore / disaster recovery proof lane
- ✅ H12. Current-truth document quarantine lane started

## Implemented in this pass

### H1. Production release sanitization

- ✅ Added `apps/skyequanta-shell/bin/release-sanitize.mjs`
- ✅ Emits a current-truth production bundle under `dist/production-release/`
- ✅ Strips `.git`, `.skyequanta`, `logs`, `reports`, `docs/proof`, `dist`, and workspace runtime state from the sanitized release lane
- ✅ Emits `SANITIZED_RELEASE_MANIFEST.json`

### H2. Control-plane API request hardening

- ✅ Added JSON body size ceiling
- ✅ Added body-read timeout enforcement
- ✅ Added per-IP / per-route rate limiting
- ✅ Added repeated-auth-failure lockout lane
- ✅ Added origin allowlist enforcement for mutating control-plane requests
- ✅ Added structured bridge request audit events

### H4. Tamper-evident audit chain

- ✅ Added append-only audit chain file
- ✅ Added rolling head/hash state
- ✅ Added verification lane for chain continuity and event-hash integrity

### H5. Provider-vault unlock policy hardening

- ✅ Added unlock-secret entropy policy enforcement
- ✅ Added failed-unlock tracking and timed lockout
- ✅ Added unlock-secret rotation lane
- ✅ Added unlock-policy visibility on safe profile surfaces

### H6. Hostile path / large-file boundary hardening

- ✅ Added symlink breakout blocking in workspace file ergonomics
- ✅ Added canonical root / realpath boundary checks
- ✅ Added max readable file size enforcement
- ✅ Added max searchable file size enforcement
- ✅ Added skipped-large-file reporting in search responses

### H12. Current-truth quarantine lane

- ✅ Added `docs/CURRENT_TRUTH_INDEX.md`
- ✅ Defined production-facing document set for sanitized release generation
- ✅ Excluded historical stage/docx material from the current-truth packaging lane

## Next hardening order

- ☐ H3 runtime isolation completion via rootless container filesystem pivot
- ☐ cgroup CPU / memory / pid enforcement
- ☐ seccomp / AppArmor enforcement on spawned workloads
- ☐ signed live deployment attestation bound to deployed artifact identity
