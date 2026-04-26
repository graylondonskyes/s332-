import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeShopifyGraphQLProducts, parseShopifyCsvProducts, scanStoreHtml } from '../src/lib/importers.js';

test('parseShopifyCsvProducts maps a minimal Shopify CSV row', () => {
  const csv = `Handle,Title,Body (HTML),Variant SKU,Variant Price,Variant Inventory Qty,Image Src\nalpha-product,Alpha Product,"<p>Hello</p>",SKU-1,19.99,8,https://img.test/a.jpg`;
  const products = parseShopifyCsvProducts(csv);
  assert.equal(products.length, 1);
  assert.equal(products[0].slug, 'alpha-product');
  assert.equal(products[0].priceCents, 1999);
  assert.equal(products[0].inventoryOnHand, 8);
});

test('normalizeShopifyGraphQLProducts maps a GraphQL payload', () => {
  const payload = {
    data: {
      products: {
        edges: [
          {
            node: {
              id: 'gid://shopify/Product/1',
              handle: 'beta-product',
              title: 'Beta Product',
              descriptionHtml: '<p>Beta</p>',
              images: { edges: [{ node: { url: 'https://img.test/b.jpg' } }] },
              variants: { edges: [{ node: { sku: 'BETA-1', inventoryQuantity: 4, price: '12.50', compareAtPrice: '15.00' } }] }
            }
          }
        ]
      }
    }
  };
  const products = normalizeShopifyGraphQLProducts(payload);
  assert.equal(products[0].slug, 'beta-product');
  assert.equal(products[0].priceCents, 1250);
  assert.equal(products[0].compareAtCents, 1500);
});

test('scanStoreHtml extracts JSON-LD products', () => {
  const html = `
    <html><head><script type="application/ld+json">{
      "@type":"Product",
      "name":"Gamma Product",
      "description":"Gamma description",
      "image":"https://img.test/g.jpg",
      "offers":{"price":"24.99"}
    }</script></head></html>`;
  const products = scanStoreHtml(html, 'https://store.test/products/gamma');
  assert.equal(products.length, 1);
  assert.equal(products[0].title, 'Gamma Product');
  assert.equal(products[0].priceCents, 2499);
});
