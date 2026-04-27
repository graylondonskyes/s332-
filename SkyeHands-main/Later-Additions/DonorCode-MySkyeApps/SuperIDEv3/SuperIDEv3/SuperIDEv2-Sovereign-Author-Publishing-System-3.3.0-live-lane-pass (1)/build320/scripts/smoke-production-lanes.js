const { spawn } = require('child_process');
const readline = require('readline');
const { fail, ok, repoPath, writeJson } = require('./lib');

(async () => {
  const child = spawn('node', [repoPath('scripts','start-ui-bridge-stack.js')], { cwd: repoPath(), stdio: ['ignore','pipe','pipe'] });
  const rl = readline.createInterface({ input: child.stdout });
  const firstLine = await new Promise((resolve, reject) => {
    rl.once('line', resolve);
    child.once('error', reject);
    child.stderr.on('data', (chunk) => { const text = String(chunk || ''); if (text.trim()) process.stderr.write(text); });
  });
  const stack = JSON.parse(firstLine);
  const base = stack.api_base;
  const login = await fetch(`${base}/api/auth/login`, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ operator:'Skyes Over London', passphrase:'sovereign-build-passphrase' }) });
  const loginData = await login.json();
  if (!loginData.ok || !loginData.access_token || !loginData.refresh_token) fail('[production-lanes] FAIL :: login');
  const verify = await fetch(`${base}/api/auth/verify`, { headers:{ authorization:`Bearer ${loginData.access_token}` } });
  const verifyData = await verify.json();
  if (!verifyData.ok) fail('[production-lanes] FAIL :: verify');
  const readiness = await fetch(`${base}/api/runtime/readiness`);
  const readinessData = await readiness.json();
  if (!readinessData.ok || readinessData.runtime_mode !== 'test') fail('[production-lanes] FAIL :: readiness');
  const refresh = await fetch(`${base}/api/auth/refresh`, { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ refresh_token: loginData.refresh_token }) });
  const refreshData = await refresh.json();
  if (!refreshData.ok) fail('[production-lanes] FAIL :: refresh');

  const authHeaders = { authorization:`Bearer ${refreshData.access_token}`, 'content-type':'application/json' };
  const checkout = await fetch(`${base}/api/payments/checkout/session`, { method:'POST', headers:authHeaders, body: JSON.stringify({ title:'Sovereign Author Publishing OS', amount_usd:49, customer_email:'buyer@example.com', metadata:{ slug:'sovereign-author-publishing-os' } }) });
  const checkoutData = await checkout.json();
  if (!checkoutData.ok) fail('[production-lanes] FAIL :: checkout');
  const sessionLookup = await fetch(`${base}/api/payments/checkout/session/${checkoutData.session.session_id}`, { headers:{ authorization:`Bearer ${refreshData.access_token}` } });
  const sessionLookupData = await sessionLookup.json();
  if (!sessionLookupData.ok || !sessionLookupData.session.line_items.length) fail('[production-lanes] FAIL :: session-lookup');
  const reconcile = await fetch(`${base}/api/payments/reconcile/${checkoutData.session.session_id}`, { method:'POST', headers:authHeaders });
  const reconcileData = await reconcile.json();
  if (!reconcileData.ok || reconcileData.summary.orders_count < 1) fail('[production-lanes] FAIL :: reconcile');

  const workflowPreview = await fetch(`${base}/api/submissions/contracts/apple_books/workflow`, { method:'POST', headers:authHeaders, body: JSON.stringify({ slug:'sovereign-author-publishing-os', mode:'skydocx', channel:'apple_books', title:'Sovereign Author Publishing OS', metadata:{ smoke:true, operator:'Skyes Over London', portal_password:'portal-test-password' } }) });
  const workflowData = await workflowPreview.json();
  if (!workflowData.ok || workflowData.workflow.steps.length < 3) fail('[production-lanes] FAIL :: workflow-preview');

  const jobCreate = await fetch(`${base}/api/submissions/from-package`, { method:'POST', headers:authHeaders, body: JSON.stringify({ slug:'sovereign-author-publishing-os', mode:'skydocx', channel:'apple_books', title:'Sovereign Author Publishing OS', metadata:{ smoke:true, operator:'Skyes Over London', portal_password:'portal-test-password' } }) });
  const jobCreateData = await jobCreate.json();
  if (!jobCreateData.ok || jobCreateData.job.status !== 'created') fail('[production-lanes] FAIL :: create-submission-job');
  const portalPlan = await fetch(`${base}/api/submissions/jobs/${jobCreateData.job.job_id}/portal-plan`, { method:'POST', headers:authHeaders });
  const portalPlanData = await portalPlan.json();
  if (!portalPlanData.ok || portalPlanData.plan.steps.length < 10) fail('[production-lanes] FAIL :: portal-plan');
  const portalRun = await fetch(`${base}/api/submissions/jobs/${jobCreateData.job.job_id}/portal-run`, { method:'POST', headers:authHeaders });
  const portalRunData = await portalRun.json();
  if (!portalRunData.ok || !portalRunData.receipt.ok || !portalRunData.receipt.remote_reference) fail('[production-lanes] FAIL :: portal-run');
  const jobDispatch = await fetch(`${base}/api/submissions/jobs/${jobCreateData.job.job_id}/dispatch`, { method:'POST', headers:authHeaders });
  const dispatchData = await jobDispatch.json();
  if (!jobDispatch.ok || !dispatchData.receipt.ok || dispatchData.receipt.workflow_step_count < 3) fail('[production-lanes] FAIL :: dispatch-submission-job');
  const jobStatus = await fetch(`${base}/api/submissions/jobs/${jobCreateData.job.job_id}/status-sync`, { method:'POST', headers:authHeaders });
  const statusData = await jobStatus.json();
  if (!statusData.ok) fail('[production-lanes] FAIL :: status-sync');
  const jobCancel = await fetch(`${base}/api/submissions/jobs/${jobCreateData.job.job_id}/cancel`, { method:'POST', headers:authHeaders });
  const cancelData = await jobCancel.json();
  if (!cancelData.ok || cancelData.job.status !== 'cancelled') fail('[production-lanes] FAIL :: cancel-submission-job');

  const receiptsRes = await fetch(`${base}/api/submissions/receipts`, { headers:{ authorization:`Bearer ${refreshData.access_token}` } });
  const receiptsData = await receiptsRes.json();
  if (!receiptsData.ok || receiptsData.count < 1) fail('[production-lanes] FAIL :: receipts');

  child.kill('SIGTERM');

  writeJson(repoPath('artifacts','production-lanes','server-auth.json'), {
    generated_at:new Date().toISOString(),
    ok:true,
    login:{ ok:loginData.ok, token_type:loginData.token_type, expires_in:loginData.expires_in || null },
    verify:{ ok:verifyData.ok, payload:verifyData.payload || null },
    refresh:{ ok:refreshData.ok, expires_in:refreshData.expires_in || null }
  });
  writeJson(repoPath('artifacts','production-lanes','payment-gateway.json'), {
    generated_at:new Date().toISOString(),
    ok:true,
    resolved:{ provider: checkoutData.session.provider, mode: checkoutData.session.provider_mode || null },
    session: checkoutData.session,
    lookup: sessionLookupData.session,
    payment_summary: sessionLookupData.payment_summary || null,
    reconcile: { ok:reconcileData.ok, finalized:reconcileData.result.finalized, payment_status:reconcileData.result.status.payment_status },
    commerce_summary: reconcileData.summary,
    idempotent_orders: reconcileData.summary.orders_count
  });
  writeJson(repoPath('artifacts','production-lanes','manifest.json'), {
    generated_at:new Date().toISOString(),
    ok:true,
    readiness:{ ok:readinessData.ok, runtime_mode:readinessData.runtime_mode, blockers:readinessData.blockers.length },
    login:{ ok:loginData.ok, token_type:loginData.token_type },
    verify:{ ok:verifyData.ok, subject:verifyData.payload.sub },
    refresh:{ ok:refreshData.ok },
    checkout:{ ok:checkoutData.ok, provider:checkoutData.session.provider, session_id:checkoutData.session.session_id },
    lookup:{ ok:sessionLookupData.ok, payment_status:sessionLookupData.session.payment_status },
    reconcile:{ ok:reconcileData.ok, finalized:reconcileData.result.finalized },
    submission_workflow:{ ok:workflowData.ok, workflow_steps:workflowData.workflow.steps.length },
    submission_job:{ ok:jobCreateData.ok, job_id:jobCreateData.job.job_id, portal_plan_steps:portalPlanData.plan.steps.length, portal_run_reference:portalRunData.receipt.remote_reference, created_status:jobCreateData.job.status, dispatched_status:dispatchData.job.status, dispatched_steps:dispatchData.receipt.workflow_step_count, synced_status:statusData.job.status, cancelled_status:cancelData.job.status },
    receipts:{ ok:receiptsData.ok, count:receiptsData.count }
  });
  ok('[production-lanes] PASS');
})().catch((error) => fail(error.stack || error.message));
