import { resolveDiscount } from './discounts.js';

export function resolveShippingCents(subtotalCents, shippingProfiles = [], selectedCode = '') {
  if (!Array.isArray(shippingProfiles) || !shippingProfiles.length) return 0;
  const flat = [];
  for (const profile of shippingProfiles) {
    const rates = Array.isArray(profile.rates) ? profile.rates : [];
    for (const rate of rates) flat.push(rate);
  }
  if (!flat.length) return 0;
  const selected = flat.find((rate) => rate.code === selectedCode) || flat[0];
  if (selected.freeAboveCents && subtotalCents >= Number(selected.freeAboveCents)) return 0;
  return Number(selected.amountCents || 0) || 0;
}

export function resolveTaxCents(taxableSubtotalCents, taxProfiles = [], countryCode = 'US', stateCode = '') {
  if (!Array.isArray(taxProfiles) || !taxProfiles.length) return 0;
  const normalizedCountry = String(countryCode || '').toUpperCase();
  const normalizedState = String(stateCode || '').toUpperCase();
  const match = taxProfiles.find((profile) => {
    return String(profile.countryCode || '').toUpperCase() === normalizedCountry && (!profile.stateCode || String(profile.stateCode).toUpperCase() === normalizedState);
  }) || taxProfiles.find((profile) => String(profile.countryCode || '').toUpperCase() === normalizedCountry) || null;
  if (!match) return 0;
  return Math.round(taxableSubtotalCents * ((Number(match.rateBps || 0) || 0) / 10000));
}

export function computeOrderQuote(items = [], shippingProfiles = [], taxProfiles = [], location = {}, selectedShippingCode = '', discountCode = '', discounts = []) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const subtotalCents = normalizedItems.reduce((sum, item) => sum + ((Number(item.unitPriceCents || 0) || 0) * (Number(item.quantity || 0) || 0)), 0);
  const discount = resolveDiscount(subtotalCents, discounts, discountCode);
  const discountedSubtotalCents = Math.max(0, subtotalCents - Number(discount.discountCents || 0));
  const shippingCents = resolveShippingCents(discountedSubtotalCents, shippingProfiles, selectedShippingCode);
  const taxCents = resolveTaxCents(discountedSubtotalCents, taxProfiles, location.countryCode || 'US', location.stateCode || '');
  return {
    subtotalCents,
    discountCode: discount.code || '',
    discountCents: Number(discount.discountCents || 0),
    discountApplied: Boolean(discount.applied),
    discountTitle: discount.title || '',
    discountedSubtotalCents,
    shippingCents,
    taxCents,
    totalCents: discountedSubtotalCents + shippingCents + taxCents
  };
}
