import test from 'node:test';
import assert from 'node:assert/strict';
import { attachVariantsToProducts, normalizeVariantInput, productVariantRecord, resolveSellableVariant } from '../src/lib/variants.js';

test('variants normalize options and attach price ranges', () => {
  const variant = normalizeVariantInput({ options: ['Black', 'XL'], priceCents: 2599, inventoryOnHand: 3, trackInventory: true }, { title: 'Hoodie', priceCents: 1999 });
  assert.equal(variant.option1, 'Black');
  assert.equal(variant.option2, 'XL');
  assert.equal(variant.priceCents, 2599);
  const record = productVariantRecord({ id: 'var_1', merchant_id: 'm1', product_id: 'p1', title: variant.title, sku: 'HD-BLK-XL', option1: 'Black', option2: 'XL', price_cents: 2599, inventory_on_hand: 3, track_inventory: 1, status: 'active', position: 1 });
  const [product] = attachVariantsToProducts([{ id: 'p1', title: 'Hoodie', priceCents: 1999 }], [record]);
  assert.equal(product.hasVariants, true);
  assert.equal(product.priceRange.maxCents, 2599);
});

test('resolveSellableVariant chooses requested variant and falls back to product price', () => {
  const product = { id: 'p1', title: 'Cap', priceCents: 1500, inventoryOnHand: 10 };
  const variants = [{ id: 'v1', productId: 'p1', title: 'Cap Red', option1: 'Red', priceCents: 1700, inventoryOnHand: 2, trackInventory: true, status: 'active' }];
  assert.equal(resolveSellableVariant(product, variants, { variantId: 'v1' }).unitPriceCents, 1700);
  assert.equal(resolveSellableVariant(product, [], {}).unitPriceCents, 1500);
});
