# SkyDexia Memory Fabric v6.8.1 — Use & Integration Guide

This guide explains how to use SkyDexia Memory Fabric in both lanes:

- **Lane A: Local sidecar** — one installed command that works across any repo.
- **Lane B: Platform embedded** — first-party memory runtime inside deployed SkyeHands / SkyDexia.

## 1. Concept

SkyDexia Memory Fabric is a persistent memory and recall layer. It stores structured records as JSONL and retrieves relevant records before work begins.

A memory record can represent:

- a rule
- a project decision
- an implementation event
- a directive update
- a smoke proof
- a failure
- a product requirement
- a route/file map note
- a deployment note
- a user preference

Every record includes:

```json
{
  "id": "mem_...",
  "projectId": "skyehands",
  "actorId": "skydexia",
  "mode": "local-sidecar or platform-embedded",
  "type": "rule",
  "title": "No placeholder controls",
  "tags": ["ui", "smoke"],
  "text": "No visible button ships unless it performs its claimed action end to end.",
  "evidence": {},
  "createdAt": "ISO timestamp"
}
```

## 2. When to use each lane

Use **local sidecar** when you want terminal AI tools and repo workflows to remember context.

Examples:

- Codex running inside a project repo
- Claude Code running from a folder
- Cursor/VS Code repo notes
- local project rules
- injecting recalled memory into `AGENTS.md`

Use **platform embedded** when SkyDexia herself needs memory during live/deployed platform operation.

Examples:

- SkyDexia receives a user request in SkyeHands
- SkyDexia recalls previous project rules before planning
- SkyDexia records a verified smoke result after execution
- SkyDexia tracks directive status across app sessions
- SkyDexia keeps a project operational history

## 3. Local sidecar setup — install once

Unzip the package in a stable location.

Recommended location:

```bash
mkdir -p "$HOME/SkyeTools"
cp -R skydexia-memory-fabric-v6.8.1 "$HOME/SkyeTools/"
cd "$HOME/SkyeTools/skydexia-memory-fabric-v6.8.1"
npm link
```

Confirm the command exists:

```bash
skydexia-memory help
```

Initialize memory in a repo:

```bash
cd /home/lordkaixu/ALPHA-13/s332-
skydexia-memory init --project skyehands
```

This creates:

```text
/home/lordkaixu/ALPHA-13/s332-/.skydexia-memory/
```

Capture a standing rule:

```bash
skydexia-memory remember \
  --type rule \
  --title "No placeholder controls" \
  --tag ui,smoke,quality \
  --text "No visible button/control ships unless it performs its claimed action end to end."
```

Recall memory:

```bash
skydexia-memory recall "placeholder controls smoke"
```

Inject relevant memory into `AGENTS.md`:

```bash
skydexia-memory inject --target AGENTS.md --query "ui smoke quality rules"
```

The injection writes a bounded block:

```text
<!-- SKYDEXIA_MEMORY_CONTEXT_BEGIN -->
...
<!-- SKYDEXIA_MEMORY_CONTEXT_END -->
```

Future injections replace only that block.

## 4. Local sidecar without npm link

Use direct Node execution if you do not want to install a global command:

```bash
node /path/to/skydexia-memory-fabric-v6.8.1/bin/skydexia-memory.mjs init --project skyehands
node /path/to/skydexia-memory-fabric-v6.8.1/bin/skydexia-memory.mjs recall "smoke proof"
```

You can also create an alias:

```bash
echo "alias skydexia-memory='node /path/to/skydexia-memory-fabric-v6.8.1/bin/skydexia-memory.mjs'" >> ~/.bashrc
source ~/.bashrc
```

## 5. Platform embedded setup

Copy the package into your SkyeHands source tree:

```text
SkyeHands-main/packages/skydexia-memory-fabric/
```

Then import it from SkyDexia runtime code:

```js
import { createSkyDexiaMemory } from '../packages/skydexia-memory-fabric/src/index.mjs';
```

Create the memory runtime:

```js
const memory = createSkyDexiaMemory({
  mode: 'platform-embedded',
  projectId: 'skyehands',
  actorId: 'skydexia',
  storage: {
    kind: 'local-jsonl',
    rootDir: './.skydexia-memory'
  },
  proofMode: true
});

await memory.init();
```

Recall before planning:

```js
const recall = await memory.recall({
  query: userRequest,
  includeDirectives: true,
  includeSmokeProof: true,
  includeFailures: true,
  limit: 8
});

const plannerInput = [
  systemPrompt,
  '\n\n# SkyDexia Memory Context\n',
  recall.contextText,
  '\n\n# User Request\n',
  userRequest
].join('');
```

