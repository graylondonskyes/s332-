const catalog = require('../../site/printful-pod/config/storefront-products.json');

function money(value) {
  const num = Number(value || 0);
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function getCatalog() {
  return catalog;
}

function getEnabledProducts() {
  return (catalog.products || []).filter((product) => product.enabled !== false);
}

function normalizeShippingSpeed(value) {
  const options = catalog.pricingDefaults?.shippingRates || {};
  const key = String(value || 'STANDARD').trim().toUpperCase();
  return options[key] ? key : Object.keys(options)[0] || 'STANDARD';
}

function normalizePrintMethod(product, value) {
  const defaults = catalog.pricingDefaults?.methods || {};
  const requested = String(value || '').trim().toLowerCase();
  const productMethods = Array.isArray(product?.methods) && product.methods.length
    ? product.methods.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean)
    : Object.keys(defaults);

  if (requested && productMethods.includes(requested)) return requested;
  return productMethods[0] || 'print';
}

function getMethodDefinition(methodKey) {
  return catalog.pricingDefaults?.methods?.[methodKey] || null;
}

function getShippingDefinition(speedKey) {
  return catalog.pricingDefaults?.shippingRates?.[speedKey] || null;
}

function getPublicCatalog() {
  return {
    brand: catalog.brand || {},
    pricingDefaults: {
      depositPercent: Number(catalog.pricingDefaults?.depositPercent || 0),
      taxRate: Number(catalog.pricingDefaults?.taxRate || 0),
      methods: catalog.pricingDefaults?.methods || {},
      shippingRates: catalog.pricingDefaults?.shippingRates || {},
    },
    products: getEnabledProducts().map((product) => ({
      key: product.key,
      enabled: product.enabled !== false,
      title: product.title,
      description: product.description,
      productId: product.productId ?? null,
      minimumQuantity: Number(product.minimumQuantity || 1),
      previewImage: product.previewImage || '',
      previewPlacement: product.previewPlacement || null,
      placements: (product.placements || []).map((placement) => ({
        key: placement.key,
        label: placement.label,
        top: Number(placement.top || 0),
        left: Number(placement.left || 0),
        width: Number(placement.width || 0),
        height: Number(placement.height || 0),
        rotate: Number(placement.rotate || 0),
      })),
      methods: Array.isArray(product.methods) ? product.methods : [],
      turnaroundDays: product.turnaroundDays || null,
      variants: (product.variants || []).map((variant) => ({
        key: variant.key,
        label: variant.label,
        variantId: variant.variantId ?? null,
        color: variant.color || '',
        size: variant.size || '',
        retailPrice: money(variant.retailPrice || 0),
      })),
      quantityTiers: (product.quantityTiers || []).map((tier) => ({
        min: Number(tier.min || 1),
        retailPrice: money(tier.retailPrice || 0),
      })),
    })),
  };
}

function findProduct(productKey) {
  return getEnabledProducts().find((product) => product.key === productKey) || null;
}

function findVariant(productKey, variantIdOrKey) {
  const product = findProduct(productKey);
  if (!product) return null;
  return (product.variants || []).find((variant) => {
    if (variantIdOrKey == null) return false;
    return String(variant.variantId ?? '') === String(variantIdOrKey) || String(variant.key) === String(variantIdOrKey);
  }) || null;
}

function findPlacement(product, placementKey) {
  if (!product) return null;
  const placements = Array.isArray(product.placements) && product.placements.length
    ? product.placements
    : (product.previewPlacement ? [{ key: 'default', label: 'Default', ...product.previewPlacement }] : []);

  if (!placements.length) return null;
  if (!placementKey) return placements[0];
  return placements.find((placement) => String(placement.key) === String(placementKey)) || placements[0];
}

function resolveQuantityTier(product, quantity, fallbackRetail) {
  const tiers = Array.isArray(product?.quantityTiers) ? product.quantityTiers.slice().sort((a, b) => Number(a.min || 0) - Number(b.min || 0)) : [];
  let chosen = null;
  for (const tier of tiers) {
    if (quantity >= Number(tier.min || 0)) chosen = tier;
  }
  if (!chosen) {
    return {
      min: 1,
      retailPrice: money(fallbackRetail || 0),
      source: 'variant',
    };
  }
  return {
    min: Number(chosen.min || 1),
    retailPrice: money(chosen.retailPrice || fallbackRetail || 0),
    source: 'tier',
  };
}

function resolveTurnaround(product, shippingSpeed, rush) {
  const productTurnaround = product?.turnaroundDays || {};
  const fallbackShipping = getShippingDefinition(shippingSpeed)?.etaDays || null;
  const preferred = rush ? productTurnaround.rush : productTurnaround.standard;
  const result = preferred || fallbackShipping || { min: 5, max: 8 };
  return {
    min: Number(result.min || result.max || 0),
    max: Number(result.max || result.min || 0),
  };
}

