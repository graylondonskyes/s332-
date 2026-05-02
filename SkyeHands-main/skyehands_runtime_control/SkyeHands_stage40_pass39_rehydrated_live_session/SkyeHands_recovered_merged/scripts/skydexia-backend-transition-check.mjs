#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const latestBatchPath = path.join(root, 'skydexia', 'knowledge-updates', 'latest-batch.json');
const rollbackStatePath = path.join(root, 'skydexia', 'knowledge-updates', 'rollback-state.json');
const outPath = path.join(root, 'skydexia', 'proofs', 'backend-transition-check.json');

const before = fs.existsSync(rollbackStatePath) ? fs.readFileSync(rollbackStatePath, 'utf8') : '';
const rollbackRun = spawnSync(process.execPath, [path.join(root, 'scripts', 'skydexia-knowledge-rollback.mjs')], { cwd: root, encoding: 'utf8' });
const after = fs.existsSync(rollbackStatePath) ? fs.readFileSync(rollbackStatePath, 'utf8') : '';

const latest = JSON.parse(fs.readFileSync(latestBatchPath, 'utf8'));
const rollback = JSON.parse(after || '{}');
const transitioned = before !== after && rollback.restoredStatus === 'ROLLED_BACK';

const report = {
  version: 1,
  checkedAt: new Date().toISOString(),
  latestBatch: latest.latestBatch,
  rollbackRunExit: rollbackRun.status,
  transitioned,
  persistedOutputs: {
    latestBatchExists: fs.existsSync(latestBatchPath),
    rollbackStateExists: fs.existsSync(rollbackStatePath)
  },
  status: rollbackRun.status === 0 && transitioned ? 'PASS' : 'FAIL'
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outPath), status: report.status }, null, 2));
if (report.status !== 'PASS') process.exit(1);
