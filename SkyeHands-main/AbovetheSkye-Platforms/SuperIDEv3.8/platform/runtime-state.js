const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { canonicalize } = require('./export-import');
const { emptyCommerceState } = require('./commerce');

function nowIso() { return new Date().toISOString(); }
function randomId(prefix='id') { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }

function defaultRuntimeState() {
  return canonicalize({
    schema: 'skye.runtime.state',
    version: '3.3.0',
    updated_at: nowIso(),
    auth: { refresh_tokens: [], revoked_jtis: [], operator_logins: [] },
    payments: { pending_sessions: [], completed_orders: [], webhook_events: [], reconciliations: [] },
    commerce: emptyCommerceState(),
    submissions: [],
    submission_jobs: [],
    portal_runs: [],
    audit: []
  });
}

function mergeRuntimeState(value) {
  const base = defaultRuntimeState();
  const next = { ...base, ...(value || {}) };
  next.auth = { ...base.auth, ...((value || {}).auth || {}) };
  next.payments = { ...base.payments, ...((value || {}).payments || {}) };
  next.commerce = (value || {}).commerce && (value || {}).commerce.schema === 'skye.directsale.state' ? (value || {}).commerce : base.commerce;
  next.submissions = Array.isArray((value || {}).submissions) ? (value || {}).submissions : [];
  next.submission_jobs = Array.isArray((value || {}).submission_jobs) ? (value || {}).submission_jobs : [];
  next.portal_runs = Array.isArray((value || {}).portal_runs) ? (value || {}).portal_runs : [];
  next.audit = Array.isArray((value || {}).audit) ? (value || {}).audit : [];
  return canonicalize(next);
}

function resolveJournalPath(filePath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  return path.join(dir, `${base}.journal.ndjson`);
}

function writeAtomicJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function appendJournalEvent(filePath, event) {
  const journalPath = resolveJournalPath(filePath);
  fs.mkdirSync(path.dirname(journalPath), { recursive: true });
  fs.appendFileSync(journalPath, `${JSON.stringify(canonicalize(event))}\n`, 'utf8');
  return journalPath;
}

function replayJournal(filePath) {
  const journalPath = resolveJournalPath(filePath);
  let state = defaultRuntimeState();
  if (!fs.existsSync(journalPath)) return state;
  const lines = fs.readFileSync(journalPath, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type === 'state-snapshot' && entry.state) state = mergeRuntimeState(entry.state);
      else if (entry.type === 'audit' && entry.event) state.audit.push(entry.event);
    } catch {
      // ignore malformed journal entries; the latest valid snapshot still wins
    }
  }
  return mergeRuntimeState(state);
}

function loadRuntimeState(filePath) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!value || value.schema !== 'skye.runtime.state') throw new Error('bad-schema');
    return mergeRuntimeState(value);
  } catch {
    return replayJournal(filePath);
  }
}

function saveRuntimeState(filePath, state) {
  const next = canonicalize({ ...mergeRuntimeState(state), updated_at: nowIso() });
  writeAtomicJson(filePath, next);
  appendJournalEvent(filePath, { at: nowIso(), type: 'state-snapshot', version: next.version, state: next });
  return next;
}

function appendAuditEvent(state, event) {
  const next = mergeRuntimeState(state || defaultRuntimeState());
  next.audit.push(canonicalize({ at: nowIso(), ...event }));
  return canonicalize(next);
}

function recordPortalRun(state, portalRun) {
  const next = mergeRuntimeState(state || defaultRuntimeState());
  next.portal_runs.push(canonicalize({ at: nowIso(), ...portalRun }));
  return canonicalize(next);
}

function hasProcessedWebhookEvent(state, eventId) {
  return !!((state?.payments?.webhook_events || []).find((item) => item.event_id === eventId));
}

function hasCompletedPaymentSession(state, sessionId) {
  return !!((state?.payments?.completed_orders || []).find((item) => item.session_id === sessionId));
}

function createSubmissionJobRecord(job, requestPreview) {
  return canonicalize({
    schema: 'skye.runtime.submission.job',
    version: '3.3.0',
    record_id: randomId('subrec'),
    job_id: job.job_id,
    channel: job.channel,
    title: job.title,
    slug: job.slug,
    package_path: job.package_path,
    package_name: job.package_name,
    package_sha256: job.package_sha256,
    package_bytes: job.package_bytes,
    metadata: job.metadata || {},
    request_preview: requestPreview || null,
    workflow_preview: requestPreview?.stages || requestPreview?.workflow?.steps || [],
    portal_plan: null,
    portal_last_run: null,
    status: 'created',
    created_at: nowIso(),
    updated_at: nowIso(),
    dispatched_at: null,
    completed_at: null,
    cancelled_at: null,
    remote_reference: null,
    remote_status: null,
    remote_last_error: null,
    last_receipt: null,
    remote_history: []
  });
}

