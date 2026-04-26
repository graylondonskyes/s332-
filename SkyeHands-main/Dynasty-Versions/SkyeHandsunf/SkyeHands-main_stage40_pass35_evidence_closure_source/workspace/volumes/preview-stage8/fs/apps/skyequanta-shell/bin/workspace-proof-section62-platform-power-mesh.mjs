#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import { buildPlatformPowerMesh, queryPlatformPowerMesh, launchPlatformCapsule, getPlatformPowerMeshPaths } from '../lib/platform-power-mesh.mjs';

async function main() {
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section62-platform-power-mesh.mjs');
  const slug = 'skye-account-executive-commandhub-s0l26-0s';
  const output = buildPlatformPowerMesh(config, slug);
  const query = queryPlatformPowerMesh(config, 'music lead');
  const musicCapsule = output.power.capsules.find(item => item.name.includes('Skye-Music-Nexus'));
  const leadCapsule = output.power.capsules.find(item => item.name.includes('Lead'));
  const launch = await launchPlatformCapsule(config, slug, musicCapsule.capsuleId, { port: 8942 });
  const fetchResult = await fetch(launch.entryUrl).then(async response => ({ ok: response.ok, status: response.status, text: await response.text() }));
  await launch.stop();

  const paths = getPlatformPowerMeshPaths(config);
  const payload = {
    generatedAt: new Date().toISOString(),
    pass: true,
    checks: [
      assertCheck(output.power.capsuleCount >= 5, 'Build a deeper imported-platform power mesh that indexes nested branch-app capsules instead of stopping at top-level launch surfaces', { capsuleCount: output.power.capsuleCount }),
      assertCheck(output.power.envKeys.length > 0 && output.power.routeTargets.length > 0, 'Harvest env-example keys and route targets from imported platform depth so diligence can see runtime posture and navigable surface depth', { envKeys: output.power.envKeys.slice(0, 12), routeTargets: output.power.routeTargets.slice(0, 12) }),
      assertCheck(Boolean(musicCapsule && musicCapsule.launchable && leadCapsule), 'Expose searchable music and lead workflow capsules from AE CommandHub instead of leaving that depth buried in source only', { musicCapsule, leadCapsule }),
      assertCheck(query.length >= 2, 'Support business-intent search across imported platform depth so SkyeHands can locate nested capability capsules by intent, not just by filesystem browsing', { query }),
      assertCheck(fetchResult.ok && /Music Forge Studio|Skyes Over London LC/.test(fetchResult.text), 'Launch a nested imported-platform capsule from the power mesh and fetch it live as real proof instead of claiming nested launchability without a running surface', { launchUrl: launch.entryUrl, fetchResult: { ok: fetchResult.ok, status: fetchResult.status } }),
      assertCheck(fs.existsSync(paths.canonicalRegistryFile) && fs.existsSync(paths.runtimeRegistryFile), 'Write canonical and runtime power-mesh registries that deep scan and valuation lanes can inherit as evidence surfaces', { canonicalRegistryFile: path.relative(config.rootDir, paths.canonicalRegistryFile), runtimeRegistryFile: path.relative(config.rootDir, paths.runtimeRegistryFile) })
    ],
    evidence: {
      slug,
      powerFile: path.relative(config.rootDir, output.powerFile),
      capsuleCount: output.power.capsuleCount,
      launchableCapsuleCount: output.power.launchableCapsuleCount,
      sampleQueryResults: query,
      launchedCapsule: musicCapsule,
      fetchResult: { ok: fetchResult.ok, status: fetchResult.status }
    },
    smokeCommand: 'bash scripts/smoke-section62-platform-power-mesh.sh'
  };
  payload.pass = payload.checks.every(item => item.pass);
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_62_PLATFORM_POWER_MESH.json');
  const written = writeProofJson(proofFile, payload, config, 'workspace-proof-section62-platform-power-mesh.mjs');
  console.log(JSON.stringify(written, null, 2));
  if (!written.pass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
