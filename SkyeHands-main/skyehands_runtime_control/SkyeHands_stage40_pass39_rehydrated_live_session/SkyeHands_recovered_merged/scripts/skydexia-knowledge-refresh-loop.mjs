#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const updatesDir = path.join(root, 'skydexia', 'knowledge-updates');
const batchesDir = path.join(updatesDir, 'batches');
const policyPath = path.join(updatesDir, 'source-trust-policy.json');
const schedulePath = path.join(updatesDir, 'schedule.json');
const latestBatchPath = path.join(updatesDir, 'latest-batch.json');

if (!fs.existsSync(policyPath)) {
  console.error('Missing source trust policy. Run skydexia-knowledge-source-trust.mjs first.');
  process.exit(1);
}

const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
fs.mkdirSync(batchesDir, { recursive: true });

const intervalMinutes = Number(process.env.SKYDEXIA_REFRESH_INTERVAL_MINUTES || 360);
const now = new Date();
const nextRun = new Date(now.getTime() + intervalMinutes * 60 * 1000);
const schedule = {
  version: 1,
  updatedAt: now.toISOString(),
  cadenceMinutes: intervalMinutes,
  nextRunAt: nextRun.toISOString(),
  enabled: true,
  sourceCount: (policy.allowlist || []).length
};
fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2) + '\n', 'utf8');

async function readSource(uri) {
  if (uri.startsWith('file://')) {
    const filePath = uri.replace('file://', '');
    const content = fs.readFileSync(filePath, 'utf8');
    return { content, bytes: Buffer.byteLength(content), sourceType: 'file' };
  }
  if (uri.startsWith('https://')) {
    const res = await fetch(uri, { headers: { 'user-agent': 'skydexia-knowledge-refresh/1.0' } });
    const content = await res.text();
    return { content, bytes: Buffer.byteLength(content), sourceType: 'https', status: res.status };
  }
  throw new Error(`Unsupported source URI: ${uri}`);
}

const updates = [];
for (const source of policy.allowlist || []) {
  try {
    const payload = await readSource(source.uri);
    const clipped = payload.content.slice(0, source.maxPayloadBytes || payload.bytes);
    const sha256 = crypto.createHash('sha256').update(clipped).digest('hex');
    updates.push({
      sourceId: source.sourceId,
      uri: source.uri,
      trustTier: source.trustTier,
      bytes: Buffer.byteLength(clipped),
      sha256,
      status: 'APPLIED',
      sourceType: payload.sourceType,
      httpStatus: payload.status || null,
      preview: clipped.slice(0, 120)
    });
  } catch (error) {
    updates.push({ sourceId: source.sourceId, uri: source.uri, status: 'FAILED', reason: String(error.message || error) });
  }
}

const batch = {
  version: 1,
  ranAt: new Date().toISOString(),
  totalSources: updates.length,
  applied: updates.filter((u) => u.status === 'APPLIED').length,
  failed: updates.filter((u) => u.status !== 'APPLIED').length,
  updates
};

const batchFile = path.join(batchesDir, `${Date.now()}-knowledge-refresh.json`);
fs.writeFileSync(batchFile, JSON.stringify(batch, null, 2) + '\n', 'utf8');
fs.writeFileSync(latestBatchPath, JSON.stringify({ latestBatch: path.relative(root, batchFile), ...batch }, null, 2) + '\n', 'utf8');

console.log(JSON.stringify({
  schedule: path.relative(root, schedulePath),
  latestBatch: path.relative(root, latestBatchPath),
  applied: batch.applied,
  failed: batch.failed
}, null, 2));
if (batch.failed) process.exit(1);
