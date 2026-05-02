#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { getPublicSummary, getStackConfig, withLocalBinPath } from './config.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { getCanonicalRuntimePaths } from '../lib/canonical-runtime.mjs';
import { collectKnownSecrets, writeRedactedSupportDump } from '../lib/gate-config.mjs';

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

function readString(value) {
  return String(value ?? '').trim();
}

function parseArgs(argv) {
  const options = {
    json: false,
    strict: false,
    output: null,
    protectSecrets: [],
    scanPaths: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') {
      options.json = true;
      continue;
    }
    if (value === '--strict') {
      options.strict = true;
      continue;
    }
    if (value === '--output' && argv[index + 1]) {
      options.output = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (value.startsWith('--output=')) {
      options.output = String(value.split('=').slice(1).join('=')).trim();
      continue;
    }
    if (value === '--protect-secret' && argv[index + 1]) {
      options.protectSecrets.push(String(argv[index + 1]).trim());
      index += 1;
      continue;
    }
    if (value.startsWith('--protect-secret=')) {
      options.protectSecrets.push(String(value.split('=').slice(1).join('=')).trim());
      continue;
    }
    if (value === '--scan-path' && argv[index + 1]) {
      options.scanPaths.push(String(argv[index + 1]).trim());
      index += 1;
      continue;
    }
    if (value.startsWith('--scan-path=')) {
      options.scanPaths.push(String(value.split('=').slice(1).join('=')).trim());
    }
  }

  return options;
}

function assertCheck(condition, message, detail = null) {
  return {
    pass: Boolean(condition),
    message,
    detail
  };
}

function resolveScanTargets(config, options = {}) {
  const defaults = [
    '.skyequanta/reports',
    'docs/proof',
    'dist/ship-candidate',
    'docs/PROCUREMENT_PACKET_INDEX.md',
    'client-handoff-for-procurement.html',
    'docs/BOARD_INVESTOR_ONE_PAGER.html',
    'docs/ARCHITECTURE_OVERVIEW.html',
    'docs/PROOF_CENTER.html',
    'public/pricing-spec.html'
  ];

  return [...new Set([...defaults, ...(options.scanPaths || [])])]
    .map(item => path.resolve(config.rootDir, item))
    .filter(filePath => fs.existsSync(filePath));
}

function listTextFiles(targetPath, fileList = []) {
  if (!fs.existsSync(targetPath)) {
    return fileList;
  }
  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath)) {
      listTextFiles(path.join(targetPath, entry), fileList);
    }
    return fileList;
  }

  const allowedExtensions = new Set([
    '.json', '.md', '.txt', '.html', '.js', '.mjs', '.cjs', '.csv', '.log', '.ndjson', '.yaml', '.yml', '.env'
  ]);
  const ext = path.extname(targetPath).toLowerCase();
  if (!allowedExtensions.has(ext) || stat.size > 2 * 1024 * 1024) {
    return fileList;
  }
  fileList.push(targetPath);
  return fileList;
}

function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex').slice(0, 16);
}

