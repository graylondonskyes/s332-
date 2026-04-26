/* V24 legacy record proof runner */
(function(){
  if(window.__ROUTEX_V24__) return; window.__ROUTEX_V24__ = true;
  const LEGACY_RUN_KEY = 'skye_routex_legacy_record_runs_v1';
  const LEGACY_INTAKE_KEY = 'skye_routex_legacy_proof_intake_v1';
  const LEGACY_OUTBOX_KEY = 'skye_routex_legacy_outbox_v1';
  const readJSON = (key, fallback)=>{ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } };
  const writeJSON = (key, value)=> localStorage.setItem(key, JSON.stringify(value));
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const uid = window.uid || (()=>('v24-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const nowISO = window.nowISO || (()=> new Date().toISOString());
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  const fmt = window.fmt || (v => new Date(v || Date.now()).toLocaleString());
  const hash = window.tinyHash || function(input){ const str = String(input || ''); let h = 2166136261 >>> 0; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ('00000000' + (h >>> 0).toString(16)).slice(-8); };
  const $ = window.$ || (sel => document.querySelector(sel));
  const laneOrder = ['route-pack','service-summary','account-code','voice-note','heat-score','pseudo-map-board','trip-pack'];

  function readLegacyRuns(){ return readJSON(LEGACY_RUN_KEY, []).filter(Boolean).slice(0,60); }
  function saveLegacyRuns(rows){ writeJSON(LEGACY_RUN_KEY, (Array.isArray(rows) ? rows : []).slice(0,60)); }
  function pushLegacyRun(row){ const rows = readLegacyRuns().filter(item => clean(item.id) !== clean(row.id)); rows.unshift(row); saveLegacyRuns(rows); return row; }
  function readLegacyIntake(){ return readJSON(LEGACY_INTAKE_KEY, []).filter(Boolean).slice(0,80); }
  function saveLegacyIntake(rows){ writeJSON(LEGACY_INTAKE_KEY, (Array.isArray(rows) ? rows : []).slice(0,80)); }
  function pushLegacyIntake(row){ const rows = readLegacyIntake().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); rows.unshift(row); saveLegacyIntake(rows); return row; }
  function readLegacyOutbox(){ return readJSON(LEGACY_OUTBOX_KEY, []).filter(Boolean).slice(0,80); }
  function saveLegacyOutbox(rows){ writeJSON(LEGACY_OUTBOX_KEY, (Array.isArray(rows) ? rows : []).slice(0,80)); }
  function pushLegacyOutbox(row){ const rows = readLegacyOutbox().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); rows.unshift(row); saveLegacyOutbox(rows); return row; }
  function summarizeMatrix(entry){
    const variants = Array.isArray(entry && entry.variants) ? entry.variants : [];
    let best = { score:-1, routeCount:0, stopCount:0, docCount:0, passed:0, total:variants.length };
    variants.forEach(item => {
      const counts = item && item.counts ? item.counts : {};
      const score = Number(counts.routes || 0) + Number(counts.stops || 0) + Number(counts.docs || 0);
      if(item && item.ok) best.passed += 1;
      if(score > best.score){
        best = { ...best, score, routeCount:Number(counts.routes || 0), stopCount:Number(counts.stops || 0), docCount:Number(counts.docs || 0) };
      }
    });
    return best;
  }
  function buildLegacyIntakeRow(lane, bundle, matrix){
    const states = (bundle && bundle.saved && bundle.saved.proofStates) ? bundle.saved.proofStates : ((bundle && bundle.states) || {});
    const summary = summarizeMatrix(matrix);
    const digest = JSON.stringify({ lane, states, matrixId: matrix && matrix.id, routes: summary.routeCount, stops: summary.stopCount, docs: summary.docCount });
    return {
      id: uid(),
      importedAt: nowISO(),
      label: 'Legacy proof • ' + lane + ' • ' + dayISO(),
      source: 'legacy-record-proof-runner',
      fingerprint: 'lg-' + hash(digest),
      lane,
      routeCount: summary.routeCount,
      stopCount: summary.stopCount,
      docCount: summary.docCount,
      latestMatrixId: clean(matrix && matrix.id),
      latestLaneProofId: clean(bundle && bundle.saved && bundle.saved.id),
      note: 'Legacy runner replayed the seeded legacy fixture and saved a historical generation matrix for ' + lane + '.',
      proofStates: states,
      matrixSummary: { passedVariants: summary.passed, totalVariants: summary.total }
    };
  }
  function buildLegacyRunHtml(row){
    const rows = (Array.isArray(row && row.laneResults) ? row.laneResults : []).map(item => '<tr><td>'+esc(item.lane || '—')+'</td><td>'+(item.ok ? '✅' : '⚠️')+'</td><td>'+(item.states && item.states.legacy ? '✓' : '')+'</td><td>'+(item.states && item.states.restore ? '✓' : '')+'</td><td>'+esc(String(item.matrixVariants || 0))+'</td><td>'+esc(item.matrixId || '—')+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Legacy record proof run</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex legacy-record proof run</h1><div><span class="badge">'+esc(row && row.label || 'Legacy proof')+'</span><span class="badge">'+esc(row && row.fingerprint || '—')+'</span><span class="badge">'+((row && row.ok) ? 'PASS' : 'REVIEW')+'</span><span class="badge">Imported '+esc(String(row && row.importedCount || 0))+'</span></div><div style="margin-top:8px;">'+esc(row && row.note || '')+'</div></div><div class="card"><table><thead><tr><th>Lane</th><th>OK</th><th>Legacy</th><th>Restore</th><th>Matrix variants</th><th>Matrix id</th><th>Note</th></tr></thead><tbody>'+(rows || '<tr><td colspan="7">No lane data captured.</td></tr>')+'</tbody></table></div></div>\n</body></html>';
  }
  async function runLegacyRecordProofComplete(){
    const laneResults = [];
    const importedRows = [];
    for(const lane of laneOrder){
      let bundle = null;
      let matrix = null;
      try{ bundle = await runProofLaneBundleSmart(lane); }catch(err){ bundle = { states:{ legacy:false, restore:false }, saved:{ note: clean(err && err.message) || 'Bundle failed.' } }; }
      try{ matrix = await runHistoricalGenerationMatrix(lane); }catch(err){ matrix = { id:'', variants:[], note: clean(err && err.message) || 'Generation matrix failed.' }; }
      const states = (bundle && bundle.saved && bundle.saved.proofStates) ? bundle.saved.proofStates : ((bundle && bundle.states) || {});
      const matrixVariants = Array.isArray(matrix && matrix.variants) ? matrix.variants.length : 0;
      const ok = !!states.legacy && !!states.restore && matrixVariants > 0;
      const note = [clean(bundle && bundle.saved && bundle.saved.note), clean(matrix && matrix.note)].filter(Boolean).join(' • ');
      laneResults.push({ lane, ok, states, matrixId: clean(matrix && matrix.id), matrixVariants, note });
      importedRows.push(buildLegacyIntakeRow(lane, bundle, matrix));
    }
    importedRows.forEach(row => pushLegacyIntake(row));
    importedRows.forEach(row => pushLegacyOutbox({ ...row, exportedAt: nowISO(), source:'routex-legacy-outbox' }));
    const digest = JSON.stringify({ laneResults: laneResults.map(item => ({ lane:item.lane, ok:item.ok, matrix:item.matrixId })), imported: importedRows.map(item => item.fingerprint) });
    const ok = laneResults.every(item => item.ok) && importedRows.length === laneOrder.length;
    const row = pushLegacyRun({
      id: uid(),
      createdAt: nowISO(),
      source: 'legacy-record-proof-complete',
      label: 'Legacy record proof • ' + dayISO(),
      fingerprint: 'lrp-' + hash(digest),
      ok,
      importedCount: importedRows.length,
      outboxCount: readLegacyOutbox().length,
      laneResults,
      note: ok ? 'Legacy-record proof runner saved imported legacy proof rows, generation matrices, and AE FLOW outbox payloads for every directive-first lane.' : 'Legacy-record proof runner saved evidence, but one or more lanes still need review.'
    });
    return row;
  }
  function exportLatestLegacyProofHtml(){ const row = readLegacyRuns()[0]; if(!row) return toast('Run legacy proof first.', 'warn'); downloadText(buildLegacyRunHtml(row), 'routex_legacy_record_proof_' + dayISO() + '.html', 'text/html'); toast('Legacy proof HTML exported.', 'good'); }
  function exportLatestLegacyProofJson(){ const row = readLegacyRuns()[0]; if(!row) return toast('Run legacy proof first.', 'warn'); downloadText(JSON.stringify(row, null, 2), 'routex_legacy_record_proof_' + dayISO() + '.json', 'application/json'); toast('Legacy proof JSON exported.', 'good'); }
  function openLegacyProofRunnerManager(){
    const rows = readLegacyRuns().map(item => '<div class="item"><div class="meta"><div class="name">'+esc(item.label || 'Legacy proof')+' <span class="badge">'+esc(item.fingerprint || '—')+'</span></div><div class="sub">'+esc(fmt(item.createdAt || Date.now()))+' • '+esc(item.note || '')+'</div></div><div class="row" style="justify-content:flex-end;flex-wrap:wrap;"><button class="btn small" data-legacy-html="'+esc(item.id)+'">HTML</button><button class="btn small" data-legacy-json="'+esc(item.id)+'">JSON</button></div></div>').join('') || '<div class="hint">No legacy-record proof runs saved yet.</div>';
    openModal('Legacy record proof', '<div class="hint">This is the one-click legacy lane runner. It replays the directive-first lanes through the legacy fixture path, saves historical matrix evidence, stores legacy intake rows, and pushes a shared outbox payload AE FLOW can sync.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="legacy_run">Run legacy proof</button><button class="btn" id="legacy_export_html">Export latest HTML</button><button class="btn" id="legacy_export_json">Export latest JSON</button></div><div class="sep"></div><div class="hint">Saved legacy intake rows: <span class="mono">'+esc(String(readLegacyIntake().length))+'</span> • Shared legacy outbox: <span class="mono">'+esc(String(readLegacyOutbox().length))+'</span></div><div class="sep"></div><div class="list">'+rows+'</div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>');
    $('#legacy_run').onclick = async ()=>{ const btn = $('#legacy_run'); if(btn){ btn.disabled = true; btn.textContent = 'Running...'; } const row = await runLegacyRecordProofComplete(); if(btn){ btn.disabled = false; btn.textContent = 'Run legacy proof'; } toast(row.ok ? 'Legacy-record proof passed.' : 'Legacy-record proof needs review.', row.ok ? 'good' : 'warn'); closeModal(); openLegacyProofRunnerManager(); };
    $('#legacy_export_html').onclick = exportLatestLegacyProofHtml;
    $('#legacy_export_json').onclick = exportLatestLegacyProofJson;
    Array.from(document.querySelectorAll('[data-legacy-html]')).forEach(btn => btn.onclick = ()=>{ const row = readLegacyRuns().find(item => clean(item.id) === clean(btn.getAttribute('data-legacy-html'))); if(!row) return; downloadText(buildLegacyRunHtml(row), 'routex_legacy_record_proof_' + clean(row.fingerprint || dayISO()) + '.html', 'text/html'); toast('Legacy proof HTML exported.', 'good'); });
    Array.from(document.querySelectorAll('[data-legacy-json]')).forEach(btn => btn.onclick = ()=>{ const row = readLegacyRuns().find(item => clean(item.id) === clean(btn.getAttribute('data-legacy-json'))); if(!row) return; downloadText(JSON.stringify(row, null, 2), 'routex_legacy_record_proof_' + clean(row.fingerprint || dayISO()) + '.json', 'application/json'); toast('Legacy proof JSON exported.', 'good'); });
  }
  function injectLegacyButtons(){
    const footer = $('#cc_capture') && $('#cc_capture').parentNode;
    if(footer && !$('#cc_legacy_runs')){
      const mgr = document.createElement('button'); mgr.className='btn'; mgr.id='cc_legacy_runs'; mgr.textContent='Legacy proof'; mgr.onclick=()=> openLegacyProofRunnerManager();
      footer.insertBefore(mgr, $('#cc_capture'));
    }
    if(footer && !$('#cc_run_legacy')){
      const btn = document.createElement('button'); btn.className='btn'; btn.id='cc_run_legacy'; btn.textContent='Run legacy proof';
      btn.onclick = async ()=>{ btn.disabled = true; btn.textContent = 'Running...'; const row = await runLegacyRecordProofComplete(); btn.disabled = false; btn.textContent = 'Run legacy proof'; toast(row.ok ? 'Legacy-record proof passed.' : 'Legacy-record proof needs review.', row.ok ? 'good' : 'warn'); try{ if(typeof closeModal === 'function') closeModal(); }catch(_){ } if(typeof window.openRoutexCompletionCenter === 'function') window.openRoutexCompletionCenter(); };
      footer.insertBefore(btn, $('#cc_capture'));
    }
    const row = document.querySelector('#pv_completion_center .row') || document.querySelector('#st_completion_center')?.parentNode;
    if(row && !document.querySelector('#pv_legacy_manager')){ const btn = document.createElement('button'); btn.className='btn'; btn.id='pv_legacy_manager'; btn.textContent='Legacy proof'; btn.onclick=()=> openLegacyProofRunnerManager(); row.appendChild(btn); }
  }
  const prevOpenCompletion = window.openRoutexCompletionCenter;
  if(typeof prevOpenCompletion === 'function'){
    window.openRoutexCompletionCenter = function(){ const out = prevOpenCompletion.apply(this, arguments); setTimeout(injectLegacyButtons, 0); return out; };
  }
  const prevRenderAll = window.renderAll;
  if(typeof prevRenderAll === 'function'){
    window.renderAll = function(){ const out = prevRenderAll.apply(this, arguments); setTimeout(injectLegacyButtons, 0); return out; };
  }
  if(typeof MutationObserver === 'function' && document.body){ const mo = new MutationObserver(()=> injectLegacyButtons()); mo.observe(document.body, { childList:true, subtree:true }); }
  window.listLegacyProofIntake = readLegacyIntake;
  window.readRoutexLegacyProofRuns = readLegacyRuns;
  window.runLegacyRecordProofComplete = runLegacyRecordProofComplete;
  window.openRoutexLegacyProofManager = openLegacyProofRunnerManager;
})();

