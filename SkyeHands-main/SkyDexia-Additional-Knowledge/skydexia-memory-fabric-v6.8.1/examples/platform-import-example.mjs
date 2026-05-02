import { createSkyDexiaMemory } from '../src/index.mjs';

const memory = createSkyDexiaMemory({
  mode: 'platform-embedded',
  projectId: 'skyehands',
  actorId: 'skydexia',
  storage: { kind: 'local-jsonl', rootDir: './.skydexia-memory' }
});

await memory.init();
await memory.remember({ type: 'project-rule', title: 'Preserve polish', tags: ['ui','rule'], text: 'Do not downgrade branding, CSS, working routes, or existing product identity.' });
const result = await memory.recall({ query: 'polish branding css routes', limit: 5 });
console.log(result.contextText);