Record after verified work:

```js
await memory.remember({
  type: 'implementation_event',
  title: 'Closed route manifest gate',
  tags: ['routes', 'smoke', 'closure'],
  text: 'Route manifest audit passed and smoke proof was written.',
  evidence: {
    passed: true,
    proofFile: 'proof/ROUTE_MANIFEST_AUDIT.json'
  }
});
```

Record directive status only after code/proof supports it:

```js
await memory.rememberDirectiveStatus({
  title: 'Gate 1 — Route manifest truth',
  complete: true,
  text: 'Route manifest exists and route smoke verified registered routes.',
  evidence: {
    proofFile: 'proof/ROUTE_SMOKE.json'
  }
});
```

Record smoke proof:

```js
await memory.rememberSmokeProof({
  title: 'SkyeHands route smoke',
  passed: true,
  text: 'Routes were discovered and validated by smoke runner.',
  evidence: {
    checkedRoutes: 14,
    failedRoutes: 0
  }
});
```

## 6. Platform middleware integration

Use middleware if you want a simple before/after loop.

```js
import { createSkyDexiaMemoryMiddleware } from '../packages/skydexia-memory-fabric/platform/skydexia-memory-middleware.mjs';

const memoryMiddleware = createSkyDexiaMemoryMiddleware({
  projectId: 'skyehands',
  actorId: 'skydexia',
  storage: { kind: 'local-jsonl', rootDir: './.skydexia-memory' }
});

export async function handleSkyDexiaRequest(userRequest) {
  const enriched = await memoryMiddleware.beforePlan({
    userRequest,
    memoryLimit: 8
  });

  const planInput = `${enriched.skydexiaMemoryContext}\n\n${userRequest}`;

  const result = await runSkyDexiaPlannerAndBuilder(planInput);

  if (result.verified) {
    await memoryMiddleware.afterAction({
      type: 'implementation_event',
      title: result.title,
      text: result.summary,
      tags: result.tags,
      evidence: result.evidence
    });
  }

  return result;
}
```

## 7. Storage modes

### Local JSONL

Use this for local dev and simple embedded operation.

```js
storage: { kind: 'local-jsonl', rootDir: './.skydexia-memory' }
```

Implemented and smoke-proven.

### In-memory

Use this only for tests.

```js
storage: { kind: 'memory' }
```

This does not persist after process exit.

### Cloudflare D1

Use this in a Cloudflare Worker with a D1 binding.

```js
storage: { kind: 'cloudflare-d1', db: env.SKYDEXIA_MEMORY_DB }
```

The class creates tables automatically when initialized. It requires an actual D1 binding at runtime.

### Neon/Postgres

Use this in a Node server/runtime with `pg` installed.

```bash
npm install pg
```

```js
storage: {
  kind: 'neon-postgres',
  connectionString: process.env.NEON_DATABASE_URL
}
```

The class creates tables automatically when initialized. It requires a real Neon/Postgres URL.

## 8. Export and import memory packs

Export current repo memory:

```bash
skydexia-memory export --out skyehands-memory-pack.json
```

Import a pack into another repo:

```bash
skydexia-memory import --file skyehands-memory-pack.json
```

Use this to seed memory into a new SkyeHands project or to move a project memory pack into the platform-embedded store.

## 9. How to wire this into SkyDexia’s brain loop

The intended flow is:

```text
1. User asks SkyDexia to do work.
2. SkyDexia calls memory.recall() using the request.
3. SkyDexia appends recalled context to the planner/system context.
4. SkyDexia plans/builds/audits.
5. Smoke/proof runs.
6. Only verified results are recorded as memories.
7. Open directives remain open until proof exists.
```

Do not record claims as complete until there is code/proof. Use `rememberDirectiveStatus()` only for code-backed directive status.

## 10. What not to do

Do not commit private memory blindly.

Do not inject secrets into memory.

Do not use the D1 or Neon adapter as “proven live” until you run a real host smoke.

Do not mark directive lines complete unless a smoke/proof file supports the checkmark.

Do not treat lexical recall as vector RAG. v6.8.1 retrieval is deterministic lexical scoring.

## 11. Minimum production upgrade path

For a full deployed SkyDexia memory system, implement these next:

☐ Cloudflare D1 live smoke with real binding.

☐ Neon live smoke with real database URL.

☐ Vector embeddings lane behind the same `remember()` / `recall()` API.

☐ Browser dashboard for memory inspection.

☐ Multi-tenant project isolation.

☐ Admin-authenticated memory viewer.

☐ Backup/restore with merge preview.

☐ Memory retention controls.

