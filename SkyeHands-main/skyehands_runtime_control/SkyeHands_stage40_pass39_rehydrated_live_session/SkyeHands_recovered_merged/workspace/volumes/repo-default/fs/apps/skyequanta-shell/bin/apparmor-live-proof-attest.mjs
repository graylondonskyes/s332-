#!/usr/bin/env node
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import fs from 'node:fs';

import { buildAppArmorLiveProofPack } from '../lib/apparmor-live-proof-pack.mjs';
import { createFixtureAppArmorHostProofReport, importAppArmorHostProof } from '../lib/apparmor-live-proof-attestation.mjs';

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function main() {
  const reportPath = getArg('--report');
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  const pack = buildAppArmorLiveProofPack(config.rootDir, { workspaceId: 'section45', label: 'apparmor-live-proof' });
  let effectiveReport = reportPath || path.join(pack.packDir, 'HOST_LIVE_PROOF_FIXTURE.json');
  if (!reportPath) {
    const fixtureReport = createFixtureAppArmorHostProofReport(pack.packDir);
    const fixtureFile = path.join(pack.packDir, 'HOST_LIVE_PROOF_FIXTURE.json');
    fs.writeFileSync(fixtureFile, `${JSON.stringify(fixtureReport, null, 2)}\n`, 'utf8');
    effectiveReport = fixtureFile;
  }
  const payload = importAppArmorHostProof(pack.packDir, effectiveReport, { rootDir: config.rootDir });
  console.log(JSON.stringify({
    ok: payload.ok,
    reason: payload.reason,
    outputDir: payload.outputDir,
    verificationFile: payload.verificationFile,
    attestationFile: payload.attestationFile,
    trustSurfaceFile: payload.trustSurfaceFile
  }, null, 2));
  process.exit(payload.ok ? 0 : 1);
}

main();
