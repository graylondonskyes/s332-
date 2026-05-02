import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { getRuntimePaths } from './runtime.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function nowIso() {
  return new Date().toISOString();
}

const ORDER = ['suggest-only', 'draft-and-wait', 'execute-with-review-gates', 'full-autonomous', 'continuous-maintenance-mode'];

export const MODE_PRESETS = {
  'suggest-only': {
    modeId: 'suggest-only',
    label: 'Suggest Only',
    level: 1,
    planAllowed: true,
    patchDraftAllowed: false,
    executeAllowed: false,
    stateMutationAllowed: false,
    backgroundAllowed: false,
    requiresApproval: false,
    reviewGates: [],
    explanation: 'Produces advice only and never mutates workspace state.'
  },
  'draft-and-wait': {
    modeId: 'draft-and-wait',
    label: 'Draft and Wait',
    level: 2,
    planAllowed: true,
    patchDraftAllowed: true,
    executeAllowed: false,
    stateMutationAllowed: false,
    backgroundAllowed: false,
    requiresApproval: false,
    reviewGates: ['draft-ready'],
    explanation: 'Produces a patch plan and diff but stops before execution.'
  },
  'execute-with-review-gates': {
    modeId: 'execute-with-review-gates',
    label: 'Execute with Review Gates',
    level: 3,
    planAllowed: true,
    patchDraftAllowed: true,
    executeAllowed: true,
    stateMutationAllowed: true,
    backgroundAllowed: false,
    requiresApproval: true,
    reviewGates: ['pre-execution-human-approval'],
    explanation: 'May execute, but only after an explicit review gate is satisfied.'
  },
  'full-autonomous': {
    modeId: 'full-autonomous',
    label: 'Full Autonomous',
    level: 4,
    planAllowed: true,
    patchDraftAllowed: true,
    executeAllowed: true,
    stateMutationAllowed: true,
    backgroundAllowed: false,
    requiresApproval: false,
    reviewGates: [],
    explanation: 'Completes the approved task without pausing for human review.'
  },
  'continuous-maintenance-mode': {
    modeId: 'continuous-maintenance-mode',
    label: 'Continuous Maintenance Mode',
    level: 5,
    planAllowed: true,
    patchDraftAllowed: true,
    executeAllowed: true,
    stateMutationAllowed: true,
    backgroundAllowed: true,
    requiresApproval: false,
    reviewGates: [],
    explanation: 'Enables unattended maintenance scheduling in addition to direct execution.'
  }
};

function computePresetFingerprint(preset = {}) {
  return stableHash({
    modeId: preset.modeId,
    label: preset.label,
    level: preset.level,
    planAllowed: preset.planAllowed,
    patchDraftAllowed: preset.patchDraftAllowed,
    executeAllowed: preset.executeAllowed,
    stateMutationAllowed: preset.stateMutationAllowed,
    backgroundAllowed: preset.backgroundAllowed,
    requiresApproval: preset.requiresApproval,
    reviewGates: preset.reviewGates || []
  });
}

export function buildModeProfile(modeId, overrides = {}) {
  const preset = MODE_PRESETS[modeId];
  if (!preset) {
    throw new Error(`Unknown autonomy mode '${modeId}'.`);
  }
  const profile = {
    ...preset,
    ...overrides,
    fingerprint: null
  };
  profile.fingerprint = computePresetFingerprint(profile);
  return profile;
}

export function verifyAutonomyProfile(profile = {}) {
  const expectedFingerprint = computePresetFingerprint(profile);
  return {
    ok: Boolean(profile?.fingerprint) && profile.fingerprint === expectedFingerprint,
    expectedFingerprint,
    actualFingerprint: profile?.fingerprint || null
  };
}

function getAutonomyPaths(config) {
  const runtimePaths = getRuntimePaths(config);
  const baseDir = path.join(runtimePaths.runtimeDir, 'autonomy-gradient');
  return {
    baseDir,
    bindingsFile: path.join(baseDir, 'bindings.json'),
    profilesFile: path.join(baseDir, 'profiles.json'),
    runsFile: path.join(baseDir, 'runs.json'),
    stateDir: path.join(baseDir, 'state')
  };
}

