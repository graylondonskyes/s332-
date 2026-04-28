/* V50 Routex white-glove backend visibility + merge tooling + route preview */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V50__) return;
  window.__ROUTEX_WHITEGLOVE_V50__ = true;

  const STORAGE = {
    profiles: 'skye_whiteglove_service_profiles_v39',
    drivers: 'skye_whiteglove_driver_profiles_v39',
    vehicles: 'skye_whiteglove_vehicle_profiles_v39',
    memberships: 'skye_whiteglove_memberships_v39',
    bookings: 'skye_whiteglove_bookings_v39',
    docs: 'skye_whiteglove_docs_v39',
    execution: 'skye_whiteglove_execution_rows_v41',
    payouts: 'skye_whiteglove_payout_ledger_v41',
    websiteRequests: 'skye_whiteglove_website_requests_v42',
    syncLedger: 'skye_whiteglove_sync_ledger_v42',
    analytics: 'skye_whiteglove_analytics_snapshots_v42',
    restoreRuns: 'skye_whiteglove_restore_runs_v42',
    conflicts: 'skye_whiteglove_conflict_snapshots_v46',
    routePlans: 'skye_whiteglove_route_plans_v47',
    profitability: 'skye_whiteglove_profitability_compare_v47',
    adjustments: 'skye_whiteglove_adjustments_v48',
    command: 'skye_whiteglove_command_snapshots_v48',
    backendSnapshots: 'skye_whiteglove_backend_snapshots_v50',
    mergeRuns: 'skye_whiteglove_merge_runs_v50',
    backendOutbox: 'skye_whiteglove_backend_snapshot_outbox_v50',
    mergeOutbox: 'skye_whiteglove_merge_run_outbox_v50',
    ui: 'skye_whiteglove_v50_ui'
  };
  const KNOWN = ['profiles','drivers','vehicles','memberships','bookings','docs','execution','payouts','websiteRequests','syncLedger','analytics','restoreRuns','conflicts','routePlans','profitability','adjustments','command'];
  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>'"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const nowISO = ()=> new Date().toISOString();
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,8) + '_' + Date.now().toString(36);
  const money = (n)=> '$' + Number(n || 0).toFixed(2);
  const toast = window.toast || function(msg){ try{ console.log(msg); }catch(_){} };
  const downloadText = window.downloadText || function(content, filename, type){
    const blob = new Blob([content], { type: type || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 1200);
  };
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_){ } return value; }
  function readRows(name){ return readJSON(STORAGE[name], []); }
  function getBooking(id){ return readRows('bookings').find(row => clean(row.id) === clean(id)) || null; }
  function readUI(){ return readJSON(STORAGE.ui, { bookingId:'', importText:'', mergeMode:'merge' }); }
  function writeUI(patch){ return writeJSON(STORAGE.ui, Object.assign({}, readUI(), patch || {})); }
  function parseStops(text){ return clean(text).split(/\n+|\s*->\s*|\s*>\s*|\s*\|\s*/).map(clean).filter(Boolean); }
  function buildMaterializedRoute(booking){
    const stops = parseStops(booking.multiStopText || '');
    const legs = [];
    let current = clean(booking.pickupAddress || 'Pickup');
    let order = 1;
    stops.forEach((stop, idx)=> { legs.push({ label:'Service stop ' + (idx + 1), from:current, to:stop, kind:'service_stop', order:order++ }); current = stop; });
    const drop = clean(booking.dropoffAddress || 'Dropoff');
    legs.push({ label:'Primary dropoff', from:current, to:drop, kind:'dropoff', order:order++ });
    const standby = Number(booking.standbyMinutesPlanned || 0);
    if(standby > 0 || clean(booking.serviceType) === 'hourly_standby') legs.push({ label:'Standby hold', from:drop, to:drop, kind:'standby_hold', standbyMinutes:standby, order:order++ });
    if(booking.returnLeg){
      const reverseStops = stops.slice().reverse();
      let back = drop;
      reverseStops.forEach((stop, idx)=> { legs.push({ label:'Return stop ' + (idx + 1), from:back, to:stop, kind:'return_stop', order:order++ }); back = stop; });
      legs.push({ label:'Return to pickup', from:back, to:clean(booking.pickupAddress || 'Pickup'), kind:'return_complete', order:order++ });
    }
    return { routeFingerprint:[booking.pickupAddress, booking.dropoffAddress, stops.join('|'), booking.returnLeg ? 'return' : 'oneway', String(standby)].join('::'), stops, legs };
  }
  function pushOutbox(key, row, limit){ const rows = readJSON(key, []); rows.unshift(row); writeJSON(key, rows.slice(0, limit || 300)); }
  function countRows(arr){ return Array.isArray(arr) ? arr.length : 0; }
  function buildBackendSnapshot(){
    const bookings = readRows('bookings');
    const payments = readJSON('skye_whiteglove_payments_v49', []);
    const payouts = readRows('payouts');
    const memberships = readRows('memberships');
    const conflicts = readRows('conflicts');
    const websiteRequests = readRows('websiteRequests');
    const syncLedger = readRows('syncLedger');
    const routePlans = readRows('routePlans');
    const profitability = readRows('profitability');
    const command = readRows('command')[0] || {};
    const live = bookings.filter(row => ['confirmed','assigned','en_route','arrived','rider_boarded','in_service'].includes(clean(row.dispatchStatus || row.status).toLowerCase()));
    const severeConflicts = conflicts.filter(row => clean(row.severity).toLowerCase() === 'high').length;
    const revenue = bookings.reduce((sum, row) => sum + Number(row.pricingSnapshot && row.pricingSnapshot.quotedTotal || row.finalEconomics && row.finalEconomics.adjustedRecognizedRevenue || 0), 0);
    const payoutLiability = payouts.reduce((sum, row) => sum + Number(row.totalPayout || row.payoutAmount || row.amount || 0), 0);
    const row = {
      id: uid('wg_back50'),
      createdAt: nowISO(),
      bookings: bookings.length,
      liveBookings: live.length,
      websiteRequests: websiteRequests.length,
      syncQueue: syncLedger.length,
      routePlans: routePlans.length,
      profitabilityRows: profitability.length,
      severeConflicts,
      memberships: memberships.length,
      payments: countRows(payments),
      payoutLiability: Number(payoutLiability.toFixed(2)),
      quotedRevenue: Number(revenue.toFixed(2)),
      estimatedNet: Number((revenue - payoutLiability).toFixed(2)),
      coverage: {
        bookingsMaterialized: bookings.filter(row => row.routeMaterialized).length,
        bookingsWithPolicyAck: bookings.filter(row => Array.isArray(row.policyAcknowledgements) && row.policyAcknowledgements.length).length,
        bookingsWithFavoriteState: bookings.filter(row => clean(row.favoriteDriverState)).length,
        bookingsWithDocs: bookings.filter(row => readRows('docs').some(doc => clean(doc.meta && doc.meta.bookingId) === clean(row.id))).length
      },
      commandReference: command.id || ''
    };
    const rows = readJSON(STORAGE.backendSnapshots, []); rows.unshift(row); writeJSON(STORAGE.backendSnapshots, rows.slice(0, 300));
    pushOutbox(STORAGE.backendOutbox, { id: uid('wg_back_out50'), snapshotId: row.id, createdAt: row.createdAt, quotedRevenue: row.quotedRevenue, severeConflicts: row.severeConflicts }, 300);
    return row;
  }
  function summarizeRows(rows){
    const ids = new Set();
    let duplicateIds = 0;
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const id = clean(row && row.id);
      if(!id) return;
      if(ids.has(id)) duplicateIds += 1;
      ids.add(id);
    });
    return { rows: countRows(rows), distinctIds: ids.size, duplicateIds };
  }
  function mergeRowsById(existingRows, incomingRows, mode){
    const current = Array.isArray(existingRows) ? existingRows : [];
    const incoming = Array.isArray(incomingRows) ? incomingRows : [];
    if(mode === 'replace') return incoming.slice();
    const map = new Map();
    current.forEach(row => { const id = clean(row && row.id) || uid('anon'); map.set(id, Object.assign({}, row, { id })); });
    incoming.forEach(row => { const id = clean(row && row.id) || uid('anon'); map.set(id, Object.assign({}, map.get(id) || { id }, row, { id })); });
    return Array.from(map.values());
  }
  function parseImportText(text){ try{ return JSON.parse(String(text || '{}')); }catch(_){ return null; } }
  function previewMerge(payload){
    const preview = {};
    KNOWN.forEach(name => {
      const existing = readRows(name);
      const incoming = Array.isArray(payload && payload[name]) ? payload[name] : [];
      const existingIds = new Set(existing.map(row => clean(row.id)).filter(Boolean));
      preview[name] = Object.assign({ duplicateAgainstExisting: incoming.filter(row => existingIds.has(clean(row && row.id))).length }, summarizeRows(incoming));
    });
    return preview;
  }
  function applyMerge(payload, mode){
    const result = {};
    KNOWN.forEach(name => {
      const current = readRows(name);
      const incoming = Array.isArray(payload && payload[name]) ? payload[name] : [];
      const merged = mergeRowsById(current, incoming, mode);
      writeJSON(STORAGE[name], merged);
      result[name] = summarizeRows(merged);
    });
    const run = { id: uid('wg_merge50'), createdAt: nowISO(), mode: mode === 'replace' ? 'replace' : 'merge', result };
    const runs = readJSON(STORAGE.mergeRuns, []); runs.unshift(run); writeJSON(STORAGE.mergeRuns, runs.slice(0, 300));
    pushOutbox(STORAGE.mergeOutbox, { id: uid('wg_merge_out50'), mergeRunId: run.id, createdAt: run.createdAt, mode: run.mode }, 300);
    return run;
  }
  function buildSnapshotHtml(row){
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>White-glove backend snapshot</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:980px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:4px 8px;border:1px solid #bbb;border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">White-glove backend snapshot</h1><div><span class="badge">Bookings '+esc(String(row.bookings))+'</span><span class="badge">Live '+esc(String(row.liveBookings))+'</span><span class="badge">Queue '+esc(String(row.syncQueue))+'</span><span class="badge">Net '+esc(money(row.estimatedNet))+'</span></div></div><div class="card"><table><tbody><tr><td>Website requests</td><td>'+esc(String(row.websiteRequests))+'</td></tr><tr><td>Route plans</td><td>'+esc(String(row.routePlans))+'</td></tr><tr><td>Profitability rows</td><td>'+esc(String(row.profitabilityRows))+'</td></tr><tr><td>Severe conflicts</td><td>'+esc(String(row.severeConflicts))+'</td></tr><tr><td>Memberships</td><td>'+esc(String(row.memberships))+'</td></tr><tr><td>Payments</td><td>'+esc(String(row.payments))+'</td></tr><tr><td>Quoted revenue</td><td>'+esc(money(row.quotedRevenue))+'</td></tr><tr><td>Payout liability</td><td>'+esc(money(row.payoutLiability))+'</td></tr></tbody></table></div></div></body></html>';
  }
  function buildMergeHtml(run){
    const rows = Object.keys(run.result || {}).map(name => '<tr><td>'+esc(name)+'</td><td>'+esc(String(run.result[name].rows || 0))+'</td><td>'+esc(String(run.result[name].distinctIds || 0))+'</td><td>'+esc(String(run.result[name].duplicateIds || 0))+'</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>White-glove merge run</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:980px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">White-glove merge run</h1><div>Mode: '+esc(run.mode)+'</div><div>Saved: '+esc(run.createdAt)+'</div></div><div class="card"><table><thead><tr><th>Store</th><th>Rows</th><th>Distinct ids</th><th>Duplicate ids</th></tr></thead><tbody>'+rows+'</tbody></table></div></div></body></html>';
  }
  function latestSnapshot(){ return readJSON(STORAGE.backendSnapshots, [])[0] || null; }
  function latestMergeRun(){ return readJSON(STORAGE.mergeRuns, [])[0] || null; }
  function bookingOptions(){ return readRows('bookings').map(row => ({ id: row.id, label: [row.serviceProfileName || row.id, row.serviceType || 'ride', row.dispatchStatus || row.status || 'status'].join(' • ') })); }
  function ensureUI(){
    if(document.getElementById('wg-v50-launcher')) return;
    const launcher = document.createElement('button');
    launcher.id = 'wg-v50-launcher';
    launcher.textContent = 'WG Backend';
    launcher.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:99999;border:1px solid rgba(255,255,255,.18);background:#2c1450;color:#fff;padding:10px 14px;border-radius:999px;font:600 12px system-ui;box-shadow:0 12px 30px rgba(0,0,0,.35);cursor:pointer;';
    const modal = document.createElement('div');
    modal.id = 'wg-v50-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.68);padding:24px;overflow:auto;';
    modal.innerHTML = '<div style="max-width:1100px;margin:0 auto;background:#12081f;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px 18px 26px;box-shadow:0 24px 60px rgba(0,0,0,.45)"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><div style="font:700 20px system-ui">White-glove backend command center</div><div style="font:12px system-ui;opacity:.72">Backend visibility, route materialization preview, and merge tooling.</div></div><button id="wg-v50-close" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div><div style="display:grid;grid-template-columns:1.15fr .85fr;gap:16px"><div style="display:grid;gap:16px"><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0;font:700 15px system-ui">Backend snapshot</h3><div><button id="wg-v50-save-snapshot" style="margin-right:8px">Save snapshot</button><button id="wg-v50-export-snapshot-html" style="margin-right:8px">Export HTML</button><button id="wg-v50-export-snapshot-json">Export JSON</button></div></div><pre id="wg-v50-snapshot" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:260px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0;font:700 15px system-ui">Route materialization preview</h3><div><button id="wg-v50-preview-route">Preview route</button></div></div><div style="margin:10px 0"><select id="wg-v50-booking" style="width:100%;padding:10px;border-radius:12px;background:#0f0a18;color:#fff;border:1px solid rgba(255,255,255,.12)"></select></div><pre id="wg-v50-route" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:260px;overflow:auto"></pre></section></div><div style="display:grid;gap:16px"><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0;font:700 15px system-ui">Restore / merge tooling</h3><div><button id="wg-v50-preview-merge" style="margin-right:8px">Preview</button><button id="wg-v50-apply-merge" style="margin-right:8px">Apply</button><button id="wg-v50-export-merge-html" style="margin-right:8px">Export HTML</button><button id="wg-v50-export-merge-json">Export JSON</button></div></div><div style="margin:10px 0"><select id="wg-v50-merge-mode" style="width:100%;padding:10px;border-radius:12px;background:#0f0a18;color:#fff;border:1px solid rgba(255,255,255,.12)"><option value="merge">Merge by id</option><option value="replace">Replace incoming stores</option></select></div><textarea id="wg-v50-import" style="width:100%;min-height:170px;padding:12px;border-radius:14px;background:#0f0a18;color:#fff;border:1px solid rgba(255,255,255,.12)" placeholder="Paste white-glove backup JSON here."></textarea><pre id="wg-v50-merge" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:220px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><h3 style="margin:0 0 10px;font:700 15px system-ui">Backend lane coverage</h3><div style="font:13px system-ui;line-height:1.55;opacity:.88">This pass adds direct UI visibility for backend contract lanes, route materialization preview, and merge tooling. Use this surface to inspect the live white-glove chain without leaving Routex.</div><ul style="margin:10px 0 0 18px;font:13px system-ui;line-height:1.6"><li>Backend snapshot of bookings, sync, finance, conflicts, and coverage</li><li>Route materialization preview for complex multi-stop / return-leg bookings</li><li>Merge preview and apply across known white-glove record classes</li></ul></section></div></div></div>';
    document.body.appendChild(launcher); document.body.appendChild(modal);
    function refresh(){
      const ui = readUI();
      const select = modal.querySelector('#wg-v50-booking');
      select.innerHTML = bookingOptions().map(opt => '<option value="'+esc(opt.id)+'" '+(clean(opt.id)===clean(ui.bookingId)?'selected':'')+'>'+esc(opt.label)+'</option>').join('');
      if(!clean(select.value) && select.options[0]) select.value = select.options[0].value;
      writeUI({ bookingId: select.value || '' });
      modal.querySelector('#wg-v50-import').value = ui.importText || '';
      modal.querySelector('#wg-v50-merge-mode').value = ui.mergeMode || 'merge';
      modal.querySelector('#wg-v50-snapshot').textContent = JSON.stringify(latestSnapshot(), null, 2);
      modal.querySelector('#wg-v50-merge').textContent = JSON.stringify(latestMergeRun(), null, 2);
      const booking = getBooking(select.value);
      modal.querySelector('#wg-v50-route').textContent = booking ? JSON.stringify(buildMaterializedRoute(booking), null, 2) : 'No booking selected.';
    }
    launcher.onclick = ()=> { modal.style.display = 'block'; refresh(); };
    modal.querySelector('#wg-v50-close').onclick = ()=> { modal.style.display = 'none'; };
    modal.querySelector('#wg-v50-booking').onchange = (e)=> { writeUI({ bookingId: e.target.value }); refresh(); };
    modal.querySelector('#wg-v50-import').oninput = (e)=> writeUI({ importText: e.target.value });
    modal.querySelector('#wg-v50-merge-mode').onchange = (e)=> writeUI({ mergeMode: e.target.value });
    modal.querySelector('#wg-v50-preview-route').onclick = ()=> refresh();
    modal.querySelector('#wg-v50-save-snapshot').onclick = ()=> { const row = buildBackendSnapshot(); modal.querySelector('#wg-v50-snapshot').textContent = JSON.stringify(row, null, 2); toast('White-glove backend snapshot saved.'); };
    modal.querySelector('#wg-v50-export-snapshot-html').onclick = ()=> { const row = latestSnapshot() || buildBackendSnapshot(); downloadText(buildSnapshotHtml(row), 'whiteglove-backend-snapshot-v50.html', 'text/html'); };
    modal.querySelector('#wg-v50-export-snapshot-json').onclick = ()=> { const row = latestSnapshot() || buildBackendSnapshot(); downloadText(JSON.stringify(row, null, 2), 'whiteglove-backend-snapshot-v50.json', 'application/json'); };
    modal.querySelector('#wg-v50-preview-merge').onclick = ()=> {
      const payload = parseImportText(modal.querySelector('#wg-v50-import').value);
      if(!payload){ toast('Import JSON could not be parsed.'); return; }
      modal.querySelector('#wg-v50-merge').textContent = JSON.stringify({ preview: previewMerge(payload) }, null, 2);
    };
    modal.querySelector('#wg-v50-apply-merge').onclick = ()=> {
      const payload = parseImportText(modal.querySelector('#wg-v50-import').value);
      if(!payload){ toast('Import JSON could not be parsed.'); return; }
      const run = applyMerge(payload, modal.querySelector('#wg-v50-merge-mode').value);
      modal.querySelector('#wg-v50-merge').textContent = JSON.stringify(run, null, 2);
      toast('White-glove merge run saved.');
    };
    modal.querySelector('#wg-v50-export-merge-html').onclick = ()=> { const run = latestMergeRun(); if(!run){ toast('No merge run saved yet.'); return; } downloadText(buildMergeHtml(run), 'whiteglove-merge-run-v50.html', 'text/html'); };
    modal.querySelector('#wg-v50-export-merge-json').onclick = ()=> { const run = latestMergeRun(); if(!run){ toast('No merge run saved yet.'); return; } downloadText(JSON.stringify(run, null, 2), 'whiteglove-merge-run-v50.json', 'application/json'); };
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI); else ensureUI();
})();
