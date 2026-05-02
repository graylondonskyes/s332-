# Directive Changelog

Generated: 2026-04-16T05:35:46.986Z

## Checked Items (Smoke-backed)
- P001 | Easy | Every checked item must include `SMOKE:` evidence pointing to an end-to-end proof artifact (not UI-only existence).
- P002 | Easy | Smoke must verify: real flow, existing controls/buttons, data path, and claimed output behavior. `SMOKE: rule declaration in this directive`
- P003 | Easy | If smoke cannot prove a claim end-to-end, the item stays unchecked. `SMOKE: rule declaration in this directive`
- P004 | Easy | Completion percentage must be based only on checked directive items. `SMOKE: enforced by scripts/validate-ultimate-directive.mjs`
- P005 | Easy | Establish single master directive at repository root. `SMOKE: manual repo check (this file exists at root)`
- P006 | Easy | Define smoke-proof-only completion rules in this directive. `SMOKE: rules block in this file`
- P007 | Easy | Create signed release gate requiring directive validation before ship candidates. `SMOKE: scripts/release-gate.mjs`
- P008 | Easy | Add automated CI job to block checked items lacking smoke evidence. `SMOKE: .github/workflows/directive-guard.yml`
- P009 | Easy | Add changelog bridge from smoke outputs to directive updates. `SMOKE: DIRECTIVE_CHANGELOG.md + scripts/generate-directive-changelog.mjs`
- P015 | Easy | Restore AE smoke pipeline so it executes to PASS state. `SMOKE: platform/user-platforms/skye-account-executive-commandhub-s0l26-0s/source/AE-Central-Command-Pack-CredentialHub-Launcher/Branching Apps/AE-Brain-Command-Site-v8-Additive/docs/SMOKE_PROOF.md`
- P016 | Easy | Reinstate required AE runtime surfaces (`netlify/functions`, shared helpers, storage schema). `SMOKE: same SMOKE_PROOF.md`
- P024 | Easy | Complete deep code-based inventory scan for AE/CommandHub/Skye route/CRM and publish findings. `SMOKE: AE_COMMANDHUB_REALITY_SCAN_2026-04-16.md`
- P025 | Easy | Classify what is real vs stubbed vs missing using code evidence only. `SMOKE: AE_COMMANDHUB_REALITY_SCAN_2026-04-16.md`
