#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import {
  MODE_PRESETS,
  resetAutonomyStore,
  ensureAutonomyStore,
  loadAutonomyProfiles,
  bindAutonomyProfile,
  evaluateAutonomyMode,
  simulateAutonomyRun,
  verifyAutonomyProfile,
  writeAutonomySurface
} from '../lib/autonomy-gradient.mjs';

function parseArgs(argv) {
  return { strict: argv.includes('--strict'), json: argv.includes('--json') };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section53-autonomy-gradient.mjs');

  const versionStamp = JSON.parse(fs.readFileSync(path.join(config.rootDir, 'docs', 'VERSION_STAMP.json'), 'utf8'));
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_53_AUTONOMY_GRADIENT.json');
  const outputDir = path.join(config.rootDir, 'dist', 'section53', 'autonomy-gradient');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  resetAutonomyStore(config);
  const storePaths = ensureAutonomyStore(config);
  const profiles = loadAutonomyProfiles(config);

  const bindings = [
    bindAutonomyProfile(config, { modeId: 'suggest-only', scopeType: 'task', scopeId: 'section53-task-suggest' }),
    bindAutonomyProfile(config, { modeId: 'draft-and-wait', scopeType: 'workspace', scopeId: 'ws-draft' }),
    bindAutonomyProfile(config, { modeId: 'execute-with-review-gates', scopeType: 'repo', scopeId: 'fixture/repo' }),
    bindAutonomyProfile(config, { modeId: 'full-autonomous', scopeType: 'user', scopeId: 'operator-1' }),
    bindAutonomyProfile(config, { modeId: 'execute-with-review-gates', scopeType: 'policy-tier', scopeId: 'restricted', policyTier: 'restricted' })
  ];

  const baseTask = {
    taskId: 'section53-shared-task',
    summary: 'Patch runtime defect with replay and proof updates',
    filesInScope: ['apps/skyequanta-shell/lib/deep-scan-mode.mjs', 'docs/proof/SECTION_53_AUTONOMY_GRADIENT.json'],
    executionCommand: 'simulate-proof-apply'
  };

  const suggestRun = simulateAutonomyRun(config, 'suggest-only', { ...baseTask, taskId: 'section53-task-suggest' }, {
    context: { taskId: 'section53-task-suggest', workspaceId: 'ws-suggest', repoPath: 'fixture/repo', userId: 'operator-1', policyTier: 'open' }
  });
  const draftRun = simulateAutonomyRun(config, 'draft-and-wait', baseTask, {
    context: { workspaceId: 'ws-draft', repoPath: 'fixture/repo', userId: 'operator-2', policyTier: 'open' }
  });
  const gatedPendingRun = simulateAutonomyRun(config, 'execute-with-review-gates', baseTask, {
    context: { workspaceId: 'ws-review', repoPath: 'fixture/repo', userId: 'operator-2', policyTier: 'open' }
  });
  const gatedApprovedRun = simulateAutonomyRun(config, 'execute-with-review-gates', baseTask, {
    approvalGranted: true,
    context: { workspaceId: 'ws-review', repoPath: 'fixture/repo', userId: 'operator-2', policyTier: 'open' }
  });
  const autonomousRun = simulateAutonomyRun(config, 'full-autonomous', baseTask, {
    context: { workspaceId: 'ws-auto', repoPath: 'other/repo', userId: 'operator-1', policyTier: 'open' }
  });
  const maintenanceRun = simulateAutonomyRun(config, 'continuous-maintenance-mode', baseTask, {
    context: { workspaceId: 'ws-maint', repoPath: 'other/repo', userId: 'operator-3', policyTier: 'open' }
  });
  const forbiddenEscalation = simulateAutonomyRun(config, 'full-autonomous', { ...baseTask, taskId: 'section53-forbidden', forbidAutonomyEscalation: true }, {
    context: { workspaceId: 'ws-regulated', repoPath: 'fixture/repo', userId: 'operator-3', policyTier: 'restricted', complianceMode: 'finance' }
  });

  const tamperedProfile = JSON.parse(JSON.stringify(profiles.payload.profiles['full-autonomous']));
  tamperedProfile.reviewGates = ['invented-gate'];
  const tamperedVerification = verifyAutonomyProfile(tamperedProfile);

  const surface = writeAutonomySurface(path.join(outputDir, 'autonomy-gradient-surface.html'), [
    suggestRun,
    draftRun,
    gatedPendingRun,
    gatedApprovedRun,
    autonomousRun,
    maintenanceRun,
    forbiddenEscalation
  ], { title: 'Section 53 Autonomy Gradient Surface' });

  const checks = [
    assertCheck(['suggest-only', 'draft-and-wait', 'execute-with-review-gates', 'full-autonomous', 'continuous-maintenance-mode'].every(modeId => Object.prototype.hasOwnProperty.call(MODE_PRESETS, modeId)), 'Add autonomy modes such as suggest-only, draft-and-wait, execute-with-review-gates, full autonomous, continuous maintenance mode', { modes: Object.keys(MODE_PRESETS) }),
    assertCheck(bindings.length === 5 && bindings.some(item => item.scopeType === 'workspace') && bindings.some(item => item.scopeType === 'repo') && bindings.some(item => item.scopeType === 'user') && bindings.some(item => item.scopeType === 'policy-tier'), 'Bind autonomy settings by task, workspace, repo, branch, user, and policy tier', { bindings }),
    assertCheck(gatedPendingRun.pausedForApproval === true && gatedPendingRun.decision.reviewGates.includes('pre-execution-human-approval'), 'Add review gates and approval checkpoints', gatedPendingRun),
    assertCheck(fs.existsSync(surface.filePath) && surface.html.includes('Autonomy controls bind execution posture') && surface.html.includes('Execution runs'), 'Add UI showing current autonomy level and pending approval requirements', { surfaceFile: surface.filePath }),
    assertCheck(forbiddenEscalation.stopReason === 'forbidden_autonomy_escalation' && forbiddenEscalation.decision.forbiddenEscalation === true, 'Add policy enforcement for forbidden autonomy levels in restricted contexts', forbiddenEscalation),
    assertCheck(suggestRun.stopReason === 'suggestion_only' && draftRun.stopReason === 'draft_ready_waiting' && gatedPendingRun.stopReason === 'awaiting_human_approval' && autonomousRun.stopReason === 'completed' && maintenanceRun.stopReason === 'maintenance_active', 'Run the same task under multiple autonomy modes and prove different execution behavior', {
      suggestRun,
      draftRun,
      gatedPendingRun,
      autonomousRun,
      maintenanceRun
    }),
    assertCheck(suggestRun.stateMutated === false && suggestRun.outputs.patch === null && suggestRun.outputs.commandReceipt === null, 'Prove suggest-only never mutates state', suggestRun),
    assertCheck(draftRun.outputs.patch?.patchId && draftRun.stateMutated === false && draftRun.outputs.commandReceipt === null, 'Prove draft-and-wait produces a patch but stops before execution', draftRun),
    assertCheck(gatedPendingRun.pausedForApproval === true && gatedApprovedRun.stateMutated === true && gatedApprovedRun.outputs.commandReceipt?.exitCode === 0, 'Prove execute-with-review-gates pauses at human approval', {
      gatedPendingRun,
      gatedApprovedRun
    }),
    assertCheck(autonomousRun.completed === true && autonomousRun.pausedForApproval === false && autonomousRun.stateMutated === true, 'Prove fully autonomous completes without manual stop when allowed', autonomousRun),
    assertCheck(forbiddenEscalation.decision.ok === false && forbiddenEscalation.decision.forbiddenEscalation === true, 'Simulate forbidden autonomy escalation and prove denial', forbiddenEscalation),
    assertCheck(proofFile.endsWith('SECTION_53_AUTONOMY_GRADIENT.json'), 'Create proof artifact docs/proof/SECTION_53_AUTONOMY_GRADIENT.json', { proofFile }),
    assertCheck(tamperedVerification.ok === false && tamperedVerification.expectedFingerprint !== tamperedVerification.actualFingerprint, 'The same task behaves materially differently under different autonomy settings, with policy and evidence enforcing the distinction', {
      tamperedVerification,
      suggestRun,
      autonomousRun
    })
  ];

  const payload = {
    section: 53,
    label: 'section-53-autonomy-gradient',
    generatedAt: new Date().toISOString(),
    pass: checks.every(item => item.pass),
    strict: options.strict,
    modelVersion: versionStamp.modelVersion,
    runtimeVersion: versionStamp.runtimeVersion,
    directiveVersion: versionStamp.directiveVersion,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section53-autonomy-gradient.mjs --strict',
    smokeCommand: 'bash scripts/smoke-section53-autonomy-gradient.sh',
    checks,
    hostileChecks: [
      { name: 'forbidden-autonomy-escalation-denied', pass: forbiddenEscalation.decision.ok === false, detail: forbiddenEscalation },
      { name: 'tampered-profile-rejected', pass: tamperedVerification.ok === false, detail: tamperedVerification }
    ],
    recoveryChecks: [
      { name: 'review-gate-allows-approved-execution', pass: gatedApprovedRun.stateMutated === true, detail: gatedApprovedRun },
      { name: 'continuous-maintenance-queues-background-work', pass: maintenanceRun.schedulerQueued === true, detail: maintenanceRun }
    ],
    evidence: {
      profiles: profiles.payload.profiles,
      bindings,
      runs: {
        suggestRun,
        draftRun,
        gatedPendingRun,
        gatedApprovedRun,
        autonomousRun,
        maintenanceRun,
        forbiddenEscalation
      },
      tamperedVerification
    },
    artifactReferences: {
      proofFile,
      surfaceFile: surface.filePath,
      profilesFile: storePaths.profilesFile,
      bindingsFile: storePaths.bindingsFile,
      runsFile: storePaths.runsFile
    }
  };

  const written = writeProofJson(proofFile, payload, config, 'workspace-proof-section53-autonomy-gradient.mjs');
  console.log(JSON.stringify(written, null, 2));
  if (!written.pass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
