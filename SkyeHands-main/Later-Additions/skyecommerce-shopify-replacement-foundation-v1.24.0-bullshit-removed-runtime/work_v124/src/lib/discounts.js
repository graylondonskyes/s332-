function clampCents(value) {
  return Math.max(0, Math.round(Number(value || 0)));
}

export function discountRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    merchantId: row.merchant_id || row.merchantId || '',
    code: row.code,
    title: row.title || '',
    type: row.type,
    amountCents: clampCents(row.amount_cents ?? row.amountCents),
    amountBps: Math.max(0, Number(row.amount_bps ?? row.amountBps ?? 0) || 0),
    minimumSubtotalCents: clampCents(row.minimum_subtotal_cents ?? row.minimumSubtotalCents),
    active: Boolean(Number(row.active ?? 0)),
    startsAt: row.starts_at || row.startsAt || '',
    endsAt: row.ends_at || row.endsAt || '',
    usageLimit: (row.usage_limit ?? row.usageLimit) == null ? null : Number(row.usage_limit ?? row.usageLimit),
    usageCount: Number(row.usage_count ?? row.usageCount ?? 0),
    createdAt: row.created_at || row.createdAt || ''
  };
}

export function normalizeDiscountInput(body = {}) {
  return {
    code: String(body.code || '').trim().toUpperCase(),
    title: String(body.title || '').trim(),
    type: String(body.type || 'percent').trim().toLowerCase() === 'fixed' ? 'fixed' : 'percent',
    amountCents: clampCents(body.amountCents),
    amountBps: Math.max(0, Number(body.amountBps || 0) || 0),
    minimumSubtotalCents: clampCents(body.minimumSubtotalCents),
    active: body.active === false || body.active === 'false' || body.active === '0' ? 0 : 1,
    startsAt: String(body.startsAt || '').trim(),
    endsAt: String(body.endsAt || '').trim(),
    usageLimit: body.usageLimit === '' || body.usageLimit == null ? null : Math.max(0, Number(body.usageLimit || 0) || 0)
  };
}

export function resolveDiscount(subtotalCents, discounts = [], code = '', nowIso = new Date().toISOString()) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return { code: '', applied: false, discountCents: 0, reason: 'No code supplied.' };
  const now = new Date(nowIso).getTime();
  const match = (Array.isArray(discounts) ? discounts : []).find((entry) => {
    const discount = discountRecord(entry) || entry;
    if (!discount || String(discount.code || '').toUpperCase() !== normalizedCode) return false;
    if (!discount.active) return false;
    if (discount.minimumSubtotalCents && subtotalCents < Number(discount.minimumSubtotalCents || 0)) return false;
    if (discount.usageLimit != null && Number(discount.usageCount || 0) >= Number(discount.usageLimit || 0)) return false;
    if (discount.startsAt && !Number.isNaN(Date.parse(discount.startsAt)) && now < new Date(discount.startsAt).getTime()) return false;
    if (discount.endsAt && !Number.isNaN(Date.parse(discount.endsAt)) && now > new Date(discount.endsAt).getTime()) return false;
    return true;
  });
  if (!match) return { code: normalizedCode, applied: false, discountCents: 0, reason: 'Code not active or not found.' };
  const normalized = discountRecord(match) || match;
  const rawDiscount = normalized.type === 'fixed'
    ? clampCents(normalized.amountCents)
    : Math.round(subtotalCents * ((Number(normalized.amountBps || 0) || 0) / 10000));
  return {
    code: normalized.code,
    title: normalized.title || normalized.code,
    type: normalized.type,
    applied: true,
    discountId: normalized.id,
    discountCents: Math.min(subtotalCents, clampCents(rawDiscount)),
    reason: 'Applied.'
  };
}
