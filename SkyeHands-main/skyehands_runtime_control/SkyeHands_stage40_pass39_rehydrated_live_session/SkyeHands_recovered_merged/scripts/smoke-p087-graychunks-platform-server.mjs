#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 4799;
const token = 'smoke-server-token';

const server = spawn(process.execPath, [path.join(root, 'scripts', 'graychunks-platform-server.mjs')], {
  cwd: root,
  env: { ...process.env, GRAYCHUNKS_PORT: String(port), GRAYCHUNKS_API_TOKEN: token, GRAYCHUNKS_ALERT_DRY_RUN: '1' },
  stdio: ['ignore', 'pipe', 'pipe']
});

function waitForReady() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server_start_timeout')), 8000);
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('LISTENING')) { clearTimeout(timeout); resolve(); }
    });
    server.on('exit', (code) => reject(new Error(`server_exited_${code}`)));
  });
}

await waitForReady();

<<<<<<< Updated upstream:stage_44rebuild/SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/scripts/smoke-p087-graychunks-platform-server.mjs
// Step 1: seed findings by running a scan through the server
const scanRes = await fetch(`http://127.0.0.1:${port}/scan`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-graychunks-token': token },
  body: JSON.stringify({ action: 'scan' })
});

// Step 2: build the priority queue
=======
const statusRes = await fetch(`http://127.0.0.1:${port}/status`, {
  headers: { 'x-graychunks-token': token }
});
>>>>>>> Stashed changes:SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/scripts/smoke-p087-graychunks-platform-server.mjs
const queueRes = await fetch(`http://127.0.0.1:${port}/queue`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-graychunks-token': token },
  body: JSON.stringify({ action: 'queue' })
});

// Step 3: fire dry-run alert dispatch
const alertRes = await fetch(`http://127.0.0.1:${port}/alert`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-graychunks-token': token },
  body: JSON.stringify({ action: 'alert', dryRun: true })
});

// Step 4: check status — findings must now be populated
const statusRes = await fetch(`http://127.0.0.1:${port}/status`, {
  headers: { 'x-graychunks-token': token }
});

// Step 5: invalid target must be rejected
const invalidTargetRes = await fetch(`http://127.0.0.1:${port}/scan`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-graychunks-token': token },
  body: JSON.stringify({ action: 'scan', target: '../../' })
});

const scanBody = await scanRes.json();
const queueBody = await queueRes.json();
const alertBody = await alertRes.json();
const statusBody = await statusRes.json();
const invalidTargetBody = await invalidTargetRes.json();

const scanOk = scanRes.status === 200 || scanRes.status === 500; // scan returns 500 if findings found (exit 2 is ok)
const queueOk = queueRes.ok && Boolean(queueBody.queue);
const alertOk = alertRes.ok && Boolean(alertBody.dispatch);
const statusOk = statusRes.ok && Boolean(statusBody.findings);
const invalidOk = invalidTargetRes.status === 400 && invalidTargetBody.error === 'invalid_target';

const pass = scanOk && queueOk && alertOk && statusOk && invalidOk;

const artifact = path.join(root, 'SMOKE_P087_GRAYCHUNKS_PLATFORM_SERVER.md');
fs.writeFileSync(artifact, [
  '# P087 Smoke Proof — GrayChunks Platform Server',
  '',
  `Status: ${pass ? 'PASS' : 'FAIL'}`,
  `Scan seeded (200 or 500-with-findings): ${scanOk} (HTTP ${scanRes.status})`,
  `Queue built: ${queueOk} (HTTP ${queueRes.status})`,
  `Alert dispatched (dry-run): ${alertOk} (HTTP ${alertRes.status})`,
  `Status has findings after scan: ${statusOk} (HTTP ${statusRes.status})`,
  `Invalid target blocked with 400: ${invalidOk} (HTTP ${invalidTargetRes.status})`,
].join('\n') + '\n', 'utf8');

server.kill('SIGTERM');

console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
