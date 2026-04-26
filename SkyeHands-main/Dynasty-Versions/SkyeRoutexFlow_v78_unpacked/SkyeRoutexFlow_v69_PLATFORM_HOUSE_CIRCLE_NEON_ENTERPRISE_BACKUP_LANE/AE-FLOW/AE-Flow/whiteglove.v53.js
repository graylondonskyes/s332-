/* V53 AE FLOW collision + surface bundle visibility */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_V53__) return;
  window.__AEFLOW_WHITEGLOVE_V53__ = true;
  const KEYS = {
    collisionRows:'skye_whiteglove_collision_audits_v53', collisionOutbox:'skye_whiteglove_collision_outbox_v53', collisionInbox:'ae_whiteglove_collision_inbox_v53',
    edgeRows:'skye_whiteglove_materialization_edge_reports_v53', edgeOutbox:'skye_whiteglove_materialization_edge_outbox_v53', edgeInbox:'ae_whiteglove_materialization_edge_inbox_v53',
    surfaceRows:'skye_whiteglove_surface_bundles_v53', surfaceOutbox:'skye_whiteglove_surface_bundle_outbox_v53', surfaceInbox:'ae_whiteglove_surface_bundle_inbox_v53'
  };
  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const toast = window.toast || function(msg){ try{ console.log(msg); }catch(_){} };
  const downloadText = window.downloadText || function(content, filename, type){ const blob = new Blob([content], { type: type || 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(url), 1200); };
  const readJSON = (k,f)=> { try{ const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; }catch(_){ return f; } };
  const writeJSON = (k,v)=> { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} return v; };
  const latest = (key)=> readJSON(key, [])[0] || null;
  function sync(refKey, rowsKey, inboxKey, idField){ const refs = readJSON(refKey, []); const rows = readJSON(rowsKey, []); const inbox = readJSON(inboxKey, []); const seen = new Set(inbox.map(r => clean(r && r.id)).filter(Boolean)); refs.forEach(ref => { const id = clean(ref && ref[idField]); const row = rows.find(item => clean(item && item.id) === id); if(row && !seen.has(id)){ inbox.unshift(row); seen.add(id); } }); writeJSON(inboxKey, inbox.slice(0, 240)); return inbox; }
  function htmlWrap(title, rows){ return '<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1080px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;white-space:pre-wrap}</style></head><body><div class="wrap"><div class="card"><h1>'+esc(title)+'</h1><pre>'+esc(JSON.stringify(rows || [], null, 2))+'</pre></div></div></body></html>'; }
  function ensureUI(){
    if(document.getElementById('ae-wg-v53-launcher')) return;
    const launcher = document.createElement('button');
    launcher.id = 'ae-wg-v53-launcher';
    launcher.textContent = 'WG Collision+';
    launcher.style.cssText = 'position:fixed;left:18px;bottom:72px;z-index:100007;border:1px solid rgba(255,255,255,.18);background:#153463;color:#fff;padding:10px 14px;border-radius:999px;font:700 12px system-ui;box-shadow:0 12px 28px rgba(0,0,0,.35);cursor:pointer;';
    const modal = document.createElement('div');
    modal.id = 'ae-wg-v53-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:100008;background:rgba(0,0,0,.72);padding:24px;overflow:auto;';
    modal.innerHTML = '<div style="max-width:1180px;margin:0 auto;background:#12081f;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px 18px 26px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><div style="font:700 20px system-ui">White-glove hardening visibility</div><div style="font:12px system-ui;opacity:.72">AE FLOW view of collision audits, materialization edge reports, and the newest operator surface bundle.</div></div><button id="ae-wg-v53-close" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Collision inbox</h3><div><button id="ae-wg-v53-sync-collision" style="margin-right:8px">Sync</button><button id="ae-wg-v53-export-collision-json">Export JSON</button></div></div><pre id="ae-wg-v53-collision" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:260px;overflow:auto"></pre></section>'
      + '<section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Materialization edge inbox</h3><div><button id="ae-wg-v53-sync-edge" style="margin-right:8px">Sync</button><button id="ae-wg-v53-export-edge-json">Export JSON</button></div></div><pre id="ae-wg-v53-edge" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:260px;overflow:auto"></pre></section>'
      + '<section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Operator surface bundle inbox</h3><div><button id="ae-wg-v53-sync-surface" style="margin-right:8px">Sync</button><button id="ae-wg-v53-export-surface-html" style="margin-right:8px">Export HTML</button><button id="ae-wg-v53-export-surface-json">Export JSON</button></div></div><pre id="ae-wg-v53-surface" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:260px;overflow:auto"></pre></section>'
      + '<section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><h3 style="margin:0 0 10px">Why this matters</h3><div style="font:13px system-ui;line-height:1.6;opacity:.86">AE FLOW can now see the newest hardening surfaces too, so the operator side knows when record-chain collisions or route-materialization gaps are threatening premium continuity.</div><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button id="ae-wg-v53-run-guide">Run hardening guide</button></div></section>'
      + '</div></div>';
    document.body.appendChild(launcher); document.body.appendChild(modal);
    const refresh = ()=> {
      modal.querySelector('#ae-wg-v53-collision').textContent = JSON.stringify(latest(KEYS.collisionInbox), null, 2);
      modal.querySelector('#ae-wg-v53-edge').textContent = JSON.stringify(latest(KEYS.edgeInbox), null, 2);
      modal.querySelector('#ae-wg-v53-surface').textContent = JSON.stringify(latest(KEYS.surfaceInbox), null, 2);
    };
    launcher.onclick = ()=> { modal.style.display='block'; refresh(); };
    modal.querySelector('#ae-wg-v53-close').onclick = ()=> { modal.style.display='none'; };
    modal.querySelector('#ae-wg-v53-sync-collision').onclick = ()=> { sync(KEYS.collisionOutbox, KEYS.collisionRows, KEYS.collisionInbox, 'collisionAuditId'); refresh(); toast('White-glove collision inbox synced.','good'); };
    modal.querySelector('#ae-wg-v53-sync-edge').onclick = ()=> { sync(KEYS.edgeOutbox, KEYS.edgeRows, KEYS.edgeInbox, 'edgeReportId'); refresh(); toast('White-glove edge inbox synced.','good'); };
    modal.querySelector('#ae-wg-v53-sync-surface').onclick = ()=> { sync(KEYS.surfaceOutbox, KEYS.surfaceRows, KEYS.surfaceInbox, 'surfaceBundleId'); refresh(); toast('White-glove surface bundle inbox synced.','good'); };
    modal.querySelector('#ae-wg-v53-export-collision-json').onclick = ()=> downloadText(JSON.stringify(readJSON(KEYS.collisionInbox, []), null, 2), 'ae_whiteglove_collision_inbox_v53.json', 'application/json');
    modal.querySelector('#ae-wg-v53-export-edge-json').onclick = ()=> downloadText(JSON.stringify(readJSON(KEYS.edgeInbox, []), null, 2), 'ae_whiteglove_materialization_edge_inbox_v53.json', 'application/json');
    modal.querySelector('#ae-wg-v53-export-surface-html').onclick = ()=> downloadText(htmlWrap('AE white-glove operator surface bundle inbox', readJSON(KEYS.surfaceInbox, [])), 'ae_whiteglove_surface_bundle_inbox_v53.html', 'text/html');
    modal.querySelector('#ae-wg-v53-export-surface-json').onclick = ()=> downloadText(JSON.stringify(readJSON(KEYS.surfaceInbox, []), null, 2), 'ae_whiteglove_surface_bundle_inbox_v53.json', 'application/json');
    modal.querySelector('#ae-wg-v53-run-guide').onclick = ()=> { if(typeof window.startAEWhiteGloveV53Tour === 'function') window.startAEWhiteGloveV53Tour(); else toast('V53 guide unavailable.','warn'); };
  }
  window.openAEWhiteGloveHardeningVisibilityV53 = function(){ ensureUI(); document.getElementById('ae-wg-v53-launcher')?.click(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI); else ensureUI();
})();
