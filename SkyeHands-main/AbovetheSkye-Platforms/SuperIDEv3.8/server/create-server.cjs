const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { hashPassphrase, verifyPassphrase, issueAccessToken, verifyAccessToken, issueRefreshToken, verifyRefreshToken, parseBearerToken } = require('../platform/server-auth');
const { resolvePaymentProvider, createPaymentSession, retrieveStripeCheckoutSession, reconcileStripePaymentSession, verifyStripeWebhook, finalizePayment, paymentSummary } = require('../platform/payment-gateways');
const { createSubmissionJob, submitJob, previewSubmissionContract, validateSubmissionConfig, querySubmissionStatus, cancelSubmissionJob, createVendorWorkflow } = require('../platform/submission-adapters');
const { loadRuntimeState, saveRuntimeState, appendAuditEvent, recordPortalRun, hasProcessedWebhookEvent, hasCompletedPaymentSession, createSubmissionJobRecord, upsertSubmissionJob, getSubmissionJob, markSubmissionJobDispatched, markSubmissionJobStatus, markSubmissionJobCancelled, markSubmissionJobPortalPlanned, markSubmissionJobPortalRun, resolveJournalPath } = require('../platform/runtime-state');
const { buildPortalPlan, runPortalAutomation } = require('../platform/portal-automation');
const { generateSkyeDocxPackage } = require('../platform/publishing');
const { summarizeCommerceState, createFulfillmentToken } = require('../platform/commerce');
const { ensureCatalogState, upsertCatalogTitle, summarizeCatalogState } = require('../platform/catalog');
const { canonicalize } = require('../platform/export-import');

