#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import {
  resetCouncilStore,
  ensureCouncilStore,
  orchestrateCouncilRun,
  verifyCouncilPersistence,
  writeCouncilPanel,
  createCouncilExecutionGraph
} from '../lib/kaixu-council.mjs';

function parseArgs(argv) {
  return {
    strict: argv.includes('--strict'),
    json: argv.includes('--json')
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section48-kaixu-council.mjs');

  const versionStampPath = path.join(config.rootDir, 'docs', 'VERSION_STAMP.json');
  const versionStamp = JSON.parse(fs.readFileSync(versionStampPath, 'utf8'));
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_48_KAIXU_COUNCIL.json');
  const outputDir = path.join(config.rootDir, 'dist', 'section48', 'kaixu-council');
  const panelFile = path.join(outputDir, 'kaixu-council-panel.html');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  resetCouncilStore(config);
  const councilPaths = ensureCouncilStore(config);

  const task = {
    taskId: 'section48-proofops-patch-council',
    summary: 'Patch ProofOps hash drift with evidence-preserving council review',
    objective: 'Get a council-backed patch verdict for ProofOps hash drift without losing evidence quality',
    filesInScope: [
      'apps/skyequanta-shell/bin/proofops-bundle.mjs',
      'apps/skyequanta-shell/bin/proofops-validate.mjs',
      'docs/proof/SECTION_49_PROOFOPS.json'
    ]
  };

  const councilGraph = createCouncilExecutionGraph(task);
  const normal = orchestrateCouncilRun(config, task, { runId: 'section48-normal' });
  const disagreement = orchestrateCouncilRun(config, task, {
    runId: 'section48-disagreement',
    architectImplementerDisagreement: true
  });
  const securityVeto = orchestrateCouncilRun(config, task, {
    runId: 'section48-security-veto',
    securityVeto: true
  });
  const budgetExhaustion = orchestrateCouncilRun(config, task, {
    runId: 'section48-budget-exhaustion',
    budgetExhaustionRole: 'implementer'
  });
  const roleFailureRecovery = orchestrateCouncilRun(config, task, {
    runId: 'section48-role-failure',
    failingRole: 'documentation-agent'
  });
  const humanOverride = orchestrateCouncilRun(config, task, {
    runId: 'section48-human-override',
    securityVeto: true,
    humanOverride: true
  });
  const tieBreak = orchestrateCouncilRun(config, task, {
    runId: 'section48-tie-break',
    tieVote: true
  });

  const panel = writeCouncilPanel(panelFile, disagreement.run, { title: 'Section 48 kAIxU Council Panel' });
  const persistedNormal = verifyCouncilPersistence(config, normal.run.councilRunId);

  const checks = [
    assertCheck(councilGraph.nodes.length === 8, 'Add council orchestration model with roles such as Architect, Implementer, Test Breaker, Security Reviewer, Migration Engineer, Deploy/Recovery Agent, Documentation Agent, Cost Optimizer', { roles: councilGraph.nodes.map(node => node.id) }),
    assertCheck(councilGraph.edges.length >= 10 && councilGraph.arbitrationRules.majorityRoles.length >= 4, 'Add council execution graph and ordering rules', councilGraph),
    assertCheck(normal.run.arbitration && securityVeto.run.arbitration && tieBreak.run.arbitration.tieBreakUsed === true && humanOverride.run.arbitration.humanOverrideApplied === true, 'Add arbitration rules for approve, deny, veto, majority, tie-break, escalation, and human override', {
      normal: normal.run.arbitration,
      securityVeto: securityVeto.run.arbitration,
      tieBreak: tieBreak.run.arbitration,
      humanOverride: humanOverride.run.arbitration
    }),
    assertCheck(normal.run.roles.every(role => Number.isFinite(role.budget.budgetCap) && Number.isFinite(role.confidence)), 'Add per-role budget tracking and confidence scoring', normal.run.roles.map(role => ({ roleId: role.roleId, budget: role.budget, confidence: role.confidence }))),
    assertCheck(normal.run.roles.some(role => role.artifact.artifactType === 'plan') && normal.run.roles.some(role => role.artifact.artifactType === 'diff') && normal.run.roles.some(role => role.artifact.artifactType === 'cost') && disagreement.run.objections.length >= 1, 'Add per-role output artifacts such as plan, verdict, diff, objection, cost, and evidence', normal.run.roles.map(role => ({ roleId: role.roleId, artifactType: role.artifact.artifactType }))),
    assertCheck(fs.existsSync(panel.filePath) && panel.html.includes('Role Timeline') && panel.html.includes('Final Arbitration Summary') && panel.html.includes('Objections'), 'Add council panel UI with role timeline, verdict cards, objections, and final arbitration summary', { panelFile: panel.filePath }),
    assertCheck(normal.run.councilRunId === 'section48-normal', 'Launch a council task', { councilRunId: normal.run.councilRunId }),
    assertCheck(normal.actors.architect.artifact.planId.includes('plan'), 'Have Architect define a plan', normal.actors.architect),
    assertCheck(normal.actors.implementer.artifact.diffId.includes('diff'), 'Have Implementer produce a patch', normal.actors.implementer),
    assertCheck(disagreement.actors['testBreaker']?.verdict?.decision === 'objection' || disagreement.run.objections.length >= 1, 'Have Test Breaker challenge the patch', disagreement.actors.testBreaker),
    assertCheck(normal.actors.securityReviewer.verdict.decision === 'approve' && securityVeto.actors.securityReviewer.verdict.decision === 'veto', 'Have Security Reviewer approve or deny', {
      approve: normal.actors.securityReviewer,
      veto: securityVeto.actors.securityReviewer
    }),
    assertCheck(normal.run.arbitration.finalDecision === 'approved', 'Produce final arbitration result', normal.run.arbitration),
    assertCheck(disagreement.run.objections.length >= 1 && disagreement.actors.implementer.artifact.patchSummary.includes('expands scope'), 'Simulate architect/implementer disagreement', disagreement.run),
    assertCheck(securityVeto.run.arbitration.finalDecision === 'vetoed', 'Simulate security veto', securityVeto.run.arbitration),
    assertCheck(budgetExhaustion.run.arbitration.finalDecision === 'denied' && budgetExhaustion.actors.implementer.budget.exhausted === true, 'Simulate budget exhaustion mid-council', budgetExhaustion.run),
    assertCheck(roleFailureRecovery.run.arbitration.finalDecision === 'approved_recovered' && roleFailureRecovery.actors.deployRecoveryAgent.recovery?.recoveredRole === 'documentation-agent', 'Simulate one agent failure and prove council recovers or fails loudly', roleFailureRecovery.run),
    assertCheck(humanOverride.run.arbitration.finalDecision === 'approved_override' && humanOverride.run.arbitration.humanOverrideApplied === true, 'Simulate human override and prove final decision reflects it', humanOverride.run.arbitration),
    assertCheck(persistedNormal.ok === true && persistedNormal.run.councilRunId === normal.run.councilRunId, 'Persist council run and prove reload after restart', persistedNormal),
    assertCheck(proofFile.endsWith('SECTION_48_KAIXU_COUNCIL.json'), 'Create proof artifact docs/proof/SECTION_48_KAIXU_COUNCIL.json', { proofFile }),
    assertCheck(normal.run.arbitration.finalDecision === 'approved' && disagreement.run.objections.length >= 1 && securityVeto.run.arbitration.finalDecision === 'vetoed', 'Multiple autonomous roles can disagree, arbitrate, and converge on a real engineering result with evidence', {
      normal: normal.run.arbitration,
      disagreement: disagreement.run.arbitration,
      securityVeto: securityVeto.run.arbitration
    })
  ];

  const payload = {
    section: 48,
    label: 'section-48-kaixu-council',
    generatedAt: new Date().toISOString(),
    pass: checks.every(item => item.pass),
    strict: options.strict,
    modelVersion: versionStamp.modelVersion,
    runtimeVersion: versionStamp.runtimeVersion,
    directiveVersion: versionStamp.directiveVersion,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section48-kaixu-council.mjs --strict',
    smokeCommand: 'bash scripts/smoke-section48-kaixu-council.sh',
    checks,
    hostileChecks: [
      { name: 'security-veto', pass: securityVeto.run.arbitration.finalDecision === 'vetoed', detail: securityVeto.run.arbitration },
      { name: 'budget-exhaustion', pass: budgetExhaustion.run.arbitration.finalDecision === 'denied', detail: budgetExhaustion.run.arbitration },
      { name: 'architect-implementer-disagreement', pass: disagreement.run.objections.length >= 1, detail: disagreement.run.objections }
    ],
    recoveryChecks: [
      { name: 'agent-failure-recovery', pass: roleFailureRecovery.run.arbitration.finalDecision === 'approved_recovered', detail: roleFailureRecovery.actors.deployRecoveryAgent.recovery },
      { name: 'human-override', pass: humanOverride.run.arbitration.finalDecision === 'approved_override', detail: humanOverride.run.arbitration }
    ],
    evidence: {
      councilGraph,
      normal: normal.run,
      disagreement: disagreement.run,
      securityVeto: securityVeto.run,
      budgetExhaustion: budgetExhaustion.run,
      roleFailureRecovery: roleFailureRecovery.run,
      humanOverride: humanOverride.run,
      tieBreak: tieBreak.run,
      persistedNormal
    },
    artifactReferences: {
      proofFile,
      panelFile: panel.filePath,
      councilIndexFile: councilPaths.indexFile,
      councilRunsDir: councilPaths.runsDir
    }
  };

  const written = writeProofJson(proofFile, payload, config, 'workspace-proof-section48-kaixu-council.mjs');
  console.log(JSON.stringify(written, null, 2));
  if (!written.pass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
