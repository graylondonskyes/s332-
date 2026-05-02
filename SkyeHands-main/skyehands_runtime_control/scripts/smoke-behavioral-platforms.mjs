/**
 * smoke-behavioral-platforms.mjs
 *
 * Behavioral smoke tests for 4 Netlify function backends.
 * Calls handlers directly in-process (no HTTP server).
 * Tests state transitions: create → read → update → delete.
 *
 * Exit 0 = all pass, Exit 1 = any failure.
 */

import { createRequire } from 'module';
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Isolated tmp dirs — each platform gets its own isolated temp dir so tests
// don't share state between runs.
// ---------------------------------------------------------------------------

const LEAD_VAULT_DIR   = mkdtempSync(join(tmpdir(), 'smoke-lead-vault-'));
const MEDIA_CENTER_DIR = mkdtempSync(join(tmpdir(), 'smoke-media-center-'));
const MUSIC_NEXUS_DIR  = mkdtempSync(join(tmpdir(), 'smoke-music-nexus-'));
const STORE_DATA_DIR   = mkdtempSync(join(tmpdir(), 'smoke-maggies-'));

// Set env vars BEFORE requiring the modules so the modules pick up the dirs.
process.env.LEAD_VAULT_DATA_DIR   = LEAD_VAULT_DIR;
process.env.MEDIA_CENTER_DATA_DIR = MEDIA_CENTER_DIR;
process.env.MUSIC_NEXUS_DATA_DIR  = MUSIC_NEXUS_DIR;
process.env.STORE_DATA_DIR        = STORE_DATA_DIR;

// ---------------------------------------------------------------------------
// Path constants
// ---------------------------------------------------------------------------

const BASE = new URL(
  '../../SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/platform/user-platforms',
  import.meta.url
).pathname;

const LEAD_FN_DIR   = join(BASE, 'skye-lead-vault/netlify/functions');
const MEDIA_FN_DIR  = join(BASE, 'skye-media-center/netlify/functions');
const MUSIC_FN_DIR  = join(BASE, 'skye-music-nexus/netlify/functions');
const STORE_FN_DIR  = join(BASE, 'ae-autonomous-store-system-maggies/netlify/functions');

// ---------------------------------------------------------------------------
// Load handlers
// ---------------------------------------------------------------------------

const leadsHandler        = require(join(LEAD_FN_DIR,  'leads.js')).handler;
const leadScoringHandler  = require(join(LEAD_FN_DIR,  'lead-scoring.js')).handler;
const leadAnalyticsHandler= require(join(LEAD_FN_DIR,  'lead-analytics.js')).handler;

const mediaAssetsHandler  = require(join(MEDIA_FN_DIR, 'media-assets.js')).handler;
const mediaSearchHandler  = require(join(MEDIA_FN_DIR, 'media-search.js')).handler;
const mediaStatsHandler   = require(join(MEDIA_FN_DIR, 'media-stats.js')).handler;
const mediaPublishHandler = require(join(MEDIA_FN_DIR, 'media-publish.js')).handler;

const musicArtistsHandler  = require(join(MUSIC_FN_DIR, 'music-artists.js')).handler;
const musicReleasesHandler = require(join(MUSIC_FN_DIR, 'music-releases.js')).handler;
const musicPaymentsHandler = require(join(MUSIC_FN_DIR, 'music-payments.js')).handler;
const musicAnalyticsHandler= require(join(MUSIC_FN_DIR, 'music-analytics.js')).handler;

const storeProductsHandler = require(join(STORE_FN_DIR, 'store-products.js')).handler;
const storeCartHandler     = require(join(STORE_FN_DIR, 'store-cart.js')).handler;
const storeCheckoutHandler = require(join(STORE_FN_DIR, 'store-checkout.js')).handler;
const storeOrdersHandler   = require(join(STORE_FN_DIR, 'store-orders.js')).handler;

// ---------------------------------------------------------------------------
// Test runner helpers
// ---------------------------------------------------------------------------

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function makeEvent(method, body = null, qs = {}) {
  return {
    httpMethod: method,
    body: body ? JSON.stringify(body) : null,
    queryStringParameters: qs,
  };
}

