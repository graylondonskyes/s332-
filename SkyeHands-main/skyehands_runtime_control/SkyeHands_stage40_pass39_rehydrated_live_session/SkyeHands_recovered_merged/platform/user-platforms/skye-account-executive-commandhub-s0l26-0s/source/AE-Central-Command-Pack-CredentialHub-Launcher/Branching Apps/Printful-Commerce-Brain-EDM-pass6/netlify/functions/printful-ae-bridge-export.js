const { listRecords, describeStore } = require('./_state-store');

exports.handler = async () => {
  try {
    const [leads, orders, sync, catalog, metrics, alerts, contractPackets, artPackets, profitability, replayQueue, presence, hardening, returns, incidents, fulfillmentPackets, settlementPackets, webhookEvents, trackingPackets] = await Promise.all([
      listRecords('aeBridgeLeads'),
      listRecords('aeBridgeOrders'),
      listRecords('aeBridgeSync'),
      listRecords('aeBridgeCatalog'),
      listRecords('aeBridgeMetrics'),
      listRecords('aeBridgeAlerts'),
      listRecords('aeBridgeContract'),
      listRecords('aeBridgeArtPackets'),
      listRecords('aeBridgeProfitability'),
      listRecords('aeBridgeReplayQueue'),
      listRecords('aeBridgePresence'),
      listRecords('aeBridgeHardening'),
      listRecords('aeBridgeReturns'),
      listRecords('aeBridgeIncidents'),
      listRecords('aeBridgeFulfillmentPackets'),
      listRecords('aeBridgeSettlementPackets'),
      listRecords('aeBridgeWebhookEvents'),
      listRecords('aeBridgeTrackingPackets'),
    ]);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        exportedAt: new Date().toISOString(),
        leads: (leads || []).map(item => item.payload || item),
        orders: (orders || []).map(item => item.payload || item),
        sync: (sync || []).map(item => item.payload || item),
        catalog: (catalog || []).map(item => item.payload || item),
        metrics: (metrics || []).map(item => item.payload || item),
        alerts: (alerts || []).map(item => item.payload || item),
        contractPackets: (contractPackets || []).map(item => item.payload || item),
        artPackets: (artPackets || []).map(item => item.payload || item),
        profitability: (profitability || []).map(item => item.payload || item),
        replayQueue: (replayQueue || []).map(item => item.payload || item),
        presence: (presence || []).map(item => item.payload || item),
        hardening: (hardening || []).map(item => item.payload || item),
        returns: (returns || []).map(item => item.payload || item),
        incidents: (incidents || []).map(item => item.payload || item),
        fulfillmentPackets: (fulfillmentPackets || []).map(item => item.payload || item),
        settlementPackets: (settlementPackets || []).map(item => item.payload || item),
        webhookEvents: (webhookEvents || []).map(item => item.payload || item),
        trackingPackets: (trackingPackets || []).map(item => item.payload || item),
        storage: await describeStore(),
      })
    };
  } catch (error) {
    return { statusCode: error.statusCode || 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: error.message || 'AE bridge export failed' }) };
  }
};
