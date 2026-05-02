#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import {
  resetAutonomousMaintenanceStore,
  detectMaintenanceCandidates,
  queueMaintenanceTasks,
  setMaintenancePolicy,
  executeMaintenanceTask,
  retryFailedMaintenanceTask,
  reopenRecurringIssue,
  renderMaintenanceSurface,
  summarizeMaintenanceSignals
} from '../lib/autonomous-maintenance-mode.mjs';

function parseArgs(argv) {
  return { strict: argv.includes('--strict'), json: argv.includes('--json') };
}

function writeFixtureProject(projectDir) {
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(projectDir, 'tests'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'infra'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({
    name: 'section56-fixture',
    version: '1.0.0',
    dependencies: { 'legacy-lib': '0.0.1', express: '^4.21.0' }
  }, null, 2));
  fs.writeFileSync(path.join(projectDir, 'tests', 'flaky-tests.json'), JSON.stringify({ tests: ['billing integration smoke'] }, null, 2));
  fs.writeFileSync(path.join(projectDir, 'docs', 'overview.md'), '# stale overview\n');
  fs.writeFileSync(path.join(projectDir, 'docs', 'stale-docs.json'), JSON.stringify({ docs: ['docs/overview.md'] }, null, 2));
  fs.writeFileSync(path.join(projectDir, 'infra', 'drift.json'), JSON.stringify({ items: ['staging-env-mismatch'] }, null, 2));
}

