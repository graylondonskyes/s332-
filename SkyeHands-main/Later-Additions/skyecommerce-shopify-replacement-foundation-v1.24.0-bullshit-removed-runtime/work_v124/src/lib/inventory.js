import { slugify } from './utils.js';

export const INVENTORY_ADJUSTMENT_KINDS = ['set', 'add', 'remove', 'receive', 'restock', 'correction'];

function normalizedText(value = '') {
  return String(value || '').trim();
}

function boolish(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true' || value === '1' || value === 1;
}

function clampInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.trunc(parsed);
}

function coerceEnum(value, allowed, fallback) {
  const normalized = normalizedText(value).toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

export function locationRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    merchantId: row.merchant_id || row.merchantId || '',
    name: row.name || '',
    code: row.code || '',
    priority: Number(row.priority || 0),
    active: Boolean(Number(row.active ?? 1)),
    isDefault: Boolean(Number(row.is_default ?? row.isDefault ?? 0)),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function inventoryLevelRecord(row) {
  if (!row) return null;
  return {
    locationId: row.location_id || row.locationId || '',
    productId: row.product_id || row.productId || '',
    available: Number(row.available || 0),
    reserved: Number(row.reserved || 0),
    inbound: Number(row.inbound || 0),
    locationName: row.location_name || row.locationName || '',
    locationCode: row.location_code || row.locationCode || '',
    priority: Number(row.priority || 0),
    active: Boolean(Number(row.active ?? 1)),
    isDefault: Boolean(Number(row.is_default ?? row.isDefault ?? 0)),
    productTitle: row.product_title || row.productTitle || '',
    productSku: row.product_sku || row.productSku || ''
  };
}

export function inventoryAdjustmentRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    merchantId: row.merchant_id || row.merchantId || '',
    locationId: row.location_id || row.locationId || '',
    productId: row.product_id || row.productId || '',
    kind: row.kind || 'correction',
    delta: Number(row.delta || 0),
    beforeAvailable: Number(row.before_available || row.beforeAvailable || 0),
    afterAvailable: Number(row.after_available || row.afterAvailable || 0),
    note: row.note || '',
    reference: row.reference || '',
    createdAt: row.created_at || row.createdAt || '',
    locationName: row.location_name || '',
    productTitle: row.product_title || ''
  };
}

export function orderAllocationRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id || row.orderId || '',
    productId: row.product_id || row.productId || '',
    locationId: row.location_id || row.locationId || '',
    quantity: Number(row.quantity || 0),
    createdAt: row.created_at || row.createdAt || '',
    locationName: row.location_name || '',
    locationCode: row.location_code || ''
  };
}

export function normalizeInventoryLocationInput(body = {}, existing = {}) {
  const name = normalizedText(body.name || existing.name || 'Primary warehouse');
  const rawCode = normalizedText(body.code || existing.code || name || 'primary') || 'primary';
  return {
    name,
    code: slugify(rawCode).replace(/-/g, '_').toUpperCase() || 'PRIMARY',
    priority: Math.max(0, clampInt(body.priority, Number(existing.priority || 0))),
    active: boolish(body.active, existing.active ?? true),
    isDefault: boolish(body.isDefault, existing.isDefault ?? false)
  };
}

export function normalizeInventoryAdjustmentInput(body = {}) {
  return {
    productId: normalizedText(body.productId || ''),
    locationId: normalizedText(body.locationId || ''),
    kind: coerceEnum(body.kind, INVENTORY_ADJUSTMENT_KINDS, 'correction'),
    delta: clampInt(body.delta ?? body.quantity ?? 0, 0),
    note: normalizedText(body.note || ''),
    reference: normalizedText(body.reference || '')
  };
}

export function allocateInventoryDemand(levels = [], demand = 0) {
  const requested = Math.max(0, clampInt(demand, 0));
  const sorted = [...(Array.isArray(levels) ? levels : [])]
    .filter((level) => Number(level.available || 0) > 0 && level.active !== false)
    .sort((a, b) => {
      const defaultScore = Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault));
      if (defaultScore) return defaultScore;
      const priorityScore = Number(a.priority || 0) - Number(b.priority || 0);
      if (priorityScore) return priorityScore;
      return Number(b.available || 0) - Number(a.available || 0);
    });
  const totalAvailable = sorted.reduce((sum, level) => sum + Number(level.available || 0), 0);
  if (requested <= 0) return { ok: true, requested: 0, totalAvailable, allocations: [] };
  if (totalAvailable < requested) return { ok: false, requested, totalAvailable, allocations: [] };
  let remaining = requested;
  const allocations = [];
  for (const level of sorted) {
    if (!remaining) break;
    const available = Math.max(0, Number(level.available || 0));
    if (!available) continue;
    const quantity = Math.min(available, remaining);
    allocations.push({
      locationId: level.locationId || level.location_id,
      productId: level.productId || level.product_id,
      quantity,
      locationName: level.locationName || level.location_name || '',
      locationCode: level.locationCode || level.location_code || ''
    });
    remaining -= quantity;
  }
  return { ok: remaining === 0, requested, totalAvailable, allocations };
}

export function summarizeInventory(levels = []) {
  const normalized = (Array.isArray(levels) ? levels : []).map(inventoryLevelRecord).filter(Boolean);
  return {
    locationCount: normalized.length,
    totalAvailable: normalized.reduce((sum, level) => sum + Number(level.available || 0), 0),
    totalReserved: normalized.reduce((sum, level) => sum + Number(level.reserved || 0), 0),
    totalInbound: normalized.reduce((sum, level) => sum + Number(level.inbound || 0), 0),
    inStock: normalized.some((level) => Number(level.available || 0) > 0)
  };
}
