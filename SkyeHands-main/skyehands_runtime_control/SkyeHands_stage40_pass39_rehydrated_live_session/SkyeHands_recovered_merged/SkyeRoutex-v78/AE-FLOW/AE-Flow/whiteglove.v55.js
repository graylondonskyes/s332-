/* V55 AE FLOW white-glove duplicate review + spread inbox */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_V55__) return;
  window.__AEFLOW_WHITEGLOVE_V55__ = true;
  const ROUTEX_KEYS = { review:'skye_whiteglove_duplicate_review_rows_v55', spread:'skye_whiteglove_spread_rows_v55' };
  const KEYS = { reviewInbox:'ae_whiteglove_duplicate_review_inbox_v55', spreadInbox:'ae_whiteglove_spread_inbox_v55' };
  const readJSON = (k,f)=> { try{ const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; }catch(_){ return f; } };
  const writeJSON = (k,v)=> { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} return v; };
  const rows = (k)=> readJSON(KEYS[k], []);
  const latest = (k)=> rows(k)[0] || null;
  const pushRow = (k,row,limit)=> { const list = rows(k); list.unshift(row); writeJSON(KEYS[k], list.slice(0, limit || 240)); return row; };
  const iso = ()=> new Date().toISOString();
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36);
  const downloadText = window.downloadText || function(content, filename, type){ const blob = new Blob([content], { type: type || 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(url), 1200); };
  function syncReviewInbox(){ const row = readJSON(ROUTEX_KEYS.review, [])[0]; if(!row) return null; return pushRow('reviewInbox', { id: uid('ae_dup_in55'), createdAt: iso(), sourceReviewId: row.id, payload: row }, 240); }
  function syncSpreadInbox(){ const row = readJSON(ROUTEX_KEYS.spread, [])[0]; if(!row) return null; return pushRow('spreadInbox', { id: uid('ae_spread_in55'), createdAt: iso(), sourceSpreadId: row.id, payload: row }, 240); }
  function render(node, value){ node.textContent = value ? JSON.stringify(value, null, 2) : 'Nothing synced yet.'; }
  function ensureUI(){
    if(document.getElementById('ae-wg-v55-launcher')) return;
    const launcher = document.createElement('button'); launcher.id = 'ae-wg-v55-launcher'; launcher.textContent = 'WG V55 Inbox'; launcher.style.cssText = 'position:fixed;right:18px;bottom:72px;z-index:100011;border:1px solid rgba(255,255,255,.18);background:#3e255d;color:#fff;padding:10px 14px;border-radius:999px;font:700 12px system-ui;box-shadow:0 12px 28px rgba(0,0,0,.35);cursor:pointer;';
    const modal = document.createElement('div'); modal.id = 'ae-wg-v55-modal'; modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:100012;background:rgba(0,0,0,.72);padding:24px;overflow:auto;';
    modal.innerHTML = '<div style="max-width:1160px;margin:0 auto;background:#08111e;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px 18px 26px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><div style="font:700 20px system-ui">AE FLOW white-glove v55 inbox</div><div style="font:12px system-ui;opacity:.72">Visibility for duplicate-booking review packs and entrypoint spread reports coming from Routex.</div></div><button id="ae-wg-v55-close" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Duplicate review inbox</h3><div><button id="ae-wg-v55-sync-review" style="margin-right:8px">Sync</button><button id="ae-wg-v55-export-review">Export JSON</button></div></div><pre id="ae-wg-v55-review" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:320px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Entrypoint spread inbox</h3><div><button id="ae-wg-v55-sync-spread" style="margin-right:8px">Sync</button><button id="ae-wg-v55-export-spread">Export JSON</button></div></div><pre id="ae-wg-v55-spread" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:320px;overflow:auto"></pre></section></div></div>';
    document.body.appendChild(launcher); document.body.appendChild(modal);
    const reviewPre = modal.querySelector('#ae-wg-v55-review'); const spreadPre = modal.querySelector('#ae-wg-v55-spread');
    const refresh = ()=> { render(reviewPre, latest('reviewInbox')); render(spreadPre, latest('spreadInbox')); };
    launcher.onclick = ()=> { modal.style.display = 'block'; refresh(); };
    modal.querySelector('#ae-wg-v55-close').onclick = ()=> { modal.style.display = 'none'; };
    modal.querySelector('#ae-wg-v55-sync-review').onclick = ()=> { const row = syncReviewInbox(); if(row) render(reviewPre, row); };
    modal.querySelector('#ae-wg-v55-sync-spread').onclick = ()=> { const row = syncSpreadInbox(); if(row) render(spreadPre, row); };
    modal.querySelector('#ae-wg-v55-export-review').onclick = ()=> { const row = latest('reviewInbox'); if(row) downloadText(JSON.stringify(row,null,2), 'ae-whiteglove-duplicate-review-inbox-v55.json', 'application/json'); };
    modal.querySelector('#ae-wg-v55-export-spread').onclick = ()=> { const row = latest('spreadInbox'); if(row) downloadText(JSON.stringify(row,null,2), 'ae-whiteglove-entrypoint-spread-inbox-v55.json', 'application/json'); };
  }
  window.syncWhiteGloveDuplicateReviewInboxV55 = syncReviewInbox;
  window.syncWhiteGloveSpreadInboxV55 = syncSpreadInbox;
  window.openAEWhiteGloveV55Center = function(){ ensureUI(); const launcher = document.getElementById('ae-wg-v55-launcher'); if(launcher) launcher.click(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI); else ensureUI();
})();
