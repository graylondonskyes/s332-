#!/usr/bin/env node
/**
 * P094 — Maggies Store — BEHAVIORAL SMOKE
 * Tests full product lifecycle: create → cart → checkout → order status update
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fnDir = path.join(root, 'platform', 'user-platforms', 'ae-autonomous-store-system-maggies', 'netlify', 'functions');
const artifact = path.join(root, 'SMOKE_P094_MAGGIES_STORE.md');

const results = [];
let allPass = true;

function assert(label, condition, detail = '') {
  const ok = Boolean(condition);
  results.push({ label, ok, detail });
  if (!ok) allPass = false;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
}

// Use an isolated test data dir so smoke doesn't pollute production
const testDir = path.join(os.tmpdir(), `maggies-smoke-${crypto.randomBytes(4).toString('hex')}`);
process.env.STORE_DATA_DIR = testDir;

const productsHandler = require(path.join(fnDir, 'store-products.js')).handler;
const productHandler = require(path.join(fnDir, 'store-product.js')).handler;
const cartHandler = require(path.join(fnDir, 'store-cart.js')).handler;
const checkoutHandler = require(path.join(fnDir, 'store-checkout.js')).handler;
const ordersHandler = require(path.join(fnDir, 'store-orders.js')).handler;

function makeEvent(method, query = {}, body = null) {
  return { httpMethod: method, queryStringParameters: query, body: body ? JSON.stringify(body) : null };
}

// ── 1. Create product ─────────────────────────────────────────────────────
const createRes = await productsHandler(makeEvent('POST', {}, { name: 'Smoke Tee', sku: 'smoke-tee-001', price: 34, cost: 18, category: 'apparel', inventory_qty: 50 }));
const createBody = JSON.parse(createRes.body);
assert('create product returns 201', createRes.statusCode === 201);
assert('create product ok:true', createBody.ok === true);
assert('product has id', typeof createBody.product?.id === 'string');
const productId = createBody.product?.id;

// ── 2. List products ──────────────────────────────────────────────────────
const listRes = await productsHandler(makeEvent('GET'));
const listBody = JSON.parse(listRes.body);
assert('list products returns 200', listRes.statusCode === 200);
assert('list includes new product', listBody.products?.some(p => p.id === productId));

// ── 3. Get single product ─────────────────────────────────────────────────
const getRes = await productHandler(makeEvent('GET', { id: productId }));
const getBody = JSON.parse(getRes.body);
assert('get product returns 200', getRes.statusCode === 200);
assert('get product returns correct sku', getBody.product?.sku === 'smoke-tee-001');

// ── 4. Add to cart ────────────────────────────────────────────────────────
const sessionId = `sess-${crypto.randomBytes(4).toString('hex')}`;
const cartAddRes = await cartHandler(makeEvent('POST', {}, { sessionId, productId, qty: 2 }));
const cartAddBody = JSON.parse(cartAddRes.body);
assert('add to cart returns 200', cartAddRes.statusCode === 200);
assert('cart has item', cartAddBody.cart?.items?.some(i => i.productId === productId));
assert('cart total > 0', cartAddBody.cart?.total > 0);

// ── 5. Checkout ───────────────────────────────────────────────────────────
const checkoutRes = await checkoutHandler(makeEvent('POST', {}, {
  sessionId, customerEmail: 'smoke@test.local', shippingAddress: { line1: '123 Smoke St', city: 'Testville', zip: '00000' }
}));
const checkoutBody = JSON.parse(checkoutRes.body);
assert('checkout returns 201', checkoutRes.statusCode === 201);
assert('checkout ok:true', checkoutBody.ok === true);
assert('checkout has orderId', typeof checkoutBody.orderId === 'string');
assert('checkout total > 0', checkoutBody.total > 0);
assert('order status pending_payment', checkoutBody.status === 'pending_payment');
const orderId = checkoutBody.orderId;

// ── 6. Cart is cleared after checkout ────────────────────────────────────
const cartGetRes = await cartHandler(makeEvent('GET', { sessionId }));
const cartGetBody = JSON.parse(cartGetRes.body);
assert('cart cleared after checkout', cartGetBody.cart?.items?.length === 0);

// ── 7. Order exists ───────────────────────────────────────────────────────
const orderRes = await ordersHandler(makeEvent('GET', { orderId }));
const orderBody = JSON.parse(orderRes.body);
assert('get order returns 200', orderRes.statusCode === 200);
assert('order matches checkout', orderBody.order?.id === orderId);
assert('order email matches', orderBody.order?.customerEmail === 'smoke@test.local');

// ── 8. Update order status ────────────────────────────────────────────────
const updateRes = await ordersHandler(makeEvent('POST', {}, { orderId, status: 'payment_received' }));
const updateBody = JSON.parse(updateRes.body);
assert('update order status returns 200', updateRes.statusCode === 200);
assert('order status updated', updateBody.order?.status === 'payment_received');

// ── Cleanup ───────────────────────────────────────────────────────────────
fs.rmSync(testDir, { recursive: true, force: true });

// ── Write artifact ────────────────────────────────────────────────────────
const passed = results.filter(r => r.ok).length;
const md = [
  '# P094 Smoke Proof — Maggies Store Behavioral',
  '', `Generated: ${new Date().toISOString()}`,
  `Result: **${allPass ? 'PASS' : 'FAIL'}** | ${passed}/${results.length} assertions`,
  '', '## Assertions',
  ...results.map(r => `- ${r.ok ? '✅' : '❌'} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`),
  '', '## Coverage',
  '- ✅ Product create + list + get', '- ✅ Cart add + total calculation',
  '- ✅ Checkout creates order and clears cart', '- ✅ Order lookup and status update',
].join('\n');
fs.writeFileSync(artifact, md);
console.log(`\n${allPass ? 'PASS' : 'FAIL'} — ${passed}/${results.length} assertions`);
if (!allPass) process.exit(1);
