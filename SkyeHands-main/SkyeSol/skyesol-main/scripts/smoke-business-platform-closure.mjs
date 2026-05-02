#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const platformRoot = path.join(root, 'Platforms-Apps-Infrastructure');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skye-business-platform-closure-'));

process.env.STORE_DATA_DIR = path.join(tmp, 'maggies');
process.env.MEDIA_CENTER_DATA_DIR = path.join(tmp, 'media');
process.env.LEAD_VAULT_DATA_DIR = path.join(tmp, 'lead-vault');
process.env.MUSIC_NEXUS_DATA_DIR = path.join(tmp, 'music-nexus');
process.env.SKYGATE_ISSUER = 'https://skygatefs13.local';

const pair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
process.env.SKYGATE_PUBLIC_KEY_PEM = pair.publicKey;

const { issueTestSkyGateToken } = require(path.join(platformRoot, 'MaggiesStore/netlify/functions/_lib/skygate-auth.js'));
const token = issueTestSkyGateToken({
  sub: 'closure-operator',
  email: 'operator@skye.local',
  role: 'admin',
  scope: 'openid profile gateway.invoke admin.write',
}, pair.privateKey);

const storeProducts = require(path.join(platformRoot, 'MaggiesStore/netlify/functions/store-products.js')).handler;
const storeOrders = require(path.join(platformRoot, 'MaggiesStore/netlify/functions/store-orders.js')).handler;
const mediaAssets = require(path.join(platformRoot, 'SkyeMediaCenter/netlify/functions/media-assets.js')).handler;
const mediaStats = require(path.join(platformRoot, 'SkyeMediaCenter/netlify/functions/media-stats.js')).handler;
const leadVaultLeads = require(path.join(platformRoot, 'SkyeLeadVault/netlify/functions/leads.js')).handler;
const leadVaultAnalytics = require(path.join(platformRoot, 'SkyeLeadVault/netlify/functions/lead-analytics.js')).handler;
const musicArtists = require(path.join(platformRoot, 'SkyeMusicNexus/netlify/functions/music-artists.js')).handler;
const musicReleases = require(path.join(platformRoot, 'SkyeMusicNexus/netlify/functions/music-releases.js')).handler;
const musicPayments = require(path.join(platformRoot, 'SkyeMusicNexus/netlify/functions/music-payments.js')).handler;
const musicAnalytics = require(path.join(platformRoot, 'SkyeMusicNexus/netlify/functions/music-analytics.js')).handler;

function event(method, body, bearerToken = '', query = {}) {
  const headers = { 'content-type': 'application/json' };
  if (bearerToken) headers.authorization = `Bearer ${bearerToken}`;
  return {
    httpMethod: method,
    headers,
    queryStringParameters: query,
    body: body == null ? '' : JSON.stringify(body),
  };
}

function parsed(response) {
  try { return JSON.parse(response.body || '{}'); } catch { return {}; }
}

const results = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    const ok = detail === true || Boolean(detail && detail.ok);
    results.push({ name, ok, detail: detail === true ? {} : detail });
  } catch (error) {
    results.push({ name, ok: false, error: error && error.stack ? error.stack : String(error) });
  }
}

await check('Maggies denies unauthenticated product writes', async () => {
  const res = await storeProducts(event('POST', { name: 'Closure Tee', sku: 'CT-1', price: 42 }));
  return { ok: res.statusCode === 401, statusCode: res.statusCode, body: parsed(res) };
});

await check('Maggies accepts SkyGate product writes', async () => {
  const res = await storeProducts(event('POST', { name: 'Closure Tee', sku: 'CT-1', price: 42, inventory_qty: 13 }, token));
  const body = parsed(res);
  return { ok: res.statusCode === 201 && body.ok === true && body.product && body.product.sku === 'CT-1', statusCode: res.statusCode, body };
});

await check('Maggies orders are SkyGate locked', async () => {
  const denied = await storeOrders(event('GET', null));
  const allowed = await storeOrders(event('GET', null, token));
  return { ok: denied.statusCode === 401 && allowed.statusCode === 200, denied: denied.statusCode, allowed: allowed.statusCode };
});

await check('Media Center denies unauthenticated uploads', async () => {
  const res = await mediaAssets(event('POST', { title: 'Deck', type: 'document', filename: 'deck.txt', content_base64: Buffer.from('proof').toString('base64') }));
  return { ok: res.statusCode === 401, statusCode: res.statusCode, body: parsed(res) };
});

