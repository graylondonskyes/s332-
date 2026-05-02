import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { getRuntimePaths } from './runtime.mjs';

export const COUNCIL_ROLES = [
  'architect',
  'cost-optimizer',
  'migration-engineer',
  'implementer',
  'test-breaker',
  'security-reviewer',
  'documentation-agent',
  'deploy-recovery-agent'
];

const ROLE_LABELS = {
  architect: 'Architect',
  'cost-optimizer': 'Cost Optimizer',
  'migration-engineer': 'Migration Engineer',
  implementer: 'Implementer',
  'test-breaker': 'Test Breaker',
  'security-reviewer': 'Security Reviewer',
  'documentation-agent': 'Documentation Agent',
  'deploy-recovery-agent': 'Deploy/Recovery Agent'
};

const ARBITRATION_ACTIONS = ['approve', 'deny', 'veto', 'objection', 'abstain'];

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback) {
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
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function eventTime(index) {
  const base = Date.parse('2026-04-07T20:00:00.000Z');
  return new Date(base + (index * 1000)).toISOString();
}

function getCouncilPaths(config) {
  const runtimePaths = getRuntimePaths(config);
  const baseDir = path.join(runtimePaths.runtimeDir, 'kaixu-council');
  return {
    baseDir,
    indexFile: path.join(baseDir, 'index.json'),
    runsDir: path.join(baseDir, 'runs'),
    panelFile: path.join(baseDir, 'council-panel.html')
  };
}

export function ensureCouncilStore(config) {
  const paths = getCouncilPaths(config);
  ensureDirectory(paths.baseDir);
  ensureDirectory(paths.runsDir);
  if (!fs.existsSync(paths.indexFile)) {
    writeJson(paths.indexFile, {
      version: 1,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runs: []
    });
  }
  return paths;
}

export function resetCouncilStore(config) {
  const paths = getCouncilPaths(config);
  fs.rmSync(paths.baseDir, { recursive: true, force: true });
  return ensureCouncilStore(config);
}

export function loadCouncilIndex(config) {
  const paths = ensureCouncilStore(config);
  const index = readJson(paths.indexFile, {
    version: 1,
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    runs: []
  });
  index.runs = Array.isArray(index.runs) ? index.runs : [];
  return { paths, index };
}

function saveCouncilIndex(config, index) {
  const { paths } = loadCouncilIndex(config);
  index.updatedAt = new Date().toISOString();
  writeJson(paths.indexFile, index);
  return paths;
}

function defaultRoleBudgets(overrides = {}) {
  return {
    architect: 3.0,
    'cost-optimizer': 1.5,
    'migration-engineer': 1.8,
    implementer: 6.0,
    'test-breaker': 3.2,
    'security-reviewer': 2.6,
    'documentation-agent': 1.2,
    'deploy-recovery-agent': 2.4,
    ...overrides
  };
}

function defaultRoleConfidence() {
  return {
    architect: 0.95,
    'cost-optimizer': 0.88,
    'migration-engineer': 0.84,
    implementer: 0.89,
    'test-breaker': 0.86,
    'security-reviewer': 0.91,
    'documentation-agent': 0.82,
    'deploy-recovery-agent': 0.87
  };
}

export function createCouncilExecutionGraph(task = {}, options = {}) {
  const roleBudgets = defaultRoleBudgets(options.roleBudgets);
  const roleConfidence = { ...defaultRoleConfidence(), ...(options.roleConfidence || {}) };
  const nodes = COUNCIL_ROLES.map((roleId, index) => ({
    id: roleId,
    label: ROLE_LABELS[roleId],
    order: index + 1,
    budgetCap: Number(roleBudgets[roleId] || 0),
    confidence: Number(roleConfidence[roleId] || 0),
    required: !['migration-engineer', 'documentation-agent'].includes(roleId),
    produces: roleId === 'architect'
      ? ['plan', 'evidence']
      : roleId === 'implementer'
        ? ['diff', 'evidence']
        : roleId === 'test-breaker'
          ? ['objection', 'verdict', 'evidence']
          : roleId === 'security-reviewer'
            ? ['verdict', 'evidence']
            : roleId === 'cost-optimizer'
              ? ['cost', 'verdict', 'evidence']
              : ['verdict', 'evidence']
  }));
  const edges = [
    ['architect', 'cost-optimizer'],
    ['architect', 'migration-engineer'],
    ['architect', 'implementer'],
    ['cost-optimizer', 'implementer'],
    ['migration-engineer', 'implementer'],
    ['implementer', 'test-breaker'],
    ['implementer', 'security-reviewer'],
    ['test-breaker', 'security-reviewer'],
    ['security-reviewer', 'documentation-agent'],
    ['documentation-agent', 'deploy-recovery-agent'],
    ['security-reviewer', 'deploy-recovery-agent']
  ].map(([from, to]) => ({
    from,
    to,
    orderingRule: `${ROLE_LABELS[from]} must complete before ${ROLE_LABELS[to]} may finalize.`
  }));
  return {
    generatedAt: new Date().toISOString(),
    task: {
      taskId: task.taskId || 'council-task',
      summary: task.summary || 'Council task'
    },
    nodes,
    edges,
    arbitrationRules: {
      actions: [...ARBITRATION_ACTIONS],
      majorityRoles: ['architect', 'test-breaker', 'security-reviewer', 'cost-optimizer'],
      tieBreakRole: 'architect',
      escalationRole: 'deploy-recovery-agent',
      humanOverrideSupported: true,
      securityVetoOverridesMajority: true,
      budgetExhaustionFailsLoudly: true
    },
    graphFingerprint: stableHash({ nodes, edges, roleBudgets, roleConfidence })
  };
}

function createRunSkeleton(graph, task, options = {}) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    councilRunId: String(options.runId || `council-${Date.now()}`),
    task: {
      taskId: String(task.taskId || 'task-unknown'),
      summary: String(task.summary || ''),
      objective: String(task.objective || task.summary || ''),
      filesInScope: Array.isArray(task.filesInScope) ? task.filesInScope : []
    },
    graph,
    scenarios: {
      architectImplementerDisagreement: Boolean(options.architectImplementerDisagreement),
      securityVeto: Boolean(options.securityVeto),
      budgetExhaustionRole: options.budgetExhaustionRole || null,
      failingRole: options.failingRole || null,
      humanOverride: Boolean(options.humanOverride),
      tieVote: Boolean(options.tieVote)
    },
    roles: [],
    objections: [],
    escalations: [],
    verdicts: [],
    recovery: [],
    arbitration: null
  };
}

