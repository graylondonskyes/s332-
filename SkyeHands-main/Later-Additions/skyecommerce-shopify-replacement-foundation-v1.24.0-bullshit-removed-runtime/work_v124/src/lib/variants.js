import { slugify } from './utils.js';

export function normalizeVariantInput(input = {}, product = {}) {
  const options = Array.isArray(input.options) ? input.options : [];
  const option1 = String(input.option1 ?? options[0]?.value ?? options[0] ?? '').trim();
  const option2 = String(input.option2 ?? options[1]?.value ?? options[1] ?? '').trim();
  const option3 = String(input.option3 ?? options[2]?.value ?? options[2] ?? '').trim();
  const label = [option1, option2, option3].filter(Boolean).join(' / ');
  const title = String(input.title || label || product.title || 'Default variant').trim();
  const sku = String(input.sku || product.sku || '').trim();
  const status = ['active', 'draft', 'archived'].includes(String(input.status || '').toLowerCase()) ? String(input.status).toLowerCase() : 'active';
  const position = Math.max(0, Number(input.position || 0) || 0);
  const priceCents = Math.max(0, Number(input.priceCents ?? input.price_cents ?? product.priceCents ?? product.price_cents ?? 0) || 0);
  const compareAtCents = Math.max(0, Number(input.compareAtCents ?? input.compare_at_cents ?? product.compareAtCents ?? product.compare_at_cents ?? 0) || 0);
  const inventoryOnHand = Math.max(0, Number(input.inventoryOnHand ?? input.inventory_on_hand ?? product.inventoryOnHand ?? product.inventory_on_hand ?? 0) || 0);
  const trackInventory = input.trackInventory ?? input.track_inventory ?? product.trackInventory ?? product.track_inventory ?? false;
  return {
    title,
    sku,
    option1,
    option2,
    option3,
    priceCents,
    compareAtCents,
    inventoryOnHand,
    trackInventory: Boolean(Number(trackInventory) || trackInventory === true || trackInventory === 'true'),
    status,
    position
  };
}

export function productVariantRecord(row = {}) {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    productId: row.product_id,
    title: row.title || '',
    sku: row.sku || '',
    option1: row.option1 || '',
    option2: row.option2 || '',
    option3: row.option3 || '',
    priceCents: Number(row.price_cents || 0),
    compareAtCents: Number(row.compare_at_cents || 0),
    inventoryOnHand: Number(row.inventory_on_hand || 0),
    trackInventory: Boolean(Number(row.track_inventory || 0)),
    status: row.status || 'active',
    position: Number(row.position || 0),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

export function attachVariantsToProducts(products = [], variants = []) {
  const byProduct = new Map();
  for (const variant of variants) {
    const key = variant.productId || variant.product_id;
    if (!key) continue;
    if (!byProduct.has(key)) byProduct.set(key, []);
    byProduct.get(key).push(variant);
  }
  return (Array.isArray(products) ? products : []).map((product) => {
    const productVariants = (byProduct.get(product.id) || [])
      .filter((variant) => variant.status !== 'archived')
      .sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
    const prices = productVariants.map((variant) => Number(variant.priceCents ?? variant.price_cents ?? 0)).filter((price) => price >= 0);
    return {
      ...product,
      hasVariants: productVariants.length > 0,
      variants: productVariants,
      defaultVariantId: productVariants.find((variant) => variant.status === 'active')?.id || productVariants[0]?.id || '',
      priceRange: prices.length ? { minCents: Math.min(...prices), maxCents: Math.max(...prices) } : { minCents: Number(product.priceCents || 0), maxCents: Number(product.priceCents || 0) }
    };
  });
}

export function resolveSellableVariant(product = {}, variants = [], cartLine = {}) {
  const active = (Array.isArray(variants) ? variants : []).filter((variant) => variant.status !== 'archived' && variant.productId === product.id);
  const requestedVariantId = String(cartLine.variantId || cartLine.variant_id || '').trim();
  const requestedSku = String(cartLine.sku || '').trim();
  const requestedOptions = [cartLine.option1, cartLine.option2, cartLine.option3].map((item) => String(item || '').trim().toLowerCase());
  let selected = null;
  if (requestedVariantId) selected = active.find((variant) => variant.id === requestedVariantId) || null;
  if (!selected && requestedSku) selected = active.find((variant) => String(variant.sku || '').toLowerCase() === requestedSku.toLowerCase()) || null;
  if (!selected && requestedOptions.some(Boolean)) {
    selected = active.find((variant) => [variant.option1, variant.option2, variant.option3].map((item) => String(item || '').trim().toLowerCase()).every((value, idx) => !requestedOptions[idx] || requestedOptions[idx] === value)) || null;
  }
  if (!selected && active.length) selected = active.find((variant) => variant.status === 'active') || active[0];
  if (!selected) {
    return {
      variantId: '',
      productId: product.id,
      title: product.title,
      sku: product.sku || '',
      optionLabel: '',
      unitPriceCents: Number(product.priceCents || product.price_cents || 0),
      inventoryOnHand: Number(product.inventoryOnHand || product.inventory_on_hand || 0),
      trackInventory: Boolean(product.trackInventory || product.track_inventory)
    };
  }
  return {
    variantId: selected.id,
    productId: product.id,
    title: selected.title || product.title,
    sku: selected.sku || product.sku || '',
    optionLabel: [selected.option1, selected.option2, selected.option3].filter(Boolean).join(' / '),
    unitPriceCents: Number(selected.priceCents || selected.price_cents || 0),
    inventoryOnHand: Number(selected.inventoryOnHand || selected.inventory_on_hand || 0),
    trackInventory: Boolean(selected.trackInventory || selected.track_inventory)
  };
}

export function normalizeVariantSlug(productTitle = '', variant = {}) {
  return slugify([productTitle, variant.option1, variant.option2, variant.option3].filter(Boolean).join(' '));
}
