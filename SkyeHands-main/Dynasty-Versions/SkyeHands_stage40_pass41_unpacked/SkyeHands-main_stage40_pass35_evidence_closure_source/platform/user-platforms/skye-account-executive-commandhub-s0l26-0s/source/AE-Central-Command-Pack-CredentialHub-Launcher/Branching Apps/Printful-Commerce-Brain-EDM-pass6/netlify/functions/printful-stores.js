const {
  assertMethod,
  callPrintful,
  json,
  noContent,
} = require('./_printful');

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'GET');
    if (method === 'OPTIONS') return noContent(event);

    const data = await callPrintful({ path: '/stores', method: 'GET', version: 'v1' });

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
