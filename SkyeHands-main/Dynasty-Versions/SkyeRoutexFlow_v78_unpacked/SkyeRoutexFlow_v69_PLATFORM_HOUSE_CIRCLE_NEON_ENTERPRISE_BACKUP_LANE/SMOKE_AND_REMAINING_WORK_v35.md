# V35 smoke status and remaining work

## Browser smoke attempt
I attempted a real headless-browser pass with Chromium automation against both localhost and file URLs for the shipped app bundle.

- [BLOCKED] `http://127.0.0.1:43715/index.html`
  - `Page.goto: net::ERR_BLOCKED_BY_ADMINISTRATOR at http://127.0.0.1:43715/index.html`
- [BLOCKED] `file:///mnt/data/smoke_v35/SkyeRoutexFlow/SkyeRoutex/index.html`
  - `Page.goto: net::ERR_BLOCKED_BY_ADMINISTRATOR at file:///mnt/data/smoke_v35/SkyeRoutexFlow/SkyeRoutex/index.html`

Because both browser navigation targets were blocked by administrator policy in this sandbox, I cannot honestly claim a completed full interactive browser click-smoke from this exact environment.

## Static verification I did run
- [PASS] Routex `index.check.js`
- [PASS] AE FLOW `index.check.js`
- [PASS] Routex `tutorials.v35.js`
- [PASS] AE FLOW `tutorials.v35.js`

## Shipped walkthrough coverage found in code
### Routex
- `start-here` — 7 guided steps
- `route-ops` — 5 guided steps
- `operator-stack` — 4 guided steps
- `security-recovery` — 5 guided steps

### AE FLOW
- `aeflow-core` — 4 guided steps
- `aeflow-routex-bridge` — 4 guided steps
- `aeflow-settings-backup` — 3 guided steps

## Selector-presence audit for key walkthrough and post-directive controls
### Routex
- [PASS] `#vaultSettingsBtn`
- [FAIL] `#rtxTopbarToursBtn` *(runtime-injected, not statically present in the HTML source)*
- [FAIL] `#rtxTutorialLaunchpadCard` *(runtime-injected, not statically present in the HTML source)*
- [FAIL] `#rtxTutorialSettingsCard` *(runtime-injected, not statically present in the HTML source)*
- [PASS] `#st_backup`
- [PASS] `#st_wipe`
- [PASS] `#routexLaunchBoardSaveBtn`
- [PASS] `#routexOpsBriefSaveBtn`
- [PASS] `#routexHandoffPacketSaveBtn`
- [PASS] `#ex_json`
- [PASS] `#ex_json_enc`
- [PASS] `#ex_import`
- [PASS] `#ex_route_pack`

### AE FLOW
- [PASS] `#newVisitBtn`
- [FAIL] `#aeFlowToursBtn` *(runtime-injected, not statically present in the HTML source)*
- [FAIL] `#aeFlowToursSettingsCard` *(runtime-injected, not statically present in the HTML source)*
- [PASS] `#saveSettingsBtn`
- [PASS] `#resetSettingsBtn`
- [PASS] `#aeRoutexQueueVisible`
- [PASS] `#aeRoutexSaveSeed`
- [PASS] `#aeRoutexExportSeed`

## What is left on the implementation / upgrade list
- Base directive status: **closed in code**. There are no untouched base NEW-SHIT2 directive rows left.

### Still not honestly proven live
- full interactive browser click-smoke inside this sandbox *(attempted, blocked by Chromium administrator policy)*
- true second-device transfer proof outside one local session
- true hardware microphone proof for the MediaRecorder lane
- broader older-package lineage proof beyond the seeded shipped corpus, if you want deeper historical evidence

### Highest-value upgrade backlog still not hit
- expand walkthrough coverage from the current 7 tours into dedicated guided tours for **every advanced manager and artifact lane**
- add **first-run onboarding orchestration** that sequences the right tours automatically for a new operator
- add **contextual help launchers** on deeper surfaces like launch board, ops brief, handoff packet, completion binder, closure bundles, and hybrid sync lanes
- add an **in-app walkthrough coverage matrix** so the product can prove which feature lanes are already taught and which still need guided instruction

## Machine-readable audit
- `static_selector_and_tour_audit.json`
- `browser_block_capture.json`