function roleNode(graph, roleId) {
  return graph.nodes.find(node => node.id === roleId);
}

function consumeBudget(graph, roleId, plannedSpend, run) {
  const node = roleNode(graph, roleId);
  const spend = Number(plannedSpend || 0);
  const budgetCap = Number(node?.budgetCap || 0);
  const exhausted = budgetCap > 0 && spend > budgetCap;
  return {
    budgetCap,
    spend,
    exhausted,
    remaining: Number((budgetCap - spend).toFixed(4))
  };
}

function pushRole(run, role) {
  run.roles.push(role);
  if (role.artifact?.objection) run.objections.push(role.artifact.objection);
  if (role.verdict) run.verdicts.push({ roleId: role.roleId, decision: role.verdict.decision, reason: role.verdict.reason });
  if (role.recovery) run.recovery.push(role.recovery);
  return role;
}

function makeRoleRecord(graph, roleId, stepIndex, artifactType, verdictDecision, detail = {}) {
  const node = roleNode(graph, roleId);
  return {
    roleId,
    roleLabel: node?.label || roleId,
    stepIndex,
    occurredAt: eventTime(stepIndex),
    budget: consumeBudget(graph, roleId, detail.spend, null),
    confidence: Number(node?.confidence || 0),
    artifact: {
      artifactType,
      ...detail.artifact
    },
    verdict: {
      decision: verdictDecision,
      reason: detail.reason || '',
      evidence: detail.evidence || []
    },
    failure: detail.failure || null,
    recovery: detail.recovery || null
  };
}

