(function(){
  if(window.__ROUTEX_HOUSECIRCLE_V59__) return;
  window.__ROUTEX_HOUSECIRCLE_V59__ = true;

  const HC_KEY = 'skye_routex_platform_house_circle_v59';
  const HC_SYNC_LOG_KEY = 'skye_routex_platform_house_circle_sync_log_v59';
  const HC_IMPORT_OUTBOX_KEY = 'skye_routex_platform_house_circle_import_outbox_v59';
  const HC_EXPORT_OUTBOX_KEY = 'skye_routex_platform_house_circle_export_outbox_v59';
  const HC_TIMELINE_LIMIT = 400;

  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(m){ return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m]; }); };
  const uidFn = (typeof uid === 'function') ? uid : function(){ return 'hc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8); };
  const nowFn = (typeof nowISO === 'function') ? nowISO : function(){ return new Date().toISOString(); };
  const dayFn = (typeof dayISO === 'function') ? dayISO : function(){ return new Date().toISOString().slice(0,10); };
  const fmtFn = (typeof fmt === 'function') ? fmt : function(v){ try{ return new Date(v || Date.now()).toLocaleString(); }catch(_){ return clean(v); } };
  const toastFn = (typeof toast === 'function') ? toast : function(){};
  const downloadTextFn = (typeof downloadText === 'function') ? downloadText : function(text, filename, mime){
    const blob = new Blob([text], { type: mime || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'download.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ try{ URL.revokeObjectURL(a.href); }catch(_){} a.remove(); }, 0);
  };

  function readJSON(key, fallback){
    try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; }
  }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function clone(value){ return JSON.parse(JSON.stringify(value)); }
  function listify(value){ return Array.isArray(value) ? value.filter(Boolean) : []; }
  function compactText(v){ return clean(v).replace(/\s+/g, ' ').trim(); }
  function normalizeEmail(v){ return clean(v).toLowerCase(); }
  function normalizePhone(v){ return clean(v).replace(/[^\d+]/g, ''); }
  function asArray(v){ return Array.isArray(v) ? v : (v ? [v] : []); }
  function numberOrZero(v){ const n = Number(v || 0); return Number.isFinite(n) ? n : 0; }
  function bool(v){ return !!v; }
  function safeHash(input){
    const str = String(input || '');
    let h = 2166136261 >>> 0;
    for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }
  function slugify(value){
    return compactText(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'item';
  }
  function toneFromStatus(status){
    const s = clean(status).toLowerCase();
    if(['live','ready','linked','done','delivered','active','synced'].includes(s)) return 'good';
    if(['queued','pending','draft','watch'].includes(s)) return 'warn';
    if(['blocked','failed','cancelled','review'].includes(s)) return 'bad';
    return '';
  }
  function humanTier(points, visits){
    const p = numberOrZero(points);
    const v = numberOrZero(visits);
    if(p >= 900 || v >= 18) return 'VIP Table';
    if(p >= 450 || v >= 7) return 'Insider';
    if(p >= 150 || v >= 3) return 'Regular';
    return 'Guest';
  }
  function humanMoney(v){
    try{ return (typeof fmtMoney === 'function') ? fmtMoney(v) : '$' + Number(v || 0).toFixed(2); }catch(_){ return '$' + Number(v || 0).toFixed(2); }
  }
  function readAEAccounts(){
    try{ return typeof getAEFlowAccounts === 'function' ? getAEFlowAccounts() : []; }catch(_){ return []; }
  }
  function readRouteTasksSafe(){
    try{ return typeof readRouteTasks === 'function' ? readRouteTasks() : []; }catch(_){ return []; }
  }
  function writeRouteTasksSafe(items){
    try{ return typeof writeRouteTasks === 'function' ? writeRouteTasks(items) : items; }catch(_){ return items; }
  }
  function readVaultDocsSafe(){
    try{ return typeof readVaultDocs === 'function' ? readVaultDocs() : []; }catch(_){ return []; }
  }
  function routesSafe(){ return (typeof APP !== 'undefined' && APP && APP.cached && Array.isArray(APP.cached.routes)) ? APP.cached.routes : []; }
  function stopsSafe(){ return (typeof APP !== 'undefined' && APP && APP.cached && Array.isArray(APP.cached.stops)) ? APP.cached.stops : []; }
  function locationKeyFromParts(parts){ return 'loc-' + safeHash(parts.filter(Boolean).join('|')); }
  function guestKeyFromParts(parts){ return 'guest-' + safeHash(parts.filter(Boolean).join('|')); }
  function bridgeKeyFromParts(parts){ return 'bridge-' + safeHash(parts.filter(Boolean).join('|')); }

  function buildSeedState(){
    return {
      version: 'v59',
      product: 'SkyeRoutexFlow Platform House Circle Integral Stack',
      createdAt: nowFn(),
      updatedAt: nowFn(),
      organizations: [{ id:'org-main', name:'Platform House Circle', code:'PHC', status:'active', createdAt: nowFn(), updatedAt: nowFn() }],
      locations: [],
      guests: [],
      events: [],
      campaigns: [],
      drops: [],
      memberships: [],
      bridgeQueue: [],
      timeline: [],
      settings: {
        autoBridgeRoutes: true,
        autoSyncStops: true,
        operatorName: 'Skyes Over London',
        shell: 'SkyeRoutexFlow',
        syncedAt: ''
      }
    };
  }

  function normalizeLocation(item){
    const value = item && typeof item === 'object' ? item : {};
    return {
      id: clean(value.id) || locationKeyFromParts([value.name, value.address, value.serviceArea]),
      orgId: clean(value.orgId) || 'org-main',
      name: compactText(value.name) || 'Untitled location',
      code: compactText(value.code) || slugify(value.name || value.serviceArea || value.address),
      territory: compactText(value.territory),
      serviceArea: compactText(value.serviceArea),
      address: compactText(value.address),
      routeHint: compactText(value.routeHint),
      sourceAccountId: clean(value.sourceAccountId),
      sourceStopId: clean(value.sourceStopId),
      sourceRouteId: clean(value.sourceRouteId),
      website: compactText(value.website),
      email: normalizeEmail(value.email),
      phone: compactText(value.phone),
      tags: listify(value.tags).map(compactText).slice(0, 12),
      routeTouches: Math.max(0, Math.round(numberOrZero(value.routeTouches))),
      guestCount: Math.max(0, Math.round(numberOrZero(value.guestCount))),
      memberCount: Math.max(0, Math.round(numberOrZero(value.memberCount))),
      totalSpend: numberOrZero(value.totalSpend),
      lastRouteAt: clean(value.lastRouteAt),
      lastGuestAt: clean(value.lastGuestAt),
      lastCampaignAt: clean(value.lastCampaignAt),
      notes: compactText(value.notes),
      createdAt: clean(value.createdAt) || nowFn(),
      updatedAt: clean(value.updatedAt) || nowFn()
    };
  }

  function normalizeGuest(item){
    const value = item && typeof item === 'object' ? item : {};
    const points = numberOrZero(value.points);
    const visitCount = Math.max(0, Math.round(numberOrZero(value.visitCount)));
    return {
      id: clean(value.id) || guestKeyFromParts([value.email, value.phone, value.name]),
      locationId: clean(value.locationId),
      sourceAccountId: clean(value.sourceAccountId),
      name: compactText(value.name) || 'Untitled guest',
      email: normalizeEmail(value.email),
      phone: normalizePhone(value.phone),
      tier: compactText(value.tier) || humanTier(points, visitCount),
      points,
      visitCount,
      totalSpend: numberOrZero(value.totalSpend),
      lastVisitAt: clean(value.lastVisitAt),
      tags: listify(value.tags).map(compactText).slice(0, 12),
      notes: compactText(value.notes),
      createdAt: clean(value.createdAt) || nowFn(),
      updatedAt: clean(value.updatedAt) || nowFn()
    };
  }

  function normalizeEvent(item){
    const value = item && typeof item === 'object' ? item : {};
    return {
      id: clean(value.id) || uidFn(),
      locationId: clean(value.locationId),
      title: compactText(value.title) || 'Event',
      kind: compactText(value.kind) || 'hospitality-event',
      status: compactText(value.status) || 'draft',
      startAt: clean(value.startAt) || nowFn(),
      endAt: clean(value.endAt),
      expectedGuests: Math.max(0, Math.round(numberOrZero(value.expectedGuests))),
      linkedRouteId: clean(value.linkedRouteId),
      bridgeStatus: compactText(value.bridgeStatus) || 'unlinked',
      notes: compactText(value.notes),
      createdAt: clean(value.createdAt) || nowFn(),
      updatedAt: clean(value.updatedAt) || nowFn()
    };
  }

  function normalizeCampaign(item){
    const value = item && typeof item === 'object' ? item : {};
    return {
      id: clean(value.id) || uidFn(),
      locationId: clean(value.locationId),
      name: compactText(value.name) || 'Campaign',
      audience: compactText(value.audience) || 'all-members',
      channel: compactText(value.channel) || 'sms+email',
      status: compactText(value.status) || 'draft',
      linkedRouteId: clean(value.linkedRouteId),
      bridgeStatus: compactText(value.bridgeStatus) || 'unlinked',
      lastRunAt: clean(value.lastRunAt),
      notes: compactText(value.notes),
      createdAt: clean(value.createdAt) || nowFn(),
      updatedAt: clean(value.updatedAt) || nowFn()
    };
  }

  function normalizeDrop(item){
    const value = item && typeof item === 'object' ? item : {};
    return {
      id: clean(value.id) || uidFn(),
      locationId: clean(value.locationId),
      title: compactText(value.title) || 'VIP Drop',
      quantity: Math.max(0, Math.round(numberOrZero(value.quantity || 1))),
      scheduledAt: clean(value.scheduledAt) || nowFn(),
      status: compactText(value.status) || 'draft',
      linkedRouteId: clean(value.linkedRouteId),
      bridgeStatus: compactText(value.bridgeStatus) || 'unlinked',
      notes: compactText(value.notes),
      createdAt: clean(value.createdAt) || nowFn(),
      updatedAt: clean(value.updatedAt) || nowFn()
    };
  }

  function normalizeMembership(item){
    const value = item && typeof item === 'object' ? item : {};
    return {
      id: clean(value.id) || uidFn(),
      guestId: clean(value.guestId),
      locationId: clean(value.locationId),
      tier: compactText(value.tier) || 'Guest',
      status: compactText(value.status) || 'active',
      joinedAt: clean(value.joinedAt) || nowFn(),
      renewalAt: clean(value.renewalAt),
      notes: compactText(value.notes),
      createdAt: clean(value.createdAt) || nowFn(),
      updatedAt: clean(value.updatedAt) || nowFn()
    };
  }

  function normalizeBridgeItem(item){
    const value = item && typeof item === 'object' ? item : {};
    return {
      id: clean(value.id) || uidFn(),
      type: compactText(value.type) || 'task',
      sourceType: compactText(value.sourceType) || 'unknown',
      sourceId: clean(value.sourceId),
      label: compactText(value.label) || 'Bridge item',
      locationId: clean(value.locationId),
      linkedRouteId: clean(value.linkedRouteId),
      linkedTaskId: clean(value.linkedTaskId),
      status: compactText(value.status) || 'queued',
      note: compactText(value.note),
      payload: value.payload && typeof value.payload === 'object' ? clone(value.payload) : {},
      createdAt: clean(value.createdAt) || nowFn(),
      updatedAt: clean(value.updatedAt) || nowFn()
    };
  }

  function normalizeTimelineItem(item){
    const value = item && typeof item === 'object' ? item : {};
    return {
      id: clean(value.id) || uidFn(),
      at: clean(value.at) || nowFn(),
      kind: compactText(value.kind) || 'note',
      label: compactText(value.label) || 'Timeline event',
      detail: compactText(value.detail),
      entityType: compactText(value.entityType),
      entityId: clean(value.entityId),
      locationId: clean(value.locationId),
      guestId: clean(value.guestId),
      routeId: clean(value.routeId),
      stopId: clean(value.stopId),
      tone: compactText(value.tone),
      createdAt: clean(value.createdAt) || nowFn()
    };
  }

  function normalizeState(state){
    const base = buildSeedState();
    const value = state && typeof state === 'object' ? state : {};
    const next = {
      ...base,
      ...value,
      settings: { ...base.settings, ...(value.settings || {}) },
      organizations: listify(value.organizations).length ? listify(value.organizations) : base.organizations,
      locations: listify(value.locations).map(normalizeLocation),
      guests: listify(value.guests).map(normalizeGuest),
      events: listify(value.events).map(normalizeEvent),
      campaigns: listify(value.campaigns).map(normalizeCampaign),
      drops: listify(value.drops).map(normalizeDrop),
      memberships: listify(value.memberships).map(normalizeMembership),
      bridgeQueue: listify(value.bridgeQueue).map(normalizeBridgeItem),
      timeline: listify(value.timeline).map(normalizeTimelineItem).sort(function(a,b){ return String(b.at || '').localeCompare(String(a.at || '')); }).slice(0, HC_TIMELINE_LIMIT)
    };
    next.updatedAt = nowFn();
    return next;
  }

  function readState(){ return normalizeState(readJSON(HC_KEY, buildSeedState())); }
  function saveState(state){ return writeJSON(HC_KEY, normalizeState(state)); }
  function readSyncLog(){ return listify(readJSON(HC_SYNC_LOG_KEY, [])); }
  function pushSyncLog(row){ const list = readSyncLog(); list.unshift({ id: uidFn(), at: nowFn(), ...(row || {}) }); return writeJSON(HC_SYNC_LOG_KEY, list.slice(0, 120)); }
  function pushOutbox(key, payload){ const list = listify(readJSON(key, [])); list.unshift({ id: uidFn(), at: nowFn(), payload: clone(payload || {}) }); return writeJSON(key, list.slice(0, 60)); }

  function findLocation(state, id){ return state.locations.find(function(item){ return item.id === clean(id); }) || null; }
  function findGuest(state, id){ return state.guests.find(function(item){ return item.id === clean(id); }) || null; }
  function findEvent(state, id){ return state.events.find(function(item){ return item.id === clean(id); }) || null; }
  function findCampaign(state, id){ return state.campaigns.find(function(item){ return item.id === clean(id); }) || null; }
  function findDrop(state, id){ return state.drops.find(function(item){ return item.id === clean(id); }) || null; }

  function upsertLocation(state, patch){
    const item = normalizeLocation({ ...(patch || {}), updatedAt: nowFn() });
    const index = state.locations.findIndex(function(entry){ return entry.id === item.id; });
    if(index === -1) state.locations.unshift(item);
    else state.locations[index] = normalizeLocation({ ...state.locations[index], ...item, updatedAt: nowFn() });
    return state.locations.find(function(entry){ return entry.id === item.id; });
  }

  function upsertGuest(state, patch){
    const item = normalizeGuest({ ...(patch || {}), updatedAt: nowFn() });
    const index = state.guests.findIndex(function(entry){ return entry.id === item.id; });
    if(index === -1) state.guests.unshift(item);
    else state.guests[index] = normalizeGuest({ ...state.guests[index], ...item, updatedAt: nowFn() });
    return state.guests.find(function(entry){ return entry.id === item.id; });
  }

  function upsertEvent(state, patch){
    const item = normalizeEvent({ ...(patch || {}), updatedAt: nowFn() });
    const index = state.events.findIndex(function(entry){ return entry.id === item.id; });
    if(index === -1) state.events.unshift(item);
    else state.events[index] = normalizeEvent({ ...state.events[index], ...item, updatedAt: nowFn() });
    return state.events.find(function(entry){ return entry.id === item.id; });
  }

  function upsertCampaign(state, patch){
    const item = normalizeCampaign({ ...(patch || {}), updatedAt: nowFn() });
    const index = state.campaigns.findIndex(function(entry){ return entry.id === item.id; });
    if(index === -1) state.campaigns.unshift(item);
    else state.campaigns[index] = normalizeCampaign({ ...state.campaigns[index], ...item, updatedAt: nowFn() });
    return state.campaigns.find(function(entry){ return entry.id === item.id; });
  }

  function upsertDrop(state, patch){
    const item = normalizeDrop({ ...(patch || {}), updatedAt: nowFn() });
    const index = state.drops.findIndex(function(entry){ return entry.id === item.id; });
    if(index === -1) state.drops.unshift(item);
    else state.drops[index] = normalizeDrop({ ...state.drops[index], ...item, updatedAt: nowFn() });
    return state.drops.find(function(entry){ return entry.id === item.id; });
  }

  function upsertMembership(state, patch){
    const item = normalizeMembership({ ...(patch || {}), updatedAt: nowFn() });
    const index = state.memberships.findIndex(function(entry){ return entry.id === item.id; });
    if(index === -1) state.memberships.unshift(item);
    else state.memberships[index] = normalizeMembership({ ...state.memberships[index], ...item, updatedAt: nowFn() });
    return state.memberships.find(function(entry){ return entry.id === item.id; });
  }

  function appendTimeline(state, row){
    const item = normalizeTimelineItem(row);
    state.timeline = [item].concat(state.timeline.filter(function(entry){ return entry.id !== item.id; })).sort(function(a,b){ return String(b.at || '').localeCompare(String(a.at || '')); }).slice(0, HC_TIMELINE_LIMIT);
    return item;
  }

  function queueBridge(state, row){
    const item = normalizeBridgeItem(row);
    state.bridgeQueue = [item].concat(state.bridgeQueue.filter(function(entry){ return entry.id !== item.id; })).slice(0, 120);
    return item;
  }

  function buildLocationPatchFromAccount(account){
    const a = account && typeof account === 'object' ? account : {};
    const name = compactText(a.business_name || a.businessName || a.name);
    const territory = compactText(a.service_area || a.territory || a.route || a.route_name);
    const address = compactText(a.exact_address || a.address || '');
    return {
      id: clean(a.house_circle_location_id) || locationKeyFromParts([name, territory, address, a.id, a.business_email]),
      name: name || 'Account venue',
      territory,
      serviceArea: territory,
      address,
      routeHint: compactText(a.route || a.route_name),
      sourceAccountId: clean(a.id),
      website: compactText(a.website_or_booking || a.booking_link || a.website),
      email: normalizeEmail(a.business_email || a.email),
      phone: compactText(a.phone),
      tags: listify(a.tags).concat(['ae-flow']).map(compactText).filter(Boolean).slice(0, 12),
      notes: compactText(a.notes),
      updatedAt: nowFn()
    };
  }

  function buildGuestPatchFromAccount(account, locationId){
    const a = account && typeof account === 'object' ? account : {};
    const name = compactText(a.contact_name || a.contactName || a.business_name || '');
    const email = normalizeEmail(a.business_email || a.email);
    const phone = normalizePhone(a.phone || '');
    return {
      id: guestKeyFromParts([email, phone, name, a.id]),
      sourceAccountId: clean(a.id),
      locationId: clean(locationId),
      name: name || 'Venue contact',
      email,
      phone,
      tier: compactText(a.account_status).match(/vetted|active/i) ? 'Insider' : 'Guest',
      tags: listify(a.tags).concat(['ae-flow-contact']).map(compactText).filter(Boolean).slice(0, 12),
      notes: compactText(a.notes),
      updatedAt: nowFn()
    };
  }

  function findLocationBySourceAccount(state, accountId){
    const id = clean(accountId);
    return state.locations.find(function(item){ return clean(item.sourceAccountId) === id; }) || null;
  }

  function findLocationByStop(state, stop){
    const candidateId = locationKeyFromParts([
      clean(stop.sourceAccountId),
      compactText(stop.label),
      compactText(stop.serviceArea),
      compactText(stop.address),
      compactText(stop.businessEmail)
    ]);
    return state.locations.find(function(item){
      return item.id === candidateId || (clean(stop.sourceAccountId) && clean(item.sourceAccountId) === clean(stop.sourceAccountId)) || (compactText(item.name).toLowerCase() === compactText(stop.label).toLowerCase() && compactText(item.serviceArea).toLowerCase() === compactText(stop.serviceArea).toLowerCase());
    }) || null;
  }

  function buildLocationPatchFromStop(stop, route){
    const s = stop && typeof stop === 'object' ? stop : {};
    const r = route && typeof route === 'object' ? route : {};
    return {
      id: locationKeyFromParts([clean(s.sourceAccountId), compactText(s.label), compactText(s.serviceArea), compactText(s.address), compactText(s.businessEmail)]),
      name: compactText(s.label) || 'Route venue',
      territory: compactText(r.territory || s.serviceArea || s.routeHint),
      serviceArea: compactText(s.serviceArea || r.territory),
      address: compactText(s.exactAddress || s.address),
      routeHint: compactText(s.routeHint || r.name),
      sourceAccountId: clean(s.sourceAccountId),
      sourceStopId: clean(s.id),
      sourceRouteId: clean(r.id),
      email: normalizeEmail(s.businessEmail),
      phone: normalizePhone(s.phone),
      website: compactText(s.website),
      tags: listify(s.tags).concat(['routex-stop']).map(compactText).filter(Boolean).slice(0, 12),
      routeTouches: Math.max(1, Math.round(numberOrZero(s.attemptCount || 1))),
      lastRouteAt: clean(s.completedAt || s.deliveredAt || s.arrivedAt || s.updatedAt || r.updatedAt || r.date),
      notes: compactText(s.notes || s.outcomeNote),
      updatedAt: nowFn()
    };
  }

  function syncFromRoutex(opts){
    const state = readState();
    const accounts = readAEAccounts();
    const routes = routesSafe();
    const stops = stopsSafe();
    let locationAdds = 0;
    let guestAdds = 0;
    accounts.forEach(function(account){
      const patch = buildLocationPatchFromAccount(account);
      const existed = !!findLocationBySourceAccount(state, account.id);
      const location = upsertLocation(state, patch);
      if(!existed) locationAdds += 1;
      const guestPatch = buildGuestPatchFromAccount(account, location.id);
      const existingGuest = state.guests.find(function(entry){ return entry.id === guestPatch.id; });
      upsertGuest(state, guestPatch);
      if(!existingGuest) guestAdds += 1;
      if(!state.memberships.find(function(entry){ return entry.guestId === guestPatch.id && entry.locationId === location.id; })){
        upsertMembership(state, { guestId: guestPatch.id, locationId: location.id, tier: guestPatch.tier, status: 'active', joinedAt: nowFn(), notes: 'Created from AE FLOW account bridge.' });
      }
    });
    stops.forEach(function(stop){
      const route = routes.find(function(item){ return item.id === stop.routeId; }) || {};
      const current = findLocationByStop(state, stop);
      const patch = buildLocationPatchFromStop(stop, route);
      const merged = upsertLocation(state, current ? { ...current, ...patch, routeTouches: Math.max(numberOrZero(current.routeTouches), numberOrZero(patch.routeTouches || 1)), lastRouteAt: patch.lastRouteAt || current.lastRouteAt } : patch);
      const timelineLabel = stop.status === 'delivered' ? 'Route delivery completed' : (stop.status === 'arrived' ? 'Route arrival logged' : 'Route stop synced');
      appendTimeline(state, {
        id: 'timeline-route-sync-' + safeHash([stop.id, stop.status, stop.completedAt || stop.deliveredAt || stop.arrivedAt || stop.updatedAt || route.updatedAt || ''].join('|')),
        kind: 'route-sync',
        label: timelineLabel,
        detail: [compactText(route.name), compactText(stop.label), compactText(stop.status)].filter(Boolean).join(' • '),
        entityType: 'stop', entityId: stop.id, routeId: stop.routeId, stopId: stop.id, locationId: merged.id,
        tone: stop.status === 'delivered' ? 'good' : (stop.status && stop.status !== 'pending' ? 'warn' : ''),
        at: clean(stop.completedAt || stop.deliveredAt || stop.arrivedAt || stop.updatedAt || route.updatedAt || nowFn())
      });
    });
    state.settings.syncedAt = nowFn();
    saveState(state);
    pushSyncLog({ type:'routex-sync', note:`Synced ${accounts.length} account(s), ${routes.length} route(s), ${stops.length} stop(s).`, locationAdds, guestAdds, routeCount: routes.length, stopCount: stops.length });
    if(!(opts && opts.silent)) toastFn('Platform House synced from Routex.', 'good');
    return state;
  }

  function collectLocationStats(state, locationId){
    const guests = state.guests.filter(function(item){ return item.locationId === locationId; });
    const events = state.events.filter(function(item){ return item.locationId === locationId; });
    const campaigns = state.campaigns.filter(function(item){ return item.locationId === locationId; });
    const drops = state.drops.filter(function(item){ return item.locationId === locationId; });
    const queue = state.bridgeQueue.filter(function(item){ return item.locationId === locationId; });
    const spend = guests.reduce(function(sum, item){ return sum + numberOrZero(item.totalSpend); }, 0);
    return { guests, events, campaigns, drops, queue, spend };
  }

  function buildStats(state){
    const liveRoutes = routesSafe().filter(function(route){ return clean(route.status) && clean(route.status) !== 'done'; }).length;
    return {
      locations: state.locations.length,
      guests: state.guests.length,
      events: state.events.length,
      campaigns: state.campaigns.length,
      drops: state.drops.length,
      memberships: state.memberships.length,
      queue: state.bridgeQueue.filter(function(item){ return clean(item.status) !== 'done'; }).length,
      liveRoutes,
      totalSpend: state.guests.reduce(function(sum, item){ return sum + numberOrZero(item.totalSpend); }, 0),
      vipGuests: state.guests.filter(function(item){ return /vip|insider/i.test(item.tier); }).length,
      linkedRoutes: state.events.filter(function(item){ return clean(item.linkedRouteId); }).length + state.drops.filter(function(item){ return clean(item.linkedRouteId); }).length + state.campaigns.filter(function(item){ return clean(item.linkedRouteId); }).length
    };
  }

  function exportUnifiedBundle(){
    const state = readState();
    const payload = {
      type: 'skye-routex-platform-house-circle-v59',
      exportedAt: nowFn(),
      product: 'SkyeRoutexFlow Platform House Circle Integral Stack',
      hospitality: state,
      routexSummary: {
        routes: routesSafe().length,
        stops: stopsSafe().length,
        tasks: readRouteTasksSafe().length,
        docs: readVaultDocsSafe().length,
        syncedAt: state.settings.syncedAt || ''
      }
    };
    pushOutbox(HC_EXPORT_OUTBOX_KEY, payload);
    downloadTextFn(JSON.stringify(payload, null, 2), 'skye_routex_platform_house_circle_v59_' + dayFn() + '.json', 'application/json');
    toastFn('Unified Platform House export saved.', 'good');
    return payload;
  }

  function importUnifiedBundle(bundle){
    const data = bundle && typeof bundle === 'object' ? bundle : {};
    const type = clean(data.type);
    const hospitality = type === 'skye-routex-platform-house-circle-v59' ? data.hospitality : data;
    if(!hospitality || typeof hospitality !== 'object') throw new Error('Bundle not recognized.');
    const next = normalizeState(hospitality);
    saveState(next);
    pushOutbox(HC_IMPORT_OUTBOX_KEY, { type:'platform-house-circle-import', importedAt: nowFn(), bundleType: type || 'raw-hospitality-state', locations: next.locations.length, guests: next.guests.length });
    pushSyncLog({ type:'import', note:`Imported ${next.locations.length} location(s) and ${next.guests.length} guest(s).` });
    toastFn('Platform House bundle imported.', 'good');
    return next;
  }

  function queueRouteTaskFromSource(sourceType, sourceId){
    const state = readState();
    const map = {
      event: findEvent(state, sourceId),
      campaign: findCampaign(state, sourceId),
      drop: findDrop(state, sourceId)
    };
    const item = map[sourceType];
    if(!item) throw new Error('Source not found.');
    const location = findLocation(state, item.locationId);
    const label = item.title || item.name || 'Hospitality mission';
    const task = normalizeRouteTask({
      id: uidFn(),
      businessName: location ? location.name : 'Platform House location',
      businessEmail: normalizeEmail(location && location.email),
      routeId: clean(item.linkedRouteId),
      routeName: clean(item.linkedRouteId) ? ((routesSafe().find(function(route){ return route.id === item.linkedRouteId; }) || {}).name || '') : '',
      routeDate: clean(item.startAt || item.scheduledAt).slice(0,10),
      stopLabel: label,
      owner: 'Platform House Circle',
      dueDate: clean(item.startAt || item.scheduledAt).slice(0,10) || dayFn(),
      note: [label, item.notes, location ? location.serviceArea : '', 'Created from Platform House Circle bridge.'].filter(Boolean).join(' • '),
      type: sourceType === 'campaign' ? 'call-back' : 'revisit',
      status: 'open'
    });
    const tasks = readRouteTasksSafe();
    writeRouteTasksSafe([task].concat(tasks));
    const nextState = readState();
    queueBridge(nextState, {
      id: bridgeKeyFromParts([sourceType, sourceId, task.id]),
      type: 'route-task', sourceType, sourceId,
      label: label,
      locationId: clean(item.locationId),
      linkedRouteId: clean(item.linkedRouteId),
      linkedTaskId: task.id,
      status: 'queued',
      note: 'Follow-up task created inside Routex.'
    });
    appendTimeline(nextState, { kind:'bridge-task', label:'Platform House task queued', detail:[label, location ? location.name : '', task.dueDate].filter(Boolean).join(' • '), entityType: sourceType, entityId: sourceId, locationId: clean(item.locationId), tone:'warn', at: nowFn() });
    saveState(nextState);
    toastFn('Routex follow-up task created from Platform House item.', 'good');
    return task;
  }

  async function createRouteMissionFromSource(sourceType, sourceId){
    const state = readState();
    const lookup = { event: findEvent(state, sourceId), campaign: findCampaign(state, sourceId), drop: findDrop(state, sourceId) };
    const item = lookup[sourceType];
    if(!item) throw new Error('Source not found.');
    const location = findLocation(state, item.locationId);
    const routeTitle = sourceType === 'drop' ? ('Drop • ' + (item.title || 'VIP Drop')) : ((item.title || item.name || 'Hospitality Mission') + ' • Platform House');
    const route = await createRoute({
      name: routeTitle,
      date: clean(item.startAt || item.scheduledAt).slice(0,10) || dayFn(),
      territory: compactText(location && (location.territory || location.serviceArea)),
      routeNotes: [location ? location.name : '', item.notes, 'Created from Platform House Circle mission bridge.'].filter(Boolean).join(' • '),
      status: 'planned'
    });
    await createStop(route.id, {
      label: location ? location.name : 'Platform House location',
      address: location ? location.address : '',
      contact: location ? location.name : '',
      phone: location ? location.phone : '',
      notes: [item.title || item.name, item.notes].filter(Boolean).join(' • '),
      businessEmail: location ? location.email : '',
      website: location ? location.website : '',
      source: 'platform-house-circle',
      serviceArea: location ? location.serviceArea : '',
      routeHint: sourceType,
      tags: ['platform-house-circle', sourceType, compactText(item.status || 'draft')].filter(Boolean),
      appointmentWindowStart: clean(item.startAt || item.scheduledAt),
      appointmentWindowEnd: clean(item.endAt),
      locationNotes: 'Mission created from Platform House Circle',
      accessNotes: item.notes || '',
      sourceAccountId: location ? clean(location.sourceAccountId) : '',
      accountStatus: 'Platform House'
    });
    const nextState = readState();
    if(sourceType === 'event') upsertEvent(nextState, { ...item, linkedRouteId: route.id, bridgeStatus: 'linked', status: clean(item.status) || 'scheduled' });
    if(sourceType === 'campaign') upsertCampaign(nextState, { ...item, linkedRouteId: route.id, bridgeStatus: 'linked' });
    if(sourceType === 'drop') upsertDrop(nextState, { ...item, linkedRouteId: route.id, bridgeStatus: 'linked', status: 'queued' });
    queueBridge(nextState, { id: bridgeKeyFromParts([sourceType, sourceId, route.id]), type:'route-mission', sourceType, sourceId, label: routeTitle, locationId: clean(item.locationId), linkedRouteId: route.id, status:'linked', note:'Mission converted into a live Routex route.' });
    appendTimeline(nextState, { kind:'route-mission', label:'Platform House mission converted', detail:[route.name, location ? location.name : '', route.date].filter(Boolean).join(' • '), entityType: sourceType, entityId: sourceId, locationId: clean(item.locationId), routeId: route.id, tone:'good', at: nowFn() });
    saveState(nextState);
    toastFn('Platform House item converted into a Routex route.', 'good');
    return route;
  }

  function syncStopIntoHospitality(stopId){
    const stop = stopsSafe().find(function(item){ return item.id === clean(stopId); });
    if(!stop) return null;
    const route = routesSafe().find(function(item){ return item.id === clean(stop.routeId); }) || null;
    const state = readState();
    const location = upsertLocation(state, buildLocationPatchFromStop(stop, route || {}));
    if(clean(stop.businessEmail) || clean(stop.phone) || clean(stop.contact)){
      const guest = upsertGuest(state, {
        id: guestKeyFromParts([stop.businessEmail, stop.phone, stop.contact, stop.sourceAccountId, location.id]),
        locationId: location.id,
        sourceAccountId: clean(stop.sourceAccountId),
        name: compactText(stop.contact || stop.label),
        email: normalizeEmail(stop.businessEmail),
        phone: normalizePhone(stop.phone),
        totalSpend: 0,
        visitCount: Math.max(0, Math.round(numberOrZero(stop.successfulVisitCount || (stop.status === 'delivered' ? 1 : 0)))),
        lastVisitAt: clean(stop.completedAt || stop.deliveredAt || stop.arrivedAt),
        tier: stop.status === 'delivered' ? 'Regular' : 'Guest',
        tags: ['routex-sync', stop.status || 'pending'],
        notes: compactText(stop.notes || stop.outcomeNote)
      });
      upsertMembership(state, { guestId: guest.id, locationId: location.id, tier: guest.tier, status:'active', joinedAt: guest.createdAt, notes:'Linked from Routex stop sync.' });
    }
    appendTimeline(state, {
      id:'timeline-stop-status-' + safeHash([stop.id, stop.status, stop.completedAt || stop.deliveredAt || stop.arrivedAt || stop.updatedAt || ''].join('|')),
      kind:'stop-status-sync',
      label:'Routex stop wrote into Platform House',
      detail:[compactText(stop.label), compactText(stop.status), route ? compactText(route.name) : ''].filter(Boolean).join(' • '),
      entityType:'stop', entityId: stop.id, locationId: location.id, routeId: stop.routeId, stopId: stop.id,
      tone: stop.status === 'delivered' ? 'good' : toneFromStatus(stop.status),
      at: clean(stop.completedAt || stop.deliveredAt || stop.arrivedAt || stop.updatedAt || nowFn())
    });
    saveState(state);
    return state;
  }

  function patchRoutexWriters(){
    if(typeof createStop === 'function' && !window.__ROUTEX_HC_CREATESTOP_PATCHED__){
      window.__ROUTEX_HC_CREATESTOP_PATCHED__ = true;
      const prev = createStop;
      createStop = async function(routeId, data){
        const stop = await prev.apply(this, arguments);
        try{ syncStopIntoHospitality(stop.id); }catch(_){ }
        return stop;
      };
    }
    if(typeof updateStop === 'function' && !window.__ROUTEX_HC_UPDATESTOP_PATCHED__){
      window.__ROUTEX_HC_UPDATESTOP_PATCHED__ = true;
      const prev = updateStop;
      updateStop = async function(id, patch){
        const result = await prev.apply(this, arguments);
        try{ syncStopIntoHospitality(id); }catch(_){ }
        return result;
      };
    }
  }

  function injectStyles(){
    if(document.getElementById('hc-v59-style')) return;
    const style = document.createElement('style');
    style.id = 'hc-v59-style';
    style.textContent = '\n      .hc-v59-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}.hc-v59-card{grid-column:span 12;padding:16px 18px;border-radius:20px;border:1px solid rgba(255,255,255,.10);background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));box-shadow:0 18px 36px rgba(0,0,0,.22)}.hc-v59-kpis{display:flex;flex-wrap:wrap;gap:12px}.hc-v59-kpi{min-width:160px;padding:14px 16px;border-radius:18px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.16)}.hc-v59-kpi .n{font-size:28px;font-weight:800}.hc-v59-kpi .d{font-size:12px;color:rgba(255,255,255,.68)}.hc-v59-list{display:flex;flex-direction:column;gap:10px}.hc-v59-item{display:flex;gap:12px;justify-content:space-between;align-items:flex-start;padding:12px 14px;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.10)}.hc-v59-meta{min-width:0;flex:1}.hc-v59-name{font-weight:800;line-height:1.3}.hc-v59-sub{margin-top:5px;font-size:12.5px;color:rgba(255,255,255,.72);line-height:1.45}.hc-v59-actions{display:flex;gap:8px;flex-wrap:wrap}.hc-v59-split{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px}.hc-v59-col-6{grid-column:span 6}.hc-v59-col-4{grid-column:span 4}.hc-v59-col-8{grid-column:span 8}.hc-v59-col-12{grid-column:span 12}.hc-v59-tag{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-size:11px;margin-right:6px;margin-top:6px}.hc-v59-tag.good{border-color:rgba(34,197,94,.35);color:#9ae6b4}.hc-v59-tag.warn{border-color:rgba(245,158,11,.35);color:#fcd34d}.hc-v59-tag.bad{border-color:rgba(239,68,68,.35);color:#fca5a5}@media (max-width:920px){.hc-v59-col-6,.hc-v59-col-4,.hc-v59-col-8{grid-column:span 12}}\n    ';
    document.head.appendChild(style);
  }

  function ensureNavItem(){
    try{
      if(Array.isArray(NAV_ITEMS) && !NAV_ITEMS.find(function(item){ return item.id === 'platform-house'; })){
        const icon = (typeof ICONS !== 'undefined' && ICONS && ICONS.aeflow) ? ICONS.aeflow : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16"/><path d="M7 4v16"/><path d="M17 4v16"/><path d="M4 17h16"/></svg>';
        NAV_ITEMS.splice(3, 0, { id:'platform-house', label:'Platform House', desc:'House Circle hospitality lane', icon: icon });
      }
    }catch(_){ }
  }

  function buildLocationItemHtml(state, location){
    const stats = collectLocationStats(state, location.id);
    return '<div class="hc-v59-item"><div class="hc-v59-meta"><div class="hc-v59-name">' + esc(location.name) + ' <span class="hc-v59-tag ' + esc(toneFromStatus(location.lastRouteAt ? 'linked' : 'draft')) + '">' + esc(location.serviceArea || location.territory || 'Unassigned') + '</span></div><div class="hc-v59-sub">Guests <span class="mono">' + esc(String(stats.guests.length)) + '</span> • Events <span class="mono">' + esc(String(stats.events.length)) + '</span> • Campaigns <span class="mono">' + esc(String(stats.campaigns.length)) + '</span> • Queue <span class="mono">' + esc(String(stats.queue.length)) + '</span> • Spend <span class="mono">' + esc(humanMoney(stats.spend)) + '</span><br/>Route touches <span class="mono">' + esc(String(location.routeTouches || 0)) + '</span>' + (location.address ? ' • ' + esc(location.address) : '') + '</div></div><div class="hc-v59-actions"><button class="btn small" data-hc-edit-location="' + esc(location.id) + '">Edit</button><button class="btn small" data-hc-new-event="' + esc(location.id) + '">Event</button><button class="btn small" data-hc-new-campaign="' + esc(location.id) + '">Campaign</button><button class="btn small" data-hc-new-drop="' + esc(location.id) + '">Drop</button></div></div>';
  }

  function buildGuestItemHtml(guest){
    return '<div class="hc-v59-item"><div class="hc-v59-meta"><div class="hc-v59-name">' + esc(guest.name) + ' <span class="hc-v59-tag ' + esc(/vip|insider/i.test(guest.tier) ? 'good' : '') + '">' + esc(guest.tier) + '</span></div><div class="hc-v59-sub">' + esc(guest.email || 'No email') + (guest.phone ? ' • ' + esc(guest.phone) : '') + ' • Visits <span class="mono">' + esc(String(guest.visitCount || 0)) + '</span> • Spend <span class="mono">' + esc(humanMoney(guest.totalSpend)) + '</span>' + (guest.lastVisitAt ? ' • Last ' + esc(fmtFn(guest.lastVisitAt)) : '') + '</div></div><div class="hc-v59-actions"><button class="btn small" data-hc-edit-guest="' + esc(guest.id) + '">Edit</button></div></div>';
  }

  function buildSourceItemHtml(type, item){
    const tone = toneFromStatus(item.bridgeStatus || item.status);
    const label = item.title || item.name || 'Item';
    const when = item.startAt || item.scheduledAt || item.lastRunAt || item.updatedAt;
    return '<div class="hc-v59-item"><div class="hc-v59-meta"><div class="hc-v59-name">' + esc(label) + ' <span class="hc-v59-tag ' + esc(tone) + '">' + esc(item.bridgeStatus || item.status || 'draft') + '</span></div><div class="hc-v59-sub">' + esc(type.toUpperCase()) + (when ? ' • ' + esc(fmtFn(when)) : '') + (item.notes ? ' • ' + esc(item.notes) : '') + (item.linkedRouteId ? ' • Route <span class="mono">' + esc(item.linkedRouteId) + '</span>' : '') + '</div></div><div class="hc-v59-actions"><button class="btn small" data-hc-task-source="' + esc(type + '|' + item.id) + '">Task</button><button class="btn small primary" data-hc-route-source="' + esc(type + '|' + item.id) + '">Route</button></div></div>';
  }

  function buildTimelineHtml(item){
    return '<div class="hc-v59-item"><div class="hc-v59-meta"><div class="hc-v59-name">' + esc(item.label) + (item.tone ? ' <span class="hc-v59-tag ' + esc(item.tone) + '">' + esc(item.tone) + '</span>' : '') + '</div><div class="hc-v59-sub">' + esc(fmtFn(item.at)) + (item.detail ? ' • ' + esc(item.detail) : '') + '</div></div></div>';
  }

  function openEntityModal(kind, id, defaultLocationId){
    const state = readState();
    const entity = kind === 'location' ? findLocation(state, id) : kind === 'guest' ? findGuest(state, id) : kind === 'event' ? findEvent(state, id) : kind === 'campaign' ? findCampaign(state, id) : kind === 'drop' ? findDrop(state, id) : null;
    const locations = state.locations;
    const options = locations.map(function(location){ return '<option value="' + esc(location.id) + '" ' + (clean(defaultLocationId || (entity && entity.locationId)) === location.id ? 'selected' : '') + '>' + esc(location.name) + '</option>'; }).join('');
    let body = '';
    if(kind === 'location'){
      body = '<div class="fieldrow"><div class="field full"><label>Name</label><input id="hc_name" value="' + esc(entity ? entity.name : '') + '"/></div><div class="field"><label>Territory / service area</label><input id="hc_area" value="' + esc(entity ? (entity.serviceArea || entity.territory) : '') + '"/></div><div class="field"><label>Address</label><input id="hc_address" value="' + esc(entity ? entity.address : '') + '"/></div><div class="field"><label>Email</label><input id="hc_email" value="' + esc(entity ? entity.email : '') + '"/></div><div class="field"><label>Phone</label><input id="hc_phone" value="' + esc(entity ? entity.phone : '') + '"/></div><div class="field full"><label>Notes</label><textarea id="hc_notes">' + esc(entity ? entity.notes : '') + '</textarea></div></div>';
    }
    if(kind === 'guest'){
      body = '<div class="fieldrow"><div class="field full"><label>Name</label><input id="hc_name" value="' + esc(entity ? entity.name : '') + '"/></div><div class="field"><label>Email</label><input id="hc_email" value="' + esc(entity ? entity.email : '') + '"/></div><div class="field"><label>Phone</label><input id="hc_phone" value="' + esc(entity ? entity.phone : '') + '"/></div><div class="field"><label>Location</label><select id="hc_location">' + options + '</select></div><div class="field"><label>Tier</label><input id="hc_tier" value="' + esc(entity ? entity.tier : 'Guest') + '"/></div><div class="field"><label>Points</label><input id="hc_points" type="number" min="0" value="' + esc(String(entity ? entity.points : 0)) + '"/></div><div class="field"><label>Visits</label><input id="hc_visits" type="number" min="0" value="' + esc(String(entity ? entity.visitCount : 0)) + '"/></div><div class="field"><label>Total spend</label><input id="hc_spend" type="number" min="0" step="0.01" value="' + esc(String(entity ? entity.totalSpend : 0)) + '"/></div><div class="field full"><label>Notes</label><textarea id="hc_notes">' + esc(entity ? entity.notes : '') + '</textarea></div></div>';
    }
    if(kind === 'event' || kind === 'campaign' || kind === 'drop'){
      const titleLabel = kind === 'campaign' ? 'Name' : 'Title';
      const titleValue = entity ? (entity.title || entity.name || '') : '';
      const scheduleLabel = kind === 'campaign' ? 'Last run / target date' : 'Scheduled / start';
      const scheduleValue = entity ? (entity.startAt || entity.scheduledAt || entity.lastRunAt || '') : '';
      const extra = kind === 'event'
        ? '<div class="field"><label>Expected guests</label><input id="hc_expected" type="number" min="0" value="' + esc(String(entity ? entity.expectedGuests : 0)) + '"/></div>'
        : kind === 'campaign'
        ? '<div class="field"><label>Audience</label><input id="hc_audience" value="' + esc(entity ? entity.audience : 'all-members') + '"/></div><div class="field"><label>Channel</label><input id="hc_channel" value="' + esc(entity ? entity.channel : 'sms+email') + '"/></div>'
        : '<div class="field"><label>Quantity</label><input id="hc_quantity" type="number" min="1" value="' + esc(String(entity ? entity.quantity : 1)) + '"/></div>';
      body = '<div class="fieldrow"><div class="field full"><label>' + titleLabel + '</label><input id="hc_name" value="' + esc(titleValue) + '"/></div><div class="field"><label>Location</label><select id="hc_location">' + options + '</select></div><div class="field"><label>Status</label><input id="hc_status" value="' + esc(entity ? (entity.status || 'draft') : 'draft') + '"/></div><div class="field"><label>' + scheduleLabel + '</label><input id="hc_when" type="datetime-local" value="' + esc(clean(scheduleValue).slice(0,16)) + '"/></div>' + extra + '<div class="field full"><label>Notes</label><textarea id="hc_notes">' + esc(entity ? entity.notes : '') + '</textarea></div></div>';
    }
    openModal((entity ? 'Edit ' : 'New ') + kind.replace('-', ' '), body, '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Cancel</button><button class="btn primary" id="hc_save_entity">Save</button>');
    const saveBtn = document.getElementById('hc_save_entity');
    if(!saveBtn) return;
    saveBtn.onclick = function(){
      const next = readState();
      if(kind === 'location'){
        upsertLocation(next, { id: entity && entity.id, name: clean(document.getElementById('hc_name').value), serviceArea: clean(document.getElementById('hc_area').value), territory: clean(document.getElementById('hc_area').value), address: clean(document.getElementById('hc_address').value), email: clean(document.getElementById('hc_email').value), phone: clean(document.getElementById('hc_phone').value), notes: clean(document.getElementById('hc_notes').value) });
      } else if(kind === 'guest'){
        upsertGuest(next, { id: entity && entity.id, name: clean(document.getElementById('hc_name').value), email: clean(document.getElementById('hc_email').value), phone: clean(document.getElementById('hc_phone').value), locationId: clean(document.getElementById('hc_location').value), tier: clean(document.getElementById('hc_tier').value), points: numberOrZero(document.getElementById('hc_points').value), visitCount: numberOrZero(document.getElementById('hc_visits').value), totalSpend: numberOrZero(document.getElementById('hc_spend').value), notes: clean(document.getElementById('hc_notes').value) });
      } else if(kind === 'event'){
        upsertEvent(next, { id: entity && entity.id, title: clean(document.getElementById('hc_name').value), locationId: clean(document.getElementById('hc_location').value), status: clean(document.getElementById('hc_status').value), startAt: clean(document.getElementById('hc_when').value), expectedGuests: numberOrZero(document.getElementById('hc_expected').value), notes: clean(document.getElementById('hc_notes').value) });
      } else if(kind === 'campaign'){
        upsertCampaign(next, { id: entity && entity.id, name: clean(document.getElementById('hc_name').value), locationId: clean(document.getElementById('hc_location').value), status: clean(document.getElementById('hc_status').value), lastRunAt: clean(document.getElementById('hc_when').value), audience: clean(document.getElementById('hc_audience').value), channel: clean(document.getElementById('hc_channel').value), notes: clean(document.getElementById('hc_notes').value) });
      } else if(kind === 'drop'){
        upsertDrop(next, { id: entity && entity.id, title: clean(document.getElementById('hc_name').value), locationId: clean(document.getElementById('hc_location').value), status: clean(document.getElementById('hc_status').value), scheduledAt: clean(document.getElementById('hc_when').value), quantity: numberOrZero(document.getElementById('hc_quantity').value), notes: clean(document.getElementById('hc_notes').value) });
      }
      appendTimeline(next, { kind:'manual-edit', label:'Platform House entity saved', detail:(clean(document.getElementById('hc_name').value) || kind), entityType:kind, entityId:(entity && entity.id) || '', tone:'good', at: nowFn() });
      saveState(next);
      closeModal();
      render();
      toastFn('Platform House entity saved.', 'good');
    };
  }

  async function viewPlatformHouse(){
    injectStyles();
    const state = syncFromRoutex({ silent:true });
    const stats = buildStats(state);
    const locations = state.locations.slice().sort(function(a,b){ return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
    const guests = state.guests.slice().sort(function(a,b){ return numberOrZero(b.totalSpend) - numberOrZero(a.totalSpend) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
    const queue = state.bridgeQueue.slice().sort(function(a,b){ return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')); });
    const liveItems = []
      .concat(state.events.slice(0,4).map(function(item){ return { type:'event', item:item }; }))
      .concat(state.campaigns.slice(0,4).map(function(item){ return { type:'campaign', item:item }; }))
      .concat(state.drops.slice(0,4).map(function(item){ return { type:'drop', item:item }; }));

    setPage('Platform House', 'House Circle hospitality, member intelligence, and route bridge');
    setPrimary('Bridge Sync', function(){ syncFromRoutex({ silent:false }); render(); }, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12a7 7 0 0 1 12-4"/><path d="M19 12a7 7 0 0 1-12 4"/><path d="M5 8v4H1"/><path d="M23 16h-4v4"/></svg>');

    document.getElementById('content').innerHTML = '\n      <div class="hc-v59-grid">\n        <div class="hc-v59-card hc-v59-col-12">\n          <h2>Integral stack command center</h2>\n          <div class="hint">SkyeRoutexFlow remains the operating spine. Platform House Circle now lives inside the same stack as the hospitality, membership, event, drop, and campaign intelligence lane. This surface is native to Routex data, not a second product bolted on later.</div>\n          <div class="sep"></div>\n          <div class="hc-v59-kpis">\n            <div class="hc-v59-kpi"><div class="n">' + esc(String(stats.locations)) + '</div><div class="d">Shared locations</div></div>\n            <div class="hc-v59-kpi"><div class="n">' + esc(String(stats.guests)) + '</div><div class="d">Guests / contacts</div></div>\n            <div class="hc-v59-kpi"><div class="n">' + esc(String(stats.vipGuests)) + '</div><div class="d">VIP / insider guests</div></div>\n            <div class="hc-v59-kpi"><div class="n">' + esc(String(stats.events + stats.campaigns + stats.drops)) + '</div><div class="d">Live hospitality work items</div></div>\n            <div class="hc-v59-kpi"><div class="n">' + esc(String(stats.queue)) + '</div><div class="d">Bridge queue items</div></div>\n            <div class="hc-v59-kpi"><div class="n">' + esc(String(stats.liveRoutes)) + '</div><div class="d">Live Routex routes</div></div>\n            <div class="hc-v59-kpi"><div class="n">' + esc(humanMoney(stats.totalSpend)) + '</div><div class="d">Guest spend tracked</div></div>\n            <div class="hc-v59-kpi"><div class="n">' + esc(String(stats.linkedRoutes)) + '</div><div class="d">Hospitality items already linked to routes</div></div>\n          </div>\n          <div class="sep"></div>\n          <div class="row" style="flex-wrap:wrap;">\n            <button class="btn" id="hc_new_location">New location</button>\n            <button class="btn" id="hc_new_guest">New guest</button>\n            <button class="btn" id="hc_sync_now">Run bridge sync</button>\n            <button class="btn" id="hc_export">Export integral bundle</button>\n            <button class="btn" id="hc_import">Import House Circle bundle</button>\n            <input id="hc_import_file" type="file" accept="application/json" style="display:none"/>\n            <div class="pill">Synced ' + esc(state.settings.syncedAt ? fmtFn(state.settings.syncedAt) : 'just now') + '</div>\n          </div>\n        </div>\n        <div class="hc-v59-card hc-v59-col-6">\n          <h2>Shared locations</h2>\n          <div class="hint">These venues are now first-class shared records inside the Routex shell. Campaigns, events, drops, and route missions all target these same location records.</div>\n          <div class="sep"></div>\n          <div class="hc-v59-list">' + (locations.slice(0,8).map(function(location){ return buildLocationItemHtml(state, location); }).join('') || '<div class="hint">No locations yet.</div>') + '</div>\n        </div>\n        <div class="hc-v59-card hc-v59-col-6">\n          <h2>Guest and member ledger</h2>\n          <div class="hint">This is the relationship layer: loyalty status, visits, spend, and the human contact surface that now rides with route intelligence instead of living outside it.</div>\n          <div class="sep"></div>\n          <div class="hc-v59-list">' + (guests.slice(0,8).map(buildGuestItemHtml).join('') || '<div class="hint">No guests yet.</div>') + '</div>\n        </div>\n        <div class="hc-v59-card hc-v59-col-6">\n          <h2>Events, campaigns, and drops</h2>\n          <div class="hint">Each hospitality item can immediately become a Routex follow-up task or a full live route mission.</div>\n          <div class="sep"></div>\n          <div class="row" style="flex-wrap:wrap;margin-bottom:12px;">\n            <button class="btn" id="hc_new_event">New event</button>\n            <button class="btn" id="hc_new_campaign">New campaign</button>\n            <button class="btn" id="hc_new_drop">New drop</button>\n          </div>\n          <div class="hc-v59-list">' + (liveItems.slice(0,10).map(function(entry){ return buildSourceItemHtml(entry.type, entry.item); }).join('') || '<div class="hint">No hospitality work items yet.</div>') + '</div>\n        </div>\n        <div class="hc-v59-card hc-v59-col-6">\n          <h2>Bridge queue + writeback</h2>\n          <div class="hint">This queue tracks the work you have asked the hospitality lane to push into Routex. Items land here when you create Routex tasks or full route missions from Platform House.</div>\n          <div class="sep"></div>\n          <div class="hc-v59-list">' + (queue.slice(0,10).map(function(item){ return '<div class="hc-v59-item"><div class="hc-v59-meta"><div class="hc-v59-name">' + esc(item.label) + ' <span class="hc-v59-tag ' + esc(toneFromStatus(item.status)) + '">' + esc(item.status) + '</span></div><div class="hc-v59-sub">' + esc(item.sourceType) + ' • ' + esc(item.note || '') + (item.linkedRouteId ? ' • Route <span class="mono">' + esc(item.linkedRouteId) + '</span>' : '') + (item.linkedTaskId ? ' • Task <span class="mono">' + esc(item.linkedTaskId) + '</span>' : '') + '</div></div></div>'; }).join('') || '<div class="hint">No bridge items yet.</div>') + '</div>\n        </div>\n        <div class="hc-v59-card hc-v59-col-12">\n          <h2>Unified timeline</h2>\n          <div class="hint">This timeline fuses hospitality edits, bridge actions, and Routex stop writebacks into one running operational memory.</div>\n          <div class="sep"></div>\n          <div class="hc-v59-list">' + (state.timeline.slice(0,14).map(buildTimelineHtml).join('') || '<div class="hint">Timeline is empty.</div>') + '</div>\n        </div>\n      </div>';

    const importInput = document.getElementById('hc_import_file');
    if(document.getElementById('hc_new_location')) document.getElementById('hc_new_location').onclick = function(){ openEntityModal('location'); };
    if(document.getElementById('hc_new_guest')) document.getElementById('hc_new_guest').onclick = function(){ openEntityModal('guest'); };
    if(document.getElementById('hc_new_event')) document.getElementById('hc_new_event').onclick = function(){ openEntityModal('event', '', state.locations[0] && state.locations[0].id); };
    if(document.getElementById('hc_new_campaign')) document.getElementById('hc_new_campaign').onclick = function(){ openEntityModal('campaign', '', state.locations[0] && state.locations[0].id); };
    if(document.getElementById('hc_new_drop')) document.getElementById('hc_new_drop').onclick = function(){ openEntityModal('drop', '', state.locations[0] && state.locations[0].id); };
    if(document.getElementById('hc_sync_now')) document.getElementById('hc_sync_now').onclick = function(){ syncFromRoutex({ silent:false }); render(); };
    if(document.getElementById('hc_export')) document.getElementById('hc_export').onclick = exportUnifiedBundle;
    if(document.getElementById('hc_import')) document.getElementById('hc_import').onclick = function(){ if(importInput) importInput.click(); };
    if(importInput) importInput.onchange = function(evt){
      const file = evt.target.files && evt.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = function(){
        try{ importUnifiedBundle(JSON.parse(reader.result)); render(); }catch(err){ toastFn(clean(err && err.message) || 'Import failed.', 'bad'); }
      };
      reader.readAsText(file);
    };
    Array.from(document.querySelectorAll('[data-hc-edit-location]')).forEach(function(btn){ btn.onclick = function(){ openEntityModal('location', btn.getAttribute('data-hc-edit-location')); }; });
    Array.from(document.querySelectorAll('[data-hc-edit-guest]')).forEach(function(btn){ btn.onclick = function(){ openEntityModal('guest', btn.getAttribute('data-hc-edit-guest')); }; });
    Array.from(document.querySelectorAll('[data-hc-new-event]')).forEach(function(btn){ btn.onclick = function(){ openEntityModal('event', '', btn.getAttribute('data-hc-new-event')); }; });
    Array.from(document.querySelectorAll('[data-hc-new-campaign]')).forEach(function(btn){ btn.onclick = function(){ openEntityModal('campaign', '', btn.getAttribute('data-hc-new-campaign')); }; });
    Array.from(document.querySelectorAll('[data-hc-new-drop]')).forEach(function(btn){ btn.onclick = function(){ openEntityModal('drop', '', btn.getAttribute('data-hc-new-drop')); }; });
    Array.from(document.querySelectorAll('[data-hc-task-source]')).forEach(function(btn){ btn.onclick = function(){ const parts = clean(btn.getAttribute('data-hc-task-source')).split('|'); queueRouteTaskFromSource(parts[0], parts[1]); render(); }; });
    Array.from(document.querySelectorAll('[data-hc-route-source]')).forEach(function(btn){ btn.onclick = async function(){ const parts = clean(btn.getAttribute('data-hc-route-source')).split('|'); await createRouteMissionFromSource(parts[0], parts[1]); APP.view = 'routes'; window.location.hash = 'routes'; render(); }; });
  }

  function injectDashboardCard(){
    const host = document.querySelector('#content .grid');
    if(!host || document.getElementById('hc_dashboard_card')) return;
    const state = readState();
    const stats = buildStats(state);
    const card = document.createElement('div');
    card.id = 'hc_dashboard_card';
    card.className = 'card';
    card.style.gridColumn = 'span 12';
    card.innerHTML = '<h2>Platform House Circle</h2><div class="hint">Hospitality, membership, campaign, event, and drop intelligence now share the same operating shell as your routes. This is the integral bridge layer, not a sidecar.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><div class="pill">Locations ' + esc(String(stats.locations)) + '</div><div class="pill">Guests ' + esc(String(stats.guests)) + '</div><div class="pill">Hospitality items ' + esc(String(stats.events + stats.campaigns + stats.drops)) + '</div><div class="pill">Bridge queue ' + esc(String(stats.queue)) + '</div><div class="pill">Linked routes ' + esc(String(stats.linkedRoutes)) + '</div><button class="btn" id="dashOpenPlatformHouse">Open Platform House</button></div>';
    host.insertBefore(card, host.children[2] || null);
    const openBtn = document.getElementById('dashOpenPlatformHouse');
    if(openBtn) openBtn.onclick = function(){ APP.routeId = null; APP.view = 'platform-house'; window.location.hash = 'platform-house'; render(); };
  }

  function injectRouteDetailCard(){
    if(!(typeof APP !== 'undefined' && APP && APP.routeId)) return;
    const host = document.querySelector('#content .card');
    if(!host || document.getElementById('hc_route_detail_card')) return;
    const stop = stopsSafe().find(function(item){ return clean(item.routeId) === clean(APP.routeId); }) || null;
    if(!stop) return;
    const state = readState();
    const location = findLocationByStop(state, stop);
    if(!location) return;
    const stats = collectLocationStats(state, location.id);
    const card = document.createElement('div');
    card.id = 'hc_route_detail_card';
    card.className = 'hint';
    card.style.marginTop = '12px';
    card.innerHTML = 'Platform House linkage: <span class="badge good">' + esc(location.name) + '</span> • Guests <span class="mono">' + esc(String(stats.guests.length)) + '</span> • Events <span class="mono">' + esc(String(stats.events.length)) + '</span> • Campaigns <span class="mono">' + esc(String(stats.campaigns.length)) + '</span> • Drops <span class="mono">' + esc(String(stats.drops.length)) + '</span> • Spend <span class="mono">' + esc(humanMoney(stats.spend)) + '</span> <button class="btn small" id="hc_open_linked_location" style="margin-left:8px;">Open</button>';
    host.appendChild(card);
    const btn = document.getElementById('hc_open_linked_location');
    if(btn) btn.onclick = function(){ APP.routeId = null; APP.view = 'platform-house'; window.location.hash = 'platform-house'; render(); setTimeout(function(){ try{ openEntityModal('location', location.id); }catch(_){ } }, 100); };
  }

  function injectSettingsCard(){
    const host = document.querySelector('#content .grid');
    if(!host || document.getElementById('hc_settings_card')) return;
    const card = document.createElement('div');
    card.id = 'hc_settings_card';
    card.className = 'card';
    card.style.gridColumn = 'span 12';
    card.innerHTML = '<h2>Platform House Circle</h2><div class="hint">Import/export the integral hospitality bundle without leaving the Routex shell.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><button class="btn" id="hc_settings_export">Export Platform House bundle</button><button class="btn" id="hc_settings_open">Open Platform House</button></div>';
    host.appendChild(card);
    const ex = document.getElementById('hc_settings_export');
    const op = document.getElementById('hc_settings_open');
    if(ex) ex.onclick = exportUnifiedBundle;
    if(op) op.onclick = function(){ APP.routeId = null; APP.view = 'platform-house'; window.location.hash = 'platform-house'; render(); };
  }

  function patchViews(){
    if(typeof viewDashboard === 'function' && !window.__ROUTEX_HC_DASH_PATCHED__){
      window.__ROUTEX_HC_DASH_PATCHED__ = true;
      const prev = viewDashboard;
      viewDashboard = async function(){ await prev.apply(this, arguments); injectDashboardCard(); };
    }
    if(typeof viewRouteDetail === 'function' && !window.__ROUTEX_HC_ROUTEDETAIL_PATCHED__){
      window.__ROUTEX_HC_ROUTEDETAIL_PATCHED__ = true;
      const prev = viewRouteDetail;
      viewRouteDetail = async function(route){ await prev.apply(this, arguments); injectRouteDetailCard(); };
    }
    if(typeof viewSettings === 'function' && !window.__ROUTEX_HC_SETTINGS_PATCHED__){
      window.__ROUTEX_HC_SETTINGS_PATCHED__ = true;
      const prev = viewSettings;
      viewSettings = async function(){ await prev.apply(this, arguments); injectSettingsCard(); };
    }
    if(typeof render === 'function' && !window.__ROUTEX_HC_RENDER_PATCHED__){
      window.__ROUTEX_HC_RENDER_PATCHED__ = true;
      const prev = render;
      render = async function(){
        if(typeof APP !== 'undefined' && APP && APP.view === 'platform-house'){
          renderNav();
          updateStatusLine();
          var hb = document.getElementById('hamburger');
          if(hb) hb.onclick = function(){ (document.getElementById('sidebar').classList.contains('open') ? closeSidebar() : openSidebar()); };
          await viewPlatformHouse();
          if(innerWidth > 980) closeSidebar();
          return;
        }
        return prev.apply(this, arguments);
      };
    }
  }

  function init(){
    ensureNavItem();
    patchRoutexWriters();
    patchViews();
    syncFromRoutex({ silent:true });
    window.RoutexPlatformHouseCircle = {
      readState: readState,
      saveState: saveState,
      syncFromRoutex: syncFromRoutex,
      exportUnifiedBundle: exportUnifiedBundle,
      importUnifiedBundle: importUnifiedBundle,
      queueRouteTaskFromSource: queueRouteTaskFromSource,
      createRouteMissionFromSource: createRouteMissionFromSource,
      syncStopIntoHospitality: syncStopIntoHospitality,
      buildStats: function(){ return buildStats(readState()); }
    };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
