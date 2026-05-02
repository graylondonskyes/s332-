import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const dataDir = path.join(rootDir, 'data');
const workspacesDir = path.join(dataDir, 'workspaces');
const configDir = path.join(rootDir, 'config');
const docsDir = path.join(rootDir, 'docs');

for (const dir of [dataDir, workspacesDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

const PORT = Number(process.env.PORT || 4317);

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function notFound(res) {
  json(res, 404, { ok: false, error: 'not_found' });
}

function sanitizeFileName(value, fallback = 'upload.zip') {
  const clean = String(value || fallback).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return clean || fallback;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', chunk => {
      total += chunk.length;
      if (total > 1024 * 1024 * 200) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function runPython(scriptName, args) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(rootDir, 'tools', scriptName);
    const child = spawn('python3', [scriptPath, ...args], {
      cwd: rootDir,
      env: {
        ...process.env,
        SKYEHANDS_VCS_ROOT: rootDir
      }
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`python_failed:${scriptName}:${code}:${stderr || stdout}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function readJsonFile(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function workspacePaths(workspaceId) {
  const baseDir = path.join(workspacesDir, workspaceId);
  return {
    baseDir,
    intakeDir: path.join(baseDir, 'intake'),
    runtimeDir: path.join(baseDir, 'runtime'),
    artifactsDir: path.join(baseDir, 'artifacts'),
    logsDir: path.join(baseDir, 'logs'),
    workspaceFile: path.join(baseDir, 'workspace.json')
  };
}

function writeWorkspace(payload) {
  const paths = workspacePaths(payload.workspaceId);
  fs.mkdirSync(paths.baseDir, { recursive: true });
  fs.writeFileSync(paths.workspaceFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function getWorkspace(workspaceId) {
  const paths = workspacePaths(workspaceId);
  return readJsonFile(paths.workspaceFile, null);
}

function listWorkspaces() {
  if (!fs.existsSync(workspacesDir)) return [];
  return fs.readdirSync(workspacesDir)
    .map(name => getWorkspace(name))
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

function effectiveReport(workspace) {
  return workspace?.patchedReport || workspace?.report || null;
}

function portfolioSummary() {
  const workspaces = listWorkspaces();
  const issuedValues = [];
  const overallScores = [];
  const patchDeltas = [];
  const confidenceCounts = {};
  const certificationCounts = {};
  let patchedWorkspaceCount = 0;
  let enterpriseReadyCount = 0;
  let sovereignWorkspaceCount = 0;
  let issueTotal = 0;

  const confidenceMap = { low: 35, medium: 67, high: 92 };
  const confidencePoints = [];

  const rows = workspaces.slice(0, 100).map(item => {
    const report = effectiveReport(item) || {};
    const valuation = report?.valuation || {};
    const issuedValue = Number(item?.summary?.issuedValue || valuation?.values?.issuedSkyeHandsCertificationValue || 0);
    const overallScore = Number(item?.summary?.overallScore || valuation?.overallScore || 0);
    const confidence = valuation?.confidence || 'low';
    const certification = item?.summary?.certification || valuation?.certification?.label || 'Unknown';
    const patchDelta = Number(item?.patchLab?.issuedValueDelta || 0);
    const issueCount = Array.isArray(report?.issues) ? report.issues.length : 0;
    const certLevel = Number(valuation?.certification?.level || 0);

    if (issuedValue > 0) issuedValues.push(issuedValue);
    if (overallScore > 0) overallScores.push(overallScore);
    patchDeltas.push(patchDelta);
    confidencePoints.push(confidenceMap[confidence] || 35);
    confidenceCounts[confidence] = (confidenceCounts[confidence] || 0) + 1;
    certificationCounts[certification] = (certificationCounts[certification] || 0) + 1;
    issueTotal += issueCount;
    if (item?.patchedReport || item?.status === 'patched') patchedWorkspaceCount += 1;
    if (certLevel >= 4 || certification === 'Enterprise-Ready') enterpriseReadyCount += 1;
    if (certLevel >= 5 || certification === 'Sovereign / Platform Grade') sovereignWorkspaceCount += 1;

    return {
      workspaceId: item.workspaceId,
      projectLabel: item.projectLabel,
      status: item.status,
      issuedValue,
      overallScore,
      confidence,
      certification,
      issueCount,
      runtimeStatus: report?.runtimeProof?.status || 'not-run',
      runtimeMatrixStatus: report?.runtimeMatrix?.overallStatus || 'not-run',
      completionPercent: Number(report?.completionLedger?.completionPercent || 0),
      patchDelta,
      updatedAt: item.updatedAt
    };
  });

  const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const median = values => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const workspaceCount = workspaces.length;
  const averageOverallScore = average(overallScores);
  const averageConfidencePoints = average(confidencePoints);
  const patchAdoptionRatio = workspaceCount ? patchedWorkspaceCount / workspaceCount : 0;
  const enterpriseRatio = workspaceCount ? enterpriseReadyCount / workspaceCount : 0;
  const issuePressure = workspaceCount ? issueTotal / workspaceCount : 0;
  const averagePatchDelta = average(patchDeltas);
  const portfolioScore = Math.max(0, Math.min(100,
    averageOverallScore * 0.62 +
    averageConfidencePoints * 0.18 +
    enterpriseRatio * 100 * 0.12 +
    patchAdoptionRatio * 100 * 0.08 -
    issuePressure * 3.4
  ));

  let portfolioCertification = { level: 0, label: 'Unverified / Incomplete' };
  const levels = readJsonFile(path.join(configDir, 'valuation_weights_2026.json'), {})?.certificationLevels || [];
  for (const level of levels) {
    if (portfolioScore >= Number(level.minScore || 0)) portfolioCertification = { level: level.level, label: level.label };
  }

  const riskFlags = [];
  if (workspaceCount && (confidenceCounts.low || 0) >= Math.max(1, Math.floor(workspaceCount / 3))) riskFlags.push('low-confidence concentration');
  if (issuePressure >= 3) riskFlags.push('issue pressure above portfolio target');
  if (workspaceCount && enterpriseReadyCount === 0) riskFlags.push('no enterprise-ready workspaces yet');

  return {
    workspaceCount,
    issuedValueTotal: Number(issuedValues.reduce((sum, value) => sum + value, 0).toFixed(2)),
    highestIssuedValue: issuedValues.length ? Math.max(...issuedValues) : 0,
    averageIssuedValue: Number(average(issuedValues).toFixed(2)),
    medianIssuedValue: Number(median(issuedValues).toFixed(2)),
    averageOverallScore: Number(averageOverallScore.toFixed(1)),
    portfolioScore: Number(portfolioScore.toFixed(1)),
    portfolioCertification,
    confidenceCounts,
    certificationCounts,
    patchedWorkspaceCount,
    enterpriseReadyCount,
    sovereignWorkspaceCount,
    averagePatchDelta: Number(averagePatchDelta.toFixed(2)),
    trend: averagePatchDelta > 5000 ? 'rising' : averagePatchDelta < -5000 ? 'falling' : 'stable',
    riskFlags,
    workspaces: rows
  };
}

function updateWorkspace(workspaceId, patch) {
  const current = getWorkspace(workspaceId);
  if (!current) return null;
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  writeWorkspace(next);
  return next;
}

function serveStatic(req, res) {
  let requestPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  if (requestPath === '/') requestPath = '/index.html';
  const resolved = path.normalize(path.join(publicDir, requestPath));
  if (!resolved.startsWith(publicDir)) {
    notFound(res);
    return;
  }
  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    notFound(res);
    return;
  }
  const ext = path.extname(resolved).toLowerCase();
  const contentType = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.md': 'text/markdown; charset=utf-8'
  }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(resolved).pipe(res);
}

function buildDownloadUrl(workspaceId, name) {
  return `/downloads/${encodeURIComponent(workspaceId)}/${encodeURIComponent(name)}`;
}

async function handleImport(req, res) {
  try {
    const body = await readBody(req);
    if (!body.length) {
      json(res, 400, { ok: false, error: 'empty_upload' });
      return;
    }
    const workspaceId = `vcs-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const paths = workspacePaths(workspaceId);
    for (const dir of [paths.baseDir, paths.intakeDir, paths.runtimeDir, paths.artifactsDir, paths.logsDir]) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const fileName = sanitizeFileName(req.headers['x-file-name'] || 'project.zip');
    const inputZip = path.join(paths.intakeDir, fileName.endsWith('.zip') ? fileName : `${fileName}.zip`);
    fs.writeFileSync(inputZip, body);

    const metadata = {
      projectLabel: String(req.headers['x-project-label'] || 'Imported Workspace'),
      commercialProfile: String(req.headers['x-commercial-profile'] || 'founder-core-asset'),
      autonomyMode: String(req.headers['x-autonomy-mode'] || 'draft-and-wait'),
      patchMode: String(req.headers['x-patch-mode'] || 'advisory'),
      importedAt: new Date().toISOString(),
      sourceFileName: path.basename(inputZip)
    };
    const metadataFile = path.join(paths.intakeDir, 'intake-metadata.json');
    fs.writeFileSync(metadataFile, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

    writeWorkspace({
      workspaceId,
      status: 'imported',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      projectLabel: metadata.projectLabel,
      commercialProfile: metadata.commercialProfile,
      autonomyMode: metadata.autonomyMode,
      patchMode: metadata.patchMode,
      inputZip,
      artifacts: {},
      history: []
    });

    const { stdout } = await runPython('scan_zip.py', [workspaceId, inputZip, metadataFile]);
    const result = JSON.parse(stdout);
    const workspace = updateWorkspace(workspaceId, {
      status: 'scanned',
      artifacts: result.artifacts,
      summary: result.summary,
      report: result.report,
      history: [...(getWorkspace(workspaceId)?.history || []), {
        kind: 'scan',
        at: new Date().toISOString(),
        status: 'completed'
      }]
    });

    json(res, 200, {
      ok: true,
      workspaceId,
      workspace,
      report: result.report,
      artifacts: result.artifacts,
      downloads: Object.fromEntries(
        Object.entries(result.artifacts || {}).map(([key, value]) => [key, buildDownloadUrl(workspaceId, path.basename(value))])
      )
    });
  } catch (error) {
    json(res, 500, { ok: false, error: error.message });
  }
}

async function handlePatch(req, res, workspaceId) {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) {
    notFound(res);
    return;
  }
  try {
    const body = await readBody(req);
    const patchRequest = body.length ? JSON.parse(body.toString('utf8')) : {};
    const { stdout } = await runPython('patch_zip.py', [workspaceId, JSON.stringify(patchRequest)]);
    const result = JSON.parse(stdout);
    const updated = updateWorkspace(workspaceId, {
      status: 'patched',
      artifacts: {
        ...(workspace.artifacts || {}),
        ...(result.artifacts || {})
      },
      patchedReport: result.report,
      patchLab: result.patchLab,
      history: [...(workspace.history || []), {
        kind: 'patch',
        at: new Date().toISOString(),
        status: 'completed',
        appliedPatchCount: result.patchLab?.appliedPatchCount || 0
      }]
    });

    json(res, 200, {
      ok: true,
      workspaceId,
      workspace: updated,
      report: result.report,
      patchLab: result.patchLab,
      artifacts: result.artifacts,
      downloads: Object.fromEntries(
        Object.entries(result.artifacts || {}).map(([key, value]) => [key, buildDownloadUrl(workspaceId, path.basename(value))])
      )
    });
  } catch (error) {
    json(res, 500, { ok: false, error: error.message });
  }
}

function handleWorkspace(res, workspaceId) {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) {
    notFound(res);
    return;
  }
  json(res, 200, { ok: true, workspace });
}

function handleDownload(res, workspaceId, name) {
  const paths = workspacePaths(workspaceId);
  const artifactPath = path.normalize(path.join(paths.artifactsDir, name));
  if (!artifactPath.startsWith(paths.artifactsDir) || !fs.existsSync(artifactPath)) {
    notFound(res);
    return;
  }
  const ext = path.extname(artifactPath).toLowerCase();
  const contentType = {
    '.json': 'application/json; charset=utf-8',
    '.md': 'text/markdown; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.zip': 'application/zip',
    '.diff': 'text/plain; charset=utf-8',
    '.html': 'text/html; charset=utf-8'
  }[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${path.basename(artifactPath)}"`
  });
  fs.createReadStream(artifactPath).pipe(res);
}

function sha256FileSync(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function authoritySecretBuffer() {
  return Buffer.from(process.env.SKYEHANDS_AUTHORITY_SECRET || 'skyehands-vcs-local-authority-v0.7.0', 'utf8');
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function resolveArtifactPath(workspaceId, candidates) {
  const paths = workspacePaths(workspaceId);
  for (const name of candidates) {
    const candidate = path.join(paths.artifactsDir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function verifyAuthorityCertificate(certificate, workspaceId) {
  if (!certificate?.payload) {
    return { verified: false, signatureVerified: false, missingArtifacts: [], mismatchedArtifacts: [], checkedArtifactCount: 0 };
  }
  const canonical = stableStringify(certificate.payload);
  const signature = crypto.createHmac('sha256', authoritySecretBuffer()).update(canonical).digest('hex');
  const payloadHash = crypto.createHash('sha256').update(canonical).digest('hex');
  const missingArtifacts = [];
  const mismatchedArtifacts = [];
  for (const item of certificate.payload.artifactLedger || []) {
    const artifactPath = resolveArtifactPath(workspaceId, [item.fileName]);
    if (!artifactPath) {
      missingArtifacts.push(item.fileName);
      continue;
    }
    const actualHash = sha256FileSync(artifactPath);
    if (actualHash !== item.sha256) mismatchedArtifacts.push(item.fileName);
  }
  return {
    verified: signature === certificate.signature && payloadHash === certificate.payloadHash && !missingArtifacts.length && !mismatchedArtifacts.length,
    signatureVerified: signature === certificate.signature && payloadHash === certificate.payloadHash,
    missingArtifacts,
    mismatchedArtifacts,
    checkedArtifactCount: (certificate.payload.artifactLedger || []).length
  };
}

function handleAuthority(res, workspaceId) {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) return notFound(res);
  const certificatePath = resolveArtifactPath(workspaceId, ['VCS-016-authority-certificate-patched.json', 'VCS-016-authority-certificate.json']);
  const verificationPath = resolveArtifactPath(workspaceId, ['VCS-017-authority-verification-patched.json', 'VCS-017-authority-verification.json']);
  const certificate = certificatePath ? readJsonFile(certificatePath, null) : null;
  const storedVerification = verificationPath ? readJsonFile(verificationPath, null) : null;
  const liveVerification = certificate ? verifyAuthorityCertificate(certificate, workspaceId) : null;
  json(res, 200, { ok: true, workspaceId, certificate, storedVerification, liveVerification });
}

function handleAuthorityVerify(res, workspaceId) {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) return notFound(res);
  const certificatePath = resolveArtifactPath(workspaceId, ['VCS-016-authority-certificate-patched.json', 'VCS-016-authority-certificate.json']);
  const certificate = certificatePath ? readJsonFile(certificatePath, null) : null;
  const verification = certificate ? verifyAuthorityCertificate(certificate, workspaceId) : { verified: false, signatureVerified: false, missingArtifacts: ['certificate'], mismatchedArtifacts: [], checkedArtifactCount: 0 };
  json(res, 200, { ok: true, workspaceId, verification });
}

function handleArbitration(res, workspaceId) {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) return notFound(res);
  const report = effectiveReport(workspace) || {};
  const arbitrationPath = resolveArtifactPath(workspaceId, ['VCS-018-council-arbitration-patched.json', 'VCS-018-council-arbitration.json']);
  const arbitration = arbitrationPath ? readJsonFile(arbitrationPath, report?.councilArbitration || null) : (report?.councilArbitration || null);
  json(res, 200, { ok: true, workspaceId, arbitration });
}

function handleRuntimeMatrix(res, workspaceId) {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) return notFound(res);
  const report = effectiveReport(workspace) || {};
  const matrixPath = resolveArtifactPath(workspaceId, ['VCS-019-runtime-matrix-patched.json', 'VCS-019-runtime-matrix.json']);
  const runtimeMatrix = matrixPath ? readJsonFile(matrixPath, report?.runtimeMatrix || null) : (report?.runtimeMatrix || null);
  json(res, 200, { ok: true, workspaceId, runtimeMatrix });
}


function handleExecution(res, workspaceId) {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) return notFound(res);
  const report = effectiveReport(workspace) || {};
  const executionPath = resolveArtifactPath(workspaceId, ['VCS-021-execution-matrix-patched.json', 'VCS-021-execution-matrix.json']);
  const execution = executionPath ? readJsonFile(executionPath, report?.executionMatrix || null) : (report?.executionMatrix || null);
  json(res, 200, { ok: true, workspaceId, execution });
}

function handleCompletion(res, workspaceId) {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) return notFound(res);
  const report = effectiveReport(workspace) || {};
  const completionPath = resolveArtifactPath(workspaceId, ['VCS-020-completion-ledger-patched.json', 'VCS-020-completion-ledger.json']);
  const completion = completionPath ? readJsonFile(completionPath, report?.completionLedger || null) : (report?.completionLedger || null);
  json(res, 200, { ok: true, workspaceId, completion });
}

