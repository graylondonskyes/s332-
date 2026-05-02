#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import { resetDeepScanStore, runDeepScan } from '../lib/deep-scan-mode.mjs';
import { runValuationAuditMode } from '../lib/valuation-audit-mode.mjs';

function parseArgs(argv) {
  return { strict: argv.includes('--strict'), json: argv.includes('--json') };
}

function writeFixtureProject(targetDir, label, richness = 'rich') {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify({
    name: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    version: '1.0.0',
    type: 'module',
    scripts: { start: 'node server.mjs' }
  }, null, 2));
  const extraRoute = richness === 'rich' ? `
  if (req.method === 'GET' && req.url === '/investor') {
    return send(res, 200, '<!doctype html><html><body><h1>Investor</h1><button id="investorDeck">Deck</button></body></html>', 'text/html; charset=utf-8');
  }` : '';
  const extraControls = richness === 'rich' ? '<button id="pricingBtn">Pricing</button><a href="/investor">Investor</a>' : '';
  fs.writeFileSync(path.join(targetDir, 'server.mjs'), `
import http from 'node:http';
const port = Number(process.env.PORT || 4320);
function send(res, status, body, type='application/json; charset=utf-8') { res.writeHead(status, { 'content-type': type }); res.end(body); }
const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    return send(res, 200, '<!doctype html><html><head><title>${label}</title></head><body><h1>${label}</h1><button id="launchBtn">Launch</button>${extraControls}<form action="/api/echo" method="post"><input name="nonce" /></form></body></html>', 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, JSON.stringify({ ok: true, label: '${label}' }));
  }
  if (req.method === 'GET' && req.url === '/pricing') {
    return send(res, 200, '<!doctype html><html><body><h1>Pricing</h1></body></html>', 'text/html; charset=utf-8');
  }${extraRoute}
  if (req.method === 'POST' && req.url === '/api/echo') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body || '{}');
    return send(res, 200, JSON.stringify({ ok: true, echo: payload.nonce || null }));
  }
  return send(res, 404, JSON.stringify({ ok: false, path: req.url }), 'application/json; charset=utf-8');
});
server.listen(port, '127.0.0.1');
`);
  fs.mkdirSync(path.join(targetDir, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'public'), { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'README.md'), `# ${label}\n\n${richness === 'rich' ? 'Investor proof, pricing, compliance, replay, and valuation surfaces are documented here.' : 'Minimal launch note.'}`);
  if (richness === 'rich') {
    fs.writeFileSync(path.join(targetDir, 'docs', 'pricing.md'), `# Pricing\n\nSubscription, billing, checkout, and plan tiers for ${label}.`);
    fs.writeFileSync(path.join(targetDir, 'docs', 'security.md'), `# Security\n\nCompliance, audit, policy, retention, and proof controls for ${label}.`);
    fs.writeFileSync(path.join(targetDir, 'public', 'investor.html'), `<!doctype html><html><body><h1>${label} Investor Surface</h1><p>Valuation, revenue, audit, and replay evidence.</p></body></html>`);
  }
  fs.writeFileSync(path.join(targetDir, 'wrangler.toml'), 'name = "fixture"\ncompatibility_date = "2026-04-07"\n');
  fs.writeFileSync(path.join(targetDir, 'netlify.toml'), '[build]\npublish = "."\n');
}

