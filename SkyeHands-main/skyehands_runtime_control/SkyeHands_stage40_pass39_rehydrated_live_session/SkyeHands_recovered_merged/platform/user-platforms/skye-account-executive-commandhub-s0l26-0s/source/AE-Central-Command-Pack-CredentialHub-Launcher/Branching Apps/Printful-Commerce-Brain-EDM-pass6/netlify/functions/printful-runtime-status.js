const { assertMethod, json, noContent, isMockMode } = require('./_printful');
const { getPublicCatalog } = require('./_storefront');
const { describeStore } = require('./_state-store');

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'GET');
    if (method === 'OPTIONS') return noContent(event);

    const mockMode = isMockMode();
    const tokenReady = mockMode || Boolean(process.env.PRINTFUL_API_TOKEN);
    const storeReady = mockMode || Boolean(process.env.PRINTFUL_STORE_ID);
    const originReady = Boolean(process.env.PRINTFUL_ALLOWED_ORIGIN);
    const printfulReady = tokenReady && storeReady;
    const storage = await describeStore();

    return json(event, 200, {
      ok: true,
      runtime: {
        tokenReady,
        storeReady,
        originReady,
        printfulReady,
        mockMode,
        orderConfirmDefault: String(process.env.PRINTFUL_ORDER_CONFIRM_DEFAULT || 'false').toLowerCase() === 'true',
        bindNonceToRequest: String(process.env.PRINTFUL_BIND_NONCE_TO_REQUEST || 'true').toLowerCase() === 'true',
        storage,
      },
      catalog: getPublicCatalog(),
    });
  } catch (error) {
    return json(event, error.statusCode || 500, {
      ok: false,
      error: error.message,
    });
  }
};
