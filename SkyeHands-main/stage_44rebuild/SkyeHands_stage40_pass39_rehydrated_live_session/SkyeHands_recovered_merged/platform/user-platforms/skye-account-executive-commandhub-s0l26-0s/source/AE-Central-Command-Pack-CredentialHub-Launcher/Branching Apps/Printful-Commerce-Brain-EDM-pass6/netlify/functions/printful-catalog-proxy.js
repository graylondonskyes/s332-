const {
  assertMethod,
  callPrintful,
  json,
  noContent,
  parseQuery,
} = require('./_printful');

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'GET');
    if (method === 'OPTIONS') return noContent(event);

    const query = parseQuery(event);
    const kind = String(query.kind || '').trim();
    const productId = String(query.productId || '').trim();
    const limit = String(query.limit || '50').trim();
    const offset = String(query.offset || '0').trim();

    let path;
    let version = 'v1';

    switch (kind) {
      case 'products':
        path = `/products`;
        break;
      case 'variants':
        if (!productId) {
          return json(event, 400, { ok: false, error: 'productId is required when kind=variants.' });
        }
        path = `/products/${encodeURIComponent(productId)}`;
        break;
      case 'categories':
        path = '/categories';
        break;
      case 'v2-products':
        version = 'v2';
        path = `/catalog-products?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;
        break;
      case 'v2-variants':
        version = 'v2';
        if (!productId) {
          return json(event, 400, { ok: false, error: 'productId is required when kind=v2-variants.' });
        }
        path = `/catalog-products/${encodeURIComponent(productId)}/catalog-variants?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`;
        break;
      default:
        return json(event, 400, {
          ok: false,
          error: 'Unsupported kind. Use one of: products, variants, categories, v2-products, v2-variants.',
        });
    }

    const data = await callPrintful({ path, method: 'GET', version });

    return json(event, 200, {
      ok: true,
      kind,
      result: data?.result || data || null,
    });
  } catch (error) {
    return json(event, error.statusCode || 500, {
      ok: false,
      error: error.message,
      printful: error.printful || null,
    });
  }
};
