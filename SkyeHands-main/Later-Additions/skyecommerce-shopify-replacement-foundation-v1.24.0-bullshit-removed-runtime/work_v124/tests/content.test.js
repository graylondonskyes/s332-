import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionRecord, navLinkRecord, normalizeCollectionInput, normalizeNavLinkInput, normalizePageInput, pageRecord } from '../src/lib/content.js';

test('normalizeCollectionInput sanitizes slug and product ids', () => {
  const collection = normalizeCollectionInput({
    title: 'Featured Picks',
    productIds: ' prd_a, prd_b , prd_a ',
    sortMode: 'price_desc',
    visible: 'false'
  });
  assert.equal(collection.slug, 'featured-picks');
  assert.equal(collection.sortMode, 'price_desc');
  assert.equal(collection.visible, false);
  assert.deepEqual(collection.productIds, ['prd_a', 'prd_b', 'prd_a']);
});

test('pageRecord and normalizePageInput preserve body html and visibility', () => {
  const payload = normalizePageInput({ title: 'About Us', bodyHtml: '<p>Hello</p>', visible: 'true' });
  assert.equal(payload.slug, 'about-us');
  const row = pageRecord({ id: 'page_1', merchant_id: 'm1', slug: payload.slug, title: payload.title, body_html: payload.bodyHtml, visible: 1 });
  assert.equal(row.bodyHtml, '<p>Hello</p>');
  assert.equal(row.visible, true);
});

test('normalizeNavLinkInput and navLinkRecord support external and collection refs', () => {
  const external = normalizeNavLinkInput({ label: 'Instagram', type: 'external', href: 'https://example.com', position: 3 });
  assert.equal(external.href, 'https://example.com');
  const collection = navLinkRecord({ id: 'nav_1', merchant_id: 'm1', label: 'Shop', type: 'collection', target_ref: 'featured', position: 1, visible: 1 });
  assert.equal(collection.targetRef, 'featured');
  assert.equal(collection.position, 1);
});

test('collectionRecord maps assignment ids', () => {
  const row = collectionRecord({ id: 'col_1', merchant_id: 'm1', slug: 'featured', title: 'Featured', visible: 1 }, ['prd_1', 'prd_2']);
  assert.equal(row.productIds.length, 2);
  assert.equal(row.visible, true);
});
