import { slugify } from './utils.js';

function normalizedText(value = '') {
  return String(value || '').trim();
}

function boolish(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 'true' || value === '1' || value === 1;
}

function numberish(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function splitIds(value) {
  if (Array.isArray(value)) return value.map((entry) => normalizedText(entry)).filter(Boolean);
  return normalizedText(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function collectionRecord(row, productIds = []) {
  return {
    id: row.id,
    merchantId: row.merchant_id || row.merchantId || '',
    slug: row.slug || '',
    title: row.title || '',
    description: row.description || '',
    sortMode: row.sort_mode || row.sortMode || 'manual',
    visible: Boolean(Number(row.visible ?? 1)),
    productIds: splitIds(productIds),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function normalizeCollectionInput(body = {}) {
  return {
    slug: slugify(body.slug || body.title || 'collection'),
    title: normalizedText(body.title || ''),
    description: normalizedText(body.description || ''),
    sortMode: ['manual', 'alpha_asc', 'alpha_desc', 'price_asc', 'price_desc', 'newest'].includes(normalizedText(body.sortMode || '').toLowerCase())
      ? normalizedText(body.sortMode).toLowerCase()
      : 'manual',
    visible: boolish(body.visible, true),
    productIds: splitIds(body.productIds)
  };
}

export function pageRecord(row) {
  return {
    id: row.id,
    merchantId: row.merchant_id || row.merchantId || '',
    slug: row.slug || '',
    title: row.title || '',
    bodyHtml: row.body_html || row.bodyHtml || '',
    visible: Boolean(Number(row.visible ?? 1)),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function normalizePageInput(body = {}) {
  return {
    slug: slugify(body.slug || body.title || 'page'),
    title: normalizedText(body.title || ''),
    bodyHtml: String(body.bodyHtml || body.body_html || '').trim(),
    visible: boolish(body.visible, true)
  };
}

export function navLinkRecord(row) {
  return {
    id: row.id,
    merchantId: row.merchant_id || row.merchantId || '',
    label: row.label || '',
    type: row.type || 'page',
    href: row.href || '',
    targetRef: row.target_ref || row.targetRef || '',
    position: numberish(row.position, 0),
    visible: Boolean(Number(row.visible ?? 1)),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function normalizeNavLinkInput(body = {}) {
  const type = ['collection', 'page', 'external', 'home'].includes(normalizedText(body.type || '').toLowerCase())
    ? normalizedText(body.type).toLowerCase()
    : 'page';
  return {
    label: normalizedText(body.label || ''),
    type,
    href: type === 'external' ? normalizedText(body.href || '') : '',
    targetRef: type === 'external' || type === 'home' ? '' : slugify(body.targetRef || body.target_ref || ''),
    position: numberish(body.position, 0),
    visible: boolish(body.visible, true)
  };
}
