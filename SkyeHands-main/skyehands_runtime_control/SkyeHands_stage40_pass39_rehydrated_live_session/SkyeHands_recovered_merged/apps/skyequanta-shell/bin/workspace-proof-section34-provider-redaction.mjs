import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { writeProofJson } from '../lib/proof-runtime.mjs';
import { writeRedactedSupportDump } from '../lib/gate-config.mjs';
import { saveProviderProfile } from '../lib/provider-vault.mjs';
import { upsertWorkspaceProviderBinding } from '../lib/provider-bindings.mjs';
import { resolveWorkspaceProviderProjection } from '../lib/provider-env-projection.mjs';
import { createSnapshot } from '../lib/workspace-manager.mjs';
import { listAuditEvents } from '../lib/governance-manager.mjs';
import { unlockProviderProfileForSession } from '../lib/session-manager.mjs';
import { collectSecretValues, redactProviderPayload, redactTextAgainstSecrets } from '../lib/provider-redaction.mjs';
import { createOpenMeFirstHtml, createOperatorHandoffReadme } from '../lib/deployment-packaging.mjs';
import { writeInvestorPacket } from '../lib/investor-packet.mjs';
import { buildProviderProofConfig, assertCheck, ensureProofWorkspace, searchPathForMarker, relative } from './provider-proof-helpers.mjs';

function parseJsonFromMixedOutput(rawText) {
  const text = String(rawText || '').trim();
  const start = text.indexOf('{');
  if (start === -1) return null;
  try {
    return JSON.parse(text.slice(start));
  } catch {
    return null;
  }
}

