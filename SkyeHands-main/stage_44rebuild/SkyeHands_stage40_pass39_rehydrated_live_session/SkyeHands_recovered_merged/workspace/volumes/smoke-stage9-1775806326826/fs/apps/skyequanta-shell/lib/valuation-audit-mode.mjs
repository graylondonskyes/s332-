
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { signProvenancePayload } from './release-provenance.mjs';
import { generateTrustSurfaceHtml, validateEvidencePack, verifyProofOpsAttestation } from './proofops.mjs';
import { orchestrateCouncilRun } from './kaixu-council.mjs';
import { verifyDeepScanReport } from './deep-scan-mode.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

function writeText(filePath, value) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, String(value), 'utf8');
  return filePath;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function stableHash(value) {
  const canonical = JSON.stringify(value, Object.keys(value).sort());
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function currency(value) {
  return `$${Number(value || 0).toLocaleString('en-US')} USD`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function computeValuationModel(deepScanReport, options = {}) {
  const routesPassed = (deepScanReport.surface?.routeResults || []).filter(item => item.ok && item.bodyContains.every(row => row.pass)).length;
  const actionsPassed = (deepScanReport.surface?.actionResults || []).filter(item => item.ok && item.assertions.every(row => row.pass)).length;
  const controls = (deepScanReport.surface?.controls?.buttonIds || []).length
    + (deepScanReport.surface?.controls?.forms || []).length
    + (deepScanReport.surface?.controls?.links || []).length;
  const descriptors = Array.isArray(deepScanReport.environment?.descriptors) ? deepScanReport.environment.descriptors.length : 0;
  const proofIntegrations = [
    deepScanReport.replay?.verification?.ok,
    deepScanReport.compliance?.decision?.ok,
    deepScanReport.costPlan?.ok,
    deepScanReport.council?.run?.arbitration?.finalDecision?.startsWith('approved')
  ].filter(Boolean).length;
  const fileCount = Number(deepScanReport.environment?.projectFileCount || 0);
  const readerDocs = Number(deepScanReport.reader?.summary?.documentCount || 0);
  const readerSignals = Number(deepScanReport.reader?.summary?.totalKeywordHits || 0);
  const readerCharacters = Number(deepScanReport.reader?.summary?.extractedCharacters || 0);
  const mirrorServices = Number(deepScanReport.environmentMirror?.services?.length || 0);
  const mirrorEnvVars = Number(deepScanReport.environmentMirror?.envVars?.length || 0);
  const mirrorConflicts = Number(deepScanReport.environmentMirror?.gapReport?.conflicts?.length || 0);
  const autonomyMode = String(deepScanReport.autonomy?.decision?.effectiveModeId || 'unknown');
  const autonomyMultiplier = autonomyMode === 'suggest-only' ? 0 : autonomyMode === 'draft-and-wait' ? 1 : autonomyMode === 'execute-with-review-gates' ? 2 : autonomyMode === 'full-autonomous' ? 3 : autonomyMode === 'continuous-maintenance-mode' ? 4 : 0;
  const foundryReady = Boolean(deepScanReport.foundrySignals?.foundryReady);
  const maintenanceCandidates = Number(deepScanReport.maintenanceSignals?.maintenanceCandidateCount || 0);
  const commercialSignals = Number(deepScanReport.commercialSignals?.proprietarySignals || 0) + Number(deepScanReport.commercialSignals?.whiteLabelSignals || 0);
  const devGlowSurfaces = Number(deepScanReport.devGlowSignals?.surfaceCount || 0);
  const registeredLaunchProfiles = Number(deepScanReport.registeredPlatform?.readyLaunchProfileCount || 0);
  const registeredBranchApps = Number(deepScanReport.registeredPlatform?.branchAppCount || 0);
  const launchPassed = Boolean(deepScanReport.launch?.ok);
  const valuation = Math.round(
    85000
    + (launchPassed ? 90000 : 0)
    + (routesPassed * 30000)
    + (actionsPassed * 50000)
    + (Math.min(controls, 12) * 6000)
    + (Math.min(descriptors, 8) * 12000)
    + (proofIntegrations * 35000)
    + (Math.min(fileCount, 120) * 900)
    + (Math.min(readerDocs, 8) * 9000)
    + (Math.min(readerSignals, 24) * 4000)
    + (Math.min(Math.floor(readerCharacters / 800), 18) * 3500)
    + (Math.min(mirrorServices, 6) * 18000)
    + (Math.min(mirrorEnvVars, 12) * 4500)
    + (autonomyMultiplier * 22000)
    + (foundryReady ? 85000 : 0)
    + (Math.min(maintenanceCandidates, 8) * 14000)
    + (Math.min(commercialSignals, 8) * 16000)
    + (Math.min(devGlowSurfaces, 12) * 7000)
    + (Math.min(registeredLaunchProfiles, 6) * 18000)
    + (Math.min(registeredBranchApps, 12) * 9000)
    - (mirrorConflicts * 15000)
  );
  return {
    valuationUsd: valuation,
    category: options.category || 'Provable Autonomous Product Audit',
    confidence: deepScanReport.valuationReady ? 'high' : 'constrained',
    metrics: {
      launchPassed,
      routesPassed,
      actionsPassed,
      controls,
      descriptors,
      proofIntegrations,
      fileCount,
      readerDocs,
      readerSignals,
      readerCharacters,
      mirrorServices,
      mirrorEnvVars,
      mirrorConflicts,
      autonomyMode,
      foundryReady,
      maintenanceCandidates,
      commercialSignals,
      devGlowSurfaces,
      registeredLaunchProfiles,
      registeredBranchApps
    },
    why: [
      launchPassed ? 'Project launched in a deployed-style local preview during deep scan.' : 'Project did not fully launch during deep scan.',
      `${routesPassed} route probes passed.`,
      `${actionsPassed} end-to-end action probes passed.`,
      `${proofIntegrations} proof integrations linked into the valuation lane.`,
      `${descriptors} deployment/runtime descriptors were discovered.`,
      `${controls} visible controls were harvested from rendered surfaces.`,
      `${readerDocs} document dossier items were extracted through the integrated Skye Reader lane.`,
      `${readerSignals} reader-derived product, proof, monetization, and compliance signals were harvested.`,
      `${mirrorServices} mirrored services and ${mirrorEnvVars} mirrored environment variables were reconstructed.`,
      `Autonomy posture during deep scan was '${autonomyMode}'.`,
      foundryReady ? 'Foundry white-label signals were detected in the scanned project.' : 'No strong foundry white-label posture was detected.',
      `${maintenanceCandidates} maintenance candidates were detected.`,
      `${commercialSignals} ownership/commercial restriction signals were detected.`,
      `${devGlowSurfaces} DevGlow surface mappings were inferred.`,
      `${registeredLaunchProfiles} registered platform launch profiles and ${registeredBranchApps} branch apps were linked through the launchpad lane.`
    ]
  };
}

function buildMetricCards(model, report) {
  const cards = [
    ['Target', report.targetLabel],
    ['Valuation', currency(model.valuationUsd)],
    ['Routes passed', String(model.metrics.routesPassed)],
    ['Actions passed', String(model.metrics.actionsPassed)],
    ['Controls found', String(model.metrics.controls)],
    ['Descriptors', String(model.metrics.descriptors)],
    ['Proof integrations', String(model.metrics.proofIntegrations)],
    ['Reader docs', String(model.metrics.readerDocs)],
    ['Reader signals', String(model.metrics.readerSignals)],
    ['Mirror services', String(model.metrics.mirrorServices)],
    ['Autonomy', String(model.metrics.autonomyMode)],
    ['Launchpad profiles', String(model.metrics.registeredLaunchProfiles)],
    ['Branch apps', String(model.metrics.registeredBranchApps)],
    ['Confidence', model.confidence.toUpperCase()]
  ];
  return cards.map(([label, value]) => `<div class="metric"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`).join('');
}

function buildRouteRows(report) {
  return (report.surface?.routeResults || []).map(item => `<tr><td>${escapeHtml(item.path)}</td><td>${item.ok ? 'PASS' : 'FAIL'}</td><td>${escapeHtml((item.surface?.buttonIds || []).join(', ') || 'n/a')}</td><td>${escapeHtml((item.bodyContains || []).filter(row => row.pass).map(row => row.value).join(', '))}</td></tr>`).join('');
}

function buildActionRows(report) {
  return (report.surface?.actionResults || []).map(item => `<tr><td>${escapeHtml(item.method)}</td><td>${escapeHtml(item.path)}</td><td>${item.ok ? 'PASS' : 'FAIL'}</td><td>${escapeHtml((item.assertions || []).map(row => `${row.key}:${row.actual}`).join(', '))}</td></tr>`).join('');
}

function buildDescriptorRows(report) {
  return (report.environment?.descriptors || []).map(item => `<tr><td>${escapeHtml(item.relativePath)}</td><td>${escapeHtml(String(item.sizeBytes))}</td><td><code>${escapeHtml(item.sha256.slice(0, 20))}…</code></td></tr>`).join('');
}

function buildReaderRows(report) {
  return (report.reader?.documents || []).map(item => `<tr><td>${escapeHtml(item.relativePath)}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(String(item.extractedCharacters || 0))}</td><td>${escapeHtml(String(item.text || '').replace(/\s+/g, ' ').trim().slice(0, 120))}</td></tr>`).join('');
}

export function applyAuditTemplate(templateHtml, payload) {
  return String(templateHtml)
    .replaceAll('__AUDIT_TITLE__', escapeHtml(payload.auditTitle))
    .replaceAll('__EYEBROW__', escapeHtml(payload.eyebrow))
    .replaceAll('__HEADLINE__', escapeHtml(payload.headline))
    .replaceAll('__SUBTITLE__', escapeHtml(payload.subtitle))
    .replaceAll('__METRIC_CARDS__', payload.metricCards)
    .replaceAll('__THESIS__', escapeHtml(payload.thesis))
    .replaceAll('__WHY_LIST__', payload.whyList)
    .replaceAll('__ROUTE_ROWS__', payload.routeRows)
    .replaceAll('__ACTION_ROWS__', payload.actionRows)
    .replaceAll('__DESCRIPTOR_ROWS__', payload.descriptorRows)
    .replaceAll('__READER_SUMMARY__', escapeHtml(payload.readerSummary))
    .replaceAll('__READER_ROWS__', payload.readerRows)
    .replaceAll('__EVIDENCE_JSON__', escapeHtml(payload.evidenceJson))
    .replaceAll('__CONTACT_BLOCK__', payload.contactBlock)
    .replaceAll('__TEMPLATE_ID__', escapeHtml(payload.templateId))
    .replaceAll('__GENERATED_AT__', escapeHtml(payload.generatedAt));
}

export function createValuationEvidencePack(rootDir, outputDir, payload) {
  const artifacts = [
    ['valuation-summary.json', payload.valuationSummaryFile],
    ['valuation-note.md', payload.valuationNoteFile],
    ['investor-audit-website.html', payload.auditWebsiteFile],
    ['valuation-audit-verification.json', payload.auditVerificationFile],
    ['replay/replay-bundle.json', payload.replayBundleFile],
    ...(payload.readerDossierFile ? [['reader/reader-dossier.json', payload.readerDossierFile]] : [])
  ];
  const artifactHashes = artifacts.map(([relative, absolute]) => ({ path: relative, sha256: sha256File(absolute) }));
  const bundle = {
    version: 1,
    generatedAt: new Date().toISOString(),
    label: 'valuation-audit-evidence-pack',
    runId: payload.runId,
    replayRefs: ['replay/replay-bundle.json'],
    readerRefs: payload.readerDossierFile ? ['reader/reader-dossier.json'] : [],
    auditVerificationRef: 'valuation-audit-verification.json',
    requiredArtifacts: artifactHashes.map(item => item.path),
    expectedArtifactHashes: Object.fromEntries(artifactHashes.map(item => [item.path, item.sha256]))
  };
  const bundleFile = writeJson(path.join(outputDir, 'evidence-pack.json'), bundle);
  const unsigned = {
    version: 1,
    generatedAt: new Date().toISOString(),
    label: 'valuation-audit-attestation',
    runId: payload.runId,
    bundlePath: 'evidence-pack.json',
    bundleSha256: sha256File(bundleFile),
    artifactSetSha256: stableHash(bundle.expectedArtifactHashes)
  };
  const signed = signProvenancePayload(unsigned, { generateKeypair: true });
  const attestationFile = writeJson(path.join(outputDir, 'evidence-attestation.json'), signed.attestation);
  const bundleValidation = validateEvidencePack(bundleFile);
  const attestationValidation = verifyProofOpsAttestation(attestationFile, bundleFile);
  const trustSurfaceFile = writeText(path.join(outputDir, 'valuation-trust-surface.html'), generateTrustSurfaceHtml({
    generatedAt: new Date().toISOString(),
    pass: bundleValidation.ok && attestationValidation.ok,
    bundlePath: 'evidence-pack.json',
    attestationPath: 'evidence-attestation.json',
    redactedBundlePath: 'not-used-for-valuation-mode',
    missingEvidence: bundleValidation.missingArtifacts,
    checks: [
      { label: 'valuation evidence pack validates', pass: bundleValidation.ok },
      { label: 'valuation attestation verifies', pass: attestationValidation.ok }
    ]
  }));
  return {
    bundleFile,
    attestationFile,
    trustSurfaceFile,
    bundleValidation,
    attestationValidation
  };
}

export function runValuationAuditMode(config, request = {}) {
  const deepScanReport = request.deepScanReport;
  const verification = verifyDeepScanReport(deepScanReport);
  if (!verification.ok) {
    throw new Error('Valuation mode denied: deep scan report fingerprint mismatch.');
  }
  if (!deepScanReport.valuationReady) {
    throw new Error('Valuation mode denied: deep scan has not produced a valuation-ready proof posture.');
  }
  const templatePath = path.resolve(request.templatePath || path.join(config.rootDir, 'docs', 'templates', 'INVESTOR_AUDIT_WEBSITE_BASE_TEMPLATE.html'));
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Valuation audit template was not found: ${templatePath}`);
  }
  const outputDir = path.resolve(request.outputDir || path.join(config.rootDir, 'dist', 'section60', deepScanReport.scanId));
  fs.rmSync(outputDir, { recursive: true, force: true });
  ensureDirectory(outputDir);

  const model = computeValuationModel(deepScanReport, request);
  const council = orchestrateCouncilRun(config, {
    taskId: `${deepScanReport.scanId}-valuation`,
    summary: `Value ${deepScanReport.targetLabel}`,
    objective: `Produce investor-facing valuation packet for ${deepScanReport.targetLabel}`,
    filesInScope: [
      deepScanReport.artifactReferences?.reportFile,
      deepScanReport.artifactReferences?.replayBundleFile,
      deepScanReport.artifactReferences?.readerDossierFile,
      'docs/templates/INVESTOR_AUDIT_WEBSITE_BASE_TEMPLATE.html'
    ].filter(Boolean)
  }, { runId: `${deepScanReport.scanId}-valuation` });

  const contactBlock = `
    <div class="contact-block">
      <strong>Skyes Over London</strong><br />
      SkyesOverLondonLC@solenterprises.org<br />
      480-469-5416<br />
      SOLEnterprises.org
    </div>`;
  const payload = {
    templateId: 'investor-audit-base-v1',
    auditTitle: `${deepScanReport.targetLabel} · Investor Audit`,
    eyebrow: 'Skyes Over London · Deep Scan Valuation Mode',
    headline: `${deepScanReport.targetLabel} — Investor Audit Website`,
    subtitle: 'Generated from a launch-backed deep scan, replay evidence, and valuation-mode scoring.',
    thesis: `${deepScanReport.targetLabel} was ingested from user-supplied project material, reconstructed into a launchable environment, tested end to end, and priced from actual proof-backed depth instead of brochure language.`,
    metricCards: buildMetricCards(model, deepScanReport),
    whyList: model.why.map(item => `<li>${escapeHtml(item)}</li>`).join(''),
    routeRows: buildRouteRows(deepScanReport),
    actionRows: buildActionRows(deepScanReport),
    descriptorRows: buildDescriptorRows(deepScanReport),
    readerSummary: `Integrated reader dossier extracted ${Number(deepScanReport.reader?.summary?.documentCount || 0)} documents, ${Number(deepScanReport.reader?.summary?.extractedCharacters || 0)} characters, and ${Number(deepScanReport.reader?.summary?.totalKeywordHits || 0)} product/proof/compliance/monetization signals. ${deepScanReport.registeredPlatform ? `Launchpad linked ${Number(deepScanReport.registeredPlatform.readyLaunchProfileCount || 0)} ready profiles and ${Number(deepScanReport.registeredPlatform.branchAppCount || 0)} branch apps.` : ''}`.trim(),
    readerRows: buildReaderRows(deepScanReport),
    evidenceJson: JSON.stringify({
      valuation: model,
      deepScan: {
        scanId: deepScanReport.scanId,
        replayBundle: deepScanReport.artifactReferences?.replayBundleFile,
        councilDecision: deepScanReport.council?.run?.arbitration,
        compliance: deepScanReport.compliance?.decision,
        costPlan: deepScanReport.costPlan?.status || deepScanReport.costPlan?.reason,
        readerDossier: deepScanReport.artifactReferences?.readerDossierFile,
        readerSummary: deepScanReport.reader?.summary,
        autonomy: deepScanReport.autonomy,
        environmentMirror: deepScanReport.environmentMirror,
        registeredPlatform: deepScanReport.registeredPlatform
      },
      valuationCouncil: council.run?.arbitration
    }, null, 2),
    contactBlock,
    generatedAt: new Date().toISOString()
  };
  const templateHtml = fs.readFileSync(templatePath, 'utf8');
  const finalHtml = applyAuditTemplate(templateHtml, payload);
  const auditWebsiteFile = writeText(path.join(outputDir, 'investor-audit-website.html'), finalHtml);
  const summary = {
    generatedAt: new Date().toISOString(),
    targetLabel: deepScanReport.targetLabel,
    valuationUsd: model.valuationUsd,
    confidence: model.confidence,
    category: model.category,
    councilDecision: council.run?.arbitration,
    deepScanFingerprint: deepScanReport.fingerprint,
    templatePath: path.relative(config.rootDir, templatePath),
    replayBundle: deepScanReport.artifactReferences?.replayBundleFile,
    readerDossier: deepScanReport.artifactReferences?.readerDossierFile,
    readerSummary: deepScanReport.reader?.summary
  };
  const valuationSummaryFile = writeJson(path.join(outputDir, 'valuation-summary.json'), summary);
  const valuationNoteFile = writeText(path.join(outputDir, 'valuation-note.md'), `# ${deepScanReport.targetLabel} — Valuation Note\n\nValuation: ${currency(model.valuationUsd)}\n\nConfidence: ${model.confidence}\n\nReasoning:\n\n${model.why.map(item => `- ${item}`).join('\n')}\n`);
  const auditVerificationFile = writeJson(path.join(outputDir, 'valuation-audit-verification.json'), {
    generatedAt: new Date().toISOString(),
    ok: true,
    deepScanVerified: verification,
    templatePath: path.relative(config.rootDir, templatePath),
    websiteContainsValuation: finalHtml.includes(currency(model.valuationUsd)),
    websiteContainsReplayRef: finalHtml.includes(deepScanReport.artifactReferences?.replayBundleFile || ''),
    websiteContainsReaderSummary: finalHtml.includes(String(deepScanReport.reader?.summary?.documentCount || 0)) && finalHtml.includes(String(deepScanReport.reader?.summary?.totalKeywordHits || 0)),
    templateMarkerRetained: finalHtml.includes('data-template-id="investor-audit-base-v1"')
  });

  const replaySource = path.join(config.rootDir, deepScanReport.artifactReferences.replayBundleFile);
  const replayDir = path.join(outputDir, 'replay');
  ensureDirectory(replayDir);
  const replayBundleFile = path.join(replayDir, 'replay-bundle.json');
  fs.copyFileSync(replaySource, replayBundleFile);
  let readerDossierFile = null;
  if (deepScanReport.artifactReferences?.readerDossierFile) {
    const readerSource = path.join(config.rootDir, deepScanReport.artifactReferences.readerDossierFile);
    if (fs.existsSync(readerSource)) {
      const readerDir = path.join(outputDir, 'reader');
      ensureDirectory(readerDir);
      readerDossierFile = path.join(readerDir, 'reader-dossier.json');
      fs.copyFileSync(readerSource, readerDossierFile);
    }
  }

  const evidence = createValuationEvidencePack(config.rootDir, outputDir, {
    runId: `${deepScanReport.scanId}-valuation`,
    valuationSummaryFile,
    valuationNoteFile,
    auditWebsiteFile,
    auditVerificationFile,
    replayBundleFile,
    readerDossierFile
  });

  return {
    generatedAt: new Date().toISOString(),
    targetLabel: deepScanReport.targetLabel,
    valuation: model,
    council,
    auditWebsiteFile,
    valuationSummaryFile,
    valuationNoteFile,
    auditVerificationFile,
    templatePath: path.relative(config.rootDir, templatePath),
    evidence,
    artifactReferences: {
      auditWebsiteFile: path.relative(config.rootDir, auditWebsiteFile),
      valuationSummaryFile: path.relative(config.rootDir, valuationSummaryFile),
      valuationNoteFile: path.relative(config.rootDir, valuationNoteFile),
      auditVerificationFile: path.relative(config.rootDir, auditVerificationFile),
      evidenceBundleFile: path.relative(config.rootDir, evidence.bundleFile),
      evidenceAttestationFile: path.relative(config.rootDir, evidence.attestationFile),
      trustSurfaceFile: path.relative(config.rootDir, evidence.trustSurfaceFile),
      replayBundleFile: path.relative(config.rootDir, replayBundleFile),
      readerDossierFile: readerDossierFile ? path.relative(config.rootDir, readerDossierFile) : null,
      templatePath: path.relative(config.rootDir, templatePath)
    }
  };
}
