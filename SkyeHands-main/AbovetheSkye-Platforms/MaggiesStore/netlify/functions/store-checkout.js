'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
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

function cartsDir() {
  return path.join(dataDir(), '.store-data', 'carts');
}

function cartFile(sessionId) {
  return path.join(cartsDir(), `${sessionId}.json`);
}

function ensureFile(filePath, defaultValue) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2) + '\n', 'utf8');
  }
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadCart(sessionId) {
  const file = cartFile(sessionId);
  ensureDir(cartsDir());
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function clearCart(sessionId) {
  const file = cartFile(sessionId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
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

function makeId() {
  return crypto.randomBytes(8).toString('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function computeTotal(items) {
  return Math.round(
    items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0) * 100
  ) / 100;
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
// Stripe integration (optional — guarded by env var)
// ---------------------------------------------------------------------------

async function tryCreateStripePaymentIntent(total, orderId, customerEmail) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  // Dynamically require stripe so absence of the package doesn't crash startup
  let Stripe;
  try {
    Stripe = require('stripe');
  } catch {
    return null;
  }

  const stripe = Stripe(key);
  const intent = await stripe.paymentIntents.create({
    amount: Math.round(total * 100), // Stripe expects cents
    currency: 'usd',
    metadata: { orderId, customerEmail: customerEmail || '' },
  });

  return intent.client_secret;
}

// ---------------------------------------------------------------------------
// POST: create checkout session from cart
// ---------------------------------------------------------------------------

async function handlePost(event) {
  let payload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return respond(400, { ok: false, error: 'Invalid JSON body' });
  }

  const { sessionId, customerEmail, shippingAddress } = payload;
  if (!sessionId) return respond(400, { ok: false, error: '"sessionId" is required' });
  if (!customerEmail) return respond(400, { ok: false, error: '"customerEmail" is required' });
  if (!shippingAddress) return respond(400, { ok: false, error: '"shippingAddress" is required' });

  // Load cart
  const cart = loadCart(sessionId);
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    return respond(400, { ok: false, error: 'Cart is empty or not found — cannot create checkout session' });
  }

  const total = computeTotal(cart.items);

  // Build order record
  const orderId = makeId();
  const order = {
    id: orderId,
    orderId,
    sessionId,
    customerEmail: String(customerEmail).trim(),
    shippingAddress: typeof shippingAddress === 'object' ? shippingAddress : { raw: String(shippingAddress) },
    items: cart.items,
    total,
    status: 'pending_payment',
    paymentMethod: 'manual',
    stripePaymentIntentId: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  // Attempt Stripe payment intent
  let clientSecret = null;
  try {
    clientSecret = await tryCreateStripePaymentIntent(total, orderId, customerEmail);
    if (clientSecret) {
      order.paymentMethod = 'stripe';
      // Extract payment intent id from client_secret (format: pi_xxx_secret_yyy)
      order.stripePaymentIntentId = clientSecret.split('_secret_')[0];
    }
  } catch (stripeErr) {
    // Stripe failure should not abort the order — fall back to manual
    order.stripeError = stripeErr.message || 'stripe error';
  }

  // Persist order
  const orders = loadOrders();
  orders.push(order);
  saveOrders(orders);

  // Clear cart
  clearCart(sessionId);

  const response = {
    ok: true,
    orderId: order.orderId,
    total,
    status: order.status,
    paymentMethod: order.paymentMethod,
    order,
  };

  if (clientSecret) {
    response.clientSecret = clientSecret;
  }

  return respond(201, response);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

module.exports.handler = async (event) => {
  try {
    const method = (event.httpMethod || 'POST').toUpperCase();
    const denied = requireSkyGate(event);
    if (denied) return denied;
    if (method === 'POST') return await handlePost(event);
    return respond(405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    return respond(500, { ok: false, error: err.message || 'Internal server error' });
  }
};
