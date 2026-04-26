import { hmacHex, uid } from './utils.js';

function text(value = '') { return String(value || '').trim(); }
function cents(value = 0) { return Math.max(0, Number(value || 0) || 0); }
function int(value = 0) { return Math.max(0, Math.trunc(Number(value || 0) || 0)); }
function jsonParse(raw, fallback) { try { return JSON.parse(raw || ''); } catch { return fallback; } }
function requireHttps(url = '', label = 'URL') {
  const value = text(url);
  if (!value || !/^https:\/\//i.test(value)) throw new Error(`${label} must be an HTTPS URL.`);
  return value;
}

async function parseResponse(response) {
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  return { ok: response.ok, status: response.status, statusText: response.statusText, data };
}

export function normalizePublicCheckoutProvider(body = {}) {
  const provider = text(body.paymentProvider || body.provider || '').toLowerCase();
  const allowed = new Set(['stripe', 'paypal']);
  return allowed.has(provider) ? provider : '';
}

export async function buildPublicOrderAccessToken(secret = '', merchantSlug = '', orderId = '') {
  const key = text(secret);
  if (!key) throw new Error('Public order access secret is required.');
  return hmacHex(key, `${text(merchantSlug)}:${text(orderId)}`);
}

export async function verifyPublicOrderAccessToken(secret = '', merchantSlug = '', orderId = '', token = '') {
  const provided = text(token);
  if (!provided) return false;
  return provided === await buildPublicOrderAccessToken(secret, merchantSlug, orderId);
}

export function buildPublicCheckoutReturnUrls(origin = '', merchantSlug = '', orderId = '', accessToken = '') {
  const base = String(origin || '').replace(/\/$/, '');
  const slug = encodeURIComponent(merchantSlug || '');
  const order = encodeURIComponent(orderId || '');
  const access = accessToken ? `&access=${encodeURIComponent(accessToken)}` : '';
  return {
    returnUrl: `${base}/store/index.html?slug=${slug}&checkout_status=return&order=${order}${access}`,
    cancelUrl: `${base}/store/index.html?slug=${slug}&checkout_status=cancel&order=${order}${access}`
  };
}

export function providerValidationSummary(result = {}) {
  return {
    status: result.status || 'failed',
    httpStatus: Number(result.httpStatus || 0),
    providerReference: result.providerReference || '',
    executed: result.status === 'executed',
    action: result.action || 'health',
    checkedAt: new Date().toISOString()
  };
}

export function warehouseBinRecord(row = {}) {
  if (!row) return null;
  return {
    id: row.id || '', merchantId: row.merchant_id || row.merchantId || '', locationId: row.location_id || row.locationId || '',
    code: row.code || '', label: row.label || '', zone: row.zone || '', aisle: row.aisle || '', shelf: row.shelf || '', active: Boolean(Number(row.active ?? 1)),
    createdAt: row.created_at || row.createdAt || '', updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function normalizeWarehouseBinInput(body = {}) {
  return { locationId: text(body.locationId || body.location_id), code: text(body.code).toUpperCase(), label: text(body.label || body.code), zone: text(body.zone), aisle: text(body.aisle), shelf: text(body.shelf), active: body.active !== false && body.active !== 'false' };
}

export function warehouseBinInventoryRecord(row = {}) {
  if (!row) return null;
  return { id: row.id || '', merchantId: row.merchant_id || '', binId: row.bin_id || '', productId: row.product_id || '', variantId: row.variant_id || '', quantity: int(row.quantity), reservedQuantity: int(row.reserved_quantity), updatedAt: row.updated_at || '' };
}

export function normalizeBinInventoryInput(body = {}) {
  return { binId: text(body.binId || body.bin_id), productId: text(body.productId || body.product_id), variantId: text(body.variantId || body.variant_id), quantity: int(body.quantity), reservedQuantity: int(body.reservedQuantity || body.reserved_quantity) };
}

export function buildPickListFromOrder({ order = {}, bins = [] } = {}) {
  const lines = (order.items || []).map((item, index) => {
    const matches = bins.filter((bin) => bin.productId === item.productId && (!item.variantId || bin.variantId === item.variantId) && Number(bin.quantity || 0) > 0);
    let remaining = int(item.quantity || 1);
    const allocations = [];
    for (const bin of matches) {
      if (!remaining) break;
      const available = Math.max(0, int(bin.quantity) - int(bin.reservedQuantity));
      const take = Math.min(available, remaining);
      if (take > 0) {
        allocations.push({ binId: bin.binId || bin.bin_id || bin.id, quantity: take });
        remaining -= take;
      }
    }
    return { id: uid('pli'), lineIndex: index, productId: item.productId, variantId: item.variantId || '', title: item.title || '', requestedQuantity: int(item.quantity || 1), allocatedQuantity: int(item.quantity || 1) - remaining, remainingQuantity: remaining, status: remaining > 0 ? 'short' : 'open', allocations };
  });
  return { status: lines.some((line) => line.remainingQuantity > 0) ? 'short' : 'open', lines };
}

export function pickListRecord(row = {}) {
  if (!row) return null;
  return { id: row.id || '', merchantId: row.merchant_id || '', orderId: row.order_id || '', workOrderId: row.work_order_id || '', status: row.status || 'open', lines: jsonParse(row.lines_json, []), createdAt: row.created_at || '', updatedAt: row.updated_at || '' };
}

export function routeDriverRecord(row = {}) {
  if (!row) return null;
  return { id: row.id || '', merchantId: row.merchant_id || '', name: row.name || '', phone: row.phone || '', email: row.email || '', status: row.status || 'active', createdAt: row.created_at || '' };
}

export function normalizeRouteDriverInput(body = {}) {
  return { name: text(body.name), phone: text(body.phone), email: text(body.email).toLowerCase(), status: text(body.status || 'active').toLowerCase() };
}

export function routeVehicleRecord(row = {}) {
  if (!row) return null;
  return { id: row.id || '', merchantId: row.merchant_id || '', driverId: row.driver_id || '', label: row.label || '', capacity: int(row.capacity), status: row.status || 'active', createdAt: row.created_at || '' };
}

export function normalizeRouteVehicleInput(body = {}) {
  return { driverId: text(body.driverId || body.driver_id), label: text(body.label), capacity: int(body.capacity || 1), status: text(body.status || 'active').toLowerCase() };
}

function dist(a = {}, b = {}) {
  const ax = Number(a.lat ?? a.latitude ?? 0); const ay = Number(a.lng ?? a.longitude ?? 0);
  const bx = Number(b.lat ?? b.latitude ?? 0); const by = Number(b.lng ?? b.longitude ?? 0);
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
}

export function buildRoutePlan({ stops = [], start = {} } = {}) {
  const remaining = stops.map((stop, index) => ({ ...stop, originalIndex: index, sequence: 0 }));
  const ordered = [];
  let current = start;
  while (remaining.length) {
    remaining.sort((a, b) => dist(current, a) - dist(current, b));
    const next = remaining.shift();
    next.sequence = ordered.length + 1;
    ordered.push(next);
    current = next;
  }
  return { stopCount: ordered.length, stops: ordered, distanceScore: ordered.reduce((sum, stop, index) => sum + dist(index ? ordered[index - 1] : start, stop), 0) };
}

export function routePlanRecord(row = {}) {
  if (!row) return null;
  return { id: row.id || '', merchantId: row.merchant_id || '', driverId: row.driver_id || '', vehicleId: row.vehicle_id || '', status: row.status || 'planned', routeDate: row.route_date || '', stops: jsonParse(row.stops_json, []), createdAt: row.created_at || '', updatedAt: row.updated_at || '' };
}

export function routePlanEventRecord(row = {}) {
  if (!row) return null;
  return {
    id: row.id || '', merchantId: row.merchant_id || '', routePlanId: row.route_plan_id || '', stopId: row.stop_id || '',
    orderId: row.order_id || '', returnPickupId: row.return_pickup_id || '', eventType: row.event_type || '', status: row.status || 'recorded',
    proof: jsonParse(row.proof_json, {}), actor: row.actor || '', createdAt: row.created_at || ''
  };
}

export function normalizeRoutePlanInput(body = {}) {
  return { driverId: text(body.driverId || body.driver_id), vehicleId: text(body.vehicleId || body.vehicle_id), routeDate: text(body.routeDate || body.route_date || new Date().toISOString().slice(0, 10)), start: body.start || {}, stops: Array.isArray(body.stops) ? body.stops : [] };
}

export function returnPickupRecord(row = {}) {
  if (!row) return null;
  return { id: row.id || '', merchantId: row.merchant_id || '', returnId: row.return_id || '', driverId: row.driver_id || '', status: row.status || 'scheduled', pickupWindowStart: row.pickup_window_start || '', pickupWindowEnd: row.pickup_window_end || '', address: jsonParse(row.address_json, {}), createdAt: row.created_at || '' };
}

export function normalizeReturnPickupInput(body = {}) {
  return { returnId: text(body.returnId || body.return_id), driverId: text(body.driverId || body.driver_id), pickupWindowStart: text(body.pickupWindowStart || body.pickup_window_start), pickupWindowEnd: text(body.pickupWindowEnd || body.pickup_window_end), address: body.address || {} };
}

export async function executeStripeTerminalPayment({ stripeSecretKey = '', readerId = '', amountCents = 0, currency = 'USD', orderRef = '', fetcher = fetch } = {}) {
  if (!text(stripeSecretKey)) throw Object.assign(new Error('STRIPE_SECRET_KEY is required for card-present terminal payments.'), { code: 'STRIPE_TERMINAL_SECRET_REQUIRED' });
  if (!text(readerId)) throw Object.assign(new Error('readerId is required for card-present terminal payment.'), { code: 'TERMINAL_READER_REQUIRED' });
  const headers = { authorization: `Bearer ${stripeSecretKey}`, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' };
  const body = new URLSearchParams({ amount: String(cents(amountCents)), currency: String(currency || 'USD').toLowerCase(), 'payment_method_types[]': 'card_present', capture_method: 'automatic', 'metadata[order_ref]': orderRef }).toString();
  const intent = await parseResponse(await fetcher('https://api.stripe.com/v1/payment_intents', { method: 'POST', headers, body }));
  if (!intent.ok || !intent.data?.id) return { status: 'failed', stage: 'payment_intent', httpStatus: intent.status, response: intent.data };
  const reader = await parseResponse(await fetcher(`https://api.stripe.com/v1/terminal/readers/${encodeURIComponent(readerId)}/process_payment_intent`, { method: 'POST', headers, body: new URLSearchParams({ payment_intent: intent.data.id }).toString() }));
  return { status: reader.ok ? 'processing' : 'failed', stage: 'reader_process', httpStatus: reader.status, providerReference: intent.data.id, readerResponse: reader.data, intent: intent.data };
}

export function terminalPaymentRecord(row = {}) {
  if (!row) return null;
  return { id: row.id || '', merchantId: row.merchant_id || '', cartId: row.cart_id || '', orderId: row.order_id || '', readerId: row.reader_id || '', providerReference: row.provider_reference || '', status: row.status || 'processing', amountCents: cents(row.amount_cents), currency: row.currency || 'USD', payload: jsonParse(row.payload_json, {}), createdAt: row.created_at || '' };
}

export function cashDrawerEventRecord(row = {}) {
  if (!row) return null;
  return { id: row.id || '', merchantId: row.merchant_id || '', registerId: row.register_id || '', shiftId: row.shift_id || '', eventType: row.event_type || '', amountCents: cents(row.amount_cents), reason: row.reason || '', createdAt: row.created_at || '' };
}

export function normalizeCashDrawerEventInput(body = {}) {
  return { registerId: text(body.registerId || body.register_id), shiftId: text(body.shiftId || body.shift_id), eventType: text(body.eventType || body.event_type || 'open').toLowerCase(), amountCents: cents(body.amountCents || body.amount_cents), reason: text(body.reason) };
}

export async function executeReceiptPrinterJob({ url = '', secret = '', receipt = {}, fetcher = fetch } = {}) {
  const endpoint = requireHttps(url, 'receipt printer endpoint');
  if (!text(secret)) throw new Error('Receipt printer secret is required.');
  const raw = JSON.stringify(receipt);
  const sig = await hmacHex(secret, raw);
  const response = await parseResponse(await fetcher(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-skye-signature': `sha256=${sig}`, 'x-skye-event': 'pos.receipt.print' }, body: raw }));
  return { status: response.ok ? 'delivered' : 'failed', httpStatus: response.status, response: response.data };
}

export function buildEndOfDayReconciliation({ shifts = [], carts = [], drawerEvents = [] } = {}) {
  const salesCents = carts.filter((cart) => cart.status === 'paid').reduce((sum, cart) => sum + cents(cart.total_cents ?? cart.totalCents), 0);
  const cashSalesCents = carts.filter((cart) => String(cart.tenders_json || '').includes('"type":"cash"')).reduce((sum, cart) => sum + cents(cart.total_cents ?? cart.totalCents), 0);
  const drawerAdjustmentsCents = drawerEvents.reduce((sum, event) => sum + (event.event_type === 'paid_out' ? -cents(event.amount_cents) : cents(event.amount_cents)), 0);
  const openingCashCents = shifts.reduce((sum, shift) => sum + cents(shift.opening_cash_cents), 0);
  const closingCashCents = shifts.reduce((sum, shift) => sum + cents(shift.closing_cash_cents), 0);
  const expectedCashCents = openingCashCents + cashSalesCents + drawerAdjustmentsCents;
  return { salesCents, cashSalesCents, drawerAdjustmentsCents, openingCashCents, closingCashCents, expectedCashCents, varianceCents: closingCashCents - expectedCashCents, shiftCount: shifts.length, cartCount: carts.length };
}

export function offlineSyncEventRecord(row = {}) {
  if (!row) return null;
  return { id: row.id || '', merchantId: row.merchant_id || '', deviceId: row.device_id || '', sequence: int(row.sequence), eventType: row.event_type || '', status: row.status || 'accepted', payloadHash: row.payload_hash || '', createdAt: row.created_at || '' };
}

export function buildTaxFilingPayload({ merchant = {}, orders = [], nexusRules = [], period = {} } = {}) {
  const taxCollectedCents = orders.reduce((sum, order) => sum + cents(order.tax_cents ?? order.taxCents), 0);
  const grossSalesCents = orders.reduce((sum, order) => sum + cents(order.total_cents ?? order.totalCents), 0);
  return { merchant: { id: merchant.id, slug: merchant.slug, brandName: merchant.brandName || merchant.brand_name }, period, grossSalesCents, taxCollectedCents, orderCount: orders.length, nexusRules };
}

export async function executeSignedProviderPost({ url = '', secret = '', payload = {}, eventType = 'commerce.provider' } = {}) {
  const endpoint = requireHttps(url, 'provider endpoint');
  if (!text(secret)) throw new Error('Provider signing secret is required.');
  const raw = JSON.stringify(payload);
  const sig = await hmacHex(secret, raw);
  const response = await parseResponse(await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-skye-event': eventType, 'x-skye-signature': `sha256=${sig}` }, body: raw }));
  return { status: response.ok ? 'submitted' : 'failed', httpStatus: response.status, response: response.data };
}

export function pciControlRecord(row = {}) {
  if (!row) return null;
  return { id: row.id || '', merchantId: row.merchant_id || '', controlKey: row.control_key || '', title: row.title || '', status: row.status || 'open', evidenceUrl: row.evidence_url || '', owner: row.owner || '', updatedAt: row.updated_at || '' };
}

export function normalizePciControlInput(body = {}) {
  return { controlKey: text(body.controlKey || body.control_key), title: text(body.title), status: text(body.status || 'open').toLowerCase(), evidenceUrl: text(body.evidenceUrl || body.evidence_url), owner: text(body.owner) };
}

export function developerAccountRecord(row = {}) {
  if (!row) return null;
  return { id: row.id || '', merchantId: row.merchant_id || '', name: row.name || '', email: row.email || '', status: row.status || 'active', payoutShareBps: int(row.payout_share_bps), createdAt: row.created_at || '' };
}

export function normalizeDeveloperAccountInput(body = {}) {
  return { name: text(body.name), email: text(body.email).toLowerCase(), status: text(body.status || 'active').toLowerCase(), payoutShareBps: int(body.payoutShareBps || body.payout_share_bps || 7000) };
}

export function appReviewSubmissionRecord(row = {}) {
  if (!row) return null;
  return { id: row.id || '', merchantId: row.merchant_id || '', appId: row.app_id || '', developerId: row.developer_id || '', status: row.status || 'submitted', checklist: jsonParse(row.checklist_json, {}), reviewerNotes: row.reviewer_notes || '', reviewedAt: row.reviewed_at || '', createdAt: row.created_at || '', updatedAt: row.updated_at || '' };
}

export function appSettlementRecord(row = {}) {
  if (!row) return null;
  return { id: row.id || '', merchantId: row.merchant_id || '', developerId: row.developer_id || '', periodStart: row.period_start || '', periodEnd: row.period_end || '', grossCents: cents(row.gross_cents), platformFeeCents: cents(row.platform_fee_cents), developerPayoutCents: cents(row.developer_payout_cents), status: row.status || 'open', payoutReference: row.payout_reference || '', paidAt: row.paid_at || '', createdAt: row.created_at || '' };
}

export function buildAppSettlement({ developer = {}, invoices = [], periodStart = '', periodEnd = '', platformFeeBps = 3000 } = {}) {
  const grossCents = invoices.reduce((sum, invoice) => sum + cents(invoice.total_cents ?? invoice.totalCents), 0);
  const platformFeeCents = Math.round(grossCents * int(platformFeeBps) / 10000);
  return { developerId: developer.id, periodStart, periodEnd, grossCents, platformFeeCents, developerPayoutCents: Math.max(0, grossCents - platformFeeCents), status: 'open' };
}

export function buildOAuthInstallSession({ app = {}, installation = {}, origin = '', state = '' } = {}) {
  const url = app.appUrl || app.app_url || '';
  requireHttps(url, 'app OAuth URL');
  const params = new URLSearchParams({ client_id: app.appKey || app.app_key || app.id, installation_id: installation.id || '', state, redirect_uri: `${String(origin || '').replace(/\/$/, '')}/api/app-installations/oauth/callback` });
  return { installUrl: `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`, state };
}


export function normalizePickScanInput(body = {}) {
  return {
    lineId: text(body.lineId || body.line_id),
    binId: text(body.binId || body.bin_id),
    quantity: Math.max(1, int(body.quantity || 1)),
    packed: body.packed === true || body.packed === 'true'
  };
}

export function applyPickScanToLines(lines = [], scan = {}) {
  const next = Array.isArray(lines) ? JSON.parse(JSON.stringify(lines)) : [];
  const line = next.find((item) => String(item.id || '') === String(scan.lineId || ''));
  if (!line) throw Object.assign(new Error('Pick-list line not found.'), { code: 'PICK_LINE_NOT_FOUND' });
  const allocations = Array.isArray(line.allocations) ? line.allocations : [];
  const allocation = allocations.find((item) => String(item.binId || item.bin_id || '') === String(scan.binId || ''));
  if (!allocation) throw Object.assign(new Error('Bin is not allocated to this pick-list line.'), { code: 'PICK_BIN_NOT_ALLOCATED' });
  const allowed = Math.max(0, int(allocation.quantity) - int(allocation.pickedQuantity));
  if (scan.quantity > allowed) throw Object.assign(new Error('Scan quantity exceeds allocated remaining quantity.'), { code: 'PICK_SCAN_EXCEEDS_ALLOCATION' });
  allocation.pickedQuantity = int(allocation.pickedQuantity) + scan.quantity;
  line.pickedQuantity = int(line.pickedQuantity) + scan.quantity;
  line.packedQuantity = int(line.packedQuantity) + (scan.packed ? scan.quantity : 0);
  const requested = int(line.requestedQuantity || line.quantity || 0);
  const remaining = Math.max(0, requested - int(line.pickedQuantity));
  line.remainingQuantity = remaining;
  const fullyPicked = remaining === 0;
  const fullyPacked = fullyPicked && int(line.packedQuantity) >= requested;
  line.status = fullyPacked ? 'packed' : (fullyPicked ? 'picked' : 'picking');
  const overallPacked = next.length > 0 && next.every((item) => String(item.status || '') === 'packed');
  const overallPicked = next.length > 0 && next.every((item) => ['picked', 'packed'].includes(String(item.status || '')));
  const overallPicking = next.some((item) => ['picking', 'picked', 'packed'].includes(String(item.status || '')));
  const status = overallPacked ? 'packed' : (overallPicked ? 'picked' : (overallPicking ? 'picking' : 'open'));
  return { status, lines: next };
}

export function normalizeRoutePlanPatch(body = {}, existing = {}) {
  const allowed = new Set(['planned', 'dispatched', 'in_progress', 'completed', 'cancelled']);
  const requested = text(body.status || existing.status || 'planned').toLowerCase();
  return {
    driverId: text(body.driverId || body.driver_id || existing.driverId || existing.driver_id),
    vehicleId: text(body.vehicleId || body.vehicle_id || existing.vehicleId || existing.vehicle_id),
    routeDate: text(body.routeDate || body.route_date || existing.routeDate || existing.route_date),
    status: allowed.has(requested) ? requested : 'planned',
    stops: Array.isArray(body.stops) ? body.stops : jsonParse(existing.stops_json || existing.stops, [])
  };
}

export function normalizeReturnPickupPatch(body = {}, existing = {}) {
  const allowed = new Set(['scheduled', 'assigned', 'in_progress', 'picked_up', 'completed', 'cancelled', 'failed']);
  const requested = text(body.status || existing.status || 'scheduled').toLowerCase();
  return {
    driverId: text(body.driverId || body.driver_id || existing.driverId || existing.driver_id),
    status: allowed.has(requested) ? requested : 'scheduled',
    pickupWindowStart: text(body.pickupWindowStart || body.pickup_window_start || existing.pickupWindowStart || existing.pickup_window_start),
    pickupWindowEnd: text(body.pickupWindowEnd || body.pickup_window_end || existing.pickupWindowEnd || existing.pickup_window_end),
    address: body.address || jsonParse(existing.address_json || existing.address, {})
  };
}

export function normalizeRouteStopEventInput(body = {}) {
  const allowed = new Set(['arrived', 'delivered', 'failed', 'skipped', 'picked_up']);
  const eventType = text(body.eventType || body.event_type || 'arrived').toLowerCase();
  const status = text(body.status || eventType || 'arrived').toLowerCase();
  return {
    eventType: allowed.has(eventType) ? eventType : 'arrived',
    status: allowed.has(status) ? status : 'arrived',
    actor: text(body.actor || body.driverName || body.driver_name),
    note: text(body.note),
    proofUrl: text(body.proofUrl || body.proof_url),
    latitude: body.latitude === undefined || body.latitude === '' ? null : Number(body.latitude),
    longitude: body.longitude === undefined || body.longitude === '' ? null : Number(body.longitude),
    occurredAt: text(body.occurredAt || body.occurred_at || new Date().toISOString())
  };
}

export function applyRouteStopEventToStops(stops = [], stopId = '', event = {}) {
  const next = Array.isArray(stops) ? JSON.parse(JSON.stringify(stops)) : [];
  const stop = next.find((item) => String(item.id || item.stopId || '') === String(stopId || ''));
  if (!stop) throw Object.assign(new Error('Route stop not found.'), { code: 'ROUTE_STOP_NOT_FOUND' });
  const terminal = new Set(['delivered', 'failed', 'skipped', 'picked_up']);
  stop.lastEventType = event.eventType || 'arrived';
  stop.status = event.status || event.eventType || 'arrived';
  stop.occurredAt = event.occurredAt || new Date().toISOString();
  stop.proof = {
    ...(stop.proof && typeof stop.proof === 'object' ? stop.proof : {}),
    note: event.note || '',
    proofUrl: event.proofUrl || '',
    latitude: Number.isFinite(event.latitude) ? event.latitude : null,
    longitude: Number.isFinite(event.longitude) ? event.longitude : null,
    actor: event.actor || '',
    occurredAt: stop.occurredAt
  };
  const routeStatus = next.every((item) => terminal.has(String(item.status || '').toLowerCase()))
    ? 'completed'
    : (next.some((item) => ['arrived', 'delivered', 'failed', 'skipped', 'picked_up'].includes(String(item.status || '').toLowerCase())) ? 'in_progress' : 'planned');
  return { status: routeStatus, stops: next, stop };
}

export function normalizeDeveloperAccountPatch(body = {}, existing = {}) {
  return {
    name: text(body.name || existing.name),
    email: text(body.email || existing.email).toLowerCase(),
    status: text(body.status || existing.status || 'active').toLowerCase(),
    payoutShareBps: int(body.payoutShareBps ?? body.payout_share_bps ?? existing.payoutShareBps ?? existing.payout_share_bps ?? 7000)
  };
}

export function normalizeAppReviewPatch(body = {}, existing = {}) {
  const allowed = new Set(['submitted', 'in_review', 'approved', 'changes_requested', 'rejected']);
  const requested = text(body.status || existing.status || 'submitted').toLowerCase();
  return {
    status: allowed.has(requested) ? requested : 'submitted',
    checklist: body.checklist && typeof body.checklist === 'object' ? body.checklist : jsonParse(existing.checklist_json || existing.checklist, {}),
    reviewerNotes: text(body.reviewerNotes || body.reviewer_notes || existing.reviewerNotes || existing.reviewer_notes)
  };
}

export function normalizeAppSettlementPatch(body = {}, existing = {}) {
  const allowed = new Set(['open', 'processing', 'paid', 'voided']);
  const requested = text(body.status || existing.status || 'open').toLowerCase();
  return {
    status: allowed.has(requested) ? requested : 'open',
    payoutReference: text(body.payoutReference || body.payout_reference || existing.payoutReference || existing.payout_reference)
  };
}
