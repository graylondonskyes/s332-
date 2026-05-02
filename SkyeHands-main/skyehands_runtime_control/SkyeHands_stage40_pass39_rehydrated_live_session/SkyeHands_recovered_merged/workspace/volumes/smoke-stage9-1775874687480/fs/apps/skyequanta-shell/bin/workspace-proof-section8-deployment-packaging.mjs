import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { parseJsonFromMixedOutput } from '../lib/deployment-packaging.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

function ensureDirectory(dirPath) { fs.mkdirSync(dirPath, { recursive: true }); }
function writeJson(filePath, payload) { ensureDirectory(path.dirname(filePath)); fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8'); }
function readJson(filePath) { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
function assertCheck(condition, message, detail = null) { return { pass: Boolean(condition), message, detail }; }

async function main() {
  const strict = process.argv.includes('--strict');
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section8-deployment-packaging.mjs');
  ensureRuntimeState(config);
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_8_DEPLOYMENT_PACKAGING.json');
  const shipScript = path.join(config.shellDir, 'bin', 'ship-candidate.mjs');
  const reportFile = path.join(config.rootDir, 'docs', 'proof', 'DEPLOYMENT_READINESS_REPORT.json');
  const manifestFile = path.join(config.rootDir, 'dist', 'ship-candidate', 'ARTIFACT_MANIFEST.json');
  const modesDoc = path.join(config.rootDir, 'docs', 'DEPLOYMENT_MODES.md');
  const quickstartDoc = path.join(config.rootDir, 'docs', 'NONEXPERT_OPERATOR_QUICKSTART.md');
  const specDoc = path.join(config.rootDir, 'docs', 'ARTIFACT_MANIFEST_SPEC.md');

  const run = spawnSync(process.execPath, [shipScript, '--strict', '--json'], {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const payload = parseJsonFromMixedOutput(run.stdout);
  const report = fs.existsSync(reportFile) ? readJson(reportFile) : null;
  const manifest = fs.existsSync(manifestFile) ? readJson(manifestFile) : null;
  const archivePath = payload?.outputs?.handoffArchive ? path.join(config.rootDir, payload.outputs.handoffArchive) : null;
  const handoffDir = payload?.outputs?.handoffDirectory ? path.join(config.rootDir, payload.outputs.handoffDirectory) : null;
  const runtimeSealPath = payload?.outputs?.runtimeSealFile ? path.join(config.rootDir, payload.outputs.runtimeSealFile) : null;
  const handoffRuntimeSealPath = payload?.outputs?.runtimeSealFile && handoffDir ? path.join(handoffDir, payload.outputs.runtimeSealFile) : null;
  const handoffPricingSpec = handoffDir ? path.join(handoffDir, 'public', 'pricing-spec.html') : null;
  const handoffProcurementIndex = handoffDir ? path.join(handoffDir, 'docs', 'PROCUREMENT_PACKET_INDEX.md') : null;
  const handoffQuickstart = handoffDir ? path.join(handoffDir, 'docs', 'NONEXPERT_OPERATOR_QUICKSTART.md') : null;
  const checks = [
    assertCheck(run.status === 0 && Boolean(payload?.ok), 'canonical ship-candidate command completes green from the canonical bootstrap and proof path', { status: run.status, stdoutTail: String(run.stdout || '').split(/\r?\n/).filter(Boolean).slice(-20), stderrTail: String(run.stderr || '').split(/\r?\n/).filter(Boolean).slice(-20) }),
    assertCheck(Array.isArray(payload?.commandSequence) && payload.commandSequence.length === 3, 'ship-candidate payload records one canonical green command sequence for operators', payload?.commandSequence),
    assertCheck(fs.existsSync(reportFile) && Boolean(report?.deployReadiness?.ok), 'deployment readiness report is emitted in machine-readable form on every ship-candidate run', report),
    assertCheck(fs.existsSync(manifestFile) && Array.isArray(manifest?.items) && manifest.items.length >= 6, 'artifact manifest with hashes is emitted for build outputs', manifest),
    assertCheck(manifest?.items?.some(item => item.path === payload?.outputs?.handoffArchive && /^[a-f0-9]{64}$/.test(String(item.sha256 || ''))), 'artifact manifest includes the packaged operator handoff archive with a sha256 hash', manifest?.items),
    assertCheck(Boolean(archivePath && fs.existsSync(archivePath) && fs.statSync(archivePath).size > 0), 'packaged operator handoff archive is generated for delivery', archivePath),
    assertCheck(Boolean(payload?.outputs?.envTemplatePack && fs.existsSync(path.join(config.rootDir, payload.outputs.envTemplatePack, 'deploy.env.example')) && fs.existsSync(path.join(config.rootDir, payload.outputs.envTemplatePack, 'dev.env.example')) && fs.existsSync(path.join(config.rootDir, payload.outputs.envTemplatePack, 'proof.env.example'))), 'environment template pack is generated for deploy, dev, and proof modes', payload?.outputs?.envTemplatePack),
    assertCheck(fs.existsSync(modesDoc) && fs.existsSync(quickstartDoc) && fs.existsSync(specDoc), 'deployment packaging docs exist for deployment modes, non-expert quickstart, and artifact manifest spec', { modesDoc: fs.existsSync(modesDoc), quickstartDoc: fs.existsSync(quickstartDoc), specDoc: fs.existsSync(specDoc) }),
    assertCheck(Boolean(runtimeSealPath && fs.existsSync(runtimeSealPath)), 'ship-candidate emits the latest gate/runtime seal report', runtimeSealPath),
    assertCheck(Boolean(handoffRuntimeSealPath && fs.existsSync(handoffRuntimeSealPath)), 'operator handoff directory includes the gate/runtime seal report', handoffRuntimeSealPath),
    assertCheck(Boolean(handoffQuickstart && fs.existsSync(handoffQuickstart)), 'operator handoff directory includes the non-expert quickstart', handoffQuickstart),
    assertCheck(Boolean(handoffProcurementIndex && fs.existsSync(handoffProcurementIndex) && handoffPricingSpec && fs.existsSync(handoffPricingSpec)), 'operator handoff directory includes the procurement packet index and public pricing/spec page', { handoffProcurementIndex, handoffPricingSpec }),
    assertCheck(typeof payload?.packageName === 'string' && typeof payload?.highestPassingStage === 'number' && payload.packageName.includes(`stage${payload.highestPassingStage}`), 'packaged handoff naming matches the actual highest passing proof stage', { packageName: payload?.packageName, highestPassingStage: payload?.highestPassingStage })
  ];
  let sectionPayload = {
    section: 8,
    label: 'section-8-deployment-readiness-and-packaging',
    strict,
    generatedAt: new Date().toISOString(),
    proofCommand: 'npm run workspace:proof:section8 -- --strict',
    shipCandidateCommand: 'npm run ship:candidate -- --strict --json',
    artifacts: {
      shipCandidate: payload,
      report,
      manifest
    },
    checks,
    pass: checks.every(item => item.pass)
  };
  sectionPayload = writeProofJson(proofFile, sectionPayload, config, 'workspace-proof-section8-deployment-packaging.mjs');
  if (strict && !sectionPayload.pass) {
    console.error(JSON.stringify(sectionPayload, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(sectionPayload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
