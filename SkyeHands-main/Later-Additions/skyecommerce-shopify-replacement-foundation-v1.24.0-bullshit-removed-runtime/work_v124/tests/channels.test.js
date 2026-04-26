import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChannelCatalogExport, buildChannelSyncDispatch, normalizeSalesChannelInput, salesChannelRecord } from '../src/lib/channels.js';

test('normalizeSalesChannelInput and salesChannelRecord map live channel config', () => {
  const normalized = normalizeSalesChannelInput({ name: 'Meta Catalog', type: 'meta_catalog', format: 'csv', destinationUrl: 'https://graph.facebook.com/catalog', config: { locale: 'en_US' }, active: true });
  assert.equal(normalized.type, 'meta_catalog');
  const record = salesChannelRecord({ id: 'chn_1', merchant_id: 'm1', name: normalized.name, type: normalized.type, destination_url: normalized.destinationUrl, format: normalized.format, config_json: JSON.stringify(normalized.config), active: 1 });
  assert.equal(record.config.locale, 'en_US');
});

test('buildChannelCatalogExport creates channel-ready payload and dispatch artifact', () => {
  const payload = buildChannelCatalogExport({
    merchant: { id: 'm1', slug: 'merchant-store', brandName: 'Merchant Store', currency: 'USD' },
    channel: { id: 'chn_1', name: 'Google', type: 'google_merchant', format: 'csv', destination_url: 'https://shoppingcontent.googleapis.com' },
    products: [{ id: 'p1', slug: 'merchant-product', title: 'Merchant Product', priceCents: 4900, sku: 'SKU-1', inventoryOnHand: 7 }],
    collections: [{ id: 'col_1', slug: 'featured', title: 'Featured', productIds: ['p1'] }],
    pages: [{ id: 'pg_1', slug: 'about', title: 'About', visible: true }],
    navigation: [{ id: 'nav_1', label: 'About', type: 'page', targetRef: 'about', position: 0 }],
    snapshot: { productCount: 1, collections: [{ id: 'col_1' }], pages: [{ id: 'pg_1' }] }
  });
  assert.equal(payload.counts.products, 1);
  assert.match(payload.csv, /merchant-product/);
  const dispatch = buildChannelSyncDispatch({ id: 'chn_1', type: 'google_merchant', format: 'csv', destination_url: 'https://shoppingcontent.googleapis.com' }, payload);
  assert.equal(dispatch.status, 'dispatched');
  assert.match(dispatch.artifactName, /google_merchant/);
});
