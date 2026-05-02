(function(){
  if(window.__ROUTEX_HOUSECIRCLE_V62__) return;
  window.__ROUTEX_HOUSECIRCLE_V62__ = true;

  const KEY_SHIFTS = 'skye_routex_platform_house_circle_shifts_v62';
  const KEY_ASSIGNMENTS = 'skye_routex_platform_house_circle_assignments_v62';
  const KEY_READINESS_TEMPLATES = 'skye_routex_platform_house_circle_readiness_templates_v62';
  const KEY_READINESS_RUNS = 'skye_routex_platform_house_circle_readiness_runs_v62';
  const KEY_REPLICA_LOG = 'skye_routex_platform_house_circle_replica_log_v62';
  const KEY_MERGE_LOG = 'skye_routex_platform_house_circle_merge_log_v62';
  const KEY_CASES_V61 = 'skye_routex_platform_house_circle_cases_v61';
  const KEY_RULES_V61 = 'skye_routex_platform_house_circle_rules_v61';
  const KEY_PLAYBOOKS_V61 = 'skye_routex_platform_house_circle_playbooks_v61';
  const KEY_RUNS_V61 = 'skye_routex_platform_house_circle_runs_v61';
  const KEY_AUDIT_V60 = 'skye_routex_platform_house_circle_audit_v60';
  const LIMIT_ROWS = 300;

  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(m){ return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m]; }); };
  const uidFn = (typeof uid === 'function') ? uid : function(){ return 'hc62-' + Math.random().toString(36).slice(2,10); };
  const nowFn = (typeof nowISO === 'function') ? nowISO : function(){ return new Date().toISOString(); };
  const dayFn = (typeof dayISO === 'function') ? dayISO : function(){ return new Date().toISOString().slice(0,10); };
  const fmtFn = (typeof fmt === 'function') ? fmt : function(v){ try{ return new Date(v || Date.now()).toLocaleString(); }catch(_){ return clean(v); } };
  const moneyFn = (typeof fmtMoney === 'function') ? fmtMoney : function(v){ return '$' + Number(v || 0).toFixed(2); };
  const toastFn = (typeof toast === 'function') ? toast : function(){};
  const openModalFn = (typeof openModal === 'function') ? openModal : function(title){ try{ alert(title); }catch(_){} };
  const closeModalFn = (typeof closeModal === 'function') ? closeModal : function(){};
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame.bind(window) : function(cb){ return setTimeout(cb, 0); };

  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function compact(v){ return clean(v).replace(/\s+/g, ' ').trim(); }
  function lower(v){ return compact(v).toLowerCase(); }
  function listify(v){ return Array.isArray(v) ? v.filter(Boolean) : []; }
  function num(v){ const n = Number(v || 0); return Number.isFinite(n) ? n : 0; }
  function attr(v){ return esc(String(v == null ? '' : v)).replace(/\n/g, '&#10;'); }
  function normalizeEmail(v){ return clean(v).toLowerCase(); }
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function sortByTs(rows){ return rows.slice().sort(function(a,b){ return tsOf(b) - tsOf(a); }); }
  function tsOf(row){
    const value = row && (row.updatedAt || row.at || row.completedAt || row.createdAt || row.exportedAt || row.importedAt || row.resolvedAt || row.startAt || row.endAt);
    const parsed = value ? Date.parse(value) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function sameJSON(a,b){ try{ return JSON.stringify(a) === JSON.stringify(b); }catch(_){ return false; } }

  function base(){ return window.RoutexPlatformHouseCircle || null; }
  function v60(){ return window.RoutexPlatformHouseCircleV60 || null; }
  function v61(){ return window.RoutexPlatformHouseCircleV61 || null; }
  function state(){ const api = base(); return api && typeof api.readState === 'function' ? api.readState() : {}; }
  function saveState(next){ const api = base(); return api && typeof api.saveState === 'function' ? api.saveState(next) : next; }
  function currentOperator(){ const api = v60(); return api && typeof api.currentOperator === 'function' ? api.currentOperator() : { id:'founder-admin', name:'Skyes Over London', role:'founder_admin' }; }
  function readOperators(){ const api = v60(); return api && typeof api.readOperators === 'function' ? api.readOperators() : [currentOperator()]; }
  function can(permission){ const api = v60(); return !permission || !(api && typeof api.can === 'function') ? true : api.can(permission); }
  function requirePermission(permission, message){ if(permission && !can(permission)) throw new Error(message || ('Current operator cannot perform ' + permission + '.')); }

  function addAudit(action, detail, tone, meta){
    try{
      const op = currentOperator();
      const row = {
        id: uidFn(),
        at: nowFn(),
        action: compact(action),
        detail: compact(detail),
        tone: compact(tone) || 'good',
        operatorId: clean(op.id),
        operatorName: compact(op.name),
        meta: meta && typeof meta === 'object' ? clone(meta) : {}
      };
      const rows = listify(readJSON(KEY_AUDIT_V60, [])).filter(Boolean);
      rows.unshift(row);
      writeJSON(KEY_AUDIT_V60, rows.slice(0, 360));
      return row;
    }catch(_){ return null; }
  }

  function readRouteTasksSafe(){ try{ return typeof readRouteTasks === 'function' ? listify(readRouteTasks()) : []; }catch(_){ return []; } }
  function writeRouteTasksSafe(items){ try{ return typeof writeRouteTasks === 'function' ? writeRouteTasks(items) : items; }catch(_){ return items; } }
  function normalizeRouteTaskSafe(task){ try{ return typeof normalizeRouteTask === 'function' ? normalizeRouteTask(task) : task; }catch(_){ return task; } }

  function readLocations(){ return listify(state().locations); }
  function readGuests(){ return listify(state().guests); }
  function findLocation(id){ return readLocations().find(function(item){ return clean(item.id) === clean(id); }) || null; }
  function findGuest(id){ return readGuests().find(function(item){ return clean(item.id) === clean(id); }) || null; }
  function findLocationName(id){ const hit = findLocation(id); return hit ? hit.name : ''; }
  function findGuestName(id){ const hit = findGuest(id); return hit ? hit.name : ''; }

  function locateLocationId(payload){
    const rows = readLocations();
    const direct = clean(payload && payload.locationId);
    if(direct && rows.find(function(item){ return clean(item.id) === direct; })) return direct;
    const sourceStopId = clean(payload && (payload.stopId || payload.sourceStopId));
    if(sourceStopId){
      const hit = rows.find(function(item){ return clean(item.sourceStopId) === sourceStopId; });
      if(hit) return hit.id;
    }
    const email = normalizeEmail(payload && (payload.email || payload.guestEmail || payload.businessEmail));
    if(email){
      const hit = rows.find(function(item){ return normalizeEmail(item.email) === email; });
      if(hit) return hit.id;
    }
    const name = lower(payload && (payload.locationName || payload.name || payload.label));
    if(name){
      const hit = rows.find(function(item){ return lower(item.name) === name; });
      if(hit) return hit.id;
    }
    return '';
  }
  function locateGuestId(payload, locationId){
    const rows = readGuests().filter(function(item){ return !locationId || clean(item.locationId) === clean(locationId); });
    const direct = clean(payload && payload.guestId);
    if(direct && rows.find(function(item){ return clean(item.id) === direct; })) return direct;
    const email = normalizeEmail(payload && (payload.email || payload.guestEmail));
    if(email){
      const hit = rows.find(function(item){ return normalizeEmail(item.email) === email; });
      if(hit) return hit.id;
    }
    const name = lower(payload && (payload.name || payload.guestName || payload.contact));
    if(name){
      const hit = rows.find(function(item){ return lower(item.name) === name; });
      if(hit) return hit.id;
    }
    return '';
  }

  function normalizeShift(item){
    const value = item && typeof item === 'object' ? item : {};
    const op = readOperators().find(function(row){ return clean(row.id) === clean(value.operatorId); });
    return {
      id: clean(value.id) || uidFn(),
      title: compact(value.title) || 'Dispatch shift',
      status: compact(value.status) || 'active',
      role: compact(value.role) || 'dispatch',
      locationId: clean(value.locationId),
      operatorId: clean(value.operatorId) || clean(op && op.id),
      operatorName: compact(value.operatorName) || compact(op && op.name),
      startAt: clean(value.startAt) || nowFn(),
      endAt: clean(value.endAt),
      note: compact(value.note),
      createdAt: clean(value.createdAt) || nowFn(),
      updatedAt: clean(value.updatedAt) || nowFn()
    };
  }
  function readShifts(){ return sortByTs(listify(readJSON(KEY_SHIFTS, [])).map(normalizeShift)).slice(0, LIMIT_ROWS); }
  function saveShifts(rows){ return writeJSON(KEY_SHIFTS, sortByTs(listify(rows).map(normalizeShift)).slice(0, LIMIT_ROWS)); }
  function createShift(payload){
    requirePermission('manage_bridge', 'Current operator cannot create shifts.');
    const row = normalizeShift(Object.assign({}, payload || {}, { id: clean(payload && payload.id) || uidFn(), createdAt: nowFn(), updatedAt: nowFn() }));
    const rows = readShifts().filter(function(item){ return clean(item.id) !== row.id; });
    rows.unshift(row);
    saveShifts(rows);
    addAudit('v62-shift-created', row.title, 'good', { shiftId: row.id, operatorId: row.operatorId, locationId: row.locationId });
    return row;
  }

  function normalizeAssignment(item){
    const value = item && typeof item === 'object' ? item : {};
    return {
      id: clean(value.id) || uidFn(),
      title: compact(value.title) || 'Assignment',
      status: compact(value.status) || 'queued',
      priority: compact(value.priority) || 'normal',
      caseId: clean(value.caseId),
      taskId: clean(value.taskId),
      shiftId: clean(value.shiftId),
      operatorId: clean(value.operatorId),
      operatorName: compact(value.operatorName),
      locationId: clean(value.locationId),
      guestId: clean(value.guestId),
      scheduledFor: clean(value.scheduledFor) || dayFn(),
      sourceType: compact(value.sourceType),
      sourceId: clean(value.sourceId),
      note: compact(value.note),
      createdAt: clean(value.createdAt) || nowFn(),
      updatedAt: clean(value.updatedAt) || nowFn(),
      completedAt: clean(value.completedAt)
    };
  }
  function readAssignments(){ return sortByTs(listify(readJSON(KEY_ASSIGNMENTS, [])).map(normalizeAssignment)).slice(0, LIMIT_ROWS); }
  function saveAssignments(rows){ return writeJSON(KEY_ASSIGNMENTS, sortByTs(listify(rows).map(normalizeAssignment)).slice(0, LIMIT_ROWS)); }

  function createRouteTask(task){
    const op = currentOperator();
    const row = normalizeRouteTaskSafe({
      id: clean(task.id) || uidFn(),
      title: compact(task.title) || 'Platform House assignment',
      status: compact(task.status) || 'todo',
      priority: compact(task.priority) || 'normal',
      dueDate: clean(task.dueDate) || dayFn(),
      createdAt: clean(task.createdAt) || nowFn(),
      updatedAt: nowFn(),
      note: compact(task.note),
      tags: listify(task.tags).map(compact).slice(0, 16),
      routeId: clean(task.routeId),
      stopId: clean(task.stopId),
      source: compact(task.source) || 'platform-house-circle-v62',
      sourceId: clean(task.sourceId),
      owner: compact(task.owner) || op.name,
      ownerId: clean(task.ownerId) || op.id,
      locationId: clean(task.locationId),
      guestId: clean(task.guestId)
    });
    const rows = readRouteTasksSafe().filter(function(item){ return clean(item.id) !== row.id; });
    rows.unshift(row);
    writeRouteTasksSafe(rows.slice(0, 800));
    return row;
  }

  function createAssignment(payload){
    requirePermission('manage_bridge', 'Current operator cannot create assignments.');
    const op = readOperators().find(function(row){ return clean(row.id) === clean(payload && payload.operatorId); }) || currentOperator();
    const row = normalizeAssignment(Object.assign({}, payload || {}, {
      id: clean(payload && payload.id) || uidFn(),
      operatorId: clean(payload && payload.operatorId) || clean(op.id),
      operatorName: compact(payload && payload.operatorName) || compact(op.name),
      createdAt: nowFn(),
      updatedAt: nowFn()
    }));
    const rows = readAssignments().filter(function(item){ return clean(item.id) !== row.id; });
    rows.unshift(row);
    saveAssignments(rows);
    addAudit('v62-assignment-created', row.title, 'good', { assignmentId: row.id, caseId: row.caseId, operatorId: row.operatorId, shiftId: row.shiftId });
    return row;
  }
  function updateAssignment(id, patch){
    const current = readAssignments().find(function(item){ return clean(item.id) === clean(id); });
    if(!current) throw new Error('Assignment not found.');
    const row = normalizeAssignment(Object.assign({}, current, patch || {}, { id: current.id, updatedAt: nowFn() }));
    const rows = readAssignments().map(function(item){ return clean(item.id) === row.id ? row : item; });
    saveAssignments(rows);
    addAudit('v62-assignment-updated', row.title, row.status === 'completed' ? 'good' : 'warn', { assignmentId: row.id, status: row.status });
    return row;
  }
  function completeAssignment(id, note){
    return updateAssignment(id, { status:'completed', completedAt: nowFn(), note: compact([readAssignments().find(function(item){ return clean(item.id) === clean(id); }).note, note].filter(Boolean).join(' • ')) });
  }

  function defaultReadinessTemplates(){
    return [
      {
        id: 'rt-v62-venue-open',
        title: 'Venue Open Readiness',
        lane: 'hospitality',
        severity: 'high',
        items: [
          { label:'VIP/member welcome packets staged', required:true },
          { label:'QR/join surface visible', required:true },
          { label:'Operator dispatch contact posted', required:true },
          { label:'Promo and event assets staged', required:false }
        ]
      },
      {
        id: 'rt-v62-event-activation',
        title: 'Event Activation Readiness',
        lane: 'bridge',
        severity: 'critical',
        items: [
          { label:'Guest list confirmed', required:true },
          { label:'Routex mission owner assigned', required:true },
          { label:'POS/offer lane checked', required:true },
          { label:'Proof pack / service summary prepared', required:true }
        ]
      },
      {
        id: 'rt-v62-white-glove-close',
        title: 'White-Glove Closeout',
        lane: 'ops',
        severity: 'medium',
        items: [
          { label:'Proof artifacts saved', required:true },
          { label:'Follow-up task queued', required:true },
          { label:'Hospitality timeline updated', required:true }
        ]
      }
    ];
  }
  function normalizeTemplate(item){
    const value = item && typeof item === 'object' ? item : {};
    return {
      id: clean(value.id) || uidFn(),
      title: compact(value.title) || 'Readiness template',
      lane: compact(value.lane) || 'hospitality',
      severity: compact(value.severity) || 'medium',
      items: listify(value.items).map(function(row){ return { label: compact(row && row.label), required: row && row.required !== false }; }).filter(function(row){ return row.label; }),
      createdAt: clean(value.createdAt) || nowFn(),
      updatedAt: clean(value.updatedAt) || nowFn()
    };
  }
  function readReadinessTemplates(){
    let rows = listify(readJSON(KEY_READINESS_TEMPLATES, [])).map(normalizeTemplate);
    if(!rows.length){ rows = defaultReadinessTemplates().map(normalizeTemplate); writeJSON(KEY_READINESS_TEMPLATES, rows); }
    return rows;
  }
  function saveReadinessTemplates(rows){ return writeJSON(KEY_READINESS_TEMPLATES, sortByTs(listify(rows).map(normalizeTemplate)).slice(0, 120)); }

  function normalizeReadinessRun(item){
    const value = item && typeof item === 'object' ? item : {};
    return {
      id: clean(value.id) || uidFn(),
      templateId: clean(value.templateId),
      title: compact(value.title) || 'Readiness run',
      locationId: clean(value.locationId),
      status: compact(value.status) || 'open',
      severity: compact(value.severity) || 'medium',
      items: listify(value.items).map(function(row){ return { label: compact(row && row.label), required: row && row.required !== false, state: compact(row && row.state) || 'pending', note: compact(row && row.note) }; }).slice(0, 24),
      failedCritical: !!value.failedCritical,
      escalatedCaseId: clean(value.escalatedCaseId),
      escalatedTaskId: clean(value.escalatedTaskId),
      createdAt: clean(value.createdAt) || nowFn(),
      updatedAt: clean(value.updatedAt) || nowFn(),
      completedAt: clean(value.completedAt)
    };
  }
  function readReadinessRuns(){ return sortByTs(listify(readJSON(KEY_READINESS_RUNS, [])).map(normalizeReadinessRun)).slice(0, LIMIT_ROWS); }
  function saveReadinessRuns(rows){ return writeJSON(KEY_READINESS_RUNS, sortByTs(listify(rows).map(normalizeReadinessRun)).slice(0, LIMIT_ROWS)); }
  function createReadinessRun(payload){
    requirePermission('manage_hospitality', 'Current operator cannot create readiness runs.');
    const template = readReadinessTemplates().find(function(item){ return clean(item.id) === clean(payload && payload.templateId); });
    if(!template) throw new Error('Readiness template not found.');
    const row = normalizeReadinessRun({
      id: uidFn(),
      templateId: template.id,
      title: compact((payload && payload.title) || (template.title + (payload && payload.locationId ? ' • ' + findLocationName(payload.locationId) : ''))),
      locationId: clean(payload && payload.locationId),
      severity: template.severity,
      items: template.items.map(function(item){ return { label:item.label, required:item.required, state:'pending', note:'' }; }),
      createdAt: nowFn(),
      updatedAt: nowFn()
    });
    const rows = readReadinessRuns().filter(function(item){ return clean(item.id) !== row.id; });
    rows.unshift(row);
    saveReadinessRuns(rows);
    addAudit('v62-readiness-run-created', row.title, 'good', { runId: row.id, templateId: row.templateId, locationId: row.locationId });
    return row;
  }
  function updateReadinessItem(runId, itemIndex, stateValue, note){
    requirePermission('manage_hospitality', 'Current operator cannot update readiness runs.');
    const runs = readReadinessRuns();
    const current = runs.find(function(item){ return clean(item.id) === clean(runId); });
    if(!current) throw new Error('Readiness run not found.');
    const items = current.items.slice();
    const idx = Number(itemIndex || 0);
    if(!items[idx]) throw new Error('Readiness item not found.');
    items[idx] = Object.assign({}, items[idx], { state: compact(stateValue) || 'pending', note: compact(note) });
    let next = normalizeReadinessRun(Object.assign({}, current, { items: items, updatedAt: nowFn() }));
    const failedRequired = next.items.filter(function(item){ return item.required && item.state === 'failed'; });
    next.failedCritical = failedRequired.length > 0;
    const pending = next.items.filter(function(item){ return item.state === 'pending'; }).length;
    next.status = pending ? (next.failedCritical ? 'attention' : 'open') : (next.failedCritical ? 'failed' : 'passed');
    if(next.failedCritical && !next.escalatedCaseId && v61() && typeof v61().createServiceCase === 'function'){
      const serviceCase = v61().createServiceCase({
        title: 'Readiness failure • ' + (findLocationName(next.locationId) || next.title),
        severity: next.severity === 'critical' ? 'critical' : 'high',
        locationId: next.locationId,
        note: 'Required readiness items failed in V62 readiness run.',
        lane: 'bridge',
        type: 'readiness_failure',
        checklist: failedRequired.map(function(item){ return item.label; })
      });
      const task = createRouteTask({
        title: 'Resolve readiness failure • ' + (findLocationName(next.locationId) || next.title),
        priority: next.severity === 'critical' ? 'high' : 'normal',
        note: 'Required readiness items failed. Review V62 readiness run.',
        source: 'platform-house-circle-v62',
        sourceId: next.id,
        locationId: next.locationId,
        tags: ['platform-house-circle', 'v62', 'readiness-failure']
      });
      next.escalatedCaseId = serviceCase && serviceCase.id || '';
      next.escalatedTaskId = task && task.id || '';
    }
    const updated = runs.map(function(item){ return clean(item.id) === clean(next.id) ? next : item; });
    saveReadinessRuns(updated);
    addAudit('v62-readiness-item-updated', next.title, next.failedCritical ? 'bad' : 'good', { runId: next.id, status: next.status, itemIndex: idx });
    return next;
  }
  function finalizeReadinessRun(runId){
    const current = readReadinessRuns().find(function(item){ return clean(item.id) === clean(runId); });
    if(!current) throw new Error('Readiness run not found.');
    const pending = current.items.filter(function(item){ return item.state === 'pending'; }).length;
    return normalizeReadinessRun(updateReadinessItem(runId, 0, current.items[0] ? current.items[0].state : 'passed', current.items[0] ? current.items[0].note : '')) && updateReadinessRunState(runId, pending ? 'attention' : (current.failedCritical ? 'failed' : 'passed'));
  }
  function updateReadinessRunState(runId, status){
    const runs = readReadinessRuns();
    const current = runs.find(function(item){ return clean(item.id) === clean(runId); });
    if(!current) throw new Error('Readiness run not found.');
    const next = normalizeReadinessRun(Object.assign({}, current, { status: compact(status) || current.status, updatedAt: nowFn(), completedAt: compact(status) === 'open' ? '' : nowFn() }));
    saveReadinessRuns(runs.map(function(item){ return clean(item.id) === clean(next.id) ? next : item; }));
    addAudit('v62-readiness-run-finalized', next.title, next.status === 'passed' ? 'good' : 'warn', { runId: next.id, status: next.status });
    return next;
  }

  function readV61Cases(){ return listify(readJSON(KEY_CASES_V61, [])); }
  function readV61Rules(){ return listify(readJSON(KEY_RULES_V61, [])); }
  function readV61Playbooks(){ return listify(readJSON(KEY_PLAYBOOKS_V61, [])); }
  function readV61Runs(){ return listify(readJSON(KEY_RUNS_V61, [])); }

  function buildWaveFromOpenCases(payload){
    requirePermission('manage_bridge', 'Current operator cannot build dispatch waves.');
    const opts = payload && typeof payload === 'object' ? payload : {};
    const operator = readOperators().find(function(item){ return clean(item.id) === clean(opts.operatorId); }) || currentOperator();
    const shiftId = clean(opts.shiftId);
    const scheduledFor = clean(opts.scheduledFor) || dayFn();
    const maxCount = Math.max(1, Math.min(12, Math.round(num(opts.count || 4))));
    const openCases = (v61() && typeof v61().readServiceCases === 'function' ? v61().readServiceCases() : []).filter(function(item){ return item.status !== 'resolved'; });
    const existingAssignments = readAssignments();
    const available = openCases.filter(function(row){ return !existingAssignments.some(function(a){ return clean(a.caseId) === clean(row.id) && a.status !== 'cancelled' && a.status !== 'completed'; }); });
    const selected = available.slice(0, maxCount);
    const created = selected.map(function(serviceCase){
      const task = createRouteTask({
        title: 'Dispatch • ' + serviceCase.title,
        priority: serviceCase.severity === 'critical' ? 'high' : 'normal',
        dueDate: scheduledFor,
        note: compact(serviceCase.note || 'Auto-built from V62 dispatch wave.'),
        source: 'platform-house-circle-v62',
        sourceId: serviceCase.id,
        locationId: serviceCase.locationId,
        guestId: serviceCase.guestId,
        tags: ['platform-house-circle', 'v62', 'dispatch-wave', lower(serviceCase.severity || 'medium')]
      });
      return createAssignment({
        title: serviceCase.title,
        caseId: serviceCase.id,
        taskId: task.id,
        shiftId: shiftId,
        operatorId: operator.id,
        operatorName: operator.name,
        locationId: serviceCase.locationId,
        guestId: serviceCase.guestId,
        priority: serviceCase.severity === 'critical' ? 'high' : 'normal',
        scheduledFor: scheduledFor,
        sourceType: 'service_case',
        sourceId: serviceCase.id,
        note: compact(serviceCase.note || 'Auto-built from V62 dispatch wave.')
      });
    });
    addAudit('v62-dispatch-wave-built', 'Dispatch wave created', 'good', { count: created.length, operatorId: operator.id, shiftId: shiftId || '' });
    return created;
  }

  function mergeRows(localRows, incomingRows){
    const next = {};
    const conflicts = [];
    listify(localRows).forEach(function(row){ if(row && clean(row.id)) next[clean(row.id)] = clone(row); });
    listify(incomingRows).forEach(function(row){
      const id = clean(row && row.id);
      if(!id) return;
      const local = next[id];
      if(!local){ next[id] = clone(row); return; }
      const localTs = tsOf(local);
      const incomingTs = tsOf(row);
      if(incomingTs > localTs){ next[id] = clone(row); return; }
      if(incomingTs === localTs && !sameJSON(local, row)) conflicts.push({ id:id, localTs:localTs, incomingTs:incomingTs });
    });
    return { rows: sortByTs(Object.keys(next).map(function(key){ return next[key]; })), conflicts: conflicts };
  }
  function compareRows(localRows, incomingRows){
    const localMap = {};
    listify(localRows).forEach(function(row){ if(row && clean(row.id)) localMap[clean(row.id)] = row; });
    const out = { creates:0, updates:0, stale:0, unchanged:0, conflicts:0 };
    listify(incomingRows).forEach(function(row){
      const id = clean(row && row.id);
      if(!id) return;
      const local = localMap[id];
      if(!local){ out.creates += 1; return; }
      const localTs = tsOf(local);
      const incomingTs = tsOf(row);
      if(incomingTs > localTs){ out.updates += 1; return; }
      if(incomingTs < localTs){ out.stale += 1; return; }
      if(!sameJSON(local, row)){ out.conflicts += 1; return; }
      out.unchanged += 1;
    });
    return out;
  }

  function mergeBaseState(localState, incomingState){
    const next = clone(localState || {});
    const source = incomingState && typeof incomingState === 'object' ? incomingState : {};
    Object.keys(source).forEach(function(key){
      const localValue = next[key];
      const incomingValue = source[key];
      if(Array.isArray(localValue) && Array.isArray(incomingValue) && incomingValue.every(function(row){ return row && typeof row === 'object'; })){
        next[key] = mergeRows(localValue, incomingValue).rows;
      }else if((localValue == null || localValue === '' || (Array.isArray(localValue) && !localValue.length)) && incomingValue != null){
        next[key] = clone(incomingValue);
      }else if(localValue && incomingValue && typeof localValue === 'object' && typeof incomingValue === 'object' && !Array.isArray(localValue) && !Array.isArray(incomingValue)){
        next[key] = Object.assign({}, incomingValue, localValue);
      }
    });
    return next;
  }

  function buildReplicaBundle(){
    return {
      type: 'skye-routex-platform-house-circle-v62',
      version: '62.0.0',
      exportedAt: nowFn(),
      state: state(),
      operators: readOperators(),
      currentOperator: currentOperator(),
      joinPackets: v60() && typeof v60().readJoinPackets === 'function' ? v60().readJoinPackets() : [],
      checkins: v60() && typeof v60().readCheckins === 'function' ? v60().readCheckins() : [],
      posTickets: v60() && typeof v60().readPosTickets === 'function' ? v60().readPosTickets() : [],
      audit: v60() && typeof v60().readAudit === 'function' ? v60().readAudit() : listify(readJSON(KEY_AUDIT_V60, [])),
      routeTasks: readRouteTasksSafe(),
      serviceCases: readV61Cases(),
      automationRules: readV61Rules(),
      playbooks: readV61Playbooks(),
      signalRuns: readV61Runs(),
      shifts: readShifts(),
      assignments: readAssignments(),
      readinessTemplates: readReadinessTemplates(),
      readinessRuns: readReadinessRuns()
    };
  }
  function exportV62Bundle(){
    const bundle = buildReplicaBundle();
    const row = { id: uidFn(), at: nowFn(), mode:'export', type:bundle.type, counts:{ cases:bundle.serviceCases.length, assignments:bundle.assignments.length, readinessRuns:bundle.readinessRuns.length, shifts:bundle.shifts.length } };
    writeJSON(KEY_REPLICA_LOG, [row].concat(listify(readJSON(KEY_REPLICA_LOG, []))).slice(0, 120));
    if(typeof downloadText === 'function') downloadText(JSON.stringify(bundle, null, 2), 'platform_house_circle_v62_bundle_' + dayFn() + '.json', 'application/json');
    addAudit('v62-bundle-exported', bundle.type, 'good', row.counts);
    return bundle;
  }
  function previewReplicaMerge(payload){
    const bundle = payload && typeof payload === 'object' ? payload : {};
    const incomingState = bundle.state || (bundle.core && bundle.core.state) || {};
    const preview = {
      type: clean(bundle.type) || 'unknown',
      stateKeys: Object.keys(incomingState || {}).length,
      serviceCases: compareRows(readV61Cases(), bundle.serviceCases || (bundle.core && bundle.core.serviceCases) || []),
      automationRules: compareRows(readV61Rules(), bundle.automationRules || (bundle.core && bundle.core.automationRules) || []),
      playbooks: compareRows(readV61Playbooks(), bundle.playbooks || (bundle.core && bundle.core.playbooks) || []),
      signalRuns: compareRows(readV61Runs(), bundle.signalRuns || (bundle.core && bundle.core.signalRuns) || []),
      routeTasks: compareRows(readRouteTasksSafe(), bundle.routeTasks || (bundle.core && bundle.core.routeTasks) || []),
      shifts: compareRows(readShifts(), bundle.shifts || []),
      assignments: compareRows(readAssignments(), bundle.assignments || []),
      readinessTemplates: compareRows(readReadinessTemplates(), bundle.readinessTemplates || []),
      readinessRuns: compareRows(readReadinessRuns(), bundle.readinessRuns || [])
    };
    return preview;
  }
  function importV62Bundle(payload){
    requirePermission('export_data', 'Current operator cannot import replica bundles.');
    const bundle = payload && typeof payload === 'object' ? payload : {};
    const preview = previewReplicaMerge(bundle);
    const incomingState = bundle.state || (bundle.core && bundle.core.state) || {};
    if(incomingState && Object.keys(incomingState).length) saveState(mergeBaseState(state(), incomingState));
    writeJSON(KEY_CASES_V61, mergeRows(readV61Cases(), bundle.serviceCases || (bundle.core && bundle.core.serviceCases) || []).rows.slice(0, LIMIT_ROWS));
    writeJSON(KEY_RULES_V61, mergeRows(readV61Rules(), bundle.automationRules || (bundle.core && bundle.core.automationRules) || []).rows.slice(0, LIMIT_ROWS));
    writeJSON(KEY_PLAYBOOKS_V61, mergeRows(readV61Playbooks(), bundle.playbooks || (bundle.core && bundle.core.playbooks) || []).rows.slice(0, LIMIT_ROWS));
    writeJSON(KEY_RUNS_V61, mergeRows(readV61Runs(), bundle.signalRuns || (bundle.core && bundle.core.signalRuns) || []).rows.slice(0, LIMIT_ROWS));
    writeRouteTasksSafe(mergeRows(readRouteTasksSafe(), bundle.routeTasks || (bundle.core && bundle.core.routeTasks) || []).rows.slice(0, 800));
    saveShifts(mergeRows(readShifts(), bundle.shifts || []).rows);
    saveAssignments(mergeRows(readAssignments(), bundle.assignments || []).rows);
    saveReadinessTemplates(mergeRows(readReadinessTemplates(), bundle.readinessTemplates || []).rows);
    saveReadinessRuns(mergeRows(readReadinessRuns(), bundle.readinessRuns || []).rows);
    const log = { id: uidFn(), at: nowFn(), mode:'import', type: clean(bundle.type) || 'unknown', preview: preview };
    writeJSON(KEY_MERGE_LOG, [log].concat(listify(readJSON(KEY_MERGE_LOG, []))).slice(0, 120));
    addAudit('v62-bundle-imported', clean(bundle.type) || 'bundle', 'good', { shifts:(bundle.shifts || []).length, assignments:(bundle.assignments || []).length, readinessRuns:(bundle.readinessRuns || []).length });
    return preview;
  }

  function buildMeshMetrics(){
    const assignments = readAssignments();
    const runs = readReadinessRuns();
    const replica = listify(readJSON(KEY_REPLICA_LOG, []));
    return {
      activeShifts: readShifts().filter(function(item){ return item.status === 'active'; }).length,
      queuedAssignments: assignments.filter(function(item){ return item.status === 'queued' || item.status === 'in_progress'; }).length,
      completedAssignments: assignments.filter(function(item){ return item.status === 'completed'; }).length,
      readinessAttention: runs.filter(function(item){ return item.status === 'attention' || item.status === 'failed'; }).length,
      readinessOpen: runs.filter(function(item){ return item.status === 'open'; }).length,
      replicaExports: replica.filter(function(item){ return item.mode === 'export'; }).length
    };
  }

  function renderShiftRows(rows){
    return rows.length ? rows.map(function(item){
      return '<div class="item"><div class="meta"><div class="name">' + esc(item.title) + ' <span class="badge">' + esc(item.status) + '</span></div><div class="sub">' + esc(item.operatorName || 'Unassigned') + (item.locationId ? ' • ' + esc(findLocationName(item.locationId)) : '') + ' • ' + esc(fmtFn(item.startAt)) + '</div></div></div>';
    }).join('') : '<div class="hint">No shifts yet.</div>';
  }
  function renderAssignmentRows(rows){
    return rows.length ? rows.map(function(item){
      return '<div class="item"><div class="meta"><div class="name">' + esc(item.title) + ' <span class="badge">' + esc(item.status) + '</span></div><div class="sub">' + esc(item.operatorName || 'Unassigned') + (item.locationId ? ' • ' + esc(findLocationName(item.locationId)) : '') + ' • ' + esc(item.scheduledFor || '—') + '</div></div><div class="actions">' + (item.status !== 'completed' ? '<button class="btn small primary" data-hc62-assignment-complete="' + attr(item.id) + '">Complete</button>' : '<button class="btn small" data-hc62-assignment-export="' + attr(item.id) + '">JSON</button>') + '</div></div>';
    }).join('') : '<div class="hint">No assignments yet.</div>';
  }
  function renderRunRows(rows){
    return rows.length ? rows.map(function(item){
      return '<div class="item"><div class="meta"><div class="name">' + esc(item.title) + ' <span class="badge">' + esc(item.status) + '</span></div><div class="sub">' + esc(findLocationName(item.locationId) || 'No linked location') + ' • ' + esc(item.items.length + ' checklist items') + (item.failedCritical ? ' • required failure' : '') + '</div></div><div class="actions"><button class="btn small" data-hc62-run-open="' + attr(item.id) + '">Open</button></div></div>';
    }).join('') : '<div class="hint">No readiness runs yet.</div>';
  }
  function renderTemplateRows(rows){
    return rows.length ? rows.map(function(item){
      return '<div class="item"><div class="meta"><div class="name">' + esc(item.title) + ' <span class="badge">' + esc(item.lane) + '</span></div><div class="sub">' + esc(item.items.length + ' checklist items') + ' • ' + esc(item.severity) + '</div></div></div>';
    }).join('') : '<div class="hint">No readiness templates yet.</div>';
  }

  function openNewShiftModal(){
    const operatorOptions = readOperators().map(function(item){ return '<option value="' + attr(item.id) + '">' + esc(item.name) + '</option>'; }).join('');
    const locationOptions = readLocations().map(function(item){ return '<option value="' + attr(item.id) + '">' + esc(item.name) + '</option>'; }).join('');
    openModalFn('Create dispatch shift · V62', '<div class="fieldrow"><div class="field full"><label>Title</label><input id="hc62_shift_title" placeholder="Friday hospitality dispatch"/></div><div class="field"><label>Operator</label><select id="hc62_shift_operator">' + operatorOptions + '</select></div><div class="field"><label>Location</label><select id="hc62_shift_location"><option value="">—</option>' + locationOptions + '</select></div><div class="field"><label>Start</label><input id="hc62_shift_start" type="datetime-local"/></div><div class="field"><label>End</label><input id="hc62_shift_end" type="datetime-local"/></div><div class="field full"><label>Note</label><textarea id="hc62_shift_note" placeholder="Operator focus, venue scope, notes."></textarea></div></div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Cancel</button><button class="btn primary" id="hc62_shift_save">Save shift</button>');
    const saveBtn = document.getElementById('hc62_shift_save');
    if(saveBtn) saveBtn.onclick = function(){
      try{
        createShift({
          title: (document.getElementById('hc62_shift_title') || {}).value,
          operatorId: (document.getElementById('hc62_shift_operator') || {}).value,
          locationId: (document.getElementById('hc62_shift_location') || {}).value,
          startAt: (document.getElementById('hc62_shift_start') || {}).value || nowFn(),
          endAt: (document.getElementById('hc62_shift_end') || {}).value || '',
          note: (document.getElementById('hc62_shift_note') || {}).value
        });
        closeModalFn();
        openDispatchModal();
      }catch(err){ toastFn(clean(err && err.message) || 'Create shift failed.', 'bad'); }
    };
  }
  function openBuildWaveModal(){
    const operatorOptions = readOperators().map(function(item){ return '<option value="' + attr(item.id) + '">' + esc(item.name) + '</option>'; }).join('');
    const shiftOptions = readShifts().map(function(item){ return '<option value="' + attr(item.id) + '">' + esc(item.title) + ' • ' + esc(item.operatorName || 'Unassigned') + '</option>'; }).join('');
    openModalFn('Build dispatch wave · V62', '<div class="fieldrow"><div class="field"><label>Operator</label><select id="hc62_wave_operator">' + operatorOptions + '</select></div><div class="field"><label>Shift</label><select id="hc62_wave_shift"><option value="">—</option>' + shiftOptions + '</select></div><div class="field"><label>Assignments</label><input id="hc62_wave_count" type="number" min="1" max="12" value="4"/></div><div class="field"><label>Scheduled for</label><input id="hc62_wave_day" value="' + esc(dayFn()) + '"/></div></div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Cancel</button><button class="btn primary" id="hc62_wave_go">Build wave</button>');
    const goBtn = document.getElementById('hc62_wave_go');
    if(goBtn) goBtn.onclick = function(){
      try{
        buildWaveFromOpenCases({
          operatorId: (document.getElementById('hc62_wave_operator') || {}).value,
          shiftId: (document.getElementById('hc62_wave_shift') || {}).value,
          count: Number((document.getElementById('hc62_wave_count') || {}).value || 4),
          scheduledFor: (document.getElementById('hc62_wave_day') || {}).value
        });
        closeModalFn();
        openDispatchModal();
      }catch(err){ toastFn(clean(err && err.message) || 'Build wave failed.', 'bad'); }
    };
  }
  function openDispatchModal(){
    openModalFn('Dispatch mesh · V62', '<div class="hint">V62 adds real dispatch shifts and assignment waves so open hospitality cases become scheduled operating work inside the same Routex stack.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; margin-bottom:10px;"><button class="btn primary" id="hc62_new_shift">New shift</button><button class="btn" id="hc62_build_wave">Auto-build wave</button><button class="btn" id="hc62_export_dispatch">Export v62 bundle</button></div><div class="grid"><div class="card" style="grid-column:span 4;"><h2 style="margin:0 0 8px;">Shifts</h2><div class="list">' + renderShiftRows(readShifts().slice(0,8)) + '</div></div><div class="card" style="grid-column:span 8;"><h2 style="margin:0 0 8px;">Assignments</h2><div class="list">' + renderAssignmentRows(readAssignments().slice(0,14)) + '</div></div></div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>');
    const shiftBtn = document.getElementById('hc62_new_shift');
    const waveBtn = document.getElementById('hc62_build_wave');
    const exportBtn = document.getElementById('hc62_export_dispatch');
    if(shiftBtn) shiftBtn.onclick = openNewShiftModal;
    if(waveBtn) waveBtn.onclick = openBuildWaveModal;
    if(exportBtn) exportBtn.onclick = function(){ exportV62Bundle(); };
    Array.from(document.querySelectorAll('[data-hc62-assignment-complete]')).forEach(function(btn){ btn.onclick = function(){ try{ completeAssignment(btn.getAttribute('data-hc62-assignment-complete'), 'Completed from dispatch mesh.'); closeModalFn(); openDispatchModal(); }catch(err){ toastFn(clean(err && err.message) || 'Complete failed.', 'bad'); } }; });
    Array.from(document.querySelectorAll('[data-hc62-assignment-export]')).forEach(function(btn){ btn.onclick = function(){ const row = readAssignments().find(function(item){ return clean(item.id) === clean(btn.getAttribute('data-hc62-assignment-export')); }); if(row && typeof downloadText === 'function') downloadText(JSON.stringify(row, null, 2), 'assignment_' + row.id + '.json', 'application/json'); }; });
  }

  function openNewReadinessModal(){
    const templateOptions = readReadinessTemplates().map(function(item){ return '<option value="' + attr(item.id) + '">' + esc(item.title) + '</option>'; }).join('');
    const locationOptions = readLocations().map(function(item){ return '<option value="' + attr(item.id) + '">' + esc(item.name) + '</option>'; }).join('');
    openModalFn('Create readiness run · V62', '<div class="fieldrow"><div class="field"><label>Template</label><select id="hc62_template_id">' + templateOptions + '</select></div><div class="field"><label>Location</label><select id="hc62_template_location"><option value="">—</option>' + locationOptions + '</select></div><div class="field full"><label>Title override</label><input id="hc62_template_title" placeholder="Optional custom title"/></div></div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Cancel</button><button class="btn primary" id="hc62_readiness_go">Create run</button>');
    const goBtn = document.getElementById('hc62_readiness_go');
    if(goBtn) goBtn.onclick = function(){
      try{
        createReadinessRun({
          templateId: (document.getElementById('hc62_template_id') || {}).value,
          locationId: (document.getElementById('hc62_template_location') || {}).value,
          title: (document.getElementById('hc62_template_title') || {}).value
        });
        closeModalFn();
        openReadinessModal();
      }catch(err){ toastFn(clean(err && err.message) || 'Create readiness run failed.', 'bad'); }
    };
  }
  function openRunModal(runId){
    const run = readReadinessRuns().find(function(item){ return clean(item.id) === clean(runId); });
    if(!run) throw new Error('Readiness run not found.');
    const rows = run.items.map(function(item, idx){
      return '<div class="item"><div class="meta"><div class="name">' + esc(item.label) + (item.required ? ' <span class="badge">required</span>' : '') + '</div><div class="sub">State ' + esc(item.state || 'pending') + (item.note ? ' • ' + esc(item.note) : '') + '</div></div><div class="actions"><button class="btn small" data-hc62-run-pass="' + attr(run.id + '|' + idx) + '">Pass</button><button class="btn small" data-hc62-run-fail="' + attr(run.id + '|' + idx) + '">Fail</button></div></div>';
    }).join('');
    openModalFn('Readiness run • ' + esc(run.title), '<div class="hint">Required failures automatically escalate into a service case and Routex task.</div><div class="sep"></div><div class="list">' + rows + '</div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button><button class="btn primary" id="hc62_run_finalize">Finalize</button>');
    Array.from(document.querySelectorAll('[data-hc62-run-pass]')).forEach(function(btn){ btn.onclick = function(){ const parts = clean(btn.getAttribute('data-hc62-run-pass')).split('|'); updateReadinessItem(parts[0], Number(parts[1]), 'passed', 'Passed from V62 readiness modal.'); closeModalFn(); openRunModal(run.id); }; });
    Array.from(document.querySelectorAll('[data-hc62-run-fail]')).forEach(function(btn){ btn.onclick = function(){ const parts = clean(btn.getAttribute('data-hc62-run-fail')).split('|'); updateReadinessItem(parts[0], Number(parts[1]), 'failed', 'Failed from V62 readiness modal.'); closeModalFn(); openRunModal(run.id); }; });
    const finalizeBtn = document.getElementById('hc62_run_finalize');
    if(finalizeBtn) finalizeBtn.onclick = function(){ try{ updateReadinessRunState(run.id, readReadinessRuns().find(function(item){ return item.id === run.id; }).failedCritical ? 'failed' : 'passed'); closeModalFn(); openReadinessModal(); }catch(err){ toastFn(clean(err && err.message) || 'Finalize failed.', 'bad'); } };
  }
  function openReadinessModal(){
    openModalFn('Readiness mesh · V62', '<div class="hint">V62 adds venue readiness templates and runs so hospitality, event, and white-glove lanes can fail closed and auto-escalate when required items break.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; margin-bottom:10px;"><button class="btn primary" id="hc62_new_readiness">New readiness run</button><button class="btn" id="hc62_export_readiness">Export v62 bundle</button></div><div class="grid"><div class="card" style="grid-column:span 4;"><h2 style="margin:0 0 8px;">Templates</h2><div class="list">' + renderTemplateRows(readReadinessTemplates()) + '</div></div><div class="card" style="grid-column:span 8;"><h2 style="margin:0 0 8px;">Recent runs</h2><div class="list">' + renderRunRows(readReadinessRuns().slice(0,12)) + '</div></div></div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>');
    const newBtn = document.getElementById('hc62_new_readiness');
    const exportBtn = document.getElementById('hc62_export_readiness');
    if(newBtn) newBtn.onclick = openNewReadinessModal;
    if(exportBtn) exportBtn.onclick = function(){ exportV62Bundle(); };
    Array.from(document.querySelectorAll('[data-hc62-run-open]')).forEach(function(btn){ btn.onclick = function(){ openRunModal(btn.getAttribute('data-hc62-run-open')); }; });
  }

  function openReplicationModal(){
    const latestPreview = listify(readJSON(KEY_MERGE_LOG, []))[0];
    const previewHtml = latestPreview ? '<div class="card" style="margin-top:12px;"><h2 style="margin:0 0 8px;">Last merge preview</h2><div class="hint">Type ' + esc(latestPreview.type || 'bundle') + ' • assignments creates ' + esc(String((((latestPreview.preview || {}).assignments || {}).creates) || 0)) + ' • updates ' + esc(String((((latestPreview.preview || {}).assignments || {}).updates) || 0)) + '</div></div>' : '';
    openModalFn('Replica mesh · V62', '<div class="hint">This pass adds manual cross-device replica bundles with merge preview so the stack can move toward shared persistence without fake server theater.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; margin-bottom:10px;"><button class="btn primary" id="hc62_replica_export">Export v62 bundle</button><button class="btn" id="hc62_replica_preview">Preview merge</button><button class="btn" id="hc62_replica_import">Import merge</button></div><div class="field full"><label>Paste incoming bundle JSON</label><textarea id="hc62_replica_json" placeholder="Paste a v62 replica bundle here."></textarea></div>' + previewHtml, '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>');
    const exportBtn = document.getElementById('hc62_replica_export');
    const previewBtn = document.getElementById('hc62_replica_preview');
    const importBtn = document.getElementById('hc62_replica_import');
    if(exportBtn) exportBtn.onclick = function(){ exportV62Bundle(); };
    if(previewBtn) previewBtn.onclick = function(){
      try{
        const raw = (document.getElementById('hc62_replica_json') || {}).value || '{}';
        const preview = previewReplicaMerge(JSON.parse(raw));
        toastFn('Preview ready.', 'good');
        writeJSON(KEY_MERGE_LOG, [{ id:uidFn(), at:nowFn(), mode:'preview', type:preview.type, preview:preview }].concat(listify(readJSON(KEY_MERGE_LOG, []))).slice(0, 120));
        closeModalFn();
        openReplicationModal();
      }catch(err){ toastFn(clean(err && err.message) || 'Preview failed.', 'bad'); }
    };
    if(importBtn) importBtn.onclick = function(){
      try{
        const raw = (document.getElementById('hc62_replica_json') || {}).value || '{}';
        const preview = importV62Bundle(JSON.parse(raw));
        toastFn('Replica bundle merged.', 'good');
        closeModalFn();
        openReplicationModal();
      }catch(err){ toastFn(clean(err && err.message) || 'Import failed.', 'bad'); }
    };
  }

  function injectStyles(){
    if(document.getElementById('hc_v62_styles')) return;
    const style = document.createElement('style');
    style.id = 'hc_v62_styles';
    style.textContent = '.hc-v62-kpi{min-width:140px;padding:14px 16px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.04)}.hc-v62-kpi .n{font-size:1.5rem;font-weight:700}.hc-v62-kpi .d{font-size:.82rem;opacity:.78}';
    (document.head || document.body).appendChild(style);
  }
  function renderMeshCard(){
    if(!(typeof APP !== 'undefined' && APP && APP.view === 'platform-house')) return;
    const host = document.querySelector('#content') || document.querySelector('#app') || document.body;
    if(!host) return;
    const existing = document.getElementById('hc_v62_mesh_card');
    if(existing && existing.remove) existing.remove();
    const metrics = buildMeshMetrics();
    const card = document.createElement('div');
    card.id = 'hc_v62_mesh_card';
    card.className = 'card';
    card.innerHTML = '<h2 style="margin:0 0 8px;">Platform House Command Mesh · V62</h2><div class="hint">This pass adds dispatch shifts, assignment waves, venue readiness runs, and manual replica merge so House Circle becomes a deeper operating mesh inside Routex.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;">' +
      '<div class="hc-v62-kpi"><div class="n">' + esc(String(metrics.activeShifts)) + '</div><div class="d">Active shifts</div></div>' +
      '<div class="hc-v62-kpi"><div class="n">' + esc(String(metrics.queuedAssignments)) + '</div><div class="d">Queued assignments</div></div>' +
      '<div class="hc-v62-kpi"><div class="n">' + esc(String(metrics.completedAssignments)) + '</div><div class="d">Completed assignments</div></div>' +
      '<div class="hc-v62-kpi"><div class="n">' + esc(String(metrics.readinessAttention)) + '</div><div class="d">Readiness attention</div></div>' +
      '<div class="hc-v62-kpi"><div class="n">' + esc(String(metrics.replicaExports)) + '</div><div class="d">Replica exports</div></div>' +
      '</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; justify-content:flex-end;"><button class="btn" id="hc62_dispatch_btn">Dispatch mesh</button><button class="btn" id="hc62_readiness_btn">Readiness mesh</button><button class="btn" id="hc62_replica_btn">Replica mesh</button><button class="btn primary" id="hc62_export_btn">Export v62 bundle</button></div>';
    host.appendChild(card);
    const dispatchBtn = document.getElementById('hc62_dispatch_btn');
    const readinessBtn = document.getElementById('hc62_readiness_btn');
    const replicaBtn = document.getElementById('hc62_replica_btn');
    const exportBtn = document.getElementById('hc62_export_btn');
    if(dispatchBtn) dispatchBtn.onclick = openDispatchModal;
    if(readinessBtn) readinessBtn.onclick = openReadinessModal;
    if(replicaBtn) replicaBtn.onclick = openReplicationModal;
    if(exportBtn) exportBtn.onclick = function(){ exportV62Bundle(); };
  }
  function injectDashboardCard(){
    if(!(typeof APP !== 'undefined' && APP && APP.view === 'dashboard')) return;
    const grid = document.querySelector('#content .grid');
    if(!grid) return;
    const old = document.getElementById('hc_v62_dash_card');
    if(old && old.remove) old.remove();
    const metrics = buildMeshMetrics();
    const card = document.createElement('div');
    card.id = 'hc_v62_dash_card';
    card.className = 'card';
    card.style.gridColumn = 'span 12';
    card.innerHTML = '<h2>Platform House V62</h2><div class="hint">Dispatch mesh, readiness mesh, and replica merge now sit inside the platform core.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><div class="pill">Shifts ' + esc(String(metrics.activeShifts)) + '</div><div class="pill">Assignments ' + esc(String(metrics.queuedAssignments)) + '</div><div class="pill">Readiness attention ' + esc(String(metrics.readinessAttention)) + '</div><button class="btn" id="hc_v62_dash_open">Open command mesh</button></div>';
    grid.insertBefore(card, grid.children[1] || null);
    const btn = document.getElementById('hc_v62_dash_open');
    if(btn) btn.onclick = function(){ APP.routeId = null; APP.view = 'platform-house'; window.location.hash = 'platform-house'; if(typeof render === 'function') render(); };
  }

  function patchApis(){
    const api = base();
    if(!api || api.__v62Patched) return;
    api.readDispatchShifts = readShifts;
    api.createDispatchShift = createShift;
    api.readDispatchAssignments = readAssignments;
    api.createDispatchAssignment = createAssignment;
    api.completeDispatchAssignment = completeAssignment;
    api.buildDispatchWave = buildWaveFromOpenCases;
    api.readReadinessTemplates = readReadinessTemplates;
    api.readReadinessRuns = readReadinessRuns;
    api.createReadinessRun = createReadinessRun;
    api.updateReadinessItem = updateReadinessItem;
    api.exportUnifiedBundle = exportV62Bundle;
    api.importUnifiedBundle = importV62Bundle;
    api.buildReplicaBundle = buildReplicaBundle;
    api.previewReplicaMerge = previewReplicaMerge;
    api.buildMeshMetrics = buildMeshMetrics;
    api.__v62Patched = true;
  }
  function patchRender(){
    if(window.__ROUTEX_HC_V62_RENDER__) return;
    window.__ROUTEX_HC_V62_RENDER__ = true;
    const prev = typeof render === 'function' ? render : null;
    if(!prev) return;
    render = async function(){
      const out = await prev.apply(this, arguments);
      raf(function(){ try{ renderMeshCard(); injectDashboardCard(); }catch(_){ } });
      return out;
    };
  }
  function firstRunSeed(){
    readReadinessTemplates();
    if(!listify(readJSON(KEY_REPLICA_LOG, [])).length) addAudit('v62-seeded', 'Dispatch mesh, readiness mesh, and replica merge lanes seeded.', 'good', { version:'v62' });
  }
  function init(){
    if(!base() || !v60() || !v61()) return setTimeout(init, 40);
    injectStyles();
    firstRunSeed();
    patchApis();
    patchRender();
    raf(function(){ try{ renderMeshCard(); injectDashboardCard(); }catch(_){ } });
    window.RoutexPlatformHouseCircleV62 = {
      readShifts: readShifts,
      createShift: createShift,
      readAssignments: readAssignments,
      createAssignment: createAssignment,
      completeAssignment: completeAssignment,
      buildWaveFromOpenCases: buildWaveFromOpenCases,
      readReadinessTemplates: readReadinessTemplates,
      readReadinessRuns: readReadinessRuns,
      createReadinessRun: createReadinessRun,
      updateReadinessItem: updateReadinessItem,
      buildReplicaBundle: buildReplicaBundle,
      exportV62Bundle: exportV62Bundle,
      previewReplicaMerge: previewReplicaMerge,
      importV62Bundle: importV62Bundle,
      buildMeshMetrics: buildMeshMetrics
    };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
