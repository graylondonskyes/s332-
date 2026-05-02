#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outPath = path.join(root, 'SMOKE_P010_CDE_OPERATOR_BOOT.md');

const run = spawnSync(process.execPath, [path.join(root, 'skyequanta.mjs'), 'doctor', '--mode', 'deploy'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 10 * 1024 * 1024,
});

const output = `${run.stdout || ''}\n${run.stderr || ''}`;
const failMatches = [...output.matchAll(/^\[fail\]\s+(.+)$/gm)].map((m) => m[1]);
const passed = run.status === 0 && failMatches.length === 0;

const lines = [
  '# P010 Smoke Proof — CDE Operator Boot',
  '',
  `Generated: ${new Date().toISOString()}`,
  `Command: node ./skyequanta.mjs doctor --mode deploy`,
  `Exit Code: ${run.status}`,
  `Fail Count: ${failMatches.length}`,
  `Status: ${passed ? 'PASS' : 'FAIL'}`,
  '',
  '## Failure Lines',
  ...(failMatches.length ? failMatches.map((f) => `- ${f}`) : ['- none']),
  '',
];

fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(JSON.stringify({ passed, output: path.relative(root, outPath), failCount: failMatches.length }, null, 2));
if (!passed) process.exit(1);
