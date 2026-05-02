import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { buildMasterProofLedger, CANONICAL_STAGE_SPECS, collectProofHashes, proofPass, readJson, writeJson } from '../lib/proof-ledger.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function assertCheck(condition, message, detail = null) {
  return { pass: Boolean(condition), message, detail };
}

function parseFreshWindowMinutes(argv) {
  const index = argv.findIndex(item => item === '--fresh-window-minutes');
  if (index === -1) return 45;
  const value = Number.parseInt(argv[index + 1] || '45', 10);
  return Number.isFinite(value) && value > 0 ? value : 45;
}

function minutesSince(isoString) {
  const millis = Date.now() - new Date(isoString || 0).getTime();
  return millis / 60000;
}

function getNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

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

function runProofCommand(config, spec) {
  const command = getNpmCommand();
  const commandArgs = ['run', spec.scriptName, '--', '--strict'];
  const result = spawnSync(command, commandArgs, {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024
  });
  return {
    command: ['npm', ...commandArgs].join(' '),
    status: result.status,
    signal: result.signal,
    pass: result.status === 0 && !result.error,
    payload: parseJsonFromMixedOutput(result.stdout),
    stdoutTail: String(result.stdout || '').split(/\r?\n/).filter(Boolean).slice(-20),
    stderrTail: String(result.stderr || '').split(/\r?\n/).filter(Boolean).slice(-20),
    error: result.error ? String(result.error) : null
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const strict = argv.includes('--strict');
  const freshWindowMinutes = parseFreshWindowMinutes(argv);
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-stage11.mjs');
  ensureRuntimeState(config);

  const stage11Artifact = path.join(config.rootDir, 'docs', 'proof', 'STAGE_11_REGRESSION_PROOF.json');
  const ledgerFile = path.join(config.rootDir, 'docs', 'proof', 'MASTER_PROOF_LEDGER.json');
  const hashFile = path.join(config.rootDir, 'docs', 'proof', 'PROOF_ARTIFACT_HASHES.json');

  const priorStages = CANONICAL_STAGE_SPECS
    .filter(spec => spec.stageKey !== '11')
    .map(spec => ({
      ...spec,
      scriptName: spec.command.replace(/^npm run\s+/, '').replace(/\s+--\s+--strict$/, '')
    }));

  const refreshRuns = [];
  const regressionRuns = priorStages.map(spec => {
    const filePath = path.join(config.rootDir, spec.artifact);
    let payload = fs.existsSync(filePath) ? readJson(filePath) : null;
    let pass = proofPass(payload);
    let ageMinutes = payload?.generatedAt ? minutesSince(payload.generatedAt) : null;
    let fresh = typeof ageMinutes === 'number' ? ageMinutes <= freshWindowMinutes : false;
    const shouldRefresh = strict && (!pass || !fresh);
    let refreshResult = null;

    if (shouldRefresh) {
      refreshResult = runProofCommand(config, spec);
      payload = fs.existsSync(filePath) ? readJson(filePath) : (refreshResult.payload || null);
      pass = proofPass(payload);
      ageMinutes = payload?.generatedAt ? minutesSince(payload.generatedAt) : null;
      fresh = typeof ageMinutes === 'number' ? ageMinutes <= freshWindowMinutes : false;
      refreshRuns.push({
        stage: spec.stageKey,
        artifactPath: spec.artifact,
        refreshedBecause: { missing: !payload, failing: !pass, stale: !fresh },
        refreshResult
      });
    }

    return {
      stage: spec.stageKey,
      command: spec.command,
      artifactPath: spec.artifact,
      artifactGeneratedAt: payload?.generatedAt || null,
      artifactPass: pass,
      freshWindowMinutes,
      artifactAgeMinutes: ageMinutes,
      fresh,
      refreshed: shouldRefresh,
      refreshCommand: shouldRefresh ? spec.command : null
    };
  });

  const preliminaryChecks = regressionRuns.map(run => assertCheck(
    run.artifactPass && run.fresh,
    `stage ${run.stage} proof artifact is passing and freshly rerun inside the regression smoke window`,
    run
  ));

  const preliminaryPayload = {
    stage: 11,
    label: 'stage-11-regression-proof',
    strict,
    generatedAt: new Date().toISOString(),
    proofCommand: 'npm run workspace:proof:stage11 -- --strict',
    smokeCommand: 'bash scripts/smoke-proof-regression.sh',
    freshWindowMinutes,
    canonicalRuntimePath: 'apps/skyequanta-shell/bin/launch.mjs',
    regressionCommands: priorStages.map(item => item.command),
    regressionRuns,
    refreshRuns,
    checks: preliminaryChecks,
    pass: preliminaryChecks.every(item => item.pass),
    outputs: {
      masterProofLedger: path.relative(config.rootDir, ledgerFile),
      proofArtifactHashes: path.relative(config.rootDir, hashFile)
    }
  };
  writeProofJson(stage11Artifact, preliminaryPayload, config, 'workspace-proof-stage11.mjs');

  const proofHashes = collectProofHashes(config.rootDir);
  writeJson(hashFile, {
    generatedAt: new Date().toISOString(),
    algorithm: 'sha256',
    source: 'docs/proof/*.json',
    items: proofHashes,
    pass: proofHashes.every(item => typeof item.sha256 === 'string' && item.sha256.length === 64)
  });

  const ledger = buildMasterProofLedger(config.rootDir, {
    stage11Artifact: path.relative(config.rootDir, stage11Artifact),
    proofArtifactHashesFile: path.relative(config.rootDir, hashFile),
    regressionCommands: priorStages.map(item => item.command),
    freshWindowMinutes,
    refreshRuns
  });
  writeJson(ledgerFile, ledger);

  const finalHashes = collectProofHashes(config.rootDir);
  const finalChecks = [
    ...preliminaryChecks,
    assertCheck(fs.existsSync(ledgerFile), 'master proof ledger was written to docs/proof/MASTER_PROOF_LEDGER.json', { artifactPath: path.relative(config.rootDir, ledgerFile) }),
    assertCheck(fs.existsSync(hashFile), 'proof artifact hashing output was written to docs/proof/PROOF_ARTIFACT_HASHES.json', { artifactPath: path.relative(config.rootDir, hashFile) }),
    assertCheck(finalHashes.some(item => item.file == 'docs/proof/STAGE_11_REGRESSION_PROOF.json' && item.sha256), 'stage 11 proof artifact is hashed alongside the rest of the proof set', { hashFile: path.relative(config.rootDir, hashFile) }),
    assertCheck(ledger.entries.every(entry => entry.pass), 'master proof ledger is fully green through stage 11 after required auto-refresh runs', ledger.entries)
  ];

  let finalPayload = {
    ...preliminaryPayload,
    generatedAt: new Date().toISOString(),
    checks: finalChecks,
    pass: finalChecks.every(item => item.pass),
    artifacts: {
      masterProofLedger: readJson(ledgerFile),
      proofArtifactHashes: readJson(hashFile)
    }
  };
  finalPayload = writeProofJson(stage11Artifact, finalPayload, config, 'workspace-proof-stage11.mjs');

  console.log(JSON.stringify(finalPayload, null, 2));
  if (strict && !finalPayload.pass) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
