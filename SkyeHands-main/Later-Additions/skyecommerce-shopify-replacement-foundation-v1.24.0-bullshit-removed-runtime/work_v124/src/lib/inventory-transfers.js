const text = (v = '') => String(v ?? '').trim();
const num = (v, f = 0) => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : f;
const asJson = (v, f) => Array.isArray(v) || (v && typeof v === 'object') ? v : (() => { try { return JSON.parse(v || ''); } catch { return f; } })();
const statuses = ['draft', 'requested', 'in_transit', 'completed', 'cancelled'];
const pick = (v, allowed, fallback) => allowed.includes(text(v).toLowerCase()) ? text(v).toLowerCase() : fallback;

export function normalizeInventoryTransferItemInput(item = {}) {
  return {
    productId: text(item.productId || item.product_id),
    variantId: text(item.variantId || item.variant_id),
    sku: text(item.sku || ''),
    title: text(item.title || ''),
    quantity: Math.max(1, num(item.quantity, 1))
  };
}

export function normalizeInventoryTransferInput(body = {}, existing = {}) {
  const items = asJson(body.items, body.items || existing.items || existing.items_json || []).map(normalizeInventoryTransferItemInput).filter((item) => item.productId || item.sku || item.title);
  return {
    fromLocationId: text(body.fromLocationId || body.from_location_id || existing.fromLocationId || existing.from_location_id),
    toLocationId: text(body.toLocationId || body.to_location_id || existing.toLocationId || existing.to_location_id),
    status: pick(body.status || existing.status || 'requested', statuses, 'requested'),
    reference: text(body.reference || existing.reference || ''),
    note: text(body.note || existing.note || ''),
    items
  };
}

export function inventoryTransferRecord(row) {
  if (!row) return null;
  let items = [];
  try { items = JSON.parse(row.items_json || row.items || '[]'); } catch {}
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    fromLocationId: row.from_location_id || row.fromLocationId || '',
    fromLocationName: row.from_location_name || row.fromLocationName || '',
    toLocationId: row.to_location_id || row.toLocationId || '',
    toLocationName: row.to_location_name || row.toLocationName || '',
    status: row.status || 'requested',
    reference: row.reference || '',
    note: row.note || '',
    items: items.map(normalizeInventoryTransferItemInput),
    unitCount: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || '',
    completedAt: row.completed_at || row.completedAt || ''
  };
}

export function buildInventoryTransferPlan(transfer = {}, sourceLevels = []) {
  const items = Array.isArray(transfer.items) ? transfer.items.map(normalizeInventoryTransferItemInput) : [];
  const checks = items.map((item) => {
    const source = (Array.isArray(sourceLevels) ? sourceLevels : []).find((level) => level.productId === item.productId || level.product_id === item.productId);
    const available = Number(source?.available ?? source?.availableUnits ?? 0);
    return { ...item, available, canTransfer: available >= item.quantity, shortBy: Math.max(0, item.quantity - available) };
  });
  return { ok: checks.every((item) => item.canTransfer), itemCount: checks.length, unitCount: checks.reduce((sum, item) => sum + item.quantity, 0), checks };
}
