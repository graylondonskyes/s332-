const H = require('../skyesol-whiteglove-runtime/shared');
const SERVICE = 'skyesol-whiteglove-sync';

function normalizePayload(payload){
  const out = {};
  H.listStoreNames().forEach(name => { out[name] = H.ensureArrayRows(payload && payload[name]); });
  return out;
}

function buildRestorePreview(payload){
  const normalized = normalizePayload(payload);
  const preview = {};
  H.listStoreNames().forEach(name => {
    const existing = H.getStore(name);
    const incoming = normalized[name];
    const existingIds = new Set(existing.map(row => H.clean(row.id)).filter(Boolean));
    const duplicateAgainstExisting = incoming.filter(row => existingIds.has(H.clean(row.id))).length;
    preview[name] = Object.assign({ duplicateAgainstExisting }, H.summarizeRows(incoming));
  });
  return preview;
}

function applyRestoreMerge(payload, mode){
  const normalized = normalizePayload(payload);
  const result = {};
  H.listStoreNames().forEach(name => {
    const merged = H.mergeRowsById(H.getStore(name), normalized[name], mode);
    H.replaceStore(name, merged);
    result[name] = H.summarizeRows(merged);
  });
  return result;
}


function buildRestorePolicyPreview(payload, policy){
  const normalized = normalizePayload(payload);
  const preview = {};
  H.listStoreNames().forEach(name => {
    const existing = H.getStore(name);
    const incoming = normalized[name];
    const existingIds = new Map(existing.map(row => [H.clean(row.id), row]));
    let duplicateAgainstExisting = 0, staleIncoming = 0, replacingIncoming = 0;
    incoming.forEach(row => {
      const id = H.clean(row.id); if(!id) return;
      if(existingIds.has(id)){
        duplicateAgainstExisting += 1;
        const prior = existingIds.get(id);
        const cmp = H.compareIso(row.updatedAt || row.createdAt || row.savedAt, prior.updatedAt || prior.createdAt || prior.savedAt);
        if(cmp < 0) staleIncoming += 1;
        if(cmp > 0) replacingIncoming += 1;
      }
    });
    const merged = H.mergeRowsByPolicy(existing, incoming, policy);
    preview[name] = Object.assign({ duplicateAgainstExisting, staleIncoming, replacingIncoming }, H.summarizeRows(incoming), { mergedRows: merged.length });
  });
  return preview;
}
function applyRestorePolicyMerge(payload, policy){
  const normalized = normalizePayload(payload);
  const result = {};
  H.listStoreNames().forEach(name => {
    const merged = H.mergeRowsByPolicy(H.getStore(name), normalized[name], policy);
    H.replaceStore(name, merged);
    result[name] = H.summarizeRows(merged);
  });
  return result;
}

function buildChainMergeAudit(payload){
  const normalized = normalizePayload(payload);
  const audit = {};
  H.listStoreNames().forEach(name => {
    const existing = H.getStore(name);
    const incoming = normalized[name];
    const existingIds = new Set(existing.map(row => H.clean(row.id)).filter(Boolean));
    const incomingIds = new Set();
    let duplicateInsideIncoming = 0, duplicateAgainstExisting = 0, staleIncoming = 0;
    incoming.forEach(row => {
      const id = H.clean(row.id); if(!id) return;
      if(incomingIds.has(id)) duplicateInsideIncoming += 1;
      incomingIds.add(id);
      if(existingIds.has(id)){
        duplicateAgainstExisting += 1;
        const prior = existing.find(item => H.clean(item.id) === id) || {};
        if(H.compareIso(row.updatedAt || row.createdAt || row.savedAt, prior.updatedAt || prior.createdAt || prior.savedAt) < 0) staleIncoming += 1;
      }
    });
    audit[name] = { incomingRows: incoming.length, duplicateInsideIncoming, duplicateAgainstExisting, staleIncoming };
  });
  return audit;
}