function scanForPlaintextLeaks(config, scanTargets, protectedSecrets = []) {
  const findings = [];
  const files = [];
  const uniqueSecrets = [...new Set((protectedSecrets || []).map(readString).filter(Boolean))];
  for (const target of scanTargets) {
    listTextFiles(target, files);
  }

  for (const filePath of [...new Set(files)]) {
    let text = '';
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }
    for (const secret of uniqueSecrets) {
      if (!secret || !text.includes(secret)) {
        continue;
      }
      findings.push({
        file: path.relative(config.rootDir, filePath),
        secretFingerprint: hashSecret(secret)
      });
    }
  }

  return {
    scannedFiles: [...new Set(files)].map(filePath => path.relative(config.rootDir, filePath)).sort(),
    findings
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const env = withLocalBinPath(loadShellEnv(baseConfig));
  const config = getStackConfig(env);
  const canonicalRuntime = getCanonicalRuntimePaths(config);

  const reportDir = path.join(config.rootDir, '.skyequanta', 'reports');
  ensureDirectory(reportDir);

  const docsToCheck = [
    path.join(config.rootDir, 'docs', 'GATE_RUNTIME_MODES.md'),
    path.join(config.rootDir, 'docs', 'CANONICAL_RUNTIME_PATHS.md'),
    path.join(config.rootDir, 'docs', 'DEPLOYMENT_MODES.md'),
    path.join(config.rootDir, 'docs', 'NONEXPERT_OPERATOR_QUICKSTART.md')
  ];

  const envTemplates = [
    path.join(config.rootDir, 'config', 'env.example'),
    path.join(config.rootDir, 'config', 'env-templates', 'deploy.env.example'),
    path.join(config.rootDir, 'config', 'env-templates', 'dev.env.example'),
    path.join(config.rootDir, 'config', 'env-templates', 'proof.env.example')
  ];

  const supportDumpPath = writeRedactedSupportDump(
    config.rootDir,
    `runtime-seal-support-dump-${Date.now()}.json`,
    {
      generatedBy: 'runtime-seal',
      runtimeSummary: getPublicSummary(config),
      environment: {
        runtimeMode: config.gateRuntime.mode,
        gateUrl: config.gateRuntime.gate.url,
        gateToken: config.gateRuntime.gate.token,
        gateModel: config.gateRuntime.gate.model,
        adminTokenConfigured: Boolean(config.auth?.adminToken)
      }
    },
    config.gateRuntime,
    env
  );
  const supportDump = readJson(supportDumpPath);

  const protectedSecrets = [...new Set([
    ...collectKnownSecrets(config.gateRuntime, env),
    ...(options.protectSecrets || []).map(readString).filter(Boolean)
  ])];
  const scanTargets = resolveScanTargets(config, options);
  const leakScan = scanForPlaintextLeaks(config, scanTargets, protectedSecrets);

  const checks = [
    assertCheck(fs.existsSync(path.join(config.rootDir, 'config', 'gate-runtime.json')), 'canonical gate runtime config file exists', 'config/gate-runtime.json'),
    assertCheck(fs.existsSync(path.join(config.rootDir, 'config', 'redaction-policy.json')), 'canonical redaction policy file exists', 'config/redaction-policy.json'),
    assertCheck(Boolean(config.gateRuntime?.mode), 'gate runtime mode resolves from canonical config and env overlay', config.gateRuntime?.mode),
    assertCheck(Boolean(config.gateRuntime?.validation?.ok), 'gate runtime validation is green for the active runtime mode', config.gateRuntime?.validation),
    assertCheck(docsToCheck.every(filePath => fs.existsSync(filePath)), 'operator-facing runtime and deployment docs exist', docsToCheck.map(filePath => path.relative(config.rootDir, filePath))),
    assertCheck(envTemplates.every(filePath => fs.existsSync(filePath)), 'operator env template surfaces exist for root, deploy, dev, and proof modes', envTemplates.map(filePath => path.relative(config.rootDir, filePath))),
    assertCheck(typeof canonicalRuntime.launcher?.command === 'string' && typeof canonicalRuntime.bridgeRuntime?.command === 'string', 'canonical runtime map resolves launcher and bridge commands', canonicalRuntime),
    assertCheck(Boolean(config.auth?.adminToken), 'admin control-plane token is configured for guarded runtime and support surfaces', { configured: Boolean(config.auth?.adminToken) }),
    assertCheck(
      config.gateRuntime.gate.token
        ? supportDump?.payload?.environment?.gateToken === '[REDACTED]'
        : !supportDump?.payload?.environment?.gateToken || supportDump?.payload?.environment?.gateToken === '[REDACTED]',
      'support dump redacts persisted gate token material',
      supportDump?.payload?.environment
    ),
    assertCheck(
      config.gateRuntime.gate.url
        ? supportDump?.payload?.environment?.gateUrl === config.gateRuntime.gate.url
        : supportDump?.payload?.environment?.gateUrl === null,
      'support dump keeps the operator-safe gate URL while withholding secrets',
      supportDump?.payload?.environment
    ),
    assertCheck(leakScan.findings.length === 0, 'runtime seal detects plaintext secret leaks across protected reports, proof, and procurement surfaces', {
      scannedTargetCount: scanTargets.length,
      scannedFileCount: leakScan.scannedFiles.length,
      protectedSecretCount: protectedSecrets.length,
      findings: leakScan.findings
    })
  ];

  const timestamp = new Date().toISOString().replace(/[:]/g, '-');
  const payload = {
    generatedAt: new Date().toISOString(),
    strict: options.strict,
    ok: checks.every(item => item.pass),
    sealId: `gate-runtime-seal-${timestamp}`,
    command: 'node apps/skyequanta-shell/bin/runtime-seal.mjs --strict --json',
    gateRuntime: {
      mode: config.gateRuntime.mode,
      validation: config.gateRuntime.validation,
      gateUrlConfigured: Boolean(config.gateRuntime.gate.url),
      gateTokenConfigured: Boolean(config.gateRuntime.gate.token),
      gateModel: config.gateRuntime.gate.model
    },
    canonicalRuntime,
    outputs: {
      supportDump: path.relative(config.rootDir, supportDumpPath)
    },
    docs: docsToCheck.map(filePath => path.relative(config.rootDir, filePath)),
    envTemplates: envTemplates.map(filePath => path.relative(config.rootDir, filePath)),
    leakScan: {
      scanTargets: scanTargets.map(filePath => path.relative(config.rootDir, filePath)),
      protectedSecretCount: protectedSecrets.length,
      scannedFiles: leakScan.scannedFiles,
      findings: leakScan.findings
    },
    checks
  };

  const latestReport = path.join(reportDir, 'GATE_RUNTIME_SEAL_LATEST.json');
  const datedReport = path.join(reportDir, `GATE_RUNTIME_SEAL_${timestamp}.json`);
  writeJson(latestReport, payload);
  writeJson(datedReport, payload);

  const outputPath = options.output ? path.resolve(config.rootDir, options.output) : null;
  if (outputPath) {
    writeJson(outputPath, payload);
  }

  const emittedPayload = {
    ...payload,
    outputs: {
      ...payload.outputs,
      latestReport: path.relative(config.rootDir, latestReport),
      datedReport: path.relative(config.rootDir, datedReport),
      explicitOutput: outputPath ? path.relative(config.rootDir, outputPath) : null
    }
  };

  if (options.json) {
    console.log(JSON.stringify(emittedPayload, null, 2));
  } else {
    console.log(`Gate runtime seal: ${emittedPayload.ok ? 'PASS' : 'FAIL'}`);
    console.log(`Latest report: ${emittedPayload.outputs.latestReport}`);
    console.log(`Support dump: ${emittedPayload.outputs.supportDump}`);
  }

  if (options.strict && !emittedPayload.ok) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
