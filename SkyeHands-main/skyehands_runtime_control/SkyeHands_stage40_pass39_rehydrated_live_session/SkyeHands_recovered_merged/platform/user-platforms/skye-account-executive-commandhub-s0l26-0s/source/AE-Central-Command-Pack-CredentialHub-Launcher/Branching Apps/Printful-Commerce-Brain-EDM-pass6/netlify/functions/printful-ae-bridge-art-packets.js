const { listRecords, describeStore } = require('./_state-store');

exports.handler = async () => {
  try {
    const artPackets = await listRecords('aeBridgeArtPackets');
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, exportedAt: new Date().toISOString(), artPackets: (artPackets || []).map(item => item.payload || item), storage: await describeStore() }) };
  } catch (error) {
    return { statusCode: error.statusCode || 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: error.message || 'AE bridge art packet export failed' }) };
  }
};
