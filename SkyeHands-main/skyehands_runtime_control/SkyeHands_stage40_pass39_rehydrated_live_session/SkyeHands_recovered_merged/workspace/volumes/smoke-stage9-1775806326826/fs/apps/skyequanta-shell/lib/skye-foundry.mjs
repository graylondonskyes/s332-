import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { getRuntimePaths } from './runtime.mjs';

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

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function getFoundryPaths(config) {
  const runtimePaths = getRuntimePaths(config);
  const baseDir = path.join(runtimePaths.runtimeDir, 'skye-foundry');
  return {
    baseDir,
    tenantsFile: path.join(baseDir, 'tenants.json'),
    exportsDir: path.join(baseDir, 'exports'),
    eventsFile: path.join(baseDir, 'events.ndjson')
  };
}

export function ensureSkyeFoundryStore(config) {
  const paths = getFoundryPaths(config);
  ensureDirectory(paths.baseDir);
  ensureDirectory(paths.exportsDir);
  if (!fs.existsSync(paths.tenantsFile)) {
    writeJson(paths.tenantsFile, { version: 1, tenants: [] });
  }
  if (!fs.existsSync(paths.eventsFile)) {
    writeText(paths.eventsFile, '');
  }
  return paths;
}

export function resetSkyeFoundryStore(config) {
  const paths = getFoundryPaths(config);
  fs.rmSync(paths.baseDir, { recursive: true, force: true });
  return ensureSkyeFoundryStore(config);
}

function appendEvent(config, payload) {
  const paths = ensureSkyeFoundryStore(config);
  fs.appendFileSync(paths.eventsFile, `${JSON.stringify({ at: new Date().toISOString(), ...payload })}\n`, 'utf8');
}

function nextFeatureTiers(featureTiers = {}) {
  return {
    starter: { shell: true, proofs: true, maintenance: false, ...(featureTiers.starter || {}) },
    pro: { shell: true, proofs: true, maintenance: true, foundryExport: true, ...(featureTiers.pro || {}) },
    sovereign: { shell: true, proofs: true, maintenance: true, foundryExport: true, whiteLabel: true, ...(featureTiers.sovereign || {}) }
  };
}

function buildTenantFingerprint(tenant) {
  return stableHash({
    tenantId: tenant.tenantId,
    brand: tenant.brand,
    domain: tenant.domain,
    policy: tenant.policy,
    providers: tenant.providers,
    featureTiers: tenant.featureTiers
  });
}

export function verifyFoundryTenant(tenant) {
  if (!tenant || typeof tenant !== 'object') {
    return { ok: false, reason: 'tenant_missing' };
  }
  const expected = buildTenantFingerprint(tenant);
  if (tenant.fingerprint !== expected) {
    return { ok: false, reason: 'tenant_fingerprint_mismatch', expected, actual: tenant.fingerprint || null };
  }
  return { ok: true, fingerprint: expected };
}

function readTenantTable(config) {
  const paths = ensureSkyeFoundryStore(config);
  return readJson(paths.tenantsFile, { version: 1, tenants: [] });
}