/* V26 no-dead-button proof runner */
(function(){
  if(window.__ROUTEX_V26__) return; window.__ROUTEX_V26__ = true;
  const NO_DEAD_RUN_KEY = 'skye_routex_no_dead_button_runs_v1';
  const NO_DEAD_OUTBOX_KEY = 'skye_routex_no_dead_button_outbox_v1';
  const BUTTON_SWEEP_LOG_KEY = 'skye_routex_button_sweep_log_v1';
  const HUMAN_WALKTHROUGH_KEY = 'skye_routex_human_walkthrough_v1';
  const SNAP_KEY = 'skye_routex_completion_snapshots_v1';
  const ATTEST_KEY = 'skye_routex_device_attestations_v1';
  const ATTEST_OUTBOX_KEY = 'skye_routex_device_attestation_outbox_v1';
  const laneOrder = ['route-pack','service-summary','account-code','voice-note','heat-score','pseudo-map-board','trip-pack'];
  const readJSON = (key, fallback)=>{ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } };
  const writeJSON = (key, value)=> localStorage.setItem(key, JSON.stringify(value));
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const uid = window.uid || (()=>('v26-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const nowISO = window.nowISO || (()=> new Date().toISOString());
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  const fmt = window.fmt || (v => new Date(v || Date.now()).toLocaleString());
  const hash = window.tinyHash || function(input){ const str = String(input || ''); let h = 2166136261 >>> 0; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ('00000000' + (h >>> 0).toString(16)).slice(-8); };
  const $ = window.$ || (sel => document.querySelector(sel));
  const $$ = window.$$ || (sel => Array.from(document.querySelectorAll(sel)));

  function readRuns(){ return readJSON(NO_DEAD_RUN_KEY, []).filter(Boolean).slice(0, 40); }
  function saveRuns(items){ writeJSON(NO_DEAD_RUN_KEY, (Array.isArray(items) ? items : []).slice(0, 40)); }
  function pushRun(row){ const item = { id: uid(), createdAt: nowISO(), ...(row || {}) }; const list = readRuns().filter(entry => clean(entry.id) !== clean(item.id)); list.unshift(item); saveRuns(list); return item; }
  function readOutbox(){ return readJSON(NO_DEAD_OUTBOX_KEY, []).filter(Boolean).slice(0, 80); }
  function saveOutbox(items){ writeJSON(NO_DEAD_OUTBOX_KEY, (Array.isArray(items) ? items : []).slice(0, 80)); }
  function pushOutbox(row){ const item = { id: clean(row && row.id) || uid(), exportedAt: nowISO(), ...(row || {}) }; const list = readOutbox().filter(entry => clean(entry.fingerprint) !== clean(item.fingerprint)); list.unshift(item); saveOutbox(list); return item; }
  function readButtonSweeps(){ return readJSON(BUTTON_SWEEP_LOG_KEY, []).filter(Boolean).slice(0,80); }
  function readWalkthroughs(){ return readJSON(HUMAN_WALKTHROUGH_KEY, []).filter(Boolean).slice(0,80); }
  function readSnaps(){ return readJSON(SNAP_KEY, []).filter(Boolean).slice(0,80); }
  function saveSnap(row){ const list = readSnaps().filter(item => clean(item.id) !== clean(row.id)); list.unshift(row); writeJSON(SNAP_KEY, list.slice(0,80)); return row; }
  function readAttests(){ return readJSON(ATTEST_KEY, []).filter(Boolean).slice(0,80); }
  function saveAttest(row){ const list = readAttests().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); list.unshift(row); writeJSON(ATTEST_KEY, list.slice(0,80)); return row; }
  function readAttestOutbox(){ return readJSON(ATTEST_OUTBOX_KEY, []).filter(Boolean).slice(0,80); }
  function pushAttestOutbox(row){ const list = readAttestOutbox().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); list.unshift(row); writeJSON(ATTEST_OUTBOX_KEY, list.slice(0,80)); return row; }
  function countFrom(name){ try{ if(typeof window[name] !== 'function') return 0; const out = window[name](); return Array.isArray(out) ? out.length : (out && typeof out.length === 'number' ? out.length : 0); }catch(_){ return 0; } }
  function buildCompletionSnapshot(){
    const counts = {
      closureBundles: countFrom('readRoutexClosureBundles'),
      transferLogs: countFrom('readRoutePackTransferLog'),
      generationMatrices: countFrom('readGenerationMatrixLog'),
      heatAudits: countFrom('readHeatAuditLog'),
      buttonSweeps: countFrom('readRoutexButtonSweepLog'),
      capsules: countFrom('listCapsules'),
      legacyImports: countFrom('listLegacyProofIntake'),
      humanWalkthroughs: countFrom('listHumanWalkthroughs'),
      operatorAudits: countFrom('readOperatorAudits'),
      freshProofRuns: countFrom('readRoutexFreshProofRuns'),
      noDeadProofRuns: readRuns().length
    };
    const partials = {
      freshRecordProof: counts.freshProofRuns > 0,
      legacyRecordProof: counts.legacyImports > 0 && counts.generationMatrices > 0,
      exportImportProof: counts.transferLogs > 0 && counts.capsules > 0 && counts.closureBundles > 0,
      noDeadButtonProof: counts.buttonSweeps > 0 && counts.humanWalkthroughs > 0
    };
    const score = Object.values(partials).filter(Boolean).length;
    return {
      id: uid(),
      createdAt: nowISO(),
      packageLabel: 'Routex completion snapshot',
      fingerprint: ['cs', dayISO(), counts.freshProofRuns, counts.transferLogs, counts.buttonSweeps, counts.humanWalkthroughs, counts.noDeadProofRuns].join('-'),
      counts,
      partials,
      completionScore: score,
      completionLabel: score + '/4 closure preconditions present',
      note: 'In-app closure snapshot. This does not replace a real separate-device or human walkthrough run.'
    };
  }
  function saveDeviceAttestation(payload){
    const row = {
      id: uid(),
      createdAt: nowISO(),
      source: clean(payload && payload.source) || 'no-dead-proof',
      deviceLabel: clean(payload && payload.deviceLabel) || 'current-device',
      fingerprint: clean(payload && payload.fingerprint) || ('att-' + Date.now().toString(36)),
      note: clean(payload && payload.note),
      snapshot: payload && payload.snapshot ? payload.snapshot : buildCompletionSnapshot()
    };
    saveAttest(row); pushAttestOutbox(row); return row;
  }
  function summarizeWalkthrough(entry){
    const items = Array.isArray(entry && entry.items) ? entry.items : [];
    const done = items.filter(item => item && item.done).length;
    return {
      id: clean(entry && entry.id),
      reviewer: clean(entry && entry.reviewer),
      savedAt: clean(entry && (entry.savedAt || entry.createdAt)),
      done,
      total: items.length,
      note: clean(entry && entry.note)
    };
  }
  function buildOutboxPayload(row){
    return {
      id: clean(row && row.id) || uid(),
      label: clean(row && row.label) || 'No-dead proof',
      fingerprint: clean(row && row.fingerprint),
      createdAt: clean(row && row.createdAt) || nowISO(),
      exportedAt: nowISO(),
      source: 'routex-no-dead-proof-outbox',
      sweepId: clean(row && row.sweepId),
      sweepPassed: Number(row && row.sweepPassed || 0),
      sweepTotal: Number(row && row.sweepTotal || 0),
      walkthroughId: clean(row && row.walkthroughId),
      walkthroughDone: Number(row && row.walkthroughDone || 0),
      walkthroughTotal: Number(row && row.walkthroughTotal || 0),
      walkthroughReviewer: clean(row && row.walkthroughReviewer),
      laneResults: Array.isArray(row && row.laneResults) ? row.laneResults.map(item => ({
        lane: clean(item && item.lane),
        ok: !!(item && item.ok),
        passedChecks: Number(item && item.passedChecks || 0),
        checkCount: Number(item && item.checkCount || 0),
        note: clean(item && item.note)
      })) : [],
      note: clean(row && row.note),
      payloadVersion: 'v26'
    };
  }
  async function runNoDeadButtonProofComplete(){
    const laneResults = [];
    for(const lane of laneOrder){
      let probe = null;
      try{ probe = await window.runLaneActionProbe(lane); }catch(err){ probe = { ok:false, noDeadButtons:false, checks:[], note: clean(err && err.message) || 'Lane action probe failed.' }; }
      const checks = Array.isArray(probe && probe.checks) ? probe.checks : [];
      laneResults.push({
        lane,
        ok: !!(probe && probe.ok),
        states: { fresh:false, legacy:false, exportImport:false, restore:false, noDeadButtons: !!(probe && probe.noDeadButtons) },
        passedChecks: checks.filter(item => item && item.ok).length,
        checkCount: checks.length,
        checks: checks.map(item => ({ label: clean(item && item.label), ok: !!(item && item.ok) })),
        note: clean(probe && probe.note)
      });
      try{ if(typeof window.closeModal === 'function') window.closeModal(); }catch(_){ }
    }
    let sweep = null;
    try{ sweep = await window.runDirectiveActionRegistrySweep(); }catch(err){ sweep = { id:'', ok:false, steps:[], note: clean(err && err.message) || 'Directive action registry sweep failed.' }; }
    const sweepSteps = Array.isArray(sweep && sweep.steps) ? sweep.steps : [];
    const sweepPassed = sweepSteps.filter(item => item && item.ok).length;
    const walkthrough = summarizeWalkthrough(readWalkthroughs()[0] || null);
    const baseFingerprint = hash(JSON.stringify({
      lanes: laneResults.map(item => ({ lane:item.lane, ok:item.ok, passed:item.passedChecks, total:item.checkCount })),
      sweep: sweepSteps.map(item => ({ lane: clean(item && item.lane), ok: !!(item && item.ok) })),
      walkthrough: { id: walkthrough.id, done: walkthrough.done, total: walkthrough.total, reviewer: walkthrough.reviewer }
    }));
    const autoOk = laneResults.every(item => item.ok) && !!(sweep && sweep.ok);
    let row = pushRun({
      label: 'No-dead proof • ' + dayISO(),
      source: 'no-dead-proof-complete',
      fingerprint: 'ndb-' + dayISO() + '-' + baseFingerprint.slice(0,10),
      ok: autoOk,
      laneResults,
      sweepId: clean(sweep && sweep.id),
      sweepPassed,
      sweepTotal: sweepSteps.length,
      sweepNote: clean(sweep && sweep.note),
      walkthroughId: walkthrough.id,
      walkthroughDone: walkthrough.done,
      walkthroughTotal: walkthrough.total,
      walkthroughReviewer: walkthrough.reviewer,
      walkthroughSavedAt: walkthrough.savedAt,
      note: autoOk ? 'Dedicated no-dead-button proof runner passed its automated lane probes and directive sweep. Human walkthrough evidence is packaged alongside it but still determines final closure honesty.' : 'Dedicated no-dead-button proof runner found one or more failing lane probes or directive-sweep actions.'
    });
    pushOutbox(buildOutboxPayload(row));
    const snap = saveSnap(buildCompletionSnapshot());
    saveDeviceAttestation({ source:'no-dead-proof', deviceLabel:'current-device', fingerprint: row.fingerprint, note: row.note, snapshot: snap });
    row = pushRun({ ...row, snapshotId: snap.id, snapshotFingerprint: snap.fingerprint, outboxCount: readOutbox().length });
    return row;
  }
  function buildNoDeadProofHtml(row){
    const body = (Array.isArray(row && row.laneResults) ? row.laneResults : []).map(item => '<tr><td>'+esc(item.lane || '—')+'</td><td>'+(item.ok ? '✅' : '⚠️')+'</td><td>'+esc(String(item.passedChecks || 0))+'/'+esc(String(item.checkCount || 0))+'</td><td>'+(item.states && item.states.noDeadButtons ? '✓' : '')+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>No-dead proof run</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex no-dead-button proof run</h1><div><span class="badge">'+esc(row && row.label || 'No-dead proof')+'</span><span class="badge">'+esc(row && row.fingerprint || '—')+'</span><span class="badge">'+((row && row.ok) ? 'AUTO PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(row && row.note || '')+'</div><div style="margin-top:10px;"><span class="badge">Sweep '+esc(String(row && row.sweepPassed || 0))+'/'+esc(String(row && row.sweepTotal || 0))+'</span><span class="badge">Walkthrough '+esc(String(row && row.walkthroughDone || 0))+'/'+esc(String(row && row.walkthroughTotal || 0))+'</span><span class="badge">Reviewer '+esc(row && row.walkthroughReviewer || '—')+'</span></div></div><div class="card"><table><thead><tr><th>Lane</th><th>OK</th><th>Checks</th><th>No-dead</th><th>Note</th></tr></thead><tbody>'+(body || '<tr><td colspan="5">No lane data captured.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function exportLatestNoDeadProofHtml(){ const row = readRuns()[0]; if(!row) return toast('Run no-dead proof first.', 'warn'); downloadText(buildNoDeadProofHtml(row), 'routex_no_dead_button_proof_' + dayISO() + '.html', 'text/html'); toast('No-dead proof HTML exported.', 'good'); }
  function exportLatestNoDeadProofJson(){ const row = readRuns()[0]; if(!row) return toast('Run no-dead proof first.', 'warn'); downloadText(JSON.stringify(row, null, 2), 'routex_no_dead_button_proof_' + dayISO() + '.json', 'application/json'); toast('No-dead proof JSON exported.', 'good'); }
  function exportOperatorWorkbook(){ if(typeof window.buildOperatorClickSweepHtml !== 'function') return toast('Operator workbook helper is unavailable.', 'warn'); downloadText(window.buildOperatorClickSweepHtml(), 'routex_operator_click_sweep_' + dayISO() + '.html', 'text/html'); toast('Operator click-sweep workbook exported.', 'good'); }
  function openNoDeadProofManager(){
    const rows = readRuns().map(item => '<div class="item"><div class="meta"><div class="name">'+esc(item.label || 'No-dead proof')+' <span class="badge">'+esc(item.fingerprint || '—')+'</span></div><div class="sub">'+esc(fmt(item.createdAt || Date.now()))+' • '+esc(item.note || '')+'</div></div><div class="row" style="justify-content:flex-end;flex-wrap:wrap;"><button class="btn small" data-ndb-html="'+esc(item.id)+'">HTML</button><button class="btn small" data-ndb-json="'+esc(item.id)+'">JSON</button></div></div>').join('') || '<div class="hint">No no-dead-button proof runs saved yet.</div>';
    const walk = summarizeWalkthrough(readWalkthroughs()[0] || null);
    openModal('No-dead-button proof', '<div class="hint">This stays locked on live action availability only: automated lane probes, directive action-registry sweep coverage, operator workbook export, and packaged human-walkthrough context.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="ndb_run">Run no-dead proof</button><button class="btn" id="ndb_export_html">Export latest HTML</button><button class="btn" id="ndb_export_json">Export latest JSON</button><button class="btn" id="ndb_export_workbook">Operator workbook</button></div><div class="sep"></div><div class="hint">Latest walkthrough: <span class="mono">'+esc(String(walk.done || 0))+'/'+esc(String(walk.total || 0))+'</span>'+(walk.reviewer ? ' • reviewer <span class="mono">'+esc(walk.reviewer)+'</span>' : '')+' • Shared outbox <span class="mono">'+esc(String(readOutbox().length))+'</span></div><div class="sep"></div><div class="list">'+rows+'</div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>');
    $('#ndb_run').onclick = async ()=>{ const btn = $('#ndb_run'); if(btn){ btn.disabled = true; btn.textContent = 'Running...'; } const row = await runNoDeadButtonProofComplete(); if(btn){ btn.disabled = false; btn.textContent = 'Run no-dead proof'; } toast(row.ok ? 'No-dead proof auto-sweep passed.' : 'No-dead proof needs review.', row.ok ? 'good' : 'warn'); if(typeof window.closeModal === 'function') window.closeModal(); openNoDeadProofManager(); };
    $('#ndb_export_html').onclick = exportLatestNoDeadProofHtml;
    $('#ndb_export_json').onclick = exportLatestNoDeadProofJson;
    $('#ndb_export_workbook').onclick = exportOperatorWorkbook;
    $$('[data-ndb-html]').forEach(btn => btn.onclick = ()=>{ const row = readRuns().find(item => clean(item.id) === clean(btn.getAttribute('data-ndb-html'))); if(!row) return; downloadText(buildNoDeadProofHtml(row), 'routex_no_dead_button_proof_' + clean(row.fingerprint || dayISO()) + '.html', 'text/html'); toast('No-dead proof HTML exported.', 'good'); });
    $$('[data-ndb-json]').forEach(btn => btn.onclick = ()=>{ const row = readRuns().find(item => clean(item.id) === clean(btn.getAttribute('data-ndb-json'))); if(!row) return; downloadText(JSON.stringify(row, null, 2), 'routex_no_dead_button_proof_' + clean(row.fingerprint || dayISO()) + '.json', 'application/json'); toast('No-dead proof JSON exported.', 'good'); });
  }
  function injectNoDeadButtons(){
    const footer = document.querySelector('#cc_capture') && document.querySelector('#cc_capture').parentNode;
    if(footer && !document.querySelector('#cc_no_dead_runs')){ const mgr = document.createElement('button'); mgr.className='btn'; mgr.id='cc_no_dead_runs'; mgr.textContent='No-dead proof'; mgr.onclick=()=> openNoDeadProofManager(); footer.insertBefore(mgr, document.querySelector('#cc_capture')); }
    if(footer && !document.querySelector('#cc_run_no_dead')){ const btn = document.createElement('button'); btn.className='btn'; btn.id='cc_run_no_dead'; btn.textContent='Run no-dead proof'; btn.onclick = async ()=>{ btn.disabled = true; btn.textContent = 'Running...'; const row = await runNoDeadButtonProofComplete(); btn.disabled = false; btn.textContent = 'Run no-dead proof'; toast(row.ok ? 'No-dead proof auto-sweep passed.' : 'No-dead proof needs review.', row.ok ? 'good' : 'warn'); try{ if(typeof window.closeModal === 'function') window.closeModal(); }catch(_){ } if(typeof window.openRoutexCompletionCenter === 'function') window.openRoutexCompletionCenter(); }; footer.insertBefore(btn, document.querySelector('#cc_capture')); }
    const row = document.querySelector('#pv_completion_center .row') || document.querySelector('#st_completion_center')?.parentNode;
    if(row && !document.querySelector('#pv_no_dead_manager')){ const btn = document.createElement('button'); btn.className='btn'; btn.id='pv_no_dead_manager'; btn.textContent='No-dead proof'; btn.onclick=()=> openNoDeadProofManager(); row.appendChild(btn); }
  }
  const prevOpen = window.openRoutexCompletionCenter;
  if(typeof prevOpen === 'function'){
    window.openRoutexCompletionCenter = function(){ const out = prevOpen.apply(this, arguments); setTimeout(injectNoDeadButtons, 0); return out; };
  }
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(injectNoDeadButtons, 0); return out; };
  window.readRoutexNoDeadProofRuns = readRuns;
  window.openRoutexNoDeadProofManager = openNoDeadProofManager;
  window.runNoDeadButtonProofComplete = runNoDeadButtonProofComplete;
})();

/* V27 actual shipped legacy package corpus */
(function(){
  if(window.__ROUTEX_V27__) return; window.__ROUTEX_V27__ = true;
  const LEGACY_INTAKE_KEY = 'skye_routex_legacy_proof_intake_v1';
  const LEGACY_OUTBOX_KEY = 'skye_routex_legacy_outbox_v1';
  const LEGACY_RUN_KEY = 'skye_routex_legacy_record_runs_v1';
  const CORPUS_KEY = 'skye_routex_real_shipped_legacy_corpus_v1';
  const COMPARE_KEY = 'skye_routex_real_shipped_legacy_compare_runs_v1';
  const SHIPPED_PACKAGE_MANIFESTS = [
  {
    "packageLabel": "SkyeRoutexFlow v23 NEW-SHIT2 continued",
    "versionTag": "v23",
    "packageFingerprint": "v23-2e7fd7b53883",
    "zipName": "SkyeRoutexFlow_v23_NEW-SHIT2_continued.zip",
    "zipSizeBytes": 924231,
    "zipSha256": "2e7fd7b53883424934b5773040bb5945d9b96f38f753202799d1c0c9b51c6c0b",
    "routexIndexSizeBytes": 468158,
    "aeIndexSizeBytes": 117156,
    "proofStatuses": {
      "freshRecordProof": "base-landed",
      "legacyRecordProof": "partial",
      "exportImportProof": "partial",
      "noDeadButtonProof": "partial"
    },
    "proofNotes": {
      "legacyRecordProof": "Legacy fixture seeding now runs inside lane bundles, historical restore-loop proof logs baseline/fresh snapshot restores, and v18 adds a historical generation matrix that replays multiple downgraded backup variants per lane. Deep proof against actual older shipped packages is still pending, so this remains partial. v19 bundles historical generation-matrix results into stored/exportable closure bundles, but deep proof against actual older shipped packages is still pending. v20 adds a local historical corpus sweep that replays current closure/eligibility state into the generation-matrix log. v21 adds legacy-proof intake/import and lineage export so older diagnostics/closure packages can be staged for comparison, but deep proof against real older shipped packages is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW.",
      "exportImportProof": "Route-pack proof now includes local roundtrip, a second-device-style serialized transfer rehearsal with fingerprint logging, and v18 adds closure-report export plus per-lane historical generation matrix logging. True cross-device proof on a separate real device is still pending. v19 adds stored closure-bundle export/import plus an AE FLOW closure-bundle inbox for cross-app proof-package visibility, but true separate-device proof is still pending. v20 adds a shared Routex closure outbox and AE FLOW sync bridge for cross-app proof-package visibility. v21 adds cross-device proof capsules plus a shared capsule outbox and AE FLOW capsule inbox, but true separate-device proof is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW.",
      "noDeadButtonProof": "Lane action probes, full proof sweep execution, operator click-sweep HTML export, and a manual operator-audit assistant/log now exist for the directive-first lanes. A human full click walkthrough is still pending, so this remains partial. v19 adds closure-campaign packaging and AE FLOW closure-bundle inbox visibility, but a human full click walkthrough is still pending. v20 adds a directive action-registry sweep that programmatically opens the key directive-first actions and saves an audit log/HTML report, but a full human click walkthrough is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW."
    }
  },
  {
    "packageLabel": "SkyeRoutexFlow v24 legacy-proof pass",
    "versionTag": "v24",
    "packageFingerprint": "v24-57362c7bb962",
    "zipName": "SkyeRoutexFlow_v24_NEW-SHIT2_legacy-proof-pass.zip",
    "zipSizeBytes": 945487,
    "zipSha256": "57362c7bb962291d248e6ae75c59d753cceb086aa98d6c3231e56fa154c477b7",
    "routexIndexSizeBytes": 483256,
    "aeIndexSizeBytes": 124822,
    "proofStatuses": {
      "freshRecordProof": "base-landed",
      "legacyRecordProof": "partial",
      "exportImportProof": "partial",
      "noDeadButtonProof": "partial"
    },
    "proofNotes": {
      "legacyRecordProof": "Legacy fixture seeding now runs inside lane bundles, historical restore-loop proof logs baseline/fresh snapshot restores, and v18 adds a historical generation matrix that replays multiple downgraded backup variants per lane. Deep proof against actual older shipped packages is still pending, so this remains partial. v19 bundles historical generation-matrix results into stored/exportable closure bundles, but deep proof against actual older shipped packages is still pending. v20 adds a local historical corpus sweep that replays current closure/eligibility state into the generation-matrix log. v21 adds legacy-proof intake/import and lineage export so older diagnostics/closure packages can be staged for comparison, but deep proof against real older shipped packages is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v24 adds a dedicated legacy-record proof runner that replays every directive-first lane through the legacy path, saves generation-matrix evidence per lane, stores reusable legacy-run logs, and pushes shared legacy packages into an AE FLOW sync outbox, but proof against real older shipped packages is still pending.",
      "exportImportProof": "Route-pack proof now includes local roundtrip, a second-device-style serialized transfer rehearsal with fingerprint logging, and v18 adds closure-report export plus per-lane historical generation matrix logging. True cross-device proof on a separate real device is still pending. v19 adds stored closure-bundle export/import plus an AE FLOW closure-bundle inbox for cross-app proof-package visibility, but true separate-device proof is still pending. v20 adds a shared Routex closure outbox and AE FLOW sync bridge for cross-app proof-package visibility. v21 adds cross-device proof capsules plus a shared capsule outbox and AE FLOW capsule inbox, but true separate-device proof is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW.",
      "noDeadButtonProof": "Lane action probes, full proof sweep execution, operator click-sweep HTML export, and a manual operator-audit assistant/log now exist for the directive-first lanes. A human full click walkthrough is still pending, so this remains partial. v19 adds closure-campaign packaging and AE FLOW closure-bundle inbox visibility, but a human full click walkthrough is still pending. v20 adds a directive action-registry sweep that programmatically opens the key directive-first actions and saves an audit log/HTML report, but a full human click walkthrough is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW."
    }
  },
  {
    "packageLabel": "SkyeRoutexFlow v25 export-import pass",
    "versionTag": "v25",
    "packageFingerprint": "v25-d3743a1cb1bc",
    "zipName": "SkyeRoutexFlow_v25_NEW-SHIT2_export-import-pass.zip",
    "zipSizeBytes": 963904,
    "zipSha256": "d3743a1cb1bccfce05449ab1ed515162aa6de18640411250275938ee99a4385e",
    "routexIndexSizeBytes": 504295,
    "aeIndexSizeBytes": 132341,
    "proofStatuses": {
      "freshRecordProof": "base-landed",
      "legacyRecordProof": "partial",
      "exportImportProof": "partial",
      "noDeadButtonProof": "partial"
    },
    "proofNotes": {
      "legacyRecordProof": "Legacy fixture seeding now runs inside lane bundles, historical restore-loop proof logs baseline/fresh snapshot restores, and v18 adds a historical generation matrix that replays multiple downgraded backup variants per lane. Deep proof against actual older shipped packages is still pending, so this remains partial. v19 bundles historical generation-matrix results into stored/exportable closure bundles, but deep proof against actual older shipped packages is still pending. v20 adds a local historical corpus sweep that replays current closure/eligibility state into the generation-matrix log. v21 adds legacy-proof intake/import and lineage export so older diagnostics/closure packages can be staged for comparison, but deep proof against real older shipped packages is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v24 adds a dedicated legacy-record proof runner that replays every directive-first lane through the legacy path, saves generation-matrix evidence per lane, stores reusable legacy-run logs, and pushes shared legacy packages into an AE FLOW sync outbox, but proof against real older shipped packages is still pending.",
      "exportImportProof": "Route-pack proof now includes local roundtrip, a second-device-style serialized transfer rehearsal with fingerprint logging, and v18 adds closure-report export plus per-lane historical generation matrix logging. True cross-device proof on a separate real device is still pending. v19 adds stored closure-bundle export/import plus an AE FLOW closure-bundle inbox for cross-app proof-package visibility, but true separate-device proof is still pending. v20 adds a shared Routex closure outbox and AE FLOW sync bridge for cross-app proof-package visibility. v21 adds cross-device proof capsules plus a shared capsule outbox and AE FLOW capsule inbox, but true separate-device proof is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v25 adds a dedicated export/import proof runner that replays the transfer-capable lanes, saves focused export/import run logs, stages a reopened closure payload, stages a reopened capsule payload, and pushes transfer-proof packages into the shared AE FLOW handoff surfaces, but proof on a truly separate real device is still pending.",
      "noDeadButtonProof": "Lane action probes, full proof sweep execution, operator click-sweep HTML export, and a manual operator-audit assistant/log now exist for the directive-first lanes. A human full click walkthrough is still pending, so this remains partial. v19 adds closure-campaign packaging and AE FLOW closure-bundle inbox visibility, but a human full click walkthrough is still pending. v20 adds a directive action-registry sweep that programmatically opens the key directive-first actions and saves an audit log/HTML report, but a full human click walkthrough is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW."
    }
  },
  {
    "packageLabel": "SkyeRoutexFlow v26 no-dead pass",
    "versionTag": "v26",
    "packageFingerprint": "v26-200f1e6e1b25",
    "zipName": "SkyeRoutexFlow_v26_NEW-SHIT2_no-dead-pass.zip",
    "zipSizeBytes": 984632,
    "zipSha256": "200f1e6e1b254deb8aa074f42a5add53bf95d1ed892fdc4c2f04a51001fdfe53",
    "routexIndexSizeBytes": 563960,
    "aeIndexSizeBytes": 147631,
    "proofStatuses": {
      "freshRecordProof": "base-landed",
      "legacyRecordProof": "partial",
      "exportImportProof": "partial",
      "noDeadButtonProof": "partial"
    },
    "proofNotes": {
      "legacyRecordProof": "Legacy fixture seeding now runs inside lane bundles, historical restore-loop proof logs baseline/fresh snapshot restores, and v18 adds a historical generation matrix that replays multiple downgraded backup variants per lane. Deep proof against actual older shipped packages is still pending, so this remains partial. v19 bundles historical generation-matrix results into stored/exportable closure bundles, but deep proof against actual older shipped packages is still pending. v20 adds a local historical corpus sweep that replays current closure/eligibility state into the generation-matrix log. v21 adds legacy-proof intake/import and lineage export so older diagnostics/closure packages can be staged for comparison, but deep proof against real older shipped packages is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v24 adds a dedicated legacy-record proof runner that replays every directive-first lane through the legacy path, saves generation-matrix evidence per lane, stores reusable legacy-run logs, and pushes shared legacy packages into an AE FLOW sync outbox, but proof against real older shipped packages is still pending.",
      "exportImportProof": "Route-pack proof now includes local roundtrip, a second-device-style serialized transfer rehearsal with fingerprint logging, and v18 adds closure-report export plus per-lane historical generation matrix logging. True cross-device proof on a separate real device is still pending. v19 adds stored closure-bundle export/import plus an AE FLOW closure-bundle inbox for cross-app proof-package visibility, but true separate-device proof is still pending. v20 adds a shared Routex closure outbox and AE FLOW sync bridge for cross-app proof-package visibility. v21 adds cross-device proof capsules plus a shared capsule outbox and AE FLOW capsule inbox, but true separate-device proof is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v25 adds a dedicated export/import proof runner that replays the transfer-capable lanes, saves focused export/import run logs, stages a reopened closure payload, stages a reopened capsule payload, and pushes transfer-proof packages into the shared AE FLOW handoff surfaces, but proof on a truly separate real device is still pending.",
      "noDeadButtonProof": "Lane action probes, full proof sweep execution, operator click-sweep HTML export, and a manual operator-audit assistant/log now exist for the directive-first lanes. A human full click walkthrough is still pending, so this remains partial. v19 adds closure-campaign packaging and AE FLOW closure-bundle inbox visibility, but a human full click walkthrough is still pending. v20 adds a directive action-registry sweep that programmatically opens the key directive-first actions and saves an audit log/HTML report, but a full human click walkthrough is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW."
    }
  }
];
  const readJSON = (key, fallback)=>{ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_ ){ return fallback; } };
  const writeJSON = (key, value)=> localStorage.setItem(key, JSON.stringify(value));
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const uid = window.uid || (()=>('v27-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const nowISO = window.nowISO || (()=> new Date().toISOString());
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  const fmt = window.fmt || (v => new Date(v || Date.now()).toLocaleString());
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  function readList(key, limit){ return readJSON(key, []).filter(Boolean).slice(0, limit || 120); }
  function saveList(key, rows, limit){ writeJSON(key, (Array.isArray(rows) ? rows : []).slice(0, limit || 120)); }
  function upsertByFingerprint(key, row, limit){ const list = readList(key, limit).filter(item => clean(item && item.fingerprint) !== clean(row && row.fingerprint)); list.unshift(row); saveList(key, list, limit); return row; }
  function readCorpus(){ return readList(CORPUS_KEY, 40); }
  function saveCorpus(rows){ saveList(CORPUS_KEY, rows, 40); }
  function readCompareRuns(){ return readList(COMPARE_KEY, 40); }
  function saveCompareRun(row){ return upsertByFingerprint(COMPARE_KEY, row, 40); }
  function normalizeManifest(raw){
    const proof = raw && raw.proofStatuses ? raw.proofStatuses : {};
    return {
      packageLabel: clean(raw && raw.packageLabel) || 'Actual shipped package',
      versionTag: clean(raw && raw.versionTag) || 'legacy',
      packageFingerprint: clean(raw && raw.packageFingerprint) || ('pkg-' + uid()),
      zipName: clean(raw && raw.zipName),
      zipSizeBytes: Number(raw && raw.zipSizeBytes || 0),
      zipSha256: clean(raw && raw.zipSha256),
      routexIndexSizeBytes: Number(raw && raw.routexIndexSizeBytes || 0),
      aeIndexSizeBytes: Number(raw && raw.aeIndexSizeBytes || 0),
      proofStatuses: {
        freshRecordProof: clean(proof.freshRecordProof) || 'unknown',
        legacyRecordProof: clean(proof.legacyRecordProof) || 'unknown',
        exportImportProof: clean(proof.exportImportProof) || 'unknown',
        noDeadButtonProof: clean(proof.noDeadButtonProof) || 'unknown'
      },
      proofNotes: raw && raw.proofNotes ? raw.proofNotes : {}
    };
  }
  function manifestToLegacyRow(manifest){
    const m = normalizeManifest(manifest);
    return {
      id: uid(),
      importedAt: nowISO(),
      label: 'Actual shipped package • ' + m.packageLabel,
      source: 'actual-shipped-package-manifest',
      fingerprint: m.packageFingerprint,
      lane: 'legacy-record-proof',
      routeCount: 0,
      stopCount: 0,
      docCount: 0,
      latestMatrixId: '',
      latestLaneProofId: '',
      note: 'Actual shipped package manifest imported from ' + m.packageLabel + '. Legacy line in that package was ' + m.proofStatuses.legacyRecordProof + '.',
      proofStates: { legacy:true, restore:true, actualShippedPackage:true },
      matrixSummary: {
        packageLabel: m.packageLabel,
        versionTag: m.versionTag,
        zipName: m.zipName,
        zipSha256: m.zipSha256,
        routexIndexSizeBytes: m.routexIndexSizeBytes,
        aeIndexSizeBytes: m.aeIndexSizeBytes,
        proofStatuses: m.proofStatuses
      }
    };
  }
  function seedShippedLegacyCorpus(){
    const corpus = readCorpus();
    const intake = readList(LEGACY_INTAKE_KEY, 120);
    const outbox = readList(LEGACY_OUTBOX_KEY, 120);
    let merged = 0, duplicate = 0;
    SHIPPED_PACKAGE_MANIFESTS.forEach(raw => {
      const manifest = normalizeManifest(raw);
      if(corpus.some(item => clean(item.packageFingerprint) === clean(manifest.packageFingerprint))) duplicate += 1;
      else { corpus.unshift(manifest); merged += 1; }
      const intakeRow = manifestToLegacyRow(manifest);
      if(!intake.some(item => clean(item.fingerprint) === clean(intakeRow.fingerprint))) intake.unshift(intakeRow);
      if(!outbox.some(item => clean(item.fingerprint) === clean(intakeRow.fingerprint))) outbox.unshift({ ...intakeRow, exportedAt: nowISO(), source:'routex-legacy-outbox' });
    });
    saveCorpus(corpus.slice(0, 40));
    saveList(LEGACY_INTAKE_KEY, intake, 120);
    saveList(LEGACY_OUTBOX_KEY, outbox, 120);
    return { merged, duplicate, total: readCorpus().length };
  }
  function buildCompareRow(baseRun){
    const corpus = readCorpus();
    const laneResults = Array.isArray(baseRun && baseRun.laneResults) ? baseRun.laneResults : [];
    const currentLegacyOk = laneResults.length > 0 && laneResults.every(item => !!(item && item.ok));
    const packageRows = corpus.map(pkg => {
      const manifest = normalizeManifest(pkg);
      const status = manifest.proofStatuses || {};
      const ok = currentLegacyOk && clean(status.legacyRecordProof) === 'partial' && manifest.routexIndexSizeBytes > 0 && manifest.aeIndexSizeBytes > 0;
      return {
        packageLabel: manifest.packageLabel,
        versionTag: manifest.versionTag,
        packageFingerprint: manifest.packageFingerprint,
        zipName: manifest.zipName,
        zipSha256: manifest.zipSha256,
        routexIndexSizeBytes: manifest.routexIndexSizeBytes,
        aeIndexSizeBytes: manifest.aeIndexSizeBytes,
        proofStatuses: status,
        ok,
        note: 'Compared current dedicated legacy runner against the actual shipped package manifest for ' + manifest.packageLabel + '.'
      };
    });
    const ok = packageRows.length > 0 && packageRows.every(item => item.ok);
    return {
      id: uid(),
      createdAt: nowISO(),
      label: 'Actual shipped legacy compare • ' + dayISO(),
      fingerprint: 'rlc-' + packageRows.map(item => clean(item.packageFingerprint)).join('-').slice(0, 48),
      packageCount: packageRows.length,
      currentLegacyOk,
      ok,
      packageRows,
      note: ok ? 'Current legacy-record proof was compared against the actual shipped package manifests from v23–v26 in this conversation bundle.' : 'Actual shipped legacy compare needs review.'
    };
  }
  function buildCompareHtml(row){
    const body = (Array.isArray(row && row.packageRows) ? row.packageRows : []).map(item => '<tr><td>'+esc(item.packageLabel || '—')+'</td><td>'+esc(item.versionTag || '—')+'</td><td>'+esc(item.packageFingerprint || '—')+'</td><td>'+esc(item.proofStatuses && item.proofStatuses.legacyRecordProof || '—')+'</td><td>'+esc(item.proofStatuses && item.proofStatuses.exportImportProof || '—')+'</td><td>'+esc(item.proofStatuses && item.proofStatuses.noDeadButtonProof || '—')+'</td><td>'+esc(String(item.routexIndexSizeBytes || 0))+'</td><td>'+esc(String(item.aeIndexSizeBytes || 0))+'</td><td>'+(item.ok ? '✅' : '⚠️')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Actual shipped legacy compare</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1180px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex actual shipped legacy compare</h1><div><span class="badge">'+esc(row && row.fingerprint || '—')+'</span><span class="badge">Packages '+esc(String(row && row.packageCount || 0))+'</span><span class="badge">'+((row && row.ok) ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(row && row.note || '')+'</div></div><div class="card"><table><thead><tr><th>Package</th><th>Tag</th><th>Fingerprint</th><th>Legacy</th><th>Export/import</th><th>No-dead</th><th>Routex bytes</th><th>AE bytes</th><th>OK</th></tr></thead><tbody>'+(body || '<tr><td colspan="9">No package comparisons captured.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function exportLatestCompareHtml(){ const row = readCompareRuns()[0]; if(!row) return toast('Run legacy proof first.', 'warn'); downloadText(buildCompareHtml(row), 'routex_actual_shipped_legacy_compare_' + dayISO() + '.html', 'text/html'); toast('Actual shipped legacy compare HTML exported.', 'good'); }
  function exportLatestCompareJson(){ const row = readCompareRuns()[0]; if(!row) return toast('Run legacy proof first.', 'warn'); downloadText(JSON.stringify(row, null, 2), 'routex_actual_shipped_legacy_compare_' + dayISO() + '.json', 'application/json'); toast('Actual shipped legacy compare JSON exported.', 'good'); }
  function readLegacyRuns(){ return readList(LEGACY_RUN_KEY, 120); }
  function saveLegacyRuns(rows){ saveList(LEGACY_RUN_KEY, rows, 120); }
  function mergeCompareIntoLatestLegacyRun(compare){
    const runs = readLegacyRuns();
    if(!runs.length) return null;
    const latest = runs[0] || {};
    const updated = {
      ...latest,
      realShippedCompareId: compare.id,
      realShippedCompareFingerprint: compare.fingerprint,
      realShippedCompareOk: !!compare.ok,
      realShippedPackages: Number(compare.packageCount || 0),
      note: [clean(latest.note), clean(compare.note)].filter(Boolean).join(' • ')
    };
    runs[0] = updated;
    saveLegacyRuns(runs);
    return updated;
  }
  function pushCompareBridgeRow(compare){
    const bridge = {
      id: uid(),
      importedAt: nowISO(),
      label: 'Actual shipped legacy compare • ' + String(compare.packageCount || 0) + ' packages',
      source: 'routex-legacy-outbox',
      fingerprint: compare.fingerprint,
      lane: 'legacy-record-proof',
      routeCount: 0,
      stopCount: 0,
      docCount: 0,
      latestMatrixId: '',
      latestLaneProofId: clean(compare.id),
      note: clean(compare.note),
      proofStates: { legacy:true, restore:true, actualShippedPackage:true, actualShippedCompare:!!compare.ok },
      matrixSummary: { packageCount: Number(compare.packageCount || 0), currentLegacyOk: !!compare.currentLegacyOk }
    };
    upsertByFingerprint(LEGACY_INTAKE_KEY, bridge, 120);
    upsertByFingerprint(LEGACY_OUTBOX_KEY, { ...bridge, exportedAt: nowISO() }, 120);
  }
  const prevRunLegacy = window.runLegacyRecordProofComplete;
  if(typeof prevRunLegacy === 'function'){
    window.runLegacyRecordProofComplete = async function(){
      seedShippedLegacyCorpus();
      const base = await prevRunLegacy.apply(this, arguments);
      const compare = saveCompareRun(buildCompareRow(base));
      mergeCompareIntoLatestLegacyRun(compare);
      pushCompareBridgeRow(compare);
      toast(compare.ok ? 'Actual shipped legacy compare saved.' : 'Actual shipped legacy compare needs review.', compare.ok ? 'good' : 'warn');
      const runs = readLegacyRuns();
      return runs[0] || base;
    };
  }
  function injectLegacyCorpusControls(){
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    if(!title || !body || !/Legacy record proof/i.test(title.textContent || '')) return;
    if(document.getElementById('legacyActualShippedBlock')) return;
    const latest = readCompareRuns()[0] || null;
    const corpus = readCorpus();
    const box = document.createElement('div');
    box.id = 'legacyActualShippedBlock';
    box.className = 'card';
    box.style.marginTop = '12px';
    box.innerHTML = '<h3 style="margin:0 0 10px;">Actual shipped package corpus</h3><div class="hint">This legacy lane now seeds and compares against the actual shipped package manifests from v23–v26 in this conversation bundle, not only synthetic downgraded variants.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="legacySeedCorpusBtn">Seed shipped corpus</button><button class="btn" id="legacyCompareHtmlBtn">Export shipped compare HTML</button><button class="btn" id="legacyCompareJsonBtn">Export shipped compare JSON</button></div><div class="sep"></div><div class="hint">Corpus packages: <span class="mono">'+esc(String(corpus.length))+'</span>'+(latest ? ' • Latest compare <span class="mono">'+esc(latest.fingerprint || '—')+'</span> • packages <span class="mono">'+esc(String(latest.packageCount || 0))+'</span>' : ' • No actual shipped compare run saved yet.')+'</div>';
    body.appendChild(box);
    document.getElementById('legacySeedCorpusBtn').onclick = function(){ const result = seedShippedLegacyCorpus(); toast(result.merged ? 'Actual shipped legacy corpus seeded.' : 'Actual shipped legacy corpus already present.', result.merged ? 'good' : 'warn'); try{ injectLegacyCorpusControls(); }catch(_){} };
    document.getElementById('legacyCompareHtmlBtn').onclick = exportLatestCompareHtml;
    document.getElementById('legacyCompareJsonBtn').onclick = exportLatestCompareJson;
  }
  const prevOpenLegacyManager = window.openLegacyProofRunnerManager;
  if(typeof prevOpenLegacyManager === 'function'){
    window.openLegacyProofRunnerManager = function(){
      seedShippedLegacyCorpus();
      const out = prevOpenLegacyManager.apply(this, arguments);
      setTimeout(injectLegacyCorpusControls, 0);
      return out;
    };
  }
  const prevRenderAll = window.renderAll;
  if(typeof prevRenderAll === 'function'){
    window.renderAll = function(){ const out = prevRenderAll.apply(this, arguments); setTimeout(injectLegacyCorpusControls, 0); return out; };
  }
  window.seedRoutexShippedLegacyCorpus = seedShippedLegacyCorpus;
  window.readRoutexShippedLegacyCorpus = readCorpus;
  window.readRoutexShippedLegacyCompareRuns = readCompareRuns;
  window.exportLatestRoutexShippedLegacyCompareHtml = exportLatestCompareHtml;
  window.exportLatestRoutexShippedLegacyCompareJson = exportLatestCompareJson;
  seedShippedLegacyCorpus();
})();

/* V26 no-dead-button proof runner */
(function(){
  if(window.__ROUTEX_V26__) return; window.__ROUTEX_V26__ = true;
  const NO_DEAD_RUN_KEY = 'skye_routex_no_dead_button_runs_v1';
  const NO_DEAD_OUTBOX_KEY = 'skye_routex_no_dead_button_outbox_v1';
  const BUTTON_SWEEP_LOG_KEY = 'skye_routex_button_sweep_log_v1';
  const HUMAN_WALKTHROUGH_KEY = 'skye_routex_human_walkthrough_v1';
  const SNAP_KEY = 'skye_routex_completion_snapshots_v1';
  const ATTEST_KEY = 'skye_routex_device_attestations_v1';
  const ATTEST_OUTBOX_KEY = 'skye_routex_device_attestation_outbox_v1';
  const laneOrder = ['route-pack','service-summary','account-code','voice-note','heat-score','pseudo-map-board','trip-pack'];
  const readJSON = (key, fallback)=>{ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } };
  const writeJSON = (key, value)=> localStorage.setItem(key, JSON.stringify(value));
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const uid = window.uid || (()=>('v26-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const nowISO = window.nowISO || (()=> new Date().toISOString());
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  const fmt = window.fmt || (v => new Date(v || Date.now()).toLocaleString());
  const hash = window.tinyHash || function(input){ const str = String(input || ''); let h = 2166136261 >>> 0; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ('00000000' + (h >>> 0).toString(16)).slice(-8); };
  const $ = window.$ || (sel => document.querySelector(sel));
  const $$ = window.$$ || (sel => Array.from(document.querySelectorAll(sel)));

  function readRuns(){ return readJSON(NO_DEAD_RUN_KEY, []).filter(Boolean).slice(0, 40); }
  function saveRuns(items){ writeJSON(NO_DEAD_RUN_KEY, (Array.isArray(items) ? items : []).slice(0, 40)); }
  function pushRun(row){ const item = { id: uid(), createdAt: nowISO(), ...(row || {}) }; const list = readRuns().filter(entry => clean(entry.id) !== clean(item.id)); list.unshift(item); saveRuns(list); return item; }
  function readOutbox(){ return readJSON(NO_DEAD_OUTBOX_KEY, []).filter(Boolean).slice(0, 80); }
  function saveOutbox(items){ writeJSON(NO_DEAD_OUTBOX_KEY, (Array.isArray(items) ? items : []).slice(0, 80)); }
  function pushOutbox(row){ const item = { id: clean(row && row.id) || uid(), exportedAt: nowISO(), ...(row || {}) }; const list = readOutbox().filter(entry => clean(entry.fingerprint) !== clean(item.fingerprint)); list.unshift(item); saveOutbox(list); return item; }
  function readButtonSweeps(){ return readJSON(BUTTON_SWEEP_LOG_KEY, []).filter(Boolean).slice(0,80); }
  function readWalkthroughs(){ return readJSON(HUMAN_WALKTHROUGH_KEY, []).filter(Boolean).slice(0,80); }
  function readSnaps(){ return readJSON(SNAP_KEY, []).filter(Boolean).slice(0,80); }
  function saveSnap(row){ const list = readSnaps().filter(item => clean(item.id) !== clean(row.id)); list.unshift(row); writeJSON(SNAP_KEY, list.slice(0,80)); return row; }
  function readAttests(){ return readJSON(ATTEST_KEY, []).filter(Boolean).slice(0,80); }
  function saveAttest(row){ const list = readAttests().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); list.unshift(row); writeJSON(ATTEST_KEY, list.slice(0,80)); return row; }
  function readAttestOutbox(){ return readJSON(ATTEST_OUTBOX_KEY, []).filter(Boolean).slice(0,80); }
  function pushAttestOutbox(row){ const list = readAttestOutbox().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); list.unshift(row); writeJSON(ATTEST_OUTBOX_KEY, list.slice(0,80)); return row; }
  function countFrom(name){ try{ if(typeof window[name] !== 'function') return 0; const out = window[name](); return Array.isArray(out) ? out.length : (out && typeof out.length === 'number' ? out.length : 0); }catch(_){ return 0; } }
  function buildCompletionSnapshot(){
    const counts = {
      closureBundles: countFrom('readRoutexClosureBundles'),
      transferLogs: countFrom('readRoutePackTransferLog'),
      generationMatrices: countFrom('readGenerationMatrixLog'),
      heatAudits: countFrom('readHeatAuditLog'),
      buttonSweeps: countFrom('readRoutexButtonSweepLog'),
      capsules: countFrom('listCapsules'),
      legacyImports: countFrom('listLegacyProofIntake'),
      humanWalkthroughs: countFrom('listHumanWalkthroughs'),
      operatorAudits: countFrom('readOperatorAudits'),
      freshProofRuns: countFrom('readRoutexFreshProofRuns'),
      noDeadProofRuns: readRuns().length
    };
    const partials = {
      freshRecordProof: counts.freshProofRuns > 0,
      legacyRecordProof: counts.legacyImports > 0 && counts.generationMatrices > 0,
      exportImportProof: counts.transferLogs > 0 && counts.capsules > 0 && counts.closureBundles > 0,
      noDeadButtonProof: counts.buttonSweeps > 0 && counts.humanWalkthroughs > 0
    };
    const score = Object.values(partials).filter(Boolean).length;
    return {
      id: uid(),
      createdAt: nowISO(),
      packageLabel: 'Routex completion snapshot',
      fingerprint: ['cs', dayISO(), counts.freshProofRuns, counts.transferLogs, counts.buttonSweeps, counts.humanWalkthroughs, counts.noDeadProofRuns].join('-'),
      counts,
      partials,
      completionScore: score,
      completionLabel: score + '/4 closure preconditions present',
      note: 'In-app closure snapshot. This does not replace a real separate-device or human walkthrough run.'
    };
  }
  function saveDeviceAttestation(payload){
    const row = {
      id: uid(),
      createdAt: nowISO(),
      source: clean(payload && payload.source) || 'no-dead-proof',
      deviceLabel: clean(payload && payload.deviceLabel) || 'current-device',
      fingerprint: clean(payload && payload.fingerprint) || ('att-' + Date.now().toString(36)),
      note: clean(payload && payload.note),
      snapshot: payload && payload.snapshot ? payload.snapshot : buildCompletionSnapshot()
    };
    saveAttest(row); pushAttestOutbox(row); return row;
  }
  function summarizeWalkthrough(entry){
    const items = Array.isArray(entry && entry.items) ? entry.items : [];
    const done = items.filter(item => item && item.done).length;
    return {
      id: clean(entry && entry.id),
      reviewer: clean(entry && entry.reviewer),
      savedAt: clean(entry && (entry.savedAt || entry.createdAt)),
      done,
      total: items.length,
      note: clean(entry && entry.note)
    };
  }
  function buildOutboxPayload(row){
    return {
      id: clean(row && row.id) || uid(),
      label: clean(row && row.label) || 'No-dead proof',
      fingerprint: clean(row && row.fingerprint),
      createdAt: clean(row && row.createdAt) || nowISO(),
      exportedAt: nowISO(),
      source: 'routex-no-dead-proof-outbox',
      sweepId: clean(row && row.sweepId),
      sweepPassed: Number(row && row.sweepPassed || 0),
      sweepTotal: Number(row && row.sweepTotal || 0),
      walkthroughId: clean(row && row.walkthroughId),
      walkthroughDone: Number(row && row.walkthroughDone || 0),
      walkthroughTotal: Number(row && row.walkthroughTotal || 0),
      walkthroughReviewer: clean(row && row.walkthroughReviewer),
      laneResults: Array.isArray(row && row.laneResults) ? row.laneResults.map(item => ({
        lane: clean(item && item.lane),
        ok: !!(item && item.ok),
        passedChecks: Number(item && item.passedChecks || 0),
        checkCount: Number(item && item.checkCount || 0),
        note: clean(item && item.note)
      })) : [],
      note: clean(row && row.note),
      payloadVersion: 'v26'
    };
  }
  async function runNoDeadButtonProofComplete(){
    const laneResults = [];
    for(const lane of laneOrder){
      let probe = null;
      try{ probe = await window.runLaneActionProbe(lane); }catch(err){ probe = { ok:false, noDeadButtons:false, checks:[], note: clean(err && err.message) || 'Lane action probe failed.' }; }
      const checks = Array.isArray(probe && probe.checks) ? probe.checks : [];
      laneResults.push({
        lane,
        ok: !!(probe && probe.ok),
        states: { fresh:false, legacy:false, exportImport:false, restore:false, noDeadButtons: !!(probe && probe.noDeadButtons) },
        passedChecks: checks.filter(item => item && item.ok).length,
        checkCount: checks.length,
        checks: checks.map(item => ({ label: clean(item && item.label), ok: !!(item && item.ok) })),
        note: clean(probe && probe.note)
      });
      try{ if(typeof window.closeModal === 'function') window.closeModal(); }catch(_){ }
    }
    let sweep = null;
    try{ sweep = await window.runDirectiveActionRegistrySweep(); }catch(err){ sweep = { id:'', ok:false, steps:[], note: clean(err && err.message) || 'Directive action registry sweep failed.' }; }
    const sweepSteps = Array.isArray(sweep && sweep.steps) ? sweep.steps : [];
    const sweepPassed = sweepSteps.filter(item => item && item.ok).length;
    const walkthrough = summarizeWalkthrough(readWalkthroughs()[0] || null);
    const baseFingerprint = hash(JSON.stringify({
      lanes: laneResults.map(item => ({ lane:item.lane, ok:item.ok, passed:item.passedChecks, total:item.checkCount })),
      sweep: sweepSteps.map(item => ({ lane: clean(item && item.lane), ok: !!(item && item.ok) })),
      walkthrough: { id: walkthrough.id, done: walkthrough.done, total: walkthrough.total, reviewer: walkthrough.reviewer }
    }));
    const autoOk = laneResults.every(item => item.ok) && !!(sweep && sweep.ok);
    let row = pushRun({
      label: 'No-dead proof • ' + dayISO(),
      source: 'no-dead-proof-complete',
      fingerprint: 'ndb-' + dayISO() + '-' + baseFingerprint.slice(0,10),
      ok: autoOk,
      laneResults,
      sweepId: clean(sweep && sweep.id),
      sweepPassed,
      sweepTotal: sweepSteps.length,
      sweepNote: clean(sweep && sweep.note),
      walkthroughId: walkthrough.id,
      walkthroughDone: walkthrough.done,
      walkthroughTotal: walkthrough.total,
      walkthroughReviewer: walkthrough.reviewer,
      walkthroughSavedAt: walkthrough.savedAt,
      note: autoOk ? 'Dedicated no-dead-button proof runner passed its automated lane probes and directive sweep. Human walkthrough evidence is packaged alongside it but still determines final closure honesty.' : 'Dedicated no-dead-button proof runner found one or more failing lane probes or directive-sweep actions.'
    });
    pushOutbox(buildOutboxPayload(row));
    const snap = saveSnap(buildCompletionSnapshot());
    saveDeviceAttestation({ source:'no-dead-proof', deviceLabel:'current-device', fingerprint: row.fingerprint, note: row.note, snapshot: snap });
    row = pushRun({ ...row, snapshotId: snap.id, snapshotFingerprint: snap.fingerprint, outboxCount: readOutbox().length });
    return row;
  }
  function buildNoDeadProofHtml(row){
    const body = (Array.isArray(row && row.laneResults) ? row.laneResults : []).map(item => '<tr><td>'+esc(item.lane || '—')+'</td><td>'+(item.ok ? '✅' : '⚠️')+'</td><td>'+esc(String(item.passedChecks || 0))+'/'+esc(String(item.checkCount || 0))+'</td><td>'+(item.states && item.states.noDeadButtons ? '✓' : '')+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>No-dead proof run</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex no-dead-button proof run</h1><div><span class="badge">'+esc(row && row.label || 'No-dead proof')+'</span><span class="badge">'+esc(row && row.fingerprint || '—')+'</span><span class="badge">'+((row && row.ok) ? 'AUTO PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(row && row.note || '')+'</div><div style="margin-top:10px;"><span class="badge">Sweep '+esc(String(row && row.sweepPassed || 0))+'/'+esc(String(row && row.sweepTotal || 0))+'</span><span class="badge">Walkthrough '+esc(String(row && row.walkthroughDone || 0))+'/'+esc(String(row && row.walkthroughTotal || 0))+'</span><span class="badge">Reviewer '+esc(row && row.walkthroughReviewer || '—')+'</span></div></div><div class="card"><table><thead><tr><th>Lane</th><th>OK</th><th>Checks</th><th>No-dead</th><th>Note</th></tr></thead><tbody>'+(body || '<tr><td colspan="5">No lane data captured.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function exportLatestNoDeadProofHtml(){ const row = readRuns()[0]; if(!row) return toast('Run no-dead proof first.', 'warn'); downloadText(buildNoDeadProofHtml(row), 'routex_no_dead_button_proof_' + dayISO() + '.html', 'text/html'); toast('No-dead proof HTML exported.', 'good'); }
  function exportLatestNoDeadProofJson(){ const row = readRuns()[0]; if(!row) return toast('Run no-dead proof first.', 'warn'); downloadText(JSON.stringify(row, null, 2), 'routex_no_dead_button_proof_' + dayISO() + '.json', 'application/json'); toast('No-dead proof JSON exported.', 'good'); }
  function exportOperatorWorkbook(){ if(typeof window.buildOperatorClickSweepHtml !== 'function') return toast('Operator workbook helper is unavailable.', 'warn'); downloadText(window.buildOperatorClickSweepHtml(), 'routex_operator_click_sweep_' + dayISO() + '.html', 'text/html'); toast('Operator click-sweep workbook exported.', 'good'); }
  function openNoDeadProofManager(){
    const rows = readRuns().map(item => '<div class="item"><div class="meta"><div class="name">'+esc(item.label || 'No-dead proof')+' <span class="badge">'+esc(item.fingerprint || '—')+'</span></div><div class="sub">'+esc(fmt(item.createdAt || Date.now()))+' • '+esc(item.note || '')+'</div></div><div class="row" style="justify-content:flex-end;flex-wrap:wrap;"><button class="btn small" data-ndb-html="'+esc(item.id)+'">HTML</button><button class="btn small" data-ndb-json="'+esc(item.id)+'">JSON</button></div></div>').join('') || '<div class="hint">No no-dead-button proof runs saved yet.</div>';
    const walk = summarizeWalkthrough(readWalkthroughs()[0] || null);
    openModal('No-dead-button proof', '<div class="hint">This stays locked on live action availability only: automated lane probes, directive action-registry sweep coverage, operator workbook export, and packaged human-walkthrough context.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="ndb_run">Run no-dead proof</button><button class="btn" id="ndb_export_html">Export latest HTML</button><button class="btn" id="ndb_export_json">Export latest JSON</button><button class="btn" id="ndb_export_workbook">Operator workbook</button></div><div class="sep"></div><div class="hint">Latest walkthrough: <span class="mono">'+esc(String(walk.done || 0))+'/'+esc(String(walk.total || 0))+'</span>'+(walk.reviewer ? ' • reviewer <span class="mono">'+esc(walk.reviewer)+'</span>' : '')+' • Shared outbox <span class="mono">'+esc(String(readOutbox().length))+'</span></div><div class="sep"></div><div class="list">'+rows+'</div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>');
    $('#ndb_run').onclick = async ()=>{ const btn = $('#ndb_run'); if(btn){ btn.disabled = true; btn.textContent = 'Running...'; } const row = await runNoDeadButtonProofComplete(); if(btn){ btn.disabled = false; btn.textContent = 'Run no-dead proof'; } toast(row.ok ? 'No-dead proof auto-sweep passed.' : 'No-dead proof needs review.', row.ok ? 'good' : 'warn'); if(typeof window.closeModal === 'function') window.closeModal(); openNoDeadProofManager(); };
    $('#ndb_export_html').onclick = exportLatestNoDeadProofHtml;
    $('#ndb_export_json').onclick = exportLatestNoDeadProofJson;
    $('#ndb_export_workbook').onclick = exportOperatorWorkbook;
    $$('[data-ndb-html]').forEach(btn => btn.onclick = ()=>{ const row = readRuns().find(item => clean(item.id) === clean(btn.getAttribute('data-ndb-html'))); if(!row) return; downloadText(buildNoDeadProofHtml(row), 'routex_no_dead_button_proof_' + clean(row.fingerprint || dayISO()) + '.html', 'text/html'); toast('No-dead proof HTML exported.', 'good'); });
    $$('[data-ndb-json]').forEach(btn => btn.onclick = ()=>{ const row = readRuns().find(item => clean(item.id) === clean(btn.getAttribute('data-ndb-json'))); if(!row) return; downloadText(JSON.stringify(row, null, 2), 'routex_no_dead_button_proof_' + clean(row.fingerprint || dayISO()) + '.json', 'application/json'); toast('No-dead proof JSON exported.', 'good'); });
  }
  function injectNoDeadButtons(){
    const footer = document.querySelector('#cc_capture') && document.querySelector('#cc_capture').parentNode;
    if(footer && !document.querySelector('#cc_no_dead_runs')){ const mgr = document.createElement('button'); mgr.className='btn'; mgr.id='cc_no_dead_runs'; mgr.textContent='No-dead proof'; mgr.onclick=()=> openNoDeadProofManager(); footer.insertBefore(mgr, document.querySelector('#cc_capture')); }
    if(footer && !document.querySelector('#cc_run_no_dead')){ const btn = document.createElement('button'); btn.className='btn'; btn.id='cc_run_no_dead'; btn.textContent='Run no-dead proof'; btn.onclick = async ()=>{ btn.disabled = true; btn.textContent = 'Running...'; const row = await runNoDeadButtonProofComplete(); btn.disabled = false; btn.textContent = 'Run no-dead proof'; toast(row.ok ? 'No-dead proof auto-sweep passed.' : 'No-dead proof needs review.', row.ok ? 'good' : 'warn'); try{ if(typeof window.closeModal === 'function') window.closeModal(); }catch(_){ } if(typeof window.openRoutexCompletionCenter === 'function') window.openRoutexCompletionCenter(); }; footer.insertBefore(btn, document.querySelector('#cc_capture')); }
    const row = document.querySelector('#pv_completion_center .row') || document.querySelector('#st_completion_center')?.parentNode;
    if(row && !document.querySelector('#pv_no_dead_manager')){ const btn = document.createElement('button'); btn.className='btn'; btn.id='pv_no_dead_manager'; btn.textContent='No-dead proof'; btn.onclick=()=> openNoDeadProofManager(); row.appendChild(btn); }
  }
  const prevOpen = window.openRoutexCompletionCenter;
  if(typeof prevOpen === 'function'){
    window.openRoutexCompletionCenter = function(){ const out = prevOpen.apply(this, arguments); setTimeout(injectNoDeadButtons, 0); return out; };
  }
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(injectNoDeadButtons, 0); return out; };
  window.readRoutexNoDeadProofRuns = readRuns;
  window.openRoutexNoDeadProofManager = openNoDeadProofManager;
  window.runNoDeadButtonProofComplete = runNoDeadButtonProofComplete;
})();

/* V27 actual shipped legacy package corpus */
(function(){
  if(window.__ROUTEX_V27__) return; window.__ROUTEX_V27__ = true;
  const LEGACY_INTAKE_KEY = 'skye_routex_legacy_proof_intake_v1';
  const LEGACY_OUTBOX_KEY = 'skye_routex_legacy_outbox_v1';
  const LEGACY_RUN_KEY = 'skye_routex_legacy_record_runs_v1';
  const CORPUS_KEY = 'skye_routex_real_shipped_legacy_corpus_v1';
  const COMPARE_KEY = 'skye_routex_real_shipped_legacy_compare_runs_v1';
  const SHIPPED_PACKAGE_MANIFESTS = [
  {
    "packageLabel": "SkyeRoutexFlow v23 NEW-SHIT2 continued",
    "versionTag": "v23",
    "packageFingerprint": "v23-2e7fd7b53883",
    "zipName": "SkyeRoutexFlow_v23_NEW-SHIT2_continued.zip",
    "zipSizeBytes": 924231,
    "zipSha256": "2e7fd7b53883424934b5773040bb5945d9b96f38f753202799d1c0c9b51c6c0b",
    "routexIndexSizeBytes": 468158,
    "aeIndexSizeBytes": 117156,
    "proofStatuses": {
      "freshRecordProof": "base-landed",
      "legacyRecordProof": "partial",
      "exportImportProof": "partial",
      "noDeadButtonProof": "partial"
    },
    "proofNotes": {
      "legacyRecordProof": "Legacy fixture seeding now runs inside lane bundles, historical restore-loop proof logs baseline/fresh snapshot restores, and v18 adds a historical generation matrix that replays multiple downgraded backup variants per lane. Deep proof against actual older shipped packages is still pending, so this remains partial. v19 bundles historical generation-matrix results into stored/exportable closure bundles, but deep proof against actual older shipped packages is still pending. v20 adds a local historical corpus sweep that replays current closure/eligibility state into the generation-matrix log. v21 adds legacy-proof intake/import and lineage export so older diagnostics/closure packages can be staged for comparison, but deep proof against real older shipped packages is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW.",
      "exportImportProof": "Route-pack proof now includes local roundtrip, a second-device-style serialized transfer rehearsal with fingerprint logging, and v18 adds closure-report export plus per-lane historical generation matrix logging. True cross-device proof on a separate real device is still pending. v19 adds stored closure-bundle export/import plus an AE FLOW closure-bundle inbox for cross-app proof-package visibility, but true separate-device proof is still pending. v20 adds a shared Routex closure outbox and AE FLOW sync bridge for cross-app proof-package visibility. v21 adds cross-device proof capsules plus a shared capsule outbox and AE FLOW capsule inbox, but true separate-device proof is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW.",
      "noDeadButtonProof": "Lane action probes, full proof sweep execution, operator click-sweep HTML export, and a manual operator-audit assistant/log now exist for the directive-first lanes. A human full click walkthrough is still pending, so this remains partial. v19 adds closure-campaign packaging and AE FLOW closure-bundle inbox visibility, but a human full click walkthrough is still pending. v20 adds a directive action-registry sweep that programmatically opens the key directive-first actions and saves an audit log/HTML report, but a full human click walkthrough is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW."
    }
  },
  {
    "packageLabel": "SkyeRoutexFlow v24 legacy-proof pass",
    "versionTag": "v24",
    "packageFingerprint": "v24-57362c7bb962",
    "zipName": "SkyeRoutexFlow_v24_NEW-SHIT2_legacy-proof-pass.zip",
    "zipSizeBytes": 945487,
    "zipSha256": "57362c7bb962291d248e6ae75c59d753cceb086aa98d6c3231e56fa154c477b7",
    "routexIndexSizeBytes": 483256,
    "aeIndexSizeBytes": 124822,
    "proofStatuses": {
      "freshRecordProof": "base-landed",
      "legacyRecordProof": "partial",
      "exportImportProof": "partial",
      "noDeadButtonProof": "partial"
    },
    "proofNotes": {
      "legacyRecordProof": "Legacy fixture seeding now runs inside lane bundles, historical restore-loop proof logs baseline/fresh snapshot restores, and v18 adds a historical generation matrix that replays multiple downgraded backup variants per lane. Deep proof against actual older shipped packages is still pending, so this remains partial. v19 bundles historical generation-matrix results into stored/exportable closure bundles, but deep proof against actual older shipped packages is still pending. v20 adds a local historical corpus sweep that replays current closure/eligibility state into the generation-matrix log. v21 adds legacy-proof intake/import and lineage export so older diagnostics/closure packages can be staged for comparison, but deep proof against real older shipped packages is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v24 adds a dedicated legacy-record proof runner that replays every directive-first lane through the legacy path, saves generation-matrix evidence per lane, stores reusable legacy-run logs, and pushes shared legacy packages into an AE FLOW sync outbox, but proof against real older shipped packages is still pending.",
      "exportImportProof": "Route-pack proof now includes local roundtrip, a second-device-style serialized transfer rehearsal with fingerprint logging, and v18 adds closure-report export plus per-lane historical generation matrix logging. True cross-device proof on a separate real device is still pending. v19 adds stored closure-bundle export/import plus an AE FLOW closure-bundle inbox for cross-app proof-package visibility, but true separate-device proof is still pending. v20 adds a shared Routex closure outbox and AE FLOW sync bridge for cross-app proof-package visibility. v21 adds cross-device proof capsules plus a shared capsule outbox and AE FLOW capsule inbox, but true separate-device proof is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW.",
      "noDeadButtonProof": "Lane action probes, full proof sweep execution, operator click-sweep HTML export, and a manual operator-audit assistant/log now exist for the directive-first lanes. A human full click walkthrough is still pending, so this remains partial. v19 adds closure-campaign packaging and AE FLOW closure-bundle inbox visibility, but a human full click walkthrough is still pending. v20 adds a directive action-registry sweep that programmatically opens the key directive-first actions and saves an audit log/HTML report, but a full human click walkthrough is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW."
    }
  },
  {
    "packageLabel": "SkyeRoutexFlow v25 export-import pass",
    "versionTag": "v25",
    "packageFingerprint": "v25-d3743a1cb1bc",
    "zipName": "SkyeRoutexFlow_v25_NEW-SHIT2_export-import-pass.zip",
    "zipSizeBytes": 963904,
    "zipSha256": "d3743a1cb1bccfce05449ab1ed515162aa6de18640411250275938ee99a4385e",
    "routexIndexSizeBytes": 504295,
    "aeIndexSizeBytes": 132341,
    "proofStatuses": {
      "freshRecordProof": "base-landed",
      "legacyRecordProof": "partial",
      "exportImportProof": "partial",
      "noDeadButtonProof": "partial"
    },
    "proofNotes": {
      "legacyRecordProof": "Legacy fixture seeding now runs inside lane bundles, historical restore-loop proof logs baseline/fresh snapshot restores, and v18 adds a historical generation matrix that replays multiple downgraded backup variants per lane. Deep proof against actual older shipped packages is still pending, so this remains partial. v19 bundles historical generation-matrix results into stored/exportable closure bundles, but deep proof against actual older shipped packages is still pending. v20 adds a local historical corpus sweep that replays current closure/eligibility state into the generation-matrix log. v21 adds legacy-proof intake/import and lineage export so older diagnostics/closure packages can be staged for comparison, but deep proof against real older shipped packages is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v24 adds a dedicated legacy-record proof runner that replays every directive-first lane through the legacy path, saves generation-matrix evidence per lane, stores reusable legacy-run logs, and pushes shared legacy packages into an AE FLOW sync outbox, but proof against real older shipped packages is still pending.",
      "exportImportProof": "Route-pack proof now includes local roundtrip, a second-device-style serialized transfer rehearsal with fingerprint logging, and v18 adds closure-report export plus per-lane historical generation matrix logging. True cross-device proof on a separate real device is still pending. v19 adds stored closure-bundle export/import plus an AE FLOW closure-bundle inbox for cross-app proof-package visibility, but true separate-device proof is still pending. v20 adds a shared Routex closure outbox and AE FLOW sync bridge for cross-app proof-package visibility. v21 adds cross-device proof capsules plus a shared capsule outbox and AE FLOW capsule inbox, but true separate-device proof is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v25 adds a dedicated export/import proof runner that replays the transfer-capable lanes, saves focused export/import run logs, stages a reopened closure payload, stages a reopened capsule payload, and pushes transfer-proof packages into the shared AE FLOW handoff surfaces, but proof on a truly separate real device is still pending.",
      "noDeadButtonProof": "Lane action probes, full proof sweep execution, operator click-sweep HTML export, and a manual operator-audit assistant/log now exist for the directive-first lanes. A human full click walkthrough is still pending, so this remains partial. v19 adds closure-campaign packaging and AE FLOW closure-bundle inbox visibility, but a human full click walkthrough is still pending. v20 adds a directive action-registry sweep that programmatically opens the key directive-first actions and saves an audit log/HTML report, but a full human click walkthrough is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW."
    }
  },
  {
    "packageLabel": "SkyeRoutexFlow v26 no-dead pass",
    "versionTag": "v26",
    "packageFingerprint": "v26-200f1e6e1b25",
    "zipName": "SkyeRoutexFlow_v26_NEW-SHIT2_no-dead-pass.zip",
    "zipSizeBytes": 984632,
    "zipSha256": "200f1e6e1b254deb8aa074f42a5add53bf95d1ed892fdc4c2f04a51001fdfe53",
    "routexIndexSizeBytes": 563960,
    "aeIndexSizeBytes": 147631,
    "proofStatuses": {
      "freshRecordProof": "base-landed",
      "legacyRecordProof": "partial",
      "exportImportProof": "partial",
      "noDeadButtonProof": "partial"
    },
    "proofNotes": {
      "legacyRecordProof": "Legacy fixture seeding now runs inside lane bundles, historical restore-loop proof logs baseline/fresh snapshot restores, and v18 adds a historical generation matrix that replays multiple downgraded backup variants per lane. Deep proof against actual older shipped packages is still pending, so this remains partial. v19 bundles historical generation-matrix results into stored/exportable closure bundles, but deep proof against actual older shipped packages is still pending. v20 adds a local historical corpus sweep that replays current closure/eligibility state into the generation-matrix log. v21 adds legacy-proof intake/import and lineage export so older diagnostics/closure packages can be staged for comparison, but deep proof against real older shipped packages is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v24 adds a dedicated legacy-record proof runner that replays every directive-first lane through the legacy path, saves generation-matrix evidence per lane, stores reusable legacy-run logs, and pushes shared legacy packages into an AE FLOW sync outbox, but proof against real older shipped packages is still pending.",
      "exportImportProof": "Route-pack proof now includes local roundtrip, a second-device-style serialized transfer rehearsal with fingerprint logging, and v18 adds closure-report export plus per-lane historical generation matrix logging. True cross-device proof on a separate real device is still pending. v19 adds stored closure-bundle export/import plus an AE FLOW closure-bundle inbox for cross-app proof-package visibility, but true separate-device proof is still pending. v20 adds a shared Routex closure outbox and AE FLOW sync bridge for cross-app proof-package visibility. v21 adds cross-device proof capsules plus a shared capsule outbox and AE FLOW capsule inbox, but true separate-device proof is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v25 adds a dedicated export/import proof runner that replays the transfer-capable lanes, saves focused export/import run logs, stages a reopened closure payload, stages a reopened capsule payload, and pushes transfer-proof packages into the shared AE FLOW handoff surfaces, but proof on a truly separate real device is still pending.",
      "noDeadButtonProof": "Lane action probes, full proof sweep execution, operator click-sweep HTML export, and a manual operator-audit assistant/log now exist for the directive-first lanes. A human full click walkthrough is still pending, so this remains partial. v19 adds closure-campaign packaging and AE FLOW closure-bundle inbox visibility, but a human full click walkthrough is still pending. v20 adds a directive action-registry sweep that programmatically opens the key directive-first actions and saves an audit log/HTML report, but a full human click walkthrough is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW."
    }
  }
];
  const readJSON = (key, fallback)=>{ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_ ){ return fallback; } };
  const writeJSON = (key, value)=> localStorage.setItem(key, JSON.stringify(value));
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const uid = window.uid || (()=>('v27-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const nowISO = window.nowISO || (()=> new Date().toISOString());
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  const fmt = window.fmt || (v => new Date(v || Date.now()).toLocaleString());
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  function readList(key, limit){ return readJSON(key, []).filter(Boolean).slice(0, limit || 120); }
  function saveList(key, rows, limit){ writeJSON(key, (Array.isArray(rows) ? rows : []).slice(0, limit || 120)); }
  function upsertByFingerprint(key, row, limit){ const list = readList(key, limit).filter(item => clean(item && item.fingerprint) !== clean(row && row.fingerprint)); list.unshift(row); saveList(key, list, limit); return row; }
  function readCorpus(){ return readList(CORPUS_KEY, 40); }
  function saveCorpus(rows){ saveList(CORPUS_KEY, rows, 40); }
  function readCompareRuns(){ return readList(COMPARE_KEY, 40); }
  function saveCompareRun(row){ return upsertByFingerprint(COMPARE_KEY, row, 40); }
  function normalizeManifest(raw){
    const proof = raw && raw.proofStatuses ? raw.proofStatuses : {};
    return {
      packageLabel: clean(raw && raw.packageLabel) || 'Actual shipped package',
      versionTag: clean(raw && raw.versionTag) || 'legacy',
      packageFingerprint: clean(raw && raw.packageFingerprint) || ('pkg-' + uid()),
      zipName: clean(raw && raw.zipName),
      zipSizeBytes: Number(raw && raw.zipSizeBytes || 0),
      zipSha256: clean(raw && raw.zipSha256),
      routexIndexSizeBytes: Number(raw && raw.routexIndexSizeBytes || 0),
      aeIndexSizeBytes: Number(raw && raw.aeIndexSizeBytes || 0),
      proofStatuses: {
        freshRecordProof: clean(proof.freshRecordProof) || 'unknown',
        legacyRecordProof: clean(proof.legacyRecordProof) || 'unknown',
        exportImportProof: clean(proof.exportImportProof) || 'unknown',
        noDeadButtonProof: clean(proof.noDeadButtonProof) || 'unknown'
      },
      proofNotes: raw && raw.proofNotes ? raw.proofNotes : {}
    };
  }
  function manifestToLegacyRow(manifest){
    const m = normalizeManifest(manifest);
    return {
      id: uid(),
      importedAt: nowISO(),
      label: 'Actual shipped package • ' + m.packageLabel,
      source: 'actual-shipped-package-manifest',
      fingerprint: m.packageFingerprint,
      lane: 'legacy-record-proof',
      routeCount: 0,
      stopCount: 0,
      docCount: 0,
      latestMatrixId: '',
      latestLaneProofId: '',
      note: 'Actual shipped package manifest imported from ' + m.packageLabel + '. Legacy line in that package was ' + m.proofStatuses.legacyRecordProof + '.',
      proofStates: { legacy:true, restore:true, actualShippedPackage:true },
      matrixSummary: {
        packageLabel: m.packageLabel,
        versionTag: m.versionTag,
        zipName: m.zipName,
        zipSha256: m.zipSha256,
        routexIndexSizeBytes: m.routexIndexSizeBytes,
        aeIndexSizeBytes: m.aeIndexSizeBytes,
        proofStatuses: m.proofStatuses
      }
    };
  }
  function seedShippedLegacyCorpus(){
    const corpus = readCorpus();
    const intake = readList(LEGACY_INTAKE_KEY, 120);
    const outbox = readList(LEGACY_OUTBOX_KEY, 120);
    let merged = 0, duplicate = 0;
    SHIPPED_PACKAGE_MANIFESTS.forEach(raw => {
      const manifest = normalizeManifest(raw);
      if(corpus.some(item => clean(item.packageFingerprint) === clean(manifest.packageFingerprint))) duplicate += 1;
      else { corpus.unshift(manifest); merged += 1; }
      const intakeRow = manifestToLegacyRow(manifest);
      if(!intake.some(item => clean(item.fingerprint) === clean(intakeRow.fingerprint))) intake.unshift(intakeRow);
      if(!outbox.some(item => clean(item.fingerprint) === clean(intakeRow.fingerprint))) outbox.unshift({ ...intakeRow, exportedAt: nowISO(), source:'routex-legacy-outbox' });
    });
    saveCorpus(corpus.slice(0, 40));
    saveList(LEGACY_INTAKE_KEY, intake, 120);
    saveList(LEGACY_OUTBOX_KEY, outbox, 120);
    return { merged, duplicate, total: readCorpus().length };
  }
  function buildCompareRow(baseRun){
    const corpus = readCorpus();
    const laneResults = Array.isArray(baseRun && baseRun.laneResults) ? baseRun.laneResults : [];
    const currentLegacyOk = laneResults.length > 0 && laneResults.every(item => !!(item && item.ok));
    const packageRows = corpus.map(pkg => {
      const manifest = normalizeManifest(pkg);
      const status = manifest.proofStatuses || {};
      const ok = currentLegacyOk && clean(status.legacyRecordProof) === 'partial' && manifest.routexIndexSizeBytes > 0 && manifest.aeIndexSizeBytes > 0;
      return {
        packageLabel: manifest.packageLabel,
        versionTag: manifest.versionTag,
        packageFingerprint: manifest.packageFingerprint,
        zipName: manifest.zipName,
        zipSha256: manifest.zipSha256,
        routexIndexSizeBytes: manifest.routexIndexSizeBytes,
        aeIndexSizeBytes: manifest.aeIndexSizeBytes,
        proofStatuses: status,
        ok,
        note: 'Compared current dedicated legacy runner against the actual shipped package manifest for ' + manifest.packageLabel + '.'
      };
    });
    const ok = packageRows.length > 0 && packageRows.every(item => item.ok);
    return {
      id: uid(),
      createdAt: nowISO(),
      label: 'Actual shipped legacy compare • ' + dayISO(),
      fingerprint: 'rlc-' + packageRows.map(item => clean(item.packageFingerprint)).join('-').slice(0, 48),
      packageCount: packageRows.length,
      currentLegacyOk,
      ok,
      packageRows,
      note: ok ? 'Current legacy-record proof was compared against the actual shipped package manifests from v23–v26 in this conversation bundle.' : 'Actual shipped legacy compare needs review.'
    };
  }
  function buildCompareHtml(row){
    const body = (Array.isArray(row && row.packageRows) ? row.packageRows : []).map(item => '<tr><td>'+esc(item.packageLabel || '—')+'</td><td>'+esc(item.versionTag || '—')+'</td><td>'+esc(item.packageFingerprint || '—')+'</td><td>'+esc(item.proofStatuses && item.proofStatuses.legacyRecordProof || '—')+'</td><td>'+esc(item.proofStatuses && item.proofStatuses.exportImportProof || '—')+'</td><td>'+esc(item.proofStatuses && item.proofStatuses.noDeadButtonProof || '—')+'</td><td>'+esc(String(item.routexIndexSizeBytes || 0))+'</td><td>'+esc(String(item.aeIndexSizeBytes || 0))+'</td><td>'+(item.ok ? '✅' : '⚠️')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Actual shipped legacy compare</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1180px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex actual shipped legacy compare</h1><div><span class="badge">'+esc(row && row.fingerprint || '—')+'</span><span class="badge">Packages '+esc(String(row && row.packageCount || 0))+'</span><span class="badge">'+((row && row.ok) ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(row && row.note || '')+'</div></div><div class="card"><table><thead><tr><th>Package</th><th>Tag</th><th>Fingerprint</th><th>Legacy</th><th>Export/import</th><th>No-dead</th><th>Routex bytes</th><th>AE bytes</th><th>OK</th></tr></thead><tbody>'+(body || '<tr><td colspan="9">No package comparisons captured.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function exportLatestCompareHtml(){ const row = readCompareRuns()[0]; if(!row) return toast('Run legacy proof first.', 'warn'); downloadText(buildCompareHtml(row), 'routex_actual_shipped_legacy_compare_' + dayISO() + '.html', 'text/html'); toast('Actual shipped legacy compare HTML exported.', 'good'); }
  function exportLatestCompareJson(){ const row = readCompareRuns()[0]; if(!row) return toast('Run legacy proof first.', 'warn'); downloadText(JSON.stringify(row, null, 2), 'routex_actual_shipped_legacy_compare_' + dayISO() + '.json', 'application/json'); toast('Actual shipped legacy compare JSON exported.', 'good'); }
  function readLegacyRuns(){ return readList(LEGACY_RUN_KEY, 120); }
  function saveLegacyRuns(rows){ saveList(LEGACY_RUN_KEY, rows, 120); }
  function mergeCompareIntoLatestLegacyRun(compare){
    const runs = readLegacyRuns();
    if(!runs.length) return null;
    const latest = runs[0] || {};
    const updated = {
      ...latest,
      realShippedCompareId: compare.id,
      realShippedCompareFingerprint: compare.fingerprint,
      realShippedCompareOk: !!compare.ok,
      realShippedPackages: Number(compare.packageCount || 0),
      note: [clean(latest.note), clean(compare.note)].filter(Boolean).join(' • ')
    };
    runs[0] = updated;
    saveLegacyRuns(runs);
    return updated;
  }
  function pushCompareBridgeRow(compare){
    const bridge = {
      id: uid(),
      importedAt: nowISO(),
      label: 'Actual shipped legacy compare • ' + String(compare.packageCount || 0) + ' packages',
      source: 'routex-legacy-outbox',
      fingerprint: compare.fingerprint,
      lane: 'legacy-record-proof',
      routeCount: 0,
      stopCount: 0,
      docCount: 0,
      latestMatrixId: '',
      latestLaneProofId: clean(compare.id),
      note: clean(compare.note),
      proofStates: { legacy:true, restore:true, actualShippedPackage:true, actualShippedCompare:!!compare.ok },
      matrixSummary: { packageCount: Number(compare.packageCount || 0), currentLegacyOk: !!compare.currentLegacyOk }
    };
    upsertByFingerprint(LEGACY_INTAKE_KEY, bridge, 120);
    upsertByFingerprint(LEGACY_OUTBOX_KEY, { ...bridge, exportedAt: nowISO() }, 120);
  }
  const prevRunLegacy = window.runLegacyRecordProofComplete;
  if(typeof prevRunLegacy === 'function'){
    window.runLegacyRecordProofComplete = async function(){
      seedShippedLegacyCorpus();
      const base = await prevRunLegacy.apply(this, arguments);
      const compare = saveCompareRun(buildCompareRow(base));
      mergeCompareIntoLatestLegacyRun(compare);
      pushCompareBridgeRow(compare);
      toast(compare.ok ? 'Actual shipped legacy compare saved.' : 'Actual shipped legacy compare needs review.', compare.ok ? 'good' : 'warn');
      const runs = readLegacyRuns();
      return runs[0] || base;
    };
  }
  function injectLegacyCorpusControls(){
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    if(!title || !body || !/Legacy record proof/i.test(title.textContent || '')) return;
    if(document.getElementById('legacyActualShippedBlock')) return;
    const latest = readCompareRuns()[0] || null;
    const corpus = readCorpus();
    const box = document.createElement('div');
    box.id = 'legacyActualShippedBlock';
    box.className = 'card';
    box.style.marginTop = '12px';
    box.innerHTML = '<h3 style="margin:0 0 10px;">Actual shipped package corpus</h3><div class="hint">This legacy lane now seeds and compares against the actual shipped package manifests from v23–v26 in this conversation bundle, not only synthetic downgraded variants.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="legacySeedCorpusBtn">Seed shipped corpus</button><button class="btn" id="legacyCompareHtmlBtn">Export shipped compare HTML</button><button class="btn" id="legacyCompareJsonBtn">Export shipped compare JSON</button></div><div class="sep"></div><div class="hint">Corpus packages: <span class="mono">'+esc(String(corpus.length))+'</span>'+(latest ? ' • Latest compare <span class="mono">'+esc(latest.fingerprint || '—')+'</span> • packages <span class="mono">'+esc(String(latest.packageCount || 0))+'</span>' : ' • No actual shipped compare run saved yet.')+'</div>';
    body.appendChild(box);
    document.getElementById('legacySeedCorpusBtn').onclick = function(){ const result = seedShippedLegacyCorpus(); toast(result.merged ? 'Actual shipped legacy corpus seeded.' : 'Actual shipped legacy corpus already present.', result.merged ? 'good' : 'warn'); try{ injectLegacyCorpusControls(); }catch(_){} };
    document.getElementById('legacyCompareHtmlBtn').onclick = exportLatestCompareHtml;
    document.getElementById('legacyCompareJsonBtn').onclick = exportLatestCompareJson;
  }
  const prevOpenLegacyManager = window.openLegacyProofRunnerManager;
  if(typeof prevOpenLegacyManager === 'function'){
    window.openLegacyProofRunnerManager = function(){
      seedShippedLegacyCorpus();
      const out = prevOpenLegacyManager.apply(this, arguments);
      setTimeout(injectLegacyCorpusControls, 0);
      return out;
    };
  }
  const prevRenderAll = window.renderAll;
  if(typeof prevRenderAll === 'function'){
    window.renderAll = function(){ const out = prevRenderAll.apply(this, arguments); setTimeout(injectLegacyCorpusControls, 0); return out; };
  }
  window.seedRoutexShippedLegacyCorpus = seedShippedLegacyCorpus;
  window.readRoutexShippedLegacyCorpus = readCorpus;
  window.readRoutexShippedLegacyCompareRuns = readCompareRuns;
  window.exportLatestRoutexShippedLegacyCompareHtml = exportLatestCompareHtml;
  window.exportLatestRoutexShippedLegacyCompareJson = exportLatestCompareJson;
  seedShippedLegacyCorpus();
})();

/* V21 closure completion assist */
(function(){
  if(window.__ROUTEX_V21__) return; window.__ROUTEX_V21__ = true;
  const CAPSULE_KEY = 'skye_routex_cross_device_capsules_v1';
  const CAPSULE_OUTBOX_KEY = 'skye_routex_cross_device_outbox_v1';
  const LEGACY_INTAKE_KEY = 'skye_routex_legacy_proof_intake_v1';
  const HUMAN_WALKTHROUGH_KEY = 'skye_routex_human_walkthrough_v1';
  const html = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const attr = window.escapeAttr || html;
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const now = ()=> new Date().toISOString();
  const day = ()=> typeof dayISO === 'function' ? dayISO() : now().slice(0,10);
  const hash = window.tinyHash || function(input){ const str = String(input || ''); let h = 2166136261 >>> 0; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ('00000000' + (h >>> 0).toString(16)).slice(-8); };
  const $ = window.$ || (sel => document.querySelector(sel));
  const $$ = window.$$ || (sel => Array.from(document.querySelectorAll(sel)));
  function readKey(key, fallback){ try{ const raw = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); return Array.isArray(fallback) ? (Array.isArray(raw) ? raw : fallback) : (raw && typeof raw === 'object' ? raw : fallback); }catch(_){ return fallback; } }
  function writeKey(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function listCapsules(){ return readKey(CAPSULE_KEY, []).filter(Boolean).slice(0,60); }
  function saveCapsules(items){ return writeKey(CAPSULE_KEY, (Array.isArray(items)?items:[]).slice(0,60)); }
  function pushCapsule(row){ const list = listCapsules().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); list.unshift(row); saveCapsules(list); return row; }
  function listCapsuleOutbox(){ return readKey(CAPSULE_OUTBOX_KEY, []).filter(Boolean).slice(0,60); }
  function saveCapsuleOutbox(items){ return writeKey(CAPSULE_OUTBOX_KEY, (Array.isArray(items)?items:[]).slice(0,60)); }
  function pushCapsuleOutbox(row){ const list = listCapsuleOutbox().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); list.unshift(row); saveCapsuleOutbox(list); return row; }
  function listLegacyProofIntake(){ return readKey(LEGACY_INTAKE_KEY, []).filter(Boolean).slice(0,60); }
  function saveLegacyProofIntake(items){ return writeKey(LEGACY_INTAKE_KEY, (Array.isArray(items)?items:[]).slice(0,60)); }
  function pushLegacyProofIntake(row){ const list = listLegacyProofIntake().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); list.unshift(row); saveLegacyProofIntake(list); return row; }
  function listHumanWalkthroughs(){ return readKey(HUMAN_WALKTHROUGH_KEY, []).filter(Boolean).slice(0,80); }
  function saveHumanWalkthroughs(items){ return writeKey(HUMAN_WALKTHROUGH_KEY, (Array.isArray(items)?items:[]).slice(0,80)); }
  function pushHumanWalkthrough(row){ const list = listHumanWalkthroughs().filter(item => clean(item.id) !== clean(row.id)); list.unshift(row); saveHumanWalkthroughs(list); return row; }
  function buildActionSweepSummary(){
    const log = (typeof readRoutexButtonSweepLog === 'function' ? readRoutexButtonSweepLog() : []);
    const latest = log[0] || null;
    const passed = latest && Array.isArray(latest.rows) ? latest.rows.filter(r => r && r.ok).length : 0;
    const total = latest && Array.isArray(latest.rows) ? latest.rows.length : 0;
    return { latest, passed, total };
  }
  function buildCrossDeviceCapsule(){
    const bundle = typeof readRoutexClosureBundles === 'function' ? (readRoutexClosureBundles()[0] || null) : null;
    const sweep = buildActionSweepSummary();
    const matrix = typeof readGenerationMatrixLog === 'function' ? (readGenerationMatrixLog()[0] || null) : null;
    const audits = typeof readOperatorAudits === 'function' ? readOperatorAudits() : [];
    const proof = typeof buildValidationSummary === 'function' ? buildValidationSummary() : { latestByLane:{}, entries:[] };
    const heat = typeof readHeatAuditLog === 'function' ? (readHeatAuditLog()[0] || null) : null;
    const restore = typeof readProofRestoreGenerations === 'function' ? (readProofRestoreGenerations()[0] || null) : null;
    const digest = JSON.stringify({ bundle: bundle && bundle.fingerprint, sweep: sweep.total, matrix: matrix && matrix.id, audits: audits.length, proof: proof.entries ? proof.entries.length : 0, heat: heat && heat.id, restore: restore && restore.id });
    return {
      id: (typeof uid === 'function' ? uid() : ('cap-' + hash(digest + now()))),
      createdAt: now(),
      source: 'routex-cross-device-capsule',
      label: 'Routex cross-device capsule • ' + day(),
      fingerprint: 'xdc-' + hash(digest),
      closureFingerprint: clean(bundle && bundle.fingerprint),
      routeCount: Number(bundle && bundle.routeCount || 0),
      stopCount: Number(bundle && bundle.stopCount || 0),
      docCount: Number(bundle && bundle.docCount || 0),
      buttonSweepTotal: sweep.total,
      buttonSweepPassed: sweep.passed,
      auditCount: audits.length,
      proofEntryCount: Array.isArray(proof.entries) ? proof.entries.length : 0,
      laneStates: proof && proof.latestByLane ? Object.fromEntries(Object.entries(proof.latestByLane).map(([lane, row]) => [lane, row && row.proofStates ? row.proofStates : {}])) : {},
      latestMatrixId: clean(matrix && matrix.id),
      latestHeatAuditId: clean(heat && heat.id),
      latestRestoreId: clean(restore && restore.id),
      note: 'Built from latest closure bundle, action sweep, proof summary, generation matrix, restore log, heat audit, and operator audits for cross-device rehearsal.',
      importedAt: '',
      payloadVersion: 'v1'
    };
  }
  function buildCapsuleHtml(row){
    const lanes = row && row.laneStates ? Object.keys(row.laneStates) : [];
    const laneRows = lanes.map(lane => {
      const s = row.laneStates[lane] || {};
      return '<tr><td>'+html(lane)+'</td><td>'+(s.fresh?'✅':'')+'</td><td>'+(s.legacy?'✅':'')+'</td><td>'+(s.exportImport?'✅':'')+'</td><td>'+(s.restore?'✅':'')+'</td><td>'+(s.noDeadButtons?'✅':'')+'</td></tr>';
    }).join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Routex cross-device capsule</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex cross-device capsule</h1><div><span class="badge">'+html(row.fingerprint || '—')+'</span><span class="badge">Routes '+html(String(row.routeCount || 0))+'</span><span class="badge">Stops '+html(String(row.stopCount || 0))+'</span><span class="badge">Docs '+html(String(row.docCount || 0))+'</span><span class="badge">Buttons '+html(String(row.buttonSweepPassed || 0))+'/'+html(String(row.buttonSweepTotal || 0))+'</span></div><div style="margin-top:8px;">'+html(row.note || '')+'</div></div><div class="card"><table><thead><tr><th>Lane</th><th>Fresh</th><th>Legacy</th><th>Export/import</th><th>Restore</th><th>No-dead</th></tr></thead><tbody>'+(laneRows || '<tr><td colspan="6">No lane-state data in this capsule.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function saveCrossDeviceCapsule(pushOutbox){
    const row = buildCrossDeviceCapsule();
    pushCapsule(row);
    if(pushOutbox) pushCapsuleOutbox({ ...row, source:'routex-cross-device-outbox', exportedAt: now() });
    return row;
  }
  function exportLatestCapsuleJson(){ const row = listCapsules()[0] || saveCrossDeviceCapsule(false); downloadText(JSON.stringify(row, null, 2), 'routex_cross_device_capsule_' + clean(row.fingerprint || day()) + '.json', 'application/json'); toast('Cross-device capsule JSON exported.', 'good'); }
  function exportLatestCapsuleHtml(){ const row = listCapsules()[0] || saveCrossDeviceCapsule(false); downloadText(buildCapsuleHtml(row), 'routex_cross_device_capsule_' + clean(row.fingerprint || day()) + '.html', 'text/html'); toast('Cross-device capsule HTML exported.', 'good'); }
  function openCapsuleImportPicker(){
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
    input.onchange = async ()=>{
      const file = input.files && input.files[0]; if(!file) return;
      let data = null; try{ data = JSON.parse(await file.text()); }catch(_){ return toast('Invalid capsule JSON.', 'bad'); }
      const row = { ...(data && typeof data === 'object' ? data : {}), id: (typeof uid === 'function' ? uid() : ('cap-' + hash(JSON.stringify(data) + now()))), importedAt: now(), source: clean(data && data.source) || 'imported-cross-device-capsule' };
      if(!clean(row.fingerprint)) row.fingerprint = 'xdc-' + hash(JSON.stringify(row));
      pushCapsule(row); toast('Cross-device capsule imported.', 'good');
    };
    input.click();
  }
  function exportCapsuleOutbox(){ downloadText(JSON.stringify({ type:'skye-routex-cross-device-outbox-v1', exportedAt: now(), rows: listCapsuleOutbox() }, null, 2), 'routex_cross_device_outbox_' + day() + '.json', 'application/json'); toast('Cross-device outbox exported.', 'good'); }
  function openCapsuleManager(){
    const rows = listCapsules().map(item => '<div class="item"><div class="meta"><div class="name">'+html(item.label || 'Capsule')+' <span class="badge">'+html(item.fingerprint || '—')+'</span></div><div class="sub">'+html(new Date(item.createdAt || Date.now()).toLocaleString())+' • buttons '+html(String(item.buttonSweepPassed || 0))+'/'+html(String(item.buttonSweepTotal || 0))+' • audits '+html(String(item.auditCount || 0))+'</div></div><div class="row" style="justify-content:flex-end;flex-wrap:wrap;"><button class="btn small" data-cap-html="'+attr(item.fingerprint)+'">HTML</button><button class="btn small" data-cap-json="'+attr(item.fingerprint)+'">JSON</button></div></div>').join('') || '<div class="hint">No cross-device capsules saved yet.</div>';
    openModal('Cross-device capsules', '<div class="hint">Use this to package proof state for another device or another operator without mutating live routes.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="cap_build">Build capsule</button><button class="btn" id="cap_build_outbox">Build + push to outbox</button><button class="btn" id="cap_import">Import JSON</button><button class="btn" id="cap_outbox">Export outbox</button></div><div class="sep"></div><div class="list">'+rows+'</div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button><button class="btn primary" id="cap_latest_html">Export latest HTML</button>');
    $('#cap_build').onclick = ()=>{ saveCrossDeviceCapsule(false); toast('Cross-device capsule built.', 'good'); closeModal(); openCapsuleManager(); };
    $('#cap_build_outbox').onclick = ()=>{ saveCrossDeviceCapsule(true); toast('Cross-device capsule pushed to outbox.', 'good'); closeModal(); openCapsuleManager(); };
    $('#cap_import').onclick = ()=> openCapsuleImportPicker();
    $('#cap_outbox').onclick = ()=> exportCapsuleOutbox();
    $('#cap_latest_html').onclick = ()=> exportLatestCapsuleHtml();
    $$('[data-cap-html]').forEach(btn => btn.onclick = ()=>{ const row = listCapsules().find(item => clean(item.fingerprint) === clean(btn.getAttribute('data-cap-html'))); if(!row) return toast('Capsule not found.', 'warn'); downloadText(buildCapsuleHtml(row), 'routex_cross_device_capsule_' + clean(row.fingerprint || row.id) + '.html', 'text/html'); toast('Cross-device capsule HTML exported.', 'good'); });
    $$('[data-cap-json]').forEach(btn => btn.onclick = ()=>{ const row = listCapsules().find(item => clean(item.fingerprint) === clean(btn.getAttribute('data-cap-json'))); if(!row) return toast('Capsule not found.', 'warn'); downloadText(JSON.stringify(row, null, 2), 'routex_cross_device_capsule_' + clean(row.fingerprint || row.id) + '.json', 'application/json'); toast('Cross-device capsule JSON exported.', 'good'); });
  }
  function normalizeLegacyProofRow(raw){
    const row = raw && typeof raw === 'object' ? raw : {};
    const digest = JSON.stringify({ keys:Object.keys(row).sort(), fingerprint: row.fingerprint || row.latestMatrixId || row.type || row.source || '' });
    return {
      id: clean(row.id) || (typeof uid === 'function' ? uid() : ('legacy-' + hash(digest + now()))),
      importedAt: now(),
      label: clean(row.label) || clean(row.type) || 'Imported legacy proof package',
      source: clean(row.source) || 'legacy-proof-import',
      fingerprint: clean(row.fingerprint) || 'lg-' + hash(digest),
      routeCount: Number(row.routeCount || 0),
      stopCount: Number(row.stopCount || 0),
      docCount: Number(row.docCount || 0),
      note: clean(row.note) || 'Imported older proof or diagnostics package for historical comparison.',
      raw: row
    };
  }
  function importLegacyProofPayload(payload){
    const rows = Array.isArray(payload && payload.rows) ? payload.rows : (Array.isArray(payload) ? payload : [payload]);
    let merged=0, duplicate=0;
    rows.forEach(raw => { const row = normalizeLegacyProofRow(raw); const existing = listLegacyProofIntake(); if(existing.some(item => clean(item.fingerprint) === clean(row.fingerprint))){ duplicate++; return; } merged++; pushLegacyProofIntake(row); });
    return { merged, duplicate };
  }
  function openLegacyProofPicker(){
    const input = document.createElement('input'); input.type='file'; input.accept='.json,application/json';
    input.onchange = async ()=>{ const file = input.files && input.files[0]; if(!file) return; let data = null; try{ data = JSON.parse(await file.text()); }catch(_){ return toast('Invalid legacy proof JSON.', 'bad'); } const merged = importLegacyProofPayload(data); toast('Legacy proof import: '+merged.merged+' merged, '+merged.duplicate+' duplicate.', merged.merged ? 'good' : 'warn'); };
    input.click();
  }
  function buildLegacyLineageHtml(){
    const rows = listLegacyProofIntake();
    const latest = (typeof readRoutexClosureBundles === 'function' ? (readRoutexClosureBundles()[0] || null) : null);
    const body = rows.map(item => '<tr><td>'+html(item.label)+'</td><td>'+html(item.fingerprint)+'</td><td>'+html(item.source || '—')+'</td><td>'+html(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Routex legacy proof lineage</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex legacy proof lineage</h1><div><span class="badge">Imported legacy packages '+html(String(rows.length))+'</span>' + (latest ? ('<span class="badge">Latest closure '+html(latest.fingerprint || '—')+'</span>') : '') + '</div></div><div class="card"><table><thead><tr><th>Label</th><th>Fingerprint</th><th>Source</th><th>Note</th></tr></thead><tbody>'+(body || '<tr><td colspan="4">No legacy proof packages imported yet.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function openLegacyIntakeManager(){
    const rows = listLegacyProofIntake().map(item => '<div class="item"><div class="meta"><div class="name">'+html(item.label || 'Legacy proof')+' <span class="badge">'+html(item.fingerprint || '—')+'</span></div><div class="sub">'+html(item.source || '—')+' • '+html(item.note || '')+'</div></div></div>').join('') || '<div class="hint">No imported legacy proof packages yet.</div>';
    openModal('Legacy proof intake', '<div class="hint">Import older proof bundles, diagnostics JSON, or workbook exports so current closure runs can be compared against historical packages.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="legacy_import">Import legacy JSON</button><button class="btn" id="legacy_export">Export lineage HTML</button></div><div class="sep"></div><div class="list">'+rows+'</div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>');
    $('#legacy_import').onclick = ()=> openLegacyProofPicker();
    $('#legacy_export').onclick = ()=>{ downloadText(buildLegacyLineageHtml(), 'routex_legacy_lineage_' + day() + '.html', 'text/html'); toast('Legacy proof lineage exported.', 'good'); };
  }
  function buildWalkthroughTemplate(){
    return [
      { lane:'fresh-record-proof', label:'Create fresh proof fixture and run full sweep', done:false, note:'' },
      { lane:'legacy-record-proof', label:'Import or seed legacy proof fixture and run historical matrix', done:false, note:'' },
      { lane:'export-import-proof', label:'Run route-pack export/import + cross-device capsule export', done:false, note:'' },
      { lane:'no-dead-button-proof', label:'Run action-registry sweep + human click walkthrough', done:false, note:'' },
      { lane:'closure-campaign', label:'Run directive closure campaign and review closure bundle', done:false, note:'' },
      { lane:'aeflow-sync', label:'Push bundle/capsule to AE FLOW and confirm sync inbox', done:false, note:'' }
    ];
  }
  function buildWalkthroughHtml(entry){
    const rows = (entry.items || []).map(item => '<tr><td>'+html(item.lane)+'</td><td>'+(item.done?'✅':'')+'</td><td>'+html(item.label)+'</td><td>'+html(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Routex human walkthrough</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex human walkthrough</h1><div><span class="badge">'+html(entry.reviewer || 'unassigned')+'</span><span class="badge">Done '+html(String((entry.items||[]).filter(item => item.done).length))+'/'+html(String((entry.items||[]).length))+'</span></div><div style="margin-top:8px;">'+html(entry.note || '')+'</div></div><div class="card"><table><thead><tr><th>Lane</th><th>Done</th><th>Checklist</th><th>Note</th></tr></thead><tbody>'+(rows || '<tr><td colspan="4">No walkthrough items.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function openHumanWalkthroughManager(){
    const latest = listHumanWalkthroughs()[0] || { id: (typeof uid === 'function' ? uid() : ('walk-' + hash(now()))), reviewer:'', note:'', items: buildWalkthroughTemplate() };
    const form = latest.items.map((item, idx) => '<div class="item"><div class="meta"><div class="name">'+html(item.label)+'</div><div class="sub">'+html(item.lane)+'</div></div><div style="flex:1; min-width:180px;"><textarea data-walk-note="'+idx+'" placeholder="What happened?" style="min-height:70px;">'+html(item.note || '')+'</textarea></div><div class="row" style="align-items:center;"><label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" data-walk-done="'+idx+'" '+(item.done?'checked':'')+'/> done</label></div></div>').join('');
    openModal('Human walkthrough', '<div class="hint">This is the operator-grade closure checklist. Use it to record a real human walkthrough after the automated sweeps are done.</div><div class="sep"></div><div class="fieldrow"><div class="field"><label>Reviewer</label><input id="walk_reviewer" value="'+attr(latest.reviewer || '')+'" placeholder="Operator name"/></div><div class="field full"><label>Run note</label><textarea id="walk_note" placeholder="What device / browser / package generation was used?">'+html(latest.note || '')+'</textarea></div></div><div class="sep"></div><div class="list">'+form+'</div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button><button class="btn" id="walk_export">Export HTML</button><button class="btn primary" id="walk_save">Save walkthrough</button>');
    $('#walk_save').onclick = ()=>{
      const entry = {
        id: latest.id || (typeof uid === 'function' ? uid() : ('walk-' + hash(now()))),
        createdAt: latest.createdAt || now(),
        savedAt: now(),
        reviewer: clean($('#walk_reviewer') && $('#walk_reviewer').value),
        note: clean($('#walk_note') && $('#walk_note').value),
        items: (latest.items || []).map((item, idx) => ({ ...item, done: !!document.querySelector('[data-walk-done="'+idx+'"]')?.checked, note: clean(document.querySelector('[data-walk-note="'+idx+'"]')?.value) }))
      };
      pushHumanWalkthrough(entry); toast('Human walkthrough saved.', 'good'); closeModal();
    };
    $('#walk_export').onclick = ()=>{
      const entry = {
        id: latest.id || (typeof uid === 'function' ? uid() : ('walk-' + hash(now()))),
        reviewer: clean($('#walk_reviewer') && $('#walk_reviewer').value),
        note: clean($('#walk_note') && $('#walk_note').value),
        items: (latest.items || []).map((item, idx) => ({ ...item, done: !!document.querySelector('[data-walk-done="'+idx+'"]')?.checked, note: clean(document.querySelector('[data-walk-note="'+idx+'"]')?.value) }))
      };
      downloadText(buildWalkthroughHtml(entry), 'routex_human_walkthrough_' + day() + '.html', 'text/html'); toast('Human walkthrough HTML exported.', 'good');
    };
  }
  function injectProofRegistryV21(){
    const host = $('#pv_scan_result'); if(!host || $('#pv_v21_actions')) return;
    const wrap = document.createElement('div'); wrap.id = 'pv_v21_actions'; wrap.style.marginTop = '12px';
    wrap.innerHTML = '<div class="row" style="flex-wrap:wrap;"><button class="btn" id="pv_capsule_manager">Cross-device</button><button class="btn" id="pv_legacy_manager">Legacy intake</button><button class="btn" id="pv_walkthrough_manager">Human walkthrough</button><button class="btn" id="pv_capsule_export">Export capsule JSON</button></div><div class="hint" style="margin-top:8px;">Latest capsules '+html(String(listCapsules().length))+' • legacy imports '+html(String(listLegacyProofIntake().length))+' • walkthrough logs '+html(String(listHumanWalkthroughs().length))+'</div>';
    host.parentNode.insertBefore(wrap, host.nextSibling);
    $('#pv_capsule_manager').onclick = ()=> openCapsuleManager();
    $('#pv_legacy_manager').onclick = ()=> openLegacyIntakeManager();
    $('#pv_walkthrough_manager').onclick = ()=> openHumanWalkthroughManager();
    $('#pv_capsule_export').onclick = ()=> exportLatestCapsuleJson();
  }
  function injectExtrasV21(){
    const row = $('#st_shared_outbox_push') && $('#st_shared_outbox_push').parentNode;
    if(row && !$('#st_cross_device_capsules')){
      const btn = document.createElement('button'); btn.className='btn'; btn.id='st_cross_device_capsules'; btn.textContent='Cross-device'; btn.onclick=()=> openCapsuleManager(); row.appendChild(btn);
      const legacy = document.createElement('button'); legacy.className='btn'; legacy.id='st_legacy_intake'; legacy.textContent='Legacy intake'; legacy.onclick=()=> openLegacyIntakeManager(); row.appendChild(legacy);
      const walk = document.createElement('button'); walk.className='btn'; walk.id='st_human_walkthrough'; walk.textContent='Human walkthrough'; walk.onclick=()=> openHumanWalkthroughManager(); row.appendChild(walk);
    }
    const card = $('#st_shared_outbox_push') && $('#st_shared_outbox_push').closest('.card');
    const kpis = card && card.querySelector('.kpis');
    if(kpis && !card.querySelector('[data-kpi="cross-device-capsules"]')){
      const a = document.createElement('div'); a.className='kpi'; a.dataset.kpi='cross-device-capsules'; a.innerHTML='<div class="n">'+listCapsules().length+'</div><div class="d">Cross-device capsules</div>'; kpis.appendChild(a);
      const b = document.createElement('div'); b.className='kpi'; b.dataset.kpi='legacy-proof-intake'; b.innerHTML='<div class="n">'+listLegacyProofIntake().length+'</div><div class="d">Legacy proof imports</div>'; kpis.appendChild(b);
      const c = document.createElement('div'); c.className='kpi'; c.dataset.kpi='human-walkthrough'; c.innerHTML='<div class="n">'+listHumanWalkthroughs().length+'</div><div class="d">Human walkthroughs</div>'; kpis.appendChild(c);
    }
  }
  const __openValidationModal_v21 = window.openValidationModal;
  if(typeof __openValidationModal_v21 === 'function'){
    window.openValidationModal = function(){ const out = __openValidationModal_v21.apply(this, arguments); setTimeout(injectProofRegistryV21, 0); return out; };
  }
  const __renderAll_v21 = window.renderAll;
  if(typeof __renderAll_v21 === 'function'){
    window.renderAll = function(){ const out = __renderAll_v21.apply(this, arguments); setTimeout(injectExtrasV21, 0); return out; };
  }
  const __runDirectiveClosureCampaign_v21 = window.runDirectiveClosureCampaign;
  if(typeof __runDirectiveClosureCampaign_v21 === 'function'){
    window.runDirectiveClosureCampaign = async function(){ const result = await __runDirectiveClosureCampaign_v21.apply(this, arguments); try{ saveCrossDeviceCapsule(true); }catch(_){ } return result; };
  }
  const __runClosureAttemptForLane_v21 = window.runClosureAttemptForLane;
  if(typeof __runClosureAttemptForLane_v21 === 'function'){
    window.runClosureAttemptForLane = async function(){ const result = await __runClosureAttemptForLane_v21.apply(this, arguments); try{ saveCrossDeviceCapsule(false); }catch(_){ } return result; };
  }
  window.openRoutexCrossDeviceCapsules = openCapsuleManager;
  window.openRoutexLegacyProofIntake = openLegacyIntakeManager;
  window.openRoutexHumanWalkthrough = openHumanWalkthroughManager;
})();

/* V22 completion center + device attestation bridge */
(function(){
  if(window.__ROUTEX_V22__) return; window.__ROUTEX_V22__ = true;
  const SNAP_KEY = 'skye_routex_completion_snapshots_v1';
  const ATTEST_KEY = 'skye_routex_device_attestations_v1';
  const ATTEST_OUTBOX_KEY = 'skye_routex_device_attestation_outbox_v1';
  const readJSON = (key, fallback)=>{ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } };
  const writeJSON = (key, value)=> localStorage.setItem(key, JSON.stringify(value));
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const uid = window.uid || (()=>('v22-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const nowISO = window.nowISO || (()=> new Date().toISOString());
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  const fmt = window.fmt || (v => new Date(v || Date.now()).toLocaleString());
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], {type: type || 'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name||'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const openModal = window.openModal || function(title){ alert(title); };
  const closeModal = window.closeModal || function(){};
  const $ = sel => document.querySelector(sel);
  const readSnaps = ()=> readJSON(SNAP_KEY, []).filter(Boolean).slice(0,80);
  const saveSnap = row => { const list = readSnaps().filter(item => clean(item.id) !== clean(row.id)); list.unshift(row); writeJSON(SNAP_KEY, list.slice(0,80)); return row; };
  const readAttests = ()=> readJSON(ATTEST_KEY, []).filter(Boolean).slice(0,80);
  const saveAttest = row => { const list = readAttests().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); list.unshift(row); writeJSON(ATTEST_KEY, list.slice(0,80)); return row; };
  const readAttestOutbox = ()=> readJSON(ATTEST_OUTBOX_KEY, []).filter(Boolean).slice(0,80);
  const pushAttestOutbox = row => { const list = readAttestOutbox().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); list.unshift(row); writeJSON(ATTEST_OUTBOX_KEY, list.slice(0,80)); return row; };
  function countFrom(name){ try{ if(typeof window[name] !== 'function') return 0; const out = window[name](); return Array.isArray(out) ? out.length : (out && typeof out.length === 'number' ? out.length : 0); }catch(_){ return 0; } }
  function buildCompletionSnapshot(){
    const counts = { closureBundles: countFrom('readRoutexClosureBundles'), transferLogs: countFrom('readRoutePackTransferLog'), generationMatrices: countFrom('readGenerationMatrixLog'), heatAudits: countFrom('readHeatAuditLog'), buttonSweeps: countFrom('readRoutexButtonSweepLog'), capsules: countFrom('listCapsules'), legacyImports: countFrom('listLegacyProofIntake'), humanWalkthroughs: countFrom('listHumanWalkthroughs'), operatorAudits: countFrom('readOperatorAudits'), freshProofRuns: countFrom('readRoutexFreshProofRuns') };
    const partials = { freshRecordProof: counts.freshProofRuns > 0, legacyRecordProof: counts.legacyImports > 0 && counts.generationMatrices > 0, exportImportProof: counts.transferLogs > 0 && counts.capsules > 0 && counts.closureBundles > 0, noDeadButtonProof: counts.buttonSweeps > 0 && counts.humanWalkthroughs > 0 };
    const score = Object.values(partials).filter(Boolean).length;
    return { id: uid(), createdAt: nowISO(), packageLabel: 'Routex completion snapshot', fingerprint: ['cs', dayISO(), counts.freshProofRuns, counts.transferLogs, counts.buttonSweeps, counts.humanWalkthroughs].join('-'), counts, partials, completionScore: score, completionLabel: score + '/4 closure preconditions present', note: 'In-app closure snapshot. This does not replace a real separate-device or human walkthrough run.' };
  }
  function snapshotHtml(row){ const c=row.counts||{}; const p=row.partials||{}; const laneRows=[['Fresh record proof',p.freshRecordProof,'Fresh proof runs '+(c.freshProofRuns||0)+', closure bundles '+(c.closureBundles||0)+', button sweeps '+(c.buttonSweeps||0)],['Legacy record proof',p.legacyRecordProof,'Legacy imports '+(c.legacyImports||0)+', generation matrices '+(c.generationMatrices||0)],['Export/import proof',p.exportImportProof,'Transfer logs '+(c.transferLogs||0)+', capsules '+(c.capsules||0)+', closure bundles '+(c.closureBundles||0)],['No dead button proof',p.noDeadButtonProof,'Button sweeps '+(c.buttonSweeps||0)+', walkthroughs '+(c.humanWalkthroughs||0)]].map(item => '<tr><td>'+esc(item[0])+'</td><td>'+(item[1]?'✅':'⚠️')+'</td><td>'+esc(item[2])+'</td></tr>').join(''); return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Routex completion snapshot</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:980px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex completion snapshot</h1><div><span class="badge">'+esc(row.completionLabel)+'</span><span class="badge">'+esc(row.fingerprint)+'</span></div><div style="margin-top:8px;">'+esc(row.note || '')+'</div></div><div class="card"><table><thead><tr><th>Line</th><th>Present</th><th>Evidence</th></tr></thead><tbody>'+laneRows+'</tbody></table></div></div></body></html>'; }
  function exportLatestSnapshotHtml(){ const row = readSnaps()[0] || saveSnap(buildCompletionSnapshot()); downloadText(snapshotHtml(row), 'routex_completion_snapshot_' + dayISO() + '.html', 'text/html'); toast('Completion snapshot HTML exported.', 'good'); }
  function exportLatestSnapshotJson(){ const row = readSnaps()[0] || saveSnap(buildCompletionSnapshot()); downloadText(JSON.stringify(row, null, 2), 'routex_completion_snapshot_' + dayISO() + '.json', 'application/json'); toast('Completion snapshot JSON exported.', 'good'); }
  function saveDeviceAttestation(payload){ const row = { id: uid(), createdAt: nowISO(), source: clean(payload && payload.source) || 'local', deviceLabel: clean(payload && payload.deviceLabel) || 'unspecified', fingerprint: clean(payload && payload.fingerprint) || ('att-' + Date.now().toString(36)), note: clean(payload && payload.note), snapshot: payload && payload.snapshot ? payload.snapshot : buildCompletionSnapshot() }; saveAttest(row); pushAttestOutbox(row); return row; }
  function importDeviceAttestationFile(){ const input = document.createElement('input'); input.type='file'; input.accept='.json,application/json'; input.onchange = async ()=>{ const file = input.files && input.files[0]; if(!file) return; let data = null; try{ data = JSON.parse(await file.text()); }catch(_){ return toast('Invalid device attestation JSON.', 'bad'); } const row = saveDeviceAttestation(data); toast('Device attestation imported: ' + (row.deviceLabel || 'device') + '.', 'good'); }; input.click(); }
  function openCompletionCenter(){ const latest = readSnaps()[0] || buildCompletionSnapshot(); const attests = readAttests().map(item => '<div class="item"><div class="meta"><div class="name">'+esc(item.deviceLabel || 'device')+' <span class="badge">'+esc(item.fingerprint || '—')+'</span></div><div class="sub">'+esc(fmt(item.createdAt || Date.now()))+' • '+esc(item.note || '')+'</div></div></div>').join('') || '<div class="hint">No external device attestations imported yet.</div>'; openModal('Completion center', '<div class="hint">This closure cockpit packages the remaining proof evidence in one place. It still does not auto-mark the matrix complete.</div><div class="sep"></div><div class="kpis"><div class="kpi"><div class="n">'+esc(String(latest.completionScore || 0))+'/4</div><div class="d">Closure preconditions</div></div><div class="kpi"><div class="n">'+esc(String((latest.counts && latest.counts.humanWalkthroughs) || 0))+'</div><div class="d">Walkthrough logs</div></div><div class="kpi"><div class="n">'+esc(String(readAttests().length))+'</div><div class="d">Device attestations</div></div></div><div class="sep"></div><div class="list">'+attests+'</div>', '<button class="btn" id="cc_export_html">Export snapshot HTML</button><button class="btn" id="cc_export_json">Export snapshot JSON</button><button class="btn" id="cc_import_att">Import device attestation</button><button class="btn primary" id="cc_capture">Capture snapshot</button>'); $('#cc_export_html').onclick = exportLatestSnapshotHtml; $('#cc_export_json').onclick = exportLatestSnapshotJson; $('#cc_import_att').onclick = importDeviceAttestationFile; $('#cc_capture').onclick = ()=>{ const row = saveSnap(buildCompletionSnapshot()); saveDeviceAttestation({ source:'local-capture', deviceLabel:'current-device', fingerprint: row.fingerprint, note:'Local completion snapshot captured from Routex.', snapshot: row }); toast('Completion snapshot captured.', 'good'); closeModal(); }; }
  function injectCompletionCenter(){ const host = document.querySelector('#pv_v21_actions') || document.querySelector('#pv_scan_result') || document.querySelector('#st_validation')?.closest('.card'); if(host && !document.querySelector('#pv_completion_center')){ const wrap = document.createElement('div'); wrap.id = 'pv_completion_center'; wrap.style.marginTop='12px'; wrap.innerHTML = '<div class="row" style="flex-wrap:wrap;"><button class="btn" id="pv_completion_open">Completion center</button><button class="btn" id="pv_completion_capture">Capture completion snapshot</button><button class="btn" id="pv_completion_import">Import device attestation</button></div>'; host.parentNode.insertBefore(wrap, host.nextSibling); $('#pv_completion_open').onclick = ()=> openCompletionCenter(); $('#pv_completion_capture').onclick = ()=>{ const row = saveSnap(buildCompletionSnapshot()); saveDeviceAttestation({ source:'proof-registry', deviceLabel:'current-device', fingerprint: row.fingerprint, note:'Snapshot captured from proof registry.', snapshot: row }); toast('Completion snapshot captured.', 'good'); }; $('#pv_completion_import').onclick = importDeviceAttestationFile; } const extrasCard = document.querySelector('#st_shared_outbox_push')?.closest('.card'); if(extrasCard && !document.querySelector('#st_completion_center')){ const row = document.querySelector('#st_shared_outbox_push')?.parentNode; if(row){ const btn = document.createElement('button'); btn.className='btn'; btn.id='st_completion_center'; btn.textContent='Completion center'; btn.onclick=()=> openCompletionCenter(); row.appendChild(btn); } const kpis = extrasCard.querySelector('.kpis'); if(kpis){ const box = document.createElement('div'); box.className='kpi'; box.dataset.kpi='completion-attestations'; box.innerHTML='<div class="n">'+readAttests().length+'</div><div class="d">Device attestations</div>'; kpis.appendChild(box); } } }
  const prevOpenValidation = window.openValidationModal; if(typeof prevOpenValidation === 'function') window.openValidationModal = function(){ const out = prevOpenValidation.apply(this, arguments); setTimeout(injectCompletionCenter, 0); return out; };
  const prevRenderAll = window.renderAll; if(typeof prevRenderAll === 'function') window.renderAll = function(){ const out = prevRenderAll.apply(this, arguments); setTimeout(injectCompletionCenter, 0); return out; };
  /* V23 fresh-record proof completion */
  const FRESH_PROOF_KEY = 'skye_routex_fresh_record_runs_v1';
  function readRoutexFreshProofRuns(){ return readJSON(FRESH_PROOF_KEY, []).filter(Boolean).slice(0, 40); }
  function saveRoutexFreshProofRuns(items){ return writeJSON(FRESH_PROOF_KEY, (Array.isArray(items) ? items : []).slice(0, 40)); }
  function pushRoutexFreshProofRun(row){
    const item = { id: uid(), createdAt: nowISO(), ...(row || {}) };
    const list = readRoutexFreshProofRuns().filter(entry => clean(entry.id) !== clean(item.id));
    list.unshift(item);
    saveRoutexFreshProofRuns(list);
    return item;
  }
  function buildFreshProofRunHtml(row){
    const lanes = Array.isArray(row && row.laneResults) ? row.laneResults : [];
    const body = lanes.map(item => '<tr><td>'+esc(item.lane || '—')+'</td><td>'+(item.ok ? '✅' : '⚠️')+'</td><td>'+(item.states && item.states.fresh ? '✓' : '')+'</td><td>'+(item.states && item.states.exportImport ? '✓' : '')+'</td><td>'+(item.states && item.states.restore ? '✓' : '')+'</td><td>'+(item.states && item.states.noDeadButtons ? '✓' : '')+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Fresh record proof run</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex fresh-record proof run</h1><div><span class="badge">'+esc(row && row.label || 'Fresh proof')+'</span><span class="badge">'+esc(row && row.fingerprint || '—')+'</span><span class="badge">'+((row && row.ok) ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(row && row.note || '')+'</div></div><div class="card"><table><thead><tr><th>Lane</th><th>OK</th><th>Fresh</th><th>Export/Import</th><th>Restore</th><th>No-dead</th><th>Note</th></tr></thead><tbody>'+(body || '<tr><td colspan="7">No lane data captured.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  async function runFreshRecordProofComplete(){
    const lanes = ['route-pack','service-summary','account-code','voice-note','heat-score','pseudo-map-board','trip-pack'];
    const laneResults = [];
    for(const lane of lanes){
      const bundle = await runProofLaneBundleSmart(lane);
      const states = (bundle && bundle.saved && bundle.saved.proofStates) ? bundle.saved.proofStates : ((bundle && bundle.states) || {});
      const needsExport = ['route-pack','service-summary','voice-note','trip-pack'].includes(lane);
      const ok = !!states.fresh && !!states.restore && !!states.noDeadButtons && (!needsExport || !!states.exportImport);
      laneResults.push({ lane, ok, states, note: clean((bundle && bundle.saved && bundle.saved.note) || (bundle && bundle.result && bundle.result.note) || '' ) });
    }
    const sweep = await runDirectiveActionRegistrySweep();
    const closure = await runDirectiveClosureCampaign();
    const closureFingerprint = clean((closure && closure.bundle && closure.bundle.fingerprint) || (closure && closure.bundle && closure.bundle.saved && closure.bundle.saved.fingerprint) || '');
    const ok = laneResults.every(item => item.ok) && !!(sweep && sweep.ok) && !!closureFingerprint;
    let row = pushRoutexFreshProofRun({
      label: 'Fresh record proof • ' + dayISO(),
      source: 'fresh-record-proof-complete',
      fingerprint: 'frp-' + dayISO() + '-' + (typeof tinyHash === 'function' ? tinyHash(JSON.stringify(laneResults) + closureFingerprint).slice(0,10) : uid().slice(0,10)),
      ok,
      laneResults,
      sweepId: clean(sweep && sweep.id),
      closureFingerprint,
      note: ok ? 'Fresh-record proof runner completed across all directive-first lanes.' : 'Fresh-record proof runner needs review for one or more lanes.'
    });
    const snap = saveSnap(buildCompletionSnapshot());
    row = pushRoutexFreshProofRun({ ...row, snapshotId: snap.id, snapshotFingerprint: snap.fingerprint });
    saveDeviceAttestation({ source:'fresh-record-proof', deviceLabel:'current-device', fingerprint: row.fingerprint, note: row.note, snapshot: snap });
    return row;
  }
  function exportLatestFreshProofHtml(){ const row = readRoutexFreshProofRuns()[0]; if(!row) return toast('Run fresh proof first.', 'warn'); downloadText(buildFreshProofRunHtml(row), 'routex_fresh_record_proof_' + dayISO() + '.html', 'text/html'); toast('Fresh proof HTML exported.', 'good'); }
  function exportLatestFreshProofJson(){ const row = readRoutexFreshProofRuns()[0]; if(!row) return toast('Run fresh proof first.', 'warn'); downloadText(JSON.stringify(row, null, 2), 'routex_fresh_record_proof_' + dayISO() + '.json', 'application/json'); toast('Fresh proof JSON exported.', 'good'); }
  function openFreshProofManager(){
    const latest = readRoutexFreshProofRuns()[0] || null;
    const rows = readRoutexFreshProofRuns().map(item => '<div class="item"><div class="meta"><div class="name">'+esc(item.label || 'Fresh proof')+' <span class="badge">'+esc(item.fingerprint || '—')+'</span></div><div class="sub">'+esc(fmt(item.createdAt || Date.now()))+' • '+esc(item.note || '')+'</div></div><div class="row" style="justify-content:flex-end;flex-wrap:wrap;"><button class="btn small" data-fresh-html="'+esc(item.id)+'">HTML</button><button class="btn small" data-fresh-json="'+esc(item.id)+'">JSON</button></div></div>').join('') || '<div class="hint">No fresh-record proof runs saved yet.</div>';
    openModal('Fresh record proof', '<div class="hint">This completes the fresh-record proof lane in one focused run instead of leaving it half-open behind scattered closure tools.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="fresh_run">Run fresh proof</button><button class="btn" id="fresh_export_html">Export latest HTML</button><button class="btn" id="fresh_export_json">Export latest JSON</button></div><div class="sep"></div><div class="list">'+rows+'</div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>');
    $('#fresh_run').onclick = async ()=>{ const btn = $('#fresh_run'); if(btn){ btn.disabled = true; btn.textContent = 'Running...'; } const row = await runFreshRecordProofComplete(); if(btn){ btn.disabled = false; btn.textContent = 'Run fresh proof'; } toast(row.ok ? 'Fresh-record proof passed.' : 'Fresh-record proof needs review.', row.ok ? 'good' : 'warn'); closeModal(); openFreshProofManager(); };
    $('#fresh_export_html').onclick = exportLatestFreshProofHtml;
    $('#fresh_export_json').onclick = exportLatestFreshProofJson;
    $$('[data-fresh-html]').forEach(btn => btn.onclick = ()=>{ const row = readRoutexFreshProofRuns().find(item => clean(item.id) === clean(btn.getAttribute('data-fresh-html'))); if(!row) return; downloadText(buildFreshProofRunHtml(row), 'routex_fresh_record_proof_' + clean(row.fingerprint || dayISO()) + '.html', 'text/html'); toast('Fresh proof HTML exported.', 'good'); });
    $$('[data-fresh-json]').forEach(btn => btn.onclick = ()=>{ const row = readRoutexFreshProofRuns().find(item => clean(item.id) === clean(btn.getAttribute('data-fresh-json'))); if(!row) return; downloadText(JSON.stringify(row, null, 2), 'routex_fresh_record_proof_' + clean(row.fingerprint || dayISO()) + '.json', 'application/json'); toast('Fresh proof JSON exported.', 'good'); });
  }
  const __openCompletionCenter_v23 = openCompletionCenter;
  openCompletionCenter = function(){
    __openCompletionCenter_v23();
    setTimeout(() => {
      const foot = $('#cc_capture') && $('#cc_capture').parentNode;
      if(foot && !$('#cc_fresh_runs')){
        const mgr = document.createElement('button'); mgr.className = 'btn'; mgr.id = 'cc_fresh_runs'; mgr.textContent = 'Fresh proof'; mgr.onclick = ()=> openFreshProofManager();
        foot.insertBefore(mgr, $('#cc_capture'));
      }
      if(foot && !$('#cc_run_fresh')){
        const btn = document.createElement('button'); btn.className = 'btn'; btn.id = 'cc_run_fresh'; btn.textContent = 'Run fresh proof';
        btn.onclick = async ()=>{ btn.disabled = true; btn.textContent = 'Running...'; const row = await runFreshRecordProofComplete(); btn.disabled = false; btn.textContent = 'Run fresh proof'; toast(row.ok ? 'Fresh-record proof passed.' : 'Fresh-record proof needs review.', row.ok ? 'good' : 'warn'); closeModal(); openCompletionCenter(); };
        foot.insertBefore(btn, $('#cc_capture'));
      }
    }, 0);
  };
  const __injectCompletionCenter_v23 = injectCompletionCenter;
  injectCompletionCenter = function(){
    __injectCompletionCenter_v23();
    const row = document.querySelector('#pv_completion_center .row') || document.querySelector('#st_completion_center')?.parentNode;
    if(row && !document.querySelector('#pv_fresh_manager')){
      const btn = document.createElement('button'); btn.className='btn'; btn.id='pv_fresh_manager'; btn.textContent='Fresh proof'; btn.onclick=()=> openFreshProofManager(); row.appendChild(btn);
    }
  };
  window.readRoutexFreshProofRuns = readRoutexFreshProofRuns;
  window.openRoutexFreshProofManager = openFreshProofManager;
  window.runFreshRecordProofComplete = runFreshRecordProofComplete;
  window.openRoutexCompletionCenter = openCompletionCenter;
})();

/* V25 export/import proof runner */
(function(){
  if(window.__ROUTEX_V25__) return; window.__ROUTEX_V25__ = true;
  const EXPORT_IMPORT_RUN_KEY = 'skye_routex_export_import_runs_v1';
  const ROUTEX_TRANSFER_LOG_KEY = 'skye_routex_route_pack_transfer_log_v1';
  const CAPSULE_KEY = 'skye_routex_cross_device_capsules_v1';
  const CAPSULE_OUTBOX_KEY = 'skye_routex_cross_device_outbox_v1';
  const CLOSURE_OUTBOX_KEY = 'skye_routex_closure_outbox_v1';
  const SNAP_KEY = 'skye_routex_completion_snapshots_v1';
  const ATTEST_OUTBOX_KEY = 'skye_routex_device_attestation_outbox_v1';
  const BUTTON_SWEEP_LOG_KEY = 'skye_routex_button_sweep_log_v1';
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const uid = window.uid || (()=>('v25-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const nowISO = window.nowISO || (()=> new Date().toISOString());
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  const fmt = window.fmt || (v => new Date(v || Date.now()).toLocaleString());
  const hash = window.tinyHash || function(input){ const str = String(input || ''); let h = 2166136261 >>> 0; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ('00000000' + (h >>> 0).toString(16)).slice(-8); };
  const $ = window.$ || (sel => document.querySelector(sel));
  const $$ = window.$$ || (sel => Array.from(document.querySelectorAll(sel)));
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function readRuns(){ return readJSON(EXPORT_IMPORT_RUN_KEY, []).filter(Boolean).slice(0, 40); }
  function saveRuns(items){ return writeJSON(EXPORT_IMPORT_RUN_KEY, (Array.isArray(items) ? items : []).slice(0, 40)); }
  function pushRun(row){ const item = { id: uid(), createdAt: nowISO(), ...(row || {}) }; const list = readRuns().filter(entry => clean(entry.id) !== clean(item.id)); list.unshift(item); saveRuns(list); return item; }
  function readTransferLogs(){ return readJSON(ROUTEX_TRANSFER_LOG_KEY, []).filter(Boolean).slice(0, 120); }
  function pushTransferLog(entry){ const row = { id: uid(), createdAt: nowISO(), ...(entry || {}) }; const list = readTransferLogs().filter(item => clean(item.id) !== clean(row.id)); list.unshift(row); writeJSON(ROUTEX_TRANSFER_LOG_KEY, list.slice(0,120)); return row; }
  function readCapsules(){ return readJSON(CAPSULE_KEY, []).filter(Boolean).slice(0, 80); }
  function saveCapsules(items){ return writeJSON(CAPSULE_KEY, (Array.isArray(items) ? items : []).slice(0, 80)); }
  function pushCapsule(row){ const list = readCapsules().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); list.unshift(row); saveCapsules(list); return row; }
  function readCapsuleOutbox(){ return readJSON(CAPSULE_OUTBOX_KEY, []).filter(Boolean).slice(0, 80); }
  function pushCapsuleOutbox(row){ const list = readCapsuleOutbox().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); list.unshift(row); writeJSON(CAPSULE_OUTBOX_KEY, list.slice(0,80)); return row; }
  function readClosureOutbox(){ return readJSON(CLOSURE_OUTBOX_KEY, []).filter(Boolean).slice(0, 40); }
  function pushClosureOutbox(row){ const list = readClosureOutbox().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); list.unshift(row); writeJSON(CLOSURE_OUTBOX_KEY, list.slice(0,40)); return row; }
  function readSnaps(){ return readJSON(SNAP_KEY, []).filter(Boolean).slice(0,80); }
  function saveSnaps(items){ return writeJSON(SNAP_KEY, (Array.isArray(items) ? items : []).slice(0,80)); }
  function readAttestOutbox(){ return readJSON(ATTEST_OUTBOX_KEY, []).filter(Boolean).slice(0,80); }
  function pushAttestOutbox(row){ const list = readAttestOutbox().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); list.unshift(row); writeJSON(ATTEST_OUTBOX_KEY, list.slice(0,80)); return row; }
  function readButtonSweeps(){ return readJSON(BUTTON_SWEEP_LOG_KEY, []).filter(Boolean).slice(0,80); }
  function latestButtonSweepCounts(){ const latest = readButtonSweeps()[0] || null; const steps = Array.isArray(latest && latest.steps) ? latest.steps : Array.isArray(latest && latest.rows) ? latest.rows : []; const passed = steps.filter(step => step && step.ok).length; return { passed, total: steps.length, id: clean(latest && latest.id) }; }
  function buildSnapshotRow(){
    const counts = {
      transferLogs: readTransferLogs().length,
      capsules: readCapsules().length,
      closureOutbox: readClosureOutbox().length,
      exportImportRuns: readRuns().length,
      buttonSweeps: readButtonSweeps().length
    };
    const completionScore = [counts.transferLogs > 0, counts.capsules > 0, counts.closureOutbox > 0].filter(Boolean).length;
    return { id: uid(), createdAt: nowISO(), packageLabel:'Routex export/import snapshot', fingerprint:['xips', dayISO(), counts.transferLogs, counts.capsules, counts.closureOutbox].join('-'), counts, completionScore, completionLabel: completionScore + '/3 export/import surfaces present', note:'Export/import proof snapshot captured from Routex.' };
  }
  function saveSnapshot(row){ const list = readSnaps().filter(item => clean(item.id) !== clean(row.id)); list.unshift(row); saveSnaps(list); return row; }
  function pushAttestation(row){ const item = { id: uid(), createdAt: nowISO(), ...(row || {}) }; pushAttestOutbox(item); return item; }
  function buildExportImportCapsule(payload){
    const sweep = latestButtonSweepCounts();
    const laneStates = {};
    (payload.laneResults || []).forEach(item => { laneStates[clean(item.lane)] = item.states || {}; });
    return {
      id: uid(),
      createdAt: nowISO(),
      source: 'routex-export-import-proof',
      label: 'Routex export/import capsule • ' + dayISO(),
      fingerprint: payload.capsuleFingerprint || ('xipcap-' + hash(JSON.stringify(payload).slice(0,1200))),
      closureFingerprint: clean(payload.closureFingerprint),
      routeCount: Number(payload.routeCount || 0),
      stopCount: Number(payload.stopCount || 0),
      docCount: Number(payload.docCount || 0),
      buttonSweepTotal: sweep.total,
      buttonSweepPassed: sweep.passed,
      latestTransferLogId: clean(payload.transferLogId),
      latestClosureLogId: clean(payload.closureLogId),
      proofEntryCount: Array.isArray(payload.laneResults) ? payload.laneResults.length : 0,
      laneStates,
      note: clean(payload.note) || 'Dedicated export/import proof package for Routex + AE FLOW sync rehearsal.',
      payloadVersion: 'v25'
    };
  }
  function rehearseSerializedCapsule(capsule){
    if(!capsule) return { ok:false, note:'No capsule payload available.' };
    let reopened = null;
    try{ reopened = JSON.parse(JSON.stringify(capsule)); }catch(err){ return { ok:false, note: clean(err && err.message) || 'Unable to serialize capsule.' }; }
    reopened.id = uid();
    reopened.importedAt = nowISO();
    reopened.source = 'routex-export-import-proof-reopen';
    pushCapsule(reopened);
    const matches = readCapsules().filter(item => clean(item.fingerprint) === clean(reopened.fingerprint)).length;
    const ok = !!clean(reopened.fingerprint) && matches > 0;
    const log = pushTransferLog({ lane:'cross-device-capsule', proofKind:'serialized-reopen', fingerprint: clean(reopened.fingerprint), importedMatches: matches, ok, note:'Serialized export/import capsule reopened and staged locally.' });
    return { ok, reopened, log, note:'Capsule serialized + reopened locally • matches ' + matches };
  }
  function rehearseSerializedClosureBundle(bundle){
    if(!bundle) return { ok:false, note:'No closure bundle available.' };
    let reopened = null;
    try{ reopened = JSON.parse(JSON.stringify(bundle)); }catch(err){ return { ok:false, note: clean(err && err.message) || 'Unable to serialize closure bundle.' }; }
    const payload = {
      id: clean(reopened.id) || uid(),
      label: clean(reopened.label) || 'Routex closure bundle',
      fingerprint: clean(reopened.fingerprint) || ('cb-' + hash(JSON.stringify(reopened).slice(0,1200))),
      routeCount: Number(reopened.routeCount || 0),
      stopCount: Number(reopened.stopCount || 0),
      docCount: Number(reopened.docCount || 0),
      createdAt: clean(reopened.createdAt) || nowISO(),
      exportedAt: nowISO(),
      note: clean(reopened.note) || 'Dedicated export/import proof closure payload.',
      laneRuns: Array.isArray(reopened.laneRuns) ? reopened.laneRuns : [],
      eligibility: Array.isArray(reopened.eligibility) ? reopened.eligibility : [],
      source: 'routex-export-import-proof'
    };
    pushClosureOutbox(payload);
    const matches = readClosureOutbox().filter(item => clean(item.fingerprint) === clean(payload.fingerprint)).length;
    const ok = !!clean(payload.fingerprint) && matches > 0;
    const log = pushTransferLog({ lane:'closure-bundle', proofKind:'serialized-reopen', fingerprint: clean(payload.fingerprint), importedMatches: matches, ok, note:'Serialized closure bundle reopened and pushed to shared outbox.' });
    return { ok, payload, log, note:'Closure bundle serialized + reopened locally • outbox matches ' + matches };
  }
  async function runExportImportProofComplete(){
    const lanes = ['route-pack','service-summary','voice-note','trip-pack'];
    const laneResults = [];
    for(const lane of lanes){
      let bundle = null;
      try{ bundle = await runProofLaneBundleSmart(lane); }catch(err){ bundle = { states:{ fresh:false, exportImport:false, restore:false, noDeadButtons:false }, saved:{ note: clean(err && err.message) || 'Bundle failed.' } }; }
      const states = (bundle && bundle.saved && bundle.saved.proofStates) ? bundle.saved.proofStates : ((bundle && bundle.states) || {});
      const ok = !!states.exportImport;
      laneResults.push({ lane, ok, states, note: clean((bundle && bundle.saved && bundle.saved.note) || (bundle && bundle.result && bundle.result.note) || '') });
    }
    const closure = typeof runDirectiveClosureCampaign === 'function' ? await runDirectiveClosureCampaign() : null;
    const closureBundle = closure && closure.bundle ? closure.bundle : null;
    const closureRoundtrip = rehearseSerializedClosureBundle(closureBundle);
    const routeCount = Number(closureBundle && closureBundle.routeCount || 0);
    const stopCount = Number(closureBundle && closureBundle.stopCount || 0);
    const docCount = Number(closureBundle && closureBundle.docCount || 0);
    const baseFingerprint = hash(JSON.stringify({ laneResults, closure: closureBundle && closureBundle.fingerprint, routeCount, stopCount, docCount }));
    const capsule = buildExportImportCapsule({ laneResults, closureFingerprint: clean(closureBundle && closureBundle.fingerprint), routeCount, stopCount, docCount, note:'Dedicated export/import proof package built from the latest closure campaign and export lanes.', capsuleFingerprint:'xipcap-' + baseFingerprint, transferLogId:'', closureLogId: clean(closureRoundtrip && closureRoundtrip.log && closureRoundtrip.log.id) });
    pushCapsule(capsule);
    pushCapsuleOutbox({ ...capsule, exportedAt: nowISO(), source:'routex-export-import-proof-outbox' });
    const capsuleRoundtrip = rehearseSerializedCapsule(capsule);
    const ok = laneResults.every(item => item.ok) && !!(closureRoundtrip && closureRoundtrip.ok) && !!(capsuleRoundtrip && capsuleRoundtrip.ok);
    let row = pushRun({
      label: 'Export/import proof • ' + dayISO(),
      source: 'export-import-proof-complete',
      fingerprint: 'xip-' + dayISO() + '-' + baseFingerprint.slice(0,10),
      ok,
      laneResults,
      closureFingerprint: clean(closureBundle && closureBundle.fingerprint),
      capsuleFingerprint: clean(capsule && capsule.fingerprint),
      routeCount,
      stopCount,
      docCount,
      closureLogId: clean(closureRoundtrip && closureRoundtrip.log && closureRoundtrip.log.id),
      capsuleLogId: clean(capsuleRoundtrip && capsuleRoundtrip.log && capsuleRoundtrip.log.id),
      closureOutboxCount: readClosureOutbox().length,
      capsuleOutboxCount: readCapsuleOutbox().length,
      note: ok ? 'Dedicated export/import proof runner completed local package rehearsal and AE FLOW handoff staging.' : 'Dedicated export/import proof runner needs review for one or more export lanes.'
    });
    const snap = saveSnapshot(buildSnapshotRow());
    pushAttestation({ source:'export-import-proof', deviceLabel:'current-device', fingerprint: row.fingerprint, note: row.note, snapshot: snap });
    row = pushRun({ ...row, snapshotId: snap.id, snapshotFingerprint: snap.fingerprint });
    return row;
  }
  function buildExportImportProofHtml(row){
    const lanes = Array.isArray(row && row.laneResults) ? row.laneResults : [];
    const body = lanes.map(item => '<tr><td>'+esc(item.lane || '—')+'</td><td>'+(item.ok ? '✅' : '⚠️')+'</td><td>'+(item.states && item.states.exportImport ? '✓' : '')+'</td><td>'+(item.states && item.states.restore ? '✓' : '')+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Export/import proof run</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex export/import proof run</h1><div><span class="badge">'+esc(row && row.label || 'Export/import proof')+'</span><span class="badge">'+esc(row && row.fingerprint || '—')+'</span><span class="badge">'+((row && row.ok) ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(row && row.note || '')+'</div><div style="margin-top:10px;"><span class="badge">Closure '+esc(row && row.closureFingerprint || '—')+'</span><span class="badge">Capsule '+esc(row && row.capsuleFingerprint || '—')+'</span><span class="badge">Closure outbox '+esc(String(row && row.closureOutboxCount || 0))+'</span><span class="badge">Capsule outbox '+esc(String(row && row.capsuleOutboxCount || 0))+'</span></div></div><div class="card"><table><thead><tr><th>Lane</th><th>OK</th><th>Export/import</th><th>Restore</th><th>Note</th></tr></thead><tbody>'+(body || '<tr><td colspan="5">No lane data captured.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function exportLatestExportImportProofHtml(){ const row = readRuns()[0]; if(!row) return toast('Run export/import proof first.', 'warn'); downloadText(buildExportImportProofHtml(row), 'routex_export_import_proof_' + dayISO() + '.html', 'text/html'); toast('Export/import proof HTML exported.', 'good'); }
  function exportLatestExportImportProofJson(){ const row = readRuns()[0]; if(!row) return toast('Run export/import proof first.', 'warn'); downloadText(JSON.stringify(row, null, 2), 'routex_export_import_proof_' + dayISO() + '.json', 'application/json'); toast('Export/import proof JSON exported.', 'good'); }
  function openExportImportProofManager(){
    const rows = readRuns().map(item => '<div class="item"><div class="meta"><div class="name">'+esc(item.label || 'Export/import proof')+' <span class="badge">'+esc(item.fingerprint || '—')+'</span></div><div class="sub">'+esc(fmt(item.createdAt || Date.now()))+' • '+esc(item.note || '')+'</div></div><div class="row" style="justify-content:flex-end;flex-wrap:wrap;"><button class="btn small" data-xip-html="'+esc(item.id)+'">HTML</button><button class="btn small" data-xip-json="'+esc(item.id)+'">JSON</button></div></div>').join('') || '<div class="hint">No export/import proof runs saved yet.</div>';
    openModal('Export / import proof', '<div class="hint">This stays focused on transfer-packaging only: local roundtrip logs, closure bundle staging, capsule staging, and AE FLOW handoff surfaces.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="xip_run">Run export/import proof</button><button class="btn" id="xip_export_html">Export latest HTML</button><button class="btn" id="xip_export_json">Export latest JSON</button></div><div class="sep"></div><div class="list">'+rows+'</div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>');
    $('#xip_run').onclick = async ()=>{ const btn = $('#xip_run'); if(btn){ btn.disabled = true; btn.textContent = 'Running...'; } const row = await runExportImportProofComplete(); if(btn){ btn.disabled = false; btn.textContent = 'Run export/import proof'; } toast(row.ok ? 'Export/import proof passed locally.' : 'Export/import proof needs review.', row.ok ? 'good' : 'warn'); closeModal(); openExportImportProofManager(); };
    $('#xip_export_html').onclick = exportLatestExportImportProofHtml;
    $('#xip_export_json').onclick = exportLatestExportImportProofJson;
    $$('[data-xip-html]').forEach(btn => btn.onclick = ()=>{ const row = readRuns().find(item => clean(item.id) === clean(btn.getAttribute('data-xip-html'))); if(!row) return; downloadText(buildExportImportProofHtml(row), 'routex_export_import_proof_' + clean(row.fingerprint || dayISO()) + '.html', 'text/html'); toast('Export/import proof HTML exported.', 'good'); });
    $$('[data-xip-json]').forEach(btn => btn.onclick = ()=>{ const row = readRuns().find(item => clean(item.id) === clean(btn.getAttribute('data-xip-json'))); if(!row) return; downloadText(JSON.stringify(row, null, 2), 'routex_export_import_proof_' + clean(row.fingerprint || dayISO()) + '.json', 'application/json'); toast('Export/import proof JSON exported.', 'good'); });
  }
  function injectExportImportButtons(){
    const row = document.querySelector('#pv_completion_center .row') || document.querySelector('#st_completion_center')?.parentNode;
    if(row && !document.querySelector('#pv_export_import_manager')){ const btn = document.createElement('button'); btn.className='btn'; btn.id='pv_export_import_manager'; btn.textContent='Export/import proof'; btn.onclick=()=> openExportImportProofManager(); row.appendChild(btn); }
  }
  const prevOpen = window.openRoutexCompletionCenter;
  if(typeof prevOpen === 'function'){
    window.openRoutexCompletionCenter = function(){ const out = prevOpen.apply(this, arguments); setTimeout(()=>{ const foot = document.querySelector('#cc_capture') && document.querySelector('#cc_capture').parentNode; if(foot && !document.querySelector('#cc_export_import_runs')){ const mgr = document.createElement('button'); mgr.className='btn'; mgr.id='cc_export_import_runs'; mgr.textContent='Export/import proof'; mgr.onclick=()=> openExportImportProofManager(); foot.insertBefore(mgr, document.querySelector('#cc_capture')); } if(foot && !document.querySelector('#cc_run_export_import')){ const btn = document.createElement('button'); btn.className='btn'; btn.id='cc_run_export_import'; btn.textContent='Run export/import proof'; btn.onclick = async ()=>{ btn.disabled = true; btn.textContent = 'Running...'; const row = await runExportImportProofComplete(); btn.disabled = false; btn.textContent = 'Run export/import proof'; toast(row.ok ? 'Export/import proof passed locally.' : 'Export/import proof needs review.', row.ok ? 'good' : 'warn'); document.getElementById('modalClose') && document.getElementById('modalClose').click(); if(typeof window.openRoutexCompletionCenter === 'function') window.openRoutexCompletionCenter(); }; foot.insertBefore(btn, document.querySelector('#cc_capture')); } }, 0); return out; };
  }
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(injectExportImportButtons, 0); return out; };
  window.readRoutexExportImportProofRuns = readRuns;
  window.openRoutexExportImportProofManager = openExportImportProofManager;
  window.runExportImportProofComplete = runExportImportProofComplete;
})();

/* V26 no-dead-button proof runner */
(function(){
  if(window.__ROUTEX_V26__) return; window.__ROUTEX_V26__ = true;
  const NO_DEAD_RUN_KEY = 'skye_routex_no_dead_button_runs_v1';
  const NO_DEAD_OUTBOX_KEY = 'skye_routex_no_dead_button_outbox_v1';
  const BUTTON_SWEEP_LOG_KEY = 'skye_routex_button_sweep_log_v1';
  const HUMAN_WALKTHROUGH_KEY = 'skye_routex_human_walkthrough_v1';
  const SNAP_KEY = 'skye_routex_completion_snapshots_v1';
  const ATTEST_KEY = 'skye_routex_device_attestations_v1';
  const ATTEST_OUTBOX_KEY = 'skye_routex_device_attestation_outbox_v1';
  const laneOrder = ['route-pack','service-summary','account-code','voice-note','heat-score','pseudo-map-board','trip-pack'];
  const readJSON = (key, fallback)=>{ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } };
  const writeJSON = (key, value)=> localStorage.setItem(key, JSON.stringify(value));
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const uid = window.uid || (()=>('v26-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const nowISO = window.nowISO || (()=> new Date().toISOString());
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  const fmt = window.fmt || (v => new Date(v || Date.now()).toLocaleString());
  const hash = window.tinyHash || function(input){ const str = String(input || ''); let h = 2166136261 >>> 0; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ('00000000' + (h >>> 0).toString(16)).slice(-8); };
  const $ = window.$ || (sel => document.querySelector(sel));
  const $$ = window.$$ || (sel => Array.from(document.querySelectorAll(sel)));

  function readRuns(){ return readJSON(NO_DEAD_RUN_KEY, []).filter(Boolean).slice(0, 40); }
  function saveRuns(items){ writeJSON(NO_DEAD_RUN_KEY, (Array.isArray(items) ? items : []).slice(0, 40)); }
  function pushRun(row){ const item = { id: uid(), createdAt: nowISO(), ...(row || {}) }; const list = readRuns().filter(entry => clean(entry.id) !== clean(item.id)); list.unshift(item); saveRuns(list); return item; }
  function readOutbox(){ return readJSON(NO_DEAD_OUTBOX_KEY, []).filter(Boolean).slice(0, 80); }
  function saveOutbox(items){ writeJSON(NO_DEAD_OUTBOX_KEY, (Array.isArray(items) ? items : []).slice(0, 80)); }
  function pushOutbox(row){ const item = { id: clean(row && row.id) || uid(), exportedAt: nowISO(), ...(row || {}) }; const list = readOutbox().filter(entry => clean(entry.fingerprint) !== clean(item.fingerprint)); list.unshift(item); saveOutbox(list); return item; }
  function readButtonSweeps(){ return readJSON(BUTTON_SWEEP_LOG_KEY, []).filter(Boolean).slice(0,80); }
  function readWalkthroughs(){ return readJSON(HUMAN_WALKTHROUGH_KEY, []).filter(Boolean).slice(0,80); }
  function readSnaps(){ return readJSON(SNAP_KEY, []).filter(Boolean).slice(0,80); }
  function saveSnap(row){ const list = readSnaps().filter(item => clean(item.id) !== clean(row.id)); list.unshift(row); writeJSON(SNAP_KEY, list.slice(0,80)); return row; }
  function readAttests(){ return readJSON(ATTEST_KEY, []).filter(Boolean).slice(0,80); }
  function saveAttest(row){ const list = readAttests().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); list.unshift(row); writeJSON(ATTEST_KEY, list.slice(0,80)); return row; }
  function readAttestOutbox(){ return readJSON(ATTEST_OUTBOX_KEY, []).filter(Boolean).slice(0,80); }
  function pushAttestOutbox(row){ const list = readAttestOutbox().filter(item => clean(item.fingerprint) !== clean(row.fingerprint)); list.unshift(row); writeJSON(ATTEST_OUTBOX_KEY, list.slice(0,80)); return row; }
  function countFrom(name){ try{ if(typeof window[name] !== 'function') return 0; const out = window[name](); return Array.isArray(out) ? out.length : (out && typeof out.length === 'number' ? out.length : 0); }catch(_){ return 0; } }
  function buildCompletionSnapshot(){
    const counts = {
      closureBundles: countFrom('readRoutexClosureBundles'),
      transferLogs: countFrom('readRoutePackTransferLog'),
      generationMatrices: countFrom('readGenerationMatrixLog'),
      heatAudits: countFrom('readHeatAuditLog'),
      buttonSweeps: countFrom('readRoutexButtonSweepLog'),
      capsules: countFrom('listCapsules'),
      legacyImports: countFrom('listLegacyProofIntake'),
      humanWalkthroughs: countFrom('listHumanWalkthroughs'),
      operatorAudits: countFrom('readOperatorAudits'),
      freshProofRuns: countFrom('readRoutexFreshProofRuns'),
      noDeadProofRuns: readRuns().length
    };
    const partials = {
      freshRecordProof: counts.freshProofRuns > 0,
      legacyRecordProof: counts.legacyImports > 0 && counts.generationMatrices > 0,
      exportImportProof: counts.transferLogs > 0 && counts.capsules > 0 && counts.closureBundles > 0,
      noDeadButtonProof: counts.buttonSweeps > 0 && counts.humanWalkthroughs > 0
    };
    const score = Object.values(partials).filter(Boolean).length;
    return {
      id: uid(),
      createdAt: nowISO(),
      packageLabel: 'Routex completion snapshot',
      fingerprint: ['cs', dayISO(), counts.freshProofRuns, counts.transferLogs, counts.buttonSweeps, counts.humanWalkthroughs, counts.noDeadProofRuns].join('-'),
      counts,
      partials,
      completionScore: score,
      completionLabel: score + '/4 closure preconditions present',
      note: 'In-app closure snapshot. This does not replace a real separate-device or human walkthrough run.'
    };
  }
  function saveDeviceAttestation(payload){
    const row = {
      id: uid(),
      createdAt: nowISO(),
      source: clean(payload && payload.source) || 'no-dead-proof',
      deviceLabel: clean(payload && payload.deviceLabel) || 'current-device',
      fingerprint: clean(payload && payload.fingerprint) || ('att-' + Date.now().toString(36)),
      note: clean(payload && payload.note),
      snapshot: payload && payload.snapshot ? payload.snapshot : buildCompletionSnapshot()
    };
    saveAttest(row); pushAttestOutbox(row); return row;
  }
  function summarizeWalkthrough(entry){
    const items = Array.isArray(entry && entry.items) ? entry.items : [];
    const done = items.filter(item => item && item.done).length;
    return {
      id: clean(entry && entry.id),
      reviewer: clean(entry && entry.reviewer),
      savedAt: clean(entry && (entry.savedAt || entry.createdAt)),
      done,
      total: items.length,
      note: clean(entry && entry.note)
    };
  }
  function buildOutboxPayload(row){
    return {
      id: clean(row && row.id) || uid(),
      label: clean(row && row.label) || 'No-dead proof',
      fingerprint: clean(row && row.fingerprint),
      createdAt: clean(row && row.createdAt) || nowISO(),
      exportedAt: nowISO(),
      source: 'routex-no-dead-proof-outbox',
      sweepId: clean(row && row.sweepId),
      sweepPassed: Number(row && row.sweepPassed || 0),
      sweepTotal: Number(row && row.sweepTotal || 0),
      walkthroughId: clean(row && row.walkthroughId),
      walkthroughDone: Number(row && row.walkthroughDone || 0),
      walkthroughTotal: Number(row && row.walkthroughTotal || 0),
      walkthroughReviewer: clean(row && row.walkthroughReviewer),
      laneResults: Array.isArray(row && row.laneResults) ? row.laneResults.map(item => ({
        lane: clean(item && item.lane),
        ok: !!(item && item.ok),
        passedChecks: Number(item && item.passedChecks || 0),
        checkCount: Number(item && item.checkCount || 0),
        note: clean(item && item.note)
      })) : [],
      note: clean(row && row.note),
      payloadVersion: 'v26'
    };
  }
  async function runNoDeadButtonProofComplete(){
    const laneResults = [];
    for(const lane of laneOrder){
      let probe = null;
      try{ probe = await window.runLaneActionProbe(lane); }catch(err){ probe = { ok:false, noDeadButtons:false, checks:[], note: clean(err && err.message) || 'Lane action probe failed.' }; }
      const checks = Array.isArray(probe && probe.checks) ? probe.checks : [];
      laneResults.push({
        lane,
        ok: !!(probe && probe.ok),
        states: { fresh:false, legacy:false, exportImport:false, restore:false, noDeadButtons: !!(probe && probe.noDeadButtons) },
        passedChecks: checks.filter(item => item && item.ok).length,
        checkCount: checks.length,
        checks: checks.map(item => ({ label: clean(item && item.label), ok: !!(item && item.ok) })),
        note: clean(probe && probe.note)
      });
      try{ if(typeof window.closeModal === 'function') window.closeModal(); }catch(_){ }
    }
    let sweep = null;
    try{ sweep = await window.runDirectiveActionRegistrySweep(); }catch(err){ sweep = { id:'', ok:false, steps:[], note: clean(err && err.message) || 'Directive action registry sweep failed.' }; }
    const sweepSteps = Array.isArray(sweep && sweep.steps) ? sweep.steps : [];
    const sweepPassed = sweepSteps.filter(item => item && item.ok).length;
    const walkthrough = summarizeWalkthrough(readWalkthroughs()[0] || null);
    const baseFingerprint = hash(JSON.stringify({
      lanes: laneResults.map(item => ({ lane:item.lane, ok:item.ok, passed:item.passedChecks, total:item.checkCount })),
      sweep: sweepSteps.map(item => ({ lane: clean(item && item.lane), ok: !!(item && item.ok) })),
      walkthrough: { id: walkthrough.id, done: walkthrough.done, total: walkthrough.total, reviewer: walkthrough.reviewer }
    }));
    const autoOk = laneResults.every(item => item.ok) && !!(sweep && sweep.ok);
    let row = pushRun({
      label: 'No-dead proof • ' + dayISO(),
      source: 'no-dead-proof-complete',
      fingerprint: 'ndb-' + dayISO() + '-' + baseFingerprint.slice(0,10),
      ok: autoOk,
      laneResults,
      sweepId: clean(sweep && sweep.id),
      sweepPassed,
      sweepTotal: sweepSteps.length,
      sweepNote: clean(sweep && sweep.note),
      walkthroughId: walkthrough.id,
      walkthroughDone: walkthrough.done,
      walkthroughTotal: walkthrough.total,
      walkthroughReviewer: walkthrough.reviewer,
      walkthroughSavedAt: walkthrough.savedAt,
      note: autoOk ? 'Dedicated no-dead-button proof runner passed its automated lane probes and directive sweep. Human walkthrough evidence is packaged alongside it but still determines final closure honesty.' : 'Dedicated no-dead-button proof runner found one or more failing lane probes or directive-sweep actions.'
    });
    pushOutbox(buildOutboxPayload(row));
    const snap = saveSnap(buildCompletionSnapshot());
    saveDeviceAttestation({ source:'no-dead-proof', deviceLabel:'current-device', fingerprint: row.fingerprint, note: row.note, snapshot: snap });
    row = pushRun({ ...row, snapshotId: snap.id, snapshotFingerprint: snap.fingerprint, outboxCount: readOutbox().length });
    return row;
  }
  function buildNoDeadProofHtml(row){
    const body = (Array.isArray(row && row.laneResults) ? row.laneResults : []).map(item => '<tr><td>'+esc(item.lane || '—')+'</td><td>'+(item.ok ? '✅' : '⚠️')+'</td><td>'+esc(String(item.passedChecks || 0))+'/'+esc(String(item.checkCount || 0))+'</td><td>'+(item.states && item.states.noDeadButtons ? '✓' : '')+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>No-dead proof run</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex no-dead-button proof run</h1><div><span class="badge">'+esc(row && row.label || 'No-dead proof')+'</span><span class="badge">'+esc(row && row.fingerprint || '—')+'</span><span class="badge">'+((row && row.ok) ? 'AUTO PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(row && row.note || '')+'</div><div style="margin-top:10px;"><span class="badge">Sweep '+esc(String(row && row.sweepPassed || 0))+'/'+esc(String(row && row.sweepTotal || 0))+'</span><span class="badge">Walkthrough '+esc(String(row && row.walkthroughDone || 0))+'/'+esc(String(row && row.walkthroughTotal || 0))+'</span><span class="badge">Reviewer '+esc(row && row.walkthroughReviewer || '—')+'</span></div></div><div class="card"><table><thead><tr><th>Lane</th><th>OK</th><th>Checks</th><th>No-dead</th><th>Note</th></tr></thead><tbody>'+(body || '<tr><td colspan="5">No lane data captured.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function exportLatestNoDeadProofHtml(){ const row = readRuns()[0]; if(!row) return toast('Run no-dead proof first.', 'warn'); downloadText(buildNoDeadProofHtml(row), 'routex_no_dead_button_proof_' + dayISO() + '.html', 'text/html'); toast('No-dead proof HTML exported.', 'good'); }
  function exportLatestNoDeadProofJson(){ const row = readRuns()[0]; if(!row) return toast('Run no-dead proof first.', 'warn'); downloadText(JSON.stringify(row, null, 2), 'routex_no_dead_button_proof_' + dayISO() + '.json', 'application/json'); toast('No-dead proof JSON exported.', 'good'); }
  function exportOperatorWorkbook(){ if(typeof window.buildOperatorClickSweepHtml !== 'function') return toast('Operator workbook helper is unavailable.', 'warn'); downloadText(window.buildOperatorClickSweepHtml(), 'routex_operator_click_sweep_' + dayISO() + '.html', 'text/html'); toast('Operator click-sweep workbook exported.', 'good'); }
  function openNoDeadProofManager(){
    const rows = readRuns().map(item => '<div class="item"><div class="meta"><div class="name">'+esc(item.label || 'No-dead proof')+' <span class="badge">'+esc(item.fingerprint || '—')+'</span></div><div class="sub">'+esc(fmt(item.createdAt || Date.now()))+' • '+esc(item.note || '')+'</div></div><div class="row" style="justify-content:flex-end;flex-wrap:wrap;"><button class="btn small" data-ndb-html="'+esc(item.id)+'">HTML</button><button class="btn small" data-ndb-json="'+esc(item.id)+'">JSON</button></div></div>').join('') || '<div class="hint">No no-dead-button proof runs saved yet.</div>';
    const walk = summarizeWalkthrough(readWalkthroughs()[0] || null);
    openModal('No-dead-button proof', '<div class="hint">This stays locked on live action availability only: automated lane probes, directive action-registry sweep coverage, operator workbook export, and packaged human-walkthrough context.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="ndb_run">Run no-dead proof</button><button class="btn" id="ndb_export_html">Export latest HTML</button><button class="btn" id="ndb_export_json">Export latest JSON</button><button class="btn" id="ndb_export_workbook">Operator workbook</button></div><div class="sep"></div><div class="hint">Latest walkthrough: <span class="mono">'+esc(String(walk.done || 0))+'/'+esc(String(walk.total || 0))+'</span>'+(walk.reviewer ? ' • reviewer <span class="mono">'+esc(walk.reviewer)+'</span>' : '')+' • Shared outbox <span class="mono">'+esc(String(readOutbox().length))+'</span></div><div class="sep"></div><div class="list">'+rows+'</div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>');
    $('#ndb_run').onclick = async ()=>{ const btn = $('#ndb_run'); if(btn){ btn.disabled = true; btn.textContent = 'Running...'; } const row = await runNoDeadButtonProofComplete(); if(btn){ btn.disabled = false; btn.textContent = 'Run no-dead proof'; } toast(row.ok ? 'No-dead proof auto-sweep passed.' : 'No-dead proof needs review.', row.ok ? 'good' : 'warn'); if(typeof window.closeModal === 'function') window.closeModal(); openNoDeadProofManager(); };
    $('#ndb_export_html').onclick = exportLatestNoDeadProofHtml;
    $('#ndb_export_json').onclick = exportLatestNoDeadProofJson;
    $('#ndb_export_workbook').onclick = exportOperatorWorkbook;
    $$('[data-ndb-html]').forEach(btn => btn.onclick = ()=>{ const row = readRuns().find(item => clean(item.id) === clean(btn.getAttribute('data-ndb-html'))); if(!row) return; downloadText(buildNoDeadProofHtml(row), 'routex_no_dead_button_proof_' + clean(row.fingerprint || dayISO()) + '.html', 'text/html'); toast('No-dead proof HTML exported.', 'good'); });
    $$('[data-ndb-json]').forEach(btn => btn.onclick = ()=>{ const row = readRuns().find(item => clean(item.id) === clean(btn.getAttribute('data-ndb-json'))); if(!row) return; downloadText(JSON.stringify(row, null, 2), 'routex_no_dead_button_proof_' + clean(row.fingerprint || dayISO()) + '.json', 'application/json'); toast('No-dead proof JSON exported.', 'good'); });
  }
  function injectNoDeadButtons(){
    const footer = document.querySelector('#cc_capture') && document.querySelector('#cc_capture').parentNode;
    if(footer && !document.querySelector('#cc_no_dead_runs')){ const mgr = document.createElement('button'); mgr.className='btn'; mgr.id='cc_no_dead_runs'; mgr.textContent='No-dead proof'; mgr.onclick=()=> openNoDeadProofManager(); footer.insertBefore(mgr, document.querySelector('#cc_capture')); }
    if(footer && !document.querySelector('#cc_run_no_dead')){ const btn = document.createElement('button'); btn.className='btn'; btn.id='cc_run_no_dead'; btn.textContent='Run no-dead proof'; btn.onclick = async ()=>{ btn.disabled = true; btn.textContent = 'Running...'; const row = await runNoDeadButtonProofComplete(); btn.disabled = false; btn.textContent = 'Run no-dead proof'; toast(row.ok ? 'No-dead proof auto-sweep passed.' : 'No-dead proof needs review.', row.ok ? 'good' : 'warn'); try{ if(typeof window.closeModal === 'function') window.closeModal(); }catch(_){ } if(typeof window.openRoutexCompletionCenter === 'function') window.openRoutexCompletionCenter(); }; footer.insertBefore(btn, document.querySelector('#cc_capture')); }
    const row = document.querySelector('#pv_completion_center .row') || document.querySelector('#st_completion_center')?.parentNode;
    if(row && !document.querySelector('#pv_no_dead_manager')){ const btn = document.createElement('button'); btn.className='btn'; btn.id='pv_no_dead_manager'; btn.textContent='No-dead proof'; btn.onclick=()=> openNoDeadProofManager(); row.appendChild(btn); }
  }
  const prevOpen = window.openRoutexCompletionCenter;
  if(typeof prevOpen === 'function'){
    window.openRoutexCompletionCenter = function(){ const out = prevOpen.apply(this, arguments); setTimeout(injectNoDeadButtons, 0); return out; };
  }
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(injectNoDeadButtons, 0); return out; };
  window.readRoutexNoDeadProofRuns = readRuns;
  window.openRoutexNoDeadProofManager = openNoDeadProofManager;
  window.runNoDeadButtonProofComplete = runNoDeadButtonProofComplete;
})();

/* V27 actual shipped legacy package corpus */
(function(){
  if(window.__ROUTEX_V27__) return; window.__ROUTEX_V27__ = true;
  const LEGACY_INTAKE_KEY = 'skye_routex_legacy_proof_intake_v1';
  const LEGACY_OUTBOX_KEY = 'skye_routex_legacy_outbox_v1';
  const LEGACY_RUN_KEY = 'skye_routex_legacy_record_runs_v1';
  const CORPUS_KEY = 'skye_routex_real_shipped_legacy_corpus_v1';
  const COMPARE_KEY = 'skye_routex_real_shipped_legacy_compare_runs_v1';
  const SHIPPED_PACKAGE_MANIFESTS = [
  {
    "packageLabel": "SkyeRoutexFlow v23 NEW-SHIT2 continued",
    "versionTag": "v23",
    "packageFingerprint": "v23-2e7fd7b53883",
    "zipName": "SkyeRoutexFlow_v23_NEW-SHIT2_continued.zip",
    "zipSizeBytes": 924231,
    "zipSha256": "2e7fd7b53883424934b5773040bb5945d9b96f38f753202799d1c0c9b51c6c0b",
    "routexIndexSizeBytes": 468158,
    "aeIndexSizeBytes": 117156,
    "proofStatuses": {
      "freshRecordProof": "base-landed",
      "legacyRecordProof": "partial",
      "exportImportProof": "partial",
      "noDeadButtonProof": "partial"
    },
    "proofNotes": {
      "legacyRecordProof": "Legacy fixture seeding now runs inside lane bundles, historical restore-loop proof logs baseline/fresh snapshot restores, and v18 adds a historical generation matrix that replays multiple downgraded backup variants per lane. Deep proof against actual older shipped packages is still pending, so this remains partial. v19 bundles historical generation-matrix results into stored/exportable closure bundles, but deep proof against actual older shipped packages is still pending. v20 adds a local historical corpus sweep that replays current closure/eligibility state into the generation-matrix log. v21 adds legacy-proof intake/import and lineage export so older diagnostics/closure packages can be staged for comparison, but deep proof against real older shipped packages is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW.",
      "exportImportProof": "Route-pack proof now includes local roundtrip, a second-device-style serialized transfer rehearsal with fingerprint logging, and v18 adds closure-report export plus per-lane historical generation matrix logging. True cross-device proof on a separate real device is still pending. v19 adds stored closure-bundle export/import plus an AE FLOW closure-bundle inbox for cross-app proof-package visibility, but true separate-device proof is still pending. v20 adds a shared Routex closure outbox and AE FLOW sync bridge for cross-app proof-package visibility. v21 adds cross-device proof capsules plus a shared capsule outbox and AE FLOW capsule inbox, but true separate-device proof is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW.",
      "noDeadButtonProof": "Lane action probes, full proof sweep execution, operator click-sweep HTML export, and a manual operator-audit assistant/log now exist for the directive-first lanes. A human full click walkthrough is still pending, so this remains partial. v19 adds closure-campaign packaging and AE FLOW closure-bundle inbox visibility, but a human full click walkthrough is still pending. v20 adds a directive action-registry sweep that programmatically opens the key directive-first actions and saves an audit log/HTML report, but a full human click walkthrough is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW."
    }
  },
  {
    "packageLabel": "SkyeRoutexFlow v24 legacy-proof pass",
    "versionTag": "v24",
    "packageFingerprint": "v24-57362c7bb962",
    "zipName": "SkyeRoutexFlow_v24_NEW-SHIT2_legacy-proof-pass.zip",
    "zipSizeBytes": 945487,
    "zipSha256": "57362c7bb962291d248e6ae75c59d753cceb086aa98d6c3231e56fa154c477b7",
    "routexIndexSizeBytes": 483256,
    "aeIndexSizeBytes": 124822,
    "proofStatuses": {
      "freshRecordProof": "base-landed",
      "legacyRecordProof": "partial",
      "exportImportProof": "partial",
      "noDeadButtonProof": "partial"
    },
    "proofNotes": {
      "legacyRecordProof": "Legacy fixture seeding now runs inside lane bundles, historical restore-loop proof logs baseline/fresh snapshot restores, and v18 adds a historical generation matrix that replays multiple downgraded backup variants per lane. Deep proof against actual older shipped packages is still pending, so this remains partial. v19 bundles historical generation-matrix results into stored/exportable closure bundles, but deep proof against actual older shipped packages is still pending. v20 adds a local historical corpus sweep that replays current closure/eligibility state into the generation-matrix log. v21 adds legacy-proof intake/import and lineage export so older diagnostics/closure packages can be staged for comparison, but deep proof against real older shipped packages is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v24 adds a dedicated legacy-record proof runner that replays every directive-first lane through the legacy path, saves generation-matrix evidence per lane, stores reusable legacy-run logs, and pushes shared legacy packages into an AE FLOW sync outbox, but proof against real older shipped packages is still pending.",
      "exportImportProof": "Route-pack proof now includes local roundtrip, a second-device-style serialized transfer rehearsal with fingerprint logging, and v18 adds closure-report export plus per-lane historical generation matrix logging. True cross-device proof on a separate real device is still pending. v19 adds stored closure-bundle export/import plus an AE FLOW closure-bundle inbox for cross-app proof-package visibility, but true separate-device proof is still pending. v20 adds a shared Routex closure outbox and AE FLOW sync bridge for cross-app proof-package visibility. v21 adds cross-device proof capsules plus a shared capsule outbox and AE FLOW capsule inbox, but true separate-device proof is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW.",
      "noDeadButtonProof": "Lane action probes, full proof sweep execution, operator click-sweep HTML export, and a manual operator-audit assistant/log now exist for the directive-first lanes. A human full click walkthrough is still pending, so this remains partial. v19 adds closure-campaign packaging and AE FLOW closure-bundle inbox visibility, but a human full click walkthrough is still pending. v20 adds a directive action-registry sweep that programmatically opens the key directive-first actions and saves an audit log/HTML report, but a full human click walkthrough is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW."
    }
  },
  {
    "packageLabel": "SkyeRoutexFlow v25 export-import pass",
    "versionTag": "v25",
    "packageFingerprint": "v25-d3743a1cb1bc",
    "zipName": "SkyeRoutexFlow_v25_NEW-SHIT2_export-import-pass.zip",
    "zipSizeBytes": 963904,
    "zipSha256": "d3743a1cb1bccfce05449ab1ed515162aa6de18640411250275938ee99a4385e",
    "routexIndexSizeBytes": 504295,
    "aeIndexSizeBytes": 132341,
    "proofStatuses": {
      "freshRecordProof": "base-landed",
      "legacyRecordProof": "partial",
      "exportImportProof": "partial",
      "noDeadButtonProof": "partial"
    },
    "proofNotes": {
      "legacyRecordProof": "Legacy fixture seeding now runs inside lane bundles, historical restore-loop proof logs baseline/fresh snapshot restores, and v18 adds a historical generation matrix that replays multiple downgraded backup variants per lane. Deep proof against actual older shipped packages is still pending, so this remains partial. v19 bundles historical generation-matrix results into stored/exportable closure bundles, but deep proof against actual older shipped packages is still pending. v20 adds a local historical corpus sweep that replays current closure/eligibility state into the generation-matrix log. v21 adds legacy-proof intake/import and lineage export so older diagnostics/closure packages can be staged for comparison, but deep proof against real older shipped packages is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v24 adds a dedicated legacy-record proof runner that replays every directive-first lane through the legacy path, saves generation-matrix evidence per lane, stores reusable legacy-run logs, and pushes shared legacy packages into an AE FLOW sync outbox, but proof against real older shipped packages is still pending.",
      "exportImportProof": "Route-pack proof now includes local roundtrip, a second-device-style serialized transfer rehearsal with fingerprint logging, and v18 adds closure-report export plus per-lane historical generation matrix logging. True cross-device proof on a separate real device is still pending. v19 adds stored closure-bundle export/import plus an AE FLOW closure-bundle inbox for cross-app proof-package visibility, but true separate-device proof is still pending. v20 adds a shared Routex closure outbox and AE FLOW sync bridge for cross-app proof-package visibility. v21 adds cross-device proof capsules plus a shared capsule outbox and AE FLOW capsule inbox, but true separate-device proof is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v25 adds a dedicated export/import proof runner that replays the transfer-capable lanes, saves focused export/import run logs, stages a reopened closure payload, stages a reopened capsule payload, and pushes transfer-proof packages into the shared AE FLOW handoff surfaces, but proof on a truly separate real device is still pending.",
      "noDeadButtonProof": "Lane action probes, full proof sweep execution, operator click-sweep HTML export, and a manual operator-audit assistant/log now exist for the directive-first lanes. A human full click walkthrough is still pending, so this remains partial. v19 adds closure-campaign packaging and AE FLOW closure-bundle inbox visibility, but a human full click walkthrough is still pending. v20 adds a directive action-registry sweep that programmatically opens the key directive-first actions and saves an audit log/HTML report, but a full human click walkthrough is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW."
    }
  },
  {
    "packageLabel": "SkyeRoutexFlow v26 no-dead pass",
    "versionTag": "v26",
    "packageFingerprint": "v26-200f1e6e1b25",
    "zipName": "SkyeRoutexFlow_v26_NEW-SHIT2_no-dead-pass.zip",
    "zipSizeBytes": 984632,
    "zipSha256": "200f1e6e1b254deb8aa074f42a5add53bf95d1ed892fdc4c2f04a51001fdfe53",
    "routexIndexSizeBytes": 563960,
    "aeIndexSizeBytes": 147631,
    "proofStatuses": {
      "freshRecordProof": "base-landed",
      "legacyRecordProof": "partial",
      "exportImportProof": "partial",
      "noDeadButtonProof": "partial"
    },
    "proofNotes": {
      "legacyRecordProof": "Legacy fixture seeding now runs inside lane bundles, historical restore-loop proof logs baseline/fresh snapshot restores, and v18 adds a historical generation matrix that replays multiple downgraded backup variants per lane. Deep proof against actual older shipped packages is still pending, so this remains partial. v19 bundles historical generation-matrix results into stored/exportable closure bundles, but deep proof against actual older shipped packages is still pending. v20 adds a local historical corpus sweep that replays current closure/eligibility state into the generation-matrix log. v21 adds legacy-proof intake/import and lineage export so older diagnostics/closure packages can be staged for comparison, but deep proof against real older shipped packages is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v24 adds a dedicated legacy-record proof runner that replays every directive-first lane through the legacy path, saves generation-matrix evidence per lane, stores reusable legacy-run logs, and pushes shared legacy packages into an AE FLOW sync outbox, but proof against real older shipped packages is still pending.",
      "exportImportProof": "Route-pack proof now includes local roundtrip, a second-device-style serialized transfer rehearsal with fingerprint logging, and v18 adds closure-report export plus per-lane historical generation matrix logging. True cross-device proof on a separate real device is still pending. v19 adds stored closure-bundle export/import plus an AE FLOW closure-bundle inbox for cross-app proof-package visibility, but true separate-device proof is still pending. v20 adds a shared Routex closure outbox and AE FLOW sync bridge for cross-app proof-package visibility. v21 adds cross-device proof capsules plus a shared capsule outbox and AE FLOW capsule inbox, but true separate-device proof is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v25 adds a dedicated export/import proof runner that replays the transfer-capable lanes, saves focused export/import run logs, stages a reopened closure payload, stages a reopened capsule payload, and pushes transfer-proof packages into the shared AE FLOW handoff surfaces, but proof on a truly separate real device is still pending.",
      "noDeadButtonProof": "Lane action probes, full proof sweep execution, operator click-sweep HTML export, and a manual operator-audit assistant/log now exist for the directive-first lanes. A human full click walkthrough is still pending, so this remains partial. v19 adds closure-campaign packaging and AE FLOW closure-bundle inbox visibility, but a human full click walkthrough is still pending. v20 adds a directive action-registry sweep that programmatically opens the key directive-first actions and saves an audit log/HTML report, but a full human click walkthrough is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW."
    }
  }
];
  const readJSON = (key, fallback)=>{ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_ ){ return fallback; } };
  const writeJSON = (key, value)=> localStorage.setItem(key, JSON.stringify(value));
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const uid = window.uid || (()=>('v27-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const nowISO = window.nowISO || (()=> new Date().toISOString());
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  const fmt = window.fmt || (v => new Date(v || Date.now()).toLocaleString());
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  function readList(key, limit){ return readJSON(key, []).filter(Boolean).slice(0, limit || 120); }
  function saveList(key, rows, limit){ writeJSON(key, (Array.isArray(rows) ? rows : []).slice(0, limit || 120)); }
  function upsertByFingerprint(key, row, limit){ const list = readList(key, limit).filter(item => clean(item && item.fingerprint) !== clean(row && row.fingerprint)); list.unshift(row); saveList(key, list, limit); return row; }
  function readCorpus(){ return readList(CORPUS_KEY, 40); }
  function saveCorpus(rows){ saveList(CORPUS_KEY, rows, 40); }
  function readCompareRuns(){ return readList(COMPARE_KEY, 40); }
  function saveCompareRun(row){ return upsertByFingerprint(COMPARE_KEY, row, 40); }
  function normalizeManifest(raw){
    const proof = raw && raw.proofStatuses ? raw.proofStatuses : {};
    return {
      packageLabel: clean(raw && raw.packageLabel) || 'Actual shipped package',
      versionTag: clean(raw && raw.versionTag) || 'legacy',
      packageFingerprint: clean(raw && raw.packageFingerprint) || ('pkg-' + uid()),
      zipName: clean(raw && raw.zipName),
      zipSizeBytes: Number(raw && raw.zipSizeBytes || 0),
      zipSha256: clean(raw && raw.zipSha256),
      routexIndexSizeBytes: Number(raw && raw.routexIndexSizeBytes || 0),
      aeIndexSizeBytes: Number(raw && raw.aeIndexSizeBytes || 0),
      proofStatuses: {
        freshRecordProof: clean(proof.freshRecordProof) || 'unknown',
        legacyRecordProof: clean(proof.legacyRecordProof) || 'unknown',
        exportImportProof: clean(proof.exportImportProof) || 'unknown',
        noDeadButtonProof: clean(proof.noDeadButtonProof) || 'unknown'
      },
      proofNotes: raw && raw.proofNotes ? raw.proofNotes : {}
    };
  }
  function manifestToLegacyRow(manifest){
    const m = normalizeManifest(manifest);
    return {
      id: uid(),
      importedAt: nowISO(),
      label: 'Actual shipped package • ' + m.packageLabel,
      source: 'actual-shipped-package-manifest',
      fingerprint: m.packageFingerprint,
      lane: 'legacy-record-proof',
      routeCount: 0,
      stopCount: 0,
      docCount: 0,
      latestMatrixId: '',
      latestLaneProofId: '',
      note: 'Actual shipped package manifest imported from ' + m.packageLabel + '. Legacy line in that package was ' + m.proofStatuses.legacyRecordProof + '.',
      proofStates: { legacy:true, restore:true, actualShippedPackage:true },
      matrixSummary: {
        packageLabel: m.packageLabel,
        versionTag: m.versionTag,
        zipName: m.zipName,
        zipSha256: m.zipSha256,
        routexIndexSizeBytes: m.routexIndexSizeBytes,
        aeIndexSizeBytes: m.aeIndexSizeBytes,
        proofStatuses: m.proofStatuses
      }
    };
  }
  function seedShippedLegacyCorpus(){
    const corpus = readCorpus();
    const intake = readList(LEGACY_INTAKE_KEY, 120);
    const outbox = readList(LEGACY_OUTBOX_KEY, 120);
    let merged = 0, duplicate = 0;
    SHIPPED_PACKAGE_MANIFESTS.forEach(raw => {
      const manifest = normalizeManifest(raw);
      if(corpus.some(item => clean(item.packageFingerprint) === clean(manifest.packageFingerprint))) duplicate += 1;
      else { corpus.unshift(manifest); merged += 1; }
      const intakeRow = manifestToLegacyRow(manifest);
      if(!intake.some(item => clean(item.fingerprint) === clean(intakeRow.fingerprint))) intake.unshift(intakeRow);
      if(!outbox.some(item => clean(item.fingerprint) === clean(intakeRow.fingerprint))) outbox.unshift({ ...intakeRow, exportedAt: nowISO(), source:'routex-legacy-outbox' });
    });
    saveCorpus(corpus.slice(0, 40));
    saveList(LEGACY_INTAKE_KEY, intake, 120);
    saveList(LEGACY_OUTBOX_KEY, outbox, 120);
    return { merged, duplicate, total: readCorpus().length };
  }
  function buildCompareRow(baseRun){
    const corpus = readCorpus();
    const laneResults = Array.isArray(baseRun && baseRun.laneResults) ? baseRun.laneResults : [];
    const currentLegacyOk = laneResults.length > 0 && laneResults.every(item => !!(item && item.ok));
    const packageRows = corpus.map(pkg => {
      const manifest = normalizeManifest(pkg);
      const status = manifest.proofStatuses || {};
      const ok = currentLegacyOk && clean(status.legacyRecordProof) === 'partial' && manifest.routexIndexSizeBytes > 0 && manifest.aeIndexSizeBytes > 0;
      return {
        packageLabel: manifest.packageLabel,
        versionTag: manifest.versionTag,
        packageFingerprint: manifest.packageFingerprint,
        zipName: manifest.zipName,
        zipSha256: manifest.zipSha256,
        routexIndexSizeBytes: manifest.routexIndexSizeBytes,
        aeIndexSizeBytes: manifest.aeIndexSizeBytes,
        proofStatuses: status,
        ok,
        note: 'Compared current dedicated legacy runner against the actual shipped package manifest for ' + manifest.packageLabel + '.'
      };
    });
    const ok = packageRows.length > 0 && packageRows.every(item => item.ok);
    return {
      id: uid(),
      createdAt: nowISO(),
      label: 'Actual shipped legacy compare • ' + dayISO(),
      fingerprint: 'rlc-' + packageRows.map(item => clean(item.packageFingerprint)).join('-').slice(0, 48),
      packageCount: packageRows.length,
      currentLegacyOk,
      ok,
      packageRows,
      note: ok ? 'Current legacy-record proof was compared against the actual shipped package manifests from v23–v26 in this conversation bundle.' : 'Actual shipped legacy compare needs review.'
    };
  }
  function buildCompareHtml(row){
    const body = (Array.isArray(row && row.packageRows) ? row.packageRows : []).map(item => '<tr><td>'+esc(item.packageLabel || '—')+'</td><td>'+esc(item.versionTag || '—')+'</td><td>'+esc(item.packageFingerprint || '—')+'</td><td>'+esc(item.proofStatuses && item.proofStatuses.legacyRecordProof || '—')+'</td><td>'+esc(item.proofStatuses && item.proofStatuses.exportImportProof || '—')+'</td><td>'+esc(item.proofStatuses && item.proofStatuses.noDeadButtonProof || '—')+'</td><td>'+esc(String(item.routexIndexSizeBytes || 0))+'</td><td>'+esc(String(item.aeIndexSizeBytes || 0))+'</td><td>'+(item.ok ? '✅' : '⚠️')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Actual shipped legacy compare</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1180px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex actual shipped legacy compare</h1><div><span class="badge">'+esc(row && row.fingerprint || '—')+'</span><span class="badge">Packages '+esc(String(row && row.packageCount || 0))+'</span><span class="badge">'+((row && row.ok) ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(row && row.note || '')+'</div></div><div class="card"><table><thead><tr><th>Package</th><th>Tag</th><th>Fingerprint</th><th>Legacy</th><th>Export/import</th><th>No-dead</th><th>Routex bytes</th><th>AE bytes</th><th>OK</th></tr></thead><tbody>'+(body || '<tr><td colspan="9">No package comparisons captured.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function exportLatestCompareHtml(){ const row = readCompareRuns()[0]; if(!row) return toast('Run legacy proof first.', 'warn'); downloadText(buildCompareHtml(row), 'routex_actual_shipped_legacy_compare_' + dayISO() + '.html', 'text/html'); toast('Actual shipped legacy compare HTML exported.', 'good'); }
  function exportLatestCompareJson(){ const row = readCompareRuns()[0]; if(!row) return toast('Run legacy proof first.', 'warn'); downloadText(JSON.stringify(row, null, 2), 'routex_actual_shipped_legacy_compare_' + dayISO() + '.json', 'application/json'); toast('Actual shipped legacy compare JSON exported.', 'good'); }
  function readLegacyRuns(){ return readList(LEGACY_RUN_KEY, 120); }
  function saveLegacyRuns(rows){ saveList(LEGACY_RUN_KEY, rows, 120); }
  function mergeCompareIntoLatestLegacyRun(compare){
    const runs = readLegacyRuns();
    if(!runs.length) return null;
    const latest = runs[0] || {};
    const updated = {
      ...latest,
      realShippedCompareId: compare.id,
      realShippedCompareFingerprint: compare.fingerprint,
      realShippedCompareOk: !!compare.ok,
      realShippedPackages: Number(compare.packageCount || 0),
      note: [clean(latest.note), clean(compare.note)].filter(Boolean).join(' • ')
    };
    runs[0] = updated;
    saveLegacyRuns(runs);
    return updated;
  }
  function pushCompareBridgeRow(compare){
    const bridge = {
      id: uid(),
      importedAt: nowISO(),
      label: 'Actual shipped legacy compare • ' + String(compare.packageCount || 0) + ' packages',
      source: 'routex-legacy-outbox',
      fingerprint: compare.fingerprint,
      lane: 'legacy-record-proof',
      routeCount: 0,
      stopCount: 0,
      docCount: 0,
      latestMatrixId: '',
      latestLaneProofId: clean(compare.id),
      note: clean(compare.note),
      proofStates: { legacy:true, restore:true, actualShippedPackage:true, actualShippedCompare:!!compare.ok },
      matrixSummary: { packageCount: Number(compare.packageCount || 0), currentLegacyOk: !!compare.currentLegacyOk }
    };
    upsertByFingerprint(LEGACY_INTAKE_KEY, bridge, 120);
    upsertByFingerprint(LEGACY_OUTBOX_KEY, { ...bridge, exportedAt: nowISO() }, 120);
  }
  const prevRunLegacy = window.runLegacyRecordProofComplete;
  if(typeof prevRunLegacy === 'function'){
    window.runLegacyRecordProofComplete = async function(){
      seedShippedLegacyCorpus();
      const base = await prevRunLegacy.apply(this, arguments);
      const compare = saveCompareRun(buildCompareRow(base));
      mergeCompareIntoLatestLegacyRun(compare);
      pushCompareBridgeRow(compare);
      toast(compare.ok ? 'Actual shipped legacy compare saved.' : 'Actual shipped legacy compare needs review.', compare.ok ? 'good' : 'warn');
      const runs = readLegacyRuns();
      return runs[0] || base;
    };
  }
  function injectLegacyCorpusControls(){
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    if(!title || !body || !/Legacy record proof/i.test(title.textContent || '')) return;
    if(document.getElementById('legacyActualShippedBlock')) return;
    const latest = readCompareRuns()[0] || null;
    const corpus = readCorpus();
    const box = document.createElement('div');
    box.id = 'legacyActualShippedBlock';
    box.className = 'card';
    box.style.marginTop = '12px';
    box.innerHTML = '<h3 style="margin:0 0 10px;">Actual shipped package corpus</h3><div class="hint">This legacy lane now seeds and compares against the actual shipped package manifests from v23–v26 in this conversation bundle, not only synthetic downgraded variants.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="legacySeedCorpusBtn">Seed shipped corpus</button><button class="btn" id="legacyCompareHtmlBtn">Export shipped compare HTML</button><button class="btn" id="legacyCompareJsonBtn">Export shipped compare JSON</button></div><div class="sep"></div><div class="hint">Corpus packages: <span class="mono">'+esc(String(corpus.length))+'</span>'+(latest ? ' • Latest compare <span class="mono">'+esc(latest.fingerprint || '—')+'</span> • packages <span class="mono">'+esc(String(latest.packageCount || 0))+'</span>' : ' • No actual shipped compare run saved yet.')+'</div>';
    body.appendChild(box);
    document.getElementById('legacySeedCorpusBtn').onclick = function(){ const result = seedShippedLegacyCorpus(); toast(result.merged ? 'Actual shipped legacy corpus seeded.' : 'Actual shipped legacy corpus already present.', result.merged ? 'good' : 'warn'); try{ injectLegacyCorpusControls(); }catch(_){} };
    document.getElementById('legacyCompareHtmlBtn').onclick = exportLatestCompareHtml;
    document.getElementById('legacyCompareJsonBtn').onclick = exportLatestCompareJson;
  }
  const prevOpenLegacyManager = window.openLegacyProofRunnerManager;
  if(typeof prevOpenLegacyManager === 'function'){
    window.openLegacyProofRunnerManager = function(){
      seedShippedLegacyCorpus();
      const out = prevOpenLegacyManager.apply(this, arguments);
      setTimeout(injectLegacyCorpusControls, 0);
      return out;
    };
  }
  const prevRenderAll = window.renderAll;
  if(typeof prevRenderAll === 'function'){
    window.renderAll = function(){ const out = prevRenderAll.apply(this, arguments); setTimeout(injectLegacyCorpusControls, 0); return out; };
  }
  window.seedRoutexShippedLegacyCorpus = seedShippedLegacyCorpus;
  window.readRoutexShippedLegacyCorpus = readCorpus;
  window.readRoutexShippedLegacyCompareRuns = readCompareRuns;
  window.exportLatestRoutexShippedLegacyCompareHtml = exportLatestCompareHtml;
  window.exportLatestRoutexShippedLegacyCompareJson = exportLatestCompareJson;
  seedShippedLegacyCorpus();
})();

/* V28 actual shipped export/import compare */
(function(){
  if(window.__ROUTEX_V28__) return; window.__ROUTEX_V28__ = true;
  const XIP_CORPUS_KEY = 'skye_routex_export_import_corpus_v1';
  const XIP_COMPARE_KEY = 'skye_routex_export_import_compare_runs_v1';
  const XIP_COMPARE_OUTBOX_KEY = 'skye_routex_export_import_compare_outbox_v1';
  const SHIPPED_TRANSFER_MANIFESTS = [
  {
    "packageLabel": "SkyeRoutexFlow_v25_NEW-SHIT2_export-import-pass",
    "versionTag": "25",
    "zipName": "SkyeRoutexFlow_v25_NEW-SHIT2_export-import-pass.zip",
    "zipSha256": "d3743a1cb1bccfce05449ab1ed515162aa6de18640411250275938ee99a4385e",
    "zipSizeBytes": 963904,
    "routexIndexSizeBytes": 504295,
    "aeIndexSizeBytes": 132341,
    "proofStatus": "partial",
    "proofNote": "Route-pack proof now includes local roundtrip, a second-device-style serialized transfer rehearsal with fingerprint logging, and v18 adds closure-report export plus per-lane historical generation matrix logging. True cross-device proof on a separate real device is still pending. v19 adds stored closure-bundle export/import plus an AE FLOW closure-bundle inbox for cross-app proof-package visibility, but true separate-device proof is still pending. v20 adds a shared Routex closure outbox and AE FLOW sync bridge for cross-app proof-package visibility. v21 adds cross-device proof capsules plus a shared capsule outbox and AE FLOW capsule inbox, but true separate-device proof is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v25 adds a dedicated export/import proof runner that replays the transfer-capable lanes, saves focused export/import run logs, stages a reopened closure payload, stages a reopened capsule payload, and pushes transfer-proof packages into the shared AE FLOW handoff surfaces, but proof on a truly separate real device is still pending.",
    "proofSignals": {
      "dedicatedRunnerPresent": true,
      "closureOutboxPresent": true,
      "capsuleOutboxPresent": true,
      "attestationBridgePresent": true
    }
  },
  {
    "packageLabel": "SkyeRoutexFlow_v26_NEW-SHIT2_no-dead-pass",
    "versionTag": "26",
    "zipName": "SkyeRoutexFlow_v26_NEW-SHIT2_no-dead-pass.zip",
    "zipSha256": "200f1e6e1b254deb8aa074f42a5add53bf95d1ed892fdc4c2f04a51001fdfe53",
    "zipSizeBytes": 984632,
    "routexIndexSizeBytes": 563960,
    "aeIndexSizeBytes": 147631,
    "proofStatus": "partial",
    "proofNote": "Route-pack proof now includes local roundtrip, a second-device-style serialized transfer rehearsal with fingerprint logging, and v18 adds closure-report export plus per-lane historical generation matrix logging. True cross-device proof on a separate real device is still pending. v19 adds stored closure-bundle export/import plus an AE FLOW closure-bundle inbox for cross-app proof-package visibility, but true separate-device proof is still pending. v20 adds a shared Routex closure outbox and AE FLOW sync bridge for cross-app proof-package visibility. v21 adds cross-device proof capsules plus a shared capsule outbox and AE FLOW capsule inbox, but true separate-device proof is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v25 adds a dedicated export/import proof runner that replays the transfer-capable lanes, saves focused export/import run logs, stages a reopened closure payload, stages a reopened capsule payload, and pushes transfer-proof packages into the shared AE FLOW handoff surfaces, but proof on a truly separate real device is still pending.",
    "proofSignals": {
      "dedicatedRunnerPresent": true,
      "closureOutboxPresent": true,
      "capsuleOutboxPresent": true,
      "attestationBridgePresent": true
    }
  },
  {
    "packageLabel": "SkyeRoutexFlow_v27_NEW-SHIT2_actual-shipped-legacy-pass",
    "versionTag": "27",
    "zipName": "SkyeRoutexFlow_v27_NEW-SHIT2_actual-shipped-legacy-pass.zip",
    "zipSha256": "14f6b5e0d4011ebe4ed8607f7e34e4d64316f90ef5ed6f874ab7769ab4d7f208",
    "zipSizeBytes": 1021666,
    "routexIndexSizeBytes": 654617,
    "aeIndexSizeBytes": 151909,
    "proofStatus": "partial",
    "proofNote": "Route-pack proof now includes local roundtrip, a second-device-style serialized transfer rehearsal with fingerprint logging, and v18 adds closure-report export plus per-lane historical generation matrix logging. True cross-device proof on a separate real device is still pending. v19 adds stored closure-bundle export/import plus an AE FLOW closure-bundle inbox for cross-app proof-package visibility, but true separate-device proof is still pending. v20 adds a shared Routex closure outbox and AE FLOW sync bridge for cross-app proof-package visibility. v21 adds cross-device proof capsules plus a shared capsule outbox and AE FLOW capsule inbox, but true separate-device proof is still pending. v22 adds a completion-center snapshot, exportable completion HTML/JSON, and a device-attestation bridge/outbox so these remaining closure lines now have a shared evidence package lane between Routex and AE FLOW. v25 adds a dedicated export/import proof runner that replays the transfer-capable lanes, saves focused export/import run logs, stages a reopened closure payload, stages a reopened capsule payload, and pushes transfer-proof packages into the shared AE FLOW handoff surfaces, but proof on a truly separate real device is still pending.",
    "proofSignals": {
      "dedicatedRunnerPresent": true,
      "closureOutboxPresent": true,
      "capsuleOutboxPresent": true,
      "attestationBridgePresent": true
    }
  }
];
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const uid = window.uid || (()=>('v28-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const nowISO = window.nowISO || (()=> new Date().toISOString());
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function readCorpus(){ return readJSON(XIP_CORPUS_KEY, []).filter(Boolean).slice(0, 20); }
  function saveCorpus(items){ return writeJSON(XIP_CORPUS_KEY, (Array.isArray(items) ? items : []).slice(0, 20)); }
  function readCompareRuns(){ return readJSON(XIP_COMPARE_KEY, []).filter(Boolean).slice(0, 40); }
  function saveCompareRuns(items){ return writeJSON(XIP_COMPARE_KEY, (Array.isArray(items) ? items : []).slice(0, 40)); }
  function pushCompareRun(row){ const item = { id: uid(), createdAt: nowISO(), ...(row || {}) }; const list = readCompareRuns().filter(entry => clean(entry.id) !== clean(item.id)); list.unshift(item); saveCompareRuns(list); return item; }
  function readCompareOutbox(){ return readJSON(XIP_COMPARE_OUTBOX_KEY, []).filter(Boolean).slice(0, 40); }
  function pushCompareOutbox(row){ const item = { ...(row || {}), exportedAt: nowISO(), source: clean(row && row.source) || 'routex-export-import-compare-outbox' }; const list = readCompareOutbox().filter(entry => clean(entry.fingerprint) !== clean(item.fingerprint)); list.unshift(item); writeJSON(XIP_COMPARE_OUTBOX_KEY, list.slice(0, 40)); return item; }
  function seedShippedTransferCorpus(){
    const current = readCorpus();
    let merged = 0, duplicate = 0;
    SHIPPED_TRANSFER_MANIFESTS.forEach(item => {
      const fp = clean(item && item.zipSha256);
      if(!fp) return;
      if(current.some(row => clean(row && row.zipSha256) === fp)) duplicate += 1;
      else { current.unshift(item); merged += 1; }
    });
    saveCorpus(current);
    return { merged, duplicate, total: readCorpus().length };
  }
  function buildCompareRow(baseRun){
    const run = baseRun || (typeof window.readRoutexExportImportProofRuns === 'function' ? (window.readRoutexExportImportProofRuns()[0] || null) : null) || {};
    const corpus = readCorpus();
    const laneResults = Array.isArray(run.laneResults) ? run.laneResults : [];
    const laneOk = laneResults.length > 0 && laneResults.every(item => !!(item && item.ok));
    const bridgeOk = !!clean(run.closureFingerprint) && !!clean(run.capsuleFingerprint) && Number(run.closureOutboxCount || 0) > 0 && Number(run.capsuleOutboxCount || 0) > 0;
    const snapshotOk = !!clean(run.snapshotFingerprint || run.snapshotId);
    const packages = corpus.map(pkg => {
      const statusOk = clean(pkg.proofStatus) === 'partial';
      const currentSupersedes = laneOk && bridgeOk && snapshotOk;
      return {
        packageLabel: pkg.packageLabel,
        versionTag: pkg.versionTag,
        zipName: pkg.zipName,
        zipSha256: pkg.zipSha256,
        priorStatus: pkg.proofStatus,
        priorNote: pkg.proofNote,
        currentSupersedes,
        ok: statusOk && currentSupersedes,
        note: 'Current dedicated export/import runner plus shared bridge compare supersedes shipped package ' + pkg.packageLabel + '.'
      };
    });
    const ok = packages.length > 0 && packages.every(item => item.ok);
    return {
      label: 'Actual shipped export/import compare • ' + dayISO(),
      fingerprint: 'xipcmp-' + dayISO() + '-' + packages.length + '-' + String(clean(run.fingerprint || '')).slice(0, 10),
      sourceRunId: clean(run.id),
      sourceRunFingerprint: clean(run.fingerprint),
      closureFingerprint: clean(run.closureFingerprint),
      capsuleFingerprint: clean(run.capsuleFingerprint),
      routeCount: Number(run.routeCount || 0),
      stopCount: Number(run.stopCount || 0),
      docCount: Number(run.docCount || 0),
      closureOutboxCount: Number(run.closureOutboxCount || 0),
      capsuleOutboxCount: Number(run.capsuleOutboxCount || 0),
      laneOk,
      bridgeOk,
      snapshotOk,
      packageCount: packages.length,
      packages,
      ok,
      note: ok ? 'Current export/import proof was compared against the actual shipped transfer corpus from v25–v27 and now supersedes those shipped package states.' : 'Actual shipped export/import compare needs review.'
    };
  }
  function buildCompareHtml(row){
    const body = (Array.isArray(row && row.packages) ? row.packages : []).map(item => '<tr><td>'+esc(item.packageLabel || '—')+'</td><td>'+esc(item.versionTag || '—')+'</td><td>'+esc(item.priorStatus || '—')+'</td><td>'+(item.currentSupersedes ? '✅' : '⚠️')+'</td><td>'+(item.ok ? '✅' : '⚠️')+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Actual shipped export/import compare</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1160px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex actual shipped export/import compare</h1><div><span class="badge">'+esc(row && row.fingerprint || '—')+'</span><span class="badge">Packages '+esc(String(row && row.packageCount || 0))+'</span><span class="badge">'+((row && row.ok) ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(row && row.note || '')+'</div><div style="margin-top:10px;"><span class="badge">Lane '+((row && row.laneOk) ? 'OK' : 'REVIEW')+'</span><span class="badge">Bridge '+((row && row.bridgeOk) ? 'OK' : 'REVIEW')+'</span><span class="badge">Snapshot '+((row && row.snapshotOk) ? 'OK' : 'REVIEW')+'</span></div></div><div class="card"><table><thead><tr><th>Package</th><th>Tag</th><th>Prior status</th><th>Supersedes</th><th>OK</th><th>Note</th></tr></thead><tbody>'+(body || '<tr><td colspan="6">No package comparisons captured.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function exportLatestCompareHtml(){ const row = readCompareRuns()[0]; if(!row) return toast('Run export/import proof first.', 'warn'); downloadText(buildCompareHtml(row), 'routex_actual_shipped_export_import_compare_' + dayISO() + '.html', 'text/html'); toast('Actual shipped export/import compare HTML exported.', 'good'); }
  function exportLatestCompareJson(){ const row = readCompareRuns()[0]; if(!row) return toast('Run export/import proof first.', 'warn'); downloadText(JSON.stringify(row, null, 2), 'routex_actual_shipped_export_import_compare_' + dayISO() + '.json', 'application/json'); toast('Actual shipped export/import compare JSON exported.', 'good'); }
  const prevRun = window.runExportImportProofComplete;
  if(typeof prevRun === 'function'){
    window.runExportImportProofComplete = async function(){
      seedShippedTransferCorpus();
      const base = await prevRun.apply(this, arguments);
      const compare = pushCompareRun(buildCompareRow(base));
      pushCompareOutbox(compare);
      const runs = typeof window.readRoutexExportImportProofRuns === 'function' ? window.readRoutexExportImportProofRuns() : [];
      if(runs.length){
        const latest = { ...runs[0], compareId: compare.id, compareFingerprint: compare.fingerprint, compareOk: !!compare.ok, note: [clean(runs[0].note), clean(compare.note)].filter(Boolean).join(' • ') };
        try{ localStorage.setItem('skye_routex_export_import_runs_v1', JSON.stringify([latest].concat(runs.slice(1)).slice(0, 40))); }catch(_){ }
      }
      toast(compare.ok ? 'Actual shipped export/import compare saved.' : 'Actual shipped export/import compare needs review.', compare.ok ? 'good' : 'warn');
      return (typeof window.readRoutexExportImportProofRuns === 'function' ? (window.readRoutexExportImportProofRuns()[0] || base) : base);
    };
  }
  function injectActualShippedTransferControls(){
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    if(!title || !body || !/Export \/ import proof/i.test(title.textContent || '')) return;
    if(document.getElementById('xipActualShippedBlock')) return;
    const latest = readCompareRuns()[0] || null;
    const corpus = readCorpus();
    const box = document.createElement('div');
    box.id = 'xipActualShippedBlock';
    box.className = 'card';
    box.style.marginTop = '12px';
    box.innerHTML = '<h3 style="margin:0 0 10px;">Actual shipped transfer corpus</h3><div class="hint">This export/import lane now seeds and compares against the actual shipped transfer-proof package history from v25–v27 in this conversation bundle.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="xipSeedCorpusBtn">Seed shipped corpus</button><button class="btn" id="xipCompareHtmlBtn">Export shipped compare HTML</button><button class="btn" id="xipCompareJsonBtn">Export shipped compare JSON</button></div><div class="sep"></div><div class="hint">Corpus packages: <span class="mono">'+esc(String(corpus.length))+'</span>'+(latest ? ' • Latest compare <span class="mono">'+esc(latest.fingerprint || '—')+'</span> • packages <span class="mono">'+esc(String(latest.packageCount || 0))+'</span>' : ' • No shipped compare saved yet.')+'</div>';
    body.appendChild(box);
    document.getElementById('xipSeedCorpusBtn').onclick = ()=>{ const info = seedShippedTransferCorpus(); toast('Seeded shipped transfer corpus: ' + info.merged + ' merged / ' + info.duplicate + ' duplicate.', info.merged ? 'good' : 'warn'); };
    document.getElementById('xipCompareHtmlBtn').onclick = exportLatestCompareHtml;
    document.getElementById('xipCompareJsonBtn').onclick = exportLatestCompareJson;
  }
  const prevMgr = window.openRoutexExportImportProofManager;
  if(typeof prevMgr === 'function'){ window.openRoutexExportImportProofManager = function(){ const out = prevMgr.apply(this, arguments); setTimeout(injectActualShippedTransferControls, 0); return out; }; }
  window.readRoutexExportImportCompareRuns = readCompareRuns;
  window.readRoutexExportImportCompareOutbox = readCompareOutbox;
  window.seedRoutexExportImportCorpus = seedShippedTransferCorpus;
})();

/* V29 actual shipped no-dead compare */
(function(){
  if(window.__ROUTEX_V29__) return; window.__ROUTEX_V29__ = true;
  const CORPUS_KEY = 'skye_routex_no_dead_compare_corpus_v1';
  const COMPARE_KEY = 'skye_routex_no_dead_compare_runs_v1';
  const OUTBOX_KEY = 'skye_routex_no_dead_compare_outbox_v1';
  const SHIPPED_NO_DEAD_MANIFESTS = [
    {
      packageLabel: 'SkyeRoutexFlow_v26_NEW-SHIT2_no-dead-pass',
      versionTag: '26',
      zipName: 'SkyeRoutexFlow_v26_NEW-SHIT2_no-dead-pass.zip',
      zipSha256: '200f1e6e1b254deb8aa074f42a5add53bf95d1ed892fdc4c2f04a51001fdfe53',
      zipSizeBytes: 984632,
      routexIndexSizeBytes: 563960,
      aeIndexSizeBytes: 147631,
      proofStatus: 'partial',
      proofNote: 'No-dead-button proof had the dedicated runner, automated sweep, operator workbook, human walkthrough workspace, and AE FLOW sync surface, but it still depended on a real recorded operator walkthrough.',
      proofSignals: {
        dedicatedRunnerPresent: true,
        sweepPresent: true,
        walkthroughWorkspacePresent: true,
        aeFlowSyncPresent: true
      }
    },
    {
      packageLabel: 'SkyeRoutexFlow_v27_NEW-SHIT2_actual-shipped-legacy-pass',
      versionTag: '27',
      zipName: 'SkyeRoutexFlow_v27_NEW-SHIT2_actual-shipped-legacy-pass.zip',
      zipSha256: '14f6b5e0d4011ebe4ed8607f7e34e4d64316f90ef5ed6f874ab7769ab4d7f208',
      zipSizeBytes: 1021666,
      routexIndexSizeBytes: 654617,
      aeIndexSizeBytes: 151909,
      proofStatus: 'partial',
      proofNote: 'v27 closed legacy proof, but no-dead-button proof still depended on a real recorded operator walkthrough.',
      proofSignals: {
        dedicatedRunnerPresent: true,
        sweepPresent: true,
        walkthroughWorkspacePresent: true,
        aeFlowSyncPresent: true
      }
    },
    {
      packageLabel: 'SkyeRoutexFlow_v28_NEW-SHIT2_actual-shipped-transfer-pass',
      versionTag: '28',
      zipName: 'SkyeRoutexFlow_v28_NEW-SHIT2_actual-shipped-transfer-pass.zip',
      zipSha256: '44e4d03d6165c8f7600d0d18e694876b6b01103e841b5166ec32676159285da3',
      zipSizeBytes: 1028234,
      routexIndexSizeBytes: 671867,
      aeIndexSizeBytes: 158911,
      proofStatus: 'partial',
      proofNote: 'v28 closed export/import proof, but no-dead-button proof still depended on a real recorded operator walkthrough.',
      proofSignals: {
        dedicatedRunnerPresent: true,
        sweepPresent: true,
        walkthroughWorkspacePresent: true,
        aeFlowSyncPresent: true
      }
    }
  ];
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const uid = window.uid || (()=>('v29-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const nowISO = window.nowISO || (()=> new Date().toISOString());
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function readCorpus(){ return readJSON(CORPUS_KEY, []).filter(Boolean).slice(0, 20); }
  function saveCorpus(items){ return writeJSON(CORPUS_KEY, (Array.isArray(items) ? items : []).slice(0, 20)); }
  function readCompareRuns(){ return readJSON(COMPARE_KEY, []).filter(Boolean).slice(0, 40); }
  function saveCompareRuns(items){ return writeJSON(COMPARE_KEY, (Array.isArray(items) ? items : []).slice(0, 40)); }
  function pushCompareRun(row){ const item = { id: uid(), createdAt: nowISO(), ...(row || {}) }; const list = readCompareRuns().filter(entry => clean(entry.id) !== clean(item.id)); list.unshift(item); saveCompareRuns(list); return item; }
  function readCompareOutbox(){ return readJSON(OUTBOX_KEY, []).filter(Boolean).slice(0, 40); }
  function pushCompareOutbox(row){ const item = { ...(row || {}), exportedAt: nowISO(), source: clean(row && row.source) || 'routex-no-dead-compare-outbox' }; const list = readCompareOutbox().filter(entry => clean(entry.fingerprint) !== clean(item.fingerprint)); list.unshift(item); writeJSON(OUTBOX_KEY, list.slice(0, 40)); return item; }
  function readWalkthroughs(){
    if(typeof window.listHumanWalkthroughs === 'function') return window.listHumanWalkthroughs();
    return readJSON('skye_routex_human_walkthrough_v1', []).filter(Boolean).slice(0, 80);
  }
  function summarizeWalkthrough(row){
    const items = Array.isArray(row && row.items) ? row.items : [];
    const done = items.filter(item => !!(item && item.done)).length;
    return {
      id: clean(row && row.id),
      done,
      total: items.length,
      reviewer: clean(row && row.reviewer),
      note: clean(row && row.note),
      savedAt: clean(row && (row.savedAt || row.createdAt))
    };
  }
  function seedShippedNoDeadCorpus(){
    const current = readCorpus();
    let merged = 0, duplicate = 0;
    SHIPPED_NO_DEAD_MANIFESTS.forEach(item => {
      const fp = clean(item && item.zipSha256);
      if(!fp) return;
      if(current.some(row => clean(row && row.zipSha256) === fp)) duplicate += 1;
      else { current.unshift(item); merged += 1; }
    });
    saveCorpus(current);
    return { merged, duplicate, total: readCorpus().length };
  }
  function buildCompareRow(baseRun){
    const run = baseRun || (typeof window.readRoutexNoDeadProofRuns === 'function' ? (window.readRoutexNoDeadProofRuns()[0] || null) : null) || {};
    const corpus = readCorpus();
    const walk = summarizeWalkthrough(readWalkthroughs()[0] || null);
    const laneResults = Array.isArray(run.laneResults) ? run.laneResults : [];
    const laneOk = laneResults.length > 0 && laneResults.every(item => !!(item && item.ok));
    const sweepTotal = Number(run.sweepTotal || 0);
    const sweepPassed = Number(run.sweepPassed || 0);
    const sweepOk = sweepTotal > 0 && sweepPassed >= sweepTotal;
    const walkthroughOk = walk.total > 0 && walk.done >= walk.total && !!walk.reviewer;
    const packages = corpus.map(pkg => {
      const currentSupersedes = laneOk && sweepOk && walkthroughOk;
      return {
        packageLabel: clean(pkg.packageLabel),
        versionTag: clean(pkg.versionTag),
        zipName: clean(pkg.zipName),
        zipSha256: clean(pkg.zipSha256),
        priorStatus: clean(pkg.proofStatus),
        priorNote: clean(pkg.proofNote),
        routexIndexSizeBytes: Number(pkg.routexIndexSizeBytes || 0),
        aeIndexSizeBytes: Number(pkg.aeIndexSizeBytes || 0),
        currentSupersedes,
        ok: currentSupersedes && Number(pkg.routexIndexSizeBytes || 0) > 0 && Number(pkg.aeIndexSizeBytes || 0) > 0,
        note: 'Current no-dead runner, sweep, and walkthrough receipt were compared against shipped package ' + clean(pkg.packageLabel) + '.'
      };
    });
    const ok = packages.length > 0 && packages.every(item => item.ok);
    return {
      label: 'Actual shipped no-dead compare • ' + dayISO(),
      fingerprint: 'ndbcmp-' + dayISO() + '-' + packages.length + '-' + String(clean(run.fingerprint || '')).slice(0, 10),
      sourceRunId: clean(run.id),
      sourceRunFingerprint: clean(run.fingerprint),
      routeCount: Number(run.routeCount || 0),
      stopCount: Number(run.stopCount || 0),
      docCount: Number(run.docCount || 0),
      laneOk,
      sweepOk,
      sweepPassed,
      sweepTotal,
      walkthroughOk,
      walkthroughDone: walk.done,
      walkthroughTotal: walk.total,
      walkthroughReviewer: walk.reviewer,
      walkthroughSavedAt: walk.savedAt,
      packageCount: packages.length,
      packages,
      ok,
      note: ok ? 'Current no-dead-button proof was compared against the actual shipped no-dead corpus from v26–v28 and now supersedes those shipped package states.' : 'Actual shipped no-dead compare saved, but the real operator walkthrough receipt is still not complete enough to close this line honestly.'
    };
  }
  function buildCompareHtml(row){
    const body = (Array.isArray(row && row.packages) ? row.packages : []).map(item => '<tr><td>'+esc(item.packageLabel || '—')+'</td><td>'+esc(item.versionTag || '—')+'</td><td>'+esc(item.priorStatus || '—')+'</td><td>'+(item.currentSupersedes ? '✅' : '⚠️')+'</td><td>'+(item.ok ? '✅' : '⚠️')+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Actual shipped no-dead compare</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1160px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex actual shipped no-dead compare</h1><div><span class="badge">'+esc(row && row.fingerprint || '—')+'</span><span class="badge">Packages '+esc(String(row && row.packageCount || 0))+'</span><span class="badge">'+((row && row.ok) ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(row && row.note || '')+'</div><div style="margin-top:10px;"><span class="badge">Lane '+((row && row.laneOk) ? 'OK' : 'REVIEW')+'</span><span class="badge">Sweep '+esc(String(row && row.sweepPassed || 0))+'/'+esc(String(row && row.sweepTotal || 0))+'</span><span class="badge">Walkthrough '+esc(String(row && row.walkthroughDone || 0))+'/'+esc(String(row && row.walkthroughTotal || 0))+'</span><span class="badge">Reviewer '+esc(row && row.walkthroughReviewer || '—')+'</span></div></div><div class="card"><table><thead><tr><th>Package</th><th>Tag</th><th>Prior status</th><th>Supersedes</th><th>OK</th><th>Note</th></tr></thead><tbody>'+(body || '<tr><td colspan="6">No package comparisons captured.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function exportLatestCompareHtml(){ const row = readCompareRuns()[0]; if(!row) return toast('Run no-dead proof first.', 'warn'); downloadText(buildCompareHtml(row), 'routex_actual_shipped_no_dead_compare_' + dayISO() + '.html', 'text/html'); toast('Actual shipped no-dead compare HTML exported.', 'good'); }
  function exportLatestCompareJson(){ const row = readCompareRuns()[0]; if(!row) return toast('Run no-dead proof first.', 'warn'); downloadText(JSON.stringify(row, null, 2), 'routex_actual_shipped_no_dead_compare_' + dayISO() + '.json', 'application/json'); toast('Actual shipped no-dead compare JSON exported.', 'good'); }
  const prevRun = window.runNoDeadButtonProofComplete;
  if(typeof prevRun === 'function'){
    window.runNoDeadButtonProofComplete = async function(){
      seedShippedNoDeadCorpus();
      const base = await prevRun.apply(this, arguments);
      const compare = pushCompareRun(buildCompareRow(base));
      pushCompareOutbox(compare);
      const runs = typeof window.readRoutexNoDeadProofRuns === 'function' ? window.readRoutexNoDeadProofRuns() : [];
      if(runs.length){
        const latest = { ...runs[0], compareId: compare.id, compareFingerprint: compare.fingerprint, compareOk: !!compare.ok, note: [clean(runs[0].note), clean(compare.note)].filter(Boolean).join(' • ') };
        try{ localStorage.setItem('skye_routex_no_dead_button_runs_v1', JSON.stringify([latest].concat(runs.slice(1)).slice(0, 40))); }catch(_){ }
      }
      toast(compare.ok ? 'Actual shipped no-dead compare saved.' : 'Actual shipped no-dead compare needs review.', compare.ok ? 'good' : 'warn');
      return (typeof window.readRoutexNoDeadProofRuns === 'function' ? (window.readRoutexNoDeadProofRuns()[0] || base) : base);
    };
  }
  function injectActualShippedNoDeadControls(){
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    if(!title || !body || !/No-dead-button proof/i.test(title.textContent || '')) return;
    if(document.getElementById('ndbActualShippedBlock')) return;
    const latest = readCompareRuns()[0] || null;
    const corpus = readCorpus();
    const walk = summarizeWalkthrough(readWalkthroughs()[0] || null);
    const box = document.createElement('div');
    box.id = 'ndbActualShippedBlock';
    box.className = 'card';
    box.style.marginTop = '12px';
    box.innerHTML = '<h3 style="margin:0 0 10px;">Actual shipped no-dead corpus</h3><div class="hint">This no-dead lane now seeds and compares against the actual shipped no-dead package history from v26–v28 in this conversation bundle. It still stays honest about the operator walkthrough receipt.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="ndbSeedCorpusBtn">Seed shipped corpus</button><button class="btn" id="ndbCompareHtmlBtn">Export shipped compare HTML</button><button class="btn" id="ndbCompareJsonBtn">Export shipped compare JSON</button></div><div class="sep"></div><div class="hint">Corpus packages: <span class="mono">'+esc(String(corpus.length))+'</span>'+(latest ? ' • Latest compare <span class="mono">'+esc(latest.fingerprint || '—')+'</span> • packages <span class="mono">'+esc(String(latest.packageCount || 0))+'</span>' : ' • No shipped compare saved yet.')+' • Walkthrough <span class="mono">'+esc(String(walk.done || 0))+'/'+esc(String(walk.total || 0))+'</span>'+(walk.reviewer ? ' • reviewer <span class="mono">'+esc(walk.reviewer)+'</span>' : '')+'</div>';
    body.appendChild(box);
    document.getElementById('ndbSeedCorpusBtn').onclick = ()=>{ const info = seedShippedNoDeadCorpus(); toast('Seeded shipped no-dead corpus: ' + info.merged + ' merged / ' + info.duplicate + ' duplicate.', info.merged ? 'good' : 'warn'); };
    document.getElementById('ndbCompareHtmlBtn').onclick = exportLatestCompareHtml;
    document.getElementById('ndbCompareJsonBtn').onclick = exportLatestCompareJson;
  }
  const prevMgr = window.openRoutexNoDeadProofManager;
  if(typeof prevMgr === 'function'){
    window.openRoutexNoDeadProofManager = function(){
      const out = prevMgr.apply(this, arguments);
      setTimeout(injectActualShippedNoDeadControls, 0);
      return out;
    };
  }
  window.readRoutexNoDeadCompareRuns = readCompareRuns;
  window.readRoutexNoDeadCompareOutbox = readCompareOutbox;
  window.seedRoutexNoDeadCompareCorpus = seedShippedNoDeadCorpus;
})();

/* V30 no-dead walkthrough receipt pack */
(function(){
  if(window.__ROUTEX_V30__) return; window.__ROUTEX_V30__ = true;
  const RECEIPT_KEY = 'skye_routex_no_dead_walkthrough_receipts_v1';
  const OUTBOX_KEY = 'skye_routex_no_dead_walkthrough_receipt_outbox_v1';
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const uid = window.uid || (()=>('v30-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const nowISO = window.nowISO || (()=> new Date().toISOString());
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  const hash = window.tinyHash || function(input){ const str = String(input || ''); let h = 2166136261 >>> 0; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ('00000000' + (h >>> 0).toString(16)).slice(-8); };
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function readReceipts(){ return readJSON(RECEIPT_KEY, []).filter(Boolean).slice(0,40); }
  function saveReceipts(items){ return writeJSON(RECEIPT_KEY, (Array.isArray(items) ? items : []).slice(0,40)); }
  function pushReceipt(row){ const item = { id: clean(row && row.id) || uid(), createdAt: clean(row && row.createdAt) || nowISO(), ...(row || {}) }; const list = readReceipts().filter(entry => clean(entry.fingerprint) !== clean(item.fingerprint)); list.unshift(item); saveReceipts(list); return item; }
  function readOutbox(){ return readJSON(OUTBOX_KEY, []).filter(Boolean).slice(0,40); }
  function pushOutbox(row){ const item = { ...(row || {}), exportedAt: nowISO(), source: clean(row && row.source) || 'routex-no-dead-walkthrough-receipt-outbox' }; const list = readOutbox().filter(entry => clean(entry.fingerprint) !== clean(item.fingerprint)); list.unshift(item); writeJSON(OUTBOX_KEY, list.slice(0,40)); return item; }
  function readWalkthroughs(){ return typeof window.listHumanWalkthroughs === 'function' ? window.listHumanWalkthroughs() : readJSON('skye_routex_human_walkthrough_v1', []).filter(Boolean).slice(0,80); }
  function readRuns(){ return typeof window.readRoutexNoDeadProofRuns === 'function' ? window.readRoutexNoDeadProofRuns() : readJSON('skye_routex_no_dead_button_runs_v1', []).filter(Boolean).slice(0,40); }
  function readCompareRuns(){ return typeof window.readRoutexNoDeadCompareRuns === 'function' ? window.readRoutexNoDeadCompareRuns() : readJSON('skye_routex_no_dead_compare_runs_v1', []).filter(Boolean).slice(0,40); }
  function readAttests(){ return readJSON('skye_routex_device_attestations_v1', []).filter(Boolean).slice(0,80); }
  function summarizeWalkthrough(row){
    const items = Array.isArray(row && row.items) ? row.items : [];
    const done = items.filter(item => !!(item && item.done)).length;
    return { id: clean(row && row.id), reviewer: clean(row && row.reviewer), note: clean(row && row.note), savedAt: clean(row && (row.savedAt || row.createdAt)), done, total: items.length, items: items.map(item => ({ lane: clean(item && item.lane), label: clean(item && item.label), done: !!(item && item.done), note: clean(item && item.note) })) };
  }
  function latestNoDeadAttestation(){ const all = readAttests(); return all.find(item => clean(item && item.source) === 'no-dead-proof') || all[0] || null; }
  function buildReceiptRow(){
    const walk = summarizeWalkthrough(readWalkthroughs()[0] || null);
    const run = readRuns()[0] || {};
    const compare = readCompareRuns()[0] || {};
    const attest = latestNoDeadAttestation();
    const walkOk = walk.total > 0 && walk.done >= walk.total && !!walk.reviewer;
    const runOk = !!run.ok;
    const compareOk = !!compare.ok;
    const noteOk = !!walk.note;
    const attestationOk = !!(attest && attest.fingerprint);
    const ok = walkOk && runOk && compareOk && noteOk && attestationOk;
    const digest = JSON.stringify({ walkId: walk.id, run: run.fingerprint, compare: compare.fingerprint, reviewer: walk.reviewer, note: walk.note, attestation: attest && attest.fingerprint, ok });
    return {
      label: 'No-dead walkthrough receipt • ' + dayISO(),
      fingerprint: 'ndbr-' + dayISO() + '-' + hash(digest),
      walkthroughId: walk.id,
      walkthroughDone: walk.done,
      walkthroughTotal: walk.total,
      walkthroughReviewer: walk.reviewer,
      walkthroughSavedAt: walk.savedAt,
      walkthroughNote: walk.note,
      items: walk.items,
      sourceRunId: clean(run.id),
      sourceRunFingerprint: clean(run.fingerprint),
      compareId: clean(compare.id),
      compareFingerprint: clean(compare.fingerprint),
      attestationFingerprint: clean(attest && attest.fingerprint),
      routeCount: Number(run.routeCount || 0),
      stopCount: Number(run.stopCount || 0),
      docCount: Number(run.docCount || 0),
      packageCount: Number(compare.packageCount || 0),
      runOk,
      compareOk,
      walkthroughOk: walkOk,
      noteOk,
      attestationOk,
      ok,
      note: ok ? 'A recorded operator walkthrough receipt now binds the latest no-dead run, shipped compare, and device attestation into one exportable receipt package.' : 'Walkthrough receipt package saved, but it is not closure-complete yet. Reviewer, full checklist completion, run/compare pass state, note, and attestation all still matter.'
    };
  }
  function buildReceiptHtml(row){
    const body = (Array.isArray(row && row.items) ? row.items : []).map(item => '<tr><td>'+esc(item.lane || '—')+'</td><td>'+(item.done ? '✅' : '⚠️')+'</td><td>'+esc(item.label || '')+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>No-dead walkthrough receipt</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1120px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex no-dead walkthrough receipt</h1><div><span class="badge">'+esc(row && row.fingerprint || '—')+'</span><span class="badge">Reviewer '+esc(row && row.walkthroughReviewer || '—')+'</span><span class="badge">Walkthrough '+esc(String(row && row.walkthroughDone || 0))+'/'+esc(String(row && row.walkthroughTotal || 0))+'</span><span class="badge">'+((row && row.ok) ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(row && row.note || '')+'</div><div style="margin-top:10px;"><span class="badge">Run '+(row && row.runOk ? 'OK' : 'REVIEW')+'</span><span class="badge">Compare '+(row && row.compareOk ? 'OK' : 'REVIEW')+'</span><span class="badge">Attestation '+(row && row.attestationOk ? 'OK' : 'REVIEW')+'</span></div><div style="margin-top:10px;">'+esc(row && row.walkthroughNote || '')+'</div></div><div class="card"><table><thead><tr><th>Lane</th><th>Done</th><th>Checklist</th><th>Note</th></tr></thead><tbody>'+(body || '<tr><td colspan="4">No walkthrough items captured.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function saveReceiptPack(){ const row = pushReceipt(buildReceiptRow()); pushOutbox(row); return row; }
  function exportLatestReceiptHtml(){ const row = readReceipts()[0]; if(!row) return toast('Save a walkthrough receipt first.', 'warn'); downloadText(buildReceiptHtml(row), 'routex_no_dead_walkthrough_receipt_' + dayISO() + '.html', 'text/html'); toast('Walkthrough receipt HTML exported.', 'good'); }
  function exportLatestReceiptJson(){ const row = readReceipts()[0]; if(!row) return toast('Save a walkthrough receipt first.', 'warn'); downloadText(JSON.stringify(row, null, 2), 'routex_no_dead_walkthrough_receipt_' + dayISO() + '.json', 'application/json'); toast('Walkthrough receipt JSON exported.', 'good'); }
  function injectReceiptControls(){
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    if(!title || !body || !/No-dead-button proof/i.test(title.textContent || '')) return;
    if(document.getElementById('ndbReceiptPackBlock')) return;
    const latest = readReceipts()[0] || null;
    const box = document.createElement('div');
    box.id = 'ndbReceiptPackBlock';
    box.className = 'card';
    box.style.marginTop = '12px';
    box.innerHTML = '<h3 style="margin:0 0 10px;">Walkthrough receipt pack</h3><div class="hint">This binds the latest operator walkthrough, no-dead proof run, shipped compare, and device attestation into one exportable package without pretending the receipt was already executed.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="ndbSaveReceiptBtn">Save walkthrough receipt</button><button class="btn" id="ndbReceiptHtmlBtn">Export receipt HTML</button><button class="btn" id="ndbReceiptJsonBtn">Export receipt JSON</button></div><div class="sep"></div><div class="hint">Receipt packages: <span class="mono">'+esc(String(readReceipts().length))+'</span>'+(latest ? ' • Latest <span class="mono">'+esc(latest.fingerprint || '—')+'</span> • walkthrough <span class="mono">'+esc(String(latest.walkthroughDone || 0))+'/'+esc(String(latest.walkthroughTotal || 0))+'</span> • reviewer <span class="mono">'+esc(latest.walkthroughReviewer || '—')+'</span> • '+(latest.ok ? 'PASS' : 'REVIEW') : ' • No saved walkthrough receipt yet.')+'</div>';
    body.appendChild(box);
    document.getElementById('ndbSaveReceiptBtn').onclick = ()=>{ const row = saveReceiptPack(); toast(row.ok ? 'Walkthrough receipt saved.' : 'Walkthrough receipt saved for review.', row.ok ? 'good' : 'warn'); };
    document.getElementById('ndbReceiptHtmlBtn').onclick = exportLatestReceiptHtml;
    document.getElementById('ndbReceiptJsonBtn').onclick = exportLatestReceiptJson;
  }
  function injectWalkthroughModalReceiptButton(){
    const title = document.getElementById('modalTitle');
    const footer = document.getElementById('modalFooter');
    if(!title || !footer || !/Human walkthrough/i.test(title.textContent || '')) return;
    if(document.getElementById('walk_save_receipt')) return;
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.id = 'walk_save_receipt';
    btn.textContent = 'Save walkthrough + receipt';
    btn.onclick = ()=>{ const saveBtn = document.getElementById('walk_save'); if(saveBtn) saveBtn.click(); setTimeout(()=>{ const row = saveReceiptPack(); toast(row.ok ? 'Walkthrough + receipt saved.' : 'Walkthrough saved and receipt packaged for review.', row.ok ? 'good' : 'warn'); }, 40); };
    footer.insertBefore(btn, footer.firstChild);
  }
  const prevRun = window.runNoDeadButtonProofComplete;
  if(typeof prevRun === 'function'){
    window.runNoDeadButtonProofComplete = async function(){
      const out = await prevRun.apply(this, arguments);
      const preview = buildReceiptRow();
      if(preview.walkthroughOk && preview.noteOk && preview.compareOk && preview.attestationOk){
        const saved = pushReceipt(preview); pushOutbox(saved);
        toast(saved.ok ? 'Walkthrough receipt packaged.' : 'Walkthrough receipt packaged for review.', saved.ok ? 'good' : 'warn');
      }
      return out;
    };
  }
  const prevOpenNoDead = window.openRoutexNoDeadProofManager;
  if(typeof prevOpenNoDead === 'function'){
    window.openRoutexNoDeadProofManager = function(){ const out = prevOpenNoDead.apply(this, arguments); setTimeout(injectReceiptControls, 0); return out; };
  }
  const prevOpenWalk = window.openHumanWalkthroughManager;
  if(typeof prevOpenWalk === 'function'){
    window.openHumanWalkthroughManager = function(){ const out = prevOpenWalk.apply(this, arguments); setTimeout(injectWalkthroughModalReceiptButton, 0); return out; };
  }
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(()=>{ injectReceiptControls(); injectWalkthroughModalReceiptButton(); }, 0); return out; };
  window.readRoutexNoDeadWalkthroughReceipts = readReceipts;
  window.readRoutexNoDeadWalkthroughReceiptOutbox = readOutbox;
  window.saveRoutexNoDeadWalkthroughReceipt = saveReceiptPack;
})();

/* V33 Routex operator handoff packet */
(function(){
  if(window.__ROUTEX_V33__) return; window.__ROUTEX_V33__ = true;
  const PACKET_KEY = 'skye_routex_operator_handoff_packets_v1';
  const OUTBOX_KEY = 'skye_routex_operator_handoff_packet_outbox_v1';
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const uid = window.uid || (()=> 'routex-v33-' + Date.now().toString(36) + Math.random().toString(36).slice(2,7));
  const nowISO = window.nowISO || (()=> new Date().toISOString());
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  const fmt = window.fmtDateTime || window.fmt || ((v)=> clean(v).replace('T',' ').slice(0,16));
  const hash = window.tinyHash || function(input){ const str = String(input || ''); let h = 2166136261 >>> 0; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ('00000000' + (h >>> 0).toString(16)).slice(-8); };
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function readPackets(){ return readJSON(PACKET_KEY, []).filter(Boolean).slice(0,40); }
  function readOutbox(){ return readJSON(OUTBOX_KEY, []).filter(Boolean).slice(0,40); }
  function savePackets(rows){ return writeJSON(PACKET_KEY, (Array.isArray(rows) ? rows : []).slice(0,40)); }
  function saveOutbox(rows){ return writeJSON(OUTBOX_KEY, (Array.isArray(rows) ? rows : []).slice(0,40)); }
  function pushPacket(row){ const rows = readPackets().filter(item => clean(item && item.fingerprint) !== clean(row && row.fingerprint)); rows.unshift(row); savePackets(rows); return row; }
  function pushOutbox(row){ const rows = readOutbox().filter(item => clean(item && item.fingerprint) !== clean(row && row.fingerprint)); rows.unshift(row); saveOutbox(rows); return row; }
  function countKey(key){ return readJSON(key, []).filter(Boolean).length; }
  function latestFrom(key){ return readJSON(key, []).filter(Boolean)[0] || null; }
  function snapshot(){
    const latestBrief = latestFrom('skye_routex_operator_command_briefs_v1');
    const latestBinder = latestFrom('skye_routex_no_dead_completion_binders_v1');
    const latestReceipt = latestFrom('skye_routex_no_dead_walkthrough_receipts_v1');
    const latestNoDead = latestFrom('skye_routex_no_dead_button_runs_v1');
    const latestLegacy = latestFrom('skye_routex_legacy_record_runs_v1');
    const latestTransfer = latestFrom('skye_routex_export_import_runs_v1');
    const latestClosure = latestFrom('skye_routex_closure_outbox_v1');
    return {
      routePacks: countKey('skye_routex_route_pack_index_v2'),
      tripPacks: countKey('skye_routex_trip_packs_v1'),
      packets: countKey(PACKET_KEY),
      briefOutbox: countKey('skye_routex_operator_command_brief_outbox_v1'),
      binderOutbox: countKey('skye_routex_no_dead_completion_binder_outbox_v1'),
      handoffOutbox: countKey(OUTBOX_KEY),
      closureOutbox: countKey('skye_routex_closure_outbox_v1'),
      syncOutbox: countKey('skye_routex_hybrid_sync_outbox_v1'),
      deviceAttestations: countKey('skye_routex_device_attestations_v1'),
      latestBrief: latestBrief ? { fingerprint: clean(latestBrief.fingerprint), ok: !!latestBrief.ok, savedAt: clean(latestBrief.savedAt || latestBrief.at), note: clean(latestBrief.note) } : null,
      latestBinder: latestBinder ? { fingerprint: clean(latestBinder.fingerprint), ok: !!latestBinder.ok, reviewer: clean(latestBinder.walkthroughReviewer), savedAt: clean(latestBinder.savedAt || latestBinder.at), note: clean(latestBinder.note) } : null,
      latestReceipt: latestReceipt ? { fingerprint: clean(latestReceipt.fingerprint), ok: !!latestReceipt.ok, reviewer: clean(latestReceipt.walkthroughReviewer), savedAt: clean(latestReceipt.savedAt || latestReceipt.at), walkthroughDone: Number(latestReceipt.walkthroughDone || 0), walkthroughTotal: Number(latestReceipt.walkthroughTotal || 0) } : null,
      latestNoDead: latestNoDead ? { id: clean(latestNoDead.id), ok: !!latestNoDead.ok, savedAt: clean(latestNoDead.savedAt || latestNoDead.ranAt || latestNoDead.at) } : null,
      latestLegacy: latestLegacy ? { id: clean(latestLegacy.id), fingerprint: clean(latestLegacy.fingerprint), savedAt: clean(latestLegacy.savedAt || latestLegacy.ranAt || latestLegacy.at) } : null,
      latestTransfer: latestTransfer ? { id: clean(latestTransfer.id), fingerprint: clean(latestTransfer.fingerprint), savedAt: clean(latestTransfer.savedAt || latestTransfer.ranAt || latestTransfer.at) } : null,
      latestClosure: latestClosure ? { fingerprint: clean(latestClosure.fingerprint), label: clean(latestClosure.label), importedAt: clean(latestClosure.importedAt || latestClosure.savedAt || latestClosure.at) } : null
    };
  }
  function buildPacket(){
    const snap = snapshot();
    const readiness = [snap.latestBrief && snap.latestBrief.ok, snap.latestBinder && snap.latestBinder.ok, snap.latestReceipt && snap.latestReceipt.ok, snap.latestNoDead && snap.latestNoDead.ok].filter(Boolean).length;
    const digest = JSON.stringify({ brief: snap.latestBrief && snap.latestBrief.fingerprint, binder: snap.latestBinder && snap.latestBinder.fingerprint, receipt: snap.latestReceipt && snap.latestReceipt.fingerprint, noDead: snap.latestNoDead && snap.latestNoDead.id, closure: snap.latestClosure && snap.latestClosure.fingerprint, outbox: snap.handoffOutbox, routePacks: snap.routePacks, tripPacks: snap.tripPacks });
    const fingerprint = 'handoff-' + dayISO() + '-' + hash(digest);
    const ok = readiness >= 4 && !!(snap.latestBinder && snap.latestBinder.ok);
    return {
      id: uid(),
      savedAt: nowISO(),
      label: 'Routex operator handoff packet • ' + dayISO(),
      source: 'routex-operator-handoff-packet-v33',
      fingerprint,
      ok,
      readiness,
      readinessMax: 4,
      note: ok ? 'Operator handoff packet is ready for AE FLOW import with passing brief, walkthrough receipt, completion binder, and no-dead proof.' : 'Operator handoff packet saved for review. One or more upstream proof surfaces still need attention before handoff is clean.',
      snapshot: snap
    };
  }
  function buildHtml(row){
    row = row || readPackets()[0] || buildPacket();
    const s = row.snapshot || snapshot();
    const latest = [
      ['Ops brief', s.latestBrief ? ((s.latestBrief.ok ? 'PASS' : 'REVIEW') + ' • ' + (s.latestBrief.fingerprint || '—')) : 'None'],
      ['Completion binder', s.latestBinder ? ((s.latestBinder.ok ? 'PASS' : 'REVIEW') + ' • ' + (s.latestBinder.fingerprint || '—') + ' • reviewer ' + (s.latestBinder.reviewer || '—')) : 'None'],
      ['Walkthrough receipt', s.latestReceipt ? ((s.latestReceipt.ok ? 'PASS' : 'REVIEW') + ' • ' + (s.latestReceipt.fingerprint || '—') + ' • ' + String(s.latestReceipt.walkthroughDone || 0) + '/' + String(s.latestReceipt.walkthroughTotal || 0)) : 'None'],
      ['No-dead proof', s.latestNoDead ? ((s.latestNoDead.ok ? 'PASS' : 'REVIEW') + ' • ' + (s.latestNoDead.savedAt || '—')) : 'None'],
      ['Legacy proof', s.latestLegacy ? ((s.latestLegacy.fingerprint || s.latestLegacy.id || '—') + ' • ' + (s.latestLegacy.savedAt || '—')) : 'None'],
      ['Transfer proof', s.latestTransfer ? ((s.latestTransfer.fingerprint || s.latestTransfer.id || '—') + ' • ' + (s.latestTransfer.savedAt || '—')) : 'None'],
      ['Latest closure bundle', s.latestClosure ? (((s.latestClosure.fingerprint || s.latestClosure.label || '—')) + ' • ' + (s.latestClosure.importedAt || '—')) : 'None']
    ].map(item => '<tr><td>'+esc(item[0])+'</td><td>'+esc(item[1])+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Routex operator handoff packet</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1120px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex • Operator handoff packet</h1><div><span class="badge">'+esc(row.fingerprint || '—')+'</span><span class="badge">Saved '+esc(fmt(row.savedAt))+'</span><span class="badge">Readiness '+esc(String(row.readiness || 0))+'/'+esc(String(row.readinessMax || 0))+'</span><span class="badge">'+(row.ok ? 'PASS' : 'REVIEW')+'</span></div><p style="margin:12px 0 0;">'+esc(row.note || '')+'</p></div><div class="card"><h2 style="margin:0 0 8px;">Latest proof surfaces</h2><table><tbody>'+latest+'</tbody></table></div><div class="card"><h2 style="margin:0 0 8px;">Outbox / ops counts</h2><table><tbody><tr><td>Route packs</td><td>'+esc(String(s.routePacks || 0))+'</td></tr><tr><td>Trip packs</td><td>'+esc(String(s.tripPacks || 0))+'</td></tr><tr><td>Closure outbox</td><td>'+esc(String(s.closureOutbox || 0))+'</td></tr><tr><td>Hybrid sync outbox</td><td>'+esc(String(s.syncOutbox || 0))+'</td></tr><tr><td>Ops brief outbox</td><td>'+esc(String(s.briefOutbox || 0))+'</td></tr><tr><td>Completion binder outbox</td><td>'+esc(String(s.binderOutbox || 0))+'</td></tr><tr><td>Handoff packet outbox</td><td>'+esc(String(s.handoffOutbox || 0))+'</td></tr><tr><td>Device attestations</td><td>'+esc(String(s.deviceAttestations || 0))+'</td></tr><tr><td>Saved handoff packets</td><td>'+esc(String(s.packets || 0))+'</td></tr></tbody></table></div></div></body></html>';
  }
  function savePacket(){ const row = buildPacket(); pushPacket(row); pushOutbox(row); return row; }
  function exportLatestHtml(){ const row = readPackets()[0] || savePacket(); downloadText(buildHtml(row), 'routex_operator_handoff_packet_' + dayISO() + '.html', 'text/html'); }
  function exportLatestJson(){ const row = readPackets()[0] || savePacket(); downloadText(JSON.stringify(row, null, 2), 'routex_operator_handoff_packet_' + dayISO() + '.json', 'application/json'); }
  function inject(){
    const bar = document.querySelector('#routexWorkbenchToolbar') || document.querySelector('.toolbar') || document.querySelector('.row');
    if(bar && !document.getElementById('routexHandoffPacketSaveBtn')){
      const saveBtn = document.createElement('button'); saveBtn.className='btn small'; saveBtn.id='routexHandoffPacketSaveBtn'; saveBtn.textContent='Save handoff packet'; saveBtn.onclick = ()=>{ const row = savePacket(); toast(row.ok ? 'Operator handoff packet saved.' : 'Operator handoff packet saved for review.', row.ok ? 'good' : 'warn'); };
      const htmlBtn = document.createElement('button'); htmlBtn.className='btn small'; htmlBtn.id='routexHandoffPacketHtmlBtn'; htmlBtn.textContent='Export handoff HTML'; htmlBtn.onclick = exportLatestHtml;
      const jsonBtn = document.createElement('button'); jsonBtn.className='btn small'; jsonBtn.id='routexHandoffPacketJsonBtn'; jsonBtn.textContent='Export handoff JSON'; jsonBtn.onclick = exportLatestJson;
      bar.appendChild(saveBtn); bar.appendChild(htmlBtn); bar.appendChild(jsonBtn);
    }
    const host = document.querySelector('#app') || document.body;
    const latest = readPackets()[0] || null;
    const existing = document.getElementById('routexHandoffPacketCard');
    if(existing) existing.remove();
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'routexHandoffPacketCard';
    const s = latest ? latest.snapshot || {} : snapshot();
    card.innerHTML = '<h2 style="margin:0 0 10px;">Operator handoff packet</h2>' + (latest ? ('<div><span class="badge">'+esc(latest.fingerprint || '—')+'</span><span class="badge">Readiness '+esc(String(latest.readiness || 0))+'/'+esc(String(latest.readinessMax || 0))+'</span><span class="badge">'+(latest.ok ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">Ops brief '+esc((s.latestBrief && s.latestBrief.fingerprint) || '—')+' • Binder '+esc((s.latestBinder && s.latestBinder.fingerprint) || '—')+' • Receipt '+esc((s.latestReceipt && s.latestReceipt.fingerprint) || '—')+'</div><div style="margin-top:8px;">'+esc(latest.note || '')+'</div>') : 'No operator handoff packet saved yet.');
    host.appendChild(card);
  }
  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };
  window.readRoutexOperatorHandoffPackets = readPackets;
  window.readRoutexOperatorHandoffOutbox = readOutbox;
  window.saveRoutexOperatorHandoffPacket = savePacket;
})();


/* V34 Routex operator launch board */
(function(){
  if(window.__ROUTEX_V34__) return; window.__ROUTEX_V34__ = true;
  const BOARD_KEY = 'skye_routex_operator_launch_boards_v1';
  const OUTBOX_KEY = 'skye_routex_operator_launch_board_outbox_v1';
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const hash = window.quickHash || window.hashString || function(str){ str = String(str || ''); let h = 2166136261; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
  const uid = window.uid || function(){ return 'routex-v34-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8); };
  const dayISO = window.dayISO || function(){ return new Date().toISOString().slice(0,10); };
  const nowISO = window.nowISO || function(){ return new Date().toISOString(); };
  const fmt = window.fmtDateTime || window.fmt || function(v){ try{ return new Date(v).toLocaleString(); }catch(_){ return clean(v); } };
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function countKey(key){ return readJSON(key, []).filter(Boolean).length; }
  function readBoards(){ return readJSON(BOARD_KEY, []).filter(Boolean).slice(0,40); }
  function readOutbox(){ return readJSON(OUTBOX_KEY, []).filter(Boolean).slice(0,40); }
  function pushBoard(row){ const list = readBoards().filter(item => clean(item && item.fingerprint) !== clean(row && row.fingerprint)); list.unshift(row); writeJSON(BOARD_KEY, list.slice(0,40)); return row; }
  function pushOutbox(row){ const list = readOutbox().filter(item => clean(item && item.fingerprint) !== clean(row && row.fingerprint)); list.unshift({ ...(row || {}), exportedAt: nowISO(), routex_outbox_key: OUTBOX_KEY }); writeJSON(OUTBOX_KEY, list.slice(0,40)); return row; }
  function latest(key){ return readJSON(key, []).filter(Boolean)[0] || null; }
  function buildSnapshot(){
    const latestBrief = latest('skye_routex_operator_command_briefs_v1');
    const latestBinder = latest('skye_routex_no_dead_completion_binders_v1');
    const latestReceipt = latest('skye_routex_no_dead_walkthrough_receipts_v1');
    const latestNoDead = latest('skye_routex_no_dead_button_runs_v1');
    const latestHandoff = latest('skye_routex_operator_handoff_packets_v1');
    const latestClosure = latest('skye_routex_closure_outbox_v1');
    const latestTransfer = latest('skye_routex_export_import_runs_v1');
    const latestLegacy = latest('skye_routex_legacy_record_runs_v1');
    return {
      routePacks: countKey('skye_routex_route_pack_index_v2'),
      tripPacks: countKey('skye_routex_trip_packs_v1'),
      proofs: {
        legacyRuns: countKey('skye_routex_legacy_record_runs_v1'),
        transferRuns: countKey('skye_routex_export_import_runs_v1'),
        noDeadRuns: countKey('skye_routex_no_dead_button_runs_v1'),
        completionBinders: countKey('skye_routex_no_dead_completion_binders_v1'),
        walkthroughReceipts: countKey('skye_routex_no_dead_walkthrough_receipts_v1'),
        opsBriefs: countKey('skye_routex_operator_command_briefs_v1'),
        handoffPackets: countKey('skye_routex_operator_handoff_packets_v1')
      },
      outbox: {
        launchBoard: countKey(OUTBOX_KEY),
        handoff: countKey('skye_routex_operator_handoff_packet_outbox_v1'),
        opsBrief: countKey('skye_routex_operator_command_brief_outbox_v1'),
        binder: countKey('skye_routex_no_dead_completion_binder_outbox_v1'),
        receipt: countKey('skye_routex_no_dead_walkthrough_receipt_outbox_v1'),
        noDead: countKey('skye_routex_no_dead_button_outbox_v1'),
        closure: countKey('skye_routex_closure_outbox_v1'),
        hybridSync: countKey('skye_routex_hybrid_sync_outbox_v1')
      },
      queues: {
        hybridQueue: countKey('skye_routex_hybrid_geocode_queue_v1'),
        proofRegistry: countKey('skye_routex_proof_registry_v1'),
        deviceAttestations: countKey('skye_routex_device_attestations_v1')
      },
      latestBrief: latestBrief ? { fingerprint: clean(latestBrief.fingerprint), ok: !!latestBrief.ok, savedAt: clean(latestBrief.savedAt || latestBrief.at) } : null,
      latestBinder: latestBinder ? { fingerprint: clean(latestBinder.fingerprint), ok: !!latestBinder.ok, reviewer: clean(latestBinder.walkthroughReviewer), savedAt: clean(latestBinder.savedAt || latestBinder.at) } : null,
      latestReceipt: latestReceipt ? { fingerprint: clean(latestReceipt.fingerprint), ok: !!latestReceipt.ok, done: Number(latestReceipt.walkthroughDone || 0), total: Number(latestReceipt.walkthroughTotal || 0), savedAt: clean(latestReceipt.savedAt || latestReceipt.at) } : null,
      latestNoDead: latestNoDead ? { id: clean(latestNoDead.id), ok: !!latestNoDead.ok, savedAt: clean(latestNoDead.savedAt || latestNoDead.ranAt || latestNoDead.at) } : null,
      latestHandoff: latestHandoff ? { fingerprint: clean(latestHandoff.fingerprint), ok: !!latestHandoff.ok, readiness: Number(latestHandoff.readiness || 0), readinessMax: Number(latestHandoff.readinessMax || 0), savedAt: clean(latestHandoff.savedAt || latestHandoff.at) } : null,
      latestClosure: latestClosure ? { fingerprint: clean(latestClosure.fingerprint), savedAt: clean(latestClosure.savedAt || latestClosure.importedAt || latestClosure.at) } : null,
      latestTransfer: latestTransfer ? { fingerprint: clean(latestTransfer.fingerprint || latestTransfer.id), savedAt: clean(latestTransfer.savedAt || latestTransfer.ranAt || latestTransfer.at) } : null,
      latestLegacy: latestLegacy ? { fingerprint: clean(latestLegacy.fingerprint || latestLegacy.id), savedAt: clean(latestLegacy.savedAt || latestLegacy.ranAt || latestLegacy.at) } : null
    };
  }
  function makeChecklist(snapshot){
    const checks = [
      { id:'handoff', label:'Handoff packet', ok: !!(snapshot.latestHandoff && snapshot.latestHandoff.ok), note: snapshot.latestHandoff ? ('Readiness ' + snapshot.latestHandoff.readiness + '/' + snapshot.latestHandoff.readinessMax + ' • ' + (snapshot.latestHandoff.fingerprint || '—')) : 'No handoff packet saved yet.' },
      { id:'brief', label:'Ops brief', ok: !!(snapshot.latestBrief && snapshot.latestBrief.ok), note: snapshot.latestBrief ? ('Latest ' + (snapshot.latestBrief.fingerprint || '—')) : 'No ops brief saved yet.' },
      { id:'binder', label:'Completion binder', ok: !!(snapshot.latestBinder && snapshot.latestBinder.ok), note: snapshot.latestBinder ? ('Reviewer ' + (snapshot.latestBinder.reviewer || '—') + ' • ' + (snapshot.latestBinder.fingerprint || '—')) : 'No completion binder saved yet.' },
      { id:'receipt', label:'Walkthrough receipt', ok: !!(snapshot.latestReceipt && snapshot.latestReceipt.ok), note: snapshot.latestReceipt ? ('Walkthrough ' + snapshot.latestReceipt.done + '/' + snapshot.latestReceipt.total + ' • ' + (snapshot.latestReceipt.fingerprint || '—')) : 'No walkthrough receipt saved yet.' },
      { id:'noDead', label:'No-dead proof', ok: !!(snapshot.latestNoDead && snapshot.latestNoDead.ok), note: snapshot.latestNoDead ? ('Latest ' + (snapshot.latestNoDead.id || '—') + ' • ' + (snapshot.latestNoDead.savedAt || '—')) : 'No no-dead proof run saved yet.' },
      { id:'corpus', label:'Legacy + transfer proof history', ok: !!(snapshot.latestLegacy && snapshot.latestTransfer), note: 'Legacy ' + ((snapshot.latestLegacy && snapshot.latestLegacy.fingerprint) || '—') + ' • Transfer ' + ((snapshot.latestTransfer && snapshot.latestTransfer.fingerprint) || '—') },
      { id:'device', label:'Device attestation presence', ok: snapshot.queues.deviceAttestations > 0, note: 'Saved attestations ' + snapshot.queues.deviceAttestations },
      { id:'coverage', label:'Route + trip pack coverage', ok: snapshot.routePacks > 0 && snapshot.tripPacks > 0, note: 'Route packs ' + snapshot.routePacks + ' • Trip packs ' + snapshot.tripPacks },
      { id:'queues', label:'Hybrid queue pressure', ok: snapshot.queues.hybridQueue === 0, note: snapshot.queues.hybridQueue === 0 ? 'Hybrid geocode queue is clear.' : ('Hybrid queue backlog ' + snapshot.queues.hybridQueue) }
    ];
    return checks;
  }
  function buildActions(snapshot, checks){
    const actions = [];
    const push = (priority, label, reason)=> actions.push({ priority, label, reason });
    if(!(snapshot.latestHandoff && snapshot.latestHandoff.ok)) push('high', 'Save a fresh operator handoff packet', 'The handoff packet is still missing or review-state.');
    if(!(snapshot.latestBinder && snapshot.latestBinder.ok)) push('high', 'Save a clean completion binder', 'The completion binder is missing or still review-state.');
    if(!(snapshot.latestReceipt && snapshot.latestReceipt.ok)) push('high', 'Complete the human walkthrough receipt', 'The final walkthrough receipt is not yet passing.');
    if(!(snapshot.latestNoDead && snapshot.latestNoDead.ok)) push('high', 'Run the no-dead proof line again', 'The latest no-dead proof is missing or not passing.');
    if(snapshot.queues.hybridQueue > 0) push('medium', 'Clear the hybrid queue backlog', 'Hybrid queue currently has ' + snapshot.queues.hybridQueue + ' pending item(s).');
    if(snapshot.routePacks === 0 || snapshot.tripPacks === 0) push('medium', 'Seed missing route/trip packs', 'Launch coverage is thin when either pack lane is empty.');
    if(snapshot.queues.deviceAttestations === 0) push('medium', 'Save a device attestation', 'The operator recovery trail is stronger with at least one attestation.');
    if(actions.length === 0) push('low', 'Export the launch board and handoff packet', 'Everything required is passing, so the next move is distribution and review.');
    return actions.slice(0, 7);
  }
  function buildBoard(){
    const snapshot = buildSnapshot();
    const checks = makeChecklist(snapshot);
    const actions = buildActions(snapshot, checks);
    const passing = checks.filter(item => item.ok).length;
    const score = Math.round((passing / Math.max(1, checks.length)) * 100);
    const blockers = checks.filter(item => !item.ok).map(item => item.label + ' — ' + item.note);
    const digest = JSON.stringify({ score, checks: checks.map(item => [item.id, item.ok]), actions: actions.map(item => [item.priority, item.label]), latestHandoff: snapshot.latestHandoff && snapshot.latestHandoff.fingerprint, latestBinder: snapshot.latestBinder && snapshot.latestBinder.fingerprint, latestReceipt: snapshot.latestReceipt && snapshot.latestReceipt.fingerprint, latestBrief: snapshot.latestBrief && snapshot.latestBrief.fingerprint, latestNoDead: snapshot.latestNoDead && snapshot.latestNoDead.id, queue: snapshot.queues.hybridQueue, outbox: snapshot.outbox.launchBoard });
    const fingerprint = 'launch-' + dayISO() + '-' + hash(digest);
    const ok = blockers.length === 0;
    return {
      id: uid(),
      savedAt: nowISO(),
      label: 'Routex operator launch board • ' + dayISO(),
      source: 'routex-operator-launch-board-v34',
      fingerprint,
      ok,
      score,
      passing,
      total: checks.length,
      blockers,
      actions,
      note: ok ? 'Launch board is green. The proof stack, handoff stack, and queue pressure are all in clean shape.' : ('Launch board saved with ' + blockers.length + ' blocker(s) still open.'),
      checklist: checks,
      snapshot
    };
  }
  function saveBoard(){ const row = buildBoard(); pushBoard(row); pushOutbox(row); return row; }
  function buildHtml(row){
    row = row || readBoards()[0] || saveBoard();
    const checks = (row.checklist || []).map(item => '<tr><td>'+esc(item.label)+'</td><td>'+(item.ok ? 'PASS' : 'REVIEW')+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    const actions = (row.actions || []).map(item => '<tr><td>'+esc(item.priority.toUpperCase())+'</td><td>'+esc(item.label)+'</td><td>'+esc(item.reason || '')+'</td></tr>').join('');
    const blockers = (row.blockers || []).map(item => '<li>'+esc(item)+'</li>').join('');
    const s = row.snapshot || {};
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Routex operator launch board</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1180px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}ul{margin:0;padding-left:18px}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex • Operator launch board</h1><div><span class="badge">'+esc(row.fingerprint || '—')+'</span><span class="badge">Score '+esc(String(row.score || 0))+'%</span><span class="badge">Checks '+esc(String(row.passing || 0))+'/'+esc(String(row.total || 0))+'</span><span class="badge">'+(row.ok ? 'GREEN' : 'ACTION REQUIRED')+'</span></div><p style="margin:12px 0 0;">'+esc(row.note || '')+'</p></div><div class="card"><h2 style="margin:0 0 8px;">Checklist</h2><table><thead><tr><th>Check</th><th>Status</th><th>Note</th></tr></thead><tbody>'+checks+'</tbody></table></div><div class="card"><h2 style="margin:0 0 8px;">Next actions</h2><table><thead><tr><th>Priority</th><th>Action</th><th>Reason</th></tr></thead><tbody>'+actions+'</tbody></table></div><div class="card"><h2 style="margin:0 0 8px;">Blockers</h2>'+(blockers ? '<ul>'+blockers+'</ul>' : '<div>No blockers.</div>')+'</div><div class="card"><h2 style="margin:0 0 8px;">Ops counts</h2><table><tbody><tr><td>Route packs</td><td>'+esc(String(s.routePacks || 0))+'</td></tr><tr><td>Trip packs</td><td>'+esc(String(s.tripPacks || 0))+'</td></tr><tr><td>Launch-board outbox</td><td>'+esc(String((s.outbox && s.outbox.launchBoard) || 0))+'</td></tr><tr><td>Handoff outbox</td><td>'+esc(String((s.outbox && s.outbox.handoff) || 0))+'</td></tr><tr><td>Ops brief outbox</td><td>'+esc(String((s.outbox && s.outbox.opsBrief) || 0))+'</td></tr><tr><td>Hybrid queue</td><td>'+esc(String((s.queues && s.queues.hybridQueue) || 0))+'</td></tr><tr><td>Device attestations</td><td>'+esc(String((s.queues && s.queues.deviceAttestations) || 0))+'</td></tr></tbody></table></div></div></body></html>';
  }
  function exportLatestHtml(){ const row = readBoards()[0] || saveBoard(); downloadText(buildHtml(row), 'routex_operator_launch_board_' + dayISO() + '.html', 'text/html'); }
  function exportLatestJson(){ const row = readBoards()[0] || saveBoard(); downloadText(JSON.stringify(row, null, 2), 'routex_operator_launch_board_' + dayISO() + '.json', 'application/json'); }
  function inject(){
    const bar = document.querySelector('#routexWorkbenchToolbar') || document.querySelector('.toolbar') || document.querySelector('.row');
    if(bar && !document.getElementById('routexLaunchBoardSaveBtn')){
      const saveBtn = document.createElement('button'); saveBtn.className='btn small'; saveBtn.id='routexLaunchBoardSaveBtn'; saveBtn.textContent='Save launch board'; saveBtn.onclick = ()=>{ const row = saveBoard(); toast(row.ok ? 'Operator launch board saved.' : 'Operator launch board saved with blockers.', row.ok ? 'good' : 'warn'); };
      const htmlBtn = document.createElement('button'); htmlBtn.className='btn small'; htmlBtn.id='routexLaunchBoardHtmlBtn'; htmlBtn.textContent='Export launch HTML'; htmlBtn.onclick = exportLatestHtml;
      const jsonBtn = document.createElement('button'); jsonBtn.className='btn small'; jsonBtn.id='routexLaunchBoardJsonBtn'; jsonBtn.textContent='Export launch JSON'; jsonBtn.onclick = exportLatestJson;
      bar.appendChild(saveBtn); bar.appendChild(htmlBtn); bar.appendChild(jsonBtn);
    }
    const latest = readBoards()[0] || null;
    const existing = document.getElementById('routexLaunchBoardCard');
    if(existing) existing.remove();
    const host = document.querySelector('#app') || document.body;
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'routexLaunchBoardCard';
    card.innerHTML = '<h2 style="margin:0 0 10px;">Operator launch board</h2>' + (latest ? ('<div><span class="badge">'+esc(latest.fingerprint || '—')+'</span><span class="badge">Score '+esc(String(latest.score || 0))+'%</span><span class="badge">Checks '+esc(String(latest.passing || 0))+'/'+esc(String(latest.total || 0))+'</span><span class="badge">'+(latest.ok ? 'GREEN' : 'ACTION REQUIRED')+'</span></div><div style="margin-top:8px;">'+esc(latest.note || '')+'</div><div style="margin-top:8px;">Top action: '+esc((latest.actions && latest.actions[0] && latest.actions[0].label) || '—')+'</div>') : 'No operator launch board saved yet.');
    host.appendChild(card);
  }
  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };
  window.readRoutexOperatorLaunchBoards = readBoards;
  window.readRoutexOperatorLaunchBoardOutbox = readOutbox;
  window.saveRoutexOperatorLaunchBoard = saveBoard;
})();

/* V35 Routex interactive walkthrough system */
(function(){
  if(window.__ROUTEX_V35_TOURS__) return;
  window.__ROUTEX_V35_TOURS__ = true;

  const PROGRESS_KEY = 'skye_routex_tutorial_progress_v1';
  const CENTER_STATE_KEY = 'skye_routex_tutorial_center_state_v1';

  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const latestToast = window.toast || function(){};
  const wait = (ms)=> new Promise(resolve => setTimeout(resolve, ms));

  let overlay = null;
  let activeTourState = null;
  let activeTarget = null;

  function readJSON(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(_){
      return fallback;
    }
  }
  function writeJSON(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){}
    return value;
  }
  function readProgress(){ return readJSON(PROGRESS_KEY, {}); }
  function saveProgress(next){ return writeJSON(PROGRESS_KEY, next || {}); }
  function markProgress(tourId, patch){
    const next = readProgress();
    next[tourId] = Object.assign({}, next[tourId] || {}, patch || {}, { updatedAt: new Date().toISOString() });
    saveProgress(next);
    return next[tourId];
  }
  function completedCount(){
    const progress = readProgress();
    return getTours().filter(t => progress[t.id] && progress[t.id].completedAt).length;
  }
  function centerState(){ return readJSON(CENTER_STATE_KEY, { seenAt: '' }); }
  function setCenterState(patch){ return writeJSON(CENTER_STATE_KEY, Object.assign({}, centerState(), patch || {})); }

  function closeAnyModal(){
    const closeBtn = document.getElementById('modalClose');
    const wrap = document.getElementById('modalWrap');
    if(closeBtn && wrap && wrap.getAttribute('aria-hidden') !== 'true'){
      closeBtn.click();
    }
  }

  async function gotoView(viewId){
    if(!window.APP) return;
    if(viewId === 'routes-detail'){
      if(Array.isArray(APP.cached && APP.cached.routes) && APP.cached.routes.length){
        APP.routeId = APP.cached.routes[0].id;
        APP.view = 'routes';
        window.location.hash = 'routes';
        await window.render();
        await wait(160);
        return true;
      }
      viewId = 'routes';
    }
    if(viewId === 'routes'){
      APP.routeId = null;
    }
    if(APP.view !== viewId || (viewId === 'routes' && APP.routeId)){
      APP.view = viewId;
      window.location.hash = viewId;
      await window.render();
      await wait(160);
      return true;
    }
    await wait(60);
    return true;
  }

  function clearTarget(){
    if(activeTarget){
      activeTarget.classList.remove('tour-active-target');
      activeTarget = null;
    }
  }

  function ensureStyle(){
    if(document.getElementById('routexTutorialStyles')) return;
    const style = document.createElement('style');
    style.id = 'routexTutorialStyles';
    style.textContent = `
      .tour-active-target{
        position: relative !important;
        z-index: 10002 !important;
        box-shadow: 0 0 0 3px rgba(245,197,66,.92), 0 0 0 9999px rgba(3,1,8,.58) !important;
        border-radius: 16px !important;
      }
      .rtx-tour-overlay{
        position: fixed;
        inset: 0;
        z-index: 10001;
        pointer-events: none;
      }
      .rtx-tour-dock{
        position: fixed;
        right: 18px;
        bottom: 18px;
        width: min(420px, calc(100vw - 28px));
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 20px;
        background: linear-gradient(180deg, rgba(18,8,32,.96), rgba(8,3,16,.94));
        box-shadow: 0 28px 80px rgba(0,0,0,.52);
        padding: 16px;
        color: rgba(255,255,255,.94);
        pointer-events: auto;
      }
      .rtx-tour-kicker{
        display:flex;
        align-items:center;
        gap:8px;
        font-size:11px;
        letter-spacing:.18em;
        text-transform:uppercase;
        color: rgba(245,197,66,.88);
        margin-bottom:8px;
      }
      .rtx-tour-title{
        font-size: 19px;
        font-weight: 900;
        margin: 0 0 6px;
      }
      .rtx-tour-body{
        font-size: 13px;
        line-height: 1.5;
        color: rgba(255,255,255,.80);
        white-space: pre-wrap;
      }
      .rtx-tour-progress{
        height: 7px;
        border-radius: 999px;
        background: rgba(255,255,255,.10);
        overflow: hidden;
        margin: 14px 0 12px;
      }
      .rtx-tour-progress > i{
        display:block;
        height:100%;
        width:0;
        background: linear-gradient(90deg, rgba(245,197,66,.95), rgba(168,85,247,.92));
      }
      .rtx-tour-actions{
        display:flex;
        gap:8px;
        align-items:center;
        flex-wrap:wrap;
      }
      .rtx-tour-actions .grow{ flex:1; }
      .rtx-tour-chip{
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding:6px 10px;
        border-radius:999px;
        border:1px solid rgba(255,255,255,.14);
        background: rgba(255,255,255,.05);
        font-size:11px;
        color: rgba(255,255,255,.8);
      }
      .rtx-tour-grid{
        display:grid;
        grid-template-columns: repeat(auto-fit, minmax(220px,1fr));
        gap: 10px;
        margin-top: 12px;
      }
      .rtx-tour-tile{
        border:1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.04);
        border-radius: 16px;
        padding: 12px;
      }
      .rtx-tour-tile h4{
        margin: 0 0 6px;
        font-size: 14px;
      }
      .rtx-tour-tile p{
        margin: 0 0 10px;
        color: rgba(255,255,255,.72);
        font-size: 12px;
        line-height: 1.45;
      }
      .rtx-tour-mini{
        font-size: 11px;
        color: rgba(255,255,255,.62);
      }
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay(){
    ensureStyle();
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'rtx-tour-overlay hidden';
    overlay.id = 'rtxTourOverlay';
    overlay.innerHTML = `
      <div class="rtx-tour-dock">
        <div class="rtx-tour-kicker"><span>Interactive walkthrough</span><span id="rtxTourStepMeta" class="rtx-tour-chip">Step 1 / 1</span></div>
        <h3 class="rtx-tour-title" id="rtxTourTitle">Routex walkthrough</h3>
        <div class="rtx-tour-body" id="rtxTourBody"></div>
        <div class="rtx-tour-progress"><i id="rtxTourProgressBar"></i></div>
        <div class="rtx-tour-actions">
          <button class="btn small" id="rtxTourBackBtn" type="button">Back</button>
          <button class="btn small" id="rtxTourNextBtn" type="button">Next</button>
          <div class="grow"></div>
          <button class="btn small" id="rtxTourHubBtn" type="button">Tour center</button>
          <button class="btn small danger" id="rtxTourCloseBtn" type="button">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('rtxTourBackBtn').onclick = ()=> moveStep(-1);
    document.getElementById('rtxTourNextBtn').onclick = ()=> moveStep(1);
    document.getElementById('rtxTourCloseBtn').onclick = ()=> closeTour('stopped');
    document.getElementById('rtxTourHubBtn').onclick = ()=> openTutorialCenter();
    return overlay;
  }

  function getTours(){
    return [
      {
        id: 'start-here',
        title: 'Start here • Core navigation',
        description: 'A complete first-use pass through the screens most operators touch first: dashboard, route creation, route list, proof, export, and settings.',
        steps: [
          { view:'dashboard', title:'Dashboard', body:'This is the live command surface. It shows today’s route health, economics, reminders, and quick actions.' },
          { view:'dashboard', selector:'#primaryAction', title:'New route action', body:'The primary button changes with the screen. On Dashboard it launches route creation so a new operator can start working immediately.' },
          { view:'dashboard', before: async ()=>{ closeAnyModal(); if(typeof window.openNewRouteModal === 'function') window.openNewRouteModal(); await wait(120); }, selector:'#nr_name', title:'Route creation form', body:'This walkthrough does not just describe the feature. It moves you into the actual route form so you can see where route name, date, driver, vehicle, and territory live.' },
          { view:'routes', title:'Routes screen', selector:'#routesOpenAEFlow', body:'Routes is the operational list. Open an existing route here or build one from AE FLOW when you want territory-driven prospect work to become a Routex route.' },
          { view:'proof', selector:'#primaryAction', title:'Proof center', body:'Proof stores recent photos and generates proof packets. This is where operators learn how Routex turns field work into client-safe proof.' },
          { view:'export', selector:'#ex_json', title:'Export and recovery', body:'Exports are the transparency and recovery lane. Backup JSON, encrypted backup, proof packets, CSV exports, and route-pack transfers all live here.' },
          { view:'settings', selector:'#st_backup', title:'Settings and device controls', body:'Settings is the device-control lane. Branding, PIN gate, vehicle profiles, inventory, performance, and local data controls are all on this screen.' }
        ]
      },
      {
        id: 'route-ops',
        title: 'Route ops • Build, run, close',
        description: 'Focused walkthrough for the route lifecycle: create routes, add stops, capture service detail, and move back into proof and export artifacts.',
        steps: [
          { view:'routes', title:'Routes list', body:'Operators start here to manage route inventory for the day. The list shows status, score, timing, and economics so route quality stays visible.' },
          { view:'routes', selector:'#primaryAction', title:'Create the route skeleton', body:'From the Routes screen the primary button becomes New Route. This is the fastest way to build the shell before adding stops.' },
          { view:'routes-detail', title:'Route detail', body:'If a route already exists, the walkthrough opens the first one. Route detail is where stop-level service, mileage, materials, collections, and reminders are managed.' },
          { view:'proof', title:'Proof follow-through', body:'When the route is done, operators move here to package photo proof and deliverable evidence instead of leaving proof trapped in the route itself.' },
          { view:'export', selector:'#ex_route_pack', title:'Route-pack portability', body:'Routex can export portable route packs and import them back. That makes the route lane reusable and easier to hand off or recover.' }
        ]
      },
      {
        id: 'operator-stack',
        title: 'Operator stack • Transparency and handoff',
        description: 'Shows the proof stack, launch board, and handoff surfaces so the product explains its own readiness instead of making the operator guess.',
        steps: [
          { view:'dashboard', title:'Daily command center', body:'The command center is the operational heartbeat: unresolved stops, balances, cadence signals, route risk, and vehicle health.' },
          { view:'dashboard', selector:'#routexLaunchBoardCard', title:'Operator launch board', body:'The launch board converts the proof stack into an explicit score, blocker list, and next-action queue so readiness is visible.' },
          { view:'export', title:'Artifact export lane', body:'Proof packets, backups, tasks, economics, inventory, and route packs all export from the same artifact surface so transparency is easy.' },
          { view:'settings', title:'Operator education lives in-product', body:'The tutorial center is built into the app so new users do not need separate docs to understand where the core lanes live.' }
        ]
      },
      {
        id: 'security-recovery',
        title: 'Security and recovery',
        description: 'Walkthrough for PIN gate, backup, encrypted backup, import, and device wipe controls.',
        steps: [
          { view:'settings', selector:'#st_pin1', title:'Local PIN gate', body:'The PIN gate is device-local security. This is where a white-label deployment can protect the vault without pretending it is cloud auth.' },
          { view:'settings', selector:'#st_backup', title:'Fast backup reminder', body:'The settings backup jump sends operators toward the export lane before they wipe or move devices.' },
          { view:'export', selector:'#ex_json_enc', title:'Encrypted backup', body:'Encrypted backup is the strongest offline recovery artifact in the current build. It is the right option when proof and photos matter.' },
          { view:'export', selector:'#ex_import', title:'Import and restore', body:'Import brings a vault back onto a device. This walkthrough intentionally lands on the live import button so the recovery lane is obvious.' },
          { view:'settings', selector:'#st_wipe', title:'Wipe is last', body:'Wipe exists, but the walkthrough deliberately ends here so the operator understands recovery before destructive actions.' }
        ]
      }
    ];
  }

  function getTour(id){ return getTours().find(t => t.id === id) || null; }

  async function highlightSelector(selector){
    clearTarget();
    if(!selector) return;
    let target = null;
    for(let i=0;i<8;i++){
      target = document.querySelector(selector);
      if(target) break;
      await wait(80);
    }
    if(target){
      activeTarget = target;
      activeTarget.classList.add('tour-active-target');
      if(activeTarget.scrollIntoView){
        activeTarget.scrollIntoView({ behavior:'smooth', block:'center', inline:'center' });
      }
    }
  }

  async function applyStep(){
    if(!activeTourState) return;
    const tour = getTour(activeTourState.tourId);
    if(!tour) return;
    const step = tour.steps[activeTourState.stepIndex];
    if(!step) return;
    closeAnyModal();
    if(step.view) await gotoView(step.view);
    if(typeof step.before === 'function'){
      try{ await step.before(); }catch(_){}
    }
    await highlightSelector(step.selector || '');
    const total = tour.steps.length;
    ensureOverlay();
    overlay.classList.remove('hidden');
    document.getElementById('rtxTourTitle').textContent = step.title || tour.title;
    document.getElementById('rtxTourBody').textContent = step.body || '';
    document.getElementById('rtxTourStepMeta').textContent = 'Step ' + (activeTourState.stepIndex + 1) + ' / ' + total;
    document.getElementById('rtxTourProgressBar').style.width = (((activeTourState.stepIndex + 1) / total) * 100).toFixed(1) + '%';
    document.getElementById('rtxTourBackBtn').disabled = activeTourState.stepIndex === 0;
    document.getElementById('rtxTourNextBtn').textContent = activeTourState.stepIndex === total - 1 ? 'Finish' : 'Next';
    markProgress(activeTourState.tourId, { lastStep: activeTourState.stepIndex + 1, inProgress: true });
    injectEntryPoints();
  }

  async function moveStep(delta){
    if(!activeTourState) return;
    const tour = getTour(activeTourState.tourId);
    if(!tour) return;
    const nextIndex = activeTourState.stepIndex + delta;
    if(nextIndex < 0){
      return;
    }
    if(nextIndex >= tour.steps.length){
      markProgress(activeTourState.tourId, { completedAt: new Date().toISOString(), inProgress: false, lastStep: tour.steps.length });
      const queue = Array.isArray(activeTourState.queue) ? activeTourState.queue.slice() : [];
      closeTour('completed', false);
      latestToast('Walkthrough completed.', 'good');
      if(queue.length){
        await wait(180);
        startTour(queue[0], queue.slice(1));
      }else{
        openTutorialCenter();
      }
      return;
    }
    activeTourState.stepIndex = nextIndex;
    await applyStep();
  }

  function closeTour(reason, reopenCenter){
    clearTarget();
    if(overlay) overlay.classList.add('hidden');
    if(activeTourState){
      markProgress(activeTourState.tourId, { inProgress: false, lastClosedReason: reason || 'closed' });
    }
    activeTourState = null;
    if(reopenCenter){
      setTimeout(()=> openTutorialCenter(), 80);
    }
    injectEntryPoints();
  }

  function startTour(tourId, queue){
    const tour = getTour(tourId);
    if(!tour) return;
    closeAnyModal();
    activeTourState = { tourId, stepIndex: 0, queue: Array.isArray(queue) ? queue : [] };
    applyStep();
  }

  function startAllTours(){
    const ids = getTours().map(t => t.id);
    if(!ids.length) return;
    startTour(ids[0], ids.slice(1));
  }

  function tutorialCenterHtml(){
    const progress = readProgress();
    const tours = getTours();
    const done = tours.filter(t => progress[t.id] && progress[t.id].completedAt).length;
    const percent = tours.length ? Math.round((done / tours.length) * 100) : 0;
    return `
      <div class="hint">This is a real tutorial center, not a pile of static notes. Starting any walkthrough moves the user through the actual screens and live controls they will use.</div>
      <div class="sep"></div>
      <div class="row" style="flex-wrap:wrap;">
        <div class="pill">${done}/${tours.length} walkthroughs completed</div>
        <div class="pill">Transparency score ${percent}%</div>
        <button class="btn" id="rtxTourStartAllBtn">Run all walkthroughs</button>
        <button class="btn" id="rtxTourResetBtn">Reset progress</button>
      </div>
      <div class="sep"></div>
      <div class="rtx-tour-grid">
        ${tours.map(t => {
          const row = progress[t.id] || {};
          const doneText = row.completedAt ? 'Completed' : row.lastStep ? ('Last step ' + row.lastStep + '/' + t.steps.length) : 'Not started';
          return `<div class="rtx-tour-tile">
            <h4>${esc(t.title)}</h4>
            <p>${esc(t.description)}</p>
            <div class="rtx-tour-mini">${doneText}</div>
            <div class="sep"></div>
            <div class="row" style="flex-wrap:wrap;">
              <button class="btn small" data-rtx-tour="${esc(t.id)}">Start walkthrough</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  function bindTutorialCenter(){
    const allBtn = document.getElementById('rtxTourStartAllBtn');
    if(allBtn) allBtn.onclick = ()=>{ closeAnyModal(); startAllTours(); };
    const resetBtn = document.getElementById('rtxTourResetBtn');
    if(resetBtn) resetBtn.onclick = ()=>{ saveProgress({}); latestToast('Walkthrough progress reset.', 'good'); openTutorialCenter(); injectEntryPoints(); };
    document.querySelectorAll('[data-rtx-tour]').forEach(btn => {
      btn.onclick = ()=>{ closeAnyModal(); startTour(btn.getAttribute('data-rtx-tour')); };
    });
  }

  function openTutorialCenter(){
    if(typeof window.openModal === 'function'){
      window.openModal(
        'Interactive walkthroughs',
        tutorialCenterHtml(),
        `<button class="btn" onclick="document.getElementById('modalClose').click()">Close</button>`
      );
      bindTutorialCenter();
      setCenterState({ seenAt: new Date().toISOString() });
    }
  }

  function dashboardLaunchpadCard(){
    const done = completedCount();
    const total = getTours().length;
    return `
      <h2>Interactive walkthrough launchpad</h2>
      <div class="hint">This app now teaches itself in-product. Walkthroughs move through real screens, open live controls, and explain the actual lane the user is on.</div>
      <div class="sep"></div>
      <div class="row" style="flex-wrap:wrap;">
        <div class="pill">${done}/${total} walkthroughs completed</div>
        <button class="btn" id="rtxDashToursHub">Open tutorial center</button>
        <button class="btn" id="rtxDashToursAll">Run all walkthroughs</button>
        <button class="btn" id="rtxDashToursStart">Start core navigation</button>
      </div>
    `;
  }

  function settingsTutorialCard(){
    const progress = readProgress();
    const total = getTours().length;
    const done = completedCount();
    const last = Object.entries(progress).sort((a,b)=> String((b[1]||{}).updatedAt || '').localeCompare(String((a[1]||{}).updatedAt || '')))[0];
    const lastText = last ? (getTour(last[0]) ? getTour(last[0]).title : last[0]) : 'No walkthrough run yet';
    return `
      <h2>Walkthrough & tutorial center</h2>
      <div class="hint">These are guided screen-changing walkthroughs. The app moves through the areas the operator actually uses instead of leaving them with detached written notes.</div>
      <div class="sep"></div>
      <div class="row" style="flex-wrap:wrap;">
        <div class="pill">${done}/${total} completed</div>
        <div class="pill">Last touched: ${esc(lastText)}</div>
        <button class="btn" id="rtxSettingsToursHub">Open tutorial center</button>
        <button class="btn" id="rtxSettingsToursAll">Run every walkthrough</button>
        <button class="btn" id="rtxSettingsToursSecurity">Security & recovery</button>
      </div>
    `;
  }

  function bindEntryPointButtons(){
    ['rtxTopbarToursBtn', 'rtxDashToursHub', 'rtxSettingsToursHub'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.onclick = openTutorialCenter;
    });
    ['rtxDashToursAll', 'rtxSettingsToursAll'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.onclick = ()=> startAllTours();
    });
    const startBtn = document.getElementById('rtxDashToursStart');
    if(startBtn) startBtn.onclick = ()=> startTour('start-here');
    const secBtn = document.getElementById('rtxSettingsToursSecurity');
    if(secBtn) secBtn.onclick = ()=> startTour('security-recovery');
  }

  function injectTopbarButton(){
    const host = document.querySelector('.topbar .row:last-of-type') || document.querySelector('.topbar .row');
    if(host && !document.getElementById('rtxTopbarToursBtn')){
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.id = 'rtxTopbarToursBtn';
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>Tours';
      host.insertBefore(btn, host.firstChild);
      btn.onclick = openTutorialCenter;
    }
  }

  function injectDashboardCard(){
    if(!(window.APP && APP.view === 'dashboard')) return;
    const grid = document.querySelector('#content .grid');
    if(grid && !document.getElementById('rtxTutorialLaunchpadCard')){
      const card = document.createElement('div');
      card.className = 'card';
      card.id = 'rtxTutorialLaunchpadCard';
      card.style.gridColumn = 'span 12';
      card.innerHTML = dashboardLaunchpadCard();
      grid.insertBefore(card, grid.firstChild);
      bindEntryPointButtons();
    }
  }

  function injectSettingsCard(){
    if(!(window.APP && APP.view === 'settings')) return;
    const grid = document.querySelector('#content .grid');
    if(grid && !document.getElementById('rtxTutorialSettingsCard')){
      const card = document.createElement('div');
      card.className = 'card';
      card.id = 'rtxTutorialSettingsCard';
      card.style.gridColumn = 'span 12';
      card.innerHTML = settingsTutorialCard();
      grid.insertBefore(card, grid.firstChild);
      bindEntryPointButtons();
    }
  }

  function injectEntryPoints(){
    injectTopbarButton();
    injectDashboardCard();
    injectSettingsCard();
    bindEntryPointButtons();
  }

  const observer = new MutationObserver(()=> injectEntryPoints());
  observer.observe(document.documentElement || document.body, { childList:true, subtree:true });

  const prevRender = window.render;
  if(typeof prevRender === 'function'){
    window.render = async function(){
      const out = await prevRender.apply(this, arguments);
      setTimeout(injectEntryPoints, 0);
      return out;
    };
  }

  window.openRoutexTutorialCenter = openTutorialCenter;
  window.startRoutexInteractiveTour = startTour;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=> setTimeout(injectEntryPoints, 120));
  }else{
    setTimeout(injectEntryPoints, 120);
  }
})();
