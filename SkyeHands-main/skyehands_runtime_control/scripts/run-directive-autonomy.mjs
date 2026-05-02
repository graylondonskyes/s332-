#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..', '..');
const RESULTS_FILE = path.join(REPO_ROOT, 'CODEX_AUTONOMY_RESULTS.md');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', shell: false });
  return {
    cmd: `${cmd} ${args.join(' ')}`,
    code: r.status ?? 1,
    out: (r.stdout || '').trim(),
    err: (r.stderr || '').trim(),
  };
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch {
    return {};
  }
}

function summarizeFailure(output, fallback) {
  const text = `${output.err}\n${output.out}`.trim();
  const lines = text
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((line) => !/^npm warn /i.test(line));
  const preferred = lines.find((line) =>
    /(NOT FOUND|FAILED|ModuleNotFoundError|resolvedTheiaCli|NOT INSTALLED|proxy|403|Action required)/i.test(line)
  );
  if (preferred) return preferred;
  const nonNoise = lines.find((line) => !/^npm warn /i.test(line));
  return nonNoise || fallback;
}

function missingFlags(proof, flags) {
  return flags.filter((flag) => proof?.[flag] !== true);
}

function main() {
  const checks = {
    busSmoke: run('npm', ['run', 'smoke:platform-bus-bridge']),
    legacyQuarantineSmoke: run('npm', ['run', 'smoke:legacy-checkmark-quarantine']),
    providerValidationSmoke: run('npm', ['run', 'smoke:provider-validation']),
    theiaRuntimeSmoke: run('npm', ['run', 'theia:smoke']),
    openhandsRuntimeSmoke: run('npm', ['run', 'openhands:smoke']),
    runtimeBlockers: run('npm', ['run', 'runtime:blockers']),
    graychunks: run('npm', ['run', 'graychunks:report']),
    releaseGate: run('npm', ['run', 'directive:release-gate']),
    theiaInstallProof: run('npm', ['run', 'theia:install-proof']),
    openhandsInstallProof: run('npm', ['run', 'openhands:install-proof']),
  };
  const theiaProof = readJson('platform/ide-core/runtime-proof.json');
  const openhandsProof = readJson('platform/agent-core/runtime-proof.json');
  const readiness = readJson('CODE_READINESS_MATRIX.json');
  const appointmentRow = (readiness.platforms || []).find((p) => p.id === 'appointment-setter') || {};
  const printfulRow = (readiness.platforms || []).find((p) => p.id === 'printful-commerce') || {};

  const artifacts = {
    bridgeProof: exists('.skyequanta/proofs/platform-bus-bridge-smoke.json'),
    legacyQuarantineProof: exists('.skyequanta/proofs/legacy-checkmark-quarantine-smoke.json'),
    providerValidationProof: exists('.skyequanta/proofs/provider-validation-smoke.json'),
    runtimeBlockersReport: exists('RUNTIME_BLOCKERS_REPORT.md'),
    aeTaskLedger: exists('.skyequanta/ae-productization-tasks.ndjson'),
    busAudit: exists('.skyequanta/bus-audit.ndjson'),
    readinessMd: exists('CODE_READINESS_MATRIX.md'),
    readinessJson: exists('CODE_READINESS_MATRIX.json'),
    claimsJson: exists('CLAIMS_TO_SMOKE_MAP.json'),
    releaseGateJson: exists('DIRECTIVE_RELEASE_GATE_REPORT.json'),
    donorProof: exists('EXISTING_DONOR_LANE_PROOF.md'),
    proofBundleSchema: exists('PROOF_BUNDLE_MANIFEST.schema.json'),
    legacyReport: exists('LEGACY_CHECKMARK_REVALIDATION_REPORT.md'),
    downgradeReport: exists('DIRECTIVE_DOWNGRADE_REPORT.md'),
  };

  const lines = [];
  lines.push('# CODEX AUTONOMY RESULTS');
  lines.push('');
  lines.push(`_As-of: ${new Date().toISOString().slice(0, 10)} (UTC)_`);
  lines.push('');
  lines.push('## Verified completed this run');
  lines.push(`- ${checks.busSmoke.code === 0 ? '✅' : '☐'} Execute platform-bus bridge smoke command.`);
  lines.push(`- ${checks.legacyQuarantineSmoke.code === 0 ? '✅' : '☐'} Execute legacy-checkmark quarantine smoke command.`);
  lines.push(`- ${checks.providerValidationSmoke.code === 0 ? '✅' : '☐'} Execute provider validation smoke command.`);
  lines.push(`- ${checks.theiaRuntimeSmoke.code === 0 ? '✅' : '☐'} Execute Theia runtime smoke command.`);
  lines.push(`- ${checks.openhandsRuntimeSmoke.code === 0 ? '✅' : '☐'} Execute OpenHands runtime smoke command.`);
  lines.push(`- ${checks.runtimeBlockers.code === 0 ? '✅' : '☐'} Generate runtime blockers report command.`);
  lines.push(`- ${artifacts.bridgeProof ? '✅' : '☐'} Generate bridge smoke proof artifact.`);
  lines.push(`- ${artifacts.legacyQuarantineProof ? '✅' : '☐'} Generate legacy-checkmark quarantine proof artifact.`);
  lines.push(`- ${artifacts.providerValidationProof ? '✅' : '☐'} Generate provider validation smoke proof artifact.`);
  lines.push(`- ${artifacts.runtimeBlockersReport ? '✅' : '☐'} Generate runtime blockers report artifact.`);
  lines.push(`- ${artifacts.aeTaskLedger ? '✅' : '☐'} Generate AE productization task ledger evidence.`);
  lines.push(`- ${artifacts.busAudit ? '✅' : '☐'} Generate bus audit ledger evidence.`);
  lines.push(`- ${checks.graychunks.code === 0 ? '✅' : '☐'} Execute GrayChunks readiness report.`);
  lines.push(`- ${artifacts.readinessMd && artifacts.readinessJson && artifacts.claimsJson ? '✅' : '☐'} Generate readiness and claims artifacts.`);
  lines.push(`- ${checks.releaseGate.code === 0 ? '✅' : '☐'} Execute directive release gate.`);
  lines.push(`- ${artifacts.releaseGateJson ? '✅' : '☐'} Generate release gate report artifact.`);
  lines.push('');
  lines.push('## Directive status (code-backed)');
  lines.push(`- ${artifacts.donorProof ? '✅' : '☐'} Add generated EXISTING_DONOR_LANE_PROOF.md.`);
  lines.push(`- ${artifacts.proofBundleSchema ? '✅' : '☐'} Add PROOF_BUNDLE_MANIFEST.schema.json.`);
  lines.push(`- ${artifacts.legacyReport ? '✅' : '☐'} Add LEGACY_CHECKMARK_REVALIDATION_REPORT.md.`);
  lines.push(`- ${artifacts.downgradeReport ? '✅' : '☐'} Add DIRECTIVE_DOWNGRADE_REPORT.md.`);
  lines.push(`- ${artifacts.runtimeBlockersReport ? '✅' : '☐'} Add RUNTIME_BLOCKERS_REPORT.md with exact Theia/OpenHands actions.`);
  lines.push(`- ${checks.legacyQuarantineSmoke.code === 0 ? '✅' : '☐'} Add smoke proving stale structural-only legacy checkmarks are quarantined.`);
  lines.push(`- ${checks.providerValidationSmoke.code === 0 ? '✅' : '☐'} Add smoke proving provider validation reports blocked states when env vars are missing.`);
  lines.push(`- ${checks.busSmoke.code === 0 ? '✅' : '☐'} Add bridge smoke proving app.generated -> AE -> productization task -> audit ledger.`);

  const theiaReady = theiaProof.installReady === true;
  const openhandsReady = openhandsProof.installReady === true;
  const theiaMissingFlags = missingFlags(theiaProof, [
    'resolvedTheiaCli',
    'backendLaunches',
    'browserLaunches',
    'workspaceOpens',
    'fileSave',
    'terminalCommand',
    'previewOutput',
  ]);
  const openhandsMissingFlags = missingFlags(openhandsProof, [
    'packageImportable',
    'serverLaunches',
    'taskReceived',
    'workspaceFileSeen',
    'fileEditedOrGenerated',
    'commandOrTestRun',
    'resultReturnedToSkyeHands',
  ]);
  const fullTheiaRuntime = theiaProof.fullTheiaRuntime === true && theiaMissingFlags.length === 0;
  const fullOpenHandsRuntime = openhandsProof.fullOpenHandsRuntime === true && openhandsMissingFlags.length === 0;
  const theiaBlocker = theiaProof.installBlockedReason || summarizeFailure(checks.theiaInstallProof, 'Theia install proof failed.');
  const openhandsBlocker = openhandsProof.installBlockedReason || summarizeFailure(checks.openhandsInstallProof, 'OpenHands install proof failed.');
  const theiaRuntimeBlocker = summarizeFailure(checks.theiaRuntimeSmoke, 'Theia runtime smoke failed.');
  const openhandsRuntimeBlocker = summarizeFailure(checks.openhandsRuntimeSmoke, 'OpenHands runtime smoke failed.');

  lines.push(`- ${theiaReady ? '✅' : '☐'} Prove Theia install lane end-to-end${theiaReady ? '.' : ` — blocker: ${theiaBlocker}`}`);
  lines.push(`- ${openhandsReady ? '✅' : '☐'} Prove OpenHands install lane end-to-end${openhandsReady ? '.' : ` — blocker: ${openhandsBlocker}`}`);
  lines.push(`- ${fullTheiaRuntime ? '✅' : '☐'} Set fullTheiaRuntime: true via behavioral smoke${fullTheiaRuntime ? '.' : ` — blocker: missing runtime flags [${theiaMissingFlags.join(', ') || 'unknown'}]; latest smoke: ${theiaRuntimeBlocker}`}`);
  lines.push(`- ${fullOpenHandsRuntime ? '✅' : '☐'} Set fullOpenHandsRuntime: true via behavioral smoke${fullOpenHandsRuntime ? '.' : ` — blocker: missing runtime flags [${openhandsMissingFlags.join(', ') || 'unknown'}]; latest smoke: ${openhandsRuntimeBlocker}`}`);
  lines.push(`- ☐ Complete autonomous codespace end-to-end gate — blocker: workspace lifecycle + IDE + agent + deploy parity is not fully behaviorally proven.`);
  lines.push(`- ☐ Complete AE independent brain mesh end-to-end gate — blocker: full gate evidence for all 13 brains is not behaviorally proven in this run.`);
  lines.push(`- ☐ Complete appointment setter backend gate — blocker: lane grade is ${appointmentRow.grade || 'UNKNOWN'} in generated readiness matrix.`);
  lines.push(`- ☐ Complete printful full backend gate — blocker: lane grade is ${printfulRow.grade || 'UNKNOWN'} in generated readiness matrix.`);
  lines.push('');
  lines.push('## Current blockers summary');
  lines.push(`- ${theiaReady ? '✅' : '☐'} Theia install proof blocker captured.`);
  lines.push(`- ${openhandsReady ? '✅' : '☐'} OpenHands install proof blocker captured.`);
  lines.push(`- ${fullTheiaRuntime && fullOpenHandsRuntime ? '✅' : '☐'} Runtime parity smoke flags for Theia/OpenHands are fully proven.`);
  lines.push(`- ☐ Remaining large platform gates require additional implementation and smoke evidence.`);

  fs.writeFileSync(RESULTS_FILE, `${lines.join('\n')}\n`);
  console.log(`Wrote ${RESULTS_FILE}`);

  if (checks.busSmoke.code !== 0 || checks.legacyQuarantineSmoke.code !== 0 || checks.providerValidationSmoke.code !== 0 || checks.runtimeBlockers.code !== 0 || checks.graychunks.code !== 0 || checks.releaseGate.code !== 0) {
    process.exit(1);
  }
}

main();
