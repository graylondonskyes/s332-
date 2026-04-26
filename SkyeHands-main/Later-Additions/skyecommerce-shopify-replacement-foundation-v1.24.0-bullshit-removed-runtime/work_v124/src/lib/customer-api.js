import {
  dbAll,
  dbFirst,
  dbRun,
  json,
  parseCookie,
  readJson,
  sha256Hex,
  signToken,
  slugify,
  uid,
  verifyToken
} from './utils.js';
import {
  buildCustomerDisplayName,
  customerRecord,
  normalizeCustomerProfileInput,
  normalizeCustomerRegistrationInput,
  normalizeSavedCartInput
} from './customers.js';
import { buildOrderEvent } from './orders.js';
import { normalizeReturnRequestInput, returnRecord } from './returns.js';
import { hashCustomerPassword, verifyCustomerPassword } from './passwords.js';
import { authSubject, checkAuthLockout, clientIp, recordAuthAttempt } from './security.js';

export const CUSTOMER_SESSION_COOKIE = 'skye_customer_session';

export function setCustomerSessionCookie(token, maxAge = 60 * 60 * 24 * 30) {
  return `${CUSTOMER_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearCustomerSessionCookie() {
  return `${CUSTOMER_SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function createCustomerSession(env, { customerId, merchantId, email = '', ttlMs = 1000 * 60 * 60 * 24 * 30 }) {
  const rawToken = await signToken(env.SESSION_SECRET, {
    sid: uid('custraw'),
    role: 'customer',
    customerId,
    merchantId,
    email,
    exp: Date.now() + ttlMs
  });
  const tokenHash = await sha256Hex(rawToken);
  const sessionId = uid('custsess');
  await dbRun(env, `
    INSERT INTO customer_sessions (id, customer_id, merchant_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?, datetime('now', '+30 day'))
  `, [sessionId, customerId, merchantId, tokenHash]);
  return rawToken;
}

export async function getCustomerSession(request, env) {
  const cookies = parseCookie(request.headers.get('cookie') || '');
  const token = cookies[CUSTOMER_SESSION_COOKIE];
  if (!token) return null;
  try {
    await verifyToken(env.SESSION_SECRET, token);
  } catch {
    return null;
  }
  const tokenHash = await sha256Hex(token);
  const row = await dbFirst(env, `
    SELECT customer_sessions.id,
           customer_sessions.customer_id,
           customer_sessions.merchant_id,
           customer_accounts.email,
           customer_accounts.first_name,
           customer_accounts.last_name,
           customer_accounts.phone,
           customer_accounts.default_address_json,
           customer_accounts.marketing_opt_in,
           customer_accounts.created_at,
           customer_accounts.updated_at,
           merchants.slug AS merchant_slug,
           merchants.brand_name AS merchant_brand_name
    FROM customer_sessions
    INNER JOIN customer_accounts ON customer_accounts.id = customer_sessions.customer_id
    INNER JOIN merchants ON merchants.id = customer_sessions.merchant_id
    WHERE customer_sessions.token_hash = ?
      AND datetime(customer_sessions.expires_at) > datetime('now')
    LIMIT 1
  `, [tokenHash]);
  if (!row) return null;
  const customer = customerRecord(row);
  customer.merchantName = row.merchant_brand_name || '';
  return {
    id: row.id,
    customerId: row.customer_id,
    merchantId: row.merchant_id,
    merchantSlug: row.merchant_slug,
    email: customer.email,
    role: 'customer',
    customer
  };
}

function unauthorized(message = 'Unauthorized.') {
  return json({ error: message }, 401);
}

async function guardCustomerAuthAttempt(request, env, kind, identity = '') {
  const ip = clientIp(request);
  const subject = authSubject(kind, identity || 'unknown', ip);
  const locked = await checkAuthLockout(env, subject);
  return { ip, subject, locked };
}

async function recordCustomerAuthFailure(env, guard, kind, identity = '', reason = 'invalid_credentials') {
  return recordAuthAttempt(env, { subject: guard.subject, kind, identity: String(identity || '').toLowerCase(), ip: guard.ip, success: false, reason });
}

async function recordCustomerAuthSuccess(env, guard, kind, identity = '') {
  return recordAuthAttempt(env, { subject: guard.subject, kind, identity: String(identity || '').toLowerCase(), ip: guard.ip, success: true, reason: 'success' });
}

async function requireCustomerSession(request, env, merchantSlug = '') {
  const session = await getCustomerSession(request, env);
  if (!session || !session.customerId) return { error: unauthorized() };
  if (merchantSlug && slugify(merchantSlug) !== slugify(session.merchantSlug || '')) return { error: unauthorized('Customer session does not belong to this store.') };
  return { session };
}

function customerOrderSummary(row) {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    customerId: row.customer_id || '',
    orderNumber: row.order_number,
    status: row.status,
    paymentStatus: row.payment_status,
    currency: row.currency,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    discountCode: row.discount_code || '',
    discountCents: Number(row.discount_cents || 0),
    subtotalCents: Number(row.subtotal_cents || 0),
    shippingCents: Number(row.shipping_cents || 0),
    taxCents: Number(row.tax_cents || 0),
    totalCents: Number(row.total_cents || 0),
    notes: row.notes || '',
    shippingAddress: JSON.parse(row.shipping_address_json || '{}'),
    items: JSON.parse(row.items_json || '[]'),
    createdAt: row.created_at
  };
}

function orderEventRecord(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    kind: row.kind,
    summary: row.summary,
    detail: row.detail || '',
    status: row.status || '',
    paymentStatus: row.payment_status || '',
    fulfillmentStatus: row.fulfillment_status || '',
    createdAt: row.created_at
  };
}

