'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function dataDir() {
  return process.env.STORE_DATA_DIR || path.join(os.tmpdir(), 'maggies-store');
}

function cartsDir() {
  return path.join(dataDir(), '.store-data', 'carts');
}

function productsFile() {
  return path.join(dataDir(), '.store-data', 'products.json');
}

function cartFile(sessionId) {
  return path.join(cartsDir(), `${sessionId}.json`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadProducts() {
  const file = productsFile();
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function loadCart(sessionId) {
  const file = cartFile(sessionId);
  ensureDir(cartsDir());
  if (!fs.existsSync(file)) return { sessionId, items: [], updatedAt: null };
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { sessionId, items: [], updatedAt: null };
  }
}

function saveCart(cart) {
  ensureDir(cartsDir());
  const file = cartFile(cart.sessionId);
  fs.writeFileSync(file, JSON.stringify(cart, null, 2) + '\n', 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Compute cart total
// ---------------------------------------------------------------------------

function computeTotal(items) {
  return items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
}

// ---------------------------------------------------------------------------
// JSON response helper
// ---------------------------------------------------------------------------

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// ---------------------------------------------------------------------------
// GET: read cart for session ?sessionId=
// ---------------------------------------------------------------------------

function handleGet(event) {
  const params = event.queryStringParameters || {};
  const sessionId = params.sessionId;
  if (!sessionId) return respond(400, { ok: false, error: 'Query parameter "sessionId" is required' });

  const cart = loadCart(sessionId);
  const total = computeTotal(cart.items);
  return respond(200, { ok: true, cart: { ...cart, total } });
}

// ---------------------------------------------------------------------------
// POST: add item to cart  { sessionId, productId, qty }
// ---------------------------------------------------------------------------

function handlePost(event) {
  let payload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return respond(400, { ok: false, error: 'Invalid JSON body' });
  }

  const { sessionId, productId, qty } = payload;
  if (!sessionId) return respond(400, { ok: false, error: '"sessionId" is required' });
  if (!productId) return respond(400, { ok: false, error: '"productId" is required' });

  const requestedQty = parseInt(qty || '1', 10);
  if (isNaN(requestedQty) || requestedQty < 1) {
    return respond(400, { ok: false, error: '"qty" must be a positive integer' });
  }

  // Look up product so we can embed price/name in cart
  const products = loadProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) return respond(404, { ok: false, error: `Product "${productId}" not found` });

  // Check inventory
  if (product.inventory_qty !== undefined && product.inventory_qty < requestedQty) {
    return respond(409, {
      ok: false,
      error: `Insufficient stock. Requested: ${requestedQty}, Available: ${product.inventory_qty}`,
    });
  }

  const cart = loadCart(sessionId);

  const existing = cart.items.find((item) => item.productId === productId);
  if (existing) {
    existing.qty += requestedQty;
    existing.updatedAt = nowIso();
  } else {
    cart.items.push({
      productId,
      name: product.name,
      sku: product.sku,
      price: Number(product.price),
      qty: requestedQty,
      image_url: product.image_url || '',
      addedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  cart.updatedAt = nowIso();
  saveCart(cart);

  const total = computeTotal(cart.items);
  return respond(200, { ok: true, cart: { ...cart, total } });
}

// ---------------------------------------------------------------------------
// DELETE: remove item from cart  { sessionId, productId }
// ---------------------------------------------------------------------------

function handleDelete(event) {
  let sessionId;
  let productId;

  const params = event.queryStringParameters || {};
  sessionId = params.sessionId;
  productId = params.productId;

  if (!sessionId || !productId) {
    try {
      const payload = event.body ? JSON.parse(event.body) : {};
      sessionId = sessionId || payload.sessionId;
      productId = productId || payload.productId;
    } catch { /* ignore */ }
  }

  if (!sessionId) return respond(400, { ok: false, error: '"sessionId" is required' });
  if (!productId) return respond(400, { ok: false, error: '"productId" is required' });

  const cart = loadCart(sessionId);
  const before = cart.items.length;
  cart.items = cart.items.filter((item) => item.productId !== productId);

  if (cart.items.length === before) {
    return respond(404, { ok: false, error: `Product "${productId}" not found in cart` });
  }

  cart.updatedAt = nowIso();
  saveCart(cart);

  const total = computeTotal(cart.items);
  return respond(200, { ok: true, cart: { ...cart, total } });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

module.exports.handler = async (event) => {
  try {
    const method = (event.httpMethod || 'GET').toUpperCase();
    if (method === 'GET') return handleGet(event);
    if (method === 'POST') return handlePost(event);
    if (method === 'DELETE') return handleDelete(event);
    return respond(405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return respond(500, { ok: false, error: err.message || 'Internal server error' });
  }
};
