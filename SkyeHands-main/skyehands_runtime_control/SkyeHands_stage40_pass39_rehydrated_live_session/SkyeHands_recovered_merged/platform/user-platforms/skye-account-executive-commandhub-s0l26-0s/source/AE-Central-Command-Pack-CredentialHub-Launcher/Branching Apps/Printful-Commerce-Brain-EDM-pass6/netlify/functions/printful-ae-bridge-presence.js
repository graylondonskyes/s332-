const { listRecords, describeStore } = require('./_state-store');

exports.handler = async () => {
  try {
    const [presence, orders] = await Promise.all([
      listRecords('aeBridgePresence'),
      listRecords('aeBridgeOrders'),
    ]);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        exportedAt: new Date().toISOString(),
        presence: (presence || []).map(item => item.payload || item),
        orders: (orders || []).map(item => item.payload || item),
        storage: await describeStore(),
      })
    };
  } catch (error) {
    return { statusCode: error.statusCode || 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: error.message || 'AE bridge presence export failed' }) };
  }
};
