import { hmacHex } from './utils.js';

export function normalizeGiftCardIssueInput(input = {}) {
  const code = String(input.code || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
  const balanceCents = Math.max(0, Number(input.balanceCents ?? input.balance_cents ?? input.amountCents ?? 0) || 0);
  return {
    code,
    balanceCents,
    initialBalanceCents: balanceCents,
    currency: String(input.currency || 'USD').trim().toUpperCase(),
    customerEmail: String(input.customerEmail || input.customer_email || '').trim().toLowerCase(),
    note: String(input.note || '').trim().slice(0, 500),
    expiresAt: input.expiresAt || input.expires_at || null,
    active: input.active === undefined ? true : Boolean(input.active)
  };
}

export function giftCardRecord(row = {}) {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    codeLast4: row.code_last4 || '',
    customerEmail: row.customer_email || '',
    initialBalanceCents: Number(row.initial_balance_cents || 0),
    balanceCents: Number(row.balance_cents || 0),
    currency: row.currency || 'USD',
    note: row.note || '',
    active: Boolean(Number(row.active || 0)),
    expiresAt: row.expires_at || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

export function giftCardLedgerRecord(row = {}) {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    giftCardId: row.gift_card_id,
    orderId: row.order_id || '',
    kind: row.kind,
    amountCents: Number(row.amount_cents || 0),
    balanceAfterCents: Number(row.balance_after_cents || 0),
    note: row.note || '',
    createdAt: row.created_at || ''
  };
}

export async function hashGiftCardCode(secret = '', code = '') {
  const material = String(secret || '').trim();
  if (!material) throw new Error('Gift-card hashing requires GIFT_CARD_SECRET or SESSION_SECRET.');
  return hmacHex(material, String(code || '').trim().toUpperCase());
}

export function previewGiftCardRedemption(card = {}, requestedCents = 0) {
  const balance = Math.max(0, Number(card.balanceCents ?? card.balance_cents ?? 0) || 0);
  const requested = Math.max(0, Number(requestedCents || 0) || 0);
  const active = Boolean(card.active === true || Number(card.active || 0));
  const expired = card.expiresAt || card.expires_at ? Date.parse(card.expiresAt || card.expires_at) < Date.now() : false;
  const appliedCents = active && !expired ? Math.min(balance, requested) : 0;
  return {
    ok: appliedCents > 0,
    appliedCents,
    remainingBalanceCents: Math.max(0, balance - appliedCents),
    reason: !active ? 'inactive' : expired ? 'expired' : balance <= 0 ? 'empty' : appliedCents > 0 ? 'applied' : 'not_applicable'
  };
}
