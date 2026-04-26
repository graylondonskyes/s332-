import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { appendAuditEvent } from './governance-manager.mjs';
import { publishRuntimeEvent } from './runtime-bus.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function normalizeWorkspaceId(value) {
  return String(value || '').trim() || 'local-default';
}

function normalizeTenantId(value) {
  return String(value || '').trim().toLowerCase() || 'local';
}

function normalizeRuleId(value, fallback = 'ops-rule') {
  return String(value || '').trim().toLowerCase() || fallback;
}

function normalizeMetricKey(value) {
  return String(value || '').trim() || 'unknownMetric';
}

function normalizeComparator(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'].includes(normalized) ? normalized : 'gt';
}

function normalizeSeverity(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['low', 'medium', 'high', 'critical'].includes(normalized) ? normalized : 'medium';
}

function normalizeStatus(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeArray(values = []) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))];
}

function emptyStore() {
  return {
    version: 1,
    watchRules: {},
    alerts: [],
    incidents: [],
    metrics: []
  };
}

function normalizeWatchRule(record = {}, fallbackRuleId = 'ops-rule') {
  const ruleId = normalizeRuleId(record.ruleId || record.id || record.metric, fallbackRuleId);
  return {
    ruleId,
    workspaceId: record.workspaceId ? normalizeWorkspaceId(record.workspaceId) : null,
    tenantId: normalizeTenantId(record.tenantId),
    metric: normalizeMetricKey(record.metric),
    comparator: normalizeComparator(record.comparator),
    threshold: normalizeNumber(record.threshold, 0),
    severity: normalizeSeverity(record.severity),
    title: String(record.title || `Watch ${record.metric || ruleId}`).trim() || `Watch ${ruleId}`,
    enabled: normalizeBoolean(record.enabled, true),
    autoCreateIncident: normalizeBoolean(record.autoCreateIncident, false),
    source: String(record.source || 'post-parity-ops').trim() || 'post-parity-ops',
    createdAt: String(record.createdAt || nowIso()),
    updatedAt: String(record.updatedAt || nowIso())
  };
}

function normalizeAlert(record = {}) {
  return {
    alertId: String(record.alertId || record.id || crypto.randomUUID()).trim(),
    ruleId: normalizeRuleId(record.ruleId),
    workspaceId: normalizeWorkspaceId(record.workspaceId),
    tenantId: normalizeTenantId(record.tenantId),
    metric: normalizeMetricKey(record.metric),
    comparator: normalizeComparator(record.comparator),
    threshold: normalizeNumber(record.threshold, 0),
    observedValue: normalizeNumber(record.observedValue, 0),
    severity: normalizeSeverity(record.severity),
    title: String(record.title || record.ruleId || 'Alert').trim() || 'Alert',
    status: normalizeStatus(record.status, ['active', 'acknowledged', 'resolved'], 'active'),
    incidentId: record.incidentId ? String(record.incidentId).trim() : null,
    createdAt: String(record.createdAt || nowIso()),
    updatedAt: String(record.updatedAt || nowIso()),
    resolvedAt: record.resolvedAt ? String(record.resolvedAt) : null,
    resolution: record.resolution ? String(record.resolution).trim() : null,
    source: String(record.source || 'post-parity-ops').trim() || 'post-parity-ops'
  };
}

function normalizeIncident(record = {}) {
  return {
    incidentId: String(record.incidentId || record.id || crypto.randomUUID()).trim(),
    workspaceId: normalizeWorkspaceId(record.workspaceId),
    tenantId: normalizeTenantId(record.tenantId),
    title: String(record.title || 'Incident').trim() || 'Incident',
    severity: normalizeSeverity(record.severity),
    status: normalizeStatus(record.status, ['open', 'acknowledged', 'resolved'], 'open'),
    alertIds: normalizeArray(record.alertIds),
    summary: record.summary ? String(record.summary).trim() : null,
    ownerId: record.ownerId ? String(record.ownerId).trim().toLowerCase() : null,
    ownerDisplayName: record.ownerDisplayName ? String(record.ownerDisplayName).trim() : null,
    createdAt: String(record.createdAt || nowIso()),
    acknowledgedAt: record.acknowledgedAt ? String(record.acknowledgedAt) : null,
    resolvedAt: record.resolvedAt ? String(record.resolvedAt) : null,
    resolution: record.resolution ? String(record.resolution).trim() : null,
    source: String(record.source || 'post-parity-ops').trim() || 'post-parity-ops'
  };
}

