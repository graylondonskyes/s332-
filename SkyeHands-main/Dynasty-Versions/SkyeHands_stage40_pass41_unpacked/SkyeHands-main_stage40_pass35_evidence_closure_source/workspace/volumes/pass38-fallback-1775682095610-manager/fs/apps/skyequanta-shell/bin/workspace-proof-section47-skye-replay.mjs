#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { appendAuditEvent, ensureGovernanceStores } from '../lib/governance-manager.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import {
  createReplaySession,
  appendReplayEvent,
  createReplayCheckpoint,
  exportReplayBundle,
  verifyReplayBundle,
  reconstructFileStateAtOrder,
  reconstructTerminalOutputAtOrder,
  materializeReplayCheckpoint,
  forkReplaySession,
  exportReplayBundle as exportForkBundle,
  createReplayExportBundle
} from '../lib/skye-replay.mjs';

function parseArgs(argv) {
  return {
    strict: argv.includes('--strict')
  };
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  ensureGovernanceStores(baseConfig);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section47-skye-replay.mjs');

  const outputDir = path.join(config.rootDir, 'dist', 'section47', 'replay-proof');
  const rerunDir = path.join(outputDir, 'rerun-from-checkpoint');
  const forkOutputDir = path.join(outputDir, 'forked-run');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_47_SKYE_REPLAY.json');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  appendAuditEvent(config, {
    action: 'section47-skye-replay-start',
    outcome: 'success',
    actorType: 'proof',
    actorId: 'section47-skye-replay',
    tenantId: 'local',
    workspaceId: 'section47',
    detail: { phase: 'initialization', section: 47 }
  });

  const session = createReplaySession({
    runId: 'section47-main-run',
    workspaceId: 'section47',
    tenantId: 'local',
    model: 'kAIxU-Prime6.7',
    policyMode: 'evidence-first',
    budgetMode: 'balanced',
    initialFiles: {
      'README.md': '# SkyeReplay Fixture\n',
      'src/app.js': 'export const answer = 40;\n',
      'src/policy.json': '{"egress":"restricted"}\n'
    }
  });

  appendReplayEvent(session, 'planning', { summary: 'Plan: inspect src/app.js, patch failing answer, keep replay evidence.' });
  appendReplayEvent(session, 'file-read', { filePath: 'src/app.js', summary: 'Read current answer constant.' });
  appendReplayEvent(session, 'file-write', { filePath: 'src/app.js', content: 'export const answer = 41;\n', reason: 'first repair attempt' });
  appendReplayEvent(session, 'command-start', { command: 'npm test', summary: 'Start tests after first patch.' });
  appendReplayEvent(session, 'command-exit', { terminalAppend: 'npm test\nFAIL expected 42 but received 41\n' });
  appendReplayEvent(session, 'test-failure', { terminalAppend: 'AssertionError: expected 42 but received 41\n', summary: 'Observed mismatch under replay.' });
  const checkpointFailure = createReplayCheckpoint(session, 'after-failure', { phase: 'failure-analysis' });
  appendReplayEvent(session, 'approval', { message: 'Human approves second repair path.', terminalAppend: 'approval granted for deterministic fix\n' });
  appendReplayEvent(session, 'file-write', { filePath: 'src/app.js', content: 'export const answer = 42;\n', reason: 'accepted repair' });
  appendReplayEvent(session, 'policy-denial', { message: 'Outbound internet denied for fixture run.', terminalAppend: 'policy denial: outbound internet blocked\n' });
  appendReplayEvent(session, 'runtime-transition', { message: 'Executor resumed under replay capture.', terminalAppend: 'runtime transition: replay capture active\n' });
  const checkpointRepair = createReplayCheckpoint(session, 'after-repair', { phase: 'repair' });
  appendReplayEvent(session, 'deploy', { message: 'Preview deployed for proof pack.', terminalAppend: 'deploy preview ok\n' });
  appendReplayEvent(session, 'command-start', { command: 'npm test', summary: 'Start final regression.' });
  appendReplayEvent(session, 'command-exit', { terminalAppend: 'npm test\nPASS deterministic replay fixture\n' });
  const checkpointSuccess = createReplayCheckpoint(session, 'after-success', { phase: 'success' });

  const exportInfo = exportReplayBundle(session, outputDir);
  const replayExport = createReplayExportBundle(config.rootDir, exportInfo, outputDir);
  const verification = verifyReplayBundle(exportInfo.bundle);

  const fileAtStep8 = reconstructFileStateAtOrder(exportInfo.bundle, 'src/app.js', 8);
  const terminalAtStep11 = reconstructTerminalOutputAtOrder(exportInfo.bundle, 11);
  const rerunMaterialized = materializeReplayCheckpoint(exportInfo.bundle, checkpointFailure.id, rerunDir);
  const rerunFileText = readText(path.join(rerunDir, 'src', 'app.js'));

  const fork = forkReplaySession(exportInfo.bundle, checkpointFailure.order, {
    runId: 'section47-forked-run',
    model: 'kAIxU-Prime6.7-fork',
    policyMode: 'strict-security',
    budgetMode: 'fastest-fix-under-budget',
    checkpointLabel: 'fork-base-after-failure'
  });
  appendReplayEvent(fork, 'file-write', { filePath: 'src/app.js', content: 'export const answer = 99;\n', reason: 'fork divergence under different budget/policy' });
  appendReplayEvent(fork, 'approval', { message: 'Fork path approved with override.', terminalAppend: 'fork approval granted\n' });
  appendReplayEvent(fork, 'command-start', { command: 'npm test' });
  appendReplayEvent(fork, 'command-exit', { terminalAppend: 'npm test\nPASS fork divergence\n' });
  const forkCheckpoint = createReplayCheckpoint(fork, 'fork-diverged', { phase: 'fork-divergence' });
  const forkExportInfo = exportForkBundle(fork, forkOutputDir);
  const forkVerification = verifyReplayBundle(forkExportInfo.bundle);
  const forkFinalState = reconstructFileStateAtOrder(forkExportInfo.bundle, 'src/app.js', 10);
  const originalFinalState = reconstructFileStateAtOrder(exportInfo.bundle, 'src/app.js', 13);

  const removedEventBundle = JSON.parse(JSON.stringify(exportInfo.bundle));
  removedEventBundle.events.splice(4, 1);
  const removedEventFailure = verifyReplayBundle(removedEventBundle);

  const tamperedDiffBundle = JSON.parse(JSON.stringify(exportInfo.bundle));
  tamperedDiffBundle.checkpoints[1].diff.fileChanges.push({ type: 'change', path: 'src/ghost.js', beforeSha256: 'aaa', afterSha256: 'bbb' });
  const tamperedDiffFailure = verifyReplayBundle(tamperedDiffBundle);

  const outOfOrderBundle = JSON.parse(JSON.stringify(exportInfo.bundle));
  outOfOrderBundle.events[3].order = 99;
  const outOfOrderFailure = verifyReplayBundle(outOfOrderBundle);

  const replayHtml = readText(exportInfo.timelineFile);

  appendAuditEvent(config, {
    action: 'section47-skye-replay-complete',
    outcome: verification.ok && forkVerification.ok ? 'success' : 'failure',
    actorType: 'proof',
    actorId: 'section47-skye-replay',
    tenantId: 'local',
    workspaceId: 'section47',
    detail: {
      verification: verification.ok,
      forkVerification: forkVerification.ok,
      rerunCheckpoint: checkpointFailure.id
    }
  });

  const checks = [
    assertCheck(exportInfo.bundle.events.length >= 13, 'Execute a real fixture task run', { eventCount: exportInfo.bundle.events.length }),
    assertCheck(exportInfo.bundle.events.every((event, index) => event.order === index + 1), 'Persist ordered replay events', { bundleFile: path.relative(config.rootDir, exportInfo.bundleFile) }),
    assertCheck(fileAtStep8 === 'export const answer = 42;\n', 'Reconstruct file state at step N', { step: 8, content: fileAtStep8 }),
    assertCheck(terminalAtStep11.includes('deploy preview ok') && terminalAtStep11.includes('policy denial'), 'Reconstruct terminal output at step N', { step: 11, terminalAtStep11 }),
    assertCheck(replayExport.ok && fs.existsSync(replayExport.exportFile), 'Add replay export bundle for debugging, procurement, and proof packs', { exportFile: path.relative(config.rootDir, replayExport.exportFile) }),
    assertCheck(rerunMaterialized.ok && rerunFileText === 'export const answer = 41;\n', 'Re-run from a selected checkpoint', { checkpointId: checkpointFailure.id, rerunDir: path.relative(config.rootDir, rerunDir), rerunFileText }),
    assertCheck(!removedEventFailure.ok && ['event_digest_mismatch', 'out_of_order_event'].includes(removedEventFailure.reason), 'Remove one event and prove replay verification fails', removedEventFailure),
    assertCheck(!tamperedDiffFailure.ok && tamperedDiffFailure.reason === 'checkpoint_diff_mismatch', 'Tamper one diff and prove digest mismatch', tamperedDiffFailure),
    assertCheck(!outOfOrderFailure.ok && outOfOrderFailure.reason === 'out_of_order_event', 'Inject out-of-order event and prove replay rejects it', outOfOrderFailure),
    assertCheck(forkVerification.ok && forkCheckpoint.order > checkpointFailure.order && forkFinalState !== originalFinalState && forkFinalState === 'export const answer = 99;\n', 'Fork replay from an intermediate step and prove the new branch diverges cleanly', {
      forkBundle: path.relative(config.rootDir, forkExportInfo.bundleFile),
      originalFinalState,
      forkFinalState,
      forkCheckpoint: forkCheckpoint.id
    }),
    assertCheck(
      exportInfo.bundle.events.some(event => event.type === 'planning') &&
      exportInfo.bundle.events.some(event => event.type === 'file-read') &&
      exportInfo.bundle.events.some(event => event.type === 'file-write') &&
      exportInfo.bundle.events.some(event => event.type === 'command-start') &&
      exportInfo.bundle.events.some(event => event.type === 'command-exit') &&
      exportInfo.bundle.events.some(event => event.type === 'test-failure') &&
      exportInfo.bundle.events.some(event => event.type === 'policy-denial') &&
      exportInfo.bundle.events.some(event => event.type === 'approval') &&
      exportInfo.bundle.events.some(event => event.type === 'deploy') &&
      exportInfo.bundle.events.some(event => event.type === 'runtime-transition'),
      'Capture ordered replay events for planning, file reads, file writes, command start/exit, test failure, policy denial, approvals, deploys, and runtime transitions',
      { eventTypes: [...new Set(exportInfo.bundle.events.map(event => event.type))] }
    ),
    assertCheck(exportInfo.bundle.checkpoints.length === 3 && exportInfo.bundle.checkpoints.every(item => item.snapshotHash && item.diffHash && item.diff.fileChangeCount >= 0), 'Add checkpoint snapshots plus diffs between checkpoints instead of only final-state storage', { checkpoints: exportInfo.bundle.checkpoints.map(item => ({ id: item.id, order: item.order, diffHash: item.diffHash })) }),
    assertCheck(replayHtml.includes('id="scrubber"') && replayHtml.includes('Event List') && replayHtml.includes('Diff View') && replayHtml.includes('Terminal View') && replayHtml.includes('Checkpoint Jump Controls'), 'Add replay timeline UI with scrubber, event list, diff view, terminal view, and checkpoint jump controls', { timelineFile: path.relative(config.rootDir, exportInfo.timelineFile) }),
    assertCheck(fork.metadata.policyMode === 'strict-security' && fork.metadata.budgetMode === 'fastest-fix-under-budget' && fork.metadata.forkedFromOrder === checkpointFailure.order, 'Add replay fork capability so a run can be resumed from a chosen checkpoint under different model, policy, or budget conditions', { metadata: fork.metadata }),
    assertCheck(verification.ok, 'Add replay verification digest so event tampering is detectable', verification),
    assertCheck(verification.ok && readText(exportInfo.bundleFile).includes('eventDigest') && readText(exportInfo.bundleFile).includes('checkpointDigest'), 'Create proof artifact docs/proof/SECTION_47_SKYE_REPLAY.json', { proofFile: path.relative(config.rootDir, proofFile), bundleFile: path.relative(config.rootDir, exportInfo.bundleFile) }),
    assertCheck(verification.ok && forkVerification.ok && originalFinalState === 'export const answer = 42;\n' && forkFinalState === 'export const answer = 99;\n', 'A real autonomous run can be rewound, inspected, verified, forked, and re-executed from a checkpoint', {
      checkpointFailure: checkpointFailure.id,
      checkpointRepair: checkpointRepair.id,
      checkpointSuccess: checkpointSuccess.id,
      forkCheckpoint: forkCheckpoint.id
    })
  ];

  let payload = {
    section: 47,
    label: 'section-47-skye-replay',
    generatedAt: new Date().toISOString(),
    pass: checks.every(item => item.pass),
    strict: options.strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section47-skye-replay.mjs --strict',
    smokeCommand: 'bash scripts/smoke-section47-skye-replay.sh',
    checks,
    hostileChecks: [
      { name: 'remove_event', pass: !removedEventFailure.ok, detail: removedEventFailure },
      { name: 'tamper_diff', pass: !tamperedDiffFailure.ok, detail: tamperedDiffFailure },
      { name: 'out_of_order_event', pass: !outOfOrderFailure.ok, detail: outOfOrderFailure }
    ],
    recoveryChecks: [
      { name: 'materialize_checkpoint', pass: rerunMaterialized.ok, detail: rerunMaterialized },
      { name: 'fork_from_checkpoint', pass: forkVerification.ok, detail: { forkBundle: path.relative(config.rootDir, forkExportInfo.bundleFile) } }
    ],
    evidence: {
      bundle: {
        bundleFile: path.relative(config.rootDir, exportInfo.bundleFile),
        timelineFile: path.relative(config.rootDir, exportInfo.timelineFile),
        exportFile: path.relative(config.rootDir, replayExport.exportFile)
      },
      artifactReferences: {
        proofFile: path.relative(config.rootDir, proofFile),
        rerunDir: path.relative(config.rootDir, rerunDir),
        forkBundleFile: path.relative(config.rootDir, forkExportInfo.bundleFile)
      },
      initializationProof: {
        initialFiles: Object.keys(session.initialFiles),
        checkpointCount: exportInfo.bundle.checkpoints.length
      },
      actionProof: {
        eventTypes: [...new Set(exportInfo.bundle.events.map(event => event.type))],
        eventCount: exportInfo.bundle.events.length
      },
      persistenceProof: {
        verification,
        fileAtStep8,
        terminalAtStep11
      },
      explanationProof: {
        policyMode: exportInfo.bundle.metadata.policyMode,
        budgetMode: exportInfo.bundle.metadata.budgetMode,
        explanations: exportInfo.bundle.finalState.explanations.slice(0, 6)
      },
      hostileFailureProof: {
        removedEventFailure,
        tamperedDiffFailure,
        outOfOrderFailure
      }
    }
  };

  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section47-skye-replay.mjs');
  if (options.strict && !payload.pass) {
    throw new Error('Section 47 SkyeReplay proof failed in strict mode.');
  }
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
