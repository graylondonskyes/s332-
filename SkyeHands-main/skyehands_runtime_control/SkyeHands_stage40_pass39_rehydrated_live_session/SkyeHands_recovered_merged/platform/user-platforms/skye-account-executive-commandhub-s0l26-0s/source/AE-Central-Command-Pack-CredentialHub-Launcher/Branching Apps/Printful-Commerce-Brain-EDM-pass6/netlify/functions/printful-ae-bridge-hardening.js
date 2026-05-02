const { listRecords, describeStore } = require('./_state-store');

exports.handler = async () => {
  try {
    const [hardening, contractPackets, replayQueue] = await Promise.all([
      listRecords('aeBridgeHardening'),
      listRecords('aeBridgeContract'),
      listRecords('aeBridgeReplayQueue'),
    ]);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        exportedAt: new Date().toISOString(),
        hardening: (hardening || []).map(item => item.payload || item),
        contractPackets: (contractPackets || []).map(item => item.payload || item),
        replayQueue: (replayQueue || []).map(item => item.payload || item),
        storage: await describeStore(),
      })
    };
  } catch (error) {
    return { statusCode: error.statusCode || 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: error.message || 'AE bridge hardening export failed' }) };
  }
};