function normalizeMetricSnapshot(record = {}) {
  return {
    snapshotId: String(record.snapshotId || crypto.randomUUID()).trim(),
    workspaceId: normalizeWorkspaceId(record.workspaceId),
    tenantId: normalizeTenantId(record.tenantId),
    metrics: record.metrics && typeof record.metrics === 'object' && !Array.isArray(record.metrics) ? record.metrics : {},
    triggeredRuleIds: normalizeArray(record.triggeredRuleIds),
    resolvedRuleIds: normalizeArray(record.resolvedRuleIds),
    createdAt: String(record.createdAt || nowIso()),
    source: String(record.source || 'post-parity-ops').trim() || 'post-parity-ops'
  };
}

export function getOpsStorePath(config) {
  return path.join(config.rootDir, '.skyequanta', 'ops-state.json');
}

function loadStore(config) {
  const parsed = readJson(getOpsStorePath(config), emptyStore());
  const normalized = {
    version: 1,
    watchRules: {},
    alerts: Array.isArray(parsed?.alerts) ? parsed.alerts.map(normalizeAlert) : [],
    incidents: Array.isArray(parsed?.incidents) ? parsed.incidents.map(normalizeIncident) : [],
    metrics: Array.isArray(parsed?.metrics) ? parsed.metrics.map(normalizeMetricSnapshot) : []
  };

  const watchRules = parsed?.watchRules && typeof parsed.watchRules === 'object' ? parsed.watchRules : {};
  for (const [ruleId, record] of Object.entries(watchRules)) {
    normalized.watchRules[normalizeRuleId(ruleId)] = normalizeWatchRule(record, ruleId);
  }

  return normalized;
}

function saveStore(config, store) {
  writeJson(getOpsStorePath(config), store);
  return store;
}

export function ensureOpsStore(config) {
  const store = loadStore(config);
  saveStore(config, store);
  return store;
}

function compareMetric(comparator, observedValue, threshold) {
  switch (normalizeComparator(comparator)) {
    case 'gt': return observedValue > threshold;
    case 'gte': return observedValue >= threshold;
    case 'lt': return observedValue < threshold;
    case 'lte': return observedValue <= threshold;
    case 'eq': return observedValue === threshold;
    case 'neq': return observedValue !== threshold;
    default: return observedValue > threshold;
  }
}

function findActiveAlert(store, workspaceId, ruleId) {
  return store.alerts.find(alert => alert.workspaceId === workspaceId && alert.ruleId === ruleId && ['active', 'acknowledged'].includes(alert.status)) || null;
}

function findActiveIncident(store, workspaceId, alertIds = []) {
  const alertSet = new Set(normalizeArray(alertIds));
  return store.incidents.find(incident => incident.workspaceId === workspaceId && ['open', 'acknowledged'].includes(incident.status) && incident.alertIds.some(alertId => alertSet.has(alertId))) || null;
}