export function ensureAutonomyStore(config) {
  const paths = getAutonomyPaths(config);
  ensureDirectory(paths.baseDir);
  ensureDirectory(paths.stateDir);
  if (!fs.existsSync(paths.profilesFile)) {
    const profiles = Object.fromEntries(Object.keys(MODE_PRESETS).map(modeId => [modeId, buildModeProfile(modeId)]));
    writeJson(paths.profilesFile, { version: 1, generatedAt: nowIso(), profiles });
  }
  if (!fs.existsSync(paths.bindingsFile)) {
    writeJson(paths.bindingsFile, { version: 1, bindings: [] });
  }
  if (!fs.existsSync(paths.runsFile)) {
    writeJson(paths.runsFile, { version: 1, runs: [] });
  }
  return paths;
}

export function resetAutonomyStore(config) {
  const paths = getAutonomyPaths(config);
  fs.rmSync(paths.baseDir, { recursive: true, force: true });
  return ensureAutonomyStore(config);
}

export function loadAutonomyProfiles(config) {
  const paths = ensureAutonomyStore(config);
  const payload = readJson(paths.profilesFile, { version: 1, profiles: {} });
  return { paths, payload };
}

export function bindAutonomyProfile(config, binding = {}) {
  const paths = ensureAutonomyStore(config);
  const payload = readJson(paths.bindingsFile, { version: 1, bindings: [] });
  const entry = {
    bindingId: binding.bindingId || `autonomy-binding-${crypto.randomUUID()}`,
    modeId: binding.modeId,
    scopeType: binding.scopeType,
    scopeId: binding.scopeId,
    policyTier: binding.policyTier || null,
    complianceMode: binding.complianceMode || null,
    createdAt: nowIso()
  };
  payload.bindings = Array.isArray(payload.bindings) ? payload.bindings : [];
  payload.bindings.unshift(entry);
  writeJson(paths.bindingsFile, payload);
  return entry;
}

function bindingScore(binding, context = {}) {
  let score = 0;
  if (binding.scopeType === 'task' && binding.scopeId === context.taskId) score += 90;
  if (binding.scopeType === 'workspace' && binding.scopeId === context.workspaceId) score += 80;
  if (binding.scopeType === 'repo' && normalizePath(binding.scopeId) === normalizePath(context.repoPath)) score += 70;
  if (binding.scopeType === 'user' && binding.scopeId === context.userId) score += 60;
  if (binding.scopeType === 'policy-tier' && binding.scopeId === context.policyTier) score += 50;
  if (binding.policyTier && binding.policyTier === context.policyTier) score += 20;
  if (binding.complianceMode && binding.complianceMode === context.complianceMode) score += 20;
  return score;
}

