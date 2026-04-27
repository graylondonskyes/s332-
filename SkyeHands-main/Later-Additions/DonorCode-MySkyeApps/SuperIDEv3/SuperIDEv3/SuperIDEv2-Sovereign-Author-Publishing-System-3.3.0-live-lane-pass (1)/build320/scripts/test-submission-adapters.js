const http = require('http');
const { createSubmissionJob, submitJob, previewSubmissionContract, createVendorWorkflow } = require('../platform/submission-adapters');
const { fail, ok, repoPath, writeJson } = require('./lib');

function json(res, code, value) { res.writeHead(code, { 'content-type':'application/json' }); res.end(JSON.stringify(value)); }
function makeId(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 10)}`; }

(async () => {
  const state = { sessions:new Map(), drafts:new Map(), uploads:new Map(), submissions:new Map() };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const parts = url.pathname.split('/').filter(Boolean);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks);
    let body = {};
    try { body = JSON.parse(raw.toString('utf8') || '{}'); } catch { body = { raw: raw.toString('utf8') }; }

    if (parts[1] === 'portal' && parts[2] === 'session' && parts[3] === 'bootstrap') {
      const session = makeId(`${parts[0]}_session`); state.sessions.set(session, { channel:parts[0] }); return json(res, 200, { ok:true, portal_session_id:session, status:'ready' });
    }
    if (parts[1] === 'portal' && parts[2] === 'titles' && parts[3] === 'draft') {
      const draft = makeId(`${parts[0]}_draft`); state.drafts.set(draft, { channel:parts[0] }); return json(res, 200, { ok:true, draft_id:draft, status:'draft_created' });
    }
    if (parts[1] === 'portal' && parts[2] === 'assets' && parts[3] === 'init') {
      const ref = makeId(`${parts[0]}_asset`); state.uploads.set(ref, { channel:parts[0] }); return json(res, 200, { ok:true, upload_reference:ref, upload_url:`http://127.0.0.1:${server.address().port}/${parts[0]}/portal/assets/${ref}` });
    }
    if (parts[1] === 'portal' && parts[2] === 'assets' && parts[3] && req.method === 'PUT') {
      return json(res, 200, { ok:true, upload_reference:parts[3], uploaded_bytes:raw.length, uploaded_sha256:req.headers['x-skye-package-sha256'] || null });
    }
    if (parts[1] === 'portal' && parts[2] === 'assets' && parts[3] === 'attach') {
      return json(res, 200, { ok:true, draft_id:body.draft_id, upload_reference:body.upload_reference, status:'attached' });
    }
    if (parts[1] === 'portal' && parts[2] === 'submissions' && parts[3] === 'submit') {
      const ref = `${parts[0]}:${body.channel_payload?.slug || 'slug'}:${body.draft_id || 'draft'}`; state.submissions.set(ref, { status:'accepted_live' }); return json(res, 200, { ok:true, reference:ref, status:'accepted_live' });
    }
    if (parts[1] === 'portal' && parts[2] === 'submissions' && parts[3] === 'status') {
      const ref = body.remote_reference; state.submissions.set(ref, { status:'completed' }); return json(res, 200, { ok:true, reference:ref, remote_status:'completed' });
    }
    if (parts[1] === 'portal' && parts[2] === 'submissions' && parts[3] === 'cancel') {
      const ref = body.remote_reference; state.submissions.set(ref, { status:'cancelled' }); return json(res, 200, { ok:true, reference:ref, status:'cancelled' });
    }
    return json(res, 404, { ok:false, path:url.pathname });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const packagePath = repoPath('artifacts','retailer-packages','skydocx','sovereign-author-publishing-os-apple-ready.zip');
  const channels = ['apple_books', 'kobo', 'kdp_ebook', 'kdp_print_prep'];
  const auth = {
    apple_books: { scheme:'bearer', token:'apple-token', partner_id:'partner-001' },
    kobo: { scheme:'hmac', key:'kobo-key', secret:'kobo-secret' },
    kdp_ebook: { scheme:'hmac', key:'kdp-key', secret:'kdp-secret' },
    kdp_print_prep: { scheme:'hmac', key:'kdp-key', secret:'kdp-secret' }
  };
  const deliveryModes = Object.fromEntries(channels.map((channel) => [channel, 'portal']));
  const receipts = [];
  const previews = [];
  for (const channel of channels) {
    const job = createSubmissionJob({ channel, package_path: packagePath, title:'Sovereign Author Publishing OS', slug:'sovereign-author-publishing-os', metadata:{ environment:'test' } });
    const base = `http://127.0.0.1:${port}/${channel}`;
    const preview = previewSubmissionContract(job, { endpoint: base, auth, strictAuth: true, deliveryModes });
    const workflow = createVendorWorkflow(job, { endpoint: base, auth, strictAuth: true, deliveryModes });
    if (!preview.stages.length || preview.stages.length !== workflow.steps.length || preview.delivery_mode !== 'portal') { await new Promise((resolve) => server.close(resolve)); fail(`[submission-adapters] FAIL :: preview ${channel}`); }
    if (preview.stages[0].name !== 'bootstrap_portal_session' || preview.stages.length < 6) { await new Promise((resolve) => server.close(resolve)); fail(`[submission-adapters] FAIL :: workflow ${channel}`); }
    const receipt = await submitJob(job, { endpoint: base, auth, strictAuth: true, deliveryModes });
    if (!receipt.ok || receipt.channel !== channel || receipt.workflow_step_count !== preview.stages.length || !receipt.transport_history.length || receipt.delivery_mode !== 'portal') { await new Promise((resolve) => server.close(resolve)); fail(`[submission-adapters] FAIL :: submit ${channel}`); }
    receipts.push(receipt); previews.push(preview);
  }
  await new Promise((resolve) => server.close(resolve));
  writeJson(repoPath('artifacts', 'production-lanes', 'submission-adapters.json'), { ok:true, count:receipts.length, receipts, previews });
  ok('[submission-adapters] PASS');
})().catch((error) => fail(error.stack || error.message));
