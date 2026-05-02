const { appendAuditEvent, listSmokeReports, writeUsageEvent } = require('./_shared/ae_state');

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  };
}

function parseLimit(event = {}, fallback = 25) {
  const raw = event?.queryStringParameters?.limit;
  const parsed = Number.parseInt(String(raw ?? fallback), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, 200));
}

module.exports.handler = async (event = {}) => {
  const limit = parseLimit(event, 25);
  const reports = await listSmokeReports(limit);
  const statusCounts = reports.reduce((acc, row) => {
    const key = String(row?.status || 'unknown').toUpperCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  await writeUsageEvent({ route: 'ae-brain-smoke-reports', action: 'list_smoke_reports', detail: { limit, returned: reports.length } });
  await appendAuditEvent({ action: 'ae_brain_smoke_reports_read', resource: 'smoke_reports', detail: { limit, returned: reports.length, statusCounts } });

  return json(200, {
    ok: true,
    generatedAt: new Date().toISOString(),
    limit,
    count: reports.length,
    statusCounts,
    reports
  });
};
