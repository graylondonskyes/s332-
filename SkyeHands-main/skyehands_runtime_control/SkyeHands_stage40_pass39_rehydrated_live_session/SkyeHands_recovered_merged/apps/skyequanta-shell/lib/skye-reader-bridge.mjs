import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
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

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getIntegratedSkyeReaderPaths(config) {
  const appDir = path.join(config.rootDir, 'apps', 'skye-reader-hardened');
  return {
    appDir,
    serverFile: path.join(appDir, 'server.js'),
    smokeFile: path.join(appDir, 'scripts', 'smoke.mjs'),
    packageFile: path.join(appDir, 'package.json'),
    publicAppFile: path.join(appDir, 'public', 'app.js'),
    nodeModulesDir: path.join(appDir, 'node_modules')
  };
}

function matchesAllowedExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return new Set(['.md', '.txt', '.html', '.htm', '.pdf', '.docx', '.epub', '.json', '.yaml', '.yml', '.xml', '.csv', '.rtf']).has(ext);
}

function priorityScore(relativePath) {
  const lower = normalizePath(relativePath).toLowerCase();
  let score = 0;
  if (/^readme(\.|$)/.test(path.basename(lower))) score += 100;
  if (lower.startsWith('docs/')) score += 80;
  if (lower.includes('investor')) score += 70;
  if (lower.includes('audit')) score += 60;
  if (lower.includes('pricing')) score += 50;
  if (lower.includes('public/') || lower.includes('pages/') || lower.includes('app/')) score += 40;
  if (lower.includes('security') || lower.includes('compliance') || lower.includes('deploy')) score += 30;
  return score;
}

function walkFiles(rootDir, currentDir = rootDir, bucket = []) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(currentDir, entry.name);
    const relative = normalizePath(path.relative(rootDir, absolute));
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'coverage', '.next', '.wrangler', '__MACOSX'].includes(entry.name)) continue;
      walkFiles(rootDir, absolute, bucket);
      continue;
    }
    if (!entry.isFile()) continue;
    const stat = fs.statSync(absolute);
    if (stat.size > 3 * 1024 * 1024) continue;
    if (!matchesAllowedExtension(absolute)) continue;
    bucket.push({
      absolutePath: absolute,
      relativePath: relative,
      fileName: path.basename(absolute),
      sizeBytes: stat.size,
      priority: priorityScore(relative)
    });
  }
  return bucket;
}

export function findReaderCandidates(projectRoot, options = {}) {
  const limit = Number(options.limit || 8);
  const files = walkFiles(projectRoot)
    .sort((a, b) => (b.priority - a.priority) || (a.relativePath.localeCompare(b.relativePath)));
  return files.slice(0, limit);
}

async function waitForReaderHealth(baseUrl, timeoutMs = 12000) {
  const started = Date.now();
  let lastError = null;
  while ((Date.now() - started) < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      const json = await res.json();
      if (res.ok && json?.ok) return { ok: true, json };
      lastError = { status: res.status, json };
    } catch (error) {
      lastError = { message: error instanceof Error ? error.message : String(error) };
    }
    await wait(250);
  }
  return { ok: false, detail: lastError };
}

function attachOutputCapture(child) {
  const stdout = [];
  const stderr = [];
  child.stdout?.on('data', chunk => stdout.push(String(chunk)));
  child.stderr?.on('data', chunk => stderr.push(String(chunk)));
  return {
    read() {
      return {
        stdout: stdout.join(''),
        stderr: stderr.join('')
      };
    }
  };
}

