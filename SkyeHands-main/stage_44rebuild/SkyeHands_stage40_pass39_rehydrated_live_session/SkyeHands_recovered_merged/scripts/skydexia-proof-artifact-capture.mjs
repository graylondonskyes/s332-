#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const proofsDir = path.join(root, 'skydexia', 'proofs');
const artifactsDir = path.join(proofsDir, 'artifacts');
const outPath = path.join(artifactsDir, 'index.json');

const candidateFiles = [
  'provider-test-execution.json',
  'e2e-required-vars-proof.json',
  path.join('..', 'providers', 'provider-var-contract.json')
];

fs.mkdirSync(artifactsDir, { recursive: true });
const artifacts = [];
for (const file of candidateFiles) {
  const absolute = path.join(proofsDir, file);
  if (!fs.existsSync(absolute)) continue;
  const data = fs.readFileSync(absolute);
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  const logPath = path.join(artifactsDir, `${path.basename(file)}.log`);
  fs.writeFileSync(logPath, data.toString('utf8'), 'utf8');
  artifacts.push({
    source: path.relative(root, absolute),
    log: path.relative(root, logPath),
    bytes: data.length,
    sha256: hash
  });
}

const report = {
  version: 1,
  capturedAt: new Date().toISOString(),
  artifactsCaptured: artifacts.length,
  artifacts
};

fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outPath), artifactsCaptured: artifacts.length }, null, 2));
if (!artifacts.length) process.exit(1);
