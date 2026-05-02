import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const files = [
  'src/ui/app.ts',
  'scripts/smoke-api.mjs',
  'scripts/smoke-replay.mjs',
  'scripts/smoke-publish.mjs',
  'scripts/smoke-agency.mjs',
  'scripts/smoke-backlinks.mjs',
  'scripts/smoke-bundles.mjs',
  'scripts/smoke-reporting.mjs',
  'scripts/smoke-readiness.mjs',
  'scripts/smoke-strategy.mjs',
  'scripts/smoke-release.mjs'
];

const banned = [
  'demo-org',
  'example.com',
  'cdn.example',
  'operator@example',
  'partner@example',
  'ops@example',
  'client@example',
  'mockFetch'
];

const hits = [];
for (const rel of files) {
  const text = readFileSync(join(process.cwd(), rel), 'utf8');
  for (const token of banned) {
    if (text.includes(token)) hits.push({ file: rel, token });
  }
}

assert.equal(hits.length, 0, `demo residue detected: ${JSON.stringify(hits)}`);
console.log(JSON.stringify({ ok: true, checks: ['no demo residue in shipped UI defaults', 'no example.com scaffolding in core smoke scripts', 'no mockFetch residue in core smoke scripts'] }, null, 2));
