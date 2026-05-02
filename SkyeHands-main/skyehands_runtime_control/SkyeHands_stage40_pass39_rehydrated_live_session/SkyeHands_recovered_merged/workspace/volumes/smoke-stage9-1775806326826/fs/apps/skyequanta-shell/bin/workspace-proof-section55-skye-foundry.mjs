#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import {
  resetSkyeFoundryStore,
  provisionFoundryTenant,
  exportFoundryTenantPackage,
  verifyFoundryIsolation,
  renderFoundryOperatorSurface,
  summarizeFoundrySignals
} from '../lib/skye-foundry.mjs';

function parseArgs(argv) {
  return { strict: argv.includes('--strict'), json: argv.includes('--json') };
}

async function main() {
  parseArgs(process.argv.slice(2));
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section55-skye-foundry.mjs');

  const versionStamp = JSON.parse(fs.readFileSync(path.join(config.rootDir, 'docs', 'VERSION_STAMP.json'), 'utf8'));
  const outputDir = path.join(config.rootDir, 'dist', 'section55', 'skye-foundry');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_55_SKYE_FOUNDRY.json');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  resetSkyeFoundryStore(config);

  const tenantA = provisionFoundryTenant(config, {
    tenantId: 'tenant-a',
    brand: { name: 'Aurora Foundry', tagline: 'Finance-regulated sovereign cloud', colors: { primary: '#8b5cf6', accent: '#f59e0b', background: '#050816' } },
    domain: { host: 'aurora.devcloud.local' },
    policy: { complianceMode: 'finance', proofRequirement: 'strict', providerScope: 'tenant-a-only' },
    providers: [{ providerId: 'kaixu-finance', scope: 'tenant-a', defaultModel: 'kAIxU-finance-pro', governanceGroup: 'tenant-a' }],
    featureTiers: { starter: { shell: true }, sovereign: { shell: true, whiteLabel: true, auditExport: true } }
  });
  const tenantB = provisionFoundryTenant(config, {
    tenantId: 'tenant-b',
    brand: { name: 'Nebula Health', tagline: 'Healthcare private engineering cloud', colors: { primary: '#06b6d4', accent: '#22c55e', background: '#04121b' } },
    domain: { host: 'nebula.devcloud.local' },
    policy: { complianceMode: 'healthcare', proofRequirement: 'strict', providerScope: 'tenant-b-only' },
    providers: [{ providerId: 'kaixu-health', scope: 'tenant-b', defaultModel: 'kAIxU-health-pro', governanceGroup: 'tenant-b' }],
    featureTiers: { pro: { shell: true, maintenance: true }, sovereign: { shell: true, whiteLabel: true, auditExport: true } }
  });

  const exportA = exportFoundryTenantPackage(config, 'tenant-a', { outputDir: path.join(outputDir, 'tenant-a-export') });
  const exportB = exportFoundryTenantPackage(config, 'tenant-b', { outputDir: path.join(outputDir, 'tenant-b-export') });
  const operatorSurfaceFile = path.join(outputDir, 'foundry-operator-surface.html');
  fs.writeFileSync(operatorSurfaceFile, renderFoundryOperatorSurface([tenantA, tenantB]), 'utf8');

  const brandIsolation = verifyFoundryIsolation({ sourceTenant: tenantA, targetTenant: tenantB, attempt: { type: 'brand-bleed' } });
  const providerIsolation = verifyFoundryIsolation({ sourceTenant: tenantA, targetTenant: tenantB, attempt: { type: 'provider-bleed' } });
  const summarizedA = summarizeFoundrySignals(path.join(config.rootDir, 'branding'));

  const checks = [
    assertCheck(fs.existsSync(path.join(config.rootDir, tenantA.artifactReferences.shellFile)) && fs.existsSync(path.join(config.rootDir, tenantB.artifactReferences.shellFile)), 'Add tenant-brandable shell generation', { tenantA: tenantA.artifactReferences, tenantB: tenantB.artifactReferences }),
    assertCheck(tenantA.domain.host !== tenantB.domain.host && tenantA.policy.complianceMode !== tenantB.policy.complianceMode && tenantA.providers[0].providerId !== tenantB.providers[0].providerId, 'Add tenant-branded domain, policy, provider, and audit posture configuration', { tenantA, tenantB }),
    assertCheck(Boolean(tenantA.featureTiers?.starter?.shell) && Boolean(tenantB.featureTiers?.pro?.maintenance), 'Add per-tenant feature tiering and branding surfaces', { tiersA: tenantA.featureTiers, tiersB: tenantB.featureTiers }),
    assertCheck(exportA.manifest.files.length >= 5 && fs.existsSync(path.join(config.rootDir, exportA.artifactReferences.manifestFile)) && fs.existsSync(path.join(config.rootDir, exportB.artifactReferences.manifestFile)), 'Add tenant packaging/export lane for white-label deployment', { exportA, exportB }),
    assertCheck(fs.existsSync(operatorSurfaceFile), 'Add operator UI for provisioning a branded developer cloud from the core platform', { operatorSurfaceFile: path.relative(config.rootDir, operatorSurfaceFile) }),
    assertCheck(brandIsolation.ok && providerIsolation.ok, 'Provision two distinct branded foundry tenants and prove they remain tenant-scoped with no cross-tenant branding or provider bleed', { brandIsolation, providerIsolation, summarizedA })
  ];

  const payload = {
    generatedAt: new Date().toISOString(),
    pass: checks.every(item => item.pass),
    checks,
    hostileChecks: [
      { name: 'cross-tenant-branding-bleed-denied', pass: brandIsolation.ok, detail: brandIsolation },
      { name: 'cross-tenant-provider-bleed-denied', pass: providerIsolation.ok, detail: providerIsolation }
    ],
    recoveryChecks: [
      { name: 'white-label-package-exported-for-tenant-a', pass: fs.existsSync(path.join(exportA.outputDir, 'index.html')), detail: exportA.artifactReferences },
      { name: 'white-label-package-exported-for-tenant-b', pass: fs.existsSync(path.join(exportB.outputDir, 'index.html')), detail: exportB.artifactReferences }
    ],
    evidence: {
      tenants: [tenantA, tenantB],
      exports: [exportA.manifest, exportB.manifest],
      isolation: { brandIsolation, providerIsolation },
      summarySignals: summarizedA
    },
    artifactReferences: {
      operatorSurfaceFile: path.relative(config.rootDir, operatorSurfaceFile),
      tenantAExportManifest: exportA.artifactReferences.manifestFile,
      tenantBExportManifest: exportB.artifactReferences.manifestFile
    },
    smokeCommand: 'bash scripts/smoke-section55-skye-foundry.sh',
    modelVersion: versionStamp.modelVersion,
    runtimeVersion: versionStamp.runtimeVersion,
    directiveVersion: versionStamp.directiveVersion
  };

  const written = writeProofJson(proofFile, payload, config, 'workspace-proof-section55-skye-foundry.mjs');
  console.log(JSON.stringify(written, null, 2));
  if (!written.pass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
