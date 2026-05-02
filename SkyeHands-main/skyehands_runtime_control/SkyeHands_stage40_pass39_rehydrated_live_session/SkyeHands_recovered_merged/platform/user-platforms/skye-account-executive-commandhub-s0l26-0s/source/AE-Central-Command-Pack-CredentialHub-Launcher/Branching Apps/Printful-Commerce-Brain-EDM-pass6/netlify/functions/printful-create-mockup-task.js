const {
  assertMethod,
  callPrintful,
  json,
  noContent,
  readJsonBody,
  requireEnv,
  isMockMode,
} = require('./_printful');
const { findVariant } = require('./_storefront');

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'POST');
    if (method === 'OPTIONS') return noContent(event);

    const body = await readJsonBody(event);
    const storeId = requireEnv('PRINTFUL_STORE_ID');
    const productTemplateId = Number(body.productTemplateId || 0);
    const productKey = String(body.productKey || '').trim();
    const variantIdRaw = body.variantId != null ? String(body.variantId) : String(body.variantKey || '').trim();
    const variant = findVariant(productKey, variantIdRaw);
    const mockMode = isMockMode();

    if (!productTemplateId && !mockMode) {
      return json(event, 400, { ok: false, error: 'productTemplateId is required.' });
    }
    if (!variant?.variantId && !mockMode) {
      return json(event, 400, { ok: false, error: 'A real numeric Printful variantId is required for mockup generation.' });
    }
    const resolvedTemplateId = productTemplateId || Number(body.mockTemplateId || 91001);
    const resolvedVariantId = Number(variant?.variantId || body.mockVariantId || 900001);

    const data = await callPrintful({
      path: `/mockup-generator/create-task/${encodeURIComponent(String(resolvedTemplateId))}`,
      method: 'POST',
      version: 'v1',
      headers: {
        'X-PF-Store-Id': String(storeId),
      },
      body: {
        variant_ids: [resolvedVariantId],
        format: String(body.format || 'jpg'),
        product_template_id: resolvedTemplateId,
      },
    });

    return json(event, 200, {
      ok: true,
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
