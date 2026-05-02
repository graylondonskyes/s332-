export const STORAGE_KEY = 'ae-autonomous-store-system-maggies-v1';

let sequence = 1;

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function ensureId(prefix = 'id') {
  const token = `${Date.now().toString(36)}-${sequence++}`;
  return `${prefix}-${token}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function slugify(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

export function titleCase(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function defaultState(seed = {}) {
  const state = clone(seed || {});
  state.merchant = state.merchant || {};
  state.merchantUsers = Array.isArray(state.merchantUsers) ? state.merchantUsers : [];
  state.inventory = Array.isArray(state.inventory) ? state.inventory : [];
  state.featuredInventoryIds = Array.isArray(state.featuredInventoryIds) ? state.featuredInventoryIds : [];
  state.bookings = Array.isArray(state.bookings) ? state.bookings : [];
  state.routePackets = Array.isArray(state.routePackets) ? state.routePackets : [];
  state.aeRoster = Array.isArray(state.aeRoster) ? state.aeRoster : [];
  state.merchantAssignments = Array.isArray(state.merchantAssignments) ? state.merchantAssignments : [];
  state.bookingSettings = state.bookingSettings || {};
  state.audit = Array.isArray(state.audit) ? state.audit : [];
  state.sync = state.sync || { publishedAt: null, lastInventoryMutationAt: null, source: 'merchant-admin' };
  return state;
}

export function addAudit(state, type, detail = '') {
  state.audit.unshift({ id: ensureId('audit'), type, detail, createdAt: nowIso() });
  state.audit = state.audit.slice(0, 40);
  return state;
}

export function authenticateMerchant(state, email, pin) {
  const user = state.merchantUsers.find((entry) => entry.email === email && entry.pin === pin && entry.status === 'active');
  if (!user) return null;
  return { id: ensureId('session'), userId: user.id, role: user.role, name: user.name, email: user.email, createdAt: nowIso() };
}

export function upsertInventoryItem(state, input) {
  const existing = state.inventory.find((item) => item.id === input.id);
  if (existing) {
    Object.assign(existing, {
      title: input.title,
      category: input.category,
      description: input.description,
      price: Number(input.price || 0),
      stock: Number(input.stock || 0),
      image: input.image || '',
      featured: Boolean(input.featured),
      deliveryEligible: Boolean(input.deliveryEligible),
      pickupEligible: Boolean(input.pickupEligible),
      tags: Array.isArray(input.tags) ? input.tags : String(input.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
      updatedAt: nowIso()
    });
    addAudit(state, 'inventory.updated', existing.title);
    state.sync.lastInventoryMutationAt = nowIso();
    return existing;
  }
  const created = {
    id: ensureId('item'),
    status: 'draft',
    title: input.title,
    category: input.category,
    description: input.description,
    price: Number(input.price || 0),
    stock: Number(input.stock || 0),
    image: input.image || '',
    featured: Boolean(input.featured),
    deliveryEligible: Boolean(input.deliveryEligible),
    pickupEligible: Boolean(input.pickupEligible),
    tags: Array.isArray(input.tags) ? input.tags : String(input.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  state.inventory.unshift(created);
  addAudit(state, 'inventory.created', created.title);
  state.sync.lastInventoryMutationAt = nowIso();
  return created;
}

export function deleteInventoryItem(state, itemId) {
  const item = state.inventory.find((entry) => entry.id === itemId);
  state.inventory = state.inventory.filter((entry) => entry.id !== itemId);
  state.featuredInventoryIds = state.featuredInventoryIds.filter((entry) => entry !== itemId);
  addAudit(state, 'inventory.deleted', item ? item.title : itemId);
  state.sync.lastInventoryMutationAt = nowIso();
  return state;
}

export function setInventoryPublished(state, itemId, published) {
  const item = state.inventory.find((entry) => entry.id === itemId);
  if (!item) throw new Error(`Inventory item not found: ${itemId}`);
  item.status = published ? 'published' : 'draft';
  item.updatedAt = nowIso();
  if (item.featured && published && !state.featuredInventoryIds.includes(item.id)) state.featuredInventoryIds.push(item.id);
  if (!published) state.featuredInventoryIds = state.featuredInventoryIds.filter((entry) => entry !== item.id);
  state.sync.publishedAt = published ? nowIso() : state.sync.publishedAt;
  state.sync.lastInventoryMutationAt = nowIso();
  addAudit(state, published ? 'inventory.published' : 'inventory.unpublished', item.title);
  return item;
}

export function getPublishedInventory(state) {
  return state.inventory.filter((item) => item.status === 'published' && Number(item.stock || 0) > 0);
}

export function buildStorefrontView(state) {
  const publishedInventory = getPublishedInventory(state);
  const featuredInventory = publishedInventory.filter((item) => state.featuredInventoryIds.includes(item.id) || item.featured);
  return {
    merchant: clone(state.merchant),
    publishedInventory,
    featuredInventory,
    metrics: {
      publishedCount: publishedInventory.length,
      featuredCount: featuredInventory.length,
      bookingCount: state.bookings.length,
      routePacketCount: state.routePackets.length
    }
  };
}

export function createBooking(state, input) {
  const item = state.inventory.find((entry) => entry.id === input.itemId);
  if (!item || item.status !== 'published') throw new Error('Selected item is not currently available for booking.');
  const booking = {
    id: ensureId('booking'),
    itemId: item.id,
    itemTitle: item.title,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    address: input.address,
    requestedWindow: input.requestedWindow,
    notes: input.notes || '',
    status: 'submitted',
    routeStatus: 'pending',
    createdAt: nowIso()
  };
  state.bookings.unshift(booking);
  addAudit(state, 'booking.created', `${booking.customerName} · ${booking.itemTitle}`);
  return booking;
}

export function createRoutePacket(state, bookingId, overrides = {}) {
  const booking = state.bookings.find((entry) => entry.id === bookingId);
  if (!booking) throw new Error(`Booking not found: ${bookingId}`);
  const existing = state.routePackets.find((entry) => entry.bookingId === bookingId);
  if (existing) return existing;
  const packet = {
    id: ensureId('route'),
    bookingId,
    bookingLabel: `${booking.customerName} · ${booking.itemTitle}`,
    pickupReady: Boolean(overrides.pickupReady ?? true),
    driverName: overrides.driverName || 'Unassigned Driver',
    dispatchWindow: overrides.dispatchWindow || booking.requestedWindow || 'TBD',
    status: 'dispatch-ready',
    createdAt: nowIso()
  };
  state.routePackets.unshift(packet);
  booking.routeStatus = 'dispatch-ready';
  booking.status = 'approved';
  addAudit(state, 'route-packet.created', packet.bookingLabel);
  return packet;
}

export function computeMerchantLaunchReadiness(state) {
  const publishedCount = getPublishedInventory(state).length;
  const score = [
    state.merchant.storeName ? 20 : 0,
    state.merchant.deliveryEnabled ? 20 : 0,
    publishedCount > 0 ? 20 : 0,
    state.merchantUsers.length > 0 ? 20 : 0,
    state.aeRoster.length > 0 ? 20 : 0
  ].reduce((sum, value) => sum + value, 0);
  return { score, status: score >= 80 ? 'launch-ready' : score >= 60 ? 'in-progress' : 'intake' };
}

export function buildAeRosterView(state) {
  const readiness = computeMerchantLaunchReadiness(state);
  const assignment = state.merchantAssignments[0] || null;
  const ae = assignment ? state.aeRoster.find((entry) => entry.id === assignment.aeId) : null;
  return {
    readiness,
    merchantRows: [
      {
        merchantId: state.merchant.id,
        storeName: state.merchant.storeName,
        assignedAe: ae ? ae.name : 'Unassigned',
        assignmentStatus: assignment ? assignment.status : 'unassigned',
        publishedInventory: getPublishedInventory(state).length,
        bookingCount: state.bookings.length,
        routePacketCount: state.routePackets.length
      }
    ],
    aeRows: state.aeRoster.map((entry) => ({
      id: entry.id,
      name: entry.name,
      title: entry.title,
      lane: entry.lane,
      status: entry.status,
      assignedMerchantCount: state.merchantAssignments.filter((assignmentRow) => assignmentRow.aeId === entry.id).length
    }))
  };
}
