# Section 85 — SkyeHands Platform DB Directive

☑ Postgres/Neon SQL migration implemented.
☑ Org, user, session, project, task, approval, usage, audit, provider config, and deployment tables implemented.
☑ JSONB proof/result/config fields implemented.
☑ CHECK constraints implemented.
☑ Foreign keys implemented.
☑ Indexes implemented.
☑ Local adapter smoke implemented.
☑ Postgres smoke command implemented with loud fail when `DATABASE_URL` or `pg` is missing.
☑ Proof ledger output implemented.

## Required proof

☑ `node platform/user-platforms/skyehands-codex-real-platform/skyehands-platform-db.mjs smoke local`
☑ Optional live DB proof: `DATABASE_URL=... node platform/user-platforms/skyehands-codex-real-platform/skyehands-platform-db.mjs smoke postgres`
☑ `docs/proof/SKYEHANDS_PLATFORM_DB_PROOF.json`
