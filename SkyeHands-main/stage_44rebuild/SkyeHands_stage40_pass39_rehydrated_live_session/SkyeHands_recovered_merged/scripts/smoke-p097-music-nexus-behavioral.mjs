#!/usr/bin/env node
/**
 * P097 — Music Nexus — BEHAVIORAL SMOKE
 * Tests artist onboarding → release workflow → payment ledger → payout
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fnDir = path.join(root, 'platform', 'user-platforms', 'skye-music-nexus', 'netlify', 'functions');
const artifact = path.join(root, 'SMOKE_P097_MUSIC_NEXUS.md');

const results = [];
let allPass = true;
function assert(label, condition, detail = '') {
  const ok = Boolean(condition);
  results.push({ label, ok, detail });
  if (!ok) allPass = false;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
}

const testDir = path.join(os.tmpdir(), `music-nexus-smoke-${crypto.randomBytes(4).toString('hex')}`);
process.env.MUSIC_NEXUS_DATA_DIR = testDir;

const artistsHandler = require(path.join(fnDir, 'music-artists.js')).handler;
const releasesHandler = require(path.join(fnDir, 'music-releases.js')).handler;
const paymentsHandler = require(path.join(fnDir, 'music-payments.js')).handler;
const analyticsHandler = require(path.join(fnDir, 'music-analytics.js')).handler;

function makeEvent(method, query = {}, body = null) {
  return { httpMethod: method, queryStringParameters: query, body: body ? JSON.stringify(body) : null };
}

// ── 1. Artist registration ────────────────────────────────────────────────
const registerRes = await artistsHandler(makeEvent('POST', {}, { action: 'register', name: 'Smoke Artist', email: 'smoke@nexus.test', genre: ['hip-hop', 'trap'], bio: 'Behavioral smoke test artist' }));
const registerBody = JSON.parse(registerRes.body);
assert('register artist returns 201', registerRes.statusCode === 201);
assert('artist has id', typeof registerBody.artist?.id === 'string');
assert('artist status pending_review', registerBody.artist?.status === 'pending_review');
const artistId = registerBody.artist?.id;

// ── 2. Approve artist ─────────────────────────────────────────────────────
const approveRes = await artistsHandler(makeEvent('POST', {}, { action: 'approve', id: artistId }));
const approveBody = JSON.parse(approveRes.body);
assert('approve artist returns 200', approveRes.statusCode === 200);
assert('artist status active', approveBody.artist?.status === 'active');

// ── 3. Submit release ─────────────────────────────────────────────────────
const releaseRes = await releasesHandler(makeEvent('POST', {}, {
  action: 'submit', artistId, title: 'Smoke EP', type: 'ep',
  tracks: [{ title: 'Track 1', duration: 180 }, { title: 'Track 2', duration: 210 }],
  distributionTargets: ['spotify', 'apple_music'],
}));
const releaseBody = JSON.parse(releaseRes.body);
assert('submit release returns 201', releaseRes.statusCode === 201);
assert('release has id', typeof releaseBody.release?.id === 'string');
assert('release status submitted', releaseBody.release?.status === 'submitted');
assert('release has 2 tracks', releaseBody.release?.tracks?.length === 2);
const releaseId = releaseBody.release?.id;

// ── 4. Review and approve release ─────────────────────────────────────────
const reviewRes = await releasesHandler(makeEvent('POST', {}, { action: 'review', id: releaseId, decision: 'approve', notes: 'Looks great' }));
const reviewBody = JSON.parse(reviewRes.body);
assert('review release returns 200', reviewRes.statusCode === 200);
assert('release status approved', reviewBody.release?.status === 'approved');

// ── 5. Publish release ────────────────────────────────────────────────────
const publishRes = await releasesHandler(makeEvent('POST', {}, { action: 'publish', id: releaseId }));
const publishBody = JSON.parse(publishRes.body);
assert('publish release returns 200', publishRes.statusCode === 200);
assert('release status live', publishBody.release?.status === 'live');
assert('release has publishedAt', typeof publishBody.release?.publishedAt === 'string');

// ── 6. Report streams ─────────────────────────────────────────────────────
const streamsRes = await releasesHandler(makeEvent('POST', {}, { action: 'report-streams', id: releaseId, streams: 1500, downloads: 200, saves: 80 }));
const streamsBody = JSON.parse(streamsRes.body);
assert('report streams returns 200', streamsRes.statusCode === 200);
assert('streams accumulated', streamsBody.release?.analytics?.streams === 1500);

// ── 7. Credit artist ──────────────────────────────────────────────────────
const creditRes = await paymentsHandler(makeEvent('POST', {}, { action: 'credit', artistId, amount: 75.50, reason: 'Streaming royalties Q1', referenceId: releaseId }));
const creditBody = JSON.parse(creditRes.body);
assert('credit artist returns 201', creditRes.statusCode === 201);
assert('ledger entry created', typeof creditBody.entry?.id === 'string');
assert('balance_after > 0', creditBody.entry?.balance_after > 0);

// ── 8. Payout ─────────────────────────────────────────────────────────────
const payoutRes = await paymentsHandler(makeEvent('POST', {}, { action: 'payout', artistId, amount: 50, payoutMethod: 'bank', payoutDetails: { accountNumber: '****1234' } }));
const payoutBody = JSON.parse(payoutRes.body);
assert('payout request returns 201', payoutRes.statusCode === 201);
assert('payout has id', typeof payoutBody.payout?.id === 'string');
assert('payout status pending', payoutBody.payout?.status === 'pending');
assert('balance decremented', payoutBody.balance < 75.50);
const payoutId = payoutBody.payout?.id;

// ── 9. Complete payout ────────────────────────────────────────────────────
const completeRes = await paymentsHandler(makeEvent('POST', {}, { action: 'complete-payout', payoutId }));
const completeBody = JSON.parse(completeRes.body);
assert('complete payout returns 200', completeRes.statusCode === 200);
assert('payout status completed', completeBody.payout?.status === 'completed');

// ── 10. Analytics ─────────────────────────────────────────────────────────
const analyticsRes = await analyticsHandler(makeEvent('GET'));
const analyticsBody = JSON.parse(analyticsRes.body);
assert('analytics returns 200', analyticsRes.statusCode === 200);
assert('analytics totalArtists >= 1', analyticsBody.totalArtists >= 1);
assert('analytics totalStreams > 0', analyticsBody.totalStreams > 0);
assert('analytics liveReleases >= 1', analyticsBody.liveReleases >= 1);

// ── Cleanup ───────────────────────────────────────────────────────────────
fs.rmSync(testDir, { recursive: true, force: true });

const passed = results.filter(r => r.ok).length;
const md = [
  '# P097 Smoke Proof — Music Nexus Behavioral', '',
  `Generated: ${new Date().toISOString()}`,
  `Result: **${allPass ? 'PASS' : 'FAIL'}** | ${passed}/${results.length} assertions`,
  '', '## Assertions',
  ...results.map(r => `- ${r.ok ? '✅' : '❌'} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`),
  '', '## Coverage',
  '- ✅ Artist registration + approval', '- ✅ Release submit → review → approve → publish',
  '- ✅ Stream reporting', '- ✅ Payment credit + ledger',
  '- ✅ Payout request + completion', '- ✅ Analytics aggregation',
].join('\n');
fs.writeFileSync(artifact, md);
console.log(`\n${allPass ? 'PASS' : 'FAIL'} — ${passed}/${results.length} assertions`);
if (!allPass) process.exit(1);
