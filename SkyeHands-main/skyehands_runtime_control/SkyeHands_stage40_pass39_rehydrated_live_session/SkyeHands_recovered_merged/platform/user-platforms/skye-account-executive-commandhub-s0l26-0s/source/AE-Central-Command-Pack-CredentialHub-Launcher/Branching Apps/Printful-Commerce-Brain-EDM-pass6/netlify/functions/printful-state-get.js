
const { assertMethod, json, noContent, parseQuery } = require('./_printful');
const { describeStore, getRecord } = require('./_state-store');

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'GET');
    if (method === 'OPTIONS') return noContent(event);
    const query = parseQuery(event);
    if (!query.collection || !query.id) {
      return json(event, 400, { ok: false, error: 'collection and id are required.' });
    }
    const record = await getRecord(query.collection, query.id);
    const storage = await describeStore();
    if (!record) return json(event, 404, { ok: false, error: 'Record not found.', storage });
    return json(event, 200, { ok: true, record, storage });
  } catch (error) {
    return json(event, error.statusCode || 500, { ok: false, error: error.message });
  }
};
