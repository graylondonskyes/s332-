/* V53 Routex cross-record collision hardening + operator surface bundle + edge reporting */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V53__) return;
  window.__ROUTEX_WHITEGLOVE_V53__ = true;
  const KEYS = {
    profiles:'skye_whiteglove_service_profiles_v39', bookings:'skye_whiteglove_bookings_v39', memberships:'skye_whiteglove_memberships_v39',
    drivers:'skye_whiteglove_driver_profiles_v39', vehicles:'skye_whiteglove_vehicle_profiles_v39', docs:'skye_whiteglove_docs_v39',
    execution:'skye_whiteglove_execution_rows_v41', payouts:'skye_whiteglove_payout_ledger_v41', adjustments:'skye_whiteglove_adjustments_v48',
    proof:'skye_whiteglove_proof_packs_v44', acceptance:'skye_whiteglove_acceptance_runs_v45', conflicts:'skye_whiteglove_conflict_snapshots_v46',
    valuation:'skye_whiteglove_valuation_center_v52', chainAudits:'skye_whiteglove_route_chain_audits_v52', superdeck:'skye_whiteglove_superdeck_v52',
    collisionAudits:'skye_whiteglove_collision_audits_v53', collisionOutbox:'skye_whiteglove_collision_outbox_v53',
    surfaceBundles:'skye_whiteglove_surface_bundles_v53', surfaceBundleOutbox:'skye_whiteglove_surface_bundle_outbox_v53',
    edgeReports:'skye_whiteglove_materialization_edge_reports_v53', edgeOutbox:'skye_whiteglove_materialization_edge_outbox_v53',
    ui:'skye_whiteglove_v53_ui'
  };
  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const iso = ()=> new Date().toISOString();
  const day = ()=> iso().slice(0,10);
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36);
  const toast = window.toast || function(msg){ try{ console.log(msg); }catch(_){} };
  const downloadText = window.downloadText || function(content, filename, type){ const blob = new Blob([content], { type: type || 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(url), 1200); };
  const readJSON = (k,f)=> { try{ const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; }catch(_){ return f; } };
  const writeJSON = (k,v)=> { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} return v; };
  const rows = (key)=> readJSON(KEYS[key], []);
  const saveRows = (key, value)=> writeJSON(KEYS[key], Array.isArray(value) ? value : []);
  const latest = (key)=> rows(key)[0] || null;
  const pushRow = (key,row,limit)=> { const list = rows(key); list.unshift(row); saveRows(key, list.slice(0, limit || 240)); return row; };
  const getById = (key,id)=> rows(key).find(row => clean(row && row.id) === clean(id)) || null;
  const uiState = ()=> readJSON(KEYS.ui, { bookingId:'' });
  const setUI = (patch)=> writeJSON(KEYS.ui, Object.assign({}, uiState(), patch || {}));
  const money = (n)=> '$' + Number(n || 0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  const bookingOptions = ()=> rows('bookings').map(row => ({ id:row.id, label:[row.serviceProfileName || row.clientName || row.id, row.serviceType || 'ride', row.dispatchStatus || row.status || 'pending'].join(' • ') }));

  function mapDuplicates(items, keyFn, label){
    const map = new Map();
    (items || []).forEach(item => {
      const key = clean(keyFn(item));
      if(!key) return;
      if(!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return Array.from(map.entries()).filter(([, list]) => list.length > 1).map(([key, list]) => ({ label, key, count:list.length, ids:list.map(row => row.id) }));
  }

  function buildCollisionAudit(){
    const profiles = rows('profiles');
    const bookings = rows('bookings');
    const memberships = rows('memberships');
    const drivers = rows('drivers');
    const vehicles = rows('vehicles');
    const docs = rows('docs');
    const execution = rows('execution');
    const payouts = rows('payouts');
    const adjustments = rows('adjustments');
    const findings = [];
    const blockers = [];
    const duplicateGroups = [];

    duplicateGroups.push(...mapDuplicates(profiles, row => [row.profileType, row.displayName || row.name, row.primaryPhone || row.phone, row.email].join('|').toLowerCase(), 'service_profile_identity'));
    duplicateGroups.push(...mapDuplicates(drivers, row => [row.displayName || row.name, row.activeMarket || row.market, row.vehicleClass || row.vehicleClassPermission].join('|').toLowerCase(), 'driver_identity'));
    duplicateGroups.push(...mapDuplicates(bookings, row => [row.serviceProfileId, row.pickupAddress, row.dropoffAddress, row.etaWindow, row.serviceType].join('|').toLowerCase(), 'booking_chain'));
    duplicateGroups.forEach(group => findings.push({ type:'duplicate_group', severity: group.count > 2 ? 'high' : 'medium', detail: group }));

    bookings.forEach(booking => {
      const profile = getById('profiles', booking.serviceProfileId);
      if(!profile) findings.push({ type:'orphan_booking_profile', severity:'high', bookingId:booking.id, profileId:booking.serviceProfileId });
      if(clean(booking.membershipId) && !getById('memberships', booking.membershipId)) findings.push({ type:'orphan_booking_membership', severity:'high', bookingId:booking.id, membershipId:booking.membershipId });
      if(clean(booking.assignedDriverId) && !getById('drivers', booking.assignedDriverId)) findings.push({ type:'orphan_booking_driver', severity:'medium', bookingId:booking.id, driverId:booking.assignedDriverId });
      if(clean(booking.assignedVehicleId) && !getById('vehicles', booking.assignedVehicleId)) findings.push({ type:'orphan_booking_vehicle', severity:'medium', bookingId:booking.id, vehicleId:booking.assignedVehicleId });
      const docCount = docs.filter(row => clean(row.bookingId) === clean(booking.id)).length;
      const execCount = execution.filter(row => clean(row.bookingId) === clean(booking.id)).length;
      const payoutCount = payouts.filter(row => clean(row.bookingId) === clean(booking.id)).length;
      if((booking.dispatchStatus || booking.status) === 'completed' && execCount === 0) findings.push({ type:'completed_without_execution', severity:'high', bookingId:booking.id });
      if((booking.dispatchStatus || booking.status) === 'completed' && payoutCount === 0) findings.push({ type:'completed_without_payout', severity:'medium', bookingId:booking.id });
      if(docCount === 0 && execCount > 0) findings.push({ type:'execution_without_docs', severity:'low', bookingId:booking.id });
    });

    memberships.forEach(membership => {
      const profile = getById('profiles', membership.serviceProfileId || membership.profileId);
      if(!profile) findings.push({ type:'orphan_membership_profile', severity:'high', membershipId:membership.id, profileId:membership.serviceProfileId || membership.profileId });
    });
    docs.forEach(doc => {
      if(clean(doc.bookingId) && !getById('bookings', doc.bookingId)) findings.push({ type:'orphan_doc_booking', severity:'medium', docId:doc.id, bookingId:doc.bookingId });
    });
    execution.forEach(row => {
      if(clean(row.bookingId) && !getById('bookings', row.bookingId)) findings.push({ type:'orphan_execution_booking', severity:'medium', executionId:row.id, bookingId:row.bookingId });
    });
    payouts.forEach(row => {
      if(clean(row.bookingId) && !getById('bookings', row.bookingId)) findings.push({ type:'orphan_payout_booking', severity:'medium', payoutId:row.id, bookingId:row.bookingId });
    });
    adjustments.forEach(row => {
      if(clean(row.bookingId) && !getById('bookings', row.bookingId)) findings.push({ type:'orphan_adjustment_booking', severity:'medium', adjustmentId:row.id, bookingId:row.bookingId });
    });

    findings.forEach(f => { if(f.severity === 'high') blockers.push(f.type + ':' + (f.bookingId || f.membershipId || f.docId || f.executionId || f.payoutId || f.adjustmentId || (f.detail && f.detail.key) || 'row')); });
    const severityCounts = findings.reduce((acc,row)=> { acc[row.severity] = (acc[row.severity] || 0) + 1; return acc; }, { high:0, medium:0, low:0 });
    const score = Math.max(0, 100 - (severityCounts.high * 12) - (severityCounts.medium * 5) - (severityCounts.low * 2));
    const row = {
      id: uid('wg_collision53'), createdAt: iso(), asOfDate: day(), fingerprint:'WG-COLLISION-' + day().replace(/-/g,''), score,
      ok: severityCounts.high === 0, blockers, severityCounts, findingCount: findings.length, duplicateGroupCount: duplicateGroups.length,
      findings: findings.slice(0, 400), summary:{ profiles:profiles.length, bookings:bookings.length, memberships:memberships.length, drivers:drivers.length, vehicles:vehicles.length, docs:docs.length, execution:execution.length, payouts:payouts.length, adjustments:adjustments.length }
    };
    pushRow('collisionAudits', row, 120);
    pushRow('collisionOutbox', { id:uid('wg_collision_out53'), createdAt:iso(), collisionAuditId:row.id }, 240);
    return row;
  }

  function buildMaterializationEdgeReport(bookingId){
    const booking = getById('bookings', bookingId);
    if(!booking) return null;
    const blockers = [];
    const notes = [];
    const detailed = Array.isArray(booking.routeStopSequenceDetailed) ? booking.routeStopSequenceDetailed : [];
    const stopCount = Number(booking.routeStopCount || 0);
    const legCount = Number(booking.routeLegCount || 0);
    const multiStopCount = clean(booking.multiStopText).split(/\n+|\s*->\s*|\s*>\s*|\s*\|\s*/).filter(Boolean).length;
    if(clean(booking.multiStopText) && stopCount === 0) blockers.push('Multi-stop text exists but routeStopCount is 0.');
    if(booking.returnLeg && !booking.routeReturnLegBuilt) blockers.push('Return-leg requested without a built return-leg route.');
    if((booking.standbyMinutesPlanned || 0) > 0 && !detailed.some(row => /standby/i.test(clean(row.kind || row.label)))) blockers.push('Standby minutes planned but no standby hold leg exists.');
    if(booking.airportMeetGreet && !clean(booking.flightCode || booking.flightNumber)) notes.push('Airport meet/greet exists without a stored flight code.');
    if(legCount < Math.max(1, multiStopCount + 1)) notes.push('Leg count is lighter than expected for the current stop chain.');
    if(clean(booking.pickupAddress) === clean(booking.dropoffAddress) && !booking.returnLeg && multiStopCount === 0) notes.push('Pickup and dropoff are identical; operator should confirm this is intentional.');
    const score = Math.max(0, 100 - (blockers.length * 18) - (notes.length * 6));
    const row = { id:uid('wg_edge53'), createdAt:iso(), bookingId:booking.id, fingerprint:'WG-EDGE-' + clean(booking.id).slice(-6), score, ok:blockers.length===0, blockers, notes, snapshot:{ routeLegCount:legCount, routeStopCount:stopCount, multiStopCount, returnLeg:!!booking.returnLeg, standbyMinutesPlanned:Number(booking.standbyMinutesPlanned || 0), airportMeetGreet:!!booking.airportMeetGreet, routeMaterialized:!!booking.routeMaterialized } };
    pushRow('edgeReports', row, 240);
    pushRow('edgeOutbox', { id:uid('wg_edge_out53'), createdAt:iso(), edgeReportId:row.id }, 240);
    return row;
  }

  function buildSurfaceBundle(){
    const valuation = latest('valuation');
    const superdeck = latest('superdeck');
    const chainAudit = latest('chainAudits');
    const collision = latest('collisionAudits');
    const proof = latest('proof');
    const acceptance = latest('acceptance');
    const conflict = latest('conflicts');
    const blockers = [];
    if(collision && !collision.ok) blockers.push('Collision audit has hard blockers.');
    if(chainAudit && !chainAudit.ok) blockers.push('Latest route-chain audit failed.');
    if(conflict && clean(conflict.severity) === 'high') blockers.push('Latest conflict snapshot is high severity.');
    if(acceptance && acceptance.scenarioFailures > 0) blockers.push('Acceptance harness still has failing scenarios.');
    const bundle = {
      id:uid('wg_surface53'), createdAt:iso(), fingerprint:'WG-SURFACE-' + day().replace(/-/g,''), blockers,
      valuationAmountUsd: valuation ? valuation.amountUsd : 0,
      chainScore: chainAudit ? chainAudit.score : 0,
      collisionScore: collision ? collision.score : 0,
      conflictSeverity: conflict ? clean(conflict.severity || 'low') : 'none',
      acceptanceOk: acceptance ? !!acceptance.ok : false,
      proofFingerprint: proof ? proof.fingerprint || proof.id : '',
      superdeckFingerprint: superdeck ? superdeck.fingerprint || superdeck.id : '',
      notes:[
        valuation ? ('Valuation layer visible at ' + money(valuation.amountUsd || 0) + '.') : 'No valuation row yet.',
        chainAudit ? ('Latest chain score ' + chainAudit.score + '%.') : 'No chain audit saved yet.',
        collision ? ('Latest collision score ' + collision.score + '%.') : 'No collision audit saved yet.'
      ]
    };
    pushRow('surfaceBundles', bundle, 120);
    pushRow('surfaceBundleOutbox', { id:uid('wg_surface_out53'), createdAt:iso(), surfaceBundleId:bundle.id }, 240);
    return bundle;
  }

  function renderJsonCard(container, row){ container.textContent = row ? JSON.stringify(row, null, 2) : 'Nothing saved yet.'; }
  function htmlWrap(title, row){ return '<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1080px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;white-space:pre-wrap}</style></head><body><div class="wrap"><div class="card"><h1>'+esc(title)+'</h1><pre>'+esc(JSON.stringify(row || {}, null, 2))+'</pre></div></div></body></html>'; }

  function ensureUI(){
    if(document.getElementById('wg-v53-launcher')) return;
    const launcher = document.createElement('button');
    launcher.id = 'wg-v53-launcher';
    launcher.textContent = 'WG Hardening+';
    launcher.style.cssText = 'position:fixed;right:18px;bottom:72px;z-index:100007;border:1px solid rgba(255,255,255,.18);background:#0b1f40;color:#fff;padding:10px 14px;border-radius:999px;font:700 12px system-ui;box-shadow:0 12px 28px rgba(0,0,0,.35);cursor:pointer;';
    const modal = document.createElement('div');
    modal.id = 'wg-v53-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:100008;background:rgba(0,0,0,.72);padding:24px;overflow:auto;';
    modal.innerHTML = '<div style="max-width:1220px;margin:0 auto;background:#08111e;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px 18px 26px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><div style="font:700 20px system-ui">White-glove hardening center</div><div style="font:12px system-ui;opacity:.72">Cross-record collision audit, route-materialization edge reporting, and operator surface bundle.</div></div><button id="wg-v53-close" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">'
      + '<section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Collision audit</h3><div><button id="wg-v53-run-collision" style="margin-right:8px">Run</button><button id="wg-v53-export-collision-html" style="margin-right:8px">Export HTML</button><button id="wg-v53-export-collision-json">Export JSON</button></div></div><pre id="wg-v53-collision" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:260px;overflow:auto"></pre></section>'
      + '<section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Route materialization edge report</h3><div><select id="wg-v53-booking" style="margin-right:8px;max-width:260px"></select><button id="wg-v53-run-edge" style="margin-right:8px">Run</button><button id="wg-v53-export-edge-json">Export JSON</button></div></div><pre id="wg-v53-edge" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:260px;overflow:auto"></pre></section>'
      + '<section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Operator surface bundle</h3><div><button id="wg-v53-run-surface" style="margin-right:8px">Build</button><button id="wg-v53-export-surface-html" style="margin-right:8px">Export HTML</button><button id="wg-v53-export-surface-json">Export JSON</button></div></div><pre id="wg-v53-surface" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:260px;overflow:auto"></pre></section>'
      + '<section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><h3 style="margin:0 0 10px">Hardening mission</h3><div style="font:13px system-ui;line-height:1.6;opacity:.86">This pass targets the ugly edge cases: duplicate identity collisions, orphaned record chains, route materialization blind spots, and one stored bundle that exposes the newest value/proof/backend surfaces together.</div><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button id="wg-v53-run-guide">Run hardening guide</button><button id="wg-v53-open-value-pdf">Open valuation PDF</button></div></section>'
      + '</div></div>';
    document.body.appendChild(launcher);
    document.body.appendChild(modal);
    const collisionPre = modal.querySelector('#wg-v53-collision');
    const edgePre = modal.querySelector('#wg-v53-edge');
    const surfacePre = modal.querySelector('#wg-v53-surface');
    const bookingSelect = modal.querySelector('#wg-v53-booking');
    function refreshOptions(){
      const state = uiState();
      const opts = bookingOptions();
      bookingSelect.innerHTML = '<option value="">Select booking…</option>' + opts.map(opt => '<option value="'+esc(opt.id)+'">'+esc(opt.label)+'</option>').join('');
      bookingSelect.value = clean(state.bookingId);
    }
    function refresh(){ renderJsonCard(collisionPre, latest('collisionAudits')); renderJsonCard(edgePre, latest('edgeReports')); renderJsonCard(surfacePre, latest('surfaceBundles')); refreshOptions(); }
    launcher.onclick = ()=> { modal.style.display='block'; refresh(); };
    modal.querySelector('#wg-v53-close').onclick = ()=> { modal.style.display='none'; };
    bookingSelect.onchange = ()=> setUI({ bookingId: bookingSelect.value });
    modal.querySelector('#wg-v53-run-collision').onclick = ()=> { const row = buildCollisionAudit(); renderJsonCard(collisionPre, row); toast(row.ok ? 'White-glove collision audit saved.' : 'White-glove collision audit saved with blockers.', row.ok ? 'good' : 'warn'); };
    modal.querySelector('#wg-v53-run-edge').onclick = ()=> { const id = clean(bookingSelect.value || uiState().bookingId); if(!id){ toast('Choose a booking first.','warn'); return; } const row = buildMaterializationEdgeReport(id); renderJsonCard(edgePre, row); toast(row && row.ok ? 'Materialization edge report saved.' : 'Materialization edge report saved with blockers.', row && row.ok ? 'good' : 'warn'); };
    modal.querySelector('#wg-v53-run-surface').onclick = ()=> { const row = buildSurfaceBundle(); renderJsonCard(surfacePre, row); toast(row.blockers.length ? 'Operator surface bundle saved with blockers.' : 'Operator surface bundle saved.', row.blockers.length ? 'warn' : 'good'); };
    modal.querySelector('#wg-v53-export-collision-html').onclick = ()=> downloadText(htmlWrap('White-glove collision audit', latest('collisionAudits')), 'whiteglove_collision_audit_v53.html', 'text/html');
    modal.querySelector('#wg-v53-export-collision-json').onclick = ()=> downloadText(JSON.stringify(latest('collisionAudits') || {}, null, 2), 'whiteglove_collision_audit_v53.json', 'application/json');
    modal.querySelector('#wg-v53-export-edge-json').onclick = ()=> downloadText(JSON.stringify(latest('edgeReports') || {}, null, 2), 'whiteglove_materialization_edge_report_v53.json', 'application/json');
    modal.querySelector('#wg-v53-export-surface-html').onclick = ()=> downloadText(htmlWrap('White-glove operator surface bundle', latest('surfaceBundles')), 'whiteglove_operator_surface_bundle_v53.html', 'text/html');
    modal.querySelector('#wg-v53-export-surface-json').onclick = ()=> downloadText(JSON.stringify(latest('surfaceBundles') || {}, null, 2), 'whiteglove_operator_surface_bundle_v53.json', 'application/json');
    modal.querySelector('#wg-v53-run-guide').onclick = ()=> { if(typeof window.startWhiteGloveV53Tour === 'function') window.startWhiteGloveV53Tour(); else toast('V53 guide unavailable.','warn'); };
    modal.querySelector('#wg-v53-open-value-pdf').onclick = ()=> { try{ window.open('../WHITE_GLOVE_V52/SkyeRoutexFlow_2026_Valuation_Report_v52.pdf','_blank'); }catch(_){ } };
  }
  window.saveWhiteGloveCollisionAuditV53 = buildCollisionAudit;
  window.saveWhiteGloveMaterializationEdgeReportV53 = buildMaterializationEdgeReport;
  window.saveWhiteGloveOperatorSurfaceBundleV53 = buildSurfaceBundle;
  window.openWhiteGloveHardeningCenterV53 = function(){ ensureUI(); document.getElementById('wg-v53-launcher')?.click(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureUI); else ensureUI();
})();
