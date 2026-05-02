export function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function buildRoster(seed = []) {
  return seed.map((item, index) => ({
    ...item,
    sortOrder: index + 1,
    enabled: item.enabled !== false,
    dailyCap: Number(item.dailyCap || 0),
    monthlyCap: Number(item.monthlyCap || 0),
    overrideDailyCap: Number(item.overrideDailyCap || 0),
    overrideMonthlyCap: Number(item.overrideMonthlyCap || 0),
    assignments: Number(item.assignments || 0),
    usageToday: Number(item.usageToday || 0),
    usageMonth: Number(item.usageMonth || 0),
    availabilityState: String(item.availabilityState || 'available'),
    unavailableUntil: String(item.unavailableUntil || ''),
    coverageNote: String(item.coverageNote || ''),
    backupOnly: item.backupOnly === true,
    dailyWindow: String(item.dailyWindow || '')
  }));
}

export const DEFAULT_OFFER_CATALOG = [
  { id: 'offer-command-pack', name: 'AE Central Command Pack', category: 'control-plane', oneTimePrice: 65000, monthlyPrice: 7500, tags: ['command', 'ae', 'clients', 'tasks', 'transcripts', 'sales', 'ops'], clientTypes: ['executive', 'technical', 'b2b'], pitch: 'Unified AE command, routing, transcripts, tasks, and operator control.' },
  { id: 'offer-skyezipinspector', name: 'SkyeZipInspector', category: 'inspection', oneTimePrice: 45000, monthlyPrice: 3500, tags: ['zip', 'valuation', 'scan', 'deploy', 'sales', 'investor', 'website'], clientTypes: ['executive', 'technical', 'b2b'], pitch: 'Deep scan, valuation, deploy-guide, and sales-material engine for product bundles and websites.' },
  { id: 'offer-appointment-brain', name: 'AI Appointment Setter Brain', category: 'appointment', oneTimePrice: 38000, monthlyPrice: 4500, tags: ['appointment', 'booking', 'calendar', 'follow-up', 'setter', 'sales'], clientTypes: ['local', 'executive', 'b2b'], pitch: 'Qualification, booking, reminder, and no-show recovery lane for pipeline conversion.' },
  { id: 'offer-printful-brain', name: '0megaCommerce Printful Brain', category: 'commerce', oneTimePrice: 52000, monthlyPrice: 6000, tags: ['printful', 'commerce', 'pod', 'catalog', 'merch', 'orders', 'ecommerce'], clientTypes: ['technical', 'executive', 'b2b'], pitch: 'Commerce, merch, POD, profitability, and order-rescue control plane.' },
  { id: 'offer-lead-vault', name: 'Skye Lead Vault Offline', category: 'crm', oneTimePrice: 12000, monthlyPrice: 0, tags: ['lead', 'offline', 'crm', 'routing', 'follow-up', 'field'], clientTypes: ['local', 'b2b'], pitch: 'Offline-first lead vault with routing, notes, follow-up, and field workflow depth.' },
  { id: 'offer-service-pack', name: 'AE Service Pack Master', category: 'sales-enablement', oneTimePrice: 8000, monthlyPrice: 0, tags: ['service', 'sales', 'offers', 'packaging', 'proposal', 'materials'], clientTypes: ['local', 'b2b', 'executive'], pitch: 'Sales enablement, packaging, proposals, and offer-structure support for closers.' }
];

export function buildOfferCatalog(seed = DEFAULT_OFFER_CATALOG) {
  return (Array.isArray(seed) && seed.length ? seed : DEFAULT_OFFER_CATALOG).map((item, index) => ({
    ...item,
    sortOrder: index + 1,
    oneTimePrice: Number(item.oneTimePrice || 0),
    monthlyPrice: Number(item.monthlyPrice || 0),
    tags: Array.isArray(item.tags) ? item.tags.map(tag => String(tag).toLowerCase()) : [],
    clientTypes: Array.isArray(item.clientTypes) ? item.clientTypes.map(tag => String(tag).toLowerCase()) : []
  }));
}

export function defaultState(roster = []) {
  return {
    version: 'v8-additive',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    aeProfiles: buildRoster(roster),
    clients: [],
    tasks: [],
    threads: [],
    messages: [],
    usageEvents: [],
    auditLog: [],
    donorTemplate: { endpointMode: 'chat', primaryProvider: 'openai', failoverProviders: ['anthropic', 'gemini'], model: 'gpt-4.1-mini', temperature: 0.7, maxOutputTokens: 900, streamDefault: true, note: '' },
    offerCatalog: buildOfferCatalog(),
    smokeReports: [],
    clientFilterPresets: [],
    taskFilterPresets: [],
    briefArchive: [],
    alertStates: {},
    automationRules: [],
    automationRuns: [],
    renewalRuns: [],
    coverageRuns: [],
    reactivationRuns: [],
    handoffRuns: [],
    promiseRuns: [],
    serviceRecoveryRuns: [],
    churnRuns: [],
    savePlanRuns: [],
    offerRuns: [],
    offerPacketRuns: [],
    restorePoints: [],
    workspacePresets: [],
    macroRuns: [],
    appointmentBridge: { handoffs: [], appointments: [], exports: [], importedRuntime: {}, sequences: [], slotTemplates: [], fulfillmentTemplates: [], syncLog: [], syncJournal: [], depositLedger: [], settlementLedger: [], rescueRuns: [], fulfillmentPackets: [] },
    printfulBridge: { leads: [], orders: [], exports: [], syncJournal: [], productCatalog: [], artPackets: [], adminNotes: [], importedRuntime: {}, pricingProfile: { status: 'packaged-donor', mode: 'initial-integration' }, sharedContract: { version: 'printful-bridge-v39', fields: [], lastNormalizedAt: '', validationRuns: [] }, contractPackets: [], replayQueue: [], profitabilitySnapshots: [], rescueRuns: [], operatorSessions: [], orderLocks: [], deploymentChecks: [] },
    directive: {
      smokeLastRunAt: '',
      smokePassed: false,
      smokeReportPath: './docs/SMOKE_PROOF.md'
    }
  };
}

