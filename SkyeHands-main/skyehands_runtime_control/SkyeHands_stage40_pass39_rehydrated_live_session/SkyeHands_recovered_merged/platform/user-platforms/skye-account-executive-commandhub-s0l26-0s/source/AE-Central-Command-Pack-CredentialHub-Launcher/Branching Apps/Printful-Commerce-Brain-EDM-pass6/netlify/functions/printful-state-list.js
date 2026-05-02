
const { assertMethod, json, noContent, parseQuery } = require('./_printful');
const { describeStore, listRecords } = require('./_state-store');

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'GET');
    if (method === 'OPTIONS') return noContent(event);
    const query = parseQuery(event);
    const collections = String(query.collections || 'incomingArtifacts,lockedOrders,clientPackages')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const results = {};
    for (const collection of collections) {
      results[collection] = await listRecords(collection);
    }
    const storage = await describeStore();
    return json(event, 200, { ok: true, collections: results, storage });
  } catch (error) {
    return json(event, error.statusCode || 500, { ok: false, error: error.message });
  }
};
