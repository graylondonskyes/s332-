/* V31 guided no-dead walkthrough closeout + completion binder */
(function(){
  if(window.__ROUTEX_V31__) return; window.__ROUTEX_V31__ = true;
  const BINDER_KEY = 'skye_routex_no_dead_completion_binders_v1';
  const BINDER_OUTBOX_KEY = 'skye_routex_no_dead_completion_binder_outbox_v1';
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const uid = window.uid || (()=>('v31-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const nowISO = window.nowISO || (()=> new Date().toISOString());
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  const fmt = window.fmt || (v => new Date(v || Date.now()).toLocaleString());
  const hash = window.tinyHash || function(input){ const str = String(input || ''); let h = 2166136261 >>> 0; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ('00000000' + (h >>> 0).toString(16)).slice(-8); };
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function readBinders(){ return readJSON(BINDER_KEY, []).filter(Boolean).slice(0,40); }
  function pushBinder(row){ const item = { id: clean(row && row.id) || uid(), createdAt: clean(row && row.createdAt) || nowISO(), ...(row || {}) }; const list = readBinders().filter(entry => clean(entry.fingerprint) !== clean(item.fingerprint)); list.unshift(item); writeJSON(BINDER_KEY, list.slice(0,40)); return item; }
  function readBinderOutbox(){ return readJSON(BINDER_OUTBOX_KEY, []).filter(Boolean).slice(0,40); }
  function pushBinderOutbox(row){ const item = { ...(row || {}), exportedAt: nowISO(), source: clean(row && row.source) || 'routex-no-dead-completion-binder-outbox' }; const list = readBinderOutbox().filter(entry => clean(entry.fingerprint) !== clean(item.fingerprint)); list.unshift(item); writeJSON(BINDER_OUTBOX_KEY, list.slice(0,40)); return item; }
  function latestReceipt(){ return typeof window.readRoutexNoDeadWalkthroughReceipts === 'function' ? (window.readRoutexNoDeadWalkthroughReceipts()[0] || null) : (readJSON('skye_routex_no_dead_walkthrough_receipts_v1', [])[0] || null); }
  function latestRun(){ return typeof window.readRoutexNoDeadProofRuns === 'function' ? (window.readRoutexNoDeadProofRuns()[0] || null) : (readJSON('skye_routex_no_dead_button_runs_v1', [])[0] || null); }
  function latestCompare(){ return typeof window.readRoutexNoDeadCompareRuns === 'function' ? (window.readRoutexNoDeadCompareRuns()[0] || null) : (readJSON('skye_routex_no_dead_compare_runs_v1', [])[0] || null); }
  function latestAttestation(){ const items = readJSON('skye_routex_device_attestations_v1', []).filter(Boolean); return items.find(item => clean(item && item.source) === 'no-dead-proof') || items[0] || null; }
  function latestSnapshot(){ const items = readJSON('skye_routex_completion_snapshots_v1', []).filter(Boolean); return items[0] || null; }
  function buildCompletionBinderRow(){
    const receipt = latestReceipt() || {};
    const run = latestRun() || {};
    const compare = latestCompare() || {};
    const attest = latestAttestation() || {};
    const snap = latestSnapshot() || {};
    const ok = !!(receipt.ok && run.ok && compare.ok && clean(attest.fingerprint));
    const digest = JSON.stringify({ receipt: receipt.fingerprint, run: run.fingerprint, compare: compare.fingerprint, attest: attest.fingerprint, snap: snap.fingerprint, ok });
    return {
      label: 'No-dead completion binder • ' + dayISO(),
      fingerprint: 'ndbc-' + dayISO() + '-' + hash(digest),
      receiptFingerprint: clean(receipt.fingerprint),
      receiptOk: !!receipt.ok,
      walkthroughReviewer: clean(receipt.walkthroughReviewer),
      walkthroughDone: Number(receipt.walkthroughDone || 0),
      walkthroughTotal: Number(receipt.walkthroughTotal || 0),
      walkthroughNote: clean(receipt.walkthroughNote),
      runFingerprint: clean(run.fingerprint),
      runOk: !!run.ok,
      compareFingerprint: clean(compare.fingerprint),
      compareOk: !!compare.ok,
      attestationFingerprint: clean(attest.fingerprint),
      attestationOk: !!clean(attest.fingerprint),
      snapshotFingerprint: clean(snap.fingerprint),
      completionLabel: clean(snap.completionLabel) || '',
      noDeadPresent: !!(snap.partials && snap.partials.noDeadButtonProof),
      routeCount: Number(run.routeCount || 0),
      stopCount: Number(run.stopCount || 0),
      packageCount: Number(compare.packageCount || 0),
      ok,
      note: ok ? 'The no-dead-button proof line now has a completion binder that packages the completed walkthrough receipt, latest no-dead run, shipped compare, completion snapshot, and device attestation into one sync-ready artifact.' : 'Completion binder saved for review. The walkthrough receipt, latest no-dead run, shipped compare, and no-dead attestation must all be present and passing before this binder is closure-complete.'
    };
  }
  function buildCompletionBinderHtml(row){
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>No-dead completion binder</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1120px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex no-dead completion binder</h1><div><span class="badge">'+esc(row && row.fingerprint || '—')+'</span><span class="badge">Reviewer '+esc(row && row.walkthroughReviewer || '—')+'</span><span class="badge">Walkthrough '+esc(String(row && row.walkthroughDone || 0))+'/'+esc(String(row && row.walkthroughTotal || 0))+'</span><span class="badge">'+((row && row.ok) ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(row && row.note || '')+'</div></div><div class="card"><table><thead><tr><th>Artifact</th><th>Fingerprint</th><th>OK</th><th>Note</th></tr></thead><tbody><tr><td>Walkthrough receipt</td><td>'+esc(row && row.receiptFingerprint || '—')+'</td><td>'+((row && row.receiptOk) ? 'OK' : 'REVIEW')+'</td><td>'+esc(row && row.walkthroughNote || '')+'</td></tr><tr><td>No-dead proof run</td><td>'+esc(row && row.runFingerprint || '—')+'</td><td>'+((row && row.runOk) ? 'OK' : 'REVIEW')+'</td><td>Routes '+esc(String(row && row.routeCount || 0))+' • Stops '+esc(String(row && row.stopCount || 0))+'</td></tr><tr><td>Shipped compare</td><td>'+esc(row && row.compareFingerprint || '—')+'</td><td>'+((row && row.compareOk) ? 'OK' : 'REVIEW')+'</td><td>Packages '+esc(String(row && row.packageCount || 0))+'</td></tr><tr><td>Device attestation</td><td>'+esc(row && row.attestationFingerprint || '—')+'</td><td>'+((row && row.attestationOk) ? 'OK' : 'REVIEW')+'</td><td>Shared receipt support</td></tr><tr><td>Completion snapshot</td><td>'+esc(row && row.snapshotFingerprint || '—')+'</td><td>'+((row && row.noDeadPresent) ? 'PRESENT' : 'REVIEW')+'</td><td>'+esc(row && row.completionLabel || '—')+'</td></tr></tbody></table></div></div></body></html>';
  }
  function saveCompletionBinder(){ const row = pushBinder(buildCompletionBinderRow()); pushBinderOutbox(row); return row; }
  function exportLatestBinderHtml(){ const row = readBinders()[0] || saveCompletionBinder(); downloadText(buildCompletionBinderHtml(row), 'routex_no_dead_completion_binder_' + dayISO() + '.html', 'text/html'); toast('Completion binder HTML exported.', 'good'); }
  function exportLatestBinderJson(){ const row = readBinders()[0] || saveCompletionBinder(); downloadText(JSON.stringify(row, null, 2), 'routex_no_dead_completion_binder_' + dayISO() + '.json', 'application/json'); toast('Completion binder JSON exported.', 'good'); }
  function getWalkModal(){
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    const footer = document.getElementById('modalFooter');
    if(!title || !body || !footer || !/Human walkthrough/i.test(title.textContent || '')) return null;
    return { title, body, footer };
  }
  function getWalkItems(){ const body = document.getElementById('modalBody'); return body ? Array.from(body.querySelectorAll('.list .item')) : []; }
  function getWalkNoteEl(index){ return document.querySelector('[data-walk-note="'+index+'"]'); }
  function getWalkDoneEl(index){ return document.querySelector('[data-walk-done="'+index+'"]'); }
  function appendWalkNote(index, text){ const el = getWalkNoteEl(index); if(!el) return; const next = clean(text); const cur = clean(el.value); el.value = cur ? (cur + '\n' + next) : next; }
  function markWalkDone(index, note){ const box = getWalkDoneEl(index); if(box) box.checked = true; if(note) appendWalkNote(index, note); }
  function ensureWalkRunNote(){ const el = document.getElementById('walk_note'); if(!el) return; if(clean(el.value)) return; el.value = 'Guided no-dead walkthrough closeout • ' + navigator.userAgent.slice(0,120) + ' • ' + dayISO(); }
  const launchers = {
    0: { label:'Run fresh proof', run: async()=> window.runFreshRecordProofComplete && window.runFreshRecordProofComplete() },
    1: { label:'Run legacy proof', run: async()=> window.runLegacyRecordProofComplete && window.runLegacyRecordProofComplete() },
    2: { label:'Run export/import proof', run: async()=> window.runExportImportProofComplete && window.runExportImportProofComplete() },
    3: { label:'Run no-dead proof', run: async()=> window.runNoDeadButtonProofComplete && window.runNoDeadButtonProofComplete() },
    4: { label:'Run closure campaign', run: async()=> window.runDirectiveClosureCampaign && window.runDirectiveClosureCampaign() }
  };
  async function runWalkLauncher(index){
    const spec = launchers[index];
    if(!spec || typeof spec.run !== 'function') return null;
    ensureWalkRunNote();
    const out = await spec.run();
    const fp = clean(out && out.fingerprint) || clean(out && out.bundle && out.bundle.fingerprint) || clean(out && out.id) || 'run';
    const status = (out && Object.prototype.hasOwnProperty.call(out, 'ok')) ? (out.ok ? 'PASS' : 'REVIEW') : 'DONE';
    markWalkDone(index, '[' + fmt(nowISO()) + '] ' + spec.label + ' • ' + status + ' • ' + fp);
    return out;
  }
  async function runGuidedWalkthrough(){
    const btn = document.getElementById('walk_guided_run');
    if(btn){ btn.disabled = true; btn.textContent = 'Running guided closeout...'; }
    let completed = 0;
    try{
      for(const index of [0,1,2,3,4]){ if(!launchers[index]) continue; await runWalkLauncher(index); completed++; }
      appendWalkNote(5, '[' + fmt(nowISO()) + '] Completion binder will be saved into the AE FLOW import outbox when you save the walkthrough receipt.');
      toast('Guided walkthrough closeout ran ' + completed + ' live proof actions.', 'good');
    }catch(err){
      toast(clean(err && err.message) || 'Guided walkthrough stopped for review.', 'warn');
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = 'Run guided closeout'; }
    }
  }
  function injectGuidedWalkthroughControls(){
    const modal = getWalkModal();
    if(!modal) return;
    const { body, footer } = modal;
    const items = getWalkItems();
    if(!document.getElementById('walk_v31_controls')){
      const block = document.createElement('div');
      block.id = 'walk_v31_controls';
      block.className = 'card';
      block.style.marginBottom = '12px';
      block.innerHTML = '<h3 style="margin:0 0 10px;">Guided closeout</h3><div class="hint">This turns the last no-dead line into an in-app guided operator run instead of a memory-based checklist. It launches the live proof actions, records receipts into the walkthrough notes, and can bind the finished walkthrough into a completion binder for AE FLOW import.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="walk_guided_run">Run guided closeout</button><button class="btn" id="walk_binder_save">Save completion binder</button><button class="btn" id="walk_binder_html">Export binder HTML</button><button class="btn" id="walk_binder_json">Export binder JSON</button></div>';
      const list = body.querySelector('.list');
      if(list) body.insertBefore(block, list);
      document.getElementById('walk_guided_run').onclick = runGuidedWalkthrough;
      document.getElementById('walk_binder_save').onclick = ()=>{ const row = saveCompletionBinder(); markWalkDone(5, '[' + fmt(nowISO()) + '] Completion binder saved • ' + clean(row.fingerprint)); const doneEl = getWalkDoneEl(5); if(doneEl) doneEl.checked = true; toast(row.ok ? 'Completion binder saved.' : 'Completion binder saved for review.', row.ok ? 'good' : 'warn'); };
      document.getElementById('walk_binder_html').onclick = exportLatestBinderHtml;
      document.getElementById('walk_binder_json').onclick = exportLatestBinderJson;
    }
    items.forEach((item, index) => {
      if(item.querySelector('[data-v31-launch]')) return;
      const spec = launchers[index];
      const host = document.createElement('div');
      host.className = 'row';
      host.style.flexWrap = 'wrap';
      host.style.justifyContent = 'flex-end';
      host.style.marginTop = '8px';
      if(spec){
        const btn = document.createElement('button');
        btn.className = 'btn small';
        btn.dataset.v31Launch = String(index);
        btn.textContent = spec.label;
        btn.onclick = async ()=>{ btn.disabled = true; const prev = btn.textContent; btn.textContent = 'Running...'; try{ await runWalkLauncher(index); toast(spec.label + ' logged into the walkthrough.', 'good'); }catch(err){ toast(clean(err && err.message) || 'Launcher failed.', 'warn'); } finally { btn.disabled = false; btn.textContent = prev; } };
        host.appendChild(btn);
      }
      if(index === 5){
        const btn = document.createElement('button');
        btn.className = 'btn small';
        btn.dataset.v31Launch = 'binder';
        btn.textContent = 'Mark binder / AE FLOW handoff ready';
        btn.onclick = ()=>{ const row = saveCompletionBinder(); markWalkDone(5, '[' + fmt(nowISO()) + '] Completion binder saved to Routex outbox • ' + clean(row.fingerprint)); const box = getWalkDoneEl(5); if(box) box.checked = true; toast(row.ok ? 'Binder handoff marked ready.' : 'Binder handoff saved for review.', row.ok ? 'good' : 'warn'); };
        host.appendChild(btn);
      }
      if(host.childNodes.length) item.appendChild(host);
    });
    if(!document.getElementById('walk_save_receipt_binder')){
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.id = 'walk_save_receipt_binder';
      btn.textContent = 'Save walkthrough + receipt + binder';
      btn.onclick = ()=>{
        ensureWalkRunNote();
        markWalkDone(5, '[' + fmt(nowISO()) + '] Completion binder requested during walkthrough save.');
        const saveBtn = document.getElementById('walk_save');
        if(saveBtn) saveBtn.click();
        setTimeout(()=>{
          try{ const receipt = typeof window.saveRoutexNoDeadWalkthroughReceipt === 'function' ? window.saveRoutexNoDeadWalkthroughReceipt() : null; const binder = saveCompletionBinder(); toast((receipt && receipt.ok && binder.ok) ? 'Walkthrough, receipt, and binder saved.' : 'Walkthrough, receipt, and binder saved for review.', (receipt && receipt.ok && binder.ok) ? 'good' : 'warn'); }catch(err){ toast(clean(err && err.message) || 'Walkthrough save finished, but binder packaging needs review.', 'warn'); }
        }, 80);
      };
      footer.insertBefore(btn, footer.firstChild);
    }
  }
  function injectBinderControls(){
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    if(!title || !body || !/No-dead-button proof/i.test(title.textContent || '')) return;
    if(document.getElementById('ndbCompletionBinderBlock')) return;
    const latest = readBinders()[0] || null;
    const block = document.createElement('div');
    block.id = 'ndbCompletionBinderBlock';
    block.className = 'card';
    block.style.marginTop = '12px';
    block.innerHTML = '<h3 style="margin:0 0 10px;">Completion binder</h3><div class="hint">This is the final sync-ready binder for the no-dead-button line. It packages the saved walkthrough receipt, latest no-dead proof run, shipped compare, completion snapshot, and attestation into one Routex artifact that AE FLOW can import directly.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="ndbBinderSaveBtn">Save completion binder</button><button class="btn" id="ndbBinderHtmlBtn">Export binder HTML</button><button class="btn" id="ndbBinderJsonBtn">Export binder JSON</button></div><div class="sep"></div><div class="hint">Binders: <span class="mono">'+esc(String(readBinders().length))+'</span>'+(latest ? ' • Latest <span class="mono">'+esc(latest.fingerprint || '—')+'</span> • '+(latest.ok ? 'PASS' : 'REVIEW')+' • reviewer <span class="mono">'+esc(latest.walkthroughReviewer || '—')+'</span>' : ' • No completion binder saved yet.')+'</div>';
    body.appendChild(block);
    document.getElementById('ndbBinderSaveBtn').onclick = ()=>{ const row = saveCompletionBinder(); toast(row.ok ? 'Completion binder saved.' : 'Completion binder saved for review.', row.ok ? 'good' : 'warn'); };
    document.getElementById('ndbBinderHtmlBtn').onclick = exportLatestBinderHtml;
    document.getElementById('ndbBinderJsonBtn').onclick = exportLatestBinderJson;
  }
  const observer = new MutationObserver(()=>{ injectGuidedWalkthroughControls(); injectBinderControls(); });
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRun = window.runNoDeadButtonProofComplete;
  if(typeof prevRun === 'function'){
    window.runNoDeadButtonProofComplete = async function(){ const out = await prevRun.apply(this, arguments); const receipt = latestReceipt(); if(receipt && receipt.ok){ try{ const binder = saveCompletionBinder(); toast(binder.ok ? 'Completion binder packaged.' : 'Completion binder saved for review.', binder.ok ? 'good' : 'warn'); }catch(_){ } } return out; };
  }
  window.readRoutexNoDeadCompletionBinders = readBinders;
  window.readRoutexNoDeadCompletionBinderOutbox = readBinderOutbox;
  window.saveRoutexNoDeadCompletionBinder = saveCompletionBinder;
})();

/* V32 Routex operator command brief */
(function(){
  if(window.__ROUTEX_V32__) return; window.__ROUTEX_V32__ = true;
  const BRIEF_KEY = 'skye_routex_operator_command_briefs_v1';
  const OUTBOX_KEY = 'skye_routex_operator_command_brief_outbox_v1';
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const uid = window.uid || (()=> 'routex-v32-' + Date.now().toString(36) + Math.random().toString(36).slice(2,7));
  const nowISO = window.nowISO || (()=> new Date().toISOString());
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  const fmt = window.fmtDateTime || window.fmt || ((v)=> clean(v).replace('T',' ').slice(0,16));
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function readBriefs(){ return readJSON(BRIEF_KEY, []).filter(Boolean).slice(0,40); }
  function readOutbox(){ return readJSON(OUTBOX_KEY, []).filter(Boolean).slice(0,40); }
  function saveBriefs(rows){ return writeJSON(BRIEF_KEY, (Array.isArray(rows) ? rows : []).slice(0,40)); }
  function saveOutbox(rows){ return writeJSON(OUTBOX_KEY, (Array.isArray(rows) ? rows : []).slice(0,40)); }
  function pushBrief(row){ const rows = readBriefs().filter(item => clean(item && item.id) !== clean(row && row.id)); rows.unshift(row); saveBriefs(rows); return row; }
  function pushOutbox(row){ const rows = readOutbox().filter(item => clean(item && item.fingerprint) !== clean(row && row.fingerprint)); rows.unshift(row); saveOutbox(rows); return row; }
  function countKey(key){ return readJSON(key, []).filter(Boolean).length; }
  function latestFrom(key){ return readJSON(key, []).filter(Boolean)[0] || null; }
  function snapshot(){
    const routePacks = countKey('skye_routex_route_pack_index_v2');
    const tripPacks = countKey('skye_routex_trip_packs_v1');
    const freshRuns = countKey('skye_routex_fresh_record_runs_v1');
    const legacyRuns = countKey('skye_routex_legacy_record_runs_v1');
    const transferRuns = countKey('skye_routex_export_import_runs_v1');
    const noDeadRuns = countKey('skye_routex_no_dead_button_runs_v1');
    const binders = countKey('skye_routex_no_dead_completion_binders_v1');
    const receipts = countKey('skye_routex_no_dead_walkthrough_receipts_v1');
    const devices = countKey('skye_routex_device_attestations_v1');
    const closureBundles = countKey('skye_routex_closure_outbox_v1');
    const proofSnapshots = countKey('skye_routex_proof_snapshots_v1');
    const lookupHistory = countKey('skye_routex_lookup_history_v1');
    const geocodeQueue = countKey('skye_routex_hybrid_geocode_queue_v1');
    const syncOutbox = countKey('skye_routex_hybrid_sync_outbox_v1');
    const latestBinder = latestFrom('skye_routex_no_dead_completion_binders_v1');
    const latestReceipt = latestFrom('skye_routex_no_dead_walkthrough_receipts_v1');
    const latestNoDead = latestFrom('skye_routex_no_dead_button_runs_v1');
    const latestTransfer = latestFrom('skye_routex_export_import_runs_v1');
    const latestLegacy = latestFrom('skye_routex_legacy_record_runs_v1');
    const readiness = [freshRuns > 0, legacyRuns > 0, transferRuns > 0, noDeadRuns > 0, !!(latestBinder && latestBinder.ok), !!(latestReceipt && latestReceipt.ok), devices > 0].filter(Boolean).length;
    return {
      routePacks, tripPacks, freshRuns, legacyRuns, transferRuns, noDeadRuns, binders, receipts, devices, closureBundles, proofSnapshots, lookupHistory, geocodeQueue, syncOutbox,
      readiness, readinessMax: 7,
      latestBinder: latestBinder ? { fingerprint: clean(latestBinder.fingerprint), reviewer: clean(latestBinder.walkthroughReviewer), ok: !!latestBinder.ok, savedAt: clean(latestBinder.savedAt || latestBinder.at) } : null,
      latestReceipt: latestReceipt ? { fingerprint: clean(latestReceipt.fingerprint), reviewer: clean(latestReceipt.walkthroughReviewer), ok: !!latestReceipt.ok, savedAt: clean(latestReceipt.savedAt || latestReceipt.at) } : null,
      latestNoDead: latestNoDead ? { id: clean(latestNoDead.id), ok: !!latestNoDead.ok, savedAt: clean(latestNoDead.savedAt || latestNoDead.ranAt || latestNoDead.at) } : null,
      latestTransfer: latestTransfer ? { id: clean(latestTransfer.id), fingerprint: clean(latestTransfer.fingerprint), savedAt: clean(latestTransfer.savedAt || latestTransfer.ranAt || latestTransfer.at) } : null,
      latestLegacy: latestLegacy ? { id: clean(latestLegacy.id), fingerprint: clean(latestLegacy.fingerprint), savedAt: clean(latestLegacy.savedAt || latestLegacy.ranAt || latestLegacy.at) } : null
    };
  }
  function buildRow(){
    const snap = snapshot();
    const fingerprint = ['OPS', dayISO(), snap.routePacks, snap.tripPacks, snap.binders, snap.readiness + '-' + snap.readinessMax].join('-');
    const ok = snap.readiness >= 6 && !!(snap.latestBinder && snap.latestBinder.ok);
    return {
      id: uid(),
      savedAt: nowISO(),
      label: 'Routex operator command brief • ' + dayISO(),
      fingerprint,
      source: 'routex-operator-command-brief-v32',
      ok,
      note: ok ? 'Operator command brief is closure-forward and sync-ready.' : 'Operator command brief saved for review. Readiness and binder state still need attention.',
      snapshot: snap
    };
  }
  function buildHtml(row){
    row = row || readBriefs()[0] || buildRow();
    const s = row.snapshot || snapshot();
    const latest = [
      ['Completion binder', s.latestBinder ? ((s.latestBinder.ok ? 'PASS' : 'REVIEW') + ' • ' + (s.latestBinder.fingerprint || '—') + ' • ' + (s.latestBinder.reviewer || '—')) : 'None'],
      ['Walkthrough receipt', s.latestReceipt ? ((s.latestReceipt.ok ? 'PASS' : 'REVIEW') + ' • ' + (s.latestReceipt.fingerprint || '—')) : 'None'],
      ['No-dead proof', s.latestNoDead ? ((s.latestNoDead.ok ? 'PASS' : 'REVIEW') + ' • ' + (s.latestNoDead.savedAt || '—')) : 'None'],
      ['Transfer proof', s.latestTransfer ? ((s.latestTransfer.fingerprint || s.latestTransfer.id || '—') + ' • ' + (s.latestTransfer.savedAt || '—')) : 'None'],
      ['Legacy proof', s.latestLegacy ? ((s.latestLegacy.fingerprint || s.latestLegacy.id || '—') + ' • ' + (s.latestLegacy.savedAt || '—')) : 'None']
    ].map(item => '<tr><td>'+esc(item[0])+'</td><td>'+esc(item[1])+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Routex operator command brief</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1120px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">Routex • Operator command brief</h1><div><span class="badge">'+esc(row.fingerprint || '—')+'</span><span class="badge">Saved '+esc(fmt(row.savedAt))+'</span><span class="badge">'+(row.ok ? 'PASS' : 'REVIEW')+'</span><span class="badge">Readiness '+esc(String(s.readiness))+'/'+esc(String(s.readinessMax))+'</span></div><p style="margin:12px 0 0;">'+esc(row.note || '')+'</p></div><div class="card"><h2 style="margin:0 0 8px;">Field counts</h2><table><tbody><tr><td>Route packs</td><td>'+esc(String(s.routePacks))+'</td></tr><tr><td>Trip packs</td><td>'+esc(String(s.tripPacks))+'</td></tr><tr><td>Fresh proof runs</td><td>'+esc(String(s.freshRuns))+'</td></tr><tr><td>Legacy proof runs</td><td>'+esc(String(s.legacyRuns))+'</td></tr><tr><td>Transfer proof runs</td><td>'+esc(String(s.transferRuns))+'</td></tr><tr><td>No-dead proof runs</td><td>'+esc(String(s.noDeadRuns))+'</td></tr><tr><td>Completion binders</td><td>'+esc(String(s.binders))+'</td></tr><tr><td>Walkthrough receipts</td><td>'+esc(String(s.receipts))+'</td></tr><tr><td>Device attestations</td><td>'+esc(String(s.devices))+'</td></tr><tr><td>Proof snapshots</td><td>'+esc(String(s.proofSnapshots))+'</td></tr><tr><td>Lookup history</td><td>'+esc(String(s.lookupHistory))+'</td></tr><tr><td>Hybrid geocode queue</td><td>'+esc(String(s.geocodeQueue))+'</td></tr><tr><td>Hybrid sync outbox</td><td>'+esc(String(s.syncOutbox))+'</td></tr><tr><td>Closure bundles</td><td>'+esc(String(s.closureBundles))+'</td></tr></tbody></table></div><div class="card"><h2 style="margin:0 0 8px;">Latest proof surfaces</h2><table><tbody>'+latest+'</tbody></table></div></div></body></html>';
  }
  function saveBrief(){ const row = buildRow(); pushBrief(row); pushOutbox(row); return row; }
  function exportLatestHtml(){ const row = readBriefs()[0] || saveBrief(); downloadText(buildHtml(row), 'routex_operator_command_brief_' + dayISO() + '.html', 'text/html'); }
  function exportLatestJson(){ const row = readBriefs()[0] || saveBrief(); downloadText(JSON.stringify(row, null, 2), 'routex_operator_command_brief_' + dayISO() + '.json', 'application/json'); }
  function inject(){
    const bar = document.querySelector('#routexWorkbenchToolbar') || document.querySelector('.toolbar') || document.querySelector('.row');
    if(bar && !document.getElementById('routexOpsBriefSaveBtn')){
      const saveBtn = document.createElement('button'); saveBtn.className='btn small'; saveBtn.id='routexOpsBriefSaveBtn'; saveBtn.textContent='Save ops brief'; saveBtn.onclick = ()=>{ const row = saveBrief(); toast(row.ok ? 'Operator command brief saved.' : 'Operator command brief saved for review.', row.ok ? 'good' : 'warn'); };
      const htmlBtn = document.createElement('button'); htmlBtn.className='btn small'; htmlBtn.id='routexOpsBriefHtmlBtn'; htmlBtn.textContent='Export ops brief HTML'; htmlBtn.onclick = exportLatestHtml;
      const jsonBtn = document.createElement('button'); jsonBtn.className='btn small'; jsonBtn.id='routexOpsBriefJsonBtn'; jsonBtn.textContent='Export ops brief JSON'; jsonBtn.onclick = exportLatestJson;
      bar.appendChild(saveBtn); bar.appendChild(htmlBtn); bar.appendChild(jsonBtn);
    }
    const host = document.querySelector('#app') || document.body;
    const latest = readBriefs()[0] || null;
    const existing = document.getElementById('routexOpsBriefCard');
    if(existing) existing.remove();
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'routexOpsBriefCard';
    const s = latest ? latest.snapshot || {} : snapshot();
    card.innerHTML = '<h2 style="margin:0 0 10px;">Operator command brief</h2>' + (latest ? ('<div><span class="badge">'+esc(latest.fingerprint || '—')+'</span><span class="badge">Readiness '+esc(String(s.readiness || 0))+'/'+esc(String(s.readinessMax || 0))+'</span><span class="badge">'+(latest.ok ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">Route packs <span class="mono">'+esc(String(s.routePacks || 0))+'</span> • Trip packs <span class="mono">'+esc(String(s.tripPacks || 0))+'</span> • Binders <span class="mono">'+esc(String(s.binders || 0))+'</span> • Receipts <span class="mono">'+esc(String(s.receipts || 0))+'</span></div><div style="margin-top:8px;">'+esc(latest.note || '')+'</div>') : 'No operator command brief saved yet.');
    host.appendChild(card);
  }
  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };
  window.readRoutexOperatorCommandBriefs = readBriefs;
  window.readRoutexOperatorCommandBriefOutbox = readOutbox;
  window.saveRoutexOperatorCommandBrief = saveBrief;
})();