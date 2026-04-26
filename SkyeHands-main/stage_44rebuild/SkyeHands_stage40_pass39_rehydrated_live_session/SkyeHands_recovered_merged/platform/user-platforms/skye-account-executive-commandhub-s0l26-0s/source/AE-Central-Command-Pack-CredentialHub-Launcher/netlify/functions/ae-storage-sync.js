const { writeSnapshot, latestSnapshot, listRecords } = require('./_shared/ae_runtime_db');
const { appendAuditEvent, writeUsageEvent } = require('./_shared/ae_state');

const MAX_HISTORY = 50;

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  };
}

function parseBody(event = {}) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return {};
  }
}

function readString(value) {
  return String(value ?? '').trim();
}

function readPositiveInt(value, fallback = 10) {
  const parsed = Number.parseInt(readString(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_HISTORY);
}

function summarizeRuntimeRecords() {
  const collections = ['clients', 'tasks', 'threads', 'messages', 'assignments', 'snapshots'];
  return collections.reduce((summary, key) => {
    summary[key] = listRecords(key).length;
    return summary;
  }, {});
}

function sanitizeSyncPayload(payload = {}) {
  const safePayload = typeof payload === 'object' && payload ? payload : {};
  return {
    source: readString(safePayload.source) || 'ae-commandhub-ui',
    reason: readString(safePayload.reason) || 'manual_sync',
    actorId: readString(safePayload.actorId) || 'ae-system',
    stateVersion: Number.parseInt(readString(safePayload.stateVersion || '1'), 10) || 1,
    snapshot: safePayload.snapshot && typeof safePayload.snapshot === 'object' ? safePayload.snapshot : {}
  };
}

module.exports.handler = async (event = {}) => {
  const method = readString(event.httpMethod || 'GET').toUpperCase();

  if (method === 'GET') {
    const query = event.queryStringParameters || {};
    const snapshot = latestSnapshot();
    const dataShape = summarizeRuntimeRecords();
    const historyLimit = readPositiveInt(query.historyLimit, 10);
    const snapshots = query.includeHistory === 'true'
      ? listRecords('snapshots').slice(-historyLimit).reverse()
      : [];

    await writeUsageEvent({
      route: 'ae-storage-sync',
      action: 'read_snapshot',
      detail: {
        hasSnapshot: Boolean(snapshot),
        includeHistory: query.includeHistory === 'true',
        historyReturned: snapshots.length,
        dataShape
      }
    });

    return json(200, {
      ok: true,
      snapshot,
      snapshots,
      dataShape
    });
  }

  if (method !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' });
  }

  const payload = sanitizeSyncPayload(parseBody(event));
  const dataShape = summarizeRuntimeRecords();
  const snapshotRow = writeSnapshot({
    source: payload.source,
    reason: payload.reason,
    actorId: payload.actorId,
    stateVersion: payload.stateVersion,
    syncedAt: new Date().toISOString(),
    dataShape,
    snapshot: payload.snapshot
  });

  await writeUsageEvent({ route: 'ae-storage-sync', action: 'write_snapshot', actorId: payload.actorId, detail: { snapshotId: snapshotRow.id, dataShape } });
  await appendAuditEvent({
    actorId: payload.actorId,
    actorType: 'system',
    action: 'ae_storage_snapshot_written',
    resource: snapshotRow.id,
    outcome: 'ok',
    detail: { source: payload.source, reason: payload.reason, stateVersion: payload.stateVersion }
  });

  return json(201, { ok: true, snapshot: snapshotRow, dataShape });
};
