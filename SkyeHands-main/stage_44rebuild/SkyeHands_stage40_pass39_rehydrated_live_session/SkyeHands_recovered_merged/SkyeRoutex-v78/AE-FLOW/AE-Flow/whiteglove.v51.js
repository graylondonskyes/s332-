/* V51 AE FLOW white-glove operator deck + duplication + merge visibility */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_V51__) return;
  window.__AEFLOW_WHITEGLOVE_V51__ = true;
  const KEYS = {
    deckOutbox: 'skye_whiteglove_operator_deck_outbox_v51',
    deckRows: 'skye_whiteglove_operator_decks_v51',
    duplicateOutbox: 'skye_whiteglove_duplication_outbox_v51',
    duplicateRows: 'skye_whiteglove_duplication_runs_v51',
    mergePolicyOutbox: 'skye_whiteglove_merge_policy_outbox_v51',
    mergePolicyRows: 'skye_whiteglove_merge_policy_runs_v51',
    deckInbox: 'ae_whiteglove_operator_deck_inbox_v51',
    duplicateInbox: 'ae_whiteglove_duplication_inbox_v51',
    mergePolicyInbox: 'ae_whiteglove_merge_policy_inbox_v51'
  };
  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const toast = window.toast || function(msg){ try{ console.log(msg); }catch(_){} };
  const downloadText = window.downloadText || function(content, filename, type){
    const blob = new Blob([content], { type: type || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 1200);
  };
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ } return value; }
  function syncInbox(outboxKey, sourceRowsKey, inboxKey, refField){
    const outbox = readJSON(outboxKey, []); const sourceRows = readJSON(sourceRowsKey, []); const rows = readJSON(inboxKey, []);
    const existing = new Set(rows.map(row => clean(row && row.id)).filter(Boolean));
    outbox.forEach(ref => { const id = clean(ref && ref[refField]); const source = sourceRows.find(row => clean(row && row.id) === id); if(source && !existing.has(id)){ rows.unshift(source); existing.add(id); } });
    writeJSON(inboxKey, rows.slice(0, 300)); return rows;
  }
  function latest(key){ return readJSON(key, [])[0] || null; }
  function buildInboxHtml(title, rows){
    const body = (rows || []).map(row => '<tr><td>'+esc(clean(row.id))+'</td><td>'+esc(clean(row.createdAt || ''))+'</td><td>'+esc(clean(row.fingerprint || row.policy || row.mode || ''))+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:900px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">'+esc(title)+'</h1><table><thead><tr><th>ID</th><th>Saved</th><th>Signal</th></tr></thead><tbody>'+body+'</tbody></table></div></div></body></html>';
  }
  function ensureUI(){
    if(document.getElementById('ae-wg-v51-launcher')) return;
    const launcher = document.createElement('button');
    launcher.id = 'ae-wg-v51-launcher'; launcher.textContent = 'WG Deck+';
    launcher.style.cssText = 'position:fixed;left:18px;bottom:62px;z-index:99999;border:1px solid rgba(255,255,255,.18);background:#0f4b65;color:#fff;padding:10px 14px;border-radius:999px;font:700 12px system-ui;box-shadow:0 12px 30px rgba(0,0,0,.35);cursor:pointer;';
    const modal = document.createElement('div');
    modal.id = 'ae-wg-v51-modal'; modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,.68);padding:24px;overflow:auto;';
    modal.innerHTML = '<div style="max-width:980px;margin:0 auto;background:#0c1a26;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px 18px 26px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><div style="font:700 20px system-ui">White-glove operator deck visibility</div><div style="font:12px system-ui;opacity:.72">Sync Routex operator deck, duplication runs, and merge-policy runs into AE FLOW.</div></div><button id="ae-wg-v51-close" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0;font:700 15px system-ui">Operator deck inbox</h3><div><button id="ae-wg-v51-sync-deck" style="margin-right:8px">Sync</button><button id="ae-wg-v51-export-deck-html" style="margin-right:8px">Export HTML</button><button id="ae-wg-v51-export-deck-json">Export JSON</button></div></div><pre id="ae-wg-v51-deck" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:240px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0;font:700 15px system-ui">Duplication inbox</h3><div><button id="ae-wg-v51-sync-dup" style="margin-right:8px">Sync</button><button id="ae-wg-v51-export-dup-html" style="margin-right:8px">Export HTML</button><button id="ae-wg-v51-export-dup-json">Export JSON</button></div></div><pre id="ae-wg-v51-dup" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:240px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0;font:700 15px system-ui">Merge-policy inbox</h3><div><button id="ae-wg-v51-sync-merge" style="margin-right:8px">Sync</button><button id="ae-wg-v51-export-merge-html" style="margin-right:8px">Export HTML</button><button id="ae-wg-v51-export-merge-json">Export JSON</button></div></div><pre id="ae-wg-v51-merge" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:240px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><h3 style="margin:0 0 10px;font:700 15px system-ui">What AE FLOW sees now</h3><ul style="margin:0 0 0 18px;font:13px system-ui;line-height:1.65"><li>Unified Routex operator deck signal</li><li>Duplication-chain visibility for repeat and split service runs</li><li>Merge-policy run visibility for restore and portability control</li></ul><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button id="ae-wg-v51-tour-bridge">Walkthrough: bridge</button></div></section></div></div>';
    document.body.appendChild(launcher); document.body.appendChild(modal);
    function refresh(){ modal.querySelector('#ae-wg-v51-deck').textContent = JSON.stringify(latest(KEYS.deckInbox), null, 2); modal.querySelector('#ae-wg-v51-dup').textContent = JSON.stringify(latest(KEYS.duplicateInbox), null, 2); modal.querySelector('#ae-wg-v51-merge').textContent = JSON.stringify(latest(KEYS.mergePolicyInbox), null, 2); }
    launcher.onclick = ()=> { modal.style.display = 'block'; refresh(); };
    modal.querySelector('#ae-wg-v51-close').onclick = ()=> { modal.style.display = 'none'; };
    modal.querySelector('#ae-wg-v51-sync-deck').onclick = ()=> { syncInbox(KEYS.deckOutbox, KEYS.deckRows, KEYS.deckInbox, 'deckId'); refresh(); toast('White-glove operator deck inbox synced.', 'good'); };
    modal.querySelector('#ae-wg-v51-sync-dup').onclick = ()=> { syncInbox(KEYS.duplicateOutbox, KEYS.duplicateRows, KEYS.duplicateInbox, 'duplicateRunId'); refresh(); toast('White-glove duplication inbox synced.', 'good'); };
    modal.querySelector('#ae-wg-v51-sync-merge').onclick = ()=> { syncInbox(KEYS.mergePolicyOutbox, KEYS.mergePolicyRows, KEYS.mergePolicyInbox, 'mergePolicyRunId'); refresh(); toast('White-glove merge-policy inbox synced.', 'good'); };
    modal.querySelector('#ae-wg-v51-export-deck-html').onclick = ()=> { downloadText(buildInboxHtml('White-glove operator deck inbox', readJSON(KEYS.deckInbox, [])), 'whiteglove_operator_deck_inbox_v51.html', 'text/html'); };
    modal.querySelector('#ae-wg-v51-export-deck-json').onclick = ()=> { downloadText(JSON.stringify(readJSON(KEYS.deckInbox, []), null, 2), 'whiteglove_operator_deck_inbox_v51.json', 'application/json'); };
    modal.querySelector('#ae-wg-v51-export-dup-html').onclick = ()=> { downloadText(buildInboxHtml('White-glove duplication inbox', readJSON(KEYS.duplicateInbox, [])), 'whiteglove_duplication_inbox_v51.html', 'text/html'); };
    modal.querySelector('#ae-wg-v51-export-dup-json').onclick = ()=> { downloadText(JSON.stringify(readJSON(KEYS.duplicateInbox, []), null, 2), 'whiteglove_duplication_inbox_v51.json', 'application/json'); };
    modal.querySelector('#ae-wg-v51-export-merge-html').onclick = ()=> { downloadText(buildInboxHtml('White-glove merge-policy inbox', readJSON(KEYS.mergePolicyInbox, [])), 'whiteglove_merge_policy_inbox_v51.html', 'text/html'); };
    modal.querySelector('#ae-wg-v51-export-merge-json').onclick = ()=> { downloadText(JSON.stringify(readJSON(KEYS.mergePolicyInbox, []), null, 2), 'whiteglove_merge_policy_inbox_v51.json', 'application/json'); };
    modal.querySelector('#ae-wg-v51-tour-bridge').onclick = ()=> { if(typeof window.startAEWhiteGloveV51Tour === 'function') window.startAEWhiteGloveV51Tour(); };
  }
  window.openAEWhiteGloveBridgeV51 = function(){ ensureUI(); document.getElementById('ae-wg-v51-modal').style.display = 'block'; };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI); else ensureUI();
})();