export function listOpsWatchRules(config, workspaceId = null) {
  const store = loadStore(config);
  const targetWorkspaceId = workspaceId ? normalizeWorkspaceId(workspaceId) : null;
  return Object.values(store.watchRules)
    .filter(rule => !targetWorkspaceId || !rule.workspaceId || rule.workspaceId === targetWorkspaceId)
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

export function upsertOpsWatchRule(config, options = {}) {
  const store = loadStore(config);
  const ruleId = normalizeRuleId(options.ruleId || options.metric || options.title, 'ops-rule');
  const existing = store.watchRules[ruleId] || {};
  const nextRule = normalizeWatchRule({
    ...existing,
    ...options,
    ruleId,
    createdAt: existing.createdAt || nowIso(),
    updatedAt: nowIso()
  }, ruleId);
  store.watchRules[ruleId] = nextRule;
  saveStore(config, store);

  appendAuditEvent(config, {
    action: 'ops.watch_rule.upsert',
    actorType: 'operator',
    actorId: String(options.actorId || 'ops-rule-upsert').trim() || 'ops-rule-upsert',
    tenantId: nextRule.tenantId,
    workspaceId: nextRule.workspaceId,
    detail: {
      ruleId: nextRule.ruleId,
      metric: nextRule.metric,
      comparator: nextRule.comparator,
      threshold: nextRule.threshold,
      severity: nextRule.severity,
      autoCreateIncident: nextRule.autoCreateIncident,
      enabled: nextRule.enabled
    }
  });

  publishRuntimeEvent(config, {
    action: 'ops.watch-rule.upsert',
    workspaceId: nextRule.workspaceId,
    tenantId: nextRule.tenantId,
    lane: 'system',
    actorType: 'operator',
    actorId: String(options.actorId || 'ops-rule-upsert').trim() || 'ops-rule-upsert',
    detail: {
      ruleId: nextRule.ruleId,
      metric: nextRule.metric,
      comparator: nextRule.comparator,
      threshold: nextRule.threshold,
      severity: nextRule.severity
    }
  });

  return { rule: nextRule, total: Object.keys(store.watchRules).length };
}

export function listOpsIncidents(config, workspaceId = null) {
  const store = loadStore(config);
  const targetWorkspaceId = workspaceId ? normalizeWorkspaceId(workspaceId) : null;
  return store.incidents
    .filter(incident => !targetWorkspaceId || incident.workspaceId === targetWorkspaceId)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

export function createOpsIncident(config, options = {}) {
  const store = loadStore(config);
  const incident = normalizeIncident({
    ...options,
    incidentId: options.incidentId || options.id || crypto.randomUUID(),
    createdAt: nowIso(),
    status: 'open'
  });
  store.incidents = [incident, ...store.incidents];

  if (incident.alertIds.length > 0) {
    store.alerts = store.alerts.map(alert => incident.alertIds.includes(alert.alertId)
      ? normalizeAlert({ ...alert, incidentId: incident.incidentId })
      : alert);
  }

  saveStore(config, store);

  appendAuditEvent(config, {
    action: 'ops.incident.create',
    actorType: 'operator',
    actorId: String(options.actorId || 'ops-incident-create').trim() || 'ops-incident-create',
    tenantId: incident.tenantId,
    workspaceId: incident.workspaceId,
    detail: {
      incidentId: incident.incidentId,
      severity: incident.severity,
      title: incident.title,
      alertIds: incident.alertIds
    }
  });

  publishRuntimeEvent(config, {
    action: 'ops.incident.create',
    workspaceId: incident.workspaceId,
    tenantId: incident.tenantId,
    lane: 'system',
    actorType: 'operator',
    actorId: String(options.actorId || 'ops-incident-create').trim() || 'ops-incident-create',
    detail: {
      incidentId: incident.incidentId,
      severity: incident.severity,
      title: incident.title,
      alertIds: incident.alertIds
    }
  });

  return { incident };
}

export function acknowledgeOpsIncident(config, options = {}) {
  const store = loadStore(config);
  const incidentId = String(options.incidentId || '').trim();
  const incident = store.incidents.find(item => item.incidentId === incidentId);
  if (!incident) {
    throw new Error(`Incident '${incidentId}' was not found.`);
  }

  incident.status = 'acknowledged';
  incident.ownerId = String(options.ownerId || incident.ownerId || 'operator').trim().toLowerCase() || 'operator';
  incident.ownerDisplayName = String(options.ownerDisplayName || incident.ownerDisplayName || 'Operator').trim() || 'Operator';
  incident.acknowledgedAt = nowIso();

  store.alerts = store.alerts.map(alert => incident.alertIds.includes(alert.alertId)
    ? normalizeAlert({ ...alert, status: 'acknowledged', updatedAt: nowIso() })
    : alert);

  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'ops.incident.acknowledge',
    actorType: 'operator',
    actorId: incident.ownerId,
    tenantId: incident.tenantId,
    workspaceId: incident.workspaceId,
    detail: {
      incidentId: incident.incidentId,
      ownerDisplayName: incident.ownerDisplayName
    }
  });
  publishRuntimeEvent(config, {
    action: 'ops.incident.acknowledge',
    workspaceId: incident.workspaceId,
    tenantId: incident.tenantId,
    lane: 'system',
    actorType: 'operator',
    actorId: incident.ownerId,
    detail: {
      incidentId: incident.incidentId,
      ownerDisplayName: incident.ownerDisplayName
    }
  });
  return { incident: normalizeIncident(incident) };
}

