# SkyDexia Donor Autonomy Runbook

## Scope
Production pipeline for donor packs from validated ingestion through normalized runtime profiles and autonomous spin-up.

## Ordered Flow
1. `scripts/skydexia-donor-ingest.mjs` validates donor manifests and writes `skydexia/donors/ingestion-registry.json`.
2. `scripts/skydexia-donor-normalize.mjs` normalizes scripts/runtime expectations into `skydexia/donors/normalized/*.json`.
3. `scripts/skydexia-template-spinup.mjs <donorId>` creates runnable generated projects under `skydexia/generated-projects/<donorId>/`.
4. `scripts/skydexia-compatibility-matrix.mjs` emits provider/env compatibility inventory.
5. `scripts/skydexia-donor-smoke-classifier.mjs` emits smoke suites grouped per donor class.

## Operational Constraints
- Ingestion blocks donors missing required manifest fields.
- Spin-up consumes normalized data only.
- Compatibility matrix is generated from normalized donors only.
- Smoke suite grouping is class-aware and includes executable commands per donor.
