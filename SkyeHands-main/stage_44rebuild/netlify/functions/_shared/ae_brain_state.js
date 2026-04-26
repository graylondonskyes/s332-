/**
 * AE Brain State — per-brain independent runtime records
 * Directive section 5.1
 *
 * Each AE brain has:
 *   - own state record (status, lastActive, currentTaskId)
 *   - per-brain memory store (key/value, scoped to tenantId + brainId)
 *   - per-brain task queue
 *   - per-brain usage ledger
 *   - per-brain audit trail
 *
 * Storage: local file-backed (smoke) or Neon-backed (production).
 * Production adapter is injected via BrainStateAdapter.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const STATE_DIR = path.resolve(__dirname, '../../../.skyequanta/brain-state');

// ─── Storage adapter interface ─────────────────────────────────────────────

let _adapter = null;

function useAdapter(adapter) {
  _adapter = adapter;
}

// ─── Local file-backed adapter ─────────────────────────────────────────────

function _localPath(tenantId, brainId, type) {
  const dir = path.join(STATE_DIR, tenantId, brainId);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${type}.json`);
}

function _localRead(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function _localWrite(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ─── Brain state CRUD ─────────────────────────────────────────────────────

async function getBrainState(tenantId, brainId) {
  if (_adapter) return _adapter.getBrainState(tenantId, brainId);
  const p = _localPath(tenantId, brainId, 'state');
  return _localRead(p) ?? {
    brainId, tenantId,
    status: 'active',
    currentTaskId: null,
    lastActiveAt: null,
    createdAt: new Date().toISOString(),
  };
}

async function setBrainState(tenantId, brainId, patch) {
  if (_adapter) return _adapter.setBrainState(tenantId, brainId, patch);
  const p = _localPath(tenantId, brainId, 'state');
  const current = _localRead(p) ?? { brainId, tenantId, createdAt: new Date().toISOString() };
  const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
  _localWrite(p, updated);
  return updated;
}

// ─── Memory store ─────────────────────────────────────────────────────────

async function getMemory(tenantId, brainId, key) {
  if (_adapter) return _adapter.getMemory(tenantId, brainId, key);
  const p = _localPath(tenantId, brainId, 'memory');
  const store = _localRead(p) ?? {};
  return store[key] ?? null;
}

async function setMemory(tenantId, brainId, key, value) {
  if (_adapter) return _adapter.setMemory(tenantId, brainId, key, value);
  const p = _localPath(tenantId, brainId, 'memory');
  const store = _localRead(p) ?? {};
  store[key] = value;
  _localWrite(p, store);
}

async function getAllMemory(tenantId, brainId) {
  if (_adapter) return _adapter.getAllMemory(tenantId, brainId);
  const p = _localPath(tenantId, brainId, 'memory');
  return _localRead(p) ?? {};
}

// ─── Task queue ───────────────────────────────────────────────────────────

async function enqueueTask(tenantId, brainId, task) {
  const taskRecord = {
    taskId: task.taskId ?? crypto.randomUUID(),
    tenantId,
    brainId,
    type: task.type,
    payload: task.payload,
    status: 'queued',
    enqueuedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    result: null,
  };

  if (_adapter) return _adapter.enqueueTask(tenantId, brainId, taskRecord);

  const p = _localPath(tenantId, brainId, 'queue');
  const queue = _localRead(p) ?? [];
  queue.push(taskRecord);
  _localWrite(p, queue);
  return taskRecord;
}

async function dequeueTask(tenantId, brainId) {
  if (_adapter) return _adapter.dequeueTask(tenantId, brainId);
  const p = _localPath(tenantId, brainId, 'queue');
  const queue = _localRead(p) ?? [];
  const task = queue.find(t => t.status === 'queued');
  if (!task) return null;
  task.status = 'in-progress';
  task.startedAt = new Date().toISOString();
  _localWrite(p, queue);
  return task;
}

async function completeTask(tenantId, brainId, taskId, result) {
  if (_adapter) return _adapter.completeTask(tenantId, brainId, taskId, result);
  const p = _localPath(tenantId, brainId, 'queue');
  const queue = _localRead(p) ?? [];
  const task = queue.find(t => t.taskId === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  task.status = 'completed';
  task.completedAt = new Date().toISOString();
  task.result = result;
  _localWrite(p, queue);
  return task;
}

async function getTaskQueue(tenantId, brainId) {
  if (_adapter) return _adapter.getTaskQueue(tenantId, brainId);
  const p = _localPath(tenantId, brainId, 'queue');
  return _localRead(p) ?? [];
}

// ─── Usage ledger ─────────────────────────────────────────────────────────

async function recordUsage(tenantId, brainId, { provider, model, inputTokens, outputTokens, costUsd }) {
  const entry = {
    usageId: crypto.randomUUID(),
    tenantId, brainId, provider, model,
    inputTokens: inputTokens ?? 0,
    outputTokens: outputTokens ?? 0,
    costUsd: costUsd ?? 0,
    at: new Date().toISOString(),
  };

  if (_adapter) return _adapter.recordUsage(tenantId, brainId, entry);

  const p = _localPath(tenantId, brainId, 'usage');
  const ledger = _localRead(p) ?? [];
  ledger.push(entry);
  _localWrite(p, ledger);
  return entry;
}

async function getUsageSummary(tenantId, brainId) {
  if (_adapter) return _adapter.getUsageSummary(tenantId, brainId);
  const p = _localPath(tenantId, brainId, 'usage');
  const ledger = _localRead(p) ?? [];
  return {
    brainId, tenantId,
    totalCalls: ledger.length,
    totalInputTokens: ledger.reduce((s, e) => s + (e.inputTokens ?? 0), 0),
    totalOutputTokens: ledger.reduce((s, e) => s + (e.outputTokens ?? 0), 0),
    totalCostUsd: ledger.reduce((s, e) => s + (e.costUsd ?? 0), 0),
  };
}

// ─── Audit trail ─────────────────────────────────────────────────────────

async function auditLog(tenantId, brainId, action, detail) {
  const entry = {
    auditId: crypto.randomUUID(),
    tenantId, brainId, action, detail,
    at: new Date().toISOString(),
  };

  if (_adapter) return _adapter.auditLog(tenantId, brainId, entry);

  const p = _localPath(tenantId, brainId, 'audit');
  const trail = _localRead(p) ?? [];
  trail.push(entry);
  _localWrite(p, trail);
  return entry;
}

async function getAuditTrail(tenantId, brainId, limit = 50) {
  if (_adapter) return _adapter.getAuditTrail(tenantId, brainId, limit);
  const p = _localPath(tenantId, brainId, 'audit');
  const trail = _localRead(p) ?? [];
  return trail.slice(-limit);
}

module.exports = {
  useAdapter,
  getBrainState, setBrainState,
  getMemory, setMemory, getAllMemory,
  enqueueTask, dequeueTask, completeTask, getTaskQueue,
  recordUsage, getUsageSummary,
  auditLog, getAuditTrail,
};
