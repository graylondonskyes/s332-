const { saveRecord, describeStore } = require('./_state-store');

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const lead = body.lead || null;
    const order = body.order || null;
    const sync = body.sync || null;
    const catalog = body.catalog || null;
    const metrics = body.metrics || null;
    const alerts = body.alerts || null;
    const contract = body.contract || null;
    const artPacket = body.artPacket || null;
    const profitability = body.profitability || null;
    const replay = body.replay || null;
    const presence = body.presence || null;
    const hardening = body.hardening || null;
    const returns = body.returns || null;
    const incidents = body.incidents || null;
    const saved = [];
    if (lead?.id) saved.push({ kind: 'lead', record: await saveRecord('aeBridgeLeads', lead.id, lead, { source: 'ae-command' }) });
    if (order?.id) saved.push({ kind: 'order', record: await saveRecord('aeBridgeOrders', order.id, order, { source: 'ae-command' }) });
    if (sync?.id) saved.push({ kind: 'sync', record: await saveRecord('aeBridgeSync', sync.id, sync, { source: 'ae-command' }) });
    if (catalog?.id) saved.push({ kind: 'catalog', record: await saveRecord('aeBridgeCatalog', catalog.id, catalog, { source: 'ae-command' }) });
    if (metrics?.id) saved.push({ kind: 'metrics', record: await saveRecord('aeBridgeMetrics', metrics.id, metrics, { source: 'ae-command' }) });
    if (alerts?.id) saved.push({ kind: 'alerts', record: await saveRecord('aeBridgeAlerts', alerts.id, alerts, { source: 'ae-command' }) });
    if (contract?.id) saved.push({ kind: 'contract', record: await saveRecord('aeBridgeContract', contract.id, contract, { source: 'ae-command' }) });
    if (artPacket?.id) saved.push({ kind: 'artPacket', record: await saveRecord('aeBridgeArtPackets', artPacket.id, artPacket, { source: 'ae-command' }) });
    if (profitability?.id) saved.push({ kind: 'profitability', record: await saveRecord('aeBridgeProfitability', profitability.id, profitability, { source: 'ae-command' }) });
    if (replay?.id) saved.push({ kind: 'replay', record: await saveRecord('aeBridgeReplayQueue', replay.id, replay, { source: 'ae-command' }) });
    if (presence?.id) saved.push({ kind: 'presence', record: await saveRecord('aeBridgePresence', presence.id, presence, { source: 'ae-command' }) });
    if (hardening?.id) saved.push({ kind: 'hardening', record: await saveRecord('aeBridgeHardening', hardening.id, hardening, { source: 'ae-command' }) });
    if (returns?.id) saved.push({ kind: 'returns', record: await saveRecord('aeBridgeReturns', returns.id, returns, { source: 'ae-command' }) });
    if (incidents?.id) saved.push({ kind: 'incidents', record: await saveRecord('aeBridgeIncidents', incidents.id, incidents, { source: 'ae-command' }) });
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true, saved, storage: await describeStore() }) };
  } catch (error) {
    return { statusCode: error.statusCode || 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: error.message || 'AE bridge import failed' }) };
  }
};
