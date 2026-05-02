# Platform Certification Table

Date: 2026-05-01

Scope: `AbovetheSkye-Platforms`

Method: local evidence only. This table uses runtime files, smoke/proof files, and repo-owned audit/directive text already present in this tree. It does not invent coverage.

## Status Legend

- `shipped`: runnable surface plus meaningful local smoke/proof evidence
- `partial`: some runnable surface or implementation evidence exists, but proof coverage and/or self-declared completion is incomplete
- `concept`: no clear runtime, or local evidence explicitly positions the folder as concept/demo/catalog material

## Certification Table

| Folder | Category | Entrypoint | Proof Surface | Status | Confidence |
| --- | --- | --- | --- | --- | --- |
| `2026` | `static-web` | `2026/OperationBrowserStrike/index.html` | `2026/smoke/smoke-proof.mjs` | `concept` | high |
| `AE-Central-CommandHub` | `static-web` | `AE-Central-CommandHub/AE-Central-Command-Pack-CredentialHub-Launcher/index.html` | `AE-Central-CommandHub/smoke/smoke-proof.mjs` | `partial` | high |
| `AE-FlowPro` | `static-web` | `AE-FlowPro/index.html` | `AE-FlowPro/smoke/smoke-proof.mjs` | `partial` | high |
| `AppointmentSetter` | `python-app` | `AppointmentSetter/server.py` | `AppointmentSetter/smoke/smoke_test.py` | `shipped` | high |
| `BrandID-Offline-PWA` | `static-web` | `BrandID-Offline-PWA/index.html` | `BrandID-Offline-PWA/smoke/smoke-static-proof.mjs` | `partial` | medium |
| `BusinessLaunchGo` | `static-web` | `BusinessLaunchGo/index.html` | `BusinessLaunchGo/smoke/smoke-proof.mjs` | `partial` | high |
| `DualLaneFunnel` | `node-app` | `DualLaneFunnel/package.json` | `DualLaneFunnel/smoke/smoke-proof.mjs` | `partial` | high |
| `Featured-on-SkyeSol` | `catalog` | `Featured-on-SkyeSol/SkyeSol-Inventory` | `Featured-on-SkyeSol/smoke/smoke-proof.mjs` | `concept` | high |
| `GateProofx` | `static-web` | `GateProofx/index.html` | `GateProofx/smoke/smoke-static-proof.mjs` | `partial` | medium |
| `JobPing` | `node-app` | `JobPing/package.json` | `JobPing/scripts/smoke.ts` | `shipped` | high |
| `LocalSeoSnapshot` | `static-web` | `LocalSeoSnapshot/index.html` | `LocalSeoSnapshot/smoke/smoke-proof.mjs` | `partial` | high |
| `MaggiesStore` | `node-app` | `MaggiesStore/source/package.json` | `MaggiesStore/source/proof-smoke/smoke-foundation.mjs` | `shipped` | high |
| `NeuralSpacePro` | `static-web` | `NeuralSpacePro/index.html` | `NeuralSpacePro/smoke/smoke-proof.mjs` | `partial` | high |
| `Offline First Tools` | `no-clear-runtime` | `Offline First Tools/SkyeCashLedger.html` | `Offline First Tools/smoke/smoke-proof.mjs` | `concept` | medium |
| `QR-Code-Generator` | `static-web` | `QR-Code-Generator/index.html` | `QR-Code-Generator/smoke/smoke-proof.mjs` | `partial` | high |
| `Repo Live` | `static-web` | `Repo Live/index.html` | `Repo Live/smoke/smoke-proof.mjs` | `partial` | high |
| `SkyDexia` | `scripted-webapp` | `SkyDexia/skydexia-orchestrator.mjs` | `SkyDexia/proofs/e2e-required-vars-proof.json` | `shipped` | high |
| `Skye Identity Standard: Global Command Center` | `static-web` | `Skye Identity Standard: Global Command Center/index.html` | `Skye Identity Standard: Global Command Center/smoke/smoke-proof.mjs` | `partial` | high |
| `Skye Profit Console` | `static-web` | `Skye Profit Console/index.html` | `Skye Profit Console/smoke/smoke-proof.mjs` | `partial` | high |
| `SkyeDexiaNeural` | `static-web` | `SkyeDexiaNeural/index.html` | `SkyeDexiaNeural/smoke/smoke-proof.mjs` | `partial` | high |
| `SkyeDocxMax` | `static-web` | `SkyeDocxMax/index.html` | `SkyeDocxMax/smoke/smoke-standalone.mjs` | `partial` | high |
| `SkyeForgeMax` | `static-web` | `SkyeForgeMax/index.html` | `SkyeForgeMax/smoke/smoke-proof.mjs` | `partial` | high |
| `SkyeGateFS13` | `node-gateway` | `SkyeGateFS13/package.json` | `SkyeGateFS13/scripts/verify-skins.mjs` | `shipped` | high |
| `SkyeLeadVault` | `static-web` | `SkyeLeadVault/public/index.html` | `SkyeLeadVault/smoke/smoke-proof.mjs` | `partial` | high |
| `SkyeMail` | `node-app` | `SkyeMail/package.json` | `SkyeMail/smoke/smoke-standalone-proof.mjs` | `partial` | high |
| `SkyeMediaCenter` | `static-web` | `SkyeMediaCenter/public/index.html` | `SkyeMediaCenter/smoke/smoke-proof.mjs` | `partial` | high |
| `SkyeMusicNexus` | `static-web` | `SkyeMusicNexus/public/index.html` | `SkyeMusicNexus/smoke/smoke-proof.mjs` | `partial` | high |
| `SkyeProfitConsole` | `static-web` | `SkyeProfitConsole/index.html` | `SkyeProfitConsole/smoke/smoke-proof.mjs` | `partial` | high |
| `SkyeProofx` | `static-web` | `SkyeProofx/index.html` | `SkyeProofx/smoke/smoke-proof.mjs` | `partial` | high |
| `SkyeRoutex` | `node-app` | `SkyeRoutex/package.json` | `SkyeRoutex/PLATFORM_HOUSE_CIRCLE_SMOKE_V83.js` | `shipped` | high |
| `SkyeWebCreatorMax` | `static-web` | `SkyeWebCreatorMax/index.html` | `SkyeWebCreatorMax/smoke/smoke-production-readiness.mjs` | `shipped` | high |
| `SuperIDEv2` | `node-app-suite` | `SuperIDEv2/package.json` | `SuperIDEv2/docs/SMOKE_CONTRACT_MATRIX.md` | `partial` | high |
| `SuperIDEv3.8` | `node-app-suite` | `SuperIDEv3.8/package.json` | `SuperIDEv3.8/public/SkyeDocxMax/smoke/smoke-standalone.mjs` | `partial` | high |
| `ValleyVerified-v2` | `node-app` | `ValleyVerified-v2/package.json` | `ValleyVerified-v2/smoke/smoke-proof.mjs` | `partial` | high |
| `kAIxU-PDF-Pro` | `node-app` | `kAIxU-PDF-Pro/package.json` | `kAIxU-PDF-Pro/smoke/smoke-static-proof.mjs` | `partial` | high |
| `kAIxUBrandKit` | `node-app` | `kAIxUBrandKit/package.json` | `kAIxUBrandKit/smoke/smoke-contract-proof.mjs` | `partial` | high |
| `kAIxUChatv6.7` | `static-web` | `kAIxUChatv6.7/kAIxUChatv67.html` | `kAIxUChatv6.7/smoke/smoke-proof.mjs` | `concept` | medium |
| `kAIxUDeltaGate` | `static-web` | `kAIxUDeltaGate/index.html` | `kAIxUDeltaGate/smoke/smoke-proof.mjs` | `partial` | high |
| `kAIxUGateway13` | `node-gateway` | `kAIxUGateway13/package.json` | `kAIxUGateway13/scripts/smoke-gemini.sh` | `shipped` | high |
| `skAIxuIDEPro` | `node-app-suite` | `skAIxuIDEPro/package.json` | `skAIxuIDEPro/scripts/smoke-functions.mjs` | `partial` | high |
| `skyeroutex-workforce-command-v0.4.0` | `node-app` | `skyeroutex-workforce-command-v0.4.0/package.json` | `skyeroutex-workforce-command-v0.4.0/scripts/smoke-deploy-readiness.mjs` | `shipped` | high |

