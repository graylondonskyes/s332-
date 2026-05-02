#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packRoot = path.resolve(__dirname, '..');

const candidates = [
  path.join(packRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
  path.resolve(packRoot, '../../../../../../../../SuperIDEv3.8/node_modules/typescript/bin/tsc'),
];

const compiler = candidates.find((candidate) => fs.existsSync(candidate));
if (!compiler) {
  console.error('TypeScript compiler not found. Run npm ci in this pack, or run inside the integrated AboveTheSkye workspace.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [compiler, '--noEmit'], {
  cwd: packRoot,
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