async function main() {
  const strict = process.argv.includes('--strict');
  const config = buildProviderProofConfig('workspace-proof-section34-provider-redaction.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_34_PROVIDER_REDACTION.json');
  const workspaceId = 'section34-provider-redaction';
  const tenantId = 'section34';
  const unlockSecret = 'section34-unlock-secret';
  const rawMarker = `S34_REDACTION_SECRET_${Date.now()}`;
  const profileId = `section34-env-${Date.now()}`;

  const { workspace, session } = await ensureProofWorkspace(config, workspaceId, {
    tenantId,
    source: 'section34-proof',
    clientName: 'section34-client'
  });

  saveProviderProfile(config, {
    profileId,
    tenantId,
    provider: 'env_bundle',
    alias: 'Section 34 Redaction Profile',
    unlockSecret,
    actorType: 'proof',
    actorId: 'section34-proof',
    source: 'section34-proof',
    secretPayload: {
      bundleName: 'Section 34 Bundle',
      env: {
        DATABASE_URL: `postgresql://section34:${rawMarker}@db.example.com:5432/section34`,
        NETLIFY_AUTH_TOKEN: rawMarker,
        GITHUB_TOKEN: rawMarker
      }
    }
  });
  upsertWorkspaceProviderBinding(config, {
    workspaceId,
    tenantId,
    profileId,
    capability: 'runtime',
    envTarget: 'workspace_runtime',
    projectionMode: 'ephemeral',
    actorType: 'proof',
    actorId: 'section34-proof'
  });

  unlockProviderProfileForSession(config, {
    sessionId: session.id,
    profileId,
    tenantId,
    workspaceId,
    unlockSecret,
    ttlMs: 60_000,
    actorType: 'proof',
    actorId: 'section34-proof'
  });

  const projection = resolveWorkspaceProviderProjection(config, {
    workspaceId,
    tenantId,
    sessionId: session.id,
    includeValues: false,
    action: 'provider_runtime_execution'
  });

  const sensitivePayload = {
    providerEnvelope: {
      databaseUrl: `postgresql://section34:${rawMarker}@db.example.com:5432/section34`,
      token: rawMarker,
      env: {
        DATABASE_URL: `postgresql://section34:${rawMarker}@db.example.com:5432/section34`,
        NETLIFY_AUTH_TOKEN: rawMarker
      }
    },
    note: `embedded-text-${rawMarker}`
  };
  const redactedObject = redactProviderPayload(sensitivePayload);
  const redactedText = redactTextAgainstSecrets(`prefix-${rawMarker}-suffix`, collectSecretValues(sensitivePayload));
  const supportDumpPath = writeRedactedSupportDump(config.rootDir, `section34-support-dump-${Date.now()}.json`, sensitivePayload, config.gateRuntime, process.env);
  const supportDumpText = fs.readFileSync(supportDumpPath, 'utf8');
  const snapshot = await createSnapshot(config, workspaceId, { label: 'section34-redaction-snapshot', createdBy: 'section34-proof' });
  const snapshotHasMarker = searchPathForMarker(snapshot.snapshot.snapshotDir, rawMarker);
  const audit = listAuditEvents(config, { tenantId, workspaceId, limit: 100 });
  const auditText = JSON.stringify(audit.events || []);
  const runtimeTreeHasMarker = searchPathForMarker(path.join(config.rootDir, '.skyequanta'), rawMarker);

  const auditExportFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_34_AUDIT_EXPORT.json');
  const auditExportRun = spawnSync(process.execPath, [
    path.join(config.shellDir, 'bin', 'audit-export.mjs'),
    '--format', 'json',
    '--tenant', tenantId,
    '--output', auditExportFile,
    '--json'
  ], {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const auditExportPayload = parseJsonFromMixedOutput(auditExportRun.stdout);
  const auditExportText = fs.existsSync(auditExportFile) ? fs.readFileSync(auditExportFile, 'utf8') : '';

  const leakFixturePath = path.join(config.rootDir, '.skyequanta', 'reports', 'runtime-seal-fixtures', `section34-provider-leak-${Date.now()}.txt`);
  fs.mkdirSync(path.dirname(leakFixturePath), { recursive: true });
  fs.writeFileSync(leakFixturePath, `leak fixture => ${rawMarker}\n`, 'utf8');

  const runtimeSealArgs = [
    path.join(config.shellDir, 'bin', 'runtime-seal.mjs'),
    '--strict',
    '--json',
    '--protect-secret', rawMarker,
    '--scan-path', path.relative(config.rootDir, leakFixturePath)
  ];
  const runtimeSealLeakRun = spawnSync(process.execPath, runtimeSealArgs, {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const runtimeSealLeakPayload = parseJsonFromMixedOutput(runtimeSealLeakRun.stdout);

  fs.rmSync(leakFixturePath, { force: true });

  const runtimeSealCleanRun = spawnSync(process.execPath, runtimeSealArgs, {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const runtimeSealCleanPayload = parseJsonFromMixedOutput(runtimeSealCleanRun.stdout);

  const investorPacket = writeInvestorPacket(config.rootDir);
  const procurementText = fs.readFileSync(investorPacket.files.procurementHandoff, 'utf8');
  const pricingText = fs.readFileSync(investorPacket.files.pricingSpec, 'utf8');
  const proofCenterText = fs.readFileSync(investorPacket.files.proofCenter, 'utf8');

  const handoffDir = path.join(config.rootDir, 'dist', 'provider-handoff-proof');
  fs.rmSync(handoffDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(handoffDir, 'docs'), { recursive: true });
  fs.copyFileSync(investorPacket.files.procurementHandoff, path.join(handoffDir, path.basename(investorPacket.files.procurementHandoff)));
  const handoffOpenMeFirst = createOpenMeFirstHtml(config, path.join(handoffDir, 'OPEN_ME_FIRST.html'), { supportDump: relative(config, supportDumpPath) });
  const handoffReadme = createOperatorHandoffReadme(config, path.join(handoffDir, 'README_OPERATOR_HANDOFF.txt'));
  const handoffProcurementText = fs.readFileSync(path.join(handoffDir, path.basename(investorPacket.files.procurementHandoff)), 'utf8');
  const handoffReadmeText = fs.readFileSync(handoffReadme, 'utf8');
  const handoffOpenMeFirstText = fs.readFileSync(handoffOpenMeFirst, 'utf8');
  const handoffHasMarker = searchPathForMarker(handoffDir, rawMarker);

  const checks = [
    assertCheck(!JSON.stringify(projection).includes(rawMarker), 'provider runtime projections redact secret values and expose only masked previews plus env key lists', { envKeys: projection.envKeys, projections: projection.projections }),
    assertCheck(redactedObject.providerEnvelope === '[REDACTED]' && JSON.stringify(redactedObject).includes('[REDACTED]'), 'provider redaction helper strips provider credential values from nested payload objects', redactedObject),
    assertCheck(!redactedText.includes(rawMarker) && redactedText.includes('[REDACTED]'), 'provider redaction helper strips embedded raw secret values from plain text output', redactedText),
    assertCheck(!supportDumpText.includes(rawMarker), 'support dumps redact provider credential values even when they appear inside nested provider payloads or text', { supportDumpPath: relative(config, supportDumpPath) }),
    assertCheck(snapshotHasMarker === false, 'workspace snapshots do not capture unlocked provider secrets from the runtime lane', { snapshotDir: relative(config, snapshot.snapshot.snapshotDir) }),
    assertCheck(!auditText.includes(rawMarker) && runtimeTreeHasMarker === false, 'audit history and runtime-state files remain free of raw provider credential values', { auditCount: (audit.events || []).length, runtimeTree: relative(config, path.join(config.rootDir, '.skyequanta')) }),
    assertCheck(auditExportRun.status === 0 && Boolean(auditExportPayload?.providerSovereignty) && !auditExportText.includes(rawMarker), 'audit export includes sovereign-provider posture summary while keeping raw provider secrets out of exported evidence', { providerSovereignty: auditExportPayload?.providerSovereignty, output: relative(config, auditExportFile) }),
    assertCheck(runtimeSealLeakRun.status !== 0 && runtimeSealLeakPayload?.ok === false && (runtimeSealLeakPayload?.leakScan?.findings || []).some(item => item.file === relative(config, leakFixturePath)), 'runtime seal fails when an intentional provider-secret leak fixture is introduced into protected outputs', runtimeSealLeakPayload?.leakScan),
    assertCheck(runtimeSealCleanRun.status === 0 && runtimeSealCleanPayload?.ok === true && (runtimeSealCleanPayload?.leakScan?.findings || []).length === 0, 'runtime seal passes again after the intentional plaintext leak fixture is removed', runtimeSealCleanPayload?.leakScan),
    assertCheck(procurementText.includes('provider execution remains unlock-gated') && pricingText.includes('Sovereign provider vault') && proofCenterText.includes('Sovereign provider evidence') && !procurementText.includes(rawMarker), 'procurement packet and public pricing/proof surfaces describe provider sovereignty truth without printing secrets', { procurement: relative(config, investorPacket.files.procurementHandoff), pricing: relative(config, investorPacket.files.pricingSpec), proofCenter: relative(config, investorPacket.files.proofCenter) }),
    assertCheck(handoffProcurementText.includes('provider execution remains unlock-gated') && handoffReadmeText.includes('sovereign provider directive and proof surfaces') && handoffOpenMeFirstText.includes('Provider redaction proof') && handoffHasMarker === false, 'ship-candidate handoff surfaces carry sovereign-provider packet truth and remain free of plaintext provider secrets', { handoffDirectory: relative(config, handoffDir), procurement: path.relative(handoffDir, path.join(handoffDir, path.basename(investorPacket.files.procurementHandoff))), openMeFirst: path.relative(handoffDir, handoffOpenMeFirst) })
  ];

  let payload = {
    section: 34,
    label: 'section-34-provider-redaction',
    generatedAt: new Date().toISOString(),
    strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section34-provider-redaction.mjs --strict',
    pass: checks.every(item => item.pass),
    checks,
    evidence: {
      workspaceId,
      sessionId: session.id,
      profileId,
      supportDumpPath: relative(config, supportDumpPath),
      snapshotDir: relative(config, snapshot.snapshot.snapshotDir),
      auditCount: (audit.events || []).length,
      projectionEnvKeys: projection.envKeys,
      auditExportFile: relative(config, auditExportFile),
      handoffDirectory: relative(config, handoffDir),
      handoffOpenMeFirst: path.relative(handoffDir, handoffOpenMeFirst),
      runtimeSealLeakStatus: runtimeSealLeakRun.status,
      runtimeSealCleanStatus: runtimeSealCleanRun.status
    }
  };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section34-provider-redaction.mjs');
  if (strict && !payload.pass) {
    throw new Error('Section 34 provider redaction proof failed in strict mode.');
  }
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