async function deepScanFixture(config, outputDir, fixtureName, port, richness) {
  const projectDir = path.join(outputDir, `${fixtureName}-source`);
  const zipPath = path.join(outputDir, `${fixtureName}.zip`);
  writeFixtureProject(projectDir, fixtureName, richness);
  spawnSync('zip', ['-qr', zipPath, '.'], { cwd: projectDir, encoding: 'utf8' });
  return runDeepScan(config, {
    scanId: `${fixtureName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-scan`,
    inputPath: zipPath,
    targetLabel: fixtureName,
    outputDir: path.join(outputDir, `${fixtureName}-scan`),
    complianceMode: 'education',
    providerFixtures: [
      {
        providerId: 'valuation-private',
        label: 'Valuation Private',
        capabilities: ['scan', 'review'],
        costPerUnit: 0.1,
        latencyMs: 140,
        trustTier: 'private',
        tenancyScope: 'private',
        policyLimits: { regulated: true },
        healthState: 'healthy',
        secretStatus: 'ok',
        costModel: { tokenPerK: 0.005, computePerMinute: 0.06, buildPerMinute: 0.08, deployFlat: 0.2, storagePerGbHour: 0.01, rollbackRiskMultiplier: 0.06 }
      },
      {
        providerId: 'valuation-economy',
        label: 'Valuation Economy',
        capabilities: ['scan', 'review'],
        costPerUnit: 0.03,
        latencyMs: 70,
        trustTier: 'standard',
        tenancyScope: 'shared',
        policyLimits: { regulated: false },
        healthState: 'healthy',
        secretStatus: 'ok',
        costModel: { tokenPerK: 0.002, computePerMinute: 0.03, buildPerMinute: 0.04, deployFlat: 0.1, storagePerGbHour: 0.01, rollbackRiskMultiplier: 0.04 }
      }
    ],
    budgetPolicy: { mode: 'cheapest_acceptable', budgetCap: 4, approvalCap: 8, trustFloor: 'standard', maxCostPerUnit: 1, requireHealthy: true, requireSecrets: true },
    port,
    routes: richness === 'rich'
      ? [
          { path: '/', expectText: [fixtureName, 'Launch'] },
          { path: '/pricing', expectText: ['Pricing'] },
          { path: '/investor', expectText: ['Investor'] },
          { path: '/health', expectText: [] }
        ]
      : [
          { path: '/', expectText: [fixtureName, 'Launch'] },
          { path: '/health', expectText: [] }
        ],
    actions: [
      { path: '/api/echo', method: 'POST', body: { nonce: `${fixtureName}-NONCE` }, expectJson: { ok: true, echo: `${fixtureName}-NONCE` } }
    ]
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section60-valuation-audit-mode.mjs');

  const versionStamp = JSON.parse(fs.readFileSync(path.join(config.rootDir, 'docs', 'VERSION_STAMP.json'), 'utf8'));
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_60_VALUATION_AUDIT_MODE.json');
  const outputDir = path.join(config.rootDir, 'dist', 'section60', 'valuation-audit-mode');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  resetDeepScanStore(config);

  const richScan = await deepScanFixture(config, outputDir, 'Section 60 Rich Fixture', 4320, 'rich');
  const shallowScan = await deepScanFixture(config, outputDir, 'Section 60 Shallow Fixture', 4321, 'shallow');

  const valuation = runValuationAuditMode(config, {
    deepScanReport: richScan,
    outputDir: path.join(outputDir, 'rich-valuation')
  });
  const shallowValuation = runValuationAuditMode(config, {
    deepScanReport: shallowScan,
    outputDir: path.join(outputDir, 'shallow-valuation')
  });

  let tamperedError = null;
  try {
    runValuationAuditMode(config, {
      deepScanReport: { ...richScan, fingerprint: 'tampered' },
      outputDir: path.join(outputDir, 'tampered-valuation')
    });
  } catch (error) {
    tamperedError = error instanceof Error ? error.message : String(error);
  }

  let missingTemplateError = null;
  try {
    runValuationAuditMode(config, {
      deepScanReport: richScan,
      outputDir: path.join(outputDir, 'missing-template-valuation'),
      templatePath: path.join(outputDir, 'does-not-exist.html')
    });
  } catch (error) {
    missingTemplateError = error instanceof Error ? error.message : String(error);
  }

  const websiteHtml = fs.readFileSync(path.join(config.rootDir, valuation.artifactReferences.auditWebsiteFile), 'utf8');
  const auditVerification = JSON.parse(fs.readFileSync(path.join(config.rootDir, valuation.artifactReferences.auditVerificationFile), 'utf8'));

  const checks = [
    assertCheck(valuation.valuation.valuationUsd > 0 && valuation.valuation.confidence === 'high', 'Produce a real single-number valuation from a launch-backed deep scan report', valuation.valuation),
    assertCheck(websiteHtml.includes('data-template-id="investor-audit-base-v1"') && websiteHtml.includes('Investor Audit Website'), 'Generate an investor-ready audit website from the base template file', { templatePath: valuation.templatePath }),
    assertCheck(auditVerification.templateMarkerRetained === true && auditVerification.websiteContainsValuation === true, 'Use the template as the base surface rather than bypassing it', auditVerification),
    assertCheck(valuation.evidence.bundleValidation.ok === true && valuation.evidence.attestationValidation.ok === true, 'Tie valuation mode into ProofOps evidence-pack validation and attestation', {
      bundle: valuation.evidence.bundleValidation,
      attestation: valuation.evidence.attestationValidation
    }),
    assertCheck(websiteHtml.includes(richScan.artifactReferences.replayBundleFile) && valuation.artifactReferences.replayBundleFile.endsWith('replay-bundle.json'), 'Link valuation mode to replay evidence from the deep scan run', {
      replayInWebsite: richScan.artifactReferences.replayBundleFile,
      replayArtifact: valuation.artifactReferences.replayBundleFile
    }),
    assertCheck(richScan.reader.integrated === true && richScan.reader.summary.documentCount > shallowScan.reader.summary.documentCount && websiteHtml.includes('Reader dossier') && Boolean(valuation.artifactReferences.readerDossierFile), 'Use integrated apps/skye-reader-hardened dossier output to enrich valuation scoring and the investor audit website', {
      richReader: richScan.reader.summary,
      shallowReader: shallowScan.reader.summary,
      readerArtifact: valuation.artifactReferences.readerDossierFile
    }),
    assertCheck(valuation.valuation.valuationUsd > shallowValuation.valuation.valuationUsd, 'Deeper proven functionality produces a higher valuation than a shallower surface', {
      rich: valuation.valuation,
      shallow: shallowValuation.valuation
    }),
    assertCheck(Boolean(tamperedError) && tamperedError.includes('fingerprint mismatch'), 'Tampered deep scan reports are denied by valuation mode', { tamperedError }),
    assertCheck(Boolean(missingTemplateError) && missingTemplateError.includes('template'), 'Missing valuation templates fail loudly instead of silently falling back', { missingTemplateError }),
    assertCheck(valuation.council.run.arbitration.finalDecision.startsWith('approved'), 'Valuation mode interlinks with the council lane for investor packet generation', valuation.council.run.arbitration),
    assertCheck(proofFile.endsWith('SECTION_60_VALUATION_AUDIT_MODE.json'), 'Create proof artifact docs/proof/SECTION_60_VALUATION_AUDIT_MODE.json', { proofFile }),
    assertCheck(websiteHtml.includes('Skyes Over London') && websiteHtml.includes('SOLEnterprises.org'), 'Investor audit website includes contact details block', { containsContact: true }),
    assertCheck(auditVerification.websiteContainsReaderSummary === true, 'Valuation audit verification proves the reader dossier materially survived into the generated website', auditVerification)
  ];

  const payload = {
    section: 60,
    label: 'section-60-valuation-audit-mode',
    generatedAt: new Date().toISOString(),
    pass: checks.every(item => item.pass),
    strict: options.strict,
    modelVersion: versionStamp.modelVersion,
    runtimeVersion: versionStamp.runtimeVersion,
    directiveVersion: versionStamp.directiveVersion,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section60-valuation-audit-mode.mjs --strict',
    smokeCommand: 'bash scripts/smoke-section60-valuation-audit-mode.sh',
    checks,
    hostileChecks: [
      { name: 'tampered-deep-scan-denied', pass: Boolean(tamperedError), detail: tamperedError },
      { name: 'missing-template-fails-loudly', pass: Boolean(missingTemplateError), detail: missingTemplateError }
    ],
    recoveryChecks: [
      { name: 'evidence-pack-validates', pass: valuation.evidence.bundleValidation.ok === true, detail: valuation.evidence.bundleValidation },
      { name: 'attestation-verifies', pass: valuation.evidence.attestationValidation.ok === true, detail: valuation.evidence.attestationValidation }
    ],
    evidence: {
      richScan,
      shallowScan,
      valuation,
      shallowValuation,
      auditVerification
    },
    artifactReferences: {
      proofFile,
      auditWebsiteFile: valuation.artifactReferences.auditWebsiteFile,
      valuationSummaryFile: valuation.artifactReferences.valuationSummaryFile,
      valuationNoteFile: valuation.artifactReferences.valuationNoteFile,
      evidenceBundleFile: valuation.artifactReferences.evidenceBundleFile,
      evidenceAttestationFile: valuation.artifactReferences.evidenceAttestationFile,
      trustSurfaceFile: valuation.artifactReferences.trustSurfaceFile,
      readerDossierFile: valuation.artifactReferences.readerDossierFile,
      templatePath: valuation.artifactReferences.templatePath
    }
  };

  const written = writeProofJson(proofFile, payload, config, 'workspace-proof-section60-valuation-audit-mode.mjs');
  console.log(JSON.stringify(written, null, 2));
  if (!written.pass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
