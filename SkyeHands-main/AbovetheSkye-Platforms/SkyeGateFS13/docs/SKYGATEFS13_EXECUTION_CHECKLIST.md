# SkyeGateFS13 Execution Checklist

This checklist turns the current audit into concrete execution lanes.

## 1. Runtime Rename Landing
- [ ] Convert the current filesystem rename into a clean git-landed rename
- [ ] Decide whether `stage_44rebuild` remains a compatibility shim or only a historical alias
- [ ] Remove ambiguity between the tracked old path and the new runtime-control path

## 2. Gate Project Landing
- [ ] Land `SkyeGateFS13` as the canonical gate project in version control
- [ ] Land the migration docs and runtime/gate scripts alongside it
- [ ] Separate gate work from unrelated repo churn

## 3. Runtime-to-Gate Proof
- [ ] Validate runtime env resolution for `SKYGATEFS13_*`
- [ ] Validate remote-gated config behavior
- [ ] Validate optional remote health/discovery checks
- [ ] Validate event-mirror contract for `/platform/events`

## 4. SuperIDE Central-Auth Tightening
- [ ] Keep local bridge provisioning but prefer central gate identity
- [ ] Disable legacy local-session fallback by default when gate auth is configured
- [ ] Preserve explicit override only for recovery/back-compat

## 5. Consumer Migration
- [ ] Continue migrating active platforms into gate-parent auth
- [ ] Continue migrating active platforms into gate-parent audit/metering
- [ ] Generate dossiers for each migrated app

## 6. Parent Ledger Expansion
- [ ] Extend parent event categories beyond generic audit
- [ ] Track billable provider actions, pushes, and privileged platform actions
- [ ] Normalize source-app metadata and actor metadata

## 7. Pricing and Billing Expansion
- [ ] Keep AI pricing sourced from `pricing/pricing.json`
- [ ] Expose priced/unpriced model visibility to operators
- [ ] Improve customer visibility for push, voice, and future lane billing

## 8. Admin Dashboard Hardening
- [ ] Add pricing catalog / rate-card operator surface
- [ ] Add usage concentration summaries
- [ ] Add gate-owned vs BYO credential posture visibility

## 9. User Dashboard Hardening
- [ ] Show customer-facing rate card
- [ ] Show invoice rollups in readable metrics, not only raw JSON
- [ ] Keep top-up and cap posture visible

## 10. Env Contract Validation
- [ ] Validate `env.ultimate.template` against the repo env catalog
- [ ] Report missing or uncatalogued vars
- [ ] Keep env names aligned with real code paths

## 11. Deployment Validation
- [ ] Run live auth validation with real gate vars
- [ ] Run live dashboard validation
- [ ] Run live runtime-to-gate validation
- [ ] Run live platform-event validation

## 12. Final Boundary Documentation
- [ ] Document gate-owned central responsibilities
- [ ] Document app-local allowed responsibilities
- [ ] Document bridge-only compatibility lanes