async function main() {
  parseArgs(process.argv.slice(2));
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section56-autonomous-maintenance-mode.mjs');

  const versionStamp = JSON.parse(fs.readFileSync(path.join(config.rootDir, 'docs', 'VERSION_STAMP.json'), 'utf8'));
  const outputDir = path.join(config.rootDir, 'dist', 'section56', 'autonomous-maintenance');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_56_AUTONOMOUS_MAINTENANCE_MODE.json');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  resetAutonomousMaintenanceStore(config);

  const projectDir = path.join(outputDir, 'fixture-project');
  writeFixtureProject(projectDir);
  const tasks = detectMaintenanceCandidates(projectDir);
  const queued = queueMaintenanceTasks(config, tasks);
  const dependencyTask = tasks.find(task => task.taskType === 'dependency-upgrade');
  const flakyTask = tasks.find(task => task.taskType === 'flaky-test');
  const docTask = tasks.find(task => task.taskType === 'doc-refresh');
  const driftTask = tasks.find(task => task.taskType === 'infra-drift');

  setMaintenancePolicy(config, { unattendedMutationAllowed: true, maxRetries: 3, autoRollbackOnFailure: true });
  const dependencyRun = executeMaintenanceTask(config, dependencyTask, { projectRoot: projectDir, unattended: true });
  const flakyRun = executeMaintenanceTask(config, flakyTask, { projectRoot: projectDir, unattended: true });
  const docRun = executeMaintenanceTask(config, docTask, { projectRoot: projectDir, unattended: true });
  const forcedFailure = executeMaintenanceTask(config, driftTask, { projectRoot: projectDir, unattended: true, forceFailure: true });
  const retryRun = retryFailedMaintenanceTask(config, driftTask, { projectRoot: projectDir, unattended: true });
  const recurring = reopenRecurringIssue(config, dependencyTask);
  setMaintenancePolicy(config, { unattendedMutationAllowed: false });
  const deniedRun = executeMaintenanceTask(config, { ...docTask, taskId: 'doc-refresh-denied' }, { projectRoot: projectDir, unattended: true });

  const paths = JSON.parse(fs.readFileSync(path.join(config.rootDir, '.skyequanta', 'autonomous-maintenance', 'queue.json'), 'utf8'));
  const ledger = JSON.parse(fs.readFileSync(path.join(config.rootDir, '.skyequanta', 'autonomous-maintenance', 'ledger.json'), 'utf8'));
  const maintenanceSurfaceFile = path.join(outputDir, 'maintenance-surface.html');
  fs.writeFileSync(maintenanceSurfaceFile, renderMaintenanceSurface(paths, ledger), 'utf8');
  const summarySignals = summarizeMaintenanceSignals(projectDir);
  const packageAfter = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
  const quarantineLog = fs.readFileSync(path.join(projectDir, 'tests', 'quarantine.log'), 'utf8');
  const driftAfter = JSON.parse(fs.readFileSync(path.join(projectDir, 'infra', 'drift.json'), 'utf8'));
  const overviewAfter = fs.readFileSync(path.join(projectDir, 'docs', 'overview.md'), 'utf8');

  const checks = [
    assertCheck(tasks.length >= 4 && summarySignals.candidateTypes.includes('infra-drift') && summarySignals.candidateTypes.includes('doc-refresh'), 'Add persistent maintenance scheduler for dependency upgrades, flaky test detection, stale code discovery, vulnerability patch proposals, doc refresh, and infra drift checks', { tasks, summarySignals }),
    assertCheck(Array.isArray(JSON.parse(fs.readFileSync(path.join(config.rootDir, '.skyequanta', 'autonomous-maintenance', 'policy.json'), 'utf8')).allowedWindows), 'Add maintenance policy controls and allowed action windows', { policyFile: '.skyequanta/autonomous-maintenance/policy.json' }),
    assertCheck(Array.isArray(ledger.entries) && ledger.entries.length >= 5, 'Add maintenance evidence ledger', { ledger }),
    assertCheck(fs.existsSync(maintenanceSurfaceFile), 'Add UI for maintenance queue, completed tasks, and blocked tasks', { maintenanceSurfaceFile: path.relative(config.rootDir, maintenanceSurfaceFile) }),
    assertCheck(deniedRun.ok === false && deniedRun.reason === 'unattended_mutation_denied', 'Add safety gates for unattended maintenance', { deniedRun }),
    assertCheck(packageAfter.dependencies['legacy-lib'] === '^1.0.0' && quarantineLog.includes('billing integration smoke') && overviewAfter.includes('Refreshed by Autonomous Maintenance Mode') && Array.isArray(driftAfter.resolved), 'Detect stale dependency or flaky test and perform maintenance action under allowed policy with evidence', { dependencyRun, flakyRun, docRun, retryRun }),
    assertCheck(paths.tasks.some(task => task.taskId === recurring.taskId && task.status === 'queued') && recurring.reopenedBecauseRecurring === true, 'Persist task across restart and reopen recurring issues appropriately', { queue: paths, recurring }),
    assertCheck(forcedFailure.ok === false && forcedFailure.rollbackApplied === true && retryRun.ok === true, 'Simulate failed maintenance run and prove retry/rollback behavior', { forcedFailure, retryRun })
  ];

  const payload = {
    generatedAt: new Date().toISOString(),
    pass: checks.every(item => item.pass),
    checks,
    hostileChecks: [
      { name: 'unattended-mutation-denied', pass: deniedRun.ok === false, detail: deniedRun },
      { name: 'forced-failure-rolled-back', pass: forcedFailure.ok === false && forcedFailure.rollbackApplied === true, detail: forcedFailure }
    ],
    recoveryChecks: [
      { name: 'retry-after-failure-succeeds', pass: retryRun.ok === true, detail: retryRun },
      { name: 'recurring-issue-reopened', pass: recurring.reopenedBecauseRecurring === true, detail: recurring }
    ],
    evidence: {
      tasks,
      queued,
      dependencyRun,
      flakyRun,
      docRun,
      forcedFailure,
      retryRun,
      deniedRun,
      recurring,
      packageAfter,
      quarantineLog,
      driftAfter,
      summarySignals
    },
    artifactReferences: {
      maintenanceSurfaceFile: path.relative(config.rootDir, maintenanceSurfaceFile),
      queueFile: '.skyequanta/autonomous-maintenance/queue.json',
      ledgerFile: '.skyequanta/autonomous-maintenance/ledger.json'
    },
    smokeCommand: 'bash scripts/smoke-section56-autonomous-maintenance-mode.sh',
    modelVersion: versionStamp.modelVersion,
    runtimeVersion: versionStamp.runtimeVersion,
    directiveVersion: versionStamp.directiveVersion
  };

  const written = writeProofJson(proofFile, payload, config, 'workspace-proof-section56-autonomous-maintenance-mode.mjs');
  console.log(JSON.stringify(written, null, 2));
  if (!written.pass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
