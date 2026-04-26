# Investor Smoke Report

As-of: 2026-04-07

- Section 39 runtime isolation smoke is passing after Python runtime egress enforcement closure.
- Section 40 runtime recovery and disaster recovery smoke is passing.
- Section 48 kAIxU Council smoke is passing with disagreement, security-veto, budget-exhaustion, recovery, tie-break, and human-override proof.
- Section 52 compliance-native modes smoke is passing with mode-bound routing, forbidden-action denial, air-gap denial, tamper detection, and mode-aware export proof.
- Commands: `npm run workspace:proof:section39`, `npm run workspace:proof:section40`, `npm run workspace:proof:section48`, `npm run workspace:proof:section52`, `npm run backup:verify`, `npm run runtime:reconcile`, `npm run runtime:reap-orphans`.

- Section 59 deep scan mode smoke is passing with zip ingestion, deployed-style launch, live route probes, end-to-end action checks, replay verification, and valuation-ready gating.
- Section 60 valuation audit mode smoke is passing with deterministic valuation generation, template-based investor audit website output, replay linkage, and ProofOps-backed evidence attestation.
- Commands: `npm run workspace:proof:section59`, `npm run workspace:proof:section60`, `bash scripts/smoke-section59-deep-scan-mode.sh`, `bash scripts/smoke-section60-valuation-audit-mode.sh`.


## Skye Reader dossier lane

- Section 59 smoke now proves integrated document-dossier extraction through `apps/skye-reader-hardened/` and `apps/skyequanta-shell/lib/skye-reader-bridge.mjs`.
- Section 60 smoke now proves that dossier survives into the investor audit website and valuation evidence pack.

- Section 53 autonomy gradient smoke is passing with scope-bound bindings, review gates, forbidden escalation denial, and continuous maintenance proof.
- Section 54 environment mirror smoke is passing with descriptor/doc/config ingestion, gap honesty, reusable template export, and launchable mirror proof.
- Commands: `npm run workspace:proof:section53`, `npm run workspace:proof:section54`, `bash scripts/smoke-section53-autonomy-gradient.sh`, `bash scripts/smoke-section54-environment-mirror.sh`.

## Skye Reader hardened runtime

- `apps/skye-reader-hardened/server.js` now exposes searchable library and summary endpoints.
- `apps/skye-reader-hardened/scripts/smoke.mjs` now proves health, config, library create/delete, summary, and search against the live reader runtime.

- Section 55 SkyeFoundry smoke is passing with branded tenant-cloud provisioning, tenant-scoped provider/policy posture, export packaging, and bleed-denial proof.
- Section 56 autonomous maintenance mode smoke is passing with persistent scheduling, unattended-policy gating, evidence-ledger output, retry/rollback, and recurring-issue reopening.
- Section 57 deal / ownership-aware generation smoke is passing with commercial-profile-aware export gating, founder-only restrictions, white-label-safe packaging, and tamper detection.
- Section 58 DevGlow smoke is passing with exact live path resolution, command registries, clipboard/bug-log capture, restricted-surface redaction, ambiguous-surface denial, and tamper-evident event verification.
- Commands: `npm run workspace:proof:section55`, `npm run workspace:proof:section56`, `npm run workspace:proof:section57`, `npm run workspace:proof:section58`, `bash scripts/smoke-section55-skye-foundry.sh`, `bash scripts/smoke-section56-autonomous-maintenance-mode.sh`, `bash scripts/smoke-section57-deal-ownership-aware-generation.sh`, `bash scripts/smoke-section58-devglow.sh`.

- Section 45 smoke is passing with AppArmor capability-gate proof, a self-verifying AppArmor host proof pack at `dist/section45/apparmor-live-proof-pack/`, manifest-bound host-proof intake and attestation at `dist/section45/apparmor-live-proof-ingest/`, plus real delegated-controller attachment, membership verification, group kill, and cleanup proof.
- Commands: `npm run workspace:proof:section45`, `npm run apparmor:live-pack`, `npm run apparmor:live-pack:verify`, `npm run apparmor:live-pack:fixture`, `npm run apparmor:live-pack:attest`, `bash scripts/smoke-section45-apparmor-delegated.sh`.

- Section 61 platform launchpad smoke is passing with canonical intake placement, generated platform manifests/registries, honest runtime-profile denial, real static launch execution, and AE CommandHub import + live launcher proof.
- Commands: `npm run workspace:proof:section61`, `bash scripts/smoke-section61-platform-launchpad.sh`, `node apps/skyequanta-shell/bin/platform-launch-plan.mjs --slug skye-account-executive-commandhub-s0l26-0s`.