export function resolveOpsIncident(config, options = {}) {
  const store = loadStore(config);
  const incidentId = String(options.incidentId || '').trim();
  const incident = store.incidents.find(item => item.incidentId === incidentId);
  if (!incident) {
    throw new Error(`Incident '${incidentId}' was not found.`);
  }

  incident.status = 'resolved';
  incident.resolution = String(options.resolution || 'resolved').trim() || 'resolved';
  incident.resolvedAt = nowIso();

  store.alerts = store.alerts.map(alert => incident.alertIds.includes(alert.alertId)
    ? normalizeAlert({ ...alert, status: 'resolved', updatedAt: nowIso(), resolvedAt: nowIso(), resolution: incident.resolution })
    : alert);

  saveStore(config, store);
  appendAuditEvent(config, {
    action: 'ops.incident.resolve',
    actorType: 'operator',
    actorId: String(options.actorId || incident.ownerId || 'ops-incident-resolve').trim() || 'ops-incident-resolve',
    tenantId: incident.tenantId,
    workspaceId: incident.workspaceId,
    detail: {
      incidentId: incident.incidentId,
      resolution: incident.resolution
    }
  });
  publishRuntimeEvent(config, {
    action: 'ops.incident.resolve',
    workspaceId: incident.workspaceId,
    tenantId: incident.tenantId,
    lane: 'system',
    actorType: 'operator',
    actorId: String(options.actorId || incident.ownerId || 'ops-incident-resolve').trim() || 'ops-incident-resolve',
    detail: {
      incidentId: incident.incidentId,
      resolution: incident.resolution
    }
  });
  return { incident: normalizeIncident(incident) };
}

