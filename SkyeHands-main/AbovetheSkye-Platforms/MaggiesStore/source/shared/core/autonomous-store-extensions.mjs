import {
  clone,
  ensureId,
  nowIso,
  slugify,
  titleCase,
  defaultState,
  addAudit,
  getPublishedInventory,
  upsertInventoryItem,
  buildStorefrontView,
  buildAeRosterView,
  createBooking,
  createRoutePacket
} from './autonomous-store.mjs';

export {
  clone,
  ensureId,
  nowIso,
  slugify,
  titleCase,
  defaultState,
  addAudit,
  getPublishedInventory,
  upsertInventoryItem,
  buildStorefrontView,
  buildAeRosterView,
  createBooking,
  createRoutePacket
};

export function registerMerchantAccount(state, input) {
  const email = String(input.email || '').trim().toLowerCase();
  if (!email) throw new Error('Email is required.');
  if ((state.merchantUsers || []).some((row) => row.email === email)) throw new Error('A merchant account with that email already exists.');
  const merchantId = ensureId('merchant');
  const userId = ensureId('user');
  state.merchant = {
    id: merchantId,
    status: 'intake',
    storeName: input.storeName,
    slug: slugify(input.storeName),
    contactEmail: email,
    contactPhone: input.contactPhone || '',
    deliveryEnabled: true,
    recurringDeliveryEnabled: true,
    onDemandDeliveryEnabled: true,
    pickupEnabled: true,
    serviceWindows: [
      { id: ensureId('window'), label: 'Friday Evening', day: 'Friday', start: '17:00', end: '20:00', mode: 'recurring' }
    ]
  };
  state.merchantUsers = [{ id: userId, email, pin: String(input.pin || '2468'), name: input.ownerName || 'Merchant Admin', role: 'merchant-admin', status: 'active' }];
  if (!Array.isArray(state.merchantAssignments)) state.merchantAssignments = [];
  if (Array.isArray(state.aeRoster) && state.aeRoster[0]) {
    state.merchantAssignments = [{ merchantId, aeId: state.aeRoster[0].id, status: 'intake' }];
  }
  addAudit(state, 'merchant.registered', input.storeName);
  return { merchantId, userId };
}

export function recommendCategory(rawText = '') {
  const text = String(rawText).toLowerCase();
  if (/vodka|bourbon|whiskey|rum|gin|tequila|spirits/.test(text)) return 'Spirits';
  if (/wine|cabernet|merlot|pinot|chardonnay/.test(text)) return 'Wine';
  if (/beer|ipa|lager|ale|stout/.test(text)) return 'Beer';
  if (/vape|pod|coil|e-?juice|disposable/.test(text)) return 'Vape';
  if (/tobacco|cigar|cigarette|rolling/.test(text)) return 'Tobacco';
  return 'General';
}

export function normalizeInventoryPaste(rawText = '') {
  return String(rawText)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [titleChunk, priceChunk = '0'] = line.split('|').map((part) => part.trim());
      const category = recommendCategory(line);
      return {
        title: titleCase(titleChunk),
        category,
        description: `${titleCase(titleChunk)} normalized from AI setup intake text.`,
        price: Number(String(priceChunk).replace(/[^0-9.]/g, '') || 0),
        stock: 12,
        featured: /featured|bundle|special/.test(line.toLowerCase()),
        deliveryEligible: true,
        pickupEligible: true,
        tags: [slugify(category), 'ai-setup']
      };
    });
}

export function bulkImportNormalizedInventory(state, rawText = '') {
  const normalized = normalizeInventoryPaste(rawText);
  const created = normalized.map((row) => upsertInventoryItem(state, row));
  addAudit(state, 'inventory.bulk-imported', `${created.length} items`);
  return created;
}

export function buildProductDetailView(state, productId) {
  const published = getPublishedInventory(state);
  const product = published.find((item) => item.id === productId) || null;
  const related = product ? published.filter((item) => item.id !== product.id && item.category === product.category).slice(0, 4) : [];
  return { merchant: clone(state.merchant), product, related };
}

export function advanceFulfillment(state, packetId) {
  const packet = (state.routePackets || []).find((row) => row.id === packetId);
  if (!packet) throw new Error('Route packet not found.');
  const booking = (state.bookings || []).find((row) => row.id === packet.bookingId);
  const next = {
    'dispatch-ready': 'pickup-ready',
    'pickup-ready': 'out-for-delivery',
    'out-for-delivery': 'completed',
    'completed': 'completed'
  }[packet.status] || 'dispatch-ready';
  packet.status = next;
  if (booking) {
    booking.routeStatus = next;
    booking.status = next === 'completed' ? 'fulfilled' : 'approved';
    booking.fulfillmentLog = Array.isArray(booking.fulfillmentLog) ? booking.fulfillmentLog : [];
    booking.fulfillmentLog.push({ status: next, createdAt: nowIso() });
  }
  if (next === 'completed') packet.deliveredAt = nowIso();
  addAudit(state, 'route-packet.advanced', `${packet.bookingLabel} · ${next}`);
  return packet;
}

export function buildOnboardingChecklist(state) {
  return [
    { key: 'profile', label: 'Merchant profile captured', done: Boolean(state.merchant?.storeName && state.merchant?.contactEmail) },
    { key: 'user', label: 'Merchant admin user exists', done: Array.isArray(state.merchantUsers) && state.merchantUsers.length > 0 },
    { key: 'inventory', label: 'Inventory seeded', done: Array.isArray(state.inventory) && state.inventory.length > 0 },
    { key: 'published', label: 'Published inventory exists', done: getPublishedInventory(state).length > 0 },
    { key: 'windows', label: 'Delivery windows exist', done: Array.isArray(state.merchant?.serviceWindows) && state.merchant.serviceWindows.length > 0 },
    { key: 'ae', label: 'AE assignment exists', done: Array.isArray(state.merchantAssignments) && state.merchantAssignments.length > 0 }
  ];
}

export function buildSystemProgress(state) {
  const checklist = buildOnboardingChecklist(state);
  const storefront = buildStorefrontView(state);
  const aeView = buildAeRosterView(state);
  const completed = checklist.filter((row) => row.done).length;
  return {
    checklist,
    completionPercent: Math.round((completed / checklist.length) * 100),
    storefrontMetrics: storefront.metrics,
    readiness: aeView.readiness
  };
}

export function createBookingAndRoutePacket(state, payload) {
  const booking = createBooking(state, payload);
  const routePacket = createRoutePacket(state, booking.id, { driverName: 'RoutexFlow Dispatch', dispatchWindow: payload.requestedWindow || 'Next available route window' });
  return { booking, routePacket };
}
