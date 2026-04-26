const { listUsageSummary, listSmokeReports } = require('./_shared/ae_state');

module.exports.handler = async () => {
  const usageSummary = await listUsageSummary();
  const smokeReports = await listSmokeReports(5);
  const payload = {
    type: 'ae_stream_snapshot',
    emittedAt: new Date().toISOString(),
    usageTopRoute: usageSummary[0] || null,
    latestSmoke: smokeReports[0] || null
  };

  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive'
    },
    body: `event: ae_snapshot\ndata: ${JSON.stringify(payload)}\n\n`
  };
};
