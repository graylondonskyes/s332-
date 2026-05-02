# RUNTIME BLOCKERS REPORT

Generated: 2026-04-30T00:00:00.000Z

Status: closed for local in-house runtime readiness. Live provider variables are still expected to be supplied at final deployment.

## Theia Install Lane
- installReady: ☑
- blocker: none for bundled runtime lane
- runtimeRootUsed: Dynasty-Versions/.skyequanta/runtime-deps/theia-browser
- proof: Dynasty-Versions/docs/proof/STAGE_2B_UPSTREAM_PARITY.json
- action: none. Bundled Theia runtime is the closure path for in-house boot readiness.

## OpenHands Install Lane
- installReady: ☑
- blocker: none for in-house compatibility lane
- runtimeRootUsed: Dynasty-Versions/apps/skyequanta-shell/python/openhands
- proof: Dynasty-Versions/docs/proof/STAGE_2B_UPSTREAM_PARITY.json
- action: none. Local OpenHands-compatible router now imports and participates in the runtime proof lane.

## Runtime Parity Flags
- ☑ fullTheiaRuntime (bundled CLI, backend launch, workspace, file, terminal, and preview proof passing)
- ☑ fullOpenHandsRuntime (package import, server compatibility, task/file/command/result proof lane passing)

## Verification
- `node apps/skyequanta-shell/bin/repair-stage2b.mjs --all` -> ok true
- `node apps/skyequanta-shell/bin/prepare-stage2b-deps.mjs` -> ok true
- `node apps/skyequanta-shell/bin/workspace-proof-stage2b.mjs --strict` -> ok true
- `./skyequanta doctor --mode deploy --probe-active --json` -> ok true with zero required failures

## SkyeRoutex Closure
- canonicalPath: AbovetheSkye-Platforms/SkyeRoutex
- sourcePath: Later-Additions/SkyeRoutexFlow_v83_BULLSHIT_REMOVED_PLATFORM_STACK/SkyeRoutexFlow_v83_BULLSHIT_REMOVED_PLATFORM_STACK/SkyeRoutex
- auth: SkyGateFS13 RS256 bearer adapter with final-gate `SKYEROUTEX_REQUIRE_SKYGATE=1`
- proof: `npm run smoke:v83` -> ok true, 17/17 checks passing in canonical path