export function normalizeState(state, roster = []) {
  const base = defaultState(roster);
  const merged = {
    ...base,
    ...state,
    aeProfiles: Array.isArray(state?.aeProfiles) && state.aeProfiles.length ? buildRoster(state.aeProfiles) : buildRoster(roster),
    clients: Array.isArray(state?.clients) ? state.clients : [],
    tasks: Array.isArray(state?.tasks) ? state.tasks : [],
    threads: Array.isArray(state?.threads) ? state.threads : [],
    messages: Array.isArray(state?.messages) ? state.messages : [],
    usageEvents: Array.isArray(state?.usageEvents) ? state.usageEvents : [],
    auditLog: Array.isArray(state?.auditLog) ? state.auditLog : [],
    donorTemplate: state?.donorTemplate && typeof state.donorTemplate === 'object' ? state.donorTemplate : base.donorTemplate,
    offerCatalog: Array.isArray(state?.offerCatalog) && state.offerCatalog.length ? buildOfferCatalog(state.offerCatalog) : buildOfferCatalog(base.offerCatalog),
    smokeReports: Array.isArray(state?.smokeReports) ? state.smokeReports : [],
    clientFilterPresets: Array.isArray(state?.clientFilterPresets) ? state.clientFilterPresets : [],
    taskFilterPresets: Array.isArray(state?.taskFilterPresets) ? state.taskFilterPresets : [],
    briefArchive: Array.isArray(state?.briefArchive) ? state.briefArchive : [],
    alertStates: state?.alertStates && typeof state.alertStates === 'object' ? state.alertStates : {},
    automationRules: Array.isArray(state?.automationRules) ? state.automationRules : [],
    automationRuns: Array.isArray(state?.automationRuns) ? state.automationRuns : [],
    renewalRuns: Array.isArray(state?.renewalRuns) ? state.renewalRuns : [],
    coverageRuns: Array.isArray(state?.coverageRuns) ? state.coverageRuns : [],
    reactivationRuns: Array.isArray(state?.reactivationRuns) ? state.reactivationRuns : [],
    handoffRuns: Array.isArray(state?.handoffRuns) ? state.handoffRuns : [],
    promiseRuns: Array.isArray(state?.promiseRuns) ? state.promiseRuns : [],
    serviceRecoveryRuns: Array.isArray(state?.serviceRecoveryRuns) ? state.serviceRecoveryRuns : [],
    churnRuns: Array.isArray(state?.churnRuns) ? state.churnRuns : [],
    savePlanRuns: Array.isArray(state?.savePlanRuns) ? state.savePlanRuns : [],
    offerRuns: Array.isArray(state?.offerRuns) ? state.offerRuns : [],
    offerPacketRuns: Array.isArray(state?.offerPacketRuns) ? state.offerPacketRuns : [],
    restorePoints: Array.isArray(state?.restorePoints) ? state.restorePoints : [],
    workspacePresets: Array.isArray(state?.workspacePresets) ? state.workspacePresets : [],
    macroRuns: Array.isArray(state?.macroRuns) ? state.macroRuns : [],
    appointmentBridge: state?.appointmentBridge && typeof state.appointmentBridge === 'object' ? {
      handoffs: Array.isArray(state.appointmentBridge.handoffs) ? state.appointmentBridge.handoffs : [],
      appointments: Array.isArray(state.appointmentBridge.appointments) ? state.appointmentBridge.appointments : [],
      exports: Array.isArray(state.appointmentBridge.exports) ? state.appointmentBridge.exports : [],
      importedRuntime: state.appointmentBridge.importedRuntime && typeof state.appointmentBridge.importedRuntime === 'object' ? state.appointmentBridge.importedRuntime : {},
      sequences: Array.isArray(state.appointmentBridge.sequences) ? state.appointmentBridge.sequences : [],
      slotTemplates: Array.isArray(state.appointmentBridge.slotTemplates) ? state.appointmentBridge.slotTemplates : [],
      fulfillmentTemplates: Array.isArray(state.appointmentBridge.fulfillmentTemplates) ? state.appointmentBridge.fulfillmentTemplates : [],
      syncLog: Array.isArray(state.appointmentBridge.syncLog) ? state.appointmentBridge.syncLog : [],
      syncJournal: Array.isArray(state.appointmentBridge.syncJournal) ? state.appointmentBridge.syncJournal : [],
      depositLedger: Array.isArray(state.appointmentBridge.depositLedger) ? state.appointmentBridge.depositLedger : [],
      settlementLedger: Array.isArray(state.appointmentBridge.settlementLedger) ? state.appointmentBridge.settlementLedger : [],
      rescueRuns: Array.isArray(state.appointmentBridge.rescueRuns) ? state.appointmentBridge.rescueRuns : [],
      fulfillmentPackets: Array.isArray(state.appointmentBridge.fulfillmentPackets) ? state.appointmentBridge.fulfillmentPackets : []
    } : base.appointmentBridge
,
    printfulBridge: state?.printfulBridge && typeof state.printfulBridge === 'object' ? {
      leads: Array.isArray(state.printfulBridge.leads) ? state.printfulBridge.leads : [],
      orders: Array.isArray(state.printfulBridge.orders) ? state.printfulBridge.orders : [],
      exports: Array.isArray(state.printfulBridge.exports) ? state.printfulBridge.exports : [],
      syncJournal: Array.isArray(state.printfulBridge.syncJournal) ? state.printfulBridge.syncJournal : [],
      productCatalog: Array.isArray(state.printfulBridge.productCatalog) ? state.printfulBridge.productCatalog : [],
      artPackets: Array.isArray(state.printfulBridge.artPackets) ? state.printfulBridge.artPackets : [],
      adminNotes: Array.isArray(state.printfulBridge.adminNotes) ? state.printfulBridge.adminNotes : [],
      importedRuntime: state.printfulBridge.importedRuntime && typeof state.printfulBridge.importedRuntime === 'object' ? state.printfulBridge.importedRuntime : {},
      pricingProfile: state.printfulBridge.pricingProfile && typeof state.printfulBridge.pricingProfile === 'object' ? state.printfulBridge.pricingProfile : { status: 'packaged-donor', mode: 'initial-integration' },
      sharedContract: state.printfulBridge.sharedContract && typeof state.printfulBridge.sharedContract === 'object' ? state.printfulBridge.sharedContract : { version: 'printful-bridge-v39', fields: [], lastNormalizedAt: '', validationRuns: [] },
      contractPackets: Array.isArray(state.printfulBridge.contractPackets) ? state.printfulBridge.contractPackets : [],
      replayQueue: Array.isArray(state.printfulBridge.replayQueue) ? state.printfulBridge.replayQueue : [],
      profitabilitySnapshots: Array.isArray(state.printfulBridge.profitabilitySnapshots) ? state.printfulBridge.profitabilitySnapshots : [],
      rescueRuns: Array.isArray(state.printfulBridge.rescueRuns) ? state.printfulBridge.rescueRuns : [],
      operatorSessions: Array.isArray(state.printfulBridge.operatorSessions) ? state.printfulBridge.operatorSessions : [],
      orderLocks: Array.isArray(state.printfulBridge.orderLocks) ? state.printfulBridge.orderLocks : [],
      deploymentChecks: Array.isArray(state.printfulBridge.deploymentChecks) ? state.printfulBridge.deploymentChecks : []
    } : base.printfulBridge
  };
  merged.updatedAt = nowIso();
  return merged;
}

