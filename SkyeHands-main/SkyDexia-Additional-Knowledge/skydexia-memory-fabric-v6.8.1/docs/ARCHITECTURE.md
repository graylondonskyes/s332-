# Architecture

SkyDexia Memory Fabric v6.8.1 is split into two lanes.

## Lane A — local-sidecar

The local sidecar lane is the repo and terminal workflow. It captures memories into `.skydexia-memory/`, recalls prior context, and injects bounded context into files such as `AGENTS.md`.

Use this lane for:

- Codex / terminal AI context
- repo-specific rules
- local project decisions
- local smoke proof notes
- curated AGENTS.md memory injection

## Lane B — platform-embedded

The platform-embedded lane is the SkyeHands/SkyDexia runtime workflow. SkyDexia recalls directives, proof records, failures, and project rules before planning work, then records verified outcomes after action.

Use this lane for:

- deployed SkyDexia runtime memory
- project operational history
- directive/proof recall
- failure avoidance
- persistent platform intelligence

## Core API

```js
const memory = createSkyDexiaMemory(options);
await memory.init();
await memory.remember(record);
await memory.recall({ query, limit });
await memory.inject({ target, query });
await memory.rememberDirectiveStatus(record);
await memory.rememberSmokeProof(record);
await memory.exportPack();
```

## Middleware API

```js
const middleware = createSkyDexiaMemoryMiddleware(options);
await middleware.beforePlan({ userRequest });
await middleware.afterAction({ title, text, evidence });
await middleware.recordDirective({ title, complete, evidence });
await middleware.recordSmoke({ title, passed, evidence });
```

## Storage

The local JSONL adapter is dependency-free and smoke-proven.

D1 and Neon/Postgres adapters are implemented as host-runtime extension points and require their real runtime bindings/dependencies.

## Retrieval

Retrieval in v6.8.1 is deterministic lexical scoring. Future embedding storage can be added behind the same `remember()` and `recall()` API without changing the main integration surface.

## Safety boundaries

Secrets are redacted before memory persistence using common token and credential patterns.

Private memory folders should usually not be committed.

Directive checkmarks should only be written after code/proof verification.

