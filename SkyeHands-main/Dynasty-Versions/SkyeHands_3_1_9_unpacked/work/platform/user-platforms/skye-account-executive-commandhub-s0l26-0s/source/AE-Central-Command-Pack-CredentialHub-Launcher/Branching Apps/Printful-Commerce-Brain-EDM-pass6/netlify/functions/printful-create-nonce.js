const {
  assertMethod,
  callPrintful,
  json,
  noContent,
  readJsonBody,
  requestIp,
  requestUserAgent,
} = require('./_printful');

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'POST');
    if (method === 'OPTIONS') return noContent(event);

    const body = await readJsonBody(event);
    const externalProductId = String(body.externalProductId || '').trim();
    const externalCustomerId = body.externalCustomerId ? String(body.externalCustomerId).trim() : null;

    if (!externalProductId) {
      return json(event, 400, { ok: false, error: 'externalProductId is required.' });
    }

    const bindToRequest = String(process.env.PRINTFUL_BIND_NONCE_TO_REQUEST || 'true').toLowerCase() === 'true';

    const payload = {
      external_product_id: externalProductId,
      external_customer_id: externalCustomerId || null,
      ip_address: bindToRequest ? requestIp(event) : null,
      user_agent: bindToRequest ? requestUserAgent(event) : null,
    };

    const data = await callPrintful({
      path: '/embedded-designer/nonces',
      method: 'POST',
      body: payload,
      version: 'v1',
    });

    return json(event, 200, {
      ok: true,
      nonce: data?.result?.nonce || null,
      templateId: data?.result?.template_id || null,
      expiresAt: data?.result?.expires_at || null,
      externalProductId,
    });
  } catch (error) {
    return json(event, error.statusCode || 500, {
      ok: false,
      error: error.message,
      printful: error.printful || null,
    });
  }
};
