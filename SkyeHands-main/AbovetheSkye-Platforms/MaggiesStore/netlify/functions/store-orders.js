'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { requireSkyGate } = require('./_lib/skygate-auth');

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function dataDir() {
  return process.env.STORE_DATA_DIR || path.join(os.tmpdir(), 'maggies-store');
}

function ordersFile() {
  return path.join(dataDir(), '.store-data', 'orders.json');
}

function ensureFile(filePath, defaultValue) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2) + '\n', 'utf8');
  }
}

function loadOrders() {
  const file = ordersFile();
  ensureFile(file, []);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  const file = ordersFile();
  ensureFile(file, []);
  fs.writeFileSync(file, JSON.stringify(orders, null, 2) + '\n', 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

// Valid status transitions
const VALID_STATUSES = [
  'pending_payment',
  'payment_received',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
];

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
// GET: list orders or get a single order
//   ?orderId=  -> single order lookup
//   ?status=   -> filter by status
//   ?email=    -> filter by customerEmail
// ---------------------------------------------------------------------------

function handleGet(event) {
  const params = event.queryStringParameters || {};
  const orderId = params.orderId;

  const orders = loadOrders();

  // Single-order lookup
  if (orderId) {
    const order = orders.find((o) => o.id === orderId || o.orderId === orderId);
    if (!order) return respond(404, { ok: false, error: 'Order not found' });
    return respond(200, { ok: true, order });
  }

  // List with optional filters
  const statusFilter = params.status ? params.status.trim() : '';
  const emailFilter = params.email ? params.email.trim().toLowerCase() : '';
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(params.limit || '50', 10)));

  let filtered = orders;
  if (statusFilter) {
    filtered = filtered.filter((o) => o.status === statusFilter);
  }
  if (emailFilter) {
    filtered = filtered.filter((o) =>
      (o.customerEmail || '').toLowerCase().includes(emailFilter)
    );
  }

  // Sort newest first
  filtered = filtered.slice().sort((a, b) => {
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const total = filtered.length;
  const offset = (page - 1) * limit;
  const paged = filtered.slice(offset, offset + limit);

  return respond(200, {
    ok: true,
    orders: paged,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

// ---------------------------------------------------------------------------
// POST: update order status  { orderId, status }
// ---------------------------------------------------------------------------

function handlePost(event) {
  let payload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return respond(400, { ok: false, error: 'Invalid JSON body' });
  }

  const { orderId, status } = payload;
  if (!orderId) return respond(400, { ok: false, error: '"orderId" is required' });
  if (!status) return respond(400, { ok: false, error: '"status" is required' });

  if (!VALID_STATUSES.includes(status)) {
    return respond(400, {
      ok: false,
      error: `Invalid status "${status}". Valid statuses: ${VALID_STATUSES.join(', ')}`,
    });
  }

  const orders = loadOrders();
  const idx = orders.findIndex((o) => o.id === orderId || o.orderId === orderId);
  if (idx === -1) return respond(404, { ok: false, error: 'Order not found' });

  const previousStatus = orders[idx].status;
  orders[idx] = { ...orders[idx], status, previousStatus, updatedAt: nowIso() };
  saveOrders(orders);

  return respond(200, { ok: true, order: orders[idx] });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

module.exports.handler = async (event) => {
  try {
    const method = (event.httpMethod || 'GET').toUpperCase();
    const denied = requireSkyGate(event);
    if (denied) return denied;
    if (method === 'GET') return handleGet(event);
    if (method === 'POST') return handlePost(event);
    return respond(405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return respond(500, { ok: false, error: err.message || 'Internal server error' });
  }
};
