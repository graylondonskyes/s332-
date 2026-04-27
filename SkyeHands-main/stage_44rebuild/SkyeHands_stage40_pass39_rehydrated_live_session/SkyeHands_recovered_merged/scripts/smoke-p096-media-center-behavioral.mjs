#!/usr/bin/env node
/**
 * P096 — Media Center — BEHAVIORAL SMOKE
 * Tests upload → publish → search → stats full flow
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fnDir = path.join(root, 'platform', 'user-platforms', 'skye-media-center', 'netlify', 'functions');
const artifact = path.join(root, 'SMOKE_P096_MEDIA_CENTER.md');

const results = [];
let allPass = true;
function assert(label, condition, detail = '') {
  const ok = Boolean(condition);
  results.push({ label, ok, detail });
  if (!ok) allPass = false;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
}

const testDir = path.join(os.tmpdir(), `media-center-smoke-${crypto.randomBytes(4).toString('hex')}`);
process.env.MEDIA_CENTER_DATA_DIR = testDir;

const assetsHandler = require(path.join(fnDir, 'media-assets.js')).handler;
const publishHandler = require(path.join(fnDir, 'media-publish.js')).handler;
const searchHandler = require(path.join(fnDir, 'media-search.js')).handler;
const statsHandler = require(path.join(fnDir, 'media-stats.js')).handler;

function makeEvent(method, query = {}, body = null) {
  return { httpMethod: method, queryStringParameters: query, body: body ? JSON.stringify(body) : null };
}

const fakeImage = Buffer.from('fake-png-data-for-smoke-test').toString('base64');

// ── 1. Upload asset ───────────────────────────────────────────────────────
const uploadRes = await assetsHandler(makeEvent('POST', {}, {
  action: 'upload', title: 'Smoke Banner Image', type: 'image',
  filename: 'smoke-banner.png', content_base64: fakeImage,
  tags: ['banner', 'smoke'], description: 'Behavioral smoke test asset',
}));
const uploadBody = JSON.parse(uploadRes.body);
assert('upload returns 201', uploadRes.statusCode === 201);
assert('asset has id', typeof uploadBody.asset?.id === 'string');
assert('asset type=image', uploadBody.asset?.type === 'image');
assert('file actually written', fs.existsSync(path.join(testDir, uploadBody.asset?.filePath || '')));
const assetId = uploadBody.asset?.id;

// ── 2. List assets ────────────────────────────────────────────────────────
const listRes = await assetsHandler(makeEvent('GET', { action: 'list' }));
const listBody = JSON.parse(listRes.body);
assert('list returns 200', listRes.statusCode === 200);
assert('list includes uploaded asset', listBody.assets?.some(a => a.id === assetId));

// ── 3. Get single asset ───────────────────────────────────────────────────
const getRes = await assetsHandler(makeEvent('GET', { action: 'get', id: assetId }));
const getBody = JSON.parse(getRes.body);
assert('get asset returns 200', getRes.statusCode === 200);
assert('get asset returns correct title', getBody.asset?.title === 'Smoke Banner Image');

// ── 4. Update asset metadata ──────────────────────────────────────────────
const updateRes = await assetsHandler(makeEvent('PUT', {}, { action: 'update', id: assetId, description: 'Updated smoke description' }));
const updateBody = JSON.parse(updateRes.body);
assert('update asset returns 200', updateRes.statusCode === 200);
assert('description updated', updateBody.asset?.description === 'Updated smoke description');

// ── 5. Search ─────────────────────────────────────────────────────────────
const searchRes = await searchHandler(makeEvent('GET', { q: 'banner smoke' }));
const searchBody = JSON.parse(searchRes.body);
assert('search returns 200', searchRes.statusCode === 200);
assert('search finds uploaded asset', searchBody.results?.some(r => r.asset?.id === assetId));
assert('search results have score', searchBody.results?.every(r => typeof r.score === 'number'));

// ── 6. Publish now ────────────────────────────────────────────────────────
const publishRes = await publishHandler(makeEvent('POST', {}, { assetId, publishTarget: 'web' }));
const publishBody = JSON.parse(publishRes.body);
assert('publish returns 200', publishRes.statusCode === 200);
assert('asset published', publishBody.asset?.status === 'published');
assert('publishedAt set', typeof publishBody.asset?.publishedAt === 'string');

// ── 7. Stats ──────────────────────────────────────────────────────────────
const statsRes = await statsHandler(makeEvent('GET'));
const statsBody = JSON.parse(statsRes.body);
assert('stats returns 200', statsRes.statusCode === 200);
assert('stats totalAssets >= 1', statsBody.totalAssets >= 1);
assert('stats byType has image', typeof statsBody.byType?.image === 'number');
assert('stats recentUploads array', Array.isArray(statsBody.recentUploads));

// ── 8. Soft-delete ────────────────────────────────────────────────────────
const deleteRes = await assetsHandler(makeEvent('DELETE', { id: assetId }));
const deleteBody = JSON.parse(deleteRes.body);
assert('delete returns 200', deleteRes.statusCode === 200);
assert('asset archived not deleted', deleteBody.asset?.status === 'archived');

// ── Cleanup ───────────────────────────────────────────────────────────────
fs.rmSync(testDir, { recursive: true, force: true });

const passed = results.filter(r => r.ok).length;
const md = [
  '# P096 Smoke Proof — Media Center Behavioral', '',
  `Generated: ${new Date().toISOString()}`,
  `Result: **${allPass ? 'PASS' : 'FAIL'}** | ${passed}/${results.length} assertions (upload ok, file path verified, search result shape, publish workflow)`,
  '', '## Assertions',
  ...results.map(r => `- ${r.ok ? '✅' : '❌'} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`),
  '', '## Coverage',
  '- ✅ Upload with real file write', '- ✅ Asset list/get', '- ✅ Metadata update',
  '- ✅ Full-text search with scoring', '- ✅ Publish workflow', '- ✅ Stats aggregation', '- ✅ Soft-delete (archived)',
].join('\n');
fs.writeFileSync(artifact, md);
console.log(`\n${allPass ? 'PASS' : 'FAIL'} — ${passed}/${results.length} assertions`);
if (!allPass) process.exit(1);
