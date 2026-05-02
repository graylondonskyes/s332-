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
    const externalProductId = String(query.externalProductId || '').trim();
    const templateId = String(query.templateId || '').trim();

    if (!externalProductId && !templateId) {
      return json(event, 400, {
        ok: false,
        error: 'Provide either externalProductId or templateId.',
      });
    }

    const path = externalProductId
      ? `/product-templates/@${encodeURIComponent(externalProductId)}`
      : `/product-templates/${encodeURIComponent(templateId)}`;

    const data = await callPrintful({ path, method: 'GET', version: 'v1' });

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
