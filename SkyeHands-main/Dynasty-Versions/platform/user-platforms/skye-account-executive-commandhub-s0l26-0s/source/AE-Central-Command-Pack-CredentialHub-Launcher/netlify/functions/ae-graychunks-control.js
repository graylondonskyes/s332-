const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { appendAuditEvent, writeUsageEvent } = require('./_shared/ae_state');

const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', '..');
const findingsPath = path.join(repoRoot, 'skydexia', 'alerts', 'graychunks-findings.json');
const queuePath = path.join(repoRoot, 'skydexia', 'alerts', 'graychunks-priority-queue.json');
const dispatchPath = path.join(repoRoot, 'skydexia', 'alerts', 'graychunks-alert-dispatch.json');
const progressPath = path.join(repoRoot, 'skydexia', 'alerts', 'graychunks-progress.json');

function json(statusCode, payload) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) };
}

function readString(value) {
  return String(value ?? '').trim();
}

function parseBody(event = {}) {
  try { return JSON.parse(event.body || '{}'); } catch { return {}; }
}

function readJsonOrNull(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function resolveSafeTargetArg(targetValue) {
  const value = readString(targetValue);
  if (!value) return [];
  const resolved = path.resolve(repoRoot, value);
  const relative = path.relative(repoRoot, resolved);
  if (relative && (relative.startsWith('..') || path.isAbsolute(relative))) {
    throw new Error(`Target directory must remain within repository root: ${value}`);
  }
  return [`--target=${resolved}`];
}

function runScript(script, args = [], extraEnv = {}) {
  const scriptPath = path.join(repoRoot, 'scripts', script);
  const run = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv }
  });

  return {
    script,
    exitCode: run.status,
    ok: run.status === 0,
    stdout: readString(run.stdout).slice(0, 2000),
    stderr: readString(run.stderr).slice(0, 2000)
  };
}

function isAuthorized(event = {}) {
  const required = readString(process.env.GRAYCHUNKS_CONTROL_TOKEN);
  if (!required) return true;
  const supplied = readString(event.headers?.['x-graychunks-token'] || event.headers?.['X-Graychunks-Token']);
  return supplied && supplied === required;
}

module.exports.handler = async (event = {}) => {
  const method = readString(event.httpMethod || 'GET').toUpperCase();

  if (method === 'GET') {
    const findings = readJsonOrNull(findingsPath);
    const queue = readJsonOrNull(queuePath);
    const dispatch = readJsonOrNull(dispatchPath);
    const progress = readJsonOrNull(progressPath);

    await writeUsageEvent({ route: 'ae-graychunks-control', action: 'read_graychunks_state', detail: { hasFindings: Boolean(findings), hasQueue: Boolean(queue), hasDispatch: Boolean(dispatch), hasProgress: Boolean(progress) } });
    return json(200, { ok: true, findings, queue, dispatch, progress });
  }

  if (method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  if (!isAuthorized(event)) return json(401, { ok: false, error: 'unauthorized' });

  const payload = parseBody(event);
  const action = readString(payload.action).toLowerCase() || 'scan';
  let targetArgs = [];
  try {
    targetArgs = resolveSafeTargetArg(payload.target);
  } catch (error) {
    return json(400, { ok: false, error: 'invalid_target', detail: String(error?.message || error) });
  }

  let steps = [];
  if (action === 'scan') {
    steps = [runScript('graychunks-scan.mjs', targetArgs)];
  } else if (action === 'queue') {
    steps = [runScript('graychunks-priority-queue.mjs')];
  } else if (action === 'alert') {
    steps = [runScript('graychunks-alert-resend.mjs', [], { GRAYCHUNKS_ALERT_DRY_RUN: payload.dryRun ? '1' : (process.env.GRAYCHUNKS_ALERT_DRY_RUN || '0') })];
  } else if (action === 'progress') {
    steps = [runScript('graychunks-progress-dashboard.mjs')];
  } else if (action === 'cycle') {
    steps = [runScript('graychunks-runtime-cycle.mjs', targetArgs, { GRAYCHUNKS_ALERT_DRY_RUN: payload.dryRun ? '1' : (process.env.GRAYCHUNKS_ALERT_DRY_RUN || '0') })];
  } else {
    return json(400, { ok: false, error: 'unsupported_action', action });
  }

  const success = steps.every((step) => step.ok || (step.script === 'graychunks-scan.mjs' && step.exitCode === 2));
  await writeUsageEvent({ route: 'ae-graychunks-control', action: `execute_${action}`, detail: { success, steps: steps.length } });
  await appendAuditEvent({ action: 'ae_graychunks_execution', actorId: 'ae-system', actorType: 'system', resource: action, outcome: success ? 'ok' : 'failed', detail: { steps } });

  return json(success ? 200 : 500, { ok: success, action, steps, findings: readJsonOrNull(findingsPath), queue: readJsonOrNull(queuePath), dispatch: readJsonOrNull(dispatchPath), progress: readJsonOrNull(progressPath) });
};
