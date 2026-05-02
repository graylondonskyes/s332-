const { latestSnapshot, writeSnapshot } = require('./_shared/ae_runtime_db');
const { appendAuditEvent, writeUsageEvent } = require('./_shared/ae_state');

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  };
}

async function saveStateSnapshot(payload = {}) {
  const snapshot = writeSnapshot(payload);
  await writeUsageEvent({ route: 'ae-branch-state', action: 'snapshot_saved', detail: { snapshotId: snapshot.id } });
  await appendAuditEvent({ action: 'ae_branch_state_snapshot_saved', resource: snapshot.id, detail: { payloadKeys: Object.keys(payload || {}) } });
  return { ok: true, snapshot };
}

module.exports.saveStateSnapshot = saveStateSnapshot;
module.exports.handler = async (event = {}) => {
  if (event.httpMethod === 'POST') {
    const payload = event.body ? JSON.parse(event.body) : {};
    const result = await saveStateSnapshot(payload);
    return json(201, result);
  }

  const snapshot = latestSnapshot();
  await writeUsageEvent({ route: 'ae-branch-state', action: 'snapshot_read', detail: { hasSnapshot: Boolean(snapshot) } });
  return json(200, { ok: true, snapshot });
};
