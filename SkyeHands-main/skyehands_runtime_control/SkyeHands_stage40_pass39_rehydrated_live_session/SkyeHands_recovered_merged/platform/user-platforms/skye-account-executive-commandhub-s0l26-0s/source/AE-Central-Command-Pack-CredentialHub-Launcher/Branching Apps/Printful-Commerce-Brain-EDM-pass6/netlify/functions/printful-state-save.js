
const { assertMethod, json, noContent, readJsonBody } = require('./_printful');
const { describeStore, saveRecord } = require('./_state-store');

exports.handler = async (event) => {
  try {
    const method = assertMethod(event, 'POST');
    if (method === 'OPTIONS') return noContent(event);
    const body = await readJsonBody(event);
    const collection = body.collection;
    const id = body.id || body.payload?.packageId || body.payload?.lockedOrderId || body.payload?.bundleId || body.payload?.packetId;
    const payload = body.payload ?? body.record ?? body.data;
    if (!collection || !id || !payload) {
      return json(event, 400, { ok: false, error: 'collection, id, and payload are required.' });
    }
    const record = await saveRecord(collection, id, payload, body.meta || {});
    const storage = await describeStore();
    return json(event, 200, { ok: true, record, storage });
  } catch (error) {
    return json(event, error.statusCode || 500, { ok: false, error: error.message });
  }
};
