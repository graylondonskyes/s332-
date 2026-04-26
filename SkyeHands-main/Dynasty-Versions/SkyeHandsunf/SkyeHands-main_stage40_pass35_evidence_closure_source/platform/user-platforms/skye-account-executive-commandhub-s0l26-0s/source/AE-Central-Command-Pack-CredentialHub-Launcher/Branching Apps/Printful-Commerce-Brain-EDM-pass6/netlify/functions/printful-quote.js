const { assertMethod, json, noContent, readJsonBody, parseQuery } = require('./_printful');
const { calculateQuote } = require('./_storefront');

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return noContent(event);

    let payload = {};
    if (event.httpMethod === 'GET') {
      payload = parseQuery(event);
    } else if (event.httpMethod === 'POST') {
      assertMethod(event, 'POST');
      payload = await readJsonBody(event);
    } else {
      assertMethod(event, 'GET');
    }

    const quote = calculateQuote({
      productKey: String(payload.productKey || '').trim(),
      variantId: payload.variantId != null ? String(payload.variantId) : String(payload.variantKey || '').trim(),
      quantity: Number(payload.quantity || 1),
      extraLogoCount: Number(payload.extraLogoCount || 1),
      rush: String(payload.rush || 'false').toLowerCase() === 'true' || payload.rush === true,
      shippingSpeed: payload.shippingSpeed || payload.shipping || 'STANDARD',
      printMethod: payload.printMethod || 'print',
      placementKey: payload.placementKey || payload.placement || null,
    });

    return json(event, 200, {
      ok: true,
      quote,
    });
  } catch (error) {
    return json(event, error.statusCode || 500, {
      ok: false,
      error: error.message,
    });
  }
};
