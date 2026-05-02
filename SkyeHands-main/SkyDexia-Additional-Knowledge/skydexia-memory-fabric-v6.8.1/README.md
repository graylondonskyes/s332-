# SkyDexia Memory Fabric v6.8.1

SkyDexia Memory Fabric is a first-party memory layer for SkyeHands. It is built to do two separate jobs:

1. **Local sidecar memory** for terminal, Codex, Claude, Cursor, VS Code, and repo workflows.
2. **Platform-embedded memory** for the deployed SkyDexia runtime inside SkyeHands.

This package is a clean SkyDexia-native implementation. It does **not** vendor, copy, or ship the AGPL Claude-Mem source.

## What this gives SkyDexia

SkyDexia can record and recall:

- project rules
- repo decisions
- route/file maps
- implementation events
- failed attempts
- smoke proofs
- directive status
- user operating preferences
- build/deployment notes
- “never repeat this mistake” records
- context blocks for `AGENTS.md`, `CLAUDE.md`, or other agent instruction files

The important architecture point: this is not only a terminal helper. The same core can be imported into the SkyeHands/SkyDexia runtime so SkyDexia recalls memory before planning and records verified results after execution.

## Package contents

```text
skydexia-memory-fabric-v6.8.1/
  bin/skydexia-memory.mjs
  src/index.mjs
  platform/skydexia-memory-middleware.mjs
  scripts/install-global.sh
  scripts/install-project.sh
  scripts/smoke-v6.8.1.mjs
  examples/platform-import-example.mjs
  examples/skyehands-orchestrator-loop-example.mjs
  templates/AGENTS_MEMORY_BLOCK.md
  docs/USE_AND_INTEGRATION_GUIDE.md
  docs/SKYEHANDS_PLATFORM_EMBEDDING_BLUEPRINT.md
  docs/LOCAL_SIDECAR_RUNBOOK.md
  docs/COMMAND_REFERENCE.md
  docs/STORAGE_ADAPTERS_GUIDE.md
  docs/TROUBLESHOOTING.md
  docs/SKYDEXIA_MEMORY_FABRIC_DIRECTIVE.md
  docs/ARCHITECTURE.md
  proof/SMOKE_PASS_v6.8.1.json
  package.json
```

## Fast path: install once for all local repos

Unzip the package somewhere permanent, then run:

```bash
cd /path/to/skydexia-memory-fabric-v6.8.1
npm link
```

After that, use the command from any repo without reinstalling:

```bash
cd /path/to/any/project
skydexia-memory init --project skyehands
skydexia-memory remember --type rule --title "No placeholder controls" --tag ui,smoke --text "No visible button ships unless it performs its claimed action end to end."
skydexia-memory recall "placeholder controls smoke"
skydexia-memory inject --target AGENTS.md --query "ui smoke rules"
```

Each repo gets its own local memory folder:

```text
<repo>/.skydexia-memory/
  config.json
  memory.jsonl
  events.jsonl
  exports/
```

## Platform path: embed inside SkyeHands / SkyDexia

Copy this folder into the SkyeHands codebase as a first-party package, for example:

```text
SkyeHands-main/packages/skydexia-memory-fabric/
```

Then import it in the SkyDexia runtime:

```js
import { createSkyDexiaMemory } from './packages/skydexia-memory-fabric/src/index.mjs';

const memory = createSkyDexiaMemory({
  mode: 'platform-embedded',
  projectId: 'skyehands',
  actorId: 'skydexia',
  storage: { kind: 'local-jsonl', rootDir: './.skydexia-memory' },
  proofMode: true
});

await memory.init();

const recalled = await memory.recall({
  query: userRequest,
  includeDirectives: true,
  includeSmokeProof: true,
  includeFailures: true,
  limit: 8
});
```

Or use the middleware loop:

```js
import { createSkyDexiaMemoryMiddleware } from './packages/skydexia-memory-fabric/platform/skydexia-memory-middleware.mjs';

const memoryMiddleware = createSkyDexiaMemoryMiddleware({
  projectId: 'skyehands',
  actorId: 'skydexia',
  storage: { kind: 'local-jsonl', rootDir: './.skydexia-memory' }
});

const enrichedRequest = await memoryMiddleware.beforePlan({
  userRequest: 'continue closure work with no demo behavior',
  memoryLimit: 8
});

// Feed enrichedRequest.skydexiaMemoryContext into SkyDexia's planner/system context.

await memoryMiddleware.afterAction({
  type: 'implementation_event',
  title: 'Closed route manifest gate',
  text: 'Route smoke passed and route manifest audit returned PASS.',
  tags: ['routes', 'smoke', 'closure'],
  evidence: { passed: true, proofFile: 'proof/ROUTE_SMOKE.json' }
});
```

## Smoke test

```bash
cd /path/to/skydexia-memory-fabric-v6.8.1
npm run smoke
```

A passing smoke writes:

```text
proof/SMOKE_PASS_v6.8.1.json
```

The smoke verifies:

- local memory capture
- local memory recall
- AGENTS.md context injection
- platform middleware recall
- directive memory recording
- smoke-proof memory recording
- secret redaction
- export pack generation

## Current boundaries

✅ Local JSONL storage is implemented and smoke-proven.

✅ Platform embedded middleware is implemented and smoke-proven with local JSONL storage.

✅ Cloudflare D1 and Neon/Postgres adapter classes exist as extension points.

☐ D1 and Neon are not live-smoke-proven without real host bindings or database credentials.

☐ Retrieval is lexical scoring in v6.8.1, not vector embeddings.

☐ Browser dashboard and multi-tenant admin UI are not implemented in v6.8.1.

For full instructions, start here:

```text
docs/USE_AND_INTEGRATION_GUIDE.md
```
