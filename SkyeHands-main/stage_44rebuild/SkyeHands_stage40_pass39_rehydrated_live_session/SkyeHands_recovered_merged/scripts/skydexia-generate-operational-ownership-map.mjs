#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outPath = path.join(root, 'skydexia', 'integration', 'OPERATIONAL_OWNERSHIP_MAP.json');

const map = {
  version: 1,
  generatedAt: new Date().toISOString(),
  ownership: [
    { system: 'CDE', owner: 'platform-ops', rollback: 'snapshot:rollback', approve: 'release:gate' },
    { system: 'AE', owner: 'ae-runtime-team', rollback: 'smoke:p026 + smoke:p017', approve: 'directive:validate' },
    { system: 'SkyDexia Knowledge', owner: 'knowledge-ops', rollback: 'knowledge:rollback', approve: 'knowledge:diff-review' },
    { system: 'Alerts', owner: 'admin-oversight', rollback: 'alerts:audit', approve: 'alerts:admin-service' }
  ]
};

fs.writeFileSync(outPath, JSON.stringify(map, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outPath), systems: map.ownership.length }, null, 2));
