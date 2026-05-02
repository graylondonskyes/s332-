# SkyeHands Platform Embedding Blueprint

This file explains how to place SkyDexia Memory Fabric into the SkyeHands platform so SkyDexia has persistent operational memory inside her runtime.

## Target placement

Recommended monorepo placement:

```text
SkyeHands-main/
  packages/
    skydexia-memory-fabric/
      src/index.mjs
      platform/skydexia-memory-middleware.mjs
      package.json
  apps/
    skyehands-platform/
    skydexia-runtime/
```

Alternative placement for a single app:

```text
SkyeHands-main/
  src/
    skydexia/
      memory-fabric/
```

The package is first-party SkyDexia code. It is not an external AGPL vendored package.

## Runtime responsibilities

SkyDexia Memory Fabric should be called in four places:

1. **Before planning** — recall rules, directives, proof, failures, and project history.
2. **Before code generation** — recall file maps, prior decisions, and “do not overwrite” records.
3. **After verified action** — record what actually changed and what proof exists.
4. **After failed action** — record failure cause so SkyDexia does not repeat it.

## Minimal integration loop

```js
import { createSkyDexiaMemoryMiddleware } from '../packages/skydexia-memory-fabric/platform/skydexia-memory-middleware.mjs';

const memoryMiddleware = createSkyDexiaMemoryMiddleware({
  projectId: 'skyehands',
  actorId: 'skydexia',
  storage: { kind: 'local-jsonl', rootDir: './.skydexia-memory' },
  proofMode: true
});

export async function runSkyDexiaTurn({ userRequest }) {
  const enriched = await memoryMiddleware.beforePlan({
    userRequest,
    memoryLimit: 10
  });

  const systemContext = [
    'You are SkyDexia, SkyeHands operational orchestrator.',
    'Use the following recalled memory as hard context.',
    enriched.skydexiaMemoryContext
  ].join('\n\n');

  const result = await runPlannerAndBuilder({
    systemContext,
    userRequest
  });

  if (result.ok && result.verified) {
    await memoryMiddleware.afterAction({
      type: 'implementation_event',
      title: result.title || 'Verified SkyDexia action',
      text: result.summary || '',
      tags: result.tags || ['skydexia', 'verified'],
      evidence: result.evidence || {}
    });
  } else {
    await memoryMiddleware.afterAction({
      type: 'failure',
      title: result.title || 'SkyDexia action failed verification',
      text: result.error || result.summary || '',
      tags: ['failure', 'verification'],
      evidence: result.evidence || {}
    });
  }

  return result;
}
```

## Recommended memory types

Use these `type` values consistently:

```text
rule
project_decision
repo_map
implementation_event
directive
smoke-proof
failure
deployment_note
provider_note
valuation_record
user_preference
```

## Directive rule

Directive memories should only be marked complete after proof exists.

Use:

```js
await memoryMiddleware.recordDirective({
  title: 'Gate 3 — Public landing claims truth',
  complete: true,
  text: 'Landing page claims were audited against implemented routes.',
  evidence: {
    proofFile: 'proof/PUBLIC_CLAIMS_LEDGER.json',
    checkedAt: new Date().toISOString()
  }
});
```

For an open directive:

```js
await memoryMiddleware.recordDirective({
  title: 'Gate 7 — Live provider smoke',
  complete: false,
  text: 'Provider code exists, but live provider smoke has not been run.',
  evidence: {
    reason: 'Missing live provider credentials'
  }
});
```

## Smoke proof rule

Smoke proof memory should contain the proof file path and pass/fail state.

```js
await memoryMiddleware.recordSmoke({
  title: 'SkyeHands UI click smoke',
  passed: true,
  text: 'All claimed UI controls were visible and clickable within screen margins.',
  evidence: {
    proofFile: 'proof/UI_CLICK_SMOKE.json',
    controlsChecked: 42,
    failures: 0
  }
});
```

## Failure memory rule

Record failures aggressively. This is how SkyDexia stops repeating waste.

```js
await memoryMiddleware.afterAction({
  type: 'failure',
  title: 'Netlify function route missing',
  text: 'Button was visible but target Netlify function route was absent. Do not claim deploy-ready until route exists and smoke passes.',
  tags: ['failure', 'route', 'netlify'],
  evidence: {
    missingRoute: '/.netlify/functions/create-lead',
    proofFile: 'proof/ROUTE_AUDIT_FAIL.json'
  }
});
```

## Prompt injection pattern

Do not dump unlimited memory into the model. Use a bounded recall result.

```js
const recall = await memory.recall({ query: userRequest, limit: 8 });
const prompt = `${baseSystemPrompt}\n\n# Recalled SkyDexia Memory\n${recall.contextText}\n\n# User Request\n${userRequest}`;
```

## Storage recommendations by environment

For local SkyeHands dev:

```js
storage: { kind: 'local-jsonl', rootDir: './.skydexia-memory' }
```

For Cloudflare Worker deployment:

```js
storage: { kind: 'cloudflare-d1', db: env.SKYDEXIA_MEMORY_DB }
```

For Node server / Neon deployment:

```js
storage: { kind: 'neon-postgres', connectionString: process.env.NEON_DATABASE_URL }
```

## Production hardening checklist

☐ Add auth checks before exposing memory data through any API.

☐ Add tenant/project isolation for multi-customer deployments.

☐ Add memory retention policies.

☐ Add export/download permissions.

☐ Add live D1 smoke or live Neon smoke.

☐ Add vector retrieval only after baseline lexical memory is proven stable.

