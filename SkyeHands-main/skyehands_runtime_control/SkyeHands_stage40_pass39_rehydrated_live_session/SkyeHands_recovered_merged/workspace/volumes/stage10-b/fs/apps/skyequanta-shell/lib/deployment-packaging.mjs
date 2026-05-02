import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { writeInvestorPacket } from './investor-packet.mjs';
import { writeReleaseStamp } from './release-stamp.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function parseJsonFromMixedOutput(rawText) {
  const text = String(rawText || '').trim();
  const start = text.indexOf('{');
  if (start === -1) return null;
  try {
    return JSON.parse(text.slice(start));
  } catch {
    return null;
  }
}

export function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

export function collectPassingStageArtifacts(rootDir) {
  const proofDir = path.join(rootDir, 'docs', 'proof');
  if (!fs.existsSync(proofDir)) return [];
  return fs.readdirSync(proofDir)
    .filter(name => /^STAGE_\d+_.*\.json$/i.test(name))
    .map(name => {
      const filePath = path.join(proofDir, name);
      try {
        const payload = readJson(filePath);
        const match = name.match(/^STAGE_(\d+)_/i);
        const stage = Number.parseInt(match?.[1] || '', 10);
        const pass = Boolean(payload?.pass ?? payload?.passed);
        return { name, filePath, stage, pass, payload };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter(item => Number.isInteger(item.stage) && item.pass)
    .sort((a, b) => a.stage - b.stage);
}

export function getHighestPassingStage(rootDir) {
  const passing = collectPassingStageArtifacts(rootDir);
  return passing.length ? passing[passing.length - 1] : null;
}

export function getShipCandidatePaths(config) {
  const distDir = path.join(config.rootDir, 'dist', 'ship-candidate');
  return {
    distDir,
    handoffDir: path.join(distDir, 'operator-handoff'),
    templatePackDir: path.join(distDir, 'env-template-pack'),
    manifestFile: path.join(distDir, 'ARTIFACT_MANIFEST.json'),
    reportFile: path.join(config.rootDir, 'docs', 'proof', 'DEPLOYMENT_READINESS_REPORT.json')
  };
}

export function writeDeploymentReadinessReport(config, stage9Payload, extra = {}) {
  const highestStage = getHighestPassingStage(config.rootDir);
  const paths = getShipCandidatePaths(config);
  const report = {
    generatedAt: new Date().toISOString(),
    productName: config.productName,
    companyName: config.companyName,
    canonicalBootstrapCommand: './START_HERE.sh',
    canonicalOperatorCli: './skyequanta',
    canonicalDoctorCommand: './skyequanta doctor --mode deploy --probe-active --json',
    canonicalProofCommand: './skyequanta proof:truthpath --strict',
    shipCandidateCommand: './skyequanta operator-green --json',
    highestPassingStage: highestStage ? { stage: highestStage.stage, artifact: path.relative(config.rootDir, highestStage.filePath) } : null,
    stage9: {
      pass: Boolean(stage9Payload?.pass),
      artifact: 'docs/proof/STAGE_9_DEPLOYMENT_READINESS.json',
      proofCommand: stage9Payload?.proofCommand || 'npm run workspace:proof:stage9 -- --strict'
    },
    deployReadiness: {
      ok: Boolean(stage9Payload?.pass),
      strict: Boolean(stage9Payload?.strict),
      lifecycleSmokeCommand: stage9Payload?.lifecycleSmokeCommand || null,
      doctorCommand: stage9Payload?.doctorCommand || null
    },
    commandSequence: [
      './START_HERE.sh',
      './skyequanta doctor --mode deploy --probe-active --json',
      './skyequanta operator-green --json'
    ],
    outputs: extra.outputs || {},
    manifest: extra.manifest || null,
    packagingDocs: {
      deploymentModes: 'docs/DEPLOYMENT_MODES.md',
      nonExpertQuickstart: 'docs/NONEXPERT_OPERATOR_QUICKSTART.md',
      gateRuntimeModes: 'docs/GATE_RUNTIME_MODES.md',
      artifactManifestSpec: 'docs/ARTIFACT_MANIFEST_SPEC.md',
      masterProofLedger: 'docs/proof/MASTER_PROOF_LEDGER.json',
      proofArtifactHashes: 'docs/proof/PROOF_ARTIFACT_HASHES.json'
    }
  };
  writeJson(paths.reportFile, report);
  return report;
}

export function materializeEnvTemplatePack(config, destinationDir) {
  const sourceDir = path.join(config.rootDir, 'config', 'env-templates');
  ensureDirectory(destinationDir);
  const entries = fs.readdirSync(sourceDir)
    .filter(name => name.endsWith('.env.example'))
    .sort();
  for (const entry of entries) {
    fs.copyFileSync(path.join(sourceDir, entry), path.join(destinationDir, entry));
  }
  return entries.map(name => path.join(destinationDir, name));
}

export function createOperatorInstallScript(config, destinationFile) {
  const contents = `#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
echo "[SkyeQuantaCore] START_HERE -> canonical operator CLI"
./skyequanta operator-green --json
`;
  ensureDirectory(path.dirname(destinationFile));
  fs.writeFileSync(destinationFile, contents, 'utf8');
  fs.chmodSync(destinationFile, 0o755);
  return destinationFile;
}

export function createOpenMeFirstHtml(config, destinationFile, options = {}) {
  const title = `${config.productName} Operator Start Surface`;
  const supportDump = options.supportDump || './.skyequanta/reports/support-dumps/operator-green-support-dump.json';
  const contents = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { --bg:#08101b; --panel:#111b2d; --panel2:#17243a; --ink:#f5f7ff; --muted:#b8c1d9; --line:rgba(255,255,255,.12); --accent:#88d5ff; --good:#7df0aa; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter,Arial,sans-serif; background:linear-gradient(180deg,#07101a,#0b1524 60%,#0e1a2b); color:var(--ink); }
    .wrap { max-width:980px; margin:0 auto; padding:40px 22px 70px; }
    .hero,.card { border:1px solid var(--line); border-radius:24px; background:linear-gradient(180deg,var(--panel),var(--panel2)); box-shadow:0 20px 50px rgba(0,0,0,.28); }
    .hero { padding:28px; margin-bottom:18px; }
    .eyebrow { color:var(--accent); text-transform:uppercase; letter-spacing:.14em; font-size:12px; font-weight:700; margin-bottom:10px; }
    h1 { margin:0 0 8px; font-size:34px; line-height:1.1; }
    p, li { color:var(--muted); line-height:1.6; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:18px; }
    .card { padding:20px 22px; }
    code { background:rgba(255,255,255,.06); border:1px solid var(--line); border-radius:10px; padding:3px 7px; color:var(--ink); }
    .cmd { display:block; margin:10px 0 0; padding:12px 14px; border-radius:14px; border:1px solid var(--line); background:rgba(0,0,0,.2); font-family:ui-monospace, SFMono-Regular, Menlo, monospace; color:var(--good); }
    a { color:#d9dcff; }
    .good { color:var(--good); font-weight:700; }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div class="eyebrow">Skyes Over London · Operator Handoff</div>
      <h1>${title}</h1>
      <p>This is the non-expert start surface. Use the one-command operator path first. Do not jump into raw internal bins.</p>
      <span class="cmd">./START_HERE.sh</span>
    </section>
    <section class="grid">
      <article class="card">
        <h2>Do this first</h2>
        <ol>
          <li>Open <code>config/env-template-pack/deploy.env.example</code> and copy the values you need into <code>.env.local</code>.</li>
          <li>Run <code>./START_HERE.sh</code>.</li>
          <li>Only hand off the package if the report finishes <span class="good">green</span>.</li>
        </ol>
      </article>
      <article class="card">
        <h2>Primary docs</h2>
        <ul>
          <li><a href="docs/NONEXPERT_OPERATOR_QUICKSTART.md">Non-expert quickstart</a></li>
          <li><a href="docs/LAUNCH_READINESS.md">Launch readiness</a></li>
          <li><a href="docs/PROCUREMENT_PACKET_INDEX.md">Procurement packet index</a></li>
          <li><a href="docs/proof/DEPLOYMENT_READINESS_REPORT.json">Deployment readiness report</a></li>
        </ul>
      </article>
      <article class="card">
        <h2>Operator-safe evidence</h2>
        <ul>
          <li><a href="docs/proof/STAGE_11_REGRESSION_PROOF.json">Fresh Stage 11 regression proof</a></li>
          <li><a href="docs/proof/SECTION_12_NONEXPERT_OPERATOR_READY.json">Non-expert operator-ready proof</a></li>
          <li><a href="docs/proof/SECTION_34_PROVIDER_REDACTION.json">Provider redaction proof</a></li>
          <li><a href="${supportDump}">Redacted support dump</a></li>
        </ul>
      </article>
    </section>
  </div>
</body>
</html>
`;
  ensureDirectory(path.dirname(destinationFile));
  fs.writeFileSync(destinationFile, contents, 'utf8');
  return destinationFile;
}

export function createOperatorHandoffReadme(config, destinationFile) {
  const readme = `SkyeQuantaCore operator handoff

Canonical command sequence
1. ./START_HERE.sh
2. npm run operator:green:json

This handoff now includes:
- the latest gate/runtime seal report
- a redacted operator support dump
- the public investor and procurement packet surfaces
- the sovereign provider directive and proof surfaces
- the non-expert operator quickstart
- an OPEN_ME_FIRST.html handoff surface
- the START_HERE one-command operator wrapper
`;
  ensureDirectory(path.dirname(destinationFile));
  fs.writeFileSync(destinationFile, readme, 'utf8');
  return destinationFile;
}

export function buildArtifactManifest(outputFiles, manifestFile, rootDir) {
  const items = outputFiles
    .filter(filePath => fs.existsSync(filePath))
    .map(filePath => ({
      path: path.relative(rootDir, filePath),
      sizeBytes: fs.statSync(filePath).size,
      sha256: sha256File(filePath)
    }));
  const payload = {
    generatedAt: new Date().toISOString(),
    algorithm: 'sha256',
    items
  };
  writeJson(manifestFile, payload);
  return payload;
}

export function createTarball(rootDir, sourceDir, archiveFile) {
  ensureDirectory(path.dirname(archiveFile));
  fs.rmSync(archiveFile, { force: true });
  const result = spawnSync('tar', ['-czf', archiveFile, '-C', rootDir, path.relative(rootDir, sourceDir)], {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(`tar failed for ${archiveFile}: ${result.stderr || result.stdout || 'unknown error'}`);
  }
  return archiveFile;
}

function runNodeJson(config, scriptName, args = []) {
  const scriptPath = path.join(config.shellDir, 'bin', scriptName);
  const run = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  return {
    run,
    payload: parseJsonFromMixedOutput(run.stdout)
  };
}

export function buildShipCandidatePackage(config, options = {}) {
  const strict = Boolean(options.strict);
  const paths = getShipCandidatePaths(config);
  const stage9Artifact = path.join(config.rootDir, 'docs', 'proof', 'STAGE_9_DEPLOYMENT_READINESS.json');
  const stage9Script = path.join(config.shellDir, 'bin', 'workspace-proof-stage9.mjs');
  const existingStage9Payload = fs.existsSync(stage9Artifact) ? readJson(stage9Artifact) : null;
  const shouldRefreshStage9 = process.env.SKYEQUANTA_FORCE_STAGE9_REFRESH === '1' || !existingStage9Payload?.pass;
  const stage9Run = shouldRefreshStage9
    ? spawnSync(process.execPath, [stage9Script, '--strict'], {
        cwd: config.rootDir,
        env: { ...process.env },
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
      })
    : { status: 0, stdout: '', stderr: '', skipped: true };
  const stage9Payload = fs.existsSync(stage9Artifact) ? readJson(stage9Artifact) : existingStage9Payload;
  if (strict && !stage9Payload?.pass) {
    throw new Error('Stage 9 deployment readiness proof did not pass during ship-candidate packaging.');
  }

  const runtimeSeal = runNodeJson(config, 'runtime-seal.mjs', ['--strict', '--json']);
  if (strict && (runtimeSeal.run.status !== 0 || !runtimeSeal.payload?.ok)) {
    throw new Error('Gate/runtime seal did not pass during ship-candidate packaging.');
  }

  const supportDump = runNodeJson(config, 'support-dump.mjs', ['--output', 'operator-handoff-support-dump.json', '--json']);
  if (strict && (supportDump.run.status !== 0 || !supportDump.payload?.ok)) {
    throw new Error('Support dump did not emit during ship-candidate packaging.');
  }

  const stage11Artifact = path.join(config.rootDir, 'docs', 'proof', 'STAGE_11_REGRESSION_PROOF.json');
  const stage11Payload = fs.existsSync(stage11Artifact) ? readJson(stage11Artifact) : null;

  const investorPacket = writeInvestorPacket(config.rootDir);
  const releaseStamp = writeReleaseStamp(config);

  fs.rmSync(paths.handoffDir, { recursive: true, force: true });
  fs.rmSync(paths.templatePackDir, { recursive: true, force: true });
  ensureDirectory(paths.handoffDir);
  ensureDirectory(paths.templatePackDir);

  const highestStage = getHighestPassingStage(config.rootDir);
  const highestLabel = highestStage ? `stage${highestStage.stage}` : 'stage0';
  const archiveBaseName = `skyequantacore-operator-handoff-${highestLabel}.tar.gz`;
  const archiveFile = path.join(paths.distDir, archiveBaseName);

  const preliminaryReport = writeDeploymentReadinessReport(config, stage9Payload, {
    outputs: {
      handoffDirectory: path.relative(config.rootDir, paths.handoffDir),
      handoffArchive: path.relative(config.rootDir, archiveFile),
      envTemplatePack: path.relative(config.rootDir, paths.templatePackDir),
      runtimeSealFile: runtimeSeal.payload?.outputs?.latestReport || null,
      supportDump: supportDump.payload?.output ? path.relative(config.rootDir, supportDump.payload.output) : null,
      procurementIndex: path.relative(config.rootDir, investorPacket.files.procurementIndex),
      releaseStamp: 'docs/VERSION_STAMP.json',
      oneCommandProof: 'docs/proof/SECTION_2_ONE_COMMAND_INSTALL.json',
      regressionProof: 'docs/proof/STAGE_11_REGRESSION_PROOF.json',
      operatorReadyProof: 'docs/proof/SECTION_12_NONEXPERT_OPERATOR_READY.json'
    },
    manifest: {
      file: path.relative(config.rootDir, paths.manifestFile)
    }
  });

  const filesToCopy = [
    'README.md',
    'skyequanta',
    'skyequanta.mjs',
    'package.json',
    'Makefile',
    'branding/identity.json',
    'config/env.example',
    'config/gate-runtime.json',
    'config/redaction-policy.json',
    'docs/DEPLOYMENT_MODES.md',
    'docs/NONEXPERT_OPERATOR_QUICKSTART.md',
    'docs/GATE_RUNTIME_MODES.md',
    'docs/ARTIFACT_MANIFEST_SPEC.md',
    'docs/CANONICAL_RUNTIME_PATHS.md',
    'docs/CANONICAL_OPERATOR_SURFACE.md',
    'docs/proof/STAGE_9_DEPLOYMENT_READINESS.json',
    'docs/proof/STAGE_10_MULTI_WORKSPACE_STRESS.json',
    'docs/proof/STAGE_11_REGRESSION_PROOF.json',
    'docs/proof/SECTION_12_NONEXPERT_OPERATOR_READY.json',
    'docs/proof/SECTION_5_GATE_RUNTIME_SEALING.json',
    'docs/proof/SECTION_8_DEPLOYMENT_PACKAGING.json',
    'docs/proof/SECTION_10_INVESTOR_PACKET.json',
    'docs/proof/SECTION_29_PROVIDER_VAULT.json',
    'docs/proof/SECTION_30_SESSION_UNLOCK.json',
    'docs/proof/SECTION_31_PROVIDER_CENTER.json',
    'docs/proof/SECTION_32_WORKSPACE_BINDINGS.json',
    'docs/proof/SECTION_33_PROVIDER_RUNTIME_EXECUTION.json',
    'docs/proof/SECTION_34_PROVIDER_REDACTION.json',
    'docs/SKYEHANDS_SOVEREIGN_PROVIDER_BINDINGS_IMPLEMENTATION_DIRECTIVE.md',
    'docs/proof/SECTION_2_ONE_COMMAND_INSTALL.json',
    'docs/proof/SECTION_3_TRUTHPATH_CONVERGENCE.json',
    'docs/proof/MASTER_PROOF_LEDGER.json',
    'docs/proof/PROOF_ARTIFACT_HASHES.json',
    'docs/proof/DEPLOYMENT_READINESS_REPORT.json',
    'docs/VERSION_STAMP.json',
    'docs/CLAIMS_REGISTER.md',
    'public/README.md',
    'public/pricing-spec.html',
    'START_HERE.sh'
  ];

  const dynamicFiles = [
    ...Object.values(investorPacket.files),
    path.join(config.rootDir, 'docs', 'VERSION_STAMP.json'),
    path.join(config.rootDir, 'docs', 'CLAIMS_REGISTER.md'),
    runtimeSeal.payload?.outputs?.latestReport ? path.join(config.rootDir, runtimeSeal.payload.outputs.latestReport) : null,
    supportDump.payload?.output ? supportDump.payload.output : null
  ].filter(Boolean);

  for (const relativePath of filesToCopy) {
    const source = path.join(config.rootDir, relativePath);
    if (!fs.existsSync(source)) continue;
    const dest = path.join(paths.handoffDir, relativePath);
    ensureDirectory(path.dirname(dest));
    fs.copyFileSync(source, dest);
  }

  for (const source of dynamicFiles) {
    if (!fs.existsSync(source)) continue;
    const dest = path.join(paths.handoffDir, path.relative(config.rootDir, source));
    ensureDirectory(path.dirname(dest));
    fs.copyFileSync(source, dest);
  }

  const templateFiles = materializeEnvTemplatePack(config, paths.templatePackDir);
  ensureDirectory(path.join(paths.handoffDir, 'config'));
  fs.cpSync(paths.templatePackDir, path.join(paths.handoffDir, 'config', 'env-template-pack'), { recursive: true });
  const installScript = createOperatorInstallScript(config, path.join(paths.handoffDir, 'operator-install.sh'));
  const openMeFirst = createOpenMeFirstHtml(config, path.join(paths.handoffDir, 'OPEN_ME_FIRST.html'), {
    supportDump: supportDump.payload?.output ? path.relative(paths.handoffDir, path.join(config.rootDir, path.relative(config.rootDir, supportDump.payload.output))).replace(/\\/g, '/') : '.skyequanta/reports/support-dumps/operator-handoff-support-dump.json'
  });
  const handoffReadme = createOperatorHandoffReadme(config, path.join(paths.handoffDir, 'README_OPERATOR_HANDOFF.txt'));

  createTarball(paths.distDir, paths.handoffDir, archiveFile);
  const outputFiles = [
    stage9Artifact,
    paths.reportFile,
    ...templateFiles,
    installScript,
    openMeFirst,
    archiveFile,
    handoffReadme,
    ...dynamicFiles
  ];
  const manifest = buildArtifactManifest(outputFiles, paths.manifestFile, config.rootDir);

  return {
    ok: Boolean(stage9Payload?.pass) && Boolean(runtimeSeal.payload?.ok),
    strict,
    generatedAt: new Date().toISOString(),
    commandSequence: preliminaryReport.commandSequence,
    highestPassingStage: highestStage ? highestStage.stage : null,
    packageName: archiveBaseName,
    outputs: {
      reportFile: path.relative(config.rootDir, paths.reportFile),
      manifestFile: path.relative(config.rootDir, paths.manifestFile),
      handoffDirectory: path.relative(config.rootDir, paths.handoffDir),
      handoffArchive: path.relative(config.rootDir, archiveFile),
      envTemplatePack: path.relative(config.rootDir, paths.templatePackDir),
      runtimeSealFile: runtimeSeal.payload?.outputs?.latestReport || null,
      supportDump: supportDump.payload?.output ? path.relative(config.rootDir, supportDump.payload.output) : null,
      procurementIndex: path.relative(config.rootDir, investorPacket.files.procurementIndex),
      releaseStamp: 'docs/VERSION_STAMP.json',
      oneCommandProof: 'docs/proof/SECTION_2_ONE_COMMAND_INSTALL.json',
      regressionProof: 'docs/proof/STAGE_11_REGRESSION_PROOF.json',
      operatorReadyProof: 'docs/proof/SECTION_12_NONEXPERT_OPERATOR_READY.json'
    },
    manifest,
    stage9Run: {
      status: stage9Run.status,
      stdoutTail: String(stage9Run.stdout || '').split(/\r?\n/).filter(Boolean).slice(-20),
      stderrTail: String(stage9Run.stderr || '').split(/\r?\n/).filter(Boolean).slice(-20)
    },
    runtimeSeal: {
      status: runtimeSeal.run.status,
      payload: runtimeSeal.payload,
      stdoutTail: String(runtimeSeal.run.stdout || '').split(/\r?\n/).filter(Boolean).slice(-20),
      stderrTail: String(runtimeSeal.run.stderr || '').split(/\r?\n/).filter(Boolean).slice(-20)
    },
    supportDump: {
      status: supportDump.run.status,
      payload: supportDump.payload,
      stdoutTail: String(supportDump.run.stdout || '').split(/\r?\n/).filter(Boolean).slice(-20),
      stderrTail: String(supportDump.run.stderr || '').split(/\r?\n/).filter(Boolean).slice(-20)
    },
    investorPacket: {
      procurementIndex: path.relative(config.rootDir, investorPacket.files.procurementIndex),
      releaseStamp: 'docs/VERSION_STAMP.json',
      datedSmokeReport: path.relative(config.rootDir, investorPacket.files.datedSmokeReport)
    },
    report: preliminaryReport,
    stage9: stage9Payload,
    stage11: stage11Payload
  };
}
