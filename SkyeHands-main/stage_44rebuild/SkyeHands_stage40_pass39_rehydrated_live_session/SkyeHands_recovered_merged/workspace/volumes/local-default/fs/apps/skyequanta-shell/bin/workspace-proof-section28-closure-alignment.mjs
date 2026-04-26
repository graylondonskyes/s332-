import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { writeInvestorPacket } from '../lib/investor-packet.mjs';
import { writeReleaseStamp } from '../lib/release-stamp.mjs';
import { buildShipCandidatePackage } from '../lib/deployment-packaging.mjs';

function assertCheck(pass, message, detail = null) { return { pass: Boolean(pass), message, detail }; }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }

async function main() {
  const strict = process.argv.includes('--strict');
  const baseConfig = getStackConfig();
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section28-closure-alignment.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_28_CLOSURE_ALIGNMENT.json');

  const investorPacket = writeInvestorPacket(config.rootDir);
  const releaseStamp = writeReleaseStamp(config);
  const ship = buildShipCandidatePackage(config, { strict: false });
  const copiedStampPath = path.join(config.rootDir, ship.outputs.handoffDirectory, 'docs', 'VERSION_STAMP.json');
  const copiedClaimsPath = path.join(config.rootDir, ship.outputs.handoffDirectory, 'docs', 'CLAIMS_REGISTER.md');
  const copiedStamp = fs.existsSync(copiedStampPath) ? readJson(copiedStampPath) : null;
  const rootPackage = readJson(path.join(config.rootDir, 'package.json'));
  const shellPackage = readJson(path.join(config.shellDir, 'package.json'));

  const checks = [
    assertCheck(releaseStamp.releaseVersion === rootPackage.version && releaseStamp.releaseVersion === shellPackage.version, 'release stamp matches the root and shell package versions', { releaseStamp: releaseStamp.releaseVersion, root: rootPackage.version, shell: shellPackage.version }),
    assertCheck(fs.existsSync(investorPacket.files.versionStamp) && fs.existsSync(investorPacket.files.claimsRegister), 'packet docs include a version stamp and claims register for language alignment', investorPacket.files),
    assertCheck(Boolean(copiedStamp) && copiedStamp.releaseVersion === releaseStamp.releaseVersion, 'ship-candidate handoff bundle carries the same release stamp as the repo docs', { copiedStampPath, copiedVersion: copiedStamp?.releaseVersion, expected: releaseStamp.releaseVersion }),
    assertCheck(fs.existsSync(copiedClaimsPath), 'ship-candidate handoff bundle carries the claims register alongside the packet docs', { copiedClaimsPath }),
    assertCheck(ship.outputs.releaseStamp === 'docs/VERSION_STAMP.json' && ship.report?.outputs?.releaseStamp === 'docs/VERSION_STAMP.json', 'packaging outputs report the release stamp explicitly for closure gating', { outputs: ship.outputs, reportOutputs: ship.report?.outputs })
  ];

  let payload = {
    section: 28,
    label: 'section-28-closure-alignment',
    generatedAt: new Date().toISOString(),
    strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section28-closure-alignment.mjs --strict',
    pass: checks.every(item => item.pass),
    checks,
    evidence: {
      releaseStamp,
      shipOutputs: ship.outputs,
      investorPacketFiles: investorPacket.files,
      copiedStampPath,
      copiedClaimsPath
    }
  };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section28-closure-alignment.mjs');
  if (strict && !payload.pass) throw new Error('Section 28 closure alignment proof failed in strict mode.');
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