function calculateQuote({
  productKey,
  variantId,
  quantity = 1,
  extraLogoCount = 1,
  rush = false,
  shippingSpeed = 'STANDARD',
  printMethod,
  placementKey,
}) {
  const product = findProduct(productKey);
  if (!product) {
    const error = new Error(`Unknown productKey: ${productKey}`);
    error.statusCode = 400;
    throw error;
  }

  const variant = findVariant(productKey, variantId);
  if (!variant) {
    const error = new Error(`Unknown or disallowed variant for productKey: ${productKey}`);
    error.statusCode = 400;
    throw error;
  }

  const safeQuantity = Math.max(1, Number(quantity || 1));
  const minimumQuantity = Math.max(1, Number(product.minimumQuantity || 1));
  if (safeQuantity < minimumQuantity) {
    const error = new Error(`Minimum quantity for ${product.title} is ${minimumQuantity}.`);
    error.statusCode = 400;
    throw error;
  }

  const safeExtraLogoCount = Math.max(1, Number(extraLogoCount || 1));
  const defaults = catalog.pricingDefaults || {};
  const fees = product.fees || {};

  const methodKey = normalizePrintMethod(product, printMethod);
  const methodDefinition = getMethodDefinition(methodKey) || {};
  const shippingKey = normalizeShippingSpeed(shippingSpeed);
  const shippingDefinition = getShippingDefinition(shippingKey) || {};
  const placement = findPlacement(product, placementKey);

  const tier = resolveQuantityTier(product, safeQuantity, variant.retailPrice || 0);
  const unitRetail = money(tier.retailPrice);
  const subtotal = money(unitRetail * safeQuantity);

  const setupFee = money(fees.setupFee ?? defaults.setupFee ?? 0);
  const additionalLogoFee = money(fees.additionalLogoFee ?? defaults.additionalLogoFee ?? 0);
  const rushFee = rush ? money(fees.rushFee ?? defaults.rushFee ?? 0) : 0;
  const extraLogoUnits = Math.max(0, safeExtraLogoCount - 1);
  const logosFeeTotal = money(extraLogoUnits * additionalLogoFee * safeQuantity);

  const methodPerUnitFee = money(methodDefinition.perUnitFee || 0);
  const methodOneTimeFee = money(methodDefinition.oneTimeFee || 0);
  const digitizeFee = methodKey === 'embroidery' ? money(methodDefinition.digitizeFee || 0) : 0;
  const methodFeeTotal = money((methodPerUnitFee * safeQuantity) + methodOneTimeFee);

  const shippingBase = money(shippingDefinition.base || 0);
  const shippingPerItem = money(shippingDefinition.perItem || 0);
  const shippingFee = money(shippingBase + (shippingPerItem * safeQuantity));

  const taxableBase = money(subtotal + logosFeeTotal + rushFee + methodFeeTotal + digitizeFee + shippingFee);
  const taxRate = Number(defaults.taxRate || 0);
  const estimatedTax = money(taxableBase * taxRate);
  const total = money(subtotal + setupFee + logosFeeTotal + rushFee + methodFeeTotal + digitizeFee + shippingFee + estimatedTax);

  const depositPercent = Number(defaults.depositPercent || 0);
  const depositDue = money(total * depositPercent);
  const balanceDue = money(total - depositDue);
  const turnaround = resolveTurnaround(product, shippingKey, rush);

  return {
    currency: catalog.brand?.currency || 'USD',
    productKey: product.key,
    productTitle: product.title,
    variantKey: variant.key,
    variantId: variant.variantId ?? null,
    variantLabel: variant.label,
    placementKey: placement?.key || null,
    placementLabel: placement?.label || null,
    printMethod: methodKey,
    printMethodLabel: methodDefinition.label || methodKey,
    quantity: safeQuantity,
    minimumQuantity,
    unitRetail,
    quantityTierMin: tier.min,
    quantityTierSource: tier.source,
    subtotal,
    setupFee,
    additionalLogoFee,
    extraLogoCount: safeExtraLogoCount,
    logosFeeTotal,
    rush: Boolean(rush),
    rushFee,
    methodPerUnitFee,
    methodOneTimeFee,
    methodFeeTotal,
    digitizeFee,
    shippingSpeed: shippingKey,
    shippingLabel: shippingDefinition.label || shippingKey,
    shippingFee,
    taxRate,
    estimatedTax,
    depositPercent,
    depositDue,
    balanceDue,
    turnaround,
    turnaroundLabel: `${turnaround.min}-${turnaround.max} business days`,
    total,
  };
}

module.exports = {
  calculateQuote,
  findPlacement,
  findProduct,
  findVariant,
  getCatalog,
  getEnabledProducts,
  getMethodDefinition,
  getPublicCatalog,
  getShippingDefinition,
  money,
  normalizePrintMethod,
  normalizeShippingSpeed,
  resolveQuantityTier,
};
