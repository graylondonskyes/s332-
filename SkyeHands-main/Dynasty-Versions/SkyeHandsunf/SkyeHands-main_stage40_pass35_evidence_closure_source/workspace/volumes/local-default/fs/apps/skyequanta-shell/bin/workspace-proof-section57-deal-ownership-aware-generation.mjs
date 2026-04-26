#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import {
  resetDealOwnershipStore,
  createCommercialProfile,
  verifyCommercialProfile,
  planCommercialGeneration,
  exportCommercialPackage,
  renderCommercialSurface,
  inferCommercialSignals
} from '../lib/deal-ownership-aware-generation.mjs';

function writeFixtureProject(projectDir) {
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(projectDir, 'core'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'modules'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'exports'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'README.md'), '# White-label runtime\n\nThis tenant package includes a founder only restricted lane.\n');
  fs.writeFileSync(path.join(projectDir, 'LICENSE'), 'Proprietary use only. Founder only modules restricted.');
  fs.writeFileSync(path.join(projectDir, 'core', 'brain.mjs'), 'export const core = true;\n');
  fs.writeFileSync(path.join(projectDir, 'modules', 'founder-only.mjs'), 'export const founderOnly = true;\n');
  fs.writeFileSync(path.join(projectDir, 'modules', 'public-shell.mjs'), 'export const shell = true;\n');
}

