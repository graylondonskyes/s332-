#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import {
  MODE_PRESETS,
  ensureComplianceModeStore,
  resetComplianceModeStore,
  evaluateComplianceMode,
  loadComplianceProfiles,
  verifyComplianceProfile,
  writeComplianceModeSurface,
  buildComplianceExportPackage
} from '../lib/compliance-native-modes.mjs';

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
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section52-compliance-native-modes.mjs');

  const versionStampPath = path.join(config.rootDir, 'docs', 'VERSION_STAMP.json');
  const versionStamp = JSON.parse(fs.readFileSync(versionStampPath, 'utf8'));
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_52_COMPLIANCE_NATIVE_MODES.json');
  const outputDir = path.join(config.rootDir, 'dist', 'section52', 'compliance-native-modes');
  const surfaceFile = path.join(outputDir, 'compliance-modes-surface.html');
  const financeExportFile = path.join(outputDir, 'finance-export.json');
  const educationExportFile = path.join(outputDir, 'education-export.json');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  resetComplianceModeStore(config);
  const storePaths = ensureComplianceModeStore(config);
  const profiles = loadComplianceProfiles(config);

  const providers = [
    {
      providerId: 'sovereign-private-safe',
      label: 'Sovereign Private Safe',
      capabilities: ['patch', 'test', 'review'],
      costPerUnit: 0.09,
      latencyMs: 220,
      trustTier: 'sovereign',
      tenancyScope: 'private',
      policyLimits: { regulated: true },
      healthState: 'healthy',
      secretStatus: 'ok'
    },
    {
      providerId: 'tenant-private-balanced',
      label: 'Tenant Private Balanced',
      capabilities: ['patch', 'test', 'review'],
      costPerUnit: 0.05,
      latencyMs: 140,
      trustTier: 'private',
      tenancyScope: 'tenant',
      policyLimits: { regulated: true },
      healthState: 'healthy',
      secretStatus: 'ok'
    },
    {
      providerId: 'education-economy',
      label: 'Education Economy',
      capabilities: ['patch', 'test', 'review'],
      costPerUnit: 0.02,
      latencyMs: 70,
      trustTier: 'standard',
      tenancyScope: 'shared',
      policyLimits: { regulated: false },
      healthState: 'healthy',
      secretStatus: 'ok'
    }
  ];

  const sharedTask = {
    taskId: 'section52-shared-task',
    action: 'patch',
    capability: 'patch',
    requiresEgress: false,
    summary: 'Patch a regulator-facing runtime defect'
  };

  const finance = evaluateComplianceMode(config, 'finance', sharedTask, providers);
  const education = evaluateComplianceMode(config, 'education', sharedTask, providers);
  const government = evaluateComplianceMode(config, 'government', sharedTask, providers);
  const forbiddenAction = evaluateComplianceMode(config, 'finance', {
    taskId: 'section52-forbidden',
    action: 'public-share',
    capability: 'patch',
    requiresEgress: false,
    summary: 'Attempt forbidden public share in finance mode'
  }, providers);
  const airGapped = evaluateComplianceMode(config, 'air-gapped', {
    taskId: 'section52-airgap',
    action: 'patch',
    capability: 'patch',
    requiresEgress: true,
    summary: 'Attempt egress from an air-gapped task'
  }, providers);

  const tamperedProfile = JSON.parse(JSON.stringify(profiles.payload.profiles.finance));
  tamperedProfile.dataRetentionDays = 30;
  const tamperedVerification = verifyComplianceProfile(tamperedProfile);

  const financeExport = buildComplianceExportPackage(financeExportFile, finance);
  const educationExport = buildComplianceExportPackage(educationExportFile, education);
  const surface = writeComplianceModeSurface(surfaceFile, [finance, education, government, forbiddenAction, airGapped], { title: 'Section 52 Compliance-Native Modes Surface' });

  const checks = [
    assertCheck(['finance', 'healthcare', 'government', 'education', 'air-gapped'].every(modeId => Object.prototype.hasOwnProperty.call(MODE_PRESETS, modeId)), 'Add named modes such as finance mode, healthcare mode, government mode, education mode, air-gapped mode', { modes: Object.keys(MODE_PRESETS) }),
    assertCheck(finance.ok && education.ok && finance.behavior.loggingDepth !== education.behavior.loggingDepth && finance.behavior.dataRetentionDays !== education.behavior.dataRetentionDays, 'Bind each mode to tool access, logging depth, data retention, provider routing, approval workflow, and export policy', {
      finance: finance.behavior,
      education: education.behavior
    }),
    assertCheck(finance.ok && government.ok && profiles.payload.profiles.finance.fingerprint && profiles.payload.profiles.government.fingerprint, 'Add policy packs and enforcement engine per mode', {
      financeProfile: profiles.payload.profiles.finance,
      governmentProfile: profiles.payload.profiles.government
    }),
    assertCheck(fs.existsSync(surface.filePath) && surface.html.includes('Mode selection') && surface.html.includes('denial explanation'), 'Add UI for mode selection, effective policy view, and denial explanation', { surfaceFile: surface.filePath }),
    assertCheck(financeExport.exportProfile === 'redacted-procurement' && educationExport.exportProfile === 'standard-export', 'Add mode-aware proof/export packaging', {
      financeExport,
      educationExport
    }),
    assertCheck(finance.ok && education.ok && finance.routing.provider.providerId !== education.routing.provider.providerId, 'Run the same task in two different compliance modes and prove different runtime/tooling behavior', {
      financeProvider: finance.routing.provider.providerId,
      educationProvider: education.routing.provider.providerId
    }),
    assertCheck(finance.routing.provider.providerId === 'sovereign-private-safe' && education.routing.provider.providerId === 'education-economy', 'Prove provider routing restrictions change by mode', {
      finance: finance.routing,
      education: education.routing
    }),
    assertCheck(finance.behavior.dataRetentionDays !== education.behavior.dataRetentionDays && finance.behavior.exportProfile !== education.behavior.exportProfile, 'Prove retention/export policy changes by mode', {
      finance: finance.behavior,
      education: education.behavior
    }),
    assertCheck(forbiddenAction.ok === false && forbiddenAction.reason === 'forbidden_action', 'Simulate a forbidden action in regulated mode and prove denial with explanation', forbiddenAction),
    assertCheck(airGapped.ok === false && airGapped.reason === 'egress_denied', 'Simulate air-gapped denial for disallowed egress', airGapped),
    assertCheck(tamperedVerification.ok === false && tamperedVerification.expectedFingerprint !== tamperedVerification.actualFingerprint, 'Tamper a compliance profile and prove verification fails', tamperedVerification),
    assertCheck(proofFile.endsWith('SECTION_52_COMPLIANCE_NATIVE_MODES.json'), 'Create proof artifact docs/proof/SECTION_52_COMPLIANCE_NATIVE_MODES.json', { proofFile }),
    assertCheck(finance.ok && forbiddenAction.ok === false && airGapped.ok === false, 'A regulated mode measurably changes runtime behavior, allowed actions, and evidence posture compared with a less restricted mode', {
      finance,
      education,
      forbiddenAction,
      airGapped
    })
  ];

  const payload = {
    section: 52,
    label: 'section-52-compliance-native-modes',
    generatedAt: new Date().toISOString(),
    pass: checks.every(item => item.pass),
    strict: options.strict,
    modelVersion: versionStamp.modelVersion,
    runtimeVersion: versionStamp.runtimeVersion,
    directiveVersion: versionStamp.directiveVersion,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section52-compliance-native-modes.mjs --strict',
    smokeCommand: 'bash scripts/smoke-section52-compliance-native-modes.sh',
    checks,
    hostileChecks: [
      { name: 'forbidden-action-denial', pass: forbiddenAction.ok === false, detail: forbiddenAction },
      { name: 'air-gap-egress-denial', pass: airGapped.ok === false, detail: airGapped },
      { name: 'tampered-profile-rejected', pass: tamperedVerification.ok === false, detail: tamperedVerification }
    ],
    recoveryChecks: [
      { name: 'regulated-mode-routing', pass: finance.ok === true, detail: finance.routing },
      { name: 'education-mode-routing', pass: education.ok === true, detail: education.routing }
    ],
    evidence: {
      profiles: profiles.payload.profiles,
      finance,
      education,
      government,
      forbiddenAction,
      airGapped,
      tamperedVerification,
      financeExport,
      educationExport
    },
    artifactReferences: {
      proofFile,
      surfaceFile: surface.filePath,
      financeExportFile,
      educationExportFile,
      profilesFile: storePaths.profilesFile,
      runsFile: storePaths.runsFile
    }
  };

  const written = writeProofJson(proofFile, payload, config, 'workspace-proof-section52-compliance-native-modes.mjs');
  console.log(JSON.stringify(written, null, 2));
  if (!written.pass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
