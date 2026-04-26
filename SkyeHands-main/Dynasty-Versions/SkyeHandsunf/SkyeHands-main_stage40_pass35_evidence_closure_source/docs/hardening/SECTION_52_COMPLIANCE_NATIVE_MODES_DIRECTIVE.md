# SECTION 52 — COMPLIANCE-NATIVE DEVELOPMENT MODES DIRECTIVE

☑ Add named modes such as finance mode, healthcare mode, government mode, education mode, air-gapped mode
☑ Bind each mode to tool access, logging depth, data retention, provider routing, approval workflow, and export policy
☑ Add policy packs and enforcement engine per mode
☑ Add UI for mode selection, effective policy view, and denial explanation
☑ Add mode-aware proof/export packaging

☑ Run the same task in two different compliance modes and prove different runtime/tooling behavior
☑ Prove provider routing restrictions change by mode
☑ Prove retention/export policy changes by mode
☑ Simulate a forbidden action in regulated mode and prove denial with explanation
☑ Simulate air-gapped denial for disallowed egress
☑ Tamper a compliance profile and prove verification fails

☑ `apps/skyequanta-shell/bin/workspace-proof-section52-compliance-native-modes.mjs`
☑ `scripts/smoke-section52-compliance-native-modes.sh`
☑ `docs/proof/SECTION_52_COMPLIANCE_NATIVE_MODES.json`

☑ A regulated mode measurably changes runtime behavior, allowed actions, and evidence posture compared with a less restricted mode
