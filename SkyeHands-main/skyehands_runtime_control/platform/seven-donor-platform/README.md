# SkyeForgeMax

SkyeForgeMax is the volcanic red/gold SkyeHands command platform for turning donor apps into proof-backed, certified, launchable sovereign products.

Brand voice: molten, premium, direct, proof-first.

Palette:

- Obsidian: `#170b08`
- Magma Red: `#d7261e`
- Lava Crimson: `#8f120d`
- Forge Gold: `#f6b73c`
- Ember Gold: `#ffdd75`
- Ash White: `#fff3df`

Legacy/internal folder name: `seven-donor-platform`.

This is the native SkyeHands runtime-control integration layer for the audited donor zips from:

`../Later-Additions/DonorCode-MySkyeApps/_integration_workspace/seven-zips-unpacked`

The goal is not to dump donor code directly into production. The goal is to route each donor through SkyeHands platform families with clear contracts, proof, and smoke gates.

## Platform Families

- `skye.sovereign.primitives`
- `skye.valuation.certification`
- `skye.quality.gate`
- `skye.ae.central`
- `skye.house.command`
- `skye.intake.funnel`
- `skye.assistant.personaRoles`

## Runtime-Control Scripts

From `SkyeHands-main/skyehands_runtime_control`:

- `npm run seven:inventory`
- `npm run seven:quality`
- `npm run seven:smoke`
- `npm run seven:e2e`
- `npm run seven:server`
- `npm run forge:e2e`
- `npm run forge:server`
- `npm run skyeforgemax:e2e`
- `npm run skyeforgemax:server`

`seven:inventory` writes:

- `.skyequanta/proofs/skye-forge-max-inventory.json`

`seven:smoke` writes:

- `.skyequanta/proofs/skye-forge-max-smoke.json`

`seven:quality` runs the Dead Route Detector donor as a SkyeHands-owned Quality Gate job over the registered donor platform families. It writes per-donor JSON, Markdown, and SARIF artifacts plus:

- `.skyequanta/proofs/seven-donor-quality-gate/<run-id>/manifest.json`
- `.skyequanta/proofs/skye-forge-max-quality-gate/<run-id>/manifest.json`
- `.skyequanta/proofs/skye-forge-max-quality-gate-latest.json`

`seven:e2e` / `forge:e2e` / `skyeforgemax:e2e` runs the connected runtime path across Sovereign Primitives, Intake, AE Central, Role Assistant, Quality Gate, Valuation Certification, Sovereign handoff, and House Command. It writes:

- `.skyequanta/proofs/skye-forge-max-full-e2e.json`
- `.skyequanta/skyeforgemax-runtime/store.json`

`seven:server` / `forge:server` / `skyeforgemax:server` exposes the SkyeForgeMax runtime API:

- `GET /v1/health`
- `GET /v1/state`
- `POST /v1/e2e/run`
- `POST /v1/quality/run`
- `POST /v1/valuation/run`
