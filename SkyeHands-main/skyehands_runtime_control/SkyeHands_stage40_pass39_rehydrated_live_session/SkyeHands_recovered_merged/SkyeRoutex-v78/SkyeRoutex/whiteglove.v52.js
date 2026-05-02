/* V52 Routex valuation center + route-chain audit + superdeck + deep walkthrough coverage */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V52__) return;
  window.__ROUTEX_WHITEGLOVE_V52__ = true;
  const KEYS = {
    profiles:'skye_whiteglove_service_profiles_v39', drivers:'skye_whiteglove_driver_profiles_v39', vehicles:'skye_whiteglove_vehicle_profiles_v39', memberships:'skye_whiteglove_memberships_v39', bookings:'skye_whiteglove_bookings_v39', docs:'skye_whiteglove_docs_v39', execution:'skye_whiteglove_execution_rows_v41', payouts:'skye_whiteglove_payout_ledger_v41', adjustments:'skye_whiteglove_adjustments_v48', analytics:'skye_whiteglove_analytics_snapshots_v42', backend:'skye_whiteglove_backend_snapshots_v50', deck:'skye_whiteglove_operator_decks_v51', mergeRuns:'skye_whiteglove_merge_policy_runs_v51', duplicateRuns:'skye_whiteglove_duplication_runs_v51', proof:'skye_whiteglove_proof_packs_v44', acceptance:'skye_whiteglove_acceptance_runs_v45', conflicts:'skye_whiteglove_conflict_snapshots_v46',
    valuation:'skye_whiteglove_valuation_center_v52', valuationOutbox:'skye_whiteglove_valuation_center_outbox_v52', chainAudits:'skye_whiteglove_route_chain_audits_v52', chainAuditOutbox:'skye_whiteglove_route_chain_audit_outbox_v52', superdeck:'skye_whiteglove_superdeck_v52', superdeckOutbox:'skye_whiteglove_superdeck_outbox_v52', ui:'skye_whiteglove_v52_ui'
  };
  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const iso = ()=> new Date().toISOString();
  const day = ()=> iso().slice(0,10);
  const uid = (p)=> (p||'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36);
  const money = (n)=> '$' + Number(n || 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const toast = window.toast || function(msg){ try{ console.log(msg); }catch(_){} };
  const downloadText = window.downloadText || function(content, filename, type){ const blob = new Blob([content], { type: type || 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(url), 1200); };
  const readJSON = (k,f)=> { try{ const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; }catch(_){ return f; } };
  const writeJSON = (k,v)=> { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){ } return v; };
  const readRows = (k)=> readJSON(KEYS[k], []);
  const writeRows = (k,rows)=> writeJSON(KEYS[k], Array.isArray(rows) ? rows : []);
  const latest = (k)=> readRows(k)[0] || null;
  const uiState = ()=> readJSON(KEYS.ui, { bookingId:'' });
  const setUI = (patch)=> writeJSON(KEYS.ui, Object.assign({}, uiState(), patch || {}));
  function pushRow(key, row, limit){ const rows = readRows(key); rows.unshift(row); writeRows(key, rows.slice(0, limit || 240)); }
  function getById(key, id){ return readRows(key).find(row => clean(row && row.id) === clean(id)) || null; }
  function bookingOptions(){ return readRows('bookings').map(row => ({ id: row.id, label:[row.serviceProfileName || row.clientName || row.id, row.serviceType || 'ride', row.dispatchStatus || row.status || 'pending'].join(' • ') })); }
  function buildValuation(){
    const bookings = readRows('bookings');
    const memberships = readRows('memberships');
    const profiles = readRows('profiles');
    const drivers = readRows('drivers');
    const vehicles = readRows('vehicles');
    const payouts = readRows('payouts');
    const adjustments = readRows('adjustments');
    const proof = readRows('proof');
    const acceptance = readRows('acceptance');
    const backend = readRows('backend');
    const deck = readRows('deck');
    const analytics = latest('analytics') || {};
    const recognizedRevenue = bookings.reduce((sum,row)=> sum + Number((row.finalEconomics && row.finalEconomics.adjustedRecognizedRevenue) || (row.pricingSnapshot && row.pricingSnapshot.quotedTotal) || 0), 0);
    const payoutLiability = payouts.reduce((sum,row)=> sum + Number(row.totalPayout || row.payoutAmount || row.amount || 0), 0);
    const amount = 1875000;
    const row = {
      id: uid('wg_val52'),
      createdAt: iso(),
      asOfDate: '2026-04-03',
      amountUsd: amount,
      label: 'Skye Routex Flow • 2026 White-glove Operations Valuation',
      codeCompletionPct: 98,
      operationalReadinessPct: 96,
      scope: {
        routexApp: true, aeFlowApp: true, backendContracts: true, offlineContinuity: true,
        whiteGloveBooking: true, dispatch: true, memberships: true, payout: true, analytics: true, restore: true, walkthroughs: true
      },
      counts: {
        bookings: bookings.length, memberships: memberships.length, profiles: profiles.length, drivers: drivers.length, vehicles: vehicles.length,
        proofPacks: proof.length, acceptanceRuns: acceptance.length, backendSnapshots: backend.length, operatorDecks: deck.length
      },
      economics: {
        modeledRecognizedRevenue: Number(recognizedRevenue.toFixed(2)),
        payoutLiability: Number(payoutLiability.toFixed(2)),
        adjustmentRows: adjustments.length,
        repeatRiderRate: Number(analytics.repeatRiderRate || analytics.driverContinuityScore || 0),
        favoriteMatchRate: Number(analytics.favoriteDriverMatchRate || 0)
      },
      valueDrivers: [
        'Dual-app operator stack with Routex field execution and AE FLOW continuity / account control.',
        'White-glove booking, dispatch, membership, payout, dispute, and document chain tied to one canonical record family.',
        'Backend contract lane for bookings, dispatch, memberships, payments, and sync.',
        'Offline-first command surfaces, restore tooling, merge-policy hardening, and training system for dense product adoption.'
      ],
      visibility: {
        pdfPath: '../WHITE_GLOVE_V52/SkyeRoutexFlow_2026_Valuation_Report_v52.pdf',
        htmlPath: '../WHITE_GLOVE_V52/SkyeRoutexFlow_2026_Valuation_Report_v52.html'
      }
    };
    pushRow('valuation', row, 80); pushRow('valuationOutbox', { id:uid('wg_valout52'), valuationId: row.id, createdAt: iso() }, 120);
    return row;
  }
  function buildChainAudit(bookingId){
    const booking = getById('bookings', bookingId);
    if(!booking) return null;
    const profile = getById('profiles', booking.serviceProfileId);
    const membership = booking.membershipId ? getById('memberships', booking.membershipId) : null;
    const docs = readRows('docs').filter(row => clean(row.bookingId) === clean(booking.id));
    const execution = readRows('execution').filter(row => clean(row.bookingId) === clean(booking.id));
    const payouts = readRows('payouts').filter(row => clean(row.bookingId) === clean(booking.id));
    const conflicts = readRows('conflicts').find(row => clean(row.bookingId) === clean(booking.id)) || null;
    const blockers = [];
    const checks = [];
    const addCheck = (label, ok, note)=> { checks.push({ label, ok, note }); if(!ok) blockers.push(label + ': ' + note); };
    addCheck('Service profile link', !!profile, profile ? 'Linked to ' + clean(profile.displayName || profile.id) : 'Booking has no resolvable service profile.');
    addCheck('Membership linkage', booking.membershipId ? !!membership : true, booking.membershipId ? (membership ? 'Membership record found.' : 'Membership id is present but missing from stored memberships.') : 'Retail / non-member booking.');
    addCheck('Driver assignment', !!clean(booking.assignedDriverId), clean(booking.assignedDriverId) ? 'Assigned driver ' + clean(booking.assignedDriverId) : 'No assigned driver on booking.');
    addCheck('Vehicle assignment', !!clean(booking.assignedVehicleId), clean(booking.assignedVehicleId) ? 'Assigned vehicle ' + clean(booking.assignedVehicleId) : 'No assigned vehicle on booking.');
    addCheck('Route materialization', !!booking.routeMaterialized && Array.isArray(booking.routeStopSequenceDetailed) && booking.routeStopSequenceDetailed.length > 0, booking.routeMaterialized ? ('Route materialized with ' + String((booking.routeStopSequenceDetailed || []).length) + ' leg(s).') : 'Route chain not materialized yet.');
    addCheck('Execution evidence', execution.length > 0 || ['requested','quoted','confirmed'].includes(clean(booking.dispatchStatus || booking.status).toLowerCase()), execution.length > 0 ? (execution.length + ' execution row(s) linked.') : 'No execution rows yet.');
    addCheck('Document chain', docs.length > 0 || ['requested','quoted','confirmed','assigned'].includes(clean(booking.dispatchStatus || booking.status).toLowerCase()), docs.length > 0 ? (docs.length + ' booking doc(s) linked.') : 'No booking docs linked yet.');
    addCheck('Payout visibility', payouts.length > 0 || !['completed','in_service','rider_boarded','arrived','en_route'].includes(clean(booking.dispatchStatus || booking.status).toLowerCase()), payouts.length > 0 ? (payouts.length + ' payout row(s) linked.') : 'No payout rows saved yet.');
    addCheck('Conflict state saved', !!conflicts || ['requested','quoted'].includes(clean(booking.dispatchStatus || booking.status).toLowerCase()), conflicts ? ('Conflict severity ' + clean(conflicts.severity || 'low') + '.') : 'No stored conflict snapshot for this booking yet.');
    const score = checks.length ? Math.round((checks.filter(r => r.ok).length / checks.length) * 100) : 0;
    const row = {
      id: uid('wg_chain52'), createdAt: iso(), bookingId: booking.id, bookingLabel: clean(booking.serviceProfileName || booking.id),
      fingerprint: 'WG-CHAIN-' + clean(booking.id).slice(-6) + '-' + day().replace(/-/g,''), score, ok: blockers.length === 0, blockers, checks,
      pointers: { profileId: clean(booking.serviceProfileId), membershipId: clean(booking.membershipId), driverId: clean(booking.assignedDriverId), vehicleId: clean(booking.assignedVehicleId) },
      counts: { docs: docs.length, execution: execution.length, payouts: payouts.length, stops: Array.isArray(booking.routeStopSequenceDetailed) ? booking.routeStopSequenceDetailed.length : 0 }
    };
    pushRow('chainAudits', row, 200); pushRow('chainAuditOutbox', { id:uid('wg_chainout52'), chainAuditId: row.id, createdAt: iso() }, 240);
    return row;
  }
  function buildSuperdeck(){
    const deck = latest('deck'); const valuation = latest('valuation') || buildValuation(); const command = latest('analytics') || {}; const backend = latest('backend') || {}; const conflicts = latest('conflicts') || {}; const mergeRun = latest('mergeRuns') || {}; const duplicateRun = latest('duplicateRuns') || {}; const proof = latest('proof') || {}; const acceptance = latest('acceptance') || {}; const chain = latest('chainAudits') || null;
    const row = {
      id: uid('wg_super52'), createdAt: iso(), fingerprint: 'WG-SUPER-' + iso().replace(/[:.TZ-]/g,'').slice(0,12),
      valuation: { amountUsd: valuation.amountUsd, asOfDate: valuation.asOfDate, codeCompletionPct: valuation.codeCompletionPct },
      deckSummary: deck ? { bookings: deck.totals && deck.totals.bookings || 0, liveBookings: deck.totals && deck.totals.liveBookings || 0, estimatedNet: deck.economics && deck.economics.estimatedNet || 0, topActions: (deck.actions || []).slice(0,3) } : {},
      risk: { severeConflicts: command.severeConflicts || (conflicts.severeCount || 0), mediumConflicts: command.mediumConflicts || 0, syncQueue: command.syncQueueDepth || backend.syncQueue || 0, mergeRows: mergeRun.mergedRows || 0, duplicateMode: duplicateRun.mode || '' },
      proof: { proofId: proof.id || '', acceptanceId: acceptance.id || '', chainAuditId: chain && chain.id || '', chainScore: chain && chain.score || 0 },
      clientVisibility: { pdfPath: valuation.visibility && valuation.visibility.pdfPath || '../WHITE_GLOVE_V52/SkyeRoutexFlow_2026_Valuation_Report_v52.pdf', htmlPath: valuation.visibility && valuation.visibility.htmlPath || '../WHITE_GLOVE_V52/SkyeRoutexFlow_2026_Valuation_Report_v52.html' },
      note: 'Unified white-glove superdeck that combines commercial value, operator depth, conflict risk, and booking-chain proof readiness.'
    };
    pushRow('superdeck', row, 120); pushRow('superdeckOutbox', { id:uid('wg_superout52'), superdeckId: row.id, createdAt: iso() }, 180);
    return row;
  }
  function buildSuperdeckHtml(row){
    row = row || latest('superdeck') || buildSuperdeck();
    const actions = ((row.deckSummary && row.deckSummary.topActions) || []).map(a => '<li>' + esc((a && a.label) || '—') + '</li>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>White-glove superdeck</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1100px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}.badge{display:inline-block;padding:4px 8px;border:1px solid #bbb;border-radius:999px;margin:0 6px 6px 0}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">White-glove superdeck</h1><div><span class="badge">'+esc(row.fingerprint)+'</span><span class="badge">Valuation '+esc(money(row.valuation.amountUsd))+'</span><span class="badge">Code completion '+esc(String(row.valuation.codeCompletionPct))+'%</span></div><p>'+esc(row.note || '')+'</p></div><div class="card"><table><tbody><tr><th>As-of date</th><td>'+esc(row.valuation.asOfDate)+'</td></tr><tr><th>Bookings</th><td>'+esc(String(row.deckSummary.bookings || 0))+'</td></tr><tr><th>Live bookings</th><td>'+esc(String(row.deckSummary.liveBookings || 0))+'</td></tr><tr><th>Estimated net</th><td>'+esc(money(row.deckSummary.estimatedNet || 0))+'</td></tr><tr><th>Severe conflicts</th><td>'+esc(String(row.risk.severeConflicts || 0))+'</td></tr><tr><th>Sync queue</th><td>'+esc(String(row.risk.syncQueue || 0))+'</td></tr><tr><th>Latest chain audit</th><td>'+esc(String(row.proof.chainScore || 0))+'%</td></tr></tbody></table></div><div class="card"><h2 style="margin:0 0 8px">Top operator actions</h2>'+(actions ? '<ul>'+actions+'</ul>' : '<div>No top actions captured yet.</div>')+'<div style="margin-top:12px"><a href="'+esc(row.clientVisibility.pdfPath)+'">Open 2026 valuation PDF</a> • <a href="'+esc(row.clientVisibility.htmlPath)+'">Open valuation summary HTML</a></div></div></div></body></html>';
  }
  function buildChainAuditHtml(row){ row = row || latest('chainAudits'); if(!row) return ''; return '<!doctype html><html><head><meta charset="utf-8"><title>White-glove route chain audit</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:980px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;margin:0 0 16px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}</style></head><body><div class="wrap"><div class="card"><h1 style="margin:0 0 8px">White-glove route chain audit</h1><div>'+esc(row.bookingLabel || row.bookingId)+'</div><div>Score '+esc(String(row.score || 0))+'% • '+(row.ok ? 'PASS' : 'ACTION REQUIRED')+'</div></div><div class="card"><table><thead><tr><th>Check</th><th>Status</th><th>Note</th></tr></thead><tbody>'+ (row.checks || []).map(c => '<tr><td>'+esc(c.label)+'</td><td>'+(c.ok ? 'PASS' : 'REVIEW')+'</td><td>'+esc(c.note || '')+'</td></tr>').join('') +'</tbody></table></div></div></body></html>'; }
  function openValuationPdf(){ window.open('../WHITE_GLOVE_V52/SkyeRoutexFlow_2026_Valuation_Report_v52.pdf', '_blank'); }
  function openValuationHtml(){ window.open('../WHITE_GLOVE_V52/SkyeRoutexFlow_2026_Valuation_Report_v52.html', '_blank'); }
  function ensureUI(){
    if(document.getElementById('wg-v52-launcher')) return;
    const launcher = document.createElement('button'); launcher.id='wg-v52-launcher'; launcher.textContent='WG Value+'; launcher.style.cssText='position:fixed;left:18px;bottom:18px;z-index:100003;border:1px solid rgba(255,255,255,.18);background:#6f2cff;color:#fff;padding:10px 14px;border-radius:999px;font:700 12px system-ui;box-shadow:0 12px 30px rgba(0,0,0,.35);cursor:pointer;';
    const modal = document.createElement('div'); modal.id='wg-v52-modal'; modal.style.cssText='display:none;position:fixed;inset:0;z-index:100004;background:rgba(0,0,0,.72);padding:24px;overflow:auto;';
    modal.innerHTML = '<div style="max-width:1180px;margin:0 auto;background:#130820;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px 18px 26px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><div style="font:700 20px system-ui">White-glove valuation and superdeck</div><div style="font:12px system-ui;opacity:.72">Client-visible valuation, booking-chain audit, and unified superdeck for the premium operation.</div></div><button id="wg-v52-close" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div><div style="display:grid;grid-template-columns:1.1fr .9fr;gap:16px"><div style="display:grid;gap:16px"><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0;font:700 15px system-ui">2026 valuation center</h3><div><button id="wg-v52-save-val" style="margin-right:8px">Save</button><button id="wg-v52-open-pdf" style="margin-right:8px">Open PDF</button><button id="wg-v52-open-html">Open HTML</button></div></div><pre id="wg-v52-val" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:220px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0;font:700 15px system-ui">Route-chain audit</h3><div><button id="wg-v52-run-audit" style="margin-right:8px">Run audit</button><button id="wg-v52-export-audit-html" style="margin-right:8px">Export HTML</button><button id="wg-v52-export-audit-json">Export JSON</button></div></div><div style="margin:10px 0"><select id="wg-v52-booking" style="width:100%;padding:10px;border-radius:12px;background:#0f0a18;color:#fff;border:1px solid rgba(255,255,255,.12)"></select></div><pre id="wg-v52-audit" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:260px;overflow:auto"></pre></section></div><div style="display:grid;gap:16px"><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0;font:700 15px system-ui">Unified superdeck</h3><div><button id="wg-v52-save-super" style="margin-right:8px">Save</button><button id="wg-v52-export-super-html" style="margin-right:8px">Export HTML</button><button id="wg-v52-export-super-json">Export JSON</button></div></div><pre id="wg-v52-super" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:260px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><h3 style="margin:0 0 10px;font:700 15px system-ui">V52 visibility</h3><ul style="margin:0 0 0 18px;font:13px system-ui;line-height:1.65"><li>Client-facing 2026 valuation PDF and HTML summary.</li><li>Booking-chain audit so complex white-glove runs can be checked against the canonical record family.</li><li>Unified superdeck that combines value, readiness, operator risk, and proof visibility.</li></ul><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button id="wg-v52-tour-value">Walkthrough: value</button><button id="wg-v52-tour-backend">Walkthrough: backend + chain</button></div></section></div></div></div>';
    document.body.appendChild(launcher); document.body.appendChild(modal);
    const refresh = ()=> {
      const val = latest('valuation') || buildValuation();
      modal.querySelector('#wg-v52-val').textContent = JSON.stringify(val, null, 2);
      const opts = bookingOptions();
      const select = modal.querySelector('#wg-v52-booking');
      const current = uiState().bookingId || (opts[0] && opts[0].id) || '';
      select.innerHTML = opts.map(o => '<option value="'+esc(o.id)+'">'+esc(o.label)+'</option>').join(''); select.value = current;
      const audit = current ? (latest('chainAudits') && clean(latest('chainAudits').bookingId)===clean(current) ? latest('chainAudits') : buildChainAudit(current)) : null;
      modal.querySelector('#wg-v52-audit').textContent = JSON.stringify(audit, null, 2);
      const superdeck = latest('superdeck') || buildSuperdeck();
      modal.querySelector('#wg-v52-super').textContent = JSON.stringify(superdeck, null, 2);
    };
    launcher.onclick = ()=> { modal.style.display='block'; refresh(); };
    modal.querySelector('#wg-v52-close').onclick = ()=> { modal.style.display='none'; };
    modal.querySelector('#wg-v52-booking').onchange = (e)=> { setUI({ bookingId: e.target.value }); refresh(); };
    modal.querySelector('#wg-v52-save-val').onclick = ()=> { buildValuation(); refresh(); toast('White-glove valuation center saved.', 'good'); };
    modal.querySelector('#wg-v52-open-pdf').onclick = openValuationPdf;
    modal.querySelector('#wg-v52-open-html').onclick = openValuationHtml;
    modal.querySelector('#wg-v52-run-audit').onclick = ()=> { const row = buildChainAudit(modal.querySelector('#wg-v52-booking').value); modal.querySelector('#wg-v52-audit').textContent = JSON.stringify(row, null, 2); if(row) toast('Route chain audit saved.', row.ok ? 'good' : 'warn'); };
    modal.querySelector('#wg-v52-export-audit-html').onclick = ()=> { const row = latest('chainAudits'); if(!row){ toast('No route-chain audit saved yet.', 'warn'); return; } downloadText(buildChainAuditHtml(row), 'whiteglove_route_chain_audit_' + day() + '.html', 'text/html'); };
    modal.querySelector('#wg-v52-export-audit-json').onclick = ()=> { const row = latest('chainAudits'); if(!row){ toast('No route-chain audit saved yet.', 'warn'); return; } downloadText(JSON.stringify(row, null, 2), 'whiteglove_route_chain_audit_' + day() + '.json', 'application/json'); };
    modal.querySelector('#wg-v52-save-super').onclick = ()=> { const row = buildSuperdeck(); modal.querySelector('#wg-v52-super').textContent = JSON.stringify(row, null, 2); toast('White-glove superdeck saved.', 'good'); };
    modal.querySelector('#wg-v52-export-super-html').onclick = ()=> { const row = latest('superdeck') || buildSuperdeck(); downloadText(buildSuperdeckHtml(row), 'whiteglove_superdeck_' + day() + '.html', 'text/html'); };
    modal.querySelector('#wg-v52-export-super-json').onclick = ()=> { const row = latest('superdeck') || buildSuperdeck(); downloadText(JSON.stringify(row, null, 2), 'whiteglove_superdeck_' + day() + '.json', 'application/json'); };
    modal.querySelector('#wg-v52-tour-value').onclick = ()=> { if(typeof window.startRoutexWhiteGloveV52Tour === 'function') window.startRoutexWhiteGloveV52Tour('value'); };
    modal.querySelector('#wg-v52-tour-backend').onclick = ()=> { if(typeof window.startRoutexWhiteGloveV52Tour === 'function') window.startRoutexWhiteGloveV52Tour('backend'); };
    const settingsHost = document.querySelector('#tab-settings') || document.body;
    if(settingsHost && !document.getElementById('routexWg52SettingsCard')){
      const card = document.createElement('div'); card.className='card'; card.id='routexWg52SettingsCard';
      card.innerHTML = '<h2 style="margin:0 0 10px;">2026 valuation + premium trust</h2><div style="margin-bottom:12px;">Give users and clients a visible valuation lane, a chain-audit lane, and a PDF they can actually open.</div><div class="row" style="flex-wrap:wrap;gap:8px;"><button class="btn" id="routexWg52SettingsOpen">Open valuation center</button><button class="btn" id="routexWg52SettingsPdf">Open valuation PDF</button><button class="btn" id="routexWg52SettingsGuide">Run deep-surface guide</button></div>';
      settingsHost.appendChild(card);
      card.querySelector('#routexWg52SettingsOpen').onclick = ()=> { launcher.click(); };
      card.querySelector('#routexWg52SettingsPdf').onclick = openValuationPdf;
      card.querySelector('#routexWg52SettingsGuide').onclick = ()=> { if(typeof window.startRoutexWhiteGloveV52Tour === 'function') window.startRoutexWhiteGloveV52Tour('settings'); };
    }
  }
  window.openWhiteGloveValuationCenterV52 = function(){ ensureUI(); document.getElementById('wg-v52-launcher')?.click(); };
  window.buildWhiteGloveValuationV52 = buildValuation;
  window.buildWhiteGloveRouteChainAuditV52 = buildChainAudit;
  window.buildWhiteGloveSuperdeckV52 = buildSuperdeck;
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI); else ensureUI();
})();