function parseResponse(res) {
  try {
    return JSON.parse(res.body);
  } catch {
    return {};
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passedTests++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log(`        Reason: ${err.message}`);
    failedTests++;
    failures.push({ name, reason: err.message });
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

// ---------------------------------------------------------------------------
// LEAD VAULT tests
// ---------------------------------------------------------------------------

section('Lead Vault');

let createdLeadId;

await test('LV-01: create lead (POST action=create)', async () => {
  const res = await leadsHandler(makeEvent('POST', {
    action: 'create',
    name: 'Alice Smoke',
    email: 'alice@smoke.test',
    phone: '555-0100',
    company: 'SmokeInc',
    source: 'referral',
    notes: 'smoke test lead',
  }));
  assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.lead, 'Response missing .lead');
  assert(data.lead.id, 'Lead missing id');
  assert(data.lead.name === 'Alice Smoke', `Name mismatch: ${data.lead.name}`);
  assert(data.lead.email === 'alice@smoke.test', `Email mismatch`);
  assert(typeof data.lead.score === 'number', 'score should be a number');
  // verify file written to disk
  const file = join(LEAD_VAULT_DIR, 'leads', `${data.lead.id}.json`);
  assert(existsSync(file), `Lead file not found on disk: ${file}`);
  createdLeadId = data.lead.id;
});

await test('LV-02: read lead by id (GET action=get)', async () => {
  assert(createdLeadId, 'Prerequisite: createdLeadId not set');
  const res = await leadsHandler(makeEvent('GET', null, { action: 'get', id: createdLeadId }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.lead, 'Response missing .lead');
  assert(data.lead.id === createdLeadId, 'Lead id mismatch');
  assert(data.lead.name === 'Alice Smoke', 'Name mismatch');
});

await test('LV-03: list leads (GET action=list)', async () => {
  const res = await leadsHandler(makeEvent('GET', null, { action: 'list' }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(Array.isArray(data.leads), 'leads should be an array');
  assert(data.count >= 1, `Expected at least 1 lead, got ${data.count}`);
  const found = data.leads.find(l => l.id === createdLeadId);
  assert(found, 'Created lead not found in list');
});

await test('LV-04: update lead (PUT action=update)', async () => {
  assert(createdLeadId, 'Prerequisite: createdLeadId not set');
  const res = await leadsHandler(makeEvent('PUT', {
    action: 'update',
    id: createdLeadId,
    notes: 'updated in smoke test',
    stage: 'contacted',
  }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.lead.notes === 'updated in smoke test', 'notes not updated');
  assert(data.lead.stage === 'contacted', `Stage not updated: ${data.lead.stage}`);
  // verify disk state changed
  const file = join(LEAD_VAULT_DIR, 'leads', `${createdLeadId}.json`);
  const onDisk = JSON.parse(readFileSync(file, 'utf8'));
  assert(onDisk.stage === 'contacted', 'Disk state: stage not updated');
  assert(onDisk.notes === 'updated in smoke test', 'Disk state: notes not updated');
});

await test('LV-05: score lead (GET lead-scoring?leadId=)', async () => {
  assert(createdLeadId, 'Prerequisite: createdLeadId not set');
  const res = await leadScoringHandler(makeEvent('GET', null, { leadId: createdLeadId }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.leadId === createdLeadId, 'leadId mismatch in scoring response');
  assert(typeof data.finalScore === 'number', 'finalScore should be a number');
  assert(Array.isArray(data.breakdown), 'breakdown should be an array');
  assert(data.finalScore >= 0 && data.finalScore <= 100, `Score out of range: ${data.finalScore}`);
});

await test('LV-06: lead analytics (GET lead-analytics)', async () => {
  const res = await leadAnalyticsHandler(makeEvent('GET'));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(typeof data.totalLeads === 'number', 'totalLeads should be a number');
  assert(typeof data.byStage === 'object', 'byStage should be an object');
  assert(data.totalLeads >= 1, `Expected totalLeads >= 1, got ${data.totalLeads}`);
});

await test('LV-07: delete lead (DELETE ?id=)', async () => {
  assert(createdLeadId, 'Prerequisite: createdLeadId not set');
  const res = await leadsHandler(makeEvent('DELETE', null, { id: createdLeadId }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.deleted === true, 'deleted flag should be true');
  // verify file removed from disk
  const file = join(LEAD_VAULT_DIR, 'leads', `${createdLeadId}.json`);
  assert(!existsSync(file), 'Lead file still exists on disk after delete');
});

await test('LV-08: read deleted lead returns 404', async () => {
  const res = await leadsHandler(makeEvent('GET', null, { action: 'get', id: createdLeadId }));
  assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
});

// ---------------------------------------------------------------------------
// MEDIA CENTER tests
// ---------------------------------------------------------------------------

section('Media Center');

let createdAssetId;
const fakeFileB64 = Buffer.from('fake image content for smoke test').toString('base64');

await test('MC-01: upload asset (POST upload)', async () => {
  const res = await mediaAssetsHandler(makeEvent('POST', {
    title: 'Smoke Test Image',
    type: 'image',
    filename: 'smoke-test.png',
    content_base64: fakeFileB64,
    tags: ['smoke', 'test'],
    description: 'A fake image for smoke testing',
  }));
  assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.asset, 'Response missing .asset');
  assert(data.asset.id, 'Asset missing id');
  assert(data.asset.title === 'Smoke Test Image', 'Title mismatch');
  assert(data.asset.type === 'image', 'Type mismatch');
  assert(data.asset.fileSize > 0, 'fileSize should be > 0');
  // verify file written to disk
  const filePath = join(MEDIA_CENTER_DIR, data.asset.filePath);
  assert(existsSync(filePath), `Asset file not found on disk: ${filePath}`);
  createdAssetId = data.asset.id;
});

await test('MC-02: list assets (GET)', async () => {
  const res = await mediaAssetsHandler(makeEvent('GET', null, {}));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(Array.isArray(data.assets), 'assets should be an array');
  const found = data.assets.find(a => a.id === createdAssetId);
  assert(found, 'Uploaded asset not found in list');
});

await test('MC-03: get asset by id (GET action=get)', async () => {
  assert(createdAssetId, 'Prerequisite: createdAssetId not set');
  const res = await mediaAssetsHandler(makeEvent('GET', null, { action: 'get', id: createdAssetId }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.asset.id === createdAssetId, 'id mismatch');
});

await test('MC-04: search assets (GET media-search ?q=smoke)', async () => {
  const res = await mediaSearchHandler(makeEvent('GET', null, { q: 'smoke' }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(typeof data.total === 'number', 'total should be a number');
  assert(Array.isArray(data.results), 'results should be an array');
  assert(data.total >= 1, `Expected at least 1 search result, got ${data.total}`);
  const found = data.results.find(r => r.asset.id === createdAssetId);
  assert(found, 'Uploaded asset not found in search results');
});

await test('MC-05: get stats (GET media-stats)', async () => {
  const res = await mediaStatsHandler(makeEvent('GET'));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(typeof data.totalAssets === 'number', 'totalAssets should be a number');
  assert(data.totalAssets >= 1, `Expected totalAssets >= 1, got ${data.totalAssets}`);
  assert(typeof data.byType === 'object', 'byType should be an object');
  assert(data.byType.image >= 1, `Expected byType.image >= 1, got ${data.byType.image}`);
  assert(data.totalFileSize > 0, 'totalFileSize should be > 0');
});

await test('MC-06: update asset (PUT update)', async () => {
  assert(createdAssetId, 'Prerequisite: createdAssetId not set');
  const res = await mediaAssetsHandler(makeEvent('PUT', {
    id: createdAssetId,
    title: 'Updated Smoke Image',
    tags: ['smoke', 'test', 'updated'],
  }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.asset.title === 'Updated Smoke Image', `title not updated: ${data.asset.title}`);
  assert(data.asset.tags.includes('updated'), 'tags not updated');
  // verify in assets.json on disk
  const assetsFile = join(MEDIA_CENTER_DIR, 'assets.json');
  const onDisk = JSON.parse(readFileSync(assetsFile, 'utf8'));
  const diskAsset = onDisk.find(a => a.id === createdAssetId);
  assert(diskAsset, 'Asset not found in assets.json after update');
  assert(diskAsset.title === 'Updated Smoke Image', 'Disk: title not updated');
});

await test('MC-07: publish asset (POST media-publish)', async () => {
  assert(createdAssetId, 'Prerequisite: createdAssetId not set');
  const res = await mediaPublishHandler(makeEvent('POST', {
    assetId: createdAssetId,
    publishTarget: 'web',
  }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.entry, 'Response missing .entry');
  assert(data.entry.status === 'published', `Expected status=published, got ${data.entry.status}`);
  assert(data.asset.status === 'published', `Asset status should be published, got ${data.asset.status}`);
});

await test('MC-08: delete (archive) asset (DELETE)', async () => {
  assert(createdAssetId, 'Prerequisite: createdAssetId not set');
  const res = await mediaAssetsHandler(makeEvent('DELETE', null, { id: createdAssetId }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.id === createdAssetId, 'id mismatch in delete response');
  assert(data.asset.status === 'archived', `Expected status=archived, got ${data.asset.status}`);
  // verify archived on disk
  const assetsFile = join(MEDIA_CENTER_DIR, 'assets.json');
  const onDisk = JSON.parse(readFileSync(assetsFile, 'utf8'));
  const diskAsset = onDisk.find(a => a.id === createdAssetId);
  assert(diskAsset && diskAsset.status === 'archived', 'Disk: asset not archived');
});

await test('MC-09: archived asset not in list (GET excludes archived)', async () => {
  const res = await mediaAssetsHandler(makeEvent('GET', null, {}));
  const data = parseResponse(res);
  const found = data.assets.find(a => a.id === createdAssetId);
  assert(!found, 'Archived asset should not appear in default list');
});

// ---------------------------------------------------------------------------
// MUSIC NEXUS tests
// ---------------------------------------------------------------------------

section('Music Nexus');

let artistId;
let releaseId;
let payoutId;

await test('MN-01: register artist (POST action=register)', async () => {
  const res = await musicArtistsHandler(makeEvent('POST', {
    action: 'register',
    name: 'Smoke Artist',
    email: 'smoke-artist@nexus.test',
    phone: '555-0200',
    genre: ['hip-hop', 'r&b'],
    bio: 'A test artist for smoke testing',
  }));
  assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(data.artist, 'Response missing .artist');
  assert(data.artist.id, 'artist missing id');
  assert(data.artist.name === 'Smoke Artist', 'name mismatch');
  assert(data.artist.status === 'pending_review', `Expected pending_review, got ${data.artist.status}`);
  // verify artists.json on disk
  const file = join(MUSIC_NEXUS_DIR, 'artists.json');
  assert(existsSync(file), 'artists.json not created');
  const onDisk = JSON.parse(readFileSync(file, 'utf8'));
  assert(onDisk.some(a => a.id === data.artist.id), 'Artist not found in artists.json');
  artistId = data.artist.id;
});

await test('MN-02: duplicate registration returns 409', async () => {
  const res = await musicArtistsHandler(makeEvent('POST', {
    action: 'register',
    name: 'Smoke Artist Duplicate',
    email: 'smoke-artist@nexus.test',
  }));
  assert(res.statusCode === 409, `Expected 409 for duplicate email, got ${res.statusCode}`);
});

await test('MN-03: get artist profile (GET action=get)', async () => {
  assert(artistId, 'Prerequisite: artistId not set');
  const res = await musicArtistsHandler(makeEvent('GET', null, { action: 'get', id: artistId }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(data.artist.id === artistId, 'artist id mismatch');
  assert(Array.isArray(data.releases), 'releases should be an array');
});

await test('MN-04: approve artist (POST action=approve)', async () => {
  assert(artistId, 'Prerequisite: artistId not set');
  const res = await musicArtistsHandler(makeEvent('POST', { action: 'approve', id: artistId }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(data.artist.status === 'active', `Expected status=active, got ${data.artist.status}`);
  // verify disk
  const file = join(MUSIC_NEXUS_DIR, 'artists.json');
  const onDisk = JSON.parse(readFileSync(file, 'utf8'));
  const diskArtist = onDisk.find(a => a.id === artistId);
  assert(diskArtist && diskArtist.status === 'active', 'Disk: artist not marked active');
});

await test('MN-05: create release (POST action=submit)', async () => {
  assert(artistId, 'Prerequisite: artistId not set');
  const res = await musicReleasesHandler(makeEvent('POST', {
    action: 'submit',
    artistId,
    title: 'Smoke Single',
    type: 'single',
    tracks: [{ title: 'Track One', duration: 210 }],
    releaseDate: '2026-06-01',
    distributionTargets: ['spotify', 'apple_music'],
  }));
  assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(data.release, 'Response missing .release');
  assert(data.release.id, 'release missing id');
  assert(data.release.title === 'Smoke Single', 'title mismatch');
  assert(data.release.status === 'submitted', `Expected submitted, got ${data.release.status}`);
  // verify disk
  const file = join(MUSIC_NEXUS_DIR, 'releases.json');
  assert(existsSync(file), 'releases.json not created');
  const onDisk = JSON.parse(readFileSync(file, 'utf8'));
  assert(onDisk.some(r => r.id === data.release.id), 'Release not in releases.json');
  releaseId = data.release.id;
});

await test('MN-06: review release → approve', async () => {
  assert(releaseId, 'Prerequisite: releaseId not set');
  const res = await musicReleasesHandler(makeEvent('POST', {
    action: 'review',
    id: releaseId,
    decision: 'approve',
    notes: 'Approved by smoke test',
  }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(data.release.status === 'approved', `Expected approved, got ${data.release.status}`);
});

await test('MN-07: publish release', async () => {
  assert(releaseId, 'Prerequisite: releaseId not set');
  const res = await musicReleasesHandler(makeEvent('POST', {
    action: 'publish',
    id: releaseId,
  }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(data.release.status === 'live', `Expected live, got ${data.release.status}`);
  assert(data.release.publishedAt, 'publishedAt should be set');
});

await test('MN-08: credit artist (POST action=credit)', async () => {
  assert(artistId, 'Prerequisite: artistId not set');
  const res = await musicPaymentsHandler(makeEvent('POST', {
    action: 'credit',
    artistId,
    amount: 250.00,
    reason: 'Smoke test streaming royalty',
    referenceId: 'SMOKE-REF-001',
  }));
  assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(data.balance === 250.00, `Expected balance 250, got ${data.balance}`);
  assert(data.entry.type === 'credit', 'entry type should be credit');
  // verify ledger on disk
  const file = join(MUSIC_NEXUS_DIR, 'ledger.json');
  assert(existsSync(file), 'ledger.json not created');
  const ledger = JSON.parse(readFileSync(file, 'utf8'));
  assert(ledger.some(e => e.artistId === artistId && e.type === 'credit'), 'Credit entry not in ledger');
  // verify artist balance on disk
  const artistsFile = join(MUSIC_NEXUS_DIR, 'artists.json');
  const artists = JSON.parse(readFileSync(artistsFile, 'utf8'));
  const diskArtist = artists.find(a => a.id === artistId);
  assert(diskArtist && diskArtist.balance === 250.00, `Disk: artist balance should be 250, got ${diskArtist?.balance}`);
});

await test('MN-09: request payout (POST action=payout)', async () => {
  assert(artistId, 'Prerequisite: artistId not set');
  const res = await musicPaymentsHandler(makeEvent('POST', {
    action: 'payout',
    artistId,
    amount: 100.00,
    payoutMethod: 'paypal',
    payoutDetails: { email: 'smoke-artist@nexus.test' },
  }));
  assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(data.balance === 150.00, `Expected balance 150 after payout, got ${data.balance}`);
  assert(data.payout.status === 'pending', `Expected payout status=pending, got ${data.payout.status}`);
  payoutId = data.payout.id;
  // verify payouts.json on disk
  const file = join(MUSIC_NEXUS_DIR, 'payouts.json');
  const payouts = JSON.parse(readFileSync(file, 'utf8'));
  assert(payouts.some(p => p.id === payoutId), 'Payout not found in payouts.json');
});

await test('MN-10: get ledger (GET action=ledger)', async () => {
  assert(artistId, 'Prerequisite: artistId not set');
  const res = await musicPaymentsHandler(makeEvent('GET', null, { action: 'ledger', artistId }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(Array.isArray(data.ledger), 'ledger should be an array');
  assert(data.ledger.length >= 2, `Expected at least 2 ledger entries (credit+debit), got ${data.ledger.length}`);
  assert(data.balance === 150.00, `Expected balance 150, got ${data.balance}`);
});

await test('MN-11: get analytics (GET music-analytics)', async () => {
  const res = await musicAnalyticsHandler(makeEvent('GET'));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(data.totalArtists >= 1, `Expected totalArtists >= 1, got ${data.totalArtists}`);
  assert(data.totalReleases >= 1, `Expected totalReleases >= 1, got ${data.totalReleases}`);
  assert(data.liveReleases >= 1, `Expected liveReleases >= 1, got ${data.liveReleases}`);
  assert(data.pendingPayouts >= 1, `Expected pendingPayouts >= 1, got ${data.pendingPayouts}`);
  assert(Array.isArray(data.topArtists), 'topArtists should be an array');
  assert(Array.isArray(data.topReleases), 'topReleases should be an array');
});

// ---------------------------------------------------------------------------
// MAGGIES STORE tests
// ---------------------------------------------------------------------------

section("Maggie's Store");

let productId;
let orderId;
const SESSION_ID = 'smoke-session-001';

await test('MS-01: add product (POST store-products)', async () => {
  const res = await storeProductsHandler(makeEvent('POST', {
    name: 'Smoke Widget',
    sku: 'SMOKE-WIDGET-001',
    price: 29.99,
    cost: 10.00,
    category: 'widgets',
    description: 'A smoke test widget',
    inventory_qty: 50,
  }));
  assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(data.product, 'Response missing .product');
  assert(data.product.id, 'product missing id');
  assert(data.product.name === 'Smoke Widget', 'name mismatch');
  assert(data.product.price === 29.99, `price mismatch: ${data.product.price}`);
  assert(data.product.inventory_qty === 50, `inventory mismatch: ${data.product.inventory_qty}`);
  // verify on disk
  const file = join(STORE_DATA_DIR, '.store-data', 'products.json');
  assert(existsSync(file), 'products.json not created');
  const onDisk = JSON.parse(readFileSync(file, 'utf8'));
  assert(onDisk.some(p => p.id === data.product.id), 'Product not in products.json');
  productId = data.product.id;
});

await test('MS-02: duplicate SKU returns 409', async () => {
  const res = await storeProductsHandler(makeEvent('POST', {
    name: 'Duplicate Widget',
    sku: 'SMOKE-WIDGET-001',
    price: 9.99,
  }));
  assert(res.statusCode === 409, `Expected 409 for duplicate SKU, got ${res.statusCode}`);
});

await test('MS-03: list products (GET store-products)', async () => {
  const res = await storeProductsHandler(makeEvent('GET', null, {}));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(Array.isArray(data.products), 'products should be an array');
  assert(data.products.length >= 1, `Expected at least 1 product`);
  const found = data.products.find(p => p.id === productId);
  assert(found, 'Created product not found in list');
});

await test('MS-04: add to cart (POST store-cart)', async () => {
  assert(productId, 'Prerequisite: productId not set');
  const res = await storeCartHandler(makeEvent('POST', {
    sessionId: SESSION_ID,
    productId,
    qty: 2,
  }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(data.cart, 'Response missing .cart');
  assert(Array.isArray(data.cart.items), 'cart.items should be an array');
  assert(data.cart.items.length === 1, `Expected 1 cart item, got ${data.cart.items.length}`);
  assert(data.cart.items[0].qty === 2, `Expected qty 2, got ${data.cart.items[0].qty}`);
  assert(data.cart.total === 59.98, `Expected total 59.98, got ${data.cart.total}`);
  // verify cart file on disk
  const cartFile = join(STORE_DATA_DIR, '.store-data', 'carts', `${SESSION_ID}.json`);
  assert(existsSync(cartFile), 'Cart file not created on disk');
});

await test('MS-05: read cart (GET store-cart ?sessionId=)', async () => {
  const res = await storeCartHandler(makeEvent('GET', null, { sessionId: SESSION_ID }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(data.cart.sessionId === SESSION_ID, 'sessionId mismatch');
  assert(data.cart.items.length === 1, 'Expected 1 item in cart');
  assert(data.cart.total > 0, 'Cart total should be > 0');
});

await test('MS-06: checkout creates order (POST store-checkout)', async () => {
  const res = await storeCheckoutHandler(makeEvent('POST', {
    sessionId: SESSION_ID,
    customerEmail: 'smoke@maggies.test',
    shippingAddress: { line1: '123 Smoke St', city: 'TestCity', zip: '00000' },
  }));
  assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(data.orderId, 'Response missing orderId');
  assert(data.order, 'Response missing .order');
  assert(data.order.status === 'pending_payment', `Expected pending_payment, got ${data.order.status}`);
  assert(data.total === 59.98, `Expected total 59.98, got ${data.total}`);
  // verify order on disk
  const file = join(STORE_DATA_DIR, '.store-data', 'orders.json');
  assert(existsSync(file), 'orders.json not created');
  const onDisk = JSON.parse(readFileSync(file, 'utf8'));
  assert(onDisk.some(o => o.id === data.orderId), 'Order not found in orders.json');
  // verify cart cleared
  const cartFile = join(STORE_DATA_DIR, '.store-data', 'carts', `${SESSION_ID}.json`);
  assert(!existsSync(cartFile), 'Cart file should be cleared after checkout');
  orderId = data.orderId;
});

await test('MS-07: list orders (GET store-orders)', async () => {
  const res = await storeOrdersHandler(makeEvent('GET', null, {}));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(Array.isArray(data.orders), 'orders should be an array');
  assert(data.orders.length >= 1, `Expected at least 1 order`);
  const found = data.orders.find(o => o.id === orderId || o.orderId === orderId);
  assert(found, 'Created order not found in list');
});

await test('MS-08: get order by id (GET store-orders ?orderId=)', async () => {
  assert(orderId, 'Prerequisite: orderId not set');
  const res = await storeOrdersHandler(makeEvent('GET', null, { orderId }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(data.order.orderId === orderId || data.order.id === orderId, 'orderId mismatch');
  assert(data.order.customerEmail === 'smoke@maggies.test', 'customerEmail mismatch');
});

await test('MS-09: update order status (POST store-orders)', async () => {
  assert(orderId, 'Prerequisite: orderId not set');
  const res = await storeOrdersHandler(makeEvent('POST', {
    orderId,
    status: 'payment_received',
  }));
  assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
  const data = parseResponse(res);
  assert(data.ok === true, 'ok should be true');
  assert(data.order.status === 'payment_received', `Expected payment_received, got ${data.order.status}`);
  assert(data.order.previousStatus === 'pending_payment', `previousStatus mismatch: ${data.order.previousStatus}`);
  // verify on disk
  const file = join(STORE_DATA_DIR, '.store-data', 'orders.json');
  const onDisk = JSON.parse(readFileSync(file, 'utf8'));
  const diskOrder = onDisk.find(o => o.id === orderId || o.orderId === orderId);
  assert(diskOrder && diskOrder.status === 'payment_received', 'Disk: order status not updated');
});

// ---------------------------------------------------------------------------
// Final summary
// ---------------------------------------------------------------------------

console.log('\n' + '='.repeat(60));
console.log(`RESULTS: ${passedTests} passed, ${failedTests} failed (${totalTests} total)`);
if (failures.length > 0) {
  console.log('\nFailed tests:');
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.reason}`);
  }
}
console.log('='.repeat(60));

// ---------------------------------------------------------------------------
// Cleanup tmp dirs
// ---------------------------------------------------------------------------

try { rmSync(LEAD_VAULT_DIR,   { recursive: true, force: true }); } catch { /* ignore */ }
try { rmSync(MEDIA_CENTER_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
try { rmSync(MUSIC_NEXUS_DIR,  { recursive: true, force: true }); } catch { /* ignore */ }
try { rmSync(STORE_DATA_DIR,   { recursive: true, force: true }); } catch { /* ignore */ }

process.exit(failedTests > 0 ? 1 : 0);