function upsertSubmissionJob(state, record) {
  const next = mergeRuntimeState(state || defaultRuntimeState());
  const idx = next.submission_jobs.findIndex((item) => item.job_id === record.job_id);
  const normalized = canonicalize({ ...record, updated_at: nowIso() });
  if (idx >= 0) next.submission_jobs[idx] = normalized; else next.submission_jobs.push(normalized);
  return canonicalize(next);
}

function getSubmissionJob(state, jobId) {
  return (mergeRuntimeState(state).submission_jobs || []).find((item) => item.job_id === jobId) || null;
}

function appendSubmissionRemoteEvent(record, event) {
  const history = Array.isArray(record.remote_history) ? record.remote_history.slice() : [];
  history.push(canonicalize({ at: nowIso(), ...event }));
  return history;
}

function markSubmissionJobDispatched(record, receipt) {
  return canonicalize({
    ...record,
    status: 'submitted',
    dispatched_at: record.dispatched_at || nowIso(),
    updated_at: nowIso(),
    remote_reference: receipt.remote_reference || receipt.remote_receipt?.reference || receipt.job_id,
    remote_status: receipt.remote_status || receipt.remote_receipt?.status || 'accepted',
    last_receipt: receipt,
    remote_history: appendSubmissionRemoteEvent(record, {
      type: 'dispatch',
      transport_status: receipt.transport_status,
      request_body_kind: receipt.request_body_kind,
      remote_reference: receipt.remote_reference || receipt.remote_receipt?.reference || receipt.job_id,
      workflow_steps: receipt.workflow_steps || [],
      workflow_step_count: receipt.workflow_step_count || 0
    })
  });
}

function markSubmissionJobStatus(record, statusReceipt) {
  return canonicalize({
    ...record,
    status: statusReceipt.job_status || record.status,
    updated_at: nowIso(),
    completed_at: statusReceipt.job_status === 'completed' ? (record.completed_at || nowIso()) : record.completed_at,
    remote_status: statusReceipt.remote_status || record.remote_status,
    remote_last_error: statusReceipt.error || null,
    last_receipt: statusReceipt,
    remote_history: appendSubmissionRemoteEvent(record, {
      type: 'status-sync',
      remote_status: statusReceipt.remote_status,
      job_status: statusReceipt.job_status,
      error: statusReceipt.error || null
    })
  });
}

function markSubmissionJobCancelled(record, cancelReceipt) {
  return canonicalize({
    ...record,
    status: 'cancelled',
    cancelled_at: record.cancelled_at || nowIso(),
    updated_at: nowIso(),
    remote_status: cancelReceipt.remote_status || 'cancelled',
    remote_last_error: cancelReceipt.error || null,
    last_receipt: cancelReceipt,
    remote_history: appendSubmissionRemoteEvent(record, {
      type: 'cancel',
      remote_status: cancelReceipt.remote_status || 'cancelled',
      error: cancelReceipt.error || null
    })
  });
}

function markSubmissionJobPortalPlanned(record, plan) {
  return canonicalize({
    ...record,
    portal_plan: plan,
    updated_at: nowIso(),
    remote_history: appendSubmissionRemoteEvent(record, { type: 'portal-plan', step_count: Array.isArray(plan?.steps) ? plan.steps.length : 0 })
  });
}

function markSubmissionJobPortalRun(record, portalReceipt) {
  return canonicalize({
    ...record,
    portal_last_run: portalReceipt,
    remote_reference: portalReceipt.remote_reference || record.remote_reference,
    remote_status: portalReceipt.remote_status || record.remote_status,
    updated_at: nowIso(),
    remote_history: appendSubmissionRemoteEvent(record, {
      type: 'portal-run',
      ok: portalReceipt.ok === true,
      remote_reference: portalReceipt.remote_reference || null,
      remote_status: portalReceipt.remote_status || null,
      screenshot_count: Array.isArray(portalReceipt.screenshots) ? portalReceipt.screenshots.length : 0
    })
  });
}

module.exports = {
  defaultRuntimeState,
  mergeRuntimeState,
  resolveJournalPath,
  replayJournal,
  loadRuntimeState,
  saveRuntimeState,
  appendAuditEvent,
  recordPortalRun,
  hasProcessedWebhookEvent,
  hasCompletedPaymentSession,
  createSubmissionJobRecord,
  upsertSubmissionJob,
  getSubmissionJob,
  markSubmissionJobDispatched,
  markSubmissionJobStatus,
  markSubmissionJobCancelled,
  markSubmissionJobPortalPlanned,
  markSubmissionJobPortalRun
};
