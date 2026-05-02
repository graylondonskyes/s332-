#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const handlerPath = path.join(root, 'platform', 'user-platforms', 'skye-account-executive-commandhub-s0l26-0s', 'source', 'AE-Central-Command-Pack-CredentialHub-Launcher', 'netlify', 'functions', 'ae-graychunks-control.js');
const { handler } = require(handlerPath);

process.env.GRAYCHUNKS_CONTROL_TOKEN = 'smoke-token';
process.env.GRAYCHUNKS_ALERT_DRY_RUN = '1';

const getRes = await handler({ httpMethod: 'GET', headers: {} });
const scanRes = await handler({ httpMethod: 'POST', headers: { 'x-graychunks-token': 'smoke-token' }, body: JSON.stringify({ action: 'scan' }) });
const queueRes = await handler({ httpMethod: 'POST', headers: { 'x-graychunks-token': 'smoke-token' }, body: JSON.stringify({ action: 'queue' }) });
const alertRes = await handler({ httpMethod: 'POST', headers: { 'x-graychunks-token': 'smoke-token' }, body: JSON.stringify({ action: 'alert', dryRun: true }) });
const progressRes = await handler({ httpMethod: 'POST', headers: { 'x-graychunks-token': 'smoke-token' }, body: JSON.stringify({ action: 'progress' }) });
const invalidTargetRes = await handler({ httpMethod: 'POST', headers: { 'x-graychunks-token': 'smoke-token' }, body: JSON.stringify({ action: 'scan', target: '../../' }) });

const getBody = JSON.parse(getRes.body || '{}');
const scanBody = JSON.parse(scanRes.body || '{}');
const queueBody = JSON.parse(queueRes.body || '{}');
const alertBody = JSON.parse(alertRes.body || '{}');
const progressBody = JSON.parse(progressRes.body || '{}');
const invalidTargetBody = JSON.parse(invalidTargetRes.body || '{}');

const pass = getRes.statusCode === 200 && scanRes.statusCode === 200 && queueRes.statusCode === 200 && alertRes.statusCode === 200 && progressRes.statusCode === 200 && invalidTargetRes.statusCode === 400
  && Boolean(scanBody.findings)
  && Boolean(queueBody.queue)
  && Boolean(alertBody.dispatch)
  && Boolean(progressBody.progress)
  && invalidTargetBody.error === 'invalid_target';

const artifact = path.join(root, 'SMOKE_P086_GRAYCHUNKS_AE_INTEGRATION.md');
fs.writeFileSync(artifact, [
  '# P086 Smoke Proof — GrayChunks AE Integration',
  '',
  `Status: ${pass ? 'PASS' : 'FAIL'}`,
  `GET status: ${getRes.statusCode}`,
  `SCAN status: ${scanRes.statusCode}`,
  `QUEUE status: ${queueRes.statusCode}`,
  `ALERT status: ${alertRes.statusCode}`,
  `PROGRESS status: ${progressRes.statusCode}`,
  `INVALID TARGET status: ${invalidTargetRes.statusCode}`,
  `Findings present: ${Boolean(scanBody.findings)}`,
  `Queue present: ${Boolean(queueBody.queue)}`,
  `Dispatch present: ${Boolean(alertBody.dispatch)}`,
  `Progress present: ${Boolean(progressBody.progress)}`,
  `Invalid target blocked: ${invalidTargetBody.error === 'invalid_target'}`
].join('\n') + '\n', 'utf8');

console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), getHasFindings: Boolean(getBody.findings) }, null, 2));
if (!pass) process.exit(1);
