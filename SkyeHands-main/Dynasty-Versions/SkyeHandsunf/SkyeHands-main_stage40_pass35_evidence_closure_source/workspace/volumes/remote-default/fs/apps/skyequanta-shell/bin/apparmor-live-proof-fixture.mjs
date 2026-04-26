#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { buildAppArmorLiveProofPack } from '../lib/apparmor-live-proof-pack.mjs';
import { createFixtureAppArmorHostProofReport } from '../lib/apparmor-live-proof-attestation.mjs';

function main() {
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  const pack = buildAppArmorLiveProofPack(config.rootDir, { workspaceId: 'section45', label: 'apparmor-live-proof' });
  const report = createFixtureAppArmorHostProofReport(pack.packDir);
  const outputFile = path.join(pack.packDir, 'HOST_LIVE_PROOF_FIXTURE.json');
  fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, outputFile, reportId: report.reportId, manifestHash: report.manifestHash }, null, 2));
}

main();