function architectRole(run) {
  const disagreement = run.scenarios.architectImplementerDisagreement;
  const artifact = {
    planId: `${run.councilRunId}-plan`,
    strategy: disagreement ? 'patch the logging drift without broad refactor' : 'patch the logging drift with aligned verification update',
    steps: disagreement
      ? ['stabilize order-sensitive serializer', 'avoid cross-module refactor', 're-run proof lane']
      : ['stabilize order-sensitive serializer', 'align validator digest input', 're-run proof lane'],
    files: run.task.filesInScope,
    evidencePack: ['plan.json', 'scope.json']
  };
  return makeRoleRecord(run.graph, 'architect', 1, 'plan', 'approve', {
    spend: 1.2,
    artifact,
    reason: 'Architecture plan issued for council execution.',
    evidence: ['plan-defined', disagreement ? 'minimal-patch-preferred' : 'aligned-patch-preferred']
  });
}

function costOptimizerRole(run) {
  const spend = 0.7;
  const tieVote = run.scenarios.tieVote;
  const artifact = {
    budgetId: `${run.councilRunId}-budget`,
    estimatedSpend: 5.6,
    perRoleBudget: Object.fromEntries(run.graph.nodes.map(node => [node.id, node.budgetCap])),
    recommendation: tieVote ? 'Hold until budget variance is reviewed by Architect.' : 'Proceed if patch remains limited to proof lane and validation lane.'
  };
  return makeRoleRecord(run.graph, 'cost-optimizer', 2, 'cost', tieVote ? 'deny' : 'approve', {
    spend,
    artifact,
    reason: tieVote ? 'Cost Optimizer denied pending budget variance review.' : 'Council budget posture stays within planned lane.',
    evidence: tieVote ? ['budget-variance', 'deny-issued'] : ['budget-estimated', 'cost-lane-approved']
  });
}

function migrationEngineerRole(run) {
  return makeRoleRecord(run.graph, 'migration-engineer', 3, 'verdict', 'approve', {
    spend: 0.8,
    artifact: {
      migrationNotes: 'No schema or runtime migration required for this patch.',
      compatibility: 'safe-minor-runtime-change'
    },
    reason: 'Migration posture remains safe.',
    evidence: ['no-schema-drift', 'runtime-compatible']
  });
}

function implementerRole(run, architect) {
  const disagreement = run.scenarios.architectImplementerDisagreement;
  const exhausted = run.scenarios.budgetExhaustionRole === 'implementer';
  const spend = exhausted ? 8.4 : 3.6;
  const artifact = {
    diffId: `${run.councilRunId}-diff`,
    patchSummary: disagreement
      ? 'Implemented serializer refactor plus validator touch that expands scope beyond architect plan.'
      : 'Implemented serializer and validator alignment exactly within architect scope.',
    filesChanged: run.task.filesInScope,
    linesChanged: disagreement ? 196 : 84,
    evidencePack: ['diff.patch', 'unit-notes.md']
  };
  const budget = consumeBudget(run.graph, 'implementer', spend, run);
  if (budget.exhausted) {
    return makeRoleRecord(run.graph, 'implementer', 4, 'diff', 'deny', {
      spend,
      artifact,
      reason: `Implementer budget exhausted: spend ${budget.spend.toFixed(2)} exceeds cap ${budget.budgetCap.toFixed(2)}.`,
      evidence: ['budget-exhausted', 'implementation-paused']
    });
  }
  return makeRoleRecord(run.graph, 'implementer', 4, 'diff', 'approve', {
    spend,
    artifact,
    reason: disagreement ? 'Implementer produced patch that diverges from architect plan.' : 'Implementer produced aligned patch.',
    evidence: disagreement ? ['patch-produced', 'scope-diverged'] : ['patch-produced', 'scope-aligned']
  });
}