function fulfillmentRecord(row) {
  return {
    id: row.id,
    orderId: row.order_id,
    carrier: row.carrier || '',
    service: row.service || '',
    trackingNumber: row.tracking_number || '',
    trackingUrl: row.tracking_url || '',
    status: row.status || 'queued',
    note: row.note || '',
    createdAt: row.created_at
  };
}

async function appendCustomerOrderEvent(env, orderId, event) {
  const normalized = buildOrderEvent(event.kind, event, event.detail || '');
  const id = uid('evt');
  await dbRun(env, `
    INSERT INTO order_events (id, order_id, kind, summary, detail, status, payment_status, fulfillment_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, orderId, normalized.kind, normalized.summary, normalized.detail, normalized.status, normalized.paymentStatus, normalized.fulfillmentStatus]);
  return id;
}

async function getCustomerOrderDetails(env, orderId, session) {
  const row = await dbFirst(env, `
    SELECT * FROM orders
    WHERE id = ?
      AND merchant_id = ?
      AND (
        customer_id = ?
        OR (customer_id IS NULL AND lower(customer_email) = lower(?))
      )
    LIMIT 1
  `, [orderId, session.merchantId, session.customerId, session.email]);
  if (!row) return null;
  const [events, fulfillments, returns] = await Promise.all([
    dbAll(env, `SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC`, [orderId]),
    dbAll(env, `SELECT * FROM fulfillments WHERE order_id = ? ORDER BY created_at DESC`, [orderId]),
    dbAll(env, `SELECT * FROM order_returns WHERE order_id = ? AND merchant_id = ? ORDER BY created_at DESC`, [orderId, session.merchantId])
  ]);
  return {
    ...customerOrderSummary(row),
    events: events.map(orderEventRecord),
    fulfillments: fulfillments.map(fulfillmentRecord),
    returns: returns.map(returnRecord)
  };
}

function savedCartRecord(row) {
  let cart = {};
  try { cart = JSON.parse(row.cart_json || '{}'); } catch { cart = {}; }
  return {
    id: row.id,
    merchantId: row.merchant_id,
    customerId: row.customer_id,
    note: row.note || '',
    cart,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function resolveCustomerSessionForMerchant(request, env, merchantId) {
  const session = await getCustomerSession(request, env);
  if (!session || session.merchantId !== merchantId) return null;
  const customer = await dbFirst(env, `SELECT *, ? AS merchant_slug FROM customer_accounts WHERE id = ? AND merchant_id = ? LIMIT 1`, [session.merchantSlug || '', session.customerId, merchantId]);
  if (!customer) return null;
  return customerRecord(customer);
}

export async function handleCustomerApi(request, env, url) {
  if (!url.pathname.startsWith('/api/customers')) return null;

  if (request.method === 'POST' && url.pathname === '/api/customers/register') {
    const body = normalizeCustomerRegistrationInput(await readJson(request) || {});
    if (!body.slug || !body.email || !body.password) return json({ error: 'slug, email, and password are required.' }, 400);
    const merchant = await dbFirst(env, `SELECT id, slug, brand_name FROM merchants WHERE slug = ? LIMIT 1`, [slugify(body.slug)]);
    if (!merchant) return json({ error: 'Store not found.' }, 404);
    const existing = await dbFirst(env, `SELECT id FROM customer_accounts WHERE merchant_id = ? AND lower(email) = lower(?) LIMIT 1`, [merchant.id, body.email]);
    if (existing) return json({ error: 'Customer account already exists for this store.' }, 409);
    const customerId = uid('cus');
    const passwordHash = await hashCustomerPassword(merchant.id, body.email, body.password);
    await dbRun(env, `
      INSERT INTO customer_accounts (
        id, merchant_id, email, password_hash, first_name, last_name, phone, default_address_json, marketing_opt_in
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [customerId, merchant.id, body.email, passwordHash, body.firstName, body.lastName, body.phone, JSON.stringify(body.defaultAddress || {}), body.marketingOptIn ? 1 : 0]);
    const token = await createCustomerSession(env, { customerId, merchantId: merchant.id, email: body.email });
    const record = await dbFirst(env, `SELECT customer_accounts.*, merchants.slug AS merchant_slug FROM customer_accounts INNER JOIN merchants ON merchants.id = customer_accounts.merchant_id WHERE customer_accounts.id = ? LIMIT 1`, [customerId]);
    return json({ ok: true, customer: customerRecord(record), merchant: { id: merchant.id, slug: merchant.slug, brandName: merchant.brand_name } }, 201, { 'Set-Cookie': setCustomerSessionCookie(token) });
  }

  if (request.method === 'POST' && url.pathname === '/api/customers/login') {
    const body = normalizeCustomerRegistrationInput(await readJson(request) || {});
    if (!body.slug || !body.email || !body.password) return json({ error: 'slug, email, and password are required.' }, 400);
    const identity = `${slugify(body.slug)}:${String(body.email || '').trim().toLowerCase()}`;
    const guard = await guardCustomerAuthAttempt(request, env, 'customer_login', identity);
    if (guard.locked) return guard.locked;
    const merchant = await dbFirst(env, `SELECT id, slug, brand_name FROM merchants WHERE slug = ? LIMIT 1`, [slugify(body.slug)]);
    if (!merchant) {
      await recordCustomerAuthFailure(env, guard, 'customer_login', identity, 'merchant_not_found');
      return json({ error: 'Store not found.' }, 404);
    }
    const customer = await dbFirst(env, `SELECT * FROM customer_accounts WHERE merchant_id = ? AND lower(email) = lower(?) LIMIT 1`, [merchant.id, body.email]);
    if (!customer) {
      await recordCustomerAuthFailure(env, guard, 'customer_login', identity, 'customer_not_found');
      return unauthorized('Invalid customer credentials.');
    }
    const passwordOk = await verifyCustomerPassword(merchant.id, customer.email, body.password, customer.password_hash);
    if (!passwordOk) {
      await recordCustomerAuthFailure(env, guard, 'customer_login', identity, 'bad_password');
      return unauthorized('Invalid customer credentials.');
    }
    await recordCustomerAuthSuccess(env, guard, 'customer_login', identity);
    if (!String(customer.password_hash || '').startsWith('pbkdf2_sha256$')) {
      const upgradedHash = await hashCustomerPassword(merchant.id, customer.email, body.password);
      await dbRun(env, `UPDATE customer_accounts SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND merchant_id = ?`, [upgradedHash, customer.id, merchant.id]);
    }
    const token = await createCustomerSession(env, { customerId: customer.id, merchantId: merchant.id, email: customer.email });
    const record = await dbFirst(env, `SELECT customer_accounts.*, merchants.slug AS merchant_slug FROM customer_accounts INNER JOIN merchants ON merchants.id = customer_accounts.merchant_id WHERE customer_accounts.id = ? LIMIT 1`, [customer.id]);
    return json({ ok: true, customer: customerRecord(record), merchant: { id: merchant.id, slug: merchant.slug, brandName: merchant.brand_name } }, 200, { 'Set-Cookie': setCustomerSessionCookie(token) });
  }
  if (request.method === 'POST' && url.pathname === '/api/customers/logout') {
    return json({ ok: true }, 200, { 'Set-Cookie': clearCustomerSessionCookie() });
  }

  if (request.method === 'GET' && url.pathname === '/api/customers/me') {
    const session = await getCustomerSession(request, env);
    const slug = url.searchParams.get('slug') || '';
    if (!session) return json({ ok: false, customer: null, merchantSlug: slugify(slug) || '' });
    if (slug && slugify(slug) !== slugify(session.merchantSlug || '')) return json({ ok: false, customer: null, merchantSlug: slugify(slug) });
    return json({ ok: true, customer: session.customer, merchantSlug: session.merchantSlug, merchantName: session.customer.merchantName || '' });
  }

  if (request.method === 'PUT' && url.pathname === '/api/customers/profile') {
    const slug = url.searchParams.get('slug') || '';
    const auth = await requireCustomerSession(request, env, slug);
    if (auth.error) return auth.error;
    const body = normalizeCustomerProfileInput(await readJson(request) || {});
    await dbRun(env, `
      UPDATE customer_accounts
      SET first_name = ?, last_name = ?, phone = ?, default_address_json = ?, marketing_opt_in = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND merchant_id = ?
    `, [body.firstName, body.lastName, body.phone, JSON.stringify(body.defaultAddress || {}), body.marketingOptIn ? 1 : 0, auth.session.customerId, auth.session.merchantId]);
    const record = await dbFirst(env, `SELECT customer_accounts.*, merchants.slug AS merchant_slug FROM customer_accounts INNER JOIN merchants ON merchants.id = customer_accounts.merchant_id WHERE customer_accounts.id = ? LIMIT 1`, [auth.session.customerId]);
    return json({ ok: true, customer: customerRecord(record) });
  }

  if (request.method === 'GET' && url.pathname === '/api/customers/orders') {
    const slug = url.searchParams.get('slug') || '';
    const auth = await requireCustomerSession(request, env, slug);
    if (auth.error) return auth.error;
    const rows = await dbAll(env, `
      SELECT * FROM orders
      WHERE merchant_id = ?
        AND (
          customer_id = ?
          OR (customer_id IS NULL AND lower(customer_email) = lower(?))
        )
      ORDER BY created_at DESC
    `, [auth.session.merchantId, auth.session.customerId, auth.session.email]);
    return json({ ok: true, orders: rows.map(customerOrderSummary) });
  }

  const orderMatch = url.pathname.match(/^\/api\/customers\/orders\/([^/]+)$/);
  if (request.method === 'GET' && orderMatch) {
    const slug = url.searchParams.get('slug') || '';
    const auth = await requireCustomerSession(request, env, slug);
    if (auth.error) return auth.error;
    const order = await getCustomerOrderDetails(env, decodeURIComponent(orderMatch[1]), auth.session);
    if (!order) return json({ error: 'Order not found.' }, 404);
    return json({ ok: true, order });
  }

  const returnMatch = url.pathname.match(/^\/api\/customers\/orders\/([^/]+)\/returns$/);
  if (request.method === 'POST' && returnMatch) {
    const slug = url.searchParams.get('slug') || '';
    const auth = await requireCustomerSession(request, env, slug);
    if (auth.error) return auth.error;
    const order = await getCustomerOrderDetails(env, decodeURIComponent(returnMatch[1]), auth.session);
    if (!order) return json({ error: 'Order not found.' }, 404);
    const body = normalizeReturnRequestInput(await readJson(request) || {}, order);
    if (!body.items.length) return json({ error: 'At least one return line is required.' }, 400);
    const id = uid('ret');
    await dbRun(env, `
      INSERT INTO order_returns (
        id, merchant_id, order_id, customer_id, status, reason, customer_note, merchant_note, resolution_type,
        items_json, requested_cents, approved_cents, refund_reference, restock_items
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, auth.session.merchantId, order.id, auth.session.customerId, 'requested', body.reason, body.customerNote, '', body.resolutionType, JSON.stringify(body.items), body.requestedCents, 0, '', body.restockItems ? 1 : 0]);
    await appendCustomerOrderEvent(env, order.id, {
      kind: 'return_requested',
      summary: `Return requested for ${order.orderNumber}`,
      status: order.status,
      paymentStatus: order.paymentStatus,
      detail: body.reason || body.customerNote || 'Customer return request created.'
    });
    return json({ ok: true, returnRequest: returnRecord(await dbFirst(env, `SELECT * FROM order_returns WHERE id = ? LIMIT 1`, [id])), order: await getCustomerOrderDetails(env, order.id, auth.session) }, 201);
  }

  if (request.method === 'GET' && url.pathname === '/api/customers/carts') {
    const slug = url.searchParams.get('slug') || '';
    const auth = await requireCustomerSession(request, env, slug);
    if (auth.error) return auth.error;
    const rows = await dbAll(env, `SELECT * FROM saved_carts WHERE customer_id = ? AND merchant_id = ? ORDER BY updated_at DESC`, [auth.session.customerId, auth.session.merchantId]);
    return json({ ok: true, carts: rows.map(savedCartRecord) });
  }

  if (request.method === 'POST' && url.pathname === '/api/customers/carts') {
    const slug = url.searchParams.get('slug') || '';
    const auth = await requireCustomerSession(request, env, slug);
    if (auth.error) return auth.error;
    const payload = normalizeSavedCartInput(await readJson(request) || {});
    if (!payload.items.length) return json({ error: 'At least one cart item is required.' }, 400);
    const id = uid('cart');
    await dbRun(env, `
      INSERT INTO saved_carts (id, merchant_id, customer_id, note, cart_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [id, auth.session.merchantId, auth.session.customerId, payload.note, JSON.stringify(payload)]);
    const row = await dbFirst(env, `SELECT * FROM saved_carts WHERE id = ? LIMIT 1`, [id]);
    return json({ ok: true, cart: savedCartRecord(row) }, 201);
  }

  const cartMatch = url.pathname.match(/^\/api\/customers\/carts\/([^/]+)$/);
  if (cartMatch) {
    const slug = url.searchParams.get('slug') || '';
    const auth = await requireCustomerSession(request, env, slug);
    if (auth.error) return auth.error;
    const id = decodeURIComponent(cartMatch[1]);
    const row = await dbFirst(env, `SELECT * FROM saved_carts WHERE id = ? AND customer_id = ? AND merchant_id = ? LIMIT 1`, [id, auth.session.customerId, auth.session.merchantId]);
    if (!row) return json({ error: 'Saved cart not found.' }, 404);
    if (request.method === 'GET') return json({ ok: true, cart: savedCartRecord(row) });
    if (request.method === 'DELETE') {
      await dbRun(env, `DELETE FROM saved_carts WHERE id = ? AND customer_id = ? AND merchant_id = ?`, [id, auth.session.customerId, auth.session.merchantId]);
      return json({ ok: true, deleted: true });
    }
  }

  return json({ error: `No route for ${request.method} ${url.pathname}` }, 404);
}

export { buildCustomerDisplayName };
