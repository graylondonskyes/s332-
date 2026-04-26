
/* V56 Routex conservative duplicate-booking guardrails + saturation spread */
(function(){
  if(window.__ROUTEX_WHITEGLOVE_V56__) return;
  window.__ROUTEX_WHITEGLOVE_V56__ = true;
  const KEYS = {
    bookings:'skye_whiteglove_bookings_v39',
    reviewRows:'skye_whiteglove_duplicate_review_rows_v55',
    guardRows:'skye_whiteglove_guardrail_rows_v56',
    guardOutbox:'skye_whiteglove_guardrail_outbox_v56',
    spreadRows:'skye_whiteglove_spread_rows_v56',
    spreadOutbox:'skye_whiteglove_spread_outbox_v56',
    ui:'skye_whiteglove_v56_ui'
  };
  const clean = (v)=> String(v == null ? '' : v).trim();
  const esc = (v)=> String(v == null ? '' : v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const iso = ()=> new Date().toISOString();
  const day = ()=> iso().slice(0,10);
  const uid = (p)=> (p || 'id') + '_' + Math.random().toString(36).slice(2,9) + '_' + Date.now().toString(36);
  const toast = window.toast || function(msg){ try{ console.log(msg); }catch(_){} };
  const readJSON = (k, f)=> { try{ const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; }catch(_){ return f; } };
  const writeJSON = (k, v)=> { try{ localStorage.setItem(k, JSON.stringify(v)); }catch(_){} return v; };
  const rows = (key)=> readJSON(KEYS[key], []);
  const saveRows = (key, list)=> writeJSON(KEYS[key], Array.isArray(list) ? list : []);
  const latest = (key)=> rows(key)[0] || null;
  const pushRow = (key, row, limit)=> { const list = rows(key); list.unshift(row); saveRows(key, list.slice(0, limit || 300)); return row; };
  const uiState = ()=> readJSON(KEYS.ui, { outcome:'cancel_duplicates' });
  const setUI = (patch)=> writeJSON(KEYS.ui, Object.assign({}, uiState(), patch || {}));
  const downloadText = window.downloadText || function(content, filename, type){ const blob = new Blob([content], { type: type || 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename || 'download.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=> URL.revokeObjectURL(url), 1200); };
  const htmlWrap = (title, row)=> '<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}.wrap{max-width:1120px;margin:0 auto}.card{border:1px solid #ddd;border-radius:18px;padding:16px;white-space:pre-wrap}</style></head><body><div class="wrap"><div class="card"><h1>'+esc(title)+'</h1><pre>'+esc(JSON.stringify(row || {}, null, 2))+'</pre></div></div></body></html>';
  function getBookings(){ return rows('bookings'); }
  function saveBookings(list){ return saveRows('bookings', list); }
  function variance(values){ const list = (values || []).filter(v => Number.isFinite(Number(v))).map(Number); if(!list.length) return 0; return Math.max.apply(null, list) - Math.min.apply(null, list); }
  function groupPotentialDuplicateBookings(){
    const existing = (rows('reviewRows')[0] && rows('reviewRows')[0].groups) || [];
    if(existing.length) return existing;
    const map = new Map();
    getBookings().forEach(row => {
      const key = [clean(row.serviceProfileId), clean(row.pickupAddress), clean(row.dropoffAddress), clean(row.serviceType), clean(row.etaWindow).slice(0,16)].join('|').toLowerCase();
      if(!key || key === '||||') return;
      if(!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    const groups = [];
    map.forEach((list, key) => {
      if(list.length < 2) return;
      const statuses = Array.from(new Set(list.map(row => clean(row.dispatchStatus || row.status).toLowerCase()).filter(Boolean)));
      const primary = list.slice().sort((a,b)=> clean(b.updatedAt || b.createdAt || '') > clean(a.updatedAt || a.createdAt || '') ? 1 : -1)[0];
      groups.push({ key, candidateCount:list.length, candidateBookingIds:list.map(row => row.id), candidateStatuses:statuses, activeCount:list.filter(row => ['confirmed','assigned','en_route','arrived','rider_boarded','in_service'].includes(clean(row.dispatchStatus || row.status).toLowerCase())).length, recommendedPrimaryBookingId:primary ? primary.id : '', recommendedOutcome: statuses.length > 1 ? 'operator_review' : 'cancel_duplicates' });
    });
    return groups;
  }
  function buildGuardrailPack(){
    const bookings = getBookings();
    const groups = groupPotentialDuplicateBookings().map(group => {
      const candidates = bookings.filter(row => (group.candidateBookingIds || []).map(clean).includes(clean(row.id)));
      const reasons = [];
      const statuses = Array.from(new Set(candidates.map(row => clean(row.dispatchStatus || row.status).toLowerCase()).filter(Boolean)));
      const sources = Array.from(new Set(candidates.map(row => clean(row.requestSource || row.source).toLowerCase()).filter(Boolean)));
      const drivers = Array.from(new Set(candidates.map(row => clean(row.assignedDriverId)).filter(Boolean)));
      const vehicles = Array.from(new Set(candidates.map(row => clean(row.assignedVehicleId)).filter(Boolean)));
      const memberships = Array.from(new Set(candidates.map(row => clean(row.membershipId)).filter(Boolean)));
      const totals = candidates.map(row => Number(row.pricingSnapshot && row.pricingSnapshot.quotedTotal));
      if((group.activeCount || 0) > 1) reasons.push('multiple_active_candidates');
      if(statuses.length > 1) reasons.push('mixed_status_state');
      if(sources.length > 1) reasons.push('mixed_request_source');
      if(drivers.length > 1) reasons.push('multi_driver_assignment');
      if(vehicles.length > 1) reasons.push('multi_vehicle_assignment');
      if(memberships.length > 1) reasons.push('mixed_membership_link');
      if(variance(totals) > 0.01) reasons.push('quoted_total_variance');
      const reviewOnly = reasons.length > 0;
      return Object.assign({}, group, { lockReasons: reasons, resolutionMode: reviewOnly ? 'review_only' : 'auto_eligible', candidateDrivers: drivers, candidateVehicles: vehicles, candidateSources: sources, quotedTotalVariance: variance(totals) });
    });
    const row = {
      id: uid('wg_guard56'),
      createdAt: iso(),
      asOfDate: day(),
      fingerprint: 'WG-GUARD-' + day().replace(/-/g,''),
      reviewOnlyCount: groups.filter(g => g.resolutionMode === 'review_only').length,
      autoEligibleCount: groups.filter(g => g.resolutionMode === 'auto_eligible').length,
      blockerCount: groups.filter(g => g.lockReasons && g.lockReasons.length).length,
      ok: groups.every(g => g.resolutionMode !== 'auto_eligible' || (g.candidateCount || 0) >= 2),
      groups
    };
    pushRow('guardRows', row, 180);
    pushRow('guardOutbox', { id: uid('wg_guard_out56'), createdAt: iso(), guardrailId: row.id }, 240);
    return row;
  }
  function applyGuardrailPlan(outcome){
    const pack = latest('guardRows') || buildGuardrailPack();
    const bookings = getBookings().slice();
    const applied = [];
    (pack.groups || []).forEach(group => {
      const ids = (group.candidateBookingIds || []).map(clean).filter(Boolean);
      const primary = clean(group.recommendedPrimaryBookingId || ids[0]);
      if(group.resolutionMode === 'review_only'){
        bookings.forEach(row => {
          if(ids.includes(clean(row.id))){
            row.duplicateGuardrailState = 'review_only';
            row.duplicateGuardrailReasons = group.lockReasons || [];
            row.duplicateGuardrailAt = iso();
          }
        });
        applied.push({ groupKey: group.key, outcome:'review_only', bookingIds: ids, reasons: group.lockReasons || [] });
        return;
      }
      if(clean(outcome).toLowerCase() === 'cancel_duplicates'){
        bookings.forEach(row => {
          const id = clean(row.id);
          if(!ids.includes(id)) return;
          row.duplicateGuardrailAt = iso();
          row.duplicateGuardrailState = id === primary ? 'safe_primary' : 'safe_cancel_duplicate';
          if(id !== primary){ row.dispatchStatus = 'cancelled_duplicate'; row.status = 'cancelled_duplicate'; row.linkedCanonicalBookingId = primary; }
        });
        applied.push({ groupKey: group.key, outcome:'cancel_duplicates', primaryBookingId: primary, bookingIds: ids });
      } else {
        bookings.forEach(row => { if(ids.includes(clean(row.id))){ row.duplicateGuardrailAt = iso(); row.duplicateGuardrailState = 'safe_mark_distinct'; } });
        applied.push({ groupKey: group.key, outcome:'mark_distinct', bookingIds: ids });
      }
    });
    saveBookings(bookings);
    const result = { id: uid('wg_guard_apply56'), createdAt: iso(), guardrailId: pack.id, outcome: clean(outcome || 'cancel_duplicates').toLowerCase(), applied };
    pushRow('guardOutbox', { id: uid('wg_guard_apply_out56'), createdAt: iso(), resultId: result.id, guardrailId: pack.id, outcome: result.outcome }, 240);
    pushRow('guardRows', Object.assign({}, pack, { appliedAt: iso(), appliedResult: result }), 180);
    return result;
  }
  function injectButton(target, id, label, handler){
    if(!target || document.getElementById(id)) return false;
    const btn = document.createElement('button');
    btn.id = id; btn.type = 'button'; btn.textContent = label;
    btn.style.cssText = 'border:1px solid rgba(255,255,255,.14);background:#334b12;color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer;font:600 12px system-ui;';
    btn.addEventListener('click', handler); target.appendChild(btn); return true;
  }
  function buildSaturationPlus(){
    const placements = [];
    const hooks = [
      { key:'header', selectors:['header .actions','.topbar .actions','.toolbar .actions','header','.topbar','.toolbar'] },
      { key:'settings', selectors:['#settings .actions','#settings','.settings-panel','.settings-card'] },
      { key:'academy', selectors:['#academy','.academy-panel','.academy-card'] },
      { key:'dashboard', selectors:['#dashboard .actions','#dashboard','.dashboard-grid','.dashboard-card'] },
      { key:'booking', selectors:['#bookingInbox','.booking-panel','.booking-card'] },
      { key:'dispatch', selectors:['#dispatchBoard','.dispatch-panel','.dispatch-card'] },
      { key:'service', selectors:['#serviceCenter','.service-panel','.service-card'] },
      { key:'finance', selectors:['#financeBoard','.finance-panel','.finance-card'] },
      { key:'valuation', selectors:['#valuationCenter','.valuation-panel','.valuation-card'] },
      { key:'backend', selectors:['#backendCommand','.backend-panel','.backend-card'] },
      { key:'proof', selectors:['#proofCenter','.proof-panel','.proof-card'] },
      { key:'continuity', selectors:['#continuityCenter','.continuity-panel','.continuity-card'] },
      { key:'analytics', selectors:['#analyticsBoard','.analytics-panel','.analytics-card'] }
    ];
    hooks.forEach(hook => {
      let placed = false;
      for(const selector of hook.selectors){
        const target = document.querySelector(selector);
        if(!target) continue;
        const ok = injectButton(target, 'wg-v56-sat-' + hook.key, 'WG Final+', ()=> window.openWhiteGloveV56Center && window.openWhiteGloveV56Center());
        if(ok){ placements.push({ hook:hook.key, selector, state:'injected' }); placed = true; break; }
      }
      if(!placed) placements.push({ hook:hook.key, selector:'missing', state:'missing_target' });
    });
    const row = { id: uid('wg_sat56'), createdAt: iso(), asOfDate: day(), fingerprint: 'WG-SAT-' + day().replace(/-/g,''), injectedCount: placements.filter(p => p.state === 'injected').length, missingCount: placements.filter(p => p.state !== 'injected').length, ok: placements.filter(p => p.state === 'injected').length >= 4, placements };
    pushRow('spreadRows', row, 180);
    pushRow('spreadOutbox', { id: uid('wg_sat_out56'), createdAt: iso(), spreadId: row.id }, 240);
    return row;
  }
  function render(node, value){ node.textContent = value ? JSON.stringify(value, null, 2) : 'Nothing saved yet.'; }
  function ensureUI(){
    if(document.getElementById('wg-v56-launcher')) return;
    const launcher = document.createElement('button'); launcher.id = 'wg-v56-launcher'; launcher.textContent = 'WG Final Review+'; launcher.style.cssText = 'position:fixed;right:18px;bottom:124px;z-index:100013;border:1px solid rgba(255,255,255,.18);background:#4c2b10;color:#fff;padding:10px 14px;border-radius:999px;font:700 12px system-ui;box-shadow:0 12px 28px rgba(0,0,0,.35);cursor:pointer;';
    const modal = document.createElement('div'); modal.id = 'wg-v56-modal'; modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:100014;background:rgba(0,0,0,.74);padding:24px;overflow:auto;';
    modal.innerHTML = '<div style="max-width:1280px;margin:0 auto;background:#0a1420;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:18px 18px 26px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px"><div><div style="font:700 20px system-ui">White-glove final conservative hardening</div><div style="font:12px system-ui;opacity:.72">Review-only guardrails for ambiguous duplicate bookings plus broader entrypoint saturation for the newest operator surfaces.</div></div><button id="wg-v56-close" style="border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;padding:8px 12px;border-radius:12px;cursor:pointer">Close</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 style="margin:0">Conservative duplicate guardrails</h3><div><select id="wg-v56-outcome" style="margin-right:8px"><option value="cancel_duplicates">cancel_duplicates</option><option value="mark_distinct">mark_distinct</option></select><button id="wg-v56-build-guard" style="margin-right:8px">Build</button><button id="wg-v56-apply-guard" style="margin-right:8px">Apply safe plan</button><button id="wg-v56-export-guard">Export JSON</button></div></div><pre id="wg-v56-guard" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:320px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">Saturation spread+</h3><div><button id="wg-v56-build-sat" style="margin-right:8px">Build</button><button id="wg-v56-export-sat-html" style="margin-right:8px">Export HTML</button><button id="wg-v56-export-sat-json">Export JSON</button></div></div><pre id="wg-v56-sat" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:320px;overflow:auto"></pre></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><h3 style="margin:0 0 10px">Quick actions</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="wg-v56-run-guide">Run v56 guide</button><button id="wg-v56-open-v55">Open v55</button><button id="wg-v56-open-v54">Open v54</button></div><div style="margin-top:12px;font:13px system-ui;line-height:1.6;opacity:.86">This pass keeps ugly duplicate-booking groups review-only when the chain is too ambiguous, and pushes the newest operator surfaces into more entry points so the product is easier to reach and explain.</div></section><section style="border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:14px"><h3 style="margin:0 0 10px">Latest safe apply result</h3><pre id="wg-v56-result" style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:12px;border-radius:14px;max-height:220px;overflow:auto"></pre></section></div></div>';
    document.body.appendChild(launcher); document.body.appendChild(modal);
    const guardPre = modal.querySelector('#wg-v56-guard'); const satPre = modal.querySelector('#wg-v56-sat'); const resultPre = modal.querySelector('#wg-v56-result'); const outcomeSel = modal.querySelector('#wg-v56-outcome');
    const refresh = ()=> { const state = uiState(); outcomeSel.value = clean(state.outcome || 'cancel_duplicates'); render(guardPre, latest('guardRows')); render(satPre, latest('spreadRows')); const latestGuard = latest('guardRows'); render(resultPre, latestGuard && latestGuard.appliedResult ? latestGuard.appliedResult : null); };
    launcher.onclick = ()=> { modal.style.display='block'; refresh(); };
    modal.querySelector('#wg-v56-close').onclick = ()=> { modal.style.display='none'; };
    outcomeSel.onchange = ()=> setUI({ outcome: outcomeSel.value });
    modal.querySelector('#wg-v56-build-guard').onclick = ()=> { const row = buildGuardrailPack(); toast('White-glove guardrail pack saved.'); render(guardPre, row); };
    modal.querySelector('#wg-v56-apply-guard').onclick = ()=> { const result = applyGuardrailPlan(uiState().outcome || 'cancel_duplicates'); toast('White-glove safe plan applied.'); render(resultPre, result); render(guardPre, latest('guardRows')); };
    modal.querySelector('#wg-v56-export-guard').onclick = ()=> { const row = latest('guardRows'); if(!row) return toast('Build a guardrail pack first.'); downloadText(JSON.stringify(row,null,2), 'whiteglove-guardrails-v56.json', 'application/json'); };
    modal.querySelector('#wg-v56-build-sat').onclick = ()=> { const row = buildSaturationPlus(); toast('Saturation spread report saved.'); render(satPre, row); };
    modal.querySelector('#wg-v56-export-sat-html').onclick = ()=> { const row = latest('spreadRows'); if(!row) return toast('Build a saturation spread report first.'); downloadText(htmlWrap('White-glove saturation spread v56', row), 'whiteglove-saturation-spread-v56.html', 'text/html'); };
    modal.querySelector('#wg-v56-export-sat-json').onclick = ()=> { const row = latest('spreadRows'); if(!row) return toast('Build a saturation spread report first.'); downloadText(JSON.stringify(row,null,2), 'whiteglove-saturation-spread-v56.json', 'application/json'); };
    modal.querySelector('#wg-v56-run-guide').onclick = ()=> { if(window.startWhiteGloveTourV56) window.startWhiteGloveTourV56(); };
    modal.querySelector('#wg-v56-open-v55').onclick = ()=> { if(window.openWhiteGloveV55Center) window.openWhiteGloveV55Center(); };
    modal.querySelector('#wg-v56-open-v54').onclick = ()=> { if(window.openWhiteGloveV54Center) window.openWhiteGloveV54Center(); };
  }
  window.buildWhiteGloveGuardrailsV56 = buildGuardrailPack;
  window.applyWhiteGloveGuardrailsV56 = applyGuardrailPlan;
  window.buildWhiteGloveSaturationV56 = buildSaturationPlus;
  window.openWhiteGloveV56Center = function(){ ensureUI(); const launcher = document.getElementById('wg-v56-launcher'); if(launcher) launcher.click(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=> { ensureUI(); buildSaturationPlus(); }); else { ensureUI(); buildSaturationPlus(); }
})();