function testBreakerRole(run, implementer, architect) {
  const disagreement = run.scenarios.architectImplementerDisagreement;
  const tieVote = run.scenarios.tieVote;
  const objection = disagreement
    ? {
        title: 'Patch scope diverged from plan',
        severity: 'medium',
        detail: 'Implementer touched a broader validator surface than Architect approved.'
      }
    : null;
  const decision = disagreement ? 'objection' : tieVote ? 'deny' : 'approve';
  return makeRoleRecord(run.graph, 'test-breaker', 5, objection ? 'objection' : 'verdict', decision, {
    spend: 1.4,
    artifact: {
      objection,
      regressionResult: disagreement ? 'scope-drift-detected' : tieVote ? 'flaky-regression-detected' : 'fixture-green',
      comparedPlanId: architect.artifact.planId,
      comparedDiffId: implementer.artifact.diffId
    },
    reason: disagreement
      ? 'Test Breaker challenged patch scope drift.'
      : tieVote
        ? 'Test Breaker denied due to flaky regression risk.'
        : 'Test Breaker accepted fixture patch.',
    evidence: disagreement ? ['scope-drift', 'objection-issued'] : tieVote ? ['flaky-regression', 'deny-issued'] : ['fixtures-green']
  });
}

function securityReviewerRole(run, implementer) {
  const securityVeto = run.scenarios.securityVeto;
  const tieVote = run.scenarios.tieVote;
  const decision = securityVeto ? 'veto' : tieVote ? 'approve' : 'approve';
  return makeRoleRecord(run.graph, 'security-reviewer', 6, 'verdict', decision, {
    spend: 1.1,
    artifact: {
      verdictCard: securityVeto ? 'security-veto' : 'security-approve',
      reviewedDiffId: implementer.artifact.diffId,
      findings: securityVeto ? ['unreviewed secret-surface mutation detected'] : ['no privileged-surface drift']
    },
    reason: securityVeto ? 'Security reviewer vetoed patch due to privileged-surface mutation.' : 'Security reviewer approved the patch posture.',
    evidence: securityVeto ? ['security-veto', 'privileged-surface-risk'] : ['security-approve']
  });
}

function documentationAgentRole(run) {
  if (run.scenarios.failingRole === 'documentation-agent') {
    return makeRoleRecord(run.graph, 'documentation-agent', 7, 'evidence', 'deny', {
      spend: 0.9,
      artifact: {
        note: 'Documentation lane failed before summary generation.'
      },
      reason: 'Documentation agent crashed while packaging notes.',
      evidence: ['agent-failure'],
      failure: {
        code: 'doc-agent-crash',
        message: 'Renderer exited before writing summary.'
      }
    });
  }
  return makeRoleRecord(run.graph, 'documentation-agent', 7, 'evidence', 'approve', {
    spend: 0.6,
    artifact: {
      summary: 'Council summary prepared for operator review and proof packaging.'
    },
    reason: 'Documentation summary completed.',
    evidence: ['documentation-ready']
  });
}

function deployRecoveryAgentRole(run, failedRole) {
  if (failedRole) {
    return makeRoleRecord(run.graph, 'deploy-recovery-agent', 8, 'evidence', 'approve', {
      spend: 1.6,
      artifact: {
        recoveryPlan: `Recovered council lane after ${failedRole.roleLabel} failure by generating fallback summary and preserving arbitration continuity.`,
        preservedArtifacts: run.roles.filter(role => role.roleId !== failedRole.roleId).map(role => role.artifact.artifactType)
      },
      reason: 'Deploy/Recovery Agent recovered the failed council lane.',
      evidence: ['recovery-plan-generated', 'council-continued'],
      recovery: {
        recoveredRole: failedRole.roleId,
        strategy: 'fallback-evidence-packaging'
      }
    });
  }
  return makeRoleRecord(run.graph, 'deploy-recovery-agent', 8, 'verdict', 'approve', {
    spend: 0.9,
    artifact: {
      deployReadiness: 'ready-for-proof-lane',
      releaseBlockers: []
    },
    reason: 'Deploy/Recovery Agent marked the council result as proof-lane ready.',
    evidence: ['deploy-ready']
  });
}

function countVotes(run) {
  const majorityRoles = new Set(run.graph.arbitrationRules.majorityRoles);
  const tally = { approve: 0, deny: 0, veto: 0, objection: 0, abstain: 0 };
  for (const role of run.roles) {
    if (!majorityRoles.has(role.roleId)) continue;
    const decision = role.verdict?.decision;
    if (!decision || !Object.prototype.hasOwnProperty.call(tally, decision)) continue;
    tally[decision] += 1;
  }
  return tally;
}

