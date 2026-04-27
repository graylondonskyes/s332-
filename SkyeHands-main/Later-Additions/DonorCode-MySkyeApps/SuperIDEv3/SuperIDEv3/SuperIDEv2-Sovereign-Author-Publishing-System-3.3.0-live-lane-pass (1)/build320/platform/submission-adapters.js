const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { canonicalize } = require('./export-import');

function guessContentType(filePath) {
  if (filePath.endsWith('.zip')) return 'application/zip';
  if (filePath.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}

function sha256Bytes(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function hmacHex(secret, value) { return crypto.createHmac('sha256', secret).update(value).digest('hex'); }
function nowIso() { return new Date().toISOString(); }
function normalizeBaseEndpoint(endpoint) { return String(endpoint || '').replace(/\/+$/, ''); }

function createSubmissionJob({ channel, package_path, title, slug, metadata = {} }) {
  if (!fs.existsSync(package_path)) throw new Error(`Package not found: ${package_path}`);
  const bytes = fs.readFileSync(package_path);
  return canonicalize({
    schema: 'skye.submission.job',
    version: '3.2.0',
    job_id: `sub_${crypto.randomBytes(8).toString('hex')}`,
    channel,
    title,
    slug,
    package_path,
    package_name: path.basename(package_path),
    package_bytes: bytes.length,
    package_sha256: sha256Bytes(bytes),
    metadata
  });
}

function normalizeChannel(channel) {
  return ({ apple_books:'apple_books', kobo:'kobo', kdp_ebook:'kdp_ebook', kdp_print_prep:'kdp_print_prep' })[channel] || 'generic';
}

function resolveDeliveryMode(job, config = {}) {
  const modes = config.deliveryModes || config.delivery_modes || {};
  return modes[job.channel] || config.deliveryMode || 'portal';
}

function createChannelPayload(job) {
  const base = { job_id: job.job_id, title: job.title, slug: job.slug, package_name: job.package_name, package_sha256: job.package_sha256, package_bytes: job.package_bytes, metadata: job.metadata };
  if (job.channel === 'apple_books') return canonicalize({ schema:'skye.apple-books.submission', version:'3.2.0', ingest_mode:'portal-automation', partner_reference:`${job.slug}:${job.job_id}`, storefronts: job.metadata.storefronts || ['US'], asset:{ filename:job.package_name, sha256:job.package_sha256, bytes:job.package_bytes }, ...base });
  if (job.channel === 'kobo') return canonicalize({ schema:'skye.kobo.submission', version:'3.2.0', ingest_mode:'portal-automation', territory_rights: job.metadata.territory_rights || ['WORLD'], publication_status: job.metadata.publication_status || 'draft', asset:{ filename:job.package_name, sha256:job.package_sha256, bytes:job.package_bytes }, ...base });
  if (job.channel === 'kdp_ebook') return canonicalize({ schema:'skye.kdp-ebook.submission', version:'3.2.0', ingest_mode:'portal-automation', marketplace_ids: job.metadata.marketplace_ids || ['ATVPDKIKX0DER'], drm_mode: job.metadata.drm_mode || 'provider-default', ebook_asset:{ filename:job.package_name, sha256:job.package_sha256, bytes:job.package_bytes }, ...base });
  if (job.channel === 'kdp_print_prep') return canonicalize({ schema:'skye.kdp-print-prep.submission', version:'3.2.0', ingest_mode:'portal-automation', trim_size: job.metadata.trim_size || '6x9', interior_type: job.metadata.interior_type || 'black_and_white', print_asset:{ filename:job.package_name, sha256:job.package_sha256, bytes:job.package_bytes }, ...base });
  return canonicalize({ schema:'skye.generic-submission', version:'3.2.0', ingest_mode:'portal-automation', asset:{ filename:job.package_name, sha256:job.package_sha256, bytes:job.package_bytes }, ...base });
}

function resolveAuthForChannel(channel, config = {}) {
  if (config.auth && typeof config.auth === 'object') {
    if (config.auth[channel]) return config.auth[channel];
    if (config.auth.default) return config.auth.default;
  }
  if (config.authToken) return { scheme:'bearer', token:config.authToken };
  return { scheme:'none' };
}

function validateSubmissionConfig(job, config) {
  if (!config?.endpoint) throw new Error(`Submission endpoint missing for ${job.channel}.`);
  let url;
  try { url = new URL(config.endpoint); } catch { throw new Error(`Invalid submission endpoint for ${job.channel}.`); }
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error(`Non-local submission endpoints must use HTTPS (${job.channel}).`);
  const auth = resolveAuthForChannel(job.channel, config);
  const deliveryMode = resolveDeliveryMode(job, config);
  if (deliveryMode !== 'portal' && deliveryMode !== 'api') throw new Error(`Unsupported delivery mode (${deliveryMode}).`);
  if (config.strictAuth === true) {
    if (job.channel === 'apple_books' && !(auth.scheme === 'bearer' && auth.token && auth.partner_id)) throw new Error('Apple Books auth requires bearer token and partner_id.');
    if (job.channel === 'kobo' && !(auth.scheme === 'hmac' && auth.key && auth.secret)) throw new Error('Kobo auth requires HMAC key and secret.');
    if ((job.channel === 'kdp_ebook' || job.channel === 'kdp_print_prep') && !(auth.scheme === 'hmac' && auth.key && auth.secret)) throw new Error('KDP auth requires HMAC key and secret.');
  }
}

function buildHeaders(job, config = {}, channelPayload, contentType = 'application/json', stepName = '') {
  const auth = resolveAuthForChannel(job.channel, config);
  const headers = { 'x-skye-channel': job.channel, 'x-skye-package-sha256': job.package_sha256, 'x-skye-job-id': job.job_id, 'x-skye-step': stepName || 'submit', 'content-type': contentType };
  if (job.channel === 'apple_books') {
    if (auth.scheme === 'bearer' && auth.token) headers.authorization = `Bearer ${auth.token}`;
    if (auth.partner_id) headers['x-apple-partner-id'] = auth.partner_id;
  } else if (job.channel === 'kobo') {
    const signature = auth.scheme === 'hmac' && auth.secret ? hmacHex(auth.secret, `${job.job_id}:${job.package_sha256}:${job.package_bytes}:${stepName}`) : null;
    if (auth.key) headers['x-kobo-key'] = auth.key;
    if (signature) headers['x-kobo-signature'] = signature;
  } else if (job.channel === 'kdp_ebook' || job.channel === 'kdp_print_prep') {
    const timestamp = nowIso();
    const signingBase = `${job.job_id}:${timestamp}:${job.package_sha256}:${channelPayload.schema}:${stepName}`;
    const signature = auth.scheme === 'hmac' && auth.secret ? hmacHex(auth.secret, signingBase) : null;
    if (auth.key) headers['x-kdp-access-key'] = auth.key;
    headers['x-kdp-timestamp'] = timestamp;
    if (signature) headers['x-kdp-signature'] = signature;
  }
  return headers;
}

function readPackage(job) { return fs.readFileSync(job.package_path); }

function portalBootstrapBody(job) {
  return JSON.stringify({ schema:'skye.portal.session.bootstrap', version:'3.2.0', channel:job.channel, operator: job.metadata.operator || 'Skyes Over London', organization: job.metadata.organization || 'SOLEnterprises', job_id: job.job_id });
}
function portalDraftBody(job, channelPayload) {
  return JSON.stringify({ schema:'skye.portal.title.draft', version:'3.2.0', channel:job.channel, title:job.title, slug:job.slug, channel_payload: channelPayload });
}
function portalAssetInitBody(job) {
  return JSON.stringify({ schema:'skye.portal.asset.init', version:'3.2.0', channel:job.channel, job_id:job.job_id, title_slug:job.slug, asset:{ filename:job.package_name, sha256:job.package_sha256, bytes:job.package_bytes } });
}
function portalAttachBody(job, channelPayload, state) {
  return JSON.stringify({ schema:'skye.portal.asset.attach', version:'3.2.0', channel:job.channel, draft_id:state.draft_id, upload_reference:state.upload_reference, uploaded_sha256:state.uploaded_sha256 || job.package_sha256, uploaded_bytes:state.uploaded_bytes || job.package_bytes, channel_payload:channelPayload });
}
function portalSubmitBody(job, channelPayload, state) {
  return JSON.stringify({ schema:'skye.portal.submission.submit', version:'3.2.0', channel:job.channel, draft_id:state.draft_id, title:job.title, slug:job.slug, attached_asset:state.upload_reference, channel_payload:channelPayload });
}

function createPortalWorkflow(job, config, channelPayload, base, binaryBytes, binaryContentType) {
  const steps = [
    { name:'bootstrap_portal_session', method:'POST', endpoint:`${base}/portal/session/bootstrap`, headers:buildHeaders(job, config, channelPayload, 'application/json', 'bootstrap_portal_session'), body:portalBootstrapBody(job), body_kind:'json', request_schema:'skye.portal.session.bootstrap' },
    { name:'create_title_draft', method:'POST', endpoint:`${base}/portal/titles/draft`, headers:buildHeaders(job, config, channelPayload, 'application/json', 'create_title_draft'), body_factory:'portal_draft', body_kind:'json', request_schema:'skye.portal.title.draft' },
    { name:'init_asset_upload', method:'POST', endpoint:`${base}/portal/assets/init`, headers:buildHeaders(job, config, channelPayload, 'application/json', 'init_asset_upload'), body_factory:'portal_asset_init', body_kind:'json', request_schema:'skye.portal.asset.init' },
    { name:'upload_binary', method:'PUT', endpoint_template:'upload_url', headers:buildHeaders(job, config, channelPayload, binaryContentType, 'upload_binary'), body_binary:binaryBytes, body_kind:'binary', request_schema:'skye.portal.asset.binary' },
    { name:'attach_asset_to_draft', method:'POST', endpoint:`${base}/portal/assets/attach`, headers:buildHeaders(job, config, channelPayload, 'application/json', 'attach_asset_to_draft'), body_factory:'portal_attach', body_kind:'json', request_schema:'skye.portal.asset.attach' },
    { name:'submit_portal_release', method:'POST', endpoint:`${base}/portal/submissions/submit`, headers:buildHeaders(job, config, channelPayload, 'application/json', 'submit_portal_release'), body_factory:'portal_submit', body_kind:'json', request_schema:'skye.portal.submission.submit' }
  ];
  return canonicalize({ schema:'skye.vendor.workflow', version:'3.2.0', channel:job.channel, delivery_mode:'portal', request_schema:channelPayload.schema, steps });
}

function createApiWorkflow(job, config, channelPayload, base, binaryBytes, binaryContentType) {
  if (job.channel === 'apple_books') return canonicalize({ schema:'skye.vendor.workflow', version:'3.2.0', channel:job.channel, delivery_mode:'api', request_schema:channelPayload.schema, steps:[
    { name:'init_upload', method:'POST', endpoint:`${base}/uploads/init`, headers:buildHeaders(job, config, channelPayload, 'application/json', 'init_upload'), body:portalAssetInitBody(job), body_kind:'json', request_schema:'skye.apple-books.upload.init' },
    { name:'upload_binary', method:'PUT', endpoint_template:'upload_url', headers:buildHeaders(job, config, channelPayload, binaryContentType, 'upload_binary'), body_binary:binaryBytes, body_kind:'binary', request_schema:'skye.apple-books.upload.binary' },
    { name:'submit_release', method:'POST', endpoint:`${base}/submissions`, headers:buildHeaders(job, config, channelPayload, 'application/json', 'submit_release'), body_factory:'portal_submit', body_kind:'json', request_schema:channelPayload.schema }
  ]});
  if (job.channel === 'kobo') return canonicalize({ schema:'skye.vendor.workflow', version:'3.2.0', channel:job.channel, delivery_mode:'api', request_schema:channelPayload.schema, steps:[
    { name:'init_asset', method:'POST', endpoint:`${base}/assets/init`, headers:buildHeaders(job, config, channelPayload, 'application/json', 'init_asset'), body:portalAssetInitBody(job), body_kind:'json', request_schema:'skye.kobo.asset.init' },
    { name:'upload_asset', method:'PUT', endpoint_template:'upload_url', headers:buildHeaders(job, config, channelPayload, binaryContentType, 'upload_asset'), body_binary:binaryBytes, body_kind:'binary', request_schema:'skye.kobo.asset.binary' },
    { name:'submit_publication', method:'POST', endpoint:`${base}/publications`, headers:buildHeaders(job, config, channelPayload, 'application/json', 'submit_publication'), body_factory:'portal_submit', body_kind:'json', request_schema:'skye.kobo.publication.submit' }
  ]});
  if (job.channel === 'kdp_ebook' || job.channel === 'kdp_print_prep') {
    const channelPrefix = job.channel === 'kdp_ebook' ? 'ebook' : 'print';
    return canonicalize({ schema:'skye.vendor.workflow', version:'3.2.0', channel:job.channel, delivery_mode:'api', request_schema:channelPayload.schema, steps:[
      { name:'init_asset', method:'POST', endpoint:`${base}/uploads/init`, headers:buildHeaders(job, config, channelPayload, 'application/json', 'init_asset'), body:portalAssetInitBody(job), body_kind:'json', request_schema:'skye.kdp.asset.init' },
      { name:'upload_asset', method:'PUT', endpoint_template:'upload_url', headers:buildHeaders(job, config, channelPayload, binaryContentType, 'upload_asset'), body_binary:binaryBytes, body_kind:'binary', request_schema:`skye.kdp.${channelPrefix}.binary` },
      { name:'finalize_asset', method:'POST', endpoint:`${base}/uploads/finalize`, headers:buildHeaders(job, config, channelPayload, 'application/json', 'finalize_asset'), body_factory:'kdp_finalize_asset', body_kind:'json', request_schema:'skye.kdp.asset.finalize' },
      { name:'submit_title', method:'POST', endpoint:`${base}/titles/${channelPrefix}`, headers:buildHeaders(job, config, channelPayload, 'application/json', 'submit_title'), body_factory:'portal_submit', body_kind:'json', request_schema:job.channel === 'kdp_ebook' ? 'skye.kdp.ebook.submit' : 'skye.kdp.print.submit' }
    ]});
  }
  return canonicalize({ schema:'skye.vendor.workflow', version:'3.2.0', channel:job.channel, delivery_mode:'api', request_schema:channelPayload.schema, steps:[{ name:'submit_generic', method:'POST', endpoint:base, headers:buildHeaders(job, config, channelPayload, 'application/json', 'submit_generic'), body:JSON.stringify({ schema:'skye.submission.request', version:'3.2.0', channel:job.channel, channel_payload:channelPayload }), body_kind:'json', request_schema:'skye.submission.request' }]});
}

function createVendorWorkflow(job, config = {}) {
  validateSubmissionConfig(job, config);
  const channelPayload = createChannelPayload(job);
  const base = normalizeBaseEndpoint(config.endpoint);
  const binaryBytes = readPackage(job);
  const binaryContentType = guessContentType(job.package_path);
  return resolveDeliveryMode(job, config) === 'portal'
    ? createPortalWorkflow(job, config, channelPayload, base, binaryBytes, binaryContentType)
    : createApiWorkflow(job, config, channelPayload, base, binaryBytes, binaryContentType);
}

function previewSubmissionContract(job, config) {
  const workflow = createVendorWorkflow(job, config);
  const statusRequest = buildStatusRequest(job, config, `${job.slug}:${job.job_id}`);
  const cancelRequest = buildCancelRequest(job, config, `${job.slug}:${job.job_id}`);
  return canonicalize({
    schema:'skye.submission.contract.preview',
    version:'3.2.0',
    channel:job.channel,
    delivery_mode: workflow.delivery_mode,
    endpoint: normalizeBaseEndpoint(config.endpoint),
    request_schema: workflow.request_schema,
    stages: workflow.steps.map((step) => ({ name:step.name, method:step.method, endpoint:step.endpoint || step.endpoint_template, body_kind:step.body_kind, request_schema:step.request_schema, header_names:Object.keys(step.headers || {}).sort() })),
    header_names:Array.from(new Set(workflow.steps.flatMap((step) => Object.keys(step.headers || {})))).sort(),
    status_schema:statusRequest.request_schema,
    status_method:statusRequest.method,
    cancel_schema:cancelRequest.request_schema,
    cancel_method:cancelRequest.method,
    title:job.title,
    slug:job.slug,
    package_name:job.package_name,
    package_sha256:job.package_sha256,
    package_bytes:job.package_bytes
  });
}

function parseRemoteResponse(text, contentType = '') {
  if (String(contentType).includes('application/json')) { try { return JSON.parse(text); } catch { return { raw:text }; } }
  try { return JSON.parse(text); } catch { return { raw:text }; }
}

async function performRequest(request, fetchImpl = fetch) {
  const response = await fetchImpl(request.endpoint, { method: request.method, headers: request.headers, body: request.body });
  const text = await response.text();
  const data = parseRemoteResponse(text, response.headers.get ? response.headers.get('content-type') : '');
  return { response, data };
}

function materializeStepRequest(step, job, config, channelPayload, state) {
  const endpoint = step.endpoint_template === 'upload_url' ? (state.upload_url || state.upload_endpoint) : step.endpoint;
  if (!endpoint) throw new Error(`Workflow endpoint unresolved for ${step.name}.`);
  let body = step.body;
  if (step.body_binary) body = step.body_binary;
  if (step.body_factory === 'portal_draft') body = portalDraftBody(job, channelPayload);
  if (step.body_factory === 'portal_asset_init') body = portalAssetInitBody(job);
  if (step.body_factory === 'portal_attach') body = portalAttachBody(job, channelPayload, state);
  if (step.body_factory === 'portal_submit') body = portalSubmitBody(job, channelPayload, state);
  if (step.body_factory === 'kdp_finalize_asset') body = JSON.stringify({ schema:'skye.kdp.asset.finalize', version:'3.2.0', job_id:job.job_id, channel:job.channel, upload_reference:state.upload_reference, uploaded_sha256:state.uploaded_sha256 || job.package_sha256, uploaded_bytes:state.uploaded_bytes || job.package_bytes });
  return { endpoint, method:step.method, headers:step.headers, body, body_kind:step.body_kind, request_schema:step.request_schema, name:step.name };
}

function resolveWorkflowState(current, stepName, data) {
  const next = { ...(current || {}) };
  if (stepName === 'bootstrap_portal_session') next.portal_session_id = data.portal_session_id || data.session_id || next.portal_session_id || null;
  if (stepName === 'create_title_draft') next.draft_id = data.draft_id || data.title_id || data.reference || next.draft_id || null;
  if (stepName === 'init_asset_upload' || stepName === 'init_upload' || stepName === 'init_asset') {
    next.upload_reference = data.upload_reference || data.asset_reference || data.reference || next.upload_reference || null;
    next.upload_url = data.upload_url || data.put_url || next.upload_url || null;
  }
  if (stepName === 'upload_binary' || stepName === 'upload_asset') {
    next.uploaded_sha256 = data.uploaded_sha256 || data.sha256 || next.uploaded_sha256 || null;
    next.uploaded_bytes = data.uploaded_bytes || data.bytes || next.uploaded_bytes || null;
  }
  if (stepName === 'submit_portal_release' || stepName === 'submit_release' || stepName === 'submit_publication' || stepName === 'submit_title') {
    next.remote_reference = data.reference || data.job_reference || data.partner_reference || next.remote_reference || null;
  }
  return next;
}

async function submitJob(job, config, fetchImpl = fetch) {
  const channelPayload = createChannelPayload(job);
  const workflow = createVendorWorkflow(job, config);
  let state = {};
  const transportHistory = [];
  let finalData = null;
  let finalStatus = 'accepted';
  for (const step of workflow.steps) {
    const request = materializeStepRequest(step, job, config, channelPayload, state);
    const { response, data } = await performRequest(request, fetchImpl);
    if (!response.ok) throw new Error(`Submission failed (${response.status}) for ${job.channel} at ${step.name}.`);
    state = resolveWorkflowState(state, step.name, data || {});
    transportHistory.push(canonicalize({ step:step.name, endpoint:request.endpoint, method:request.method, request_schema:request.request_schema, body_kind:request.body_kind, transport_status:response.status, remote_status:data.status || data.remote_status || null }));
    finalData = data;
    finalStatus = data.remote_status || data.status || finalStatus;
  }
  return canonicalize({ schema:'skye.submission.receipt', version:'3.2.0', ok:true, channel:job.channel, normalized_channel:normalizeChannel(job.channel), delivery_mode:workflow.delivery_mode, job_id:job.job_id, title:job.title, slug:job.slug, endpoint:normalizeBaseEndpoint(config.endpoint), request_schema:workflow.request_schema, workflow_steps:workflow.steps.map((step) => step.name), workflow_step_count:workflow.steps.length, request_body_kind:workflow.steps[workflow.steps.length - 1]?.body_kind || null, transport_status:transportHistory[transportHistory.length - 1]?.transport_status || 200, remote_reference:state.remote_reference || finalData?.reference || `${job.slug}:${job.job_id}`, remote_status:finalStatus, upload_reference:state.upload_reference || null, upload_sha256:state.uploaded_sha256 || job.package_sha256, draft_id:state.draft_id || null, portal_session_id:state.portal_session_id || null, remote_receipt:finalData, transport_history:transportHistory, submitted_at:nowIso() });
}

function buildStatusRequest(job, config = {}, remoteReference = null) {
  validateSubmissionConfig(job, config);
  const auth = resolveAuthForChannel(job.channel, config);
  const base = normalizeBaseEndpoint(config.endpoint);
  const ref = remoteReference || `${job.slug}:${job.job_id}`;
  const deliveryMode = resolveDeliveryMode(job, config);
  if (deliveryMode === 'portal') {
    const headers = buildHeaders(job, config, createChannelPayload(job), 'application/json', 'portal_status_sync');
    return canonicalize({ endpoint:`${base}/portal/submissions/status`, method:'POST', headers, body:JSON.stringify({ schema:'skye.portal.submission.status.request', version:'3.2.0', channel:job.channel, remote_reference:ref, slug:job.slug }), request_schema:'skye.portal.submission.status.request' });
  }
  if (job.channel === 'apple_books') { const headers = { 'x-skye-channel': job.channel, 'x-skye-job-id': job.job_id }; if (auth.scheme === 'bearer' && auth.token) headers.authorization = `Bearer ${auth.token}`; if (auth.partner_id) headers['x-apple-partner-id'] = auth.partner_id; return canonicalize({ endpoint:`${base}/submissions/status?partner_reference=${encodeURIComponent(ref)}`, method:'GET', headers, request_schema:'skye.apple-books.status' }); }
  if (job.channel === 'kobo') return canonicalize({ endpoint:`${base}/publications/status`, method:'POST', headers:{ 'content-type':'application/json', 'x-skye-channel':job.channel, 'x-kobo-key':auth.key || '', 'x-kobo-signature': auth.secret ? hmacHex(auth.secret, `${job.job_id}:status`) : '' }, body:JSON.stringify({ schema:'skye.kobo.status.request', version:'3.2.0', job_id:job.job_id, remote_reference:ref, slug:job.slug }), request_schema:'skye.kobo.status.request' });
  if (job.channel === 'kdp_ebook' || job.channel === 'kdp_print_prep') { const ts = nowIso(); return canonicalize({ endpoint:`${base}/titles/status`, method:'POST', headers:{ 'content-type':'application/json', 'x-skye-channel':job.channel, 'x-kdp-access-key':auth.key || '', 'x-kdp-timestamp':ts, 'x-kdp-signature': auth.secret ? hmacHex(auth.secret, `${job.job_id}:${ts}:status`) : '' }, body:JSON.stringify({ schema:'skye.kdp.status.request', version:'3.2.0', channel:job.channel, job_id:job.job_id, remote_reference:ref, slug:job.slug }), request_schema:'skye.kdp.status.request' }); }
  return canonicalize({ endpoint:`${base}/status`, method:'POST', headers:{ 'content-type':'application/json', 'x-skye-channel':job.channel }, body:JSON.stringify({ schema:'skye.submission.status.request', version:'3.2.0', job_id:job.job_id, remote_reference:ref, slug:job.slug }), request_schema:'skye.submission.status.request' });
}

function buildCancelRequest(job, config = {}, remoteReference = null) {
  validateSubmissionConfig(job, config);
  const auth = resolveAuthForChannel(job.channel, config);
  const base = normalizeBaseEndpoint(config.endpoint);
  const ref = remoteReference || `${job.slug}:${job.job_id}`;
  const deliveryMode = resolveDeliveryMode(job, config);
  if (deliveryMode === 'portal') {
    const headers = buildHeaders(job, config, createChannelPayload(job), 'application/json', 'portal_cancel');
    return canonicalize({ endpoint:`${base}/portal/submissions/cancel`, method:'POST', headers, body:JSON.stringify({ schema:'skye.portal.submission.cancel.request', version:'3.2.0', channel:job.channel, remote_reference:ref, slug:job.slug }), request_schema:'skye.portal.submission.cancel.request' });
  }
  const baseHeaders = { 'content-type':'application/json', 'x-skye-channel':job.channel, 'x-skye-job-id':job.job_id };
  if (job.channel === 'apple_books') { if (auth.scheme === 'bearer' && auth.token) baseHeaders.authorization = `Bearer ${auth.token}`; if (auth.partner_id) baseHeaders['x-apple-partner-id'] = auth.partner_id; return canonicalize({ endpoint:`${base}/submissions/cancel`, method:'POST', headers:baseHeaders, body:JSON.stringify({ schema:'skye.apple-books.cancel.request', version:'3.2.0', partner_reference:ref, slug:job.slug }), request_schema:'skye.apple-books.cancel.request' }); }
  if (job.channel === 'kobo') { if (auth.key) baseHeaders['x-kobo-key'] = auth.key; if (auth.secret) baseHeaders['x-kobo-signature'] = hmacHex(auth.secret, `${job.job_id}:cancel`); return canonicalize({ endpoint:`${base}/publications/cancel`, method:'POST', headers:baseHeaders, body:JSON.stringify({ schema:'skye.kobo.cancel.request', version:'3.2.0', remote_reference:ref, slug:job.slug }), request_schema:'skye.kobo.cancel.request' }); }
  if (job.channel === 'kdp_ebook' || job.channel === 'kdp_print_prep') { const ts = nowIso(); if (auth.key) baseHeaders['x-kdp-access-key'] = auth.key; baseHeaders['x-kdp-timestamp'] = ts; if (auth.secret) baseHeaders['x-kdp-signature'] = hmacHex(auth.secret, `${job.job_id}:${ts}:cancel`); return canonicalize({ endpoint:`${base}/titles/cancel`, method:'POST', headers:baseHeaders, body:JSON.stringify({ schema:'skye.kdp.cancel.request', version:'3.2.0', channel:job.channel, remote_reference:ref, slug:job.slug }), request_schema:'skye.kdp.cancel.request' }); }
  return canonicalize({ endpoint:`${base}/cancel`, method:'POST', headers:baseHeaders, body:JSON.stringify({ schema:'skye.submission.cancel.request', version:'3.2.0', remote_reference:ref, slug:job.slug }), request_schema:'skye.submission.cancel.request' });
}

async function querySubmissionStatus(job, config, remoteReference = null, fetchImpl = fetch) {
  const request = buildStatusRequest(job, config, remoteReference);
  const { response, data } = await performRequest(request, fetchImpl);
  if (!response.ok) throw new Error(`Submission status failed (${response.status}) for ${job.channel}.`);
  const remoteStatus = data.remote_status || data.status || data.state || 'accepted';
  const completedStates = new Set(['completed','delivered','accepted_live','published']);
  return canonicalize({ schema:'skye.submission.status.receipt', version:'3.2.0', ok:true, channel:job.channel, delivery_mode:resolveDeliveryMode(job, config), job_id:job.job_id, remote_reference:data.reference || data.job_reference || remoteReference || `${job.slug}:${job.job_id}`, remote_status:remoteStatus, job_status: completedStates.has(remoteStatus) ? 'completed' : (remoteStatus === 'cancelled' ? 'cancelled' : 'submitted'), transport_status:response.status, raw:data, checked_at:nowIso() });
}

async function cancelSubmissionJob(job, config, remoteReference = null, fetchImpl = fetch) {
  const request = buildCancelRequest(job, config, remoteReference);
  const { response, data } = await performRequest(request, fetchImpl);
  if (!response.ok) throw new Error(`Submission cancel failed (${response.status}) for ${job.channel}.`);
  return canonicalize({ schema:'skye.submission.cancel.receipt', version:'3.2.0', ok:true, channel:job.channel, delivery_mode:resolveDeliveryMode(job, config), job_id:job.job_id, remote_reference:data.reference || data.job_reference || remoteReference || `${job.slug}:${job.job_id}`, remote_status:data.remote_status || data.status || 'cancelled', transport_status:response.status, raw:data, cancelled_at:nowIso() });
}

function buildSubmissionRequest(job, config) {
  const workflow = createVendorWorkflow(job, config);
  const first = workflow.steps[0];
  return canonicalize({ endpoint:first.endpoint || first.endpoint_template, method:first.method, headers:first.headers, body:first.body || null, body_kind:first.body_kind, request_schema:first.request_schema });
}

module.exports = { createSubmissionJob, createChannelPayload, resolveAuthForChannel, resolveDeliveryMode, validateSubmissionConfig, createVendorWorkflow, buildSubmissionRequest, buildStatusRequest, buildCancelRequest, previewSubmissionContract, submitJob, querySubmissionStatus, cancelSubmissionJob };
