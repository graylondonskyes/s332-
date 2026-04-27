const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');
const { createServer } = require('../server/create-server');
const { repoPath } = require('./lib');

function json(res, code, value) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); }
function html(res, body) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(body); }
function makeId(prefix) { return `${prefix}_${crypto.randomBytes(6).toString('hex')}`; }

function portalPage(channel, kind) {
  const nextMap = { login:'draft', draft:'upload', upload:'review', review:'status', status:'status' };
  const next = nextMap[kind];
  return `<!doctype html><html><head><meta charset="utf-8"><title>${channel} ${kind}</title></head><body>
    <main>
      <h1>${channel} portal ${kind}</h1>
      ${kind === 'login' ? `
      <input id="operator" value="Skyes Over London" />
      <input id="password" value="portal-test-password" type="password" />
      <button id="login-submit">Login</button>
      ` : ''}
      ${kind === 'draft' ? `
      <input id="title" value="Sovereign Author Publishing OS" />
      <input id="slug" value="sovereign-author-publishing-os" />
      <button id="draft-submit">Create Draft</button>
      ` : ''}
      ${kind === 'upload' ? `
      <input id="package-file" type="file" />
      <button id="upload-submit">Upload</button>
      ` : ''}
      ${kind === 'review' ? `
      <div id="attach-status" data-status="pending">pending</div>
      <button id="attach-submit">Attach</button>
      <button id="submit-final">Submit</button>
      <div id="submission-reference"></div>
      ` : ''}
      ${kind === 'status' ? `
      <button id="status-sync">Sync Status</button>
      <button id="cancel-job">Cancel</button>
      <div id="remote-status"></div>
      ` : ''}
    </main>
    <script>
      const channel = ${JSON.stringify(channel)};
      async function j(url, init){ const res = await fetch(url, init); return await res.json(); }
      if (${JSON.stringify(kind)} === 'login') {
        document.querySelector('#login-submit').onclick = async () => { sessionStorage.setItem('operator', document.querySelector('#operator').value); sessionStorage.setItem('password', document.querySelector('#password').value); location.href = '/${channel}/portal-ui/${next}'; };
      }
      if (${JSON.stringify(kind)} === 'draft') {
        document.querySelector('#draft-submit').onclick = async () => { const title=document.querySelector('#title').value; const slug=document.querySelector('#slug').value; const out = await j('/${channel}/portal/titles/draft', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ title, slug }) }); sessionStorage.setItem('draft_id', out.draft_id); sessionStorage.setItem('title', title); sessionStorage.setItem('slug', slug); location.href = '/${channel}/portal-ui/${next}'; };
      }
      if (${JSON.stringify(kind)} === 'upload') {
        document.querySelector('#upload-submit').onclick = async () => { const file = document.querySelector('#package-file').files[0]; const init = await j('/${channel}/portal/assets/init', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ title:sessionStorage.getItem('title'), slug:sessionStorage.getItem('slug') }) }); const bytes = new Uint8Array(await file.arrayBuffer()); await fetch(init.upload_url, { method:'PUT', body:bytes, headers:{ 'x-skye-package-sha256':'browser-upload' } }); sessionStorage.setItem('upload_reference', init.upload_reference); location.href = '/${channel}/portal-ui/${next}'; };
      }
      if (${JSON.stringify(kind)} === 'review') {
        document.querySelector('#attach-submit').onclick = async () => { const out = await j('/${channel}/portal/assets/attach', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ draft_id:sessionStorage.getItem('draft_id'), upload_reference:sessionStorage.getItem('upload_reference') }) }); const node=document.querySelector('#attach-status'); node.textContent=out.status; node.dataset.status='attached'; };
        document.querySelector('#submit-final').onclick = async () => { const out = await j('/${channel}/portal/submissions/submit', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ draft_id:sessionStorage.getItem('draft_id'), channel_payload:{ slug:sessionStorage.getItem('slug') } }) }); sessionStorage.setItem('remote_reference', out.reference); document.querySelector('#submission-reference').textContent=out.reference; };
      }
      if (${JSON.stringify(kind)} === 'status') {
        document.querySelector('#status-sync').onclick = async () => { const out = await j('/${channel}/portal/submissions/status', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ remote_reference:sessionStorage.getItem('remote_reference') }) }); document.querySelector('#remote-status').textContent=out.remote_status || out.status || 'completed'; };
        const cancel = document.querySelector('#cancel-job'); if (cancel) cancel.onclick = async () => { const out = await j('/${channel}/portal/submissions/cancel', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ remote_reference:sessionStorage.getItem('remote_reference') }) }); document.querySelector('#remote-status').textContent=out.status || 'cancelled'; };
      }
    </script>
  </body></html>`;
}