await check('Media Center accepts SkyGate uploads and locks stats', async () => {
  const upload = await mediaAssets(event('POST', { title: 'Deck', type: 'document', filename: 'deck.txt', content_base64: Buffer.from('proof').toString('base64'), tags: ['investor'] }, token));
  const deniedStats = await mediaStats(event('GET', null));
  const allowedStats = await mediaStats(event('GET', null, token));
  const stats = parsed(allowedStats);
  return {
    ok: upload.statusCode === 201 && deniedStats.statusCode === 401 && allowedStats.statusCode === 200 && stats.totalAssets === 1,
    upload: upload.statusCode,
    deniedStats: deniedStats.statusCode,
    allowedStats: allowedStats.statusCode,
    stats,
  };
});

await check('Lead Vault accepts SkyGate lead workflow and locks analytics', async () => {
  const deniedCreate = await leadVaultLeads(event('POST', { action: 'create', name: 'Lead', email: 'lead@skye.local' }));
  const create = await leadVaultLeads(event('POST', { action: 'create', name: 'Lead', email: 'lead@skye.local', source: 'referral' }, token));
  const lead = parsed(create).lead;
  const stage = await leadVaultLeads(event('POST', { action: 'stage', id: lead && lead.id, stage: 'qualified' }, token));
  const deniedAnalytics = await leadVaultAnalytics(event('GET', null));
  const allowedAnalytics = await leadVaultAnalytics(event('GET', null, token));
  const analytics = parsed(allowedAnalytics);
  return {
    ok: deniedCreate.statusCode === 401 && create.statusCode === 201 && stage.statusCode === 200 && deniedAnalytics.statusCode === 401 && allowedAnalytics.statusCode === 200 && analytics.totalLeads >= 1,
    deniedCreate: deniedCreate.statusCode,
    create: create.statusCode,
    stage: stage.statusCode,
    deniedAnalytics: deniedAnalytics.statusCode,
    allowedAnalytics: allowedAnalytics.statusCode,
    analytics,
  };
});

await check('Music Nexus accepts SkyGate artist/release/payment workflow and locks ledgers', async () => {
  const deniedArtist = await musicArtists(event('POST', { action: 'register', name: 'Artist', email: 'artist@skye.local' }));
  const artistRes = await musicArtists(event('POST', { action: 'register', name: 'Artist', email: 'artist@skye.local', genre: ['hip-hop'] }, token));
  const artist = parsed(artistRes).artist;
  const approve = await musicArtists(event('POST', { action: 'approve', id: artist && artist.id }, token));
  const releaseRes = await musicReleases(event('POST', { action: 'submit', artistId: artist && artist.id, title: 'Closure EP', type: 'ep', tracks: [{ title: 'One', duration: 120 }] }, token));
  const release = parsed(releaseRes).release;
  const review = await musicReleases(event('POST', { action: 'review', id: release && release.id, decision: 'approve', notes: 'closure smoke' }, token));
  const publish = await musicReleases(event('POST', { action: 'publish', id: release && release.id }, token));
  const credit = await musicPayments(event('POST', { action: 'credit', artistId: artist && artist.id, amount: 10, reason: 'closure smoke', referenceId: release && release.id }, token));
  const deniedLedger = await musicPayments(event('GET', null, '', { action: 'ledger', artistId: artist && artist.id }));
  const allowedStats = await musicAnalytics(event('GET', null, token));
  return {
    ok: deniedArtist.statusCode === 401 && artistRes.statusCode === 201 && approve.statusCode === 200 && releaseRes.statusCode === 201 && review.statusCode === 200 && publish.statusCode === 200 && credit.statusCode === 201 && deniedLedger.statusCode === 401 && allowedStats.statusCode === 200,
    deniedArtist: deniedArtist.statusCode,
    artist: artistRes.statusCode,
    approve: approve.statusCode,
    release: releaseRes.statusCode,
    review: review.statusCode,
    publish: publish.statusCode,
    credit: credit.statusCode,
    deniedLedger: deniedLedger.statusCode,
    analytics: allowedStats.statusCode,
  };
});

const failed = results.filter((item) => !item.ok);
const out = {
  ok: failed.length === 0,
  generatedAt: new Date().toISOString(),
  proof: 'business-platform-closure',
  tmp,
  passed: results.length - failed.length,
  total: results.length,
  results,
};

const proofDir = path.join(root, 'docs/proof');
fs.mkdirSync(proofDir, { recursive: true });
const outFile = path.join(proofDir, 'BUSINESS_PLATFORM_CLOSURE.json');
fs.writeFileSync(outFile, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: out.ok, passed: out.passed, total: out.total, outFile }, null, 2));
if (!out.ok) {
  console.error(JSON.stringify(failed, null, 2));
  process.exit(1);
}
