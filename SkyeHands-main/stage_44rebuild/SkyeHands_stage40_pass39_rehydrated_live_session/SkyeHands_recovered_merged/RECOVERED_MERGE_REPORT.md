# SkyeHands recovered merge report

- Base used: TAR (`SkyeHands_3_1_9_FULL_PROJECT_COMPLETE (1).tar.gz`)
- Recovery donor used: ZIP (`SkyeHands-main_stage40_pass38_stage9_fallback_full (3)(1).zip`)
- Merge rule: keep TAR files when same path exists in both; restore only paths absent from TAR from the ZIP

## Counts
- ZIP regular files: **28426**
- TAR regular files: **13940**
- Merged regular files: **28597**
- Restored from ZIP into TAR base: **14657**
- TAR-only files preserved: **171**
- Same-path ZIP/TAR files left on TAR base because TAR looked newer/different: **51**
- ZIP files still missing after merge: **0**

## Restored from ZIP by top-level area
- `platform`: **10929**
- `dist`: **2227**
- `workspace`: **1248**
- `docs`: **170**
- `scripts`: **70**
- `.skyequanta`: **3**
- `public`: **2**
- `INVESTOR_VALUATION_2026-04-07_SECTION42.md`: **1**
- `Makefile`: **1**
- `README.md`: **1**
- `START_HERE.sh`: **1**
- `package.json`: **1**
- `skyequanta`: **1**
- `skyequanta.mjs`: **1**
- `src`: **1**

## TAR-only files preserved by top-level area
- `.skyequanta`: **85**
- `dist`: **85**
- `apps`: **1**

## Key root files that were restored from the ZIP
- `Makefile`
- `README.md`
- `START_HERE.sh`
- `package.json`
- `skyequanta`
- `skyequanta.mjs`

## Sample same-path files that differed and were kept from the TAR base
- `.skyequanta/audit-chain.ndjson` (zip=86309, tar=266070)
- `.skyequanta/audit-log.json` (zip=76522, tar=227215)
- `.skyequanta/remote-executor/executor-state.json` (zip=669, tar=325)
- `.skyequanta/remote-executor/executor.log` (zip=1890, tar=630)
- `.skyequanta/remote-executor/workspace-runtimes.json` (zip=27531, tar=20831)
- `.skyequanta/runtime-bus/events.ndjson` (zip=26428, tar=143555)
- `.skyequanta/runtime-bus/workspaces/local-default.json` (zip=2700, tar=2599)
- `.skyequanta/runtime-bus/workspaces/preview-stage8.json` (zip=5594, tar=9000)
- `.skyequanta/runtime-bus/workspaces/remote-default.json` (zip=3067, tar=2957)
- `.skyequanta/runtime-dependency-repair.json` (zip=591, tar=288)
- `.skyequanta/runtime-recovery/journal.ndjson` (zip=15644, tar=115335)
- `.skyequanta/workspace-runtime/local-default/ide.log` (zip=283, tar=234)
- `.skyequanta/workspace-runtime/local-default/state.json` (zip=18580, tar=15315)
- `.skyequanta/workspace-runtime/preview-stage8/ide.log` (zip=382, tar=333)
- `.skyequanta/workspace-runtime/preview-stage8/logs/activity.ndjson` (zip=3346, tar=6969)
- `.skyequanta/workspace-runtime/preview-stage8/logs/log-retention.json` (zip=221, tar=172)
- `.skyequanta/workspace-runtime/preview-stage8/state.json` (zip=19772, tar=15999)
- `.skyequanta/workspace-runtime/remote-default/logs/activity.ndjson` (zip=3372, tar=1120)
- `.skyequanta/workspace-runtime/remote-default/logs/log-retention.json` (zip=221, tar=172)
- `.skyequanta/workspace-scheduler-state.json` (zip=369, tar=3493)
- `.skyequanta/workspaces.json` (zip=6968, tar=9463)
- `apps/skyequanta-shell/bin/workspace-proof-stage10.mjs` (zip=14586, tar=15021)
- `apps/skyequanta-shell/bin/workspace-proof-stage11.mjs` (zip=7578, tar=8796)
- `apps/skyequanta-shell/bin/workspace-proof-stage4.mjs` (zip=7130, tar=7825)
- `apps/skyequanta-shell/bin/workspace-proof-stage9.mjs` (zip=9058, tar=9749)
- `apps/skyequanta-shell/bin/workspace-smoke-lifecycle.mjs` (zip=11619, tar=15988)
- `apps/skyequanta-shell/lib/deployment-packaging.mjs` (zip=20682, tar=20747)
- `apps/skyequanta-shell/lib/runtime-containment.mjs` (zip=15318, tar=15357)
- `apps/skyequanta-shell/lib/workspace-runtime.mjs` (zip=51446, tar=53797)
- `apps/skyequanta-shell/python/__pycache__/skyequanta_app_server.cpython-313.pyc` (zip=11808, tar=11760)
- `apps/skyequanta-shell/python/__pycache__/skyequanta_runtime_bootstrap.cpython-313.pyc` (zip=4260, tar=4212)
- `dist/production-release/SANITIZED_RELEASE_MANIFEST.json` (zip=1506209, tar=1600786)
- `dist/production-release/skyequantacore-current-truth/apps/skyequanta-shell/bin/remote-executor.mjs` (zip=25593, tar=25799)
- `dist/production-release/skyequantacore-current-truth/apps/skyequanta-shell/bin/workspace-proof-stage10.mjs` (zip=14354, tar=15021)
- `dist/production-release/skyequantacore-current-truth/apps/skyequanta-shell/bin/workspace-proof-stage11.mjs` (zip=7578, tar=8796)
- `dist/production-release/skyequantacore-current-truth/apps/skyequanta-shell/bin/workspace-proof-stage4.mjs` (zip=7022, tar=7825)
- `dist/production-release/skyequantacore-current-truth/apps/skyequanta-shell/bin/workspace-proof-stage8.mjs` (zip=14180, tar=14392)
- `dist/production-release/skyequantacore-current-truth/apps/skyequanta-shell/bin/workspace-proof-stage9.mjs` (zip=8780, tar=9749)
- `dist/production-release/skyequantacore-current-truth/apps/skyequanta-shell/bin/workspace-smoke-lifecycle.mjs` (zip=6747, tar=15988)
- `dist/production-release/skyequantacore-current-truth/apps/skyequanta-shell/lib/apparmor-policy.mjs` (zip=6920, tar=9407)