import { createSkyDexiaMemoryMiddleware } from '../platform/skydexia-memory-middleware.mjs';

async function fakeSkyDexiaPlanner({ systemContext, userRequest }) {
  return {
    ok: true,
    verified: true,
    title: 'Example verified SkyDexia action',
    summary: `Handled request with ${systemContext.length} characters of memory-aware context: ${userRequest}`,
    tags: ['example', 'platform-embedded'],
    evidence: { example: true }
  };
}

const memoryMiddleware = createSkyDexiaMemoryMiddleware({
  projectId: 'skyehands-example',
  actorId: 'skydexia',
  storage: { kind: 'local-jsonl', rootDir: './.skydexia-memory-example' },
  proofMode: true
});

await memoryMiddleware.recordDirective({
  title: 'Example directive — no placeholder controls',
  complete: true,
  text: 'Visible controls must perform their claimed action.',
  evidence: { example: true }
});

export async function runSkyDexiaTurn(userRequest) {
  const enriched = await memoryMiddleware.beforePlan({
    userRequest,
    memoryLimit: 8
  });

  const systemContext = [
    'You are SkyDexia running inside SkyeHands.',
    'Use recalled memory before planning.',
    enriched.skydexiaMemoryContext
  ].join('\n\n');

  const result = await fakeSkyDexiaPlanner({ systemContext, userRequest });

  if (result.ok && result.verified) {
    await memoryMiddleware.afterAction({
      type: 'implementation_event',
      title: result.title,
      text: result.summary,
      tags: result.tags,
      evidence: result.evidence
    });
  } else {
    await memoryMiddleware.afterAction({
      type: 'failure',
      title: result.title || 'Example failed action',
      text: result.summary || 'Action failed verification.',
      tags: ['failure', 'example'],
      evidence: result.evidence || {}
    });
  }

  return { result, recalledMemory: enriched.skydexiaMemoryResults };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = await runSkyDexiaTurn('Continue closure work with no demo behavior.');
  console.log(JSON.stringify(out, null, 2));
}
