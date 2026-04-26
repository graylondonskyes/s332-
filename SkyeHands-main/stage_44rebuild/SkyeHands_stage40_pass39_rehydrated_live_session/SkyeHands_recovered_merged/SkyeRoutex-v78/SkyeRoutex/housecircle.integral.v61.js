(function(){
  if(window.__ROUTEX_HOUSECIRCLE_V61__) return;
  window.__ROUTEX_HOUSECIRCLE_V61__ = true;

  const KEY_CASES = 'skye_routex_platform_house_circle_cases_v61';
  const KEY_RULES = 'skye_routex_platform_house_circle_rules_v61';
  const KEY_PLAYBOOKS = 'skye_routex_platform_house_circle_playbooks_v61';
  const KEY_RUNS = 'skye_routex_platform_house_circle_runs_v61';
  const KEY_EXPORT_OUTBOX = 'skye_routex_platform_house_circle_export_outbox_v61';
  const KEY_IMPORT_OUTBOX = 'skye_routex_platform_house_circle_import_outbox_v61';
  const LIMIT_CASES = 240;
  const LIMIT_RUNS = 280;

  const clean = window.cleanStr || function(v){ return String(v == null ? '' : v).trim(); };
  const esc = window.escapeHTML || function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(m){ return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m]; }); };
  const uidFn = (typeof uid === 'function') ? uid : function(){ return 'hc61-' + Math.random().toString(36).slice(2,10); };
  const nowFn = (typeof nowISO === 'function') ? nowISO : function(){ return new Date().toISOString(); };
  const dayFn = (typeof dayISO === 'function') ? dayISO : function(){ return new Date().toISOString().slice(0,10); };
  const fmtFn = (typeof fmt === 'function') ? fmt : function(v){ try{ return new Date(v || Date.now()).toLocaleString(); }catch(_){ return clean(v); } };
  const moneyFn = (typeof fmtMoney === 'function') ? fmtMoney : function(v){ return '$' + Number(v || 0).toFixed(2); };
  const toastFn = (typeof toast === 'function') ? toast : function(){};
  const openModalFn = (typeof openModal === 'function') ? openModal : function(title){ try{ alert(title); }catch(_){} };
  const closeModalFn = (typeof closeModal === 'function') ? closeModal : function(){};
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame.bind(window) : function(cb){ return setTimeout(cb, 0); };

  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function listify(v){ return Array.isArray(v) ? v.filter(Boolean) : []; }
  function compact(v){ return clean(v).replace(/\s+/g, ' ').trim(); }
  function lower(v){ return compact(v).toLowerCase(); }
  function normalizeEmail(v){ return clean(v).toLowerCase(); }
  function normalizePhone(v){ return clean(v).replace(/[^\d+]/g, ''); }
  function readJSON(key, fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function writeJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); return value; }
  function num(v){ const n = Number(v || 0); return Number.isFinite(n) ? n : 0; }
  function int(v){ return Math.max(0, Math.round(num(v))); }
  function attr(v){ return esc(String(v == null ? '' : v)).replace(/\n/g, '&#10;'); }

  function base(){ return window.RoutexPlatformHouseCircle || null; }
  function v60(){ return window.RoutexPlatformHouseCircleV60 || null; }
  function state(){
    const api = base();
    if(!api || typeof api.readState !== 'function') throw new Error('Base Platform House API unavailable.');
    return api.readState();
  }
  function saveState(next){
    const api = base();
    if(!api || typeof api.saveState !== 'function') throw new Error('Base Platform House save API unavailable.');
    return api.saveState(next);
  }
  function currentOperator(){
    const api = v60();
    return api && typeof api.currentOperator === 'function' ? api.currentOperator() : { id:'operator-founder-admin', name:'Skyes Over London', role:'founder_admin', email:'' };
  }
  function can(permission){
    const api = v60();
    return !permission || !(api && typeof api.can === 'function') ? true : api.can(permission);
  }
  function requirePermission(permission, message){
    if(permission && !can(permission)) throw new Error(message || ('Current operator cannot perform ' + permission + '.'));
  }
  function addAudit(action, detail, tone, meta){
    const api = v60();
    if(api && typeof api.readAudit === 'function'){
      try{
        const rows = listify(readJSON('skye_routex_platform_house_circle_audit_v60', [])).filter(Boolean);
        const op = currentOperator();
        const row = {
          id: uidFn(), at: nowFn(), action: compact(action), detail: compact(detail), tone: compact(tone), meta: meta && typeof meta === 'object' ? clone(meta) : {}, operatorId: clean(op.id), operatorName: compact(op.name)
        };
        rows.unshift(row);
        writeJSON('skye_routex_platform_house_circle_audit_v60', rows.slice(0, 240));
        return row;
      }catch(_){ }
    }
    return null;
  }

  function readRouteTasksSafe(){ try{ return typeof readRouteTasks === 'function' ? listify(readRouteTasks()) : []; }catch(_){ return []; } }
  function writeRouteTasksSafe(items){ try{ return typeof writeRouteTasks === 'function' ? writeRouteTasks(items) : items; }catch(_){ return items; } }
  function normalizeRouteTaskSafe(task){ try{ return typeof normalizeRouteTask === 'function' ? normalizeRouteTask(task) : task; }catch(_){ return task; } }
  function routesSafe(){ return (typeof APP !== 'undefined' && APP && APP.cached && Array.isArray(APP.cached.routes)) ? APP.cached.routes : []; }
  function stopsSafe(){ return (typeof APP !== 'undefined' && APP && APP.cached && Array.isArray(APP.cached.stops)) ? APP.cached.stops : []; }

  function locateLocationId(payload){
    const st = state();
    const rows = listify(st.locations);
    const direct = clean(payload && payload.locationId);
    if(direct && rows.find(function(item){ return clean(item.id) === direct; })) return direct;
    const sourceStopId = clean(payload && payload.stopId || payload && payload.sourceStopId);
    if(sourceStopId){
      const hit = rows.find(function(item){ return clean(item.sourceStopId) === sourceStopId; });
      if(hit) return hit.id;
    }
    const sourceRouteId = clean(payload && payload.routeId || payload && payload.sourceRouteId);
    if(sourceRouteId){
      const hit = rows.find(function(item){ return clean(item.sourceRouteId) === sourceRouteId; });
      if(hit) return hit.id;
    }
    const email = normalizeEmail(payload && (payload.email || payload.guestEmail || payload.businessEmail));
    if(email){
      const emailHit = rows.find(function(item){ return normalizeEmail(item.email) === email; });
      if(emailHit) return emailHit.id;
    }
    const name = lower(payload && (payload.locationName || payload.name || payload.label));
    if(name){
      const nameHit = rows.find(function(item){ return lower(item.name) === name; });
      if(nameHit) return nameHit.id;
    }
    return '';
  }
  function locateGuestId(payload, locationId){
    const st = state();
    const rows = listify(st.guests).filter(function(item){ return !locationId || clean(item.locationId) === clean(locationId); });
    const direct = clean(payload && payload.guestId);
    if(direct && rows.find(function(item){ return clean(item.id) === direct; })) return direct;
    const email = normalizeEmail(payload && (payload.email || payload.guestEmail));
    if(email){
      const hit = rows.find(function(item){ return normalizeEmail(item.email) === email; });
      if(hit) return hit.id;
    }
    const phone = normalizePhone(payload && payload.phone);
    if(phone){
      const hit = rows.find(function(item){ return normalizePhone(item.phone) === phone; });
      if(hit) return hit.id;
    }
    const name = lower(payload && (payload.name || payload.guestName || payload.contact));
    if(name){
      const hit = rows.find(function(item){ return lower(item.name) === name; });
      if(hit) return hit.id;
    }
    return '';
  }

  function buildTask(task){
    const op = currentOperator();
    return normalizeRouteTaskSafe({
      id: clean(task.id) || uidFn(),
      title: compact(task.title) || 'Platform House task',
      status: compact(task.status) || 'todo',
      priority: compact(task.priority) || 'normal',
      dueDate: clean(task.dueDate) || '',
      createdAt: clean(task.createdAt) || nowFn(),
      updatedAt: nowFn(),
      note: compact(task.note),
      tags: listify(task.tags).map(compact).slice(0, 14),
      routeId: clean(task.routeId),
      stopId: clean(task.stopId),
      source: compact(task.source) || 'platform-house-circle-v61',
      sourceId: clean(task.sourceId),
      owner: compact(task.owner) || op.name,
      ownerId: clean(task.ownerId) || op.id,
      locationId: clean(task.locationId),
      guestId: clean(task.guestId)
    });
  }
  function pushRouteTask(task){
    requirePermission('manage_bridge', 'Current operator cannot create Routex tasks.');
    const row = buildTask(task);
    const rows = readRouteTasksSafe().filter(function(item){ return clean(item.id) !== row.id; });
    rows.unshift(row);
    writeRouteTasksSafe(rows.slice(0, 500));
    addAudit('v61-route-task-created', row.title, 'good', { taskId: row.id, locationId: row.locationId, guestId: row.guestId });
    return row;
  }

  function normalizeChecklist(value){ return listify(value).map(function(item){ return compact(item); }).filter(Boolean).slice(0, 16); }

  function defaultPlaybooks(){
    return [
      {
        id: 'pb-vip-arrival',
        title: 'VIP Arrival Recovery',
        slug: 'vip-arrival-recovery',
        lane: 'hospitality',
        description: 'Escalate high-value hospitality moments into a tracked white-glove case and Routex follow-up.',
        severity: 'high',
        defaultTaskTitle: 'Prepare VIP hospitality follow-up',
        checklist: ['Confirm operator owner', 'Review last visit + spend', 'Prepare guest-facing follow-up', 'Queue Routex hospitality touch'],
        triggers: ['packet_redeemed', 'pos_ticket_logged'],
        active: true
      },
      {
        id: 'pb-stop-recovery',
        title: 'Missed Stop Recovery',
        slug: 'missed-stop-recovery',
        lane: 'ops',
        description: 'Turn failed, blocked, or no-show stop results into a recovery case with Routex follow-up.',
        severity: 'critical',
        defaultTaskTitle: 'Run missed-stop recovery',
        checklist: ['Review stop outcome', 'Contact venue/guest', 'Create corrected mission or appointment', 'Capture operator note'],
        triggers: ['stop_status_sync'],
        active: true
      },
      {
        id: 'pb-post-visit-revenue',
        title: 'Post-Visit Revenue Lift',
        slug: 'post-visit-revenue-lift',
        lane: 'bridge',
        description: 'Convert completed service touches into a revenue-lift follow-up task.',
        severity: 'medium',
        defaultTaskTitle: 'Run post-visit hospitality follow-up',
        checklist: ['Review service proof', 'Send hospitality offer', 'Log next opportunity'],
        triggers: ['stop_status_sync', 'mission_created'],
        active: true
      },
      {
        id: 'pb-event-activation',
        title: 'Event Activation Run',
        slug: 'event-activation-run',
        lane: 'bridge',
        description: 'Operationalize an event or member moment into a Routex mission plan.',
        severity: 'high',
        defaultTaskTitle: 'Build event activation mission',
        checklist: ['Review guest mix', 'Confirm route/operator lane', 'Prepare assets and checklist'],
        triggers: ['manual'],
        active: true
      }
    ];
  }

  function normalizePlaybook(item){
    const value = item && typeof item === 'object' ? item : {};
    return {
      id: clean(value.id) || uidFn(),
      title: compact(value.title) || 'Playbook',
      slug: compact(value.slug) || compact(value.title).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      lane: compact(value.lane) || 'hospitality',
      description: compact(value.description),
      severity: compact(value.severity) || 'medium',
      defaultTaskTitle: compact(value.defaultTaskTitle) || 'Platform House task',
      checklist: normalizeChecklist(value.checklist),
      triggers: listify(value.triggers).map(compact).filter(Boolean),
      active: value.active !== false,
      createdAt: clean(value.createdAt) || nowFn(),
      updatedAt: clean(value.updatedAt) || nowFn()
    };
  }
  function readPlaybooks(){
    let rows = listify(readJSON(KEY_PLAYBOOKS, [])).map(normalizePlaybook);
    if(!rows.length){ rows = defaultPlaybooks().map(normalizePlaybook); writeJSON(KEY_PLAYBOOKS, rows); }
    return rows;
  }
  function savePlaybooks(rows){ return writeJSON(KEY_PLAYBOOKS, listify(rows).map(normalizePlaybook)); }

  function defaultRules(){
    return [
      { id:'rule-pos-vip', title:'High-spend POS creates VIP case', active:true, trigger:'pos_ticket_logged', thresholdField:'amount', comparator:'gte', threshold:150, playbookId:'pb-vip-arrival', action:'case+task', severity:'high', noteTemplate:'High-spend POS ticket for {{locationName}} • {{money}}' },
      { id:'rule-stop-recovery', title:'Failed or blocked stop creates recovery case', active:true, trigger:'stop_status_sync', statusIn:['failed','blocked','no-show','cancelled'], playbookId:'pb-stop-recovery', action:'case+task', severity:'critical', noteTemplate:'Recovery required for stop {{label}} • {{status}}' },
      { id:'rule-packet-vip', title:'VIP packet redemption creates welcome case', active:true, trigger:'packet_redeemed', offerIncludes:'vip', playbookId:'pb-vip-arrival', action:'case', severity:'medium', noteTemplate:'VIP packet redeemed by {{guestName}}' },
      { id:'rule-stop-delivered', title:'Delivered stop creates post-visit task', active:true, trigger:'stop_status_sync', statusIn:['delivered','completed'], playbookId:'pb-post-visit-revenue', action:'task', severity:'medium', noteTemplate:'Post-visit follow-up for {{label}}' }
    ];
  }
  function normalizeRule(item){
    const value = item && typeof item === 'object' ? item : {};
    return {
      id: clean(value.id) || uidFn(),
      title: compact(value.title) || 'Automation rule',
      active: value.active !== false,
      trigger: compact(value.trigger) || 'manual',
      thresholdField: compact(value.thresholdField),
      comparator: compact(value.comparator) || 'gte',
      threshold: num(value.threshold),
      statusIn: listify(value.statusIn).map(function(v){ return lower(v); }).filter(Boolean),
      offerIncludes: lower(value.offerIncludes),
      playbookId: clean(value.playbookId),
      action: compact(value.action) || 'case',
      severity: compact(value.severity) || 'medium',
      noteTemplate: compact(value.noteTemplate),
      createdAt: clean(value.createdAt) || nowFn(),
      updatedAt: clean(value.updatedAt) || nowFn()
    };
  }
  function readAutomationRules(){
    let rows = listify(readJSON(KEY_RULES, [])).map(normalizeRule);
    if(!rows.length){ rows = defaultRules().map(normalizeRule); writeJSON(KEY_RULES, rows); }
    return rows;
  }
  function saveAutomationRules(rows){ return writeJSON(KEY_RULES, listify(rows).map(normalizeRule)); }

  function normalizeServiceCase(item){
    const value = item && typeof item === 'object' ? item : {};
    return {
      id: clean(value.id) || uidFn(),
      title: compact(value.title) || 'Service case',
      type: compact(value.type) || 'hospitality',
      status: compact(value.status) || 'open',
      severity: compact(value.severity) || 'medium',
      lane: compact(value.lane) || 'hospitality',
      locationId: clean(value.locationId),
      guestId: clean(value.guestId),
      routeId: clean(value.routeId),
      stopId: clean(value.stopId),
      sourceType: compact(value.sourceType),
      sourceId: clean(value.sourceId),
      playbookId: clean(value.playbookId),
      ownerId: clean(value.ownerId),
      ownerName: compact(value.ownerName),
      note: compact(value.note),
      checklist: normalizeChecklist(value.checklist),
      meta: value.meta && typeof value.meta === 'object' ? clone(value.meta) : {},
      createdAt: clean(value.createdAt) || nowFn(),
      updatedAt: clean(value.updatedAt) || nowFn(),
      resolvedAt: clean(value.resolvedAt)
    };
  }
  function readServiceCases(){ return listify(readJSON(KEY_CASES, [])).map(normalizeServiceCase).slice(0, LIMIT_CASES); }
  function saveServiceCases(rows){ return writeJSON(KEY_CASES, listify(rows).map(normalizeServiceCase).slice(0, LIMIT_CASES)); }
  function upsertServiceCase(caseRow){
    const row = normalizeServiceCase(caseRow);
    const rows = readServiceCases().filter(function(item){ return clean(item.id) !== row.id; });
    rows.unshift(row);
    saveServiceCases(rows);
    return row;
  }
  function findCase(id){ return readServiceCases().find(function(item){ return clean(item.id) === clean(id); }) || null; }

  function normalizeRun(item){
    const value = item && typeof item === 'object' ? item : {};
    return {
      id: clean(value.id) || uidFn(),
      at: clean(value.at) || nowFn(),
      trigger: compact(value.trigger) || 'manual',
      ruleId: clean(value.ruleId),
      ruleTitle: compact(value.ruleTitle),
      playbookId: clean(value.playbookId),
      playbookTitle: compact(value.playbookTitle),
      action: compact(value.action),
      status: compact(value.status) || 'ran',
      caseId: clean(value.caseId),
      taskId: clean(value.taskId),
      locationId: clean(value.locationId),
      guestId: clean(value.guestId),
      note: compact(value.note),
      payload: value.payload && typeof value.payload === 'object' ? clone(value.payload) : {}
    };
  }
  function readSignalRuns(){ return listify(readJSON(KEY_RUNS, [])).map(normalizeRun).slice(0, LIMIT_RUNS); }
  function pushSignalRun(run){
    const row = normalizeRun(run);
    const rows = readSignalRuns().filter(function(item){ return clean(item.id) !== row.id; });
    rows.unshift(row);
    writeJSON(KEY_RUNS, rows.slice(0, LIMIT_RUNS));
    return row;
  }

  function findLocationName(id){
    const st = state();
    const hit = listify(st.locations).find(function(item){ return clean(item.id) === clean(id); });
    return hit ? hit.name : '';
  }
  function findGuestName(id){
    const st = state();
    const hit = listify(st.guests).find(function(item){ return clean(item.id) === clean(id); });
    return hit ? hit.name : '';
  }
  function templateNote(template, payload){
    const data = Object.assign({}, payload || {}, {
      money: moneyFn(payload && payload.amount),
      guestName: compact(payload && (payload.guestName || payload.name || payload.contact)),
      locationName: compact(payload && (payload.locationName || payload.label || findLocationName(payload && payload.locationId))),
      status: compact(payload && payload.status),
      label: compact(payload && payload.label)
    });
    return compact(String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, function(_, key){ return data[key] == null ? '' : String(data[key]); }));
  }

  function buildCaseTitle(playbook, payload, fallback){
    const pieces = [playbook && playbook.title, compact(payload && (payload.locationName || payload.label)), compact(payload && (payload.guestName || payload.name)), compact(payload && payload.status)].filter(Boolean);
    return pieces.join(' • ') || fallback || 'Service case';
  }

  function createServiceCase(payload){
    requirePermission('manage_hospitality', 'Current operator cannot create service cases.');
    const op = currentOperator();
    const locationId = locateLocationId(payload);
    const guestId = locateGuestId(payload, locationId);
    const row = upsertServiceCase({
      id: clean(payload && payload.id) || uidFn(),
      title: payload && payload.title,
      type: payload && payload.type,
      lane: payload && payload.lane,
      status: payload && payload.status || 'open',
      severity: payload && payload.severity,
      locationId: payload && payload.locationId || locationId,
      guestId: payload && payload.guestId || guestId,
      routeId: payload && payload.routeId,
      stopId: payload && payload.stopId,
      sourceType: payload && payload.sourceType,
      sourceId: payload && payload.sourceId,
      playbookId: payload && payload.playbookId,
      ownerId: op.id,
      ownerName: op.name,
      note: payload && payload.note,
      checklist: payload && payload.checklist,
      meta: payload && payload.meta,
      createdAt: nowFn(),
      updatedAt: nowFn()
    });
    addAudit('v61-service-case-created', row.title, row.severity === 'critical' ? 'bad' : 'good', { caseId: row.id, locationId: row.locationId, guestId: row.guestId });
    return row;
  }
  function updateServiceCase(id, patch){
    const current = findCase(id);
    if(!current) throw new Error('Service case not found.');
    const next = upsertServiceCase(Object.assign({}, current, patch || {}, { id: current.id, updatedAt: nowFn() }));
    addAudit('v61-service-case-updated', next.title, next.status === 'resolved' ? 'good' : 'warn', { caseId: next.id, status: next.status });
    return next;
  }
  function resolveServiceCase(id, note){
    requirePermission('manage_hospitality', 'Current operator cannot resolve service cases.');
    return updateServiceCase(id, { status:'resolved', note: compact([findCase(id).note, note].filter(Boolean).join(' • ')), resolvedAt: nowFn() });
  }

  function matchRule(rule, trigger, payload){
    if(!rule.active) return false;
    if(compact(rule.trigger) !== compact(trigger)) return false;
    if(rule.statusIn.length){
      const status = lower(payload && payload.status);
      if(!rule.statusIn.includes(status)) return false;
    }
    if(rule.offerIncludes){
      const offer = lower(payload && payload.offer);
      if(offer.indexOf(rule.offerIncludes) === -1) return false;
    }
    if(rule.thresholdField){
      const value = num(payload && payload[rule.thresholdField]);
      const threshold = num(rule.threshold);
      if(rule.comparator === 'gt' && !(value > threshold)) return false;
      if(rule.comparator === 'gte' && !(value >= threshold)) return false;
      if(rule.comparator === 'lt' && !(value < threshold)) return false;
      if(rule.comparator === 'lte' && !(value <= threshold)) return false;
    }
    return true;
  }

  function runPlaybook(playbookId, payload, contextMeta){
    const playbook = readPlaybooks().find(function(item){ return clean(item.id) === clean(playbookId); });
    if(!playbook) throw new Error('Playbook not found.');
    const locationId = locateLocationId(payload);
    const guestId = locateGuestId(payload, locationId);
    const title = buildCaseTitle(playbook, payload, playbook.title);
    let serviceCase = null;
    let task = null;
    if((contextMeta && contextMeta.action || '').indexOf('case') !== -1 || !contextMeta || !contextMeta.action){
      serviceCase = createServiceCase({
        title: title,
        type: playbook.slug,
        lane: playbook.lane,
        severity: contextMeta && contextMeta.severity || playbook.severity,
        locationId: locationId,
        guestId: guestId,
        routeId: payload && payload.routeId,
        stopId: payload && payload.stopId,
        sourceType: contextMeta && contextMeta.trigger,
        sourceId: payload && (payload.sourceId || payload.id || payload.code || payload.stopId || payload.routeId),
        playbookId: playbook.id,
        note: compact(contextMeta && contextMeta.note || playbook.description),
        checklist: playbook.checklist,
        meta: { trigger: contextMeta && contextMeta.trigger, payload: clone(payload || {}) }
      });
    }
    if((contextMeta && contextMeta.action || '').indexOf('task') !== -1 || (contextMeta && contextMeta.action === 'case+task')){
      task = pushRouteTask({
        title: compact((playbook.defaultTaskTitle || playbook.title) + (locationId ? ' • ' + findLocationName(locationId) : '')),
        note: compact((contextMeta && contextMeta.note) || playbook.description),
        priority: contextMeta && contextMeta.severity === 'critical' ? 'high' : 'normal',
        dueDate: dayFn(),
        tags: ['platform-house-circle', 'v61', playbook.slug, compact(contextMeta && contextMeta.trigger || 'manual')],
        sourceId: payload && (payload.sourceId || payload.id || payload.code || payload.stopId),
        locationId: locationId,
        guestId: guestId,
        routeId: payload && payload.routeId,
        stopId: payload && payload.stopId
      });
    }
    const run = pushSignalRun({
      trigger: compact(contextMeta && contextMeta.trigger || 'manual'),
      ruleId: clean(contextMeta && contextMeta.ruleId),
      ruleTitle: compact(contextMeta && contextMeta.ruleTitle),
      playbookId: playbook.id,
      playbookTitle: playbook.title,
      action: compact(contextMeta && contextMeta.action || 'case'),
      status: 'ran',
      caseId: clean(serviceCase && serviceCase.id),
      taskId: clean(task && task.id),
      locationId: locationId,
      guestId: guestId,
      note: compact(contextMeta && contextMeta.note || playbook.description),
      payload: payload && typeof payload === 'object' ? clone(payload) : {}
    });
    addAudit('v61-playbook-ran', playbook.title, 'good', { runId: run.id, caseId: run.caseId, taskId: run.taskId, trigger: run.trigger });
    return { playbook: playbook, case: serviceCase, task: task, run: run };
  }

  function emitSignal(trigger, payload){
    const rules = readAutomationRules().filter(function(rule){ return matchRule(rule, trigger, payload || {}); });
    const runs = [];
    rules.forEach(function(rule){
      try{
        const playbookId = clean(rule.playbookId) || (readPlaybooks()[0] && readPlaybooks()[0].id);
        const outcome = runPlaybook(playbookId, payload || {}, {
          trigger: trigger,
          ruleId: rule.id,
          ruleTitle: rule.title,
          action: rule.action,
          severity: rule.severity,
          note: templateNote(rule.noteTemplate, payload || {}) || rule.title
        });
        runs.push(outcome.run);
      }catch(err){
        const failed = pushSignalRun({
          trigger: trigger,
          ruleId: rule.id,
          ruleTitle: rule.title,
          playbookId: rule.playbookId,
          action: rule.action,
          status: 'failed',
          note: clean(err && err.message) || 'Rule failed',
          payload: payload && typeof payload === 'object' ? clone(payload) : {}
        });
        runs.push(failed);
        addAudit('v61-rule-failed', rule.title, 'bad', { runId: failed.id, error: failed.note });
      }
    });
    return runs;
  }

  function createAutomationRule(payload){
    requirePermission('manage_hospitality', 'Current operator cannot manage automation rules.');
    const row = normalizeRule(Object.assign({}, payload || {}, { id: clean(payload && payload.id) || uidFn(), createdAt: nowFn(), updatedAt: nowFn() }));
    const rows = readAutomationRules().filter(function(item){ return clean(item.id) !== row.id; });
    rows.unshift(row);
    saveAutomationRules(rows);
    addAudit('v61-rule-created', row.title, 'good', { ruleId: row.id, trigger: row.trigger, playbookId: row.playbookId });
    return row;
  }
  function toggleAutomationRule(id){
    requirePermission('manage_hospitality', 'Current operator cannot manage automation rules.');
    const current = readAutomationRules().find(function(item){ return clean(item.id) === clean(id); });
    if(!current) throw new Error('Automation rule not found.');
    const row = normalizeRule(Object.assign({}, current, { active: !current.active, updatedAt: nowFn() }));
    const rows = readAutomationRules().map(function(item){ return clean(item.id) === row.id ? row : item; });
    saveAutomationRules(rows);
    addAudit('v61-rule-toggled', row.title, row.active ? 'good' : 'warn', { ruleId: row.id, active: row.active });
    return row;
  }

  function buildMetrics(){
    const cases = readServiceCases();
    const rules = readAutomationRules();
    const playbooks = readPlaybooks();
    const runs = readSignalRuns();
    const openCases = cases.filter(function(item){ return item.status !== 'resolved'; });
    return {
      openCases: openCases.length,
      criticalCases: openCases.filter(function(item){ return item.severity === 'critical'; }).length,
      activeRules: rules.filter(function(item){ return item.active; }).length,
      playbooks: playbooks.length,
      runs: runs.length,
      tasks: readRouteTasksSafe().filter(function(item){ return lower(item.source) === 'platform-house-circle-v61' || listify(item.tags).some(function(tag){ return lower(tag) === 'v61'; }); }).length
    };
  }

  function buildBundle(){
    return {
      type: 'skye-routex-platform-house-circle-v61',
      version: '61.0.0',
      exportedAt: nowFn(),
      state: state(),
      operators: v60() && typeof v60().readOperators === 'function' ? v60().readOperators() : [],
      currentOperator: currentOperator(),
      joinPackets: v60() && typeof v60().readJoinPackets === 'function' ? v60().readJoinPackets() : [],
      checkins: v60() && typeof v60().readCheckins === 'function' ? v60().readCheckins() : [],
      posTickets: v60() && typeof v60().readPosTickets === 'function' ? v60().readPosTickets() : [],
      audit: v60() && typeof v60().readAudit === 'function' ? v60().readAudit() : [],
      routeTasks: readRouteTasksSafe(),
      serviceCases: readServiceCases(),
      automationRules: readAutomationRules(),
      playbooks: readPlaybooks(),
      signalRuns: readSignalRuns()
    };
  }
  function exportV61Bundle(){
    const bundle = buildBundle();
    writeJSON(KEY_EXPORT_OUTBOX, [ { id: uidFn(), at: nowFn(), bundleType: bundle.type, counts: { cases: bundle.serviceCases.length, rules: bundle.automationRules.length, runs: bundle.signalRuns.length } } ].concat(listify(readJSON(KEY_EXPORT_OUTBOX, []))).slice(0, 80));
    if(typeof downloadText === 'function') downloadText(JSON.stringify(bundle, null, 2), 'platform_house_circle_v61_bundle_' + dayFn() + '.json', 'application/json');
    addAudit('v61-bundle-exported', bundle.type, 'good', { cases: bundle.serviceCases.length, rules: bundle.automationRules.length, runs: bundle.signalRuns.length });
    return bundle;
  }
  function importV61Bundle(payload){
    requirePermission('export_data', 'Current operator cannot import bundles.');
    const data = payload && typeof payload === 'object' ? payload : {};
    if(data.state && base() && typeof base().importUnifiedBundle === 'function'){
      try{ base().importUnifiedBundle(data.state.type ? data.state : { state:data.state }); }catch(_){ try{ if(data.state) saveState(data.state); }catch(__){} }
    }else if(data.state){
      saveState(data.state);
    }
    if(Array.isArray(data.serviceCases)) saveServiceCases(data.serviceCases);
    if(Array.isArray(data.automationRules)) saveAutomationRules(data.automationRules);
    if(Array.isArray(data.playbooks)) savePlaybooks(data.playbooks);
    if(Array.isArray(data.signalRuns)) writeJSON(KEY_RUNS, data.signalRuns.map(normalizeRun).slice(0, LIMIT_RUNS));
    if(Array.isArray(data.routeTasks) && data.routeTasks.length) writeRouteTasksSafe(data.routeTasks.map(normalizeRouteTaskSafe));
    writeJSON(KEY_IMPORT_OUTBOX, [ { id: uidFn(), at: nowFn(), bundleType: clean(data.type) || 'unknown', counts: { cases: listify(data.serviceCases).length, rules: listify(data.automationRules).length, runs: listify(data.signalRuns).length } } ].concat(listify(readJSON(KEY_IMPORT_OUTBOX, []))).slice(0, 80));
    addAudit('v61-bundle-imported', clean(data.type) || 'bundle', 'good', { cases: listify(data.serviceCases).length, rules: listify(data.automationRules).length, runs: listify(data.signalRuns).length });
    return true;
  }

  function renderCaseRows(cases){
    return cases.length ? cases.map(function(item){
      return '<div class="item"><div class="meta"><div class="name">' + esc(item.title) + ' <span class="badge">' + esc(item.severity) + '</span> <span class="badge">' + esc(item.status) + '</span></div><div class="sub">' + esc(findLocationName(item.locationId) || 'No linked location') + (item.guestId ? ' • ' + esc(findGuestName(item.guestId)) : '') + ' • ' + esc(fmtFn(item.createdAt)) + (item.note ? ' • ' + esc(item.note) : '') + '</div></div><div class="actions"><button class="btn small" data-hc61-case-export="' + attr(item.id) + '">JSON</button>' + (item.status !== 'resolved' ? '<button class="btn small primary" data-hc61-case-resolve="' + attr(item.id) + '">Resolve</button>' : '') + '</div></div>';
    }).join('') : '<div class="hint">No service cases yet.</div>';
  }
  function renderRuleRows(rules){
    return rules.length ? rules.map(function(item){
      return '<div class="item"><div class="meta"><div class="name">' + esc(item.title) + ' <span class="badge">' + esc(item.trigger) + '</span> <span class="badge">' + (item.active ? 'active' : 'paused') + '</span></div><div class="sub">Action ' + esc(item.action) + ' • Playbook ' + esc((readPlaybooks().find(function(pb){ return pb.id === item.playbookId; }) || {}).title || item.playbookId || '—') + '</div></div><div class="actions"><button class="btn small" data-hc61-rule-toggle="' + attr(item.id) + '">' + (item.active ? 'Pause' : 'Resume') + '</button></div></div>';
    }).join('') : '<div class="hint">No automation rules yet.</div>';
  }
  function renderPlaybookRows(playbooks){
    return playbooks.length ? playbooks.map(function(item){
      return '<div class="item"><div class="meta"><div class="name">' + esc(item.title) + ' <span class="badge">' + esc(item.lane) + '</span></div><div class="sub">' + esc(item.description) + (item.checklist.length ? ' • ' + esc(item.checklist.length + ' checklist items') : '') + '</div></div><div class="actions"><button class="btn small primary" data-hc61-playbook-run="' + attr(item.id) + '">Run</button></div></div>';
    }).join('') : '<div class="hint">No playbooks yet.</div>';
  }

  function openCasesModal(){
    const cases = readServiceCases();
    openModalFn('Service cases · V61', '<div class="hint">Major V61 pass: service cases are now a first-class stack object across hospitality, operations, and Routex follow-up.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; margin-bottom:10px;"><button class="btn primary" id="hc61_new_case">New case</button><button class="btn" id="hc61_export_bundle_cases">Export v61 bundle</button></div><div class="list">' + renderCaseRows(cases.slice(0, 18)) + '</div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>');
    const newBtn = document.getElementById('hc61_new_case');
    const exBtn = document.getElementById('hc61_export_bundle_cases');
    if(newBtn) newBtn.onclick = openNewCaseModal;
    if(exBtn) exBtn.onclick = function(){ exportV61Bundle(); };
    Array.from(document.querySelectorAll('[data-hc61-case-resolve]')).forEach(function(btn){ btn.onclick = function(){ try{ resolveServiceCase(btn.getAttribute('data-hc61-case-resolve'), 'Resolved from V61 command deck.'); closeModalFn(); openCasesModal(); }catch(err){ toastFn(clean(err && err.message) || 'Resolve failed.', 'bad'); } }; });
    Array.from(document.querySelectorAll('[data-hc61-case-export]')).forEach(function(btn){ btn.onclick = function(){ const row = findCase(btn.getAttribute('data-hc61-case-export')); if(row && typeof downloadText === 'function') downloadText(JSON.stringify(row, null, 2), 'service_case_' + row.id + '.json', 'application/json'); }; });
  }

  function openNewCaseModal(){
    const st = state();
    const locationOptions = listify(st.locations).map(function(item){ return '<option value="' + attr(item.id) + '">' + esc(item.name) + '</option>'; }).join('');
    const guestOptions = listify(st.guests).slice(0, 120).map(function(item){ return '<option value="' + attr(item.id) + '">' + esc(item.name) + '</option>'; }).join('');
    const playbookOptions = readPlaybooks().map(function(item){ return '<option value="' + attr(item.id) + '">' + esc(item.title) + '</option>'; }).join('');
    openModalFn('Create service case', '<div class="fieldrow"><div class="field full"><label>Title</label><input id="hc61_case_title" placeholder="VIP recovery at Downtown House"/></div><div class="field"><label>Severity</label><select id="hc61_case_severity"><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div><div class="field"><label>Location</label><select id="hc61_case_location"><option value="">—</option>' + locationOptions + '</select></div><div class="field"><label>Guest</label><select id="hc61_case_guest"><option value="">—</option>' + guestOptions + '</select></div><div class="field"><label>Playbook</label><select id="hc61_case_playbook"><option value="">—</option>' + playbookOptions + '</select></div><div class="field full"><label>Note</label><textarea id="hc61_case_note" placeholder="What requires attention?"></textarea></div></div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Cancel</button><button class="btn primary" id="hc61_case_save">Save case</button>');
    const saveBtn = document.getElementById('hc61_case_save');
    if(saveBtn) saveBtn.onclick = function(){
      try{
        const playbookId = clean((document.getElementById('hc61_case_playbook') || {}).value);
        const playbook = playbookId ? readPlaybooks().find(function(item){ return item.id === playbookId; }) : null;
        createServiceCase({
          title: (document.getElementById('hc61_case_title') || {}).value,
          severity: (document.getElementById('hc61_case_severity') || {}).value,
          locationId: (document.getElementById('hc61_case_location') || {}).value,
          guestId: (document.getElementById('hc61_case_guest') || {}).value,
          playbookId: playbookId,
          checklist: playbook ? playbook.checklist : [],
          note: (document.getElementById('hc61_case_note') || {}).value,
          lane: playbook ? playbook.lane : 'hospitality'
        });
        closeModalFn();
        openCasesModal();
      }catch(err){ toastFn(clean(err && err.message) || 'Save case failed.', 'bad'); }
    };
  }

  function openRulesModal(){
    const rules = readAutomationRules();
    openModalFn('Automation rules · V61', '<div class="hint">These rules let Platform House signals automatically generate service cases and Routex tasks without patchworking the domains together.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; margin-bottom:10px;"><button class="btn primary" id="hc61_rule_new">New rule</button></div><div class="list">' + renderRuleRows(rules) + '</div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>');
    const newBtn = document.getElementById('hc61_rule_new');
    if(newBtn) newBtn.onclick = openNewRuleModal;
    Array.from(document.querySelectorAll('[data-hc61-rule-toggle]')).forEach(function(btn){ btn.onclick = function(){ try{ toggleAutomationRule(btn.getAttribute('data-hc61-rule-toggle')); closeModalFn(); openRulesModal(); }catch(err){ toastFn(clean(err && err.message) || 'Toggle failed.', 'bad'); } }; });
  }

  function openNewRuleModal(){
    const playbookOptions = readPlaybooks().map(function(item){ return '<option value="' + attr(item.id) + '">' + esc(item.title) + '</option>'; }).join('');
    openModalFn('Create automation rule', '<div class="fieldrow"><div class="field full"><label>Title</label><input id="hc61_rule_title" placeholder="High-spend VIP escalation"/></div><div class="field"><label>Trigger</label><select id="hc61_rule_trigger"><option value="pos_ticket_logged">POS ticket logged</option><option value="packet_redeemed">Packet redeemed</option><option value="stop_status_sync">Stop status sync</option></select></div><div class="field"><label>Action</label><select id="hc61_rule_action"><option value="case">Case</option><option value="task">Task</option><option value="case+task">Case + task</option></select></div><div class="field"><label>Severity</label><select id="hc61_rule_severity"><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div><div class="field"><label>Threshold field</label><select id="hc61_rule_field"><option value="">—</option><option value="amount">Amount</option></select></div><div class="field"><label>Threshold</label><input id="hc61_rule_threshold" type="number" min="0" step="1" value="150"/></div><div class="field"><label>Status match</label><input id="hc61_rule_status" placeholder="failed, blocked or delivered"/></div><div class="field"><label>Offer contains</label><input id="hc61_rule_offer" placeholder="vip"/></div><div class="field full"><label>Playbook</label><select id="hc61_rule_playbook">' + playbookOptions + '</select></div><div class="field full"><label>Note template</label><input id="hc61_rule_note" placeholder="Recovery required for {{label}} • {{status}}"/></div></div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Cancel</button><button class="btn primary" id="hc61_rule_save">Save rule</button>');
    const saveBtn = document.getElementById('hc61_rule_save');
    if(saveBtn) saveBtn.onclick = function(){
      try{
        createAutomationRule({
          title: (document.getElementById('hc61_rule_title') || {}).value,
          trigger: (document.getElementById('hc61_rule_trigger') || {}).value,
          action: (document.getElementById('hc61_rule_action') || {}).value,
          severity: (document.getElementById('hc61_rule_severity') || {}).value,
          thresholdField: (document.getElementById('hc61_rule_field') || {}).value,
          threshold: (document.getElementById('hc61_rule_threshold') || {}).value,
          statusIn: String((document.getElementById('hc61_rule_status') || {}).value || '').split(',').map(function(v){ return v.trim(); }).filter(Boolean),
          offerIncludes: (document.getElementById('hc61_rule_offer') || {}).value,
          playbookId: (document.getElementById('hc61_rule_playbook') || {}).value,
          noteTemplate: (document.getElementById('hc61_rule_note') || {}).value
        });
        closeModalFn();
        openRulesModal();
      }catch(err){ toastFn(clean(err && err.message) || 'Save rule failed.', 'bad'); }
    };
  }

  function openPlaybooksModal(){
    const playbooks = readPlaybooks();
    openModalFn('Playbooks · V61', '<div class="hint">Playbooks turn hospitality, membership, and stop-state signals into repeatable operating motions inside the Routex stack.</div><div class="sep"></div><div class="list">' + renderPlaybookRows(playbooks) + '</div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Close</button>');
    Array.from(document.querySelectorAll('[data-hc61-playbook-run]')).forEach(function(btn){ btn.onclick = function(){ openRunPlaybookModal(btn.getAttribute('data-hc61-playbook-run')); }; });
  }

  function openRunPlaybookModal(playbookId){
    const st = state();
    const locationOptions = listify(st.locations).map(function(item){ return '<option value="' + attr(item.id) + '">' + esc(item.name) + '</option>'; }).join('');
    const guestOptions = listify(st.guests).slice(0, 120).map(function(item){ return '<option value="' + attr(item.id) + '">' + esc(item.name) + '</option>'; }).join('');
    const playbook = readPlaybooks().find(function(item){ return item.id === playbookId; });
    if(!playbook) return;
    openModalFn('Run playbook • ' + esc(playbook.title), '<div class="hint">This creates the case/task motion directly from the V61 command deck.</div><div class="sep"></div><div class="fieldrow"><div class="field"><label>Location</label><select id="hc61_run_location"><option value="">—</option>' + locationOptions + '</select></div><div class="field"><label>Guest</label><select id="hc61_run_guest"><option value="">—</option>' + guestOptions + '</select></div><div class="field full"><label>Note</label><textarea id="hc61_run_note" placeholder="Optional context for the run."></textarea></div></div>', '<button class="btn" onclick="document.getElementById(\'modalClose\').click()">Cancel</button><button class="btn primary" id="hc61_run_go">Run</button>');
    const goBtn = document.getElementById('hc61_run_go');
    if(goBtn) goBtn.onclick = function(){
      try{
        runPlaybook(playbook.id, {
          locationId: (document.getElementById('hc61_run_location') || {}).value,
          guestId: (document.getElementById('hc61_run_guest') || {}).value,
          locationName: findLocationName((document.getElementById('hc61_run_location') || {}).value),
          guestName: findGuestName((document.getElementById('hc61_run_guest') || {}).value)
        }, {
          trigger: 'manual',
          action: 'case+task',
          severity: playbook.severity,
          note: (document.getElementById('hc61_run_note') || {}).value || playbook.description
        });
        closeModalFn();
        openCasesModal();
      }catch(err){ toastFn(clean(err && err.message) || 'Playbook run failed.', 'bad'); }
    };
  }

  function injectStyles(){
    if(document.getElementById('hc-v61-style')) return;
    const style = document.createElement('style');
    style.id = 'hc-v61-style';
    style.textContent = '.hc-v61-command{margin-top:12px}.hc-v61-command .row{gap:8px}.hc-v61-kpi{min-width:150px;padding:14px 16px;border-radius:18px;border:1px solid rgba(255,255,255,.1);background:rgba(0,0,0,.16)}.hc-v61-kpi .n{font-size:28px;font-weight:800}.hc-v61-kpi .d{font-size:12px;color:rgba(255,255,255,.68)}';
    document.head.appendChild(style);
  }

  function renderCommandDeck(){
    if(!(typeof APP !== 'undefined' && APP && APP.view === 'platform-house')) return;
    const host = document.querySelector('#content');
    if(!host) return;
    const metrics = buildMetrics();
    const openCases = readServiceCases().filter(function(item){ return item.status !== 'resolved'; }).slice(0, 6);
    const rules = readAutomationRules().slice(0, 4);
    const playbooks = readPlaybooks().slice(0, 4);
    const existing = document.getElementById('hc_v61_command_deck');
    if(existing && existing.remove) existing.remove();
    const card = document.createElement('div');
    card.id = 'hc_v61_command_deck';
    card.className = 'card hc-v61-command';
    card.innerHTML = '<h2 style="margin:0 0 8px;">Platform House Command Deck · V61</h2><div class="hint">This pass adds automation rules, service cases, signal execution logs, and repeatable playbooks so House Circle talks to Routex through operating logic, not hand-wavy patchwork.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;">' +
      '<div class="hc-v61-kpi"><div class="n">' + esc(String(metrics.openCases)) + '</div><div class="d">Open service cases</div></div>' +
      '<div class="hc-v61-kpi"><div class="n">' + esc(String(metrics.criticalCases)) + '</div><div class="d">Critical cases</div></div>' +
      '<div class="hc-v61-kpi"><div class="n">' + esc(String(metrics.activeRules)) + '</div><div class="d">Active rules</div></div>' +
      '<div class="hc-v61-kpi"><div class="n">' + esc(String(metrics.playbooks)) + '</div><div class="d">Playbooks</div></div>' +
      '<div class="hc-v61-kpi"><div class="n">' + esc(String(metrics.runs)) + '</div><div class="d">Signal runs</div></div>' +
      '<div class="hc-v61-kpi"><div class="n">' + esc(String(metrics.tasks)) + '</div><div class="d">V61 Routex tasks</div></div>' +
      '</div><div class="sep"></div><div class="row" style="flex-wrap:wrap; justify-content:flex-end; margin-bottom:12px;"><button class="btn" id="hc61_cases_btn">Service cases</button><button class="btn" id="hc61_rules_btn">Automation rules</button><button class="btn" id="hc61_playbooks_btn">Playbooks</button><button class="btn primary" id="hc61_export_btn">Export v61 bundle</button></div><div class="grid"><div class="card" style="grid-column:span 6;"><h2 style="margin:0 0 8px;">Open cases</h2><div class="list">' + renderCaseRows(openCases) + '</div></div><div class="card" style="grid-column:span 3;"><h2 style="margin:0 0 8px;">Rules</h2><div class="list">' + renderRuleRows(rules) + '</div></div><div class="card" style="grid-column:span 3;"><h2 style="margin:0 0 8px;">Playbooks</h2><div class="list">' + renderPlaybookRows(playbooks) + '</div></div></div>';
    host.appendChild(card);
    const casesBtn = document.getElementById('hc61_cases_btn');
    const rulesBtn = document.getElementById('hc61_rules_btn');
    const playbooksBtn = document.getElementById('hc61_playbooks_btn');
    const exportBtn = document.getElementById('hc61_export_btn');
    if(casesBtn) casesBtn.onclick = openCasesModal;
    if(rulesBtn) rulesBtn.onclick = openRulesModal;
    if(playbooksBtn) playbooksBtn.onclick = openPlaybooksModal;
    if(exportBtn) exportBtn.onclick = function(){ try{ exportV61Bundle(); }catch(err){ toastFn(clean(err && err.message) || 'Export failed.', 'bad'); } };
    Array.from(document.querySelectorAll('[data-hc61-case-resolve]')).forEach(function(btn){ btn.onclick = function(){ try{ resolveServiceCase(btn.getAttribute('data-hc61-case-resolve'), 'Resolved from V61 command deck.'); renderCommandDeck(); }catch(err){ toastFn(clean(err && err.message) || 'Resolve failed.', 'bad'); } }; });
    Array.from(document.querySelectorAll('[data-hc61-rule-toggle]')).forEach(function(btn){ btn.onclick = function(){ try{ toggleAutomationRule(btn.getAttribute('data-hc61-rule-toggle')); renderCommandDeck(); }catch(err){ toastFn(clean(err && err.message) || 'Toggle failed.', 'bad'); } }; });
    Array.from(document.querySelectorAll('[data-hc61-playbook-run]')).forEach(function(btn){ btn.onclick = function(){ openRunPlaybookModal(btn.getAttribute('data-hc61-playbook-run')); }; });
  }

  function injectDashboardCard(){
    if(!(typeof APP !== 'undefined' && APP && APP.view === 'dashboard')) return;
    const grid = document.querySelector('#content .grid');
    if(!grid) return;
    const old = document.getElementById('hc_v61_dash_card');
    if(old && old.remove) old.remove();
    const metrics = buildMetrics();
    const card = document.createElement('div');
    card.id = 'hc_v61_dash_card';
    card.className = 'card';
    card.style.gridColumn = 'span 12';
    card.innerHTML = '<h2>Platform House V61</h2><div class="hint">Automation, cases, and playbooks now convert hospitality signals into operations and follow-up inside the same stack.</div><div class="sep"></div><div class="row" style="flex-wrap:wrap;"><div class="pill">Open cases ' + esc(String(metrics.openCases)) + '</div><div class="pill">Rules ' + esc(String(metrics.activeRules)) + '</div><div class="pill">Signal runs ' + esc(String(metrics.runs)) + '</div><button class="btn" id="hc_v61_dash_open">Open command deck</button></div>';
    grid.insertBefore(card, grid.children[1] || null);
    const btn = document.getElementById('hc_v61_dash_open');
    if(btn) btn.onclick = function(){ APP.routeId = null; APP.view = 'platform-house'; window.location.hash = 'platform-house'; if(typeof render === 'function') render(); };
  }

  function patchApis(){
    const api = base();
    const ops = v60();
    if(!api || !ops || api.__v61Patched) return;
    const origRedeem = ops.redeemJoinPacket ? ops.redeemJoinPacket.bind(ops) : null;
    const origPos = ops.recordPosTicket ? ops.recordPosTicket.bind(ops) : null;
    const origImportPos = ops.importPosRows ? ops.importPosRows.bind(ops) : null;
    const origSyncStop = api.syncStopIntoHospitality ? api.syncStopIntoHospitality.bind(api) : null;
    const origMission = api.createRouteMissionFromSource ? api.createRouteMissionFromSource.bind(api) : null;

    if(origRedeem){
      ops.redeemJoinPacket = function(code, payload){
        const out = origRedeem(code, payload);
        try{ emitSignal('packet_redeemed', Object.assign({}, payload || {}, { code: code, offer: out && out.packet && out.packet.offer, locationId: out && out.packet && out.packet.locationId, guestId: out && out.checkin && out.checkin.guestId, guestName: payload && payload.name })); }catch(_){ }
        return out;
      };
      api.redeemJoinPacket = ops.redeemJoinPacket;
    }
    if(origPos){
      ops.recordPosTicket = function(payload){
        const out = origPos(payload);
        try{ emitSignal('pos_ticket_logged', Object.assign({}, payload || {}, out && out.ticket || {})); }catch(_){ }
        return out;
      };
      api.recordPosTicket = ops.recordPosTicket;
    }
    if(origImportPos){
      ops.importPosRows = function(rows){
        const out = origImportPos(rows);
        try{ listify(out).forEach(function(item){ emitSignal('pos_ticket_logged', item && item.ticket || item || {}); }); }catch(_){ }
        return out;
      };
      api.importPosRows = ops.importPosRows;
    }
    if(origSyncStop){
      api.syncStopIntoHospitality = function(stopId){
        const out = origSyncStop(stopId);
        try{
          const stop = stopsSafe().find(function(item){ return clean(item.id) === clean(stopId); }) || {};
          const route = routesSafe().find(function(item){ return clean(item.id) === clean(stop.routeId); }) || {};
          emitSignal('stop_status_sync', {
            id: stop.id,
            stopId: stop.id,
            routeId: stop.routeId,
            sourceRouteId: stop.routeId,
            sourceStopId: stop.id,
            label: stop.label,
            status: stop.status,
            locationName: stop.label,
            businessEmail: stop.businessEmail,
            email: stop.businessEmail,
            guestName: stop.contact,
            phone: stop.phone,
            routeName: route.name,
            locationId: locateLocationId({ sourceStopId: stop.id, sourceRouteId: stop.routeId, businessEmail: stop.businessEmail, label: stop.label }),
            guestId: locateGuestId({ email: stop.businessEmail, phone: stop.phone, name: stop.contact }, locateLocationId({ sourceStopId: stop.id, sourceRouteId: stop.routeId, businessEmail: stop.businessEmail, label: stop.label }))
          });
        }catch(_){ }
        return out;
      };
    }
    if(origMission){
      api.createRouteMissionFromSource = async function(type, id){
        const out = await origMission(type, id);
        try{ emitSignal('mission_created', { sourceType:type, sourceId:id, routeId: out && out.id, label: out && out.name, status:'created' }); }catch(_){ }
        return out;
      };
    }

    api.readServiceCases = readServiceCases;
    api.createServiceCase = createServiceCase;
    api.resolveServiceCase = resolveServiceCase;
    api.readAutomationRules = readAutomationRules;
    api.createAutomationRule = createAutomationRule;
    api.toggleAutomationRule = toggleAutomationRule;
    api.readPlaybooks = readPlaybooks;
    api.runPlaybook = runPlaybook;
    api.readSignalRuns = readSignalRuns;
    api.emitSignal = emitSignal;
    api.exportUnifiedBundle = exportV61Bundle;
    api.importUnifiedBundle = importV61Bundle;
    api.buildCommandMetrics = buildMetrics;
    api.__v61Patched = true;
  }

  function patchRender(){
    if(window.__ROUTEX_HC_V61_RENDER__) return;
    window.__ROUTEX_HC_V61_RENDER__ = true;
    const prev = typeof render === 'function' ? render : null;
    if(!prev) return;
    render = async function(){
      const out = await prev.apply(this, arguments);
      raf(function(){ try{ renderCommandDeck(); injectDashboardCard(); }catch(_){ } });
      return out;
    };
  }

  function firstRunSeed(){
    readPlaybooks();
    readAutomationRules();
    if(!readSignalRuns().length){
      pushSignalRun({ trigger:'seed', action:'seed', status:'ran', note:'V61 automation + service case lanes seeded.' });
      addAudit('v61-seeded', 'Automation rules, service cases, and playbooks seeded.', 'good', { version:'v61' });
    }
  }

  function init(){
    if(!base() || !v60()) return setTimeout(init, 40);
    injectStyles();
    firstRunSeed();
    patchApis();
    patchRender();
    raf(function(){ try{ renderCommandDeck(); injectDashboardCard(); }catch(_){ } });
    window.RoutexPlatformHouseCircleV61 = {
      readServiceCases: readServiceCases,
      createServiceCase: createServiceCase,
      resolveServiceCase: resolveServiceCase,
      readAutomationRules: readAutomationRules,
      createAutomationRule: createAutomationRule,
      toggleAutomationRule: toggleAutomationRule,
      readPlaybooks: readPlaybooks,
      runPlaybook: runPlaybook,
      readSignalRuns: readSignalRuns,
      emitSignal: emitSignal,
      exportV61Bundle: exportV61Bundle,
      importV61Bundle: importV61Bundle,
      buildMetrics: buildMetrics
    };
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