export async function startIntegratedSkyeReader(config, options = {}) {
  const paths = getIntegratedSkyeReaderPaths(config);
  if (!fs.existsSync(paths.serverFile) || !fs.existsSync(paths.nodeModulesDir)) {
    return {
      ok: false,
      reason: 'integrated_skye_reader_missing',
      paths: Object.fromEntries(Object.entries(paths).map(([k, v]) => [k, normalizePath(path.relative(config.rootDir, v))]))
    };
  }
  const port = Number(options.port || 4390);
  const host = options.host || '127.0.0.1';
  const baseUrl = `http://${host}:${port}`;
  const dataDir = path.resolve(options.dataDir || path.join(config.rootDir, '.skyequanta', 'skye-reader-bridge', String(options.runId || 'default')));
  ensureDirectory(dataDir);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: paths.appDir,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: host,
      SKYE_READER_DATA_DIR: dataDir,
      MAX_UPLOAD_MB: String(options.maxUploadMb || 20),
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const capture = attachOutputCapture(child);
  const health = await waitForReaderHealth(baseUrl, Number(options.timeoutMs || 12000));
  if (!health.ok) {
    try { child.kill('SIGTERM'); } catch {}
    return {
      ok: false,
      reason: 'reader_health_timeout',
      baseUrl,
      dataDir,
      logs: capture.read(),
      detail: health.detail
    };
  }
  return {
    ok: true,
    child,
    baseUrl,
    dataDir,
    paths,
    health,
    logs: capture.read,
    async stop() {
      if (child.killed) return;
      child.kill('SIGTERM');
      await wait(250);
      if (!child.killed) {
        try { child.kill('SIGKILL'); } catch {}
      }
    }
  };
}

async function importSingleFile(baseUrl, candidate) {
  const form = new FormData();
  const blob = new Blob([fs.readFileSync(candidate.absolutePath)]);
  form.set('file', blob, candidate.fileName);
  form.set('saveToLibrary', 'false');
  const res = await fetch(`${baseUrl}/api/import/file`, { method: 'POST', body: form });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload?.ok) {
    return {
      ok: false,
      relativePath: candidate.relativePath,
      fileName: candidate.fileName,
      status: res.status,
      error: payload?.error || payload?.detail || 'reader import failed'
    };
  }
  const doc = payload.document || {};
  return {
    ok: true,
    relativePath: candidate.relativePath,
    fileName: candidate.fileName,
    title: doc.title || candidate.fileName,
    text: String(doc.text || ''),
    sourceType: doc.sourceType || 'upload',
    sourceLabel: doc.sourceLabel || candidate.fileName,
    metadata: doc.metadata || {},
    extractedCharacters: String(doc.text || '').length,
    sizeBytes: candidate.sizeBytes
  };
}

function countKeywordHits(text, keywords) {
  const lower = String(text || '').toLowerCase();
  return keywords.reduce((acc, keyword) => acc + (lower.includes(keyword.toLowerCase()) ? 1 : 0), 0);
}

function summarizeReaderDocuments(documents) {
  const keywordSets = {
    investor: ['investor', 'valuation', 'audit', 'revenue', 'market', 'raise'],
    product: ['feature', 'platform', 'workflow', 'dashboard', 'automation', 'experience'],
    proof: ['proof', 'smoke', 'test', 'verification', 'attestation', 'replay'],
    compliance: ['compliance', 'security', 'policy', 'privacy', 'retention', 'regulated'],
    monetization: ['pricing', 'billing', 'subscription', 'checkout', 'plan', 'tier']
  };
  const keywordHits = Object.fromEntries(Object.entries(keywordSets).map(([label, keywords]) => [
    label,
    documents.reduce((acc, item) => acc + countKeywordHits(item.text, keywords), 0)
  ]));
  const excerpts = documents.slice(0, 5).map(item => ({
    title: item.title,
    relativePath: item.relativePath,
    excerpt: String(item.text || '').replace(/\s+/g, ' ').trim().slice(0, 220)
  }));
  return {
    documentCount: documents.length,
    extractedCharacters: documents.reduce((acc, item) => acc + Number(item.extractedCharacters || 0), 0),
    keywordHits,
    totalKeywordHits: Object.values(keywordHits).reduce((acc, value) => acc + Number(value || 0), 0),
    topTitles: documents.slice(0, 6).map(item => item.title),
    excerpts
  };
}

