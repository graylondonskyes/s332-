#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig } from '../apps/skyequanta-shell/bin/config.mjs';
import {
  createSnapshot,
  createWorkspace,
  deleteWorkspace,
  describeSnapshot,
  listSnapshots,
  restoreSnapshot,
  setWorkspacePorts,
  setWorkspaceSecretScope,
  updateWorkspaceStatus
} from '../apps/skyequanta-shell/lib/workspace-manager.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifactPath = path.join(root, 'SMOKE_P011_WORKSPACE_LIFECYCLE.md');

function check(condition, label, detail = null) {
  return { pass: Boolean(condition), label, detail };
}

function toBulletLines(checks) {
  return checks.map((item) => `- ${item.pass ? 'PASS' : 'FAIL'} | ${item.label}`);
}

async function run() {
  const config = getStackConfig(process.env);
  const workspaceId = `smoke-p011-${Date.now()}`;
  const checks = [];
  const artifacts = {};

  try {
    const created = createWorkspace(config, workspaceId, {
      name: 'P011 Workspace Lifecycle Smoke',
      tenantId: 'stage9-smoke',
      source: 'smoke-p011'
    });
    artifacts.created = created;
    checks.push(check(created?.created === true && created?.workspace?.id === workspaceId, 'create: workspace record is created'));

    const runningStatus = updateWorkspaceStatus(config, workspaceId, 'running', 'smoke_p011_run');
    artifacts.runningStatus = runningStatus;
    checks.push(check(runningStatus?.workspace?.status === 'running', 'run: workspace transitions to running status'));

    const baselinePorts = setWorkspacePorts(config, workspaceId, [4310, 4311], { forwardedHost: 'http://127.0.0.1' });
    artifacts.baselinePorts = baselinePorts;
    checks.push(check(Array.isArray(baselinePorts?.workspace?.metadata?.forwardedPorts) && baselinePorts.workspace.metadata.forwardedPorts.length === 2, 'run: forwarded ports can be configured'));

    const baselineSecret = setWorkspaceSecretScope(config, workspaceId, 'scope:baseline', { actorId: 'smoke-p011' });
    artifacts.baselineSecret = baselineSecret;
    checks.push(check(baselineSecret?.workspace?.metadata?.secretScope === 'scope:baseline', 'run: secret scope can be configured'));

    const snapshot = await createSnapshot(config, workspaceId, {
      label: 'baseline',
      actorId: 'smoke-p011',
      reason: 'capture baseline for recover flow'
    });
    artifacts.snapshot = snapshot;
    checks.push(check(Boolean(snapshot?.snapshot?.id), 'recover: baseline snapshot can be created'));

    const driftPorts = setWorkspacePorts(config, workspaceId, [4399], { forwardedHost: 'http://localhost' });
    const driftSecret = setWorkspaceSecretScope(config, workspaceId, 'scope:drifted', { actorId: 'smoke-p011' });
    artifacts.driftPorts = driftPorts;
    artifacts.driftSecret = driftSecret;

    const recovered = await restoreSnapshot(config, workspaceId, snapshot.snapshot.id, {
      actorId: 'smoke-p011',
      reason: 'recover from baseline snapshot'
    });
    artifacts.recovered = recovered;
    checks.push(check(recovered?.workspace?.metadata?.lastRestoredSnapshotId === snapshot.snapshot.id, 'recover: workspace reports restored snapshot id'));

    const described = describeSnapshot(config, workspaceId, snapshot.snapshot.id);
    const listed = listSnapshots(config, workspaceId);
    artifacts.described = described;
    artifacts.listed = listed;
    checks.push(check(described?.snapshot?.id === snapshot.snapshot.id, 'recover: snapshot descriptor is readable after restore'));
    checks.push(check(Array.isArray(listed?.snapshots) && listed.snapshots.some((entry) => entry.id === snapshot.snapshot.id), 'recover: snapshot remains listed for auditability'));
  } finally {
    try {
      const deleted = await deleteWorkspace(config, workspaceId, { deletedBy: 'smoke-p011', force: true });
      artifacts.deleted = deleted;
      checks.push(check(deleted?.deleted === true && deleted?.workspaceId === workspaceId, 'teardown: workspace cleanup delete succeeds'));
    } catch (error) {
      checks.push(check(false, 'teardown: workspace cleanup delete succeeds', String(error?.message || error)));
    }
  }

  const pass = checks.every((item) => item.pass);
  const summary = {
    pass,
    workspaceId,
    checkCount: checks.length,
    failed: checks.filter((item) => !item.pass).map((item) => item.label)
  };

  const lines = [
    '# P011 Smoke Proof — Workspace Lifecycle (Create/Run/Recover/Teardown)',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Workspace ID: ${workspaceId}`,
    `Checks: ${checks.length}`,
    `Failed Checks: ${summary.failed.length}`,
    `Status: ${pass ? 'PASS' : 'FAIL'}`,
    '',
    '## Checks',
    ...toBulletLines(checks),
    '',
    '## Summary JSON',
    '```json',
    JSON.stringify(summary, null, 2),
    '```',
    ''
  ];

  fs.writeFileSync(artifactPath, lines.join('\n'), 'utf8');
  console.log(JSON.stringify({ ...summary, artifact: path.relative(root, artifactPath) }, null, 2));
  if (!pass) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