export function arbitrateCouncil(run, options = {}) {
  const votes = countVotes(run);
  const security = run.roles.find(role => role.roleId === 'security-reviewer');
  const architect = run.roles.find(role => role.roleId === 'architect');
  const failedRole = run.roles.find(role => role.failure);
  const exhaustedRole = run.roles.find(role => role.budget?.exhausted);
  const tie = votes.approve === votes.deny && votes.approve > 0;
  const tieBreakDecision = tie ? architect?.verdict?.decision || 'deny' : null;
  const securityVeto = security?.verdict?.decision === 'veto';
  const humanOverride = Boolean(options.humanOverride || run.scenarios.humanOverride);

  let finalDecision = 'approved';
  let reason = 'Council majority approved the engineering result.';

  if (exhaustedRole) {
    finalDecision = humanOverride ? 'approved_override' : 'denied';
    reason = humanOverride
      ? `Human override approved council after ${exhaustedRole.roleLabel} budget exhaustion.`
      : `${exhaustedRole.roleLabel} exhausted budget and council failed loudly.`;
    run.escalations.push({ type: 'budget-exhaustion', roleId: exhaustedRole.roleId, at: eventTime(9) });
  } else if (securityVeto) {
    finalDecision = humanOverride ? 'approved_override' : 'vetoed';
    reason = humanOverride
      ? 'Human override accepted risk and overrode the security veto.'
      : 'Security reviewer vetoed the council result.';
    run.escalations.push({ type: 'security-veto', roleId: 'security-reviewer', at: eventTime(9) });
  } else if (failedRole) {
    const recovered = run.roles.find(role => role.roleId === 'deploy-recovery-agent' && role.recovery);
    finalDecision = recovered ? 'approved_recovered' : 'denied';
    reason = recovered
      ? `Council recovered after ${failedRole.roleLabel} failure.`
      : `${failedRole.roleLabel} failed and no recovery path completed.`;
    run.escalations.push({ type: 'agent-failure', roleId: failedRole.roleId, at: eventTime(9) });
  } else if (tie) {
    finalDecision = tieBreakDecision === 'approve' ? 'approved_tiebreak' : 'denied_tiebreak';
    reason = `Tie resolved by ${ROLE_LABELS[run.graph.arbitrationRules.tieBreakRole]} as ${tieBreakDecision}.`;
    run.escalations.push({ type: 'tie-break', roleId: run.graph.arbitrationRules.tieBreakRole, at: eventTime(9) });
  } else if (votes.deny > votes.approve) {
    finalDecision = 'denied';
    reason = 'Council majority denied the engineering result.';
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    finalDecision,
    reason,
    voteTally: votes,
    humanOverrideApplied: humanOverride && ['approved_override'].includes(finalDecision),
    tieBreakUsed: Boolean(tie),
    escalations: run.escalations,
    recovered: finalDecision === 'approved_recovered',
    objections: run.objections,
    summaryFingerprint: stableHash({ votes, finalDecision, reason, escalations: run.escalations })
  };
  run.arbitration = summary;
  return summary;
}

export function persistCouncilRun(config, run) {
  const { paths, index } = loadCouncilIndex(config);
  const runFile = path.join(paths.runsDir, `${run.councilRunId}.json`);
  writeJson(runFile, run);
  const summary = {
    councilRunId: run.councilRunId,
    generatedAt: run.generatedAt,
    taskId: run.task.taskId,
    finalDecision: run.arbitration?.finalDecision || null,
    summaryFingerprint: run.arbitration?.summaryFingerprint || stableHash(run)
  };
  const nextRuns = index.runs.filter(item => item.councilRunId !== run.councilRunId);
  nextRuns.push(summary);
  index.runs = nextRuns.sort((a, b) => String(a.councilRunId).localeCompare(String(b.councilRunId)));
  saveCouncilIndex(config, index);
  return { runFile, indexFile: paths.indexFile, summary };
}

export function loadCouncilRun(config, runId) {
  const { paths } = loadCouncilIndex(config);
  return readJson(path.join(paths.runsDir, `${runId}.json`), null);
}

