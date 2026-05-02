'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Storage helpers (mirrors store-products.js)
// ---------------------------------------------------------------------------

function dataDir() {
  return process.env.STORE_DATA_DIR || path.join(os.tmpdir(), 'maggies-store');
}

function productsFile() {
  return path.join(dataDir(), '.store-data', 'products.json');
}

function ensureFile(filePath, defaultValue) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2) + '\n', 'utf8');
  }
}

function loadProducts() {
  const file = productsFile();
  ensureFile(file, []);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function saveProducts(products) {
  const file = productsFile();
  ensureFile(file, []);
  fs.writeFileSync(file, JSON.stringify(products, null, 2) + '\n', 'utf8');
}

function nowIso() {
  return new Date().toISOString();
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
// GET: fetch a single product by ?id=
// ---------------------------------------------------------------------------

function handleGet(event) {
  const params = event.queryStringParameters || {};
  const id = params.id || params.productId;
  if (!id) return respond(400, { ok: false, error: 'Query parameter "id" is required' });

  const products = loadProducts();
  const product = products.find((p) => p.id === id);
  if (!product) return respond(404, { ok: false, error: 'Product not found' });

  return respond(200, { ok: true, product });
}

// ---------------------------------------------------------------------------
// PUT: update a product by ?id=  (or id in body)
// ---------------------------------------------------------------------------

function handlePut(event) {
  const params = event.queryStringParameters || {};
  let id = params.id || params.productId;

  let payload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return respond(400, { ok: false, error: 'Invalid JSON body' });
  }

  id = id || payload.id;
  if (!id) return respond(400, { ok: false, error: 'Product id is required (query param or body)' });

  const products = loadProducts();
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) return respond(404, { ok: false, error: 'Product not found' });

  const existing = products[idx];

  // If updating sku, ensure no duplicate
  if (payload.sku && payload.sku !== existing.sku) {
    if (products.some((p) => p.sku === payload.sku && p.id !== id)) {
      return respond(409, { ok: false, error: `A product with SKU "${payload.sku}" already exists` });
    }
  }

  // Allow-list of updatable fields
  const allowedFields = ['name', 'sku', 'price', 'cost', 'category', 'description', 'inventory_qty', 'image_url'];
  const updated = { ...existing };
  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      updated[field] = field === 'price' || field === 'cost' || field === 'inventory_qty'
        ? Number(payload[field])
        : String(payload[field]).trim();
    }
  }
  updated.updatedAt = nowIso();

  products[idx] = updated;
  saveProducts(products);

  return respond(200, { ok: true, product: updated });
}

// ---------------------------------------------------------------------------
// DELETE: remove a product by ?id=  (or id in body)
// ---------------------------------------------------------------------------

function handleDelete(event) {
  const params = event.queryStringParameters || {};
  let id = params.id || params.productId;

  if (!id) {
    try {
      const payload = event.body ? JSON.parse(event.body) : {};
      id = payload.id || payload.productId;
    } catch { /* ignore */ }
  }

  if (!id) return respond(400, { ok: false, error: 'Product id is required' });

  const products = loadProducts();
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) return respond(404, { ok: false, error: 'Product not found' });

  const removed = products[idx];
  products.splice(idx, 1);
  saveProducts(products);

  return respond(200, { ok: true, deleted: true, product: removed });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

module.exports.handler = async (event) => {
  try {
    const method = (event.httpMethod || 'GET').toUpperCase();
    if (method === 'GET') return handleGet(event);
    if (method === 'PUT' || method === 'PATCH') return handlePut(event);
    if (method === 'DELETE') return handleDelete(event);
    return respond(405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return respond(500, { ok: false, error: err.message || 'Internal server error' });
  }
};
