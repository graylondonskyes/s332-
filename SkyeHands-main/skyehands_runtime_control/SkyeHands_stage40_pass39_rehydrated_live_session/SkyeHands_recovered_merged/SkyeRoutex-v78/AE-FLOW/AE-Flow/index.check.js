/* V23 AE FLOW legacy proof shared sync */
(function(){
  if(window.__AEFLOW_V23__) return; window.__AEFLOW_V23__ = true;
  const ROUTEX_LEGACY_OUTBOX_KEY = 'skye_routex_legacy_outbox_v1';
  const AE_LEGACY_INBOX_KEY = 'skye_aeflow_imported_routex_legacy_v1';
  const AE_LEGACY_SYNC_LOG_KEY = 'skye_aeflow_routex_legacy_sync_log_v1';
  const readJSON = (key, fallback)=>{ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } };
  const writeJSON = (key, value)=> localStorage.setItem(key, JSON.stringify(value));
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHtml || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const uid = window.uid || (()=>('ae23-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  function readLegacyOutbox(){ return readJSON(ROUTEX_LEGACY_OUTBOX_KEY, []).filter(Boolean).slice(0,80); }
  function readLegacyInbox(){ return readJSON(AE_LEGACY_INBOX_KEY, []).filter(Boolean).slice(0,80); }
  function saveLegacyInbox(rows){ writeJSON(AE_LEGACY_INBOX_KEY, (Array.isArray(rows) ? rows : []).slice(0,80)); }
  function readLegacySyncLog(){ return readJSON(AE_LEGACY_SYNC_LOG_KEY, []).filter(Boolean).slice(0,80); }
  function saveLegacySyncLog(rows){ writeJSON(AE_LEGACY_SYNC_LOG_KEY, (Array.isArray(rows) ? rows : []).slice(0,80)); }
  function pushLegacySyncLog(row){ const rows = readLegacySyncLog().filter(item => clean(item.id) !== clean(row.id)); rows.unshift(row); saveLegacySyncLog(rows); return row; }
  function normalizeLegacyRow(raw){ const row = raw && typeof raw === 'object' ? raw : {}; return { id: clean(row.id) || uid(), label: clean(row.label) || clean(row.type) || 'Imported Routex legacy proof', fingerprint: clean(row.fingerprint) || ('lg-' + uid()), imported_at: new Date().toISOString(), source: clean(row.source) || 'routex-legacy-outbox', lane: clean(row.lane), note: clean(row.note), routeCount: Number(row.routeCount || 0), stopCount: Number(row.stopCount || 0), docCount: Number(row.docCount || 0), latestMatrixId: clean(row.latestMatrixId), matrixSummary: row.matrixSummary || null, proofStates: row.proofStates || null }; }
  function syncLegacyOutbox(){
    const inbox = readLegacyInbox();
    let merged = 0, duplicate = 0;
    readLegacyOutbox().forEach(item => {
      const row = normalizeLegacyRow(item);
      if(inbox.some(existing => clean(existing.fingerprint) === clean(row.fingerprint))){ duplicate += 1; return; }
      inbox.unshift(row);
      merged += 1;
    });
    saveLegacyInbox(inbox);
    return pushLegacySyncLog({ id: uid(), at: new Date().toISOString(), merged, duplicate, total: readLegacyOutbox().length, note: 'Routex legacy outbox sync ' + merged + ' merged / ' + duplicate + ' duplicate.' });
  }
  function buildLegacySyncLogHtml(){ const rows = readLegacySyncLog().map(item => '<tr><td>'+esc(new Date(item.at || Date.now()).toLocaleString())+'</td><td>'+esc(String(item.merged || 0))+'</td><td>'+esc(String(item.duplicate || 0))+'</td><td>'+esc(String(item.total || 0))+'</td><td>'+esc(item.note || '')+'</td></tr>').join(''); return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AE FLOW Routex legacy sync log</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:980px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">AE FLOW • Routex legacy sync log</h1><div><span class="badge">Legacy outbox '+esc(String(readLegacyOutbox().length))+'</span><span class="badge">Legacy inbox '+esc(String(readLegacyInbox().length))+'</span></div></div><div class="card"><table><thead><tr><th>When</th><th>Merged</th><th>Duplicate</th><th>Outbox</th><th>Note</th></tr></thead><tbody>'+(rows || '<tr><td colspan="5">No legacy sync log yet.</td></tr>')+'</tbody></table></div></div>\n</body></html>'; }
  function injectLegacySyncControls(){
    const bar = document.getElementById('routexLensToolbar') || document.querySelector('.toolbar .row') || document.querySelector('.toolbar');
    if(bar && !document.getElementById('aeRoutexLegacySyncBtn')){
      const syncBtn = document.createElement('button'); syncBtn.className='btn small'; syncBtn.id='aeRoutexLegacySyncBtn'; syncBtn.textContent='Sync Legacy'; syncBtn.onclick = ()=>{ const result = syncLegacyOutbox(); toast(result.merged ? 'Routex legacy proofs synced.' : 'No new Routex legacy proofs.', result.merged ? 'good' : 'warn'); if(typeof window.renderAll === 'function') window.renderAll(); }; bar.appendChild(syncBtn);
      const logBtn = document.createElement('button'); logBtn.className='btn small'; logBtn.id='aeRoutexLegacySyncLogBtn'; logBtn.textContent='Legacy Sync Log'; logBtn.onclick = ()=>{ downloadText(buildLegacySyncLogHtml(), 'ae_flow_routex_legacy_sync_log_' + dayISO() + '.html', 'text/html'); toast('Routex legacy sync log exported.', 'good'); }; bar.appendChild(logBtn);
      const badge = document.createElement('div'); badge.className='muted2'; badge.id='aeRoutexLegacySyncBadge'; badge.style.marginLeft='8px'; badge.textContent='Imported legacy proofs: ' + readLegacyInbox().length; bar.appendChild(badge);
    }
    const badge = document.getElementById('aeRoutexLegacySyncBadge');
    if(badge) badge.textContent = 'Imported legacy proofs: ' + readLegacyInbox().length;
  }
  const prevWorkbench = window.buildAERoutexWorkbenchHtml;
  if(typeof prevWorkbench === 'function'){
    window.buildAERoutexWorkbenchHtml = function(){
      const htmlDoc = prevWorkbench.apply(this, arguments);
      const latest = readLegacyInbox()[0] || null;
      const inject = '<div class="card"><h2 style="margin:0 0 10px;">Routex legacy proof sync</h2>' + (latest ? ('<div><span class="badge">'+esc(latest.fingerprint || '—')+'</span><span class="badge">'+esc(latest.lane || 'legacy')+'</span><span class="badge">Routes '+esc(String(latest.routeCount || 0))+'</span><span class="badge">Stops '+esc(String(latest.stopCount || 0))+'</span></div><div style="margin-top:8px;">'+esc(latest.label || 'Imported Routex legacy proof')+'</div>') : 'No synced Routex legacy proof yet.') + '</div>';
      return htmlDoc.replace('</div></body></html>', inject + '</div></body></html>');
    };
  }
  const prevRenderAll = window.renderAll;
  if(typeof prevRenderAll === 'function'){
    window.renderAll = function(){ const out = prevRenderAll.apply(this, arguments); try{ syncLegacyOutbox(); }catch(_){ } setTimeout(injectLegacySyncControls, 0); return out; };
  }
  window.syncRoutexLegacyOutboxToAE = syncLegacyOutbox;
})();

/* V26 AE FLOW no-dead proof sync */
(function(){
  if(window.__AEFLOW_V26__) return; window.__AEFLOW_V26__ = true;
  const OUTBOX_KEY = 'skye_routex_no_dead_button_outbox_v1';
  const INBOX_KEY = 'skye_aeflow_imported_routex_no_dead_v1';
  const LOG_KEY = 'skye_aeflow_routex_no_dead_sync_log_v1';
  const readJSON = (key, fallback)=>{ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } };
  const writeJSON = (key, value)=> localStorage.setItem(key, JSON.stringify(value));
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHtml || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const uid = window.uid || (()=>('ae26-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  function readOutbox(){ return readJSON(OUTBOX_KEY, []).filter(Boolean).slice(0,80); }
  function readInbox(){ return readJSON(INBOX_KEY, []).filter(Boolean).slice(0,80); }
  function saveInbox(items){ writeJSON(INBOX_KEY, (Array.isArray(items) ? items : []).slice(0,80)); }
  function readLog(){ return readJSON(LOG_KEY, []).filter(Boolean).slice(0,80); }
  function saveLog(items){ writeJSON(LOG_KEY, (Array.isArray(items) ? items : []).slice(0,80)); }
  function pushLog(row){ const item = { id: uid(), at: new Date().toISOString(), ...(row || {}) }; const list = readLog().filter(entry => clean(entry.id) !== clean(item.id)); list.unshift(item); saveLog(list); return item; }
  function normalizeRow(raw){
    const row = raw && typeof raw === 'object' ? raw : {};
    const laneResults = Array.isArray(row.laneResults) ? row.laneResults : [];
    return {
      id: clean(row.id) || uid(),
      label: clean(row.label) || 'Imported Routex no-dead proof',
      fingerprint: clean(row.fingerprint) || ('ndb-' + uid()),
      imported_at: new Date().toISOString(),
      source: clean(row.source) || 'routex-no-dead-proof-outbox',
      sweepPassed: Number(row.sweepPassed || 0),
      sweepTotal: Number(row.sweepTotal || 0),
      walkthroughDone: Number(row.walkthroughDone || 0),
      walkthroughTotal: Number(row.walkthroughTotal || 0),
      walkthroughReviewer: clean(row.walkthroughReviewer),
      laneCount: laneResults.length,
      laneResults: laneResults.map(item => ({ lane: clean(item && item.lane), ok: !!(item && item.ok), passedChecks: Number(item && item.passedChecks || 0), checkCount: Number(item && item.checkCount || 0), note: clean(item && item.note) })),
      note: clean(row.note)
    };
  }
  function syncNoDeadOutbox(){
    const inbox = readInbox();
    let merged = 0, duplicate = 0;
    readOutbox().forEach(item => {
      const row = normalizeRow(item);
      if(inbox.some(existing => clean(existing.fingerprint) === clean(row.fingerprint))){ duplicate += 1; return; }
      inbox.unshift(row);
      merged += 1;
    });
    saveInbox(inbox);
    return pushLog({ merged, duplicate, total: readOutbox().length, note: 'Routex no-dead proof sync ' + merged + ' merged / ' + duplicate + ' duplicate.' });
  }
  function buildNoDeadSyncLogHtml(){
    const rows = readLog().map(item => '<tr><td>'+esc(new Date(item.at || Date.now()).toLocaleString())+'</td><td>'+esc(String(item.merged || 0))+'</td><td>'+esc(String(item.duplicate || 0))+'</td><td>'+esc(String(item.total || 0))+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AE FLOW Routex no-dead sync log</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:980px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">AE FLOW • Routex no-dead sync log</h1><div><span class="badge">Outbox '+esc(String(readOutbox().length))+'</span><span class="badge">Inbox '+esc(String(readInbox().length))+'</span><span class="badge">Log rows '+esc(String(readLog().length))+'</span></div></div><div class="card"><table><thead><tr><th>When</th><th>Merged</th><th>Duplicate</th><th>Outbox</th><th>Note</th></tr></thead><tbody>'+(rows || '<tr><td colspan="5">No no-dead sync log yet.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function injectNoDeadControls(){
    const bar = document.getElementById('routexLensToolbar') || document.querySelector('.toolbar .row') || document.querySelector('.toolbar');
    if(bar && !document.getElementById('aeRoutexNoDeadSyncBtn')){
      const syncBtn = document.createElement('button'); syncBtn.className='btn small'; syncBtn.id='aeRoutexNoDeadSyncBtn'; syncBtn.textContent='Sync No-Dead Proof'; syncBtn.onclick = ()=>{ const result = syncNoDeadOutbox(); toast(result.merged ? 'Routex no-dead proofs synced.' : 'No new Routex no-dead proofs.', result.merged ? 'good' : 'warn'); if(typeof window.renderAll === 'function') window.renderAll(); }; bar.appendChild(syncBtn);
      const logBtn = document.createElement('button'); logBtn.className='btn small'; logBtn.id='aeRoutexNoDeadSyncLogBtn'; logBtn.textContent='No-Dead Sync Log'; logBtn.onclick = ()=>{ downloadText(buildNoDeadSyncLogHtml(), 'ae_flow_routex_no_dead_sync_log_' + dayISO() + '.html', 'text/html'); toast('Routex no-dead sync log exported.', 'good'); }; bar.appendChild(logBtn);
    }
  }
  const prevWorkbench = window.buildAERoutexWorkbenchHtml;
  if(typeof prevWorkbench === 'function'){
    window.buildAERoutexWorkbenchHtml = function(){
      const htmlDoc = prevWorkbench.apply(this, arguments);
      const latest = readInbox()[0] || null;
      const inject = '<div class="card"><h2 style="margin:0 0 10px;">Routex no-dead-button proof sync</h2>' + (latest ? ('<div><span class="badge">'+esc(latest.fingerprint || '—')+'</span><span class="badge">Sweep '+esc(String(latest.sweepPassed || 0))+'/'+esc(String(latest.sweepTotal || 0))+'</span><span class="badge">Walkthrough '+esc(String(latest.walkthroughDone || 0))+'/'+esc(String(latest.walkthroughTotal || 0))+'</span></div><div style="margin-top:8px;">'+esc(latest.label || 'Imported Routex no-dead proof')+'</div><div style="margin-top:8px;">'+esc(latest.note || '')+'</div>') : 'No synced Routex no-dead proof yet.') + '</div>';
      return htmlDoc.replace('</div></body></html>', inject + '</div></body></html>');
    };
  }
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); try{ syncNoDeadOutbox(); }catch(_){ } setTimeout(injectNoDeadControls, 0); return out; };
  window.syncRoutexNoDeadOutboxToAE = syncNoDeadOutbox;
})();

/* V27 AE FLOW actual shipped legacy visibility */
(function(){
  if(window.__AEFLOW_V27__) return; window.__AEFLOW_V27__ = true;
  const LEGACY_INBOX_KEY = 'skye_aeflow_imported_routex_legacy_v1';
  const html = window.escapeHtml || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  function readLegacyInbox(){ try{ const raw = JSON.parse(localStorage.getItem(LEGACY_INBOX_KEY)||'[]'); return Array.isArray(raw) ? raw : []; }catch(_){ return []; } }
  function summarizeActualShipped(){
    const rows = readLegacyInbox();
    const packageRows = rows.filter(item => clean(item.source) === 'actual-shipped-package-manifest' || /Actual shipped package/i.test(clean(item.label)));
    const compareRows = rows.filter(item => /Actual shipped legacy compare/i.test(clean(item.label)));
    return { packageRows, compareRows, latestCompare: compareRows[0] || null };
  }
  const prevWorkbench = window.buildAERoutexWorkbenchHtml;
  if(typeof prevWorkbench === 'function'){
    window.buildAERoutexWorkbenchHtml = function(){
      const htmlDoc = prevWorkbench.apply(this, arguments);
      const summary = summarizeActualShipped();
      const latest = summary.latestCompare;
      const inject = '<div class="card"><h2 style="margin:0 0 10px;">Routex actual shipped legacy corpus</h2>' +
        '<div><span class="badge">Packages ' + html(String(summary.packageRows.length)) + '</span><span class="badge">Compare runs ' + html(String(summary.compareRows.length)) + '</span></div>' +
        '<div style="margin-top:10px;">' + (latest ? ('<span class="badge">' + html(latest.fingerprint || '—') + '</span><span class="badge">' + html(latest.label || 'Actual shipped legacy compare') + '</span><div style="margin-top:8px;">' + html(latest.note || '') + '</div>') : 'No imported actual shipped legacy compare yet.') + '</div></div>';
      return htmlDoc.replace('</div></body></html>', inject + '</div></body></html>');
    };
  }
})();

/* V21 AE FLOW closure sync assist */
(function(){
  if(window.__AEFLOW_V21__) return; window.__AEFLOW_V21__ = true;
  const ROUTEX_CAPSULE_OUTBOX_KEY = 'skye_routex_cross_device_outbox_v1';
  const AE_CAPSULE_INBOX_KEY = 'skye_aeflow_imported_routex_capsules_v1';
  const AE_LEGACY_INBOX_KEY = 'skye_aeflow_imported_routex_legacy_v1';
  const html = window.escapeHtml || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const hash = window.tinyAEHash || function(input){ const str = String(input || ''); let h = 2166136261 >>> 0; for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ('00000000' + (h >>> 0).toString(16)).slice(-8); };
  const now = ()=> new Date().toISOString();
  function readKey(key){ try{ const raw = JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(raw) ? raw : []; }catch(_){ return []; } }
  function writeKey(key, rows){ localStorage.setItem(key, JSON.stringify((Array.isArray(rows)?rows:[]).slice(0,60))); }
  function readRoutexCapsuleOutbox(){ return readKey(ROUTEX_CAPSULE_OUTBOX_KEY); }
  function readImportedRoutexCapsules(){ return readKey(AE_CAPSULE_INBOX_KEY); }
  function writeImportedRoutexCapsules(rows){ writeKey(AE_CAPSULE_INBOX_KEY, rows); }
  function readImportedRoutexLegacy(){ return readKey(AE_LEGACY_INBOX_KEY); }
  function writeImportedRoutexLegacy(rows){ writeKey(AE_LEGACY_INBOX_KEY, rows); }
  function syncRoutexCapsuleOutbox(){
    const outbox = readRoutexCapsuleOutbox();
    const inbox = readImportedRoutexCapsules();
    let merged = 0, duplicate = 0;
    outbox.forEach(item => {
      const fp = clean(item && item.fingerprint);
      if(fp && inbox.some(row => clean(row.fingerprint) === fp)){ duplicate++; return; }
      merged++; inbox.unshift({ ...(item || {}), imported_at: now(), source: clean(item && item.source) || 'routex-cross-device-outbox' });
    });
    writeImportedRoutexCapsules(inbox.slice(0,60));
    return { merged, duplicate, total: outbox.length };
  }
  function importLegacyPayload(payload){
    const rows = Array.isArray(payload && payload.rows) ? payload.rows : (Array.isArray(payload) ? payload : [payload]);
    const inbox = readImportedRoutexLegacy();
    let merged = 0, duplicate = 0;
    rows.forEach(raw => {
      const row = { ...(raw && typeof raw === 'object' ? raw : {}), id: clean(raw && raw.id) || ('legacy-' + hash(JSON.stringify(raw || {}) + now())), fingerprint: clean(raw && raw.fingerprint) || ('lg-' + hash(JSON.stringify(raw || {}))), imported_at: now(), label: clean(raw && raw.label) || clean(raw && raw.type) || 'Imported Routex legacy proof' };
      if(inbox.some(item => clean(item.fingerprint) === clean(row.fingerprint))){ duplicate++; return; }
      merged++; inbox.unshift(row);
    });
    writeImportedRoutexLegacy(inbox.slice(0,60));
    return { merged, duplicate };
  }
  function openLegacyPicker(){
    const input = document.createElement('input'); input.type='file'; input.accept='.json,application/json';
    input.onchange = async ()=>{ const file = input.files && input.files[0]; if(!file) return; let data = null; try{ data = JSON.parse(await file.text()); }catch(_){ return toast('Invalid Routex legacy proof JSON.'); } const merged = importLegacyPayload(data); toast('Routex legacy intake: ' + merged.merged + ' merged, ' + merged.duplicate + ' duplicate.'); renderAll(); };
    input.click();
  }
  function buildCapsuleInboxHtml(){
    const rows = readImportedRoutexCapsules().map(item => '<tr><td>'+html(item.label || 'Capsule')+'</td><td>'+html(item.fingerprint || '—')+'</td><td>'+html(String(item.routeCount || 0))+'</td><td>'+html(String(item.stopCount || 0))+'</td><td>'+html(String(item.buttonSweepPassed || 0))+'/'+html(String(item.buttonSweepTotal || 0))+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AE FLOW Routex capsule inbox</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">AE FLOW • Routex capsule inbox</h1><div><span class="badge">Imported capsules '+html(String(readImportedRoutexCapsules().length))+'</span><span class="badge">Outbox '+html(String(readRoutexCapsuleOutbox().length))+'</span></div></div><div class="card"><table><thead><tr><th>Label</th><th>Fingerprint</th><th>Routes</th><th>Stops</th><th>Buttons</th></tr></thead><tbody>'+(rows || '<tr><td colspan="5">No Routex capsules imported yet.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function buildLegacyInboxHtml(){
    const rows = readImportedRoutexLegacy().map(item => '<tr><td>'+html(item.label || 'Legacy proof')+'</td><td>'+html(item.fingerprint || '—')+'</td><td>'+html(item.source || '—')+'</td><td>'+html(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AE FLOW Routex legacy inbox</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">AE FLOW • Routex legacy inbox</h1><div><span class="badge">Imported legacy packages '+html(String(readImportedRoutexLegacy().length))+'</span></div></div><div class="card"><table><thead><tr><th>Label</th><th>Fingerprint</th><th>Source</th><th>Note</th></tr></thead><tbody>'+(rows || '<tr><td colspan="4">No imported Routex legacy proofs yet.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  const __ensureRoutexAccountsToolbar_v21 = window.ensureRoutexAccountsToolbar;
  if(typeof __ensureRoutexAccountsToolbar_v21 === 'function'){
    window.ensureRoutexAccountsToolbar = function(){
      const bar = __ensureRoutexAccountsToolbar_v21.apply(this, arguments);
      if(bar && !document.getElementById('aeRoutexCapsuleSyncBtn')){
        const syncBtn = document.createElement('button'); syncBtn.className='btn small'; syncBtn.id='aeRoutexCapsuleSyncBtn'; syncBtn.textContent='Sync Capsules'; syncBtn.onclick = ()=>{ const result = syncRoutexCapsuleOutbox(); toast(result.merged ? 'Routex capsules synced.' : 'No new Routex capsules.', result.merged ? 'good' : 'warn'); renderAll(); }; bar.appendChild(syncBtn);
        const inboxBtn = document.createElement('button'); inboxBtn.className='btn small'; inboxBtn.id='aeRoutexCapsuleInboxBtn'; inboxBtn.textContent='Capsule Inbox'; inboxBtn.onclick = ()=>{ downloadText(buildCapsuleInboxHtml(), 'ae_flow_routex_capsule_inbox_' + (typeof dayISO === 'function' ? dayISO() : now().slice(0,10)) + '.html', 'text/html'); toast('Routex capsule inbox exported.'); }; bar.appendChild(inboxBtn);
        const legacyBtn = document.createElement('button'); legacyBtn.className='btn small'; legacyBtn.id='aeRoutexLegacyImportBtn'; legacyBtn.textContent='Import Legacy'; legacyBtn.onclick = ()=> openLegacyPicker(); bar.appendChild(legacyBtn);
        const legacyInboxBtn = document.createElement('button'); legacyInboxBtn.className='btn small'; legacyInboxBtn.id='aeRoutexLegacyInboxBtn'; legacyInboxBtn.textContent='Legacy Inbox'; legacyInboxBtn.onclick = ()=>{ downloadText(buildLegacyInboxHtml(), 'ae_flow_routex_legacy_inbox_' + (typeof dayISO === 'function' ? dayISO() : now().slice(0,10)) + '.html', 'text/html'); toast('Routex legacy inbox exported.'); }; bar.appendChild(legacyInboxBtn);
      }
      return bar;
    };
  }
  const __buildAERoutexWorkbenchHtml_v21 = window.buildAERoutexWorkbenchHtml;
  if(typeof __buildAERoutexWorkbenchHtml_v21 === 'function'){
    window.buildAERoutexWorkbenchHtml = function(){
      const htmlDoc = __buildAERoutexWorkbenchHtml_v21.apply(this, arguments);
      const latestCap = readImportedRoutexCapsules()[0] || null;
      const latestLegacy = readImportedRoutexLegacy()[0] || null;
      const inject = '<div class="card"><h2 style="margin:0 0 10px;">Routex capsule + legacy intake</h2>' + (latestCap ? ('<div><span class="badge">Capsule ' + html(latestCap.fingerprint || '—') + '</span><span class="badge">Buttons ' + html(String(latestCap.buttonSweepPassed || 0)) + '/' + html(String(latestCap.buttonSweepTotal || 0)) + '</span></div><div style="margin-top:8px;">' + html(latestCap.label || 'Imported Routex capsule') + '</div>') : 'No imported Routex capsule yet.') + '<div style="margin-top:10px;">' + (latestLegacy ? ('<span class="badge">Legacy ' + html(latestLegacy.fingerprint || '—') + '</span><span class="badge">' + html(latestLegacy.label || 'Legacy proof') + '</span>') : 'No imported Routex legacy proof yet.') + '</div></div>';
      return htmlDoc.replace('</div></body></html>', inject + '</div></body></html>');
    };
  }
  const __renderAll_v21 = window.renderAll;
  if(typeof __renderAll_v21 === 'function'){
    window.renderAll = function(){ const out = __renderAll_v21.apply(this, arguments); try{ syncRoutexCapsuleOutbox(); }catch(_){ } return out; };
  }
  window.syncRoutexCapsuleOutboxToAE = syncRoutexCapsuleOutbox;
})();

/* V22 AE FLOW completion inbox */
(function(){
  if(window.__AEFLOW_V22__) return; window.__AEFLOW_V22__ = true;
  const ROUTEX_ATTEST_OUTBOX_KEY = 'skye_routex_device_attestation_outbox_v1';
  const AE_ATTEST_INBOX_KEY = 'skye_aeflow_imported_routex_attestations_v1';
  const readJSON = (key, fallback)=>{ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } };
  const writeJSON = (key, value)=> localStorage.setItem(key, JSON.stringify(value));
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHtml || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], {type: type || 'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name||'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const dayISO = ()=> new Date().toISOString().slice(0,10);
  const readOutbox = ()=> readJSON(ROUTEX_ATTEST_OUTBOX_KEY, []).filter(Boolean).slice(0,80);
  const readInbox = ()=> readJSON(AE_ATTEST_INBOX_KEY, []).filter(Boolean).slice(0,80);
  const saveInbox = rows => writeJSON(AE_ATTEST_INBOX_KEY, rows.slice(0,80));
  function syncRoutexAttestationOutbox(){ const inbox = readInbox(); const outbox = readOutbox(); let merged = 0, duplicate = 0; outbox.forEach(item => { const fp = clean(item && item.fingerprint); if(!fp || inbox.some(row => clean(row.fingerprint) === fp)){ duplicate++; return; } inbox.unshift({ ...(item || {}), imported_at: new Date().toISOString(), source: clean(item && item.source) || 'routex-attestation-outbox' }); merged++; }); saveInbox(inbox); return { merged, duplicate, total: outbox.length }; }
  function buildAttestationInboxHtml(){ const rows = readInbox().map(item => '<tr><td>'+esc(item.deviceLabel || 'device')+'</td><td><code>'+esc(item.fingerprint || '—')+'</code></td><td>'+esc(item.imported_at || item.createdAt || '')+'</td><td>'+esc(item.note || '')+'</td><td>'+esc(item.snapshot && item.snapshot.completionLabel || '—')+'</td></tr>').join(''); return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AE FLOW Routex attestation inbox</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:980px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">AE FLOW • Routex attestation inbox</h1><div>Imported attestations '+esc(String(readInbox().length))+'</div></div><div class="card"><table><thead><tr><th>Device</th><th>Fingerprint</th><th>Imported</th><th>Note</th><th>Snapshot</th></tr></thead><tbody>'+(rows || '<tr><td colspan="5">No Routex device attestations imported yet.</td></tr>')+'</tbody></table></div></div></body></html>'; }
  function importAttestationJson(){ const input = document.createElement('input'); input.type='file'; input.accept='.json,application/json'; input.onchange = async ()=>{ const file = input.files && input.files[0]; if(!file) return; let data=null; try{ data = JSON.parse(await file.text()); }catch(_){ return toast('Invalid Routex device attestation JSON.'); } const inbox = readInbox(); if(!inbox.some(item => clean(item.fingerprint) === clean(data && data.fingerprint))){ inbox.unshift({ ...(data || {}), imported_at: new Date().toISOString(), source: clean(data && data.source) || 'manual-json-import' }); saveInbox(inbox); toast('Routex device attestation imported.', 'good'); if(typeof window.renderAll === 'function') window.renderAll(); } else { toast('That attestation is already in the inbox.', 'warn'); } }; input.click(); }
  function injectAttestationControls(){ const bar = document.querySelector('#routexLensToolbar') || document.querySelector('.toolbar .row') || document.querySelector('.toolbar'); if(bar && !document.querySelector('#aeRoutexAttestSyncBtn')){ const syncBtn = document.createElement('button'); syncBtn.className='btn small'; syncBtn.id='aeRoutexAttestSyncBtn'; syncBtn.textContent='Sync Attestations'; syncBtn.onclick = ()=>{ const result = syncRoutexAttestationOutbox(); toast(result.merged ? 'Routex attestations synced.' : 'No new Routex attestations.', result.merged ? 'good' : 'warn'); if(typeof window.renderAll === 'function') window.renderAll(); }; bar.appendChild(syncBtn); const importBtn = document.createElement('button'); importBtn.className='btn small'; importBtn.id='aeRoutexAttestImportBtn'; importBtn.textContent='Import Attestation'; importBtn.onclick = importAttestationJson; bar.appendChild(importBtn); const exportBtn = document.createElement('button'); exportBtn.className='btn small'; exportBtn.id='aeRoutexAttestExportBtn'; exportBtn.textContent='Attestation Inbox'; exportBtn.onclick = ()=>{ downloadText(buildAttestationInboxHtml(), 'ae_flow_routex_attestation_inbox_' + dayISO() + '.html', 'text/html'); toast('Routex attestation inbox exported.', 'good'); }; bar.appendChild(exportBtn); } if(!document.querySelector('[data-ae-kpi="routex-attestations"]')){ const host = document.querySelector('.toolbar') || document.querySelector('main') || document.body; const kpi = document.createElement('div'); kpi.className='meta'; kpi.dataset.aeKpi='routex-attestations'; kpi.style.marginTop='8px'; kpi.innerHTML='Routex device attestations: <b>'+readInbox().length+'</b>'; host.appendChild(kpi); } }
  const prevRenderAll = window.renderAll; if(typeof prevRenderAll === 'function') window.renderAll = function(){ const out = prevRenderAll.apply(this, arguments); try{ syncRoutexAttestationOutbox(); }catch(_){ } setTimeout(injectAttestationControls, 0); return out; };
  window.syncRoutexAttestationOutboxToAE = syncRoutexAttestationOutbox;
})();

/* V25 AE FLOW export/import sync log */
(function(){
  if(window.__AEFLOW_V25__) return; window.__AEFLOW_V25__ = true;
  const LOG_KEY = 'skye_aeflow_routex_transfer_sync_log_v1';
  const CAPSULE_INBOX_KEY = 'skye_aeflow_imported_routex_capsules_v1';
  const ATTEST_INBOX_KEY = 'skye_aeflow_imported_routex_attestations_v1';
  const esc = window.escapeHtml || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], {type: type || 'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name||'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const nowISO = ()=> new Date().toISOString();
  const dayISO = ()=> nowISO().slice(0,10);
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function readLog(){ return readJSON(LOG_KEY, []).filter(Boolean).slice(0,80); }
  function saveLog(items){ return writeJSON(LOG_KEY, (Array.isArray(items) ? items : []).slice(0,80)); }
  function pushLog(row){ const item = { id: 'xfer-' + Math.random().toString(36).slice(2), at: nowISO(), ...(row || {}) }; const list = readLog().filter(entry => clean(entry.id) !== clean(item.id)); list.unshift(item); saveLog(list); return item; }
  function readCapsuleInbox(){ return readJSON(CAPSULE_INBOX_KEY, []).filter(Boolean).slice(0,80); }
  function readAttestInbox(){ return readJSON(ATTEST_INBOX_KEY, []).filter(Boolean).slice(0,80); }
  function runTransferSync(){
    const closure = typeof window.syncImportedRoutexClosureBundlesFromSharedOutbox === 'function' ? window.syncImportedRoutexClosureBundlesFromSharedOutbox() : { merged:0, duplicate:0, total:0 };
    const capsules = typeof window.syncRoutexCapsuleOutboxToAE === 'function' ? window.syncRoutexCapsuleOutboxToAE() : { merged:0, duplicate:0, total:0 };
    const attest = typeof window.syncRoutexAttestationOutboxToAE === 'function' ? window.syncRoutexAttestationOutboxToAE() : { merged:0, duplicate:0, total:0 };
    const mergedTotal = Number(closure.merged || 0) + Number(capsules.merged || 0) + Number(attest.merged || 0);
    return pushLog({
      closure, capsules, attest,
      mergedTotal,
      note: 'Transfer proof sync merged ' + mergedTotal + ' total payload(s) across closure, capsules, and attestations.'
    });
  }
  function buildTransferSyncLogHtml(){
    const rows = readLog().map(item => '<tr><td>'+esc(new Date(item.at || Date.now()).toLocaleString())+'</td><td>'+esc(String(item.mergedTotal || 0))+'</td><td>'+esc(String(item.closure && item.closure.merged || 0))+'</td><td>'+esc(String(item.capsules && item.capsules.merged || 0))+'</td><td>'+esc(String(item.attest && item.attest.merged || 0))+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AE FLOW Routex transfer sync log</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">AE FLOW • Routex transfer sync log</h1><div><span class="badge">Capsules '+esc(String(readCapsuleInbox().length))+'</span><span class="badge">Attestations '+esc(String(readAttestInbox().length))+'</span><span class="badge">Log rows '+esc(String(readLog().length))+'</span></div></div><div class="card"><table><thead><tr><th>When</th><th>Merged</th><th>Closure</th><th>Capsules</th><th>Attestations</th><th>Note</th></tr></thead><tbody>'+(rows || '<tr><td colspan="6">No transfer sync log yet.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function injectTransferControls(){
    const bar = document.querySelector('#routexLensToolbar') || document.querySelector('.toolbar .row') || document.querySelector('.toolbar');
    if(bar && !document.getElementById('aeRoutexTransferSyncBtn')){
      const syncBtn = document.createElement('button'); syncBtn.className='btn small'; syncBtn.id='aeRoutexTransferSyncBtn'; syncBtn.textContent='Sync Transfer Proof'; syncBtn.onclick = ()=>{ const row = runTransferSync(); toast(row.mergedTotal ? 'Routex transfer proof synced.' : 'No new Routex transfer proof payloads.', row.mergedTotal ? 'good' : 'warn'); if(typeof window.renderAll === 'function') window.renderAll(); }; bar.appendChild(syncBtn);
      const logBtn = document.createElement('button'); logBtn.className='btn small'; logBtn.id='aeRoutexTransferSyncLogBtn'; logBtn.textContent='Transfer Sync Log'; logBtn.onclick = ()=>{ downloadText(buildTransferSyncLogHtml(), 'ae_flow_routex_transfer_sync_log_' + dayISO() + '.html', 'text/html'); toast('Routex transfer sync log exported.', 'good'); }; bar.appendChild(logBtn);
    }
  }
  const prevWorkbench = window.buildAERoutexWorkbenchHtml;
  if(typeof prevWorkbench === 'function'){
    window.buildAERoutexWorkbenchHtml = function(){
      const htmlDoc = prevWorkbench.apply(this, arguments);
      const latestCap = readCapsuleInbox()[0] || null;
      const latestAtt = readAttestInbox()[0] || null;
      const latestLog = readLog()[0] || null;
      const inject = '<div class="card"><h2 style="margin:0 0 10px;">Routex export/import proof sync</h2>' + (latestLog ? ('<div><span class="badge">Merged '+esc(String(latestLog.mergedTotal || 0))+'</span><span class="badge">Capsules '+esc(String(latestLog.capsules && latestLog.capsules.merged || 0))+'</span><span class="badge">Attestations '+esc(String(latestLog.attest && latestLog.attest.merged || 0))+'</span></div><div style="margin-top:8px;">'+esc(latestLog.note || '')+'</div>') : 'No Routex transfer sync log yet.') + '<div style="margin-top:10px;">' + (latestCap ? ('<span class="badge">Capsule '+esc(latestCap.fingerprint || '—')+'</span><span class="badge">Routes '+esc(String(latestCap.routeCount || 0))+'</span><span class="badge">Stops '+esc(String(latestCap.stopCount || 0))+'</span>') : 'No imported Routex export/import capsule yet.') + '</div><div style="margin-top:10px;">' + (latestAtt ? ('<span class="badge">Attestation '+esc(latestAtt.fingerprint || '—')+'</span><span class="badge">'+esc(latestAtt.deviceLabel || 'device')+'</span>') : 'No imported Routex export/import attestation yet.') + '</div></div>';
      return htmlDoc.replace('</div></body></html>', inject + '</div></body></html>');
    };
  }
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(injectTransferControls, 0); return out; };
})();

/* V26 AE FLOW no-dead proof sync */
(function(){
  if(window.__AEFLOW_V26__) return; window.__AEFLOW_V26__ = true;
  const OUTBOX_KEY = 'skye_routex_no_dead_button_outbox_v1';
  const INBOX_KEY = 'skye_aeflow_imported_routex_no_dead_v1';
  const LOG_KEY = 'skye_aeflow_routex_no_dead_sync_log_v1';
  const readJSON = (key, fallback)=>{ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } };
  const writeJSON = (key, value)=> localStorage.setItem(key, JSON.stringify(value));
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHtml || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const uid = window.uid || (()=>('ae26-' + Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], { type: type || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name || 'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const dayISO = window.dayISO || (()=> new Date().toISOString().slice(0,10));
  function readOutbox(){ return readJSON(OUTBOX_KEY, []).filter(Boolean).slice(0,80); }
  function readInbox(){ return readJSON(INBOX_KEY, []).filter(Boolean).slice(0,80); }
  function saveInbox(items){ writeJSON(INBOX_KEY, (Array.isArray(items) ? items : []).slice(0,80)); }
  function readLog(){ return readJSON(LOG_KEY, []).filter(Boolean).slice(0,80); }
  function saveLog(items){ writeJSON(LOG_KEY, (Array.isArray(items) ? items : []).slice(0,80)); }
  function pushLog(row){ const item = { id: uid(), at: new Date().toISOString(), ...(row || {}) }; const list = readLog().filter(entry => clean(entry.id) !== clean(item.id)); list.unshift(item); saveLog(list); return item; }
  function normalizeRow(raw){
    const row = raw && typeof raw === 'object' ? raw : {};
    const laneResults = Array.isArray(row.laneResults) ? row.laneResults : [];
    return {
      id: clean(row.id) || uid(),
      label: clean(row.label) || 'Imported Routex no-dead proof',
      fingerprint: clean(row.fingerprint) || ('ndb-' + uid()),
      imported_at: new Date().toISOString(),
      source: clean(row.source) || 'routex-no-dead-proof-outbox',
      sweepPassed: Number(row.sweepPassed || 0),
      sweepTotal: Number(row.sweepTotal || 0),
      walkthroughDone: Number(row.walkthroughDone || 0),
      walkthroughTotal: Number(row.walkthroughTotal || 0),
      walkthroughReviewer: clean(row.walkthroughReviewer),
      laneCount: laneResults.length,
      laneResults: laneResults.map(item => ({ lane: clean(item && item.lane), ok: !!(item && item.ok), passedChecks: Number(item && item.passedChecks || 0), checkCount: Number(item && item.checkCount || 0), note: clean(item && item.note) })),
      note: clean(row.note)
    };
  }
  function syncNoDeadOutbox(){
    const inbox = readInbox();
    let merged = 0, duplicate = 0;
    readOutbox().forEach(item => {
      const row = normalizeRow(item);
      if(inbox.some(existing => clean(existing.fingerprint) === clean(row.fingerprint))){ duplicate += 1; return; }
      inbox.unshift(row);
      merged += 1;
    });
    saveInbox(inbox);
    return pushLog({ merged, duplicate, total: readOutbox().length, note: 'Routex no-dead proof sync ' + merged + ' merged / ' + duplicate + ' duplicate.' });
  }
  function buildNoDeadSyncLogHtml(){
    const rows = readLog().map(item => '<tr><td>'+esc(new Date(item.at || Date.now()).toLocaleString())+'</td><td>'+esc(String(item.merged || 0))+'</td><td>'+esc(String(item.duplicate || 0))+'</td><td>'+esc(String(item.total || 0))+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AE FLOW Routex no-dead sync log</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:980px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">AE FLOW • Routex no-dead sync log</h1><div><span class="badge">Outbox '+esc(String(readOutbox().length))+'</span><span class="badge">Inbox '+esc(String(readInbox().length))+'</span><span class="badge">Log rows '+esc(String(readLog().length))+'</span></div></div><div class="card"><table><thead><tr><th>When</th><th>Merged</th><th>Duplicate</th><th>Outbox</th><th>Note</th></tr></thead><tbody>'+(rows || '<tr><td colspan="5">No no-dead sync log yet.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function injectNoDeadControls(){
    const bar = document.getElementById('routexLensToolbar') || document.querySelector('.toolbar .row') || document.querySelector('.toolbar');
    if(bar && !document.getElementById('aeRoutexNoDeadSyncBtn')){
      const syncBtn = document.createElement('button'); syncBtn.className='btn small'; syncBtn.id='aeRoutexNoDeadSyncBtn'; syncBtn.textContent='Sync No-Dead Proof'; syncBtn.onclick = ()=>{ const result = syncNoDeadOutbox(); toast(result.merged ? 'Routex no-dead proofs synced.' : 'No new Routex no-dead proofs.', result.merged ? 'good' : 'warn'); if(typeof window.renderAll === 'function') window.renderAll(); }; bar.appendChild(syncBtn);
      const logBtn = document.createElement('button'); logBtn.className='btn small'; logBtn.id='aeRoutexNoDeadSyncLogBtn'; logBtn.textContent='No-Dead Sync Log'; logBtn.onclick = ()=>{ downloadText(buildNoDeadSyncLogHtml(), 'ae_flow_routex_no_dead_sync_log_' + dayISO() + '.html', 'text/html'); toast('Routex no-dead sync log exported.', 'good'); }; bar.appendChild(logBtn);
    }
  }
  const prevWorkbench = window.buildAERoutexWorkbenchHtml;
  if(typeof prevWorkbench === 'function'){
    window.buildAERoutexWorkbenchHtml = function(){
      const htmlDoc = prevWorkbench.apply(this, arguments);
      const latest = readInbox()[0] || null;
      const inject = '<div class="card"><h2 style="margin:0 0 10px;">Routex no-dead-button proof sync</h2>' + (latest ? ('<div><span class="badge">'+esc(latest.fingerprint || '—')+'</span><span class="badge">Sweep '+esc(String(latest.sweepPassed || 0))+'/'+esc(String(latest.sweepTotal || 0))+'</span><span class="badge">Walkthrough '+esc(String(latest.walkthroughDone || 0))+'/'+esc(String(latest.walkthroughTotal || 0))+'</span></div><div style="margin-top:8px;">'+esc(latest.label || 'Imported Routex no-dead proof')+'</div><div style="margin-top:8px;">'+esc(latest.note || '')+'</div>') : 'No synced Routex no-dead proof yet.') + '</div>';
      return htmlDoc.replace('</div></body></html>', inject + '</div></body></html>');
    };
  }
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); try{ syncNoDeadOutbox(); }catch(_){ } setTimeout(injectNoDeadControls, 0); return out; };
  window.syncRoutexNoDeadOutboxToAE = syncNoDeadOutbox;
})();

/* V27 AE FLOW actual shipped legacy visibility */
(function(){
  if(window.__AEFLOW_V27__) return; window.__AEFLOW_V27__ = true;
  const LEGACY_INBOX_KEY = 'skye_aeflow_imported_routex_legacy_v1';
  const html = window.escapeHtml || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  function readLegacyInbox(){ try{ const raw = JSON.parse(localStorage.getItem(LEGACY_INBOX_KEY)||'[]'); return Array.isArray(raw) ? raw : []; }catch(_){ return []; } }
  function summarizeActualShipped(){
    const rows = readLegacyInbox();
    const packageRows = rows.filter(item => clean(item.source) === 'actual-shipped-package-manifest' || /Actual shipped package/i.test(clean(item.label)));
    const compareRows = rows.filter(item => /Actual shipped legacy compare/i.test(clean(item.label)));
    return { packageRows, compareRows, latestCompare: compareRows[0] || null };
  }
  const prevWorkbench = window.buildAERoutexWorkbenchHtml;
  if(typeof prevWorkbench === 'function'){
    window.buildAERoutexWorkbenchHtml = function(){
      const htmlDoc = prevWorkbench.apply(this, arguments);
      const summary = summarizeActualShipped();
      const latest = summary.latestCompare;
      const inject = '<div class="card"><h2 style="margin:0 0 10px;">Routex actual shipped legacy corpus</h2>' +
        '<div><span class="badge">Packages ' + html(String(summary.packageRows.length)) + '</span><span class="badge">Compare runs ' + html(String(summary.compareRows.length)) + '</span></div>' +
        '<div style="margin-top:10px;">' + (latest ? ('<span class="badge">' + html(latest.fingerprint || '—') + '</span><span class="badge">' + html(latest.label || 'Actual shipped legacy compare') + '</span><div style="margin-top:8px;">' + html(latest.note || '') + '</div>') : 'No imported actual shipped legacy compare yet.') + '</div></div>';
      return htmlDoc.replace('</div></body></html>', inject + '</div></body></html>');
    };
  }
})();

/* V28 AE FLOW export/import compare sync */
(function(){
  if(window.__AEFLOW_V28__) return; window.__AEFLOW_V28__ = true;
  const OUTBOX_KEY = 'skye_routex_export_import_compare_outbox_v1';
  const INBOX_KEY = 'skye_aeflow_imported_routex_export_import_compare_v1';
  const LOG_KEY = 'skye_aeflow_routex_export_import_compare_sync_log_v1';
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHtml || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], {type: type || 'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name||'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const dayISO = ()=> new Date().toISOString().slice(0,10);
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function readOutbox(){ return readJSON(OUTBOX_KEY, []).filter(Boolean).slice(0,40); }
  function readInbox(){ return readJSON(INBOX_KEY, []).filter(Boolean).slice(0,40); }
  function saveInbox(items){ return writeJSON(INBOX_KEY, (Array.isArray(items) ? items : []).slice(0,40)); }
  function readLog(){ return readJSON(LOG_KEY, []).filter(Boolean).slice(0,40); }
  function saveLog(items){ return writeJSON(LOG_KEY, (Array.isArray(items) ? items : []).slice(0,40)); }
  function pushLog(row){ const item = { id:'xipcmp-' + Math.random().toString(36).slice(2), at:new Date().toISOString(), ...(row || {}) }; const list = readLog().filter(entry => clean(entry.id) !== clean(item.id)); list.unshift(item); saveLog(list); return item; }
  function syncOutbox(){
    const inbox = readInbox();
    const outbox = readOutbox();
    let merged = 0, duplicate = 0;
    outbox.forEach(item => {
      const fp = clean(item && item.fingerprint);
      if(!fp) return;
      if(inbox.some(row => clean(row && row.fingerprint) === fp)){ duplicate += 1; return; }
      inbox.unshift({ ...(item || {}), imported_at: new Date().toISOString(), source: clean(item && item.source) || 'routex-export-import-compare-outbox' });
      merged += 1;
    });
    saveInbox(inbox);
    return pushLog({ merged, duplicate, total: outbox.length, note:'Export/import compare sync merged ' + merged + ' compare package(s).' });
  }
  function buildCompareInboxHtml(){
    const rows = readInbox().map(item => '<tr><td>'+esc(item.label || 'Routex export/import compare')+'</td><td>'+esc(item.fingerprint || '—')+'</td><td>'+esc(String(item.packageCount || 0))+'</td><td>'+(item.ok ? 'PASS' : 'REVIEW')+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AE FLOW Routex export/import compare inbox</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">AE FLOW • Routex export/import compare inbox</h1><div><span class="badge">Imported compares '+esc(String(readInbox().length))+'</span><span class="badge">Sync rows '+esc(String(readLog().length))+'</span></div></div><div class="card"><table><thead><tr><th>Label</th><th>Fingerprint</th><th>Packages</th><th>OK</th><th>Note</th></tr></thead><tbody>'+(rows || '<tr><td colspan="5">No Routex export/import compare packages imported yet.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function injectCompareControls(){
    const bar = document.querySelector('#routexLensToolbar') || document.querySelector('.toolbar .row') || document.querySelector('.toolbar');
    if(bar && !document.getElementById('aeRoutexTransferCompareSyncBtn')){
      const syncBtn = document.createElement('button'); syncBtn.className='btn small'; syncBtn.id='aeRoutexTransferCompareSyncBtn'; syncBtn.textContent='Sync Transfer Compare'; syncBtn.onclick = ()=>{ const row = syncOutbox(); toast(row.merged ? 'Routex transfer compare synced.' : 'No new Routex transfer compare packages.', row.merged ? 'good' : 'warn'); if(typeof window.renderAll === 'function') window.renderAll(); }; bar.appendChild(syncBtn);
      const inboxBtn = document.createElement('button'); inboxBtn.className='btn small'; inboxBtn.id='aeRoutexTransferCompareInboxBtn'; inboxBtn.textContent='Transfer Compare Inbox'; inboxBtn.onclick = ()=>{ downloadText(buildCompareInboxHtml(), 'ae_flow_routex_export_import_compare_inbox_' + dayISO() + '.html', 'text/html'); toast('Routex export/import compare inbox exported.', 'good'); }; bar.appendChild(inboxBtn);
    }
  }
  const prevTransferSync = window.runTransferSync;
  if(typeof prevTransferSync === 'function'){
    window.runTransferSync = function(){
      const row = prevTransferSync.apply(this, arguments) || {};
      const compare = syncOutbox();
      return { ...row, compare, mergedTotal: Number(row.mergedTotal || 0) + Number(compare.merged || 0), note: [clean(row.note), clean(compare.note)].filter(Boolean).join(' • ') };
    };
  }
  const prevWorkbench = window.buildAERoutexWorkbenchHtml;
  if(typeof prevWorkbench === 'function'){
    window.buildAERoutexWorkbenchHtml = function(){
      const htmlDoc = prevWorkbench.apply(this, arguments);
      const latest = readInbox()[0] || null;
      const inject = '<div class="card"><h2 style="margin:0 0 10px;">Routex shipped export/import compare</h2>' + (latest ? ('<div><span class="badge">'+esc(latest.fingerprint || '—')+'</span><span class="badge">Packages '+esc(String(latest.packageCount || 0))+'</span><span class="badge">'+(latest.ok ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(latest.note || '')+'</div>') : 'No imported Routex export/import compare yet.') + '</div>';
      return htmlDoc.replace('</div></body></html>', inject + '</div></body></html>');
    };
  }
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(injectCompareControls, 0); return out; };
  window.syncRoutexExportImportCompareOutboxToAE = syncOutbox;
})();

/* V29 AE FLOW no-dead compare sync */
(function(){
  if(window.__AEFLOW_V29__) return; window.__AEFLOW_V29__ = true;
  const OUTBOX_KEY = 'skye_routex_no_dead_compare_outbox_v1';
  const INBOX_KEY = 'skye_aeflow_imported_routex_no_dead_compare_v1';
  const LOG_KEY = 'skye_aeflow_routex_no_dead_compare_sync_log_v1';
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHtml || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], {type: type || 'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name||'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const dayISO = ()=> new Date().toISOString().slice(0,10);
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function readOutbox(){ return readJSON(OUTBOX_KEY, []).filter(Boolean).slice(0,40); }
  function readInbox(){ return readJSON(INBOX_KEY, []).filter(Boolean).slice(0,40); }
  function saveInbox(items){ return writeJSON(INBOX_KEY, (Array.isArray(items) ? items : []).slice(0,40)); }
  function readLog(){ return readJSON(LOG_KEY, []).filter(Boolean).slice(0,40); }
  function saveLog(items){ return writeJSON(LOG_KEY, (Array.isArray(items) ? items : []).slice(0,40)); }
  function pushLog(row){ const item = { id:'ndbcmp-' + Math.random().toString(36).slice(2), at:new Date().toISOString(), ...(row || {}) }; const list = readLog().filter(entry => clean(entry.id) !== clean(item.id)); list.unshift(item); saveLog(list); return item; }
  function syncOutbox(){
    const inbox = readInbox();
    const outbox = readOutbox();
    let merged = 0, duplicate = 0;
    outbox.forEach(item => {
      const fp = clean(item && item.fingerprint);
      if(!fp) return;
      if(inbox.some(row => clean(row && row.fingerprint) === fp)){ duplicate += 1; return; }
      inbox.unshift({ ...(item || {}), imported_at: new Date().toISOString(), source: clean(item && item.source) || 'routex-no-dead-compare-outbox' });
      merged += 1;
    });
    saveInbox(inbox);
    return pushLog({ merged, duplicate, total: outbox.length, note:'No-dead compare sync merged ' + merged + ' compare package(s).' });
  }
  function buildCompareInboxHtml(){
    const rows = readInbox().map(item => '<tr><td>'+esc(item.label || 'Routex no-dead compare')+'</td><td>'+esc(item.fingerprint || '—')+'</td><td>'+esc(String(item.packageCount || 0))+'</td><td>'+esc(String(item.walkthroughDone || 0))+'/'+esc(String(item.walkthroughTotal || 0))+'</td><td>'+esc(item.walkthroughReviewer || '—')+'</td><td>'+(item.ok ? 'PASS' : 'REVIEW')+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AE FLOW Routex no-dead compare inbox</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1120px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">AE FLOW • Routex no-dead compare inbox</h1><div><span class="badge">Imported compares '+esc(String(readInbox().length))+'</span><span class="badge">Sync rows '+esc(String(readLog().length))+'</span></div></div><div class="card"><table><thead><tr><th>Label</th><th>Fingerprint</th><th>Packages</th><th>Walkthrough</th><th>Reviewer</th><th>OK</th><th>Note</th></tr></thead><tbody>'+(rows || '<tr><td colspan="7">No Routex no-dead compare packages imported yet.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function injectCompareControls(){
    const bar = document.querySelector('#routexLensToolbar') || document.querySelector('.toolbar .row') || document.querySelector('.toolbar');
    if(bar && !document.getElementById('aeRoutexNoDeadCompareSyncBtn')){
      const syncBtn = document.createElement('button'); syncBtn.className='btn small'; syncBtn.id='aeRoutexNoDeadCompareSyncBtn'; syncBtn.textContent='Sync No-Dead Compare'; syncBtn.onclick = ()=>{ const row = syncOutbox(); toast(row.merged ? 'Routex no-dead compare synced.' : 'No new Routex no-dead compare packages.', row.merged ? 'good' : 'warn'); if(typeof window.renderAll === 'function') window.renderAll(); }; bar.appendChild(syncBtn);
      const inboxBtn = document.createElement('button'); inboxBtn.className='btn small'; inboxBtn.id='aeRoutexNoDeadCompareInboxBtn'; inboxBtn.textContent='No-Dead Compare Inbox'; inboxBtn.onclick = ()=>{ downloadText(buildCompareInboxHtml(), 'ae_flow_routex_no_dead_compare_inbox_' + dayISO() + '.html', 'text/html'); toast('Routex no-dead compare inbox exported.', 'good'); }; bar.appendChild(inboxBtn);
    }
  }
  const prevWorkbench = window.buildAERoutexWorkbenchHtml;
  if(typeof prevWorkbench === 'function'){
    window.buildAERoutexWorkbenchHtml = function(){
      const htmlDoc = prevWorkbench.apply(this, arguments);
      const latest = readInbox()[0] || null;
      const inject = '<div class="card"><h2 style="margin:0 0 10px;">Routex shipped no-dead compare</h2>' + (latest ? ('<div><span class="badge">'+esc(latest.fingerprint || '—')+'</span><span class="badge">Packages '+esc(String(latest.packageCount || 0))+'</span><span class="badge">Walkthrough '+esc(String(latest.walkthroughDone || 0))+'/'+esc(String(latest.walkthroughTotal || 0))+'</span><span class="badge">'+(latest.ok ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(latest.note || '')+'</div>') : 'No imported Routex no-dead compare yet.') + '</div>';
      return htmlDoc.replace('</div></body></html>', inject + '</div></body></html>');
    };
  }
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(injectCompareControls, 0); return out; };
  window.syncRoutexNoDeadCompareOutboxToAE = syncOutbox;
})();

/* V30 AE FLOW no-dead walkthrough receipt sync */
(function(){
  if(window.__AEFLOW_V30__) return; window.__AEFLOW_V30__ = true;
  const OUTBOX_KEY = 'skye_routex_no_dead_walkthrough_receipt_outbox_v1';
  const INBOX_KEY = 'skye_aeflow_imported_routex_no_dead_walkthrough_receipts_v1';
  const LOG_KEY = 'skye_aeflow_routex_no_dead_walkthrough_receipt_sync_log_v1';
  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHtml || function(v){ return String(v==null?'':v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); };
  const toast = window.toast || function(){};
  const downloadText = window.downloadText || function(text, name, type){ const blob = new Blob([text], {type: type || 'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name||'download.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0); };
  const dayISO = ()=> new Date().toISOString().slice(0,10);
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function readOutbox(){ return readJSON(OUTBOX_KEY, []).filter(Boolean).slice(0,40); }
  function readInbox(){ return readJSON(INBOX_KEY, []).filter(Boolean).slice(0,40); }
  function saveInbox(items){ return writeJSON(INBOX_KEY, (Array.isArray(items) ? items : []).slice(0,40)); }
  function readLog(){ return readJSON(LOG_KEY, []).filter(Boolean).slice(0,40); }
  function saveLog(items){ return writeJSON(LOG_KEY, (Array.isArray(items) ? items : []).slice(0,40)); }
  function pushLog(row){ const item = { id:'ndbrx-' + Math.random().toString(36).slice(2), at:new Date().toISOString(), ...(row || {}) }; const list = readLog().filter(entry => clean(entry.id) !== clean(item.id)); list.unshift(item); saveLog(list); return item; }
  function syncOutbox(){
    const inbox = readInbox();
    const outbox = readOutbox();
    let merged = 0, duplicate = 0;
    outbox.forEach(item => {
      const fp = clean(item && item.fingerprint);
      if(!fp) return;
      if(inbox.some(row => clean(row && row.fingerprint) === fp)){ duplicate += 1; return; }
      inbox.unshift({ ...(item || {}), imported_at: new Date().toISOString(), source: clean(item && item.source) || 'routex-no-dead-walkthrough-receipt-outbox' });
      merged += 1;
    });
    saveInbox(inbox);
    return pushLog({ merged, duplicate, total: outbox.length, note:'No-dead walkthrough receipt sync merged ' + merged + ' receipt package(s).' });
  }
  function buildInboxHtml(){
    const rows = readInbox().map(item => '<tr><td>'+esc(item.label || 'Routex walkthrough receipt')+'</td><td>'+esc(item.fingerprint || '—')+'</td><td>'+esc(item.walkthroughReviewer || '—')+'</td><td>'+esc(String(item.walkthroughDone || 0))+'/'+esc(String(item.walkthroughTotal || 0))+'</td><td>'+(item.compareOk ? 'OK' : 'REVIEW')+'</td><td>'+(item.ok ? 'PASS' : 'REVIEW')+'</td><td>'+esc(item.note || '')+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AE FLOW Routex walkthrough receipt inbox</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1120px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">AE FLOW • Routex walkthrough receipt inbox</h1><div><span class="badge">Imported receipts '+esc(String(readInbox().length))+'</span><span class="badge">Sync rows '+esc(String(readLog().length))+'</span></div></div><div class="card"><table><thead><tr><th>Label</th><th>Fingerprint</th><th>Reviewer</th><th>Walkthrough</th><th>Compare</th><th>OK</th><th>Note</th></tr></thead><tbody>'+(rows || '<tr><td colspan="7">No Routex walkthrough receipts imported yet.</td></tr>')+'</tbody></table></div></div></body></html>';
  }
  function injectReceiptControls(){
    const bar = document.querySelector('#routexLensToolbar') || document.querySelector('.toolbar .row') || document.querySelector('.toolbar');
    if(bar && !document.getElementById('aeRoutexWalkthroughReceiptSyncBtn')){
      const syncBtn = document.createElement('button'); syncBtn.className='btn small'; syncBtn.id='aeRoutexWalkthroughReceiptSyncBtn'; syncBtn.textContent='Sync Walkthrough Receipt'; syncBtn.onclick = ()=>{ const row = syncOutbox(); toast(row.merged ? 'Routex walkthrough receipt synced.' : 'No new Routex walkthrough receipt packages.', row.merged ? 'good' : 'warn'); if(typeof window.renderAll === 'function') window.renderAll(); }; bar.appendChild(syncBtn);
      const inboxBtn = document.createElement('button'); inboxBtn.className='btn small'; inboxBtn.id='aeRoutexWalkthroughReceiptInboxBtn'; inboxBtn.textContent='Walkthrough Receipt Inbox'; inboxBtn.onclick = ()=>{ downloadText(buildInboxHtml(), 'ae_flow_routex_walkthrough_receipt_inbox_' + dayISO() + '.html', 'text/html'); toast('Routex walkthrough receipt inbox exported.', 'good'); }; bar.appendChild(inboxBtn);
    }
  }
  const prevWorkbench = window.buildAERoutexWorkbenchHtml;
  if(typeof prevWorkbench === 'function'){
    window.buildAERoutexWorkbenchHtml = function(){
      const htmlDoc = prevWorkbench.apply(this, arguments);
      const latest = readInbox()[0] || null;
      const inject = '<div class="card"><h2 style="margin:0 0 10px;">Routex walkthrough receipt</h2>' + (latest ? ('<div><span class="badge">'+esc(latest.fingerprint || '—')+'</span><span class="badge">Reviewer '+esc(latest.walkthroughReviewer || '—')+'</span><span class="badge">Walkthrough '+esc(String(latest.walkthroughDone || 0))+'/'+esc(String(latest.walkthroughTotal || 0))+'</span><span class="badge">'+(latest.ok ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(latest.note || '')+'</div>') : 'No imported Routex walkthrough receipt yet.') + '</div>';
      return htmlDoc.replace('</div></body></html>', inject + '</div></body></html>');
    };
  }
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(injectReceiptControls, 0); return out; };
  window.syncRoutexNoDeadWalkthroughReceiptOutboxToAE = syncOutbox;
})();

/* V33 AE FLOW Routex operator handoff packet sync */
(function(){
  if(window.__AEFLOW_V33__) return; window.__AEFLOW_V33__ = true;
  const OUTBOX_KEY = 'skye_routex_operator_handoff_packet_outbox_v1';
  const INBOX_KEY = 'skye_aeflow_imported_routex_operator_handoff_packets_v1';
  const LOG_KEY = 'skye_aeflow_routex_operator_handoff_packet_sync_log_v1';
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
  function pushLog(row){ const list = readLog().filter(item => clean(item && item.id) !== clean(row && row.id)); list.unshift({ id:'aeflow-v33-' + Date.now().toString(36), at:new Date().toISOString(), ...(row || {}) }); writeJSON(LOG_KEY, list.slice(0,60)); return list[0]; }
  function syncOutbox(){ const outbox = readOutbox(); const inbox = readInbox(); let merged = 0, duplicate = 0; outbox.forEach(item => { if(inbox.some(existing => clean(existing && existing.fingerprint) === clean(item && item.fingerprint))){ duplicate++; return; } merged++; inbox.unshift({ ...(item || {}), imported_at:new Date().toISOString(), source: clean(item && item.source) || 'routex-operator-handoff-packet-outbox' }); }); saveInbox(inbox); return pushLog({ merged, duplicate, total: outbox.length, note:'Routex operator handoff packet sync merged ' + merged + ' handoff packet(s).' }); }
  function buildInboxHtml(){ const rows = readInbox().map(item => { const snap = item.snapshot || {}; return '<tr><td>'+esc(item.label || 'Routex operator handoff packet')+'</td><td>'+esc(item.fingerprint || '—')+'</td><td>'+esc(String(item.readiness || 0))+'/'+esc(String(item.readinessMax || 0))+'</td><td>'+esc((snap.latestBrief && snap.latestBrief.fingerprint) || '—')+'</td><td>'+esc((snap.latestBinder && snap.latestBinder.fingerprint) || '—')+'</td><td>'+esc((snap.latestReceipt && snap.latestReceipt.fingerprint) || '—')+'</td><td>'+(item.ok ? 'PASS' : 'REVIEW')+'</td></tr>'; }).join(''); return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AE FLOW Routex operator handoff packet inbox</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1120px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">AE FLOW • Routex operator handoff packet inbox</h1><div><span class="badge">Imported handoff packets '+esc(String(readInbox().length))+'</span><span class="badge">Sync rows '+esc(String(readLog().length))+'</span></div></div><div class="card"><table><thead><tr><th>Label</th><th>Fingerprint</th><th>Readiness</th><th>Ops brief</th><th>Binder</th><th>Receipt</th><th>OK</th></tr></thead><tbody>'+(rows || '<tr><td colspan="7">No Routex operator handoff packets imported yet.</td></tr>')+'</tbody></table></div></div></body></html>'; }
  function inject(){
    const bar = document.querySelector('#routexWorkbenchToolbar') || document.querySelector('.toolbar') || document.querySelector('.row');
    if(bar && !document.getElementById('aeRoutexHandoffPacketSyncBtn')){
      const syncBtn = document.createElement('button'); syncBtn.className='btn small'; syncBtn.id='aeRoutexHandoffPacketSyncBtn'; syncBtn.textContent='Sync Handoff Packet'; syncBtn.onclick = ()=>{ const row = syncOutbox(); toast(row.merged ? 'Routex handoff packet synced.' : 'No new Routex handoff packets.', row.merged ? 'good' : 'warn'); if(typeof window.renderAll === 'function') window.renderAll(); };
      const inboxBtn = document.createElement('button'); inboxBtn.className='btn small'; inboxBtn.id='aeRoutexHandoffPacketInboxBtn'; inboxBtn.textContent='Handoff Packet Inbox'; inboxBtn.onclick = ()=>{ downloadText(buildInboxHtml(), 'ae_flow_routex_operator_handoff_packet_inbox_' + dayISO() + '.html', 'text/html'); toast('Routex handoff packet inbox exported.', 'good'); };
      bar.appendChild(syncBtn); bar.appendChild(inboxBtn);
    }
    const latest = readInbox()[0] || null;
    const host = document.querySelector('#routexWorkbenchHost') || document.querySelector('#app') || document.body;
    const existing = document.getElementById('aeRoutexHandoffPacketCard');
    if(existing) existing.remove();
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'aeRoutexHandoffPacketCard';
    const s = latest ? latest.snapshot || {} : {};
    card.innerHTML = '<h2 style="margin:0 0 10px;">Routex operator handoff packet</h2>' + (latest ? ('<div><span class="badge">'+esc(latest.fingerprint || '—')+'</span><span class="badge">Readiness '+esc(String(latest.readiness || 0))+'/'+esc(String(latest.readinessMax || 0))+'</span><span class="badge">'+(latest.ok ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">Ops brief '+esc((s.latestBrief && s.latestBrief.fingerprint) || '—')+' • Binder '+esc((s.latestBinder && s.latestBinder.fingerprint) || '—')+' • Receipt '+esc((s.latestReceipt && s.latestReceipt.fingerprint) || '—')+'</div><div style="margin-top:8px;">'+esc(latest.note || '')+'</div>') : 'No imported Routex operator handoff packet yet.');
    host.appendChild(card);
  }
  const prevWorkbench = window.buildAERoutexWorkbenchHtml;
  if(typeof prevWorkbench === 'function'){
    window.buildAERoutexWorkbenchHtml = function(){
      const htmlDoc = prevWorkbench.apply(this, arguments);
      const latest = readInbox()[0] || null;
      const injectCard = '<div class="card"><h2 style="margin:0 0 10px;">Routex operator handoff packet</h2>' + (latest ? ('<div><span class="badge">'+esc(latest.fingerprint || '—')+'</span><span class="badge">Readiness '+esc(String(latest.readiness || 0))+'/'+esc(String(latest.readinessMax || 0))+'</span><span class="badge">'+(latest.ok ? 'PASS' : 'REVIEW')+'</span></div><div style="margin-top:8px;">'+esc(latest.note || '')+'</div>') : 'No imported Routex operator handoff packet yet.') + '</div>';
      return htmlDoc.replace('</div></body></html>', injectCard + '</div></body></html>');
    };
  }
  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };
  window.readAEFlowRoutexOperatorHandoffPackets = readInbox;
  window.syncRoutexOperatorHandoffPacketOutboxToAE = syncOutbox;
})();


/* V34 AE FLOW Routex operator launch board sync */
(function(){
  if(window.__AEFLOW_V34__) return; window.__AEFLOW_V34__ = true;
  const OUTBOX_KEY = 'skye_routex_operator_launch_board_outbox_v1';
  const INBOX_KEY = 'skye_aeflow_imported_routex_operator_launch_boards_v1';
  const LOG_KEY = 'skye_aeflow_routex_operator_launch_board_sync_log_v1';
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
  function pushLog(row){ const list = readLog().filter(item => clean(item && item.id) !== clean(row && row.id)); list.unshift({ id:'aeflow-v34-' + Date.now().toString(36), at:new Date().toISOString(), ...(row || {}) }); writeJSON(LOG_KEY, list.slice(0,60)); return list[0]; }
  function syncOutbox(){ const outbox = readOutbox(); const inbox = readInbox(); let merged = 0, duplicate = 0; outbox.forEach(item => { if(inbox.some(existing => clean(existing && existing.fingerprint) === clean(item && item.fingerprint))){ duplicate++; return; } merged++; inbox.unshift({ ...(item || {}), imported_at:new Date().toISOString(), source: clean(item && item.source) || 'routex-operator-launch-board-outbox' }); }); saveInbox(inbox); return pushLog({ merged, duplicate, total: outbox.length, note:'Routex operator launch board sync merged ' + merged + ' board(s).' }); }
  function buildInboxHtml(){ const rows = readInbox().map(item => '<tr><td>'+esc(item.label || 'Routex operator launch board')+'</td><td>'+esc(item.fingerprint || '—')+'</td><td>'+esc(String(item.score || 0))+'%</td><td>'+esc(String(item.passing || 0))+'/'+esc(String(item.total || 0))+'</td><td>'+esc(String((item.blockers || []).length))+'</td><td>'+esc((((item.actions || [])[0] || {}).label) || '—')+'</td><td>'+(item.ok ? 'GREEN' : 'ACTION REQUIRED')+'</td></tr>').join(''); return '<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>AE FLOW Routex operator launch board inbox</title><style>body{font-family:ui-sans-serif,system-ui;background:#05000a;color:#fff;padding:24px}.wrap{max-width:1120px;margin:0 auto}.card{border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.04);padding:18px;margin:0 0 18px}.badge{display:inline-block;padding:4px 8px;border:1px solid rgba(255,255,255,.16);border-radius:999px;margin-right:6px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid rgba(255,255,255,.1);text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px;">AE FLOW • Routex operator launch board inbox</h1><div><span class="badge">Imported boards '+esc(String(readInbox().length))+'</span><span class="badge">Sync rows '+esc(String(readLog().length))+'</span></div></div><div class="card"><table><thead><tr><th>Label</th><th>Fingerprint</th><th>Score</th><th>Checks</th><th>Blockers</th><th>Top action</th><th>Status</th></tr></thead><tbody>'+(rows || '<tr><td colspan="7">No Routex operator launch boards imported yet.</td></tr>')+'</tbody></table></div></div></body></html>'; }
  function inject(){
    const bar = document.querySelector('#routexWorkbenchToolbar') || document.querySelector('.toolbar') || document.querySelector('.row');
    if(bar && !document.getElementById('aeRoutexLaunchBoardSyncBtn')){
      const syncBtn = document.createElement('button'); syncBtn.className='btn small'; syncBtn.id='aeRoutexLaunchBoardSyncBtn'; syncBtn.textContent='Sync Launch Board'; syncBtn.onclick = ()=>{ const row = syncOutbox(); toast(row.merged ? 'Routex launch board synced.' : 'No new Routex launch boards.', row.merged ? 'good' : 'warn'); if(typeof window.renderAll === 'function') window.renderAll(); };
      const inboxBtn = document.createElement('button'); inboxBtn.className='btn small'; inboxBtn.id='aeRoutexLaunchBoardInboxBtn'; inboxBtn.textContent='Launch Board Inbox'; inboxBtn.onclick = ()=>{ downloadText(buildInboxHtml(), 'ae_flow_routex_operator_launch_board_inbox_' + dayISO() + '.html', 'text/html'); toast('Routex launch board inbox exported.', 'good'); };
      bar.appendChild(syncBtn); bar.appendChild(inboxBtn);
    }
    const latest = readInbox()[0] || null;
    const host = document.querySelector('#routexWorkbenchHost') || document.querySelector('#app') || document.body;
    const existing = document.getElementById('aeRoutexLaunchBoardCard');
    if(existing) existing.remove();
    const card = document.createElement('div');
    card.className = 'card';
    card.id = 'aeRoutexLaunchBoardCard';
    card.innerHTML = '<h2 style="margin:0 0 10px;">Routex operator launch board</h2>' + (latest ? ('<div><span class="badge">'+esc(latest.fingerprint || '—')+'</span><span class="badge">Score '+esc(String(latest.score || 0))+'%</span><span class="badge">Checks '+esc(String(latest.passing || 0))+'/'+esc(String(latest.total || 0))+'</span><span class="badge">'+(latest.ok ? 'GREEN' : 'ACTION REQUIRED')+'</span></div><div style="margin-top:8px;">Blockers '+esc(String((latest.blockers || []).length))+' • Top action '+esc((((latest.actions || [])[0] || {}).label) || '—')+'</div><div style="margin-top:8px;">'+esc(latest.note || '')+'</div>') : 'No imported Routex operator launch board yet.');
    host.appendChild(card);
  }
  const prevWorkbench = window.buildAERoutexWorkbenchHtml;
  if(typeof prevWorkbench === 'function'){
    window.buildAERoutexWorkbenchHtml = function(){
      const htmlDoc = prevWorkbench.apply(this, arguments);
      const latest = readInbox()[0] || null;
      const injectCard = '<div class="card"><h2 style="margin:0 0 10px;">Routex operator launch board</h2>' + (latest ? ('<div><span class="badge">'+esc(latest.fingerprint || '—')+'</span><span class="badge">Score '+esc(String(latest.score || 0))+'%</span><span class="badge">'+(latest.ok ? 'GREEN' : 'ACTION REQUIRED')+'</span></div><div style="margin-top:8px;">'+esc((((latest.actions || [])[0] || {}).label) || 'No top action')+'</div>') : 'No imported Routex operator launch board yet.') + '</div>';
      return htmlDoc.replace('</div></body></html>', injectCard + '</div></body></html>');
    };
  }
  const observer = new MutationObserver(()=> inject());
  observer.observe(document.body, { childList:true, subtree:true });
  const prevRender = window.renderAll;
  if(typeof prevRender === 'function') window.renderAll = function(){ const out = prevRender.apply(this, arguments); setTimeout(inject, 0); return out; };
  window.readAEFlowRoutexOperatorLaunchBoards = readInbox;
  window.syncRoutexOperatorLaunchBoardOutboxToAE = syncOutbox;
})();

/* V35 AE FLOW interactive walkthrough system */
(function(){
  if(window.__AEFLOW_V35_TOURS__) return;
  window.__AEFLOW_V35_TOURS__ = true;

  const PROGRESS_KEY = 'skye_aeflow_tutorial_progress_v1';
  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const toast = window.toast || function(){};
  const wait = (ms)=> new Promise(resolve => setTimeout(resolve, ms));

  let overlay = null;
  let activeTour = null;
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
  function markProgress(id, patch){
    const next = readProgress();
    next[id] = Object.assign({}, next[id] || {}, patch || {}, { updatedAt: new Date().toISOString() });
    saveProgress(next);
    return next[id];
  }
  function completedCount(){
    const p = readProgress();
    return getTours().filter(t => p[t.id] && p[t.id].completedAt).length;
  }

  function ensureStyle(){
    if(document.getElementById('aeFlowTourStyles')) return;
    const style = document.createElement('style');
    style.id = 'aeFlowTourStyles';
    style.textContent = `
      .ae-tour-target{
        position: relative !important;
        z-index: 10002 !important;
        box-shadow: 0 0 0 3px rgba(245,197,66,.92), 0 0 0 9999px rgba(5,0,10,.56) !important;
        border-radius: 16px !important;
      }
      .ae-tour-overlay{
        position: fixed;
        inset: 0;
        z-index: 10001;
        pointer-events: none;
      }
      .ae-tour-dock{
        position: fixed;
        right: 16px;
        bottom: 96px;
        width: min(400px, calc(100vw - 24px));
        border:1px solid rgba(255,255,255,.14);
        border-radius: 20px;
        background: linear-gradient(180deg, rgba(25,8,45,.96), rgba(10,4,20,.94));
        box-shadow: 0 26px 80px rgba(0,0,0,.48);
        padding: 16px;
        color: rgba(255,255,255,.94);
        pointer-events: auto;
      }
      .ae-tour-title{ margin:0 0 8px; font-size:18px; font-weight:900; }
      .ae-tour-body{ font-size:13px; line-height:1.5; color:rgba(255,255,255,.8); white-space:pre-wrap; }
      .ae-tour-progress{ height:7px; border-radius:999px; background:rgba(255,255,255,.1); overflow:hidden; margin:14px 0 12px; }
      .ae-tour-progress > i{ display:block; height:100%; width:0; background:linear-gradient(90deg, rgba(245,197,66,.95), rgba(124,58,237,.92)); }
      .ae-tour-grid{ display:grid; grid-template-columns: repeat(auto-fit, minmax(210px,1fr)); gap:10px; margin-top:12px; }
      .ae-tour-tile{ border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.04); border-radius:16px; padding:12px; }
      .ae-tour-tile h4{ margin:0 0 6px; font-size:14px; }
      .ae-tour-tile p{ margin:0 0 10px; font-size:12px; line-height:1.45; color:rgba(255,255,255,.72); }
      .ae-tour-mini{ font-size:11px; color:rgba(255,255,255,.62); }
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay(){
    ensureStyle();
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'ae-tour-overlay hidden';
    overlay.id = 'aeFlowTourOverlay';
    overlay.innerHTML = `
      <div class="ae-tour-dock">
        <div class="pill" id="aeFlowTourMeta">Step 1 / 1</div>
        <h3 class="ae-tour-title" id="aeFlowTourTitle">AE FLOW walkthrough</h3>
        <div class="ae-tour-body" id="aeFlowTourBody"></div>
        <div class="ae-tour-progress"><i id="aeFlowTourBar"></i></div>
        <div class="row" style="flex-wrap:wrap;">
          <button class="btn small" id="aeFlowTourBackBtn" type="button">Back</button>
          <button class="btn small" id="aeFlowTourNextBtn" type="button">Next</button>
          <div class="spacer"></div>
          <button class="btn small" id="aeFlowTourHubBtn" type="button">Tour center</button>
          <button class="btn small danger" id="aeFlowTourCloseBtn" type="button">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('aeFlowTourBackBtn').onclick = ()=> moveStep(-1);
    document.getElementById('aeFlowTourNextBtn').onclick = ()=> moveStep(1);
    document.getElementById('aeFlowTourCloseBtn').onclick = ()=> closeTour();
    document.getElementById('aeFlowTourHubBtn').onclick = ()=> openCenter();
    return overlay;
  }

  function getTours(){
    return [
      {
        id:'aeflow-core',
        title:'Core app tour',
        description:'Moves through intake, accounts, deals, and settings so a new user sees the actual operating surfaces instead of disconnected notes.',
        steps:[
          { tab:'intake', title:'Intake workspace', body:'This is the lead-capture and entry lane. It is where the AE records visits, contact details, action taken, and field notes.' },
          { tab:'accounts', title:'Owned accounts', body:'Accounts turns captured businesses into owned working records. This is where the operator filters, reviews, and prepares accounts for Routex handoff.' },
          { tab:'deals', title:'Deals and proposals', body:'Deals is the money lane. It is where the AE converts work into structured proposals, presets, and close tracking.' },
          { tab:'settings', title:'Settings and backup', body:'Settings controls deposit presets, export behavior, and brand defaults. The tutorial center is also built into this screen.' }
        ]
      },
      {
        id:'aeflow-routex-bridge',
        title:'Routex bridge',
        description:'Shows how AE FLOW becomes a feeder system for Routex instead of staying trapped as a disconnected CRM lane.',
        steps:[
          { tab:'accounts', title:'Accounts are route-ready', body:'The accounts tab is the bridge surface. This is where the operator prepares visible accounts for Routex and keeps ownership organized.' },
          { tab:'accounts', selector:'#aeRoutexQueueVisible', title:'Queue visible accounts', body:'When the Routex queue button is present, this is the fastest way to hand the currently visible accounts over to Routex.' },
          { tab:'accounts', selector:'#aeRoutexSeedVisible', title:'Build pack seeds', body:'Pack seeds turn visible account slices into portable handoff units. That makes the AE lane more operational and less passive.' },
          { tab:'settings', title:'Settings still matter', body:'Even the bridge depends on predictable settings and export behavior, so the operator is guided back into the control surface here.' }
        ]
      },
      {
        id:'aeflow-settings-backup',
        title:'Settings, backup, and trust',
        description:'Focused pass through settings so the user understands what is configurable, what exports, and how device-level behavior works.',
        steps:[
          { tab:'settings', selector:'#saveSettingsBtn', title:'Save settings', body:'This is where deposit presets, brand text, and configurable behavior are saved for the local build.' },
          { tab:'settings', selector:'#resetSettingsBtn', title:'Reset settings', body:'Reset exists for fast recovery and testing. The walkthrough touches it so the user knows where cleanup lives.' },
          { tab:'settings', title:'Product transparency', body:'The app explains itself in-product now. That means walkthroughs, visible controls, and fewer mystery lanes for new operators.' }
        ]
      }
    ];
  }

  function getTour(id){ return getTours().find(t => t.id === id) || null; }

  function clearTarget(){
    if(activeTarget){
      activeTarget.classList.remove('ae-tour-target');
      activeTarget = null;
    }
  }

  async function switchToTab(tab){
    if(typeof window.switchTab === 'function'){
      window.switchTab(tab);
      await wait(160);
    }
  }

  async function focusSelector(selector){
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
      activeTarget.classList.add('ae-tour-target');
      if(activeTarget.scrollIntoView){
        activeTarget.scrollIntoView({ behavior:'smooth', block:'center' });
      }
    }
  }

  async function applyStep(){
    if(!activeTour) return;
    const tour = getTour(activeTour.id);
    if(!tour) return;
    const step = tour.steps[activeTour.index];
    if(!step) return;
    if(step.tab) await switchToTab(step.tab);
    if(typeof step.before === 'function'){
      try{ await step.before(); }catch(_){}
    }
    await focusSelector(step.selector || '');
    ensureOverlay();
    overlay.classList.remove('hidden');
    document.getElementById('aeFlowTourMeta').textContent = 'Step ' + (activeTour.index + 1) + ' / ' + tour.steps.length;
    document.getElementById('aeFlowTourTitle').textContent = step.title || tour.title;
    document.getElementById('aeFlowTourBody').textContent = step.body || '';
    document.getElementById('aeFlowTourBar').style.width = (((activeTour.index + 1) / tour.steps.length) * 100).toFixed(1) + '%';
    document.getElementById('aeFlowTourBackBtn').disabled = activeTour.index === 0;
    document.getElementById('aeFlowTourNextBtn').textContent = activeTour.index === tour.steps.length - 1 ? 'Finish' : 'Next';
    markProgress(activeTour.id, { lastStep: activeTour.index + 1, inProgress: true });
    injectEntryPoints();
  }

  async function moveStep(delta){
    if(!activeTour) return;
    const tour = getTour(activeTour.id);
    const nextIndex = activeTour.index + delta;
    if(nextIndex < 0) return;
    if(nextIndex >= tour.steps.length){
      markProgress(activeTour.id, { completedAt: new Date().toISOString(), inProgress: false, lastStep: tour.steps.length });
      const queue = Array.isArray(activeTour.queue) ? activeTour.queue.slice() : [];
      closeTour(false);
      toast('Walkthrough completed ✅');
      if(queue.length){
        await wait(140);
        startTour(queue[0], queue.slice(1));
      }else{
        openCenter();
      }
      return;
    }
    activeTour.index = nextIndex;
    await applyStep();
  }

  function closeTour(reopen=true){
    clearTarget();
    if(overlay) overlay.classList.add('hidden');
    if(activeTour){
      markProgress(activeTour.id, { inProgress:false });
    }
    activeTour = null;
    if(reopen){
      setTimeout(()=> openCenter(), 60);
    }
    injectEntryPoints();
  }

  function startTour(id, queue){
    activeTour = { id, index:0, queue:Array.isArray(queue) ? queue : [] };
    applyStep();
  }

  function startAll(){
    const ids = getTours().map(t => t.id);
    if(!ids.length) return;
    startTour(ids[0], ids.slice(1));
  }

  function centerHtml(){
    const tours = getTours();
    const progress = readProgress();
    const done = tours.filter(t => progress[t.id] && progress[t.id].completedAt).length;
    return `
      <div class="muted">These walkthroughs are active product education. They switch tabs and land on the real surfaces a user needs to operate AE FLOW.</div>
      <div class="sep"></div>
      <div class="row" style="flex-wrap:wrap;">
        <div class="pill">${done}/${tours.length} walkthroughs completed</div>
        <button class="btn" id="aeFlowTourStartAll">Run all walkthroughs</button>
        <button class="btn" id="aeFlowTourReset">Reset progress</button>
      </div>
      <div class="ae-tour-grid">
        ${tours.map(t => {
          const row = progress[t.id] || {};
          const status = row.completedAt ? 'Completed' : row.lastStep ? ('Last step ' + row.lastStep + '/' + t.steps.length) : 'Not started';
          return `<div class="ae-tour-tile">
            <h4>${esc(t.title)}</h4>
            <p>${esc(t.description)}</p>
            <div class="ae-tour-mini">${status}</div>
            <div class="sep"></div>
            <button class="btn small" data-ae-tour="${esc(t.id)}">Start walkthrough</button>
          </div>`;
        }).join('')}
      </div>
    `;
  }

  function openCenter(){
    const old = document.getElementById('aeFlowTourCenterCard');
    if(old) old.remove();
    const wrap = document.createElement('div');
    wrap.className = 'card';
    wrap.id = 'aeFlowTourCenterCard';
    wrap.innerHTML = `<h2 style="margin:0 0 10px;">Interactive walkthrough center</h2>${centerHtml()}`;
    const host = document.getElementById('tab-settings') || document.querySelector('.wrap');
    if(host){
      host.prepend(wrap);
      bindCenter();
      switchToTab('settings');
      wrap.scrollIntoView({ behavior:'smooth', block:'start' });
    }
  }

  function bindCenter(){
    const allBtn = document.getElementById('aeFlowTourStartAll');
    if(allBtn) allBtn.onclick = ()=> startAll();
    const resetBtn = document.getElementById('aeFlowTourReset');
    if(resetBtn) resetBtn.onclick = ()=>{ saveProgress({}); toast('Walkthrough progress reset'); openCenter(); injectEntryPoints(); };
    document.querySelectorAll('[data-ae-tour]').forEach(btn => btn.onclick = ()=> startTour(btn.getAttribute('data-ae-tour')));
  }

  function injectTopbarButton(){
    const host = document.querySelector('.topbar .row');
    if(host && !document.getElementById('aeFlowToursBtn')){
      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.id = 'aeFlowToursBtn';
      btn.textContent = 'Tours';
      btn.onclick = openCenter;
      host.appendChild(btn);
    }
  }

  function injectSettingsCard(){
    const host = document.getElementById('tab-settings');
    if(host && !document.getElementById('aeFlowToursSettingsCard')){
      const done = completedCount();
      const total = getTours().length;
      const card = document.createElement('div');
      card.className = 'card';
      card.id = 'aeFlowToursSettingsCard';
      card.innerHTML = `
        <h2>Walkthrough and tutorial center</h2>
        <div class="muted">AE FLOW now teaches itself in-product. Starting a walkthrough switches tabs and shows the real surfaces the operator needs to use.</div>
        <div class="sep"></div>
        <div class="row" style="flex-wrap:wrap;">
          <div class="pill">${done}/${total} completed</div>
          <button class="btn" id="aeFlowToursOpenFromSettings">Open walkthrough center</button>
          <button class="btn" id="aeFlowToursRunAllFromSettings">Run all walkthroughs</button>
        </div>
      `;
      host.prepend(card);
      const openBtn = document.getElementById('aeFlowToursOpenFromSettings');
      if(openBtn) openBtn.onclick = openCenter;
      const allBtn = document.getElementById('aeFlowToursRunAllFromSettings');
      if(allBtn) allBtn.onclick = startAll;
    }
  }

  function injectEntryPoints(){
    injectTopbarButton();
    injectSettingsCard();
  }

  const prevRenderAll = window.renderAll;
  if(typeof prevRenderAll === 'function'){
    window.renderAll = function(){
      const out = prevRenderAll.apply(this, arguments);
      setTimeout(injectEntryPoints, 0);
      return out;
    };
  }

  const observer = new MutationObserver(()=> injectEntryPoints());
  observer.observe(document.documentElement || document.body, { childList:true, subtree:true });

  window.openAEFlowTutorialCenter = openCenter;
  window.startAEFlowInteractiveTour = startTour;

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=> setTimeout(injectEntryPoints, 140));
  }else{
    setTimeout(injectEntryPoints, 140);
  }
})();
