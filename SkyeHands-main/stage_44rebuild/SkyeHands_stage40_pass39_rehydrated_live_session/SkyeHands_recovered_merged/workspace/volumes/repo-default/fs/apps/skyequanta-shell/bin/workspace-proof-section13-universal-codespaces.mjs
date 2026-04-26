import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { proofPass, readJson } from '../lib/proof-ledger.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function assertCheck(pass, message, detail = null) {
  return { pass: Boolean(pass), message, detail };
}

function currentArtifact(config, relativePath) {
  const absolutePath = path.join(config.rootDir, relativePath);
  return fs.existsSync(absolutePath) ? readJson(absolutePath) : null;
}

async function main() {
  const strict = process.argv.includes('--strict');
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section13-universal-codespaces.mjs');
  ensureRuntimeState(config);

  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_13_UNIVERSAL_CODESPACES_REPLACEMENT.json');

  const section4 = currentArtifact(config, 'docs/proof/SECTION_4_IDE_AGENT_CONVERGENCE.json');
  const stage10 = currentArtifact(config, 'docs/proof/STAGE_10_MULTI_WORKSPACE_STRESS.json');
  const stage11 = currentArtifact(config, 'docs/proof/STAGE_11_REGRESSION_PROOF.json');
  const section12 = currentArtifact(config, 'docs/proof/SECTION_12_NONEXPERT_OPERATOR_READY.json');
  const operatorGreen = currentArtifact(config, '.skyequanta/reports/OPERATOR_GREEN_LATEST.json');
  const masterLedger = currentArtifact(config, 'docs/proof/MASTER_PROOF_LEDGER.json');

  const checks = [
    assertCheck(proofPass(section4), 'IDE + agent convergence proof passes from the shell-owned authoritative surface', section4?.label || section4?.section),
    assertCheck(proofPass(stage10), 'multi-workspace remote-executor stress proof passes across concurrent workspace sessions', stage10?.label || stage10?.stage),
    assertCheck(proofPass(stage11), 'fresh regression proof passes across stages 1 through 10 inside the canonical smoke window', { generatedAt: stage11?.generatedAt, refreshRuns: stage11?.refreshRuns || [] }),
    assertCheck(proofPass(section12), 'non-expert operator-safe handoff proof passes with OPEN_ME_FIRST and support surfaces present', section12?.label || section12?.section),
    assertCheck(operatorGreen?.ok === true, 'canonical one-command operator-green lane passes from the public operator surface', operatorGreen?.generatedAt || null),
    assertCheck(Boolean(operatorGreen?.outputs?.handoffArchive) && Boolean(operatorGreen?.outputs?.supportDump), 'operator lane emits handoff archive and support dump from the same canonical path', operatorGreen?.outputs),
    assertCheck(Boolean(masterLedger?.pass), 'master proof ledger is fully green through stage 11', masterLedger?.entries),
    assertCheck(Array.isArray(masterLedger?.entries) && masterLedger.entries.every(entry => entry.pass), 'every canonical stage ledger entry is passing', masterLedger?.entries)
  ];

  let payload = {
    section: 13,
    label: 'section-13-universal-codespaces-replacement',
    generatedAt: new Date().toISOString(),
    strict,
    proofCommand: 'npm run workspace:proof:section13 -- --strict',
    smokeCommand: 'bash scripts/smoke-section13-universal-codespaces.sh',
    artifacts: {
      section4,
      stage10,
      stage11,
      section12,
      operatorGreen,
      masterProofLedger: masterLedger
    },
    checks,
    pass: checks.every(item => item.pass)
  };

  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section13-universal-codespaces.mjs');
  console.log(JSON.stringify(payload, null, 2));
  if (strict && !payload.pass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
