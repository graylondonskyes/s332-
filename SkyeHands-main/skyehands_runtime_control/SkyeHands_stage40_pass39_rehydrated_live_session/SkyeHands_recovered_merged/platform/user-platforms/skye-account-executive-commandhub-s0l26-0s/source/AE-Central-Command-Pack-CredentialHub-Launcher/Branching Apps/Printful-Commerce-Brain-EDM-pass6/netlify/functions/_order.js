const { calculateQuote, findVariant, money } = require('./_storefront');
const { isMockMode } = require('./_printful');

function normalizeBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
  }
  return fallback;
}

function sanitizeString(value) {
  return String(value || '').trim();
}

function buildRecipient(recipient = {}) {
  return {
    name: sanitizeString(recipient.name),
    company: recipient.company ? sanitizeString(recipient.company) : undefined,
    address1: sanitizeString(recipient.address1),
    address2: recipient.address2 ? sanitizeString(recipient.address2) : undefined,
    city: sanitizeString(recipient.city),
    state_code: recipient.state_code ? sanitizeString(recipient.state_code) : undefined,
    state_name: recipient.state_name ? sanitizeString(recipient.state_name) : undefined,
    country_code: sanitizeString(recipient.country_code).toUpperCase(),
    zip: sanitizeString(recipient.zip),
    phone: recipient.phone ? sanitizeString(recipient.phone) : undefined,
    email: recipient.email ? sanitizeString(recipient.email) : undefined,
    tax_number: recipient.tax_number ? sanitizeString(recipient.tax_number) : undefined,
  };
}

function requiredRecipientMissing(recipient = {}) {
  const requiredRecipientFields = ['name', 'address1', 'city', 'country_code', 'zip'];
  return requiredRecipientFields.filter((key) => !sanitizeString(recipient[key]));
}

