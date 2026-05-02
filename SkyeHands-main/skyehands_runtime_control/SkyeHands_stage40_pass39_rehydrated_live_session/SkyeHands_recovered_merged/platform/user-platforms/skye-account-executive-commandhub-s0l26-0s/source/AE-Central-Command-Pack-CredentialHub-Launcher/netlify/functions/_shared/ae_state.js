const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const runtimeRoot = path.resolve(__dirname, '..', '..', '.ae-runtime');
const stateFile = path.join(runtimeRoot, 'state.json');

function ensureRuntimeStore() {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  if (!fs.existsSync(stateFile)) {
    const seed = { usageEvents: [], auditEvents: [], smokeReports: [] };
    fs.writeFileSync(stateFile, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
  }
}

function loadState() {
  ensureRuntimeStore();
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch {
    return { usageEvents: [], auditEvents: [], smokeReports: [] };
  }
}

function saveState(next) {
  ensureRuntimeStore();
  fs.writeFileSync(stateFile, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
}

function toIsoNow() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') return {};
  return JSON.parse(JSON.stringify(payload));
}

async function writeUsageEvent(event = {}) {
  const state = loadState();
  const usageEvent = {
    id: makeId('usage'),
    createdAt: toIsoNow(),
    route: String(event.route || ''),
    action: String(event.action || ''),
    actorId: String(event.actorId || ''),
    tenantId: String(event.tenantId || 'default'),
    metrics: sanitizePayload(event.metrics || {}),
    detail: sanitizePayload(event.detail || {})
  };
  state.usageEvents.push(usageEvent);
  saveState(state);
  return { ok: true, event: usageEvent };
}

async function appendAuditEvent(event = {}) {
  const state = loadState();
  const auditEvent = {
    id: makeId('audit'),
    createdAt: toIsoNow(),
    actorId: String(event.actorId || 'system'),
    actorType: String(event.actorType || 'system'),
    action: String(event.action || 'unknown_action'),
    resource: String(event.resource || ''),
    tenantId: String(event.tenantId || 'default'),
    outcome: String(event.outcome || 'ok'),
    detail: sanitizePayload(event.detail || {})
  };
  state.auditEvents.push(auditEvent);
  saveState(state);
  return auditEvent;
}

async function upsertSmokeReport(report = {}) {
  const state = loadState();
  const id = String(report.id || makeId('smoke'));
  const existingIndex = state.smokeReports.findIndex((item) => item.id === id);
  const next = {
    id,
    createdAt: existingIndex >= 0 ? state.smokeReports[existingIndex].createdAt : toIsoNow(),
    updatedAt: toIsoNow(),
    suite: String(report.suite || 'unknown'),
    status: String(report.status || 'unknown'),
    summary: sanitizePayload(report.summary || {})
  };
  if (existingIndex >= 0) state.smokeReports[existingIndex] = next;
  else state.smokeReports.push(next);
  saveState(state);
  return next;
}

async function listUsageSummary() {
  const state = loadState();
  const byRoute = new Map();
  for (const event of state.usageEvents) {
    const key = event.route || 'unknown';
    const current = byRoute.get(key) || { route: key, count: 0, lastSeenAt: null };
    current.count += 1;
    current.lastSeenAt = event.createdAt;
    byRoute.set(key, current);
  }
  return Array.from(byRoute.values()).sort((a, b) => b.count - a.count);
}

async function listAuditEvents(limit = 200) {
  const state = loadState();
  return state.auditEvents.slice(-Math.max(1, Number(limit) || 200)).reverse();
}

async function listSmokeReports(limit = 50) {
  const state = loadState();
  return state.smokeReports.slice(-Math.max(1, Number(limit) || 50)).reverse();
}

module.exports = {
  writeUsageEvent,
  appendAuditEvent,
  upsertSmokeReport,
  listUsageSummary,
  listAuditEvents,
  listSmokeReports
};
