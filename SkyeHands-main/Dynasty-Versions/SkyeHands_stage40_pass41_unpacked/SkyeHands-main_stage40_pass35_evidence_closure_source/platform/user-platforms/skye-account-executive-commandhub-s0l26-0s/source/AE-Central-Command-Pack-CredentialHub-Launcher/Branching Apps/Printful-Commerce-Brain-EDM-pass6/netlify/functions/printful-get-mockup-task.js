const {
  assertMethod,
  callPrintful,
  json,
  noContent,
  parseQuery,
  requireEnv,
} = require('./_printful');

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'GET');
    if (method === 'OPTIONS') return noContent(event);

    const query = parseQuery(event);
    const taskKey = String(query.taskKey || '').trim();
    const storeId = requireEnv('PRINTFUL_STORE_ID');

    if (!taskKey) {
      return json(event, 400, { ok: false, error: 'taskKey is required.' });
    }

    const data = await callPrintful({
      path: `/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`,
      method: 'GET',
      version: 'v1',
      headers: {
        'X-PF-Store-Id': String(storeId),
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
