/* V31 AE FLOW no-dead completion binder sync */
(function(){
  if(window.__AEFLOW_V31__) return; window.__AEFLOW_V31__ = true;
  const OUTBOX_KEY = 'skye_routex_no_dead_completion_binder_outbox_v1';
  const INBOX_KEY = 'skye_aeflow_imported_routex_no_dead_completion_binders_v1';
  const LOG_KEY = 'skye_aeflow_routex_no_dead_completion_binder_sync_log_v1';
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function readOutbox(){ return readJSON(OUTBOX_KEY, []).filter(Boolean).slice(0,40); }
  function readInbox(){ return readJSON(INBOX_KEY, []).filter(Boolean).slice(0,60); }
  function readLog(){ return readJSON(LOG_KEY, []).filter(Boolean).slice(0,60); }
  function saveInbox(items){ return writeJSON(INBOX_KEY, (Array.isArray(items) ? items : []).slice(0,60)); }
  function pushLog(row){ const list = readLog().filter(item => clean(item && item.id) !== clean(row && row.id)); list.unshift({ id:'aeflow-v31-' + Date.now().toString(36), at:new Date().toISOString(), ...(row || {}) }); writeJSON(LOG_KEY, list.slice(0,60)); return list[0]; }
  function syncOutbox(){ const outbox = readOutbox(); const inbox = readInbox(); let merged = 0, duplicate = 0; outbox.forEach(item => { if(inbox.some(existing => clean(existing && existing.fingerprint) === clean(item && item.fingerprint))){ duplicate++; return; } merged++; inbox.unshift({ ...(item || {}), imported_at:new Date().toISOString(), source: clean(item && item.source) || 'routex-no-dead-completion-binder-outbox' }); }); saveInbox(inbox); return pushLog({ merged, duplicate, total: outbox.length, note:'No-dead completion binder sync merged ' + merged + ' binder(s).' }); }
  function buildInboxHtml(){ const rows = readInbox().map(item => '<tr><td>'+esc(item.label || 'Routex completion binder')+'</td><td>'+esc(item.fingerprint || '—')+'</td><td>'+esc(item.walkthroughReviewer || '—')+'</td><td>'+esc(String(item.walkthroughDone || 0))+'/'+esc(String(item.walkthroughTotal || 0))+'</td><td>'+(item.receiptOk ? 'OK' : 'REVIEW')+'</td><td>'+(item.ok ? 'PASS' : 'REVIEW')+'</td><td>'+esc(item.note || '')+'</td></tr>').join(''); return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AE FLOW Routex completion binder inbox</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1120px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">AE FLOW • Routex completion binder inbox</h1><div><span class="badge">Imported binders '+esc(String(readInbox().length))+'</span><span class="badge">Sync rows '+esc(String(readLog().length))+'</span></div></div><div class="card"><table><thead><tr><th>Label</th><th>Fingerprint</th><th>Reviewer</th><th>Walkthrough</th><th>Receipt</th><th>OK</th><th>Note</th></tr></thead><tbody>'+(rows || '<tr><td colspan="7">No Routex completion binders imported yet.</td></tr>')+'</tbody></table></div></div></body></html>'; }
  function injectControls(){
    const bar = document.querySelector('#routexWorkbenchToolbar') || document.querySelector('.toolbar') || document.querySelector('.row');
    if(bar && !document.getElementById('aeRoutexCompletionBinderSyncBtn')){
      const syncBtn = document.createElement('button'); syncBtn.className='btn small'; syncBtn.id='aeRoutexCompletionBinderSyncBtn'; syncBtn.textContent='Sync Completion Binder'; syncBtn.onclick = ()=>{ const row = syncOutbox(); toast(row.merged ? 'Routex completion binder synced.' : 'No new Routex completion binders.', row.merged ? 'good' : 'warn'); if(typeof window.renderAll === 'function') window.renderAll(); }; bar.appendChild(syncBtn);
      const inboxBtn = document.createElement('button'); inboxBtn.className='btn small'; inboxBtn.id='aeRoutexCompletionBinderInboxBtn'; inboxBtn.textContent='Completion Binder Inbox'; inboxBtn.onclick = ()=>{ downloadText(buildInboxHtml(), 'ae_flow_routex_completion_binder_inbox_' + dayISO() + '.html', 'text/html'); toast('Routex completion binder inbox exported.', 'good'); }; bar.appendChild(inboxBtn);
    }
    const latest = readInbox()[0] || null;
    const host = document.querySelector('#routexWorkbenchHost') || document.querySelector('#app') || document.body;
    if(host && !document.getElementById('aeRoutexCompletionBinderCard')){
      const card = document.createElement('div');
      card.className = 'card';
      card.id = 'aeRoutexCompletionBinderCard';
      card.innerHTML = '<h2 style="margin:0 0 10px;">Routex completion binder</h2>' + (latest ? ('<div><span class="badge">'+esc(latest.fingerprint || '—')+'</span><span class="badge">Reviewer '+esc(latest.walkthroughReviewer || '—')+'</span><span class="badge">Walkthrough '+esc(String(latest.walkthroughDone || 0))+'/'+esc(String(latest.walkthroughTotal || 0))+'</span><span class="badge">'+(latest.ok ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(latest.note || '')+'</div>') : 'No imported Routex completion binder yet.');
      host.appendChild(card);
    }
  }
  const observer = new MutationObserver(()=> injectControls());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(()=>{ const existing = document.getElementById('aeRoutexCompletionBinderCard'); if(existing) existing.remove(); injectControls(); }, 0); return out; };
  window.readAEFlowRoutexCompletionBinders = readInbox;
})();

/* V32 AE FLOW Routex operator command brief sync */
(function(){
  if(window.__AEFLOW_V32__) return; window.__AEFLOW_V32__ = true;
  const OUTBOX_KEY = 'skye_routex_operator_command_brief_outbox_v1';
  const INBOX_KEY = 'skye_aeflow_imported_routex_operator_command_briefs_v1';
  const LOG_KEY = 'skye_aeflow_routex_operator_command_brief_sync_log_v1';
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function readOutbox(){ return readJSON(OUTBOX_KEY, []).filter(Boolean).slice(0,40); }
  function readInbox(){ return readJSON(INBOX_KEY, []).filter(Boolean).slice(0,60); }
  function readLog(){ return readJSON(LOG_KEY, []).filter(Boolean).slice(0,60); }
  function saveInbox(items){ return writeJSON(INBOX_KEY, (Array.isArray(items) ? items : []).slice(0,60)); }
  function pushLog(row){ const list = readLog().filter(item => clean(item && item.id) !== clean(row && row.id)); list.unshift({ id:'aeflow-v32-' + Date.now().toString(36), at:new Date().toISOString(), ...(row || {}) }); writeJSON(LOG_KEY, list.slice(0,60)); return list[0]; }
  function syncOutbox(){ const outbox = readOutbox(); const inbox = readInbox(); let merged = 0, duplicate = 0; outbox.forEach(item => { if(inbox.some(existing => clean(existing && existing.fingerprint) === clean(item && item.fingerprint))){ duplicate++; return; } merged++; inbox.unshift({ ...(item || {}), imported_at:new Date().toISOString(), source: clean(item && item.source) || 'routex-operator-command-brief-outbox' }); }); saveInbox(inbox); return pushLog({ merged, duplicate, total: outbox.length, note:'Routex operator command brief sync merged ' + merged + ' brief(s).' }); }
  function buildInboxHtml(){ const rows = readInbox().map(item => { const snap = item.snapshot || {}; return '<tr><td>'+esc(item.label || 'Routex operator command brief')+'</td><td>'+esc(item.fingerprint || '—')+'</td><td>'+esc(String(snap.readiness || 0))+'/'+esc(String(snap.readinessMax || 0))+'</td><td>'+esc(String(snap.routePacks || 0))+'</td><td>'+esc(String(snap.tripPacks || 0))+'</td><td>'+esc(String(snap.binders || 0))+'</td><td>'+(item.ok ? 'PASS' : 'REVIEW')+'</td></tr>'; }).join(''); return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AE FLOW Routex operator command brief inbox</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1120px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">AE FLOW • Routex operator command brief inbox</h1><div><span class="badge">Imported briefs '+esc(String(readInbox().length))+'</span><span class="badge">Sync rows '+esc(String(readLog().length))+'</span></div></div><div class="card"><table><thead><tr><th>Label</th><th>Fingerprint</th><th>Readiness</th><th>Route packs</th><th>Trip packs</th><th>Binders</th><th>OK</th></tr></thead><tbody>'+(rows || '<tr><td colspan="7">No Routex operator command briefs imported yet.</td></tr>')+'</tbody></table></div></div></body></html>'; }
  function inject(){
    const bar = document.querySelector('#routexWorkbenchToolbar') || document.querySelector('.toolbar') || document.querySelector('.row');
    if(bar && !document.getElementById('aeRoutexOpsBriefSyncBtn')){
      const syncBtn = document.createElement('button'); syncBtn.className='btn small'; syncBtn.id='aeRoutexOpsBriefSyncBtn'; syncBtn.textContent='Sync Ops Brief'; syncBtn.onclick = ()=>{ const row = syncOutbox(); toast(row.merged ? 'Routex operator brief synced.' : 'No new Routex operator briefs.', row.merged ? 'good' : 'warn'); if(typeof window.renderAll === 'function') window.renderAll(); };
      const inboxBtn = document.createElement('button'); inboxBtn.className='btn small'; inboxBtn.id='aeRoutexOpsBriefInboxBtn'; inboxBtn.textContent='Ops Brief Inbox'; inboxBtn.onclick = ()=>{ downloadText(buildInboxHtml(), 'ae_flow_routex_operator_command_brief_inbox_' + dayISO() + '.html', 'text/html'); toast('Routex operator brief inbox exported.', 'good'); };
      bar.appendChild(syncBtn); bar.appendChild(inboxBtn);
    }
    const latest = readInbox()[0] || null;
    const host = document.querySelector('#routexWorkbenchHost') || document.querySelector('#app') || document.body;
    const existing = document.getElementById('aeRoutexOpsBriefCard');
    if(existing) existing.remove();
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'aeRoutexOpsBriefCard';
    const s = latest ? latest.snapshot || {} : {};
    card.innerHTML = '<h2 style="margin:0 0 10px;">Routex operator command brief</h2>' + (latest ? ('<div><span class="badge">'+esc(latest.fingerprint || '—')+'</span><span class="badge">Readiness '+esc(String(s.readiness || 0))+'/'+esc(String(s.readinessMax || 0))+'</span><span class="badge">'+(latest.ok ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">Route packs <span class="mono">'+esc(String(s.routePacks || 0))+'</span> • Trip packs <span class="mono">'+esc(String(s.tripPacks || 0))+'</span> • Binders <span class="mono">'+esc(String(s.binders || 0))+'</span> • Receipts <span class="mono">'+esc(String(s.receipts || 0))+'</span></div><div style="margin-top:8px;">'+esc(latest.note || '')+'</div>') : 'No imported Routex operator command brief yet.');
    host.appendChild(card);
  }
  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };
  window.readAEFlowRoutexOperatorCommandBriefs = readInbox;
  window.syncRoutexOperatorCommandBriefOutboxToAE = syncOutbox;
})();