function makeId(prefix = 'id') {
  try {
    const { randomUUID } = require('crypto');
    return randomUUID();
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function normalizeLineItem(raw = {}, fallback = {}) {
  const productKey = sanitizeString(raw.productKey || raw.product?.key || fallback.productKey || fallback.product?.key);
  const variantRef = raw.variantId != null
    ? String(raw.variantId)
    : sanitizeString(raw.variantKey || raw.product?.variantKey || fallback.variantKey || fallback.product?.variantKey);
  const quantity = Math.max(1, Number(raw.quantity || raw.pricing?.quantity || fallback.quantity || fallback.pricing?.quantity || 1));
  const extraLogoCount = Math.max(1, Number(raw.extraLogoCount || raw.pricing?.extraLogoCount || fallback.extraLogoCount || fallback.pricing?.extraLogoCount || 1));
  const rush = normalizeBool(raw.rush, normalizeBool(raw.pricing?.rush, normalizeBool(fallback.rush, normalizeBool(fallback.pricing?.rush, false))));
  const shippingSpeed = sanitizeString(raw.shippingSpeed || raw.shipping || raw.logistics?.shippingSpeed || fallback.shipping || fallback.shippingSpeed || fallback.logistics?.shippingSpeed || 'STANDARD').toUpperCase();
  const printMethod = sanitizeString(raw.printMethod || raw.product?.printMethod || raw.pricing?.printMethod || fallback.printMethod || fallback.product?.printMethod || fallback.pricing?.printMethod || 'print').toLowerCase();
  const placementKey = sanitizeString(raw.placementKey || raw.product?.placementKey || fallback.placementKey || fallback.product?.placementKey);
  const externalProductId = sanitizeString(raw.externalProductId || fallback.externalProductId);
  const productTemplateId = raw.productTemplateId ?? raw.templateId ?? fallback.productTemplateId ?? fallback.templateId ?? null;
  const itemName = raw.itemName ? String(raw.itemName) : undefined;
  const itemSku = raw.itemSku ? String(raw.itemSku) : undefined;
  const itemExternalId = raw.itemExternalId ? String(raw.itemExternalId) : undefined;

  if (!productKey) {
    const error = new Error('productKey is required for every line item.');
    error.statusCode = 400;
    throw error;
  }

  const variant = findVariant(productKey, variantRef);
  if (!variant?.variantId && !isMockMode()) {
    const error = new Error(`Selected variant for ${productKey} is missing a real Printful variantId.`);
    error.statusCode = 400;
    throw error;
  }

  const quote = calculateQuote({
    productKey,
    variantId: variantRef,
    quantity,
    extraLogoCount,
    rush,
    shippingSpeed,
    printMethod,
    placementKey,
  });

  const item = {
    variant_id: Number(variant.variantId || 900000 + quantity),
    quantity,
    retail_price: String(quote.unitRetail),
  };

  if (externalProductId) item.external_product_id = externalProductId;
  if (productTemplateId) item.product_template_id = Number(productTemplateId);
  if (itemName) item.name = itemName;
  if (itemSku) item.sku = itemSku;
  if (itemExternalId) item.external_id = itemExternalId;

  return {
    item,
    quote,
    shippingSpeed,
    externalProductId,
    productTemplateId: productTemplateId != null && productTemplateId !== '' ? Number(productTemplateId) : null,
    productKey,
    variantKey: quote.variantKey,
    placementKey: quote.placementKey,
    printMethod: quote.printMethod,
  };
}

function normalizeSourceToItems(source = {}) {
  if (Array.isArray(source.items) && source.items.length) {
    return source.items.map((item) => ({
      productKey: item.product?.key || item.productKey,
      variantKey: item.product?.variantKey || item.variantKey,
      variantId: item.product?.variantId || item.variantId,
      quantity: item.pricing?.quantity || item.quantity,
      extraLogoCount: item.pricing?.extraLogoCount || item.extraLogoCount,
      rush: item.pricing?.rush || item.rush,
      shippingSpeed: item.logistics?.shippingSpeed || item.shippingSpeed || source.logistics?.shippingSpeed || source.shippingSpeed,
      printMethod: item.product?.printMethod || item.printMethod,
      placementKey: item.product?.placementKey || item.placementKey,
      externalProductId: item.externalProductId,
      templateId: item.templateId || item.productTemplateId,
      itemName: `${item.product?.title || item.productTitle || 'Product'} - ${item.product?.variantLabel || item.variantLabel || item.variantKey || ''}`.trim(),
    }));
  }

  if (source.product || source.productKey) {
    return [{
      productKey: source.product?.key || source.productKey,
      variantKey: source.product?.variantKey || source.variantKey,
      variantId: source.product?.variantId || source.variantId,
      quantity: source.pricing?.quantity || source.quantity,
      extraLogoCount: source.pricing?.extraLogoCount || source.extraLogoCount,
      rush: source.pricing?.rush || source.rush,
      shippingSpeed: source.logistics?.shippingSpeed || source.shippingSpeed,
      printMethod: source.product?.printMethod || source.printMethod,
      placementKey: source.product?.placementKey || source.placementKey,
      externalProductId: source.externalProductId,
      templateId: source.templateId || source.productTemplateId,
      itemName: `${source.product?.title || source.productTitle || 'Product'} - ${source.product?.variantLabel || source.variantLabel || source.variantKey || ''}`.trim(),
    }];
  }

  return [];
}

function summarizeQuotes(quotes = []) {
  const totals = quotes.reduce((acc, quote) => {
    acc.quantity += Number(quote.quantity || 0);
    acc.subtotal += Number(quote.subtotal || 0);
    acc.setupFee += Number(quote.setupFee || 0);
    acc.logosFeeTotal += Number(quote.logosFeeTotal || 0);
    acc.methodFeeTotal += Number(quote.methodFeeTotal || 0);
    acc.digitizeFee += Number(quote.digitizeFee || 0);
    acc.rushFee += Number(quote.rushFee || 0);
    acc.shippingFee += Number(quote.shippingFee || 0);
    acc.estimatedTax += Number(quote.estimatedTax || 0);
    acc.total += Number(quote.total || 0);
    acc.depositDue += Number(quote.depositDue || 0);
    acc.balanceDue += Number(quote.balanceDue || 0);
    return acc;
  }, {
    quantity: 0,
    subtotal: 0,
    setupFee: 0,
    logosFeeTotal: 0,
    methodFeeTotal: 0,
    digitizeFee: 0,
    rushFee: 0,
    shippingFee: 0,
    estimatedTax: 0,
    total: 0,
    depositDue: 0,
    balanceDue: 0,
  });

  Object.keys(totals).forEach((key) => {
    totals[key] = money(totals[key]);
  });
  return totals;
}

function buildRetailCosts(quotes = []) {
  const totals = summarizeQuotes(quotes);
  return {
    currency: quotes[0]?.currency || 'USD',
    subtotal: String(totals.subtotal),
    discount: '0',
    shipping: String(totals.shippingFee),
    tax: String(totals.estimatedTax),
  };
}

module.exports = {
  buildRecipient,
  buildRetailCosts,
  makeId,
  normalizeBool,
  normalizeLineItem,
  normalizeSourceToItems,
  requiredRecipientMissing,
  sanitizeString,
  summarizeQuotes,
};