export function renderReaderDossierSurface(dossier = {}, options = {}) {
  const title = options.title || 'Skye Reader Dossier';
  const docs = Array.isArray(dossier.documents) ? dossier.documents : [];
  const rows = docs.map(item => `<tr><td>${item.relativePath}</td><td>${item.title}</td><td>${item.extractedCharacters}</td><td>${String(item.text || '').replace(/\s+/g, ' ').trim().slice(0, 140)}</td></tr>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
body{margin:0;background:#070910;color:#f4f7ff;font-family:Inter,Arial,sans-serif} main{max-width:1140px;margin:0 auto;padding:28px}
.card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:18px 20px;margin-bottom:18px}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.metric{padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1)}
.metric .label{font-size:12px;text-transform:uppercase;color:#9fb3d9;letter-spacing:.08em}.metric .value{font-size:24px;font-weight:800;margin-top:4px}
table{width:100%;border-collapse:collapse}th,td{padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left;vertical-align:top}th{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#76e7ff}
</style>
</head>
<body>
<main>
<div class="card"><h1>${title}</h1><p>Integrated Skye Reader dossier for document-rich deep scan and valuation enrichment.</p></div>
<div class="card"><div class="grid">
<div class="metric"><div class="label">Documents</div><div class="value">${Number(dossier.summary?.documentCount || 0)}</div></div>
<div class="metric"><div class="label">Extracted chars</div><div class="value">${Number(dossier.summary?.extractedCharacters || 0)}</div></div>
<div class="metric"><div class="label">Keyword hits</div><div class="value">${Number(dossier.summary?.totalKeywordHits || 0)}</div></div>
<div class="metric"><div class="label">Import failures</div><div class="value">${Number((dossier.failures || []).length)}</div></div>
</div></div>
<div class="card"><h2>Imported project documents</h2><table><thead><tr><th>Path</th><th>Title</th><th>Chars</th><th>Excerpt</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No readable documents imported.</td></tr>'}</tbody></table></div>
</main>
</body>
</html>`;
}

export async function buildProjectReaderDossier(config, projectRoot, options = {}) {
  const runId = String(options.runId || 'reader-dossier');
  const port = Number(options.port || 4390);
  const reader = await startIntegratedSkyeReader(config, {
    runId,
    port,
    dataDir: options.dataDir,
    timeoutMs: options.timeoutMs || 12000
  });
  const candidates = findReaderCandidates(projectRoot, { limit: options.limit || 8 });
  const failures = [];
  const documents = [];
  if (!reader.ok) {
    return {
      ok: false,
      integrated: false,
      reason: reader.reason,
      candidates,
      failures: [{ relativePath: '(bootstrap)', error: reader.reason }],
      summary: summarizeReaderDocuments([]),
      reader,
      documents
    };
  }
  try {
    for (const candidate of candidates) {
      const result = await importSingleFile(reader.baseUrl, candidate);
      if (!result.ok) {
        failures.push(result);
      } else {
        documents.push(result);
      }
    }
  } finally {
    await reader.stop();
  }
  return {
    ok: documents.length > 0,
    integrated: true,
    readerBaseUrl: reader.baseUrl,
    readerPaths: Object.fromEntries(Object.entries(reader.paths).map(([key, value]) => [key, normalizePath(path.relative(config.rootDir, value))])),
    candidates: candidates.map(item => ({ ...item, absolutePath: undefined })),
    failures,
    documents,
    summary: summarizeReaderDocuments(documents),
    logs: typeof reader.logs === 'function' ? reader.logs() : reader.logs
  };
}

export function writeReaderDossierArtifacts(config, outputDir, dossier, options = {}) {
  const dossierFile = writeJson(path.join(outputDir, 'deep-scan-reader-dossier.json'), dossier);
  const surfaceFile = writeText(path.join(outputDir, 'deep-scan-reader-dossier.html'), renderReaderDossierSurface(dossier, options));
  return {
    dossierFile,
    surfaceFile
  };
}
