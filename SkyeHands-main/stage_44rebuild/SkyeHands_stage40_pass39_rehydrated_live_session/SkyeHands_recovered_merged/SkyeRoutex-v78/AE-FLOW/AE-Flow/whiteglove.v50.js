/* V50 AE FLOW white-glove backend visibility + merge inbox */
(function(){
  if(window.__AEFLOW_WHITEGLOVE_V50__) return;
  window.__AEFLOW_WHITEGLOVE_V50__ = true;

  const KEYS = {
    backendOutbox: 'skye_whiteglove_backend_snapshot_outbox_v50',
    mergeOutbox: 'skye_whiteglove_merge_run_outbox_v50',
    routexBackendSnapshots: 'skye_whiteglove_backend_snapshots_v50',
    routexMergeRuns: 'skye_whiteglove_merge_runs_v50',
    backendInbox: 'ae_whiteglove_backend_inbox_v50',
    mergeInbox: 'ae_whiteglove_merge_inbox_v50',
    ui: 'ae_whiteglove_v50_ui'
  };
  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
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
    const outbox = readJSON(outboxKey, []);
    const sourceRows = readJSON(sourceRowsKey, []);
    const rows = readJSON(inboxKey, []);
    const existing = new Set(rows.map(row => clean(row && row.id)).filter(Boolean));
    outbox.forEach(ref => {
      const id = clean(ref && ref[refField]);
      const source = sourceRows.find(row => clean(row && row.id) === id);
      if(source && !existing.has(id)) { rows.unshift(source); existing.add(id); }
    });
    writeJSON(inboxKey, rows.slice(0, 300));
    return rows;
  }
  function latest(key){ return readJSON(key, [])[0] || null; }
  function buildInboxHtml(title, rows){
    const body = (rows || []).map(row => '<tr><td>'+esc(clean(row.id))+'</td><td>'+esc(clean(row.createdAt || row.now || ''))+'</td><td>'+esc(clean(row.mode || row.estimatedNet || row.quotedRevenue || ''))+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:900px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">'+esc(title)+'</h1><table><thead><tr><th>ID</th><th>Saved</th><th>Signal</th></tr></thead><tbody>'+body+'</tbody></table></div></div></body></html>';
  }
  function ensureUI(){
    if(document.getElementById('ae-wg-v50-launcher')) return;
    const launcher = document.createElement('button');
    launcher.id = 'ae-wg-v50-launcher';
    launcher.textContent = 'WG Ops';
    launcher.style.cssText = 'position:fixed;left:18px;bottom:18px;z-index:99999;border:1px solid rgba(255,255,255,.18);background:#14304f;color:#fff;padding:10px 14px;border-radius:999px;font:600 12px system-ui;box-shadow:0 12px 30px rgba(0,0,0,.35);cursor:pointer;';
    const modal = document.createElement('div');
    modal.id = 'ae-wg-v50-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.68);padding:24px;overflow:auto;';
    modal.innerHTML = '<div style="max-width:980px;margin:0 auto;background:#0c1a26;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px 18px 26px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><div style="font:700 20px system-ui">White-glove backend visibility</div><div style="font:12px system-ui;opacity:.72">Sync Routex backend snapshots and merge runs into AE FLOW.</div></div><button id="ae-wg-v50-close" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0;font:700 15px system-ui">Backend snapshot inbox</h3><div><button id="ae-wg-v50-sync-backend" style="margin-right:8px">Sync</button><button id="ae-wg-v50-export-backend-html" style="margin-right:8px">Export HTML</button><button id="ae-wg-v50-export-backend-json">Export JSON</button></div></div><pre id="ae-wg-v50-backend" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:280px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0;font:700 15px system-ui">Merge run inbox</h3><div><button id="ae-wg-v50-sync-merge" style="margin-right:8px">Sync</button><button id="ae-wg-v50-export-merge-html" style="margin-right:8px">Export HTML</button><button id="ae-wg-v50-export-merge-json">Export JSON</button></div></div><pre id="ae-wg-v50-merge" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:280px;overflow:auto"></pre></section></div><section style="margin-top:16px;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><h3 style="margin:0 0 10px;font:700 15px system-ui">Backend lane guide</h3><ul style="margin:0 0 0 18px;font:13px system-ui;line-height:1.65"><li>Sync backend snapshots after dispatch / finance / sync-heavy work.</li><li>Use merge inbox after a restore or portability pass.</li><li>Treat snapshot severity, queue depth, and estimated net as operator-facing signals.</li></ul></section></div>';
    document.body.appendChild(launcher); document.body.appendChild(modal);
    function refresh(){
      modal.querySelector('#ae-wg-v50-backend').textContent = JSON.stringify(latest(KEYS.backendInbox), null, 2);
      modal.querySelector('#ae-wg-v50-merge').textContent = JSON.stringify(latest(KEYS.mergeInbox), null, 2);
    }
    launcher.onclick = ()=> { modal.style.display = 'block'; refresh(); };
    modal.querySelector('#ae-wg-v50-close').onclick = ()=> { modal.style.display = 'none'; };
    modal.querySelector('#ae-wg-v50-sync-backend').onclick = ()=> { syncInbox(KEYS.backendOutbox, KEYS.routexBackendSnapshots, KEYS.backendInbox, 'snapshotId'); refresh(); toast('White-glove backend inbox synced.'); };
    modal.querySelector('#ae-wg-v50-sync-merge').onclick = ()=> { syncInbox(KEYS.mergeOutbox, KEYS.routexMergeRuns, KEYS.mergeInbox, 'mergeRunId'); refresh(); toast('White-glove merge inbox synced.'); };
    modal.querySelector('#ae-wg-v50-export-backend-html').onclick = ()=> { const rows = readJSON(KEYS.backendInbox, []); downloadText(buildInboxHtml('White-glove backend snapshot inbox', rows), 'whiteglove-backend-inbox-v50.html', 'text/html'); };
    modal.querySelector('#ae-wg-v50-export-backend-json').onclick = ()=> { const rows = readJSON(KEYS.backendInbox, []); downloadText(JSON.stringify(rows, null, 2), 'whiteglove-backend-inbox-v50.json', 'application/json'); };
    modal.querySelector('#ae-wg-v50-export-merge-html').onclick = ()=> { const rows = readJSON(KEYS.mergeInbox, []); downloadText(buildInboxHtml('White-glove merge inbox', rows), 'whiteglove-merge-inbox-v50.html', 'text/html'); };
    modal.querySelector('#ae-wg-v50-export-merge-json').onclick = ()=> { const rows = readJSON(KEYS.mergeInbox, []); downloadText(JSON.stringify(rows, null, 2), 'whiteglove-merge-inbox-v50.json', 'application/json'); };
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI); else ensureUI();
})();
