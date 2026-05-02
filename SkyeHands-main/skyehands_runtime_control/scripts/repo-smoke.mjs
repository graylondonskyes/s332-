#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.resolve(__dirname, '..');
const proofDir = path.join(runtimeRoot, '.skyequanta', 'proofs');
const outFile = path.join(proofDir, 'repo-smoke.json');

const smokeScripts = [
  'repo:doctor',
  'smoke:platform-bus-core',
  'smoke:platform-bus-bridge',
  'smoke:skyewebcreator',
  'smoke:platform-registry-sync',
  'typecheck:gateway-additive-packs',
  'smoke:gateway-additive-routes',
  'stub-check:abovetheskye',
  'smoke:abovetheskye-mesh',
  'smoke:company-flow',
  'smoke:creator-ide-mesh',
];

const results = [];
for (const scriptName of smokeScripts) {
  const run = spawnSync('npm', ['run', scriptName], {
    cwd: runtimeRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  results.push({
    scriptName,
    ok: run.status === 0,
    status: run.status,
    stdoutTail: run.stdout.trim().split(/\r?\n/).slice(-24),
    stderrTail: run.stderr.trim().split(/\r?\n/).filter(Boolean).slice(-24),
  });
  if (run.status !== 0) break;
}

const result = {
  generatedAt: new Date().toISOString(),
  smoke: 'repo-smoke',
  results,
  passed: results.length === smokeScripts.length && results.every((item) => item.ok),
};

fs.mkdirSync(proofDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ generatedAt: result.generatedAt, smoke: result.smoke, results: result.results.map((item) => ({ scriptName: item.scriptName, ok: item.ok, status: item.status })), passed: result.passed, proof: path.relative(runtimeRoot, outFile) }, null, 2));

if (!result.passed) process.exit(1);
