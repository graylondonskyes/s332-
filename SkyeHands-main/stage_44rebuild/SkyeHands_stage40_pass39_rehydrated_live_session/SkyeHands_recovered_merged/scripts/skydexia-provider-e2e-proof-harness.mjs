#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outPath = path.join(root, 'skydexia', 'proofs', 'provider-e2e-proof-harness.json');
const env = { ...process.env, OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'harness-provider-key' };

const pipeline = [
  { name: 'provider-contract', cmd: ['node', './scripts/skydexia-provider-var-contract.mjs'] },
  { name: 'provider-test-executor', cmd: ['node', './scripts/skydexia-provider-test-executor.mjs'] },
  { name: 'required-vars-e2e', cmd: ['node', './scripts/skydexia-e2e-required-vars-proof.mjs'] },
  { name: 'artifact-capture', cmd: ['node', './scripts/skydexia-proof-artifact-capture.mjs'] },
  { name: 'diagnostics', cmd: ['node', './scripts/skydexia-proof-diagnostics.mjs'] }
];

const steps = pipeline.map((step) => {
  const run = spawnSync(step.cmd[0], step.cmd.slice(1), { cwd: root, encoding: 'utf8', env });
  return { step: step.name, exit: run.status, ok: run.status === 0 };
});

const pass = steps.every((s) => s.ok);
const report = { version: 1, executedAt: new Date().toISOString(), steps, status: pass ? 'PASS' : 'FAIL' };
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outPath), status: report.status, steps: steps.length }, null, 2));
if (!pass) process.exit(1);
