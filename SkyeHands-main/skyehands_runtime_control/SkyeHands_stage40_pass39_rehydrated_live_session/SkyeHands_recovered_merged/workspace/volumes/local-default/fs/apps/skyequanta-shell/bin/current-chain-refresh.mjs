import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { reconcileWorkspaceRuntime, releaseStartupLock } from '../lib/runtime-recovery.mjs';

function parseArgs(argv) {
  const options = {
    applyDocs: false,
    json: false,
    workspaceId: '',
    forceReleaseLock: false,
    lockTtlMs: 60_000
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--apply-docs') {
      options.applyDocs = true;
      continue;
    }
    if (value === '--json') {
      options.json = true;
      continue;
    }
    if (value === '--workspace-id' || value === '--workspace') {
      options.workspaceId = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (value === '--force-release-lock') {
      options.forceReleaseLock = true;
      continue;
    }
    if (value === '--lock-ttl-ms') {
      const parsed = Number.parseInt(String(argv[index + 1] || ''), 10);
      if (Number.isInteger(parsed) && parsed > 0) options.lockTtlMs = parsed;
      index += 1;
      continue;
    }
  }

  return options;
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeText(filePath, content) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function readPass(filePath) {
  const payload = readJson(filePath, null);
  return {
    exists: Boolean(payload),
    pass: Boolean(payload?.pass || payload?.passed || payload?.ok),
    generatedAt: payload?.generatedAt || null,
    filePath,
    label: payload?.label || payload?.proof || null
  };
}

function statusLabel(entry) {
  return entry.pass ? 'CHECKMARK' : 'BLANK';
}

function buildMatrixEntries(config) {
  const proofDir = path.join(config.rootDir, 'docs', 'proof');
  return [
    {
      key: 'stage8',
      title: 'Stage 8 preview forwarding',
      command: 'npm run workspace:proof:stage8 -- --strict',
      artifact: 'docs/proof/STAGE_8_PREVIEW_FORWARDING.json',
      ...readPass(path.join(proofDir, 'STAGE_8_PREVIEW_FORWARDING.json'))
    },
    {
      key: 'stage9',
      title: 'Stage 9 deployment readiness',
      command: 'npm run workspace:proof:stage9 -- --strict',
      artifact: 'docs/proof/STAGE_9_DEPLOYMENT_READINESS.json',
      ...readPass(path.join(proofDir, 'STAGE_9_DEPLOYMENT_READINESS.json'))
    },
    {
      key: 'stage10',
      title: 'Stage 10 multi-workspace stress',
      command: 'npm run workspace:proof:stage10 -- --strict',
      artifact: 'docs/proof/STAGE_10_MULTI_WORKSPACE_STRESS.json',
      ...readPass(path.join(proofDir, 'STAGE_10_MULTI_WORKSPACE_STRESS.json'))
    },
    {
      key: 'stage11',
      title: 'Stage 11 regression proof',
      command: 'npm run workspace:proof:stage11 -- --strict',
      artifact: 'docs/proof/STAGE_11_REGRESSION_PROOF.json',
      ...readPass(path.join(proofDir, 'STAGE_11_REGRESSION_PROOF.json'))
    },
    {
      key: 'section8',
      title: 'Ship-candidate packaging',
      command: 'npm run workspace:proof:section8 -- --strict',
      artifact: 'docs/proof/SECTION_8_DEPLOYMENT_PACKAGING.json',
      ...readPass(path.join(proofDir, 'SECTION_8_DEPLOYMENT_PACKAGING.json'))
    },
    {
      key: 'section42',
      title: 'Section 42 portable hostile-environment rerun',
      command: 'npm run workspace:proof:section42 -- --strict',
      artifact: 'docs/proof/SECTION_42_KERNEL_CONTAINMENT_AND_ARTIFACT_IDENTITY.json',
      ...readPass(path.join(proofDir, 'SECTION_42_KERNEL_CONTAINMENT_AND_ARTIFACT_IDENTITY.json'))
    },
    {
      key: 'section61',
      title: 'Imported platform launchpad',
      command: 'npm run workspace:proof:section61',
      artifact: 'docs/proof/SECTION_61_PLATFORM_LAUNCHPAD.json',
      ...readPass(path.join(proofDir, 'SECTION_61_PLATFORM_LAUNCHPAD.json'))
    },
    {
      key: 'section62',
      title: 'Imported platform power mesh',
      command: 'npm run workspace:proof:section62',
      artifact: 'docs/proof/SECTION_62_PLATFORM_POWER_MESH.json',
      ...readPass(path.join(proofDir, 'SECTION_62_PLATFORM_POWER_MESH.json'))
    },
    {
      key: 'section63',
      title: 'Agent-core runtime bundle',
      command: 'npm run workspace:proof:section63',
      artifact: 'docs/proof/SECTION_63_AGENT_CORE_BUNDLE.json',
      ...readPass(path.join(proofDir, 'SECTION_63_AGENT_CORE_BUNDLE.json'))
    }
  ];
}

function buildLaunchReadiness(entries) {
  const stage9 = entries.find(entry => entry.key === 'stage9');
  const stage11 = entries.find(entry => entry.key === 'stage11');
  const open = entries.filter(entry => ['stage8', 'stage9', 'stage10', 'stage11', 'section8', 'section42'].includes(entry.key) && !entry.pass);
  return `# Launch Readiness\n\nGenerated: ${new Date().toISOString().slice(0, 10)}\n\n## Current launch posture\n\n- Canonical runtime path: locked to \`apps/skyequanta-shell\`.\n- Root shipped operator entrypoints are now physically present: \`./START_HERE.sh\`, \`./skyequanta\`, root \`package.json\`, and root \`Makefile\`.\n- Platform launchpad proof is present through Section 61.\n- Platform power mesh proof is present through Section 62.\n- Agent-core runtime bundle proof is present through Section 63.\n- Deployment readiness is ${stage9?.pass ? 'green in the current artifact chain.' : 'still conservative until Stage 9 is rerun green in the current artifact chain.'}\n- Regression status is ${stage11?.pass ? 'green in the current artifact chain.' : 'still conservative until Stage 11 is rerun green in the current artifact chain.'}\n\n## Honest gate\n\n${open.length === 0 ? 'The current artifact chain has no remaining open rerun surfaces in the Stage 8–11 / Section 8 / Section 42 closure set.' : `The surviving package is stronger and more converged than pass34, but diligence should still treat these rerun surfaces as open until refreshed: ${open.map(entry => entry.title).join(', ')}.`}\n`;
}

function buildSmokeContractMatrix(entries) {
  const lines = [
    '# Smoke Contract Matrix',
    '',
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    '',
    '| Claim Surface | Command | Artifact | Status |',
    '|---|---|---|---|'
  ];

  for (const entry of entries) {
    lines.push(`| ${entry.title} | \`${entry.command}\` | \`${entry.artifact}\` | ${statusLabel(entry)} |`);
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'current-chain-refresh.mjs');

  let workspaceRecovery = null;
  if (options.workspaceId) {
    workspaceRecovery = reconcileWorkspaceRuntime(config, options.workspaceId, { lockTtlMs: options.lockTtlMs });
    if (options.forceReleaseLock && workspaceRecovery?.recovery?.status !== 'running') {
      workspaceRecovery.forceReleasedLock = releaseStartupLock(config, options.workspaceId, { holder: 'current-chain-refresh' });
    }
  }

  const entries = buildMatrixEntries(config);
  const refreshOpen = entries.filter(entry => ['stage8', 'stage9', 'stage10', 'stage11', 'section8', 'section42'].includes(entry.key) && !entry.pass);
  const docs = {
    launchReadinessPath: path.join(config.rootDir, 'docs', 'LAUNCH_READINESS.md'),
    smokeContractMatrixPath: path.join(config.rootDir, 'docs', 'SMOKE_CONTRACT_MATRIX.md')
  };

  if (options.applyDocs) {
    writeText(docs.launchReadinessPath, buildLaunchReadiness(entries));
    writeText(docs.smokeContractMatrixPath, buildSmokeContractMatrix(entries));
  }

  const payload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    proof: 'current-chain-refresh-plan',
    workspaceRecovery,
    docsApplied: options.applyDocs,
    docs,
    summary: {
      openRefreshCount: refreshOpen.length,
      openRefreshKeys: refreshOpen.map(entry => entry.key),
      greenCurrentChainKeys: entries.filter(entry => entry.pass).map(entry => entry.key)
    },
    entries
  };

  const outFile = path.join(config.rootDir, 'docs', 'proof', 'CURRENT_CHAIN_REFRESH_PLAN.json');
  const emitted = writeProofJson(outFile, payload, config, 'current-chain-refresh.mjs');

  if (options.json) {
    console.log(JSON.stringify(emitted, null, 2));
    return;
  }

  console.log(`current-chain refresh plan written to ${path.relative(config.rootDir, outFile)}`);
  console.log(`open refresh surfaces: ${refreshOpen.length}`);
  if (options.applyDocs) {
    console.log('docs updated: docs/LAUNCH_READINESS.md, docs/SMOKE_CONTRACT_MATRIX.md');
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
