const crypto = require('crypto');
const { canonicalize } = require('./export-import');

function nowIso() { return new Date().toISOString(); }
function stableHash(value) { return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex'); }

function deriveBuyer(value = {}) {
  return { name: value.name || 'Reader', email: value.email || 'reader@local.invalid' };
}

function createCheckoutSession(authorPackage, buyer = {}, options = {}) {
  if (!authorPackage || authorPackage.schema !== 'skye.skydocx.package') {
    throw new Error('Author package required before checkout.');
  }
  const resolvedBuyer = deriveBuyer(buyer);
  const body = {
    schema: 'skye.directsale.checkout.session',
    version: '3.2.0',
    created_at: nowIso(),
    run_id: options.runId || 'direct-sale-run',
    session_id: options.sessionId || `chk_${crypto.randomBytes(6).toString('hex')}`,
    release_slug: authorPackage.slug,
    title: authorPackage.title,
    amount_usd: Number(authorPackage.direct_sale?.price_usd || 0),
    buyer: resolvedBuyer,
    checkout_mode: authorPackage.direct_sale?.checkout_mode || 'direct-first',
    bundle_targets: authorPackage.direct_sale?.bundle_targets || [],
    membership_upsell: authorPackage.direct_sale?.membership_upsell || null,
    status: 'ready'
  };
  return canonicalize({ ...body, integrity_hash: stableHash(body) });
}

function emptyCommerceState() {
  return canonicalize({
    schema: 'skye.directsale.state',
    version: '3.2.0',
    updated_at: nowIso(),
    orders: [],
    entitlements: [],
    library: [],
    analytics: { orders_count: 0, entitlements_count: 0, library_count: 0, gross_usd: 0, latest_ledger_hash: null }
  });
}

function createFulfillmentToken(order, entitlement, libraryItem) {
  return stableHash({ order_id: order.order_id, entitlement_id: entitlement.entitlement_id, library_id: libraryItem.library_id, buyer_email: libraryItem.buyer_email, release_slug: libraryItem.release_slug });
}

function locateExistingPurchase(state, checkoutSession) {
  const base = state && state.schema === 'skye.directsale.state' ? state : emptyCommerceState();
  const order = (base.orders || []).find((item) => item.session_id === checkoutSession.session_id);
  if (!order) return null;
  const entitlement = (base.entitlements || []).find((item) => item.order_id === order.order_id) || null;
  const libraryItem = (base.library || []).find((item) => item.order_id === order.order_id) || null;
  return canonicalize({ order, entitlement, libraryItem });
}

function appendPurchase(state, checkoutSession, options = {}) {
  if (!checkoutSession || checkoutSession.schema !== 'skye.directsale.checkout.session') {
    throw new Error('Checkout session required before purchase completion.');
  }
  const base = state && state.schema === 'skye.directsale.state' ? JSON.parse(JSON.stringify(state)) : emptyCommerceState();
  const existing = locateExistingPurchase(base, checkoutSession);
  if (existing) return canonicalize(base);

  const purchasedAt = nowIso();
  const previousLedgerHash = base.analytics?.latest_ledger_hash || null;

  const orderBody = {
    schema: 'skye.directsale.order',
    version: '3.2.0',
    order_id: options.orderId || `ord_${crypto.randomBytes(6).toString('hex')}`,
    session_id: checkoutSession.session_id,
    purchased_at: purchasedAt,
    buyer: checkoutSession.buyer,
    release_slug: checkoutSession.release_slug,
    title: checkoutSession.title,
    amount_usd: checkoutSession.amount_usd,
    status: 'paid',
    previous_ledger_hash: previousLedgerHash
  };
  const order = canonicalize({ ...orderBody, integrity_hash: stableHash(orderBody) });

  const entitlementBody = {
    schema: 'skye.directsale.entitlement',
    version: '3.2.0',
    entitlement_id: options.entitlementId || `ent_${crypto.randomBytes(6).toString('hex')}`,
    order_id: order.order_id,
    granted_at: purchasedAt,
    buyer_email: checkoutSession.buyer.email,
    release_slug: checkoutSession.release_slug,
    access: ['epub', 'pdf', 'bonus-assets']
  };
  const entitlement = canonicalize({ ...entitlementBody, integrity_hash: stableHash(entitlementBody) });

  const libraryBody = {
    schema: 'skye.directsale.library.item',
    version: '3.2.0',
    library_id: options.libraryId || `lib_${crypto.randomBytes(6).toString('hex')}`,
    order_id: order.order_id,
    entitlement_id: entitlement.entitlement_id,
    added_at: purchasedAt,
    buyer_email: checkoutSession.buyer.email,
    release_slug: checkoutSession.release_slug,
    title: checkoutSession.title,
    download_formats: ['epub', 'pdf'],
    update_channel: 'owned-library'
  };
  const libraryItem = canonicalize({ ...libraryBody, integrity_hash: stableHash(libraryBody), fulfillment_token: createFulfillmentToken(order, entitlement, libraryBody) });

  const ledgerHash = stableHash({
    previousLedgerHash,
    order: { ...orderBody, integrity_hash: order.integrity_hash },
    entitlement,
    libraryItem: { ...libraryBody, integrity_hash: libraryItem.integrity_hash, fulfillment_token: libraryItem.fulfillment_token }
  });

  base.orders.push({ ...order, ledger_hash: ledgerHash });
  base.entitlements.push(entitlement);
  base.library.push({ ...libraryItem, ledger_hash: ledgerHash });
  base.updated_at = purchasedAt;
  base.analytics = {
    orders_count: base.orders.length,
    entitlements_count: base.entitlements.length,
    library_count: base.library.length,
    gross_usd: base.orders.reduce((sum, item) => sum + Number(item.amount_usd || 0), 0),
    latest_ledger_hash: ledgerHash
  };
  return canonicalize(base);
}

function summarizeCommerceState(state) {
  const resolved = state && state.schema === 'skye.directsale.state' ? state : emptyCommerceState();
  const latest = resolved.library[resolved.library.length - 1] || null;
  return canonicalize({
    schema: 'skye.directsale.summary',
    version: '3.2.0',
    updated_at: resolved.updated_at,
    orders_count: resolved.analytics.orders_count,
    entitlements_count: resolved.analytics.entitlements_count,
    library_count: resolved.analytics.library_count,
    gross_usd: resolved.analytics.gross_usd,
    latest_release_slug: latest ? latest.release_slug : null,
    latest_buyer_email: latest ? latest.buyer_email : null,
    latest_ledger_hash: resolved.analytics.latest_ledger_hash || null
  });
}

function verifyCommerceState(state) {
  const resolved = state && state.schema === 'skye.directsale.state' ? state : emptyCommerceState();
  let previousLedgerHash = null;
  const issues = [];
  const seenSessions = new Set();
  for (let index = 0; index < resolved.orders.length; index += 1) {
    const order = resolved.orders[index];
    const entitlement = resolved.entitlements[index];
    const libraryItem = resolved.library[index];
    if (!order || !entitlement || !libraryItem) { issues.push(`missing-record-${index}`); continue; }
    if (seenSessions.has(order.session_id)) issues.push(`duplicate-session-${index}`);
    seenSessions.add(order.session_id);

    const orderBody = { ...order };
    delete orderBody.integrity_hash;
    delete orderBody.ledger_hash;
    if (stableHash(orderBody) !== order.integrity_hash) issues.push(`order-integrity-${index}`);

    const entitlementBody = { ...entitlement };
    delete entitlementBody.integrity_hash;
    if (stableHash(entitlementBody) !== entitlement.integrity_hash) issues.push(`entitlement-integrity-${index}`);

    const libraryBody = { ...libraryItem };
    delete libraryBody.integrity_hash;
    delete libraryBody.fulfillment_token;
    delete libraryBody.ledger_hash;
    if (stableHash(libraryBody) !== libraryItem.integrity_hash) issues.push(`library-integrity-${index}`);

    const expectedToken = createFulfillmentToken(order, entitlement, libraryBody);
    if (expectedToken !== libraryItem.fulfillment_token) issues.push(`fulfillment-token-${index}`);

    const expectedLedgerHash = stableHash({
      previousLedgerHash,
      order: { ...orderBody, integrity_hash: order.integrity_hash },
      entitlement,
      libraryItem: { ...libraryBody, integrity_hash: libraryItem.integrity_hash, fulfillment_token: libraryItem.fulfillment_token }
    });
    if (order.ledger_hash !== expectedLedgerHash || libraryItem.ledger_hash !== expectedLedgerHash) issues.push(`ledger-hash-${index}`);

    previousLedgerHash = expectedLedgerHash;
  }
  return canonicalize({
    schema: 'skye.directsale.verification',
    version: '3.2.0',
    ok: issues.length === 0,
    issues,
    summary: summarizeCommerceState(resolved)
  });
}

module.exports = { stableHash, createCheckoutSession, emptyCommerceState, locateExistingPurchase, appendPurchase, summarizeCommerceState, verifyCommerceState };