export function orchestrateCouncilRun(config, task = {}, options = {}) {
  const graph = createCouncilExecutionGraph(task, options);
  const run = createRunSkeleton(graph, task, options);

  const architect = pushRole(run, architectRole(run));
  const costOptimizer = pushRole(run, costOptimizerRole(run));
  const migrationEngineer = pushRole(run, migrationEngineerRole(run));
  const implementer = pushRole(run, implementerRole(run, architect));
  const testBreaker = pushRole(run, testBreakerRole(run, implementer, architect));
  const securityReviewer = pushRole(run, securityReviewerRole(run, implementer));
  const documentationAgent = pushRole(run, documentationAgentRole(run));
  const failedRole = documentationAgent.failure ? documentationAgent : null;
  const deployRecoveryAgent = pushRole(run, deployRecoveryAgentRole(run, failedRole));

  arbitrateCouncil(run, options);
  const persisted = persistCouncilRun(config, run);

  return {
    run,
    persisted,
    actors: {
      architect,
      costOptimizer,
      migrationEngineer,
      implementer,
      testBreaker,
      securityReviewer,
      documentationAgent,
      deployRecoveryAgent
    }
  };
}

export function renderCouncilPanel(run, options = {}) {
  const title = options.title || 'kAIxU Council';
  const roleCards = run.roles.map(role => `
    <article class="card role-card">
      <h3>${role.roleLabel}</h3>
      <p><strong>Decision:</strong> ${role.verdict?.decision || 'n/a'}</p>
      <p><strong>Confidence:</strong> ${(Number(role.confidence || 0) * 100).toFixed(0)}%</p>
      <p><strong>Budget:</strong> ${role.budget.spend.toFixed(2)} / ${role.budget.budgetCap.toFixed(2)}</p>
      <p><strong>Reason:</strong> ${role.verdict?.reason || ''}</p>
      <pre>${JSON.stringify(role.artifact, null, 2)}</pre>
    </article>`).join('');

  const objections = run.objections.length
    ? run.objections.map(item => `<li><strong>${item.title}</strong> — ${item.detail}</li>`).join('')
    : '<li>No objections.</li>';

  const timeline = run.roles.map(role => `<li><strong>${role.roleLabel}</strong> — ${role.verdict?.decision || 'n/a'} — ${role.occurredAt}</li>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body{margin:0;background:#09111f;color:#f4f7ff;font-family:Inter,Arial,sans-serif}
  main{max-width:1280px;margin:0 auto;padding:24px}
  .card{background:#121d33;border:1px solid #334a72;border-radius:18px;padding:16px;margin-bottom:16px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
  pre{white-space:pre-wrap;word-break:break-word;background:#0a1324;padding:12px;border-radius:12px;max-height:240px;overflow:auto}
  ul{padding-left:20px}
</style>
</head>
<body>
<main>
  <section class="card">
    <h1>${title}</h1>
    <p><strong>Role Timeline</strong></p>
    <ul>${timeline}</ul>
  </section>
  <section class="card">
    <h2>Final Arbitration Summary</h2>
    <p><strong>Decision:</strong> ${run.arbitration?.finalDecision || 'n/a'}</p>
    <p><strong>Reason:</strong> ${run.arbitration?.reason || ''}</p>
    <p><strong>Vote tally:</strong> ${JSON.stringify(run.arbitration?.voteTally || {})}</p>
  </section>
  <section class="card">
    <h2>Objections</h2>
    <ul>${objections}</ul>
  </section>
  <section class="grid">${roleCards}</section>
</main>
</body>
</html>\n`;
}

export function writeCouncilPanel(filePath, run, options = {}) {
  ensureDirectory(path.dirname(filePath));
  const html = renderCouncilPanel(run, options);
  fs.writeFileSync(filePath, html, 'utf8');
  return { filePath, html };
}

export function verifyCouncilPersistence(config, councilRunId) {
  const run = loadCouncilRun(config, councilRunId);
  const { index } = loadCouncilIndex(config);
  const indexed = index.runs.find(item => item.councilRunId === councilRunId);
  return {
    ok: Boolean(run && indexed),
    run,
    indexed
  };
}
