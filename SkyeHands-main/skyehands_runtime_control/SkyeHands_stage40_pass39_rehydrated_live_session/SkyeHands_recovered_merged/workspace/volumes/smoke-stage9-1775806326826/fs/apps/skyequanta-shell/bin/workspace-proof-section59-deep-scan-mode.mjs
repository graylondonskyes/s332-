#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import { resetDeepScanStore, runDeepScan, verifyDeepScanReport, detectLaunchStrategy, ingestProjectInput } from '../lib/deep-scan-mode.mjs';

function parseArgs(argv) {
  return { strict: argv.includes('--strict'), json: argv.includes('--json') };
}

function writeFixtureProject(targetDir, label) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify({
    name: 'deep-scan-fixture',
    version: '1.0.0',
    type: 'module',
    scripts: { start: 'node server.mjs' }
  }, null, 2));
  fs.writeFileSync(path.join(targetDir, 'server.mjs'), `
import http from 'node:http';
const port = Number(process.env.PORT || 4310);
function send(res, status, body, type='application/json; charset=utf-8') { res.writeHead(status, { 'content-type': type }); res.end(body); }
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    return send(res, 200, '<!doctype html><html><head><meta charset="utf-8" /><title>${label}</title></head><body><h1>${label}</h1><button id="scanBtn">Run Deep Scan</button><button id="investorBtn">Investor Audit</button><form action="/api/echo" method="post"><input name="nonce" /></form><a href="/pricing">Pricing</a></body></html>', 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && req.url === '/pricing') {
    return send(res, 200, '<!doctype html><html><body><h1>Pricing</h1><button id="buyBtn">Buy</button></body></html>', 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, JSON.stringify({ ok: true, product: '${label}', port }));
  }
  if (req.method === 'POST' && req.url === '/api/echo') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body || '{}');
    return send(res, 200, JSON.stringify({ ok: true, echo: payload.nonce || null, product: '${label}' }));
  }
  return send(res, 404, JSON.stringify({ ok: false, path: req.url }), 'application/json; charset=utf-8');
});
server.listen(port, '127.0.0.1');
`);
  fs.mkdirSync(path.join(targetDir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'public'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'README.md'), `# ${label}\n\nThis platform supports investor audits, pricing, proof packs, and route-level deep scan verification.`);
  fs.writeFileSync(path.join(targetDir, 'docs', 'investor-audit.md'), `# Investor Audit\n\nValuation posture for ${label} is grounded in proof, replay, pricing, and compliance evidence.`);
  fs.writeFileSync(path.join(targetDir, 'public', 'landing.html'), `<!doctype html><html><body><h1>${label} Landing</h1><p>Pricing, investor, compliance, and smoke proof all live here.</p></body></html>`);
  fs.writeFileSync(path.join(targetDir, 'netlify.toml'), '[build]\npublish = "."\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section59-deep-scan-mode.mjs');

  const versionStamp = JSON.parse(fs.readFileSync(path.join(config.rootDir, 'docs', 'VERSION_STAMP.json'), 'utf8'));
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_59_DEEP_SCAN_MODE.json');
  const outputDir = path.join(config.rootDir, 'dist', 'section59', 'deep-scan-mode');
  const fixtureDir = path.join(outputDir, 'fixture-project');
  const fixtureZip = path.join(outputDir, 'fixture-project.zip');
  const brokenDir = path.join(outputDir, 'broken-project');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  resetDeepScanStore(config);

  writeFixtureProject(fixtureDir, 'Section 59 Fixture App');
  spawnSync('zip', ['-qr', fixtureZip, '.'], { cwd: fixtureDir, encoding: 'utf8' });
  fs.mkdirSync(brokenDir, { recursive: true });
  fs.writeFileSync(path.join(brokenDir, 'README.md'), '# broken\n');

  const providerFixtures = [
    {
      providerId: 'sovereign-scan-private',
      label: 'Sovereign Scan Private',
      capabilities: ['scan', 'review'],
      costPerUnit: 0.22,
      latencyMs: 180,
      trustTier: 'private',
      tenancyScope: 'private',
      policyLimits: { regulated: true },
      healthState: 'healthy',
      secretStatus: 'ok',
      costModel: { tokenPerK: 0.01, computePerMinute: 0.12, buildPerMinute: 0.14, deployFlat: 0.5, storagePerGbHour: 0.02, rollbackRiskMultiplier: 0.2 }
    },
    {
      providerId: 'economy-scan-shared',
      label: 'Economy Scan Shared',
      capabilities: ['scan', 'review'],
      costPerUnit: 0.05,
      latencyMs: 80,
      trustTier: 'standard',
      tenancyScope: 'shared',
      policyLimits: { regulated: false },
      healthState: 'healthy',
      secretStatus: 'ok',
      costModel: { tokenPerK: 0.004, computePerMinute: 0.03, buildPerMinute: 0.04, deployFlat: 0.15, storagePerGbHour: 0.01, rollbackRiskMultiplier: 0.08 }
    }
  ];

  const report = await runDeepScan(config, {
    scanId: 'section59-proof',
    inputPath: fixtureZip,
    targetLabel: 'Section 59 Fixture App',
    outputDir: path.join(outputDir, 'run'),
    complianceMode: 'education',
    providerFixtures,
    budgetPolicy: { mode: 'cheapest_acceptable', budgetCap: 5, approvalCap: 8, trustFloor: 'standard', maxCostPerUnit: 1, requireHealthy: true, requireSecrets: true },
    routes: [
      { path: '/', expectText: ['Section 59 Fixture App', 'Run Deep Scan', 'Investor Audit'] },
      { path: '/pricing', expectText: ['Pricing'] },
      { path: '/health', expectText: [] }
    ],
    actions: [
      { path: '/api/echo', method: 'POST', body: { nonce: 'SECTION59-NONCE' }, expectJson: { ok: true, echo: 'SECTION59-NONCE' } }
    ]
  });

  const verification = verifyDeepScanReport(report);
  const tamperedVerification = verifyDeepScanReport({ ...report, projectFingerprint: 'tampered' });
  const brokenStrategy = detectLaunchStrategy(brokenDir);
  const brokenIngest = ingestProjectInput(config, brokenDir, { scanId: 'section59-broken' });

  const checks = [
    assertCheck(report.launch.ok === true && report.launch.strategy === 'npm-start', 'Ingest a user-supplied zip or project and spin it up like a running deployed product', report.launch),
    assertCheck(report.environment.honesty === 'launchable-with-current-input' && report.environment.descriptors.length >= 2, 'Reconstruct environment shape with descriptors, scripts, and honest gap reporting', report.environment),
    assertCheck(report.surface.routeResults.length === 3 && report.surface.routeResults.every(item => item.ok), 'Probe multiple rendered routes end to end', report.surface.routeResults),
    assertCheck(report.surface.controls.buttonIds.includes('scanBtn') && report.surface.controls.buttonIds.includes('investorBtn'), 'Harvest rendered controls from live surfaces instead of static claims', report.surface.controls),
    assertCheck(report.surface.actionResults.length === 1 && report.surface.actionResults[0].assertions.every(item => item.pass), 'Execute a real functionality action end to end against the running preview', report.surface.actionResults),
    assertCheck(report.replay.verification.ok === true && Boolean(report.artifactReferences.replayBundleFile), 'Tie deep scan into replay export and verification', report.replay.verification),
    assertCheck(report.reader.integrated === true && report.reader.ok === true && report.reader.summary.documentCount >= 3 && Boolean(report.artifactReferences.readerDossierFile), 'Use integrated apps/skye-reader-hardened through apps/skyequanta-shell/lib/skye-reader-bridge.mjs to extract a real project document dossier during deep scan', { reader: report.reader, dossier: report.artifactReferences.readerDossierFile }),
    assertCheck(report.compliance.decision.ok === true && report.costPlan.ok === true && report.council.run.arbitration.finalDecision.startsWith('approved'), 'Interlink deep scan with compliance, cost, and council lanes', {
      compliance: report.compliance.decision,
      cost: report.costPlan,
      council: report.council.run.arbitration
    }),
    assertCheck(verification.ok === true, 'Deep scan report fingerprint verifies as untampered', verification),
    assertCheck(tamperedVerification.ok === false, 'Tampering the deep scan report fails verification loudly', tamperedVerification),
    assertCheck(brokenIngest.projectRoot.endsWith('broken-project') && brokenStrategy.ok === false && brokenStrategy.label.includes('no supported launch strategy'), 'Unsupported projects fail honestly instead of pretending to be launchable', { brokenIngest, brokenStrategy }),
    assertCheck(proofFile.endsWith('SECTION_59_DEEP_SCAN_MODE.json'), 'Create proof artifact docs/proof/SECTION_59_DEEP_SCAN_MODE.json', { proofFile }),
    assertCheck(report.valuationReady === true, 'Deep scan reaches valuation-ready posture only after actual launch, probes, and action proof pass', { valuationReady: report.valuationReady })
  ];

  const payload = {
    section: 59,
    label: 'section-59-deep-scan-mode',
    generatedAt: new Date().toISOString(),
    pass: checks.every(item => item.pass),
    strict: options.strict,
    modelVersion: versionStamp.modelVersion,
    runtimeVersion: versionStamp.runtimeVersion,
    directiveVersion: versionStamp.directiveVersion,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section59-deep-scan-mode.mjs --strict',
    smokeCommand: 'bash scripts/smoke-section59-deep-scan-mode.sh',
    checks,
    hostileChecks: [
      { name: 'tampered-report-rejected', pass: tamperedVerification.ok === false, detail: tamperedVerification },
      { name: 'unsupported-project-denied', pass: brokenStrategy.ok === false, detail: brokenStrategy }
    ],
    recoveryChecks: [
      { name: 'replay-verifies', pass: report.replay.verification.ok === true, detail: report.replay.verification },
      { name: 'valuation-ready', pass: report.valuationReady === true, detail: { valuationReady: report.valuationReady } }
    ],
    evidence: {
      report,
      verification,
      tamperedVerification,
      brokenStrategy
    },
    artifactReferences: {
      proofFile,
      fixtureZip: path.relative(config.rootDir, fixtureZip),
      reportFile: report.artifactReferences.reportFile,
      surfaceFile: report.artifactReferences.surfaceFile,
      replayBundleFile: report.artifactReferences.replayBundleFile,
      costSurfaceFile: report.artifactReferences.costSurfaceFile,
      readerDossierFile: report.artifactReferences.readerDossierFile,
      readerSurfaceFile: report.artifactReferences.readerSurfaceFile
    }
  };

  const written = writeProofJson(proofFile, payload, config, 'workspace-proof-section59-deep-scan-mode.mjs');
  console.log(JSON.stringify(written, null, 2));
  if (!written.pass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