function writeCors(res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type, authorization, stripe-signature');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
}
function json(res, code, value) { writeCors(res); res.writeHead(code, { 'content-type': 'application/json' }); res.end(`${JSON.stringify(value, null, 2)}\n`); }
function readBody(req) { return new Promise((resolve, reject) => { const chunks=[]; req.on('data',(c)=>chunks.push(c)); req.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8'))); req.on('error',reject); }); }
function parseJsonBody(raw) { try { return JSON.parse(raw || '{}'); } catch { return {}; } }
function routePath(req) { return String(req.url || '').split('?')[0]; }
function pathParts(req) { return routePath(req).split('/').filter(Boolean); }

function readFixturePackage(config) {
  const fixture = JSON.parse(fs.readFileSync(path.join(config.root, 'fixtures', 'publishing', 'skydocx-workspace.json'), 'utf8'));
  return generateSkyeDocxPackage(fixture, { runId: 'server-runtime' });
}
function readRetailerManifest(config) { const fp = path.join(config.root, 'artifacts', 'retailer-packages', 'manifest.json'); try { return JSON.parse(fs.readFileSync(fp,'utf8')); } catch { return { ok:false, jobs:[] }; } }
function resolvePackagePath(config, value) {
  if (!value) return null;
  if (path.isAbsolute(value) && fs.existsSync(value)) return value;
  const basename = path.basename(value);
  const matches = [];
  const base = path.join(config.root, 'artifacts', 'retailer-packages');
  if (fs.existsSync(base)) {
    for (const folder of fs.readdirSync(base)) {
      const sub = path.join(base, folder);
      if (!fs.statSync(sub).isDirectory()) continue;
      for (const file of fs.readdirSync(sub)) if (file === basename) matches.push(path.join(sub, file));
    }
  }
  return matches[0] || null;
}
function summarizePackageManifest(config) {
  const manifest = readRetailerManifest(config);
  return canonicalize({ ok: !!manifest.ok, jobs: (manifest.jobs || []).map((job) => ({ slug: job.slug, mode: job.mode, packages: (job.packages || []).map((pkg) => ({ channel: pkg.channel, lane: pkg.lane, path: resolvePackagePath(config, pkg.path), filename: path.basename(pkg.path || '') })) })) });
}
function nowIso() { return new Date().toISOString(); }
function randomId(prefix) { return `${prefix}_${crypto.randomBytes(6).toString('hex')}`; }
function readJsonFile(filePath, fallback) { try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; } }
function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(canonicalize(value), null, 2)}\n`, 'utf8');
}
function readFixtureWorkspace(config, mode = 'skydocx') {
  const filename = mode === 'skyeblog' ? 'skyeblog-workspace.json' : 'skydocx-workspace.json';
  return JSON.parse(fs.readFileSync(path.join(config.root, 'fixtures', 'publishing', filename), 'utf8'));
}
function buildWorkspaceFromDocument(document) {
  const metadata = canonicalize({
    schema: 'skye.skydocx.metadata',
    title: document.title || 'Untitled SkyeDocxMax Document',
    subtitle: document.metadata?.subtitle || '',
    author: document.metadata?.author || 'Skyes Over London',
    imprint: document.metadata?.imprint || 'SOLEnterprises',
    slug: document.metadata?.slug || String(document.title || 'untitled-skydocxmax-document').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled-skydocxmax-document',
    priceUsd: Number(document.metadata?.priceUsd || 0),
    membershipUpsell: document.metadata?.membershipUpsell || null,
    territories: Array.isArray(document.metadata?.territories) ? document.metadata.territories : ['US'],
    tags: Array.isArray(document.metadata?.tags) ? document.metadata.tags : [],
    status: document.metadata?.status || 'draft'
  });
  const edition = canonicalize({
    schema: 'skye.skydocx.edition',
    editionName: document.metadata?.editionName || 'Working Draft',
    editionNumber: document.metadata?.editionNumber || '1.0.0',
    isbnPlaceholder: document.metadata?.isbnPlaceholder || 'pending-founder-issued',
    trimIntent: document.metadata?.trimIntent || 'digital-first',
    outputs: Array.isArray(document.metadata?.outputs) ? document.metadata.outputs : ['docx-master', 'pdf-suite'],
    releaseWindow: document.metadata?.releaseWindow || 'manual'
  });
  const storefront = canonicalize({
    schema: 'skye.storefront.release',
    heroLine: document.metadata?.heroLine || 'Write once. Own the master. Export everywhere.',
    checkoutMode: document.metadata?.checkoutMode || 'direct-first',
    preorder: Boolean(document.metadata?.preorder),
    bonuses: Array.isArray(document.metadata?.bonuses) ? document.metadata.bonuses : [],
    bundleTargets: Array.isArray(document.metadata?.bundleTargets) ? document.metadata.bundleTargets : []
  });
  return canonicalize({
    mode: 'skydocx',
    files: {
      'manuscript.md': String(document.content || ''),
      'metadata.json': JSON.stringify(metadata, null, 2),
      'edition.json': JSON.stringify(edition, null, 2),
      'storefront.json': JSON.stringify(storefront, null, 2)
    },
    publishing: {},
    commerce: {}
  });
}
function catalogStatePath(config) { return path.join(config.root, 'artifacts', 'catalog-state', 'server-state.json'); }
function seedCatalogState(config) {
  let state = ensureCatalogState(null);
  state = upsertCatalogTitle(state, readFixtureWorkspace(config, 'skydocx'), { titleId: 'title_docx', titleName: 'Sovereign Author Publishing OS' });
  state = upsertCatalogTitle(state, readFixtureWorkspace(config, 'skyeblog'), { titleId: 'title_blog', titleName: 'SkyeBlog Command' });
  return state;
}
function loadCatalogState(config) {
  const existing = readJsonFile(catalogStatePath(config), null);
  if (existing && existing.schema === 'skye.catalog.state') return ensureCatalogState(existing);
  const seeded = seedCatalogState(config);
  writeJsonFile(catalogStatePath(config), seeded);
  return seeded;
}
function saveCatalogState(config, state) {
  const next = ensureCatalogState(state);
  writeJsonFile(catalogStatePath(config), next);
  return next;
}
function loadReleaseHistory(config) {
  return readJsonFile(path.join(config.root, 'artifacts', 'release-history', 'manifest.json'), { ok: false, summary: null, runs: [] });
}
function skyeDocxStatePath(config) { return path.join(config.root, 'artifacts', 'skydocxmax-state', 'documents.json'); }
function seedSkyeDocxState(config) {
  const fixture = readFixtureWorkspace(config, 'skydocx');
  return canonicalize({
    schema: 'skye.skydocxmax.state',
    version: '3.3.0',
    updated_at: nowIso(),
    documents: [
      {
        schema: 'skye.skydocxmax.document',
        version: '3.3.0',
        document_id: 'skydocxmax_primary',
        title: 'Sovereign Author Publishing OS',
        content: String(fixture?.files?.['manuscript.md'] || ''),
        metadata: JSON.parse(String(fixture?.files?.['metadata.json'] || '{}')),
        created_at: nowIso(),
        updated_at: nowIso()
      }
    ],
    exports: [],
    shares: [],
    publish_runs: []
  });
}
function ensureSkyeDocxState(value, config) {
  const base = value && value.schema === 'skye.skydocxmax.state' ? { ...value } : seedSkyeDocxState(config);
  base.documents = Array.isArray(base.documents) ? base.documents : [];
  base.exports = Array.isArray(base.exports) ? base.exports : [];
  base.shares = Array.isArray(base.shares) ? base.shares : [];
  base.publish_runs = Array.isArray(base.publish_runs) ? base.publish_runs : [];
  base.updated_at = nowIso();
  return canonicalize(base);
}
function loadSkyeDocxState(config) {
  const existing = readJsonFile(skyeDocxStatePath(config), null);
  if (existing && existing.schema === 'skye.skydocxmax.state') return ensureSkyeDocxState(existing, config);
  const seeded = seedSkyeDocxState(config);
  writeJsonFile(skyeDocxStatePath(config), seeded);
  return seeded;
}
function saveSkyeDocxState(config, state) {
  const next = ensureSkyeDocxState(state, config);
  writeJsonFile(skyeDocxStatePath(config), next);
  return next;
}
function summarizeSkyeDocxDocument(document) {
  return canonicalize({
    document_id: document.document_id,
    title: document.title,
    updated_at: document.updated_at,
    bytes: Buffer.byteLength(String(document.content || ''), 'utf8'),
    metadata: document.metadata || {}
  });
}
function upsertSkyeDocxDocument(state, body) {
  const next = { ...state, documents: state.documents.slice() };
  const documentId = String(body.document_id || body.id || '').trim() || randomId('doc');
  const title = String(body.title || body.metadata?.title || 'Untitled SkyeDocxMax Document').trim();
  const index = next.documents.findIndex((item) => item.document_id === documentId);
  const current = index >= 0 ? next.documents[index] : null;
  const record = canonicalize({
    schema: 'skye.skydocxmax.document',
    version: '3.3.0',
    document_id: documentId,
    title,
    content: String(body.content || current?.content || ''),
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : (current?.metadata || {}),
    created_at: current?.created_at || nowIso(),
    updated_at: nowIso()
  });
  if (index >= 0) next.documents[index] = record;
  else next.documents.push(record);
  next.updated_at = nowIso();
  return { state: canonicalize(next), document: record };
}
function findDocument(state, documentId) {
  return (state.documents || []).find((item) => item.document_id === documentId) || null;
}

function createConfig(env = process.env) {
  const root = path.resolve(__dirname, '..');
  const operatorPassphrase = env.SKYE_OPERATOR_PASSPHRASE || 'sovereign-build-passphrase';
  const stripeSecretKey = env.STRIPE_SECRET_KEY || '';
  const runtimeMode = env.SKYE_RUNTIME_MODE || 'development';
  const authSecret = (env.SKYE_AUTH_SECRET || '').trim();
  return {
    root,
    runtimeMode,
    authSecret,
    authRecord: hashPassphrase(operatorPassphrase, env.SKYE_OPERATOR_SALT || 'fixed-testsalt-fixed'),
    operator: env.SKYE_OPERATOR || 'Skyes Over London',
    org: env.SKYE_ORG || 'SOLEnterprises',
    paymentProvider: env.SKYE_PAYMENT_PROVIDER || 'stripe',
    stripeSecretKey,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
    stripeApiBase: env.STRIPE_API_BASE || 'https://api.stripe.com',
    runtimeStatePath: env.SKYE_RUNTIME_STATE_PATH || path.join(root, 'artifacts', 'runtime', 'server-state.json'),
    portalAutomationEnabled: env.SKYE_PORTAL_AUTOMATION_ENABLE === '1' || env.SKYE_PORTAL_AUTOMATION_ENABLE === 'true' || runtimeMode !== 'production',
    portalArtifactDir: env.SKYE_PORTAL_ARTIFACT_DIR || path.join(root, 'artifacts', 'portal-automation'),
    submissionEndpoints: {
      apple_books: env.SKYE_SUBMIT_APPLE_URL || '',
      kobo: env.SKYE_SUBMIT_KOBO_URL || '',
      kdp_ebook: env.SKYE_SUBMIT_KDP_EBOOK_URL || '',
      kdp_print_prep: env.SKYE_SUBMIT_KDP_PRINT_URL || ''
    },
    submissionDeliveryModes: {
      apple_books: env.SKYE_SUBMIT_APPLE_MODE || 'portal',
      kobo: env.SKYE_SUBMIT_KOBO_MODE || 'portal',
      kdp_ebook: env.SKYE_SUBMIT_KDP_EBOOK_MODE || 'portal',
      kdp_print_prep: env.SKYE_SUBMIT_KDP_PRINT_MODE || 'portal'
    },
    submissionAuth: {
      apple_books: env.SKYE_SUBMIT_APPLE_TOKEN ? { scheme:'bearer', token:env.SKYE_SUBMIT_APPLE_TOKEN, partner_id: env.SKYE_SUBMIT_APPLE_PARTNER_ID || '' } : null,
      kobo: env.SKYE_SUBMIT_KOBO_KEY && env.SKYE_SUBMIT_KOBO_SECRET ? { scheme:'hmac', key:env.SKYE_SUBMIT_KOBO_KEY, secret:env.SKYE_SUBMIT_KOBO_SECRET } : null,
      kdp_ebook: env.SKYE_SUBMIT_KDP_KEY && env.SKYE_SUBMIT_KDP_SECRET ? { scheme:'hmac', key:env.SKYE_SUBMIT_KDP_KEY, secret:env.SKYE_SUBMIT_KDP_SECRET } : null,
      kdp_print_prep: env.SKYE_SUBMIT_KDP_KEY && env.SKYE_SUBMIT_KDP_SECRET ? { scheme:'hmac', key:env.SKYE_SUBMIT_KDP_KEY, secret:env.SKYE_SUBMIT_KDP_SECRET } : null,
      default: env.SKYE_SUBMISSION_AUTH_TOKEN ? { scheme:'bearer', token:env.SKYE_SUBMISSION_AUTH_TOKEN } : { scheme:'none' }
    }
  };
}

function collectProductionReadiness(config) {
  const blockers = [];
  if (!config.authSecret) blockers.push('auth-secret-missing');
  try { resolvePaymentProvider({ provider: config.paymentProvider, secretKey: config.stripeSecretKey, apiBase: config.stripeApiBase }); } catch (error) { blockers.push(`payment-provider:${error.message}`); }
  if (!config.stripeSecretKey) blockers.push('stripe-secret-missing');
  if (!config.stripeWebhookSecret) blockers.push('stripe-webhook-secret-missing');
  for (const channel of Object.keys(config.submissionEndpoints)) {
    try {
      validateSubmissionConfig({ channel, package_path: __filename, package_name: 'probe.zip', package_sha256: 'probe', package_bytes: 1, title: 'Probe', slug: 'probe', metadata: {} }, { endpoint: config.submissionEndpoints[channel], auth: config.submissionAuth, strictAuth: config.runtimeMode === 'production', deliveryModes: config.submissionDeliveryModes });
    } catch (error) { blockers.push(`${channel}:${error.message}`); }
    if (config.submissionDeliveryModes[channel] === 'portal' && !config.portalAutomationEnabled) blockers.push(`${channel}:portal-automation-disabled`);
  }
  return canonicalize({ schema: 'skye.production.readiness', version: '3.3.0', runtime_mode: config.runtimeMode, payment_provider: config.paymentProvider, payment_api_base: config.stripeApiBase, journal_path: resolveJournalPath(config.runtimeStatePath), ok: blockers.length === 0, blockers });
}

function requireAuth(req, config, state) { const token = parseBearerToken(req.headers.authorization || ''); return verifyAccessToken(token, config.authSecret, Math.floor(Date.now()/1000), { revokedJtis: state.auth.revoked_jtis || [] }); }
function saveState(config, state) { return saveRuntimeState(config.runtimeStatePath, state); }
function findRefreshRecord(state, rawToken, config) { return (state.auth.refresh_tokens || []).find((item) => verifyRefreshToken(rawToken, item, config.authSecret).ok); }
function summarizeRuntime(state, config) { return { schema:'skye.runtime.summary', version:'3.3.0', auth:{ refresh_tokens:state.auth.refresh_tokens.length, revoked_jtis:state.auth.revoked_jtis.length, operator_logins:state.auth.operator_logins.length }, payments:{ pending_sessions:state.payments.pending_sessions.length, completed_orders:state.payments.completed_orders.length, webhook_events:state.payments.webhook_events.length, reconciliations:(state.payments.reconciliations||[]).length }, commerce:summarizeCommerceState(state.commerce), submissions:state.submissions.length, submission_jobs:state.submission_jobs.length, portal_runs:state.portal_runs.length, audit:state.audit.length, journal_path: resolveJournalPath(config.runtimeStatePath) }; }

function findPackagedArtifact(config, slug, channel, mode = null) {
  const manifest = summarizePackageManifest(config);
  for (const job of manifest.jobs || []) {
    if (mode && job.mode !== mode) continue;
    if (job.slug !== slug) continue;
    const found = (job.packages || []).find((pkg) => pkg.channel === channel);
    if (found && found.path) return { ...found, slug: job.slug, mode: job.mode };
  }
  return null;
}
function buildSubmissionConfig(config, channel) { return { endpoint: config.submissionEndpoints[channel], auth: config.submissionAuth, strictAuth: config.runtimeMode === 'production', deliveryModes: config.submissionDeliveryModes }; }
function buildWorkflowPreview(config, job) { return createVendorWorkflow(job, buildSubmissionConfig(config, job.channel)); }
function createSubmissionJobFromBody(config, channel, body) {
  const pkgPath = body.package_path || resolvePackagePath(config, body.package_filename || '') || (() => {
    if (body.slug) {
      const found = findPackagedArtifact(config, body.slug, channel, body.mode || null);
      return found ? found.path : null;
    }
    return null;
  })();
  if (!pkgPath) throw new Error('package-path-unresolved');
  return createSubmissionJob({ channel, package_path: pkgPath, title: body.title || body.slug || path.basename(pkgPath), slug: body.slug || path.basename(pkgPath, path.extname(pkgPath)), metadata: body.metadata || {} });
}
function enqueueSubmissionJob(config, state, job) {
  const preview = previewSubmissionContract(job, buildSubmissionConfig(config, job.channel));
  const workflow = buildWorkflowPreview(config, job);
  const record = createSubmissionJobRecord(job, { ...preview, workflow });
  state = upsertSubmissionJob(state, record);
  state = appendAuditEvent(state, { type:'submission-job-created', job_id:job.job_id, channel:job.channel, slug:job.slug });
  return { state, record, preview };
}
async function dispatchSubmissionJob(config, state, jobId) {
  const record = getSubmissionJob(state, jobId);
  if (!record) throw new Error('submission-job-not-found');
  if (record.status === 'submitted' || record.status === 'completed') return { state, record, idempotent:true, receipt: null };
  if (record.status === 'cancelled') throw new Error('submission-job-cancelled');
  const job = createSubmissionJob({ channel:record.channel, package_path:record.package_path, title:record.title, slug:record.slug, metadata:record.metadata || {} });
  job.job_id = record.job_id;
  const receipt = await submitJob(job, buildSubmissionConfig(config, record.channel));
  const updated = markSubmissionJobDispatched(record, receipt);
  state = upsertSubmissionJob(state, updated);
  state.submissions.push(receipt);
  state = appendAuditEvent(state, { type:'submission-job-dispatched', job_id:jobId, channel:record.channel, slug:record.slug });
  return { state, record:updated, idempotent:false, receipt };
}
async function syncSubmissionJobStatus(config, state, jobId) {
  const record = getSubmissionJob(state, jobId);
  if (!record) throw new Error('submission-job-not-found');
  const job = createSubmissionJob({ channel:record.channel, package_path:record.package_path, title:record.title, slug:record.slug, metadata:record.metadata || {} });
  job.job_id = record.job_id;
  const receipt = await querySubmissionStatus(job, buildSubmissionConfig(config, record.channel), record.remote_reference);
  const updated = markSubmissionJobStatus(record, receipt);
  state = upsertSubmissionJob(state, updated);
  state = appendAuditEvent(state, { type:'submission-job-status', job_id:jobId, channel:record.channel, remote_status:receipt.remote_status });
  return { state, record:updated, receipt };
}
async function cancelSubmissionRecord(config, state, jobId) {
  const record = getSubmissionJob(state, jobId);
  if (!record) throw new Error('submission-job-not-found');
  const job = createSubmissionJob({ channel:record.channel, package_path:record.package_path, title:record.title, slug:record.slug, metadata:record.metadata || {} });
  job.job_id = record.job_id;
  const receipt = await cancelSubmissionJob(job, buildSubmissionConfig(config, record.channel), record.remote_reference);
  const updated = markSubmissionJobCancelled(record, receipt);
  state = upsertSubmissionJob(state, updated);
  state = appendAuditEvent(state, { type:'submission-job-cancel', job_id:jobId, channel:record.channel });
  return { state, record:updated, receipt };
}
function planPortalRun(config, state, jobId) {
  const record = getSubmissionJob(state, jobId);
  if (!record) throw new Error('submission-job-not-found');
  const job = createSubmissionJob({ channel:record.channel, package_path:record.package_path, title:record.title, slug:record.slug, metadata:record.metadata || {} });
  job.job_id = record.job_id;
  const plan = buildPortalPlan(job, { endpoint: config.submissionEndpoints[record.channel] });
  const updated = markSubmissionJobPortalPlanned(record, plan);
  state = upsertSubmissionJob(state, updated);
  state = appendAuditEvent(state, { type:'submission-job-portal-plan', job_id:jobId, channel:record.channel, steps:plan.steps.length });
  return { state, record:updated, plan };
}
async function executePortalRun(config, state, jobId) {
  const record = getSubmissionJob(state, jobId);
  if (!record) throw new Error('submission-job-not-found');
  if (!config.portalAutomationEnabled) throw new Error('portal-automation-disabled');
  const plan = record.portal_plan || buildPortalPlan({ channel:record.channel, package_path:record.package_path, title:record.title, slug:record.slug, metadata:record.metadata || {} }, { endpoint: config.submissionEndpoints[record.channel] });
  const receipt = await runPortalAutomation(plan, { outputDir: path.join(config.portalArtifactDir, record.job_id) });
  let updated = markSubmissionJobPortalRun(record, receipt);
  if (receipt.remote_reference && updated.status === 'created') updated = { ...updated, status:'portal_automated' };
  state = upsertSubmissionJob(state, updated);
  state = recordPortalRun(state, { job_id: jobId, channel:record.channel, receipt });
  state = appendAuditEvent(state, { type:'submission-job-portal-run', job_id:jobId, channel:record.channel, ok:receipt.ok === true });
  return { state, record:updated, receipt, plan };
}

function createServer(env = process.env) {
  const config = createConfig(env);
  const readiness = collectProductionReadiness(config);
  if (config.runtimeMode === 'production' && !readiness.ok) throw new Error(`Production config invalid: ${readiness.blockers.join(', ')}`);
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') return json(res, 200, { ok:true });
      const pathname = routePath(req);
      if (pathname === '/api/health' && req.method === 'GET') {
        const state = loadRuntimeState(config.runtimeStatePath);
        return json(res, 200, { ok:true, auth_provider:'server-token', payment_provider:config.paymentProvider, submission_channels:Object.keys(config.submissionEndpoints), runtime:summarizeRuntime(state, config), readiness });
      }
      if (pathname === '/api/runtime/readiness' && req.method === 'GET') return json(res, readiness.ok ? 200 : 409, readiness);
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        let state = loadRuntimeState(config.runtimeStatePath);
        const body = parseJsonBody(await readBody(req));
        if (!verifyPassphrase(body.passphrase || '', config.authRecord)) return json(res, 401, { ok:false, error:'invalid-credentials' });
        const claims = { sub: body.operator || config.operator, org: config.org, scope:['operator:read','operator:write'] };
        const access_token = issueAccessToken(claims, config.authSecret);
        const refresh = issueRefreshToken(config.authSecret, claims.sub);
        state.auth.refresh_tokens.push(refresh);
        state.auth.operator_logins.push({ operator:claims.sub, at:new Date().toISOString() });
        state = appendAuditEvent(state, { type:'auth-login', operator:claims.sub });
        saveState(config, state);
        return json(res, 200, { ok:true, token_type:'Bearer', access_token, refresh_token:refresh.token, expires_in:900 });
      }
      if (pathname === '/api/auth/verify' && req.method === 'GET') {
        const state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        return json(res, verification.ok ? 200 : 401, verification);
      }
      if (pathname === '/api/auth/refresh' && req.method === 'POST') {
        let state = loadRuntimeState(config.runtimeStatePath);
        const body = parseJsonBody(await readBody(req));
        const record = findRefreshRecord(state, body.refresh_token, config);
        if (!record) return json(res, 401, { ok:false, error:'invalid-refresh-token' });
        const verification = verifyRefreshToken(body.refresh_token, record, config.authSecret);
        if (!verification.ok) return json(res, 401, verification);
        record.revoked = true;
        const claims = { sub:record.operator, org:config.org, scope:['operator:read','operator:write'] };
        const access_token = issueAccessToken(claims, config.authSecret);
        const refresh = issueRefreshToken(config.authSecret, record.operator);
        state.auth.refresh_tokens = state.auth.refresh_tokens.map((item) => item.refresh_id === record.refresh_id ? record : item);
        state.auth.refresh_tokens.push(refresh);
        state = appendAuditEvent(state, { type:'auth-refresh', operator:record.operator, refresh_id:record.refresh_id });
        saveState(config, state);
        return json(res, 200, { ok:true, token_type:'Bearer', access_token, refresh_token:refresh.token, expires_in:900 });
      }
      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        let state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        if (verification.payload?.jti) state.auth.revoked_jtis.push(verification.payload.jti);
        state = appendAuditEvent(state, { type:'auth-logout', operator:verification.payload.sub, jti:verification.payload?.jti || null });
        saveState(config, state);
        return json(res, 200, { ok:true });
      }
      if (pathname === '/api/runtime/summary' && req.method === 'GET') {
        const state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        return json(res, 200, { ok:true, runtime:summarizeRuntime(state, config) });
      }
      if (pathname === '/api/runtime/commerce' && req.method === 'GET') {
        const state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        return json(res, 200, { ok:true, commerce:state.commerce, summary:summarizeCommerceState(state.commerce) });
      }
      if (pathname === '/api/commerce/library' && req.method === 'GET') {
        const state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        return json(res, 200, {
          ok: true,
          library: state.commerce.library || [],
          entitlements: state.commerce.entitlements || [],
          summary: summarizeCommerceState(state.commerce)
        });
      }
      if (pathname === '/api/commerce/fulfillment-token' && req.method === 'POST') {
        const state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        const body = parseJsonBody(await readBody(req));
        const order = (state.commerce.orders || []).find((item) => item.order_id === body.order_id || item.session_id === body.session_id) || null;
        const libraryItem = (state.commerce.library || []).find((item) => item.library_id === body.library_id || item.order_id === order?.order_id) || null;
        const entitlement = (state.commerce.entitlements || []).find((item) => item.entitlement_id === body.entitlement_id || item.order_id === order?.order_id) || null;
        if (!order || !libraryItem || !entitlement) return json(res, 404, { ok: false, error: 'purchase-record-not-found' });
        return json(res, 200, {
          ok: true,
          fulfillment_token: createFulfillmentToken(order, entitlement, libraryItem),
          order_id: order.order_id,
          entitlement_id: entitlement.entitlement_id,
          library_id: libraryItem.library_id
        });
      }
      if (pathname === '/api/catalog/titles' && req.method === 'GET') {
        const runtime = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, runtime);
        if (!verification.ok) return json(res, 401, verification);
        const catalog = loadCatalogState(config);
        return json(res, 200, { ok: true, catalog, summary: summarizeCatalogState(catalog) });
      }
      if (pathname === '/api/catalog/titles' && req.method === 'POST') {
        const runtime = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, runtime);
        if (!verification.ok) return json(res, 401, verification);
        const body = parseJsonBody(await readBody(req));
        const workspace = body.workspace && typeof body.workspace === 'object'
          ? canonicalize({
              mode: body.workspace.mode || body.mode || 'skydocx',
              files: body.workspace.files || {},
              publishing: body.workspace.publishing || {},
              commerce: body.workspace.commerce || {}
            })
          : canonicalize({
              mode: body.mode || 'skydocx',
              files: body.files || readFixtureWorkspace(config, body.mode === 'skyeblog' ? 'skyeblog' : 'skydocx').files || {},
              publishing: body.publishing || {},
              commerce: body.commerce || {}
            });
        const updated = upsertCatalogTitle(loadCatalogState(config), workspace, {
          titleId: body.title_id,
          titleName: body.title_name,
          notes: body.notes || ''
        });
        const saved = saveCatalogState(config, updated);
        return json(res, 200, { ok: true, catalog: saved, summary: summarizeCatalogState(saved) });
      }
      if (pathname === '/api/release-history' && req.method === 'GET') {
        const state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        return json(res, 200, { ok: true, history: loadReleaseHistory(config) });
      }
      if (pathname === '/api/skydocxmax/documents' && req.method === 'GET') {
        const runtime = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, runtime);
        if (!verification.ok) return json(res, 401, verification);
        const state = loadSkyeDocxState(config);
        return json(res, 200, { ok: true, count: state.documents.length, documents: state.documents.map(summarizeSkyeDocxDocument) });
      }
      if (pathname === '/api/skydocxmax/documents' && req.method === 'POST') {
        const runtime = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, runtime);
        if (!verification.ok) return json(res, 401, verification);
        const body = parseJsonBody(await readBody(req));
        const result = upsertSkyeDocxDocument(loadSkyeDocxState(config), body);
        const saved = saveSkyeDocxState(config, result.state);
        return json(res, 200, { ok: true, document: result.document, count: saved.documents.length });
      }
      if (pathname === '/api/skydocxmax/import' && req.method === 'POST') {
        const runtime = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, runtime);
        if (!verification.ok) return json(res, 401, verification);
        const body = parseJsonBody(await readBody(req));
        const documentBody = body.document && typeof body.document === 'object' ? body.document : body;
        const result = upsertSkyeDocxDocument(loadSkyeDocxState(config), documentBody);
        const saved = saveSkyeDocxState(config, result.state);
        return json(res, 200, { ok: true, imported: summarizeSkyeDocxDocument(result.document), count: saved.documents.length });
      }
      if (pathname === '/api/skydocxmax/export' && req.method === 'POST') {
        const runtime = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, runtime);
        if (!verification.ok) return json(res, 401, verification);
        const body = parseJsonBody(await readBody(req));
        let state = loadSkyeDocxState(config);
        const document = findDocument(state, String(body.document_id || '').trim());
        if (!document) return json(res, 404, { ok: false, error: 'document-not-found' });
        const formats = Array.isArray(body.formats) && body.formats.length ? body.formats : ['md', 'json'];
        const receipt = canonicalize({
          export_id: randomId('export'),
          document_id: document.document_id,
          title: document.title,
          formats,
          bytes: Buffer.byteLength(String(document.content || ''), 'utf8'),
          exported_at: nowIso()
        });
        state = canonicalize({ ...state, exports: [...state.exports, receipt], updated_at: nowIso() });
        saveSkyeDocxState(config, state);
        return json(res, 200, { ok: true, export_receipt: receipt, document: summarizeSkyeDocxDocument(document) });
      }
      if (pathname === '/api/skydocxmax/share' && req.method === 'POST') {
        const runtime = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, runtime);
        if (!verification.ok) return json(res, 401, verification);
        const body = parseJsonBody(await readBody(req));
        let state = loadSkyeDocxState(config);
        const document = findDocument(state, String(body.document_id || '').trim());
        if (!document) return json(res, 404, { ok: false, error: 'document-not-found' });
        const receipt = canonicalize({
          share_id: randomId('share'),
          document_id: document.document_id,
          title: document.title,
          channel: body.channel || 'internal',
          recipient: body.recipient || body.email || '',
          note: body.note || '',
          shared_at: nowIso()
        });
        state = canonicalize({ ...state, shares: [...state.shares, receipt], updated_at: nowIso() });
        saveSkyeDocxState(config, state);
        return json(res, 200, { ok: true, share_receipt: receipt });
      }
      if (pathname === '/api/skydocxmax/publish' && req.method === 'POST') {
        const runtime = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, runtime);
        if (!verification.ok) return json(res, 401, verification);
        const body = parseJsonBody(await readBody(req));
        let state = loadSkyeDocxState(config);
        const document = findDocument(state, String(body.document_id || '').trim());
        if (!document) return json(res, 404, { ok: false, error: 'document-not-found' });
        const pkg = generateSkyeDocxPackage(buildWorkspaceFromDocument(document), { runId: body.run_id || document.document_id });
        const publishRun = canonicalize({
          publish_id: randomId('publish'),
          document_id: document.document_id,
          title: document.title,
          run_id: pkg.run_id,
          slug: pkg.slug,
          outputs: pkg.outputs,
          published_at: nowIso()
        });
        state = canonicalize({ ...state, publish_runs: [...state.publish_runs, publishRun], updated_at: nowIso() });
        saveSkyeDocxState(config, state);
        return json(res, 200, { ok: true, package: pkg, publish_run: publishRun });
      }
      if (pathname === '/api/payments/checkout/session' && req.method === 'POST') {
        let state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        const body = parseJsonBody(await readBody(req));
        const session = await createPaymentSession({
          title: body.title || 'Sovereign Author Publishing OS',
          amount_usd: Number(body.amount_usd || 49),
          customer_email: body.customer_email || '',
          success_url: body.success_url || '',
          cancel_url: body.cancel_url || '',
          metadata: body.metadata || {}
        }, { provider:config.paymentProvider, secretKey:config.stripeSecretKey, apiBase:config.stripeApiBase });
        state.payments.pending_sessions.push(session);
        state = appendAuditEvent(state, { type:'payment-session-created', provider:session.provider, session_id:session.session_id });
        saveState(config, state);
        return json(res, 200, { ok:true, session, payment_summary:paymentSummary(session) });
      }
      if (pathname.startsWith('/api/payments/checkout/session/') && req.method === 'GET') {
        const state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        const sessionId = pathname.split('/').pop();
        const details = await retrieveStripeCheckoutSession(sessionId, { provider:'stripe', secretKey:config.stripeSecretKey, apiBase:config.stripeApiBase });
        return json(res, 200, { ok:true, session:details, payment_summary:paymentSummary({ provider:'stripe', provider_mode: details.raw.livemode ? 'live' : 'test', session_id:details.session_id, amount_total:details.amount_total, currency:details.currency, customer_email:details.customer_email, title:details.metadata?.title || null, payment_status:details.payment_status, status:details.status }) });
      }
      if (pathname.startsWith('/api/payments/reconcile/') && req.method === 'POST') {
        let state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        const sessionId = pathname.split('/').pop();
        const authorPackage = readFixturePackage(config);
        const result = await reconcileStripePaymentSession(sessionId, { provider:'stripe', secretKey:config.stripeSecretKey, apiBase:config.stripeApiBase }, authorPackage, state.commerce, {}, fetch);
        state.commerce = result.commerce;
        state.payments.reconciliations.push({ session_id: sessionId, at:new Date().toISOString(), finalized: result.finalized, payment_status: result.status.payment_status, status: result.status.status });
        state = appendAuditEvent(state, { type:'payment-reconcile', session_id:sessionId, finalized:result.finalized, payment_status:result.status.payment_status });
        saveState(config, state);
        return json(res, 200, { ok:true, result, summary:summarizeCommerceState(state.commerce) });
      }
      if (pathname === '/api/payments/session/reconcile' && req.method === 'POST') {
        let state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        const body = parseJsonBody(await readBody(req));
        const sessionId = body.session_id || body.sessionId;
        if (!sessionId) return json(res, 400, { ok:false, error:'missing-session-id' });
        const authorPackage = readFixturePackage(config);
        const result = await reconcileStripePaymentSession(sessionId, { provider:'stripe', secretKey:config.stripeSecretKey, apiBase:config.stripeApiBase }, authorPackage, state.commerce, {}, fetch);
        state.commerce = result.commerce;
        state.payments.reconciliations.push({ session_id: sessionId, at:new Date().toISOString(), finalized: result.finalized, payment_status: result.status.payment_status, status: result.status.status });
        state = appendAuditEvent(state, { type:'payment-reconcile', session_id:sessionId, finalized:result.finalized, payment_status:result.status.payment_status });
        saveState(config, state);
        return json(res, 200, { ok:true, session_id:sessionId, result, summary:summarizeCommerceState(state.commerce) });
      }
      if (pathname === '/api/payments/checkout/complete-mock' && req.method === 'POST') {
        let state = loadRuntimeState(config.runtimeStatePath); const verification = requireAuth(req, config, state); if (!verification.ok) return json(res, 401, verification);
        const body = parseJsonBody(await readBody(req)); const pending = state.payments.pending_sessions.find((item) => item.session_id === body.session_id) || null;
        if (!pending && hasCompletedPaymentSession(state, body.session_id)) return json(res, 200, { ok:true, session:{ session_id:body.session_id }, commerce:state.commerce, summary:summarizeCommerceState(state.commerce), idempotent:true });
        if (!pending) return json(res, 404, { ok:false, error:'missing-session' }); if (pending.provider === 'stripe' && pending.provider_mode === 'live') return json(res, 409, { ok:false, error:'live-stripe-session-requires-webhook' }); if (hasCompletedPaymentSession(state, pending.session_id)) return json(res, 200, { ok:true, session:pending, commerce:state.commerce, summary:summarizeCommerceState(state.commerce), idempotent:true });
        const authorPackage = readFixturePackage(config); const event = { id:`evt_${pending.session_id}`, type:'checkout.session.completed', data:{ object:{ id:pending.session_id } } }; const buyer = { name:body.customer_name || 'Server Buyer', email:pending.customer_email || body.customer_email || 'buyer@internal.invalid' };
        state.commerce = finalizePayment(event, authorPackage, buyer, state.commerce, { sessionId:pending.session_id }); state.payments.completed_orders.push({ event_id:event.id, session_id:pending.session_id, provider:pending.provider, at:new Date().toISOString() }); state.payments.pending_sessions = state.payments.pending_sessions.filter((item) => item.session_id !== pending.session_id); state = appendAuditEvent(state, { type:'checkout-complete-mock', session_id:pending.session_id }); saveState(config, state);
        return json(res, 200, { ok:true, session:pending, commerce:state.commerce, summary:summarizeCommerceState(state.commerce) });
      }
      if (pathname === '/api/payments/webhook/stripe' && req.method === 'POST') {
        const rawBody = await readBody(req); const verification = verifyStripeWebhook(rawBody, req.headers['stripe-signature'], config.stripeWebhookSecret); if (!verification.ok) return json(res, 400, verification);
        let state = loadRuntimeState(config.runtimeStatePath); if (hasProcessedWebhookEvent(state, verification.event.id)) return json(res, 200, { ok:true, verification, summary:summarizeCommerceState(state.commerce), idempotent:true });
        const authorPackage = readFixturePackage(config); const buyerEmail = verification.event?.data?.object?.customer_details?.email || verification.event?.data?.object?.customer_email || 'buyer@internal.invalid';
        state.payments.webhook_events.push({ event_id:verification.event.id, type:verification.event.type, at:new Date().toISOString() }); state.payments.completed_orders.push({ event_id:verification.event.id, session_id:verification.event?.data?.object?.id || null, provider:'stripe', at:new Date().toISOString() }); state.commerce = finalizePayment(verification.event, authorPackage, { name:'Webhook Buyer', email:buyerEmail }, state.commerce); state = appendAuditEvent(state, { type:'stripe-webhook', event_id:verification.event.id }); saveState(config, state); return json(res, 200, { ok:true, verification, summary:summarizeCommerceState(state.commerce) });
      }
      if (pathname === '/api/submissions/receipts' && req.method === 'GET') {
        const state = loadRuntimeState(config.runtimeStatePath); const verification = requireAuth(req, config, state); if (!verification.ok) return json(res, 401, verification); return json(res, 200, { ok:true, count:state.submissions.length, submissions:state.submissions });
      }
      if (pathname === '/api/publishing/package' && req.method === 'POST') {
        const state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        const body = parseJsonBody(await readBody(req));
        const fixture = body.fixture === 'skyeblog'
          ? JSON.parse(fs.readFileSync(path.join(config.root, 'fixtures', 'publishing', 'skyeblog-workspace.json'), 'utf8'))
          : JSON.parse(fs.readFileSync(path.join(config.root, 'fixtures', 'publishing', 'skydocx-workspace.json'), 'utf8'));
        const pkg = generateSkyeDocxPackage(fixture, { runId: body.run_id || 'superidev3-merged' });
        return json(res, 200, { ok:true, package:pkg });
      }
      if (pathname === '/api/publishing/binaries' && req.method === 'POST') {
        const state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        const manifestPath = path.join(config.root, 'artifacts', 'publishing-binaries', 'manifest.json');
        let manifest = { ok:false, files:[] };
        try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch {}
        return json(res, 200, { ok:true, manifest });
      }
      if (pathname === '/api/publishing/packages' && req.method === 'GET') {
        const state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        return json(res, 200, { ok: true, manifest: summarizePackageManifest(config) });
      }
      if (pathname === '/api/evidence/release-gates' && req.method === 'GET') {
        const state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        const filePath = path.join(config.root, 'artifacts', 'release-gates.json');
        let gates = { ok:false };
        try { gates = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch {}
        return json(res, 200, { ok:true, gates });
      }
      if (pathname === '/api/evidence/artifacts' && req.method === 'GET') {
        const state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        const buildManifestPath = path.join(config.root, 'artifacts', 'build-manifest.json');
        const releaseChecklistPath = path.join(config.root, 'artifacts', 'release-checklist.json');
        let build_manifest = null;
        let release_checklist = null;
        try { build_manifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8')); } catch {}
        try { release_checklist = JSON.parse(fs.readFileSync(releaseChecklistPath, 'utf8')); } catch {}
        return json(res, 200, { ok:true, build_manifest, release_checklist });
      }
      if (pathname === '/api/evidence/smoke' && req.method === 'GET') {
        const state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        const summaryPath = path.join(config.root, 'artifacts', 'ui-smoke', 'ui-smoke-summary.json');
        let smoke = { ok:false };
        try { smoke = JSON.parse(fs.readFileSync(summaryPath, 'utf8')); } catch {}
        return json(res, 200, { ok:true, smoke });
      }
      if (pathname === '/api/submissions/jobs' && req.method === 'GET') {
        const state = loadRuntimeState(config.runtimeStatePath); const verification = requireAuth(req, config, state); if (!verification.ok) return json(res, 401, verification); return json(res, 200, { ok:true, count:state.submission_jobs.length, jobs:state.submission_jobs });
      }
      if (pathname === '/api/submissions/jobs' && req.method === 'POST') {
        let state = loadRuntimeState(config.runtimeStatePath); const verification = requireAuth(req, config, state); if (!verification.ok) return json(res, 401, verification); const body = parseJsonBody(await readBody(req));
        const job = createSubmissionJobFromBody(config, body.channel, body); const queued = enqueueSubmissionJob(config, state, job); state = queued.state; saveState(config, state); return json(res, 200, { ok:true, job:queued.record, preview:queued.preview, runtime:summarizeRuntime(state, config) });
      }
      if (pathname.startsWith('/api/submissions/contracts/') && pathname.endsWith('/workflow') && req.method === 'POST') {
        const state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        const parts = pathname.split('/').filter(Boolean);
        const channel = parts[3];
        const body = parseJsonBody(await readBody(req));
        const job = createSubmissionJobFromBody(config, channel, body);
        const workflow = buildWorkflowPreview(config, job);
        return json(res, 200, { ok:true, workflow });
      }
      if (pathname.startsWith('/api/submissions/contracts/') && req.method === 'POST') {
        const state = loadRuntimeState(config.runtimeStatePath); const verification = requireAuth(req, config, state); if (!verification.ok) return json(res, 401, verification); const channel = pathname.split('/').pop(); const body = parseJsonBody(await readBody(req)); const job = createSubmissionJobFromBody(config, channel, body); const preview = previewSubmissionContract(job, buildSubmissionConfig(config, channel)); return json(res, 200, { ok:true, preview });
      }
      if (pathname === '/api/submissions/from-package' && req.method === 'POST') {
        let state = loadRuntimeState(config.runtimeStatePath); const verification = requireAuth(req, config, state); if (!verification.ok) return json(res, 401, verification); const body = parseJsonBody(await readBody(req)); const found = findPackagedArtifact(config, body.slug, body.channel, body.mode || null); if (!found) return json(res, 404, { ok:false, error:'package-not-found' });
        const job = createSubmissionJob({ channel:body.channel, package_path:found.path, title:body.title || body.slug, slug:body.slug, metadata:body.metadata || {} }); const queued = enqueueSubmissionJob(config, state, job); state = queued.state; saveState(config, state); return json(res, 200, { ok:true, job:queued.record, preview:queued.preview, resolved_package:found, runtime:summarizeRuntime(state, config) });
      }
      const parts = pathParts(req);
      if (parts[0] === 'api' && parts[1] === 'submissions' && parts[2] === 'jobs' && parts[3]) {
        const jobId = parts[3];
        if (req.method === 'GET' && parts.length === 4) {
          const state = loadRuntimeState(config.runtimeStatePath); const verification = requireAuth(req, config, state); if (!verification.ok) return json(res, 401, verification); const record = getSubmissionJob(state, jobId); if (!record) return json(res, 404, { ok:false, error:'submission-job-not-found' }); return json(res, 200, { ok:true, job:record });
        }
        if (req.method === 'POST' && parts[4] === 'dispatch') {
          let state = loadRuntimeState(config.runtimeStatePath); const verification = requireAuth(req, config, state); if (!verification.ok) return json(res, 401, verification); const result = await dispatchSubmissionJob(config, state, jobId); state = result.state; saveState(config, state); return json(res, 200, { ok:true, idempotent:result.idempotent === true, job:result.record, receipt:result.receipt, runtime:summarizeRuntime(state, config) });
        }
        if (req.method === 'POST' && parts[4] === 'status-sync') {
          let state = loadRuntimeState(config.runtimeStatePath); const verification = requireAuth(req, config, state); if (!verification.ok) return json(res, 401, verification); const result = await syncSubmissionJobStatus(config, state, jobId); state = result.state; saveState(config, state); return json(res, 200, { ok:true, job:result.record, status_receipt:result.receipt, runtime:summarizeRuntime(state, config) });
        }
        if (req.method === 'POST' && parts[4] === 'cancel') {
          let state = loadRuntimeState(config.runtimeStatePath); const verification = requireAuth(req, config, state); if (!verification.ok) return json(res, 401, verification); const result = await cancelSubmissionRecord(config, state, jobId); state = result.state; saveState(config, state); return json(res, 200, { ok:true, job:result.record, cancel_receipt:result.receipt, runtime:summarizeRuntime(state, config) });
        }
        if (req.method === 'POST' && parts[4] === 'portal-plan') {
          let state = loadRuntimeState(config.runtimeStatePath); const verification = requireAuth(req, config, state); if (!verification.ok) return json(res, 401, verification); const result = planPortalRun(config, state, jobId); state = result.state; saveState(config, state); return json(res, 200, { ok:true, job:result.record, plan:result.plan, runtime:summarizeRuntime(state, config) });
        }
        if (req.method === 'POST' && parts[4] === 'portal-run') {
          let state = loadRuntimeState(config.runtimeStatePath); const verification = requireAuth(req, config, state); if (!verification.ok) return json(res, 401, verification); const result = await executePortalRun(config, state, jobId); state = result.state; saveState(config, state); return json(res, 200, { ok:true, job:result.record, receipt:result.receipt, plan:result.plan, runtime:summarizeRuntime(state, config) });
        }
      }
      if (pathname === '/api/submissions/dispatch' && req.method === 'POST') {
        let state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        const body = parseJsonBody(await readBody(req));
        if (!body.job_id) return json(res, 400, { ok:false, error:'missing-job-id' });
        const result = await dispatchSubmissionJob(config, state, body.job_id);
        state = result.state;
        saveState(config, state);
        return json(res, 200, { ok:true, idempotent:result.idempotent === true, job:result.record, receipt:result.receipt, runtime:summarizeRuntime(state, config) });
      }
      if (pathname === '/api/submissions/status' && req.method === 'POST') {
        let state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        const body = parseJsonBody(await readBody(req));
        if (!body.job_id) return json(res, 400, { ok:false, error:'missing-job-id' });
        const result = await syncSubmissionJobStatus(config, state, body.job_id);
        state = result.state;
        saveState(config, state);
        return json(res, 200, { ok:true, job:result.record, status_receipt:result.receipt, runtime:summarizeRuntime(state, config) });
      }
      if (pathname === '/api/submissions/cancel' && req.method === 'POST') {
        let state = loadRuntimeState(config.runtimeStatePath);
        const verification = requireAuth(req, config, state);
        if (!verification.ok) return json(res, 401, verification);
        const body = parseJsonBody(await readBody(req));
        if (!body.job_id) return json(res, 400, { ok:false, error:'missing-job-id' });
        const result = await cancelSubmissionRecord(config, state, body.job_id);
        state = result.state;
        saveState(config, state);
        return json(res, 200, { ok:true, job:result.record, cancel_receipt:result.receipt, runtime:summarizeRuntime(state, config) });
      }
      if (pathname.startsWith('/api/submissions/') && req.method === 'POST') {
        let state = loadRuntimeState(config.runtimeStatePath); const verification = requireAuth(req, config, state); if (!verification.ok) return json(res, 401, verification); const channel = pathname.split('/').pop(); const body = parseJsonBody(await readBody(req)); const job = createSubmissionJobFromBody(config, channel, body); const result = enqueueSubmissionJob(config, state, job); state = result.state; saveState(config, state); return json(res, 200, { ok:true, job:result.record, preview:result.preview, runtime:summarizeRuntime(state, config) });
      }
      return json(res, 404, { ok:false, error:'not-found' });
    } catch (error) { return json(res, 500, { ok:false, error:error.message }); }
  });
  return { config, readiness, server };
}

module.exports = { createConfig, collectProductionReadiness, summarizePackageManifest, createServer };
