import { createSkyDexiaMemory } from '../src/index.mjs';

export function createSkyDexiaMemoryMiddleware(options = {}) {
  const memory = options.memory || createSkyDexiaMemory({
    mode: 'platform-embedded',
    projectId: options.projectId || 'skyehands',
    actorId: options.actorId || 'skydexia',
    storage: options.storage || { kind: 'local-jsonl', rootDir: options.rootDir || '.skydexia-memory' },
    proofMode: options.proofMode !== false
  });
  return {
    memory,
    async beforePlan(request = {}) {
      await memory.init();
      const query = request.query || request.prompt || request.userRequest || '';
      const recalled = await memory.recall({ query, includeDirectives: true, includeSmokeProof: true, includeFailures: true, limit: request.memoryLimit || 8 });
      return { ...request, skydexiaMemoryContext: recalled.contextText, skydexiaMemoryResults: recalled.results };
    },
    async afterAction(action = {}) {
      await memory.init();
      return memory.remember({ type: action.type || 'implementation_event', title: action.title || 'SkyDexia action recorded', tags: action.tags || ['platform','action'], text: action.text || action.summary || '', evidence: action.evidence || {} });
    },
    async recordDirective(directive = {}) { await memory.init(); return memory.rememberDirectiveStatus(directive); },
    async recordSmoke(smoke = {}) { await memory.init(); return memory.rememberSmokeProof(smoke); }
  };
}
