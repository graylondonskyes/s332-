
const { assertMethod, json, noContent, readJsonBody } = require('./_printful');
const { deleteRecord, describeStore } = require('./_state-store');

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'POST');
    if (method === 'OPTIONS') return noContent(event);
    const body = await readJsonBody(event);
    if (!body.collection || !body.id) {
      return json(event, 400, { ok: false, error: 'collection and id are required.' });
    }
    await deleteRecord(body.collection, body.id);
    const storage = await describeStore();
    return json(event, 200, { ok: true, deleted: true, storage });
  } catch (error) {
    return json(event, error.statusCode || 500, { ok: false, error: error.message });
  }
};
