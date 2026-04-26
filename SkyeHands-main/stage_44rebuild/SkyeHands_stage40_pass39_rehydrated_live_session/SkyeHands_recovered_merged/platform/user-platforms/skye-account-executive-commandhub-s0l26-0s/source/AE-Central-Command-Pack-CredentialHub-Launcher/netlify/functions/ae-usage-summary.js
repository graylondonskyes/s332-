const { listUsageSummary } = require('./_shared/ae_state');

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  };
}

module.exports.handler = async () => {
  const summary = await listUsageSummary();
  const totals = summary.reduce((acc, row) => acc + (Number(row.count) || 0), 0);
  const topRoute = summary[0]?.route || null;

  return json(200, {
    ok: true,
    generatedAt: new Date().toISOString(),
    totalEvents: totals,
    distinctRoutes: summary.length,
    topRoute,
    summary
  });
};
