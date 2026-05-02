# Skye GEO Engine Starter

Cloudflare-first starter for an operator-grade AI-search growth system.

## What is real in this pass

- workspace and project CRUD
- persisted audit runs
- persisted 30-day content plans
- persisted visibility prompt packs
- research/source ingest with dedupe
- article brief generation from stored sources
- deterministic article draft generation from stored briefs
- persisted publish payload records
- workspace history aggregation
- route-level smoke proof

## Core routes

- `GET /v1/health`
- `GET/POST /v1/workspaces`
- `GET/POST /v1/projects`
- `GET /v1/jobs`
- `GET /v1/history`
- `POST /v1/audit/site`
- `POST /v1/content/plan`
- `GET/POST /v1/visibility/prompt-pack`
- `GET/POST /v1/research`
- `GET/POST /v1/articles/brief`
- `POST /v1/articles/draft`
- `GET/POST /v1/publish/payload`

## Commands

```bash
npm run check
npm run smoke
```

## SQL

- `sql/001_init.sql`
- `sql/002_core_tables.sql`
- `sql/003_indexes.sql`
- `sql/004_rls_or_tenant_guards.sql`

## Important note

The local smoke currently proves the adapter-backed flow in memory mode. Real Neon execution proof is still open and should remain open until a live Neon target is exercised.