export function evaluateOpsWatchRules(config, options = {}) {
  const store = loadStore(config);
  const workspaceId = normalizeWorkspaceId(options.workspaceId);
  const tenantId = normalizeTenantId(options.tenantId);
  const metrics = options.metrics && typeof options.metrics === 'object' && !Array.isArray(options.metrics) ? options.metrics : {};
  const source = String(options.source || 'post-parity-ops').trim() || 'post-parity-ops';
  const actorId = String(options.actorId || 'ops-evaluate').trim() || 'ops-evaluate';
  const stamp = nowIso();

  const triggeredAlerts = [];
  const resolvedAlerts = [];
  const createdIncidents = [];

  for (const rule of Object.values(store.watchRules)) {
    if (!rule.enabled) continue;
    if (rule.workspaceId && rule.workspaceId !== workspaceId) continue;
    if (!(rule.metric in metrics)) continue;

    const observedValue = normalizeNumber(metrics[rule.metric], 0);
    const breached = compareMetric(rule.comparator, observedValue, rule.threshold);
    const existingAlert = findActiveAlert(store, workspaceId, rule.ruleId);

    if (breached) {
      if (existingAlert) {
        existingAlert.observedValue = observedValue;
        existingAlert.updatedAt = stamp;
        existingAlert.severity = rule.severity;
        existingAlert.title = rule.title;
        triggeredAlerts.push(normalizeAlert(existingAlert));
      } else {
        const nextAlert = normalizeAlert({
          ruleId: rule.ruleId,
          workspaceId,
          tenantId,
          metric: rule.metric,
          comparator: rule.comparator,
          threshold: rule.threshold,
          observedValue,
          severity: rule.severity,
          title: rule.title,
          status: 'active',
          createdAt: stamp,
          updatedAt: stamp,
          source
        });
        store.alerts = [nextAlert, ...store.alerts];
        triggeredAlerts.push(nextAlert);
      }

      const activeAlert = findActiveAlert(store, workspaceId, rule.ruleId);
      if (rule.autoCreateIncident && activeAlert && !findActiveIncident(store, workspaceId, [activeAlert.alertId])) {
        const incident = normalizeIncident({
          workspaceId,
          tenantId,
          title: `${rule.title} incident`,
          severity: rule.severity,
          alertIds: [activeAlert.alertId],
          summary: `Watch rule ${rule.ruleId} breached on ${rule.metric} with observed value ${observedValue}.`,
          source,
          createdAt: stamp,
          status: 'open'
        });
        store.incidents = [incident, ...store.incidents];
        activeAlert.incidentId = incident.incidentId;
        createdIncidents.push(incident);
      }
    } else if (existingAlert) {
      existingAlert.status = 'resolved';
      existingAlert.updatedAt = stamp;
      existingAlert.resolvedAt = stamp;
      existingAlert.resolution = 'metric_recovered';
      resolvedAlerts.push(normalizeAlert(existingAlert));
      const incident = store.incidents.find(item => item.incidentId === existingAlert.incidentId && item.status !== 'resolved');
      if (incident) {
        incident.status = 'resolved';
        incident.resolution = 'metric_recovered';
        incident.resolvedAt = stamp;
      }
    }
  }

  const snapshot = normalizeMetricSnapshot({
    workspaceId,
    tenantId,
    metrics,
    triggeredRuleIds: triggeredAlerts.map(item => item.ruleId),
    resolvedRuleIds: resolvedAlerts.map(item => item.ruleId),
    createdAt: stamp,
    source
  });
  store.metrics = [snapshot, ...store.metrics].slice(0, 50);
  saveStore(config, store);

  appendAuditEvent(config, {
    action: 'ops.evaluate',
    actorType: 'operator',
    actorId,
    tenantId,
    workspaceId,
    detail: {
      metrics,
      triggeredRuleIds: snapshot.triggeredRuleIds,
      resolvedRuleIds: snapshot.resolvedRuleIds,
      createdIncidentIds: createdIncidents.map(item => item.incidentId)
    }
  });
  publishRuntimeEvent(config, {
    action: 'ops.evaluate',
    workspaceId,
    tenantId,
    lane: 'system',
    actorType: 'operator',
    actorId,
    detail: {
      metrics,
      triggeredRuleIds: snapshot.triggeredRuleIds,
      resolvedRuleIds: snapshot.resolvedRuleIds,
      createdIncidentIds: createdIncidents.map(item => item.incidentId)
    }
  });

  return {
    snapshot,
    triggeredAlerts,
    resolvedAlerts,
    incidents: createdIncidents,
    summary: getOpsStatus(config, workspaceId).summary
  };
}

export function getOpsStatus(config, workspaceId = null) {
  const store = loadStore(config);
  const targetWorkspaceId = workspaceId ? normalizeWorkspaceId(workspaceId) : null;
  const rules = Object.values(store.watchRules)
    .filter(rule => !targetWorkspaceId || !rule.workspaceId || rule.workspaceId === targetWorkspaceId)
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));
  const alerts = store.alerts
    .filter(alert => !targetWorkspaceId || alert.workspaceId === targetWorkspaceId)
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  const incidents = store.incidents
    .filter(incident => !targetWorkspaceId || incident.workspaceId === targetWorkspaceId)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const metrics = store.metrics
    .filter(snapshot => !targetWorkspaceId || snapshot.workspaceId === targetWorkspaceId)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  const summary = {
    workspaceId: targetWorkspaceId || null,
    watchRuleCount: rules.length,
    activeAlerts: alerts.filter(item => item.status === 'active').length,
    acknowledgedAlerts: alerts.filter(item => item.status === 'acknowledged').length,
    resolvedAlerts: alerts.filter(item => item.status === 'resolved').length,
    openIncidents: incidents.filter(item => item.status === 'open').length,
    acknowledgedIncidents: incidents.filter(item => item.status === 'acknowledged').length,
    resolvedIncidents: incidents.filter(item => item.status === 'resolved').length,
    latestSnapshotAt: metrics[0]?.createdAt || null,
    health: incidents.some(item => item.status !== 'resolved') || alerts.some(item => item.status !== 'resolved') ? 'degraded' : 'healthy'
  };

  return {
    summary,
    watchRules: rules,
    alerts,
    incidents,
    metrics
  };
}