function handleRepair(res, workspaceId) {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) return notFound(res);
  const report = effectiveReport(workspace) || {};
  const repairPath = resolveArtifactPath(workspaceId, ['VCS-022-repair-intelligence-patched.json', 'VCS-022-repair-intelligence.json']);
  const repair = repairPath ? readJsonFile(repairPath, report?.repairIntelligence || null) : (report?.repairIntelligence || null);
  json(res, 200, { ok: true, workspaceId, repair });
}

function handleTrust(res, workspaceId) {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) return notFound(res);
  const report = effectiveReport(workspace) || {};
  const trustPath = resolveArtifactPath(workspaceId, ['VCS-023-public-trust-readiness-patched.json', 'VCS-023-public-trust-readiness.json']);
  const trust = trustPath ? readJsonFile(trustPath, report?.publicTrustChain || null) : (report?.publicTrustChain || null);
  json(res, 200, { ok: true, workspaceId, trust });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    json(res, 200, {
      ok: true,
      service: 'skyehands-valuation-certification-system',
      name: 'skyehands-valuation-certification-system',
      version: '0.7.0',
      port: PORT,
      workspaceCount: fs.readdirSync(workspacesDir).length,
      workspacesDir
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/workspaces') {
    json(res, 200, { ok: true, workspaces: listWorkspaces(), portfolio: portfolioSummary() });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/portfolio') {
    json(res, 200, { ok: true, portfolio: portfolioSummary() });
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/authority/verify/')) {
    const workspaceId = url.pathname.split('/').filter(Boolean).at(-1);
    handleAuthorityVerify(res, workspaceId);
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/authority/')) {
    const workspaceId = url.pathname.split('/').filter(Boolean).at(-1);
    handleAuthority(res, workspaceId);
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/arbitration/')) {
    const workspaceId = url.pathname.split('/').filter(Boolean).at(-1);
    handleArbitration(res, workspaceId);
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/runtime/')) {
    const workspaceId = url.pathname.split('/').filter(Boolean).at(-1);
    handleRuntimeMatrix(res, workspaceId);
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/completion/')) {
    const workspaceId = url.pathname.split('/').filter(Boolean).at(-1);
    handleCompletion(res, workspaceId);
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/execution/')) {
    const workspaceId = url.pathname.split('/').filter(Boolean).at(-1);
    handleExecution(res, workspaceId);
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/repair/')) {
    const workspaceId = url.pathname.split('/').filter(Boolean).at(-1);
    handleRepair(res, workspaceId);
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/trust/')) {
    const workspaceId = url.pathname.split('/').filter(Boolean).at(-1);
    handleTrust(res, workspaceId);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/import') {
    await handleImport(req, res);
    return;
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/patch/')) {
    const workspaceId = url.pathname.split('/').filter(Boolean).at(-1);
    await handlePatch(req, res, workspaceId);
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/workspaces/')) {
    const workspaceId = url.pathname.split('/').filter(Boolean).at(-1);
    handleWorkspace(res, workspaceId);
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/downloads/')) {
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 3) {
      handleDownload(res, parts[1], parts.slice(2).join('/'));
      return;
    }
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  notFound(res);
});

server.listen(PORT, () => {
  console.log(`[VCS] listening on http://127.0.0.1:${PORT}`);
  console.log(`[VCS] config ${configDir}`);
  console.log(`[VCS] docs ${docsDir}`);
});
