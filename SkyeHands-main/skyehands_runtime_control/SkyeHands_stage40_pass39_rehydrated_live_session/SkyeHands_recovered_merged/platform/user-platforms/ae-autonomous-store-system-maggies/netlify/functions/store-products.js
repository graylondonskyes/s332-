'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

// ---------------------------------------------------------------------------
// Storage helpers
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
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveProducts(products) {
  const file = productsFile();
  ensureFile(file, []);
  fs.writeFileSync(file, JSON.stringify(products, null, 2) + '\n', 'utf8');
}

function makeId() {
  return crypto.randomBytes(8).toString('hex');
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
// GET: list products with pagination and filtering
// ---------------------------------------------------------------------------

function handleGet(event) {
  const params = event.queryStringParameters || {};
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(params.limit || '50', 10)));
  const category = params.category ? params.category.trim() : '';
  const search = params.search ? params.search.trim().toLowerCase() : '';
  const minPrice = params.minPrice !== undefined ? parseFloat(params.minPrice) : null;
  const maxPrice = params.maxPrice !== undefined ? parseFloat(params.maxPrice) : null;

  let products = loadProducts();

  // Apply filters
  if (category) {
    products = products.filter((p) => p.category === category);
  }
  if (search) {
    products = products.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(search) ||
        (p.description || '').toLowerCase().includes(search) ||
        (p.sku || '').toLowerCase().includes(search)
    );
  }
  if (minPrice !== null && !isNaN(minPrice)) {
    products = products.filter((p) => Number(p.price || 0) >= minPrice);
  }
  if (maxPrice !== null && !isNaN(maxPrice)) {
    products = products.filter((p) => Number(p.price || 0) <= maxPrice);
  }

  const total = products.length;
  const offset = (page - 1) * limit;
  const paged = products.slice(offset, offset + limit);

  return respond(200, {
    ok: true,
    products: paged,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

// ---------------------------------------------------------------------------
// POST: create a product
// ---------------------------------------------------------------------------

function handlePost(event) {
  let payload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return respond(400, { ok: false, error: 'Invalid JSON body' });
  }

  const { name, sku, price, cost, category, description, inventory_qty, image_url } = payload;

  if (!name || !sku || price === undefined) {
    return respond(400, { ok: false, error: 'name, sku, and price are required' });
  }

  const products = loadProducts();

  // Enforce unique SKU
  if (products.some((p) => p.sku === sku)) {
    return respond(409, { ok: false, error: `A product with SKU "${sku}" already exists` });
  }

  const product = {
    id: makeId(),
    name: String(name).trim(),
    sku: String(sku).trim(),
    price: Number(price),
    cost: cost !== undefined ? Number(cost) : null,
    category: category ? String(category).trim() : '',
    description: description ? String(description).trim() : '',
    inventory_qty: inventory_qty !== undefined ? Number(inventory_qty) : 0,
    image_url: image_url ? String(image_url).trim() : '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  products.push(product);
  saveProducts(products);

  return respond(201, { ok: true, product });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

module.exports.handler = async (event) => {
  try {
    const method = (event.httpMethod || 'GET').toUpperCase();
    if (method === 'GET') return handleGet(event);
    if (method === 'POST') return handlePost(event);
    return respond(405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return respond(500, { ok: false, error: err.message || 'Internal server error' });
  }
};