export function tagify(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

export function scoreAeForClient(ae, client) {
  if (!ae || ae.enabled === false) return -9999;
  const availabilityState = String(ae.availabilityState || 'available').toLowerCase();
  const today = nowIso().slice(0, 10);
  if (availabilityState === 'out') return -9999;
  const unavailableUntil = String(ae.unavailableUntil || '').slice(0, 10);
  const clientTags = tagify(client.tags).concat(tagify(client.needs), tagify(client.clientType));
  const specialties = Array.isArray(ae.specialties) ? ae.specialties : [];
  let score = 0;
  if (unavailableUntil && unavailableUntil >= today) score -= 120;
  if (availabilityState === 'focus') score -= 22;
  if (availabilityState === 'backup' || ae.backupOnly === true) score -= (String(client.priority || '').toLowerCase() === 'urgent' ? 6 : 14);
  specialties.forEach(item => {
    if (clientTags.includes(String(item).toLowerCase())) score += 15;
  });
  if (clientTags.includes(String(ae.lane || '').toLowerCase())) score += 22;
  if (Array.isArray(ae.clientTypes)) {
    ae.clientTypes.forEach(type => {
      if (clientTags.includes(String(type).toLowerCase())) score += 12;
    });
  }
  const assignments = Number(ae.assignments || 0);
  score -= Math.min(assignments, 50) * 0.3;
  const dailyCap = Number(ae.overrideDailyCap || ae.dailyCap || 0);
  if (dailyCap > 0 && Number(ae.usageToday || 0) >= dailyCap) score -= 40;
  const monthlyCap = Number(ae.overrideMonthlyCap || ae.monthlyCap || 0);
  if (monthlyCap > 0 && Number(ae.usageMonth || 0) >= monthlyCap) score -= 40;
  return score;
}


export function rankAeCandidates(state, client, limit = 5) {
  return [...(state.aeProfiles || [])]
    .map(ae => ({ ae, score: scoreAeForClient(ae, client) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => ({ ...item.ae, score: item.score }));
}

export function autoAssignClient(state, client) {
  const profiles = rankAeCandidates(state, client, Math.max((state.aeProfiles || []).length, 1));
  const best = profiles[0];
  if (!best || best.score < -1000) return null;
  return best;
}

export function assignClient(state, clientId, aeId, mode = 'manual') {
  const client = state.clients.find(item => item.id === clientId);
  const ae = state.aeProfiles.find(item => item.id === aeId);
  if (!client || !ae) return state;
  client.assignmentHistory = Array.isArray(client.assignmentHistory) ? client.assignmentHistory : [];
  client.assignedAeId = ae.id;
  client.assignedAeName = ae.name;
  client.lastAssignedAt = nowIso();
  client.assignmentHistory.unshift({
    id: uid('assign'),
    aeId: ae.id,
    aeName: ae.name,
    mode,
    at: client.lastAssignedAt
  });
  ae.assignments = Number(ae.assignments || 0) + 1;
  state.auditLog.unshift({
    id: uid('audit'),
    kind: 'assignment',
    message: `${client.name} assigned to ${ae.name} (${mode})`,
    at: nowIso()
  });
  state.updatedAt = nowIso();
  return state;
}

export function exportState(state) {
  return JSON.stringify(state, null, 2);
}


function parseIsoDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const iso = raw.length >= 10 ? raw.slice(0, 10) : raw;
  const stamp = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(stamp)) return null;
  return { iso, stamp };
}

export function getDaysDelta(targetIso = '', todayIso = nowIso().slice(0, 10)) {
  const target = parseIsoDate(targetIso);
  const today = parseIsoDate(todayIso);
  if (!target || !today) return null;
  return Math.round((target.stamp - today.stamp) / 86400000);
}

function toMoney(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}


export function getClientRenewalRiskState(client = {}, todayIso = nowIso().slice(0, 10)) {
  const stage = String(client.stage || 'intake').toLowerCase();
  const priority = String(client.priority || 'normal').toLowerCase();
  const escalationLevel = String(client.escalationLevel || 'none').toLowerCase();
  const monthlyValue = Math.max(0, toMoney(client.monthlyValue));
  const estimatedValue = Math.max(0, toMoney(client.estimatedValue));
  const closeProbability = Math.min(100, Math.max(0, Number(client.closeProbability || 0)));
  const followUpDelta = getDaysDelta(client.followUpDate || '', todayIso);
  const closeDelta = getDaysDelta(client.targetCloseDate || '', todayIso);
  const notes = String(client.notes || '').toLowerCase();
  const nextStep = String(client.nextStep || '').toLowerCase();
  const reasons = [];
  let score = 0;

  if (stage === 'closed') {
    return { score: 0, label: 'Closed', status: 'closed', reasons: ['Client is already closed.'], atRiskValue: 0, monthlyValue, estimatedValue, followUpDelta, closeDelta };
  }
  if (monthlyValue >= 5000) { score += 24; reasons.push('High recurring value needs renewal protection.'); }
  else if (monthlyValue >= 2000) { score += 16; reasons.push('Meaningful recurring value is in play.'); }
  else if (monthlyValue > 0) { score += 8; reasons.push('Recurring value is attached to this client.'); }
  if (estimatedValue >= 25000) { score += 18; reasons.push('Large estimated value raises renewal exposure.'); }
  else if (estimatedValue >= 10000) { score += 10; reasons.push('Mid-tier estimated value is exposed.'); }
  if (followUpDelta !== null) {
    if (followUpDelta < 0) {
      const overdueDays = Math.abs(followUpDelta);
      const overdueWeight = Math.min(24, 8 + overdueDays * 2);
      score += overdueWeight;
      reasons.push(`Follow-up is overdue by ${overdueDays} day(s).`);
    } else if (followUpDelta <= 2) {
      score += 10;
      reasons.push('Follow-up deadline is immediate.');
    }
  } else {
    score += 6;
    reasons.push('No follow-up date is set.');
  }
  if (closeDelta !== null) {
    if (closeDelta < 0) { score += 20; reasons.push('Target close date has already slipped.'); }
    else if (closeDelta <= 7) { score += 14; reasons.push('Close window lands within 7 days.'); }
  }
  if (closeProbability > 0 && closeProbability < 60) { score += 18; reasons.push(`Close probability is only ${closeProbability}%.`); }
  else if (closeProbability >= 60 && closeProbability < 80) { score += 9; reasons.push(`Close probability still needs protection at ${closeProbability}%.`); }
  if (['active', 'nurture', 'blocked'].includes(stage)) {
    score += stage === 'blocked' ? 16 : 8;
    reasons.push(stage === 'blocked' ? 'Client is blocked and needs intervention.' : `Client is in ${stage} stage and still needs active retention.`);
  }
  if (priority === 'urgent') { score += 16; reasons.push('Priority is urgent.'); }
  else if (priority === 'high') { score += 10; reasons.push('Priority is high.'); }
  if (escalationLevel === 'founder') { score += 28; reasons.push('Founder escalation is active.'); }
  else if (escalationLevel === 'executive') { score += 20; reasons.push('Executive escalation is active.'); }
  else if (escalationLevel === 'watch') { score += 10; reasons.push('Watch escalation is active.'); }
  if (notes.includes('renew') || notes.includes('save') || nextStep.includes('renew') || nextStep.includes('save')) {
    score += 6;
    reasons.push('Notes already reference renewal/save work.');
  }
  const weightedEstimate = estimatedValue > 0 && closeProbability > 0 ? Math.round((estimatedValue * closeProbability) / 100) : 0;
  const atRiskValue = monthlyValue > 0 ? Math.round(monthlyValue * 3) : weightedEstimate;
  const status = score >= 80 ? 'critical' : score >= 55 ? 'high' : score >= 30 ? 'watch' : 'stable';
  const label = status === 'critical' ? 'Critical renewal risk' : status === 'high' ? 'High renewal risk' : status === 'watch' ? 'Watch renewal risk' : 'Stable renewal outlook';
  return { score, label, status, reasons, atRiskValue, monthlyValue, estimatedValue, weightedEstimate, closeProbability, followUpDelta, closeDelta, escalationLevel };
}

export function buildRenewalRiskSummary(clients = [], todayIso = nowIso().slice(0, 10)) {
  const rows = (clients || []).map(client => ({ client, risk: getClientRenewalRiskState(client, todayIso) }));
  return {
    generatedAt: nowIso(),
    total: rows.length,
    critical: rows.filter(item => item.risk.status === 'critical').length,
    high: rows.filter(item => item.risk.status === 'high').length,
    watch: rows.filter(item => item.risk.status === 'watch').length,
    stable: rows.filter(item => item.risk.status === 'stable').length,
    atRiskRevenue: rows.reduce((sum, item) => sum + Number(item.risk.atRiskValue || 0), 0),
    rows
  };
}

export function getAeCoveragePressureState(ae = {}) {
  const availabilityState = String(ae.availabilityState || 'available').toLowerCase();
  const dailyCap = Number(ae.overrideDailyCap || ae.dailyCap || 0);
  const monthlyCap = Number(ae.overrideMonthlyCap || ae.monthlyCap || 0);
  const usageToday = Number(ae.usageToday || 0);
  const usageMonth = Number(ae.usageMonth || 0);
  const assignments = Number(ae.assignments || 0);
  const dailyRatio = dailyCap > 0 ? usageToday / dailyCap : 0;
  const monthlyRatio = monthlyCap > 0 ? usageMonth / monthlyCap : 0;
  const maxRatio = Math.max(dailyRatio, monthlyRatio);
  const reasons = [];
  let score = 0;
  if (ae.enabled === false || availabilityState === 'out') { score += 95; reasons.push('AE is unavailable for new work.'); }
  else if (availabilityState === 'focus') { score += 32; reasons.push('AE is in focused capacity.'); }
  else if (availabilityState === 'backup') { score += 24; reasons.push('AE is marked backup-only.'); }
  if (maxRatio >= 1) { score += 38; reasons.push('Capacity cap is fully consumed.'); }
  else if (maxRatio >= 0.85) { score += 22; reasons.push('Capacity is above 85%.'); }
  else if (maxRatio >= 0.7) { score += 12; reasons.push('Capacity is above 70%.'); }
  if (assignments >= 18) { score += 22; reasons.push('Assignment load is heavy.'); }
  else if (assignments >= 10) { score += 12; reasons.push('Assignment load is elevated.'); }
  if (String(ae.unavailableUntil || '').trim()) { score += 10; reasons.push(`Unavailable window is set through ${String(ae.unavailableUntil).slice(0, 10)}.`); }
  const status = score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 28 ? 'watch' : 'healthy';
  const label = status === 'critical' ? 'Critical coverage pressure' : status === 'high' ? 'High coverage pressure' : status === 'watch' ? 'Watch coverage pressure' : 'Healthy coverage';
  return { score, label, status, reasons, dailyRatio, monthlyRatio, assignments, availabilityState, dailyCap, monthlyCap, usageToday, usageMonth, maxRatio };
}

export function buildAeCoverageSummary(aeProfiles = []) {
  const rows = (aeProfiles || []).map(ae => ({ ae, pressure: getAeCoveragePressureState(ae) }));
  return {
    generatedAt: nowIso(),
    total: rows.length,
    critical: rows.filter(item => item.pressure.status === 'critical').length,
    high: rows.filter(item => item.pressure.status === 'high').length,
    watch: rows.filter(item => item.pressure.status === 'watch').length,
    healthy: rows.filter(item => item.pressure.status === 'healthy').length,
    rows
  };
}


export function getClientReactivationState(client = {}, todayIso = nowIso().slice(0, 10)) {
  const stage = String(client.stage || 'intake').toLowerCase();
  if (stage === 'closed') {
    return { score: 0, label: 'Closed client', status: 'closed', reasons: ['Client is already closed.'], recoverableValue: 0, weightedEstimate: 0, lastContactDelta: null, followUpDelta: null };
  }
  const priority = String(client.priority || 'normal').toLowerCase();
  const monthlyValue = Math.max(0, toMoney(client.monthlyValue));
  const estimatedValue = Math.max(0, toMoney(client.estimatedValue));
  const closeProbability = Math.min(100, Math.max(0, Number(client.closeProbability || 0)));
  const notes = String(client.notes || '').toLowerCase();
  const nextStep = String(client.nextStep || '').toLowerCase();
  const touchState = String(client.touchState || client.touch || '').toLowerCase();
  const followUpDelta = getDaysDelta(client.followUpDate || '', todayIso);
  const lastContactRaw = String(client.lastContactAt || client.lastTouchedAt || client.updatedAt || client.createdAt || '').trim();
  const lastContactDeltaRaw = lastContactRaw ? getDaysDelta(lastContactRaw, todayIso) : null;
  const lastContactDelta = lastContactDeltaRaw === null ? null : Math.abs(lastContactDeltaRaw);
  const reasons = [];
  let score = 0;

  if (monthlyValue >= 5000) { score += 22; reasons.push('High recurring value is sitting idle.'); }
  else if (monthlyValue >= 2000) { score += 14; reasons.push('Recurring value can still be recovered.'); }
  else if (monthlyValue > 0) { score += 8; reasons.push('Recurring value is attached to this client.'); }

  if (estimatedValue >= 20000) { score += 16; reasons.push('Large estimated value increases reactivation leverage.'); }
  else if (estimatedValue >= 10000) { score += 10; reasons.push('Mid-tier estimated value remains recoverable.'); }

  if (followUpDelta !== null) {
    if (followUpDelta < 0) {
      score += Math.min(24, 10 + Math.abs(followUpDelta) * 2);
      reasons.push('Follow-up date is overdue.');
    } else if (followUpDelta <= 2) {
      score += 8;
      reasons.push('Follow-up window is immediate.');
    }
  } else {
    score += 10;
    reasons.push('No follow-up date is set.');
  }

  if (lastContactDelta !== null) {
    if (lastContactDelta >= 21) {
      score += 22;
      reasons.push('No meaningful contact for more than 21 days.');
    } else if (lastContactDelta >= 10) {
      score += 12;
      reasons.push('Contact has gone stale.');
    }
  } else {
    score += 10;
    reasons.push('No last-contact timestamp is recorded.');
  }

  if (['ghosted', 'cold', 'awaiting', 'stale'].includes(touchState)) {
    score += 12;
    reasons.push('Touch state already signals reactivation pressure.');
  }
  if (priority === 'urgent') { score += 12; reasons.push('Priority is urgent.'); }
  else if (priority === 'high') { score += 8; reasons.push('Priority is high.'); }
  if (['nurture', 'active', 'blocked'].includes(stage)) {
    score += stage === 'blocked' ? 16 : 8;
    reasons.push(stage === 'blocked' ? 'Client is blocked and needs a recovery move.' : `Client remains in ${stage} stage and can still be recovered.`);
  }
  if (notes.includes('ghost') || notes.includes('cold') || notes.includes('stale') || notes.includes('reactivat') || notes.includes('no response') || nextStep.includes('reactivat')) {
    score += 10;
    reasons.push('Notes already point toward reactivation work.');
  }

  const weightedEstimate = estimatedValue > 0 && closeProbability > 0 ? Math.round((estimatedValue * closeProbability) / 100) : 0;
  const recoverableValue = monthlyValue > 0 ? Math.round(monthlyValue * 2) : weightedEstimate;
  const status = score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 28 ? 'watch' : 'stable';
  const label = status === 'critical' ? 'Critical reactivation pressure' : status === 'high' ? 'High reactivation pressure' : status === 'watch' ? 'Watch reactivation pressure' : 'Stable reactivation outlook';
  return { score, label, status, reasons, recoverableValue, weightedEstimate, monthlyValue, estimatedValue, closeProbability, followUpDelta, lastContactDelta };
}

export function buildReactivationSummary(clients = [], todayIso = nowIso().slice(0, 10)) {
  const rows = (clients || []).map(client => ({ client, reactivation: getClientReactivationState(client, todayIso) }));
  return {
    generatedAt: nowIso(),
    total: rows.length,
    critical: rows.filter(item => item.reactivation.status === 'critical').length,
    high: rows.filter(item => item.reactivation.status === 'high').length,
    watch: rows.filter(item => item.reactivation.status === 'watch').length,
    stable: rows.filter(item => item.reactivation.status === 'stable').length,
    recoverableValue: rows.reduce((sum, item) => sum + Number(item.reactivation.recoverableValue || 0), 0),
    rows
  };
}


export function getClientPromiseIntegrityState(client = {}, tasks = [], threads = [], todayIso = nowIso().slice(0, 10)) {
  const stage = String(client.stage || 'intake').toLowerCase();
  if (stage === 'closed') {
    return { score: 0, label: 'Closed client', status: 'closed', reasons: ['Client is already closed.'], exposedValue: 0, overdueTaskCount: 0, stalledThreadCount: 0, missingNextStep: false };
  }
  const priority = String(client.priority || 'normal').toLowerCase();
  const monthlyValue = Math.max(0, toMoney(client.monthlyValue));
  const estimatedValue = Math.max(0, toMoney(client.estimatedValue));
  const notes = String(client.notes || '').toLowerCase();
  const nextStep = String(client.nextStep || '').trim();
  const followUpDelta = getDaysDelta(client.followUpDate || '', todayIso);
  const targetCloseDelta = getDaysDelta(client.targetCloseDate || '', todayIso);
  const clientTasks = (tasks || []).filter(task => String(task.clientId || '') === String(client.id || ''));
  const openTasks = clientTasks.filter(task => String(task.status || 'todo') !== 'done');
  const overdueTaskCount = openTasks.filter(task => {
    const delta = getDaysDelta(task.dueDate || '', todayIso);
    return delta !== null && delta < 0;
  }).length;
  const clientThreads = (threads || []).filter(thread => String(thread.clientId || '') === String(client.id || ''));
  const stalledThreadCount = clientThreads.filter(thread => {
    const updated = String(thread.updatedAt || thread.createdAt || '').trim();
    if (!updated) return true;
    const deltaRaw = getDaysDelta(updated, todayIso);
    const delta = deltaRaw === null ? null : Math.abs(deltaRaw);
    return delta === null || delta >= 7;
  }).length;
  const reasons = [];
  let score = 0;

  if (monthlyValue >= 5000) { score += 20; reasons.push('High recurring value is exposed if promises slip.'); }
  else if (monthlyValue >= 2000) { score += 12; reasons.push('Recurring value is exposed to delivery slippage.'); }
  else if (monthlyValue > 0) { score += 6; reasons.push('Recurring value still needs promise protection.'); }

  if (estimatedValue >= 20000) { score += 18; reasons.push('Large estimated value raises promise-integrity exposure.'); }
  else if (estimatedValue >= 10000) { score += 10; reasons.push('Mid-tier estimated value raises promise-integrity exposure.'); }

  if (overdueTaskCount >= 3) { score += 28; reasons.push('Multiple overdue tasks are attached to the client.'); }
  else if (overdueTaskCount >= 1) { score += 16; reasons.push('Overdue tasks are attached to the client.'); }

  if (stalledThreadCount >= 2) { score += 18; reasons.push('Multiple stale client threads threaten continuity.'); }
  else if (stalledThreadCount >= 1) { score += 10; reasons.push('A stale client thread threatens continuity.'); }

  if (followUpDelta !== null) {
    if (followUpDelta < 0) {
      score += Math.min(22, 8 + Math.abs(followUpDelta) * 2);
      reasons.push('Follow-up promise is overdue.');
    } else if (followUpDelta <= 1) {
      score += 8;
      reasons.push('Follow-up promise is due immediately.');
    }
  } else {
    score += 8;
    reasons.push('No follow-up checkpoint is set.');
  }

  if (targetCloseDelta !== null && targetCloseDelta < 0) {
    score += 12;
    reasons.push('Target close date has already slipped.');
  }

  if (!nextStep) {
    score += 10;
    reasons.push('No visible next step is recorded.');
  }

  if (priority === 'urgent') { score += 14; reasons.push('Priority is urgent.'); }
  else if (priority === 'high') { score += 8; reasons.push('Priority is high.'); }

  if (notes.includes('promise') || notes.includes('deadline') || notes.includes('sla') || notes.includes('late') || notes.includes('missed') || notes.includes('breach') || notes.includes('angry') || notes.includes('upset')) {
    score += 14;
    reasons.push('Notes already indicate delivery or trust pressure.');
  }

  const exposedValue = Math.max(monthlyValue > 0 ? Math.round(monthlyValue * 2) : 0, estimatedValue > 0 ? Math.round(estimatedValue * 0.65) : 0);
  const status = score >= 78 ? 'critical' : score >= 52 ? 'high' : score >= 30 ? 'watch' : 'stable';
  const label = status === 'critical' ? 'Critical promise integrity risk' : status === 'high' ? 'High promise integrity risk' : status === 'watch' ? 'Watch promise integrity risk' : 'Stable promise integrity';
  return { score, label, status, reasons, exposedValue, overdueTaskCount, stalledThreadCount, missingNextStep: !nextStep, monthlyValue, estimatedValue, followUpDelta, targetCloseDelta };
}

export function buildPromiseIntegritySummary(clients = [], tasks = [], threads = [], todayIso = nowIso().slice(0, 10)) {
  const rows = (clients || []).map(client => ({ client, promise: getClientPromiseIntegrityState(client, tasks, threads, todayIso) }));
  return {
    generatedAt: nowIso(),
    total: rows.length,
    critical: rows.filter(item => item.promise.status === 'critical').length,
    high: rows.filter(item => item.promise.status === 'high').length,
    watch: rows.filter(item => item.promise.status === 'watch').length,
    stable: rows.filter(item => item.promise.status === 'stable').length,
    exposedValue: rows.reduce((sum, item) => sum + Number(item.promise.exposedValue || 0), 0),
    rows
  };
}

export function buildAePromiseLoadSummary(aeProfiles = [], clients = [], tasks = [], threads = [], todayIso = nowIso().slice(0, 10)) {
  const rows = (aeProfiles || []).map(ae => {
    const ownedClients = (clients || []).filter(client => String(client.assignedAeId || '') === String(ae.id || ''));
    const promiseRows = ownedClients.map(client => ({ client, promise: getClientPromiseIntegrityState(client, tasks, threads, todayIso) }));
    const criticalClients = promiseRows.filter(item => item.promise.status === 'critical').length;
    const highClients = promiseRows.filter(item => item.promise.status === 'high').length;
    const exposedValue = promiseRows.reduce((sum, item) => sum + Number(item.promise.exposedValue || 0), 0);
    const openTasks = (tasks || []).filter(task => String(task.assignedAeId || '') === String(ae.id || '') && String(task.status || 'todo') !== 'done').length;
    const overdueTasks = (tasks || []).filter(task => String(task.assignedAeId || '') === String(ae.id || '') && String(task.status || 'todo') !== 'done').filter(task => {
      const delta = getDaysDelta(task.dueDate || '', todayIso);
      return delta !== null && delta < 0;
    }).length;
    const score = criticalClients * 24 + highClients * 12 + Math.min(20, overdueTasks * 4) + Math.min(18, openTasks * 2);
    const status = score >= 60 ? 'critical' : score >= 36 ? 'high' : score >= 18 ? 'watch' : 'healthy';
    const label = status === 'critical' ? 'Critical promise load' : status === 'high' ? 'High promise load' : status === 'watch' ? 'Watch promise load' : 'Healthy promise load';
    return { ae, status, label, score, criticalClients, highClients, exposedValue, openTasks, overdueTasks, clientCount: ownedClients.length };
  });
  return {
    generatedAt: nowIso(),
    total: rows.length,
    critical: rows.filter(item => item.status === 'critical').length,
    high: rows.filter(item => item.status === 'high').length,
    watch: rows.filter(item => item.status === 'watch').length,
    healthy: rows.filter(item => item.status === 'healthy').length,
    exposedValue: rows.reduce((sum, item) => sum + Number(item.exposedValue || 0), 0),
    rows
  };
}


export function getClientChurnRiskState(client = {}, tasks = [], threads = [], todayIso = nowIso().slice(0, 10)) {
  const stage = String(client.stage || 'intake').toLowerCase();
  if (stage === 'closed') {
    return { score: 0, label: 'Closed client', status: 'closed', reasons: ['Client is already closed.'], exposedValue: 0, overdueTaskCount: 0, stalledThreadCount: 0, missingNextStep: false, saveWindow: 'closed' };
  }
  const priority = String(client.priority || 'normal').toLowerCase();
  const monthlyValue = Math.max(0, toMoney(client.monthlyValue));
  const estimatedValue = Math.max(0, toMoney(client.estimatedValue));
  const closeProbability = Math.min(100, Math.max(0, Number(client.closeProbability || 0)));
  const notes = String(client.notes || '').toLowerCase();
  const nextStep = String(client.nextStep || '').trim();
  const followUpDelta = getDaysDelta(client.followUpDate || '', todayIso);
  const targetCloseDelta = getDaysDelta(client.targetCloseDate || '', todayIso);
  const lastContactDeltaRaw = getDaysDelta(client.lastContactAt || '', todayIso);
  const lastContactDelta = lastContactDeltaRaw === null ? null : Math.abs(lastContactDeltaRaw);
  const clientTasks = (tasks || []).filter(task => String(task.clientId || '') === String(client.id || ''));
  const openTasks = clientTasks.filter(task => String(task.status || 'todo') !== 'done');
  const overdueTaskCount = openTasks.filter(task => {
    const delta = getDaysDelta(task.dueDate || '', todayIso);
    return delta !== null && delta < 0;
  }).length;
  const clientThreads = (threads || []).filter(thread => String(thread.clientId || '') === String(client.id || ''));
  const stalledThreadCount = clientThreads.filter(thread => {
    const updated = String(thread.updatedAt || thread.createdAt || '').trim();
    if (!updated) return true;
    const deltaRaw = getDaysDelta(updated, todayIso);
    const delta = deltaRaw === null ? null : Math.abs(deltaRaw);
    return delta === null || delta >= 8;
  }).length;
  const reasons = [];
  let score = 0;

  if (monthlyValue >= 6000) { score += 24; reasons.push('High recurring value is vulnerable to churn.'); }
  else if (monthlyValue >= 2500) { score += 15; reasons.push('Recurring value is vulnerable to churn.'); }
  else if (monthlyValue > 0) { score += 8; reasons.push('Recurring value still needs churn defense.'); }

  if (estimatedValue >= 25000) { score += 20; reasons.push('Large remaining contract value is at risk.'); }
  else if (estimatedValue >= 12000) { score += 12; reasons.push('Mid-tier remaining value is at risk.'); }

  if (closeProbability > 0 && closeProbability <= 45) { score += 8; reasons.push('Low confidence on continued forward motion.'); }

  if (overdueTaskCount >= 3) { score += 24; reasons.push('Multiple overdue tasks suggest a slipping account.'); }
  else if (overdueTaskCount >= 1) { score += 14; reasons.push('Overdue work is attached to the client.'); }

  if (stalledThreadCount >= 2) { score += 18; reasons.push('Multiple stale threads indicate weak continuity.'); }
  else if (stalledThreadCount >= 1) { score += 10; reasons.push('A stale thread indicates weak continuity.'); }

  if (followUpDelta !== null) {
    if (followUpDelta < 0) {
      score += Math.min(22, 8 + Math.abs(followUpDelta) * 2);
      reasons.push('Follow-up checkpoint is overdue.');
    } else if (followUpDelta <= 1) {
      score += 8;
      reasons.push('Follow-up checkpoint is due immediately.');
    }
  } else {
    score += 8;
    reasons.push('No follow-up checkpoint is set.');
  }

  if (targetCloseDelta !== null && targetCloseDelta < 0) {
    score += 12;
    reasons.push('The target close or commitment date already slipped.');
  }

  if (lastContactDelta !== null && lastContactDelta >= 10) {
    score += 14;
    reasons.push('The client has gone too long without direct contact.');
  }

  if (!nextStep) {
    score += 10;
    reasons.push('No visible next step is recorded.');
  }

  if (priority === 'urgent') { score += 14; reasons.push('Priority is urgent.'); }
  else if (priority === 'high') { score += 8; reasons.push('Priority is high.'); }

  if (notes.includes('cancel') || notes.includes('churn') || notes.includes('leaving') || notes.includes('terminate') || notes.includes('competitor') || notes.includes('expensive') || notes.includes('too much') || notes.includes('frustrated') || notes.includes('disappointed') || notes.includes('ghosted')) {
    score += 18;
    reasons.push('Notes already indicate churn or dissatisfaction pressure.');
  }

  const exposedValue = Math.max(monthlyValue > 0 ? Math.round(monthlyValue * 3) : 0, estimatedValue > 0 ? Math.round(estimatedValue * 0.75) : 0);
  const status = score >= 76 ? 'critical' : score >= 50 ? 'high' : score >= 28 ? 'watch' : 'stable';
  const label = status === 'critical' ? 'Critical churn risk' : status === 'high' ? 'High churn risk' : status === 'watch' ? 'Watch churn risk' : 'Stable churn outlook';
  const saveWindow = status === 'critical' ? 'Immediate executive save' : status === 'high' ? '48-hour save plan' : status === 'watch' ? 'Watch and reinforce' : 'Healthy';
  return { score, label, status, reasons, exposedValue, overdueTaskCount, stalledThreadCount, missingNextStep: !nextStep, monthlyValue, estimatedValue, closeProbability, followUpDelta, targetCloseDelta, lastContactDelta, saveWindow };
}

export function buildChurnRiskSummary(clients = [], tasks = [], threads = [], todayIso = nowIso().slice(0, 10)) {
  const rows = (clients || []).map(client => ({ client, churn: getClientChurnRiskState(client, tasks, threads, todayIso) }));
  return {
    generatedAt: nowIso(),
    total: rows.length,
    critical: rows.filter(item => item.churn.status === 'critical').length,
    high: rows.filter(item => item.churn.status === 'high').length,
    watch: rows.filter(item => item.churn.status === 'watch').length,
    stable: rows.filter(item => item.churn.status === 'stable').length,
    exposedValue: rows.reduce((sum, item) => sum + Number(item.churn.exposedValue || 0), 0),
    rows
  };
}

export function buildAeChurnExposureSummary(aeProfiles = [], clients = [], tasks = [], threads = [], todayIso = nowIso().slice(0, 10)) {
  const rows = (aeProfiles || []).map(ae => {
    const ownedClients = (clients || []).filter(client => String(client.assignedAeId || '') === String(ae.id || ''));
    const churnRows = ownedClients.map(client => ({ client, churn: getClientChurnRiskState(client, tasks, threads, todayIso) }));
    const criticalClients = churnRows.filter(item => item.churn.status === 'critical').length;
    const highClients = churnRows.filter(item => item.churn.status === 'high').length;
    const exposedValue = churnRows.reduce((sum, item) => sum + Number(item.churn.exposedValue || 0), 0);
    const overdueTasks = (tasks || []).filter(task => String(task.assignedAeId || '') === String(ae.id || '') && String(task.status || 'todo') !== 'done').filter(task => {
      const delta = getDaysDelta(task.dueDate || '', todayIso);
      return delta !== null && delta < 0;
    }).length;
    const stalledThreads = (threads || []).filter(thread => String(thread.assignedAeId || thread.aeId || '') === String(ae.id || '')).filter(thread => {
      const updated = String(thread.updatedAt || thread.createdAt || '').trim();
      if (!updated) return true;
      const deltaRaw = getDaysDelta(updated, todayIso);
      const delta = deltaRaw === null ? null : Math.abs(deltaRaw);
      return delta === null || delta >= 8;
    }).length;
    const score = criticalClients * 24 + highClients * 12 + Math.min(18, overdueTasks * 4) + Math.min(16, stalledThreads * 4);
    const status = score >= 58 ? 'critical' : score >= 34 ? 'high' : score >= 18 ? 'watch' : 'healthy';
    const label = status === 'critical' ? 'Critical churn exposure' : status === 'high' ? 'High churn exposure' : status === 'watch' ? 'Watch churn exposure' : 'Healthy churn exposure';
    return { ae, status, label, score, criticalClients, highClients, exposedValue, overdueTasks, stalledThreads, clientCount: ownedClients.length };
  });
  return {
    generatedAt: nowIso(),
    total: rows.length,
    critical: rows.filter(item => item.status === 'critical').length,
    high: rows.filter(item => item.status === 'high').length,
    watch: rows.filter(item => item.status === 'watch').length,
    healthy: rows.filter(item => item.status === 'healthy').length,
    exposedValue: rows.reduce((sum, item) => sum + Number(item.exposedValue || 0), 0),
    rows
  };
}


export function getClientOfferFitState(client = {}, offerCatalog = DEFAULT_OFFER_CATALOG) {
  const catalog = buildOfferCatalog(offerCatalog);
  const stage = String(client.stage || 'intake').toLowerCase();
  const priority = String(client.priority || 'normal').toLowerCase();
  const clientTypeTags = tagify(client.clientType);
  const textTags = [
    ...tagify(client.tags),
    ...tagify(client.needs),
    ...clientTypeTags,
    ...tagify(client.notes),
    ...tagify(client.nextStep),
    ...tagify(client.company),
    ...tagify(client.name)
  ];
  const monthlyValue = Math.max(0, toMoney(client.monthlyValue));
  const estimatedValue = Math.max(0, toMoney(client.estimatedValue));
  const pipelineValue = estimatedValue > 0 ? estimatedValue : monthlyValue * 6;
  const followUpDelta = getDaysDelta(client.followUpDate || '', nowIso().slice(0, 10));
  const scoredOffers = catalog.map(offer => {
    let score = 0;
    const reasons = [];
    for (const tag of offer.tags || []) {
      if (textTags.includes(tag)) {
        score += 16;
        reasons.push(`Matches ${tag} signal.`);
      }
    }
    for (const type of offer.clientTypes || []) {
      if (clientTypeTags.includes(type)) {
        score += 14;
        reasons.push(`Built for ${type} client type.`);
      }
    }
    if (stage === 'new') { score += 8; reasons.push('New inquiry supports offer movement.'); }
    if (stage === 'active') { score += 6; reasons.push('Active account can support expansion or close motion.'); }
    if (priority === 'urgent') { score += 10; reasons.push('Urgency raises close velocity.'); }
    if (followUpDelta !== null && followUpDelta <= 2) { score += 6; reasons.push('Immediate follow-up window is open.'); }
    if ((offer.category === 'commerce' && (textTags.includes('merch') || textTags.includes('ecommerce') || textTags.includes('printful'))) ||
        (offer.category === 'appointment' && (textTags.includes('booking') || textTags.includes('calendar') || textTags.includes('appointment'))) ||
        (offer.category === 'inspection' && (textTags.includes('valuation') || textTags.includes('scan') || textTags.includes('website') || textTags.includes('zip')))) {
      score += 18;
      reasons.push(`Strong category fit for ${offer.category}.`);
    }
    if (pipelineValue >= 50000 && ['control-plane', 'commerce', 'inspection'].includes(offer.category)) {
      score += 12;
      reasons.push('Pipeline size can absorb premium product positioning.');
    } else if (pipelineValue >= 15000) {
      score += 6;
      reasons.push('Pipeline size supports product expansion.');
    }
    const projectedValue = Number(offer.oneTimePrice || 0) + Number(offer.monthlyPrice || 0) * (monthlyValue > 0 ? 12 : 6);
    return { offer, score, projectedValue, reasons };
  }).sort((a, b) => (b.score - a.score) || (b.projectedValue - a.projectedValue));
  const topOffers = scoredOffers.slice(0, 3);
  const totalProjectedValue = topOffers.slice(0, 2).reduce((sum, item) => sum + Number(item.projectedValue || 0), 0);
  const status = topOffers[0]?.score >= 70 ? 'hot' : topOffers[0]?.score >= 48 ? 'warm' : topOffers[0]?.score >= 28 ? 'watch' : 'low';
  const label = status === 'hot' ? 'Hot offer-fit opportunity' : status === 'warm' ? 'Warm offer-fit opportunity' : status === 'watch' ? 'Watch offer-fit opportunity' : 'Low offer-fit opportunity';
  return { score: topOffers[0]?.score || 0, label, status, reasons: topOffers[0]?.reasons || [], totalProjectedValue, topOffers, stage, priority, pipelineValue };
}

export function buildOfferCommandSummary(clients = [], offerCatalog = DEFAULT_OFFER_CATALOG) {
  const rows = (clients || []).map(client => ({ client, fit: getClientOfferFitState(client, offerCatalog) }));
  return {
    generatedAt: nowIso(),
    total: rows.length,
    hot: rows.filter(item => item.fit.status === 'hot').length,
    warm: rows.filter(item => item.fit.status === 'warm').length,
    watch: rows.filter(item => item.fit.status === 'watch').length,
    projectedValue: rows.reduce((sum, item) => sum + Number(item.fit.totalProjectedValue || 0), 0),
    rows
  };
}

export function buildAeOfferCoverageSummary(aeProfiles = [], clients = [], offerCatalog = DEFAULT_OFFER_CATALOG) {
  const rows = (aeProfiles || []).map(ae => {
    const ownedClients = (clients || []).filter(client => String(client.assignedAeId || '') === String(ae.id || ''));
    const fits = ownedClients.map(client => getClientOfferFitState(client, offerCatalog));
    const hotClients = fits.filter(item => item.status === 'hot').length;
    const warmClients = fits.filter(item => item.status === 'warm').length;
    const projectedValue = fits.reduce((sum, item) => sum + Number(item.totalProjectedValue || 0), 0);
    let score = hotClients * 28 + warmClients * 16 + Math.min(24, ownedClients.length * 2);
    if (projectedValue >= 120000) score += 24;
    else if (projectedValue >= 60000) score += 14;
    const status = score >= 75 ? 'critical' : score >= 48 ? 'high' : score >= 24 ? 'watch' : 'healthy';
    const label = status === 'critical' ? 'Critical offer coverage' : status === 'high' ? 'High offer coverage' : status === 'watch' ? 'Watch offer coverage' : 'Healthy offer coverage';
    return { ae, status, label, score, hotClients, warmClients, projectedValue, clientCount: ownedClients.length };
  });
  return {
    generatedAt: nowIso(),
    critical: rows.filter(item => item.status === 'critical').length,
    high: rows.filter(item => item.status === 'high').length,
    watch: rows.filter(item => item.status === 'watch').length,
    projectedValue: rows.reduce((sum, item) => sum + Number(item.projectedValue || 0), 0),
    rows
  };
}
