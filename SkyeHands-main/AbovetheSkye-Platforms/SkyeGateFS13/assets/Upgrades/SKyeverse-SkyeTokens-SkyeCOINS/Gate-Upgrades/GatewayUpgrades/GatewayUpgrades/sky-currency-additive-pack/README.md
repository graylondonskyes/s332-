# Kaixu Sovereign Multimodal Gateway Patch Pack

This additive pack hardens the existing Kaixu gateway into a lane-aware multimodal control surface.

## What changed

- Added distinct public Kaixu lanes for chat, stream, images, videos, speech, transcriptions, realtime, usage, and jobs.
- Added first-class `kaixu_traces` and `kaixu_jobs` tables for trace/job observability.
- Split OpenAI adapter code by lane instead of pretending one generic handler can do all the weird little circus acts.
- Normalized public responses so provider/model/upstream details stay admin-only.
- Added admin routes for trace inspection, job inspection, upstream inspection, retry, and cancel.
- Added separate async video polling behavior to avoid query-racing between direct-response lanes and background job lanes.

## Key files

- `src/router.ts`
- `src/routes/*.ts`
- `src/adapters/*.ts`
- `src/db/migrations/0002_multimodal_hardening.sql`
- `docs/api-contract.md`
- `docs/env-example.md`
- `docs/acceptance-checklist.md`
- `docs/integration-readme.md`

## Deploy notes

1. Use Node `>=20.18.1`, then run `npm ci`.
2. Create or bind the D1 database and export `SKY_CURRENCY_D1_DATABASE_ID` with the real remote D1 UUID before remote migrations or deploys.
3. Run `npm run smoke:static` for local static readiness, then `SKY_CURRENCY_D1_DATABASE_ID=<uuid> npm run deploy:check` for strict deploy readiness.
4. Apply D1 migrations with `SKY_CURRENCY_D1_DATABASE_ID=<uuid> npm run d1:migrate:remote`; the pack renders a resolved Wrangler config at runtime, keeps no fake D1 binding in committed config, and points migrations at `src/db/migrations`.
5. For initial bootstrap data, run `npm run d1:seed:remote` or apply equivalent production-managed seed data.
6. Set Worker secrets for the OpenAI key(s) and `KAIXU_ADMIN_TOKEN`.
7. Set or confirm enabled lane vars.
8. Deploy the worker with `npm run deploy`.
9. Point frontend apps at Kaixu routes only.

## Typecheck

```bash
npm ci
npm run typecheck
npm run smoke:static
SKY_CURRENCY_D1_DATABASE_ID=<real-cloudflare-d1-uuid> npm run deploy:check
```

`npm run typecheck` first uses this pack's local TypeScript compiler. Inside the integrated AboveTheSkye workspace it can fall back to the shared SuperIDEv3.8 compiler so the pack remains verifiable while local dependencies are being installed.
