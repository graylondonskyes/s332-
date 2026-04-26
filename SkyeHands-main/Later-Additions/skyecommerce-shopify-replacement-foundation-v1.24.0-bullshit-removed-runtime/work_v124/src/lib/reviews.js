const text = (v = '') => String(v ?? '').trim();
const num = (v, f = 0) => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : f;
const statuses = ['pending', 'approved', 'rejected', 'flagged'];
const pick = (v, allowed, fallback) => allowed.includes(text(v).toLowerCase()) ? text(v).toLowerCase() : fallback;

export function normalizeProductReviewInput(body = {}, existing = {}) {
  return {
    productId: text(body.productId || body.product_id || existing.productId || existing.product_id),
    customerId: text(body.customerId || body.customer_id || existing.customerId || existing.customer_id),
    customerName: text(body.customerName || body.customer_name || existing.customerName || existing.customer_name || 'Customer'),
    customerEmail: text(body.customerEmail || body.customer_email || existing.customerEmail || existing.customer_email).toLowerCase(),
    rating: Math.min(5, Math.max(1, num(body.rating ?? existing.rating, 5))),
    title: text(body.title || existing.title || ''),
    body: text(body.body || existing.body || ''),
    status: pick(body.status || existing.status || 'pending', statuses, 'pending'),
    source: text(body.source || existing.source || 'storefront')
  };
}

export function productReviewRecord(row) {
  if (!row) return null;
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    productId: row.product_id || row.productId || '',
    productTitle: row.product_title || row.productTitle || '',
    customerId: row.customer_id || row.customerId || '',
    customerName: row.customer_name || row.customerName || '',
    customerEmail: row.customer_email || row.customerEmail || '',
    rating: Number(row.rating || 0),
    title: row.title || '',
    body: row.body || '',
    status: row.status || 'pending',
    source: row.source || '',
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function summarizeProductReviews(reviews = []) {
  const records = (Array.isArray(reviews) ? reviews : []).map(productReviewRecord).filter(Boolean);
  const approved = records.filter((review) => review.status === 'approved');
  const averageRating = approved.length ? Math.round((approved.reduce((sum, review) => sum + review.rating, 0) / approved.length) * 10) / 10 : 0;
  const byRating = [5, 4, 3, 2, 1].map((rating) => ({ rating, count: approved.filter((review) => review.rating === rating).length }));
  return { totalCount: records.length, approvedCount: approved.length, pendingCount: records.filter((review) => review.status === 'pending').length, averageRating, byRating };
}

export function moderateReview(review = {}, rules = {}) {
  const normalized = normalizeProductReviewInput(review);
  const blockedTerms = Array.isArray(rules.blockedTerms) ? rules.blockedTerms.map((item) => text(item).toLowerCase()).filter(Boolean) : [];
  const body = `${normalized.title} ${normalized.body}`.toLowerCase();
  const blocked = blockedTerms.find((term) => body.includes(term));
  if (blocked) return { ...normalized, status: 'flagged', moderationReason: `blocked_term:${blocked}` };
  if (normalized.rating >= Number(rules.autoApproveMinRating || 4) && normalized.body.length >= Number(rules.minBodyLength || 8)) return { ...normalized, status: 'approved', moderationReason: 'auto_approved' };
  return { ...normalized, status: normalized.status || 'pending', moderationReason: 'manual_review' };
}