function writeTenantTable(config, table) {
  const paths = ensureSkyeFoundryStore(config);
  writeJson(paths.tenantsFile, table);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderFoundryTenantShell(tenant) {
  const colors = tenant.brand?.colors || { primary: '#7c3aed', accent: '#f59e0b', background: '#050816' };
  const policies = Object.entries(tenant.policy || {}).map(([key, value]) => `<li><strong>${escapeHtml(key)}</strong>: ${escapeHtml(typeof value === 'object' ? JSON.stringify(value) : String(value))}</li>`).join('');
  const providers = (tenant.providers || []).map(provider => `<li>${escapeHtml(provider.providerId)} — ${escapeHtml(provider.scope)} — ${escapeHtml(provider.defaultModel || 'default')}</li>`).join('');
  const tiers = Object.entries(tenant.featureTiers || {}).map(([tier, features]) => `<li><strong>${escapeHtml(tier)}</strong>: ${escapeHtml(Object.keys(features).filter(key => features[key]).join(', ') || 'none')}</li>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(tenant.brand?.name || tenant.tenantId)} Foundry</title>
<style>
  :root { --primary:${escapeHtml(colors.primary)}; --accent:${escapeHtml(colors.accent)}; --bg:${escapeHtml(colors.background)}; }
  body { margin:0; font-family:Inter,Arial,sans-serif; background: radial-gradient(circle at top, rgba(255,255,255,.08), transparent 42%), var(--bg); color:#f8fafc; }
  .wrap { max-width:1100px; margin:0 auto; padding:40px 24px 72px; }
  .hero { display:grid; gap:18px; padding:26px; border:1px solid rgba(255,255,255,.15); border-radius:24px; background:rgba(8,15,36,.72); box-shadow:0 18px 48px rgba(0,0,0,.35); }
  .pill { display:inline-flex; gap:8px; align-items:center; padding:8px 12px; border-radius:999px; background:rgba(255,255,255,.08); color:var(--accent); font-size:12px; text-transform:uppercase; letter-spacing:.14em; }
  h1 { margin:0; font-size:clamp(32px,4vw,56px); line-height:1.02; }
  .lead { color:#cbd5e1; font-size:18px; max-width:72ch; }
  .grid { display:grid; gap:20px; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); margin-top:24px; }
  .card { padding:18px; border-radius:20px; background:rgba(15,23,42,.8); border:1px solid rgba(255,255,255,.12); }
  h2 { margin:0 0 12px; font-size:18px; color:var(--accent); }
  ul { margin:0; padding-left:18px; color:#e2e8f0; }
  code { color:#fde68a; }
</style>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <span class="pill">SkyeFoundry · ${escapeHtml(tenant.tenantId)}</span>
      <h1>${escapeHtml(tenant.brand?.name || tenant.tenantId)} Autonomous Developer Cloud</h1>
      <p class="lead">Domain: <code>${escapeHtml(tenant.domain?.host || 'unset')}</code> · Theme: ${escapeHtml(tenant.brand?.tagline || 'white-label sovereign developer cloud')}</p>
    </section>
    <section class="grid">
      <article class="card"><h2>Policy posture</h2><ul>${policies}</ul></article>
      <article class="card"><h2>Provider posture</h2><ul>${providers}</ul></article>
      <article class="card"><h2>Feature tiers</h2><ul>${tiers}</ul></article>
    </section>
  </main>
</body>
</html>`;
}

export function provisionFoundryTenant(config, request = {}) {
  const paths = ensureSkyeFoundryStore(config);
  const table = readTenantTable(config);
  const tenantId = String(request.tenantId || '').trim() || crypto.randomUUID();
  const existingIndex = (table.tenants || []).findIndex(item => item.tenantId === tenantId);
  const tenant = {
    version: 1,
    createdAt: new Date().toISOString(),
    tenantId,
    brand: {
      name: request.brand?.name || tenantId,
      tagline: request.brand?.tagline || 'Provable autonomous developer cloud',
      colors: request.brand?.colors || { primary: '#7c3aed', accent: '#f59e0b', background: '#050816' },
      logoUrl: request.brand?.logoUrl || null
    },
    domain: {
      host: request.domain?.host || `${tenantId}.skye-foundry.local`,
      publicBaseUrl: request.domain?.publicBaseUrl || `https://${request.domain?.host || `${tenantId}.skye-foundry.local`}`
    },
    policy: {
      isolationTier: request.policy?.isolationTier || 'tenant-scoped',
      exportMode: request.policy?.exportMode || 'white-label',
      complianceMode: request.policy?.complianceMode || 'standard',
      proofRequirement: request.policy?.proofRequirement || 'strict',
      providerScope: request.policy?.providerScope || 'tenant-only'
    },
    providers: (request.providers || []).map(provider => ({
      providerId: provider.providerId,
      scope: provider.scope || 'tenant-only',
      defaultModel: provider.defaultModel || 'default',
      governanceGroup: provider.governanceGroup || 'tenant'
    })),
    featureTiers: nextFeatureTiers(request.featureTiers),
    metadata: {
      operatorNotes: request.metadata?.operatorNotes || null,
      template: request.metadata?.template || 'skye-foundry-core'
    }
  };
  tenant.fingerprint = buildTenantFingerprint(tenant);
  const shellDir = path.join(paths.exportsDir, tenantId, 'shell');
  const shellFile = writeText(path.join(shellDir, 'index.html'), renderFoundryTenantShell(tenant));
  tenant.artifactReferences = {
    shellFile: normalizePath(path.relative(config.rootDir, shellFile))
  };
  if (existingIndex >= 0) table.tenants[existingIndex] = tenant;
  else table.tenants = [...(table.tenants || []), tenant];
  writeTenantTable(config, table);
  appendEvent(config, { type: 'tenant-provisioned', tenantId, fingerprint: tenant.fingerprint });
  return tenant;
}

export function exportFoundryTenantPackage(config, tenantId, options = {}) {
  const table = readTenantTable(config);
  const tenant = (table.tenants || []).find(item => item.tenantId === tenantId);
  if (!tenant) {
    throw new Error(`SkyeFoundry tenant not found: ${tenantId}`);
  }
  const verification = verifyFoundryTenant(tenant);
  if (!verification.ok) {
    throw new Error(`SkyeFoundry tenant verification failed: ${verification.reason}`);
  }
  const outputDir = path.resolve(options.outputDir || path.join(config.rootDir, 'dist', 'section55', tenantId, 'white-label-package'));
  fs.rmSync(outputDir, { recursive: true, force: true });
  ensureDirectory(outputDir);
  const shellFile = writeText(path.join(outputDir, 'index.html'), renderFoundryTenantShell(tenant));
  const policyFile = writeJson(path.join(outputDir, 'policy.json'), tenant.policy);
  const providersFile = writeJson(path.join(outputDir, 'providers.json'), tenant.providers);
  const brandFile = writeJson(path.join(outputDir, 'brand.json'), tenant.brand);
  const featureFile = writeJson(path.join(outputDir, 'feature-tiers.json'), tenant.featureTiers);
  const manifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tenantId,
    tenantFingerprint: tenant.fingerprint,
    files: [shellFile, policyFile, providersFile, brandFile, featureFile].map(filePath => ({
      relativePath: normalizePath(path.relative(outputDir, filePath)),
      sha256: sha256File(filePath)
    }))
  };
  const manifestFile = writeJson(path.join(outputDir, 'manifest.json'), manifest);
  appendEvent(config, { type: 'tenant-exported', tenantId, outputDir: normalizePath(path.relative(config.rootDir, outputDir)) });
  return {
    tenant,
    outputDir,
    manifest,
    artifactReferences: {
      shellFile: normalizePath(path.relative(config.rootDir, shellFile)),
      manifestFile: normalizePath(path.relative(config.rootDir, manifestFile))
    }
  };
}

export function verifyFoundryIsolation(request = {}) {
  const sourceTenant = request.sourceTenant;
  const targetTenant = request.targetTenant;
  const attempt = request.attempt || {};
  if (!sourceTenant || !targetTenant) {
    return { ok: false, reason: 'tenant_pair_required' };
  }
  if (attempt.type === 'brand-bleed') {
    const ok = sourceTenant.brand?.name !== targetTenant.brand?.name && sourceTenant.domain?.host !== targetTenant.domain?.host;
    return {
      ok,
      reason: ok ? 'brand_tenant_boundary_preserved' : 'brand_tenant_boundary_failed',
      sourceBrand: sourceTenant.brand?.name || null,
      targetBrand: targetTenant.brand?.name || null,
      sourceDomain: sourceTenant.domain?.host || null,
      targetDomain: targetTenant.domain?.host || null
    };
  }
  if (attempt.type === 'provider-bleed') {
    const sourceIds = new Set((sourceTenant.providers || []).map(item => `${item.providerId}:${item.scope}:${item.governanceGroup || 'tenant'}`));
    const targetIds = new Set((targetTenant.providers || []).map(item => `${item.providerId}:${item.scope}:${item.governanceGroup || 'tenant'}`));
    const overlap = [...sourceIds].filter(item => targetIds.has(item));
    const ok = overlap.length === 0;
    return { ok, reason: ok ? 'provider_tenant_boundary_preserved' : 'provider_tenant_boundary_failed', overlap };
  }
  return { ok: false, reason: 'unknown_isolation_attempt' };
}

export function renderFoundryOperatorSurface(tenants = []) {
  const rows = tenants.map(item => `<tr><td>${escapeHtml(item.tenantId)}</td><td>${escapeHtml(item.brand?.name)}</td><td>${escapeHtml(item.domain?.host)}</td><td>${escapeHtml(item.policy?.complianceMode)}</td><td>${escapeHtml((item.providers || []).map(provider => provider.providerId).join(', '))}</td></tr>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>SkyeFoundry Operator Surface</title><style>body{font-family:Inter,Arial,sans-serif;background:#020617;color:#e2e8f0;margin:0;padding:28px;}table{width:100%;border-collapse:collapse;}td,th{border:1px solid rgba(255,255,255,.12);padding:10px;text-align:left;}th{background:#111827;}tr:nth-child(even){background:#0f172a;}</style></head><body><h1>SkyeFoundry Operator Surface</h1><table><thead><tr><th>Tenant</th><th>Brand</th><th>Domain</th><th>Compliance</th><th>Providers</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export function summarizeFoundrySignals(projectRoot) {
  const brandingDir = path.join(projectRoot, 'branding');
  const docs = [path.join(projectRoot, 'README.md'), path.join(projectRoot, 'docs', 'README.md')].filter(filePath => fs.existsSync(filePath)).map(filePath => fs.readFileSync(filePath, 'utf8').toLowerCase()).join('\n');
  const configFiles = ['netlify.toml', 'wrangler.toml', 'vercel.json'].filter(name => fs.existsSync(path.join(projectRoot, name)));
  const brandingFiles = fs.existsSync(brandingDir) ? fs.readdirSync(brandingDir) : [];
  const domainSignals = [docs.includes('domain'), docs.includes('white-label'), docs.includes('tenant')].filter(Boolean).length;
  return {
    foundryReady: brandingFiles.length > 0 || configFiles.length > 0 || domainSignals > 0,
    brandingAssetCount: brandingFiles.length,
    configSignals: configFiles,
    domainSignalCount: domainSignals
  };
}
