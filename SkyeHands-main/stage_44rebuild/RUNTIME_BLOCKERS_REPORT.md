# RUNTIME BLOCKERS REPORT

Generated: 2026-04-26T15:04:25.667Z

## Theia Install Lane
- installReady: ☐
- blocker: resolvedTheiaCli is null (dependencies/CLI not installed)
- runtimeRootUsed: SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/platform/ide-core
- action: cd SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/platform/ide-core && yarn install

## OpenHands Install Lane
- installReady: ☐
- blocker: Python import openhands failed (package unavailable in current environment)
- runtimeRootUsed: SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/platform/agent-core
- action: pip3 install openhands-ai OR cd SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/platform/agent-core && pip3 install -e .

## Runtime Parity Flags
- ☐ fullTheiaRuntime (missing flags: resolvedTheiaCli, backendLaunches, browserLaunches, workspaceOpens, fileSave, terminalCommand, previewOutput)
- ☐ fullOpenHandsRuntime (missing flags: packageImportable, serverLaunches, taskReceived, workspaceFileSeen, fileEditedOrGenerated, commandOrTestRun, resultReturnedToSkyeHands)