export function resolveAutonomyBinding(config, context = {}) {
  const paths = ensureAutonomyStore(config);
  const payload = readJson(paths.bindingsFile, { version: 1, bindings: [] });
  const bindings = Array.isArray(payload.bindings) ? payload.bindings : [];
  const ranked = bindings
    .map(binding => ({ binding, score: bindingScore(binding, context) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || String(b.binding.createdAt || '').localeCompare(String(a.binding.createdAt || '')));
  return {
    matched: ranked.length > 0,
    binding: ranked[0]?.binding || null,
    score: ranked[0]?.score || 0,
    candidates: ranked.slice(0, 5)
  };
}

function restrictedCap(context = {}) {
  if (context.policyTier === 'restricted') return 'execute-with-review-gates';
  if (['finance', 'healthcare', 'government', 'air-gapped'].includes(String(context.complianceMode || ''))) return 'execute-with-review-gates';
  return null;
}

function compareModeLevel(a, b) {
  return (MODE_PRESETS[a]?.level || 0) - (MODE_PRESETS[b]?.level || 0);
}

export function evaluateAutonomyMode(config, requestedModeId, task = {}, context = {}) {
  const profiles = loadAutonomyProfiles(config).payload.profiles || {};
  const binding = resolveAutonomyBinding(config, {
    ...context,
    taskId: task.taskId || context.taskId
  });
  const requestedProfile = profiles[requestedModeId] || buildModeProfile(requestedModeId);
  const boundModeId = binding.matched ? binding.binding.modeId : requestedModeId;
  const boundProfile = profiles[boundModeId] || buildModeProfile(boundModeId);
  const capModeId = restrictedCap({
    ...context,
    complianceMode: context.complianceMode || task.complianceMode,
    policyTier: context.policyTier || task.policyTier
  });
  const denialReasons = [];
  let effectiveModeId = boundProfile.modeId;
  if (binding.matched && requestedModeId !== binding.binding.modeId) {
    denialReasons.push(`Requested mode '${requestedModeId}' was overridden by binding '${binding.binding.bindingId}' to '${binding.binding.modeId}'.`);
  }
  if (capModeId && compareModeLevel(effectiveModeId, capModeId) > 0) {
    denialReasons.push(`Requested mode '${effectiveModeId}' exceeds the allowed cap '${capModeId}' for the current policy/compliance context.`);
    effectiveModeId = capModeId;
  }
  const effectiveProfile = profiles[effectiveModeId] || buildModeProfile(effectiveModeId);
  const forcedDenial = Boolean(task.forbidAutonomyEscalation) && compareModeLevel(requestedProfile.modeId, effectiveModeId) > 0;
  const ok = !forcedDenial;
  return {
    ok,
    requestedModeId,
    baseModeId: boundProfile.modeId,
    effectiveModeId: effectiveProfile.modeId,
    profile: effectiveProfile,
    binding,
    reviewGates: [...(effectiveProfile.reviewGates || [])],
    explanation: [
      binding.matched ? `Autonomy binding '${binding.binding.bindingId}' applied at scope ${binding.binding.scopeType}:${binding.binding.scopeId}.` : 'No explicit autonomy binding matched, so the requested mode was evaluated directly.',
      effectiveProfile.explanation,
      ...denialReasons,
      forcedDenial ? 'This context forbids automatic autonomy escalation, so the request is denied instead of silently continuing.' : null
    ].filter(Boolean).join(' '),
    denialReasons,
    forbiddenEscalation: forcedDenial,
    requiresApproval: Boolean(effectiveProfile.requiresApproval),
    backgroundAllowed: Boolean(effectiveProfile.backgroundAllowed),
    stateMutationAllowed: Boolean(effectiveProfile.stateMutationAllowed),
    executeAllowed: Boolean(effectiveProfile.executeAllowed),
    patchDraftAllowed: Boolean(effectiveProfile.patchDraftAllowed),
    planAllowed: Boolean(effectiveProfile.planAllowed)
  };
}

function writeMutationState(paths, runId, payload) {
  const filePath = path.join(paths.stateDir, `${runId}.json`);
  writeJson(filePath, payload);
  return filePath;
}

export function simulateAutonomyRun(config, requestedModeId, task = {}, options = {}) {
  const paths = ensureAutonomyStore(config);
  const decision = evaluateAutonomyMode(config, requestedModeId, task, options.context || {});
  const runId = options.runId || `${decision.effectiveModeId}-${crypto.randomUUID()}`;
  const patch = {
    patchId: `${runId}-patch`,
    files: (task.filesInScope || []).slice(0, 6),
    summary: task.summary || task.objective || 'autonomy task',
    plannedMutationCount: Math.max(1, Math.min(4, Number((task.filesInScope || []).length || 1)))
  };
  const execution = {
    runId,
    generatedAt: nowIso(),
    requestedModeId,
    decision,
    task: {
      taskId: task.taskId || runId,
      summary: task.summary || task.objective || 'autonomy task',
      workspaceId: options.context?.workspaceId || null,
      repoPath: normalizePath(options.context?.repoPath || '') || null
    },
    outputs: {
      suggestions: [
        `Plan for ${task.summary || task.objective || 'task'} using mode ${decision.effectiveModeId}.`,
        'Keep replay, proof, and hostile-path checks bound to the selected autonomy lane.'
      ],
      patch: decision.patchDraftAllowed ? patch : null,
      commandReceipt: null
    },
    stateMutated: false,
    pausedForApproval: false,
    schedulerQueued: false,
    completed: false,
    stopReason: null,
    stateFile: null
  };

  if (!decision.ok && decision.forbiddenEscalation) {
    execution.stopReason = 'forbidden_autonomy_escalation';
  } else if (decision.effectiveModeId === 'suggest-only') {
    execution.stopReason = 'suggestion_only';
    execution.completed = true;
  } else if (decision.effectiveModeId === 'draft-and-wait') {
    execution.stopReason = 'draft_ready_waiting';
    execution.completed = true;
  } else if (decision.effectiveModeId === 'execute-with-review-gates' && !options.approvalGranted) {
    execution.pausedForApproval = true;
    execution.stopReason = 'awaiting_human_approval';
  } else {
    execution.outputs.commandReceipt = {
      command: task.executionCommand || 'simulate-apply-patch',
      exitCode: 0,
      executedAt: nowIso()
    };
    execution.stateMutated = decision.stateMutationAllowed;
    execution.completed = true;
    execution.stopReason = decision.effectiveModeId === 'continuous-maintenance-mode' ? 'maintenance_active' : 'completed';
    if (decision.backgroundAllowed) {
      execution.schedulerQueued = true;
    }
    if (execution.stateMutated) {
      execution.stateFile = normalizePath(path.relative(config.rootDir, writeMutationState(paths, runId, {
        version: 1,
        runId,
        mutatedAt: nowIso(),
        modeId: decision.effectiveModeId,
        files: patch.files,
        summary: patch.summary
      })));
    }
  }

  const runsPayload = readJson(paths.runsFile, { version: 1, runs: [] });
  runsPayload.runs = Array.isArray(runsPayload.runs) ? runsPayload.runs : [];
  runsPayload.runs.unshift({
    runId,
    generatedAt: execution.generatedAt,
    requestedModeId,
    effectiveModeId: decision.effectiveModeId,
    completed: execution.completed,
    pausedForApproval: execution.pausedForApproval,
    schedulerQueued: execution.schedulerQueued,
    stateMutated: execution.stateMutated,
    stopReason: execution.stopReason,
    stateFile: execution.stateFile
  });
  writeJson(paths.runsFile, runsPayload);
  return execution;
}

export function renderAutonomySurface(runs = [], options = {}) {
  const title = options.title || 'Autonomy Gradient';
  const cards = ORDER.map(modeId => {
    const mode = MODE_PRESETS[modeId];
    return `<div class="mode-card"><h3>${mode.label}</h3><p>${mode.explanation}</p><ul><li>Execute: ${mode.executeAllowed ? 'YES' : 'NO'}</li><li>Mutate: ${mode.stateMutationAllowed ? 'YES' : 'NO'}</li><li>Background: ${mode.backgroundAllowed ? 'YES' : 'NO'}</li><li>Review gates: ${(mode.reviewGates || []).join(', ') || 'none'}</li></ul></div>`;
  }).join('');
  const rows = runs.map(run => `<tr><td>${run.requestedModeId}</td><td>${run.decision?.effectiveModeId || run.effectiveModeId}</td><td>${run.stateMutated ? 'YES' : 'NO'}</td><td>${run.pausedForApproval ? 'YES' : 'NO'}</td><td>${run.schedulerQueued ? 'YES' : 'NO'}</td><td>${run.stopReason}</td></tr>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
body{margin:0;background:#080d1a;color:#f4f7ff;font-family:Inter,Arial,sans-serif}main{max-width:1120px;margin:0 auto;padding:24px}.card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:18px 20px;margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.mode-card{border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:14px;background:rgba(255,255,255,.02)}table{width:100%;border-collapse:collapse}th,td{padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left}th{font-size:12px;color:#85d8ff;text-transform:uppercase;letter-spacing:.08em}
</style>
</head>
<body>
<main>
<section class="card"><h1>${title}</h1><p>Autonomy controls bind execution posture by task, workspace, repo, user, and policy tier.</p></section>
<section class="card"><div class="grid">${cards}</div></section>
<section class="card"><h2>Execution runs</h2><table><thead><tr><th>Requested</th><th>Effective</th><th>State mutated</th><th>Paused</th><th>Scheduler</th><th>Stop reason</th></tr></thead><tbody>${rows}</tbody></table></section>
</main>
</body>
</html>`;
}

export function writeAutonomySurface(filePath, runs, options = {}) {
  ensureDirectory(path.dirname(filePath));
  const html = renderAutonomySurface(runs, options);
  fs.writeFileSync(filePath, html, 'utf8');
  return { filePath, html };
}
