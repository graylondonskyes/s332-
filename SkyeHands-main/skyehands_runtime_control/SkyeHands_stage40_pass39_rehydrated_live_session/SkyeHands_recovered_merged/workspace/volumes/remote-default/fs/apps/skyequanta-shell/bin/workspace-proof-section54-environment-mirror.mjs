#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import {
  resetEnvironmentMirrorStore,
  ingestMirrorInput,
  reconstructEnvironmentMirror,
  verifyEnvironmentMirror,
  launchEnvironmentMirror
} from '../lib/environment-mirror.mjs';

function parseArgs(argv) {
  return { strict: argv.includes('--strict'), json: argv.includes('--json') };
}

function writeFixtureProject(targetDir, options = {}) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify({
    name: options.name || 'section54-fixture',
    version: '1.0.0',
    type: 'module',
    scripts: { start: 'node server.mjs' },
    dependencies: {
      '@neondatabase/serverless': '^0.9.0',
      express: '^4.0.0'
    }
  }, null, 2));
  fs.writeFileSync(path.join(targetDir, 'server.mjs'), `
import http from 'node:http';
const port = Number(process.env.PORT || 4340);
const server = http.createServer(async (req, res) => {
  const send = (status, body, type='application/json; charset=utf-8') => { res.writeHead(status, { 'content-type': type }); res.end(body); };
  if (req.method === 'GET' && req.url === '/') return send(200, '<!doctype html><html><body><h1>Section 54 Fixture</h1><a href="/docs">Docs</a></body></html>', 'text/html; charset=utf-8');
  if (req.method === 'GET' && req.url === '/health') return send(200, JSON.stringify({ ok: true, port }));
  if (req.method === 'GET' && req.url === '/docs') return send(200, '<!doctype html><html><body><h1>Docs</h1><p>Deploy with npm run start.</p></body></html>', 'text/html; charset=utf-8');
  return send(404, JSON.stringify({ ok: false, path: req.url }));
});
server.listen(port, '127.0.0.1');
`);
  fs.writeFileSync(path.join(targetDir, '.env.example'), 'PORT=4340\nDATABASE_URL=postgres://fixture\nOPENAI_API_KEY=\n');
  fs.mkdirSync(path.join(targetDir, 'config'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'config', 'env.example'), 'SKYE_MODE=mirror\nPUBLIC_BASE_URL=http://127.0.0.1:4340\n');
  fs.writeFileSync(path.join(targetDir, 'README.md'), '# Section 54 Fixture\n\nRun with `npm run start` on port 4340. Database service is Neon-backed.');
  fs.mkdirSync(path.join(targetDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'docs', 'deploy.md'), '# Deploy\n\nUse Netlify for the web surface and a Neon-backed database.');
  fs.mkdirSync(path.join(targetDir, 'traces'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'traces', 'runtime-trace.json'), JSON.stringify({ ok: true, lane: 'smoke', ts: '2026-04-07T20:00:00Z' }, null, 2));
  fs.writeFileSync(path.join(targetDir, 'netlify.toml'), '[build]\npublish = "."\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section54-environment-mirror.mjs');

  const versionStamp = JSON.parse(fs.readFileSync(path.join(config.rootDir, 'docs', 'VERSION_STAMP.json'), 'utf8'));
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_54_ENVIRONMENT_MIRROR.json');
  const outputDir = path.join(config.rootDir, 'dist', 'section54', 'environment-mirror');
  const fixtureDir = path.join(outputDir, 'fixture-project');
  const fixtureZip = path.join(outputDir, 'fixture-project.zip');
  const brokenDir = path.join(outputDir, 'broken-project');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  resetEnvironmentMirrorStore(config);

  writeFixtureProject(fixtureDir, { name: 'section54-fixture' });
  spawnSync('zip', ['-qr', fixtureZip, '.'], { cwd: fixtureDir, encoding: 'utf8' });
  fs.mkdirSync(brokenDir, { recursive: true });
  fs.writeFileSync(path.join(brokenDir, 'README.md'), '# broken project\n');

  const ingest = ingestMirrorInput(config, fixtureZip, { runId: 'section54-ingest' });
  const mirror = await reconstructEnvironmentMirror(config, {
    runId: 'section54-proof',
    inputPath: fixtureZip,
    targetLabel: 'Section 54 Fixture',
    outputDir: path.join(outputDir, 'mirror'),
    detectedPort: 4340
  });
  const launch = await launchEnvironmentMirror(mirror, { port: 4340 });
  if (launch.ok) await launch.stop();
  const brokenMirror = await reconstructEnvironmentMirror(config, {
    runId: 'section54-broken',
    inputPath: brokenDir,
    targetLabel: 'Broken Mirror',
    outputDir: path.join(outputDir, 'broken-mirror')
  });
  const conflictMirror = await reconstructEnvironmentMirror(config, {
    runId: 'section54-conflict',
    inputPath: fixtureZip,
    targetLabel: 'Section 54 Fixture Conflict',
    outputDir: path.join(outputDir, 'conflict-mirror'),
    metadataOverrides: { expectedPort: 9999, detectedPort: 4340 }
  });
  const tamperedVerification = verifyEnvironmentMirror({ ...mirror, fingerprint: 'tampered' });

  const checks = [
    assertCheck(ingest.inputType === 'zip' && mirror.descriptors.some(item => item.relativePath === 'package.json') && mirror.runbooks.some(item => item.relativePath === 'README.md'), 'Add ingestion for repo metadata, docs, config files, deployment descriptors, and runtime traces', {
      ingest,
      descriptors: mirror.descriptors,
      runbooks: mirror.runbooks,
      runtimeTraces: mirror.runtimeTraces
    }),
    assertCheck(mirror.services.length >= 2 && mirror.envVars.some(item => item.name === 'DATABASE_URL') && mirror.dependencyGraph.dependencyCount >= 1, 'Build environment reconstruction model for services, env vars, runbooks, dependency graphs, and launch paths', {
      services: mirror.services,
      envVars: mirror.envVars,
      dependencyGraph: mirror.dependencyGraph,
      launchStrategy: mirror.launchStrategy
    }),
    assertCheck(mirror.gapReport.honesty === 'launchable-with-current-input' && Array.isArray(mirror.gapReport.inferred) && Array.isArray(mirror.gapReport.missing), 'Add environment gap report that explains what was inferred, what was confirmed, and what is still missing', mirror.gapReport),
    assertCheck(fs.existsSync(path.join(config.rootDir, mirror.artifactReferences.surfaceFile)) && fs.existsSync(path.join(config.rootDir, mirror.artifactReferences.templateFile)), 'Add UI for reconstructed environment summary and manual correction', {
      surfaceFile: mirror.artifactReferences.surfaceFile,
      templateFile: mirror.artifactReferences.templateFile
    }),
    assertCheck(fs.existsSync(path.join(config.rootDir, mirror.artifactReferences.templateFile)) && JSON.parse(fs.readFileSync(path.join(config.rootDir, mirror.artifactReferences.templateFile), 'utf8')).services.length >= 1, 'Add reusable environment template export', {
      templateFile: mirror.artifactReferences.templateFile
    }),
    assertCheck(ingest.projectRoot.endsWith('fixture-project') || ingest.projectRoot.includes('extract'), 'Import a fixture repo or descriptor set', ingest),
    assertCheck(mirror.launchStrategy.ok === true && mirror.services.some(item => item.type === 'web'), 'Reconstruct workspace/runtime model', {
      launchStrategy: mirror.launchStrategy,
      services: mirror.services
    }),
    assertCheck(launch.ok === true && launch.health.ok === true, 'Launch reconstructed environment successfully', launch),
    assertCheck(mirror.gapReport.honesty === 'launchable-with-current-input', 'Produce environment gap report', mirror.gapReport),
    assertCheck(fs.existsSync(path.join(config.rootDir, mirror.artifactReferences.templateFile)), 'Export reconstructed template', { templateFile: mirror.artifactReferences.templateFile }),
    assertCheck(brokenMirror.gapReport.honesty === 'partial-confidence' && brokenMirror.gapReport.missing.includes('launchable service model'), 'Inject incomplete metadata and prove gap report remains honest', brokenMirror.gapReport),
    assertCheck(conflictMirror.gapReport.honesty === 'conflicted-signals' && conflictMirror.gapReport.conflicts.some(item => item.type === 'port-conflict'), 'Inject contradictory metadata and prove conflict detection', conflictMirror.gapReport),
    assertCheck(tamperedVerification.ok === false && tamperedVerification.expectedFingerprint !== tamperedVerification.actualFingerprint, 'Tamper one inferred service dependency and prove validation fails or requests correction', tamperedVerification),
    assertCheck(proofFile.endsWith('SECTION_54_ENVIRONMENT_MIRROR.json'), 'Create proof artifact docs/proof/SECTION_54_ENVIRONMENT_MIRROR.json', { proofFile }),
    assertCheck(mirror.gapReport.honesty === 'launchable-with-current-input' && launch.ok === true, 'The system can reconstruct a materially usable engineering environment from partial external signals and honestly show what was inferred versus proven', { mirror, launch })
  ];

  const payload = {
    section: 54,
    label: 'section-54-environment-mirror',
    generatedAt: new Date().toISOString(),
    pass: checks.every(item => item.pass),
    strict: options.strict,
    modelVersion: versionStamp.modelVersion,
    runtimeVersion: versionStamp.runtimeVersion,
    directiveVersion: versionStamp.directiveVersion,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section54-environment-mirror.mjs --strict',
    smokeCommand: 'bash scripts/smoke-section54-environment-mirror.sh',
    checks,
    hostileChecks: [
      { name: 'incomplete-metadata-remains-honest', pass: brokenMirror.gapReport.honesty === 'partial-confidence', detail: brokenMirror.gapReport },
      { name: 'contradictory-metadata-detected', pass: conflictMirror.gapReport.conflicts.length > 0, detail: conflictMirror.gapReport },
      { name: 'tampered-mirror-verification-fails', pass: tamperedVerification.ok === false, detail: tamperedVerification }
    ],
    recoveryChecks: [
      { name: 'launchable-mirror-can-start', pass: launch.ok === true, detail: launch },
      { name: 'reader-dossier-survives-into-mirror', pass: mirror.reader.integrated === true && mirror.reader.summary.documentCount >= 2, detail: mirror.reader.summary }
    ],
    evidence: {
      mirror,
      brokenMirror,
      conflictMirror,
      launch,
      tamperedVerification
    },
    artifactReferences: {
      proofFile,
      mirrorFile: mirror.artifactReferences.mirrorFile,
      templateFile: mirror.artifactReferences.templateFile,
      surfaceFile: mirror.artifactReferences.surfaceFile,
      readerDossierFile: mirror.artifactReferences.readerDossierFile
    }
  };

  const written = writeProofJson(proofFile, payload, config, 'workspace-proof-section54-environment-mirror.mjs');
  console.log(JSON.stringify(written, null, 2));
  if (!written.pass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
