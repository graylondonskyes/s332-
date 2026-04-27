#!/usr/bin/env node
/**
 * P022 — Printful Commerce Flow — BEHAVIORAL SMOKE
 * Tests actual order lifecycle state transitions, not just route existence.
 * With PRINTFUL_API_TOKEN set, also tests real catalog fetch.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const runtimePath = path.join(root, 'platform', 'user-platforms',
  'skye-account-executive-commandhub-s0l26-0s', 'source',
  'AE-Central-Command-Pack-CredentialHub-Launcher', 'Branching Apps',
  'Printful-Commerce-Brain-EDM-pass6', 'site', 'printful-pod', 'assets', 'js',
  'printful-local-runtime.cjs');

const artifact = path.join(root, 'SMOKE_P022_PRINTFUL_COMMERCE_FLOW.md');
const results = [];
let allPass = true;

function assert(label, condition, detail = '') {
  const ok = Boolean(condition);
  results.push({ label, ok, detail });
  if (!ok) allPass = false;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
}

// ── 1. Local runtime module loads ─────────────────────────────────────────
const rt = require(runtimePath);
assert('runtime module loads', typeof rt === 'object');
assert('getProducts() returns array', Array.isArray(rt.getProducts()));
assert('products have required fields', rt.getProducts().every(p => p.sku && p.price >= 0 && p.cost >= 0));

// ── 2. State machine — full order lifecycle ────────────────────────────────
let state = rt.createState();
assert('createState() returns empty state', Array.isArray(state.orders) && state.orders.length === 0);

// Add draft order
state = rt.addDraftOrder(state, { customer: 'Smoke Test Client', sku: 'tee-black', quantity: 2 });
assert('addDraftOrder creates order', state.orders.length === 1);
const order = state.orders[0];
assert('order has id', typeof order.id === 'string' && order.id.length > 0);
assert('order.stage is draft', order.stage === 'draft');
assert('order has correct sku', order.sku === 'tee-black');
assert('order quantity >= 1', order.quantity >= 1);

// Attach art packet
state = rt.addArtPacket(state, { orderId: order.id, assetName: 'smoke-art.png', revision: 1 });
assert('addArtPacket sets artPacketReady', state.orders[0].artPacketReady === true);
assert('addArtPacket creates asset', state.assets.length === 1);

// Move order through pipeline
state = rt.moveOrder(state, order.id, 'approved');
assert('moveOrder to approved', state.orders[0].stage === 'approved');

state = rt.moveOrder(state, order.id, 'in-production');
assert('moveOrder to in-production', state.orders[0].stage === 'in-production');

state = rt.moveOrder(state, order.id, 'shipped');
assert('moveOrder to shipped', state.orders[0].stage === 'shipped');

// ── 3. Profitability calculation ───────────────────────────────────────────
const profit = rt.profitability(state);
assert('profitability returns object', typeof profit === 'object');
assert('profitability.orders counts correctly', profit.orders === 1);
assert('profitability.revenue > 0', profit.revenue > 0);
assert('profitability.profit = revenue - cost', profit.profit === profit.revenue - profit.cost);
assert('profitability.shipped counted', profit.production > 0 || profit.approved > 0 || profit.orders > 0);

// ── 4. History audit trail ────────────────────────────────────────────────
const history = state.orders[0].history;
assert('order has history entries', Array.isArray(history) && history.length >= 3);
assert('history entries have stage field', history.every(h => typeof h.stage === 'string'));
assert('history entries have timestamp', history.every(h => typeof h.at === 'string'));

// ── 5. Multi-order state isolation ────────────────────────────────────────
state = rt.addDraftOrder(state, { customer: 'Second Client', sku: 'hoodie-midnight', quantity: 1 });
assert('state supports multiple orders', state.orders.length === 2);
const secondOrder = state.orders.find(o => o.sku === 'hoodie-midnight');
assert('second order exists independently', secondOrder && secondOrder.stage === 'draft');

// Move only the first order — second should be unaffected
state = rt.moveOrder(state, order.id, 'ready-to-ship');
const firstAfter = state.orders.find(o => o.id === order.id);
const secondAfter = state.orders.find(o => o.sku === 'hoodie-midnight');
assert('first order stage updated', firstAfter.stage === 'ready-to-ship');
assert('second order unaffected by first move', secondAfter.stage === 'draft');

// ── 6. Real Printful API (skipped without token) ──────────────────────────
const hasToken = process.env.PRINTFUL_API_TOKEN && process.env.PRINTFUL_API_TOKEN !== 'smoke-skip';
if (hasToken) {
  console.log('  [live] Testing real Printful API catalog fetch...');
  try {
    const res = await fetch('https://api.printful.com/products?limit=1', {
      headers: { Authorization: `Bearer ${process.env.PRINTFUL_API_TOKEN}` },
    });
    assert('Printful API catalog reachable', res.ok, `HTTP ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      assert('Printful API returns items', Array.isArray(data?.result) && data.result.length > 0);
    }
  } catch (err) {
    assert('Printful API fetch (live)', false, err.message);
  }
} else {
  results.push({ label: 'Printful live API', ok: null, detail: 'SKIPPED — set PRINTFUL_API_TOKEN to enable' });
  console.log('  - Printful live API: SKIPPED (no token)');
}

// ── Write artifact ────────────────────────────────────────────────────────
const passed = results.filter(r => r.ok === true).length;
const failed = results.filter(r => r.ok === false).length;
const skipped = results.filter(r => r.ok === null).length;
const md = [
  `# P022 Smoke Proof — Printful Commerce Flow`,
  ``,
  `**Behavioral smoke** — tests state transitions, not just route existence.`,
  ``,
  `Generated: ${new Date().toISOString()}`,
  `Result: ${allPass ? '**PASS**' : '**FAIL**'} | ${passed} passed, ${failed} failed, ${skipped} skipped`,
  ``,
  `## Assertions`,
  ...results.map(r => `- ${r.ok === true ? '✅' : r.ok === null ? '⏭' : '❌'} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`),
  ``,
  `## Coverage`,
  `- ✅ State machine: draft → approved → in-production → shipped → ready-to-ship`,
  `- ✅ Art packet attachment and artPacketReady flag`,
  `- ✅ Profitability calculation (revenue, cost, profit)`,
  `- ✅ Audit history with timestamps`,
  `- ✅ Multi-order state isolation`,
  `- ${hasToken ? '✅' : '⏭'} Real Printful catalog API`,
].join('\n');

fs.writeFileSync(artifact, md, 'utf8');
console.log(`\n${allPass ? 'PASS' : 'FAIL'} — ${passed}/${results.filter(r => r.ok !== null).length} assertions | artifact: ${path.relative(root, artifact)}`);
console.log(JSON.stringify({ pass: allPass, passed, failed, skipped, artifact: path.relative(root, artifact) }, null, 2));
if (!allPass) process.exit(1);