## Uncertain Classifications

These folders could not be classified confidently from local evidence alone. I kept them conservative in the registry.

- `AE-Central-CommandHub`: top-level launcher shell is now proven, but the bundle still includes walkthrough/packaging lanes that are not independently certified as shipped apps
- `AE-FlowPro`: proof lane now exists, but it only proves local PWA/export/offline contracts, not backend sync
- `BrandID-Offline-PWA`: static shell now has proof coverage, but first-load offline behavior and live submission are still outside local proof
- `GateProofx`: static reader now has proof coverage, but deployed archive endpoints are still external
- `NeuralSpacePro`: proof lane now exists, browser-held key UX has been removed, and a same-origin local session archive lane is now proven, but live gateway execution and deployed runtime proof still block stronger certification
- `QR-Code-Generator`: proof lane now exists, but automated browser rendering is still not proven
- `Repo Live`: static browser tool now has proof coverage, but live WebContainer/browser execution is still not proven end to end
- `Skye Identity Standard: Global Command Center`: local pages are now proven, but the folder still does not prove a full local command-center runtime
- `Skye Profit Console`: local product shell plus a browser-local planning worksheet and ledger subset are now proven, but the underlying hosted bookkeeping runtime is still not proven here
- `SkyeDexiaNeural`: UI and worker wiring are now proven, including local project and artifact inspection routes, but live remote worker behavior is still not proven here
- `SkyeForgeMax`: static shell plus a self-contained local runtime API lane are now proven locally, including proof-run history inspection, but deployed runtime behavior and live provider-backed integrations are still not proven here
- `SkyeLeadVault`: local handler and browser shell are now proven locally, including session-scoped browser auth and credential-checked local operator login, but real identity-provider handoff and deployed behavior are still not proven
- `SkyeMediaCenter`: local handler and browser shell are now proven locally, including session-scoped browser auth, credential-checked local operator login, and local media-file retrieval, but real identity-provider handoff and deployed behavior are still not proven
- `SkyeMusicNexus`: local handler surfaces are now proven locally, including session-scoped browser auth, credential-checked local operator login, and payout flows, but real identity-provider handoff and deployed distribution integrations are still not proven
- `SkyeProfitConsole`: redirect/alias behavior is now proven, but it is not its own independent app runtime
- `SkyeProofx`: crypto/PWA plus local export/verify, activity-log, and verification-report markers are now proven, but browser end-to-end vault exercise is still absent
- `kAIxUDeltaGate`: directive/tester shell plus a local request-planning lane and same-folder proof API are now proven, but live gateway/provider behavior is still not proven here

## Notes

- `Featured-on-SkyeSol/SkyeSol-Inventory` is treated as explicit local evidence for concept/demo/catalog material.
- `SkyeDocxMax/SkyeDocxMax_DIRECTIVE.md` is treated as explicit local evidence that `.docx`-claim completion and proof criteria are still incomplete.
- `SuperIDEv2`, `SuperIDEv3.8`, and `skAIxuIDEPro` have real smoke/proof surfaces, but the estate-level audit still places them below fully closed shipped certification.