function buildDuplicateBookingReviewLocks(){
  const bookings = H.getStore('bookings');
  const map = new Map();
  bookings.forEach(row => {
    const key = [H.clean(row.serviceProfileId),H.clean(row.pickupAddress),H.clean(row.dropoffAddress),H.clean(row.serviceType),H.clean(row.etaWindow).slice(0,16)].join('|').toLowerCase();
    if(!key || key === '||||') return;
    if(!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  const groups = [];
  map.forEach((list, key) => {
    if(list.length < 2) return;
    const statuses = Array.from(new Set(list.map(row => H.clean(row.dispatchStatus || row.status).toLowerCase()).filter(Boolean)));
    const sources = Array.from(new Set(list.map(row => H.clean(row.requestSource || row.source).toLowerCase()).filter(Boolean)));
    const drivers = Array.from(new Set(list.map(row => H.clean(row.assignedDriverId)).filter(Boolean)));
    const vehicles = Array.from(new Set(list.map(row => H.clean(row.assignedVehicleId)).filter(Boolean)));
    const memberships = Array.from(new Set(list.map(row => H.clean(row.membershipId)).filter(Boolean)));
    const totals = list.map(row => Number(row.pricingSnapshot && row.pricingSnapshot.quotedTotal)).filter(v => Number.isFinite(v));
    const variance = totals.length ? (Math.max.apply(null, totals) - Math.min.apply(null, totals)) : 0;
    const reasons = [];
    const activeCount = list.filter(row => ['confirmed','assigned','en_route','arrived','rider_boarded','in_service'].includes(H.clean(row.dispatchStatus || row.status).toLowerCase())).length;
    if(activeCount > 1) reasons.push('multiple_active_candidates');
    if(statuses.length > 1) reasons.push('mixed_status_state');
    if(sources.length > 1) reasons.push('mixed_request_source');
    if(drivers.length > 1) reasons.push('multi_driver_assignment');
    if(vehicles.length > 1) reasons.push('multi_vehicle_assignment');
    if(memberships.length > 1) reasons.push('mixed_membership_link');
    if(variance > 0.01) reasons.push('quoted_total_variance');
    groups.push({ key, candidateCount:list.length, candidateBookingIds:list.map(row => row.id), reviewOnly: reasons.length > 0, lockReasons: reasons, activeCount, candidateStatuses: statuses, candidateSources: sources, candidateDrivers: drivers, candidateVehicles: vehicles, quotedTotalVariance: variance });
  });
  return { ok:true, reviewOnlyCount:groups.filter(g => g.reviewOnly).length, autoEligibleCount:groups.filter(g => !g.reviewOnly).length, groups };
}
function applyDuplicateBookingReviewGuardrails(body){
  const preview = buildDuplicateBookingReviewLocks();
  const bookings = H.getStore('bookings').map(row => Object.assign({}, row));
  const outcome = H.clean(body && body.outcome || 'cancel_duplicates').toLowerCase();
  const applied = [];
  preview.groups.forEach(group => {
    const ids = group.candidateBookingIds.map(H.clean).filter(Boolean);
    const primary = ids[0] || '';
    bookings.forEach(row => {
      if(!ids.includes(H.clean(row.id))) return;
      row.duplicateGuardrailAt = H.iso();
      row.duplicateGuardrailReasons = group.lockReasons || [];
      row.duplicateGuardrailState = group.reviewOnly ? 'review_only' : (outcome === 'cancel_duplicates' ? (H.clean(row.id) === primary ? 'safe_primary' : 'safe_cancel_duplicate') : 'safe_mark_distinct');
      if(!group.reviewOnly && outcome === 'cancel_duplicates' && H.clean(row.id) !== primary){ row.dispatchStatus = 'cancelled_duplicate'; row.status = 'cancelled_duplicate'; row.linkedCanonicalBookingId = primary; }
    });
    applied.push({ groupKey:group.key, reviewOnly:group.reviewOnly, outcome:group.reviewOnly ? 'review_only' : outcome, bookingIds:ids });
  });
  H.replaceStore('bookings', bookings);
  return { ok:true, preview, applied, outcome };
}

function buildDuplicateBookingReviewPreview(){
  const bookings = H.getStore('bookings');
  const map = new Map();
  bookings.forEach(row => {
    const key = [H.clean(row.serviceProfileId),H.clean(row.pickupAddress),H.clean(row.dropoffAddress),H.clean(row.serviceType),H.clean(row.etaWindow).slice(0,16)].join('|').toLowerCase();
    if(!key || key === '||||') return;
    if(!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  const groups = [];
  map.forEach((list, key) => {
    if(list.length < 2) return;
    const statuses = Array.from(new Set(list.map(row => H.clean(row.dispatchStatus || row.status).toLowerCase()).filter(Boolean)));
    const primary = list.slice().sort((a,b)=> H.compareIso(b.updatedAt || b.createdAt || b.savedAt, a.updatedAt || a.createdAt || a.savedAt))[0];
    groups.push({ key, candidateCount:list.length, candidateBookingIds:list.map(row => row.id), candidateStatuses:statuses, ambiguityLevel: statuses.length > 1 ? 'high' : (list.length > 2 ? 'medium' : 'low'), recommendedPrimaryBookingId: primary ? primary.id : '', recommendedOutcome: statuses.length > 1 ? 'operator_review' : 'cancel_duplicates' });
  });
  return { ok:true, groupCount:groups.length, highAmbiguityGroups:groups.filter(g => g.ambiguityLevel === 'high').length, groups };
}
function applyDuplicateBookingReview(body){
  const outcome = H.clean(body && body.outcome || 'mark_distinct').toLowerCase();
  const review = buildDuplicateBookingReviewPreview();
  const bookings = H.getStore('bookings').map(row => Object.assign({}, row));
  const applied = [];
  review.groups.forEach(group => {
    const bookingIds = group.candidateBookingIds.map(H.clean).filter(Boolean);
    const primary = H.clean((body && body.primaryBookingId) || group.recommendedPrimaryBookingId || bookingIds[0]);
    if(outcome === 'mark_distinct' || group.ambiguityLevel === 'high'){
      bookings.forEach(row => { if(bookingIds.includes(H.clean(row.id))){ row.duplicateReviewState = 'reviewed_distinct'; row.reviewedAt = H.iso(); } });
      applied.push({ groupKey:group.key, outcome:'mark_distinct', bookingIds });
      return;
    }
    if(outcome === 'cancel_duplicates'){
      bookings.forEach(row => {
        const id = H.clean(row.id);
        if(!bookingIds.includes(id)) return;
        row.reviewedAt = H.iso();
        if(id !== primary){ row.dispatchStatus = 'cancelled_duplicate'; row.status = 'cancelled_duplicate'; row.linkedCanonicalBookingId = primary; row.duplicateReviewState = 'cancelled_duplicate'; }
        else { row.duplicateReviewState = 'kept_primary'; }
      });
      applied.push({ groupKey:group.key, outcome:'cancel_duplicates', primaryBookingId:primary, bookingIds });
    }
  });
  H.replaceStore('bookings', bookings);
  return { ok:true, review, applied, outcome };
}

function buildCollisionResolutionPreview(policy){
  const profiles = H.getStore('serviceProfiles');
  const bookings = H.getStore('bookings');
  const memberships = H.getStore('memberships');
  const actions = [];
  const blockers = [];
  const map = new Map();
  profiles.forEach(row => {
    const key = H.clean([row.profileType, row.displayName || row.name, row.primaryPhone || row.phone, row.email].join('|')).toLowerCase();
    if(!key) return;
    if(!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  map.forEach((list, key) => {
    if(list.length < 2) return;
    const winner = list.slice().sort((a,b)=> H.compareIso(b.updatedAt || b.createdAt || b.savedAt, a.updatedAt || a.createdAt || a.savedAt))[0];
    const absorbIds = list.filter(row => H.clean(row.id) !== H.clean(winner && winner.id)).map(row => row.id);
    if(winner && absorbIds.length) actions.push({ id:H.uid('wg_resolve54'), type:'service_profile_merge', key, policy, survivorId:winner.id, absorbIds });
  });
  bookings.forEach(booking => {
    if(H.clean(booking.serviceProfileId) && !H.findById('serviceProfiles', booking.serviceProfileId)){
      const matches = profiles.filter(row => H.clean(row.displayName || row.name) === H.clean(booking.serviceProfileName || booking.clientName || booking.profileName));
      if(matches.length === 1) actions.push({ id:H.uid('wg_resolve54'), type:'booking_profile_reattach', bookingId:booking.id, targetProfileId:matches[0].id, policy });
      else blockers.push('booking_profile_orphan:' + booking.id);
    }
  });
  return { ok:blockers.length === 0, policy, blockers, actionCount:actions.length, actions };
}
function applyCollisionResolution(policy){
  const preview = buildCollisionResolutionPreview(policy);
  const profiles = H.getStore('serviceProfiles').map(row => Object.assign({}, row));
  const bookings = H.getStore('bookings').map(row => Object.assign({}, row));
  const memberships = H.getStore('memberships').map(row => Object.assign({}, row));
  const applied = [];
  preview.actions.forEach(action => {
    if(action.type === 'service_profile_merge'){
      let bookingUpdates = 0, membershipUpdates = 0, profileUpdates = 0;
      bookings.forEach(row => { if(action.absorbIds.includes(H.clean(row.serviceProfileId))){ row.serviceProfileId = action.survivorId; row.updatedAt = H.iso(); bookingUpdates += 1; } });
      memberships.forEach(row => { const key = H.clean(row.serviceProfileId || row.profileId); if(action.absorbIds.includes(key)){ row.serviceProfileId = action.survivorId; row.profileId = action.survivorId; row.updatedAt = H.iso(); membershipUpdates += 1; } });
      profiles.forEach(row => { if(action.absorbIds.includes(H.clean(row.id))){ row.active = false; row.resolvedIntoId = action.survivorId; row.resolutionState = 'absorbed'; row.updatedAt = H.iso(); profileUpdates += 1; } });
      applied.push({ type:action.type, bookingUpdates, membershipUpdates, profileUpdates, survivorId:action.survivorId });
    }
    if(action.type === 'booking_profile_reattach'){
      let count = 0;
      bookings.forEach(row => { if(H.clean(row.id) === H.clean(action.bookingId)){ row.serviceProfileId = action.targetProfileId; row.updatedAt = H.iso(); count += 1; } });
      applied.push({ type:action.type, bookingId:action.bookingId, targetProfileId:action.targetProfileId, count });
    }
  });
  H.replaceStore('serviceProfiles', profiles); H.replaceStore('bookings', bookings); H.replaceStore('memberships', memberships);
  return { ok:true, policy:preview.policy, blockers:preview.blockers, actionCount:preview.actionCount, applied };
}

function buildCrossRecordCollisionAudit(){
  const profiles = H.getStore('serviceProfiles');
  const bookings = H.getStore('bookings');
  const memberships = H.getStore('memberships');
  const docs = H.getStore('incidents').concat([]); // keep shape friendly
  const payouts = H.getStore('payouts');
  const payments = H.getStore('payments');
  const findings = [];
  function dup(rows, keyFn, type){
    const map = new Map();
    rows.forEach(row => { const key = H.clean(keyFn(row)).toLowerCase(); if(!key) return; if(!map.has(key)) map.set(key, []); map.get(key).push(row); });
    map.forEach((list, key) => { if(list.length > 1) findings.push({ type, key, severity:list.length > 2 ? 'high' : 'medium', ids:list.map(r => r.id) }); });
  }
  dup(profiles, row => [row.profileType, row.displayName || row.name, row.primaryPhone || row.phone, row.email].join('|'), 'profile_identity_duplicate');
  dup(bookings, row => [row.serviceProfileId, row.pickupAddress, row.dropoffAddress, row.etaWindow, row.serviceType].join('|'), 'booking_identity_duplicate');
  bookings.forEach(row => {
    if(H.clean(row.serviceProfileId) && !H.findById('serviceProfiles', row.serviceProfileId)) findings.push({ type:'orphan_booking_profile', severity:'high', bookingId:row.id, profileId:row.serviceProfileId });
    if(H.clean(row.membershipId) && !H.findById('memberships', row.membershipId)) findings.push({ type:'orphan_booking_membership', severity:'high', bookingId:row.id, membershipId:row.membershipId });
  });
  memberships.forEach(row => { if(H.clean(row.serviceProfileId || row.profileId) && !H.findById('serviceProfiles', row.serviceProfileId || row.profileId)) findings.push({ type:'orphan_membership_profile', severity:'high', membershipId:row.id, profileId:row.serviceProfileId || row.profileId }); });
  payouts.forEach(row => { if(H.clean(row.bookingId) && !H.findById('bookings', row.bookingId)) findings.push({ type:'orphan_payout_booking', severity:'medium', payoutId:row.id, bookingId:row.bookingId }); });
  payments.forEach(row => { if(H.clean(row.bookingId) && !H.findById('bookings', row.bookingId)) findings.push({ type:'orphan_payment_booking', severity:'medium', paymentId:row.id, bookingId:row.bookingId }); });
  const severity = findings.reduce((acc,row) => { acc[row.severity] = (acc[row.severity] || 0) + 1; return acc; }, { high:0, medium:0, low:0 });
  return { ok:(severity.high || 0) === 0, severity, findings, counts:{ profiles:profiles.length, bookings:bookings.length, memberships:memberships.length, payouts:payouts.length, payments:payments.length, incidents:docs.length } };
}

function route(request){
  const auth = H.checkToken(request, SERVICE); if(auth) return auth;
  const path = H.clean(request && request.path || '/') || '/';
  const method = H.clean(request && request.method || 'GET').toUpperCase();
  const body = H.parseBody(request);
  if(path === '/health') return H.json(H.responseEnvelope(SERVICE,{ status:'healthy', queueDepth:H.getStore('syncQueue').length }));
  if(path === '/queue'){
    if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
    return H.json(H.responseEnvelope(SERVICE,{ rows:H.clone(H.getStore('syncQueue')) }));
  }
  if(path === '/enqueue'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['kind']);
    if(missing.length) return H.badRequest(SERVICE,'Missing enqueue fields.',{ missing });
    const row = { id:H.uid('wg_sync50'), kind:H.clean(body.kind), payload:body.payload || {}, status:'queued', retryCount:0, createdAt:H.iso(), updatedAt:H.iso() };
    H.pushStore('syncQueue', row, 5000);
    return H.json(H.responseEnvelope(SERVICE,{ row }), 201);
  }
  if(path === '/retry'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['queueId']);
    if(missing.length) return H.badRequest(SERVICE,'Missing retry fields.',{ missing });
    const row = H.updateById('syncQueue', body.queueId, draft => { draft.retryCount = H.toNum(draft.retryCount || 0,0) + 1; draft.status = 'retried'; draft.updatedAt = H.iso(); return draft; });
    if(!row) return H.badRequest(SERVICE,'Queue row not found.',{ queueId: body.queueId });
    return H.json(H.responseEnvelope(SERVICE,{ row }));
  }
  if(path === '/ack'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['queueId']);
    if(missing.length) return H.badRequest(SERVICE,'Missing ack fields.',{ missing });
    const row = H.updateById('syncQueue', body.queueId, draft => { draft.status = 'acked'; draft.updatedAt = H.iso(); return draft; });
    if(!row) return H.badRequest(SERVICE,'Queue row not found.',{ queueId: body.queueId });
    return H.json(H.responseEnvelope(SERVICE,{ row }));
  }
  if(path === '/import-website-booking'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const missing = H.requireFields(body,['serviceProfileId','serviceType','market','pickupAddress','dropoffAddress']);
    if(missing.length) return H.badRequest(SERVICE,'Missing website booking import fields.',{ missing });
    const row = { id:H.uid('wg_syncimp50'), kind:'website_booking', payload:body, status:'queued', retryCount:0, createdAt:H.iso(), updatedAt:H.iso() };
    H.pushStore('syncQueue', row, 5000);
    H.pushStore('bookingRequests', { id:H.uid('wg_req50'), requestSource:'website', serviceProfileId:H.clean(body.serviceProfileId), serviceType:H.clean(body.serviceType), market:H.clean(body.market), pickupAddress:H.clean(body.pickupAddress), dropoffAddress:H.clean(body.dropoffAddress), etaWindow:H.clean(body.etaWindow || ''), notes:H.clean(body.notes || ''), createdAt:H.iso(), status:'requested', syncQueueId: row.id, multiStopText:H.clean(body.multiStopText || ''), returnLeg:!!body.returnLeg, standbyMinutesPlanned:H.toNum(body.standbyMinutesPlanned || 0, 0) }, 2000);
    return H.json(H.responseEnvelope(SERVICE,{ queueRow: row }), 201);
  }



  if(path === '/duplicate-booking-review-locks'){
    if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
    return H.json(H.responseEnvelope(SERVICE, buildDuplicateBookingReviewLocks()));
  }
  if(path === '/duplicate-booking-review-guardrail-apply'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    return H.json(H.responseEnvelope(SERVICE, applyDuplicateBookingReviewGuardrails(body)));
  }
  if(path === '/duplicate-booking-review-preview'){
    if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
    return H.json(H.responseEnvelope(SERVICE,{ review: buildDuplicateBookingReviewPreview() }));
  }
  if(path === '/duplicate-booking-review-apply'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    return H.json(H.responseEnvelope(SERVICE,{ result: applyDuplicateBookingReview(body) }));
  }

  if(path === '/collision-resolution-preview'){
    if(method !== 'GET' && method !== 'POST') return H.methodNotAllowed(method,['GET','POST']);
    const policy = H.clean(body.policy || (request && request.queryStringParameters && request.queryStringParameters.policy) || 'merge_newer').toLowerCase();
    return H.json(H.responseEnvelope(SERVICE,{ preview: buildCollisionResolutionPreview(policy) }));
  }
  if(path === '/collision-resolution-apply'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const policy = H.clean(body.policy || 'merge_newer').toLowerCase();
    return H.json(H.responseEnvelope(SERVICE,{ result: applyCollisionResolution(policy) }));
  }

  if(path === '/cross-record-collision-audit'){
    if(method !== 'GET') return H.methodNotAllowed(method,['GET']);
    return H.json(H.responseEnvelope(SERVICE,{ audit: buildCrossRecordCollisionAudit() }));
  }

  if(path === '/chain-merge-audit'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    return H.json(H.responseEnvelope(SERVICE,{ audit: buildChainMergeAudit(body.payload || body) }));
  }

if(path === '/restore-policy-preview'){
  if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
  const policy = H.clean(body.policy || 'merge_newer').toLowerCase();
  return H.json(H.responseEnvelope(SERVICE,{ policy, preview: buildRestorePolicyPreview(body.payload || body, policy) }));
}
if(path === '/restore-policy-merge'){
  if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
  const policy = H.clean(body.policy || 'merge_newer').toLowerCase();
  const result = applyRestorePolicyMerge(body.payload || body, policy);
  const audit = { id:H.uid('wg_sync_restorepol51'), kind:'restore_policy_' + policy, payload:{ stores:Object.keys(result) }, status:'acked', retryCount:0, createdAt:H.iso(), updatedAt:H.iso() };
  H.pushStore('syncQueue', audit, 5000);
  return H.json(H.responseEnvelope(SERVICE,{ policy, result, audit }));
}

  if(path === '/restore-preview'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    return H.json(H.responseEnvelope(SERVICE,{ preview: buildRestorePreview(body.payload || body) }));
  }
  if(path === '/restore-merge'){
    if(method !== 'POST') return H.methodNotAllowed(method,['POST']);
    const mode = H.clean(body.mode || 'merge').toLowerCase() === 'replace' ? 'replace' : 'merge';
    const result = applyRestoreMerge(body.payload || body, mode);
    const audit = { id:H.uid('wg_sync_restore50'), kind:'restore_' + mode, payload: { stores: Object.keys(result) }, status:'acked', retryCount:0, createdAt:H.iso(), updatedAt:H.iso() };
    H.pushStore('syncQueue', audit, 5000);
    return H.json(H.responseEnvelope(SERVICE,{ mode, result, audit }));
  }
  return H.notFound(SERVICE, method, path);
}
if(typeof module !== 'undefined') module.exports = { route, buildRestorePreview, applyRestoreMerge, buildRestorePolicyPreview, applyRestorePolicyMerge, buildChainMergeAudit, buildCrossRecordCollisionAudit, buildCollisionResolutionPreview, applyCollisionResolution, buildDuplicateBookingReviewLocks, applyDuplicateBookingReviewGuardrails };