(async () => {
  const state = {
    stripe: { sessions:new Map() },
    apple: { sessions:new Map(), drafts:new Map(), uploads:new Map(), submissions:new Map() },
    kobo: { sessions:new Map(), drafts:new Map(), uploads:new Map(), submissions:new Map() },
    kdp: { sessions:new Map(), drafts:new Map(), uploads:new Map(), submissions:new Map() }
  };

  const echoServer = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const parts = url.pathname.split('/').filter(Boolean);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks);
    const rawText = raw.toString('utf8');
    let body;
    try { body = JSON.parse(rawText || '{}'); } catch { body = Object.fromEntries(new URLSearchParams(rawText)); }

    if (parts[0] === 'stripe' && parts[1] === 'v1' && parts[2] === 'checkout' && parts[3] === 'sessions' && req.method === 'POST') {
      const id = makeId('cs_test');
      const data = { id, url:`https://checkout.stripe.test/session/${id}`, amount_total:Number(body['line_items[0][price_data][unit_amount]'] || 0), amount_subtotal:Number(body['line_items[0][price_data][unit_amount]'] || 0), currency:body['line_items[0][price_data][currency]'] || 'usd', payment_status:'unpaid', status:'open', customer_email:body.customer_email || 'buyer@example.com', metadata: body.metadata ? JSON.parse(body.metadata) : {}, livemode:false };
      state.stripe.sessions.set(id, data);
      return json(res, 200, data);
    }
    if (parts[0] === 'stripe' && parts[1] === 'v1' && parts[2] === 'checkout' && parts[3] === 'sessions' && parts[4] && parts[5] === 'line_items' && req.method === 'GET') {
      const session = state.stripe.sessions.get(parts[4]) || { amount_total:4900, currency:'usd' };
      return json(res, 200, { object:'list', data:[{ description:'Sovereign Author Publishing OS', amount_total: session.amount_total, currency:session.currency || 'usd', quantity:1 }] });
    }
    if (parts[0] === 'stripe' && parts[1] === 'v1' && parts[2] === 'checkout' && parts[3] === 'sessions' && parts[4] && req.method === 'GET') {
      const session = state.stripe.sessions.get(parts[4]) || { id:parts[4], amount_total:4900, amount_subtotal:4900, currency:'usd', customer_email:'buyer@example.com', payment_status:'paid', status:'complete', metadata:{ slug:'sovereign-author-publishing-os' }, livemode:false };
      return json(res, 200, { ...session, payment_status: 'paid', status: 'complete' });
    }

    const maps = parts[0] === 'apple_books' ? state.apple : (parts[0] === 'kobo' ? state.kobo : state.kdp);
    if (parts[1] === 'portal-ui') return html(res, portalPage(parts[0], parts[2] || 'login'));
    if (parts[1] === 'portal' && parts[2] === 'session' && parts[3] === 'bootstrap') { const session = makeId(`${parts[0]}_session`); maps.sessions.set(session, { channel:parts[0] }); return json(res, 200, { ok:true, portal_session_id:session, status:'ready' }); }
    if (parts[1] === 'portal' && parts[2] === 'titles' && parts[3] === 'draft') { const draft = makeId(`${parts[0]}_draft`); maps.drafts.set(draft, { channel:parts[0] }); return json(res, 200, { ok:true, draft_id:draft, status:'draft_created' }); }
    if (parts[1] === 'portal' && parts[2] === 'assets' && parts[3] === 'init') { const ref = makeId(`${parts[0]}_asset`); maps.uploads.set(ref, { channel:parts[0] }); return json(res, 200, { ok:true, upload_reference:ref, upload_url:`http://127.0.0.1:${echoServer.address().port}/${parts[0]}/portal/assets/${ref}` }); }
    if (parts[1] === 'portal' && parts[2] === 'assets' && parts[3] && req.method === 'PUT') return json(res, 200, { ok:true, upload_reference:parts[3], uploaded_bytes:raw.length, uploaded_sha256:req.headers['x-skye-package-sha256'] || null });
    if (parts[1] === 'portal' && parts[2] === 'assets' && parts[3] === 'attach') return json(res, 200, { ok:true, draft_id:body.draft_id, upload_reference:body.upload_reference, status:'attached' });
    if (parts[1] === 'portal' && parts[2] === 'submissions' && parts[3] === 'submit') { const ref = `${parts[0]}:${body.channel_payload?.slug || 'slug'}:${body.draft_id || 'draft'}`; maps.submissions.set(ref, { status:'accepted_live' }); return json(res, 200, { ok:true, reference:ref, status:'accepted_live' }); }
    if (parts[1] === 'portal' && parts[2] === 'submissions' && parts[3] === 'status') { const ref = body.remote_reference; maps.submissions.set(ref, { status:'completed' }); return json(res, 200, { ok:true, reference:ref, remote_status:'completed' }); }
    if (parts[1] === 'portal' && parts[2] === 'submissions' && parts[3] === 'cancel') { const ref = body.remote_reference; maps.submissions.set(ref, { status:'cancelled' }); return json(res, 200, { ok:true, reference:ref, status:'cancelled' }); }

    return json(res, 404, { ok:false, error:'unknown-route', path:url.pathname, method:req.method });
  });

  await new Promise((resolve) => echoServer.listen(0, '127.0.0.1', resolve));
  const echoPort = echoServer.address().port;
  const runtimeStatePath = repoPath('artifacts','production-lanes','server-state.json');
  try { require('fs').rmSync(runtimeStatePath, { force:true }); } catch {}
  try { require('fs').rmSync(`${runtimeStatePath.replace(/\.json$/, '')}.journal.ndjson`, { force:true }); } catch {}
  const env = {
    ...process.env,
    SKYE_RUNTIME_MODE: process.env.SKYE_RUNTIME_MODE || 'test',
    SKYE_AUTH_SECRET: process.env.SKYE_AUTH_SECRET || 'smoke-auth-secret',
    SKYE_OPERATOR_PASSPHRASE: process.env.SKYE_OPERATOR_PASSPHRASE || 'sovereign-build-passphrase',
    SKYE_RUNTIME_STATE_PATH: runtimeStatePath,
    SKYE_PORTAL_AUTOMATION_ENABLE: '1',
    SKYE_PORTAL_ARTIFACT_DIR: repoPath('artifacts','portal-automation'),
    SKYE_PAYMENT_PROVIDER: 'stripe',
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_local_sim',
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret',
    STRIPE_API_BASE: `http://127.0.0.1:${echoPort}/stripe`,
    SKYE_SUBMIT_APPLE_URL: `http://127.0.0.1:${echoPort}/apple_books`,
    SKYE_SUBMIT_APPLE_MODE: 'portal',
    SKYE_SUBMIT_KOBO_URL: `http://127.0.0.1:${echoPort}/kobo`,
    SKYE_SUBMIT_KOBO_MODE: 'portal',
    SKYE_SUBMIT_KDP_EBOOK_URL: `http://127.0.0.1:${echoPort}/kdp_ebook`,
    SKYE_SUBMIT_KDP_EBOOK_MODE: 'portal',
    SKYE_SUBMIT_KDP_PRINT_URL: `http://127.0.0.1:${echoPort}/kdp_print_prep`,
    SKYE_SUBMIT_KDP_PRINT_MODE: 'portal',
    SKYE_SUBMIT_APPLE_TOKEN: 'apple-token',
    SKYE_SUBMIT_APPLE_PARTNER_ID: 'partner-001',
    SKYE_SUBMIT_KOBO_KEY: 'kobo-key',
    SKYE_SUBMIT_KOBO_SECRET: 'kobo-secret',
    SKYE_SUBMIT_KDP_KEY: 'kdp-key',
    SKYE_SUBMIT_KDP_SECRET: 'kdp-secret'
  };
  const { server } = createServer(env);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const apiPort = server.address().port;
  process.stdout.write(JSON.stringify({ api_base: `http://127.0.0.1:${apiPort}`, echo_port: echoPort }) + '\n');
  const cleanup = () => { server.close(() => {}); echoServer.close(() => {}); process.exit(0); };
  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);
})();
