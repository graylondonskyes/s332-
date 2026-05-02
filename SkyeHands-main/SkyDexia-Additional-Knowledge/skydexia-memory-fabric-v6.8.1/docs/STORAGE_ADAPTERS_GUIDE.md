# Storage Adapters Guide

SkyDexia Memory Fabric supports multiple storage modes through one API.

## Local JSONL

Status: implemented and smoke-proven.

Use for:

- local dev
- repo memory
- simple embedded memory
- smoke tests

Config:

```js
storage: {
  kind: 'local-jsonl',
  rootDir: './.skydexia-memory'
}
```

Files:

```text
.skydexia-memory/config.json
.skydexia-memory/memory.jsonl
.skydexia-memory/events.jsonl
```

## Memory store

Status: implemented.

Use for:

- tests
- temporary processes

Config:

```js
storage: { kind: 'memory' }
```

Warning: data disappears when the process exits.

## Cloudflare D1

Status: adapter class implemented; live host smoke requires a real D1 binding.

Use for:

- Cloudflare Worker deployments
- deployed SkyeHands memory
- lightweight platform persistence

Worker example:

```js
import { createSkyDexiaMemory } from './packages/skydexia-memory-fabric/src/index.mjs';

export default {
  async fetch(request, env) {
    const memory = createSkyDexiaMemory({
      mode: 'platform-embedded',
      projectId: 'skyehands',
      actorId: 'skydexia',
      storage: {
        kind: 'cloudflare-d1',
        db: env.SKYDEXIA_MEMORY_DB
      }
    });

    await memory.init();
    await memory.remember({
      type: 'deployment_note',
      title: 'Worker memory initialized',
      text: 'D1-backed SkyDexia memory initialized inside Worker.'
    });

    return Response.json({ ok: true });
  }
};
```

`wrangler.toml` / `wrangler.jsonc` concept:

```toml
[[d1_databases]]
binding = "SKYDEXIA_MEMORY_DB"
database_name = "skydexia-memory"
database_id = "REPLACE_WITH_D1_DATABASE_ID"
```

The adapter creates these tables automatically:

```sql
CREATE TABLE IF NOT EXISTS skydexia_memories (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  project_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skydexia_memory_events (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  project_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

## Neon/Postgres

Status: adapter class implemented; live smoke requires `pg` and a real connection string.

Install runtime dependency in the host app:

```bash
npm install pg
```

Config:

```js
storage: {
  kind: 'neon-postgres',
  connectionString: process.env.NEON_DATABASE_URL
}
```

Environment:

```bash
export NEON_DATABASE_URL='postgres://user:password@host/db?sslmode=require'
```

The adapter creates these tables automatically:

```sql
CREATE TABLE IF NOT EXISTS skydexia_memories (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  project_id text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS skydexia_memory_events (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  project_id text NOT NULL,
  created_at timestamptz NOT NULL
);
```

## Adapter selection recommendation

Local development:

```js
{ kind: 'local-jsonl', rootDir: './.skydexia-memory' }
```

Cloudflare-first deployed SkyeHands:

```js
{ kind: 'cloudflare-d1', db: env.SKYDEXIA_MEMORY_DB }
```

Node/Netlify/longer relational deployment:

```js
{ kind: 'neon-postgres', connectionString: process.env.NEON_DATABASE_URL }
```

## Current limitation

v6.8.1 retrieval is lexical scoring. D1/Neon persistence does not automatically add vector search. Add embeddings later behind the same `remember()` and `recall()` API.

