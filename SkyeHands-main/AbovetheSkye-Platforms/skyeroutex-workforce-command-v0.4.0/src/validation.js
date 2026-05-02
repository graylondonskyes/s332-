export const ROLES = ['contractor', 'provider', 'crew', 'house_command', 'ae'];
export const ACCEPTANCE_MODES = ['single', 'multi', 'manual', 'roster_only'];
export const PAY_TYPES = ['fixed', 'hourly'];
export const PAYMENT_STATUSES = ['payment_authorized', 'work_pending', 'approval_pending', 'payout_eligible', 'held', 'released', 'cancelled'];
export const USER_STATUSES = ['active', 'suspended', 'disabled'];

export function isEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || ''));
}

export function strongEnoughPassword(value) {
  const text = String(value || '');
  return text.length >= 10 && /[A-Za-z]/.test(text) && /[0-9]/.test(text);
}

export function cleanText(value, max = 500) {
  const text = String(value || '').trim();
  if (!text || text.length > max) return null;
  return text;
}

export function positiveInt(value, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > max) return null;
  return n;
}

export function moneyCents(value) {
  return positiveInt(value, 10_000_000);
}

export function ratingScore(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

export function isoDateLike(value) {
  const text = String(value || '');
  const time = Date.parse(text);
  return Number.isNaN(time) ? null : text;
}

export function assignmentTransitionAllowed(current, next) {
  const allowed = {
    offered: ['contractor_confirmed'],
    contractor_confirmed: ['on_the_way', 'cancelled_by_contractor'],
    on_the_way: ['checked_in', 'cancelled_by_contractor', 'no_show'],
    checked_in: ['checked_out'],
    checked_out: ['proof_submitted'],
    proof_submitted: ['completed'],
    completed: [],
    cancelled_by_contractor: [],
    cancelled_by_provider: [],
    no_show: []
  };
  return (allowed[current] || []).includes(next);
}
