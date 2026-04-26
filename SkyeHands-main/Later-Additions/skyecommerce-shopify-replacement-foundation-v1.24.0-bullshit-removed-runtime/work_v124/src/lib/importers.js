import { slugify } from './utils.js';

function cents(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.round(num * 100)) : 0;
}

function stripTags(html = '') {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseCsvRows(csvText = '') {
  const rows = [];
  let current = '';
  let row = [];
  let inside = false;
  const pushCell = () => {
    row.push(current);
    current = '';
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];
    if (char === '"') {
      if (inside && next === '"') {
        current += '"';
        i += 1;
      } else {
        inside = !inside;
      }
      continue;
    }
    if (char === ',' && !inside) {
      pushCell();
      continue;
    }
    if ((char === '\n' || char === '\r') && !inside) {
      if (char === '\r' && next === '\n') i += 1;
      pushCell();
      pushRow();
      continue;
    }
    current += char;
  }
  if (current.length || row.length) {
    pushCell();
    pushRow();
  }
  return rows.filter((cells) => cells.some((cell) => String(cell).trim()));
}

export function parseShopifyCsvProducts(csvText = '') {
  const rows = parseCsvRows(csvText);
  if (!rows.length) return [];
  const headers = rows.shift().map((cell) => String(cell).trim().toLowerCase());
  const products = [];
  for (const cells of rows) {
    const row = Object.fromEntries(headers.map((key, idx) => [key, cells[idx] ?? '']));
    const title = row.title || row['product title'] || row.handle || '';
    if (!title) continue;
    const price = row['variant price'] || row.price || row['price'] || '0';
    const sku = row['variant sku'] || row.sku || '';
    const qty = row['variant inventory qty'] || row.inventory || row['inventory qty'] || '0';
    products.push({
      slug: slugify(row.handle || title),
      title,
      shortDescription: stripTags(row['body (html)'] || row.description || ''),
      descriptionHtml: row['body (html)'] || row.description || '',
      priceCents: Math.max(0, Math.round(Number(price || 0) * 100)),
      compareAtCents: Math.max(0, Math.round(Number(row['variant compare at price'] || 0) * 100)),
      sku,
      inventoryOnHand: Number(qty || 0) || 0,
      heroImageUrl: row.image_src || row.image || '',
      sourceType: 'shopify_csv',
      sourceRef: row.handle || title
    });
  }
  return products;
}

export function normalizeShopifyGraphQLProducts(payload) {
  const edges = payload?.data?.products?.edges || payload?.products?.edges || [];
  return edges
    .map((edge) => edge?.node)
    .filter(Boolean)
    .map((node) => {
      const firstVariant = node.variants?.edges?.[0]?.node || {};
      const firstImage = node.images?.edges?.[0]?.node || {};
      return {
        slug: slugify(node.handle || node.title || node.id),
        title: node.title || 'Untitled',
        shortDescription: stripTags(node.descriptionHtml || node.description || ''),
        descriptionHtml: node.descriptionHtml || node.description || '',
        priceCents: cents(firstVariant.price || firstVariant.priceV2?.amount || 0),
        compareAtCents: cents(firstVariant.compareAtPrice || firstVariant.compareAtPriceV2?.amount || 0),
        sku: firstVariant.sku || '',
        inventoryOnHand: Number(firstVariant.inventoryQuantity || 0) || 0,
        heroImageUrl: firstImage.url || node.featuredImage?.url || '',
        sourceType: 'shopify_graphql',
        sourceRef: node.id || node.handle || node.title
      };
    });
}

function extractJsonLd(html = '') {
  const matches = [...String(html).matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const nodes = [];
  for (const match of matches) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) nodes.push(...parsed);
      else if (parsed['@graph']) nodes.push(...parsed['@graph']);
      else nodes.push(parsed);
    } catch {
      // ignore bad JSON-LD
    }
  }
  return nodes;
}

function extractMeta(html = '', key) {
  const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  return html.match(regex)?.[1] || '';
}

export function scanStoreHtml(html = '', baseUrl = '') {
  const out = [];
  const jsonLd = extractJsonLd(html);
  for (const node of jsonLd) {
    const type = Array.isArray(node['@type']) ? node['@type'].join(',') : node['@type'];
    if (!String(type || '').toLowerCase().includes('product')) continue;
    const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers || {};
    const title = node.name || '';
    if (!title) continue;
    out.push({
      slug: slugify(title),
      title,
      shortDescription: stripTags(node.description || ''),
      descriptionHtml: node.description || '',
      priceCents: cents(offers.price || 0),
      compareAtCents: 0,
      sku: node.sku || '',
      inventoryOnHand: 0,
      heroImageUrl: Array.isArray(node.image) ? node.image[0] : node.image || '',
      sourceType: 'url_scan',
      sourceRef: baseUrl
    });
  }
  if (out.length) return out;
  const title = extractMeta(html, 'og:title') || html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
  const description = extractMeta(html, 'og:description') || '';
  const image = extractMeta(html, 'og:image') || '';
  const price = extractMeta(html, 'product:price:amount') || html.match(/[$]([0-9]+(?:\.[0-9]{2})?)/)?.[1] || '0';
  if (!title) return [];
  return [{
    slug: slugify(title),
    title,
    shortDescription: stripTags(description),
    descriptionHtml: description,
    priceCents: cents(price),
    compareAtCents: 0,
    sku: '',
    inventoryOnHand: 0,
    heroImageUrl: image,
    sourceType: 'url_scan',
    sourceRef: baseUrl
  }];
}

export async function fetchAndScanStorefront(url, fetchImpl = fetch, maxPages = 12) {
  const origin = new URL(url).origin;
  const queue = [url];
  const visited = new Set();
  const products = [];
  while (queue.length && visited.size < maxPages) {
    const nextUrl = queue.shift();
    if (!nextUrl || visited.has(nextUrl)) continue;
    visited.add(nextUrl);
    const res = await fetchImpl(nextUrl, { headers: { 'user-agent': 'SkyeCommerce Importer/0.1' } });
    const html = await res.text();
    products.push(...scanStoreHtml(html, nextUrl));
    const matches = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
    for (const href of matches) {
      try {
        const absolute = new URL(href, nextUrl).toString();
        const urlObj = new URL(absolute);
        if (urlObj.origin !== origin) continue;
        if (!/(product|products|shop|item)/i.test(urlObj.pathname)) continue;
        if (!visited.has(absolute) && !queue.includes(absolute)) queue.push(absolute);
      } catch {
        // ignore bad href
      }
    }
  }
  const deduped = new Map();
  for (const product of products) {
    const key = product.slug || slugify(product.title);
    if (!deduped.has(key)) deduped.set(key, product);
  }
  return [...deduped.values()];
}