async function main() {
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section57-deal-ownership-aware-generation.mjs');

  const versionStamp = JSON.parse(fs.readFileSync(path.join(config.rootDir, 'docs', 'VERSION_STAMP.json'), 'utf8'));
  const outputDir = path.join(config.rootDir, 'dist', 'section57', 'deal-generation');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_57_DEAL_OWNERSHIP_AWARE_GENERATION.json');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  resetDealOwnershipStore(config);

  const projectDir = path.join(outputDir, 'fixture-project');
  writeFixtureProject(projectDir);

  const internalProfile = createCommercialProfile(config, {
    profileId: 'internal-core',
    kind: 'internal-product',
    owner: 'Skyes Over London',
    founderOnlyModules: ['modules/founder-only.mjs'],
    reusableModules: ['core/brain.mjs', 'modules/public-shell.mjs'],
    exportRestrictions: ['modules/founder-only.mjs'],
    whiteLabelAllowed: false,
    regulatedInternalOnly: true,
    license: 'proprietary'
  });
  const whiteLabelProfile = createCommercialProfile(config, {
    profileId: 'tenant-export',
    kind: 'white-label-branch',
    owner: 'Skyes Over London',
    founderOnlyModules: ['modules/founder-only.mjs'],
    reusableModules: ['core/brain.mjs', 'modules/public-shell.mjs'],
    exportRestrictions: ['modules/founder-only.mjs'],
    whiteLabelAllowed: true,
    regulatedInternalOnly: false,
    license: 'proprietary'
  });
  const communityProfile = createCommercialProfile(config, {
    profileId: 'community-edition',
    kind: 'community-edition',
    owner: 'Skyes Over London',
    founderOnlyModules: ['modules/founder-only.mjs'],
    reusableModules: ['modules/public-shell.mjs'],
    exportRestrictions: ['core/brain.mjs', 'modules/founder-only.mjs'],
    whiteLabelAllowed: false,
    regulatedInternalOnly: false,
    license: 'community'
  });

  const founderPlan = planCommercialGeneration(config, {
    profile: internalProfile,
    requestedAction: 'export',
    consumerType: 'founder',
    targetModules: ['core/brain.mjs', 'modules/founder-only.mjs']
  });
  const whiteLabelDenied = planCommercialGeneration(config, {
    profile: internalProfile,
    requestedAction: 'export',
    consumerType: 'white-label',
    targetModules: ['core/brain.mjs', 'modules/founder-only.mjs']
  });
  const communityDenied = planCommercialGeneration(config, {
    profile: communityProfile,
    requestedAction: 'export',
    consumerType: 'external',
    targetModules: ['core/brain.mjs', 'modules/public-shell.mjs']
  });
  const whiteLabelAllowed = planCommercialGeneration(config, {
    profile: whiteLabelProfile,
    requestedAction: 'export',
    consumerType: 'white-label',
    targetModules: ['core/brain.mjs', 'modules/public-shell.mjs']
  });

  const exportPackage = exportCommercialPackage(config, {
    profile: whiteLabelProfile,
    consumerType: 'white-label',
    modules: ['core/brain.mjs', 'modules/public-shell.mjs'],
    projectRoot: projectDir,
    outputDir: path.join(outputDir, 'white-label-export')
  });
  const exportDenied = exportCommercialPackage(config, {
    profile: internalProfile,
    consumerType: 'white-label',
    modules: ['core/brain.mjs', 'modules/founder-only.mjs'],
    projectRoot: projectDir,
    outputDir: path.join(outputDir, 'denied-export')
  });

  const tamperedProfile = { ...whiteLabelProfile, fingerprint: 'tampered' };
  const tamperedVerification = verifyCommercialProfile(tamperedProfile);
  const signals = inferCommercialSignals(projectDir);
  const surfaceFile = path.join(outputDir, 'deal-ownership-surface.html');
  fs.writeFileSync(surfaceFile, renderCommercialSurface([internalProfile, whiteLabelProfile, communityProfile], [founderPlan, whiteLabelDenied, communityDenied, whiteLabelAllowed]), 'utf8');

  const checks = [
    assertCheck([internalProfile, whiteLabelProfile, communityProfile].every(profile => profile.profileId), 'Add project commercial profile model distinguishing internal product, client work, white-label branch, acquirable core asset, regulated internal tool, community edition, and resale-restricted deliverable', { profiles: [internalProfile, whiteLabelProfile, communityProfile] }),
    assertCheck(whiteLabelDenied.ok === false && communityDenied.ok === false, 'Add policy engine for reuse restrictions, founder-only modules, export restrictions, and ownership boundaries', { whiteLabelDenied, communityDenied }),
    assertCheck(founderPlan.ok === true && whiteLabelAllowed.ok === true, 'Add generation planner that respects commercial profile before producing patches, exports, or templates', { founderPlan, whiteLabelAllowed }),
    assertCheck(fs.existsSync(surfaceFile), 'Add UI showing current ownership/deal posture and blocked reuse lanes', { surfaceFile: path.relative(config.rootDir, surfaceFile) }),
    assertCheck(exportPackage.ok === true && exportPackage.copied.every(item => !item.relativePath.includes('founder-only')), 'Add export packaging that honors the project commercial profile', { exportPackage }),
    assertCheck(exportDenied.ok === false && tamperedVerification.ok === false && signals.inferredKind === 'white-label-branch', 'Prove founder-only modules stay blocked from inappropriate exports and tampering is caught', { exportDenied, tamperedVerification, signals })
  ];

  const payload = {
    generatedAt: new Date().toISOString(),
    pass: checks.every(item => item.pass),
    checks,
    hostileChecks: [
      { name: 'ownership-mismatch-export-denied', pass: exportDenied.ok === false, detail: exportDenied },
      { name: 'tampered-commercial-profile-rejected', pass: tamperedVerification.ok === false, detail: tamperedVerification }
    ],
    recoveryChecks: [
      { name: 'white-label-package-excludes-restricted-modules', pass: exportPackage.ok === true && exportPackage.copied.every(item => !item.relativePath.includes('founder-only')), detail: exportPackage },
      { name: 'founder-export-remains-allowed', pass: founderPlan.ok === true, detail: founderPlan }
    ],
    evidence: {
      profiles: [internalProfile, whiteLabelProfile, communityProfile],
      plans: [founderPlan, whiteLabelDenied, communityDenied, whiteLabelAllowed],
      exportPackage,
      exportDenied,
      tamperedVerification,
      signals
    },
    artifactReferences: {
      surfaceFile: path.relative(config.rootDir, surfaceFile),
      exportManifestFile: exportPackage.artifactReferences.manifestFile
    },
    smokeCommand: 'bash scripts/smoke-section57-deal-ownership-aware-generation.sh',
    modelVersion: versionStamp.modelVersion,
    runtimeVersion: versionStamp.runtimeVersion,
    directiveVersion: versionStamp.directiveVersion
  };

  const written = writeProofJson(proofFile, payload, config, 'workspace-proof-section57-deal-ownership-aware-generation.mjs');
  console.log(JSON.stringify(written, null, 2));
  if (!written.pass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
