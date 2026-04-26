import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDomainVerification, buildSitemapEntries, customDomainRecord, normalizeCustomDomainInput, normalizeRedirectRuleInput, normalizeSeoEntryInput, redirectRuleRecord, renderSitemapXml, seoEntryRecord } from '../src/lib/storefront-ops.js';

test('custom domains produce deterministic DNS verification records', () => {
  const input = normalizeCustomDomainInput({ hostname: 'https://Store.Example.com/path', mode: 'primary' });
  const verification = buildDomainVerification(input.hostname, 'abc123');
  const record = customDomainRecord({ id: 'dom_1', merchant_id: 'm1', hostname: input.hostname, verification_token: 'abc123', verification_record_name: verification.name, verification_record_value: verification.value });
  assert.equal(record.hostname, 'store.example.com');
  assert.equal(record.verificationRecordName, '_skyecommerce.store.example.com');
  assert.match(record.verificationRecordValue, /abc123/);
});

test('redirect and SEO entries feed sitemap XML', () => {
  const redirect = normalizeRedirectRuleInput({ fromPath: 'old-page', toPath: '/new-page', statusCode: 308 });
  assert.equal(redirect.fromPath, '/old-page');
  assert.equal(redirectRuleRecord({ id: 'red_1', from_path: redirect.fromPath, to_path: redirect.toPath, status_code: redirect.statusCode, active: 1 }).statusCode, 308);
  const seo = normalizeSeoEntryInput({ path: '/s/merchant-store/pages/about', title: 'About Merchant', schema: { '@type': 'AboutPage' } });
  const seoRecord = seoEntryRecord({ id: 'seo_1', path: seo.path, title: seo.title, schema_json: JSON.stringify(seo.schema) });
  const entries = buildSitemapEntries({ origin: 'https://store.example.com', merchant: { slug: 'merchant-store' }, products: [{ id: 'p1', slug: 'starter' }], pages: [], collections: [], seoEntries: [seoRecord] });
  assert.equal(entries.some((entry) => entry.loc === 'https://store.example.com/s/merchant-store/products/starter'), true);
  assert.match(renderSitemapXml(entries), /urlset/);
});
