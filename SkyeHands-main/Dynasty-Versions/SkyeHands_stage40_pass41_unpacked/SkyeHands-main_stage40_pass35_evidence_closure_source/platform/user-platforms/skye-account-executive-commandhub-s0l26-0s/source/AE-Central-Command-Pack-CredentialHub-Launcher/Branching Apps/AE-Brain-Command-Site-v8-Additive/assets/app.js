import { defaultState, normalizeState, autoAssignClient, assignClient, exportState, nowIso, uid, rankAeCandidates, getClientRenewalRiskState, buildRenewalRiskSummary, getAeCoveragePressureState, buildAeCoverageSummary, getClientReactivationState, buildReactivationSummary, getClientPromiseIntegrityState, buildPromiseIntegritySummary, buildAePromiseLoadSummary, getClientChurnRiskState, buildChurnRiskSummary, buildAeChurnExposureSummary, getClientOfferFitState, buildOfferCommandSummary, buildAeOfferCoverageSummary, getDaysDelta } from './core.mjs';
import { loadHybridState, saveHybridState, syncHybridStateToNeon, listStorageSyncEvents } from './storage.mjs';

const STORAGE_KEY = 'ae.brain.command.site.v8.additive';
const ROSTER_URL = './data/ae-roster.json';
const DIRECTIVE_URL = './docs/BUILD_DIRECTIVE.md';

const pageMeta = {
  dashboard: { title: 'Dashboard', subtitle: 'Command summary, AE load, stage and priority mix, recent tasks, and transcript activity.' },
  clients: { title: 'Clients', subtitle: 'Client ledger, intake, stage and priority control, export, bulk actions, dossier, and assignment history.' },
  'ae-brains': { title: 'AE Brains', subtitle: '13 named AEs, headshot prompts, caps, key slots, and enable/disable controls.' },
  'live-brain': { title: 'Live Brain', subtitle: 'Donor-based server brain lane with 13 AE key slots, founder auth, and transcript-backed live turns.' },
  tasks: { title: 'Task Board', subtitle: 'Task capture, status movement, AE linkage, and client linkage.' },
  transcripts: { title: 'Transcript Center', subtitle: 'Conversation threads, transcript search, and offline message logging.' },
  directive: { title: 'Directive', subtitle: 'Directive file rendered inside the app with checkmarks only where smoke-backed implementation exists.' },
  access: { title: 'Access', subtitle: 'Owner/admin/operator access, roles, and multi-user branch control.' },
  'appointment-brain': { title: 'Appointment Brain', subtitle: 'Integrated appointment-setter command lane with handoffs, bookings, reminders, no-show pressure, and return-to-AE control.' },
  'printful-brain': { title: 'Printful Brain', subtitle: 'Integrated merch and POD commerce lane with client handoffs, draft orders, production tracking, and bridge export.' }
};

const navItems = [
  ['dashboard', 'Dashboard'],
  ['clients', 'Clients'],
  ['ae-brains', 'AE Brains'],
  ['live-brain', 'Live Brain'],
  ['tasks', 'Task Board'],
  ['transcripts', 'Transcript Center'],
  ['directive', 'Directive'],
  ['access', 'Access'],
  ['appointment-brain', 'Appointment Brain'],
  ['printful-brain', 'Printful Brain']
];

let rosterSeed = [];
let state = null;
let page = 'dashboard';
let selectedClientIds = new Set();
let selectedTaskIds = new Set();
let editingClientId = '';
let editingTaskId = '';
let clientFilters = { query: '', aeId: '', stage: '', priority: '', health: '', touch: '', value: '' };
let taskFilters = { query: '', status: '', aeId: '', clientId: '', due: '' };
let transcriptFilters = { query: '', aeId: '', clientId: '', state: '' };
let auditFilters = { query: '', source: 'all', kind: '' };
let founderSession = { authenticated: false, email: '', role: 'local-only', mode: 'local-only' };
let remoteStateStatus = 'unavailable';
let liveBrainStatus = 'unavailable';
let liveConsole = { aeId: '', clientId: '', threadId: '', subject: '', sending: false, error: '', info: '', stream: true };
let accessState = { users: [], status: 'local-only', error: '' };
let remoteHealth = null;
let remoteUsage = { totals: [], recent: [] };
let remoteAudit = [];
let liveSmoke = { running: false, dryRun: false, ranAt: '', summary: null, results: [] };
let donorTemplate = { endpointMode: 'chat', primaryProvider: 'openai', failoverProviders: ['anthropic', 'gemini'], model: 'gpt-4.1-mini', temperature: 0.7, maxOutputTokens: 900, streamDefault: true, note: '' };
let smokeReports = [];
let compareConsole = { message: '', aeIds: [], running: false, summary: null, results: [] };
let persistTimer = null;
let storageBridge = { source: 'localStorage', indexedDb: false, neonSync: 'idle', snapshotAt: '', syncEvents: [] };

const TASK_TEMPLATE_LIBRARY = [
  {
    id: 'intro-call',
    label: 'Intro Call',
    title: 'Intro call — {{clientName}}',
    offsetDays: 1,
    notes: 'Confirm goals, decision-makers, timeline, and current blockers. Capture next step before closing the call.'
  },
  {
    id: 'proposal-followup',
    label: 'Proposal Follow-Up',
    title: 'Proposal follow-up — {{clientName}}',
    offsetDays: 3,
    notes: 'Review proposal status, objections, budget fit, and decision timeline. Push for a clear yes/no or next checkpoint.'
  },
  {
    id: 'review-recovery',
    label: 'Review Recovery',
    title: 'Review recovery — {{clientName}}',
    offsetDays: 2,
    notes: 'Check service friction, identify what needs correction, and ask for a direct status update after the fix.'
  },
  {
    id: 'renewal-checkpoint',
    label: 'Renewal Checkpoint',
    title: 'Renewal checkpoint — {{clientName}}',
    offsetDays: 14,
    notes: 'Prepare renewal conversation, value recap, expansion opportunities, and retention blockers.'
  }
];

const CLIENT_ACTION_PLAN_LIBRARY = [
  {
    id: 'stabilize-7',
    label: '7-Day Stabilize Plan',
    steps: [
      { title: 'Stabilize triage — {{clientName}}', offsetDays: 0, notes: 'Review risk factors, confirm owner, and lock the immediate next step.' },
      { title: 'Midweek status check — {{clientName}}', offsetDays: 3, notes: 'Confirm movement on the agreed next step and surface new blockers.' },
      { title: '7-day closeout review — {{clientName}}', offsetDays: 7, notes: 'Evaluate whether the account is stabilized or needs escalation.' }
    ]
  },
  {
    id: 'growth-14',
    label: '14-Day Growth Plan',
    steps: [
      { title: 'Growth strategy review — {{clientName}}', offsetDays: 1, notes: 'Confirm expansion priorities and define the strongest growth lane.' },
      { title: 'Offer positioning checkpoint — {{clientName}}', offsetDays: 7, notes: 'Check message alignment, objections, and conversion blockers.' },
      { title: '14-day momentum review — {{clientName}}', offsetDays: 14, notes: 'Review progress, next package/add-on, and recommended scale move.' }
    ]
  }
];

const RESPONSE_PLAYBOOK_LIBRARY = [
  {
    id: 'status-check',
    label: 'Status Check',
    text: 'Hi {{clientName}} — checking in on the current status from our side. The next step we have tracked is: {{nextStep}}. Please send a direct update so we can keep momentum clean and accurate.'
  },
  {
    id: 'blocker-clear',
    label: 'Blocker Clear Request',
    text: 'Hi {{clientName}} — we have a blocker on this lane and need a direct confirmation to clear it. Current blocker context: {{latestBlocker}}. Once confirmed, we can move immediately into the next action.'
  },
  {
    id: 'executive-followup',
    label: 'Executive Follow-Up',
    text: 'Hi {{clientName}} — sending a higher-priority follow-up so this thread does not drift. We currently have {{openTasks}} open task(s), {{openThreads}} open thread(s), and the next step tracked as: {{nextStep}}. Please confirm the decision-maker update and immediate next move.'
  }
];


const APPOINTMENT_SEQUENCE_LIBRARY = [
  {
    id: 'qualification-sprint',
    label: 'Qualification Sprint',
    steps: [
      { label: 'Initial outreach', offsetDays: 0, note: 'Confirm interest, timing, and the best contact lane.' },
      { label: 'Qualification checkpoint', offsetDays: 1, note: 'Verify service fit, urgency, and whether the lead is real for booking.' },
      { label: 'Booking push', offsetDays: 3, note: 'Push for a concrete time selection or clear disqualification.' }
    ]
  },
  {
    id: 'show-up-defense',
    label: 'Show-Up Defense',
    steps: [
      { label: 'Reminder confirmation', offsetDays: -1, note: 'Confirm attendance and make sure reminder delivery is acknowledged.' },
      { label: 'Morning-of lock', offsetDays: 0, note: 'Send same-day attendance lock and contingency instructions.' },
      { label: 'If-missed recovery', offsetDays: 1, note: 'If the client missed, move immediately into reschedule or return-to-AE handling.' }
    ]
  },
  {
    id: 'reactivation-run',
    label: 'Reactivation Run',
    steps: [
      { label: 'Cold lead re-open', offsetDays: 0, note: 'Re-open the lead with a direct status question and one simple next step.' },
      { label: 'Value recap', offsetDays: 2, note: 'Restate value, timing, and why the appointment matters now.' },
      { label: 'Final fork', offsetDays: 5, note: 'Force a clean branch: book, disqualify, or return to AE.' }
    ]
  }
];

const APPOINTMENT_SLOT_TEMPLATE_LIBRARY = [
  { id: 'weekday-am', label: 'Weekday AM', weekday: [1,2,3,4,5], hour: 9, minute: 0, durationMinutes: 60 },
  { id: 'weekday-mid', label: 'Weekday Midday', weekday: [1,2,3,4,5], hour: 13, minute: 0, durationMinutes: 60 },
  { id: 'weekday-pm', label: 'Weekday PM', weekday: [1,2,3,4,5], hour: 16, minute: 0, durationMinutes: 60 },
  { id: 'sat-am', label: 'Saturday AM', weekday: [6], hour: 10, minute: 0, durationMinutes: 60 }
];


const APPOINTMENT_FULFILLMENT_TEMPLATE_LIBRARY = [
  {
    id: 'service-launch',
    label: 'Service Launch',
    steps: [
      { label: 'Kickoff handoff', offsetDays: 0, minutes: 20, note: 'Confirm scope, owner, and delivery target.' },
      { label: 'Collect fulfillment materials', offsetDays: 1, minutes: 35, note: 'Gather intake documents, assets, and client approvals.' },
      { label: 'First delivery checkpoint', offsetDays: 3, minutes: 45, note: 'Send the first delivery touchpoint or readiness update.' }
    ]
  },
  {
    id: 'premium-whiteglove',
    label: 'Premium White-Glove',
    steps: [
      { label: 'Executive confirmation', offsetDays: 0, minutes: 30, note: 'Confirm executive expectations, timing, and protected contact lane.' },
      { label: 'Priority delivery block', offsetDays: 1, minutes: 55, note: 'Reserve priority production time and assign the owner.' },
      { label: 'White-glove closeout', offsetDays: 4, minutes: 40, note: 'Deliver final review packet, approvals, and concierge follow-through.' }
    ]
  },
  {
    id: 'local-growth-sprint',
    label: 'Local Growth Sprint',
    steps: [
      { label: 'Local intake lock', offsetDays: 0, minutes: 15, note: 'Lock business details, markets, and local service territory.' },
      { label: 'Asset and offer review', offsetDays: 2, minutes: 30, note: 'Review existing pages, offers, reviews, and local proof points.' },
      { label: 'Go-live follow-through', offsetDays: 5, minutes: 35, note: 'Confirm launch status, appointment outcomes, and next growth move.' }
    ]
  }
];

const TASK_RECURRENCE_OPTIONS = [
  { value: 'none', label: 'No recurrence', days: 0 },
  { value: 'daily', label: 'Daily', days: 1 },
  { value: 'weekly', label: 'Weekly', days: 7 },
  { value: 'biweekly', label: 'Biweekly', days: 14 },
  { value: 'monthly', label: 'Monthly', days: 30 }
];



const COMMAND_MACRO_LIBRARY = [
  {
    id: 'morning-triage',
    label: 'Morning Triage',
    description: 'Save a restore point, run enabled automations, and archive the ops snapshot and command brief.',
    actions: ['snapshot', 'automations', 'ops-snapshot', 'command-brief']
  },
  {
    id: 'revenue-review',
    label: 'Revenue Review',
    description: 'Save a restore point, archive revenue and pipeline planning briefs, and capture AE ownership exposure.',
    actions: ['snapshot', 'revenue-brief', 'pipeline-brief', 'ownership-brief']
  },
  {
    id: 'recovery-sweep',
    label: 'Recovery Sweep',
    description: 'Save a restore point, run enabled automations, and archive the SLA and cadence briefs for recovery work.',
    actions: ['snapshot', 'automations', 'sla-brief', 'cadence-brief']
  },
  {
    id: 'end-of-day',
    label: 'End of Day Wrap',
    description: 'Save a restore point, archive the daily focus and alert digest, and preserve the current working state.',
    actions: ['snapshot', 'daily-focus', 'alert-digest']
  }
];

function getDefaultAutomationRules() {
  return [
    {
      id: 'overdue-followup-task',
      label: 'Overdue follow-up task creation',
      description: 'Create a follow-up task when a client follow-up date is overdue and no open follow-up task already exists.',
      enabled: true,
      kind: 'client-followup',
      severity: 'high'
    },
    {
      id: 'stale-thread-response-task',
      label: 'Stale thread response tasks',
      description: 'Create a response task when a thread becomes stale or is still awaiting response.',
      enabled: true,
      kind: 'stale-thread',
      severity: 'high'
    },
    {
      id: 'blocked-task-escalation-rule',
      label: 'Blocked task client escalation',
      description: 'Escalate linked clients when blocked tasks are still open and unresolved.',
      enabled: true,
      kind: 'blocked-task',
      severity: 'critical'
    },
    {
      id: 'cold-client-nudge-rule',
      label: 'Cold client nudge tasks',
      description: 'Create contact-nudge tasks for stale or cold clients without an open nudge task.',
      enabled: true,
      kind: 'cold-client',
      severity: 'watch'
    }
  ];
}

function normalizeAutomationRules(rules = []) {
  const defaults = getDefaultAutomationRules();
  return defaults.map(defaultRule => ({
    ...defaultRule,
    ...(Array.isArray(rules) ? rules.find(item => item?.id === defaultRule.id) : null),
    enabled: Array.isArray(rules) && rules.find(item => item?.id === defaultRule.id)
      ? rules.find(item => item?.id === defaultRule.id).enabled !== false
      : defaultRule.enabled !== false
  }));
}


const CLIENT_STAGE_ORDER = ['intake', 'nurture', 'active', 'blocked', 'closed'];
const CLIENT_STAGE_LABELS = {
  intake: 'Intake',
  nurture: 'Nurture',
  active: 'Active',
  blocked: 'Blocked',
  closed: 'Closed'
};

const $ = selector => document.querySelector(selector);

async function init() {
  rosterSeed = await fetch(ROSTER_URL).then(r => r.json()).catch(() => []);
  const hybridSnapshot = await loadHybridState(STORAGE_KEY);
  storageBridge.source = hybridSnapshot.source || 'empty';
  storageBridge.snapshotAt = hybridSnapshot.snapshotAt || '';
  const raw = hybridSnapshot.payload;
  state = normalizeState(raw ? JSON.parse(raw) : null, rosterSeed);
  if (!state.aeProfiles.length) state = defaultState(rosterSeed);
  donorTemplate = state.donorTemplate || donorTemplate;
  smokeReports = Array.isArray(state.smokeReports) ? state.smokeReports : smokeReports;
  const hashPage = String(window.location.hash || '').replace(/^#/, '').trim();
  if (hashPage && pageMeta[hashPage]) page = hashPage;
  state.briefArchive = Array.isArray(state.briefArchive) ? state.briefArchive : [];
  state.alertStates = state.alertStates && typeof state.alertStates === 'object' ? state.alertStates : {};
  state.automationRules = normalizeAutomationRules(state.automationRules);
  state.automationRuns = Array.isArray(state.automationRuns) ? state.automationRuns : [];
  state.restorePoints = Array.isArray(state.restorePoints) ? state.restorePoints : [];
  state.workspacePresets = Array.isArray(state.workspacePresets) ? state.workspacePresets : [];
  state.macroRuns = Array.isArray(state.macroRuns) ? state.macroRuns : [];
  ensureAppointmentBridge();
  loadAppointmentDonorRuntimeSeed();
  storageBridge.syncEvents = await listStorageSyncEvents(8);
  await refreshFounderSession();
  await tryLoadRemoteResources();
  await tryLoadRemoteState();
  await refreshRemoteOps();
  renderNav();
  bindGlobal();
  updateSessionBadge();
  render();
}

function persist() {
  state.updatedAt = nowIso();
  state.donorTemplate = donorTemplate;
  state.smokeReports = smokeReports;
  const payload = exportState(state);
  void saveHybridState(STORAGE_KEY, payload).then((result) => {
    storageBridge.indexedDb = Boolean(result?.indexedDb);
    storageBridge.snapshotAt = result?.savedAt || nowIso();
  });
  void syncHybridStateToNeon(payload, founderSession?.email || 'local-founder').then((result) => {
    storageBridge.neonSync = result?.ok ? 'synced' : 'pending';
  });
  void listStorageSyncEvents(8).then((rows) => { storageBridge.syncEvents = rows; });
  scheduleRemotePersist();
}

function renderNav() {
  $('#nav').innerHTML = navItems.map(([key, label]) => `<button data-page="${key}" class="${key === page ? 'active' : ''}">${label}</button>`).join('');
  $('#nav').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      page = btn.dataset.page;
      window.location.hash = page;
      renderNav();
      render();
    });
  });
}

function bindGlobal() {
  $('#seed-btn').addEventListener('click', seedDemoData);
  $('#export-btn').addEventListener('click', exportJson);
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', importJson);
  $('#founder-login-btn').addEventListener('click', founderLoginPrompt);
  $('#founder-logout-btn').addEventListener('click', founderLogout);
}

function statCard(label, value, note) {
  return `<div class="card stat"><div class="eyebrow">${label}</div><div class="value">${value}</div><div class="meta">${note}</div></div>`;
}

function countOpenTasks() {
  return state.tasks.filter(task => task.status !== 'done').length;
}

function countActiveThreads() {
  return state.threads.length;
}

function getClientStageCounts() {
  return state.clients.reduce((acc, client) => {
    const key = client.stage || 'intake';
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});
}

function getClientPriorityCounts() {
  return state.clients.reduce((acc, client) => {
    const key = client.priority || 'normal';
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});
}

function getClientHealth(client) {
  const reasons = [];
  let score = 0;
  const due = getClientDueState(client);
  const openTasks = getClientRelatedTasks(client.id).filter(task => String(task.status || 'todo') !== 'done');
  const overdueTasks = openTasks.filter(task => getTaskDueState(task).status === 'overdue');
  const openThreads = getClientRelatedThreads(client.id).filter(thread => String(thread.state || 'open') !== 'resolved');

  if (!client.assignedAeId) {
    score += 3;
    reasons.push('No AE assigned');
  }
  if ((client.priority || 'normal') === 'urgent') {
    score += 4;
    reasons.push('Urgent priority');
  } else if ((client.priority || 'normal') === 'high') {
    score += 2;
    reasons.push('High priority');
  }
  if ((client.stage || 'intake') === 'blocked') {
    score += 4;
    reasons.push('Blocked stage');
  } else if ((client.stage || 'intake') === 'nurture') {
    score += 1;
    reasons.push('Nurture stage');
  }
  if (due.status === 'overdue') {
    score += 4;
    reasons.push('Follow-up overdue');
  } else if (due.status === 'today') {
    score += 2;
    reasons.push('Follow-up due today');
  }
  if (overdueTasks.length) {
    score += 3;
    reasons.push(`${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'}`);
  }
  if (openTasks.length >= 3) {
    score += 2;
    reasons.push(`${openTasks.length} open tasks`);
  }
  if (openThreads.length >= 2) {
    score += 1;
    reasons.push(`${openThreads.length} open threads`);
  }
  if (!String(client.nextStep || '').trim()) {
    score += 1;
    reasons.push('No next step set');
  }

  let status = 'healthy';
  let label = 'Healthy';
  if (score >= 8) {
    status = 'critical';
    label = 'Critical';
  } else if (score >= 4) {
    status = 'watch';
    label = 'Watch';
  }
  return {
    status,
    label,
    score,
    reasons,
    openTasks: openTasks.length,
    overdueTasks: overdueTasks.length,
    openThreads: openThreads.length,
    followUpState: due.status
  };
}

function getClientHealthCounts() {
  return state.clients.reduce((acc, client) => {
    const key = getClientHealth(client).status;
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, { healthy: 0, watch: 0, critical: 0 });
}

function getAtRiskClients(limit = 8) {
  return state.clients
    .map(client => ({ client, health: getClientHealth(client) }))
    .filter(item => item.health.status !== 'healthy')
    .sort((a, b) => Number(b.health.score || 0) - Number(a.health.score || 0) || String(a.client.followUpDate || '').localeCompare(String(b.client.followUpDate || '')))
    .slice(0, limit);
}


function getTodayIsoDate() {
  return nowIso().slice(0, 10);
}

function getClientDueState(client) {
  const followUpDate = String(client.followUpDate || '').trim();
  if (!followUpDate) return { status: 'none', label: 'No follow-up date' };
  const today = getTodayIsoDate();
  if (followUpDate < today) return { status: 'overdue', label: `Overdue since ${followUpDate}` };
  if (followUpDate === today) return { status: 'today', label: `Due today · ${followUpDate}` };
  return { status: 'upcoming', label: `Upcoming · ${followUpDate}` };
}

function getFollowupQueue(limit = 8) {
  return [...state.clients]
    .filter(client => String(client.followUpDate || '').trim())
    .sort((a, b) => String(a.followUpDate || '').localeCompare(String(b.followUpDate || '')))
    .slice(0, limit);
}

function getFollowupCounts() {
  return state.clients.reduce((acc, client) => {
    const key = getClientDueState(client).status;
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, { overdue: 0, today: 0, upcoming: 0, none: 0 });
}

function getTaskDueState(task) {
  const dueDate = String(task?.dueDate || '').trim();
  if (!dueDate) return { status: 'none', label: 'No due date' };
  const today = getTodayIsoDate();
  if (dueDate < today) return { status: 'overdue', label: `Overdue since ${dueDate}` };
  if (dueDate === today) return { status: 'today', label: `Due today · ${dueDate}` };
  return { status: 'upcoming', label: `Upcoming · ${dueDate}` };
}

function getTaskDueCounts() {
  return state.tasks.reduce((acc, task) => {
    const key = getTaskDueState(task).status;
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, { overdue: 0, today: 0, upcoming: 0, none: 0 });
}

function getTaskQueue(limit = 8) {
  return [...state.tasks]
    .filter(task => String(task.dueDate || '').trim() && String(task.status || 'todo') !== 'done')
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')))
    .slice(0, limit);
}

function getRecurrenceConfig(cadence = 'none') {
  return TASK_RECURRENCE_OPTIONS.find(option => option.value === cadence) || TASK_RECURRENCE_OPTIONS[0];
}

function getRecurringOpenTaskCount() {
  return state.tasks.filter(task => String(task.recurrenceCadence || 'none') !== 'none' && String(task.status || 'todo') !== 'done').length;
}

function getRecurringTaskQueue(limit = 8) {
  return [...state.tasks]
    .filter(task => String(task.recurrenceCadence || 'none') !== 'none' && String(task.status || 'todo') !== 'done')
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, limit)
    .map(task => ({ task, recurrence: getRecurrenceConfig(task.recurrenceCadence) }));
}

function buildNextRecurringTask(task) {
  const recurrence = getRecurrenceConfig(task?.recurrenceCadence || 'none');
  if (!task || recurrence.value === 'none' || !recurrence.days) return null;
  const nextDueDate = isoDatePlusDays(task.dueDate || getTodayIsoDate(), recurrence.days);
  return {
    id: uid('task'),
    title: task.title,
    dueDate: nextDueDate,
    assignedAeId: task.assignedAeId || '',
    assignedAeName: task.assignedAeName || '',
    clientId: task.clientId || '',
    clientName: task.clientName || '',
    notes: task.notes || '',
    status: 'todo',
    blockerNote: '',
    dependsOnTaskId: '',
    dependsOnTaskTitle: '',
    recurrenceCadence: recurrence.value,
    recurrenceSourceTaskId: task.recurrenceSourceTaskId || task.id,
    recurrenceParentTaskId: task.id,
    recurrenceSpawnedFromAt: nowIso(),
    recurrenceIteration: Number(task.recurrenceIteration || 1) + 1,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

function spawnRecurringTaskIfNeeded(task) {
  const nextTask = buildNextRecurringTask(task);
  if (!nextTask) return null;
  state.tasks.unshift(nextTask);
  remoteUpsert('tasks', nextTask);
  state.auditLog.unshift({ id: uid('audit'), kind: 'task-recurrence-spawn', message: `Recurring task spawned: ${nextTask.title} · ${nextTask.dueDate}`, at: nowIso() });
  return nextTask;
}

function getTaskDependency(task) {
  const dependencyId = String(task?.dependsOnTaskId || '').trim();
  if (!dependencyId) return { status: 'none', label: 'No dependency', task: null };
  const dependencyTask = state.tasks.find(item => item.id === dependencyId) || null;
  if (!dependencyTask) return { status: 'missing', label: `Missing dependency · ${task?.dependsOnTaskTitle || 'Unknown task'}`, task: null };
  if (String(dependencyTask.status || 'todo') === 'done') return { status: 'ready', label: `Ready · ${dependencyTask.title}`, task: dependencyTask };
  return { status: 'waiting', label: `Waiting on ${dependencyTask.title} · ${dependencyTask.status || 'todo'}`, task: dependencyTask };
}

function syncTaskDependencyState(task, persistChange = false) {
  if (!task) return { status: 'none', label: 'No dependency', task: null };
  const dependency = getTaskDependency(task);
  const waitingNotePrefix = 'Waiting on dependency:';
  if (dependency.task) task.dependsOnTaskTitle = dependency.task.title;
  if (task.dependsOnTaskId && dependency.status !== 'ready' && String(task.status || 'todo') !== 'done') {
    task.status = 'waiting';
    task.blockerNote = `${waitingNotePrefix} ${dependency.task?.title || task.dependsOnTaskTitle || 'Unknown task'}`;
  } else if (task.dependsOnTaskId && dependency.status === 'ready' && String(task.status || 'todo') === 'waiting') {
    task.status = 'todo';
    if (String(task.blockerNote || '').startsWith(waitingNotePrefix)) task.blockerNote = '';
  }
  if (persistChange) {
    task.updatedAt = nowIso();
    remoteUpsert('tasks', task);
  }
  return dependency;
}

function refreshDependentTasksForTask(taskId) {
  const dependents = state.tasks.filter(item => item.dependsOnTaskId === taskId);
  dependents.forEach(task => syncTaskDependencyState(task, true));
  return dependents.length;
}

function getTaskDependencyCounts() {
  return state.tasks.reduce((acc, task) => {
    if (!task.dependsOnTaskId) return acc;
    const dependency = getTaskDependency(task);
    acc.total += 1;
    if (dependency.status === 'ready') acc.ready += 1;
    else acc.waiting += 1;
    return acc;
  }, { total: 0, ready: 0, waiting: 0 });
}

function getDependencyBlockedTasks(limit = 8) {
  return state.tasks
    .map(task => ({ task, dependency: getTaskDependency(task) }))
    .filter(item => item.task.dependsOnTaskId && String(item.task.status || 'todo') !== 'done' && item.dependency.status !== 'ready')
    .sort((a, b) => String(b.task.updatedAt || '').localeCompare(String(a.task.updatedAt || '')))
    .slice(0, limit);
}

function resumeTaskIfDependencyReady(taskId) {
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) return false;
  const dependency = syncTaskDependencyState(task, false);
  if (dependency.status !== 'ready') return false;
  task.updatedAt = nowIso();
  remoteUpsert('tasks', task);
  state.auditLog.unshift({ id: uid('audit'), kind: 'task-dependency-resume', message: `${task.title} resumed after dependency cleared`, at: nowIso() });
  persist();
  return true;
}


function daysAgoIso(days = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function getThreadFreshness(thread) {
  const latestMessageAt = state.messages
    .filter(message => message.threadId === thread.id)
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))[0]?.at || '';
  const lastTouch = String(latestMessageAt || thread.updatedAt || thread.createdAt || '').slice(0, 10);
  const open = (thread.state || 'open') !== 'resolved';
  if (!lastTouch) return { status: 'unknown', label: 'No thread activity date', ageDays: null, open };
  const today = getTodayIsoDate();
  const ms = new Date(`${today}T00:00:00Z`).getTime() - new Date(`${lastTouch}T00:00:00Z`).getTime();
  const ageDays = Math.max(Math.floor(ms / 86400000), 0);
  if (!open) return { status: 'resolved', label: `Resolved · last touch ${lastTouch}`, ageDays, open };
  if (ageDays >= 5) return { status: 'stale', label: `Stale · ${ageDays} days since last touch`, ageDays, open };
  if (ageDays >= 2) return { status: 'watch', label: `Watching · ${ageDays} days since last touch`, ageDays, open };
  if (ageDays === 0) return { status: 'today', label: `Updated today · ${lastTouch}`, ageDays, open };
  return { status: 'fresh', label: `Fresh · ${ageDays} day${ageDays === 1 ? '' : 's'} since last touch`, ageDays, open };
}

function getThreadFreshnessCounts() {
  return state.threads.reduce((acc, thread) => {
    const key = getThreadFreshness(thread).status;
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, { today: 0, fresh: 0, watch: 0, stale: 0, resolved: 0, unknown: 0 });
}

function getStaleThreads(limit = 8) {
  return state.threads
    .map(thread => ({ thread, freshness: getThreadFreshness(thread) }))
    .filter(item => item.freshness.status === 'stale')
    .sort((a, b) => Number(b.freshness.ageDays || 0) - Number(a.freshness.ageDays || 0) || String(b.thread.updatedAt || '').localeCompare(String(a.thread.updatedAt || '')))
    .slice(0, limit);
}

function getThreadResponseLag(thread) {
  const messages = state.messages.filter(message => message.threadId === thread.id).sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  const lastMessage = messages[messages.length - 1] || null;
  const lastUserMessage = [...messages].reverse().find(message => message.role === 'user') || null;
  const lastAssistantMessage = [...messages].reverse().find(message => message.role === 'assistant') || null;
  const awaiting = Boolean(lastMessage && lastMessage.role === 'user' && (thread.state || 'open') !== 'resolved');
  if (!awaiting || !lastUserMessage) return { awaiting: false, status: 'idle', label: 'No pending user reply', ageDays: 0, ageHours: 0, lastUserMessage, lastAssistantMessage };
  const ms = new Date(nowIso()).getTime() - new Date(lastUserMessage.at).getTime();
  const ageHours = Math.max(Math.floor(ms / 3600000), 0);
  const ageDays = Math.max(Math.floor(ms / 86400000), 0);
  const status = ageHours >= 48 ? 'critical' : ageHours >= 24 ? 'watch' : 'fresh';
  const label = status === 'critical' ? `Critical wait · ${ageHours}h since last user message` : status === 'watch' ? `Watch wait · ${ageHours}h since last user message` : `Fresh wait · ${ageHours}h since last user message`;
  return { awaiting: true, status, label, ageDays, ageHours, lastUserMessage, lastAssistantMessage };
}

function getAwaitingResponseThreads(limit = 8) {
  return state.threads
    .map(thread => ({ thread, lag: getThreadResponseLag(thread) }))
    .filter(item => item.lag.awaiting)
    .sort((a, b) => Number(b.lag.ageHours || 0) - Number(a.lag.ageHours || 0) || String(b.thread.updatedAt || '').localeCompare(String(a.thread.updatedAt || '')))
    .slice(0, limit);
}

function getAwaitingResponseCounts() {
  return state.threads.reduce((acc, thread) => {
    const lag = getThreadResponseLag(thread);
    if (!lag.awaiting) return acc;
    acc.awaiting += 1;
    acc[lag.status] = Number(acc[lag.status] || 0) + 1;
    return acc;
  }, { awaiting: 0, fresh: 0, watch: 0, critical: 0 });
}

function getClientLastTouchAt(client) {
  if (!client) return '';
  const threadIds = state.threads.filter(thread => thread.clientId === client.id).map(thread => thread.id);
  const messageDates = state.messages.filter(message => threadIds.includes(message.threadId)).map(message => String(message.at || ''));
  const taskDates = state.tasks.filter(task => task.clientId === client.id).map(task => String(task.updatedAt || task.createdAt || ''));
  const candidateDates = [String(client.updatedAt || ''), String(client.createdAt || ''), ...messageDates, ...taskDates].filter(Boolean).sort();
  return candidateDates[candidateDates.length - 1] || '';
}

function getClientTouchStatus(client) {
  const latestTouch = getClientLastTouchAt(client);
  if (!latestTouch) return { status: 'unknown', label: 'No client touch recorded', ageDays: null, lastTouch: '' };
  const lastTouchDate = String(latestTouch).slice(0, 10);
  const ms = new Date(`${getTodayIsoDate()}T00:00:00Z`).getTime() - new Date(`${lastTouchDate}T00:00:00Z`).getTime();
  const ageDays = Math.max(Math.floor(ms / 86400000), 0);
  if ((client.stage || 'intake') === 'closed') return { status: 'closed', label: `Closed · last touch ${lastTouchDate}`, ageDays, lastTouch: latestTouch };
  if (ageDays >= 14) return { status: 'cold', label: `Cold · ${ageDays} days since last touch`, ageDays, lastTouch: latestTouch };
  if (ageDays >= 7) return { status: 'stale', label: `No contact · ${ageDays} days since last touch`, ageDays, lastTouch: latestTouch };
  if (ageDays >= 3) return { status: 'watch', label: `Watch · ${ageDays} days since last touch`, ageDays, lastTouch: latestTouch };
  if (ageDays === 0) return { status: 'today', label: `Touched today · ${lastTouchDate}`, ageDays, lastTouch: latestTouch };
  return { status: 'current', label: `Current · ${ageDays} day${ageDays === 1 ? '' : 's'} since last touch`, ageDays, lastTouch: latestTouch };
}

function getClientTouchCounts() {
  return state.clients.reduce((acc, client) => {
    const key = getClientTouchStatus(client).status;
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, { today: 0, current: 0, watch: 0, stale: 0, cold: 0, closed: 0, unknown: 0 });
}

function getNoContactClients(limit = 8) {
  return state.clients
    .map(client => ({ client, touch: getClientTouchStatus(client) }))
    .filter(item => ['stale', 'cold'].includes(item.touch.status))
    .sort((a, b) => Number(b.touch.ageDays || 0) - Number(a.touch.ageDays || 0) || String(a.client.followUpDate || '').localeCompare(String(b.client.followUpDate || '')))
    .slice(0, limit);
}

function getThreadDraftQueue(limit = 8) {
  return state.threads
    .filter(thread => String(thread.draftReply || '').trim())
    .sort((a, b) => String(b.draftUpdatedAt || b.updatedAt || '').localeCompare(String(a.draftUpdatedAt || a.updatedAt || '')))
    .slice(0, limit);
}

function getClientMilestoneState(client) {
  const milestone = String(client?.currentMilestone || '').trim();
  const dueDate = String(client?.milestoneDueDate || '').trim();
  const progress = Math.max(0, Math.min(100, Number(client?.milestoneProgress || 0)));
  if (!milestone) return { status: 'none', label: 'No milestone set', progress, dueDate, milestone };
  if (progress >= 100) return { status: 'complete', label: `Completed · ${milestone}`, progress, dueDate, milestone };
  if (!dueDate) return { status: 'active', label: `Active milestone · ${milestone} · ${progress}%`, progress, dueDate, milestone };
  const today = getTodayIsoDate();
  if (dueDate < today) return { status: 'overdue', label: `Overdue milestone · ${milestone} · ${dueDate}`, progress, dueDate, milestone };
  if (dueDate === today) return { status: 'today', label: `Milestone due today · ${milestone}`, progress, dueDate, milestone };
  if (progress >= 75) return { status: 'near', label: `Near completion · ${milestone} · ${progress}%`, progress, dueDate, milestone };
  return { status: 'active', label: `Active milestone · ${milestone} · ${progress}%`, progress, dueDate, milestone };
}

function getMilestoneCounts() {
  return state.clients.reduce((acc, client) => {
    const key = getClientMilestoneState(client).status;
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, { overdue: 0, today: 0, active: 0, near: 0, complete: 0, none: 0 });
}

function getMilestoneQueue(limit = 8) {
  return state.clients
    .map(client => ({ client, milestone: getClientMilestoneState(client) }))
    .filter(item => ['overdue', 'today', 'active', 'near'].includes(item.milestone.status))
    .sort((a, b) => {
      const order = { overdue: 0, today: 1, near: 2, active: 3 };
      return (order[a.milestone.status] ?? 99) - (order[b.milestone.status] ?? 99)
        || String(a.milestone.dueDate || '9999-12-31').localeCompare(String(b.milestone.dueDate || '9999-12-31'))
        || Number(b.milestone.progress || 0) - Number(a.milestone.progress || 0);
    })
    .slice(0, limit);
}

function advanceClientMilestone(clientId, amount = 25) {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  client.milestoneProgress = Math.max(0, Math.min(100, Number(client.milestoneProgress || 0) + Number(amount || 0)));
  client.updatedAt = nowIso();
  logClientActivity(client, 'milestone-progress', 'Milestone progress updated', `${client.currentMilestone || 'No milestone'} · ${client.milestoneProgress}%`);
  remoteUpsert('clients', client);
  state.auditLog.unshift({ id: uid('audit'), kind: 'client-milestone-progress', message: `${client.name} milestone moved to ${client.milestoneProgress}%`, at: nowIso() });
  persist();
  return client;
}

function clearClientMilestone(clientId) {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const prior = client.currentMilestone || 'No milestone';
  client.currentMilestone = '';
  client.milestoneDueDate = '';
  client.milestoneProgress = 0;
  client.updatedAt = nowIso();
  logClientActivity(client, 'milestone-clear', 'Milestone cleared', prior);
  remoteUpsert('clients', client);
  state.auditLog.unshift({ id: uid('audit'), kind: 'client-milestone-clear', message: `${client.name} milestone cleared`, at: nowIso() });
  persist();
  return client;
}

function getTaskEffortState(task) {
  const estimated = Math.max(0, Number(task?.estimatedMinutes || 0));
  const actual = Math.max(0, Number(task?.actualMinutes || 0));
  const remaining = Math.max(estimated - actual, 0);
  if (!estimated && !actual) return { status: 'unestimated', label: 'No effort estimate', estimated, actual, remaining };
  if (estimated && actual > estimated) return { status: 'overrun', label: `Overrun by ${actual - estimated} min`, estimated, actual, remaining: 0 };
  if (estimated && actual >= estimated && actual > 0) return { status: 'on-target', label: `Effort hit target · ${actual}/${estimated} min`, estimated, actual, remaining: 0 };
  if (estimated && actual > 0) return { status: 'tracking', label: `Tracked ${actual}/${estimated} min`, estimated, actual, remaining };
  if (estimated) return { status: 'estimated', label: `Estimated ${estimated} min`, estimated, actual, remaining };
  return { status: 'logged', label: `Logged ${actual} min`, estimated, actual, remaining };
}

function getTaskEffortSummary() {
  return state.tasks.reduce((acc, task) => {
    const effort = getTaskEffortState(task);
    acc.estimated += effort.estimated;
    acc.actual += effort.actual;
    acc.remaining += effort.remaining;
    acc[effort.status] = Number(acc[effort.status] || 0) + 1;
    return acc;
  }, { estimated: 0, actual: 0, remaining: 0, overrun: 0, unestimated: 0, tracking: 0, estimatedCount: 0, logged: 0, 'on-target': 0 });
}

function getTaskEffortQueue(limit = 8) {
  return state.tasks
    .filter(task => String(task.status || 'todo') !== 'done')
    .map(task => ({ task, effort: getTaskEffortState(task) }))
    .filter(item => item.effort.status === 'overrun' || item.effort.estimated || item.effort.actual)
    .sort((a, b) => {
      const overrunA = Math.max(Number(a.effort.actual || 0) - Number(a.effort.estimated || 0), 0);
      const overrunB = Math.max(Number(b.effort.actual || 0) - Number(b.effort.estimated || 0), 0);
      return overrunB - overrunA || Number(b.effort.remaining || 0) - Number(a.effort.remaining || 0) || String(a.task.dueDate || '9999-12-31').localeCompare(String(b.task.dueDate || '9999-12-31'));
    })
    .slice(0, limit);
}

function addTaskActualMinutes(taskId, minutes = 15) {
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) return null;
  task.actualMinutes = Math.max(0, Number(task.actualMinutes || 0) + Number(minutes || 0));
  task.updatedAt = nowIso();
  remoteUpsert('tasks', task);
  state.auditLog.unshift({ id: uid('audit'), kind: 'task-effort-log', message: `${task.title} logged ${minutes} minute(s)`, at: nowIso() });
  persist();
  return task;
}

function getThreadSummaryCounts() {
  return state.threads.reduce((acc, thread) => {
    if (String(thread.summaryNote || '').trim()) acc.summaries += 1;
    if (String(thread.openQuestions || '').trim() && (thread.state || 'open') !== 'resolved') acc.openQuestions += 1;
    return acc;
  }, { summaries: 0, openQuestions: 0 });
}

function saveThreadSummary(threadId, summaryNote = '', openQuestions = '') {
  const thread = state.threads.find(item => item.id === threadId);
  if (!thread) return null;
  thread.summaryNote = String(summaryNote || '').trim();
  thread.openQuestions = String(openQuestions || '').trim();
  thread.summaryUpdatedAt = nowIso();
  thread.updatedAt = nowIso();
  remoteUpsert('threads', thread);
  state.auditLog.unshift({ id: uid('audit'), kind: 'thread-summary-save', message: `Summary saved for ${thread.subject}`, at: nowIso() });
  persist();
  return thread;
}

function clearThreadSummary(threadId) {
  const thread = state.threads.find(item => item.id === threadId);
  if (!thread) return null;
  thread.summaryNote = '';
  thread.openQuestions = '';
  thread.summaryUpdatedAt = '';
  thread.updatedAt = nowIso();
  remoteUpsert('threads', thread);
  state.auditLog.unshift({ id: uid('audit'), kind: 'thread-summary-clear', message: `Summary cleared for ${thread.subject}`, at: nowIso() });
  persist();
  return thread;
}

function getOpenQuestionThreads(limit = 8) {
  return state.threads
    .filter(thread => String(thread.openQuestions || '').trim() && (thread.state || 'open') !== 'resolved')
    .sort((a, b) => String(b.summaryUpdatedAt || b.updatedAt || '').localeCompare(String(a.summaryUpdatedAt || a.updatedAt || '')))
    .slice(0, limit);
}

function persistThreadDraft(threadId, value) {
  const thread = state.threads.find(item => item.id === threadId);
  if (!thread) return null;
  thread.draftReply = String(value || '');
  thread.draftUpdatedAt = thread.draftReply.trim() ? nowIso() : '';
  thread.updatedAt = nowIso();
  remoteUpsert('threads', thread);
  persist();
  return thread;
}

function clearThreadDraft(threadId) {
  const thread = state.threads.find(item => item.id === threadId);
  if (!thread) return null;
  thread.draftReply = '';
  thread.draftUpdatedAt = '';
  thread.updatedAt = nowIso();
  remoteUpsert('threads', thread);
  state.auditLog.unshift({ id: uid('audit'), kind: 'thread-draft-clear', message: `Draft cleared for ${thread.subject}`, at: nowIso() });
  persist();
  return thread;
}

function getAeWorkloadAlerts(limit = 8) {
  return state.aeProfiles
    .map(ae => {
      const capacityState = getAeCapacityState(ae);
      const affectedClients = state.clients.filter(client => client.assignedAeId === ae.id);
      const alertReasons = [];
      if (capacityState === 'disabled') alertReasons.push('AE is disabled');
      if (capacityState === 'over-cap') alertReasons.push('AE is over cap');
      if (!affectedClients.length) return null;
      if (capacityState === 'healthy' && affectedClients.length >= Math.max(Number(ae.overrideDailyCap || ae.dailyCap || 0), 4)) {
        alertReasons.push('Assignment load is heavy');
      }
      if (!alertReasons.length) return null;
      return { ae, capacityState, affectedClients, affectedCount: affectedClients.length, reason: alertReasons.join(' · ') };
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.affectedCount || 0) - Number(a.affectedCount || 0) || String(a.ae.name || '').localeCompare(String(b.ae.name || '')))
    .slice(0, limit);
}


function getTaskBlockedCounts() {
  return state.tasks.reduce((acc, task) => {
    const key = String(task.status || 'todo') === 'blocked' ? 'blocked' : 'other';
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, { blocked: 0, other: 0 });
}

function getBlockedTasks(limit = 8) {
  return state.tasks
    .filter(task => String(task.status || 'todo') === 'blocked')
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, limit);
}

function escalateBlockedTask(taskId) {
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) return null;
  const client = state.clients.find(item => item.id === task.clientId);
  if (!client) return null;
  const blocker = String(task.blockerNote || '').trim() || 'No blocker note recorded.';
  client.stage = 'blocked';
  client.priority = client.priority === 'urgent' ? 'urgent' : 'high';
  client.followUpDate = client.followUpDate || getTodayIsoDate();
  client.nextStep = `Clear blocked task: ${task.title}`;
  client.escalationLevel = client.escalationLevel && client.escalationLevel !== 'none' ? client.escalationLevel : 'watch';
  client.escalationReason = client.escalationReason || blocker;
  client.tags = buildClientTags(client);
  client.updatedAt = nowIso();
  logClientActivity(client, 'blocked-task-escalation', 'Blocked task escalated into client lane', blocker);
  remoteUpsert('clients', client);
  state.auditLog.unshift({ id: uid('audit'), kind: 'blocked-task-escalation', message: `${task.title} escalated into ${client.name}`, at: nowIso() });
  persist();
  return client;
}

function getClientSlaPressure(client) {
  const due = getClientDueState(client);
  const health = getClientHealth(client);
  const blockedTasks = getClientRelatedTasks(client.id).filter(task => String(task.status || 'todo') === 'blocked');
  const overdueTasks = getClientRelatedTasks(client.id).filter(task => String(task.status || 'todo') !== 'done' && getTaskDueState(task).status === 'overdue');
  const staleThreads = getClientRelatedThreads(client.id).filter(thread => getThreadFreshness(thread).status === 'stale');
  const watchThreads = getClientRelatedThreads(client.id).filter(thread => getThreadFreshness(thread).status === 'watch');
  let score = Number(health.score || 0);
  const reasons = [...(health.reasons || [])];
  if (blockedTasks.length) {
    score += blockedTasks.length * 4;
    reasons.push(`${blockedTasks.length} blocked task${blockedTasks.length === 1 ? '' : 's'}`);
  }
  if (overdueTasks.length) {
    score += overdueTasks.length * 2;
    reasons.push(`${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'}`);
  }
  if (staleThreads.length) {
    score += staleThreads.length * 3;
    reasons.push(`${staleThreads.length} stale thread${staleThreads.length === 1 ? '' : 's'}`);
  }
  if (watchThreads.length) {
    score += watchThreads.length;
    reasons.push(`${watchThreads.length} watch thread${watchThreads.length === 1 ? '' : 's'}`);
  }
  if (!String(client.nextStep || '').trim()) {
    score += 2;
    reasons.push('No next step recorded');
  }
  if (due.status === 'overdue') score += 3;
  const status = score >= 12 ? 'critical' : score >= 6 ? 'watch' : 'healthy';
  const label = status === 'critical' ? 'SLA critical' : status === 'watch' ? 'SLA watch' : 'SLA healthy';
  return { status, label, score, reasons, blockedTasks: blockedTasks.length, overdueTasks: overdueTasks.length, staleThreads: staleThreads.length, watchThreads: watchThreads.length };
}

function getSlaPressureCounts() {
  return state.clients.reduce((acc, client) => {
    const key = getClientSlaPressure(client).status;
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, { healthy: 0, watch: 0, critical: 0 });
}

function getSlaPressureQueue(limit = 8) {
  return state.clients
    .map(client => ({ client, sla: getClientSlaPressure(client) }))
    .filter(item => item.sla.status !== 'healthy')
    .sort((a, b) => Number(b.sla.score || 0) - Number(a.sla.score || 0) || String(a.client.followUpDate || '').localeCompare(String(b.client.followUpDate || '')))
    .slice(0, limit);
}

function getResponsePlaybookById(playbookId) {
  return RESPONSE_PLAYBOOK_LIBRARY.find(item => item.id === playbookId) || null;
}

function interpolateResponsePlaybook(text, thread, client, ae) {
  const relatedTasks = thread ? state.tasks.filter(task => task.threadId === thread.id && String(task.status || 'todo') !== 'done') : [];
  const relatedThreads = client ? getClientRelatedThreads(client.id).filter(item => (item.state || 'open') !== 'resolved') : (thread ? [thread] : []);
  const latestBlockedTask = client ? getClientRelatedTasks(client.id).filter(task => String(task.status || 'todo') === 'blocked')[0] : null;
  return String(text || '')
    .replaceAll('{{clientName}}', client?.name || thread?.clientName || 'Client')
    .replaceAll('{{company}}', client?.company || thread?.clientName || 'Company')
    .replaceAll('{{aeName}}', ae?.name || thread?.aeName || client?.assignedAeName || 'Assigned AE')
    .replaceAll('{{nextStep}}', client?.nextStep || 'next step not yet recorded')
    .replaceAll('{{latestBlocker}}', latestBlockedTask?.blockerNote || latestBlockedTask?.title || 'no blocker recorded')
    .replaceAll('{{openTasks}}', String(client ? getClientRelatedTasks(client.id).filter(task => String(task.status || 'todo') !== 'done').length : relatedTasks.length))
    .replaceAll('{{openThreads}}', String(relatedThreads.length));
}

function buildResponsePlaybookDraft(playbookId, threadId) {
  const playbook = getResponsePlaybookById(playbookId);
  const thread = state.threads.find(item => item.id === threadId);
  if (!playbook || !thread) return '';
  const client = state.clients.find(item => item.id === thread.clientId) || null;
  const ae = state.aeProfiles.find(item => item.id === (thread.aeId || client?.assignedAeId || '')) || null;
  return interpolateResponsePlaybook(playbook.text, thread, client, ae);
}

function applyResponsePlaybookToThread(playbookId, threadId, save = false) {
  const playbook = getResponsePlaybookById(playbookId);
  const thread = state.threads.find(item => item.id === threadId);
  if (!playbook || !thread) return '';
  const text = buildResponsePlaybookDraft(playbookId, threadId);
  if (!save) {
    if ($('#thread-reply')) $('#thread-reply').value = text;
    return text;
  }
  const replyRow = { id: uid('msg'), threadId, role: 'assistant', text, at: nowIso(), playbookId: playbook.id, playbookLabel: playbook.label };
  state.messages.push(replyRow);
  thread.messageCount = state.messages.filter(item => item.threadId === threadId).length;
  thread.updatedAt = nowIso();
  remoteUpsert('messages', replyRow);
  remoteUpsert('threads', thread);
  state.auditLog.unshift({ id: uid('audit'), kind: 'thread-playbook-reply', message: `${playbook.label} reply saved to ${thread.subject}`, at: nowIso() });
  persist();
  return text;
}

function buildSlaBrief() {
  return {
    exportedAt: nowIso(),
    pressureCounts: getSlaPressureCounts(),
    blockedTaskCounts: getTaskBlockedCounts(),
    slaQueue: getSlaPressureQueue().map(item => ({
      clientName: item.client.name,
      company: item.client.company || '',
      assignedAeName: item.client.assignedAeName || '',
      sla: item.sla.label,
      score: item.sla.score,
      reasons: item.sla.reasons
    })),
    blockedTasks: getBlockedTasks().map(task => ({
      title: task.title,
      clientName: task.clientName || '',
      assignedAeName: task.assignedAeName || '',
      blockerNote: task.blockerNote || '',
      updatedAt: task.updatedAt || task.createdAt || ''
    })),
    staleThreads: getStaleThreads().map(item => ({
      subject: item.thread.subject,
      clientName: item.thread.clientName || '',
      aeName: item.thread.aeName || '',
      freshness: item.freshness.label
    }))
  };
}

function exportSlaBrief(format = 'json') {
  const brief = buildSlaBrief();
  if (format === 'json') return download('ae-sla-brief.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — SLA Brief',
    '',
    `- Exported at: ${brief.exportedAt}`,
    '',
    '## SLA queue',
    '',
    ...(brief.slaQueue.length ? brief.slaQueue.map(item => `- ${item.clientName}: ${item.sla} · score ${item.score} · ${item.reasons.join(' | ')}`) : ['- No SLA pressure clients surfaced.']),
    '',
    '## Blocked tasks',
    '',
    ...(brief.blockedTasks.length ? brief.blockedTasks.map(item => `- ${item.title}: ${item.clientName || 'No client'} · ${item.assignedAeName || 'No AE'} · ${item.blockerNote || 'No blocker note'}`) : ['- No blocked tasks surfaced.']),
    '',
    '## Stale threads',
    '',
    ...(brief.staleThreads.length ? brief.staleThreads.map(item => `- ${item.subject}: ${item.clientName || 'No client'} · ${item.aeName || 'No AE'} · ${item.freshness}`) : ['- No stale threads surfaced.'])
  ].join('
');
  return download('ae-sla-brief.md', md, 'text/markdown');
}

function buildAePerformanceRows() {
  return state.aeProfiles.map(ae => {
    const assignedClients = state.clients.filter(client => client.assignedAeId === ae.id);
    const openTasks = state.tasks.filter(task => task.assignedAeId === ae.id && String(task.status || 'todo') !== 'done');
    const blockedTasks = openTasks.filter(task => ['blocked', 'waiting'].includes(String(task.status || 'todo')));
    const staleThreads = state.threads.filter(thread => thread.aeId === ae.id && getThreadFreshness(thread).status === 'stale');
    const awaitingThreads = state.threads.filter(thread => thread.aeId === ae.id && getThreadResponseLag(thread).awaiting);
    const criticalClients = assignedClients.filter(client => getClientHealth(client).status === 'critical' || getClientSlaPressure(client).status === 'critical');
    const score = assignedClients.length + blockedTasks.length * 2 + staleThreads.length * 2 + awaitingThreads.length + criticalClients.length * 3;
    const status = score >= 10 ? 'critical' : score >= 5 ? 'watch' : 'healthy';
    return { aeId: ae.id, aeName: ae.name, title: ae.title, assignedClients: assignedClients.length, openTasks: openTasks.length, blockedTasks: blockedTasks.length, staleThreads: staleThreads.length, awaitingThreads: awaitingThreads.length, criticalClients: criticalClients.length, status, score };
  }).sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || String(a.aeName || '').localeCompare(String(b.aeName || '')));
}

function buildAePerformanceBrief() {
  return { exportedAt: nowIso(), rows: buildAePerformanceRows() };
}

function exportAePerformanceBrief(format = 'json') {
  const brief = buildAePerformanceBrief();
  if (format === 'json') return download('ae-performance-brief.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — AE Performance Brief',
    '',
    `- Exported at: ${brief.exportedAt}`,
    '',
    '## AE scoreboard',
    '',
    ...(brief.rows.length ? brief.rows.map(row => `- ${row.aeName}: ${row.status} · score ${row.score} · clients ${row.assignedClients} · open tasks ${row.openTasks} · blocked/waiting ${row.blockedTasks} · stale threads ${row.staleThreads} · awaiting replies ${row.awaitingThreads} · critical clients ${row.criticalClients}`) : ['- No AE performance rows surfaced.'])
  ].join('\n');
  return download('ae-performance-brief.md', md, 'text/markdown');
}

function buildClientHandoffBrief(clientId) {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const health = getClientHealth(client);
  const sla = getClientSlaPressure(client);
  const tasks = getClientRelatedTasks(client.id).slice(0, 8).map(task => ({ title: task.title, status: task.status || 'todo', dueDate: task.dueDate || '', dependency: getTaskDependency(task).label }));
  const threads = getClientRelatedThreads(client.id).slice(0, 8).map(thread => ({ subject: thread.subject, state: thread.state || 'open', freshness: getThreadFreshness(thread).label, awaitingReply: getThreadResponseLag(thread).awaiting }));
  const recommendations = getClientRecommendedActions(client).map(action => ({ id: action.id, label: action.label, detail: action.detail }));
  const timeline = buildClientActivityTimeline(client).slice(0, 12);
  return { exportedAt: nowIso(), client, health, sla, tasks, threads, recommendations, timeline };
}

function exportClientHandoffBrief(clientId, format = 'json') {
  const brief = buildClientHandoffBrief(clientId);
  if (!brief) return;
  if (format === 'json') return download('ae-client-handoff.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    `# Client handoff — ${brief.client.name}`,
    '',
    `- Company: ${brief.client.company || 'No company'}`,
    `- Assigned AE: ${brief.client.assignedAeName || 'Unassigned'}`,
    `- Stage: ${brief.client.stage || 'intake'}`,
    `- Priority: ${brief.client.priority || 'normal'}`,
    `- Follow-up date: ${brief.client.followUpDate || 'None'}`,
    `- Next step: ${brief.client.nextStep || 'None'}`,
    `- Health: ${brief.health.label} · score ${brief.health.score}`,
    `- SLA: ${brief.sla.label} · score ${brief.sla.score}`,
    '',
    '## Notes',
    '',
    brief.client.notes || 'No notes.',
    '',
    '## Linked tasks',
    '',
    ...(brief.tasks.length ? brief.tasks.map(task => `- ${task.title} · ${task.status} · ${task.dueDate || 'no due date'} · ${task.dependency}`) : ['- No linked tasks.']),
    '',
    '## Linked threads',
    '',
    ...(brief.threads.length ? brief.threads.map(thread => `- ${thread.subject} · ${thread.state} · ${thread.freshness}${thread.awaitingReply ? ' · awaiting reply' : ''}`) : ['- No linked threads.']),
    '',
    '## Recommendations',
    '',
    ...(brief.recommendations.length ? brief.recommendations.map(action => `- ${action.label} · ${action.detail}`) : ['- No surfaced recommendations.']),
    '',
    '## Activity timeline',
    '',
    ...(brief.timeline.length ? brief.timeline.map(row => `- ${row.at} · ${row.kind} · ${row.title} · ${row.detail}`) : ['- No timeline rows.'])
  ].join('\n');
  return download('ae-client-handoff.md', md, 'text/markdown');
}

function addClientHandoffNote(clientId) {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return;
  const note = globalThis.prompt('Add a handoff note for this client.');
  if (!note || !note.trim()) return;
  logClientActivity(client, 'handoff-note', 'Client handoff note added', note.trim());
  client.updatedAt = nowIso();
  remoteUpsert('clients', client);
  state.auditLog.unshift({ id: uid('audit'), kind: 'client-handoff-note', message: `Handoff note added for ${client.name}`, at: nowIso() });
  persist();
}

function buildRecommendedNextStep(client) {
  const due = getClientDueState(client);
  const health = getClientHealth(client);
  if ((client.stage || 'intake') === 'blocked') return 'Clear blocker, confirm owner, and lock the unblock action today.';
  if (due.status === 'overdue') return `Follow up immediately and confirm the owner for the overdue checkpoint (${client.followUpDate || 'no date'}).`;
  if (health.status === 'critical') return 'Run a stabilization review, confirm client risk factors, and set the next dated checkpoint.';
  if ((client.stage || 'intake') === 'intake') return 'Confirm scope, gather missing intake details, and assign the best-fit AE.';
  if ((client.stage || 'intake') === 'active') return 'Confirm delivery progress, next milestone, and any growth or retention blockers.';
  return 'Review current state, confirm next move, and put a dated action into motion.';
}

function getClientRecommendedActions(client) {
  if (!client) return [];
  const actions = [];
  const due = getClientDueState(client);
  const health = getClientHealth(client);
  const openThreads = getClientRelatedThreads(client.id).filter(thread => (thread.state || 'open') !== 'resolved');
  const openTasks = getClientRelatedTasks(client.id).filter(task => String(task.status || 'todo') !== 'done');
  if (!client.assignedAeId) {
    actions.push({ id: 'auto-assign', label: 'Auto-assign best-fit AE', detail: 'No AE currently owns this account.' });
  }
  if (!String(client.nextStep || '').trim()) {
    actions.push({ id: 'apply-next-step', label: 'Apply recommended next step', detail: buildRecommendedNextStep(client) });
  }
  if (due.status === 'overdue' || due.status === 'today') {
    actions.push({ id: 'followup-task', label: 'Create dated follow-up task', detail: `Follow-up is ${due.status}.` });
  }
  if (health.status === 'critical') {
    actions.push({ id: 'stabilize-plan', label: 'Launch 7-day stabilize plan', detail: 'Critical health score detected.' });
  }
  if ((client.stage || 'intake') === 'active' && String(client.needs || '').toLowerCase().includes('growth')) {
    actions.push({ id: 'growth-plan', label: 'Launch 14-day growth plan', detail: 'Client is active and tagged for growth.' });
  }
  if ((client.stage || 'intake') !== 'closed' && ['premium','enterprise'].includes(getClientValueTier(client)) && String(client.appointmentSetterStatus || '').toLowerCase() !== 'booked') {
    actions.push({ id: 'appointment-handoff', label: 'Send to appointment setter', detail: 'Value tier or active pipeline justifies booking-lane handling.' });
  }
  if (String(client.appointmentSetterStatus || '').toLowerCase() === 'booked') {
    actions.push({ id: 'appointment-return', label: 'Return appointment outcome to AE', detail: 'Booked appointment should flow back into AE follow-through.' });
  }
  if (openThreads.length >= 1 && !openTasks.some(task => String(task.title || '').startsWith('Response task —'))) {
    actions.push({ id: 'response-task', label: 'Create response task from latest open thread', detail: `${openThreads.length} open thread${openThreads.length === 1 ? '' : 's'} need operator response.` });
  }
  return actions.slice(0, 6);
}


function getClientEstimatedValue(client) {
  return Math.max(0, Number(client?.estimatedValue || 0));
}

function getClientMonthlyValue(client) {
  return Math.max(0, Number(client?.monthlyValue || 0));
}

function getClientCloseProbability(client) {
  const value = Number(client?.closeProbability || 0);
  return Math.max(0, Math.min(100, value));
}

function getClientWeightedValue(client) {
  return Math.round(getClientEstimatedValue(client) * (getClientCloseProbability(client) / 100));
}

function getClientValueTier(client) {
  const estimated = getClientEstimatedValue(client);
  const monthly = getClientMonthlyValue(client);
  if (estimated >= 25000 || monthly >= 5000) return 'enterprise';
  if (estimated >= 10000 || monthly >= 2500) return 'premium';
  if (estimated > 0 || monthly > 0) return 'standard';
  return 'unscored';
}

function formatCurrency(value = 0) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function getRevenueSnapshot() {
  const openClients = state.clients.filter(client => String(client.stage || 'intake') !== 'closed');
  const totalPipeline = openClients.reduce((sum, client) => sum + getClientEstimatedValue(client), 0);
  const weightedPipeline = openClients.reduce((sum, client) => sum + getClientWeightedValue(client), 0);
  const monthlyManaged = state.clients.reduce((sum, client) => sum + getClientMonthlyValue(client), 0);
  const scoredClients = openClients.filter(client => getClientEstimatedValue(client) > 0 || getClientMonthlyValue(client) > 0).length;
  return {
    totalPipeline,
    weightedPipeline,
    monthlyManaged,
    scoredClients,
    byTier: {
      enterprise: state.clients.filter(client => getClientValueTier(client) === 'enterprise').length,
      premium: state.clients.filter(client => getClientValueTier(client) === 'premium').length,
      standard: state.clients.filter(client => getClientValueTier(client) === 'standard').length,
      unscored: state.clients.filter(client => getClientValueTier(client) === 'unscored').length
    }
  };
}

function getPipelineQueue(limit = 10) {
  const today = getTodayIsoDate();
  return [...state.clients]
    .filter(client => String(client.stage || 'intake') !== 'closed' && (getClientEstimatedValue(client) > 0 || getClientMonthlyValue(client) > 0 || String(client.targetCloseDate || '').trim()))
    .map(client => ({
      client,
      weightedValue: getClientWeightedValue(client),
      valueTier: getClientValueTier(client),
      overdueClose: !!(client.targetCloseDate && client.targetCloseDate < today && String(client.stage || 'intake') !== 'closed')
    }))
    .sort((a, b) => Number(b.weightedValue || 0) - Number(a.weightedValue || 0))
    .slice(0, limit);
}

function getAeAvailabilityState(ae) {
  const stateKey = String(ae?.availabilityState || 'available').toLowerCase();
  const until = String(ae?.unavailableUntil || '').trim();
  if (ae?.enabled === false) return { status: 'disabled', label: 'Disabled', severity: 'bad', detail: 'Routing disabled' };
  if (stateKey === 'out') return { status: 'out', label: until ? `Out until ${until}` : 'Out', severity: 'bad', detail: ae?.coverageNote || 'Unavailable for routing' };
  if (until && until >= getTodayIsoDate()) return { status: 'scheduled-out', label: `Unavailable until ${until}`, severity: 'warn', detail: ae?.coverageNote || 'Temporary coverage gap' };
  if (stateKey === 'focus') return { status: 'focus', label: 'Focus lane', severity: 'warn', detail: ae?.coverageNote || 'Deprioritize new routing' };
  if (stateKey === 'backup' || ae?.backupOnly === true) return { status: 'backup', label: 'Backup only', severity: 'warn', detail: ae?.coverageNote || 'Reserve for overflow or urgent work' };
  return { status: 'available', label: 'Available', severity: 'ok', detail: ae?.coverageNote || 'Normal routing' };
}

function getAeCoverageAlerts(limit = 12) {
  return state.aeProfiles
    .map(ae => ({ ae, availability: getAeAvailabilityState(ae), affectedClients: state.clients.filter(client => client.assignedAeId === ae.id) }))
    .filter(row => row.availability.status !== 'available')
    .sort((a, b) => b.affectedClients.length - a.affectedClients.length)
    .slice(0, limit);
}

function getSevenDayCommandPlan(limit = 18) {
  const today = getTodayIsoDate();
  const max = isoDatePlusDays(today, 7);
  const items = [];
  state.clients.forEach(client => {
    if (client.followUpDate && client.followUpDate >= today && client.followUpDate <= max) {
      items.push({ id: client.id, date: client.followUpDate, kind: 'follow-up', label: `Follow-up — ${client.name}`, meta: `${client.assignedAeName || 'Unassigned'} · ${client.nextStep || 'No next step'}`, openPage: 'clients' });
    }
    if (client.milestoneDueDate && client.milestoneDueDate >= today && client.milestoneDueDate <= max) {
      items.push({ id: client.id, date: client.milestoneDueDate, kind: 'milestone', label: `${client.currentMilestone || 'Milestone'} — ${client.name}`, meta: `${client.assignedAeName || 'Unassigned'} · progress ${Number(client.milestoneProgress || 0)}%`, openPage: 'clients' });
    }
  });
  state.tasks.forEach(task => {
    if (task.dueDate && task.dueDate >= today && task.dueDate <= max && String(task.status || 'todo') !== 'done') {
      items.push({ id: task.id, date: task.dueDate, kind: 'task', label: task.title, meta: `${task.assignedAeName || 'No AE'} · ${task.clientName || 'No client'}`, openPage: 'tasks' });
    }
  });
  return items.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.kind).localeCompare(String(b.kind))).slice(0, limit);
}

function buildRevenueBrief() {
  const snapshot = getRevenueSnapshot();
  return {
    exportedAt: nowIso(),
    summary: snapshot,
    pipelineQueue: getPipelineQueue(12).map(item => ({
      clientId: item.client.id,
      clientName: item.client.name,
      aeName: item.client.assignedAeName || '',
      stage: item.client.stage || 'intake',
      valueTier: item.valueTier,
      estimatedValue: getClientEstimatedValue(item.client),
      weightedValue: item.weightedValue,
      monthlyValue: getClientMonthlyValue(item.client),
      closeProbability: getClientCloseProbability(item.client),
      targetCloseDate: item.client.targetCloseDate || '',
      overdueClose: item.overdueClose
    }))
  };
}

function exportRevenueBrief(format = 'json') {
  const brief = buildRevenueBrief();
  if (format === 'json') return download('ae-revenue-brief.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — Revenue Brief',
    '',
    `- Exported at: ${brief.exportedAt}`,
    `- Total pipeline: ${formatCurrency(brief.summary.totalPipeline)}`,
    `- Weighted pipeline: ${formatCurrency(brief.summary.weightedPipeline)}`,
    `- Monthly managed: ${formatCurrency(brief.summary.monthlyManaged)}`,
    `- Scored clients: ${brief.summary.scoredClients}`,
    '',
    '## Value tiers',
    '',
    ...Object.entries(brief.summary.byTier || {}).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Pipeline queue',
    '',
    ...(brief.pipelineQueue.length ? brief.pipelineQueue.map(item => `- ${item.clientName}: ${formatCurrency(item.estimatedValue)} · weighted ${formatCurrency(item.weightedValue)} · ${item.aeName || 'Unassigned'} · ${item.stage} · target ${item.targetCloseDate || 'not set'}${item.overdueClose ? ' · OVERDUE' : ''}`) : ['- No revenue-scored clients yet.'])
  ].join('
');
  return download('ae-revenue-brief.md', md, 'text/markdown');
}

function buildCommandPlannerBrief() {
  return {
    exportedAt: nowIso(),
    coverageAlerts: getAeCoverageAlerts(12).map(item => ({
      aeId: item.ae.id,
      aeName: item.ae.name,
      status: item.availability.label,
      detail: item.availability.detail,
      affectedClients: item.affectedClients.length
    })),
    plan: getSevenDayCommandPlan(24)
  };
}

function exportCommandPlannerBrief(format = 'json') {
  const brief = buildCommandPlannerBrief();
  if (format === 'json') return download('ae-command-planner-brief.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — 7-Day Command Planner',
    '',
    `- Exported at: ${brief.exportedAt}`,
    '',
    '## Coverage alerts',
    '',
    ...(brief.coverageAlerts.length ? brief.coverageAlerts.map(item => `- ${item.aeName}: ${item.status} · ${item.detail} · affected clients ${item.affectedClients}`) : ['- No AE coverage alerts right now.']),
    '',
    '## Next 7 days',
    '',
    ...(brief.plan.length ? brief.plan.map(item => `- ${item.date}: ${item.kind} · ${item.label} · ${item.meta}`) : ['- No dated work is scheduled in the next 7 days.'])
  ].join('
');
  return download('ae-command-planner-brief.md', md, 'text/markdown');
}


function getClientStageIndex(stage) {
  const key = String(stage || 'intake').toLowerCase();
  const idx = CLIENT_STAGE_ORDER.indexOf(key);
  return idx >= 0 ? idx : 0;
}

function setClientStage(clientId, stage, reason = 'stage-set') {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const nextStage = CLIENT_STAGE_ORDER.includes(String(stage || '').toLowerCase()) ? String(stage).toLowerCase() : 'intake';
  const previousStage = String(client.stage || 'intake');
  if (previousStage === nextStage) return client;
  client.stage = nextStage;
  client.updatedAt = nowIso();
  client.tags = buildClientTags(client);
  logClientActivity(client, 'stage-move', 'Client stage moved', `${previousStage} -> ${nextStage} · ${reason}`);
  state.auditLog.unshift({ id: uid('audit'), kind: 'client-stage-move', message: `${client.name} moved from ${previousStage} to ${nextStage} (${reason})`, at: nowIso() });
  remoteUpsert('clients', client);
  persist();
  return client;
}

function shiftClientStage(clientId, direction = 1, reason = 'pipeline-move') {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const currentIndex = getClientStageIndex(client.stage);
  const nextIndex = Math.max(0, Math.min(CLIENT_STAGE_ORDER.length - 1, currentIndex + Number(direction || 0)));
  if (nextIndex === currentIndex) return client;
  return setClientStage(clientId, CLIENT_STAGE_ORDER[nextIndex], reason);
}

function getPipelineBoardData(limitPerStage = 5) {
  return CLIENT_STAGE_ORDER.map(stage => {
    const clients = state.clients
      .filter(client => String(client.stage || 'intake') === stage)
      .sort((a, b) => Number(getClientWeightedValue(b) || 0) - Number(getClientWeightedValue(a) || 0) || String(a.name || '').localeCompare(String(b.name || '')));
    return {
      stage,
      label: CLIENT_STAGE_LABELS[stage] || stage,
      count: clients.length,
      totalEstimated: clients.reduce((sum, client) => sum + getClientEstimatedValue(client), 0),
      totalWeighted: clients.reduce((sum, client) => sum + getClientWeightedValue(client), 0),
      clients: clients.slice(0, limitPerStage)
    };
  });
}

function buildPipelineBoardBrief() {
  return {
    exportedAt: nowIso(),
    stages: getPipelineBoardData(12).map(column => ({
      stage: column.stage,
      label: column.label,
      count: column.count,
      totalEstimated: column.totalEstimated,
      totalWeighted: column.totalWeighted,
      clients: column.clients.map(client => ({
        clientId: client.id,
        clientName: client.name,
        company: client.company || '',
        assignedAeName: client.assignedAeName || '',
        valueTier: getClientValueTier(client),
        estimatedValue: getClientEstimatedValue(client),
        weightedValue: getClientWeightedValue(client),
        monthlyValue: getClientMonthlyValue(client),
        followUpDate: client.followUpDate || '',
        targetCloseDate: client.targetCloseDate || '',
        nextStep: client.nextStep || ''
      }))
    }))
  };
}

function exportPipelineBoardBrief(format = 'json') {
  const brief = buildPipelineBoardBrief();
  if (format === 'json') return download('ae-pipeline-board-brief.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — Pipeline Board Brief',
    '',
    `- Exported at: ${brief.exportedAt}`,
    ''
  ];
  brief.stages.forEach(column => {
    md.push(`## ${column.label}`);
    md.push('');
    md.push(`- Count: ${column.count}`);
    md.push(`- Estimated: ${formatCurrency(column.totalEstimated)}`);
    md.push(`- Weighted: ${formatCurrency(column.totalWeighted)}`);
    md.push('');
    md.push(...(column.clients.length ? column.clients.map(client => `- ${client.clientName}: ${client.assignedAeName || 'Unassigned'} · ${client.valueTier} · est ${formatCurrency(client.estimatedValue)} · weighted ${formatCurrency(client.weightedValue)}${client.followUpDate ? ` · follow-up ${client.followUpDate}` : ''}${client.targetCloseDate ? ` · close ${client.targetCloseDate}` : ''}`) : ['- No clients in this stage.']));
    md.push('');
  });
  return download('ae-pipeline-board-brief.md', md.join('
'), 'text/markdown');
}

function buildAeOwnershipRows() {
  return state.aeProfiles.map(ae => {
    const clients = state.clients.filter(client => client.assignedAeId === ae.id);
    const openTasks = state.tasks.filter(task => task.assignedAeId === ae.id && String(task.status || 'todo') !== 'done');
    const awaiting = getAwaitingResponseThreads().filter(item => item.thread.aeId === ae.id);
    const overdueFollowups = clients.filter(client => getClientDueState(client).status === 'overdue').length;
    const weightedPipeline = clients.reduce((sum, client) => sum + getClientWeightedValue(client), 0);
    const monthlyManaged = clients.reduce((sum, client) => sum + getClientMonthlyValue(client), 0);
    return {
      aeId: ae.id,
      aeName: ae.name,
      title: ae.title,
      availability: getAeAvailabilityState(ae).label,
      assignedClients: clients.length,
      weightedPipeline,
      monthlyManaged,
      overdueFollowups,
      openTasks: openTasks.length,
      awaitingReplies: awaiting.length
    };
  }).sort((a, b) => Number(b.weightedPipeline || 0) - Number(a.weightedPipeline || 0) || Number(b.assignedClients || 0) - Number(a.assignedClients || 0));
}

function buildAeOwnershipBrief() {
  return {
    exportedAt: nowIso(),
    rows: buildAeOwnershipRows()
  };
}

function exportAeOwnershipBrief(format = 'json') {
  const brief = buildAeOwnershipBrief();
  if (format === 'json') return download('ae-ownership-brief.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — AE Ownership Brief',
    '',
    `- Exported at: ${brief.exportedAt}`,
    '',
    '## AE ownership rows',
    '',
    ...(brief.rows.length ? brief.rows.map(row => `- ${row.aeName}: ${row.availability} · clients ${row.assignedClients} · weighted ${formatCurrency(row.weightedPipeline)} · monthly ${formatCurrency(row.monthlyManaged)} · overdue follow-ups ${row.overdueFollowups} · open tasks ${row.openTasks} · awaiting replies ${row.awaitingReplies}`) : ['- No AE ownership rows surfaced.'])
  ].join('
');
  return download('ae-ownership-brief.md', md, 'text/markdown');
}

function buildRebalancePlanner(limit = 18) {
  const flaggedAeIds = new Set([
    ...getAeCoverageAlerts(50).map(item => item.ae.id),
    ...getAeWorkloadAlerts(50).map(item => item.ae.id)
  ]);
  const rows = [];
  state.clients.filter(client => client.assignedAeId && flaggedAeIds.has(client.assignedAeId)).forEach(client => {
    const currentAe = state.aeProfiles.find(ae => ae.id === client.assignedAeId);
    const ranked = rankAeCandidates(state, client, state.aeProfiles.length);
    const currentRank = ranked.find(item => item.id === client.assignedAeId);
    const alternative = ranked.find(item => item.id !== client.assignedAeId && item.enabled !== false && getAeAvailabilityState(item).status === 'available');
    if (!currentAe || !alternative) return;
    rows.push({
      client,
      currentAe,
      currentScore: Number(currentRank?.score || 0),
      targetAe: alternative,
      targetScore: Number(alternative.score || 0),
      improvement: Number(alternative.score || 0) - Number(currentRank?.score || 0),
      reason: `${getAeAvailabilityState(currentAe).label} · ${currentAe.assignments || 0} assignments`
    });
  });
  return rows
    .sort((a, b) => Number(b.improvement || 0) - Number(a.improvement || 0) || Number(getClientWeightedValue(b.client) || 0) - Number(getClientWeightedValue(a.client) || 0))
    .slice(0, limit);
}

function applyRebalanceRecommendation(clientId, aeId, reason = 'rebalancer') {
  const client = state.clients.find(item => item.id === clientId);
  const ae = state.aeProfiles.find(item => item.id === aeId);
  if (!client || !ae) return false;
  if (client.assignedAeId === aeId) return false;
  assignClient(state, client.id, ae.id, reason);
  remoteUpsert('clients', client);
  if (client.assignmentHistory?.[0]) remoteUpsert('assignments', client.assignmentHistory[0]);
  persist();
  return true;
}

function applyRebalancePlan(limit = 10) {
  const rows = buildRebalancePlanner(limit);
  let moved = 0;
  rows.forEach(row => {
    if (applyRebalanceRecommendation(row.client.id, row.targetAe.id, 'planner-bulk')) moved += 1;
  });
  if (moved) state.auditLog.unshift({ id: uid('audit'), kind: 'planner-bulk-rebalance', message: `Applied ${moved} rebalance move(s)`, at: nowIso() });
  if (moved) persist();
  return moved;
}

function buildRebalancePlanBrief() {
  return {
    exportedAt: nowIso(),
    rows: buildRebalancePlanner(24).map(row => ({
      clientId: row.client.id,
      clientName: row.client.name,
      currentAe: row.currentAe.name,
      targetAe: row.targetAe.name,
      currentScore: row.currentScore,
      targetScore: row.targetScore,
      improvement: row.improvement,
      weightedValue: getClientWeightedValue(row.client),
      reason: row.reason
    }))
  };
}

function exportRebalancePlanBrief(format = 'json') {
  const brief = buildRebalancePlanBrief();
  if (format === 'json') return download('ae-rebalance-plan-brief.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — Rebalance Plan Brief',
    '',
    `- Exported at: ${brief.exportedAt}`,
    '',
    '## Suggested moves',
    '',
    ...(brief.rows.length ? brief.rows.map(row => `- ${row.clientName}: ${row.currentAe} -> ${row.targetAe} · improvement ${row.improvement} · weighted ${formatCurrency(row.weightedValue)} · ${row.reason}`) : ['- No rebalance moves are currently surfaced.'])
  ].join('
');
  return download('ae-rebalance-plan-brief.md', md, 'text/markdown');
}

function getFourteenDayCommandCalendar(limit = 60) {
  const today = getTodayIsoDate();
  const max = isoDatePlusDays(today, 14);
  const items = [];
  state.clients.forEach(client => {
    if (client.followUpDate && client.followUpDate >= today && client.followUpDate <= max) items.push({ id: client.id, date: client.followUpDate, kind: 'follow-up', label: `Follow-up — ${client.name}`, meta: `${client.assignedAeName || 'Unassigned'} · ${client.nextStep || 'No next step'}`, actionKind: 'client' });
    if (client.milestoneDueDate && client.milestoneDueDate >= today && client.milestoneDueDate <= max) items.push({ id: client.id, date: client.milestoneDueDate, kind: 'milestone', label: `${client.currentMilestone || 'Milestone'} — ${client.name}`, meta: `${client.assignedAeName || 'Unassigned'} · progress ${Number(client.milestoneProgress || 0)}%`, actionKind: 'client' });
    if (client.targetCloseDate && client.targetCloseDate >= today && client.targetCloseDate <= max && String(client.stage || 'intake') !== 'closed') items.push({ id: client.id, date: client.targetCloseDate, kind: 'close-target', label: `Close target — ${client.name}`, meta: `${client.assignedAeName || 'Unassigned'} · weighted ${formatCurrency(getClientWeightedValue(client))}`, actionKind: 'client' });
  });
  state.tasks.forEach(task => {
    if (task.dueDate && task.dueDate >= today && task.dueDate <= max && String(task.status || 'todo') !== 'done') items.push({ id: task.id, date: task.dueDate, kind: 'task', label: task.title, meta: `${task.assignedAeName || 'No AE'} · ${task.clientName || 'No client'}`, actionKind: 'task' });
  });
  state.aeProfiles.forEach(ae => {
    const availability = getAeAvailabilityState(ae);
    if (ae.unavailableUntil && ae.unavailableUntil >= today && ae.unavailableUntil <= max && availability.status !== 'available') items.push({ id: ae.id, date: ae.unavailableUntil, kind: 'ae-coverage', label: `${ae.name} availability checkpoint`, meta: availability.label, actionKind: 'ae' });
  });
  return items.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.kind).localeCompare(String(b.kind))).slice(0, limit);
}

function buildCommandCalendarBrief() {
  return {
    exportedAt: nowIso(),
    items: getFourteenDayCommandCalendar(80)
  };
}

function exportCommandCalendarBrief(format = 'json') {
  const brief = buildCommandCalendarBrief();
  if (format === 'json') return download('ae-command-calendar-brief.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — 14-Day Command Calendar',
    '',
    `- Exported at: ${brief.exportedAt}`,
    '',
    '## Calendar items',
    '',
    ...(brief.items.length ? brief.items.map(item => `- ${item.date}: ${item.kind} · ${item.label} · ${item.meta}`) : ['- No dated command items in the next 14 days.'])
  ].join('
');
  return download('ae-command-calendar-brief.md', md, 'text/markdown');
}

function renderPipelineBoardCard() {
  const columns = getPipelineBoardData(4);
  return `<div class="card"><div class="eyebrow">Pipeline board</div><h3>Stage-weighted client board with quick move controls</h3><div class="toolbar"><button class="btn-soft" id="export-pipeline-brief-json">Export JSON</button><button class="btn-soft" id="export-pipeline-brief-md">Export Markdown</button></div><div class="list">${columns.map(column => `<div class="item"><div class="split"><div><h4>${escapeHtml(column.label)}</h4><div class="meta">${column.count} client(s) · est ${formatCurrency(column.totalEstimated)} · weighted ${formatCurrency(column.totalWeighted)}</div></div><div class="tag-row"><span class="tag">${column.stage}</span></div></div><div class="list">${column.clients.length ? column.clients.map(client => `<div class="item compact-item"><div><strong>${escapeHtml(client.name)}</strong><div class="meta">${escapeHtml(client.assignedAeName || 'Unassigned')} · ${escapeHtml(getClientValueTier(client))} · weighted ${formatCurrency(getClientWeightedValue(client))}</div></div><div class="toolbar"><button class="btn-soft" data-act="pipeline-open-client" data-id="${client.id}">Open</button><button class="btn-soft" data-act="pipeline-stage-back" data-id="${client.id}">◀</button><button class="btn-soft" data-act="pipeline-stage-forward" data-id="${client.id}">▶</button></div></div>`).join('') : '<div class="item"><div class="meta">No clients in this stage.</div></div>'}</div></div>`).join('')}</div></div>`;
}

function renderRebalancePlannerCard() {
  const plan = buildRebalancePlanner(8);
  return `<div class="card"><div class="eyebrow">Rebalance planner</div><h3>Suggested coverage moves from overloaded or unavailable AEs</h3><div class="toolbar"><button class="btn-soft" id="export-rebalance-brief-json">Export JSON</button><button class="btn-soft" id="export-rebalance-brief-md">Export Markdown</button><button class="btn-soft" data-act="rebalance-apply-all">Apply surfaced moves</button></div><div class="list">${plan.length ? plan.map(row => `<div class="item"><h4>${escapeHtml(row.client.name)}</h4><div class="meta">${escapeHtml(row.currentAe.name)} -> ${escapeHtml(row.targetAe.name)} · improvement ${row.improvement} · weighted ${formatCurrency(getClientWeightedValue(row.client))}</div><p>${escapeHtml(row.reason)}</p><div class="toolbar"><button class="btn-soft" data-act="rebalance-open-client" data-id="${row.client.id}">Open</button><button class="btn-soft" data-act="rebalance-apply-one" data-id="${row.client.id}" data-ae-id="${row.targetAe.id}">Apply move</button></div></div>`).join('') : '<div class="item"><div class="meta">No rebalance moves are currently surfaced.</div></div>'}</div></div>`;
}

function renderCommandCalendarCard() {
  const items = getFourteenDayCommandCalendar(24);
  return `<div class="card"><div class="eyebrow">14-day command calendar</div><h3>Dated follow-ups, milestones, tasks, close targets, and AE coverage checkpoints</h3><div class="toolbar"><button class="btn-soft" id="export-command-calendar-json">Export JSON</button><button class="btn-soft" id="export-command-calendar-md">Export Markdown</button></div><div class="list">${items.length ? items.map(item => `<div class="item"><h4>${escapeHtml(item.label)}</h4><div class="meta">${escapeHtml(item.date)} · ${escapeHtml(item.kind)} · ${escapeHtml(item.meta)}</div><div class="toolbar"><button class="btn-soft" data-act="calendar-open-${item.actionKind}" data-id="${item.id}">Open</button></div></div>`).join('') : '<div class="item"><div class="meta">No calendar items in the next 14 days.</div></div>'}</div></div>`;
}

function renderAeOwnershipCard() {
  const rows = buildAeOwnershipRows();
  return `<div class="card"><div class="eyebrow">AE ownership board</div><h3>Revenue ownership, overdue follow-ups, and reply burden by AE</h3><div class="toolbar"><button class="btn-soft" id="export-ownership-brief-json">Export JSON</button><button class="btn-soft" id="export-ownership-brief-md">Export Markdown</button></div><div class="table-wrap"><table><thead><tr><th>AE</th><th>Availability</th><th>Clients</th><th>Weighted pipeline</th><th>Monthly</th><th>Overdue follow-ups</th><th>Open tasks</th><th>Awaiting replies</th><th>Actions</th></tr></thead><tbody>${rows.length ? rows.map(row => `<tr><td>${escapeHtml(row.aeName)}<div class="meta">${escapeHtml(row.title)}</div></td><td><span class="tag">${escapeHtml(row.availability)}</span></td><td>${row.assignedClients}</td><td>${formatCurrency(row.weightedPipeline)}</td><td>${formatCurrency(row.monthlyManaged)}</td><td>${row.overdueFollowups}</td><td>${row.openTasks}</td><td>${row.awaitingReplies}</td><td><button class="btn-soft" data-act="ownership-open-clients" data-id="${row.aeId}">Open clients</button></td></tr>`).join('') : '<tr><td colspan="9">No AE ownership rows surfaced.</td></tr>'}</tbody></table></div></div>`;
}

function applyClientRecommendation(clientId, actionId) {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return;
  if (actionId === 'auto-assign') {
    const match = autoAssignClient(state, client);
    if (match) {
      assignClient(state, client.id, match.id, 'recommended-auto');
      remoteUpsert('clients', client);
      if (client.assignmentHistory?.[0]) remoteUpsert('assignments', client.assignmentHistory[0]);
    }
  }
  if (actionId === 'apply-next-step') {
    client.nextStep = buildRecommendedNextStep(client);
    client.updatedAt = nowIso();
    logClientActivity(client, 'next-step', 'Recommended next step applied', client.nextStep);
    remoteUpsert('clients', client);
  }
  if (actionId === 'followup-task') createFollowupTaskFromClient(client, 'recommended-followup');
  if (actionId === 'stabilize-plan') createClientActionPlan(client.id, 'stabilize-7');
  if (actionId === 'growth-plan') createClientActionPlan(client.id, 'growth-14');
  if (actionId === 'appointment-handoff') sendClientToAppointmentSetter(client.id, 'recommended-action');
  if (actionId === 'appointment-return') {
    const latestAppointment = getAppointmentRecords().find(item => item.clientId === client.id);
    if (latestAppointment) returnAppointmentClientToAe(latestAppointment.id, 'Recommended return from appointment brain');
  }
  if (actionId === 'response-task') {
    const latestOpenThread = getClientRelatedThreads(client.id).filter(thread => (thread.state || 'open') !== 'resolved')[0];
    if (latestOpenThread) createThreadResponseTask(latestOpenThread.id, 'recommended-response');
  }
  state.auditLog.unshift({ id: uid('audit'), kind: 'client-recommendation', message: `Applied recommendation ${actionId} for ${client.name}`, at: nowIso() });
  persist();
}

function getFilteredTasks() {
  const q = String(taskFilters.query || '').trim().toLowerCase();
  return state.tasks.filter(task => {
    const dueState = getTaskDueState(task).status;
    const queryHit = !q || [task.title, task.notes, task.clientName, task.assignedAeName, task.dependsOnTaskTitle, getTaskDependency(task).label].some(value => String(value || '').toLowerCase().includes(q));
    const statusHit = !taskFilters.status || String(task.status || '') === taskFilters.status;
    const aeHit = !taskFilters.aeId || task.assignedAeId === taskFilters.aeId;
    const clientHit = !taskFilters.clientId || task.clientId === taskFilters.clientId;
    const dueHit = !taskFilters.due || dueState === taskFilters.due;
    return queryHit && statusHit && aeHit && clientHit && dueHit;
  }).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

function updateTaskFormMode() {
  const mode = $('#task-form-mode');
  const save = $('#save-task');
  const cancel = $('#cancel-task-edit');
  if (mode) mode.textContent = editingTaskId ? 'Edit mode · saving updates the current task record.' : 'Create mode · saving adds a new task record.';
  if (save) save.textContent = editingTaskId ? 'Update task' : 'Save task';
  if (cancel) cancel.hidden = !editingTaskId;
}

function clearTaskForm() {
  ['#task-title', '#task-due', '#task-notes', '#task-blocker-note'].forEach(id => { if ($(id)) $(id).value = ''; });
  if ($('#task-dependency')) $('#task-dependency').value = '';
  if ($('#task-ae')) $('#task-ae').value = '';
  if ($('#task-client')) $('#task-client').value = '';
  if ($('#task-status-form')) $('#task-status-form').value = 'todo';
  if ($('#task-recurrence')) $('#task-recurrence').value = 'none';
  if ($('#task-estimated-minutes')) $('#task-estimated-minutes').value = '0';
  if ($('#task-actual-minutes')) $('#task-actual-minutes').value = '0';
  editingTaskId = '';
  updateTaskFormMode();
}

function loadTaskIntoForm(task) {
  if (!task) return;
  editingTaskId = task.id;
  if ($('#task-title')) $('#task-title').value = task.title || '';
  if ($('#task-due')) $('#task-due').value = task.dueDate || '';
  if ($('#task-ae')) $('#task-ae').value = task.assignedAeId || '';
  if ($('#task-client')) $('#task-client').value = task.clientId || '';
  if ($('#task-notes')) $('#task-notes').value = task.notes || '';
  if ($('#task-status-form')) $('#task-status-form').value = task.status || 'todo';
  if ($('#task-blocker-note')) $('#task-blocker-note').value = task.blockerNote || '';
  if ($('#task-dependency')) $('#task-dependency').value = task.dependsOnTaskId || '';
  if ($('#task-recurrence')) $('#task-recurrence').value = task.recurrenceCadence || 'none';
  if ($('#task-estimated-minutes')) $('#task-estimated-minutes').value = String(Number(task.estimatedMinutes || 0));
  if ($('#task-actual-minutes')) $('#task-actual-minutes').value = String(Number(task.actualMinutes || 0));
  updateTaskFormMode();
}

function applyTaskDraft(task, draft, mode = 'update') {
  task.title = draft.title;
  task.dueDate = draft.dueDate;
  task.assignedAeId = draft.assignedAeId;
  task.assignedAeName = draft.assignedAeName;
  task.clientId = draft.clientId;
  task.clientName = draft.clientName;
  task.notes = draft.notes;
  task.status = draft.status || task.status || 'todo';
  task.blockerNote = draft.blockerNote || '';
  task.dependsOnTaskId = draft.dependsOnTaskId || '';
  task.dependsOnTaskTitle = draft.dependsOnTaskTitle || '';
  task.recurrenceCadence = draft.recurrenceCadence || 'none';
  task.estimatedMinutes = Math.max(0, Number(draft.estimatedMinutes || 0));
  task.actualMinutes = Math.max(0, Number(draft.actualMinutes || 0));
  task.recurrenceSourceTaskId = task.recurrenceSourceTaskId || draft.recurrenceSourceTaskId || task.id;
  task.recurrenceIteration = Number(task.recurrenceIteration || draft.recurrenceIteration || 1);
  syncTaskDependencyState(task, false);
  task.updatedAt = nowIso();
  if (!task.createdAt) task.createdAt = task.updatedAt;
  state.auditLog.unshift({ id: uid('audit'), kind: mode === 'create' ? 'task-create' : 'task-update', message: `${mode === 'create' ? 'Task created' : 'Task updated'}: ${task.title}`, at: nowIso() });
  return task;
}

function shiftTaskDueDate(taskId, days = 0) {
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) return;
  const base = String(task.dueDate || '').trim() || getTodayIsoDate();
  task.dueDate = isoDatePlusDays(base, days);
  task.updatedAt = nowIso();
  remoteUpsert('tasks', task);
  state.auditLog.unshift({ id: uid('audit'), kind: 'task-followup-shift', message: `${task.title} due date moved to ${task.dueDate}`, at: nowIso() });
  persist();
}

function completeTask(taskId) {
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) return;
  task.status = 'done';
  task.updatedAt = nowIso();
  remoteUpsert('tasks', task);
  const spawnedTask = spawnRecurringTaskIfNeeded(task);
  refreshDependentTasksForTask(task.id);
  state.auditLog.unshift({ id: uid('audit'), kind: 'task-complete', message: `${task.title} marked done${spawnedTask ? ` · next recurrence ${spawnedTask.dueDate}` : ''}`, at: nowIso() });
  persist();
}

function exportTaskDossier(taskId, type = 'json') {
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) return;
  if (type === 'json') return download(`ae-task-${task.id}.json`, JSON.stringify(task, null, 2), 'application/json');
  const md = [
    `# ${task.title}`,
    '',
    `- Status: ${task.status || 'todo'}`,
    `- Due: ${task.dueDate || 'not set'}`,
    `- AE: ${task.assignedAeName || 'Unassigned'}`,
    `- Client: ${task.clientName || 'No client linked'}`,
    `- Updated: ${task.updatedAt || task.createdAt || ''}`,
    `- Dependency: ${getTaskDependency(task).label}`,
    `- Recurrence: ${getRecurrenceConfig(task.recurrenceCadence || 'none').label}`,
    `- Recurrence iteration: ${Number(task.recurrenceIteration || 1)}`,
    `- Estimated minutes: ${Number(task.estimatedMinutes || 0)}`,
    `- Actual minutes: ${Number(task.actualMinutes || 0)}`,
    `- Effort state: ${getTaskEffortState(task).label}`,
    '',
    '## Notes',
    '',
    task.notes || 'No notes.',
    '',
    '## Blocker note',
    '',
    task.blockerNote || 'No blocker note.'
  ].join('\n');
  return download(`ae-task-${task.id}.md`, md, 'text/markdown');
}

function getSelectedTasks() {
  return state.tasks.filter(task => selectedTaskIds.has(task.id));
}

function exportTasks(tasks, type = 'json') {
  if (!Array.isArray(tasks) || !tasks.length) return alert('No tasks selected to export.');
  if (type === 'json') return download('ae-brain-tasks.json', JSON.stringify(tasks, null, 2), 'application/json');
  const md = [
    '# AE Brain Tasks Export',
    '',
    ...tasks.flatMap(task => [
      `## ${task.title}`,
      '',
      `- Status: ${task.status || 'todo'}`,
      `- Due: ${task.dueDate || 'not set'}`,
      `- AE: ${task.assignedAeName || 'Unassigned'}`,
      `- Client: ${task.clientName || 'No client linked'}`,
      `- Effort: ${getTaskEffortState(task).label}`,
      '',
      task.notes || 'No notes.',
      ''
    ])
  ].join('\n');
  return download('ae-brain-tasks.md', md, 'text/markdown');
}

function updateTaskBulkCount() {
  if ($('#task-bulk-count')) $('#task-bulk-count').textContent = `${selectedTaskIds.size} selected`;
}

function syncSelectAllVisibleTasks() {
  const visibleIds = getFilteredTasks().map(task => task.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedTaskIds.has(id));
  const selectAll = $('#select-all-visible-tasks');
  if (selectAll) selectAll.checked = allSelected;
}

function bindTaskSelectionControls() {
  document.querySelectorAll('.task-select').forEach(input => input.addEventListener('change', () => {
    if (input.checked) selectedTaskIds.add(input.dataset.id);
    else selectedTaskIds.delete(input.dataset.id);
    updateTaskBulkCount();
    syncSelectAllVisibleTasks();
  }));
}

function bulkUpdateSelectedTasksStatus() {
  const tasks = getSelectedTasks();
  const nextStatus = $('#bulk-task-status')?.value || '';
  if (!tasks.length) return alert('Select at least one task first.');
  if (!nextStatus) return alert('Choose a task status first.');
  tasks.forEach(task => {
    task.status = nextStatus;
    task.updatedAt = nowIso();
    remoteUpsert('tasks', task);
  });
  state.auditLog.unshift({ id: uid('audit'), kind: 'bulk-task-status', message: `Bulk updated ${tasks.length} tasks to ${nextStatus}`, at: nowIso() });
  persist();
  render();
}

function bulkSnoozeSelectedTasks(days = 1) {
  const tasks = getSelectedTasks();
  if (!tasks.length) return alert('Select at least one task first.');
  tasks.forEach(task => shiftTaskDueDate(task.id, days));
  state.auditLog.unshift({ id: uid('audit'), kind: 'bulk-task-snooze', message: `Bulk moved ${tasks.length} tasks by ${days} day(s)`, at: nowIso() });
  persist();
  render();
}

function bulkDeleteSelectedTasks() {
  const tasks = getSelectedTasks();
  if (!tasks.length) return alert('Select at least one task first.');
  if (!globalThis.confirm(`Delete ${tasks.length} selected tasks?`)) return;
  const ids = new Set(tasks.map(task => task.id));
  tasks.forEach(task => remoteDelete('tasks', task.id));
  state.tasks = state.tasks.filter(task => !ids.has(task.id));
  selectedTaskIds = new Set();
  state.auditLog.unshift({ id: uid('audit'), kind: 'bulk-task-delete', message: `Deleted ${tasks.length} selected tasks`, at: nowIso() });
  persist();
  render();
}

function exportSelectedTasks() {
  const type = $('#task-export-type')?.value || 'json';
  exportTasks(getSelectedTasks(), type);
}

function saveTaskFilterPreset() {
  const name = globalThis.prompt('Preset name for the current task filters?');
  if (!name) return;
  const preset = {
    id: uid('task-filter-preset'),
    name: name.trim(),
    filters: { ...taskFilters },
    createdAt: nowIso()
  };
  state.taskFilterPresets = Array.isArray(state.taskFilterPresets) ? state.taskFilterPresets.filter(item => item.name !== preset.name) : [];
  state.taskFilterPresets.unshift(preset);
  state.auditLog.unshift({ id: uid('audit'), kind: 'task-filter-preset', message: `Saved task filter preset: ${preset.name}`, at: nowIso() });
  persist();
  render();
}

function loadTaskFilterPreset(id) {
  const preset = (state.taskFilterPresets || []).find(item => item.id === id);
  if (!preset) return;
  taskFilters = { ...taskFilters, ...preset.filters };
  state.auditLog.unshift({ id: uid('audit'), kind: 'task-filter-preset-load', message: `Loaded task filter preset: ${preset.name}`, at: nowIso() });
  render();
}

function deleteTaskFilterPreset(id) {
  const preset = (state.taskFilterPresets || []).find(item => item.id === id);
  state.taskFilterPresets = (state.taskFilterPresets || []).filter(item => item.id !== id);
  if (preset) state.auditLog.unshift({ id: uid('audit'), kind: 'task-filter-preset-delete', message: `Deleted task filter preset: ${preset.name}`, at: nowIso() });
  persist();
  render();
}

function getClientFormDraft() {
  return {
    name: $('#client-name')?.value.trim() || '',
    company: $('#client-company')?.value.trim() || '',
    clientType: $('#client-type')?.value.trim() || '',
    needs: $('#client-needs')?.value.trim() || '',
    stage: $('#client-stage')?.value || 'intake',
    priority: $('#client-priority')?.value || 'normal',
    escalationLevel: $('#client-escalation-level')?.value || 'none',
    escalationReason: $('#client-escalation-reason')?.value.trim() || '',
    estimatedValue: Number($('#client-estimated-value')?.value || 0),
    monthlyValue: Number($('#client-monthly-value')?.value || 0),
    closeProbability: Number($('#client-close-probability')?.value || 0),
    targetCloseDate: $('#client-target-close')?.value || '',
    followUpDate: $('#client-follow-up')?.value || '',
    currentMilestone: $('#client-milestone')?.value.trim() || '',
    milestoneDueDate: $('#client-milestone-due')?.value || '',
    milestoneProgress: Number($('#client-milestone-progress')?.value || 0),
    nextStep: $('#client-next-step')?.value.trim() || '',
    notes: $('#client-notes')?.value.trim() || ''
  };
}


function buildClientTags(draft = {}) {
  return [
    draft.clientType || '',
    draft.needs || '',
    draft.stage || '',
    draft.priority || '',
    draft.escalationLevel && draft.escalationLevel !== 'none' ? `escalation-${draft.escalationLevel}` : '',
    draft.followUpDate ? 'follow-up-set' : '',
    draft.nextStep ? 'next-step-set' : '',
    getClientValueTier(draft),
    draft.targetCloseDate ? 'target-close-set' : ''
  ].filter(Boolean).join(', ');
}

function updateClientFormMode() {
  const mode = $('#client-form-mode');
  const save = $('#save-client');
  const cancel = $('#cancel-client-edit');
  if (mode) mode.textContent = editingClientId ? 'Edit mode · saving updates the current client record.' : 'Create mode · saving adds a new client record.';
  if (save) save.textContent = editingClientId ? 'Update client' : 'Save client';
  if (cancel) cancel.hidden = !editingClientId;
}

function clearClientForm() {
  ['#client-name','#client-company','#client-type','#client-needs','#client-next-step','#client-notes','#client-follow-up','#client-milestone','#client-milestone-due','#client-target-close','#client-escalation-reason'].forEach(id => { if ($(id)) $(id).value = ''; });
  if ($('#client-stage')) $('#client-stage').value = 'intake';
  if ($('#client-priority')) $('#client-priority').value = 'normal';
  if ($('#client-escalation-level')) $('#client-escalation-level').value = 'none';
  if ($('#client-milestone-progress')) $('#client-milestone-progress').value = '0';
  if ($('#client-estimated-value')) $('#client-estimated-value').value = '0';
  if ($('#client-monthly-value')) $('#client-monthly-value').value = '0';
  if ($('#client-close-probability')) $('#client-close-probability').value = '0';
  editingClientId = '';
  updateClientFormMode();
  renderDuplicateWatch();
  updateClientFormMode();
}

function loadClientIntoForm(client) {
  if (!client) return;
  editingClientId = client.id;
  if ($('#client-name')) $('#client-name').value = client.name || '';
  if ($('#client-company')) $('#client-company').value = client.company || '';
  if ($('#client-type')) $('#client-type').value = client.clientType || '';
  if ($('#client-needs')) $('#client-needs').value = client.needs || '';
  if ($('#client-stage')) $('#client-stage').value = client.stage || 'intake';
  if ($('#client-priority')) $('#client-priority').value = client.priority || 'normal';
  if ($('#client-escalation-level')) $('#client-escalation-level').value = client.escalationLevel || 'none';
  if ($('#client-escalation-reason')) $('#client-escalation-reason').value = client.escalationReason || '';
  if ($('#client-estimated-value')) $('#client-estimated-value').value = String(Number(client.estimatedValue || 0));
  if ($('#client-monthly-value')) $('#client-monthly-value').value = String(Number(client.monthlyValue || 0));
  if ($('#client-close-probability')) $('#client-close-probability').value = String(Number(client.closeProbability || 0));
  if ($('#client-target-close')) $('#client-target-close').value = client.targetCloseDate || '';
  if ($('#client-follow-up')) $('#client-follow-up').value = client.followUpDate || '';
  if ($('#client-milestone')) $('#client-milestone').value = client.currentMilestone || '';
  if ($('#client-milestone-due')) $('#client-milestone-due').value = client.milestoneDueDate || '';
  if ($('#client-milestone-progress')) $('#client-milestone-progress').value = String(Number(client.milestoneProgress || 0));
  if ($('#client-next-step')) $('#client-next-step').value = client.nextStep || '';
  if ($('#client-notes')) $('#client-notes').value = client.notes || '';
  updateClientFormMode();
  renderDuplicateWatch();
}

function logClientActivity(client, kind, title, detail = '') {
  if (!client) return;
  client.activityHistory = Array.isArray(client.activityHistory) ? client.activityHistory : [];
  client.activityHistory.unshift({
    id: uid('client-activity'),
    at: nowIso(),
    kind,
    title,
    detail
  });
}

function applyClientDraft(client, draft, mode = 'update') {
  client.name = draft.name;
  client.company = draft.company;
  client.clientType = draft.clientType;
  client.needs = draft.needs;
  client.stage = draft.stage;
  client.priority = draft.priority;
  client.escalationLevel = draft.escalationLevel || 'none';
  client.escalationReason = draft.escalationReason || '';
  client.estimatedValue = Math.max(0, Number(draft.estimatedValue || 0));
  client.monthlyValue = Math.max(0, Number(draft.monthlyValue || 0));
  client.closeProbability = Math.max(0, Math.min(100, Number(draft.closeProbability || 0)));
  client.targetCloseDate = draft.targetCloseDate || '';
  client.followUpDate = draft.followUpDate;
  client.currentMilestone = draft.currentMilestone;
  client.milestoneDueDate = draft.milestoneDueDate;
  client.milestoneProgress = Math.max(0, Math.min(100, Number(draft.milestoneProgress || 0)));
  client.nextStep = draft.nextStep;
  client.notes = draft.notes;
  client.tags = buildClientTags(draft);
  client.updatedAt = nowIso();
  if (!client.createdAt) client.createdAt = client.updatedAt;
  if (!Array.isArray(client.assignmentHistory)) client.assignmentHistory = [];
  logClientActivity(client, mode === 'create' ? 'client-created' : 'client-updated', mode === 'create' ? 'Client created' : 'Client updated', `${client.stage || 'intake'} · ${client.priority || 'normal'} · ${formatCurrency(client.estimatedValue)} est`);
  return client;
}

function isoDatePlusDays(baseDate, days = 0) {
  const base = new Date(`${baseDate || getTodayIsoDate()}T12:00:00`);
  base.setDate(base.getDate() + Number(days || 0));
  return base.toISOString().slice(0, 10);
}

function shiftClientFollowUp(clientId, days = 1) {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const nextDate = isoDatePlusDays(client.followUpDate || getTodayIsoDate(), days);
  client.followUpDate = nextDate;
  client.tags = buildClientTags(client);
  client.updatedAt = nowIso();
  logClientActivity(client, 'followup-snooze', 'Follow-up snoozed', `${days} day move · ${nextDate}`);
  state.auditLog.unshift({ id: uid('audit'), kind: 'client-followup-snooze', message: `${client.name} follow-up moved by ${days} day(s) to ${nextDate}`, at: nowIso() });
  remoteUpsert('clients', client);
  persist();
  return client;
}

function completeClientFollowUp(clientId) {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const previousDate = client.followUpDate || '';
  client.followUpDate = '';
  client.tags = buildClientTags(client);
  client.updatedAt = nowIso();
  logClientActivity(client, 'followup-complete', 'Follow-up completed', previousDate || 'No prior date');
  state.auditLog.unshift({ id: uid('audit'), kind: 'client-followup-complete', message: `${client.name} follow-up cleared`, at: nowIso() });
  remoteUpsert('clients', client);
  persist();
  return client;
}

function bulkUpdateSelectedStage() {
  const clients = getSelectedClients();
  const nextStage = $('#bulk-stage-select')?.value || '';
  if (!clients.length) return alert('Select at least one client first.');
  if (!nextStage) return alert('Choose a stage first.');
  clients.forEach(client => {
    client.stage = nextStage;
    client.tags = buildClientTags(client);
    client.updatedAt = nowIso();
    logClientActivity(client, 'bulk-stage-update', 'Stage updated', nextStage);
    remoteUpsert('clients', client);
  });
  state.auditLog.unshift({ id: uid('audit'), kind: 'bulk-stage-update', message: `Bulk updated ${clients.length} clients to stage ${nextStage}`, at: nowIso() });
  persist();
  render();
}

function bulkUpdateSelectedPriority() {
  const clients = getSelectedClients();
  const nextPriority = $('#bulk-priority-select')?.value || '';
  if (!clients.length) return alert('Select at least one client first.');
  if (!nextPriority) return alert('Choose a priority first.');
  clients.forEach(client => {
    client.priority = nextPriority;
    client.tags = buildClientTags(client);
    client.updatedAt = nowIso();
    logClientActivity(client, 'bulk-priority-update', 'Priority updated', nextPriority);
    remoteUpsert('clients', client);
  });
  state.auditLog.unshift({ id: uid('audit'), kind: 'bulk-priority-update', message: `Bulk updated ${clients.length} clients to priority ${nextPriority}`, at: nowIso() });
  persist();
  render();
}

function findPotentialDuplicateClients(draft, excludeId = '') {
  const name = String(draft?.name || '').trim().toLowerCase();
  const company = String(draft?.company || '').trim().toLowerCase();
  if (!name && !company) return [];
  return state.clients.filter(client => {
    if (excludeId && client.id === excludeId) return false;
    const sameName = name && String(client.name || '').trim().toLowerCase() === name;
    const sameCompany = company && String(client.company || '').trim().toLowerCase() === company;
    const partialName = name && String(client.name || '').trim().toLowerCase().includes(name);
    const partialCompany = company && String(client.company || '').trim().toLowerCase().includes(company);
    return (sameName && sameCompany) || sameName || sameCompany || (partialName && sameCompany) || (sameName && partialCompany);
  }).slice(0, 6);
}

function renderDuplicateWatch() {
  const target = $('#client-duplicate-watch');
  if (!target) return;
  const draft = getClientFormDraft();
  const matches = findPotentialDuplicateClients(draft);
  if (!draft.name && !draft.company) {
    target.innerHTML = '<div class="meta">Enter a name or company to check for duplicates before saving.</div>';
    return;
  }
  if (!matches.length) {
    target.innerHTML = '<div class="meta">No likely duplicate clients detected from the current intake fields.</div>';
    return;
  }
  target.innerHTML = `
    <div class="item warning-item">
      <div class="eyebrow">Duplicate watch</div>
      <h4>Possible matching clients</h4>
      <div class="list">${matches.map(client => `<div class="item compact-item"><div><strong>${escapeHtml(client.name)}</strong><div class="meta">${escapeHtml(client.company || 'No company')} · ${escapeHtml(client.stage || 'intake')} · assigned ${escapeHtml(client.assignedAeName || 'Unassigned')}</div></div><div class="toolbar"><button class="btn-soft" data-act="open-duplicate-client" data-id="${client.id}">Open</button></div></div>`).join('')}</div>
    </div>`;
  target.querySelectorAll('[data-act="open-duplicate-client"]').forEach(btn => btn.addEventListener('click', () => renderClientHistory(btn.dataset.id, true)));
}

function saveClientFilterPreset() {
  const name = globalThis.prompt('Preset name for the current client filters?');
  if (!name) return;
  const preset = {
    id: uid('client-filter-preset'),
    name: name.trim(),
    filters: { ...clientFilters },
    createdAt: nowIso()
  };
  state.clientFilterPresets = Array.isArray(state.clientFilterPresets) ? state.clientFilterPresets.filter(item => item.name !== preset.name) : [];
  state.clientFilterPresets.unshift(preset);
  state.auditLog.unshift({ id: uid('audit'), kind: 'client-filter-preset', message: `Saved client filter preset: ${preset.name}`, at: nowIso() });
  persist();
  render();
}

function loadClientFilterPreset(id) {
  const preset = (state.clientFilterPresets || []).find(item => item.id === id);
  if (!preset) return;
  clientFilters = { query: '', aeId: '', stage: '', priority: '', health: '', touch: '', value: '', ...(preset.filters || {}) };
  render();
}

function deleteClientFilterPreset(id) {
  const preset = (state.clientFilterPresets || []).find(item => item.id === id);
  state.clientFilterPresets = (state.clientFilterPresets || []).filter(item => item.id !== id);
  if (preset) state.auditLog.unshift({ id: uid('audit'), kind: 'client-filter-preset-delete', message: `Deleted client filter preset: ${preset.name}`, at: nowIso() });
  persist();
  render();
}

function getAeMatchCandidates(client, limit = 3) {
  return rankAeCandidates(state, client, limit).filter(item => Number(item.score || 0) > -1000);
}

function buildClientActivityTimeline(client) {
  const taskEvents = getClientRelatedTasks(client.id).map(task => ({
    at: task.updatedAt || task.createdAt || '',
    kind: 'task',
    title: task.title,
    detail: `${task.status || 'todo'}${task.assignedAeName ? ` · ${task.assignedAeName}` : ''}`
  }));
  const threadEvents = getClientRelatedThreads(client.id).map(thread => ({
    at: thread.updatedAt || thread.createdAt || '',
    kind: 'thread',
    title: thread.subject,
    detail: `${thread.messageCount || 0} messages${thread.aeName ? ` · ${thread.aeName}` : ''}`
  }));
  const messageEvents = state.messages
    .filter(message => getClientRelatedThreads(client.id).some(thread => thread.id === message.threadId))
    .slice(-8)
    .map(message => ({
      at: message.at || '',
      kind: 'message',
      title: message.role,
      detail: snippetAround(message.text || '', '')
    }));
  const assignmentEvents = (client.assignmentHistory || []).map(row => ({
    at: row.at || '',
    kind: 'assignment',
    title: row.aeName || 'AE assignment',
    detail: row.mode || 'manual'
  }));
  const customEvents = (client.activityHistory || []).map(row => ({
    at: row.at || '',
    kind: row.kind || 'client-activity',
    title: row.title || 'Client activity',
    detail: row.detail || ''
  }));
  const createdEvent = [{ at: client.createdAt || '', kind: 'client', title: client.name || 'Client created', detail: client.stage || 'intake' }];
  return [...createdEvent, ...customEvents, ...assignmentEvents, ...taskEvents, ...threadEvents, ...messageEvents]
    .filter(item => item.at)
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, 16);
}

function exportClientDossier(clientId, format = 'json') {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return;
  const tasks = getClientRelatedTasks(client.id);
  const threads = getClientRelatedThreads(client.id);
  const timeline = buildClientActivityTimeline(client);
  const candidates = getAeMatchCandidates(client, 5);
  const health = getClientHealth(client);
  const touch = getClientTouchStatus(client);
  if (format === 'json') {
    return download('ae-client-dossier.json', JSON.stringify({ client, health, touch, valueTier: getClientValueTier(client), estimatedValue: getClientEstimatedValue(client), weightedValue: getClientWeightedValue(client), monthlyValue: getClientMonthlyValue(client), tasks, threads, timeline, candidates }, null, 2), 'application/json');
  }
  const md = [
    `# ${client.name}`,
    '',
    `- Company: ${client.company || 'No company'}`,
    `- Assigned AE: ${client.assignedAeName || 'Unassigned'}`,
    `- Stage: ${client.stage || 'intake'}`,
    `- Priority: ${client.priority || 'normal'}`,
    `- Follow-up: ${client.followUpDate || 'None'}`,
    `- Next step: ${client.nextStep || 'None'}`,
    `- Value tier: ${getClientValueTier(client)}`,
    `- Estimated value: ${formatCurrency(getClientEstimatedValue(client))}`,
    `- Weighted value: ${formatCurrency(getClientWeightedValue(client))}`,
    `- Monthly value: ${formatCurrency(getClientMonthlyValue(client))}`,
    `- Target close: ${client.targetCloseDate || 'None'}`,
    `- Health: ${health.label} · score ${health.score}`,
    `- Contact cadence: ${touch.label}`,
    '',
    '## Notes',
    '',
    client.notes || 'No notes.',
    '',
    '## Top AE matches',
    '',
    ...candidates.map(item => `- ${item.name} (${item.title}) — score ${item.score}`),
    '',
    '## Activity timeline',
    '',
    ...timeline.map(item => `- ${item.at} · ${item.kind} · ${item.title} · ${item.detail}`),
    '',
    '## Tasks',
    '',
    ...tasks.map(task => `- ${task.title} · ${task.status || 'todo'} · ${task.updatedAt || task.createdAt || ''}`),
    '',
    '## Threads',
    '',
    ...threads.map(thread => `- ${thread.subject} · ${thread.messageCount || 0} messages · ${thread.updatedAt || thread.createdAt || ''}`)
  ].join('
');
  return download('ae-client-dossier.md', md, 'text/markdown');
}

function getAeCapacityState(ae) {
  const dailyCap = Number(ae.overrideDailyCap || ae.dailyCap || 0);
  const monthlyCap = Number(ae.overrideMonthlyCap || ae.monthlyCap || 0);
  const dailyUsed = Number(ae.usageToday || 0);
  const monthlyUsed = Number(ae.usageMonth || 0);
  const availability = getAeAvailabilityState(ae);
  if (availability.status === 'disabled') return 'disabled';
  if (availability.status === 'out' || availability.status === 'scheduled-out') return 'unavailable';
  if ((dailyCap > 0 && dailyUsed >= dailyCap) || (monthlyCap > 0 && monthlyUsed >= monthlyCap)) return 'over-cap';
  if (availability.status === 'focus' || availability.status === 'backup') return availability.status;
  return 'healthy';
}

function getClientRelatedTasks(clientId) {
  return state.tasks.filter(task => task.clientId === clientId).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

function getClientRelatedThreads(clientId) {
  return state.threads.filter(thread => thread.clientId === clientId).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

function createTaskFromClient(client) {
  const task = {
    id: uid('task'),
    title: `Follow up — ${client.name}`,
    dueDate: '',
    assignedAeId: client.assignedAeId || '',
    assignedAeName: client.assignedAeName || '',
    clientId: client.id,
    clientName: client.name,
    notes: client.nextStep ? `Next step: ${client.nextStep}` : (client.notes || ''),
    status: 'todo',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  state.tasks.unshift(task);
  state.auditLog.unshift({ id: uid('audit'), kind: 'client-task', message: `Task created from client dossier: ${client.name}`, at: nowIso() });
  remoteUpsert('tasks', task);
  persist();
  return task;
}

function createFollowupTaskFromClient(client, mode = 'client-followup') {
  if (!client) return null;
  const existing = state.tasks.find(task => task.clientId === client.id && String(task.status || 'todo') !== 'done' && String(task.title || '').startsWith('Follow up —'));
  if (existing) return existing;
  const noteParts = [];
  if (client.nextStep) noteParts.push(`Next step: ${client.nextStep}`);
  if (client.notes) noteParts.push(client.notes);
  const task = applyTaskDraft({
    id: uid('task'),
    status: 'todo',
    templateKind: mode,
    createdAt: nowIso(),
    updatedAt: nowIso()
  }, {
    title: `Follow up — ${client.name}`,
    dueDate: client.followUpDate || getTodayIsoDate(),
    assignedAeId: client.assignedAeId || '',
    assignedAeName: client.assignedAeName || '',
    clientId: client.id,
    clientName: client.name,
    notes: noteParts.join('\n\n')
  }, 'create');
  state.tasks.unshift(task);
  logClientActivity(client, 'followup-task', 'Follow-up task created', task.dueDate || 'No due date');
  state.auditLog.unshift({ id: uid('audit'), kind: 'followup-task-create', message: `Follow-up task created for ${client.name}`, at: nowIso() });
  remoteUpsert('tasks', task);
  persist();
  return task;
}

function getTaskTemplateById(templateId) {
  return TASK_TEMPLATE_LIBRARY.find(item => item.id === templateId) || null;
}

function interpolateTaskTemplate(text, client, ae) {
  return String(text || '')
    .replaceAll('{{clientName}}', client?.name || 'Client')
    .replaceAll('{{company}}', client?.company || client?.name || 'Company')
    .replaceAll('{{aeName}}', ae?.name || client?.assignedAeName || 'Assigned AE');
}

function applyTaskTemplateToForm(templateId) {
  const template = getTaskTemplateById(templateId);
  if (!template) return null;
  const client = state.clients.find(item => item.id === $('#task-client')?.value);
  const ae = state.aeProfiles.find(item => item.id === ($('#task-ae')?.value || client?.assignedAeId || ''));
  if ($('#task-title')) $('#task-title').value = interpolateTaskTemplate(template.title, client, ae);
  if ($('#task-due')) $('#task-due').value = isoDatePlusDays(client?.followUpDate || getTodayIsoDate(), template.offsetDays || 0);
  if ($('#task-notes')) $('#task-notes').value = interpolateTaskTemplate(template.notes, client, ae);
  if ($('#task-ae') && ae?.id) $('#task-ae').value = ae.id;
  if ($('#task-client') && client?.id) $('#task-client').value = client.id;
  return template;
}

function createTaskFromTemplate(templateId, options = {}) {
  const template = getTaskTemplateById(templateId);
  if (!template) return null;
  const client = state.clients.find(item => item.id === (options.clientId || $('#task-client')?.value || '')) || null;
  const ae = state.aeProfiles.find(item => item.id === (options.aeId || $('#task-ae')?.value || client?.assignedAeId || '')) || null;
  const title = interpolateTaskTemplate(options.title || template.title, client, ae);
  const dueDate = options.dueDate || isoDatePlusDays(client?.followUpDate || getTodayIsoDate(), options.offsetDays ?? template.offsetDays ?? 0);
  const notes = interpolateTaskTemplate(options.notes || template.notes, client, ae);
  const task = applyTaskDraft({
    id: uid('task'),
    status: 'todo',
    templateId: template.id,
    templateLabel: template.label,
    createdAt: nowIso(),
    updatedAt: nowIso()
  }, {
    title,
    dueDate,
    assignedAeId: ae?.id || client?.assignedAeId || '',
    assignedAeName: ae?.name || client?.assignedAeName || '',
    clientId: client?.id || '',
    clientName: client?.name || '',
    notes
  }, 'create');
  state.tasks.unshift(task);
  if (client) logClientActivity(client, 'template-task', 'Task created from template', `${template.label} · ${dueDate}`);
  state.auditLog.unshift({ id: uid('audit'), kind: 'task-template-create', message: `Template task created: ${task.title}`, at: nowIso() });
  remoteUpsert('tasks', task);
  persist();
  return task;
}

function createClientActionPlan(clientId, planId = 'stabilize-7') {
  const client = state.clients.find(item => item.id === clientId);
  const plan = CLIENT_ACTION_PLAN_LIBRARY.find(item => item.id === planId);
  if (!client || !plan) return [];
  const ae = state.aeProfiles.find(item => item.id === client.assignedAeId) || null;
  const created = plan.steps.map(step => {
    const task = applyTaskDraft({
      id: uid('task'),
      status: 'todo',
      actionPlanId: plan.id,
      actionPlanLabel: plan.label,
      createdAt: nowIso(),
      updatedAt: nowIso()
    }, {
      title: interpolateTaskTemplate(step.title, client, ae),
      dueDate: isoDatePlusDays(client.followUpDate || getTodayIsoDate(), step.offsetDays || 0),
      assignedAeId: client.assignedAeId || '',
      assignedAeName: client.assignedAeName || '',
      clientId: client.id,
      clientName: client.name,
      notes: interpolateTaskTemplate(step.notes, client, ae)
    }, 'create');
    state.tasks.unshift(task);
    remoteUpsert('tasks', task);
    return task;
  });
  logClientActivity(client, 'action-plan-create', 'Client action plan created', `${plan.label} · ${created.length} tasks`);
  state.auditLog.unshift({ id: uid('audit'), kind: 'client-action-plan', message: `${plan.label} created for ${client.name}`, at: nowIso() });
  persist();
  return created;
}

function createThreadFromClient(client) {
  const thread = {
    id: uid('thread'),
    subject: `${client.name} — follow-up`,
    aeId: client.assignedAeId || '',
    aeName: client.assignedAeName || '',
    clientId: client.id,
    clientName: client.name,
    messageCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  state.threads.unshift(thread);
  state.auditLog.unshift({ id: uid('audit'), kind: 'client-thread', message: `Thread created from client dossier: ${client.name}`, at: nowIso() });
  remoteUpsert('threads', thread);
  persist();
  return thread;
}

function rebalanceUnavailableAeClients() {
  let moved = 0;
  state.clients.forEach(client => {
    const currentAe = state.aeProfiles.find(ae => ae.id === client.assignedAeId);
    if (!currentAe) return;
    const capacity = getAeCapacityState(currentAe);
    if (capacity === 'healthy') return;
    const next = autoAssignClient(state, client);
    if (!next || next.id === currentAe.id) return;
    assignClient(state, client.id, next.id, 'rebalance');
    moved += 1;
    remoteUpsert('clients', client);
    if (client.assignmentHistory?.[0]) remoteUpsert('assignments', client.assignmentHistory[0]);
  });
  if (moved) {
    state.auditLog.unshift({ id: uid('audit'), kind: 'ae-rebalance', message: `Rebalanced ${moved} clients from disabled or over-cap AEs`, at: nowIso() });
    persist();
  }
  return moved;
}

function exportThread(threadId, format = 'json') {
  const thread = state.threads.find(item => item.id === threadId);
  if (!thread) return;
  const messages = state.messages.filter(item => item.threadId === threadId).sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  if (format === 'json') {
    return download('ae-thread-export.json', JSON.stringify({ thread, messages }, null, 2), 'application/json');
  }
  const md = [
    `# ${thread.subject}`,
    '',
    `- Client: ${thread.clientName || 'No client'}`,
    `- AE: ${thread.aeName || 'No AE'}`,
    `- Messages: ${messages.length}`,
    '',
    ...messages.flatMap(msg => [`## ${msg.role} · ${msg.at || ''}`, '', msg.text || '', ''])
  ].join('\n');
  return download('ae-thread-export.md', md, 'text/markdown');
}

function promoteThreadToTask(threadId) {
  const thread = state.threads.find(item => item.id === threadId);
  if (!thread) return null;
  const messages = state.messages.filter(item => item.threadId === threadId).sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  const preview = messages.slice(-3).map(msg => `${msg.role}: ${msg.text}`).join('\n\n');
  const task = {
    id: uid('task'),
    title: `Follow-up from thread — ${thread.subject}`,
    dueDate: '',
    assignedAeId: thread.aeId || '',
    assignedAeName: thread.aeName || '',
    clientId: thread.clientId || '',
    clientName: thread.clientName || '',
    notes: preview,
    status: 'todo',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  state.tasks.unshift(task);
  state.auditLog.unshift({ id: uid('audit'), kind: 'thread-to-task', message: `Task created from thread: ${thread.subject}`, at: nowIso() });
  remoteUpsert('tasks', task);
  persist();
  return task;
}


function createThreadResponseTask(threadId, mode = 'thread-response') {
  const thread = state.threads.find(item => item.id === threadId);
  if (!thread) return null;
  const freshness = getThreadFreshness(thread);
  const existing = state.tasks.find(task => task.threadId === threadId && String(task.status || 'todo') !== 'done');
  if (existing) return existing;
  const messages = state.messages.filter(item => item.threadId === threadId).sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  const preview = messages.slice(-4).map(msg => `${msg.role}: ${msg.text}`).join('\n\n');
  const task = applyTaskDraft({
    id: uid('task'),
    status: 'todo',
    threadId,
    templateKind: mode,
    createdAt: nowIso(),
    updatedAt: nowIso()
  }, {
    title: `Response task — ${thread.subject}`,
    dueDate: getTodayIsoDate(),
    assignedAeId: thread.aeId || '',
    assignedAeName: thread.aeName || '',
    clientId: thread.clientId || '',
    clientName: thread.clientName || '',
    notes: `${freshness.label}\n\n${preview}`
  }, 'create');
  state.tasks.unshift(task);
  state.auditLog.unshift({ id: uid('audit'), kind: 'thread-response-task', message: `Response task created from thread: ${thread.subject}`, at: nowIso() });
  remoteUpsert('tasks', task);
  persist();
  return task;
}



function getAlertState(alertKey) {
  state.alertStates = state.alertStates && typeof state.alertStates === 'object' ? state.alertStates : {};
  return state.alertStates[alertKey] || { acknowledged: false, snoozeUntil: '', updatedAt: '' };
}

function updateAlertState(alertKey, patch = {}) {
  state.alertStates = state.alertStates && typeof state.alertStates === 'object' ? state.alertStates : {};
  state.alertStates[alertKey] = { ...getAlertState(alertKey), ...patch, updatedAt: nowIso() };
  state.auditLog.unshift({ id: uid('audit'), kind: 'alert-state', message: `Alert state updated: ${alertKey}`, at: nowIso() });
  persist();
}

function getAlertInbox(limit = 24) {
  const now = Date.now();
  const items = [];
  const push = item => {
    const alertState = getAlertState(item.key);
    if (alertState.acknowledged) return;
    if (alertState.snoozeUntil && Date.parse(alertState.snoozeUntil) > now) return;
    items.push({ ...item, alertState });
  };

  getAtRiskClients(8).forEach(item => push({
    key: `risk-${item.client.id}`,
    source: 'client',
    kind: 'client-risk',
    severity: item.health.status === 'critical' ? 'critical' : 'watch',
    score: 100 + Number(item.health.score || 0),
    title: `${item.client.name} is ${item.health.label}`,
    detail: `${item.client.assignedAeName || 'Unassigned'} · ${item.client.company || 'No company'} · ${item.client.nextStep || 'No next step set.'}`,
    actionKind: 'client',
    targetId: item.client.id
  }));

  getSlaPressureQueue(8).forEach(item => push({
    key: `sla-${item.client.id}`,
    source: 'client',
    kind: 'sla-pressure',
    severity: item.sla.status === 'critical' ? 'critical' : 'watch',
    score: 90 + Number(item.sla.score || 0),
    title: `${item.client.name} has SLA pressure`,
    detail: `${item.sla.label} · ${item.sla.reasons.join(' | ') || 'No reasons'} `,
    actionKind: 'client',
    targetId: item.client.id
  }));

  getStaleThreads(8).forEach(item => push({
    key: `stale-${item.thread.id}`,
    source: 'thread',
    kind: 'stale-thread',
    severity: item.freshness.status === 'stale' ? 'critical' : 'watch',
    score: 80 + Number(item.freshness.ageDays || 0),
    title: item.thread.subject,
    detail: `${item.freshness.label} · ${item.thread.clientName || 'No client'} · ${item.thread.aeName || 'No AE'}`,
    actionKind: 'thread',
    targetId: item.thread.id
  }));

  getAwaitingResponseThreads(8).forEach(item => push({
    key: `awaiting-${item.thread.id}`,
    source: 'thread',
    kind: 'awaiting-reply',
    severity: item.lag.critical ? 'critical' : 'watch',
    score: 85 + Number(item.lag.hours || 0),
    title: `${item.thread.subject} is awaiting reply`,
    detail: `${item.lag.label} · ${item.thread.clientName || 'No client'} · ${item.thread.aeName || 'No AE'}`,
    actionKind: 'thread',
    targetId: item.thread.id
  }));

  getBlockedTasks(8).forEach(task => push({
    key: `blocked-${task.id}`,
    source: 'task',
    kind: 'blocked-task',
    severity: 'watch',
    score: 75,
    title: task.title,
    detail: `${task.clientName || 'No client'} · ${task.assignedAeName || 'No AE'} · ${task.blockerNote || 'No blocker note'}`,
    actionKind: 'task',
    targetId: task.id
  }));

  getMilestoneQueue(8).filter(item => ['overdue', 'today'].includes(item.milestone.status)).forEach(item => push({
    key: `milestone-${item.client.id}`,
    source: 'client',
    kind: 'milestone-pressure',
    severity: item.milestone.status === 'overdue' ? 'critical' : 'watch',
    score: item.milestone.status === 'overdue' ? 88 : 72,
    title: `${item.client.name} milestone pressure`,
    detail: `${item.milestone.label} · ${item.client.assignedAeName || 'Unassigned'}`,
    actionKind: 'client',
    targetId: item.client.id
  }));

  getTaskEffortQueue(8).filter(item => item.effort.status === 'overrun').forEach(item => push({
    key: `effort-${item.task.id}`,
    source: 'task',
    kind: 'effort-overrun',
    severity: 'watch',
    score: 70 + Number(item.effort.overBy || 0),
    title: `${item.task.title} is over effort`,
    detail: `${item.effort.label} · ${item.task.assignedAeName || 'No AE'} · ${item.task.clientName || 'No client'}`,
    actionKind: 'task',
    targetId: item.task.id
  }));

  getOpenQuestionThreads(8).forEach(thread => push({
    key: `question-${thread.id}`,
    source: 'thread',
    kind: 'open-question',
    severity: 'watch',
    score: 68,
    title: `${thread.subject} has open questions`,
    detail: `${thread.clientName || 'No client'} · ${thread.aeName || 'No AE'} · ${thread.openQuestions || 'No open question text'}`,
    actionKind: 'thread',
    targetId: thread.id
  }));

  return items.sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || String(a.title || '').localeCompare(String(b.title || ''))).slice(0, limit);
}

function getAlertInboxCounts() {
  return getAlertInbox(100).reduce((acc, item) => {
    acc.total = Number(acc.total || 0) + 1;
    acc[item.source] = Number(acc[item.source] || 0) + 1;
    acc[item.severity] = Number(acc[item.severity] || 0) + 1;
    return acc;
  }, { total: 0, client: 0, thread: 0, task: 0, critical: 0, watch: 0 });
}

function buildAlertDigest() {
  return {
    exportedAt: nowIso(),
    counts: getAlertInboxCounts(),
    alerts: getAlertInbox(40).map(item => ({
      key: item.key,
      source: item.source,
      kind: item.kind,
      severity: item.severity,
      score: item.score,
      title: item.title,
      detail: item.detail,
      actionKind: item.actionKind,
      targetId: item.targetId
    }))
  };
}

function exportAlertDigest(format = 'json') {
  const digest = buildAlertDigest();
  if (format === 'json') return download('ae-alert-digest.json', JSON.stringify(digest, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — Alert Digest',
    '',
    `- Exported at: ${digest.exportedAt}`,
    `- Total alerts: ${digest.counts.total || 0}`,
    `- Critical alerts: ${digest.counts.critical || 0}`,
    `- Client alerts: ${digest.counts.client || 0}`,
    `- Thread alerts: ${digest.counts.thread || 0}`,
    `- Task alerts: ${digest.counts.task || 0}`,
    '',
    '## Active alerts',
    '',
    ...(digest.alerts.length ? digest.alerts.map(item => `- ${item.title}: ${item.kind} · ${item.severity} · ${item.detail}`) : ['- No active alerts are currently surfaced.'])
  ].join('
');
  return download('ae-alert-digest.md', md, 'text/markdown');
}

function buildOperationalSnapshotMarkdown(snapshot) {
  return [
    '# AE Brain Command Site — Operational Snapshot',
    '',
    `- Exported at: ${snapshot.exportedAt}`,
    `- Founder session: ${snapshot.founderSession.authenticated ? 'signed in' : 'local only'} · ${snapshot.founderSession.email || 'no email'}`,
    `- Remote state: ${snapshot.remote.state}`,
    `- Live brain lane: ${snapshot.remote.liveBrain}`,
    '',
    '## Client counts',
    '',
    ...Object.entries(snapshot.clients.stageCounts || {}).map(([key, value]) => `- Stage ${key}: ${value}`),
    ...Object.entries(snapshot.clients.priorityCounts || {}).map(([key, value]) => `- Priority ${key}: ${value}`),
    ...Object.entries(snapshot.clients.followupCounts || {}).map(([key, value]) => `- Follow-up ${key}: ${value}`),
    ...Object.entries(snapshot.clients.healthCounts || {}).map(([key, value]) => `- Client health ${key}: ${value}`),
    ...Object.entries(snapshot.clients.touchCounts || {}).map(([key, value]) => `- Contact cadence ${key}: ${value}`),
    ...Object.entries(snapshot.clients.valueCounts || {}).map(([key, value]) => `- Value tier ${key}: ${value}`),
    '',
    '## At-risk clients',
    '',
    ...(snapshot.clients.atRiskQueue?.length ? snapshot.clients.atRiskQueue.map(item => `- ${item.name}: ${item.status} · score ${item.score} · ${item.assignedAeName || 'Unassigned'} · ${item.followUpDate || 'no follow-up date'}`) : ['- No at-risk clients in the current snapshot.']),
    '',
    '## Pipeline queue',
    '',
    ...(snapshot.clients.pipelineQueue?.length ? snapshot.clients.pipelineQueue.map(item => `- ${item.name}: estimated ${formatCurrency(item.estimatedValue)} · weighted ${formatCurrency(item.weightedValue)} · ${item.assignedAeName || 'Unassigned'} · target ${item.targetCloseDate || 'not set'}`) : ['- No pipeline queue items in the current snapshot.']),
    '',
    '## Task counts',
    '',
    `- Total tasks: ${snapshot.tasks.total}`,
    `- Open tasks: ${snapshot.tasks.open}`,
    ...Object.entries(snapshot.tasks.dueCounts || {}).map(([key, value]) => `- Task due ${key}: ${value}`),
    `- Recurring open tasks: ${snapshot.tasks.recurringOpen}`,
    `- Draft replies stored: ${snapshot.transcripts.draftCount}`,
    '',
    '## AE roster load',
    '',
    ...snapshot.aeRoster.map(ae => `- ${ae.name}: ${ae.capacityState} · ${ae.availability} · assignments ${ae.assignments} · daily ${ae.dailyCap} · monthly ${ae.monthlyCap}`)
  ].join('
');
}

function buildCommandBriefMarkdown(brief) {
  return [
    '# AE Brain Command Site — Command Brief',
    '',
    `- Exported at: ${brief.exportedAt}`,
    '',
    '## Stale threads',
    '',
    ...(brief.staleThreads.length ? brief.staleThreads.map(item => `- ${item.subject}: ${item.label} · ${item.clientName || 'No client'} · ${item.aeName || 'No AE'}`) : ['- No stale threads in the current brief.']),
    '',
    '## AE workload alerts',
    '',
    ...(brief.workloadAlerts.length ? brief.workloadAlerts.map(item => `- ${item.aeName}: ${item.reason} · ${item.affectedCount} affected clients`) : ['- No AE workload alerts in the current brief.']),
    '',
    '## Recommended client actions',
    '',
    ...(brief.recommendedActions.length ? brief.recommendedActions.map(item => `- ${item.clientName}: ${item.health} · ${item.actions.join(' | ') || 'No recommendations surfaced'}`) : ['- No client recommendations surfaced.'])
  ].join('
');
}

function buildSlaBriefMarkdown(brief) {
  return [
    '# AE Brain Command Site — SLA Brief',
    '',
    `- Exported at: ${brief.exportedAt}`,
    '',
    '## SLA queue',
    '',
    ...(brief.slaQueue.length ? brief.slaQueue.map(item => `- ${item.clientName}: ${item.sla} · score ${item.score} · ${item.reasons.join(' | ')}`) : ['- No SLA pressure clients surfaced.']),
    '',
    '## Blocked tasks',
    '',
    ...(brief.blockedTasks.length ? brief.blockedTasks.map(item => `- ${item.title}: ${item.clientName || 'No client'} · ${item.assignedAeName || 'No AE'} · ${item.blockerNote || 'No blocker note'}`) : ['- No blocked tasks surfaced.']),
    '',
    '## Stale threads',
    '',
    ...(brief.staleThreads.length ? brief.staleThreads.map(item => `- ${item.subject}: ${item.clientName || 'No client'} · ${item.aeName || 'No AE'} · ${item.freshness}`) : ['- No stale threads surfaced.'])
  ].join('
');
}

function buildAePerformanceBriefMarkdown(brief) {
  return [
    '# AE Brain Command Site — AE Performance Brief',
    '',
    `- Exported at: ${brief.exportedAt}`,
    '',
    '## AE scoreboard',
    '',
    ...(brief.rows.length ? brief.rows.map(row => `- ${row.aeName}: ${row.status} · score ${row.score} · clients ${row.assignedClients} · open tasks ${row.openTasks} · blocked/waiting ${row.blockedTasks} · stale threads ${row.staleThreads} · awaiting replies ${row.awaitingThreads} · critical clients ${row.criticalClients}`) : ['- No AE performance rows surfaced.'])
  ].join('
');
}

function buildCadenceBriefMarkdown(brief) {
  return [
    '# AE Brain Command Site — Cadence Brief',
    '',
    `- Exported at: ${brief.exportedAt}`,
    '',
    '## Contact cadence counts',
    '',
    ...Object.entries(brief.touchCounts || {}).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## No-contact clients',
    '',
    ...(brief.noContactClients.length ? brief.noContactClients.map(item => `- ${item.clientName}: ${item.touch} · ${item.aeName || 'Unassigned'} · ${item.nextStep || 'No next step'}`) : ['- No no-contact clients surfaced.']),
    '',
    '## Recurring tasks',
    '',
    ...(brief.recurringTasks.length ? brief.recurringTasks.map(item => `- ${item.title}: ${item.cadence} · due ${item.dueDate || 'not set'} · ${item.clientName || 'No client'}`) : ['- No recurring tasks are active.']),
    '',
    '## Draft replies',
    '',
    ...(brief.draftThreads.length ? brief.draftThreads.map(item => `- ${item.subject}: ${item.clientName || 'No client'} · draft saved ${item.draftUpdatedAt || 'unknown time'}`) : ['- No draft replies are stored.'])
  ].join('
');
}

function buildDailyFocusBriefMarkdown(brief) {
  return [
    '# AE Brain Command Site — Daily Focus Brief',
    '',
    `- Exported at: ${brief.exportedAt}`,
    '',
    '## Milestone counts',
    '',
    ...Object.entries(brief.milestones.counts || {}).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Milestone queue',
    '',
    ...(brief.milestones.queue.length ? brief.milestones.queue.map(item => `- ${item.clientName}: ${item.label} · ${item.aeName || 'Unassigned'} · progress ${item.progress}%`) : ['- No milestone pressure currently surfaced.']),
    '',
    '## Task effort summary',
    '',
    `- Estimated minutes: ${brief.taskEffort.summary.estimated || 0}`,
    `- Actual minutes: ${brief.taskEffort.summary.actual || 0}`,
    `- Remaining minutes: ${brief.taskEffort.summary.remaining || 0}`,
    `- Overruns: ${brief.taskEffort.summary.overrun || 0}`,
    '',
    '## Task effort queue',
    '',
    ...(brief.taskEffort.queue.length ? brief.taskEffort.queue.map(item => `- ${item.title}: ${item.effort.label} · ${item.aeName || 'No AE'} · ${item.clientName || 'No client'}`) : ['- No effort queue items currently surfaced.']),
    '',
    '## Open thread questions',
    '',
    ...(brief.threadQuestions.queue.length ? brief.threadQuestions.queue.map(item => `- ${item.subject}: ${item.clientName || 'No client'} · ${item.openQuestions || 'No open question text'}`) : ['- No open thread questions are currently tracked.'])
  ].join('
');
}


function buildSnapshotPayload() {
  const snapshot = JSON.parse(exportState({
    ...state,
    restorePoints: [],
    workspacePresets: [],
    macroRuns: [],
    automationRuns: [],
    briefArchive: []
  }));
  snapshot.restorePoints = [];
  snapshot.workspacePresets = [];
  snapshot.macroRuns = [];
  snapshot.automationRuns = [];
  snapshot.briefArchive = [];
  return snapshot;
}

function summarizeSnapshotPayload(payload) {
  return {
    aeProfiles: Array.isArray(payload?.aeProfiles) ? payload.aeProfiles.length : 0,
    clients: Array.isArray(payload?.clients) ? payload.clients.length : 0,
    tasks: Array.isArray(payload?.tasks) ? payload.tasks.length : 0,
    threads: Array.isArray(payload?.threads) ? payload.threads.length : 0,
    messages: Array.isArray(payload?.messages) ? payload.messages.length : 0,
    auditRows: Array.isArray(payload?.auditLog) ? payload.auditLog.length : 0
  };
}

function saveRestorePoint(label = '', reason = 'manual') {
  const entry = {
    id: uid('restore'),
    label: String(label || '').trim() || 'Manual restore point',
    reason,
    createdAt: nowIso(),
    summary: summarizeSnapshotPayload(buildSnapshotPayload()),
    payload: buildSnapshotPayload()
  };
  state.restorePoints = Array.isArray(state.restorePoints) ? state.restorePoints : [];
  state.restorePoints.unshift(entry);
  state.restorePoints = state.restorePoints.slice(0, 18);
  state.auditLog.unshift({ id: uid('audit'), kind: 'restore-point-save', message: `${entry.label} saved`, at: nowIso() });
  persist();
  return entry;
}

function restoreFromPoint(entryId) {
  const entry = (state.restorePoints || []).find(item => item.id === entryId);
  if (!entry?.payload) return false;
  const preserved = {
    restorePoints: state.restorePoints || [],
    workspacePresets: state.workspacePresets || [],
    macroRuns: state.macroRuns || [],
    automationRules: state.automationRules || [],
    automationRuns: state.automationRuns || [],
    briefArchive: state.briefArchive || [],
    alertStates: state.alertStates || {},
    donorTemplate: donorTemplate
  };
  state = normalizeState({ ...entry.payload, ...preserved }, rosterSeed);
  donorTemplate = state.donorTemplate || donorTemplate;
  smokeReports = Array.isArray(state.smokeReports) ? state.smokeReports : smokeReports;
  state.automationRules = normalizeAutomationRules(state.automationRules);
  state.automationRuns = Array.isArray(state.automationRuns) ? state.automationRuns : [];
  state.restorePoints = Array.isArray(state.restorePoints) ? state.restorePoints : [];
  state.workspacePresets = Array.isArray(state.workspacePresets) ? state.workspacePresets : [];
  state.macroRuns = Array.isArray(state.macroRuns) ? state.macroRuns : [];
  state.auditLog.unshift({ id: uid('audit'), kind: 'restore-point-restore', message: `${entry.label} restored`, at: nowIso() });
  persist();
  renderNav();
  render();
  return true;
}

function deleteRestorePoint(entryId) {
  const before = (state.restorePoints || []).length;
  state.restorePoints = (state.restorePoints || []).filter(item => item.id !== entryId);
  if (state.restorePoints.length === before) return false;
  state.auditLog.unshift({ id: uid('audit'), kind: 'restore-point-delete', message: `Restore point deleted: ${entryId}`, at: nowIso() });
  persist();
  return true;
}

function exportRestorePoint(entryId, format = 'json') {
  const entry = (state.restorePoints || []).find(item => item.id === entryId);
  if (!entry) return;
  if (format === 'json') return download(`ae-restore-point-${entry.id}.json`, JSON.stringify(entry, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — Restore Point',
    '',
    `- Label: ${entry.label}`,
    `- Reason: ${entry.reason}`,
    `- Saved at: ${entry.createdAt}`,
    '',
    '## Summary',
    '',
    ...Object.entries(entry.summary || {}).map(([key, value]) => `- ${key}: ${value}`)
  ].join('\n');
  return download(`ae-restore-point-${entry.id}.md`, md, 'text/markdown');
}

function saveWorkspacePreset(label = '') {
  const name = String(label || '').trim() || `Workspace ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
  const entry = {
    id: uid('workspace'),
    label: name,
    createdAt: nowIso(),
    page,
    clientFilters: { ...clientFilters },
    taskFilters: { ...taskFilters },
    transcriptFilters: { ...transcriptFilters },
    auditFilters: { ...auditFilters },
    liveConsole: { aeId: liveConsole.aeId || '', clientId: liveConsole.clientId || '', threadId: liveConsole.threadId || '' }
  };
  state.workspacePresets = Array.isArray(state.workspacePresets) ? state.workspacePresets : [];
  state.workspacePresets.unshift(entry);
  state.workspacePresets = state.workspacePresets.slice(0, 18);
  state.auditLog.unshift({ id: uid('audit'), kind: 'workspace-save', message: `${entry.label} saved`, at: nowIso() });
  persist();
  return entry;
}

function loadWorkspacePreset(entryId) {
  const entry = (state.workspacePresets || []).find(item => item.id === entryId);
  if (!entry) return false;
  page = entry.page || 'dashboard';
  clientFilters = { ...clientFilters, ...(entry.clientFilters || {}) };
  taskFilters = { ...taskFilters, ...(entry.taskFilters || {}) };
  transcriptFilters = { ...transcriptFilters, ...(entry.transcriptFilters || {}) };
  auditFilters = { ...auditFilters, ...(entry.auditFilters || {}) };
  liveConsole = { ...liveConsole, ...(entry.liveConsole || {}) };
  state.auditLog.unshift({ id: uid('audit'), kind: 'workspace-load', message: `${entry.label} loaded`, at: nowIso() });
  persist();
  renderNav();
  render();
  return true;
}

function deleteWorkspacePreset(entryId) {
  const before = (state.workspacePresets || []).length;
  state.workspacePresets = (state.workspacePresets || []).filter(item => item.id !== entryId);
  if (state.workspacePresets.length === before) return false;
  state.auditLog.unshift({ id: uid('audit'), kind: 'workspace-delete', message: `Workspace deleted: ${entryId}`, at: nowIso() });
  persist();
  return true;
}

function hasOpenClientTask(clientId, titlePrefix = '') {
  return state.tasks.some(task => task.clientId === clientId && String(task.status || 'todo') !== 'done' && (!titlePrefix || String(task.title || '').startsWith(titlePrefix)));
}

function hasOpenThreadTask(threadId) {
  return state.tasks.some(task => task.threadId === threadId && String(task.status || 'todo') !== 'done');
}

function createContactNudgeTask(client, mode = 'contact-nudge') {
  if (!client) return null;
  const existing = state.tasks.find(task => task.clientId === client.id && String(task.status || 'todo') !== 'done' && String(task.title || '').startsWith('Contact nudge —'));
  if (existing) return existing;
  const task = applyTaskDraft({
    id: uid('task'),
    status: 'todo',
    templateKind: mode,
    createdAt: nowIso(),
    updatedAt: nowIso()
  }, {
    title: `Contact nudge — ${client.name}`,
    dueDate: getTodayIsoDate(),
    assignedAeId: client.assignedAeId || '',
    assignedAeName: client.assignedAeName || '',
    clientId: client.id,
    clientName: client.name,
    notes: client.nextStep ? `Re-establish contact and confirm next step.\n\nCurrent next step: ${client.nextStep}` : 'Re-establish contact and confirm next step.'
  }, 'create');
  state.tasks.unshift(task);
  logClientActivity(client, 'contact-nudge-task', 'Contact nudge task created', task.dueDate);
  state.auditLog.unshift({ id: uid('audit'), kind: 'contact-nudge-task', message: `Contact nudge task created for ${client.name}`, at: nowIso() });
  remoteUpsert('tasks', task);
  persist();
  return task;
}

function getAutomationRuleMatches(rule) {
  if (!rule?.enabled) return [];
  if (rule.kind === 'client-followup') {
    return getFollowupQueue(200)
      .filter(client => getClientDueState(client).status === 'overdue')
      .filter(client => !hasOpenClientTask(client.id, 'Follow up —'))
      .map(client => ({ id: client.id, type: 'client', title: client.name, detail: getClientDueState(client).label, entity: client }));
  }
  if (rule.kind === 'stale-thread') {
    return state.threads
      .map(thread => ({ thread, freshness: getThreadFreshness(thread), lag: getThreadResponseLag(thread) }))
      .filter(item => (item.freshness.status === 'stale' || item.lag.awaiting) && (item.thread.state || 'open') !== 'resolved')
      .filter(item => !hasOpenThreadTask(item.thread.id))
      .map(item => ({ id: item.thread.id, type: 'thread', title: item.thread.subject, detail: item.lag.awaiting ? item.lag.label : item.freshness.label, entity: item.thread }));
  }
  if (rule.kind === 'blocked-task') {
    return getBlockedTasks(200)
      .filter(task => task.clientId)
      .map(task => ({ id: task.id, type: 'task', title: task.title, detail: task.blockerNote || 'Blocked task', entity: task }));
  }
  if (rule.kind === 'cold-client') {
    return getNoContactClients(200)
      .filter(item => !hasOpenClientTask(item.client.id, 'Contact nudge —'))
      .map(item => ({ id: item.client.id, type: 'client', title: item.client.name, detail: item.touch.label, entity: item.client }));
  }
  return [];
}

function buildAutomationOverview() {
  return (state.automationRules || []).map(rule => ({
    ...rule,
    matches: getAutomationRuleMatches(rule)
  }));
}

function runAutomationRule(ruleId) {
  const rule = (state.automationRules || []).find(item => item.id === ruleId);
  if (!rule || !rule.enabled) return { ruleId, label: rule?.label || ruleId, actions: 0, matches: 0 };
  const matches = getAutomationRuleMatches(rule);
  let actions = 0;
  matches.forEach(match => {
    if (rule.kind === 'client-followup') {
      if (createFollowupTaskFromClient(match.entity, 'automation-followup')) actions += 1;
    }
    if (rule.kind === 'stale-thread') {
      if (createThreadResponseTask(match.entity.id, 'automation-stale-thread')) actions += 1;
    }
    if (rule.kind === 'blocked-task') {
      if (escalateBlockedTask(match.entity.id)) actions += 1;
    }
    if (rule.kind === 'cold-client') {
      if (createContactNudgeTask(match.entity, 'automation-contact-nudge')) actions += 1;
    }
  });
  const run = {
    id: uid('autorun'),
    ruleId: rule.id,
    label: rule.label,
    matches: matches.length,
    actions,
    ranAt: nowIso()
  };
  state.automationRuns = Array.isArray(state.automationRuns) ? state.automationRuns : [];
  state.automationRuns.unshift(run);
  state.automationRuns = state.automationRuns.slice(0, 40);
  state.auditLog.unshift({ id: uid('audit'), kind: 'automation-run', message: `${rule.label} ran with ${actions} action(s) from ${matches.length} match(es)`, at: nowIso() });
  persist();
  return run;
}

function runEnabledAutomations() {
  const runs = (state.automationRules || []).filter(rule => rule.enabled).map(rule => runAutomationRule(rule.id));
  return runs;
}

function buildAutomationDigest() {
  return {
    exportedAt: nowIso(),
    rules: buildAutomationOverview().map(rule => ({
      id: rule.id,
      label: rule.label,
      enabled: rule.enabled,
      severity: rule.severity,
      matches: rule.matches.length,
      sample: rule.matches.slice(0, 5).map(item => ({ id: item.id, type: item.type, title: item.title, detail: item.detail }))
    })),
    recentRuns: (state.automationRuns || []).slice(0, 12)
  };
}

function exportAutomationDigest(format = 'json') {
  const payload = buildAutomationDigest();
  if (format === 'json') return download('ae-automation-digest.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — Automation Digest',
    '',
    `- Exported at: ${payload.exportedAt}`,
    '',
    '## Rules',
    '',
    ...(payload.rules.length ? payload.rules.map(rule => `- ${rule.label}: ${rule.enabled ? 'enabled' : 'disabled'} · ${rule.matches} match(es) · ${rule.severity}`) : ['- No automation rules are configured.']),
    '',
    '## Recent runs',
    '',
    ...(payload.recentRuns.length ? payload.recentRuns.map(run => `- ${run.ranAt}: ${run.label} · ${run.actions} action(s) from ${run.matches} match(es)`) : ['- No automation runs have been logged.'])
  ].join('\n');
  return download('ae-automation-digest.md', md, 'text/markdown');
}

function getCommandMacroById(macroId) {
  return COMMAND_MACRO_LIBRARY.find(item => item.id === macroId) || null;
}

function runCommandMacro(macroId) {
  const macro = getCommandMacroById(macroId);
  if (!macro) return null;
  const result = { id: uid('macro'), macroId: macro.id, label: macro.label, ranAt: nowIso(), actions: [] };
  if (macro.actions.includes('snapshot')) {
    const restore = saveRestorePoint(`${macro.label} · pre-run`, 'macro');
    result.actions.push({ kind: 'snapshot', id: restore?.id || '', label: restore?.label || '' });
  }
  if (macro.actions.includes('automations')) {
    const runs = runEnabledAutomations();
    result.actions.push({ kind: 'automations', count: runs.reduce((sum, run) => sum + Number(run.actions || 0), 0), runs: runs.map(run => ({ ruleId: run.ruleId, actions: run.actions, matches: run.matches })) });
  }
  const briefActions = [
    ['ops-snapshot', 'ops-snapshot'],
    ['command-brief', 'command-brief'],
    ['sla-brief', 'sla-brief'],
    ['cadence-brief', 'cadence-brief'],
    ['daily-focus', 'daily-focus'],
    ['alert-digest', 'alert-digest']
  ];
  briefActions.forEach(([actionKey, briefKind]) => {
    if (macro.actions.includes(actionKey)) {
      const entry = saveBriefArchive(briefKind);
      result.actions.push({ kind: 'brief-archive', briefKind, archiveId: entry?.id || '' });
    }
  });
  if (macro.actions.includes('revenue-brief')) {
    result.actions.push({ kind: 'export-ready', briefKind: 'revenue-brief', rows: buildRevenueBrief().queue?.length || 0 });
  }
  if (macro.actions.includes('pipeline-brief')) {
    result.actions.push({ kind: 'export-ready', briefKind: 'pipeline-board', rows: buildPipelineBoardBrief().columns?.length || 0 });
  }
  if (macro.actions.includes('ownership-brief')) {
    result.actions.push({ kind: 'export-ready', briefKind: 'ae-ownership', rows: buildAeOwnershipBrief().rows?.length || 0 });
  }
  state.macroRuns = Array.isArray(state.macroRuns) ? state.macroRuns : [];
  state.macroRuns.unshift(result);
  state.macroRuns = state.macroRuns.slice(0, 30);
  state.auditLog.unshift({ id: uid('audit'), kind: 'macro-run', message: `${macro.label} executed`, at: nowIso() });
  persist();
  return result;
}

function renderAutomationCenterCard() {
  const rows = buildAutomationOverview();
  return `<div class="card"><div class="eyebrow">Automation center</div><h3>Rule-based internal actions for follow-ups, stale replies, blockers, and cold accounts</h3><div class="toolbar"><button class="btn-soft" id="run-all-automations">Run enabled rules</button><button class="btn-soft" id="export-automation-digest-json">Export JSON</button><button class="btn-soft" id="export-automation-digest-md">Export Markdown</button></div><div class="list">${rows.length ? rows.map(rule => `<div class="item"><div class="split"><div><h4>${escapeHtml(rule.label)}</h4><div class="meta">${escapeHtml(rule.description || '')}</div></div><div class="tag-row"><span class="tag">${rule.enabled ? 'enabled' : 'disabled'}</span><span class="tag">${rule.matches.length} match(es)</span><span class="tag">${escapeHtml(rule.severity || 'watch')}</span></div></div><div class="toolbar"><button class="btn-soft" data-act="toggle-automation-rule" data-id="${rule.id}">${rule.enabled ? 'Disable' : 'Enable'}</button><button class="btn-soft" data-act="run-automation-rule" data-id="${rule.id}">Run rule</button></div>${rule.matches.length ? `<div class="meta">Sample: ${escapeHtml(rule.matches.slice(0, 2).map(item => `${item.title} (${item.detail})`).join(' · '))}</div>` : '<div class="meta">No current matches.</div>'}</div>`).join('') : '<div class="item"><div class="meta">No automation rules available.</div></div>'}</div></div>`;
}

function renderCommandMacroCard() {
  const recent = (state.macroRuns || []).slice(0, 6);
  return `<div class="card"><div class="eyebrow">Command macros</div><h3>One-click grouped internal operations</h3><div class="list">${COMMAND_MACRO_LIBRARY.map(macro => `<div class="item"><h4>${escapeHtml(macro.label)}</h4><div class="meta">${escapeHtml(macro.description)}</div><div class="tag-row">${macro.actions.map(action => `<span class="tag">${escapeHtml(action)}</span>`).join('')}</div><div class="toolbar"><button class="btn-soft" data-act="run-command-macro" data-id="${macro.id}">Run macro</button></div></div>`).join('')}</div><div class="eyebrow" style="margin-top:16px">Recent macro runs</div><div class="list">${recent.length ? recent.map(run => `<div class="item"><h4>${escapeHtml(run.label)}</h4><div class="meta">${escapeHtml(run.ranAt)} · ${run.actions.length} action group(s)</div></div>`).join('') : '<div class="item"><div class="meta">No macro runs logged yet.</div></div>'}</div></div>`;
}

function renderWorkspacePresetCard() {
  const rows = state.workspacePresets || [];
  return `<div class="card"><div class="eyebrow">Workspace presets</div><h3>Save and reopen your current filters, page, and command focus</h3><div class="toolbar"><input id="workspace-label" placeholder="Preset name"><button class="btn-soft" id="save-workspace-preset">Save current workspace</button></div><div class="list">${rows.length ? rows.map(entry => `<div class="item"><h4>${escapeHtml(entry.label)}</h4><div class="meta">${escapeHtml(entry.page)} · saved ${escapeHtml(entry.createdAt)}</div><div class="toolbar"><button class="btn-soft" data-act="load-workspace-preset" data-id="${entry.id}">Load</button><button class="btn-soft danger" data-act="delete-workspace-preset" data-id="${entry.id}">Delete</button></div></div>`).join('') : '<div class="item"><div class="meta">No saved workspace presets yet.</div></div>'}</div></div>`;
}

function renderRestorePointCard() {
  const rows = state.restorePoints || [];
  return `<div class="card"><div class="eyebrow">Restore points</div><h3>Save internal rollback points and recover earlier command states</h3><div class="toolbar"><input id="restore-point-label" placeholder="Restore point label"><button class="btn-soft" id="save-restore-point">Save restore point</button></div><div class="list">${rows.length ? rows.map(entry => `<div class="item"><h4>${escapeHtml(entry.label)}</h4><div class="meta">${escapeHtml(entry.reason)} · ${escapeHtml(entry.createdAt)} · clients ${entry.summary?.clients || 0} · tasks ${entry.summary?.tasks || 0}</div><div class="toolbar"><button class="btn-soft" data-act="restore-point-restore" data-id="${entry.id}">Restore</button><button class="btn-soft" data-act="restore-point-export-json" data-id="${entry.id}">Export JSON</button><button class="btn-soft" data-act="restore-point-export-md" data-id="${entry.id}">Export Markdown</button><button class="btn-soft danger" data-act="restore-point-delete" data-id="${entry.id}">Delete</button></div></div>`).join('') : '<div class="item"><div class="meta">No restore points saved yet.</div></div>'}</div></div>`;
}

function getBriefDefinition(kind) {
  const defs = {
    'ops-snapshot': { label: 'Operational snapshot', filenameBase: 'ae-ops-snapshot', build: () => buildOperationalSnapshot(), markdown: payload => buildOperationalSnapshotMarkdown(payload) },
    'command-brief': { label: 'Command brief', filenameBase: 'ae-command-brief', build: () => buildCommandBrief(), markdown: payload => buildCommandBriefMarkdown(payload) },
    'sla-brief': { label: 'SLA brief', filenameBase: 'ae-sla-brief', build: () => buildSlaBrief(), markdown: payload => buildSlaBriefMarkdown(payload) },
    'ae-performance': { label: 'AE performance brief', filenameBase: 'ae-performance-brief', build: () => buildAePerformanceBrief(), markdown: payload => buildAePerformanceBriefMarkdown(payload) },
    'cadence-brief': { label: 'Cadence brief', filenameBase: 'ae-cadence-brief', build: () => buildCadenceBrief(), markdown: payload => buildCadenceBriefMarkdown(payload) },
    'daily-focus': { label: 'Daily focus brief', filenameBase: 'ae-daily-focus-brief', build: () => buildDailyFocusBrief(), markdown: payload => buildDailyFocusBriefMarkdown(payload) },
    'alert-digest': { label: 'Alert digest', filenameBase: 'ae-alert-digest', build: () => buildAlertDigest(), markdown: payload => [
      '# AE Brain Command Site — Alert Digest',
      '',
      `- Exported at: ${payload.exportedAt}`,
      `- Total alerts: ${payload.counts.total || 0}`,
      '',
      '## Active alerts',
      '',
      ...(payload.alerts.length ? payload.alerts.map(item => `- ${item.title}: ${item.kind} · ${item.severity} · ${item.detail}`) : ['- No active alerts are currently surfaced.'])
    ].join('\n') },
    'automation-digest': { label: 'Automation digest', filenameBase: 'ae-automation-digest', build: () => buildAutomationDigest(), markdown: payload => [
      '# AE Brain Command Site — Automation Digest',
      '',
      `- Exported at: ${payload.exportedAt}`,
      '',
      '## Rules',
      '',
      ...(payload.rules.length ? payload.rules.map(rule => `- ${rule.label}: ${rule.enabled ? 'enabled' : 'disabled'} · ${rule.matches} match(es) · ${rule.severity}`) : ['- No automation rules are configured.']),
      '',
      '## Recent runs',
      '',
      ...(payload.recentRuns.length ? payload.recentRuns.map(run => `- ${run.ranAt}: ${run.label} · ${run.actions} action(s) from ${run.matches} match(es)`) : ['- No automation runs have been logged.'])
    ].join('\n') }
  };
  return defs[kind] || null;
}

function saveBriefArchive(kind) {
  const definition = getBriefDefinition(kind);
  if (!definition) return null;
  const payload = definition.build();
  const markdown = definition.markdown(payload);
  const entry = {
    id: uid('brief'),
    kind,
    label: definition.label,
    filenameBase: definition.filenameBase,
    createdAt: nowIso(),
    payload,
    markdown
  };
  state.briefArchive = Array.isArray(state.briefArchive) ? state.briefArchive : [];
  state.briefArchive.unshift(entry);
  state.briefArchive = state.briefArchive.slice(0, 40);
  state.auditLog.unshift({ id: uid('audit'), kind: 'brief-archive', message: `${definition.label} archived`, at: nowIso() });
  persist();
  return entry;
}

function exportBriefArchiveEntry(entryId, format = 'json') {
  const entry = (state.briefArchive || []).find(item => item.id === entryId);
  if (!entry) return;
  if (format === 'json') return download(`${entry.filenameBase}.json`, JSON.stringify(entry.payload, null, 2), 'application/json');
  return download(`${entry.filenameBase}.md`, entry.markdown || '', 'text/markdown');
}

function deleteBriefArchiveEntry(entryId) {
  const entry = (state.briefArchive || []).find(item => item.id === entryId);
  state.briefArchive = (state.briefArchive || []).filter(item => item.id !== entryId);
  if (entry) state.auditLog.unshift({ id: uid('audit'), kind: 'brief-archive-delete', message: `${entry.label} removed from archive`, at: nowIso() });
  persist();
}

function renderAlertInboxCard() {
  const counts = getAlertInboxCounts();
  const alerts = getAlertInbox(12);
  return `<div class="card"><div class="eyebrow">Alert inbox</div><h3>Unified operational alerts</h3><div class="tag-row"><span class="tag">Total ${counts.total || 0}</span><span class="tag">Critical ${counts.critical || 0}</span><span class="tag">Clients ${counts.client || 0}</span><span class="tag">Threads ${counts.thread || 0}</span><span class="tag">Tasks ${counts.task || 0}</span></div><div class="toolbar"><button class="btn-soft" id="export-alert-digest-json">Export JSON</button><button class="btn-soft" id="export-alert-digest-md">Export Markdown</button></div><div class="list">${alerts.length ? alerts.map(item => `<div class="item"><h4>${escapeHtml(item.title)}</h4><div class="meta">${escapeHtml(item.kind)} · ${escapeHtml(item.severity)} · score ${item.score}</div><p>${escapeHtml(item.detail)}</p><div class="toolbar"><button class="btn-soft" data-act="alert-open-${item.actionKind}" data-id="${item.targetId}">Open</button><button class="btn-soft" data-act="alert-ack" data-key="${item.key}">Acknowledge</button><button class="btn-soft" data-act="alert-snooze-1" data-key="${item.key}">+1 day</button><button class="btn-soft" data-act="alert-snooze-7" data-key="${item.key}">+7 days</button></div></div>`).join('') : '<div class="item"><div class="meta">No active alerts are currently surfaced.</div></div>'}</div></div>`;
}

function renderBriefArchiveCard() {
  const archive = Array.isArray(state.briefArchive) ? state.briefArchive.slice(0, 8) : [];
  return `<div class="card"><div class="eyebrow">Brief archive</div><h3>Saved reporting history</h3><p>Store snapshots of the current command state so operator brief history does not disappear into one-off exports.</p><div class="toolbar"><button class="btn-soft" data-act="save-brief-archive" data-kind="daily-focus">Save daily focus</button><button class="btn-soft" data-act="save-brief-archive" data-kind="command-brief">Save command brief</button><button class="btn-soft" data-act="save-brief-archive" data-kind="ops-snapshot">Save ops snapshot</button><button class="btn-soft" data-act="save-brief-archive" data-kind="sla-brief">Save SLA brief</button></div><div class="toolbar"><button class="btn-soft" data-act="save-brief-archive" data-kind="ae-performance">Save performance</button><button class="btn-soft" data-act="save-brief-archive" data-kind="cadence-brief">Save cadence</button><button class="btn-soft" data-act="save-brief-archive" data-kind="alert-digest">Save alert digest</button></div><div class="list">${archive.length ? archive.map(entry => `<div class="item"><h4>${escapeHtml(entry.label)}</h4><div class="meta">${escapeHtml(entry.kind)} · ${escapeHtml(entry.createdAt || '')}</div><div class="toolbar"><button class="btn-soft" data-act="brief-export-json" data-id="${entry.id}">Export JSON</button><button class="btn-soft" data-act="brief-export-md" data-id="${entry.id}">Export Markdown</button><button class="btn-soft danger" data-act="brief-delete" data-id="${entry.id}">Delete</button></div></div>`).join('') : '<div class="item"><div class="meta">No archived briefs yet.</div></div>'}</div></div>`;
}

function getCombinedAuditRows(limit = 80) {
  const localRows = (state.auditLog || []).map(item => ({ id: item.id || uid('audit-row'), source: 'local', kind: item.kind || 'event', message: item.message || '', at: item.at || '' }));
  const remoteRows = (remoteAudit || []).map(item => ({ id: item.id || uid('audit-row'), source: 'remote', kind: item.kind || item.event_type || 'event', message: item.message || item.summary || '', at: item.at || item.created_at || '' }));
  return [...localRows, ...remoteRows].sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))).slice(0, limit);
}

function getFilteredAuditRows(limit = 80) {
  const query = String(auditFilters.query || '').trim().toLowerCase();
  return getCombinedAuditRows(limit).filter(row => {
    if (auditFilters.source && auditFilters.source !== 'all' && row.source !== auditFilters.source) return false;
    if (auditFilters.kind && row.kind !== auditFilters.kind) return false;
    if (query) {
      const hay = `${row.kind} ${row.message} ${row.source} ${row.at}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

function getAuditKinds() {
  return [...new Set(getCombinedAuditRows(200).map(row => row.kind).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function exportAuditDigest(format = 'json') {
  const payload = { exportedAt: nowIso(), filters: auditFilters, rows: getFilteredAuditRows(200) };
  if (format === 'json') return download('ae-audit-digest.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — Audit Digest',
    '',
    `- Exported at: ${payload.exportedAt}`,
    `- Source filter: ${payload.filters.source || 'all'}`,
    `- Kind filter: ${payload.filters.kind || 'all'}`,
    `- Query: ${payload.filters.query || 'none'}`,
    '',
    '## Audit rows',
    '',
    ...(payload.rows.length ? payload.rows.map(row => `- ${row.at || 'no time'} · ${row.source} · ${row.kind} · ${row.message}`) : ['- No audit rows match the current filters.'])
  ].join('
');
  return download('ae-audit-digest.md', md, 'text/markdown');
}

function renderAuditCommandCenter() {
  const rows = getFilteredAuditRows(40);
  const kindOptions = getAuditKinds().map(kind => `<option value="${escapeHtml(kind)}" ${auditFilters.kind === kind ? 'selected' : ''}>${escapeHtml(kind)}</option>`).join('');
  return `<section class="card"><div class="eyebrow">Audit command center</div><h3>Local + remote audit history</h3><div class="form-grid"><label><span>Search</span><input id="audit-search" value="${escapeHtml(auditFilters.query || '')}" placeholder="assignment, brief, thread, alert"></label><label><span>Source</span><select id="audit-source-filter"><option value="all" ${auditFilters.source === 'all' ? 'selected' : ''}>All</option><option value="local" ${auditFilters.source === 'local' ? 'selected' : ''}>Local</option><option value="remote" ${auditFilters.source === 'remote' ? 'selected' : ''}>Remote</option></select></label><label><span>Kind</span><select id="audit-kind-filter"><option value="" ${!auditFilters.kind ? 'selected' : ''}>All kinds</option>${kindOptions}</select></label></div><div class="toolbar"><button class="btn-soft" id="export-audit-digest-json">Export JSON</button><button class="btn-soft" id="export-audit-digest-md">Export Markdown</button><button class="btn-soft" id="reset-audit-filters">Reset filters</button></div><div class="list">${rows.length ? rows.map(row => `<div class="item"><h4>${escapeHtml(row.kind)}</h4><div class="meta">${escapeHtml(row.source)} · ${escapeHtml(row.at || 'no timestamp')}</div><p>${escapeHtml(row.message || 'No message')}</p></div>`).join('') : '<div class="item"><div class="meta">No audit rows match the current filters.</div></div>'}</div></section>`;
}



function bindInternalCommandOps() {
  $('#run-all-automations')?.addEventListener('click', () => {
    const runs = runEnabledAutomations();
    render();
    alert(`Automation run complete: ${runs.reduce((sum, run) => sum + Number(run.actions || 0), 0)} action(s).`);
  });
  $('#export-automation-digest-json')?.addEventListener('click', () => exportAutomationDigest('json'));
  $('#export-automation-digest-md')?.addEventListener('click', () => exportAutomationDigest('markdown'));
  document.querySelectorAll('[data-act="toggle-automation-rule"]').forEach(btn => btn.addEventListener('click', () => {
    const rule = (state.automationRules || []).find(item => item.id === btn.dataset.id);
    if (!rule) return;
    rule.enabled = !rule.enabled;
    state.auditLog.unshift({ id: uid('audit'), kind: 'automation-toggle', message: `${rule.label} ${rule.enabled ? 'enabled' : 'disabled'}`, at: nowIso() });
    persist();
    render();
  }));
  document.querySelectorAll('[data-act="run-automation-rule"]').forEach(btn => btn.addEventListener('click', () => {
    const run = runAutomationRule(btn.dataset.id);
    render();
    alert(`${run.label} completed with ${run.actions} action(s) from ${run.matches} match(es).`);
  }));
  document.querySelectorAll('[data-act="run-command-macro"]').forEach(btn => btn.addEventListener('click', () => {
    const run = runCommandMacro(btn.dataset.id);
    render();
    if (run) alert(`${run.label} executed.`);
  }));
  $('#save-workspace-preset')?.addEventListener('click', () => {
    const entry = saveWorkspacePreset($('#workspace-label')?.value || '');
    if ($('#workspace-label')) $('#workspace-label').value = '';
    render();
    if (entry) alert(`Workspace saved: ${entry.label}`);
  });
  document.querySelectorAll('[data-act="load-workspace-preset"]').forEach(btn => btn.addEventListener('click', () => loadWorkspacePreset(btn.dataset.id)));
  document.querySelectorAll('[data-act="delete-workspace-preset"]').forEach(btn => btn.addEventListener('click', () => {
    deleteWorkspacePreset(btn.dataset.id);
    render();
  }));
  $('#save-restore-point')?.addEventListener('click', () => {
    const entry = saveRestorePoint($('#restore-point-label')?.value || '', 'manual');
    if ($('#restore-point-label')) $('#restore-point-label').value = '';
    render();
    if (entry) alert(`Restore point saved: ${entry.label}`);
  });
  document.querySelectorAll('[data-act="restore-point-restore"]').forEach(btn => btn.addEventListener('click', () => {
    if (!confirm('Restore this internal state snapshot?')) return;
    restoreFromPoint(btn.dataset.id);
  }));
  document.querySelectorAll('[data-act="restore-point-delete"]').forEach(btn => btn.addEventListener('click', () => {
    deleteRestorePoint(btn.dataset.id);
    render();
  }));
  document.querySelectorAll('[data-act="restore-point-export-json"]').forEach(btn => btn.addEventListener('click', () => exportRestorePoint(btn.dataset.id, 'json')));
  document.querySelectorAll('[data-act="restore-point-export-md"]').forEach(btn => btn.addEventListener('click', () => exportRestorePoint(btn.dataset.id, 'markdown')));
}

function bindDashboard() {
  bindInternalCommandOps();
  document.querySelectorAll('[data-act="dashboard-open-client"]').forEach(btn => btn.addEventListener('click', () => {
    page = 'clients';
    renderNav();
    render();
    renderClientHistory(btn.dataset.id, true);
  }));
  document.querySelectorAll('[data-act="dashboard-open-task"]').forEach(btn => btn.addEventListener('click', () => {
    const task = state.tasks.find(item => item.id === btn.dataset.id);
    if (!task) return;
    page = 'tasks';
    renderNav();
    render();
    loadTaskIntoForm(task);
  }));
  document.querySelectorAll('[data-act="followup-snooze-1"]').forEach(btn => btn.addEventListener('click', () => {
    shiftClientFollowUp(btn.dataset.id, 1);
    render();
  }));
  document.querySelectorAll('[data-act="followup-snooze-7"]').forEach(btn => btn.addEventListener('click', () => {
    shiftClientFollowUp(btn.dataset.id, 7);
    render();
  }));
  document.querySelectorAll('[data-act="followup-complete"]').forEach(btn => btn.addEventListener('click', () => {
    completeClientFollowUp(btn.dataset.id);
    render();
  }));
  document.querySelectorAll('[data-act="followup-to-task"]').forEach(btn => btn.addEventListener('click', () => {
    const client = state.clients.find(item => item.id === btn.dataset.id);
    if (!client) return;
    createFollowupTaskFromClient(client, 'dashboard-followup');
    render();
  }));
  document.querySelectorAll('[data-act="risk-open-client"]').forEach(btn => btn.addEventListener('click', () => {
    page = 'clients';
    renderNav();
    render();
    renderClientHistory(btn.dataset.id, true);
  }));
  document.querySelectorAll('[data-act="risk-create-plan"]').forEach(btn => btn.addEventListener('click', () => {
    createClientActionPlan(btn.dataset.id, btn.dataset.plan || 'stabilize-7');
    render();
  }));
  document.querySelectorAll('[data-act="stale-open-thread"]').forEach(btn => btn.addEventListener('click', () => {
    page = 'transcripts';
    renderNav();
    render();
    openThread(btn.dataset.id);
  }));
  document.querySelectorAll('[data-act="awaiting-open-thread"]').forEach(btn => btn.addEventListener('click', () => {
    page = 'transcripts';
    renderNav();
    render();
    openThread(btn.dataset.id);
  }));
  document.querySelectorAll('[data-act="awaiting-playbook"]').forEach(btn => btn.addEventListener('click', () => {
    page = 'transcripts';
    renderNav();
    render();
    openThread(btn.dataset.id, 'executive-followup');
  }));
  document.querySelectorAll('[data-act="awaiting-response-task"]').forEach(btn => btn.addEventListener('click', () => {
    createThreadResponseTask(btn.dataset.id, 'dashboard-awaiting-response');
    render();
  }));
  document.querySelectorAll('[data-act="no-contact-open-client"]').forEach(btn => btn.addEventListener('click', () => {
    page = 'clients';
    renderNav();
    render();
    renderClientHistory(btn.dataset.id, true);
  }));
  document.querySelectorAll('[data-act="no-contact-task"]').forEach(btn => btn.addEventListener('click', () => {
    const client = state.clients.find(item => item.id === btn.dataset.id);
    if (!client) return;
    createFollowupTaskFromClient(client, 'dashboard-no-contact');
    render();
  }));
  document.querySelectorAll('[data-act="draft-open-thread"]').forEach(btn => btn.addEventListener('click', () => {
    page = 'transcripts';
    renderNav();
    render();
    openThread(btn.dataset.id);
  }));
  document.querySelectorAll('[data-act="draft-clear-thread"]').forEach(btn => btn.addEventListener('click', () => {
    clearThreadDraft(btn.dataset.id);
    render();
  }));
  document.querySelectorAll('[data-act="milestone-open-client"]').forEach(btn => btn.addEventListener('click', () => {
    page = 'clients';
    renderNav();
    render();
    renderClientHistory(btn.dataset.id, true);
  }));
  document.querySelectorAll('[data-act="milestone-progress"]').forEach(btn => btn.addEventListener('click', () => {
    advanceClientMilestone(btn.dataset.id, Number(btn.dataset.step || 25));
    render();
  }));
  document.querySelectorAll('[data-act="milestone-clear"]').forEach(btn => btn.addEventListener('click', () => {
    clearClientMilestone(btn.dataset.id);
    render();
  }));
  document.querySelectorAll('[data-act="task-add-effort"]').forEach(btn => btn.addEventListener('click', () => {
    addTaskActualMinutes(btn.dataset.id, Number(btn.dataset.minutes || 0));
    render();
  }));
  document.querySelectorAll('[data-act="open-question-thread"]').forEach(btn => btn.addEventListener('click', () => {
    page = 'transcripts';
    renderNav();
    render();
    openThread(btn.dataset.id);
  }));
  document.querySelectorAll('[data-act="open-question-task"]').forEach(btn => btn.addEventListener('click', () => {
    createThreadResponseTask(btn.dataset.id, 'dashboard-open-question');
    render();
  }));
  document.querySelectorAll('[data-act="open-question-clear"]').forEach(btn => btn.addEventListener('click', () => {
    clearThreadSummary(btn.dataset.id);
    render();
  }));
  document.querySelectorAll('[data-act="stale-playbook-followup"]').forEach(btn => btn.addEventListener('click', () => {
    page = 'transcripts';
    renderNav();
    render();
    openThread(btn.dataset.id, 'status-check');
  }));
  document.querySelectorAll('[data-act="stale-thread-task"]').forEach(btn => btn.addEventListener('click', () => {
    createThreadResponseTask(btn.dataset.id, 'dashboard-stale-thread');
    render();
  }));
  document.querySelectorAll('[data-act="stale-thread-resolve"]').forEach(btn => btn.addEventListener('click', () => {
    const thread = state.threads.find(item => item.id === btn.dataset.id);
    if (!thread) return;
    thread.state = 'resolved';
    thread.updatedAt = nowIso();
    remoteUpsert('threads', thread);
    persist();
    render();
  }));
  document.querySelectorAll('[data-act="workload-open-clients"]').forEach(btn => btn.addEventListener('click', () => {
    clientFilters.aeId = btn.dataset.id || '';
    page = 'clients';
    renderNav();
    render();
  }));
  document.querySelectorAll('[data-act="performance-open-clients"]').forEach(btn => btn.addEventListener('click', () => {
    clientFilters.aeId = btn.dataset.id || '';
    page = 'clients';
    renderNav();
    render();
  }));
  document.querySelectorAll('[data-act="workload-rebalance-ae"]').forEach(btn => btn.addEventListener('click', () => {
    const aeId = btn.dataset.id;
    let moved = 0;
    state.clients.filter(client => client.assignedAeId === aeId).forEach(client => {
      const match = autoAssignClient(state, { ...client, assignedAeId: '', assignedAeName: '' });
      if (match && match.id !== aeId) {
        assignClient(state, client.id, match.id, 'workload-rebalance');
        remoteUpsert('clients', client);
        if (client.assignmentHistory?.[0]) remoteUpsert('assignments', client.assignmentHistory[0]);
        moved += 1;
      }
    });
    if (!moved) return alert('No workload moves were available for that AE.');
    state.auditLog.unshift({ id: uid('audit'), kind: 'workload-rebalance', message: `Rebalanced ${moved} clients from ${aeId}`, at: nowIso() });
    persist();
    render();
  }));
  document.querySelectorAll('[data-act="task-snooze-1"]').forEach(btn => btn.addEventListener('click', () => {
    shiftTaskDueDate(btn.dataset.id, 1);
    render();
  }));
  document.querySelectorAll('[data-act="task-snooze-7"]').forEach(btn => btn.addEventListener('click', () => {
    shiftTaskDueDate(btn.dataset.id, 7);
    render();
  }));
  document.querySelectorAll('[data-act="task-complete"]').forEach(btn => btn.addEventListener('click', () => {
    completeTask(btn.dataset.id);
    render();
  }));
  document.querySelectorAll('[data-act="dependency-open-task"]').forEach(btn => btn.addEventListener('click', () => {
    const task = state.tasks.find(item => item.id === btn.dataset.id);
    if (!task) return;
    page = 'tasks';
    renderNav();
    render();
    loadTaskIntoForm(task);
  }));
  document.querySelectorAll('[data-act="dependency-resume-task"]').forEach(btn => btn.addEventListener('click', () => {
    const resumed = resumeTaskIfDependencyReady(btn.dataset.id);
    if (!resumed) return alert('The dependency is not finished yet.');
    render();
  }));
  $('#export-ops-snapshot-json')?.addEventListener('click', () => exportOperationalSnapshot('json'));
  $('#export-ops-snapshot-md')?.addEventListener('click', () => exportOperationalSnapshot('markdown'));
  $('#export-command-brief-json')?.addEventListener('click', () => exportCommandBrief('json'));
  $('#export-command-brief-md')?.addEventListener('click', () => exportCommandBrief('markdown'));
  $('#export-sla-brief-json')?.addEventListener('click', () => exportSlaBrief('json'));
  $('#export-sla-brief-md')?.addEventListener('click', () => exportSlaBrief('markdown'));
  $('#export-ae-performance-json')?.addEventListener('click', () => exportAePerformanceBrief('json'));
  $('#export-ae-performance-md')?.addEventListener('click', () => exportAePerformanceBrief('markdown'));
  $('#export-cadence-brief-json')?.addEventListener('click', () => exportCadenceBrief('json'));
  $('#export-cadence-brief-md')?.addEventListener('click', () => exportCadenceBrief('markdown'));
  $('#export-daily-focus-json')?.addEventListener('click', () => exportDailyFocusBrief('json'));
  $('#export-daily-focus-md')?.addEventListener('click', () => exportDailyFocusBrief('markdown'));
  $('#export-alert-digest-json')?.addEventListener('click', () => exportAlertDigest('json'));
  $('#export-alert-digest-md')?.addEventListener('click', () => exportAlertDigest('markdown'));
  $('#export-revenue-brief-json')?.addEventListener('click', () => exportRevenueBrief('json'));
  $('#export-revenue-brief-md')?.addEventListener('click', () => exportRevenueBrief('markdown'));
  $('#export-command-planner-json')?.addEventListener('click', () => exportCommandPlannerBrief('json'));
  $('#export-command-planner-md')?.addEventListener('click', () => exportCommandPlannerBrief('markdown'));
  $('#export-appointment-brief-json')?.addEventListener('click', () => exportAppointmentBridgeBrief('json'));
  $('#export-appointment-brief-md')?.addEventListener('click', () => exportAppointmentBridgeBrief('markdown'));
  $('#export-omega-brief-json')?.addEventListener('click', () => exportOmegaCommandBrief('json'));
  $('#export-omega-brief-md')?.addEventListener('click', () => exportOmegaCommandBrief('markdown'));
  $('#open-appointment-brain')?.addEventListener('click', () => { page = 'appointment-brain'; renderNav(); render(); });
  document.querySelectorAll('[data-act="open-appointment-page"]').forEach(btn => btn.addEventListener('click', () => { page = 'appointment-brain'; renderNav(); render(); }));
  document.querySelectorAll('[data-act="open-appointment-client"]').forEach(btn => btn.addEventListener('click', () => { page = 'clients'; renderNav(); render(); renderClientHistory(btn.dataset.id, true); }));
  document.querySelectorAll('[data-act="pipeline-open-client"]').forEach(btn => btn.addEventListener('click', () => { page = 'clients'; renderNav(); render(); renderClientHistory(btn.dataset.id, true); }));
  document.querySelectorAll('[data-act="pipeline-stage-back"]').forEach(btn => btn.addEventListener('click', () => { shiftClientStage(btn.dataset.id, -1, 'pipeline-board-back'); render(); }));
  document.querySelectorAll('[data-act="pipeline-stage-forward"]').forEach(btn => btn.addEventListener('click', () => { shiftClientStage(btn.dataset.id, 1, 'pipeline-board-forward'); render(); }));
  document.querySelectorAll('[data-act="rebalance-open-client"]').forEach(btn => btn.addEventListener('click', () => { page = 'clients'; renderNav(); render(); renderClientHistory(btn.dataset.id, true); }));
  document.querySelectorAll('[data-act="rebalance-apply-one"]').forEach(btn => btn.addEventListener('click', () => { const moved = applyRebalanceRecommendation(btn.dataset.id, btn.dataset.aeId, 'planner-single'); if (!moved) return alert('No rebalance move was applied.'); render(); }));
  document.querySelectorAll('[data-act="rebalance-apply-all"]').forEach(btn => btn.addEventListener('click', () => { const moved = applyRebalancePlan(12); if (!moved) return alert('No surfaced moves were available.'); render(); }));
  document.querySelectorAll('[data-act="calendar-open-client"]').forEach(btn => btn.addEventListener('click', () => { page = 'clients'; renderNav(); render(); renderClientHistory(btn.dataset.id, true); }));
  document.querySelectorAll('[data-act="calendar-open-task"]').forEach(btn => btn.addEventListener('click', () => { const task = state.tasks.find(item => item.id === btn.dataset.id); if (!task) return; page = 'tasks'; renderNav(); render(); loadTaskIntoForm(task); }));
  document.querySelectorAll('[data-act="calendar-open-ae"]').forEach(btn => btn.addEventListener('click', () => { page = 'ae-brains'; renderNav(); render(); }));
  document.querySelectorAll('[data-act="ownership-open-clients"]').forEach(btn => btn.addEventListener('click', () => { clientFilters.aeId = btn.dataset.id || ''; page = 'clients'; renderNav(); render(); }));
  $('#export-pipeline-brief-json')?.addEventListener('click', () => exportPipelineBoardBrief('json'));
  $('#export-pipeline-brief-md')?.addEventListener('click', () => exportPipelineBoardBrief('markdown'));
  $('#export-command-calendar-json')?.addEventListener('click', () => exportCommandCalendarBrief('json'));
  $('#export-command-calendar-md')?.addEventListener('click', () => exportCommandCalendarBrief('markdown'));
  $('#export-rebalance-brief-json')?.addEventListener('click', () => exportRebalancePlanBrief('json'));
  $('#export-rebalance-brief-md')?.addEventListener('click', () => exportRebalancePlanBrief('markdown'));
  $('#export-ownership-brief-json')?.addEventListener('click', () => exportAeOwnershipBrief('json'));
  $('#export-ownership-brief-md')?.addEventListener('click', () => exportAeOwnershipBrief('markdown'));
  document.querySelectorAll('[data-act="alert-open-client"]').forEach(btn => btn.addEventListener('click', () => { page = 'clients'; renderNav(); render(); renderClientHistory(btn.dataset.id, true); }));
  document.querySelectorAll('[data-act="alert-open-thread"]').forEach(btn => btn.addEventListener('click', () => { page = 'transcripts'; renderNav(); render(); openThread(btn.dataset.id); }));
  document.querySelectorAll('[data-act="alert-open-task"]').forEach(btn => btn.addEventListener('click', () => { const task = state.tasks.find(item => item.id === btn.dataset.id); if (!task) return; page = 'tasks'; renderNav(); render(); loadTaskIntoForm(task); }));
  document.querySelectorAll('[data-act="alert-ack"]').forEach(btn => btn.addEventListener('click', () => { updateAlertState(btn.dataset.key, { acknowledged: true, snoozeUntil: '' }); render(); }));
  document.querySelectorAll('[data-act="alert-snooze-1"]').forEach(btn => btn.addEventListener('click', () => { updateAlertState(btn.dataset.key, { acknowledged: false, snoozeUntil: new Date(Date.now() + 86400000).toISOString() }); render(); }));
  document.querySelectorAll('[data-act="alert-snooze-7"]').forEach(btn => btn.addEventListener('click', () => { updateAlertState(btn.dataset.key, { acknowledged: false, snoozeUntil: new Date(Date.now() + 604800000).toISOString() }); render(); }));
  document.querySelectorAll('[data-act="save-brief-archive"]').forEach(btn => btn.addEventListener('click', () => { saveBriefArchive(btn.dataset.kind); render(); }));
  document.querySelectorAll('[data-act="brief-export-json"]').forEach(btn => btn.addEventListener('click', () => exportBriefArchiveEntry(btn.dataset.id, 'json')));
  document.querySelectorAll('[data-act="brief-export-md"]').forEach(btn => btn.addEventListener('click', () => exportBriefArchiveEntry(btn.dataset.id, 'markdown')));
  document.querySelectorAll('[data-act="brief-delete"]').forEach(btn => btn.addEventListener('click', () => { deleteBriefArchiveEntry(btn.dataset.id); render(); }));
}

function buildOperationalSnapshot() {
  return {
    exportedAt: nowIso(),
    founderSession: { authenticated: founderSession.authenticated, email: founderSession.email, role: founderSession.role, mode: founderSession.mode },
    remote: { state: remoteStateStatus, liveBrain: liveBrainStatus, health: remoteHealth },
    aeRoster: state.aeProfiles.map(ae => ({
      id: ae.id,
      name: ae.name,
      enabled: ae.enabled !== false,
      assignments: ae.assignments || 0,
      dailyCap: ae.overrideDailyCap || ae.dailyCap || 0,
      monthlyCap: ae.overrideMonthlyCap || ae.monthlyCap || 0,
      capacityState: getAeCapacityState(ae),
      availability: getAeAvailabilityState(ae).label
    })),
    clients: {
      total: state.clients.length,
      stageCounts: getClientStageCounts(),
      priorityCounts: getClientPriorityCounts(),
      followupCounts: getFollowupCounts(),
      healthCounts: getClientHealthCounts(),
      touchCounts: getClientTouchCounts(),
      valueCounts: getRevenueSnapshot().byTier,
      queued: getFollowupQueue(12).map(client => ({ id: client.id, name: client.name, assignedAeName: client.assignedAeName || '', followUpDate: client.followUpDate || '', nextStep: client.nextStep || '' })),
      atRiskQueue: getAtRiskClients(12).map(item => ({ id: item.client.id, name: item.client.name, status: item.health.status, score: item.health.score, assignedAeName: item.client.assignedAeName || '', followUpDate: item.client.followUpDate || '' })),
      pipelineQueue: getPipelineQueue(12).map(item => ({ id: item.client.id, name: item.client.name, assignedAeName: item.client.assignedAeName || '', weightedValue: item.weightedValue, estimatedValue: getClientEstimatedValue(item.client), targetCloseDate: item.client.targetCloseDate || '' }))
    },
    tasks: {
      total: state.tasks.length,
      open: countOpenTasks(),
      dueCounts: getTaskDueCounts(),
      recurringOpen: getRecurringOpenTaskCount(),
      queued: getTaskQueue(12).map(task => ({ id: task.id, title: task.title, assignedAeName: task.assignedAeName || '', clientName: task.clientName || '', dueDate: task.dueDate || '', status: task.status || 'todo' })),
      recurringQueue: getRecurringTaskQueue(12).map(item => ({ id: item.task.id, title: item.task.title, cadence: item.recurrence.label, clientName: item.task.clientName || '', dueDate: item.task.dueDate || '' }))
    },
    transcripts: {
      threads: state.threads.length,
      messages: state.messages.length,
      draftCount: getThreadDraftQueue().length
    },
    revenue: buildRevenueBrief(),
    planner: buildCommandPlannerBrief(),
    auditRows: state.auditLog.length
  };
}

function exportOperationalSnapshot(format = 'json') {
  const snapshot = buildOperationalSnapshot();
  if (format === 'json') return download('ae-ops-snapshot.json', JSON.stringify(snapshot, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — Operational Snapshot',
    '',
    `- Exported at: ${snapshot.exportedAt}`,
    `- Founder session: ${snapshot.founderSession.authenticated ? 'signed in' : 'local only'} · ${snapshot.founderSession.email || 'no email'}`,
    `- Remote state: ${snapshot.remote.state}`,
    `- Live brain lane: ${snapshot.remote.liveBrain}`,
    '',
    '## Client counts',
    '',
    ...Object.entries(snapshot.clients.stageCounts || {}).map(([key, value]) => `- Stage ${key}: ${value}`),
    ...Object.entries(snapshot.clients.priorityCounts || {}).map(([key, value]) => `- Priority ${key}: ${value}`),
    ...Object.entries(snapshot.clients.followupCounts || {}).map(([key, value]) => `- Follow-up ${key}: ${value}`),
    ...Object.entries(snapshot.clients.healthCounts || {}).map(([key, value]) => `- Client health ${key}: ${value}`),
    ...Object.entries(snapshot.clients.touchCounts || {}).map(([key, value]) => `- Contact cadence ${key}: ${value}`),
    '',
    '## At-risk clients',
    '',
    ...(snapshot.clients.atRiskQueue?.length ? snapshot.clients.atRiskQueue.map(item => `- ${item.name}: ${item.status} · score ${item.score} · ${item.assignedAeName || 'Unassigned'} · ${item.followUpDate || 'no follow-up date'}`) : ['- No at-risk clients in the current snapshot.']),
    '',
    '## Task counts',
    '',
    `- Total tasks: ${snapshot.tasks.total}`,
    `- Open tasks: ${snapshot.tasks.open}`,
    ...Object.entries(snapshot.tasks.dueCounts || {}).map(([key, value]) => `- Task due ${key}: ${value}`),
    `- Recurring open tasks: ${snapshot.tasks.recurringOpen}`,
    `- Draft replies stored: ${snapshot.transcripts.draftCount}`,
    '',
    '## AE roster load',
    '',
    ...snapshot.aeRoster.map(ae => `- ${ae.name}: ${ae.capacityState} · assignments ${ae.assignments} · daily ${ae.dailyCap} · monthly ${ae.monthlyCap}`)
  ].join('\n');
  return download('ae-ops-snapshot.md', md, 'text/markdown');
}


function buildCommandBrief() {
  return {
    exportedAt: nowIso(),
    snapshot: buildOperationalSnapshot(),
    staleThreads: getStaleThreads(12).map(item => ({
      id: item.thread.id,
      subject: item.thread.subject,
      aeName: item.thread.aeName || '',
      clientName: item.thread.clientName || '',
      label: item.freshness.label,
      ageDays: item.freshness.ageDays
    })),
    workloadAlerts: getAeWorkloadAlerts(12).map(item => ({
      aeId: item.ae.id,
      aeName: item.ae.name,
      capacityState: item.capacityState,
      affectedCount: item.affectedCount,
      reason: item.reason
    })),
    recommendedActions: getAtRiskClients(12).map(item => ({
      clientId: item.client.id,
      clientName: item.client.name,
      health: item.health.label,
      actions: getClientRecommendedActions(item.client).map(action => action.label)
    }))
  };
}

function exportCommandBrief(format = 'json') {
  const brief = buildCommandBrief();
  if (format === 'json') return download('ae-command-brief.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — Command Brief',
    '',
    `- Exported at: ${brief.exportedAt}`,
    '',
    '## Stale threads',
    '',
    ...(brief.staleThreads.length ? brief.staleThreads.map(item => `- ${item.subject}: ${item.label} · ${item.clientName || 'No client'} · ${item.aeName || 'No AE'}`) : ['- No stale threads in the current brief.']),
    '',
    '## AE workload alerts',
    '',
    ...(brief.workloadAlerts.length ? brief.workloadAlerts.map(item => `- ${item.aeName}: ${item.reason} · ${item.affectedCount} affected clients`) : ['- No AE workload alerts in the current brief.']),
    '',
    '## Recommended client actions',
    '',
    ...(brief.recommendedActions.length ? brief.recommendedActions.map(item => `- ${item.clientName}: ${item.health} · ${item.actions.join(' | ') || 'No recommendations surfaced'}`) : ['- No client recommendations surfaced.'])
  ].join('\n');
  return download('ae-command-brief.md', md, 'text/markdown');
}

function buildCadenceBrief() {
  return {
    exportedAt: nowIso(),
    touchCounts: getClientTouchCounts(),
    noContactClients: getNoContactClients(12).map(item => ({
      clientId: item.client.id,
      clientName: item.client.name,
      company: item.client.company || '',
      aeName: item.client.assignedAeName || '',
      touch: item.touch.label,
      nextStep: item.client.nextStep || ''
    })),
    recurringTasks: getRecurringTaskQueue(12).map(item => ({
      taskId: item.task.id,
      title: item.task.title,
      clientName: item.task.clientName || '',
      aeName: item.task.assignedAeName || '',
      cadence: item.recurrence.label,
      dueDate: item.task.dueDate || ''
    })),
    draftThreads: getThreadDraftQueue(12).map(thread => ({
      threadId: thread.id,
      subject: thread.subject,
      clientName: thread.clientName || '',
      aeName: thread.aeName || '',
      draftUpdatedAt: thread.draftUpdatedAt || '',
      draftPreview: String(thread.draftReply || '').slice(0, 180)
    }))
  };
}

function exportCadenceBrief(format = 'json') {
  const brief = buildCadenceBrief();
  if (format === 'json') return download('ae-cadence-brief.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — Cadence Brief',
    '',
    `- Exported at: ${brief.exportedAt}`,
    '',
    '## Contact cadence counts',
    '',
    ...Object.entries(brief.touchCounts || {}).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## No-contact clients',
    '',
    ...(brief.noContactClients.length ? brief.noContactClients.map(item => `- ${item.clientName}: ${item.touch} · ${item.aeName || 'Unassigned'} · ${item.nextStep || 'No next step'}`) : ['- No no-contact clients surfaced.']),
    '',
    '## Recurring tasks',
    '',
    ...(brief.recurringTasks.length ? brief.recurringTasks.map(item => `- ${item.title}: ${item.cadence} · due ${item.dueDate || 'not set'} · ${item.clientName || 'No client'}`) : ['- No recurring tasks are active.']),
    '',
    '## Draft replies',
    '',
    ...(brief.draftThreads.length ? brief.draftThreads.map(item => `- ${item.subject}: ${item.clientName || 'No client'} · draft saved ${item.draftUpdatedAt || 'unknown time'}`) : ['- No draft replies are stored.'])
  ].join('\n');
  return download('ae-cadence-brief.md', md, 'text/markdown');
}

function buildDailyFocusBrief() {
  return {
    exportedAt: nowIso(),
    milestones: {
      counts: getMilestoneCounts(),
      queue: getMilestoneQueue(12).map(item => ({
        clientId: item.client.id,
        clientName: item.client.name,
        company: item.client.company || '',
        aeName: item.client.assignedAeName || '',
        milestone: item.milestone.milestone,
        status: item.milestone.status,
        label: item.milestone.label,
        progress: item.milestone.progress,
        dueDate: item.milestone.dueDate || ''
      }))
    },
    taskEffort: {
      summary: getTaskEffortSummary(),
      queue: getTaskEffortQueue(12).map(item => ({
        taskId: item.task.id,
        title: item.task.title,
        aeName: item.task.assignedAeName || '',
        clientName: item.task.clientName || '',
        dueDate: item.task.dueDate || '',
        effort: item.effort
      }))
    },
    threadQuestions: {
      counts: getThreadSummaryCounts(),
      queue: getOpenQuestionThreads(12).map(thread => ({
        threadId: thread.id,
        subject: thread.subject,
        aeName: thread.aeName || '',
        clientName: thread.clientName || '',
        openQuestions: thread.openQuestions || '',
        summaryNote: thread.summaryNote || '',
        summaryUpdatedAt: thread.summaryUpdatedAt || ''
      }))
    }
  };
}

function exportDailyFocusBrief(format = 'json') {
  const brief = buildDailyFocusBrief();
  if (format === 'json') return download('ae-daily-focus-brief.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — Daily Focus Brief',
    '',
    `- Exported at: ${brief.exportedAt}`,
    '',
    '## Milestone counts',
    '',
    ...Object.entries(brief.milestones.counts || {}).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Milestone queue',
    '',
    ...(brief.milestones.queue.length ? brief.milestones.queue.map(item => `- ${item.clientName}: ${item.label} · ${item.aeName || 'Unassigned'} · progress ${item.progress}%`) : ['- No milestone pressure currently surfaced.']),
    '',
    '## Task effort summary',
    '',
    `- Estimated minutes: ${brief.taskEffort.summary.estimated || 0}`,
    `- Actual minutes: ${brief.taskEffort.summary.actual || 0}`,
    `- Remaining minutes: ${brief.taskEffort.summary.remaining || 0}`,
    `- Overruns: ${brief.taskEffort.summary.overrun || 0}`,
    '',
    '## Task effort queue',
    '',
    ...(brief.taskEffort.queue.length ? brief.taskEffort.queue.map(item => `- ${item.title}: ${item.effort.label} · ${item.aeName || 'No AE'} · ${item.clientName || 'No client'}`) : ['- No effort queue items currently surfaced.']),
    '',
    '## Open thread questions',
    '',
    ...(brief.threadQuestions.queue.length ? brief.threadQuestions.queue.map(item => `- ${item.subject}: ${item.clientName || 'No client'} · ${item.openQuestions || 'No open question text'}`) : ['- No open thread questions are currently tracked.'])
  ].join('
');
  return download('ae-daily-focus-brief.md', md, 'text/markdown');
}

function bindView() {
  if (page === 'dashboard') bindDashboard();
  if (page === 'clients') bindClients();
  if (page === 'ae-brains') bindAeBrains();
  if (page === 'live-brain') bindLiveBrain();
  if (page === 'tasks') bindTasks();
  if (page === 'transcripts') bindTranscripts();
  if (page === 'access') bindAccess();
  if (page === 'appointment-brain') bindAppointmentBrain();
}

function render() {
  const meta = pageMeta[page];
  $('#page-title').textContent = meta.title;
  $('#page-subtitle').textContent = meta.subtitle;
  const view = $('#view');
  if (page === 'dashboard') view.innerHTML = renderDashboard();
  if (page === 'clients') view.innerHTML = renderClients();
  if (page === 'ae-brains') view.innerHTML = renderAeBrains();
  if (page === 'live-brain') view.innerHTML = renderLiveBrain();
  if (page === 'tasks') view.innerHTML = renderTasks();
  if (page === 'transcripts') view.innerHTML = renderTranscripts();
  if (page === 'directive') view.innerHTML = renderDirective();
  if (page === 'access') view.innerHTML = renderAccess();
  if (page === 'appointment-brain') view.innerHTML = renderAppointmentBrain();
  bindView();
}



function ensureAppointmentBridge() {
  if (!state.appointmentBridge || typeof state.appointmentBridge !== 'object') {
    state.appointmentBridge = { handoffs: [], appointments: [], exports: [], importedRuntime: {}, sequences: [], slotTemplates: [], fulfillmentTemplates: [], syncLog: [], syncJournal: [], depositLedger: [], settlementLedger: [], rescueRuns: [], fulfillmentPackets: [] };
  }
  state.appointmentBridge.handoffs = Array.isArray(state.appointmentBridge.handoffs) ? state.appointmentBridge.handoffs : [];
  state.appointmentBridge.appointments = Array.isArray(state.appointmentBridge.appointments) ? state.appointmentBridge.appointments : [];
  state.appointmentBridge.exports = Array.isArray(state.appointmentBridge.exports) ? state.appointmentBridge.exports : [];
  state.appointmentBridge.importedRuntime = state.appointmentBridge.importedRuntime && typeof state.appointmentBridge.importedRuntime === 'object' ? state.appointmentBridge.importedRuntime : {};
  state.appointmentBridge.sequences = Array.isArray(state.appointmentBridge.sequences) ? state.appointmentBridge.sequences : [];
  state.appointmentBridge.fulfillmentTemplates = Array.isArray(state.appointmentBridge.fulfillmentTemplates) ? state.appointmentBridge.fulfillmentTemplates : [];
  state.appointmentBridge.syncLog = Array.isArray(state.appointmentBridge.syncLog) ? state.appointmentBridge.syncLog : [];
  state.appointmentBridge.syncJournal = Array.isArray(state.appointmentBridge.syncJournal) ? state.appointmentBridge.syncJournal : [];
  state.appointmentBridge.depositLedger = Array.isArray(state.appointmentBridge.depositLedger) ? state.appointmentBridge.depositLedger : [];
  state.appointmentBridge.settlementLedger = Array.isArray(state.appointmentBridge.settlementLedger) ? state.appointmentBridge.settlementLedger : [];
  state.appointmentBridge.rescueRuns = Array.isArray(state.appointmentBridge.rescueRuns) ? state.appointmentBridge.rescueRuns : [];
  state.appointmentBridge.fulfillmentPackets = Array.isArray(state.appointmentBridge.fulfillmentPackets) ? state.appointmentBridge.fulfillmentPackets : [];
  state.appointmentBridge.slotTemplates = Array.isArray(state.appointmentBridge.slotTemplates) && state.appointmentBridge.slotTemplates.length ? state.appointmentBridge.slotTemplates : APPOINTMENT_SLOT_TEMPLATE_LIBRARY.map(item => ({ ...item }));
  state.appointmentBridge.fulfillmentTemplates = Array.isArray(state.appointmentBridge.fulfillmentTemplates) && state.appointmentBridge.fulfillmentTemplates.length ? state.appointmentBridge.fulfillmentTemplates : APPOINTMENT_FULFILLMENT_TEMPLATE_LIBRARY.map(item => ({ ...item, steps: (item.steps || []).map(step => ({ ...step })) }));
  return state.appointmentBridge;
}


async function loadAppointmentDonorRuntimeSeed() {
  const bridge = ensureAppointmentBridge();
  if (bridge.importedRuntime?.loaded) return bridge.importedRuntime;
  try {
    const response = await fetch('../AI-Appointment-Setter-Brain-v33/smoke/last_smoke_report.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    bridge.importedRuntime = {
      loaded: true,
      loadedAt: nowIso(),
      smoke: payload,
      runtimeStatus: payload?.status || payload?.summary?.status || 'unknown',
      checksPassed: Array.isArray(payload?.checks) ? payload.checks.filter(item => item?.pass).length : 0,
      checksTotal: Array.isArray(payload?.checks) ? payload.checks.length : 0
    };
    persist();
    if (page === 'dashboard' || page === 'appointment-brain') render();
  } catch (error) {
    bridge.importedRuntime = { loaded: false, loadedAt: nowIso(), error: String(error?.message || error || 'unknown') };
  }
  return bridge.importedRuntime;
}

function getAppointmentHandoffs() {
  return ensureAppointmentBridge().handoffs;
}

function getAppointmentRecords() {
  return ensureAppointmentBridge().appointments;
}

function getClientAppointmentHistory(clientId) {
  const bridge = ensureAppointmentBridge();
  const handoffs = bridge.handoffs.filter(item => item.clientId === clientId).sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  const appointments = bridge.appointments.filter(item => item.clientId === clientId).sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  return { handoffs, appointments };
}

function computeAppointmentNoShowRisk(entry) {
  const startAt = String(entry?.startAt || '').trim();
  const status = String(entry?.status || 'scheduled').toLowerCase();
  let score = 0;
  const reasons = [];
  if (status === 'no-show') {
    score += 100;
    reasons.push('Already marked no-show');
  }
  if (status === 'cancelled') {
    score += 35;
    reasons.push('Recently cancelled appointment');
  }
  if (status === 'scheduled') {
    const reminderState = String(entry?.reminderState || '').toLowerCase();
    if (reminderState === 'missing') {
      score += 30;
      reasons.push('Reminder not queued');
    }
    if (String(entry?.urgency || '').toLowerCase() === 'urgent') {
      score += 12;
      reasons.push('Urgent client lane');
    }
    if (String(entry?.qualificationStatus || '').toLowerCase() === 'new') {
      score += 8;
      reasons.push('Lead still fresh/unqualified');
    }
    if (startAt) {
      const hours = (new Date(startAt).getTime() - Date.now()) / 36e5;
      if (hours < 0) {
        score += 50;
        reasons.push('Scheduled time already passed');
      } else if (hours <= 24) {
        score += 20;
        reasons.push('Appointment within 24 hours');
      } else if (hours <= 72) {
        score += 8;
        reasons.push('Appointment within 72 hours');
      }
    }
  }
  const label = score >= 70 ? 'Critical risk' : score >= 35 ? 'Watch risk' : 'Healthy';
  const statusKey = score >= 70 ? 'critical' : score >= 35 ? 'watch' : 'healthy';
  return { score, label, status: statusKey, reasons };
}

function getAppointmentDeskSummary() {
  const bridge = ensureAppointmentBridge();
  const handoffs = bridge.handoffs;
  const appointments = bridge.appointments;
  const openHandoffs = handoffs.filter(item => !['returned','completed','booked'].includes(String(item.status || '').toLowerCase())).length;
  const qualified = handoffs.filter(item => String(item.qualificationStatus || '').toLowerCase() === 'qualified').length;
  const booked = appointments.filter(item => !['cancelled','completed'].includes(String(item.status || '').toLowerCase())).length;
  const reminders = appointments.filter(item => ['queued','sent'].includes(String(item.reminderState || '').toLowerCase())).length;
  const noShowRisk = appointments.filter(item => computeAppointmentNoShowRisk(item).status !== 'healthy').length;
  const returned = handoffs.filter(item => String(item.status || '').toLowerCase() === 'returned').length;
  const donor = bridge.importedRuntime || {};
  return {
    handoffs: handoffs.length,
    openHandoffs,
    qualified,
    booked,
    reminders,
    noShowRisk,
    returned,
    donorStatus: donor.runtimeStatus || (donor.loaded ? 'loaded' : 'not-loaded'),
    donorChecksPassed: Number(donor.checksPassed || 0),
    donorChecksTotal: Number(donor.checksTotal || 0)
  };
}

function getAppointmentLeadQueue(limit = 10) {
  return getAppointmentHandoffs()
    .filter(item => !['returned','completed','booked'].includes(String(item.status || '').toLowerCase()))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .slice(0, limit);
}

function getAppointmentBookingQueue(limit = 10) {
  return getAppointmentRecords()
    .map(item => ({ ...item, risk: computeAppointmentNoShowRisk(item) }))
    .sort((a, b) => Number(b.risk.score || 0) - Number(a.risk.score || 0) || String(a.startAt || '').localeCompare(String(b.startAt || '')))
    .slice(0, limit);
}

function getAppointmentReturnQueue(limit = 10) {
  return getAppointmentHandoffs()
    .filter(item => ['returned','booked'].includes(String(item.status || '').toLowerCase()))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .slice(0, limit);
}

function buildAppointmentPayloadFromClient(client, source = 'client-dossier') {
  const match = client?.assignedAeId ? state.aeProfiles.find(item => item.id === client.assignedAeId) : null;
  return {
    id: uid('handoff'),
    clientId: client.id,
    clientName: client.name,
    company: client.company || '',
    aeId: client.assignedAeId || '',
    aeName: client.assignedAeName || match?.name || '',
    stage: client.stage || 'intake',
    priority: client.priority || 'normal',
    serviceInterest: client.needs || client.clientType || 'appointment-setter',
    tags: [client.clientType || '', client.needs || '', getClientValueTier(client), 'ae-command'].filter(Boolean).join(', '),
    estimatedValue: getClientEstimatedValue(client),
    monthlyValue: getClientMonthlyValue(client),
    qualificationStatus: getClientCloseProbability(client) >= 60 ? 'qualified' : 'new',
    targetCloseDate: client.targetCloseDate || '',
    followUpDate: client.followUpDate || '',
    nextStep: client.nextStep || buildRecommendedNextStep(client),
    handoffNote: client.handoffNote || '',
    notes: client.notes || '',
    status: 'queued',
    source,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

function sendClientToAppointmentSetter(clientId, source = 'client-dossier') {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const bridge = ensureAppointmentBridge();
  const existing = bridge.handoffs.find(item => item.clientId === clientId && !['returned','completed'].includes(String(item.status || '').toLowerCase()));
  if (existing) {
    existing.updatedAt = nowIso();
    existing.status = String(existing.status || 'queued');
    existing.nextStep = client.nextStep || existing.nextStep;
    existing.notes = client.notes || existing.notes;
    logClientActivity(client, 'appointment-handoff-refresh', 'Appointment setter handoff refreshed', existing.nextStep || 'Updated handoff context');
    state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-handoff-refresh', message: `Refreshed appointment handoff for ${client.name}`, at: nowIso() });
    pushAppointmentSyncPacket('outbound', 'handoff-refresh', 'queued', `Refreshed appointment handoff for ${client.name}`, { clientId: client.id, clientName: client.name, aeId: existing.aeId, aeName: existing.aeName, source }, { nextStep: existing.nextStep, qualificationStatus: existing.qualificationStatus });
    persist();
    return existing;
  }
  const payload = buildAppointmentPayloadFromClient(client, source);
  bridge.handoffs.unshift(payload);
  client.lastAppointmentHandoffAt = payload.createdAt;
  client.appointmentSetterStatus = payload.status;
  client.updatedAt = nowIso();
  logClientActivity(client, 'appointment-handoff', 'Sent to appointment setter brain', payload.nextStep || 'Queued for qualification');
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-handoff', message: `Sent ${client.name} into appointment brain`, at: nowIso() });
  pushAppointmentSyncPacket('outbound', 'handoff', 'queued', `Sent ${client.name} into appointment brain`, { clientId: client.id, clientName: client.name, aeId: payload.aeId, aeName: payload.aeName, source }, { estimatedValue: payload.estimatedValue, followUpDate: payload.followUpDate, targetCloseDate: payload.targetCloseDate });
  remoteUpsert('clients', client);
  persist();
  return payload;
}

function bulkSendSelectedToAppointmentSetter() {
  const clients = getSelectedClients();
  if (!clients.length) return alert('Select at least one client first.');
  let count = 0;
  clients.forEach(client => { if (sendClientToAppointmentSetter(client.id, 'bulk-clients')) count += 1; });
  state.auditLog.unshift({ id: uid('audit'), kind: 'bulk-appointment-handoff', message: `Sent ${count} selected clients to appointment brain`, at: nowIso() });
  persist();
  render();
}

function createAppointmentFromHandoff(handoffId) {
  const bridge = ensureAppointmentBridge();
  const handoff = bridge.handoffs.find(item => item.id === handoffId);
  if (!handoff) return null;
  const client = state.clients.find(item => item.id === handoff.clientId);
  const appointment = {
    id: uid('appt'),
    handoffId: handoff.id,
    clientId: handoff.clientId,
    clientName: handoff.clientName,
    aeId: handoff.aeId,
    aeName: handoff.aeName,
    qualificationStatus: handoff.qualificationStatus || 'qualified',
    status: 'scheduled',
    reminderState: 'queued',
    urgency: handoff.priority || 'normal',
    estimatedValue: Number(handoff.estimatedValue || 0),
    depositValue: Math.round(Number(handoff.estimatedValue || 0) * 0.2),
    startAt: new Date(Date.now() + 86400000).toISOString(),
    timezone: 'America/Phoenix',
    notes: handoff.notes || '',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  bridge.appointments.unshift(appointment);
  enrollAppointmentSequence(handoff.id, 'show-up-defense');
  handoff.status = 'booked';
  handoff.updatedAt = nowIso();
  if (client) {
    client.appointmentSetterStatus = 'booked';
    client.followUpDate = isoDatePlusDays(getTodayIsoDate(), 1);
    client.updatedAt = nowIso();
    logClientActivity(client, 'appointment-booked', 'Appointment setter booked appointment', appointment.startAt);
    remoteUpsert('clients', client);
  }
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-booked', message: `Booked appointment for ${handoff.clientName}`, at: nowIso() });
  pushAppointmentSyncPacket('inbound', 'booking', 'booked', `Booked appointment for ${handoff.clientName}`, { clientId: appointment.clientId, clientName: appointment.clientName, appointmentId: appointment.id, aeId: appointment.aeId, aeName: appointment.aeName, source: 'appointment-brain' }, { startAt: appointment.startAt, qualificationStatus: appointment.qualificationStatus });
  persist();
  return appointment;
}

function setAppointmentStatus(appointmentId, status, note = '') {
  const bridge = ensureAppointmentBridge();
  const appointment = bridge.appointments.find(item => item.id === appointmentId);
  if (!appointment) return;
  appointment.status = status;
  appointment.updatedAt = nowIso();
  if (status === 'scheduled') appointment.reminderState = 'queued';
  if (status === 'completed') appointment.reminderState = 'sent';
  if (status === 'no-show' || status === 'cancelled') appointment.reminderState = 'missing';
  const client = state.clients.find(item => item.id === appointment.clientId);
  if (client) {
    client.appointmentSetterStatus = status;
    client.updatedAt = nowIso();
    if (status === 'no-show' || status === 'cancelled') client.followUpDate = isoDatePlusDays(getTodayIsoDate(), 1);
    if (status === 'completed') client.followUpDate = isoDatePlusDays(getTodayIsoDate(), 7);
    logClientActivity(client, 'appointment-status', `Appointment marked ${status}`, note || appointment.startAt || '');
    remoteUpsert('clients', client);
  }
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-status', message: `${appointment.clientName} appointment marked ${status}`, at: nowIso() });
  pushAppointmentSyncPacket('inbound', 'appointment-status', status, `${appointment.clientName} appointment marked ${status}`, { clientId: appointment.clientId, clientName: appointment.clientName, appointmentId: appointment.id, aeId: appointment.aeId, aeName: appointment.aeName, source: 'appointment-brain' }, { note: note || '', startAt: appointment.startAt });
  persist();
}

function returnAppointmentClientToAe(appointmentId, note = '') {
  const bridge = ensureAppointmentBridge();
  const appointment = bridge.appointments.find(item => item.id === appointmentId);
  if (!appointment) return;
  const handoff = bridge.handoffs.find(item => item.id === appointment.handoffId);
  if (handoff) {
    handoff.status = 'returned';
    handoff.returnNote = note || `Returned from appointment setter after ${appointment.status || 'scheduled'} status.`;
    handoff.updatedAt = nowIso();
  }
  const client = state.clients.find(item => item.id === appointment.clientId);
  if (client) {
    client.appointmentSetterStatus = 'returned';
    client.nextStep = note || client.nextStep || 'Review appointment outcome and decide next AE move.';
    client.followUpDate = isoDatePlusDays(getTodayIsoDate(), 1);
    client.updatedAt = nowIso();
    logClientActivity(client, 'appointment-return', 'Returned from appointment setter to AE command', client.nextStep);
    remoteUpsert('clients', client);
  }
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-return', message: `Returned ${appointment.clientName} from appointment brain to AE command`, at: nowIso() });
  pushAppointmentSyncPacket('inbound', 'return-to-ae', 'returned', `Returned ${appointment.clientName} from appointment brain to AE command`, { clientId: appointment.clientId, clientName: appointment.clientName, appointmentId: appointment.id, aeId: appointment.aeId, aeName: appointment.aeName, source: 'appointment-brain' }, { note: note || handoff?.returnNote || '' });
  persist();
}

function createAppointmentReminderTask(appointmentId) {
  const appointment = getAppointmentRecords().find(item => item.id === appointmentId);
  if (!appointment) return null;
  const client = state.clients.find(item => item.id === appointment.clientId);
  const existing = state.tasks.find(task => String(task.title || '').startsWith('Appointment reminder —') && task.clientId === appointment.clientId && String(task.status || '') !== 'done');
  if (existing) return existing;
  const task = applyTaskDraft({ id: uid('task'), createdAt: nowIso(), updatedAt: nowIso(), recurrenceSourceTaskId: '' }, {
    title: `Appointment reminder — ${appointment.clientName}`,
    dueDate: String(appointment.startAt || '').slice(0, 10) || getTodayIsoDate(),
    assignedAeId: appointment.aeId || client?.assignedAeId || '',
    assignedAeName: appointment.aeName || client?.assignedAeName || '',
    clientId: appointment.clientId || '',
    clientName: appointment.clientName || client?.name || '',
    notes: `Confirm appointment attendance, reminder delivery, and no-show risk mitigation for ${appointment.clientName}.`,
    status: 'todo',
    blockerNote: '',
    dependsOnTaskId: '',
    dependsOnTaskTitle: '',
    recurrenceCadence: 'none',
    estimatedMinutes: 15,
    actualMinutes: 0
  }, 'create');
  state.tasks.unshift(task);
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-reminder-task', message: `Created appointment reminder task for ${appointment.clientName}`, at: nowIso() });
  persist();
  return task;
}

function buildAppointmentBridgeBrief() {
  const summary = getAppointmentDeskSummary();
  return {
    generatedAt: nowIso(),
    summary,
    handoffs: getAppointmentLeadQueue(25),
    bookings: getAppointmentBookingQueue(25),
    returned: getAppointmentReturnQueue(25),
    donorRuntime: ensureAppointmentBridge().importedRuntime || {}
  };
}

function exportAppointmentBridgeBrief(format = 'json') {
  const payload = buildAppointmentBridgeBrief();
  ensureAppointmentBridge().exports.unshift({ id: uid('brief'), kind: 'appointment-bridge', createdAt: nowIso(), summary: payload.summary });
  persist();
  if (format === 'json') return download('ae-appointment-bridge-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# AE Command + Appointment Brain Brief',
    '',
    `Generated at: ${payload.generatedAt}`,
    '',
    `- Handoffs: ${payload.summary.handoffs}`,
    `- Open handoffs: ${payload.summary.openHandoffs}`,
    `- Qualified: ${payload.summary.qualified}`,
    `- Booked: ${payload.summary.booked}`,
    `- Reminders: ${payload.summary.reminders}`,
    `- No-show risk: ${payload.summary.noShowRisk}`,
    `- Returned to AE: ${payload.summary.returned}`,
    `- Donor runtime: ${payload.summary.donorStatus} (${payload.summary.donorChecksPassed}/${payload.summary.donorChecksTotal} checks)`,
    '',
    '## Handoffs',
    '',
    ...(payload.handoffs.length ? payload.handoffs.map(item => `- ${item.clientName} · ${item.company || 'No company'} · ${item.status} · ${item.qualificationStatus} · ${item.aeName || 'No AE'}`) : ['- No active handoffs.']),
    '',
    '## Bookings',
    '',
    ...(payload.bookings.length ? payload.bookings.map(item => `- ${item.clientName} · ${item.status} · ${item.risk.label} · ${String(item.startAt || '').slice(0,16)}`) : ['- No appointments in queue.']),
    '',
    '## Return queue',
    '',
    ...(payload.returned.length ? payload.returned.map(item => `- ${item.clientName} · ${item.status} · ${item.returnNote || item.nextStep || 'No note'}`) : ['- Nothing waiting to return to AE command.'])
  ].join('\n');
  return download('ae-appointment-bridge-brief.md', md, 'text/markdown');
}

function buildOmegaCommandBrief() {
  const appointment = buildAppointmentBridgeBrief();
  return {
    generatedAt: nowIso(),
    command: buildOpsSnapshot(),
    appointment,
    appointmentRevenue: buildAppointmentRevenueDeck(),
    appointmentCalendar: buildAppointmentCalendarDeck(),
    appointmentSettlement: buildAppointmentSettlementDeck(),
    appointmentFunnel: buildAppointmentFunnelDeck(),
    appointmentSync: buildAppointmentSyncDeck(),
    appointmentFulfillment: buildAppointmentFulfillmentDeck(),
    appointmentOrchestration: buildAppointmentOrchestrationDeck(),
    appointmentProfitability: buildAppointmentProfitabilityDeck(),
    revenue: buildRevenueBrief(),
    planner: buildCommandPlannerBrief()
  };
}

function exportOmegaCommandBrief(format = 'json') {
  const payload = buildOmegaCommandBrief();
  if (format === 'json') return download('ae-omega-command-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# 0megaPhase Combined Command Brief',
    '',
    `Generated at: ${payload.generatedAt}`,
    '',
    '## AE Command Snapshot',
    '',
    `- Clients: ${payload.command.summary.totalClients}`,
    `- Open tasks: ${payload.command.summary.openTasks}`,
    `- Open threads: ${payload.command.summary.openThreads}`,
    '',
    '## Appointment Brain Snapshot',
    '',
    `- Handoffs: ${payload.appointment.summary.handoffs}`,
    `- Booked: ${payload.appointment.summary.booked}`,
    `- Reminders: ${payload.appointment.summary.reminders}`,
    `- No-show risk: ${payload.appointment.summary.noShowRisk}`,
    `- Deposit collected: ${formatCurrency(payload.appointmentRevenue.summary.depositCollectedValue)}`,
    `- Open slots next 7 days: ${payload.appointmentCalendar.summary.totalOpenSlots}`,
    `- Settlements paid: ${payload.appointmentSettlement.summary.paid}`,
    `- Funnel conversion to paid: ${payload.appointmentFunnel.summary.handoffs ? Math.round((payload.appointmentFunnel.summary.settlementsPaid / payload.appointmentFunnel.summary.handoffs) * 100) : 0}%`,
    `- Sync packets queued: ${payload.appointmentSync.summary.queued}`,
    `- Fulfillment packets active: ${payload.appointmentFulfillment.summary.total}`,
    `- Orchestration backlog: ${payload.appointmentOrchestration.summary.syncBacklog}`,
    `- Net appointment position: ${formatCurrency(payload.appointmentProfitability.summary.netCollected)}`,
    '',
    '## Revenue Snapshot',
    '',
    `- Weighted pipeline: ${formatCurrency(payload.revenue.summary.weightedPipeline)}`,
    `- Total pipeline: ${formatCurrency(payload.revenue.summary.totalPipeline)}`,
    `- Monthly managed: ${formatCurrency(payload.revenue.summary.monthlyManaged)}`
  ].join('\n');
  return download('ae-omega-command-brief.md', md, 'text/markdown');
}



function pushAppointmentSyncPacket(direction = 'outbound', kind = 'handoff', status = 'queued', summary = '', refs = {}, payload = {}) {
  const bridge = ensureAppointmentBridge();
  const packet = {
    id: uid('appt-syncpkt'),
    direction,
    kind,
    status,
    summary: String(summary || '').trim() || `${kind} ${status}`,
    clientId: refs.clientId || '',
    clientName: refs.clientName || '',
    appointmentId: refs.appointmentId || '',
    aeId: refs.aeId || '',
    aeName: refs.aeName || '',
    source: refs.source || 'appointment-brain',
    retries: Number(refs.retries || 0),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    payloadSummary: payload && typeof payload === 'object' ? JSON.stringify(payload).slice(0, 320) : String(payload || '')
  };
  bridge.syncJournal.unshift(packet);
  bridge.syncJournal = bridge.syncJournal.slice(0, 160);
  return packet;
}

function getAppointmentSyncJournal(limit = 40) {
  return (ensureAppointmentBridge().syncJournal || [])
    .slice()
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .slice(0, limit);
}

function retryAppointmentSyncPacket(packetId) {
  const packet = (ensureAppointmentBridge().syncJournal || []).find(item => item.id === packetId);
  if (!packet) return null;
  packet.status = 'retried';
  packet.retries = Number(packet.retries || 0) + 1;
  packet.updatedAt = nowIso();
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-sync-retry', message: `Retried ${packet.kind} sync for ${packet.clientName || packet.clientId || 'unknown client'}`, at: nowIso() });
  persist();
  return packet;
}

function resolveAppointmentSyncPacket(packetId) {
  const packet = (ensureAppointmentBridge().syncJournal || []).find(item => item.id === packetId);
  if (!packet) return null;
  packet.status = 'resolved';
  packet.updatedAt = nowIso();
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-sync-resolve', message: `Resolved ${packet.kind} sync for ${packet.clientName || packet.clientId || 'unknown client'}`, at: nowIso() });
  persist();
  return packet;
}

function buildAppointmentSyncDeck() {
  const rows = getAppointmentSyncJournal(60);
  const summary = {
    total: rows.length,
    queued: rows.filter(item => String(item.status || '').toLowerCase() === 'queued').length,
    retried: rows.filter(item => String(item.status || '').toLowerCase() === 'retried').length,
    resolved: rows.filter(item => String(item.status || '').toLowerCase() === 'resolved').length,
    inbound: rows.filter(item => String(item.direction || '').toLowerCase() === 'inbound').length,
    outbound: rows.filter(item => String(item.direction || '').toLowerCase() === 'outbound').length
  };
  return { generatedAt: nowIso(), summary, rows };
}

function exportAppointmentSyncDeck(format = 'json') {
  const payload = buildAppointmentSyncDeck();
  ensureAppointmentBridge().exports.unshift({ id: uid('brief'), kind: 'appointment-sync', createdAt: nowIso(), summary: payload.summary });
  persist();
  if (format === 'json') return download('ae-appointment-sync-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# Appointment Sync Brief',
    '',
    `Generated at: ${payload.generatedAt}`,
    '',
    `- Total packets: ${payload.summary.total}`,
    `- Queued: ${payload.summary.queued}`,
    `- Retried: ${payload.summary.retried}`,
    `- Resolved: ${payload.summary.resolved}`,
    `- Inbound: ${payload.summary.inbound}`,
    `- Outbound: ${payload.summary.outbound}`,
    '',
    '## Recent packets',
    '',
    ...(payload.rows.length ? payload.rows.map(item => `- ${item.clientName || item.clientId || 'Unknown'} · ${item.direction} · ${item.kind} · ${item.status} · ${item.summary}`) : ['- No sync packets logged yet.'])
  ].join('\n');
  return download('ae-appointment-sync-brief.md', md, 'text/markdown');
}

function renderAppointmentSyncCard() {
  const payload = buildAppointmentSyncDeck();
  const rows = payload.rows.slice(0, 8);
  return `<div class="card"><div class="eyebrow">Bridge sync journal</div><h3>Inbound/outbound packet log with retry and resolve controls</h3><div class="tag-row"><span class="tag">Total ${payload.summary.total}</span><span class="tag">Queued ${payload.summary.queued}</span><span class="tag">Retried ${payload.summary.retried}</span><span class="tag">Resolved ${payload.summary.resolved}</span></div><div class="list">${rows.length ? rows.map(item => `<div class="item"><h4>${escapeHtml(item.clientName || item.clientId || 'Unknown packet')}</h4><div class="meta">${escapeHtml(item.direction)} · ${escapeHtml(item.kind)} · ${escapeHtml(item.status)} · ${escapeHtml(item.updatedAt || item.createdAt || '')}</div><p>${escapeHtml(item.summary || 'No summary recorded.')}</p><div class="toolbar"><button class="btn-soft" data-act="appointment-sync-open-client" data-id="${item.clientId}">Open client</button><button class="btn-soft" data-act="appointment-sync-retry" data-id="${item.id}">Retry</button><button class="btn-soft" data-act="appointment-sync-resolve" data-id="${item.id}">Resolve</button></div></div>`).join('') : '<div class="item"><div class="meta">No sync packets have been logged yet.</div></div>'}</div><div class="toolbar"><button class="btn-soft" id="export-appointment-sync-json">Export JSON</button><button class="btn-soft" id="export-appointment-sync-md">Export Markdown</button></div></div>`;
}

function findAppointmentFulfillmentPacket(appointmentId) {
  return (ensureAppointmentBridge().fulfillmentPackets || []).find(item => item.appointmentId === appointmentId) || null;
}

function createAppointmentFulfillmentPacket(appointmentId, source = 'appointment-brain') {
  const appointment = getAppointmentRecords().find(item => item.id === appointmentId);
  if (!appointment) return null;
  const client = state.clients.find(item => item.id === appointment.clientId) || {};
  let packet = findAppointmentFulfillmentPacket(appointmentId);
  if (!packet) {
    packet = {
      id: uid('fulfillment'),
      appointmentId,
      clientId: appointment.clientId,
      clientName: appointment.clientName,
      aeId: appointment.aeId || client.assignedAeId || '',
      aeName: appointment.aeName || client.assignedAeName || '',
      status: 'queued',
      dueDate: isoDatePlusDays(getTodayIsoDate(), 2),
      owner: appointment.aeName || client.assignedAeName || 'Founder Desk',
      note: 'Fulfillment packet opened from appointment close-pack lane.',
      source,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    ensureAppointmentBridge().fulfillmentPackets.unshift(packet);
  } else {
    packet.updatedAt = nowIso();
    packet.note = packet.note || 'Fulfillment packet refreshed.';
  }
  if (client?.id) {
    client.nextStep = client.nextStep || 'Move this client through fulfillment and closeout.';
    client.updatedAt = nowIso();
    logClientActivity(client, 'appointment-fulfillment-packet', 'Created fulfillment packet from appointment lane', packet.dueDate);
    remoteUpsert('clients', client);
  }
  pushAppointmentSyncPacket('outbound', 'fulfillment-packet', 'queued', `Fulfillment packet opened for ${appointment.clientName}`, { clientId: appointment.clientId, clientName: appointment.clientName, appointmentId, aeId: packet.aeId, aeName: packet.aeName, source }, { dueDate: packet.dueDate, owner: packet.owner, status: packet.status });
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-fulfillment-packet', message: `Created fulfillment packet for ${appointment.clientName}`, at: nowIso() });
  persist();
  return packet;
}

function setAppointmentFulfillmentStatus(packetId, status = 'in-progress') {
  const packet = (ensureAppointmentBridge().fulfillmentPackets || []).find(item => item.id === packetId);
  if (!packet) return null;
  packet.status = status;
  packet.updatedAt = nowIso();
  const client = state.clients.find(item => item.id === packet.clientId);
  if (client) {
    client.updatedAt = nowIso();
    if (status === 'completed') {
      client.nextStep = 'Fulfillment completed. Archive delivery proof and mark the account fully closed.';
    } else if (status === 'in-progress') {
      client.nextStep = 'Fulfillment in progress. Protect delivery timing and close-out.';
    } else if (status === 'blocked') {
      client.nextStep = 'Fulfillment blocked. Review dependencies and unblock delivery.';
    }
    logClientActivity(client, 'appointment-fulfillment-status', `Fulfillment marked ${status}`, packet.dueDate || '');
    remoteUpsert('clients', client);
  }
  pushAppointmentSyncPacket('inbound', 'fulfillment-status', status, `Fulfillment ${status} for ${packet.clientName}`, { clientId: packet.clientId, clientName: packet.clientName, appointmentId: packet.appointmentId, aeId: packet.aeId, aeName: packet.aeName, source: 'appointment-brain' }, { dueDate: packet.dueDate, owner: packet.owner });
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-fulfillment-status', message: `${packet.clientName} fulfillment marked ${status}`, at: nowIso() });
  persist();
  return packet;
}

function buildAppointmentFulfillmentDeck() {
  const rows = (ensureAppointmentBridge().fulfillmentPackets || []).slice().sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  const summary = {
    total: rows.length,
    queued: rows.filter(item => String(item.status || '').toLowerCase() === 'queued').length,
    inProgress: rows.filter(item => String(item.status || '').toLowerCase() === 'in-progress').length,
    blocked: rows.filter(item => String(item.status || '').toLowerCase() === 'blocked').length,
    completed: rows.filter(item => String(item.status || '').toLowerCase() === 'completed').length
  };
  return { generatedAt: nowIso(), summary, rows: rows.slice(0, 40) };
}

function exportAppointmentFulfillmentDeck(format = 'json') {
  const payload = buildAppointmentFulfillmentDeck();
  ensureAppointmentBridge().exports.unshift({ id: uid('brief'), kind: 'appointment-fulfillment', createdAt: nowIso(), summary: payload.summary });
  persist();
  if (format === 'json') return download('ae-appointment-fulfillment-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# Appointment Fulfillment Brief',
    '',
    `Generated at: ${payload.generatedAt}`,
    '',
    `- Total packets: ${payload.summary.total}`,
    `- Queued: ${payload.summary.queued}`,
    `- In progress: ${payload.summary.inProgress}`,
    `- Blocked: ${payload.summary.blocked}`,
    `- Completed: ${payload.summary.completed}`,
    '',
    '## Fulfillment packets',
    '',
    ...(payload.rows.length ? payload.rows.map(item => `- ${item.clientName} · ${item.status} · due ${item.dueDate || 'not set'} · owner ${item.owner || 'Founder Desk'}`) : ['- No fulfillment packets opened yet.'])
  ].join('\n');
  return download('ae-appointment-fulfillment-brief.md', md, 'text/markdown');
}


function getAppointmentFulfillmentTemplates() {
  return ensureAppointmentBridge().fulfillmentTemplates || [];
}

function createFulfillmentTaskFromTemplateStep(packet, step, templateId, index) {
  const stepId = `${templateId}-${index + 1}`;
  const existing = state.tasks.find(task => task.sourcePacketId === packet.id && task.templateStepId === stepId && String(task.status || '').toLowerCase() !== 'done');
  if (existing) return existing;
  const dueDate = isoDatePlusDays(packet.dueDate || getTodayIsoDate(), Math.max(Number(step.offsetDays || 0), 0));
  const task = applyTaskDraft({ id: uid('task'), createdAt: nowIso(), updatedAt: nowIso(), recurrenceSourceTaskId: '' }, {
    title: `Fulfillment — ${step.label} — ${packet.clientName}`,
    dueDate,
    assignedAeId: packet.ownerId || packet.aeId || '',
    assignedAeName: packet.owner || packet.aeName || '',
    clientId: packet.clientId || '',
    clientName: packet.clientName || '',
    notes: step.note || `Fulfillment step ${step.label} for ${packet.clientName}.`,
    status: 'todo',
    blockerNote: '',
    dependsOnTaskId: '',
    dependsOnTaskTitle: '',
    recurrenceCadence: 'none',
    estimatedMinutes: Number(step.minutes || 15),
    actualMinutes: 0
  }, 'create');
  task.sourcePacketId = packet.id;
  task.templateStepId = stepId;
  task.templateId = templateId;
  state.tasks.unshift(task);
  return task;
}

function applyAppointmentFulfillmentTemplate(packetId, templateId = 'service-launch') {
  const bridge = ensureAppointmentBridge();
  const packet = bridge.fulfillmentPackets.find(item => item.id === packetId);
  if (!packet) return null;
  const template = getAppointmentFulfillmentTemplates().find(item => item.id === templateId) || APPOINTMENT_FULFILLMENT_TEMPLATE_LIBRARY[0];
  if (!template) return null;
  const existingChecklist = Array.isArray(packet.checklist) ? packet.checklist : [];
  packet.templateId = template.id;
  packet.templateLabel = template.label;
  packet.updatedAt = nowIso();
  packet.checklist = (template.steps || []).map((step, index) => {
    const existing = existingChecklist.find(item => item.id === `${template.id}-${index + 1}`) || {};
    const entry = {
      id: `${template.id}-${index + 1}`,
      label: step.label,
      note: step.note || '',
      offsetDays: Number(step.offsetDays || 0),
      minutes: Number(step.minutes || 0),
      done: Boolean(existing.done),
      linkedTaskId: existing.linkedTaskId || ''
    };
    const task = createFulfillmentTaskFromTemplateStep(packet, step, template.id, index);
    entry.linkedTaskId = task?.id || entry.linkedTaskId || '';
    return entry;
  });
  const client = state.clients.find(item => item.id === packet.clientId);
  if (client) {
    logClientActivity(client, 'appointment-fulfillment-template', 'Applied fulfillment template', template.label);
    client.updatedAt = nowIso();
    remoteUpsert('clients', client);
  }
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-fulfillment-template', message: `Applied ${template.label} to ${packet.clientName}`, at: nowIso() });
  pushAppointmentSyncPacket('outbound', 'fulfillment-template', 'queued', `Applied fulfillment template for ${packet.clientName}`, { clientId: packet.clientId, clientName: packet.clientName, appointmentId: packet.appointmentId || '', aeId: packet.aeId || '', aeName: packet.owner || packet.aeName || '', source: 'appointment-brain' }, { templateId: template.id, checklistCount: packet.checklist.length });
  persist();
  return packet;
}

function getAppointmentProfitabilityRows() {
  return getAppointmentRecords().map(appointment => {
    const deposit = findAppointmentDeposit(appointment.id) || {};
    const settlement = findAppointmentSettlement(appointment.id) || {};
    const packet = findAppointmentFulfillmentPacket(appointment.id) || {};
    const relatedTasks = state.tasks.filter(task => task.sourcePacketId === packet.id || (task.clientId === appointment.clientId && String(task.title || '').startsWith('Fulfillment —')));
    const actualMinutes = relatedTasks.reduce((sum, task) => sum + Number(task.actualMinutes || 0), 0);
    const estimatedMinutes = relatedTasks.reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0) || (Array.isArray(packet.checklist) ? packet.checklist.reduce((sum, item) => sum + Number(item.minutes || 0), 0) : 0);
    const workingMinutes = Math.max(actualMinutes, estimatedMinutes);
    const deliveryCost = Math.round(workingMinutes * 250);
    const bookedValue = Math.max(Number(appointment.estimatedValue || 0), Number(settlement.amount || 0) + Number(deposit.amount || 0));
    const collected = (String(deposit.status || '').toLowerCase() === 'paid' ? Number(deposit.amount || 0) : 0) + (String(settlement.status || '').toLowerCase() === 'paid' ? Number(settlement.amount || 0) : 0);
    const outstanding = Math.max(bookedValue - collected, 0);
    const net = collected - deliveryCost;
    return {
      appointmentId: appointment.id,
      clientId: appointment.clientId,
      clientName: appointment.clientName,
      aeName: appointment.aeName || '',
      bookedValue,
      collected,
      outstanding,
      deliveryCost,
      net,
      fulfillmentStatus: packet.status || 'not-opened',
      templateLabel: packet.templateLabel || '',
      workingMinutes,
      startAt: appointment.startAt || ''
    };
  }).sort((a, b) => Number(b.net || 0) - Number(a.net || 0) || Number(b.collected || 0) - Number(a.collected || 0));
}

function buildAppointmentProfitabilityDeck() {
  const rows = getAppointmentProfitabilityRows();
  const summary = {
    total: rows.length,
    bookedValue: rows.reduce((sum, item) => sum + Number(item.bookedValue || 0), 0),
    collected: rows.reduce((sum, item) => sum + Number(item.collected || 0), 0),
    outstanding: rows.reduce((sum, item) => sum + Number(item.outstanding || 0), 0),
    deliveryCost: rows.reduce((sum, item) => sum + Number(item.deliveryCost || 0), 0),
    netCollected: rows.reduce((sum, item) => sum + Number(item.net || 0), 0),
    templateApplied: rows.filter(item => item.templateLabel).length,
    marginWatch: rows.filter(item => Number(item.net || 0) < 0).length
  };
  return { generatedAt: nowIso(), summary, rows: rows.slice(0, 40) };
}

function exportAppointmentProfitabilityDeck(format = 'json') {
  const payload = buildAppointmentProfitabilityDeck();
  ensureAppointmentBridge().exports.unshift({ id: uid('brief'), kind: 'appointment-profitability', createdAt: nowIso(), summary: payload.summary });
  persist();
  if (format === 'json') return download('ae-appointment-profitability-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# Appointment Profitability Brief',
    '',
    `Generated at: ${payload.generatedAt}`,
    '',
    `- Total rows: ${payload.summary.total}`,
    `- Booked value: ${formatCurrency(payload.summary.bookedValue)}`,
    `- Collected: ${formatCurrency(payload.summary.collected)}`,
    `- Outstanding: ${formatCurrency(payload.summary.outstanding)}`,
    `- Delivery cost: ${formatCurrency(payload.summary.deliveryCost)}`,
    `- Net collected: ${formatCurrency(payload.summary.netCollected)}`,
    `- Template applied: ${payload.summary.templateApplied}`,
    `- Margin watch: ${payload.summary.marginWatch}`,
    '',
    '## Profitability rows',
    '',
    ...(payload.rows.length ? payload.rows.map(item => `- ${item.clientName} · collected ${formatCurrency(item.collected)} · delivery ${formatCurrency(item.deliveryCost)} · net ${formatCurrency(item.net)} · template ${item.templateLabel || 'none'}`) : ['- No appointment profitability rows yet.'])
  ].join('
');
  return download('ae-appointment-profitability-brief.md', md, 'text/markdown');
}

function getAppointmentStuckSyncPackets(limit = 20) {
  return getAppointmentSyncJournal(limit * 3).map(packet => {
    const ageHours = (Date.now() - new Date(packet.createdAt || packet.updatedAt || Date.now()).getTime()) / 36e5;
    return { ...packet, ageHours };
  }).filter(packet => ['queued', 'retry'].includes(String(packet.status || '').toLowerCase()) || Number(packet.ageHours || 0) > 24).sort((a, b) => Number(b.ageHours || 0) - Number(a.ageHours || 0)).slice(0, limit);
}

function retryAllAppointmentSyncPackets() {
  let count = 0;
  getAppointmentStuckSyncPackets(100).forEach(packet => { retryAppointmentSyncPacket(packet.id); count += 1; });
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-sync-retry-all', message: `Retried ${count} appointment sync packet(s)`, at: nowIso() });
  persist();
  return count;
}

function resolveReadyAppointmentSyncPackets() {
  let count = 0;
  getAppointmentSyncJournal(100).filter(packet => ['completed', 'booked', 'paid', 'resolved', 'returned'].includes(String(packet.status || '').toLowerCase())).forEach(packet => { resolveAppointmentSyncPacket(packet.id); count += 1; });
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-sync-resolve-ready', message: `Resolved ${count} healthy appointment sync packet(s)`, at: nowIso() });
  persist();
  return count;
}

function buildAppointmentOrchestrationDeck() {
  const stuck = getAppointmentStuckSyncPackets(30);
  const sequences = getAppointmentSequenceQueue(20);
  const rescueRuns = (ensureAppointmentBridge().rescueRuns || []).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 12);
  const fulfillment = buildAppointmentFulfillmentDeck();
  const summary = {
    syncBacklog: stuck.length,
    activeSequences: sequences.length,
    rescueRuns: rescueRuns.length,
    fulfillmentWithTemplate: fulfillment.rows.filter(item => item.templateLabel).length,
    blockedFulfillment: fulfillment.summary.blocked,
    queuedFulfillment: fulfillment.summary.queued
  };
  return { generatedAt: nowIso(), summary, stuckPackets: stuck, sequences, rescueRuns, fulfillmentRows: fulfillment.rows.slice(0, 12) };
}

function exportAppointmentOrchestrationDeck(format = 'json') {
  const payload = buildAppointmentOrchestrationDeck();
  ensureAppointmentBridge().exports.unshift({ id: uid('brief'), kind: 'appointment-orchestration', createdAt: nowIso(), summary: payload.summary });
  persist();
  if (format === 'json') return download('ae-appointment-orchestration-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# Appointment Orchestration Brief',
    '',
    `Generated at: ${payload.generatedAt}`,
    '',
    `- Sync backlog: ${payload.summary.syncBacklog}`,
    `- Active sequences: ${payload.summary.activeSequences}`,
    `- Rescue runs: ${payload.summary.rescueRuns}`,
    `- Template-applied fulfillment: ${payload.summary.fulfillmentWithTemplate}`,
    `- Blocked fulfillment: ${payload.summary.blockedFulfillment}`,
    '',
    '## Stuck packets',
    '',
    ...(payload.stuckPackets.length ? payload.stuckPackets.map(item => `- ${item.clientName || item.refs?.clientName || 'Lead'} · ${item.kind} · ${item.status} · age ${Math.round(item.ageHours || 0)}h`) : ['- No stuck appointment packets.'])
  ].join('
');
  return download('ae-appointment-orchestration-brief.md', md, 'text/markdown');
}

function renderAppointmentProfitabilityCard() {
  const payload = buildAppointmentProfitabilityDeck();
  const rows = payload.rows.slice(0, 8);
  return `<div class="card"><div class="eyebrow">Profitability deck</div><h3>Collected value, delivery cost, and net appointment position</h3><div class="tag-row"><span class="tag">Booked ${formatCurrency(payload.summary.bookedValue)}</span><span class="tag">Collected ${formatCurrency(payload.summary.collected)}</span><span class="tag">Outstanding ${formatCurrency(payload.summary.outstanding)}</span><span class="tag">Delivery ${formatCurrency(payload.summary.deliveryCost)}</span><span class="tag">Net ${formatCurrency(payload.summary.netCollected)}</span><span class="tag">Margin watch ${payload.summary.marginWatch}</span></div><div class="list">${rows.length ? rows.map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.fulfillmentStatus || 'not-opened')} · ${escapeHtml(item.templateLabel || 'no template')} · ${escapeHtml(item.aeName || 'No AE')}</div><p>Collected ${escapeHtml(formatCurrency(item.collected))} · delivery ${escapeHtml(formatCurrency(item.deliveryCost))} · net ${escapeHtml(formatCurrency(item.net))}</p><div class="toolbar"><button class="btn-soft" data-act="appointment-profit-open-client" data-id="${item.clientId}">Open client</button></div></div>`).join('') : '<div class="item"><div class="meta">No appointment profitability rows exist yet.</div></div>'}</div><div class="toolbar"><button class="btn-soft" id="export-appointment-profitability-json">Export JSON</button><button class="btn-soft" id="export-appointment-profitability-md">Export Markdown</button></div></div>`;
}

function renderAppointmentOrchestrationCard() {
  const payload = buildAppointmentOrchestrationDeck();
  const packets = payload.stuckPackets.slice(0, 6);
  return `<div class="card"><div class="eyebrow">Orchestration desk</div><h3>Sync backlog, rescue pressure, and fulfillment template control</h3><div class="tag-row"><span class="tag">Sync backlog ${payload.summary.syncBacklog}</span><span class="tag">Sequences ${payload.summary.activeSequences}</span><span class="tag">Rescue runs ${payload.summary.rescueRuns}</span><span class="tag">Templates ${payload.summary.fulfillmentWithTemplate}</span><span class="tag">Blocked ${payload.summary.blockedFulfillment}</span></div><div class="list">${packets.length ? packets.map(item => `<div class="item"><h4>${escapeHtml(item.clientName || item.refs?.clientName || 'Lead')}</h4><div class="meta">${escapeHtml(item.kind || 'packet')} · ${escapeHtml(item.status || 'queued')} · ${Math.round(Number(item.ageHours || 0))}h old</div><p>${escapeHtml(item.summary || 'No packet summary.')}</p><div class="toolbar"><button class="btn-soft" data-act="appointment-sync-open-client" data-id="${item.refs?.clientId || ''}">Open client</button><button class="btn-soft" data-act="appointment-sync-retry" data-id="${item.id}">Retry</button></div></div>`).join('') : '<div class="item"><div class="meta">No stuck appointment sync packets.</div></div>'}</div><div class="toolbar"><button class="btn-soft" id="appointment-sync-retry-all">Retry all</button><button class="btn-soft" id="appointment-sync-resolve-ready">Resolve healthy</button><button class="btn-soft" id="export-appointment-orchestration-json">Export JSON</button><button class="btn-soft" id="export-appointment-orchestration-md">Export Markdown</button></div></div>`;
}

function renderAppointmentFulfillmentCard() {
  const payload = buildAppointmentFulfillmentDeck();
  const rows = payload.rows.slice(0, 8);
  return `<div class="card"><div class="eyebrow">Fulfillment board</div><h3>Post-sale delivery packets, status control, and closeout visibility</h3><div class="tag-row"><span class="tag">Total ${payload.summary.total}</span><span class="tag">Queued ${payload.summary.queued}</span><span class="tag">In progress ${payload.summary.inProgress}</span><span class="tag">Blocked ${payload.summary.blocked}</span><span class="tag">Completed ${payload.summary.completed}</span></div><div class="list">${rows.length ? rows.map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.status)} · due ${escapeHtml(item.dueDate || 'not set')} · ${escapeHtml(item.owner || 'Founder Desk')} · ${escapeHtml(item.templateLabel || 'no template')}</div><p>${escapeHtml(item.note || 'No fulfillment note recorded.')} ${Array.isArray(item.checklist) && item.checklist.length ? `Checklist ${item.checklist.filter(step => step.done).length}/${item.checklist.length}.` : 'No checklist yet.'}</p><div class="toolbar"><button class="btn-soft" data-act="appointment-fulfillment-open-client" data-id="${item.clientId}">Open client</button><button class="btn-soft" data-act="appointment-fulfillment-template" data-id="${item.id}">Apply template</button><button class="btn-soft" data-act="appointment-fulfillment-template-premium" data-id="${item.id}">Premium template</button><button class="btn-soft" data-act="appointment-fulfillment-progress" data-id="${item.id}">In progress</button><button class="btn-soft" data-act="appointment-fulfillment-blocked" data-id="${item.id}">Blocked</button><button class="btn-soft" data-act="appointment-fulfillment-complete" data-id="${item.id}">Complete</button></div></div>`).join('') : '<div class="item"><div class="meta">No fulfillment packets are active.</div></div>'}</div><div class="toolbar"><button class="btn-soft" id="export-appointment-fulfillment-json">Export JSON</button><button class="btn-soft" id="export-appointment-fulfillment-md">Export Markdown</button></div></div>`;
}
function renderAppointmentDeskCard() {
  const summary = getAppointmentDeskSummary();
  const handoffs = getAppointmentLeadQueue(5);
  return `<div class="card"><div class="eyebrow">Appointment brain</div><h3>Integrated handoff, booking, and no-show control</h3><div class="tag-row"><span class="tag">Handoffs ${summary.handoffs}</span><span class="tag">Booked ${summary.booked}</span><span class="tag">Risk ${summary.noShowRisk}</span><span class="tag">Runtime ${escapeHtml(summary.donorStatus)}</span></div><div class="list">${handoffs.length ? handoffs.map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.company || 'No company')} · ${escapeHtml(item.status)} · ${escapeHtml(item.qualificationStatus)}</div><div class="toolbar"><button class="btn-soft" data-act="open-appointment-client" data-id="${item.clientId}">Open client</button><button class="btn-soft" data-act="open-appointment-page">Open appointment brain</button></div></div>`).join('') : '<div class="item"><div class="meta">No appointment-setter handoffs yet.</div></div>'}</div><div class="toolbar"><button class="btn-soft" id="export-appointment-brief-json">Export JSON</button><button class="btn-soft" id="export-appointment-brief-md">Export Markdown</button><button class="btn-soft" id="export-omega-brief-json">0mega JSON</button><button class="btn-soft" id="export-omega-brief-md">0mega Markdown</button></div></div>`;
}


function computeAppointmentSequencePressure(entry) {
  const nextRun = String(entry?.nextRunDate || '').slice(0, 10);
  const today = getTodayIsoDate();
  const current = Number(entry?.currentStepIndex || 0) + 1;
  let score = 0;
  if (String(entry?.status || '').toLowerCase() === 'active') score += 10;
  if (nextRun && nextRun < today) score += 40;
  else if (nextRun && nextRun === today) score += 18;
  if (current >= Number(entry?.stepCount || 0)) score += 8;
  return { score, label: score >= 40 ? 'Due now' : score >= 18 ? 'Next up' : 'Healthy' };
}

function getAppointmentSequenceQueue(limit = 20) {
  return ensureAppointmentBridge().sequences
    .map(item => ({ ...item, pressure: computeAppointmentSequencePressure(item) }))
    .filter(item => String(item.status || '').toLowerCase() !== 'completed')
    .sort((a, b) => Number(b.pressure.score || 0) - Number(a.pressure.score || 0) || String(a.nextRunDate || '').localeCompare(String(b.nextRunDate || '')))
    .slice(0, limit);
}

function getAppointmentSequenceSummary() {
  const rows = getAppointmentSequenceQueue(1000);
  return {
    active: rows.filter(item => String(item.status || '').toLowerCase() === 'active').length,
    dueNow: rows.filter(item => Number(item.pressure.score || 0) >= 40).length,
    nextUp: rows.filter(item => Number(item.pressure.score || 0) >= 18 && Number(item.pressure.score || 0) < 40).length,
    responded: rows.filter(item => String(item.lastResponseState || '').toLowerCase() === 'responded').length
  };
}

function enrollAppointmentSequence(handoffId, templateId = 'qualification-sprint') {
  const bridge = ensureAppointmentBridge();
  const handoff = bridge.handoffs.find(item => item.id === handoffId);
  const template = APPOINTMENT_SEQUENCE_LIBRARY.find(item => item.id === templateId);
  if (!handoff || !template) return null;
  const existing = bridge.sequences.find(item => item.handoffId === handoffId && String(item.templateId || '') === templateId && String(item.status || '').toLowerCase() !== 'completed');
  if (existing) return existing;
  const startDate = String(handoff.followUpDate || getTodayIsoDate()).slice(0, 10) || getTodayIsoDate();
  const firstStep = template.steps[0] || { label: 'Initial step', note: '' };
  const entry = {
    id: uid('appt-seq'),
    handoffId,
    appointmentId: '',
    clientId: handoff.clientId,
    clientName: handoff.clientName,
    aeId: handoff.aeId,
    aeName: handoff.aeName,
    templateId: template.id,
    templateLabel: template.label,
    currentStepIndex: 0,
    currentStepLabel: firstStep.label,
    stepCount: template.steps.length,
    nextRunDate: isoDatePlusDays(startDate, Number(firstStep.offsetDays || 0)),
    status: 'active',
    lastResponseState: 'pending',
    notes: handoff.nextStep || firstStep.note || '',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  bridge.sequences.unshift(entry);
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-sequence-enroll', message: `Enrolled ${handoff.clientName} into ${template.label}`, at: nowIso() });
  persist();
  return entry;
}

function advanceAppointmentSequence(sequenceId) {
  const bridge = ensureAppointmentBridge();
  const entry = bridge.sequences.find(item => item.id === sequenceId);
  if (!entry) return null;
  const template = APPOINTMENT_SEQUENCE_LIBRARY.find(item => item.id === entry.templateId);
  if (!template) return null;
  const nextIndex = Number(entry.currentStepIndex || 0) + 1;
  if (nextIndex >= template.steps.length) {
    entry.currentStepIndex = template.steps.length - 1;
    entry.currentStepLabel = template.steps[template.steps.length - 1]?.label || entry.currentStepLabel;
    entry.status = 'completed';
    entry.updatedAt = nowIso();
    state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-sequence-complete', message: `Completed sequence ${entry.templateLabel} for ${entry.clientName}`, at: nowIso() });
    persist();
    return entry;
  }
  const step = template.steps[nextIndex];
  entry.currentStepIndex = nextIndex;
  entry.currentStepLabel = step.label;
  entry.nextRunDate = isoDatePlusDays(getTodayIsoDate(), Number(step.offsetDays || 0));
  entry.notes = step.note || entry.notes;
  entry.lastResponseState = 'pending';
  entry.updatedAt = nowIso();
  createAppointmentSequenceTask(entry, step.label, step.note || '');
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-sequence-advance', message: `Advanced sequence ${entry.templateLabel} for ${entry.clientName} to ${step.label}`, at: nowIso() });
  persist();
  return entry;
}

function markAppointmentSequenceResponded(sequenceId) {
  const entry = ensureAppointmentBridge().sequences.find(item => item.id === sequenceId);
  if (!entry) return null;
  entry.lastResponseState = 'responded';
  entry.updatedAt = nowIso();
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-sequence-response', message: `Marked responded inside ${entry.templateLabel} for ${entry.clientName}`, at: nowIso() });
  persist();
  return entry;
}

function createAppointmentSequenceTask(entry, label = '', note = '') {
  const client = state.clients.find(item => item.id === entry.clientId);
  const title = `Appointment sequence — ${entry.clientName} · ${label || entry.currentStepLabel || 'Follow-up step'}`;
  const existing = state.tasks.find(task => String(task.title || '') === title && String(task.status || '') !== 'done');
  if (existing) return existing;
  const task = applyTaskDraft({ id: uid('task'), createdAt: nowIso(), updatedAt: nowIso(), recurrenceSourceTaskId: '' }, {
    title,
    dueDate: String(entry.nextRunDate || getTodayIsoDate()).slice(0, 10),
    assignedAeId: entry.aeId || client?.assignedAeId || '',
    assignedAeName: entry.aeName || client?.assignedAeName || '',
    clientId: entry.clientId || '',
    clientName: entry.clientName || client?.name || '',
    notes: note || entry.notes || 'Run the next appointment sequence action and capture the outcome.',
    status: 'todo',
    blockerNote: '',
    dependsOnTaskId: '',
    dependsOnTaskTitle: '',
    recurrenceCadence: 'none',
    estimatedMinutes: 20,
    actualMinutes: 0
  }, 'create');
  state.tasks.unshift(task);
  persist();
  return task;
}

function getAppointmentConflictQueue(limit = 20) {
  const appointments = [...getAppointmentRecords()].sort((a, b) => String(a.startAt || '').localeCompare(String(b.startAt || '')));
  const conflicts = [];
  const seen = new Set();
  appointments.forEach((appointment, index) => {
    const status = String(appointment.status || '').toLowerCase();
    if (['completed', 'cancelled'].includes(status)) return;
    const start = String(appointment.startAt || '');
    const startMs = start ? new Date(start).getTime() : NaN;
    let reason = '';
    if (!start) {
      reason = 'Missing scheduled time';
    } else if (Number.isFinite(startMs) && startMs < Date.now() && status === 'scheduled') {
      reason = 'Scheduled time already passed';
    } else {
      const overlap = appointments.find((other, otherIndex) => otherIndex !== index && String(other.status || '').toLowerCase() === 'scheduled' && String(other.startAt || '') && Math.abs(new Date(other.startAt).getTime() - startMs) < 55 * 60 * 1000);
      if (overlap) reason = `Conflict with ${overlap.clientName}`;
    }
    if (reason && !seen.has(appointment.id)) {
      seen.add(appointment.id);
      conflicts.push({ ...appointment, reason });
    }
  });
  return conflicts.slice(0, limit);
}

function buildAppointmentSlotPlan(days = 10, limit = 12) {
  const bridge = ensureAppointmentBridge();
  const templates = bridge.slotTemplates || [];
  const used = new Set(getAppointmentRecords().filter(item => String(item.status || '').toLowerCase() === 'scheduled' && item.startAt).map(item => String(item.startAt).slice(0, 16)));
  const results = [];
  for (let dayOffset = 0; dayOffset < days && results.length < limit; dayOffset += 1) {
    const date = new Date();
    date.setHours(0,0,0,0);
    date.setDate(date.getDate() + dayOffset);
    const weekday = date.getDay();
    templates.forEach(template => {
      if (results.length >= limit) return;
      if (!Array.isArray(template.weekday) || !template.weekday.includes(weekday)) return;
      const slot = new Date(date.getTime());
      slot.setHours(Number(template.hour || 9), Number(template.minute || 0), 0, 0);
      const key = slot.toISOString().slice(0, 16);
      if (used.has(key) || slot.getTime() < Date.now()) return;
      results.push({
        id: uid('slot'),
        templateId: template.id,
        label: template.label,
        startAt: slot.toISOString(),
        durationMinutes: Number(template.durationMinutes || 60)
      });
      used.add(key);
    });
  }
  return results;
}

function scheduleAppointmentFromCoverage(appointmentId) {
  const appointment = getAppointmentRecords().find(item => item.id === appointmentId);
  if (!appointment) return null;
  const suggestions = buildAppointmentSlotPlan(14, 1);
  const suggestion = suggestions[0];
  if (!suggestion) return null;
  appointment.startAt = suggestion.startAt;
  appointment.slotTemplateId = suggestion.templateId;
  appointment.status = 'scheduled';
  appointment.reminderState = 'queued';
  appointment.updatedAt = nowIso();
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-slot-plan', message: `Rescheduled ${appointment.clientName} using ${suggestion.label}`, at: nowIso() });
  persist();
  return suggestion;
}

function syncAppointmentOutcomeToClient(appointmentId, outcome = 'qualified') {
  const appointment = getAppointmentRecords().find(item => item.id === appointmentId);
  if (!appointment) return null;
  const client = state.clients.find(item => item.id === appointment.clientId);
  const bridge = ensureAppointmentBridge();
  const handoff = bridge.handoffs.find(item => item.id === appointment.handoffId);
  const syncRow = { id: uid('appt-sync'), appointmentId, clientId: appointment.clientId, clientName: appointment.clientName, outcome, at: nowIso() };
  bridge.syncLog.unshift(syncRow);
  bridge.syncLog = bridge.syncLog.slice(0, 60);
  appointment.outcome = outcome;
  appointment.updatedAt = nowIso();
  if (handoff) {
    handoff.qualificationStatus = outcome === 'qualified' ? 'qualified' : outcome === 'disqualified' ? 'disqualified' : handoff.qualificationStatus || 'pending';
    handoff.status = outcome === 'qualified' ? 'booked' : outcome === 'disqualified' ? 'returned' : handoff.status || 'queued';
    handoff.returnNote = outcome === 'disqualified' ? 'Returned to AE after disqualification.' : handoff.returnNote || '';
    handoff.updatedAt = nowIso();
  }
  if (client) {
    if (outcome === 'qualified') {
      client.stage = 'active';
      client.closeProbability = Math.max(Number(client.closeProbability || 0), 70);
      client.nextStep = 'Run booked-appointment follow-through and push toward close.';
      client.followUpDate = isoDatePlusDays(getTodayIsoDate(), 1);
    } else if (outcome === 'disqualified') {
      client.stage = 'nurture';
      client.closeProbability = Math.min(Number(client.closeProbability || 0), 25);
      client.nextStep = 'Review disqualification notes and decide nurture or exit.';
      client.followUpDate = isoDatePlusDays(getTodayIsoDate(), 5);
    } else if (outcome === 'reschedule') {
      client.stage = 'active';
      client.nextStep = 'Reschedule appointment and confirm attendance.';
      client.followUpDate = isoDatePlusDays(getTodayIsoDate(), 1);
    }
    client.appointmentSetterStatus = outcome;
    client.updatedAt = nowIso();
    client.lastTouchAt = nowIso();
    logClientActivity(client, 'appointment-outcome-sync', `Appointment outcome synced: ${outcome}`, client.nextStep || '');
    remoteUpsert('clients', client);
  }
  const existing = state.tasks.find(task => task.clientId === appointment.clientId && String(task.title || '').startsWith('Appointment outcome —') && String(task.status || '') !== 'done');
  if (!existing) {
    const task = applyTaskDraft({ id: uid('task'), createdAt: nowIso(), updatedAt: nowIso(), recurrenceSourceTaskId: '' }, {
      title: `Appointment outcome — ${appointment.clientName}`,
      dueDate: isoDatePlusDays(getTodayIsoDate(), outcome === 'disqualified' ? 5 : 1),
      assignedAeId: appointment.aeId || client?.assignedAeId || '',
      assignedAeName: appointment.aeName || client?.assignedAeName || '',
      clientId: appointment.clientId,
      clientName: appointment.clientName,
      notes: `Outcome sync recorded as ${outcome}. Review appointment lane and execute the next AE move.`,
      status: 'todo', blockerNote: '', dependsOnTaskId: '', dependsOnTaskTitle: '', recurrenceCadence: 'none', estimatedMinutes: 20, actualMinutes: 0
    }, 'create');
    state.tasks.unshift(task);
  }
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-outcome-sync', message: `Synced ${outcome} outcome for ${appointment.clientName} back to AE command`, at: nowIso() });
  persist();
  return syncRow;
}

function getAppointmentOutcomeSummary() {
  const rows = (ensureAppointmentBridge().syncLog || []);
  return {
    total: rows.length,
    qualified: rows.filter(item => item.outcome === 'qualified').length,
    disqualified: rows.filter(item => item.outcome === 'disqualified').length,
    reschedule: rows.filter(item => item.outcome === 'reschedule').length
  };
}

function buildAppointmentSequenceBrief() {
  return {
    generatedAt: nowIso(),
    summary: getAppointmentSequenceSummary(),
    queue: getAppointmentSequenceQueue(25),
    conflicts: getAppointmentConflictQueue(25),
    slotPlan: buildAppointmentSlotPlan(14, 20),
    outcomes: getAppointmentOutcomeSummary(),
    syncLog: (ensureAppointmentBridge().syncLog || []).slice(0, 25)
  };
}


function getAppointmentDepositEntries() {
  return ensureAppointmentBridge().depositLedger || [];
}

function findAppointmentDeposit(appointmentId) {
  return getAppointmentDepositEntries().find(item => item.appointmentId === appointmentId);
}

function estimateAppointmentDepositAmount(appointment) {
  const client = state.clients.find(item => item.id === appointment?.clientId);
  const estimated = Math.max(Number(appointment?.estimatedValue || 0), Number(client?.estimatedValue || 0), Number(client?.monthlyValue || 0));
  const raw = estimated > 0 ? Math.round(estimated * 0.15) : 750;
  return Math.max(raw, 750);
}

function requestAppointmentDeposit(appointmentId) {
  const appointment = getAppointmentRecords().find(item => item.id === appointmentId);
  if (!appointment) return null;
  const bridge = ensureAppointmentBridge();
  let row = findAppointmentDeposit(appointmentId);
  if (!row) {
    row = {
      id: uid('deposit'),
      appointmentId,
      clientId: appointment.clientId,
      clientName: appointment.clientName,
      aeId: appointment.aeId || '',
      amount: estimateAppointmentDepositAmount(appointment),
      status: 'requested',
      requestedAt: nowIso(),
      paidAt: '',
      refundAt: '',
      note: 'Deposit requested from appointment brain.'
    };
    bridge.depositLedger.unshift(row);
  } else {
    row.status = row.status === 'paid' ? 'paid' : 'requested';
    row.requestedAt = row.requestedAt || nowIso();
    row.note = 'Deposit request refreshed from appointment brain.';
  }
  appointment.depositStatus = row.status;
  appointment.depositAmount = row.amount;
  appointment.updatedAt = nowIso();
  const client = state.clients.find(item => item.id === appointment.clientId);
  if (client) {
    client.updatedAt = nowIso();
    client.depositStatus = row.status;
    client.depositAmount = row.amount;
    client.nextStep = client.nextStep || 'Collect booking deposit and confirm appointment commitment.';
    logClientActivity(client, 'appointment-deposit-requested', 'Appointment deposit requested', formatCurrency(row.amount));
    remoteUpsert('clients', client);
  }
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-deposit-requested', message: `Deposit requested for ${appointment.clientName}`, at: nowIso() });
  pushAppointmentSyncPacket('outbound', 'deposit-request', row.status, `Deposit requested for ${appointment.clientName}`, { clientId: appointment.clientId, clientName: appointment.clientName, appointmentId: appointment.id, aeId: appointment.aeId, aeName: appointment.aeName, source: 'appointment-brain' }, { amount: row.amount, status: row.status });
  persist();
  return row;
}

function setAppointmentDepositStatus(appointmentId, status = 'paid') {
  const appointment = getAppointmentRecords().find(item => item.id === appointmentId);
  if (!appointment) return null;
  const row = findAppointmentDeposit(appointmentId) || requestAppointmentDeposit(appointmentId);
  if (!row) return null;
  row.status = status;
  if (status === 'paid') row.paidAt = nowIso();
  if (status === 'refunded') row.refundAt = nowIso();
  row.note = `Deposit marked ${status}.`;
  appointment.depositStatus = status;
  appointment.depositAmount = row.amount;
  appointment.updatedAt = nowIso();
  const client = state.clients.find(item => item.id === appointment.clientId);
  if (client) {
    client.depositStatus = status;
    client.depositAmount = row.amount;
    if (status === 'paid') {
      client.closeProbability = Math.max(Number(client.closeProbability || 0), 78);
      client.stage = client.stage === 'closed' ? 'closed' : 'active';
      client.nextStep = 'Deposit received. Protect the appointment and move toward close.';
    }
    if (status === 'refunded') {
      client.nextStep = 'Deposit refunded. Review appointment lane and decide whether to re-qualify or exit.';
    }
    client.updatedAt = nowIso();
    logClientActivity(client, 'appointment-deposit-status', `Deposit marked ${status}`, formatCurrency(row.amount));
    remoteUpsert('clients', client);
  }
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-deposit-status', message: `${appointment.clientName} deposit marked ${status}`, at: nowIso() });
  pushAppointmentSyncPacket('inbound', 'deposit-status', status, `${appointment.clientName} deposit marked ${status}`, { clientId: appointment.clientId, clientName: appointment.clientName, appointmentId: appointment.id, aeId: appointment.aeId, aeName: appointment.aeName, source: 'appointment-brain' }, { amount: row.amount });
  persist();
  return row;
}

function buildAppointmentRevenueDeck() {
  const bookings = getAppointmentRecords();
  const ledger = getAppointmentDepositEntries();
  const requested = ledger.filter(item => item.status === 'requested');
  const paid = ledger.filter(item => item.status === 'paid');
  const refunded = ledger.filter(item => item.status === 'refunded');
  const totalRequested = ledger.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalPaid = paid.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const summary = {
    bookings: bookings.length,
    depositsRequested: requested.length,
    depositsPaid: paid.length,
    depositsRefunded: refunded.length,
    depositRequestedValue: totalRequested,
    depositCollectedValue: totalPaid,
    committedValue: bookings.reduce((sum, item) => sum + Math.max(Number(item.estimatedValue || 0), Number((state.clients.find(client => client.id === item.clientId) || {}).estimatedValue || 0)), 0)
  };
  const rows = bookings.map(item => {
    const client = state.clients.find(client => client.id === item.clientId) || {};
    const deposit = findAppointmentDeposit(item.id);
    return {
      appointmentId: item.id,
      clientId: item.clientId,
      clientName: item.clientName,
      aeName: item.aeName || client.assignedAeName || '',
      status: item.status || 'scheduled',
      startAt: item.startAt || '',
      estimatedValue: Math.max(Number(item.estimatedValue || 0), Number(client.estimatedValue || 0)),
      depositStatus: deposit?.status || item.depositStatus || 'none',
      depositAmount: Number(deposit?.amount || item.depositAmount || 0),
      risk: computeAppointmentNoShowRisk(item).label
    };
  }).sort((a, b) => (b.estimatedValue - a.estimatedValue) || String(a.startAt).localeCompare(String(b.startAt))).slice(0, 20);
  return { generatedAt: nowIso(), summary, rows };
}

function exportAppointmentRevenueDeck(format = 'json') {
  const payload = buildAppointmentRevenueDeck();
  ensureAppointmentBridge().exports.unshift({ id: uid('brief'), kind: 'appointment-revenue', createdAt: nowIso(), summary: payload.summary });
  persist();
  if (format === 'json') return download('ae-appointment-revenue-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# Appointment Revenue + Deposit Brief',
    '',
    `Generated at: ${payload.generatedAt}`,
    '',
    `- Bookings: ${payload.summary.bookings}`,
    `- Deposits requested: ${payload.summary.depositsRequested}`,
    `- Deposits paid: ${payload.summary.depositsPaid}`,
    `- Deposits refunded: ${payload.summary.depositsRefunded}`,
    `- Deposit requested value: ${formatCurrency(payload.summary.depositRequestedValue)}`,
    `- Deposit collected value: ${formatCurrency(payload.summary.depositCollectedValue)}`,
    `- Committed value: ${formatCurrency(payload.summary.committedValue)}`,
    '',
    '## Booking rows',
    '',
    ...(payload.rows.length ? payload.rows.map(item => `- ${item.clientName} · ${item.status} · ${item.depositStatus} ${formatCurrency(item.depositAmount)} · est ${formatCurrency(item.estimatedValue)} · ${item.risk}`) : ['- No booking rows yet.'])
  ].join('\n');
  return download('ae-appointment-revenue-brief.md', md, 'text/markdown');
}

function buildAppointmentCalendarDeck(days = 7) {
  const rows = [];
  const templates = ensureAppointmentBridge().slotTemplates || [];
  const appointments = getAppointmentRecords();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date();
    date.setHours(0,0,0,0);
    date.setDate(date.getDate() + offset);
    const iso = date.toISOString().slice(0,10);
    const weekday = date.getDay();
    const capacity = templates.filter(item => Array.isArray(item.weekday) && item.weekday.includes(weekday)).length;
    const scheduled = appointments.filter(item => String(item.startAt || '').slice(0,10) === iso && ['scheduled','booked','confirmed'].includes(String(item.status || '').toLowerCase())).length;
    const watch = appointments.filter(item => String(item.startAt || '').slice(0,10) === iso && computeAppointmentNoShowRisk(item).status !== 'healthy').length;
    rows.push({ day: iso, weekday: date.toLocaleDateString(undefined, { weekday: 'short' }), capacity, scheduled, openSlots: Math.max(capacity - scheduled, 0), watch });
  }
  const conflicts = getAppointmentConflictQueue(20);
  return {
    generatedAt: nowIso(),
    summary: {
      days,
      totalCapacity: rows.reduce((sum, row) => sum + row.capacity, 0),
      totalScheduled: rows.reduce((sum, row) => sum + row.scheduled, 0),
      totalOpenSlots: rows.reduce((sum, row) => sum + row.openSlots, 0),
      watchDays: rows.filter(row => row.watch > 0 || row.openSlots === 0).length,
      conflicts: conflicts.length
    },
    rows,
    conflicts
  };
}

function exportAppointmentCalendarDeck(format = 'json') {
  const payload = buildAppointmentCalendarDeck();
  ensureAppointmentBridge().exports.unshift({ id: uid('brief'), kind: 'appointment-calendar', createdAt: nowIso(), summary: payload.summary });
  persist();
  if (format === 'json') return download('ae-appointment-calendar-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# Appointment Calendar + Capacity Brief',
    '',
    `Generated at: ${payload.generatedAt}`,
    '',
    `- Total capacity: ${payload.summary.totalCapacity}`,
    `- Total scheduled: ${payload.summary.totalScheduled}`,
    `- Total open slots: ${payload.summary.totalOpenSlots}`,
    `- Watch days: ${payload.summary.watchDays}`,
    `- Conflicts: ${payload.summary.conflicts}`,
    '',
    '## Next 7 days',
    '',
    ...(payload.rows.length ? payload.rows.map(item => `- ${item.day} (${item.weekday}) · scheduled ${item.scheduled}/${item.capacity} · open ${item.openSlots} · watch ${item.watch}`) : ['- No calendar rows yet.']),
    '',
    '## Conflicts',
    '',
    ...(payload.conflicts.length ? payload.conflicts.map(item => `- ${item.clientName} · ${item.reason}`) : ['- No conflicts surfaced.'])
  ].join('\n');
  return download('ae-appointment-calendar-brief.md', md, 'text/markdown');
}

function runAppointmentRescuePack(mode = 'watch') {
  const bridge = ensureAppointmentBridge();
  const candidates = getAppointmentRecords().filter(item => mode === 'all' ? true : (mode === 'watch' ? computeAppointmentNoShowRisk(item).status !== 'healthy' || ['cancelled','no-show'].includes(String(item.status || '').toLowerCase()) : String(item.status || '').toLowerCase() === mode));
  let tasksCreated = 0;
  let sequencesEnrolled = 0;
  candidates.forEach(item => {
    if (!findAppointmentDeposit(item.id) && ['scheduled','booked','confirmed'].includes(String(item.status || '').toLowerCase())) requestAppointmentDeposit(item.id);
    if (createAppointmentReminderTask(item.id)) tasksCreated += 1;
    const seq = enrollAppointmentSequence(item.handoffId || '', ['no-show','cancelled'].includes(String(item.status || '').toLowerCase()) ? 'reactivation-run' : 'show-up-defense');
    if (seq) sequencesEnrolled += 1;
  });
  const run = { id: uid('appt-rescue'), mode, createdAt: nowIso(), candidates: candidates.length, tasksCreated, sequencesEnrolled };
  bridge.rescueRuns.unshift(run);
  bridge.rescueRuns = bridge.rescueRuns.slice(0, 25);
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-rescue-run', message: `Appointment rescue pack run for ${candidates.length} items`, at: nowIso() });
  persist();
  return run;
}

function renderAppointmentRevenueCard() {
  const deck = buildAppointmentRevenueDeck();
  return `<div class="card"><div class="eyebrow">Revenue + deposits</div><h3>Deposit pressure, collected commitment, and booking value</h3><div class="tag-row"><span class="tag">Requested ${deck.summary.depositsRequested}</span><span class="tag">Paid ${deck.summary.depositsPaid}</span><span class="tag">Collected ${escapeHtml(formatCurrency(deck.summary.depositCollectedValue))}</span><span class="tag">Committed ${escapeHtml(formatCurrency(deck.summary.committedValue))}</span></div><div class="list">${deck.rows.length ? deck.rows.slice(0,6).map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.status)} · deposit ${escapeHtml(item.depositStatus)} ${escapeHtml(formatCurrency(item.depositAmount))} · est ${escapeHtml(formatCurrency(item.estimatedValue))}</div></div>`).join('') : '<div class="item"><div class="meta">No appointment revenue rows yet.</div></div>'}</div><div class="toolbar"><button class="btn-soft" id="export-appointment-revenue-json">Export revenue JSON</button><button class="btn-soft" id="export-appointment-revenue-md">Export revenue Markdown</button><button class="btn-soft" id="run-appointment-rescue">Run rescue pack</button></div></div>`;
}

function renderAppointmentCalendarCard() {
  const deck = buildAppointmentCalendarDeck();
  const lastRun = (ensureAppointmentBridge().rescueRuns || [])[0];
  return `<div class="card"><div class="eyebrow">Calendar + rescue</div><h3>7-day slot pressure, open capacity, and recovery actions</h3><div class="tag-row"><span class="tag">Capacity ${deck.summary.totalCapacity}</span><span class="tag">Scheduled ${deck.summary.totalScheduled}</span><span class="tag">Open ${deck.summary.totalOpenSlots}</span><span class="tag">Conflicts ${deck.summary.conflicts}</span></div><div class="list">${deck.rows.length ? deck.rows.slice(0,7).map(item => `<div class="item"><h4>${escapeHtml(item.day)} · ${escapeHtml(item.weekday)}</h4><div class="meta">scheduled ${escapeHtml(String(item.scheduled))}/${escapeHtml(String(item.capacity))} · open ${escapeHtml(String(item.openSlots))} · watch ${escapeHtml(String(item.watch))}</div></div>`).join('') : '<div class="item"><div class="meta">No calendar pressure rows yet.</div></div>'}${lastRun ? `<div class="item"><h4>Latest rescue run</h4><div class="meta">${escapeHtml(lastRun.mode)} · candidates ${escapeHtml(String(lastRun.candidates))} · tasks ${escapeHtml(String(lastRun.tasksCreated))} · sequences ${escapeHtml(String(lastRun.sequencesEnrolled))}</div></div>` : ''}</div><div class="toolbar"><button class="btn-soft" id="export-appointment-calendar-json">Export calendar JSON</button><button class="btn-soft" id="export-appointment-calendar-md">Export calendar Markdown</button><button class="btn-soft" id="run-appointment-noshow-rescue">No-show rescue</button></div></div>`;
}

function exportAppointmentSequenceBrief(format = 'json') {
  const payload = buildAppointmentSequenceBrief();
  ensureAppointmentBridge().exports.unshift({ id: uid('brief'), kind: 'appointment-sequences', createdAt: nowIso(), summary: payload.summary });
  persist();
  if (format === 'json') return download('ae-appointment-sequence-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# Appointment Sequence + Slot Plan Brief',
    '',
    `Generated at: ${payload.generatedAt}`,
    '',
    `- Active sequences: ${payload.summary.active}`,
    `- Due now: ${payload.summary.dueNow}`,
    `- Next up: ${payload.summary.nextUp}`,
    `- Responded: ${payload.summary.responded}`,
    `- Outcome syncs: ${payload.outcomes.total}`,
    '',
    '## Sequence queue',
    '',
    ...(payload.queue.length ? payload.queue.map(item => `- ${item.clientName} · ${item.templateLabel} · ${item.currentStepLabel} · ${item.pressure.label} · next ${item.nextRunDate || 'n/a'}`) : ['- No active sequences.']),
    '',
    '## Booking conflicts',
    '',
    ...(payload.conflicts.length ? payload.conflicts.map(item => `- ${item.clientName} · ${item.reason} · ${String(item.startAt || '').slice(0, 16) || 'unscheduled'}`) : ['- No booking conflicts surfaced.']),
    '',
    '## Suggested slots',
    '',
    ...(payload.slotPlan.length ? payload.slotPlan.map(item => `- ${item.label} · ${String(item.startAt || '').slice(0, 16)}`) : ['- No slot suggestions available.'])
  ].join('
');
  return download('ae-appointment-sequence-brief.md', md, 'text/markdown');
}

function renderAppointmentSequenceCard() {
  const rows = getAppointmentSequenceQueue(12);
  const summary = getAppointmentSequenceSummary();
  return `<div class="card"><div class="eyebrow">Sequence engine</div><h3>Qualification, show-up, and reactivation cadences</h3><div class="tag-row"><span class="tag">Active ${summary.active}</span><span class="tag">Due ${summary.dueNow}</span><span class="tag">Next up ${summary.nextUp}</span><span class="tag">Responded ${summary.responded}</span></div><div class="list">${rows.length ? rows.map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.templateLabel)} · ${escapeHtml(item.currentStepLabel)} · ${escapeHtml(item.pressure.label)} · next ${escapeHtml(item.nextRunDate || 'n/a')}</div><p>${escapeHtml(item.notes || 'No sequence notes yet.')}</p><div class="toolbar"><button class="btn-soft" data-act="appointment-sequence-open-client" data-id="${item.clientId}">Open client</button><button class="btn-soft" data-act="appointment-sequence-advance" data-id="${item.id}">Advance</button><button class="btn-soft" data-act="appointment-sequence-responded" data-id="${item.id}">Responded</button></div></div>`).join('') : '<div class="item"><div class="meta">No appointment sequences are active yet.</div></div>'}</div><div class="toolbar"><button class="btn-soft" id="export-appointment-sequence-json">Export JSON</button><button class="btn-soft" id="export-appointment-sequence-md">Export Markdown</button></div></div>`;
}

function renderAppointmentCoverageCard() {
  const conflicts = getAppointmentConflictQueue(10);
  const slots = buildAppointmentSlotPlan(10, 10);
  const outcomes = getAppointmentOutcomeSummary();
  return `<div class="card"><div class="eyebrow">Coverage + outcome sync</div><h3>Conflict repair, slot planning, and return signals</h3><div class="tag-row"><span class="tag">Conflicts ${conflicts.length}</span><span class="tag">Suggested slots ${slots.length}</span><span class="tag">Qualified ${outcomes.qualified}</span><span class="tag">Disqualified ${outcomes.disqualified}</span></div><div class="list">${conflicts.length ? conflicts.map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.reason)} · ${escapeHtml(String(item.startAt || '').slice(0, 16) || 'unscheduled')}</div><div class="toolbar"><button class="btn-soft" data-act="appointment-slot-plan" data-id="${item.id}">Apply slot plan</button><button class="btn-soft" data-act="appointment-outcome-reschedule" data-id="${item.id}">Sync reschedule</button><button class="btn-soft" data-act="appointment-open-client" data-id="${item.clientId}">Open client</button></div></div>`).join('') : '<div class="item"><div class="meta">No booking conflicts are surfaced right now.</div></div>'}</div><div class="mini-grid" style="margin-top:12px">${slots.length ? slots.slice(0, 4).map(item => `<div class="mini-card"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(String(item.startAt || '').slice(0, 16))}</span></div>`).join('') : '<div class="mini-card"><strong>No slot suggestions</strong><span>Generate additional slot templates if you need more coverage.</span></div>'}</div></div>`;
}


function findAppointmentSettlement(appointmentId) {
  return ensureAppointmentBridge().settlementLedger.find(item => item.appointmentId === appointmentId) || null;
}

function estimateAppointmentSettlementAmount(appointment) {
  const client = state.clients.find(item => item.id === appointment?.clientId) || {};
  const estimated = Math.max(Number(appointment?.estimatedValue || 0), Number(client.estimatedValue || 0), Number(client.monthlyValue || 0));
  const deposit = Number(findAppointmentDeposit(appointment?.id)?.amount || appointment?.depositAmount || 0);
  return Math.max(estimated - deposit, Math.round(estimated * 0.65), 0);
}

function createAppointmentSettlement(appointmentId) {
  const appointment = getAppointmentRecords().find(item => item.id === appointmentId);
  if (!appointment) return null;
  let row = findAppointmentSettlement(appointmentId);
  if (!row) {
    row = {
      id: uid('appt-settle'),
      appointmentId,
      clientId: appointment.clientId,
      clientName: appointment.clientName,
      aeId: appointment.aeId || '',
      amount: estimateAppointmentSettlementAmount(appointment),
      status: 'draft',
      note: 'Close-pack settlement prepared from appointment brain.',
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    ensureAppointmentBridge().settlementLedger.unshift(row);
  }
  appointment.settlementStatus = row.status;
  appointment.updatedAt = nowIso();
  persist();
  return row;
}

function createAppointmentClosePackTask(appointmentId) {
  const appointment = getAppointmentRecords().find(item => item.id === appointmentId);
  if (!appointment) return null;
  const client = state.clients.find(item => item.id === appointment.clientId);
  const title = `Appointment close pack — ${appointment.clientName}`;
  const existing = state.tasks.find(task => String(task.title || '') === title && String(task.status || '').toLowerCase() !== 'done');
  if (existing) return existing;
  const task = applyTaskDraft({ id: uid('task'), createdAt: nowIso(), updatedAt: nowIso(), recurrenceSourceTaskId: '' }, {
    title,
    dueDate: getTodayIsoDate(),
    assignedAeId: appointment.aeId || client?.assignedAeId || '',
    assignedAeName: appointment.aeName || client?.assignedAeName || '',
    clientId: appointment.clientId || '',
    clientName: appointment.clientName || client?.name || '',
    status: 'todo',
    notes: `Finalize booked appointment outcome, confirm delivery handoff, and archive settlement details for ${appointment.clientName}.`
  });
  state.tasks.unshift(task);
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-close-pack-task', message: `Created close-pack task for ${appointment.clientName}`, at: nowIso() });
  persist();
  return task;
}

function setAppointmentSettlementStatus(appointmentId, status = 'sent') {
  const appointment = getAppointmentRecords().find(item => item.id === appointmentId);
  if (!appointment) return null;
  const row = findAppointmentSettlement(appointmentId) || createAppointmentSettlement(appointmentId);
  row.status = status;
  row.updatedAt = nowIso();
  appointment.settlementStatus = status;
  appointment.updatedAt = nowIso();
  const client = state.clients.find(item => item.id === appointment.clientId);
  if (client) {
    client.lastTouchedAt = nowIso();
    if (status === 'sent') {
      client.nextStep = 'Settlement sent. Await payment confirmation and delivery handoff.';
    }
    if (status === 'paid') {
      client.closeProbability = 100;
      client.appointmentSetterStatus = 'won';
      client.stage = 'closed';
      client.nextStep = 'Closed won — hand off to delivery and archive appointment revenue.';
      logClientActivity(client, 'appointment-settlement-paid', 'Appointment settlement marked paid', formatCurrency(row.amount));
      createAppointmentClosePackTask(appointmentId);
      createAppointmentFulfillmentPacket(appointmentId, 'settlement-paid');
      returnAppointmentClientToAe(appointmentId, 'Settlement paid and close-pack created.');
    } else {
      logClientActivity(client, 'appointment-settlement-status', `Appointment settlement marked ${status}`, formatCurrency(row.amount));
    }
  }
  ensureAppointmentBridge().syncLog.unshift({ id: uid('appt-sync'), appointmentId, clientId: appointment.clientId, outcome: `settlement-${status}`, at: nowIso() });
  state.auditLog.unshift({ id: uid('audit'), kind: 'appointment-settlement-status', message: `${appointment.clientName} settlement marked ${status}`, at: nowIso() });
  pushAppointmentSyncPacket('inbound', 'settlement-status', status, `${appointment.clientName} settlement marked ${status}`, { clientId: appointment.clientId, clientName: appointment.clientName, appointmentId: appointment.id, aeId: appointment.aeId, aeName: appointment.aeName, source: 'appointment-brain' }, { amount: row.amount, appointmentStatus: appointment.status });
  persist();
  return row;
}

function buildAppointmentSettlementDeck() {
  const rows = getAppointmentRecords().map(item => {
    const row = findAppointmentSettlement(item.id) || createAppointmentSettlement(item.id);
    return {
      appointmentId: item.id,
      clientId: item.clientId,
      clientName: item.clientName,
      aeName: item.aeName || state.clients.find(client => client.id === item.clientId)?.assignedAeName || '',
      status: row?.status || 'draft',
      amount: Number(row?.amount || 0),
      startAt: item.startAt || '',
      appointmentStatus: item.status || 'scheduled'
    };
  }).filter(item => item.amount > 0).sort((a, b) => (b.amount - a.amount) || String(a.startAt || '').localeCompare(String(b.startAt || '')));
  return {
    generatedAt: nowIso(),
    summary: {
      draft: rows.filter(item => item.status === 'draft').length,
      sent: rows.filter(item => item.status === 'sent').length,
      paid: rows.filter(item => item.status === 'paid').length,
      writeoff: rows.filter(item => item.status === 'writeoff').length,
      collectedValue: rows.filter(item => item.status === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0),
      outstandingValue: rows.filter(item => !['paid', 'writeoff'].includes(String(item.status || '').toLowerCase())).reduce((sum, item) => sum + Number(item.amount || 0), 0)
    },
    rows: rows.slice(0, 20)
  };
}

function exportAppointmentSettlementDeck(format = 'json') {
  const payload = buildAppointmentSettlementDeck();
  ensureAppointmentBridge().exports.unshift({ id: uid('brief'), kind: 'appointment-settlement', createdAt: nowIso(), summary: payload.summary });
  persist();
  if (format === 'json') return download('ae-appointment-settlement-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# Appointment Settlement Brief',
    '',
    `Generated at: ${payload.generatedAt}`,
    '',
    `- Draft: ${payload.summary.draft}`,
    `- Sent: ${payload.summary.sent}`,
    `- Paid: ${payload.summary.paid}`,
    `- Writeoff: ${payload.summary.writeoff}`,
    `- Collected value: ${formatCurrency(payload.summary.collectedValue)}`,
    `- Outstanding value: ${formatCurrency(payload.summary.outstandingValue)}`,
    '',
    '## Settlement rows',
    '',
    ...(payload.rows.length ? payload.rows.map(item => `- ${item.clientName} · ${item.status} ${formatCurrency(item.amount)} · ${item.appointmentStatus}`) : ['- No settlement rows yet.'])
  ].join('
');
  return download('ae-appointment-settlement-brief.md', md, 'text/markdown');
}

function buildAppointmentFunnelDeck() {
  const bridge = ensureAppointmentBridge();
  const handoffs = bridge.handoffs || [];
  const appointments = getAppointmentRecords();
  const summary = {
    handoffs: handoffs.length,
    qualified: handoffs.filter(item => String(item.qualificationStatus || '').toLowerCase() === 'qualified').length,
    booked: appointments.filter(item => ['scheduled', 'booked', 'confirmed', 'completed'].includes(String(item.status || '').toLowerCase())).length,
    completed: appointments.filter(item => String(item.status || '').toLowerCase() === 'completed').length,
    noShow: appointments.filter(item => String(item.status || '').toLowerCase() === 'no-show').length,
    depositsPaid: (ensureAppointmentBridge().depositLedger || []).filter(item => String(item.status || '').toLowerCase() === 'paid').length,
    settlementsPaid: (ensureAppointmentBridge().settlementLedger || []).filter(item => String(item.status || '').toLowerCase() === 'paid').length,
  };
  const aeIds = [...new Set(handoffs.map(item => item.aeId).filter(Boolean).concat(appointments.map(item => item.aeId).filter(Boolean)))];
  const rows = aeIds.map(aeId => {
    const ae = state.aeProfiles.find(item => item.id === aeId) || {};
    const aeHandoffs = handoffs.filter(item => item.aeId === aeId);
    const aeAppointments = appointments.filter(item => item.aeId === aeId);
    const aePaid = (ensureAppointmentBridge().settlementLedger || []).filter(item => item.aeId === aeId && String(item.status || '').toLowerCase() === 'paid').length;
    return {
      aeId,
      aeName: ae.name || aeId,
      handoffs: aeHandoffs.length,
      qualified: aeHandoffs.filter(item => String(item.qualificationStatus || '').toLowerCase() === 'qualified').length,
      booked: aeAppointments.filter(item => ['scheduled', 'booked', 'confirmed', 'completed'].includes(String(item.status || '').toLowerCase())).length,
      completed: aeAppointments.filter(item => String(item.status || '').toLowerCase() === 'completed').length,
      paid: aePaid,
      paidRate: aeHandoffs.length ? Math.round((aePaid / aeHandoffs.length) * 100) : 0
    };
  }).sort((a, b) => (b.paid - a.paid) || (b.handoffs - a.handoffs));
  return { generatedAt: nowIso(), summary, rows: rows.slice(0, 12) };
}

function exportAppointmentFunnelDeck(format = 'json') {
  const payload = buildAppointmentFunnelDeck();
  ensureAppointmentBridge().exports.unshift({ id: uid('brief'), kind: 'appointment-funnel', createdAt: nowIso(), summary: payload.summary });
  persist();
  if (format === 'json') return download('ae-appointment-funnel-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# Appointment Funnel Brief',
    '',
    `Generated at: ${payload.generatedAt}`,
    '',
    `- Handoffs: ${payload.summary.handoffs}`,
    `- Qualified: ${payload.summary.qualified}`,
    `- Booked: ${payload.summary.booked}`,
    `- Completed: ${payload.summary.completed}`,
    `- No-show: ${payload.summary.noShow}`,
    `- Deposits paid: ${payload.summary.depositsPaid}`,
    `- Settlements paid: ${payload.summary.settlementsPaid}`,
    '',
    '## AE rows',
    '',
    ...(payload.rows.length ? payload.rows.map(item => `- ${item.aeName} · handoffs ${item.handoffs} · booked ${item.booked} · paid ${item.paid} · paid-rate ${item.paidRate}%`) : ['- No funnel rows yet.'])
  ].join('
');
  return download('ae-appointment-funnel-brief.md', md, 'text/markdown');
}

function renderAppointmentSettlementCard() {
  const deck = buildAppointmentSettlementDeck();
  return `<div class="card"><div class="eyebrow">Settlement + close pack</div><h3>Invoices, collections, and won-hand-off control</h3><div class="tag-row"><span class="tag">Draft ${deck.summary.draft}</span><span class="tag">Sent ${deck.summary.sent}</span><span class="tag">Paid ${deck.summary.paid}</span><span class="tag">Collected ${escapeHtml(formatCurrency(deck.summary.collectedValue))}</span></div><div class="list">${deck.rows.length ? deck.rows.slice(0,6).map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.status)} · ${escapeHtml(formatCurrency(item.amount))} · ${escapeHtml(item.appointmentStatus)}</div><div class="toolbar"><button class="btn-soft" data-act="appointment-invoice-send" data-id="${item.appointmentId}">Send invoice</button><button class="btn-soft" data-act="appointment-invoice-paid" data-id="${item.appointmentId}">Mark paid</button><button class="btn-soft" data-act="appointment-close-pack" data-id="${item.appointmentId}">Close pack</button></div></div>`).join('') : '<div class="item"><div class="meta">No settlement rows yet.</div></div>'}</div><div class="toolbar"><button class="btn-soft" id="export-appointment-settlement-json">Export settlement JSON</button><button class="btn-soft" id="export-appointment-settlement-md">Export settlement Markdown</button></div></div>`;
}

function renderAppointmentFunnelCard() {
  const deck = buildAppointmentFunnelDeck();
  const conversion = deck.summary.handoffs ? Math.round((Number(deck.summary.settlementsPaid || 0) / Number(deck.summary.handoffs || 1)) * 100) : 0;
  return `<div class="card"><div class="eyebrow">Funnel analytics</div><h3>Handoff-to-revenue conversion by AE lane</h3><div class="tag-row"><span class="tag">Handoffs ${deck.summary.handoffs}</span><span class="tag">Booked ${deck.summary.booked}</span><span class="tag">Paid ${deck.summary.settlementsPaid}</span><span class="tag">Paid-rate ${conversion}%</span></div><div class="list">${deck.rows.length ? deck.rows.slice(0,6).map(item => `<div class="item"><h4>${escapeHtml(item.aeName)}</h4><div class="meta">handoffs ${item.handoffs} · qualified ${item.qualified} · booked ${item.booked} · completed ${item.completed} · paid ${item.paid}</div><p>${escapeHtml(`Paid-rate ${item.paidRate}% across AE-owned appointment traffic.`)}</p></div>`).join('') : '<div class="item"><div class="meta">No appointment funnel rows yet.</div></div>'}</div><div class="toolbar"><button class="btn-soft" id="export-appointment-funnel-json">Export funnel JSON</button><button class="btn-soft" id="export-appointment-funnel-md">Export funnel Markdown</button></div></div>`;
}

function renderAppointmentBrain() {
  const summary = getAppointmentDeskSummary();
  const handoffs = getAppointmentLeadQueue(25);
  const bookings = getAppointmentBookingQueue(25);
  const returns = getAppointmentReturnQueue(25);
  const donor = ensureAppointmentBridge().importedRuntime || {};
  return `
    <section class="card">
      <div class="eyebrow">0megaPhase integration</div>
      <h3>AE Command + Appointment Setter Brain</h3>
      <p>This lane treats the appointment setter as another brain under AE Command, with one handoff payload, one booking queue, reminder task creation, no-show recovery, sequence automation, slot planning, and outcome sync back into the AE dossier.</p>
      <div class="toolbar"><button class="btn-soft" id="refresh-appointment-runtime">Refresh donor runtime seed</button><button class="btn-soft" id="export-appointment-brief-json">Export appointment JSON</button><button class="btn-soft" id="export-appointment-brief-md">Export appointment Markdown</button><button class="btn-soft" id="export-appointment-sequence-json">Export sequence JSON</button><button class="btn-soft" id="export-appointment-sequence-md">Export sequence Markdown</button><button class="btn-soft" id="export-appointment-revenue-json">Export revenue JSON</button><button class="btn-soft" id="export-appointment-revenue-md">Export revenue Markdown</button><button class="btn-soft" id="export-appointment-calendar-json">Export calendar JSON</button><button class="btn-soft" id="export-appointment-calendar-md">Export calendar Markdown</button><button class="btn-soft" id="export-appointment-settlement-json">Export settlements JSON</button><button class="btn-soft" id="export-appointment-settlement-md">Export settlements Markdown</button><button class="btn-soft" id="export-appointment-funnel-json">Export funnel JSON</button><button class="btn-soft" id="export-appointment-funnel-md">Export funnel Markdown</button><button class="btn-soft" id="export-appointment-sync-json">Export sync JSON</button><button class="btn-soft" id="export-appointment-sync-md">Export sync Markdown</button><button class="btn-soft" id="export-appointment-fulfillment-json">Export fulfillment JSON</button><button class="btn-soft" id="export-appointment-fulfillment-md">Export fulfillment Markdown</button><button class="btn-soft" id="export-appointment-orchestration-json">Export orchestration JSON</button><button class="btn-soft" id="export-appointment-orchestration-md">Export orchestration Markdown</button><button class="btn-soft" id="export-appointment-profitability-json">Export profitability JSON</button><button class="btn-soft" id="export-appointment-profitability-md">Export profitability Markdown</button><button class="btn-soft" id="export-omega-brief-json">Export 0mega JSON</button><button class="btn-soft" id="export-omega-brief-md">Export 0mega Markdown</button><a class="btn-soft" href="../AI-Appointment-Setter-Brain-v33/static/admin/index.html" target="_blank" rel="noopener">Launch donor admin</a></div>
      <div class="tag-row"><span class="tag">Handoffs ${summary.handoffs}</span><span class="tag">Open ${summary.openHandoffs}</span><span class="tag">Qualified ${summary.qualified}</span><span class="tag">Booked ${summary.booked}</span><span class="tag">Reminders ${summary.reminders}</span><span class="tag">Risk ${summary.noShowRisk}</span><span class="tag">Returned ${summary.returned}</span><span class="tag">Donor ${escapeHtml(summary.donorStatus)}</span></div>
      <div class="meta">Donor runtime smoke: ${escapeHtml(String(donor.checksPassed || 0))}/${escapeHtml(String(donor.checksTotal || 0))} checks${donor.error ? ` · ${escapeHtml(donor.error)}` : ''}</div>
    </section>
    <section class="kpi-grid">
      ${statCard('Appointment handoffs', summary.handoffs, 'Clients moved from AE command into booking qualification')}
      ${statCard('Open handoffs', summary.openHandoffs, 'Still waiting for booking action')}
      ${statCard('Booked appointments', summary.booked, 'Appointment records active in the bridge lane')}
      ${statCard('No-show pressure', summary.noShowRisk, 'Appointments needing stronger reminder handling')}
    </section>
    <section class="grid-2">
      <div class="card"><div class="eyebrow">Handoff queue</div><h3>Clients sent into the appointment brain</h3><div class="list">${handoffs.length ? handoffs.map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.company || 'No company')} · ${escapeHtml(item.aeName || 'No AE')} · ${escapeHtml(item.status)} · ${escapeHtml(item.qualificationStatus)}</div><p>${escapeHtml(item.nextStep || item.notes || 'No next step recorded.')}</p><div class="toolbar"><button class="btn-soft" data-act="appointment-open-client" data-id="${item.clientId}">Open client</button><button class="btn-soft" data-act="appointment-book" data-id="${item.id}">Book</button><button class="btn-soft" data-act="appointment-sequence-enroll" data-id="${item.id}">Sequence</button></div></div>`).join('') : '<div class="item"><div class="meta">No handoffs are currently queued.</div></div>'}</div></div>
      <div class="card"><div class="eyebrow">Booking board</div><h3>Appointments, reminders, slot repair, and no-show recovery</h3><div class="list">${bookings.length ? bookings.map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(String(item.startAt || '').slice(0,16) || 'unscheduled')} · ${escapeHtml(item.status)} · ${escapeHtml(item.risk.label)} · reminder ${escapeHtml(item.reminderState || 'none')}</div><p>${escapeHtml(item.notes || 'No appointment notes captured.')}</p><div class="toolbar"><button class="btn-soft" data-act="appointment-reminder-task" data-id="${item.id}">Reminder task</button><button class="btn-soft" data-act="appointment-slot-plan" data-id="${item.id}">Slot plan</button><button class="btn-soft" data-act="appointment-deposit-request" data-id="${item.id}">Request deposit</button><button class="btn-soft" data-act="appointment-deposit-paid" data-id="${item.id}">Deposit paid</button><button class="btn-soft" data-act="appointment-invoice-send" data-id="${item.id}">Send invoice</button><button class="btn-soft" data-act="appointment-invoice-paid" data-id="${item.id}">Invoice paid</button><button class="btn-soft" data-act="appointment-fulfillment-create" data-id="${item.id}">Fulfillment packet</button><button class="btn-soft" data-act="appointment-close-pack" data-id="${item.id}">Close pack</button><button class="btn-soft" data-act="appointment-outcome-qualified" data-id="${item.id}">Qualify</button><button class="btn-soft" data-act="appointment-complete" data-id="${item.id}">Complete</button><button class="btn-soft" data-act="appointment-noshow" data-id="${item.id}">No-show</button><button class="btn-soft" data-act="appointment-return" data-id="${item.id}">Return to AE</button></div></div>`).join('') : '<div class="item"><div class="meta">No appointment records are currently active.</div></div>'}</div></div>
    </section>
    <section class="grid-2">
      <div class="card"><div class="eyebrow">Return queue</div><h3>Appointment outcomes that need AE command follow-through</h3><div class="list">${returns.length ? returns.map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.status)} · ${escapeHtml(item.aeName || 'No AE')} · ${escapeHtml(item.returnNote || item.nextStep || 'No note')}</div><div class="toolbar"><button class="btn-soft" data-act="appointment-open-client" data-id="${item.clientId}">Open client</button></div></div>`).join('') : '<div class="item"><div class="meta">Nothing is waiting to return to AE command.</div></div>'}</div></div>
      <div class="card"><div class="eyebrow">Bridge contract</div><h3>One canonical handoff payload</h3><p>The bridge payload carries AE owner, qualification state, next step, notes, value context, follow-up timing, sequence status, slot suggestions, and outcome sync state so the appointment desk can act without re-intaking the account.</p><div class="tag-row"><span class="tag">clientId</span><span class="tag">aeId</span><span class="tag">qualificationStatus</span><span class="tag">nextStep</span><span class="tag">estimatedValue</span><span class="tag">followUpDate</span><span class="tag">targetCloseDate</span><span class="tag">slotTemplateId</span><span class="tag">outcome</span><span class="tag">tags</span></div></div>
    </section>
    <section class="grid-2">
      ${renderAppointmentSequenceCard()}
      ${renderAppointmentCoverageCard()}
    </section>
    <section class="grid-2">
      ${renderAppointmentRevenueCard()}
      ${renderAppointmentCalendarCard()}
    </section>
    <section class="grid-2">
      ${renderAppointmentSettlementCard()}
      ${renderAppointmentFunnelCard()}
    </section>
    <section class="grid-2">
      ${renderAppointmentSyncCard()}
      ${renderAppointmentFulfillmentCard()}
    </section>
    <section class="grid-2">
      ${renderAppointmentOrchestrationCard()}
      ${renderAppointmentProfitabilityCard()}
    </section>`;
}



function bindAppointmentBrain() {
  $('#refresh-appointment-runtime')?.addEventListener('click', async () => {
    ensureAppointmentBridge().importedRuntime = {};
    await loadAppointmentDonorRuntimeSeed();
    render();
  });
  $('#export-appointment-brief-json')?.addEventListener('click', () => exportAppointmentBridgeBrief('json'));
  $('#export-appointment-brief-md')?.addEventListener('click', () => exportAppointmentBridgeBrief('markdown'));
  $('#export-appointment-sequence-json')?.addEventListener('click', () => exportAppointmentSequenceBrief('json'));
  $('#export-appointment-sequence-md')?.addEventListener('click', () => exportAppointmentSequenceBrief('markdown'));
  $('#export-appointment-revenue-json')?.addEventListener('click', () => exportAppointmentRevenueDeck('json'));
  $('#export-appointment-revenue-md')?.addEventListener('click', () => exportAppointmentRevenueDeck('markdown'));
  $('#export-appointment-calendar-json')?.addEventListener('click', () => exportAppointmentCalendarDeck('json'));
  $('#export-appointment-calendar-md')?.addEventListener('click', () => exportAppointmentCalendarDeck('markdown'));
  $('#export-appointment-settlement-json')?.addEventListener('click', () => exportAppointmentSettlementDeck('json'));
  $('#export-appointment-settlement-md')?.addEventListener('click', () => exportAppointmentSettlementDeck('markdown'));
  $('#export-appointment-funnel-json')?.addEventListener('click', () => exportAppointmentFunnelDeck('json'));
  $('#export-appointment-funnel-md')?.addEventListener('click', () => exportAppointmentFunnelDeck('markdown'));
  $('#export-appointment-sync-json')?.addEventListener('click', () => exportAppointmentSyncDeck('json'));
  $('#export-appointment-sync-md')?.addEventListener('click', () => exportAppointmentSyncDeck('markdown'));
  $('#export-appointment-fulfillment-json')?.addEventListener('click', () => exportAppointmentFulfillmentDeck('json'));
  $('#export-appointment-fulfillment-md')?.addEventListener('click', () => exportAppointmentFulfillmentDeck('markdown'));
  $('#run-appointment-rescue')?.addEventListener('click', () => { runAppointmentRescuePack('watch'); render(); });
  $('#run-appointment-noshow-rescue')?.addEventListener('click', () => { runAppointmentRescuePack('no-show'); render(); });
  $('#export-omega-brief-json')?.addEventListener('click', () => exportOmegaCommandBrief('json'));
  $('#export-omega-brief-md')?.addEventListener('click', () => exportOmegaCommandBrief('markdown'));
  $('#open-appointment-brain')?.addEventListener('click', () => { page = 'appointment-brain'; renderNav(); render(); });
  document.querySelectorAll('[data-act="open-appointment-page"]').forEach(btn => btn.addEventListener('click', () => { page = 'appointment-brain'; renderNav(); render(); }));
  document.querySelectorAll('[data-act="open-appointment-client"], [data-act="appointment-open-client"], [data-act="appointment-sequence-open-client"]').forEach(btn => btn.addEventListener('click', () => { page = 'clients'; renderNav(); render(); renderClientHistory(btn.dataset.id, true); }));
  document.querySelectorAll('[data-act="appointment-book"]').forEach(btn => btn.addEventListener('click', () => { createAppointmentFromHandoff(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="appointment-sequence-enroll"]').forEach(btn => btn.addEventListener('click', () => { enrollAppointmentSequence(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="appointment-sequence-advance"]').forEach(btn => btn.addEventListener('click', () => { advanceAppointmentSequence(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="appointment-sequence-responded"]').forEach(btn => btn.addEventListener('click', () => { markAppointmentSequenceResponded(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="appointment-reminder-task"]').forEach(btn => btn.addEventListener('click', () => { createAppointmentReminderTask(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="appointment-slot-plan"]').forEach(btn => btn.addEventListener('click', () => { scheduleAppointmentFromCoverage(btn.dataset.id); syncAppointmentOutcomeToClient(btn.dataset.id, 'reschedule'); render(); }));
  document.querySelectorAll('[data-act="appointment-deposit-request"]').forEach(btn => btn.addEventListener('click', () => { requestAppointmentDeposit(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="appointment-deposit-paid"]').forEach(btn => btn.addEventListener('click', () => { setAppointmentDepositStatus(btn.dataset.id, 'paid'); render(); }));
  document.querySelectorAll('[data-act="appointment-invoice-send"]').forEach(btn => btn.addEventListener('click', () => { setAppointmentSettlementStatus(btn.dataset.id, 'sent'); render(); }));
  document.querySelectorAll('[data-act="appointment-invoice-paid"]').forEach(btn => btn.addEventListener('click', () => { setAppointmentSettlementStatus(btn.dataset.id, 'paid'); render(); }));
  document.querySelectorAll('[data-act="appointment-fulfillment-create"]').forEach(btn => btn.addEventListener('click', () => { createAppointmentFulfillmentPacket(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="appointment-close-pack"]').forEach(btn => btn.addEventListener('click', () => { createAppointmentClosePackTask(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="appointment-outcome-qualified"]').forEach(btn => btn.addEventListener('click', () => { syncAppointmentOutcomeToClient(btn.dataset.id, 'qualified'); render(); }));
  document.querySelectorAll('[data-act="appointment-outcome-reschedule"]').forEach(btn => btn.addEventListener('click', () => { syncAppointmentOutcomeToClient(btn.dataset.id, 'reschedule'); render(); }));
  document.querySelectorAll('[data-act="appointment-complete"]').forEach(btn => btn.addEventListener('click', () => { setAppointmentStatus(btn.dataset.id, 'completed', 'Appointment completed'); syncAppointmentOutcomeToClient(btn.dataset.id, 'qualified'); render(); }));
  document.querySelectorAll('[data-act="appointment-noshow"]').forEach(btn => btn.addEventListener('click', () => { setAppointmentStatus(btn.dataset.id, 'no-show', 'No-show recovery needed'); enrollAppointmentSequence(getAppointmentRecords().find(item => item.id === btn.dataset.id)?.handoffId || '', 'show-up-defense'); render(); }));
  document.querySelectorAll('[data-act="appointment-return"]').forEach(btn => btn.addEventListener('click', () => { syncAppointmentOutcomeToClient(btn.dataset.id, 'disqualified'); returnAppointmentClientToAe(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="appointment-sync-retry"]').forEach(btn => btn.addEventListener('click', () => { retryAppointmentSyncPacket(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="appointment-sync-resolve"]').forEach(btn => btn.addEventListener('click', () => { resolveAppointmentSyncPacket(btn.dataset.id); render(); }));
  $('#export-appointment-orchestration-json')?.addEventListener('click', () => exportAppointmentOrchestrationDeck('json'));
  $('#export-appointment-orchestration-md')?.addEventListener('click', () => exportAppointmentOrchestrationDeck('markdown'));
  $('#export-appointment-profitability-json')?.addEventListener('click', () => exportAppointmentProfitabilityDeck('json'));
  $('#export-appointment-profitability-md')?.addEventListener('click', () => exportAppointmentProfitabilityDeck('markdown'));
  $('#appointment-sync-retry-all')?.addEventListener('click', () => { retryAllAppointmentSyncPackets(); render(); });
  $('#appointment-sync-resolve-ready')?.addEventListener('click', () => { resolveReadyAppointmentSyncPackets(); render(); });
  document.querySelectorAll('[data-act="appointment-profit-open-client"]').forEach(btn => btn.addEventListener('click', () => { page = 'clients'; renderNav(); render(); renderClientHistory(btn.dataset.id, true); }));
  document.querySelectorAll('[data-act="appointment-fulfillment-template"]').forEach(btn => btn.addEventListener('click', () => { applyAppointmentFulfillmentTemplate(btn.dataset.id, 'service-launch'); render(); }));
  document.querySelectorAll('[data-act="appointment-fulfillment-template-premium"]').forEach(btn => btn.addEventListener('click', () => { applyAppointmentFulfillmentTemplate(btn.dataset.id, 'premium-whiteglove'); render(); }));
  document.querySelectorAll('[data-act="appointment-sync-open-client"], [data-act="appointment-fulfillment-open-client"]').forEach(btn => btn.addEventListener('click', () => { page = 'clients'; renderNav(); render(); renderClientHistory(btn.dataset.id, true); }));
  document.querySelectorAll('[data-act="appointment-fulfillment-progress"]').forEach(btn => btn.addEventListener('click', () => { setAppointmentFulfillmentStatus(btn.dataset.id, 'in-progress'); render(); }));
  document.querySelectorAll('[data-act="appointment-fulfillment-blocked"]').forEach(btn => btn.addEventListener('click', () => { setAppointmentFulfillmentStatus(btn.dataset.id, 'blocked'); render(); }));
  document.querySelectorAll('[data-act="appointment-fulfillment-complete"]').forEach(btn => btn.addEventListener('click', () => { setAppointmentFulfillmentStatus(btn.dataset.id, 'completed'); render(); }));
}


function renderDashboard() {
  const enabled = state.aeProfiles.filter(ae => ae.enabled).length;
  const disabled = state.aeProfiles.length - enabled;
  const assigned = state.clients.filter(client => client.assignedAeId).length;
  const stageCounts = getClientStageCounts();
  const priorityCounts = getClientPriorityCounts();
  const followupCounts = getFollowupCounts();
  const followupQueue = getFollowupQueue();
  const clientHealthCounts = getClientHealthCounts();
  const atRiskClients = getAtRiskClients();
  const threadFreshnessCounts = getThreadFreshnessCounts();
  const staleThreads = getStaleThreads();
  const awaitingResponseCounts = getAwaitingResponseCounts();
  const awaitingThreads = getAwaitingResponseThreads();
  const workloadAlerts = getAeWorkloadAlerts();
  const taskDueCounts = getTaskDueCounts();
  const dependencyCounts = getTaskDependencyCounts();
  const dependencyQueue = getDependencyBlockedTasks();
  const aePerformanceRows = buildAePerformanceRows();
  const recentTasks = [...state.tasks].sort((a,b) => (b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0, 6);
  const taskQueue = getTaskQueue();
  const milestoneCounts = getMilestoneCounts();
  const milestoneQueue = getMilestoneQueue();
  const effortSummary = getTaskEffortSummary();
  const effortQueue = getTaskEffortQueue();
  const threadSummaryCounts = getThreadSummaryCounts();
  const openQuestionThreads = getOpenQuestionThreads();
  const alertCounts = getAlertInboxCounts();
  const revenueSnapshot = getRevenueSnapshot();
  const pipelineQueue = getPipelineQueue();
  const coverageAlerts = getAeCoverageAlerts();
  const commandPlanner = getSevenDayCommandPlan();
  const loadRows = state.aeProfiles.map(ae => {
    const capacity = getAeCapacityState(ae);
    return `
    <tr>
      <td>${ae.name}<div class="meta">${ae.title}</div></td>
      <td>${capacity === 'healthy' ? '<span class="status-pill status-ok">Healthy</span>' : capacity === 'over-cap' ? '<span class="status-pill status-warn">Over cap</span>' : '<span class="status-pill status-bad">Disabled</span>'}</td>
      <td>${ae.assignments}</td>
      <td>${ae.overrideDailyCap || ae.dailyCap}</td>
      <td>${ae.overrideMonthlyCap || ae.monthlyCap}</td>
    </tr>`;
  }).join('');
  return `
    <section class="hero">
      <div class="card">
        <div class="eyebrow">Foundational branch app</div>
        <h3>AE Brain Command Site is now inside this pack as an additive branch app.</h3>
        <p>This pass adds the missing AE-focused command surface into the current zip instead of replacing the launcher or the credential shell. It stays offline-first, exportable, and smoke-backed.</p>
        <div class="tag-row">
          <span class="tag">13 AE brains</span>
          <span class="tag">Instant assignment</span>
          <span class="tag">Manual reassignment</span>
          <span class="tag">Bulk client actions</span>
          <span class="tag">Transcript search</span>
          <span class="tag">Directive tracking</span>
          <span class="tag">Follow-up queue</span>
        </div>
      </div>
      <div class="hero-image card"><img src="./assets/logo.png" alt="Skyes Over London logo"></div>
    </section>
    <section class="kpi-grid">
      ${statCard('AE profiles', state.aeProfiles.length, 'Roster loaded from ae-roster.json')}
      ${statCard('Enabled AEs', enabled, 'Ready for routing')}
      ${statCard('Assigned clients', assigned, 'Clients with active owner')}
      ${statCard('Open tasks', countOpenTasks(), 'Task board still in motion')}
    </section>
    <section class="kpi-grid">
      ${statCard('Transcript threads', countActiveThreads(), 'Saved offline thread ledger')}
      ${statCard('Messages logged', state.messages.length, 'Transcript messages stored locally')}
      ${statCard('Active-stage clients', stageCounts.active || 0, 'Currently in active delivery')}
      ${statCard('Urgent clients', priorityCounts.urgent || 0, 'Priority flagged for immediate attention')}
    </section>
    <section class="kpi-grid">
      ${statCard('Audit rows', state.auditLog.length, 'Assignment, task, and AE status events')}
      ${statCard('Disabled AEs', disabled, 'Temporarily out of routing rotation')}
      ${statCard('Follow-ups overdue', followupCounts.overdue || 0, 'Past the follow-up date')}
      ${statCard('Follow-ups today', followupCounts.today || 0, 'Need action today')}
    </section>
    <section class="kpi-grid">
      ${statCard('Healthy clients', clientHealthCounts.healthy || 0, 'Low-risk relationship state')}
      ${statCard('Watch clients', clientHealthCounts.watch || 0, 'Needs closer operator attention')}
      ${statCard('Critical clients', clientHealthCounts.critical || 0, 'Most at-risk accounts right now')}
      ${statCard('At-risk queue', atRiskClients.length, 'Immediate operator review list')}
    </section>
    <section class="kpi-grid">
      ${statCard('Stale threads', threadFreshnessCounts.stale || 0, 'Open threads needing operator response')}
      ${statCard('Thread watch', threadFreshnessCounts.watch || 0, 'Open threads aging into risk')}
      ${statCard('AE workload alerts', workloadAlerts.length, 'AEs needing rebalance review')}
      ${statCard('Resolved threads', threadFreshnessCounts.resolved || 0, 'Closed transcript lanes')}
    </section>
    <section class="kpi-grid">
      ${statCard('Awaiting replies', awaitingResponseCounts.awaiting || 0, 'Threads with latest inbound user message still unanswered')}
      ${statCard('Critical waits', awaitingResponseCounts.critical || 0, 'Awaiting replies older than 48 hours')}
      ${statCard('Dependency waiting', dependencyCounts.waiting || 0, 'Tasks blocked by incomplete dependencies')}
      ${statCard('AE pressure rows', aePerformanceRows.filter(row => row.status !== 'healthy').length, 'AEs needing closer operational review')}
    </section>
    <section class="kpi-grid">
      ${statCard('Recurring open tasks', getRecurringOpenTaskCount(), 'Tasks with an active repeat cadence')}
      ${statCard('IndexedDB lane', storageBridge.indexedDb ? 'Active' : 'Pending', storageBridge.indexedDb ? 'Hybrid browser storage is live' : 'Waiting for hybrid browser storage')}
      ${statCard('Neon sync lane', storageBridge.neonSync || 'idle', storageBridge.neonSync === 'synced' ? 'Indexed storage is syncing to Neon' : 'Hybrid sync awaiting remote confirmation')}
      ${statCard('Cold clients', getClientTouchCounts().cold || 0, 'No-touch clients older than 14 days')}
    </section>
    <section class="card">
      <div class="section-head"><div><div class="eyebrow">Hybrid storage bridge</div><h2>Local storage + IndexedDB + Neon snapshot line</h2></div></div>
      <div class="quick-list" style="margin-top:14px">
        <div class="quick-item"><span>Latest snapshot source</span><span class="status-pill">${storageBridge.source}</span></div>
        <div class="quick-item"><span>Latest local snapshot</span><span class="status-pill">${storageBridge.snapshotAt || 'Not saved yet'}</span></div>
        <div class="quick-item"><span>Neon sync state</span><span class="status-pill">${storageBridge.neonSync || 'idle'}</span></div>
        ${Array.isArray(storageBridge.syncEvents) && storageBridge.syncEvents.length ? storageBridge.syncEvents.map(event => `<div class="quick-item"><span>${event.status} · ${event.detail || event.source || 'storage sync'}</span><span class="status-pill">${event.createdAt || ''}</span></div>`).join('') : '<div class="quick-item"><span>No indexed-storage sync events yet.</span><span class="status-pill">Idle</span></div>'}
      </div>
    </section>
    <section class="kpi-grid">
      ${statCard('Milestones overdue', milestoneCounts.overdue || 0, 'Accounts behind on the current milestone')}
      ${statCard('Milestones due today', milestoneCounts.today || 0, 'Client milestone checkpoints due now')}
      ${statCard('Task effort overruns', effortSummary.overrun || 0, 'Tasks already beyond estimated minutes')}
      ${statCard('Open thread questions', threadSummaryCounts.openQuestions || 0, 'Threads carrying unresolved operator questions')}
    </section>
    <section class="kpi-grid">
      ${statCard('Active alerts', alertCounts.total || 0, 'Unified inbox across client, task, and thread risk')}
      ${statCard('Critical alerts', alertCounts.critical || 0, 'Highest-priority command issues')}
      ${statCard('Client alerts', alertCounts.client || 0, 'Relationship and milestone pressure')}
      ${statCard('Task + thread alerts', (alertCounts.task || 0) + (alertCounts.thread || 0), 'Execution and response risk')}
    </section>
    <section class="kpi-grid">
      ${statCard('Weighted pipeline', formatCurrency(revenueSnapshot.weightedPipeline), 'Probability-adjusted open revenue')}
      ${statCard('Total pipeline', formatCurrency(revenueSnapshot.totalPipeline), 'Open client estimated value')}
      ${statCard('Monthly managed', formatCurrency(revenueSnapshot.monthlyManaged), 'Recurring monthly account value')}
      ${statCard('Coverage alerts', coverageAlerts.length, 'AEs in focus, backup, out, or disabled states')}
    </section>
    <section class="grid-2">
      <div class="card"><div class="eyebrow">Revenue forecast</div><h3>Pipeline, weighted value, and close targets</h3><div class="toolbar"><button class="btn-soft" id="export-revenue-brief-json">Export JSON</button><button class="btn-soft" id="export-revenue-brief-md">Export Markdown</button></div><div class="tag-row"><span class="tag">Enterprise ${revenueSnapshot.byTier.enterprise || 0}</span><span class="tag">Premium ${revenueSnapshot.byTier.premium || 0}</span><span class="tag">Standard ${revenueSnapshot.byTier.standard || 0}</span><span class="tag">Unscored ${revenueSnapshot.byTier.unscored || 0}</span></div><div class="list">${pipelineQueue.length ? pipelineQueue.map(item => `<div class="item"><h4>${escapeHtml(item.client.name)}</h4><div class="meta">${escapeHtml(item.client.assignedAeName || 'Unassigned')} · ${escapeHtml(item.client.stage || 'intake')} · ${escapeHtml(item.valueTier)}${item.client.targetCloseDate ? ` · target ${escapeHtml(item.client.targetCloseDate)}` : ''}</div><div class="meta">estimated ${formatCurrency(getClientEstimatedValue(item.client))} · weighted ${formatCurrency(item.weightedValue)} · monthly ${formatCurrency(getClientMonthlyValue(item.client))} · probability ${getClientCloseProbability(item.client)}%</div><div class="toolbar"><button class="btn-soft" data-act="dashboard-open-client" data-id="${item.client.id}">Open</button></div></div>`).join('') : '<div class="item"><div class="meta">No revenue-scored clients yet.</div></div>'}</div></div>
      <div class="card"><div class="eyebrow">Coverage planner</div><h3>Availability-aware AE coverage and next 7 days</h3><div class="toolbar"><button class="btn-soft" id="export-command-planner-json">Planner JSON</button><button class="btn-soft" id="export-command-planner-md">Planner Markdown</button></div><div class="eyebrow" style="margin-top:12px">Coverage alerts</div><div class="list">${coverageAlerts.length ? coverageAlerts.map(item => `<div class="item"><h4>${escapeHtml(item.ae.name)}</h4><div class="meta">${escapeHtml(item.availability.label)} · affected clients ${item.affectedClients.length}</div><p>${escapeHtml(item.availability.detail || 'No coverage note.')}</p><div class="toolbar"><button class="btn-soft" data-act="workload-open-clients" data-id="${item.ae.id}">Open clients</button><button class="btn-soft" data-act="workload-rebalance-ae" data-id="${item.ae.id}">Rebalance</button></div></div>`).join('') : '<div class="item"><div class="meta">No AE coverage alerts right now.</div></div>'}</div><div class="eyebrow" style="margin-top:12px">Next 7 days</div><div class="list">${commandPlanner.length ? commandPlanner.map(item => `<div class="item"><h4>${escapeHtml(item.label)}</h4><div class="meta">${escapeHtml(item.date)} · ${escapeHtml(item.kind)} · ${escapeHtml(item.meta)}</div><div class="toolbar"><button class="btn-soft" data-act="${item.openPage === 'tasks' ? 'dashboard-open-task' : 'dashboard-open-client'}" data-id="${item.id}">Open</button></div></div>`).join('') : '<div class="item"><div class="meta">No dated work is scheduled in the next 7 days.</div></div>'}</div></div>
    </section>
    <section class="runtime-grid">
      ${statCard('Founder session', founderSession.authenticated ? 'Signed in' : 'Local only', founderSession.authenticated ? founderSession.email : 'No server session')}
      ${statCard('Remote state', remoteStateStatus, 'Shared branch snapshot lane')}
      ${statCard('Live brain lane', liveBrainStatus, 'Root function donor runtime')}
      ${statCard('Primary route', '/.netlify/functions/ae-brain-chat', '13 key slots server-side')}
    </section>
    <section class="runtime-grid">
      ${statCard('Configured OpenAI slots', remoteHealth?.configured?.openai ?? 0, 'Server health reported')}
      ${statCard('Configured fallback slots', ((remoteHealth?.configured?.anthropic ?? 0) + (remoteHealth?.configured?.gemini ?? 0)), 'Anthropic + Gemini')}
      ${statCard('Remote usage rows', remoteUsage.recent?.length || 0, 'Recent live calls loaded')}
      ${statCard('Remote audit rows', remoteAudit.length || 0, 'Recent server audit events')}
    </section>
    <section class="grid-2">
      <div class="card">
        <div class="eyebrow">AE load</div>
        <h3>Roster load and cap view</h3>
        <div class="table-wrap"><table><thead><tr><th>AE</th><th>Status</th><th>Assignments</th><th>Daily cap</th><th>Monthly cap</th></tr></thead><tbody>${loadRows}</tbody></table></div>
      </div>
      <div class="grid-2">
        <div class="card"><div class="eyebrow">Task due queue</div><h3>Overdue, today, and upcoming task actions</h3><div class="tag-row"><span class="tag">Overdue ${taskDueCounts.overdue || 0}</span><span class="tag">Today ${taskDueCounts.today || 0}</span><span class="tag">Upcoming ${taskDueCounts.upcoming || 0}</span></div><div class="list">${taskQueue.length ? taskQueue.map(task => { const due = getTaskDueState(task); return `<div class="item"><h4>${escapeHtml(task.title)}</h4><div class="meta">${escapeHtml(task.status || 'todo')} · ${escapeHtml(task.assignedAeName || 'Unassigned')} · ${escapeHtml(task.clientName || 'No client linked')} · ${escapeHtml(due.label)}</div><p>${escapeHtml(task.notes || 'No task notes yet.')}</p>${task.blockerNote ? `<div class="meta">Blocker: ${escapeHtml(task.blockerNote)}</div>` : ''}<div class="toolbar"><button class="btn-soft" data-act="dashboard-open-task" data-id="${task.id}">Open</button><button class="btn-soft" data-act="task-snooze-1" data-id="${task.id}">+1 day</button><button class="btn-soft" data-act="task-snooze-7" data-id="${task.id}">+7 days</button><button class="btn-soft" data-act="task-complete" data-id="${task.id}">Done</button></div></div>`; }).join('') : '<div class="item"><div class="meta">No dated open tasks yet.</div></div>'}</div></div>
        <div class="card"><div class="eyebrow">Follow-up queue</div><h3>Next client actions by date</h3><div class="list">${followupQueue.length ? followupQueue.map(client => { const due = getClientDueState(client); return `<div class="item"><h4>${escapeHtml(client.name)}</h4><div class="meta">${escapeHtml(client.company || 'No company')} · ${escapeHtml(client.assignedAeName || 'Unassigned')} · ${escapeHtml(due.label)}</div><p>${escapeHtml(client.nextStep || 'No next step set.')}</p><div class="toolbar"><button class="btn-soft" data-act="dashboard-open-client" data-id="${client.id}">Open</button><button class="btn-soft" data-act="followup-snooze-1" data-id="${client.id}">+1 day</button><button class="btn-soft" data-act="followup-snooze-7" data-id="${client.id}">+7 days</button><button class="btn-soft" data-act="followup-complete" data-id="${client.id}">Done</button><button class="btn-soft" data-act="followup-to-task" data-id="${client.id}">Create task</button></div></div>`; }).join('') : '<div class="item"><div class="meta">No follow-up dates set yet.</div></div>'}</div></div>
      </div>
    </section>

    <section class="grid-2">
      <div class="card"><div class="eyebrow">Milestone queue</div><h3>Client milestone tracking</h3><div class="tag-row"><span class="tag">Overdue ${milestoneCounts.overdue || 0}</span><span class="tag">Today ${milestoneCounts.today || 0}</span><span class="tag">Active ${milestoneCounts.active || 0}</span><span class="tag">Near ${milestoneCounts.near || 0}</span></div><div class="list">${milestoneQueue.length ? milestoneQueue.map(item => `<div class="item"><h4>${escapeHtml(item.client.name)}</h4><div class="meta">${escapeHtml(item.client.company || 'No company')} · ${escapeHtml(item.client.assignedAeName || 'Unassigned')} · ${escapeHtml(item.milestone.label)}</div><p>${escapeHtml(item.client.nextStep || 'No next step set.')}</p><div class="toolbar"><button class="btn-soft" data-act="milestone-open-client" data-id="${item.client.id}">Open</button><button class="btn-soft" data-act="milestone-progress" data-id="${item.client.id}" data-step="25">+25%</button><button class="btn-soft" data-act="milestone-progress" data-id="${item.client.id}" data-step="50">+50%</button><button class="btn-soft" data-act="milestone-clear" data-id="${item.client.id}">Clear</button></div></div>`).join('') : '<div class="item"><div class="meta">No active milestone checkpoints are currently set.</div></div>'}</div></div>
      <div class="card"><div class="eyebrow">Task effort queue</div><h3>Estimated vs actual effort</h3><div class="tag-row"><span class="tag">Estimated ${effortSummary.estimated || 0} min</span><span class="tag">Actual ${effortSummary.actual || 0} min</span><span class="tag">Remaining ${effortSummary.remaining || 0} min</span><span class="tag">Overruns ${effortSummary.overrun || 0}</span></div><div class="list">${effortQueue.length ? effortQueue.map(item => `<div class="item"><h4>${escapeHtml(item.task.title)}</h4><div class="meta">${escapeHtml(item.task.assignedAeName || 'No AE')} · ${escapeHtml(item.task.clientName || 'No client linked')} · ${escapeHtml(item.effort.label)}</div><p>${escapeHtml(item.task.notes || 'No task notes yet.')}</p><div class="toolbar"><button class="btn-soft" data-act="dashboard-open-task" data-id="${item.task.id}">Open</button><button class="btn-soft" data-act="task-add-effort" data-id="${item.task.id}" data-minutes="15">+15 min</button><button class="btn-soft" data-act="task-add-effort" data-id="${item.task.id}" data-minutes="30">+30 min</button></div></div>`).join('') : '<div class="item"><div class="meta">No estimated effort rows are active yet.</div></div>'}</div></div>
    </section>
    <section class="grid-2">
      <div class="card"><div class="eyebrow">Open question queue</div><h3>Thread summaries and unresolved questions</h3><div class="tag-row"><span class="tag">Summaries ${threadSummaryCounts.summaries || 0}</span><span class="tag">Open questions ${threadSummaryCounts.openQuestions || 0}</span></div><div class="list">${openQuestionThreads.length ? openQuestionThreads.map(thread => `<div class="item"><h4>${escapeHtml(thread.subject)}</h4><div class="meta">${escapeHtml(thread.clientName || 'No client')} · ${escapeHtml(thread.aeName || 'No AE')} · saved ${escapeHtml(thread.summaryUpdatedAt || thread.updatedAt || '')}</div><p>${escapeHtml(thread.openQuestions || 'No open questions recorded.')}</p><div class="toolbar"><button class="btn-soft" data-act="open-question-thread" data-id="${thread.id}">Open</button><button class="btn-soft" data-act="open-question-task" data-id="${thread.id}">Create task</button><button class="btn-soft" data-act="open-question-clear" data-id="${thread.id}">Clear</button></div></div>`).join('') : '<div class="item"><div class="meta">No unresolved thread questions are currently tracked.</div></div>'}</div></div>
      <div class="card"><div class="eyebrow">Daily focus export</div><h3>Operator brief for the current working day</h3><p>Export the current milestone pressure, task effort load, and thread-question stack into one concise operator packet.</p><div class="toolbar"><button class="btn-soft" id="export-daily-focus-json">Export daily focus JSON</button><button class="btn-soft" id="export-daily-focus-md">Export daily focus Markdown</button></div><div class="list"><div class="item"><div class="meta">Milestone queue: ${milestoneQueue.length}</div><div class="meta">Effort queue: ${effortQueue.length}</div><div class="meta">Open question threads: ${openQuestionThreads.length}</div></div></div></div>
    </section>
    <section class="grid-2">
      <div class="card"><div class="eyebrow">Client health</div><h3>At-risk client queue</h3><div class="tag-row"><span class="tag">Healthy ${clientHealthCounts.healthy || 0}</span><span class="tag">Watch ${clientHealthCounts.watch || 0}</span><span class="tag">Critical ${clientHealthCounts.critical || 0}</span></div><div class="list">${atRiskClients.length ? atRiskClients.map(item => `<div class="item"><h4>${escapeHtml(item.client.name)}</h4><div class="meta">${escapeHtml(item.client.company || 'No company')} · ${escapeHtml(item.client.assignedAeName || 'Unassigned')} · ${escapeHtml(item.health.label)} · score ${item.health.score}</div><p>${escapeHtml(item.health.reasons.join(' · ') || 'No risk reasons surfaced.')}</p><div class="toolbar"><button class="btn-soft" data-act="risk-open-client" data-id="${item.client.id}">Open</button><button class="btn-soft" data-act="risk-create-plan" data-id="${item.client.id}" data-plan="stabilize-7">7-day plan</button><button class="btn-soft" data-act="followup-to-task" data-id="${item.client.id}">Create task</button></div></div>`).join('') : '<div class="item"><div class="meta">No at-risk clients are currently surfaced.</div></div>'}</div></div>
      <div class="card"><div class="eyebrow">Recent task movement</div><h3>Latest task updates</h3><div class="list">${recentTasks.length ? recentTasks.map(task => `<div class="item"><h4>${escapeHtml(task.title)}</h4><div class="meta">${escapeHtml(task.status || 'todo')} · ${escapeHtml(task.assignedAeName || 'Unassigned')} · ${escapeHtml(task.clientName || 'No client linked')} · ${escapeHtml(getTaskDueState(task).label)}</div></div>`).join('') : '<div class="item"><div class="meta">No tasks yet.</div></div>'}</div></div>
    </section>
    <section class="grid-2">
      <div class="card"><div class="eyebrow">Transcript stale queue</div><h3>Open threads needing response</h3><div class="tag-row"><span class="tag">Stale ${threadFreshnessCounts.stale || 0}</span><span class="tag">Watch ${threadFreshnessCounts.watch || 0}</span><span class="tag">Resolved ${threadFreshnessCounts.resolved || 0}</span></div><div class="list">${staleThreads.length ? staleThreads.map(item => `<div class="item"><h4>${escapeHtml(item.thread.subject)}</h4><div class="meta">${escapeHtml(item.thread.clientName || 'No client')} · ${escapeHtml(item.thread.aeName || 'No AE')} · ${escapeHtml(item.freshness.label)}</div><p>${escapeHtml(((state.messages.filter(message => message.threadId === item.thread.id).slice(-1)[0]?.text) || 'No transcript text yet.').slice(0, 180))}</p><div class="toolbar"><button class="btn-soft" data-act="stale-open-thread" data-id="${item.thread.id}">Open</button><button class="btn-soft" data-act="stale-playbook-followup" data-id="${item.thread.id}">Follow-up playbook</button><button class="btn-soft" data-act="stale-thread-task" data-id="${item.thread.id}">Create response task</button><button class="btn-soft" data-act="stale-thread-resolve" data-id="${item.thread.id}">Resolve</button></div></div>`).join('') : '<div class="item"><div class="meta">No stale open threads are currently surfaced.</div></div>'}</div></div>
      <div class="card"><div class="eyebrow">AE workload alerts</div><h3>Profiles needing rebalance review</h3><div class="list">${workloadAlerts.length ? workloadAlerts.map(item => `<div class="item"><h4>${escapeHtml(item.ae.name)}</h4><div class="meta">${escapeHtml(item.reason)} · ${item.affectedCount} affected clients · ${escapeHtml(item.capacityState)}</div><p>${escapeHtml(item.affectedClients.slice(0, 4).map(client => client.name).join(' · ') || 'No client names available.')}</p><div class="toolbar"><button class="btn-soft" data-act="workload-open-clients" data-id="${item.ae.id}">Open clients</button><button class="btn-soft" data-act="workload-rebalance-ae" data-id="${item.ae.id}">Rebalance</button></div></div>`).join('') : '<div class="item"><div class="meta">No AE workload alerts are currently surfaced.</div></div>'}</div></div>
    </section>
    <section class="grid-2">
      <div class="card"><div class="eyebrow">SLA pressure queue</div><h3>Clients with the most operator pressure right now</h3><div class="list">${getSlaPressureQueue().length ? getSlaPressureQueue().map(item => `<div class="item"><h4>${escapeHtml(item.client.name)}</h4><div class="meta">${escapeHtml(item.client.company || 'No company')} · ${escapeHtml(item.client.assignedAeName || 'Unassigned')} · ${escapeHtml(item.sla.label)} · score ${item.sla.score}</div><p>${escapeHtml(item.sla.reasons.join(' · ') || 'No active SLA reasons.')}</p><div class="toolbar"><button class="btn-soft" data-act="sla-open-client" data-id="${item.client.id}">Open</button><button class="btn-soft" data-act="sla-create-plan" data-id="${item.client.id}">Create plan</button><button class="btn-soft" data-act="followup-to-task" data-id="${item.client.id}">Follow-up task</button></div></div>`).join('') : '<div class="item"><div class="meta">No SLA pressure clients surfaced.</div></div>'}</div></div>
      <div class="card"><div class="eyebrow">Blocked task queue</div><h3>Tasks blocked and waiting for operator clearance</h3><div class="list">${getBlockedTasks().length ? getBlockedTasks().map(task => `<div class="item"><h4>${escapeHtml(task.title)}</h4><div class="meta">${escapeHtml(task.assignedAeName || 'No AE')} · ${escapeHtml(task.clientName || 'No client linked')} · ${escapeHtml(task.updatedAt || task.createdAt || '')}</div><p>${escapeHtml(task.blockerNote || 'No blocker note recorded.')}</p><div class="toolbar"><button class="btn-soft" data-act="blocked-task-open" data-id="${task.id}">Open</button><button class="btn-soft" data-act="blocked-task-unblock" data-id="${task.id}">Unblock</button><button class="btn-soft" data-act="blocked-task-escalate" data-id="${task.id}">Escalate client</button></div></div>`).join('') : '<div class="item"><div class="meta">No blocked tasks surfaced.</div></div>'}</div></div>
    </section>
    <section class="grid-2">
      <div class="card"><div class="eyebrow">Response waiting queue</div><h3>Threads awaiting a live reply</h3><div class="tag-row"><span class="tag">Awaiting ${awaitingResponseCounts.awaiting || 0}</span><span class="tag">Watch ${awaitingResponseCounts.watch || 0}</span><span class="tag">Critical ${awaitingResponseCounts.critical || 0}</span></div><div class="list">${awaitingThreads.length ? awaitingThreads.map(item => `<div class="item"><h4>${escapeHtml(item.thread.subject)}</h4><div class="meta">${escapeHtml(item.thread.clientName || 'No client')} · ${escapeHtml(item.thread.aeName || 'No AE')} · ${escapeHtml(item.lag.label)}</div><p>${escapeHtml((item.lag.lastUserMessage?.text || 'No inbound user message captured.').slice(0, 180))}</p><div class="toolbar"><button class="btn-soft" data-act="awaiting-open-thread" data-id="${item.thread.id}">Open</button><button class="btn-soft" data-act="awaiting-playbook" data-id="${item.thread.id}">Draft follow-up</button><button class="btn-soft" data-act="awaiting-response-task" data-id="${item.thread.id}">Create response task</button></div></div>`).join('') : '<div class="item"><div class="meta">No threads are currently awaiting response.</div></div>'}</div></div>
      <div class="card"><div class="eyebrow">Dependency queue</div><h3>Tasks waiting on other tasks to finish</h3><div class="tag-row"><span class="tag">Waiting ${dependencyCounts.waiting || 0}</span><span class="tag">Ready ${dependencyCounts.ready || 0}</span><span class="tag">Total with deps ${dependencyCounts.total || 0}</span></div><div class="list">${dependencyQueue.length ? dependencyQueue.map(item => `<div class="item"><h4>${escapeHtml(item.task.title)}</h4><div class="meta">${escapeHtml(item.task.assignedAeName || 'No AE')} · ${escapeHtml(item.task.clientName || 'No client')} · ${escapeHtml(item.dependency.label)}</div><p>${escapeHtml(item.task.blockerNote || 'No dependency blocker note recorded.')}</p><div class="toolbar"><button class="btn-soft" data-act="dashboard-open-task" data-id="${item.task.id}">Open</button><button class="btn-soft" data-act="dependency-open-task" data-id="${item.dependency.task?.id || ''}">Open dependency</button><button class="btn-soft" data-act="dependency-resume-task" data-id="${item.task.id}">Resume if ready</button></div></div>`).join('') : '<div class="item"><div class="meta">No dependency-blocked tasks surfaced.</div></div>'}</div></div>
    </section>
    <section class="grid-2">
      <div class="card"><div class="eyebrow">No-contact queue</div><h3>Clients drifting without recent operator touch</h3><div class="tag-row"><span class="tag">Watch ${getClientTouchCounts().watch || 0}</span><span class="tag">Stale ${getClientTouchCounts().stale || 0}</span><span class="tag">Cold ${getClientTouchCounts().cold || 0}</span></div><div class="list">${getNoContactClients().length ? getNoContactClients().map(item => `<div class="item"><h4>${escapeHtml(item.client.name)}</h4><div class="meta">${escapeHtml(item.client.company || 'No company')} · ${escapeHtml(item.client.assignedAeName || 'Unassigned')} · ${escapeHtml(item.touch.label)}</div><p>${escapeHtml(item.client.nextStep || 'No next step set.')}</p><div class="toolbar"><button class="btn-soft" data-act="no-contact-open-client" data-id="${item.client.id}">Open</button><button class="btn-soft" data-act="no-contact-task" data-id="${item.client.id}">Create nudge task</button></div></div>`).join('') : '<div class="item"><div class="meta">No no-contact clients surfaced.</div></div>'}</div></div>
      <div class="card"><div class="eyebrow">Recurring task queue</div><h3>Repeat cadences currently in motion</h3><div class="list">${getRecurringTaskQueue().length ? getRecurringTaskQueue().map(item => `<div class="item"><h4>${escapeHtml(item.task.title)}</h4><div class="meta">${escapeHtml(item.task.clientName || 'No client linked')} · ${escapeHtml(item.task.assignedAeName || 'Unassigned')} · ${escapeHtml(item.recurrence.label)} · ${escapeHtml(getTaskDueState(item.task).label)}</div><p>${escapeHtml(item.task.notes || 'No task notes yet.')}</p><div class="toolbar"><button class="btn-soft" data-act="dashboard-open-task" data-id="${item.task.id}">Open</button><button class="btn-soft" data-act="task-complete" data-id="${item.task.id}">Complete</button></div></div>`).join('') : '<div class="item"><div class="meta">No recurring tasks are currently active.</div></div>'}</div></div>
    </section>
    <section class="grid-2">
      <div class="card"><div class="eyebrow">Reply draft queue</div><h3>Threads with unsent reply drafts</h3><div class="list">${getThreadDraftQueue().length ? getThreadDraftQueue().map(thread => `<div class="item"><h4>${escapeHtml(thread.subject)}</h4><div class="meta">${escapeHtml(thread.clientName || 'No client')} · ${escapeHtml(thread.aeName || 'No AE')} · draft saved ${escapeHtml(thread.draftUpdatedAt || '')}</div><p>${escapeHtml(String(thread.draftReply || '').slice(0, 180))}</p><div class="toolbar"><button class="btn-soft" data-act="draft-open-thread" data-id="${thread.id}">Open</button><button class="btn-soft" data-act="draft-clear-thread" data-id="${thread.id}">Clear draft</button></div></div>`).join('') : '<div class="item"><div class="meta">No unsent thread drafts are stored.</div></div>'}</div></div>
      <div class="card"><div class="eyebrow">Cadence brief</div><h3>Export contact, recurrence, and draft pressure briefing</h3><p>Download a founder-readable brief covering no-contact clients, recurring task load, and unsent reply drafts.</p><div class="toolbar"><button class="btn-soft" id="export-cadence-brief-json">Export brief JSON</button><button class="btn-soft" id="export-cadence-brief-md">Export brief Markdown</button></div></div>
    </section>
    <section class="grid-2">
      <div class="card"><div class="eyebrow">SLA brief</div><h3>Export SLA, blocked-task, and stale-thread briefing</h3><p>Download a focused brief covering client pressure scoring, blocked tasks, and stale threads in one founder-readable file.</p><div class="toolbar"><button class="btn-soft" id="export-sla-brief-json">Export brief JSON</button><button class="btn-soft" id="export-sla-brief-md">Export brief Markdown</button></div></section>
      <div class="card"><div class="eyebrow">Response playbooks</div><h3>Transcript macros for faster operator replies</h3><p>Use the response playbook library in thread detail to insert or immediately save structured follow-up replies without rewriting the same message repeatedly.</p><div class="tag-row">${RESPONSE_PLAYBOOK_LIBRARY.map(playbook => `<span class="tag">${escapeHtml(playbook.label)}</span>`).join('')}</div></section>
    </section>
    <section class="grid-2">
      <div class="card"><div class="eyebrow">AE performance scorecard</div><h3>Pressure, reply load, and friction by AE</h3><div class="table-wrap"><table><thead><tr><th>AE</th><th>Status</th><th>Clients</th><th>Open tasks</th><th>Blocked/waiting</th><th>Stale</th><th>Awaiting replies</th><th>Critical clients</th><th>Actions</th></tr></thead><tbody>${aePerformanceRows.length ? aePerformanceRows.map(row => `<tr><td>${escapeHtml(row.aeName)}<div class="meta">${escapeHtml(row.title)}</div></td><td><span class="tag">${escapeHtml(row.status)}</span><div class="meta">score ${row.score}</div></td><td>${row.assignedClients}</td><td>${row.openTasks}</td><td>${row.blockedTasks}</td><td>${row.staleThreads}</td><td>${row.awaitingThreads}</td><td>${row.criticalClients}</td><td><button class="btn-soft" data-act="performance-open-clients" data-id="${row.aeId}">Open clients</button></td></tr>`).join('') : '<tr><td colspan="9">No AE performance rows surfaced.</td></tr>'}</tbody></table></div><div class="toolbar"><button class="btn-soft" id="export-ae-performance-json">Export JSON</button><button class="btn-soft" id="export-ae-performance-md">Export Markdown</button></div></div>
      <div class="card"><div class="eyebrow">Operational snapshot</div><h3>Export current branch ops summary</h3><p>Download a founder-readable JSON or Markdown snapshot of roster load, client mix, follow-up pressure, task state, transcript volume, remote lane status, and client health pressure.</p><div class="toolbar"><button class="btn-soft" id="export-ops-snapshot-json">Export JSON</button><button class="btn-soft" id="export-ops-snapshot-md">Export Markdown</button></div><div class="eyebrow" style="margin-top:16px">Command brief</div><h3>Export stale-thread, workload, and recommendation briefing</h3><p>Download a focused operator brief covering stale transcript response risk, AE workload alerts, and surfaced client recommendation lanes.</p><div class="toolbar"><button class="btn-soft" id="export-command-brief-json">Export brief JSON</button><button class="btn-soft" id="export-command-brief-md">Export brief Markdown</button></div></div>
    </section>
    <section class="grid-2">
      ${renderAppointmentDeskCard()}
      ${renderAppointmentFunnelCard()}
    </section>
    <section class="grid-2">
      ${renderAppointmentSettlementCard()}
      <div class="card"><div class="eyebrow">0megaPhase brief</div><h3>Combined AE + appointment-setter export</h3><p>Export the integrated command state so founder review, packaging, or donor import can happen from one combined payload.</p><div class="toolbar"><button class="btn-soft" id="export-omega-brief-json">Export JSON</button><button class="btn-soft" id="export-omega-brief-md">Export Markdown</button><button class="btn-soft" id="open-appointment-brain">Open appointment brain</button></div></div>
    </section>
    <section class="grid-2">
      ${renderPipelineBoardCard()}
      ${renderCommandCalendarCard()}
    </section>
    <section class="grid-2">
      ${renderRebalancePlannerCard()}
      ${renderAeOwnershipCard()}
    </section>
    <section class="grid-2">
      ${renderAutomationCenterCard()}
      ${renderCommandMacroCard()}
    </section>
    <section class="grid-2">
      ${renderWorkspacePresetCard()}
      ${renderRestorePointCard()}
    </section>`;
}

function renderClients() {
  const rows = buildClientRows(getFilteredClients());
  const bulkOptions = state.aeProfiles.map(ae => `<option value="${ae.id}">${ae.name}</option>`).join('');
  const presets = Array.isArray(state.clientFilterPresets) ? state.clientFilterPresets : [];
  return `
    <section class="card">
      <div class="eyebrow">Client intake</div>
      <h3>Add or update a client</h3>
      <div class="form-grid">
        <label><span>Name</span><input id="client-name" placeholder="Business or person"></label>
        <label><span>Company</span><input id="client-company" placeholder="Company"></label>
        <label><span>Client type</span><input id="client-type" placeholder="local-business, premium, infrastructure"></label>
        <label><span>Needs tags</span><input id="client-needs" placeholder="growth, onboarding, local-business"></label>
        <label><span>Stage</span><select id="client-stage"><option value="intake">intake</option><option value="active">active</option><option value="nurture">nurture</option><option value="blocked">blocked</option><option value="closed">closed</option></select></label>
        <label><span>Priority</span><select id="client-priority"><option value="low">low</option><option value="normal" selected>normal</option><option value="high">high</option><option value="urgent">urgent</option></select></label>
        <label><span>Estimated value</span><input id="client-estimated-value" type="number" min="0" step="500" placeholder="15000"></label>
        <label><span>Monthly value</span><input id="client-monthly-value" type="number" min="0" step="100" placeholder="2500"></label>
        <label><span>Close probability %</span><input id="client-close-probability" type="number" min="0" max="100" step="5" value="0"></label>
        <label><span>Target close date</span><input id="client-target-close" type="date"></label>
        <label><span>Follow-up date</span><input id="client-follow-up" type="date"></label>
        <label><span>Current milestone</span><input id="client-milestone" placeholder="Onboarding call, launch signoff, renewal review"></label>
        <label><span>Milestone due</span><input id="client-milestone-due" type="date"></label>
        <label><span>Milestone progress %</span><input id="client-milestone-progress" type="number" min="0" max="100" step="5" value="0"></label>
        <label><span>Next step</span><input id="client-next-step" placeholder="Immediate next step, follow-up, or action owner"></label>
        <label class="full"><span>Notes</span><textarea id="client-notes" placeholder="Context, issues, priorities, assignment notes"></textarea></label>
      </div>
      <div class="meta" id="client-form-mode">Create mode · saving adds a new client record.</div><div class="toolbar"><button class="btn" id="save-client">Save client</button><button class="btn-soft" id="clear-client-form">Clear</button><button class="btn-soft" id="cancel-client-edit" hidden>Cancel edit</button></div>
      <div class="card nested-card"><div class="eyebrow">Duplicate watch</div><div id="client-duplicate-watch" class="list"><div class="meta">Enter a name or company to check for duplicates before saving.</div></div></div>
    </section>
    <section class="grid-2">
      <div class="card">
        <div class="eyebrow">Client ledger</div>
        <h3>Clients and assignments</h3>
        <div class="search-row"><input id="client-search" placeholder="Search clients" value="${escapeHtml(clientFilters.query)}"><select id="client-ae-filter"><option value="">All AEs</option>${state.aeProfiles.map(ae => `<option value="${ae.id}" ${clientFilters.aeId === ae.id ? 'selected' : ''}>${ae.name}</option>`).join('')}</select><select id="client-stage-filter"><option value="">All stages</option>${['intake','active','nurture','blocked','closed'].map(stage => `<option value="${stage}" ${clientFilters.stage === stage ? 'selected' : ''}>${stage}</option>`).join('')}</select><select id="client-priority-filter"><option value="">All priorities</option>${['low','normal','high','urgent'].map(priority => `<option value="${priority}" ${clientFilters.priority === priority ? 'selected' : ''}>${priority}</option>`).join('')}</select><select id="client-health-filter"><option value="">All health states</option>${['healthy','watch','critical'].map(status => `<option value="${status}" ${clientFilters.health === status ? 'selected' : ''}>${status}</option>`).join('')}</select><select id="client-touch-filter"><option value="">All contact states</option>${['today','current','watch','stale','cold'].map(status => `<option value="${status}" ${clientFilters.touch === status ? 'selected' : ''}>${status}</option>`).join('')}</select><select id="client-value-filter"><option value="">All value tiers</option>${['unscored','standard','premium','enterprise'].map(status => `<option value="${status}" ${clientFilters.value === status ? 'selected' : ''}>${status}</option>`).join('')}</select><select id="client-export-type"><option value="json">Export JSON</option><option value="csv">Export CSV</option></select><button class="btn-soft" id="export-clients">Export clients</button><button class="btn-soft" id="export-revenue-brief-json">Revenue JSON</button><button class="btn-soft" id="export-revenue-brief-md">Revenue MD</button></div>
        <div class="toolbar preset-row"><button class="btn-soft" id="save-client-filter-preset">Save current filters</button><button class="btn-soft" id="reset-client-filters">Reset filters</button><div class="tag-row">${presets.length ? presets.map(preset => `<span class="tag actionable-tag"><button class="btn-tag" data-act="load-client-preset" data-id="${preset.id}">${escapeHtml(preset.name)}</button><button class="btn-tag danger" data-act="delete-client-preset" data-id="${preset.id}">×</button></span>`).join('') : '<span class="meta">No saved filter presets yet.</span>'}</div></div>
        <div class="bulk-row">
          <label class="checkbox-inline"><input id="select-all-visible" type="checkbox"> <span>Select visible</span></label>
          <div class="meta" id="bulk-count">${selectedClientIds.size} selected</div>
          <select id="bulk-ae-select"><option value="">Choose AE for bulk assign</option>${bulkOptions}</select>
          <button class="btn-soft" id="bulk-auto-assign">Bulk auto-assign</button>
          <button class="btn-soft" id="bulk-manual-assign">Bulk manual assign</button>
          <select id="bulk-stage-select"><option value="">Stage for selected</option><option value="intake">intake</option><option value="active">active</option><option value="nurture">nurture</option><option value="blocked">blocked</option><option value="closed">closed</option></select><button class="btn-soft" id="bulk-update-stage">Apply stage</button>
          <select id="bulk-priority-select"><option value="">Priority for selected</option><option value="low">low</option><option value="normal">normal</option><option value="high">high</option><option value="urgent">urgent</option></select><button class="btn-soft" id="bulk-update-priority">Apply priority</button>
          <button class="btn-soft" id="rebalance-unavailable-aes">Rebalance unavailable AE clients</button>
          <button class="btn-soft" id="bulk-create-followup-tasks">Create follow-up tasks</button><button class="btn-soft" id="bulk-send-to-appointment">Send to appointment brain</button><select id="bulk-plan-select"><option value="">Choose action plan</option>${CLIENT_ACTION_PLAN_LIBRARY.map(plan => `<option value="${plan.id}">${plan.label}</option>`).join('')}</select><button class="btn-soft" id="bulk-create-client-plans">Create plans</button>
          <button class="btn-soft" id="bulk-export">Export selected</button>
          <button class="btn-soft danger" id="bulk-delete">Delete selected</button>
        </div>
        <div class="table-wrap"><table><thead><tr><th></th><th>Client</th><th>Assigned AE</th><th>Stage</th><th>Priority</th><th>Health</th><th>Needs</th><th>History</th><th>Actions</th></tr></thead><tbody id="clients-body">${rows || '<tr><td colspan="9">No clients yet.</td></tr>'}</tbody></table></div>
      </div>
      <div class="card">
        <div class="eyebrow">Client dossier</div>
        <h3>Selected client</h3>
        <div id="client-history-panel" class="list"><div class="item"><div class="meta">Select or auto-assign a client to view the dossier, linked work, assignment history, and activity timeline here.</div></div></div>
      </div>
    </section>
    <section class="grid-2">
      ${renderPipelineBoardCard()}
      ${renderRebalancePlannerCard()}
    </section>`;
}

function getFilteredClients() {
  const q = String(clientFilters.query || '').trim().toLowerCase();
  return state.clients.filter(client => {
    const haystack = [client.name, client.company, client.needs, client.clientType, client.assignedAeName, client.notes, client.stage, client.priority, client.nextStep, client.followUpDate, client.targetCloseDate, getClientValueTier(client)].join(' ').toLowerCase();
    const hit = haystack.includes(q);
    const aeHit = !clientFilters.aeId || client.assignedAeId === clientFilters.aeId;
    const stageHit = !clientFilters.stage || (client.stage || 'intake') === clientFilters.stage;
    const priorityHit = !clientFilters.priority || (client.priority || 'normal') === clientFilters.priority;
    const healthHit = !clientFilters.health || getClientHealth(client).status === clientFilters.health;
    const touchHit = !clientFilters.touch || getClientTouchStatus(client).status === clientFilters.touch;
    const valueHit = !clientFilters.value || getClientValueTier(client) === clientFilters.value;
    return hit && aeHit && stageHit && priorityHit && healthHit && touchHit && valueHit;
  });
}

function buildClientRows(clients) {
  return clients.map(client => {
    const due = getClientDueState(client);
    const health = getClientHealth(client);
    const estimatedValue = getClientEstimatedValue(client);
    const weightedValue = getClientWeightedValue(client);
    const monthlyValue = getClientMonthlyValue(client);
    const valueTier = getClientValueTier(client);
    return `
    <tr>
      <td><input class="client-select" type="checkbox" data-id="${client.id}" ${selectedClientIds.has(client.id) ? 'checked' : ''}></td>
      <td>${client.name}<div class="meta">${client.company || 'No company'} · ${client.clientType || 'unspecified'}${client.nextStep ? ` · next: ${escapeHtml(client.nextStep)}` : ''}${client.followUpDate ? ` · follow-up: ${escapeHtml(client.followUpDate)}` : ''}</div><div class="meta">${escapeHtml(valueTier)} · est ${formatCurrency(estimatedValue)} · weighted ${formatCurrency(weightedValue)} · monthly ${formatCurrency(monthlyValue)}${client.targetCloseDate ? ` · target close ${escapeHtml(client.targetCloseDate)}` : ''}</div></td>
      <td>${client.assignedAeName || 'Unassigned'}</td>
      <td><span class="tag">${client.stage || 'intake'}</span></td>
      <td><span class="tag">${client.priority || 'normal'}</span><div class="meta">${escapeHtml(due.label)}</div><div class="meta">${escapeHtml(getClientMilestoneState(client).label)}</div></td>
      <td><span class="tag">${escapeHtml(health.label)}</span><div class="meta">score ${health.score} · ${escapeHtml(getClientTouchStatus(client).label)}</div></td>
      <td>${client.needs || '—'}</td>
      <td>${client.assignmentHistory?.length || 0}</td>
      <td><div class="row"><button class="btn-soft" data-act="auto-assign" data-id="${client.id}">Auto</button><button class="btn-soft" data-act="edit-client" data-id="${client.id}">Open</button><button class="btn-soft" data-act="send-to-appointment" data-id="${client.id}">Appt</button><button class="btn-soft" data-act="client-stage-back" data-id="${client.id}">◀</button><button class="btn-soft" data-act="client-stage-forward" data-id="${client.id}">▶</button></div></td>
    </tr>`;
  }).join('');
}

function bindClientTableControls() {
  document.querySelectorAll('[data-act="auto-assign"]').forEach(btn => btn.addEventListener('click', () => {
    const client = state.clients.find(item => item.id === btn.dataset.id);
    const match = autoAssignClient(state, client);
    if (!match) return alert('No enabled AE could be matched.');
    assignClient(state, client.id, match.id, 'auto');
    remoteUpsert('clients', client);
    remoteUpsert('assignments', client.assignmentHistory?.[0]);
    persist();
    render();
    renderClientHistory(client.id);
  }));
  document.querySelectorAll('[data-act="edit-client"]').forEach(btn => btn.addEventListener('click', () => renderClientHistory(btn.dataset.id, true)));
  document.querySelectorAll('[data-act="send-to-appointment"]').forEach(btn => btn.addEventListener('click', () => { sendClientToAppointmentSetter(btn.dataset.id, 'client-ledger'); render(); renderClientHistory(btn.dataset.id); }));
  document.querySelectorAll('[data-act="client-stage-back"]').forEach(btn => btn.addEventListener('click', () => { shiftClientStage(btn.dataset.id, -1, 'client-ledger-back'); render(); renderClientHistory(btn.dataset.id); }));
  document.querySelectorAll('[data-act="client-stage-forward"]').forEach(btn => btn.addEventListener('click', () => { shiftClientStage(btn.dataset.id, 1, 'client-ledger-forward'); render(); renderClientHistory(btn.dataset.id); }));
  document.querySelectorAll('.client-select').forEach(input => input.addEventListener('change', () => {
    if (input.checked) selectedClientIds.add(input.dataset.id);
    else selectedClientIds.delete(input.dataset.id);
    updateBulkCount();
    syncSelectAllVisible();
  }));
}

function bindClients() {
  $('#save-client').addEventListener('click', () => {
    const draft = getClientFormDraft();
    if (!draft.name) return alert('Client name is required.');
    const existing = editingClientId ? state.clients.find(item => item.id === editingClientId) : null;
    const duplicates = findPotentialDuplicateClients(draft, editingClientId);
    if (duplicates.length && !globalThis.confirm(`Possible duplicate clients found (${duplicates.length}). Save anyway?`)) return;
    if (existing) {
      applyClientDraft(existing, draft, 'update');
      state.auditLog.unshift({ id: uid('audit'), kind: 'client-update', message: `Client updated: ${existing.name}`, at: nowIso() });
      remoteUpsert('clients', existing);
      persist();
      render();
      renderClientHistory(existing.id, true);
      return;
    }
    const client = applyClientDraft({ id: uid('client'), createdAt: nowIso(), updatedAt: nowIso(), assignmentHistory: [], activityHistory: [] }, draft, 'create');
    state.clients.unshift(client);
    state.auditLog.unshift({ id: uid('audit'), kind: 'client', message: `Client created: ${client.name}`, at: nowIso() });
    remoteUpsert('clients', client);
    persist();
    render();
    renderClientHistory(client.id, true);
  });
  $('#clear-client-form').addEventListener('click', clearClientForm);
  $('#cancel-client-edit')?.addEventListener('click', clearClientForm);
  ['#client-name','#client-company','#client-type','#client-needs','#client-stage','#client-priority','#client-follow-up','#client-next-step','#client-notes','#client-estimated-value','#client-monthly-value','#client-close-probability','#client-target-close'].forEach(selector => {
    $(selector)?.addEventListener('input', renderDuplicateWatch);
    $(selector)?.addEventListener('change', renderDuplicateWatch);
  });
  $('#export-clients').addEventListener('click', () => exportClients(getFilteredClients()));
  const search = $('#client-search');
  if (search) search.addEventListener('input', () => {
    clientFilters.query = search.value;
    filterClients();
  });
  const aeFilter = $('#client-ae-filter');
  if (aeFilter) aeFilter.addEventListener('change', () => {
    clientFilters.aeId = aeFilter.value;
    filterClients();
  });
  const stageFilter = $('#client-stage-filter');
  if (stageFilter) stageFilter.addEventListener('change', () => {
    clientFilters.stage = stageFilter.value;
    filterClients();
  });
  const priorityFilter = $('#client-priority-filter');
  if (priorityFilter) priorityFilter.addEventListener('change', () => {
    clientFilters.priority = priorityFilter.value;
    filterClients();
  });
  const healthFilter = $('#client-health-filter');
  if (healthFilter) healthFilter.addEventListener('change', () => {
    clientFilters.health = healthFilter.value;
    filterClients();
  });
  const touchFilter = $('#client-touch-filter');
  if (touchFilter) touchFilter.addEventListener('change', () => {
    clientFilters.touch = touchFilter.value;
    filterClients();
  });
  const valueFilter = $('#client-value-filter');
  if (valueFilter) valueFilter.addEventListener('change', () => {
    clientFilters.value = valueFilter.value;
    filterClients();
  });
  $('#save-client-filter-preset')?.addEventListener('click', saveClientFilterPreset);
  $('#reset-client-filters')?.addEventListener('click', () => {
    clientFilters = { query: '', aeId: '', stage: '', priority: '', health: '', touch: '', value: '' };
    render();
  });
  document.querySelectorAll('[data-act="load-client-preset"]').forEach(btn => btn.addEventListener('click', () => loadClientFilterPreset(btn.dataset.id)));
  document.querySelectorAll('[data-act="delete-client-preset"]').forEach(btn => btn.addEventListener('click', () => deleteClientFilterPreset(btn.dataset.id)));
  $('#select-all-visible')?.addEventListener('change', event => {
    const visibleIds = getFilteredClients().map(client => client.id);
    if (event.target.checked) visibleIds.forEach(id => selectedClientIds.add(id));
    else visibleIds.forEach(id => selectedClientIds.delete(id));
    filterClients();
  });
  $('#bulk-auto-assign')?.addEventListener('click', bulkAutoAssignSelected);
  $('#bulk-manual-assign')?.addEventListener('click', bulkManualAssignSelected);
  $('#bulk-update-stage')?.addEventListener('click', bulkUpdateSelectedStage);
  $('#bulk-update-priority')?.addEventListener('click', bulkUpdateSelectedPriority);
  $('#rebalance-unavailable-aes')?.addEventListener('click', () => {
    const moved = rebalanceUnavailableAeClients();
    if (!moved) return alert('No clients needed rebalancing.');
    render();
  });
  $('#bulk-create-followup-tasks')?.addEventListener('click', () => {
    const clients = getSelectedClients();
    if (!clients.length) return alert('Select at least one client first.');
    let created = 0;
    clients.forEach(client => { if (createFollowupTaskFromClient(client, 'bulk-followup')) created += 1; });
    state.auditLog.unshift({ id: uid('audit'), kind: 'bulk-followup-task-create', message: `Created or opened ${created} follow-up task lanes from selected clients`, at: nowIso() });
    render();
  });
  $('#bulk-send-to-appointment')?.addEventListener('click', bulkSendSelectedToAppointmentSetter);
  $('#bulk-create-client-plans')?.addEventListener('click', () => {
    const clients = getSelectedClients();
    const planId = $('#bulk-plan-select')?.value || '';
    if (!clients.length) return alert('Select at least one client first.');
    if (!planId) return alert('Choose an action plan first.');
    let created = 0;
    clients.forEach(client => { created += createClientActionPlan(client.id, planId).length; });
    state.auditLog.unshift({ id: uid('audit'), kind: 'bulk-client-action-plan', message: `Created ${created} action-plan tasks from selected clients`, at: nowIso() });
    render();
  });
  $('#bulk-export')?.addEventListener('click', () => exportClients(getSelectedClients()));
  $('#export-revenue-brief-json')?.addEventListener('click', () => exportRevenueBrief('json'));
  $('#export-revenue-brief-md')?.addEventListener('click', () => exportRevenueBrief('markdown'));
  $('#bulk-delete')?.addEventListener('click', bulkDeleteSelected);
  bindClientTableControls();
  updateBulkCount();
  syncSelectAllVisible();
  renderDuplicateWatch();
  updateClientFormMode();
}

function filterClients() {
  const rows = buildClientRows(getFilteredClients());
  $('#clients-body').innerHTML = rows || '<tr><td colspan="9">No matching clients.</td></tr>';
  bindClientTableControls();
  updateBulkCount();
  syncSelectAllVisible();
}

function getSelectedClients() {
  return state.clients.filter(client => selectedClientIds.has(client.id));
}

function updateBulkCount() {
  if ($('#bulk-count')) $('#bulk-count').textContent = `${selectedClientIds.size} selected`;
}

function syncSelectAllVisible() {
  const visibleIds = getFilteredClients().map(client => client.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedClientIds.has(id));
  const selectAll = $('#select-all-visible');
  if (selectAll) selectAll.checked = allSelected;
}

function exportClients(clients) {
  const type = $('#client-export-type')?.value || 'json';
  if (type === 'json') return download('ae-brain-clients.json', JSON.stringify(clients, null, 2), 'application/json');
  const rows = [['name','company','assignedAeName','stage','priority','estimatedValue','monthlyValue','closeProbability','targetCloseDate','followUpDate','needs','clientType','nextStep','notes']].concat(clients.map(client => [client.name, client.company || '', client.assignedAeName || '', client.stage || 'intake', client.priority || 'normal', getClientEstimatedValue(client), getClientMonthlyValue(client), getClientCloseProbability(client), client.targetCloseDate || '', client.followUpDate || '', client.needs || '', client.clientType || '', client.nextStep || '', client.notes || '']));
  download('ae-brain-clients.csv', rows.map(row => row.map(csvCell).join(',')).join('\n'), 'text/csv');
}

function bulkAutoAssignSelected() {
  const clients = getSelectedClients();
  if (!clients.length) return alert('Select at least one client first.');
  let assigned = 0;
  clients.forEach(client => {
    const match = autoAssignClient(state, client);
    if (match) {
      assignClient(state, client.id, match.id, 'bulk-auto');
      assigned += 1;
    }
  });
  clients.forEach(client => { remoteUpsert('clients', client); if (client.assignmentHistory?.[0]) remoteUpsert('assignments', client.assignmentHistory[0]); });
  state.auditLog.unshift({ id: uid('audit'), kind: 'bulk-auto-assign', message: `Bulk auto-assigned ${assigned} clients`, at: nowIso() });
  persist();
  render();
}

function bulkManualAssignSelected() {
  const aeId = $('#bulk-ae-select')?.value;
  const clients = getSelectedClients();
  if (!clients.length) return alert('Select at least one client first.');
  if (!aeId) return alert('Choose an AE first.');
  clients.forEach(client => assignClient(state, client.id, aeId, 'bulk-manual'));
  const ae = state.aeProfiles.find(item => item.id === aeId);
  clients.forEach(client => { remoteUpsert('clients', client); if (client.assignmentHistory?.[0]) remoteUpsert('assignments', client.assignmentHistory[0]); });
  state.auditLog.unshift({ id: uid('audit'), kind: 'bulk-manual-assign', message: `Bulk assigned ${clients.length} clients to ${ae?.name || 'AE'}`, at: nowIso() });
  persist();
  render();
}

function bulkDeleteSelected() {
  const clients = getSelectedClients();
  if (!clients.length) return alert('Select at least one client first.');
  const confirmed = globalThis.confirm(`Delete ${clients.length} selected clients?`);
  if (!confirmed) return;
  const ids = new Set(clients.map(client => client.id));
  clients.forEach(client => remoteDelete('clients', client.id));
  state.clients = state.clients.filter(client => !ids.has(client.id));
  state.tasks = state.tasks.filter(task => !ids.has(task.clientId));
  state.threads = state.threads.filter(thread => !ids.has(thread.clientId));
  const threadIds = new Set(state.threads.map(thread => thread.id));
  state.messages = state.messages.filter(message => threadIds.has(message.threadId));
  selectedClientIds = new Set();
  state.auditLog.unshift({ id: uid('audit'), kind: 'bulk-delete', message: `Deleted ${clients.length} selected clients`, at: nowIso() });
  persist();
  render();
}

function renderClientHistory(clientId, focusForm = false) {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return;
  const relatedTasks = getClientRelatedTasks(client.id);
  const relatedThreads = getClientRelatedThreads(client.id);
  const timeline = buildClientActivityTimeline(client);
  const candidates = getAeMatchCandidates(client, 3);
  const options = state.aeProfiles.map(ae => `<option value="${ae.id}" ${client.assignedAeId === ae.id ? 'selected' : ''}>${ae.name}</option>`).join('');
  const due = getClientDueState(client);
  const health = getClientHealth(client);
  const milestone = getClientMilestoneState(client);
  $('#client-history-panel').innerHTML = `
    <div class="item">
      <h4>${client.name}</h4>
      <div class="meta">${client.company || 'No company'} · stage ${client.stage || 'intake'} · priority ${client.priority || 'normal'} · ${escapeHtml(due.label)} · health ${escapeHtml(health.label)} · score ${health.score}</div>
      <div class="meta">Assigned AE: ${client.assignedAeName || 'Unassigned'}${client.nextStep ? ` · next step: ${escapeHtml(client.nextStep)}` : ''}</div>
      <div class="meta">SLA pressure: ${escapeHtml(getClientSlaPressure(client).label)} · score ${getClientSlaPressure(client).score}</div>
      <div class="meta">Contact cadence: ${escapeHtml(getClientTouchStatus(client).label)} · milestone: ${escapeHtml(milestone.label)}</div>
      <div class="meta">Value tier: ${escapeHtml(getClientValueTier(client))} · estimated ${formatCurrency(getClientEstimatedValue(client))} · weighted ${formatCurrency(getClientWeightedValue(client))} · monthly ${formatCurrency(getClientMonthlyValue(client))}${client.targetCloseDate ? ` · target close ${escapeHtml(client.targetCloseDate)}` : ''}</div>
      <p>${escapeHtml(client.notes || 'No notes yet.')}</p>
      <div class="tag-row">${health.reasons.length ? health.reasons.map(reason => `<span class="tag">${escapeHtml(reason)}</span>`).join('') : '<span class="tag">No active risk reasons</span>'}${getClientSlaPressure(client).reasons.length ? getClientSlaPressure(client).reasons.map(reason => `<span class="tag">${escapeHtml(reason)}</span>`).join('') : ''}</div>
      <div class="toolbar"><select id="history-ae-select"><option value="">Choose AE</option>${options}</select><button class="btn-soft" id="manual-assign-btn">Manual assign</button><button class="btn-soft" id="client-edit-form">Edit in form</button><button class="btn-soft" id="create-client-task">Create task</button><button class="btn-soft" id="create-client-thread">Create thread</button><button class="btn-soft" id="create-client-followup-task">Create follow-up task</button><button class="btn-soft" id="send-client-to-appointment">Send to appointment brain</button><button class="btn-soft" id="book-client-appointment">Book appointment</button><button class="btn-soft" id="return-client-from-appointment">Return to AE</button><button class="btn-soft" id="client-snooze-1d">+1 day</button><button class="btn-soft" id="client-snooze-7d">+7 days</button><button class="btn-soft" id="client-followup-complete">Complete follow-up</button><button class="btn-soft" id="client-handoff-note">Add handoff note</button><button class="btn-soft" id="client-milestone-progress-25">Milestone +25%</button><button class="btn-soft" id="client-milestone-progress-50">Milestone +50%</button><button class="btn-soft" id="client-milestone-clear">Clear milestone</button><button class="btn-soft" id="export-client-json">Export dossier JSON</button><button class="btn-soft" id="export-client-md">Export dossier Markdown</button><button class="btn-soft" id="export-client-handoff-json">Export handoff JSON</button><button class="btn-soft" id="export-client-handoff-md">Export handoff Markdown</button></div>
      <div class="toolbar"><select id="client-template-select"><option value="">Choose task template</option>${TASK_TEMPLATE_LIBRARY.map(template => `<option value="${template.id}">${template.label}</option>`).join('')}</select><button class="btn-soft" id="create-client-template-task">Create template task</button><select id="client-plan-select"><option value="">Choose action plan</option>${CLIENT_ACTION_PLAN_LIBRARY.map(plan => `<option value="${plan.id}">${plan.label}</option>`).join('')}</select><button class="btn-soft" id="create-client-plan">Create action plan</button></div>
    </div>
    <div class="item"><div class="eyebrow">Top AE candidates</div>${candidates.length ? `<div class="match-stack">${candidates.map(item => `<div class="match-chip"><strong>${escapeHtml(item.name)}</strong> · ${escapeHtml(item.title)} · score ${item.score}</div>`).join('')}</div>` : '<div class="meta">No candidate insights available.</div>'}</div>
    <div class="item"><div class="eyebrow">Recommended actions</div>${getClientRecommendedActions(client).length ? `<div class="match-stack">${getClientRecommendedActions(client).map(action => `<div class="match-chip"><strong>${escapeHtml(action.label)}</strong> · ${escapeHtml(action.detail)} <button class="btn-tag" data-act="client-recommendation" data-id="${client.id}" data-recommendation="${action.id}">Apply</button></div>`).join('')}</div>` : '<div class="meta">No recommendation actions are currently surfaced.</div>'}</div>
    <div class="item"><div class="eyebrow">Linked tasks</div>${relatedTasks.length ? relatedTasks.map(task => `<div class="meta">${escapeHtml(task.title)} · ${escapeHtml(task.status || 'todo')} · ${escapeHtml(task.updatedAt || task.createdAt || '')}</div>`).join('') : '<div class="meta">No tasks linked yet.</div>'}</div>
    <div class="item"><div class="eyebrow">Linked threads</div>${relatedThreads.length ? relatedThreads.map(thread => `<div class="meta">${escapeHtml(thread.subject)} · ${escapeHtml(thread.messageCount || 0)} messages</div>`).join('') : '<div class="meta">No threads linked yet.</div>'}</div>
    <div class="item"><div class="eyebrow">Appointment brain</div>${(() => { const appt = getClientAppointmentHistory(client.id); return appt.handoffs.length || appt.appointments.length ? `<div class="meta">Handoffs ${appt.handoffs.length} · Appointments ${appt.appointments.length}</div>${appt.handoffs.map(row => `<div class="meta">handoff · ${escapeHtml(row.status || 'queued')} · ${escapeHtml(row.qualificationStatus || 'new')} · ${escapeHtml(row.updatedAt || row.createdAt || '')}</div>`).join('')}${appt.appointments.map(row => `<div class="meta">appointment · ${escapeHtml(row.status || 'scheduled')} · ${escapeHtml(String(row.startAt || '').slice(0,16))} · ${escapeHtml(computeAppointmentNoShowRisk(row).label)}</div>`).join('')}` : '<div class="meta">No appointment-brain history yet.</div>'; })()}</div>
    <div class="item"><div class="eyebrow">Activity timeline</div>${timeline.length ? timeline.map(row => `<div class="meta">${escapeHtml(row.at)} · ${escapeHtml(row.kind)} · ${escapeHtml(row.title)} · ${escapeHtml(row.detail)}</div>`).join('') : '<div class="meta">No activity timeline yet.</div>'}</div>
    ${client.assignmentHistory?.length ? client.assignmentHistory.map(row => `<div class="item"><div class="meta">${row.aeName} · ${row.mode} · ${row.at}</div></div>`).join('') : '<div class="item"><div class="meta">No assignment history yet.</div></div>'}`;
  $('#manual-assign-btn')?.addEventListener('click', () => {
    const aeId = $('#history-ae-select').value;
    if (!aeId) return alert('Choose an AE first.');
    assignClient(state, client.id, aeId, 'manual');
    remoteUpsert('clients', client);
    remoteUpsert('assignments', client.assignmentHistory?.[0]);
    persist();
    render();
    renderClientHistory(client.id);
  });
  $('#client-edit-form')?.addEventListener('click', () => loadClientIntoForm(client));
  $('#client-snooze-1d')?.addEventListener('click', () => { shiftClientFollowUp(client.id, 1); render(); renderClientHistory(client.id, true); });
  $('#client-snooze-7d')?.addEventListener('click', () => { shiftClientFollowUp(client.id, 7); render(); renderClientHistory(client.id, true); });
  $('#client-followup-complete')?.addEventListener('click', () => { completeClientFollowUp(client.id); render(); renderClientHistory(client.id, true); });
  $('#create-client-task')?.addEventListener('click', () => {
    createTaskFromClient(client);
    render();
    renderClientHistory(client.id);
  });
  $('#create-client-thread')?.addEventListener('click', () => {
    const thread = createThreadFromClient(client);
    render();
    renderClientHistory(client.id);
    page = 'transcripts';
    renderNav();
    render();
    openThread(thread.id);
  });
  $('#create-client-followup-task')?.addEventListener('click', () => {
    createFollowupTaskFromClient(client, 'dossier-followup');
    render();
    renderClientHistory(client.id);
  });
  $('#send-client-to-appointment')?.addEventListener('click', () => {
    sendClientToAppointmentSetter(client.id, 'client-dossier');
    render();
    renderClientHistory(client.id);
  });
  $('#book-client-appointment')?.addEventListener('click', () => {
    const handoff = sendClientToAppointmentSetter(client.id, 'client-dossier-book');
    if (handoff) createAppointmentFromHandoff(handoff.id);
    render();
    renderClientHistory(client.id);
  });
  $('#return-client-from-appointment')?.addEventListener('click', () => {
    const appt = getAppointmentRecords().find(item => item.clientId === client.id);
    if (appt) returnAppointmentClientToAe(appt.id, 'Returned from dossier control');
    render();
    renderClientHistory(client.id);
  });
  $('#create-client-template-task')?.addEventListener('click', () => {
    const templateId = $('#client-template-select')?.value || '';
    if (!templateId) return alert('Choose a task template first.');
    createTaskFromTemplate(templateId, { clientId: client.id, aeId: client.assignedAeId || '' });
    render();
    renderClientHistory(client.id);
  });
  $('#create-client-plan')?.addEventListener('click', () => {
    const planId = $('#client-plan-select')?.value || '';
    if (!planId) return alert('Choose an action plan first.');
    createClientActionPlan(client.id, planId);
    render();
    renderClientHistory(client.id);
  });
  document.querySelectorAll('[data-act="client-recommendation"]').forEach(btn => btn.addEventListener('click', () => {
    applyClientRecommendation(btn.dataset.id, btn.dataset.recommendation);
    render();
    renderClientHistory(client.id);
  }));
  $('#client-handoff-note')?.addEventListener('click', () => {
    addClientHandoffNote(client.id);
    render();
    renderClientHistory(client.id);
  });
  $('#client-milestone-progress-25')?.addEventListener('click', () => { advanceClientMilestone(client.id, 25); render(); renderClientHistory(client.id); });
  $('#client-milestone-progress-50')?.addEventListener('click', () => { advanceClientMilestone(client.id, 50); render(); renderClientHistory(client.id); });
  $('#client-milestone-clear')?.addEventListener('click', () => { clearClientMilestone(client.id); render(); renderClientHistory(client.id); });
  $('#export-client-json')?.addEventListener('click', () => exportClientDossier(client.id, 'json'));
  $('#export-client-md')?.addEventListener('click', () => exportClientDossier(client.id, 'markdown'));
  $('#export-client-handoff-json')?.addEventListener('click', () => exportClientHandoffBrief(client.id, 'json'));
  $('#export-client-handoff-md')?.addEventListener('click', () => exportClientHandoffBrief(client.id, 'markdown'));
  if (focusForm) loadClientIntoForm(client);
}

function renderAeBrains() {
  return `
    <section class="card">
      <div class="eyebrow">13 AE roster</div>
      <h3>Profiles, prompts, caps, key-slot map, coverage planner, remote overrides, and rebalance controls</h3>
      <div class="toolbar"><button class="btn-soft" id="ae-page-rebalance">Rebalance clients from unavailable AEs</button></div>
      <div class="list">${state.aeProfiles.map(ae => {
        const failover = Array.isArray(ae.failoverProviders) ? ae.failoverProviders.join(', ') : '';
        const slotHealth = getHealthSlot(ae);
        const capacity = getAeCapacityState(ae);
        const availability = getAeAvailabilityState(ae);
        return `
        <article class="item">
          <div class="split">
            <div>
              <h4>${ae.name}</h4>
              <div class="meta">${ae.title} · lane: ${ae.lane} · key slot: <span class="mono">${ae.keySlot}</span></div>
              <p>${ae.systemPrompt}</p>
              <div class="tag-row">${(ae.specialties || []).map(tag => `<span class="tag">${tag}</span>`).join('')}</div>
            </div>
            <div>
              <div class="meta">Headshot prompt</div>
              <p class="meta">${ae.headshotPrompt}</p>
              <div class="form-grid compact">
                <label><span>Provider</span><select data-ae-provider data-id="${ae.id}"><option value="openai" ${String(ae.provider || 'openai') === 'openai' ? 'selected' : ''}>openai</option><option value="anthropic" ${String(ae.provider || '') === 'anthropic' ? 'selected' : ''}>anthropic</option><option value="gemini" ${String(ae.provider || '') === 'gemini' ? 'selected' : ''}>gemini</option></select></label>
                <label><span>Model</span><input data-ae-model data-id="${ae.id}" value="${escapeHtml(ae.model || '')}"></label>
                <label><span>Availability</span><select data-ae-availability data-id="${ae.id}"><option value="available" ${String(ae.availabilityState || 'available') === 'available' ? 'selected' : ''}>available</option><option value="focus" ${String(ae.availabilityState || '') === 'focus' ? 'selected' : ''}>focus</option><option value="backup" ${String(ae.availabilityState || '') === 'backup' ? 'selected' : ''}>backup-only</option><option value="out" ${String(ae.availabilityState || '') === 'out' ? 'selected' : ''}>out</option></select></label>
                <label><span>Unavailable until</span><input data-ae-until data-id="${ae.id}" type="date" value="${escapeHtml(ae.unavailableUntil || '')}"></label>
                <label class="full"><span>Coverage note</span><input data-ae-note data-id="${ae.id}" value="${escapeHtml(ae.coverageNote || '')}" placeholder="Focus window, PTO, overflow backup, or routing note"></label>
                <label class="full"><span>Failover providers</span><input data-ae-failover data-id="${ae.id}" value="${escapeHtml(failover)}" placeholder="anthropic, gemini"></label>
              </div>
              <div class="toolbar">
                <button class="btn-soft" data-act="toggle-ae" data-id="${ae.id}">${ae.enabled ? 'Disable' : 'Enable'}</button>
                <button class="btn-soft" data-act="override-ae" data-id="${ae.id}">Override caps</button>
                <button class="btn-soft" data-act="save-ae-runtime" data-id="${ae.id}">Save runtime</button>
              </div>
              <div class="meta">Daily cap: ${ae.overrideDailyCap || ae.dailyCap} · Monthly cap: ${ae.overrideMonthlyCap || ae.monthlyCap} · Assignments: ${ae.assignments} · provider: ${ae.provider || 'openai'} · runtime state: ${capacity} · availability: ${availability.label} · openai slot: ${slotHealth.openai ? 'configured' : 'missing'} · fallbacks: ${slotHealth.fallbacks || 'none'}</div>
              ${availability.detail ? `<div class="meta">Coverage note: ${escapeHtml(availability.detail)}</div>` : ''}
            </div>
          </div>
        </article>`;
      }).join('')}</div>
    </section>`;
}

function renderTasks() {
  const tasks = getFilteredTasks();
  const dueCounts = getTaskDueCounts();
  const presets = Array.isArray(state.taskFilterPresets) ? state.taskFilterPresets : [];
  const rows = tasks.map(task => {
    const due = getTaskDueState(task);
    const dependency = getTaskDependency(task);
    const recurrence = getRecurrenceConfig(task.recurrenceCadence || 'none');
    const effort = getTaskEffortState(task);
    return `
    <div class="item">
      <div class="toolbar"><label class="checkbox-inline"><input class="task-select" type="checkbox" data-id="${task.id}" ${selectedTaskIds.has(task.id) ? 'checked' : ''}> <span>Select</span></label><span class="tag">${escapeHtml(task.status || 'todo')}</span></div>
      <h4>${escapeHtml(task.title)}</h4>
      <div class="meta">${escapeHtml(task.assignedAeName || 'No AE')} · ${escapeHtml(task.clientName || 'No client')} · ${escapeHtml(due.label)}</div>
      ${task.dependsOnTaskId ? `<div class="meta">Dependency: ${escapeHtml(dependency.label)}</div>` : ''}${String(task.recurrenceCadence || 'none') !== 'none' ? `<div class="meta">Recurrence: ${escapeHtml(recurrence.label)} · cycle ${Number(task.recurrenceIteration || 1)}</div>` : ''}<div class="meta">Effort: ${escapeHtml(effort.label)}</div>
      <p>${escapeHtml(task.notes || '')}</p>
      <div class="toolbar"><button class="btn-soft" data-act="task-status" data-id="${task.id}" data-status="todo">To do</button><button class="btn-soft" data-act="task-status" data-id="${task.id}" data-status="doing">Doing</button><button class="btn-soft" data-act="task-status" data-id="${task.id}" data-status="blocked">Blocked</button><button class="btn-soft" data-act="task-status" data-id="${task.id}" data-status="done">Done</button><button class="btn-soft" data-act="task-edit" data-id="${task.id}">Edit</button><button class="btn-soft" data-act="task-snooze-inline" data-id="${task.id}" data-days="1">+1 day</button><button class="btn-soft" data-act="task-snooze-inline" data-id="${task.id}" data-days="7">+7 days</button><button class="btn-soft" data-act="task-add-effort" data-id="${task.id}" data-minutes="15">+15 min</button><button class="btn-soft" data-act="task-add-effort" data-id="${task.id}" data-minutes="30">+30 min</button>${task.dependsOnTaskId ? `<button class="btn-soft" data-act="task-resume-dependency" data-id="${task.id}">Resume</button>` : ''}<button class="btn-soft" data-act="task-export-json" data-id="${task.id}">JSON</button><button class="btn-soft" data-act="task-export-md" data-id="${task.id}">Markdown</button></div>
    </div>`;
  }).join('');
  return `
    <section class="card">
      <div class="eyebrow">Task capture</div>
      <h3>Create or update a task</h3>
      <div class="form-grid">
        <label><span>Title</span><input id="task-title" placeholder="Task title"></label>
        <label><span>Due date</span><input id="task-due" type="date"></label>
        <label><span>AE</span><select id="task-ae"><option value="">No AE</option>${state.aeProfiles.map(ae => `<option value="${ae.id}">${ae.name}</option>`).join('')}</select></label>
        <label><span>Client</span><select id="task-client"><option value="">No client</option>${state.clients.map(client => `<option value="${client.id}">${client.name}</option>`).join('')}</select></label>
        <label><span>Status</span><select id="task-status-form"><option value="todo">todo</option><option value="doing">doing</option><option value="waiting">waiting</option><option value="blocked">blocked</option><option value="done">done</option></select></label>
        <label><span>Blocker note</span><input id="task-blocker-note" placeholder="Why is this task blocked?"></label>
        <label><span>Recurrence</span><select id="task-recurrence">${TASK_RECURRENCE_OPTIONS.map(option => `<option value="${option.value}">${option.label}</option>`).join('')}</select></label>
        <label><span>Depends on task</span><select id="task-dependency"><option value="">No dependency</option>${state.tasks.map(task => `<option value="${task.id}">${escapeHtml(task.title)}</option>`).join('')}</select></label>
        <label><span>Estimated minutes</span><input id="task-estimated-minutes" type="number" min="0" step="15" value="0"></label>
        <label><span>Actual minutes</span><input id="task-actual-minutes" type="number" min="0" step="15" value="0"></label>
        <label class="full"><span>Notes</span><textarea id="task-notes" placeholder="Task notes"></textarea></label>
      </div>
      <div class="meta" id="task-form-mode">Create mode · saving adds a new task record.</div>
      <div class="toolbar"><select id="task-template-select"><option value="">Choose task template</option>${TASK_TEMPLATE_LIBRARY.map(template => `<option value="${template.id}">${template.label}</option>`).join('')}</select><button class="btn-soft" id="task-template-apply">Load template into form</button><button class="btn-soft" id="task-template-create">Create from template</button></div>
      <div class="toolbar"><button class="btn" id="save-task">Save task</button><button class="btn-soft" id="clear-task-form">Clear</button><button class="btn-soft" id="cancel-task-edit" hidden>Cancel edit</button></div>
    </section>
    <section class="grid-2">
      <div class="card">
        <div class="eyebrow">Task board</div>
        <h3>Current tasks</h3>
        <div class="search-row"><input id="task-search" placeholder="Search tasks" value="${escapeHtml(taskFilters.query)}"><select id="task-status-filter"><option value="">All statuses</option>${['todo','doing','waiting','blocked','done'].map(status => `<option value="${status}" ${taskFilters.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select><select id="task-ae-filter"><option value="">All AEs</option>${state.aeProfiles.map(ae => `<option value="${ae.id}" ${taskFilters.aeId === ae.id ? 'selected' : ''}>${ae.name}</option>`).join('')}</select><select id="task-client-filter"><option value="">All clients</option>${state.clients.map(client => `<option value="${client.id}" ${taskFilters.clientId === client.id ? 'selected' : ''}>${client.name}</option>`).join('')}</select><select id="task-due-filter"><option value="">All due states</option>${['overdue','today','upcoming','none'].map(status => `<option value="${status}" ${taskFilters.due === status ? 'selected' : ''}>${status}</option>`).join('')}</select><select id="task-export-type"><option value="json">Export JSON</option><option value="markdown">Export Markdown</option></select><button class="btn-soft" id="task-filter-reset">Reset filters</button></div>
        <div class="toolbar preset-row"><button class="btn-soft" id="save-task-filter-preset">Save current filters</button><div class="tag-row">${presets.length ? presets.map(preset => `<span class="tag actionable-tag"><button class="btn-tag" data-act="load-task-preset" data-id="${preset.id}">${escapeHtml(preset.name)}</button><button class="btn-tag danger" data-act="delete-task-preset" data-id="${preset.id}">×</button></span>`).join('') : '<span class="meta">No saved task filter presets yet.</span>'}</div></div>
        <div class="bulk-row">
          <label class="checkbox-inline"><input id="select-all-visible-tasks" type="checkbox"> <span>Select visible</span></label>
          <div class="meta" id="task-bulk-count">${selectedTaskIds.size} selected</div>
          <select id="bulk-task-status"><option value="">Status for selected</option><option value="todo">todo</option><option value="doing">doing</option><option value="waiting">waiting</option><option value="done">done</option></select>
          <button class="btn-soft" id="bulk-update-task-status">Apply status</button>
          <button class="btn-soft" id="bulk-task-snooze-1">+1 day</button>
          <button class="btn-soft" id="bulk-task-snooze-7">+7 days</button>
          <button class="btn-soft" id="bulk-export-tasks">Export selected</button>
          <button class="btn-soft danger" id="bulk-delete-tasks">Delete selected</button>
        </div>
        <div class="tag-row"><span class="tag">Overdue ${dueCounts.overdue || 0}</span><span class="tag">Today ${dueCounts.today || 0}</span><span class="tag">Upcoming ${dueCounts.upcoming || 0}</span><span class="tag">Blocked ${getTaskBlockedCounts().blocked || 0}</span><span class="tag">Dependency waiting ${getTaskDependencyCounts().waiting || 0}</span><span class="tag">Effort overruns ${getTaskEffortSummary().overrun || 0}</span><span class="tag">Filtered ${tasks.length}</span></div>
        <div class="list">${rows || '<div class="item"><div class="meta">No tasks matched.</div></div>'}</div>
      </div>
      <div class="card"><div class="eyebrow">Task control</div><h3>Task due-state operations</h3><div class="list">${getTaskQueue().length ? getTaskQueue().map(task => { const due = getTaskDueState(task); return `<div class="item"><h4>${escapeHtml(task.title)}</h4><div class="meta">${escapeHtml(task.assignedAeName || 'No AE')} · ${escapeHtml(task.clientName || 'No client')} · ${escapeHtml(due.label)} · ${escapeHtml(getTaskEffortState(task).label)}</div><div class="toolbar"><button class="btn-soft" data-act="task-edit" data-id="${task.id}">Open</button><button class="btn-soft" data-act="task-snooze-inline" data-id="${task.id}" data-days="1">+1 day</button><button class="btn-soft" data-act="task-snooze-inline" data-id="${task.id}" data-days="7">+7 days</button><button class="btn-soft" data-act="task-add-effort" data-id="${task.id}" data-minutes="15">+15 min</button><button class="btn-soft" data-act="task-status" data-id="${task.id}" data-status="done">Done</button></div></div>`; }).join('') : '<div class="item"><div class="meta">No dated open tasks yet.</div></div>'}</div><div class="eyebrow" style="margin-top:16px">Blocked task queue</div><div class="list">${getBlockedTasks().length ? getBlockedTasks().map(task => `<div class="item"><h4>${escapeHtml(task.title)}</h4><div class="meta">${escapeHtml(task.assignedAeName || 'No AE')} · ${escapeHtml(task.clientName || 'No client linked')}</div><p>${escapeHtml(task.blockerNote || 'No blocker note recorded.')}</p><div class="toolbar"><button class="btn-soft" data-act="task-edit" data-id="${task.id}">Open</button><button class="btn-soft" data-act="task-status" data-id="${task.id}" data-status="todo">Unblock</button><button class="btn-soft" data-act="blocked-task-escalate" data-id="${task.id}">Escalate client</button></div></div>`).join('') : '<div class="item"><div class="meta">No blocked tasks right now.</div></div>'}</div><div class="eyebrow" style="margin-top:16px">Dependency queue</div><div class="list">${getDependencyBlockedTasks().length ? getDependencyBlockedTasks().map(item => `<div class="item"><h4>${escapeHtml(item.task.title)}</h4><div class="meta">${escapeHtml(item.task.assignedAeName || 'No AE')} · ${escapeHtml(item.task.clientName || 'No client linked')} · ${escapeHtml(item.dependency.label)}</div><p>${escapeHtml(item.task.blockerNote || 'No dependency blocker note recorded.')}</p><div class="toolbar"><button class="btn-soft" data-act="task-edit" data-id="${item.task.id}">Open</button><button class="btn-soft" data-act="dependency-open-task" data-id="${item.dependency.task?.id || ''}">Open dependency</button><button class="btn-soft" data-act="task-resume-dependency" data-id="${item.task.id}">Resume</button></div></div>`).join('') : '<div class="item"><div class="meta">No dependency-blocked tasks right now.</div></div>'}</div><div class="eyebrow" style="margin-top:16px">Effort queue</div><div class="list">${getTaskEffortQueue().length ? getTaskEffortQueue().map(item => `<div class="item"><h4>${escapeHtml(item.task.title)}</h4><div class="meta">${escapeHtml(item.task.assignedAeName || 'No AE')} · ${escapeHtml(item.task.clientName || 'No client linked')} · ${escapeHtml(item.effort.label)}</div><div class="toolbar"><button class="btn-soft" data-act="task-edit" data-id="${item.task.id}">Open</button><button class="btn-soft" data-act="task-add-effort" data-id="${item.task.id}" data-minutes="15">+15 min</button><button class="btn-soft" data-act="task-add-effort" data-id="${item.task.id}" data-minutes="30">+30 min</button></div></div>`).join('') : '<div class="item"><div class="meta">No effort-tracked tasks right now.</div></div>'}</div></div>
    </section>`;
}

function renderTranscripts() {
  const { results, totalMessages } = getTranscriptSearchResults();
  const pinnedCount = state.threads.filter(thread => thread.pinned).length;
  const resolvedCount = state.threads.filter(thread => thread.state === 'resolved').length;
  const openCount = state.threads.filter(thread => (thread.state || 'open') !== 'resolved').length;
  const staleCount = getThreadFreshnessCounts().stale || 0;
  const awaitingCount = getAwaitingResponseCounts().awaiting || 0;
  const summaryCounts = getThreadSummaryCounts();
  const threadCards = results.map(result => `
    <div class="item">
      <h4>${escapeHtml(result.thread.subject)}</h4>
      <div class="meta">${escapeHtml(result.thread.clientName || 'No client')} · ${escapeHtml(result.thread.aeName || 'No AE')} · ${result.thread.messageCount || 0} messages · ${result.thread.pinned ? 'Pinned' : 'Not pinned'} · ${escapeHtml(result.thread.state || 'open')}</div>
      ${result.matches.length ? `<div class="match-stack">${result.matches.slice(0, 3).map(match => `<div class="match-chip"><span class="mono">${match.role}</span> ${escapeHtml(match.text)}</div>`).join('')}</div>` : ''}
      <div class="toolbar"><button class="btn-soft" data-act="open-thread" data-id="${result.thread.id}">Open thread</button><button class="btn-soft" data-act="thread-toggle-pin" data-id="${result.thread.id}">${result.thread.pinned ? 'Unpin' : 'Pin'}</button><button class="btn-soft" data-act="thread-toggle-state" data-id="${result.thread.id}">${(result.thread.state || 'open') === 'resolved' ? 'Reopen' : 'Resolve'}</button></div>
    </div>`).join('');
  return `
    <section class="card">
      <div class="eyebrow">Create transcript thread</div>
      <h3>Offline thread logger</h3>
      <div class="form-grid">
        <label><span>Subject</span><input id="thread-subject" placeholder="Thread subject"></label>
        <label><span>AE</span><select id="thread-ae"><option value="">No AE</option>${state.aeProfiles.map(ae => `<option value="${ae.id}">${ae.name}</option>`).join('')}</select></label>
        <label><span>Client</span><select id="thread-client"><option value="">No client</option>${state.clients.map(client => `<option value="${client.id}">${client.name}</option>`).join('')}</select></label>
        <label><span>Role</span><select id="thread-role"><option value="user">User</option><option value="assistant">Assistant</option></select></label>
        <label class="full"><span>First message</span><textarea id="thread-message" placeholder="Message text"></textarea></label>
      </div>
      <div class="toolbar"><button class="btn" id="save-thread">Save thread</button></div>
    </section>
    <section class="grid-2">
      <div class="card">
        <div class="eyebrow">Transcript threads</div>
        <h3>Thread list, state control, export, and task promotion</h3>
        <div class="search-row"><input id="transcript-search" placeholder="Search subject, client, AE, or message text" value="${escapeHtml(transcriptFilters.query)}"><select id="transcript-ae-filter"><option value="">All AEs</option>${state.aeProfiles.map(ae => `<option value="${ae.id}" ${transcriptFilters.aeId === ae.id ? 'selected' : ''}>${ae.name}</option>`).join('')}</select><select id="transcript-client-filter"><option value="">All clients</option>${state.clients.map(client => `<option value="${client.id}" ${transcriptFilters.clientId === client.id ? 'selected' : ''}>${client.name}</option>`).join('')}</select><select id="transcript-state-filter"><option value="">All thread states</option>${['open','resolved','pinned','stale','awaiting'].map(stateKey => `<option value="${stateKey}" ${transcriptFilters.state === stateKey ? 'selected' : ''}>${stateKey}</option>`).join('')}</select></div>
        <div class="tag-row"><span class="tag">Open ${openCount}</span><span class="tag">Resolved ${resolvedCount}</span><span class="tag">Pinned ${pinnedCount}</span><span class="tag">Stale ${staleCount}</span><span class="tag">Awaiting ${awaitingCount}</span><span class="tag">Summaries ${summaryCounts.summaries}</span><span class="tag">Open questions ${summaryCounts.openQuestions}</span></div>
        <div class="meta search-meta">${results.length} threads matched · ${totalMessages} messages searched</div>
        <div class="list" id="thread-list">${threadCards || '<div class="item"><div class="meta">No transcript threads matched.</div></div>'}</div>
      </div>
      <div class="card"><div class="eyebrow">Transcript detail</div><h3>Selected thread</h3><div id="thread-detail" class="list"><div class="item"><div class="meta">Open a thread to view transcript messages, export the transcript, promote it into a task, or use a response playbook.</div></div></div></div>
    </section>`;
}

function renderDirective() {
  return `
    <section class="card">
      <div class="eyebrow">Directive file</div>
      <h3>Smoke-backed implementation directive</h3>
      <pre class="directive">${escapeHtml(window.__directiveText || 'Directive file unavailable.')}</pre>
    </section>`;
}

function bindAeBrains() {
  $('#ae-page-rebalance')?.addEventListener('click', () => {
    const moved = rebalanceUnavailableAeClients();
    if (!moved) return alert('No clients needed rebalancing.');
    render();
  });
  document.querySelectorAll('[data-act="toggle-ae"]').forEach(btn => btn.addEventListener('click', async () => {
    const ae = state.aeProfiles.find(item => item.id === btn.dataset.id);
    ae.enabled = !ae.enabled;
    state.auditLog.unshift({ id: uid('audit'), kind: 'ae-status', message: `${ae.name} ${ae.enabled ? 'enabled' : 'disabled'}`, at: nowIso() });
    persist();
    await persistAeProfile(ae);
    render();
  }));
  document.querySelectorAll('[data-act="override-ae"]').forEach(btn => btn.addEventListener('click', async () => {
    const ae = state.aeProfiles.find(item => item.id === btn.dataset.id);
    const daily = prompt(`Override daily cap for ${ae.name}`, String(ae.overrideDailyCap || ae.dailyCap || ''));
    const monthly = prompt(`Override monthly cap for ${ae.name}`, String(ae.overrideMonthlyCap || ae.monthlyCap || ''));
    if (daily !== null) ae.overrideDailyCap = Number(daily || 0);
    if (monthly !== null) ae.overrideMonthlyCap = Number(monthly || 0);
    state.auditLog.unshift({ id: uid('audit'), kind: 'ae-cap-override', message: `${ae.name} cap override updated`, at: nowIso() });
    persist();
    await persistAeProfile(ae);
    render();
  }));
  document.querySelectorAll('[data-act="save-ae-runtime"]').forEach(btn => btn.addEventListener('click', async () => {
    const ae = state.aeProfiles.find(item => item.id === btn.dataset.id);
    const provider = document.querySelector(`[data-ae-provider][data-id="${ae.id}"]`)?.value || 'openai';
    const model = document.querySelector(`[data-ae-model][data-id="${ae.id}"]`)?.value?.trim() || '';
    const availabilityState = document.querySelector(`[data-ae-availability][data-id="${ae.id}"]`)?.value || 'available';
    const unavailableUntil = document.querySelector(`[data-ae-until][data-id="${ae.id}"]`)?.value || '';
    const coverageNote = document.querySelector(`[data-ae-note][data-id="${ae.id}"]`)?.value?.trim() || '';
    const failoverRaw = document.querySelector(`[data-ae-failover][data-id="${ae.id}"]`)?.value || '';
    ae.provider = provider;
    ae.model = model;
    ae.availabilityState = availabilityState;
    ae.unavailableUntil = unavailableUntil;
    ae.coverageNote = coverageNote;
    ae.backupOnly = availabilityState === 'backup';
    ae.failoverProviders = failoverRaw.split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
    state.auditLog.unshift({ id: uid('audit'), kind: 'ae-runtime', message: `${ae.name} runtime updated`, at: nowIso() });
    persist();
    await persistAeProfile(ae);
    render();
  }));
}

function bindTasks() {
  updateTaskFormMode();
  $('#save-task').addEventListener('click', () => {
    const ae = state.aeProfiles.find(item => item.id === $('#task-ae').value);
    const client = state.clients.find(item => item.id === $('#task-client').value);
    const draft = {
      title: $('#task-title').value.trim(),
      dueDate: $('#task-due').value,
      assignedAeId: ae?.id || '',
      assignedAeName: ae?.name || '',
      clientId: client?.id || '',
      clientName: client?.name || '',
      notes: $('#task-notes').value.trim(),
      status: $('#task-status-form')?.value || 'todo',
      blockerNote: $('#task-blocker-note')?.value.trim() || '',
      dependsOnTaskId: $('#task-dependency')?.value || '',
      dependsOnTaskTitle: state.tasks.find(item => item.id === ($('#task-dependency')?.value || ''))?.title || '',
      recurrenceCadence: $('#task-recurrence')?.value || 'none',
      estimatedMinutes: Number($('#task-estimated-minutes')?.value || 0),
      actualMinutes: Number($('#task-actual-minutes')?.value || 0)
    };
    if (!draft.title) return alert('Task title is required.');
    if (editingTaskId && draft.dependsOnTaskId === editingTaskId) return alert('A task cannot depend on itself.');
    if (editingTaskId) {
      const task = state.tasks.find(item => item.id === editingTaskId);
      if (!task) return;
      applyTaskDraft(task, draft, 'update');
      remoteUpsert('tasks', task);
    } else {
      const task = applyTaskDraft({ id: uid('task'), status: 'todo', createdAt: nowIso(), updatedAt: nowIso() }, draft, 'create');
      state.tasks.unshift(task);
      remoteUpsert('tasks', task);
    }
    persist();
    clearTaskForm();
    render();
  });
  $('#clear-task-form')?.addEventListener('click', clearTaskForm);
  $('#task-template-apply')?.addEventListener('click', () => {
    const templateId = $('#task-template-select')?.value || '';
    if (!templateId) return alert('Choose a task template first.');
    applyTaskTemplateToForm(templateId);
  });
  $('#task-template-create')?.addEventListener('click', () => {
    const templateId = $('#task-template-select')?.value || '';
    if (!templateId) return alert('Choose a task template first.');
    createTaskFromTemplate(templateId);
    clearTaskForm();
    render();
  });
  $('#cancel-task-edit')?.addEventListener('click', clearTaskForm);
  $('#task-search')?.addEventListener('input', event => {
    taskFilters.query = event.target.value;
    render();
  });
  $('#task-status-filter')?.addEventListener('change', event => {
    taskFilters.status = event.target.value;
    render();
  });
  $('#task-ae-filter')?.addEventListener('change', event => {
    taskFilters.aeId = event.target.value;
    render();
  });
  $('#task-client-filter')?.addEventListener('change', event => {
    taskFilters.clientId = event.target.value;
    render();
  });
  $('#task-due-filter')?.addEventListener('change', event => {
    taskFilters.due = event.target.value;
    render();
  });
  $('#task-filter-reset')?.addEventListener('click', () => {
    taskFilters = { query: '', status: '', aeId: '', clientId: '', due: '' };
    render();
  });
  $('#save-task-filter-preset')?.addEventListener('click', saveTaskFilterPreset);
  document.querySelectorAll('[data-act="load-task-preset"]').forEach(btn => btn.addEventListener('click', () => loadTaskFilterPreset(btn.dataset.id)));
  document.querySelectorAll('[data-act="delete-task-preset"]').forEach(btn => btn.addEventListener('click', () => deleteTaskFilterPreset(btn.dataset.id)));
  $('#select-all-visible-tasks')?.addEventListener('change', event => {
    const visibleIds = getFilteredTasks().map(task => task.id);
    if (event.target.checked) visibleIds.forEach(id => selectedTaskIds.add(id));
    else visibleIds.forEach(id => selectedTaskIds.delete(id));
    render();
  });
  $('#bulk-update-task-status')?.addEventListener('click', bulkUpdateSelectedTasksStatus);
  $('#bulk-task-snooze-1')?.addEventListener('click', () => bulkSnoozeSelectedTasks(1));
  $('#bulk-task-snooze-7')?.addEventListener('click', () => bulkSnoozeSelectedTasks(7));
  $('#bulk-export-tasks')?.addEventListener('click', exportSelectedTasks);
  $('#bulk-delete-tasks')?.addEventListener('click', bulkDeleteSelectedTasks);
  document.querySelectorAll('[data-act="task-status"]').forEach(btn => btn.addEventListener('click', () => {
    const task = state.tasks.find(item => item.id === btn.dataset.id);
    if (!task) return;
    task.status = btn.dataset.status;
    syncTaskDependencyState(task, false);
    task.updatedAt = nowIso();
    remoteUpsert('tasks', task);
    if (btn.dataset.status === 'done') refreshDependentTasksForTask(task.id);
    persist();
    render();
  }));
  document.querySelectorAll('[data-act="task-edit"]').forEach(btn => btn.addEventListener('click', () => {
    const task = state.tasks.find(item => item.id === btn.dataset.id);
    if (!task) return;
    loadTaskIntoForm(task);
  }));
  document.querySelectorAll('[data-act="task-snooze-inline"]').forEach(btn => btn.addEventListener('click', () => {
    shiftTaskDueDate(btn.dataset.id, Number(btn.dataset.days || 0));
    render();
  }));
  document.querySelectorAll('[data-act="task-add-effort"]').forEach(btn => btn.addEventListener('click', () => {
    addTaskActualMinutes(btn.dataset.id, Number(btn.dataset.minutes || 0));
    render();
  }));
  document.querySelectorAll('[data-act="task-export-json"]').forEach(btn => btn.addEventListener('click', () => exportTaskDossier(btn.dataset.id, 'json')));
  document.querySelectorAll('[data-act="task-export-md"]').forEach(btn => btn.addEventListener('click', () => exportTaskDossier(btn.dataset.id, 'markdown')));
  document.querySelectorAll('[data-act="dependency-open-task"]').forEach(btn => btn.addEventListener('click', () => {
    const dependencyTask = state.tasks.find(item => item.id === btn.dataset.id);
    if (!dependencyTask) return alert('Dependency task not found.');
    loadTaskIntoForm(dependencyTask);
  }));
  document.querySelectorAll('[data-act="blocked-task-escalate"]').forEach(btn => btn.addEventListener('click', () => {
    escalateBlockedTask(btn.dataset.id);
    render();
  }));
  document.querySelectorAll('[data-act="task-resume-dependency"]').forEach(btn => btn.addEventListener('click', () => {
    const resumed = resumeTaskIfDependencyReady(btn.dataset.id);
    if (!resumed) return alert('The dependency is not finished yet.');
    render();
  }));
  bindTaskSelectionControls();
  updateTaskBulkCount();
  syncSelectAllVisibleTasks();
}

function getTranscriptSearchResults() {
  const q = String(transcriptFilters.query || '').trim().toLowerCase();
  const totalMessages = state.messages.length;
  const results = state.threads.filter(thread => {
    const aeHit = !transcriptFilters.aeId || thread.aeId === transcriptFilters.aeId;
    const clientHit = !transcriptFilters.clientId || thread.clientId === transcriptFilters.clientId;
    const stateHit = !transcriptFilters.state
      || (transcriptFilters.state === 'pinned'
        ? Boolean(thread.pinned)
        : transcriptFilters.state === 'resolved'
          ? (thread.state || 'open') === 'resolved'
          : transcriptFilters.state === 'stale'
            ? getThreadFreshness(thread).status === 'stale'
            : transcriptFilters.state === 'awaiting'
              ? getThreadResponseLag(thread).awaiting
              : (thread.state || 'open') !== 'resolved');
    if (!aeHit || !clientHit || !stateHit) return false;
    if (!q) return true;
    const threadMessages = state.messages.filter(item => item.threadId === thread.id);
    const messageHit = threadMessages.some(msg => String(msg.text || '').toLowerCase().includes(q));
    const threadHit = [thread.subject, thread.clientName, thread.aeName, thread.state, thread.summaryNote, thread.openQuestions].join(' ').toLowerCase().includes(q);
    return threadHit || messageHit;
  }).map(thread => {
    const matches = state.messages
      .filter(item => item.threadId === thread.id)
      .filter(item => !q || String(item.text || '').toLowerCase().includes(q))
      .map(item => ({ role: item.role, text: snippetAround(item.text, q) }));
    return { thread, matches };
  }).sort((a, b) => Number(Boolean(b.thread.pinned)) - Number(Boolean(a.thread.pinned)) || (b.thread.updatedAt || '').localeCompare(a.thread.updatedAt || ''));
  return { results, totalMessages };
}

function bindTranscripts() {
  $('#save-thread').addEventListener('click', () => {
    const ae = state.aeProfiles.find(item => item.id === $('#thread-ae').value);
    const client = state.clients.find(item => item.id === $('#thread-client').value);
    const thread = {
      id: uid('thread'),
      subject: $('#thread-subject').value.trim(),
      aeId: ae?.id || '',
      aeName: ae?.name || '',
      clientId: client?.id || '',
      clientName: client?.name || '',
      messageCount: 0,
      pinned: false,
      state: 'open',
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const messageText = $('#thread-message').value.trim();
    const role = $('#thread-role').value;
    if (!thread.subject || !messageText) return alert('Thread subject and first message are required.');
    const firstMessage = { id: uid('msg'), threadId: thread.id, role, text: messageText, at: nowIso() };
    state.threads.unshift(thread);
    state.messages.unshift(firstMessage);
    thread.messageCount = 1;
    remoteUpsert('threads', thread);
    remoteUpsert('messages', firstMessage);
    state.auditLog.unshift({ id: uid('audit'), kind: 'thread', message: `Thread created: ${thread.subject}`, at: nowIso() });
    persist();
    render();
    openThread(thread.id);
  });
  document.querySelectorAll('[data-act="open-thread"]').forEach(btn => btn.addEventListener('click', () => openThread(btn.dataset.id)));
  document.querySelectorAll('[data-act="thread-toggle-pin"]').forEach(btn => btn.addEventListener('click', () => {
    const thread = state.threads.find(item => item.id === btn.dataset.id);
    if (!thread) return;
    thread.pinned = !thread.pinned;
    thread.updatedAt = nowIso();
    remoteUpsert('threads', thread);
    state.auditLog.unshift({ id: uid('audit'), kind: 'thread-pin', message: `${thread.subject} ${thread.pinned ? 'pinned' : 'unpinned'}`, at: nowIso() });
    persist();
    render();
    openThread(thread.id);
  }));
  document.querySelectorAll('[data-act="thread-toggle-state"]').forEach(btn => btn.addEventListener('click', () => {
    const thread = state.threads.find(item => item.id === btn.dataset.id);
    if (!thread) return;
    thread.state = (thread.state || 'open') === 'resolved' ? 'open' : 'resolved';
    thread.updatedAt = nowIso();
    remoteUpsert('threads', thread);
    state.auditLog.unshift({ id: uid('audit'), kind: 'thread-state', message: `${thread.subject} marked ${thread.state}`, at: nowIso() });
    persist();
    render();
    openThread(thread.id);
  }));
  $('#transcript-search')?.addEventListener('input', event => {
    transcriptFilters.query = event.target.value;
    render();
  });
  $('#transcript-ae-filter')?.addEventListener('change', event => {
    transcriptFilters.aeId = event.target.value;
    render();
  });
  $('#transcript-client-filter')?.addEventListener('change', event => {
    transcriptFilters.clientId = event.target.value;
    render();
  });
  $('#transcript-state-filter')?.addEventListener('change', event => {
    transcriptFilters.state = event.target.value;
    render();
  });
}

function openThread(threadId, playbookId = '') {
  const thread = state.threads.find(item => item.id === threadId);
  if (!thread) return;
  const messages = state.messages.filter(item => item.threadId === threadId).sort((a,b) => (a.at || '').localeCompare(b.at || ''));
  const freshness = getThreadFreshness(thread);
  const responseLag = getThreadResponseLag(thread);
  $('#thread-detail').innerHTML = `
    <div class="item"><h4>${escapeHtml(thread.subject)}</h4><div class="meta">${escapeHtml(thread.clientName || 'No client')} · ${escapeHtml(thread.aeName || 'No AE')} · ${thread.pinned ? 'Pinned' : 'Not pinned'} · ${escapeHtml(thread.state || 'open')} · ${escapeHtml(freshness.label)}${responseLag.awaiting ? ` · ${escapeHtml(responseLag.label)}` : ''}${thread.draftReply ? ` · draft saved ${escapeHtml(thread.draftUpdatedAt || '')}` : ''}</div><div class="toolbar"><button class="btn-soft" id="export-thread-json">Export JSON</button><button class="btn-soft" id="export-thread-md">Export Markdown</button><button class="btn-soft" id="thread-to-task">Promote to task</button><button class="btn-soft" id="thread-response-task">Response task</button><button class="btn-soft" id="thread-pin-toggle">${thread.pinned ? 'Unpin' : 'Pin'}</button><button class="btn-soft" id="thread-state-toggle">${(thread.state || 'open') === 'resolved' ? 'Reopen' : 'Resolve'}</button></div></div>
    ${messages.map(msg => `<div class="item"><div class="eyebrow">${msg.role}</div><div>${escapeHtml(msg.text)}</div><div class="meta">${msg.at}</div></div>`).join('')}
    <div class="item"><label><span>Thread summary</span><textarea id="thread-summary" placeholder="Summary of the thread so far">${escapeHtml(thread.summaryNote || '')}</textarea></label><label><span>Open questions</span><textarea id="thread-open-questions" placeholder="Outstanding questions, missing answers, or unresolved items">${escapeHtml(thread.openQuestions || '')}</textarea></label><div class="meta">Summary last updated ${escapeHtml(thread.summaryUpdatedAt || 'not yet saved')}.</div><div class="toolbar"><button class="btn-soft" id="save-thread-summary">Save summary</button><button class="btn-soft" id="clear-thread-summary">Clear summary</button></div></div>
    <div class="item"><label><span>Add message</span><textarea id="thread-reply">${escapeHtml(thread.draftReply || '')}</textarea></label><div class="meta">Draft autosaves while you type and restores when this thread is reopened.</div><div class="toolbar"><select id="thread-playbook-select"><option value="">Choose response playbook</option>${RESPONSE_PLAYBOOK_LIBRARY.map(playbook => `<option value="${playbook.id}">${playbook.label}</option>`).join('')}</select><button class="btn-soft" id="thread-playbook-apply">Insert playbook</button><button class="btn-soft" id="thread-playbook-save">Save playbook reply</button><button class="btn-soft" id="clear-thread-draft">Clear draft</button><button class="btn" id="save-thread-reply">Save message</button></div></div>`;
  $('#export-thread-json')?.addEventListener('click', () => exportThread(threadId, 'json'));
  $('#export-thread-md')?.addEventListener('click', () => exportThread(threadId, 'markdown'));
  $('#thread-to-task')?.addEventListener('click', () => {
    promoteThreadToTask(threadId);
    render();
    openThread(threadId);
  });
  $('#thread-response-task')?.addEventListener('click', () => {
    createThreadResponseTask(threadId, 'thread-detail-response');
    render();
    openThread(threadId);
  });
  $('#thread-pin-toggle')?.addEventListener('click', () => {
    thread.pinned = !thread.pinned;
    thread.updatedAt = nowIso();
    remoteUpsert('threads', thread);
    persist();
    render();
    openThread(threadId);
  });
  $('#thread-state-toggle')?.addEventListener('click', () => {
    thread.state = (thread.state || 'open') === 'resolved' ? 'open' : 'resolved';
    thread.updatedAt = nowIso();
    remoteUpsert('threads', thread);
    persist();
    render();
    openThread(threadId);
  });
  if ($('#thread-playbook-select') && playbookId) {
    $('#thread-playbook-select').value = playbookId;
    applyResponsePlaybookToThread(playbookId, threadId, false);
  }
  $('#thread-reply')?.addEventListener('input', event => {
    persistThreadDraft(threadId, event.target.value);
  });
  $('#save-thread-summary')?.addEventListener('click', () => {
    saveThreadSummary(threadId, $('#thread-summary')?.value || '', $('#thread-open-questions')?.value || '');
    render();
    openThread(threadId);
  });
  $('#clear-thread-summary')?.addEventListener('click', () => {
    clearThreadSummary(threadId);
    render();
    openThread(threadId);
  });
  $('#thread-playbook-apply')?.addEventListener('click', () => {
    const selectedPlaybookId = $('#thread-playbook-select')?.value || '';
    if (!selectedPlaybookId) return alert('Choose a response playbook first.');
    applyResponsePlaybookToThread(selectedPlaybookId, threadId, false);
  });
  $('#thread-playbook-save')?.addEventListener('click', () => {
    const selectedPlaybookId = $('#thread-playbook-select')?.value || '';
    if (!selectedPlaybookId) return alert('Choose a response playbook first.');
    applyResponsePlaybookToThread(selectedPlaybookId, threadId, true);
    render();
    openThread(threadId, selectedPlaybookId);
  });
  $('#clear-thread-draft')?.addEventListener('click', () => {
    clearThreadDraft(threadId);
    render();
    openThread(threadId);
  });
  $('#save-thread-reply').addEventListener('click', () => {
    const text = $('#thread-reply').value.trim();
    if (!text) return;
    const replyRow = { id: uid('msg'), threadId, role: 'assistant', text, at: nowIso() };
    state.messages.push(replyRow);
    thread.messageCount = state.messages.filter(item => item.threadId === threadId).length;
    thread.draftReply = '';
    thread.draftUpdatedAt = '';
    thread.updatedAt = nowIso();
    remoteUpsert('messages', replyRow);
    remoteUpsert('threads', thread);
    state.auditLog.unshift({ id: uid('audit'), kind: 'thread-reply', message: `Reply added to ${thread.subject}`, at: nowIso() });
    persist();
    render();
    openThread(threadId);
  });
}

function renderDirectiveText() {
  return fetch(DIRECTIVE_URL).then(res => res.text()).then(text => {
    window.__directiveText = text;
    if (page === 'directive') render();
  }).catch(() => { window.__directiveText = 'Directive file could not be loaded.'; });
}

function seedDemoData() {
  if (state.clients.length) return alert('Demo data already seeded.');
  const demos = [
    { name: 'Botco.ai', company: 'Botco.ai', clientType: 'growth, infrastructure', needs: 'growth, infrastructure, onboarding', notes: 'AI platform buyer', tags: 'growth, infrastructure, onboarding', stage: 'active', priority: 'high', nextStep: 'Finalize rollout plan' },
    { name: 'Sensagrate', company: 'Sensagrate', clientType: 'local-business, infrastructure', needs: 'infrastructure, local-business', notes: 'Smart-city fit', tags: 'infrastructure, local-business', stage: 'intake', priority: 'normal', nextStep: 'Confirm technical scope' },
    { name: 'Peerlogic', company: 'Peerlogic', clientType: 'growth, premium', needs: 'growth, executive, retention', notes: 'Healthcare AI', tags: 'growth, executive, retention', stage: 'nurture', priority: 'urgent', nextStep: 'Schedule founder review' }
  ].map(item => ({ ...item, id: uid('client'), createdAt: nowIso(), updatedAt: nowIso(), assignmentHistory: [] }));
  state.clients.push(...demos);
  state.tasks.push({ id: uid('task'), title: 'Prepare founder review packet', dueDate: daysAgoIso(1), assignedAeId: '', assignedAeName: '', clientId: demos[0].id, clientName: demos[0].name, notes: 'Compile summary and proposal notes.', status: 'todo', createdAt: nowIso(), updatedAt: nowIso() });
  const staleDate = `${daysAgoIso(6)}T12:00:00.000Z`;
  const thread = { id: uid('thread'), subject: 'Pilot rollout conversation', aeId: '', aeName: '', clientId: demos[0].id, clientName: demos[0].name, messageCount: 2, pinned: false, state: 'open', createdAt: staleDate, updatedAt: staleDate };
  state.threads.push(thread);
  state.messages.push({ id: uid('msg'), threadId: thread.id, role: 'user', text: 'We need a pilot rollout plan for the next 30 days.', at: staleDate });
  state.messages.push({ id: uid('msg'), threadId: thread.id, role: 'assistant', text: 'Understood. I will structure the rollout around onboarding, risk, and measurable milestones.', at: staleDate });
  demos.forEach(client => {
    const match = autoAssignClient(state, client);
    if (match) assignClient(state, client.id, match.id, 'auto');
  });
  persist();
  render();
}

function exportJson() {
  download('ae-brain-command-site-v8-additive.json', exportState(state), 'application/json');
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = normalizeState(JSON.parse(String(reader.result || '{}')), rosterSeed);
      selectedClientIds = new Set();
      selectedTaskIds = new Set();
      persist();
      render();
    } catch (error) {
      alert('Import failed.');
    }
  };
  reader.readAsText(file);
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? '');
  const escaped = text.replaceAll('"', '""');
  return `"${escaped}"`;
}

function snippetAround(text, query) {
  const source = String(text || '');
  if (!query) return source;
  const lower = source.toLowerCase();
  const index = lower.indexOf(query.toLowerCase());
  if (index < 0) return source;
  const start = Math.max(index - 40, 0);
  const end = Math.min(index + query.length + 60, source.length);
  return `${start > 0 ? '…' : ''}${source.slice(start, end)}${end < source.length ? '…' : ''}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}



function renderLiveBrain() {
  const aeOptions = state.aeProfiles.map(ae => `<option value="${ae.id}" ${liveConsole.aeId === ae.id ? 'selected' : ''}>${ae.name}</option>`).join('');
  const clientOptions = state.clients.map(client => `<option value="${client.id}" ${liveConsole.clientId === client.id ? 'selected' : ''}>${client.name}</option>`).join('');
  const filteredThreads = state.threads.filter(thread => (!liveConsole.aeId || thread.aeId === liveConsole.aeId) && (!liveConsole.clientId || thread.clientId === liveConsole.clientId));
  const threadOptions = filteredThreads.map(thread => `<option value="${thread.id}" ${liveConsole.threadId === thread.id ? 'selected' : ''}>${thread.subject}</option>`).join('');
  const activeThread = state.threads.find(thread => thread.id === liveConsole.threadId) || null;
  const messages = activeThread ? state.messages.filter(msg => msg.threadId === activeThread.id).sort((a, b) => a.at.localeCompare(b.at)) : [];
  const compareRows = state.aeProfiles.map(ae => `
    <label class="check-card ${compareConsole.aeIds.includes(ae.id) ? 'selected' : ''}">
      <input type="checkbox" data-act="compare-ae" value="${ae.id}" ${compareConsole.aeIds.includes(ae.id) ? 'checked' : ''}>
      <span>${ae.name}</span>
      <small>${ae.title}</small>
    </label>`).join('');
  const compareTable = compareConsole.results.length ? compareConsole.results.map(row => `<tr><td>${escapeHtml(row.brain?.aeName || row.aeId || '')}</td><td>${row.ok ? '<span class="status-pill status-ok">PASS</span>' : '<span class="status-pill status-bad">FAIL</span>'}</td><td>${escapeHtml(row.brain?.provider || '')}</td><td>${escapeHtml(row.brain?.route || '')}</td><td>${escapeHtml(String(row.latencyMs || ''))} ms</td><td>${escapeHtml((row.text || row.error || '').slice(0, 180))}</td></tr>`).join('') : '<tr><td colspan="6">No compare results yet.</td></tr>';
  const reportCards = smokeReports.length ? smokeReports.map(item => `<div class="item"><h4>${escapeHtml(item.kind || 'live-smoke')} · ${escapeHtml(item.created_at || '')}</h4><div class="meta">by ${escapeHtml(item.created_by || 'unknown')} · passed ${Number(item.summary_json?.passed || 0)} / ${Number(item.summary_json?.total || 0)}</div><div class="toolbar"><button class="btn-soft" data-act="load-smoke-report" data-id="${escapeHtml(item.id || '')}">Load</button></div></div>`).join('') : '<div class="item"><div class="meta">No stored smoke reports loaded.</div></div>';
  return `
    <section class="card">
      <div class="eyebrow">Donor-based live brain lane</div>
      <h3>One replicated AE brain runtime across 13 OpenAI key slots</h3>
      <p>This branch now includes a real server-side AE brain lane at <span class="mono">/.netlify/functions/ae-brain-chat</span>. It selects the AE profile, applies that AE's system prompt, resolves that AE's key slot, and writes usage rows when the shared database lane is configured.</p>
      <div class="tag-row">
        <span class="tag">13 key slots</span>
        <span class="tag">Founder auth</span>
        <span class="tag">Remote sync</span>
        <span class="tag">Server-side prompts</span>
        <span class="tag">OpenAI SSE stream</span>
        <span class="tag">Provider failover</span>
        <span class="tag">Donor template</span>
        <span class="tag">Multi-AE compare</span>
      </div>
    </section>
    <section class="grid-2">
      <div class="card">
        <div class="eyebrow">Donor runtime template</div>
        <h3>Replicate one donor brain across all 13 AEs</h3>
        <div class="form-grid">
          <label><span>Endpoint mode</span><select id="donor-endpoint-mode"><option value="chat" ${donorTemplate.endpointMode === 'chat' ? 'selected' : ''}>chat/completions</option><option value="responses" ${donorTemplate.endpointMode === 'responses' ? 'selected' : ''}>responses</option></select></label>
          <label><span>Primary provider</span><select id="donor-primary-provider"><option value="openai" ${donorTemplate.primaryProvider === 'openai' ? 'selected' : ''}>openai</option><option value="anthropic" ${donorTemplate.primaryProvider === 'anthropic' ? 'selected' : ''}>anthropic</option><option value="gemini" ${donorTemplate.primaryProvider === 'gemini' ? 'selected' : ''}>gemini</option></select></label>
          <label><span>Model</span><input id="donor-model" value="${escapeHtml(donorTemplate.model || '')}" placeholder="gpt-4.1-mini"></label>
          <label><span>Temperature</span><input id="donor-temperature" type="number" step="0.1" value="${escapeHtml(String(donorTemplate.temperature ?? 0.7))}"></label>
          <label><span>Max output tokens</span><input id="donor-max-output" type="number" step="1" value="${escapeHtml(String(donorTemplate.maxOutputTokens ?? 900))}"></label>
          <label><span>Failovers</span><input id="donor-failovers" value="${escapeHtml((donorTemplate.failoverProviders || []).join(', '))}" placeholder="anthropic, gemini"></label>
          <label class="checkbox-inline"><input id="donor-stream-default" type="checkbox" ${donorTemplate.streamDefault ? 'checked' : ''}> <span>Default to streaming</span></label>
          <label class="full"><span>Runtime note</span><textarea id="donor-note" placeholder="Runtime notes">${escapeHtml(donorTemplate.note || '')}</textarea></label>
        </div>
        <div class="toolbar"><button class="btn" id="save-donor-template">Save donor template</button><button class="btn-soft" id="refresh-donor-template">Refresh donor template</button></div>
      </div>
      <div class="card">
        <div class="eyebrow">Batch compare</div>
        <h3>Send one prompt across selected AEs</h3>
        <label><span>Prompt</span><textarea id="compare-message" placeholder="Run one prompt across multiple AE brains">${escapeHtml(compareConsole.message || '')}</textarea></label>
        <div class="check-grid">${compareRows}</div>
        <div class="toolbar"><button class="btn" id="run-brain-compare">Run compare</button><button class="btn-soft" id="select-all-compare">Select all</button><button class="btn-soft" id="clear-compare">Clear</button><button class="btn-soft" id="export-compare-results">Export compare JSON</button></div>
        <div class="meta">${compareConsole.summary ? `passed ${Number(compareConsole.summary.passed || 0)} of ${Number(compareConsole.summary.total || 0)} · avg latency ${Number(compareConsole.summary.averageLatencyMs || 0)} ms` : 'No compare run yet.'}</div>
        <div class="table-wrap"><table><thead><tr><th>AE</th><th>Status</th><th>Provider</th><th>Route</th><th>Latency</th><th>Reply</th></tr></thead><tbody>${compareTable}</tbody></table></div>
      </div>
    </section>
    <section class="chat-layout">
      <div class="card chat-thread-list">
        <div class="eyebrow">Runtime controls</div>
        <h3>Live routing</h3>
        <div class="form-grid">
          <label><span>AE</span><select id="live-ae"><option value="">Choose AE</option>${aeOptions}</select></label>
          <label><span>Client</span><select id="live-client"><option value="">Choose client</option>${clientOptions}</select></label>
          <label><span>Thread</span><select id="live-thread"><option value="">New thread</option>${threadOptions}</select></label>
          <label><span>New thread subject</span><input id="live-subject" placeholder="Launch plan, intake, follow-up" value="${escapeHtml(liveConsole.subject)}"></label>
          <label class="checkbox-inline"><input id="live-stream" type="checkbox" ${liveConsole.stream ? 'checked' : ''}> <span>Stream from live brain</span></label>
        </div>
        <div class="list">
          ${filteredThreads.length ? filteredThreads.map(thread => `<div class="item"><h4>${thread.subject}</h4><div class="meta">${thread.aeName || 'No AE'} · ${thread.clientName || 'No client'} · ${thread.messageCount || 0} messages</div><div class="toolbar"><button class="btn-soft" data-act="live-open-thread" data-id="${thread.id}">Open</button></div></div>`).join('') : '<div class="item"><div class="meta">No threads yet for the current selection.</div></div>'}
        </div>
      </div>
      <div class="card chat-window">
        <div class="eyebrow">Live conversation</div>
        <h3>${activeThread ? escapeHtml(activeThread.subject) : 'Create or select a thread'}</h3>
        <div class="meta">Founder session: ${founderSession.authenticated ? escapeHtml(founderSession.email) : 'not signed in'} · role: ${escapeHtml(founderSession.role || 'local-only')} · Remote state: ${remoteStateStatus} · Live lane: ${liveBrainStatus}</div>
        <div class="chat-messages" id="live-chat-messages">
          ${messages.length ? messages.map(msg => `<div class="chat-bubble ${msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'assistant' : 'system'}"><div class="eyebrow">${msg.role}</div><div>${escapeHtml(msg.text)}</div><div class="meta">${msg.at}</div></div>`).join('') : '<div class="chat-bubble system"><div>No live messages in this thread yet.</div></div>'}
        </div>
        <label><span>Message</span><textarea id="live-message" placeholder="Send a live prompt through the selected AE brain"></textarea></label>
        <div class="toolbar"><button class="btn" id="send-live-message">Send to live brain</button><button class="btn-soft" id="check-live-health">Check health</button><button class="btn-soft" id="refresh-access-users">Refresh access</button></div>
        ${liveConsole.error ? `<div class="small-card"><div class="eyebrow">Latest error</div><p>${escapeHtml(liveConsole.error)}</p></div>` : ''}
        ${liveConsole.info ? `<div class="small-card"><div class="eyebrow">Latest result</div><p>${escapeHtml(liveConsole.info)}</p></div>` : ''}
        ${remoteHealth ? `<div class="small-card"><div class="eyebrow">Live health</div><p>OpenAI slots: ${remoteHealth.configured?.openai ?? 0} · DB ready: ${remoteHealth.databaseReady ? 'yes' : 'no'} · enabled AEs: ${remoteHealth.enabledCount ?? 0} · mode: ${escapeHtml(remoteHealth.donorTemplate?.endpointMode || donorTemplate.endpointMode || 'chat')}</p></div>` : ''}
      </div>
    </section>
    <section class="card">
      <div class="eyebrow">Batch live smoke</div>
      <h3>Run the donor brain lane across the roster</h3>
      <div class="toolbar"><button class="btn" id="run-live-smoke">Run 13-brain smoke</button><label class="checkbox-inline"><input id="live-smoke-dry-run" type="checkbox" ${liveSmoke.dryRun ? 'checked' : ''}> <span>Dry run only</span></label><button class="btn-soft" id="export-live-smoke">Export smoke JSON</button><button class="btn-soft" id="refresh-smoke-reports">Refresh stored reports</button></div>
      <div class="meta">${liveSmoke.ranAt ? `Last run: ${escapeHtml(liveSmoke.ranAt)} · ` : ''}${liveSmoke.summary ? `passed ${Number(liveSmoke.summary.passed || 0)} of ${Number(liveSmoke.summary.total || 0)} · configured ${Number(liveSmoke.summary.configured || 0)}` : 'No smoke run yet.'}</div>
      <div class="table-wrap"><table><thead><tr><th>AE</th><th>Status</th><th>Provider</th><th>Route</th><th>Model</th><th>Detail</th></tr></thead><tbody>${liveSmoke.results.length ? liveSmoke.results.map(row => `<tr><td>${escapeHtml(row.aeName || row.aeId || '')}</td><td>${row.ok ? '<span class="status-pill status-ok">PASS</span>' : '<span class="status-pill status-bad">FAIL</span>'}</td><td>${escapeHtml(row.provider || '')}</td><td>${escapeHtml(row.route || '')}</td><td>${escapeHtml(row.model || '')}</td><td>${escapeHtml(row.detail || row.error || '')}</td></tr>`).join('') : '<tr><td colspan="6">No live smoke results yet.</td></tr>'}</tbody></table></div>
      <div class="list">${reportCards}</div>
    </section>`;
}

function bindLiveBrain() {
  $('#live-ae')?.addEventListener('change', event => {
    liveConsole.aeId = event.target.value;
    const matchingThread = state.threads.find(thread => (!liveConsole.aeId || thread.aeId === liveConsole.aeId) && (!liveConsole.clientId || thread.clientId === liveConsole.clientId));
    if (!liveConsole.threadId && matchingThread) liveConsole.threadId = matchingThread.id;
    render();
  });
  $('#live-client')?.addEventListener('change', event => {
    liveConsole.clientId = event.target.value;
    render();
  });
  $('#live-thread')?.addEventListener('change', event => {
    liveConsole.threadId = event.target.value;
    if (liveConsole.threadId) {
      const thread = state.threads.find(item => item.id === liveConsole.threadId);
      if (thread) {
        liveConsole.aeId = thread.aeId || liveConsole.aeId;
        liveConsole.clientId = thread.clientId || liveConsole.clientId;
        liveConsole.subject = thread.subject || '';
      }
    }
    render();
  });
  $('#live-subject')?.addEventListener('input', event => {
    liveConsole.subject = event.target.value;
  });
  $('#live-stream')?.addEventListener('change', event => { liveConsole.stream = !!event.target.checked; });
  $('#refresh-access-users')?.addEventListener('click', async () => { await refreshAccessUsers(); if (page === 'access' || page === 'live-brain') render(); });
  $('#check-live-health')?.addEventListener('click', async () => { await refreshRemoteOps(); render(); });
  $('#run-live-smoke')?.addEventListener('click', runLiveSmoke);
  $('#export-live-smoke')?.addEventListener('click', exportLiveSmoke);
  $('#live-smoke-dry-run')?.addEventListener('change', event => { liveSmoke.dryRun = !!event.target.checked; });
  document.querySelectorAll('[data-act="live-open-thread"]').forEach(btn => btn.addEventListener('click', () => {
    liveConsole.threadId = btn.dataset.id;
    const thread = state.threads.find(item => item.id === liveConsole.threadId);
    if (thread) {
      liveConsole.aeId = thread.aeId || liveConsole.aeId;
      liveConsole.clientId = thread.clientId || liveConsole.clientId;
      liveConsole.subject = thread.subject || '';
    }
    render();
  }));
  $('#send-live-message')?.addEventListener('click', sendLiveBrainMessage);
}

function ensureLiveThread() {
  if (liveConsole.threadId) {
    return state.threads.find(item => item.id === liveConsole.threadId) || null;
  }
  const ae = state.aeProfiles.find(item => item.id === liveConsole.aeId);
  const client = state.clients.find(item => item.id === liveConsole.clientId);
  const subject = String(liveConsole.subject || '').trim();
  if (!ae || !subject) return null;
  const thread = {
    id: uid('thread'),
    subject,
    aeId: ae.id,
    aeName: ae.name,
    clientId: client?.id || '',
    clientName: client?.name || '',
    messageCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  state.threads.unshift(thread);
  liveConsole.threadId = thread.id;
  return thread;
}

async function sendLiveBrainMessage() {
  const ae = state.aeProfiles.find(item => item.id === ( $('#live-ae')?.value || liveConsole.aeId ));
  const client = state.clients.find(item => item.id === ( $('#live-client')?.value || liveConsole.clientId ));
  const text = String($('#live-message')?.value || '').trim();
  if (!ae) return alert('Choose an AE first.');
  if (!text) return alert('Enter a message first.');
  liveConsole.aeId = ae.id;
  if (client) liveConsole.clientId = client.id;
  const thread = ensureLiveThread();
  if (!thread) return alert('Choose or create a thread subject first.');
  const userMessage = { id: uid('msg'), threadId: thread.id, role: 'user', text, at: nowIso() };
  state.messages.push(userMessage);
  thread.messageCount = state.messages.filter(item => item.threadId === thread.id).length;
  thread.updatedAt = nowIso();
  liveConsole.error = '';
  liveConsole.info = 'Sending live request…';
  persist();
  render();
  try {
    const history = state.messages.filter(item => item.threadId === thread.id).slice(-12).map(item => ({ role: item.role, content: item.text }));
    const data = liveConsole.stream
      ? await streamLiveBrainMessage(ae, client, thread, text)
      : await (async () => {
          const res = await fetch('/.netlify/functions/ae-brain-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              aeId: ae.id,
              clientId: client?.id || '',
              threadId: thread.id,
              message: text,
              history: history.slice(0, -1),
              endpointMode: donorTemplate.endpointMode || 'chat',
              temperature: donorTemplate.temperature ?? 0.7,
              maxOutputTokens: donorTemplate.maxOutputTokens ?? 900,
              context: {
                clientName: client?.name || '',
                company: client?.company || '',
                notes: client?.notes || '',
                threadSubject: thread.subject,
              },
            }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || !body.ok) throw new Error(body.error || 'Live brain request failed.');
          return body;
        })();
    const assistantMessage = { id: uid('msg'), threadId: thread.id, role: 'assistant', text: String(data.text || '').trim(), at: nowIso() };
    state.messages.push(assistantMessage);
    thread.messageCount = state.messages.filter(item => item.threadId === thread.id).length;
    thread.updatedAt = nowIso();
    remoteUpsert('threads', thread);
    remoteUpsert('messages', userMessage);
    remoteUpsert('messages', assistantMessage);
    const profile = state.aeProfiles.find(item => item.id === ae.id);
    if (profile) {
      profile.usageToday = Number(profile.usageToday || 0) + 1;
      profile.usageMonth = Number(profile.usageMonth || 0) + 1;
    }
    state.usageEvents.unshift({
      id: uid('usage'),
      aeId: ae.id,
      aeName: ae.name,
      threadId: thread.id,
      clientId: client?.id || '',
      model: data.brain?.model || ae.model || '',
      requestId: data.requestId || '',
      usage: data.usage || {},
      route: data.brain?.route || 'primary',
      at: nowIso(),
    });
    state.auditLog.unshift({ id: uid('audit'), kind: 'live-brain', message: `Live brain response from ${ae.name}`, at: nowIso() });
    liveBrainStatus = 'ready';
    liveConsole.info = `${ae.name} replied via ${data.brain?.route || 'primary'} route.`;
    await refreshRemoteOps();
  } catch (error) {
    liveBrainStatus = 'error';
    liveConsole.error = String(error?.message || 'Live brain request failed.');
    state.auditLog.unshift({ id: uid('audit'), kind: 'live-brain-error', message: liveConsole.error, at: nowIso() });
  }
  persist();
  render();
}


async function refreshDonorTemplate() {
  if (!founderSession.authenticated) return donorTemplate;
  try {
    const data = await apiJson('/.netlify/functions/ae-donor-template');
    donorTemplate = data.item || donorTemplate;
    return donorTemplate;
  } catch {
    return donorTemplate;
  }
}

async function refreshSmokeReports() {
  if (!founderSession.authenticated) return smokeReports;
  try {
    const data = await apiJson('/.netlify/functions/ae-brain-smoke-reports');
    smokeReports = Array.isArray(data.items) ? data.items : [];
    return smokeReports;
  } catch {
    smokeReports = [];
    return smokeReports;
  }
}

async function saveDonorTemplateRemote() {
  if (!founderSession.authenticated) return alert('Founder sign-in is required.');
  const payload = {
    endpointMode: $('#donor-endpoint-mode')?.value || donorTemplate.endpointMode,
    primaryProvider: $('#donor-primary-provider')?.value || donorTemplate.primaryProvider,
    model: $('#donor-model')?.value.trim() || donorTemplate.model,
    temperature: Number($('#donor-temperature')?.value || donorTemplate.temperature || 0.7),
    maxOutputTokens: Number($('#donor-max-output')?.value || donorTemplate.maxOutputTokens || 900),
    failoverProviders: String($('#donor-failovers')?.value || '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean),
    streamDefault: !!$('#donor-stream-default')?.checked,
    note: $('#donor-note')?.value || '',
  };
  try {
    const data = await apiJson('/.netlify/functions/ae-donor-template', { method: 'POST', body: JSON.stringify(payload) });
    donorTemplate = data.item || payload;
    liveConsole.info = 'Donor template saved.';
    await refreshRemoteOps();
    render();
  } catch (error) {
    liveConsole.error = String(error?.message || 'Donor template save failed.');
    render();
  }
}

async function runBrainCompare() {
  if (!founderSession.authenticated) return alert('Founder sign-in is required for compare runs.');
  const message = String($('#compare-message')?.value || compareConsole.message || '').trim();
  const aeIds = [...compareConsole.aeIds];
  if (!message) return alert('Enter a compare prompt first.');
  if (!aeIds.length) return alert('Select at least one AE to compare.');
  compareConsole.running = true;
  compareConsole.message = message;
  liveConsole.error = '';
  render();
  try {
    const data = await apiJson('/.netlify/functions/ae-brain-compare', {
      method: 'POST',
      body: JSON.stringify({ aeIds, message, clientId: liveConsole.clientId || '', context: { compare: true, clientName: state.clients.find(item => item.id === liveConsole.clientId)?.name || '', threadSubject: liveConsole.subject || 'Compare run' } })
    });
    compareConsole.summary = data.summary || null;
    compareConsole.results = Array.isArray(data.results) ? data.results : [];
    liveConsole.info = `Compare complete: ${data.summary?.passed || 0}/${data.summary?.total || 0} passed.`;
    render();
  } catch (error) {
    liveConsole.error = String(error?.message || 'Compare run failed.');
    render();
  }
  compareConsole.running = false;
}

function exportCompareResults() {
  const blob = new Blob([JSON.stringify({ summary: compareConsole.summary, results: compareConsole.results, donorTemplate }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ae-brain-compare.json';
  a.click();
  URL.revokeObjectURL(url);
}

function updateSessionBadge() {
  const badge = $('#session-badge');
  if (!badge) return;
  badge.textContent = founderSession.authenticated ? `Founder session: ${founderSession.email} · ${founderSession.role || 'admin'}` : 'Founder session: local only';
}

async function refreshFounderSession() {
  try {
    const res = await fetch('/.netlify/functions/ae-founder-me');
    const data = await res.json();
    if (res.ok && data.authenticated) {
      founderSession = { authenticated: true, email: data.founder?.email || '', role: data.founder?.role || 'admin', mode: 'server' };
      liveBrainStatus = 'ready';
    } else {
      founderSession = { authenticated: false, email: '', role: 'local-only', mode: 'local-only' };
    }
  } catch {
    founderSession = { authenticated: false, email: '', role: 'local-only', mode: 'local-only' };
  }
}

async function founderLoginPrompt() {
  const email = prompt('Founder email');
  if (email === null) return;
  const password = prompt('Founder password');
  if (password === null) return;
  try {
    const res = await fetch('/.netlify/functions/ae-founder-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Founder login failed.');
    founderSession = { authenticated: true, email: data.founder?.email || email, role: data.founder?.role || 'admin', mode: 'server' };
    remoteStateStatus = 'available';
    liveBrainStatus = 'ready';
    updateSessionBadge();
    await tryLoadRemoteState();
    await refreshRemoteOps();
    await refreshDonorTemplate();
    await refreshSmokeReports();
    render();
  } catch (error) {
    alert(String(error?.message || 'Founder login failed.'));
  }
}

async function founderLogout() {
  try { await fetch('/.netlify/functions/ae-founder-logout'); } catch {}
  founderSession = { authenticated: false, email: '', role: 'local-only', mode: 'local-only' };
  remoteStateStatus = 'unavailable';
  remoteHealth = null;
  remoteUsage = { totals: [], recent: [] };
  remoteAudit = [];
  updateSessionBadge();
  render();
}

async function tryLoadRemoteState() {
  if (!founderSession.authenticated) return;
  const loadedResources = await tryLoadRemoteResources();
  if (loadedResources) return;
  try {
    const res = await fetch('/.netlify/functions/ae-branch-state');
    const data = await res.json();
    if (res.ok && data.snapshot?.state) {
      state = normalizeState(data.snapshot.state, rosterSeed);
      remoteStateStatus = 'synced';
    } else {
      remoteStateStatus = 'empty';
    }
  } catch {
    remoteStateStatus = 'unavailable';
  }
}

function scheduleRemotePersist() {
  if (!founderSession.authenticated) return;
  if (remoteStateStatus === 'resource-sync') return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    try {
      const res = await fetch('/.netlify/functions/ae-branch-state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
      const data = await res.json().catch(() => ({}));
      remoteStateStatus = res.ok && data.ok ? 'synced' : 'error';
      updateSessionBadge();
      if (page === 'dashboard' || page === 'live-brain') render();
    } catch {
      remoteStateStatus = 'unavailable';
      if (page === 'dashboard' || page === 'live-brain') render();
    }
  }, 250);
}



async function apiJson(url, options = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

async function tryLoadRemoteResources() {
  if (!founderSession.authenticated) return false;
  try {
    const [clientsRes, tasksRes, threadsRes, messagesRes, assignmentsRes, brainsRes] = await Promise.all([
      apiJson('/.netlify/functions/ae-clients'),
      apiJson('/.netlify/functions/ae-tasks'),
      apiJson('/.netlify/functions/ae-threads'),
      apiJson('/.netlify/functions/ae-messages'),
      apiJson('/.netlify/functions/ae-assignments'),
      apiJson('/.netlify/functions/ae-brains'),
    ]);
    const clients = Array.isArray(clientsRes.items) ? clientsRes.items : [];
    const tasks = Array.isArray(tasksRes.items) ? tasksRes.items : [];
    const threads = Array.isArray(threadsRes.items) ? threadsRes.items : [];
    const messages = Array.isArray(messagesRes.items) ? messagesRes.items : [];
    const assignments = Array.isArray(assignmentsRes.items) ? assignmentsRes.items : [];
    const brains = Array.isArray(brainsRes.items) ? brainsRes.items : [];
    if (brains.length) state.aeProfiles = brains;
    if (clients.length || tasks.length || threads.length || messages.length || assignments.length || brains.length) {
      state.clients = clients;
      state.tasks = tasks;
      state.threads = threads;
      state.messages = messages;
      if (assignments.length) {
        for (const client of state.clients) {
          client.assignmentHistory = assignments.filter(item => item.clientId === client.id).sort((a,b) => String(b.at || '').localeCompare(String(a.at || '')));
          if (!client.assignedAeId && client.assignmentHistory[0]) {
            client.assignedAeId = client.assignmentHistory[0].aeId || '';
            client.assignedAeName = client.assignmentHistory[0].aeName || '';
          }
        }
      }
      remoteStateStatus = 'resource-sync';
    }
    await refreshAccessUsers();
    return true;
  } catch {
    return false;
  }
}

async function refreshAccessUsers() {
  if (!founderSession.authenticated) return [];
  try {
    const data = await apiJson('/.netlify/functions/ae-access-users');
    accessState.users = Array.isArray(data.users) ? data.users : [];
    accessState.status = 'ready';
    accessState.error = '';
    return accessState.users;
  } catch (error) {
    accessState.status = 'unavailable';
    accessState.error = String(error?.message || 'Access users unavailable');
    return [];
  }
}

async function remoteUpsert(type, item) {
  if (!founderSession.authenticated) return;
  const map = { clients: 'ae-clients', tasks: 'ae-tasks', threads: 'ae-threads', messages: 'ae-messages', assignments: 'ae-assignments' };
  if (!map[type]) return;
  try { await apiJson(`/.netlify/functions/${map[type]}`, { method: 'POST', body: JSON.stringify({ item }) }); } catch {}
}

async function remoteDelete(type, id) {
  if (!founderSession.authenticated) return;
  const map = { clients: 'ae-clients', tasks: 'ae-tasks', threads: 'ae-threads', messages: 'ae-messages', assignments: 'ae-assignments' };
  if (!map[type]) return;
  try { await apiJson(`/.netlify/functions/${map[type]}?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch {}
}

async function refreshRemoteOps() {
  if (!founderSession.authenticated) return;
  try { remoteHealth = await apiJson('/.netlify/functions/ae-brain-health'); } catch { remoteHealth = null; }
  try { remoteUsage = await apiJson('/.netlify/functions/ae-usage-summary'); } catch { remoteUsage = { totals: [], recent: [] }; }
  try { const data = await apiJson('/.netlify/functions/ae-audit-events'); remoteAudit = Array.isArray(data.items) ? data.items : []; } catch { remoteAudit = []; }
  await refreshDonorTemplate();
  await refreshSmokeReports();
}

async function persistAeProfile(ae) {
  if (!founderSession.authenticated) return;
  try {
    const data = await apiJson('/.netlify/functions/ae-brains', { method: 'POST', body: JSON.stringify({ aeId: ae.id, patch: ae }) });
    if (data?.item) {
      const idx = state.aeProfiles.findIndex((item) => item.id === ae.id);
      if (idx >= 0) state.aeProfiles[idx] = data.item;
    }
  } catch {}
}

function getHealthSlot(ae) {
  const slots = Array.isArray(remoteHealth?.slots) ? remoteHealth.slots : [];
  return slots.find(item => item.keySlot === ae.keySlot) || { openai: false, fallbacks: '' };
}

async function runLiveSmoke() {
  if (!founderSession.authenticated) return alert('Founder sign-in is required for live smoke.');
  liveSmoke.running = true;
  liveConsole.error = '';
  liveConsole.info = 'Running 13-brain smoke…';
  render();
  try {
    const data = await apiJson('/.netlify/functions/ae-brain-smoke', {
      method: 'POST',
      body: JSON.stringify({ dryRun: !!liveSmoke.dryRun, message: 'Reply only with READY and your AE name.' })
    });
    liveSmoke.results = Array.isArray(data.results) ? data.results : [];
    liveSmoke.summary = data.summary || null;
    liveSmoke.ranAt = nowIso();
    liveConsole.info = `Smoke complete: ${data.summary?.passed || 0}/${data.summary?.total || 0} passed.`;
    state.auditLog.unshift({ id: uid('audit'), kind: 'live-smoke', message: `13-brain smoke run completed (${data.summary?.passed || 0}/${data.summary?.total || 0})`, at: nowIso() });
    await refreshSmokeReports();
  } catch (error) {
    liveConsole.error = String(error?.message || 'Live smoke failed.');
  }
  liveSmoke.running = false;
  await refreshRemoteOps();
  persist();
  render();
}

function exportLiveSmoke() {
  const blob = new Blob([JSON.stringify({ ranAt: liveSmoke.ranAt, dryRun: liveSmoke.dryRun, summary: liveSmoke.summary, results: liveSmoke.results }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ae-brain-live-smoke.json';
  a.click();
  URL.revokeObjectURL(url);
}

function renderAccess() {
  return `
    <section class="card">
      <div class="eyebrow">Multi-user access</div>
      <h3>Owner, admin, operator, and viewer roles</h3>
      <div class="meta">Status: ${escapeHtml(accessState.status)} · ${escapeHtml(accessState.error || 'RBAC lane ready when authenticated.')}</div>
      <div class="tag-row"><span class="tag">owner</span><span class="tag">admin</span><span class="tag">operator</span><span class="tag">viewer</span></div>
      <div class="form-grid">
        <label><span>Email</span><input id="access-email" placeholder="new-user@example.com"></label>
        <label><span>Password</span><input id="access-password" type="password" placeholder="temporary password"></label>
        <label><span>Role</span><select id="access-role"><option value="admin">admin</option><option value="operator">operator</option><option value="viewer">viewer</option></select></label>
        <label><span>Display name</span><input id="access-display-name" placeholder="Team member"></label>
      </div>
      <div class="toolbar"><button class="btn" id="create-access-user">Create user</button><button class="btn-soft" id="refresh-access-users-page">Refresh users</button></div>
    </section>
    <section class="card"><div class="eyebrow">Access roster</div><h3>Authenticated branch users</h3><div class="list">${accessState.users.length ? accessState.users.map(user => `<div class="item"><div class="split"><div><h4>${escapeHtml(user.display_name || user.email)}</h4><div class="meta">${escapeHtml(user.email)} · ${escapeHtml(user.role || 'admin')} · ${escapeHtml(user.status || 'active')}</div></div><div class="toolbar">${String(user.role || '') !== 'owner' ? `<button class="btn-soft" data-act="toggle-user-status" data-id="${escapeHtml(user.id || '')}" data-status="${escapeHtml(user.status || 'active')}">${String(user.status || 'active') === 'active' ? 'Disable' : 'Activate'}</button><button class="btn-soft danger" data-act="delete-user" data-id="${escapeHtml(user.id || '')}">Delete</button>` : ''}</div></div></div>`).join('') : '<div class="item"><div class="meta">No remote users loaded.</div></div>'}</div></section>
    ${renderAutomationCenterCard()}
    ${renderRestorePointCard()}
    ${renderWorkspacePresetCard()}
    ${renderAuditCommandCenter()}`;
}

function bindAccess() {
  bindInternalCommandOps();
  $('#refresh-access-users-page')?.addEventListener('click', async () => { await refreshAccessUsers(); render(); });
  $('#create-access-user')?.addEventListener('click', async () => {
    const email = $('#access-email')?.value.trim();
    const password = $('#access-password')?.value || '';
    const role = $('#access-role')?.value || 'admin';
    const display_name = $('#access-display-name')?.value.trim() || '';
    if (!email || !password) return alert('Email and password are required.');
    try {
      await apiJson('/.netlify/functions/ae-access-users', { method: 'POST', body: JSON.stringify({ email, password, role, display_name }) });
      await refreshAccessUsers();
      render();
    } catch (error) {
      alert(String(error?.message || 'Create user failed.'));
    }
  });
  document.querySelectorAll('[data-act="toggle-user-status"]').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.id;
    const nextStatus = btn.dataset.status === 'active' ? 'disabled' : 'active';
    try {
      await apiJson('/.netlify/functions/ae-access-users', { method: 'PATCH', body: JSON.stringify({ id, patch: { status: nextStatus } }) });
      await refreshAccessUsers();
      render();
    } catch (error) {
      alert(String(error?.message || 'Update user failed.'));
    }
  }));
  document.querySelectorAll('[data-act="delete-user"]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('Delete this user?')) return;
    try {
      await apiJson(`/.netlify/functions/ae-access-users?id=${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' });
      await refreshAccessUsers();
      render();
    } catch (error) {
      alert(String(error?.message || 'Delete user failed.'));
    }
  }));
  $('#audit-search')?.addEventListener('input', event => { auditFilters.query = event.target.value; render(); });
  $('#audit-source-filter')?.addEventListener('change', event => { auditFilters.source = event.target.value; render(); });
  $('#audit-kind-filter')?.addEventListener('change', event => { auditFilters.kind = event.target.value; render(); });
  $('#reset-audit-filters')?.addEventListener('click', () => { auditFilters = { query: '', source: 'all', kind: '' }; render(); });
  $('#export-audit-digest-json')?.addEventListener('click', () => exportAuditDigest('json'));
  $('#export-audit-digest-md')?.addEventListener('click', () => exportAuditDigest('markdown'));
}

async function streamLiveBrainMessage(ae, client, thread, text) {
  const history = state.messages.filter(item => item.threadId === thread.id).slice(-12).map(item => ({ role: item.role, content: item.text }));
  const res = await fetch('/.netlify/functions/ae-brain-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aeId: ae.id, clientId: client?.id || '', threadId: thread.id, message: text, history: history.slice(0, -1), endpointMode: donorTemplate.endpointMode || 'chat', temperature: donorTemplate.temperature ?? 0.7, maxOutputTokens: donorTemplate.maxOutputTokens ?? 900, context: { clientName: client?.name || '', company: client?.company || '', notes: client?.notes || '', threadSubject: thread.subject } }),
  });
  if (!res.ok && !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Live brain stream failed.');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let textOut = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('

');
    buffer = chunks.pop() || '';
    for (const block of chunks) {
      const lines = block.split('
');
      const evLine = lines.find(line => line.startsWith('event: '));
      const dataLine = lines.find(line => line.startsWith('data: '));
      if (!dataLine) continue;
      const eventName = evLine ? evLine.slice(7).trim() : 'message';
      let payload = {};
      try { payload = JSON.parse(dataLine.slice(6)); } catch { payload = {}; }
      if (eventName === 'delta') {
        textOut += payload.text || '';
        liveConsole.info = `Streaming ${ae.name}… ${textOut.slice(-120)}`;
        render();
      }
      if (eventName === 'done') {
        return { text: payload.text || textOut, usage: payload.usage || {}, brain: { route: 'openai-primary', provider: 'openai', model: ae.model || 'gpt-4.1-mini' } };
      }
      if (eventName === 'error') throw new Error(payload.error || 'Stream failed.');
    }
  }
  return { text: textOut, usage: {}, brain: { route: 'openai-primary', provider: 'openai', model: ae.model || 'gpt-4.1-mini' } };
}



/* OMEGACOMMERCE PRINTFUL EXTENSION */
const PRINTFUL_PRODUCT_LIBRARY = [
  { id: 'pf-tee', label: 'Premium Tee', family: 'apparel', basePrice: 34, production: 'proofing' },
  { id: 'pf-hoodie', label: 'Signature Hoodie', family: 'apparel', basePrice: 64, production: 'proofing' },
  { id: 'pf-mug', label: 'Branded Mug', family: 'home', basePrice: 22, production: 'art-queued' },
  { id: 'pf-pack', label: 'Starter Merch Pack', family: 'bundle', basePrice: 180, production: 'quote' }
];

pageMeta['printful-brain'] = pageMeta['printful-brain'] || { title: 'Printful Brain', subtitle: 'Integrated merch and POD commerce lane with client handoffs, draft orders, production tracking, and bridge export.' };
if (!navItems.find(item => item[0] === 'printful-brain')) navItems.push(['printful-brain', 'Printful Brain']);

function ensurePrintfulBridge() {
  if (!state.printfulBridge || typeof state.printfulBridge !== 'object') {
    state.printfulBridge = { leads: [], orders: [], exports: [], syncJournal: [], productCatalog: [], artPackets: [], adminNotes: [], importedRuntime: {}, pricingProfile: { status: 'packaged-donor', mode: 'initial-integration' } };
  }
  state.printfulBridge.leads = Array.isArray(state.printfulBridge.leads) ? state.printfulBridge.leads : [];
  state.printfulBridge.orders = Array.isArray(state.printfulBridge.orders) ? state.printfulBridge.orders : [];
  state.printfulBridge.exports = Array.isArray(state.printfulBridge.exports) ? state.printfulBridge.exports : [];
  state.printfulBridge.syncJournal = Array.isArray(state.printfulBridge.syncJournal) ? state.printfulBridge.syncJournal : [];
  state.printfulBridge.productCatalog = Array.isArray(state.printfulBridge.productCatalog) && state.printfulBridge.productCatalog.length ? state.printfulBridge.productCatalog : PRINTFUL_PRODUCT_LIBRARY.map(item => ({ ...item }));
  state.printfulBridge.artPackets = Array.isArray(state.printfulBridge.artPackets) ? state.printfulBridge.artPackets : [];
  state.printfulBridge.adminNotes = Array.isArray(state.printfulBridge.adminNotes) ? state.printfulBridge.adminNotes : [];
  state.printfulBridge.importedRuntime = state.printfulBridge.importedRuntime && typeof state.printfulBridge.importedRuntime === 'object' ? state.printfulBridge.importedRuntime : {};
  state.printfulBridge.pricingProfile = state.printfulBridge.pricingProfile && typeof state.printfulBridge.pricingProfile === 'object' ? state.printfulBridge.pricingProfile : { status: 'packaged-donor', mode: 'initial-integration' };
  return state.printfulBridge;
}

function getPrintfulLeads() { return ensurePrintfulBridge().leads; }
function getPrintfulOrders() { return ensurePrintfulBridge().orders; }
function getClientPrintfulHistory(clientId) {
  const bridge = ensurePrintfulBridge();
  return {
    leads: bridge.leads.filter(item => item.clientId === clientId).sort((a,b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''))),
    orders: bridge.orders.filter(item => item.clientId === clientId).sort((a,b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
  };
}
function isMerchClient(client) {
  const hay = [client?.needs, client?.notes, client?.clientType, client?.nextStep].join(' ').toLowerCase();
  return /(merch|apparel|print|printful|uniform|shirt|hoodie|mug|pod|store|product)/.test(hay);
}
function pushPrintfulSyncPacket(direction, kind, status, message, source = {}, payload = {}) {
  const row = { id: uid('pf-sync'), direction, kind, status, message, at: nowIso(), source, payload };
  ensurePrintfulBridge().syncJournal.unshift(row);
  state.auditLog.unshift({ id: uid('audit'), kind: `printful-${kind}`, message, at: row.at });
  return row;
}
function sendClientToPrintful(clientId, source = 'client-dossier') {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const bridge = ensurePrintfulBridge();
  let lead = bridge.leads.find(item => item.clientId === clientId && !['completed','closed'].includes(String(item.status || '').toLowerCase()));
  const product = bridge.productCatalog[0] || PRINTFUL_PRODUCT_LIBRARY[0];
  if (lead) {
    lead.updatedAt = nowIso();
    lead.source = source;
    lead.needs = client.needs || lead.needs;
    lead.productId = lead.productId || product.id;
    logClientActivity(client, 'printful-refresh', 'Printful commerce handoff refreshed', lead.status || 'Lead refreshed');
    pushPrintfulSyncPacket('outbound', 'lead-refresh', lead.status || 'queued', `Refreshed Printful lead for ${client.name}`, { clientId: client.id, clientName: client.name, aeId: client.assignedAeId || '', aeName: client.assignedAeName || '', source }, { leadId: lead.id, productId: lead.productId });
    persist();
    return lead;
  }
  lead = {
    id: uid('pf-lead'), clientId: client.id, clientName: client.name, company: client.company || '', aeId: client.assignedAeId || '', aeName: client.assignedAeName || '',
    status: 'queued', source, createdAt: nowIso(), updatedAt: nowIso(),
    productId: product.id, productLabel: product.label, family: product.family,
    estimatedValue: Math.max(85, Math.round((Number(client.estimatedValue || 0) || product.basePrice * 4) * 0.25)),
    notes: client.notes || '', needs: client.needs || '', quoteStatus: 'draft', productionStatus: product.production || 'quote'
  };
  bridge.leads.unshift(lead);
  client.printfulStatus = 'queued';
  client.nextStep = client.nextStep || 'Review merch/POD fit and push the client through the Printful commerce lane.';
  logClientActivity(client, 'printful-handoff', 'Sent to Printful commerce brain', lead.productLabel);
  pushPrintfulSyncPacket('outbound', 'lead-create', 'queued', `Sent ${client.name} into Printful brain`, { clientId: client.id, clientName: client.name, aeId: lead.aeId, aeName: lead.aeName, source }, { leadId: lead.id, productId: lead.productId, estimatedValue: lead.estimatedValue });
  persist();
  return lead;
}
function createPrintfulOrderFromLead(leadId) {
  const bridge = ensurePrintfulBridge();
  const lead = bridge.leads.find(item => item.id === leadId);
  if (!lead) return null;
  let order = bridge.orders.find(item => item.leadId === leadId && !['completed','cancelled'].includes(String(item.status || '').toLowerCase()));
  if (order) return order;
  order = {
    id: uid('pf-order'), leadId: lead.id, clientId: lead.clientId, clientName: lead.clientName, aeId: lead.aeId || '', aeName: lead.aeName || '',
    productId: lead.productId, productLabel: lead.productLabel, family: lead.family,
    amount: Number(lead.estimatedValue || 0), depositDue: Math.round(Number(lead.estimatedValue || 0) * 0.5),
    status: 'draft-order', productionStatus: 'quote', createdAt: nowIso(), updatedAt: nowIso(), source: 'command-bridge'
  };
  bridge.orders.unshift(order);
  lead.status = 'draft-order';
  lead.quoteStatus = 'draft-order';
  lead.updatedAt = nowIso();
  const client = state.clients.find(item => item.id === lead.clientId);
  if (client) {
    client.printfulStatus = 'draft-order';
    client.nextStep = 'Review draft merch/POD order, quote, and proof packet.';
    logClientActivity(client, 'printful-draft-order', 'Printful draft order created', order.productLabel);
  }
  pushPrintfulSyncPacket('outbound', 'order-create', 'draft-order', `Created Printful draft order for ${lead.clientName}`, { clientId: lead.clientId, clientName: lead.clientName, aeId: lead.aeId, aeName: lead.aeName }, { orderId: order.id, amount: order.amount, depositDue: order.depositDue });
  persist();
  return order;
}
function setPrintfulOrderStatus(orderId, status = 'quoted') {
  const bridge = ensurePrintfulBridge();
  const order = bridge.orders.find(item => item.id === orderId);
  if (!order) return null;
  order.status = status;
  order.productionStatus = status;
  order.updatedAt = nowIso();
  const lead = bridge.leads.find(item => item.id === order.leadId);
  if (lead) {
    lead.status = status;
    lead.quoteStatus = status;
    lead.productionStatus = status;
    lead.updatedAt = nowIso();
  }
  const client = state.clients.find(item => item.id === order.clientId);
  if (client) {
    client.printfulStatus = status;
    if (status === 'production') client.nextStep = 'Track production status and confirm ship/fulfillment milestones.';
    if (status === 'fulfilled') client.nextStep = 'Confirm merch delivery, review satisfaction, and capture follow-on demand.';
    if (status === 'quoted') client.nextStep = 'Confirm quote approval and proof acceptance.';
    logClientActivity(client, 'printful-status', `Printful status updated: ${status}`, order.productLabel || '');
  }
  pushPrintfulSyncPacket('inbound', 'order-status', status, `Printful order status set to ${status} for ${order.clientName}`, { clientId: order.clientId, clientName: order.clientName, aeId: order.aeId, aeName: order.aeName }, { orderId: order.id, amount: order.amount });
  persist();
  return order;
}
function getPrintfulSummary() {
  const bridge = ensurePrintfulBridge();
  const leads = bridge.leads;
  const orders = bridge.orders;
  const quoted = orders.filter(item => ['quoted','proofing','production','fulfilled'].includes(String(item.status || '').toLowerCase())).length;
  const production = orders.filter(item => ['production'].includes(String(item.status || '').toLowerCase())).length;
  const fulfilled = orders.filter(item => ['fulfilled'].includes(String(item.status || '').toLowerCase())).length;
  return {
    leads: leads.length,
    draftOrders: orders.filter(item => String(item.status || '').toLowerCase() === 'draft-order').length,
    quoted,
    production,
    fulfilled,
    estimatedValue: orders.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    depositExposure: orders.reduce((sum, item) => sum + Number(item.depositDue || 0), 0),
    donorStatus: bridge.pricingProfile.status || 'packaged-donor'
  };
}
function buildPrintfulCommerceBrief() {
  const summary = getPrintfulSummary();
  const bridge = ensurePrintfulBridge();
  return {
    exportedAt: nowIso(),
    summary,
    productCatalog: bridge.productCatalog,
    leads: bridge.leads.slice(0, 50),
    orders: bridge.orders.slice(0, 50),
    syncJournal: bridge.syncJournal.slice(0, 75)
  };
}
function exportPrintfulCommerceBrief(format = 'json') {
  const brief = buildPrintfulCommerceBrief();
  if (format === 'json') return download('ae-printful-brief.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    '# AE Brain Command Site — Printful Commerce Brief','',`- Exported at: ${brief.exportedAt}`,'',
    '## Summary','',
    `- Leads: ${brief.summary.leads}`,
    `- Draft orders: ${brief.summary.draftOrders}`,
    `- Quoted/active orders: ${brief.summary.quoted}`,
    `- In production: ${brief.summary.production}`,
    `- Fulfilled: ${brief.summary.fulfilled}`,
    `- Estimated order value: ${formatCurrency(brief.summary.estimatedValue)}`,
    `- Deposit exposure: ${formatCurrency(brief.summary.depositExposure)}`,
    '', '## Leads','',
    ...(brief.leads.length ? brief.leads.map(item => `- ${item.clientName}: ${item.productLabel} · ${item.status} · ${item.aeName || 'No AE'}`) : ['- No Printful leads yet.']),
    '', '## Orders','',
    ...(brief.orders.length ? brief.orders.map(item => `- ${item.clientName}: ${item.productLabel} · ${item.status} · ${formatCurrency(item.amount || 0)}`) : ['- No Printful orders yet.'])
  ].join('
');
  return download('ae-printful-brief.md', md, 'text/markdown');
}
function renderPrintfulCommandCard() {
  const summary = getPrintfulSummary();
  const leads = getPrintfulLeads().slice(0, 6);
  return `<div class="card"><div class="eyebrow">Printful brain</div><h3>Integrated merch and POD command lane</h3><div class="tag-row"><span class="tag">Leads ${summary.leads}</span><span class="tag">Draft orders ${summary.draftOrders}</span><span class="tag">Production ${summary.production}</span><span class="tag">Fulfilled ${summary.fulfilled}</span><span class="tag">Runtime ${escapeHtml(summary.donorStatus)}</span></div><div class="list">${leads.length ? leads.map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.productLabel)} · ${escapeHtml(item.status)} · ${escapeHtml(item.aeName || 'No AE')}</div><div class="meta">estimated ${formatCurrency(item.estimatedValue || 0)} · ${escapeHtml(item.family || 'general')}</div><div class="toolbar"><button class="btn-soft" data-act="open-printful-client" data-id="${item.clientId}">Open client</button><button class="btn-soft" data-act="open-printful-page">Open Printful brain</button></div></div>`).join('') : '<div class="item"><div class="meta">No Printful commerce leads yet.</div></div>'}</div><div class="toolbar"><button class="btn-soft" id="export-printful-brief-json">Export JSON</button><button class="btn-soft" id="export-printful-brief-md">Export Markdown</button></div></div>`;
}
function renderPrintfulProductionCard() {
  const orders = getPrintfulOrders().slice(0, 8);
  return `<div class="card"><div class="eyebrow">Production board</div><h3>Draft orders, quote state, and fulfillment progress</h3><div class="list">${orders.length ? orders.map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.productLabel)} · ${escapeHtml(item.status)} · ${formatCurrency(item.amount || 0)} · deposit ${formatCurrency(item.depositDue || 0)}</div><div class="toolbar"><button class="btn-soft" data-act="printful-order-status" data-id="${item.id}" data-status="quoted">Quote</button><button class="btn-soft" data-act="printful-order-status" data-id="${item.id}" data-status="production">Production</button><button class="btn-soft" data-act="printful-order-status" data-id="${item.id}" data-status="fulfilled">Fulfilled</button></div></div>`).join('') : '<div class="item"><div class="meta">No Printful orders yet.</div></div>'}</div></div>`;
}
function renderPrintfulBrain() {
  const bridge = ensurePrintfulBridge();
  const summary = getPrintfulSummary();
  return `
    <section class="grid-2">
      <div class="card"><div class="eyebrow">Commerce brain</div><h3>Printful merch and POD control lane</h3><p>The full Printful donor is now inside the stack and this lane manages AE-sourced merch/POD leads, draft orders, status changes, and bridge exports from Central Command.</p><div class="tag-row"><span class="tag">Leads ${summary.leads}</span><span class="tag">Draft ${summary.draftOrders}</span><span class="tag">Quoted ${summary.quoted}</span><span class="tag">Production ${summary.production}</span><span class="tag">Fulfilled ${summary.fulfilled}</span></div><div class="toolbar"><button class="btn-soft" id="printful-import-selected">Import selected clients</button><button class="btn-soft" id="export-printful-brief-json-page">Export JSON</button><button class="btn-soft" id="export-printful-brief-md-page">Export Markdown</button><a class="btn-soft" href="../../Printful-Commerce-Brain-EDM-pass6/site/printful-pod/admin.html" target="_blank" rel="noreferrer">Open donor admin</a></div></div>
      <div class="card"><div class="eyebrow">Product catalog</div><h3>Packaged donor families</h3><div class="list">${bridge.productCatalog.map(item => `<div class="item"><h4>${escapeHtml(item.label)}</h4><div class="meta">${escapeHtml(item.family)} · base ${formatCurrency(item.basePrice || 0)} · default ${escapeHtml(item.production || 'quote')}</div></div>`).join('')}</div></div>
    </section>
    <section class="grid-2">
      <div class="card"><div class="eyebrow">Printful leads</div><h3>AE-sourced merch/POD intake</h3><div class="list">${bridge.leads.length ? bridge.leads.map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.productLabel)} · ${escapeHtml(item.status)} · ${escapeHtml(item.aeName || 'No AE')}</div><div class="meta">estimated ${formatCurrency(item.estimatedValue || 0)} · ${escapeHtml(item.company || 'No company')}</div><div class="toolbar"><button class="btn-soft" data-act="printful-open-client" data-id="${item.clientId}">Open client</button><button class="btn-soft" data-act="printful-create-order" data-id="${item.id}">Create draft order</button></div></div>`).join('') : '<div class="item"><div class="meta">No Printful leads yet. Use selected clients or client dossier controls to hand accounts into this lane.</div></div>'}</div></div>
      <div class="card"><div class="eyebrow">Orders + production</div><h3>Draft orders and production-state control</h3><div class="list">${bridge.orders.length ? bridge.orders.map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.productLabel)} · ${escapeHtml(item.status)} · ${formatCurrency(item.amount || 0)}</div><div class="toolbar"><button class="btn-soft" data-act="printful-order-status" data-id="${item.id}" data-status="quoted">Quote</button><button class="btn-soft" data-act="printful-order-status" data-id="${item.id}" data-status="production">Production</button><button class="btn-soft" data-act="printful-order-status" data-id="${item.id}" data-status="fulfilled">Fulfilled</button></div></div>`).join('') : '<div class="item"><div class="meta">No Printful orders yet.</div></div>'}</div></div>
    </section>
    <section class="grid-2">
      <div class="card"><div class="eyebrow">Sync journal</div><h3>Bridge packets between command and donor</h3><div class="list">${bridge.syncJournal.length ? bridge.syncJournal.slice(0, 20).map(item => `<div class="item"><h4>${escapeHtml(item.kind)}</h4><div class="meta">${escapeHtml(item.direction)} · ${escapeHtml(item.status)} · ${escapeHtml(item.at)}</div><p>${escapeHtml(item.message || '')}</p></div>`).join('') : '<div class="item"><div class="meta">No sync packets recorded yet.</div></div>'}</div></div>
      <div class="card"><div class="eyebrow">Admin notes</div><h3>Packaged donor status</h3><div class="meta">Pricing profile: ${escapeHtml(bridge.pricingProfile.status || 'packaged-donor')} · mode ${escapeHtml(bridge.pricingProfile.mode || 'initial-integration')}</div><div class="meta">Initial packaged-integration valuation: $15,300,000 USD</div><p>Use this lane to keep merch/POD work visible inside Central Command before the deeper catalog and production automation phases are closed.</p></div>
    </section>`;
}
function bindPrintfulBrain() {
  $('#printful-import-selected')?.addEventListener('click', () => { let count = 0; [...selectedClientIds].map(id => state.clients.find(item => item.id === id)).filter(Boolean).forEach(client => { if (sendClientToPrintful(client.id, 'bulk-selected')) count += 1; }); if (!count) alert('Select at least one client first.'); render(); });
  $('#export-printful-brief-json-page')?.addEventListener('click', () => exportPrintfulCommerceBrief('json'));
  $('#export-printful-brief-md-page')?.addEventListener('click', () => exportPrintfulCommerceBrief('markdown'));
  document.querySelectorAll('[data-act="printful-open-client"],[data-act="open-printful-client"]').forEach(btn => btn.addEventListener('click', () => { page = 'clients'; renderNav(); render(); renderClientHistory(btn.dataset.id, true); }));
  document.querySelectorAll('[data-act="printful-create-order"]').forEach(btn => btn.addEventListener('click', () => { createPrintfulOrderFromLead(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="printful-order-status"]').forEach(btn => btn.addEventListener('click', () => { setPrintfulOrderStatus(btn.dataset.id, btn.dataset.status || 'quoted'); render(); }));
  document.querySelectorAll('[data-act="open-printful-page"]').forEach(btn => btn.addEventListener('click', () => { page = 'printful-brain'; renderNav(); render(); }));
}


const __baseBindDashboard = bindDashboard;
bindDashboard = function() {
  __baseBindDashboard();
  $('#export-printful-brief-json')?.addEventListener('click', () => exportPrintfulCommerceBrief('json'));
  $('#export-printful-brief-md')?.addEventListener('click', () => exportPrintfulCommerceBrief('markdown'));
  document.querySelectorAll('[data-act="open-printful-page"]').forEach(btn => btn.addEventListener('click', () => { page = 'printful-brain'; renderNav(); render(); }));
  document.querySelectorAll('[data-act="open-printful-client"]').forEach(btn => btn.addEventListener('click', () => { page = 'clients'; renderNav(); render(); renderClientHistory(btn.dataset.id, true); }));
  document.querySelectorAll('[data-act="printful-order-status"]').forEach(btn => btn.addEventListener('click', () => { setPrintfulOrderStatus(btn.dataset.id, btn.dataset.status || 'quoted'); render(); }));
};

const __baseBindView = bindView;
bindView = function() {
  __baseBindView();
  if (page === 'printful-brain') bindPrintfulBrain();
};

const __baseRender = render;
render = function() {
  if (page === 'printful-brain') {
    const meta = pageMeta[page];
    $('#page-title').textContent = meta.title;
    $('#page-subtitle').textContent = meta.subtitle;
    $('#view').innerHTML = renderPrintfulBrain();
    bindView();
    return;
  }
  return __baseRender();
};

const __baseRenderDashboard = renderDashboard;
renderDashboard = (function(base){ return function(){ const html = base(); return html + `
<section class="grid-2">${renderPrintfulCommandCard()}${renderPrintfulProductionCard()}</section>`; }; })(__baseRenderDashboard);

const __baseRenderClients = renderClients;
renderClients = function() {
  return __baseRenderClients().replace('id="bulk-send-to-appointment">Send to appointment brain</button>', 'id="bulk-send-to-appointment">Send to appointment brain</button><button class="btn-soft" id="bulk-send-to-printful">Send to Printful brain</button>');
};
const __baseBuildClientRows = buildClientRows;
buildClientRows = function(clients) {
  return __baseBuildClientRows(clients).replace(/<button class=\"btn-soft\" data-act=\"client-stage-back\" data-id=\"([^\"]+)\">/g, '<button class=\"btn-soft\" data-act=\"send-to-printful\" data-id=\"$1\">Print</button><button class=\"btn-soft\" data-act=\"client-stage-back\" data-id=\"$1\">');
};
const __baseBindClientTableControls = bindClientTableControls;
bindClientTableControls = function() {
  __baseBindClientTableControls();
  document.querySelectorAll('[data-act="send-to-printful"]').forEach(btn => btn.addEventListener('click', () => { sendClientToPrintful(btn.dataset.id, 'client-ledger'); render(); renderClientHistory(btn.dataset.id); }));
};
const __baseBindClients = bindClients;
bindClients = function() {
  __baseBindClients();
  $('#bulk-send-to-printful')?.addEventListener('click', () => {
    let count = 0;
    [...selectedClientIds].map(id => state.clients.find(item => item.id === id)).filter(Boolean).forEach(client => { if (sendClientToPrintful(client.id, 'bulk-clients')) count += 1; });
    state.auditLog.unshift({ id: uid('audit'), kind: 'bulk-printful-handoff', message: `Sent ${count} selected clients to Printful brain`, at: nowIso() });
    render();
  });
};
const __baseRenderClientHistory = renderClientHistory;
renderClientHistory = function(clientId, openInForm = false) {
  __baseRenderClientHistory(clientId, openInForm);
  const panel = $('#client-history-panel');
  const client = state.clients.find(item => item.id === clientId);
  if (!panel || !client) return;
  const history = getClientPrintfulHistory(clientId);
  panel.innerHTML = panel.innerHTML
    .replace('id="book-client-appointment">Book appointment</button>', 'id="book-client-appointment">Book appointment</button><button class="btn-soft" id="send-client-to-printful">Send to Printful</button><button class="btn-soft" id="create-client-printful-order">Draft merch order</button>')
    .replace('</div>
    <div class="item"><div class="eyebrow">Activity timeline</div>', `</div>
    <div class="item"><div class="eyebrow">Printful brain</div>${history.leads.length || history.orders.length ? `<div class="meta">Leads ${history.leads.length} · Orders ${history.orders.length}</div>${history.leads.map(row => `<div class="meta">lead · ${escapeHtml(row.productLabel || 'Product')} · ${escapeHtml(row.status || 'queued')} · ${escapeHtml(row.updatedAt || row.createdAt || '')}</div>`).join('')}${history.orders.map(row => `<div class="meta">order · ${escapeHtml(row.productLabel || 'Product')} · ${escapeHtml(row.status || 'draft-order')} · ${formatCurrency(row.amount || 0)}</div>`).join('')}` : '<div class="meta">No Printful history yet.</div>'}</div>
    <div class="item"><div class="eyebrow">Activity timeline</div>`);
  $('#send-client-to-printful')?.addEventListener('click', () => { sendClientToPrintful(client.id, 'client-dossier'); render(); renderClientHistory(client.id, true); });
  $('#create-client-printful-order')?.addEventListener('click', () => { const lead = sendClientToPrintful(client.id, 'client-dossier-order'); if (lead) createPrintfulOrderFromLead(lead.id); render(); renderClientHistory(client.id, true); });
};
const __baseGetClientRecommendedActions = getClientRecommendedActions;
getClientRecommendedActions = function(client) {
  const actions = __baseGetClientRecommendedActions(client);
  if (client && (isMerchClient(client) || ['premium','enterprise'].includes(getClientValueTier(client))) && String(client.printfulStatus || '').toLowerCase() !== 'fulfilled') {
    actions.push({ id: 'printful-handoff', label: 'Send to Printful brain', detail: 'Client profile suggests merch/POD or branded-goods handling.' });
  }
  return actions.slice(0, 6);
};
const __baseApplyClientRecommendation = applyClientRecommendation;
applyClientRecommendation = function(clientId, actionId) {
  if (actionId === 'printful-handoff') {
    sendClientToPrintful(clientId, 'recommended-action');
    state.auditLog.unshift({ id: uid('audit'), kind: 'client-recommendation', message: `Applied recommendation ${actionId} for ${state.clients.find(item => item.id === clientId)?.name || 'client'}`, at: nowIso() });
    persist();
    return;
  }
  return __baseApplyClientRecommendation(clientId, actionId);
};


/* OMEGACOMMERCE PRINTFUL V38 MAJOR IMPLEMENTATION PASS */
const PRINTFUL_SHARED_CONTRACT_FIELDS = ['clientId', 'aeId', 'leadId', 'orderId', 'productFamily', 'quoteStatus', 'depositStatus', 'balanceStatus', 'productionStatus', 'artStatus', 'estimatedValue', 'collectedValue', 'sourceTags', 'bridgeTimestamps'];
const __v38BaseEnsurePrintfulBridge = ensurePrintfulBridge;
ensurePrintfulBridge = function() {
  const bridge = __v38BaseEnsurePrintfulBridge();
  bridge.sharedContract = bridge.sharedContract && typeof bridge.sharedContract === 'object' ? bridge.sharedContract : { version: 'printful-bridge-v38', fields: [], lastNormalizedAt: '', validationRuns: [] };
  bridge.sharedContract.version = bridge.sharedContract.version || 'printful-bridge-v38';
  bridge.sharedContract.fields = Array.isArray(bridge.sharedContract.fields) && bridge.sharedContract.fields.length ? bridge.sharedContract.fields : [...PRINTFUL_SHARED_CONTRACT_FIELDS];
  bridge.sharedContract.validationRuns = Array.isArray(bridge.sharedContract.validationRuns) ? bridge.sharedContract.validationRuns : [];
  bridge.contractPackets = Array.isArray(bridge.contractPackets) ? bridge.contractPackets : [];
  bridge.replayQueue = Array.isArray(bridge.replayQueue) ? bridge.replayQueue : [];
  bridge.profitabilitySnapshots = Array.isArray(bridge.profitabilitySnapshots) ? bridge.profitabilitySnapshots : [];
  bridge.rescueRuns = Array.isArray(bridge.rescueRuns) ? bridge.rescueRuns : [];
  return bridge;
};

function plusDaysIso(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function normalizePrintfulSharedContract() {
  const bridge = ensurePrintfulBridge();
  bridge.sharedContract.version = 'printful-bridge-v38';
  bridge.sharedContract.fields = [...PRINTFUL_SHARED_CONTRACT_FIELDS];
  bridge.sharedContract.lastNormalizedAt = nowIso();
  bridge.sharedContract.validationRuns.unshift({
    id: uid('pf-contract-run'),
    at: bridge.sharedContract.lastNormalizedAt,
    leadCount: bridge.leads.length,
    orderCount: bridge.orders.length,
    packetCount: bridge.contractPackets.length,
    replayCount: bridge.replayQueue.length,
  });
  bridge.sharedContract.validationRuns = bridge.sharedContract.validationRuns.slice(0, 50);
  return bridge.sharedContract;
}

function pushPrintfulContractPacket(kind, status, message, source = {}, payload = {}) {
  const bridge = ensurePrintfulBridge();
  const packet = { id: uid('pf-contract'), kind, status, message, at: nowIso(), source, payload };
  bridge.contractPackets.unshift(packet);
  state.auditLog.unshift({ id: uid('audit'), kind: `printful-contract-${kind}`, message, at: packet.at });
  normalizePrintfulSharedContract();
  return packet;
}

function queuePrintfulReplay(reason, refs = {}) {
  const bridge = ensurePrintfulBridge();
  const row = { id: uid('pf-replay'), reason, status: 'queued', createdAt: nowIso(), refs };
  bridge.replayQueue.unshift(row);
  pushPrintfulContractPacket('replay-queued', 'queued', reason, refs, row);
  return row;
}

function resolvePrintfulReplay(replayId) {
  const bridge = ensurePrintfulBridge();
  const row = bridge.replayQueue.find(item => item.id === replayId);
  if (!row) return null;
  row.status = 'resolved';
  row.resolvedAt = nowIso();
  pushPrintfulContractPacket('replay-resolved', 'resolved', `Resolved replay queue item: ${row.reason}`, row.refs || {}, row);
  persist();
  return row;
}

function recalcPrintfulOrderFinancials(order) {
  if (!order) return null;
  order.amount = Number(order.amount || 0);
  order.depositDue = Number(order.depositDue || Math.round(order.amount * 0.5));
  order.balanceDue = Number(order.balanceDue || Math.max(order.amount - order.depositDue, 0));
  order.productionCost = Number(order.productionCost || Math.round(order.amount * 0.46));
  order.shippingReserve = Number(order.shippingReserve || Math.round(order.amount * 0.08));
  order.platformReserve = Number(order.platformReserve || Math.round(order.amount * 0.05));
  order.depositStatus = order.depositStatus || 'not-requested';
  order.balanceStatus = order.balanceStatus || 'not-requested';
  order.quoteStatus = order.quoteStatus || 'draft';
  order.collectedValue = Number(order.collectedValue || 0);
  order.netPosition = Number(order.collectedValue || 0) - Number(order.productionCost || 0) - Number(order.shippingReserve || 0) - Number(order.platformReserve || 0);
  order.marginPct = order.amount ? Math.round((order.netPosition / order.amount) * 1000) / 10 : 0;
  return order;
}

function ensurePrintfulArtPacket(order) {
  const bridge = ensurePrintfulBridge();
  if (!order) return null;
  let packet = bridge.artPackets.find(item => item.orderId === order.id);
  if (!packet) {
    packet = {
      id: uid('pf-art'),
      orderId: order.id,
      clientId: order.clientId,
      clientName: order.clientName,
      productLabel: order.productLabel,
      status: 'queued-review',
      revisionCount: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    bridge.artPackets.unshift(packet);
  }
  order.artPacketId = packet.id;
  order.artStatus = packet.status;
  return packet;
}

const __v38BaseSendClientToPrintful = sendClientToPrintful;
sendClientToPrintful = function(clientId, source = 'client-dossier') {
  const lead = __v38BaseSendClientToPrintful(clientId, source);
  const client = state.clients.find(item => item.id === clientId);
  if (lead && client) {
    lead.clientType = client.clientType || 'general';
    lead.valueTier = getClientValueTier(client);
    lead.tags = [client.tags, client.needs].filter(Boolean).join(', ');
    lead.family = lead.family || 'general';
    pushPrintfulContractPacket('lead-contract', lead.status || 'queued', `Normalized merch lead for ${client.name}`, { clientId: client.id, aeId: client.assignedAeId || '' }, { leadId: lead.id, family: lead.family, valueTier: lead.valueTier });
    normalizePrintfulSharedContract();
    persist();
  }
  return lead;
};

const __v38BaseCreatePrintfulOrderFromLead = createPrintfulOrderFromLead;
createPrintfulOrderFromLead = function(leadId) {
  const order = __v38BaseCreatePrintfulOrderFromLead(leadId);
  if (!order) return order;
  recalcPrintfulOrderFinancials(order);
  ensurePrintfulArtPacket(order);
  order.quoteStatus = order.quoteStatus || 'draft';
  order.balanceStatus = order.balanceStatus || 'not-requested';
  order.depositStatus = order.depositStatus || 'not-requested';
  pushPrintfulContractPacket('order-contract', order.status || 'draft-order', `Created normalized merch order for ${order.clientName}`, { clientId: order.clientId, aeId: order.aeId || '' }, { orderId: order.id, amount: order.amount, depositDue: order.depositDue });
  normalizePrintfulSharedContract();
  persist();
  return order;
};

const __v38BaseSetPrintfulOrderStatus = setPrintfulOrderStatus;
setPrintfulOrderStatus = function(orderId, status = 'quoted') {
  const order = __v38BaseSetPrintfulOrderStatus(orderId, status);
  if (!order) return order;
  recalcPrintfulOrderFinancials(order);
  const packet = ensurePrintfulArtPacket(order);
  if (status === 'quoted' && packet && packet.status === 'queued-review') packet.status = 'proof-sent';
  if (status === 'production' && order.depositStatus !== 'paid') queuePrintfulReplay(`Order ${order.clientName} promoted to production before deposit was marked paid`, { orderId: order.id, clientId: order.clientId });
  if (status === 'fulfilled' && order.balanceStatus !== 'paid') queuePrintfulReplay(`Order ${order.clientName} fulfilled with unpaid balance still open`, { orderId: order.id, clientId: order.clientId });
  if (status === 'fulfilled') requestPrintfulBalance(order.id, true);
  const client = state.clients.find(item => item.id === order.clientId);
  if (client) {
    client.printfulStatus = status;
    client.lastPrintfulUpdatedAt = nowIso();
    remoteUpsert?.('clients', client);
  }
  persist();
  return order;
};

function requestPrintfulQuoteApproval(orderId) {
  const order = ensurePrintfulBridge().orders.find(item => item.id === orderId);
  if (!order) return null;
  order.quoteStatus = 'approval-requested';
  order.status = order.status === 'draft-order' ? 'quoted' : order.status;
  order.updatedAt = nowIso();
  const packet = ensurePrintfulArtPacket(order);
  packet.status = 'proof-sent';
  packet.updatedAt = nowIso();
  pushPrintfulSyncPacket('outbound', 'quote-approval-request', 'requested', `Requested merch quote approval for ${order.clientName}`, { clientId: order.clientId, aeId: order.aeId || '' }, { orderId: order.id, artPacketId: packet.id });
  pushPrintfulContractPacket('quote-approval', 'requested', `Quote approval requested for ${order.clientName}`, { clientId: order.clientId, aeId: order.aeId || '' }, { orderId: order.id, artPacketId: packet.id });
  persist();
  return order;
}

function approvePrintfulQuote(orderId) {
  const order = ensurePrintfulBridge().orders.find(item => item.id === orderId);
  if (!order) return null;
  order.quoteStatus = 'approved';
  order.status = 'quoted';
  order.updatedAt = nowIso();
  const packet = ensurePrintfulArtPacket(order);
  packet.status = 'client-approved';
  packet.updatedAt = nowIso();
  pushPrintfulSyncPacket('inbound', 'quote-approval', 'approved', `Quote approved for ${order.clientName}`, { clientId: order.clientId, aeId: order.aeId || '' }, { orderId: order.id });
  pushPrintfulContractPacket('quote-approval', 'approved', `Quote approved for ${order.clientName}`, { clientId: order.clientId, aeId: order.aeId || '' }, { orderId: order.id });
  persist();
  return order;
}

function requestPrintfulDeposit(orderId, silent = false) {
  const order = ensurePrintfulBridge().orders.find(item => item.id === orderId);
  if (!order) return null;
  recalcPrintfulOrderFinancials(order);
  order.depositStatus = 'requested';
  order.updatedAt = nowIso();
  if (!silent) createPrintfulFollowupTask(order, `Collect merch deposit — ${order.clientName}`, `Collect deposit of ${formatCurrency(order.depositDue || 0)} for ${order.productLabel}.`, 1, 'deposit');
  pushPrintfulContractPacket('deposit', 'requested', `Deposit requested for ${order.clientName}`, { clientId: order.clientId, aeId: order.aeId || '' }, { orderId: order.id, depositDue: order.depositDue });
  persist();
  return order;
}

function markPrintfulDepositPaid(orderId) {
  const order = ensurePrintfulBridge().orders.find(item => item.id === orderId);
  if (!order) return null;
  recalcPrintfulOrderFinancials(order);
  order.depositStatus = 'paid';
  order.collectedValue = Number(order.collectedValue || 0) + Number(order.depositDue || 0);
  recalcPrintfulOrderFinancials(order);
  order.updatedAt = nowIso();
  pushPrintfulSyncPacket('inbound', 'deposit', 'paid', `Deposit paid for ${order.clientName}`, { clientId: order.clientId, aeId: order.aeId || '' }, { orderId: order.id, collectedValue: order.collectedValue });
  pushPrintfulContractPacket('deposit', 'paid', `Deposit paid for ${order.clientName}`, { clientId: order.clientId, aeId: order.aeId || '' }, { orderId: order.id, collectedValue: order.collectedValue });
  persist();
  return order;
}

function requestPrintfulBalance(orderId, silent = false) {
  const order = ensurePrintfulBridge().orders.find(item => item.id === orderId);
  if (!order) return null;
  recalcPrintfulOrderFinancials(order);
  order.balanceStatus = 'requested';
  order.updatedAt = nowIso();
  if (!silent) createPrintfulFollowupTask(order, `Collect merch balance — ${order.clientName}`, `Collect balance of ${formatCurrency(order.balanceDue || 0)} for ${order.productLabel}.`, 2, 'balance');
  pushPrintfulContractPacket('balance', 'requested', `Balance requested for ${order.clientName}`, { clientId: order.clientId, aeId: order.aeId || '' }, { orderId: order.id, balanceDue: order.balanceDue });
  persist();
  return order;
}

function markPrintfulBalancePaid(orderId) {
  const order = ensurePrintfulBridge().orders.find(item => item.id === orderId);
  if (!order) return null;
  recalcPrintfulOrderFinancials(order);
  order.balanceStatus = 'paid';
  order.collectedValue = Number(order.amount || 0);
  recalcPrintfulOrderFinancials(order);
  order.updatedAt = nowIso();
  pushPrintfulSyncPacket('inbound', 'balance', 'paid', `Final balance paid for ${order.clientName}`, { clientId: order.clientId, aeId: order.aeId || '' }, { orderId: order.id, collectedValue: order.collectedValue });
  pushPrintfulContractPacket('balance', 'paid', `Final balance paid for ${order.clientName}`, { clientId: order.clientId, aeId: order.aeId || '' }, { orderId: order.id, collectedValue: order.collectedValue });
  persist();
  return order;
}

function setPrintfulArtPacketStatus(packetId, status = 'proof-sent') {
  const bridge = ensurePrintfulBridge();
  const packet = bridge.artPackets.find(item => item.id === packetId);
  if (!packet) return null;
  packet.status = status;
  packet.updatedAt = nowIso();
  if (status === 'revision-requested') packet.revisionCount = Number(packet.revisionCount || 0) + 1;
  const order = bridge.orders.find(item => item.id === packet.orderId);
  if (order) {
    order.artStatus = status;
    order.updatedAt = nowIso();
  }
  pushPrintfulContractPacket('art-packet', status, `Art packet moved to ${status} for ${packet.clientName}`, { clientId: packet.clientId }, { packetId: packet.id, orderId: packet.orderId, revisionCount: packet.revisionCount || 0 });
  persist();
  return packet;
}

function createPrintfulFollowupTask(order, title, notes, offsetDays = 1, kind = 'printful-followup') {
  if (!order) return null;
  const existing = state.tasks.find(task => task.clientId === order.clientId && String(task.status || 'todo') !== 'done' && String(task.title || '').trim() === String(title || '').trim());
  if (existing) return existing;
  const task = {
    id: uid('task'),
    title,
    dueDate: plusDaysIso(offsetDays),
    assignedAeId: order.aeId || '',
    assignedAeName: order.aeName || '',
    clientId: order.clientId,
    clientName: order.clientName,
    notes,
    status: 'todo',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    dependencyTaskId: '',
    kind,
  };
  state.tasks.unshift(task);
  remoteUpsert?.('tasks', task);
  state.auditLog.unshift({ id: uid('audit'), kind: 'printful-task', message: `Created Printful follow-up task: ${title}`, at: nowIso() });
  persist();
  return task;
}

function returnPrintfulOrderToAe(orderId) {
  const bridge = ensurePrintfulBridge();
  const order = bridge.orders.find(item => item.id === orderId);
  if (!order) return null;
  order.returnToAeState = 'returned';
  order.updatedAt = nowIso();
  const client = state.clients.find(item => item.id === order.clientId);
  if (client) {
    client.printfulStatus = 'returned-to-ae';
    client.nextStep = `Review Printful return for ${order.productLabel} and confirm the next commercial action.`;
    logClientActivity(client, 'printful-return-ae', 'Merch order returned to AE for follow-through', order.productLabel || '');
    remoteUpsert?.('clients', client);
  }
  createPrintfulFollowupTask(order, `AE follow-through — ${order.clientName}`, `Review returned merch/POD order for ${order.productLabel} and confirm next action.`, 1, 'return-to-ae');
  pushPrintfulContractPacket('return-to-ae', 'returned', `Returned merch order to AE for ${order.clientName}`, { clientId: order.clientId, aeId: order.aeId || '' }, { orderId: order.id });
  persist();
  return order;
}

function buildPrintfulCatalogDeck() {
  const bridge = ensurePrintfulBridge();
  const familyPressure = bridge.productCatalog.map(item => {
    const leadCount = bridge.leads.filter(lead => lead.family === item.family).length;
    const orderCount = bridge.orders.filter(order => order.family === item.family).length;
    const estimatedValue = bridge.orders.filter(order => order.family === item.family).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return { family: item.family, label: item.label, leadCount, orderCount, estimatedValue };
  });
  const quoteMix = ['draft-order', 'quoted', 'production', 'fulfilled'].map(status => ({ status, count: bridge.orders.filter(order => String(order.status || '').toLowerCase() === status).length }));
  const aeDemand = Object.entries(bridge.leads.reduce((acc, row) => { const key = row.aeName || 'Unassigned'; acc[key] = Number(acc[key] || 0) + 1; return acc; }, {})).map(([aeName, count]) => ({ aeName, count }));
  const clientTypeDemand = Object.entries(bridge.leads.reduce((acc, row) => { const key = row.clientType || 'general'; acc[key] = Number(acc[key] || 0) + 1; return acc; }, {})).map(([clientType, count]) => ({ clientType, count }));
  return { generatedAt: nowIso(), familyPressure, quoteMix, aeDemand, clientTypeDemand };
}

function buildPrintfulProductionPressureDeck() {
  const bridge = ensurePrintfulBridge();
  const alerts = [];
  bridge.orders.forEach(order => {
    recalcPrintfulOrderFinancials(order);
    if ((order.quoteStatus || '') === 'approval-requested' && !['client-approved'].includes(String(order.artStatus || ''))) {
      alerts.push({ id: uid('pf-alert'), orderId: order.id, clientId: order.clientId, clientName: order.clientName, type: 'stalled-proof', severity: 'high', detail: 'Quote approval requested but art packet not yet client-approved.' });
    }
    if ((order.depositStatus || '') === 'requested' && (order.status || '') !== 'production') {
      alerts.push({ id: uid('pf-alert'), orderId: order.id, clientId: order.clientId, clientName: order.clientName, type: 'deposit-pressure', severity: 'high', detail: 'Deposit was requested and the order has not advanced into production.' });
    }
    if ((order.status || '') === 'production' && (order.balanceStatus || '') !== 'paid') {
      alerts.push({ id: uid('pf-alert'), orderId: order.id, clientId: order.clientId, clientName: order.clientName, type: 'margin-watch', severity: 'medium', detail: 'Production is active while the final balance remains open.' });
    }
    if ((order.status || '') === 'fulfilled' && (order.returnToAeState || '') !== 'returned') {
      alerts.push({ id: uid('pf-alert'), orderId: order.id, clientId: order.clientId, clientName: order.clientName, type: 'delivery-follow-through', severity: 'medium', detail: 'Delivery is complete but AE follow-through has not been logged yet.' });
    }
  });
  return alerts;
}

function runPrintfulRescueSweep(mode = 'full') {
  const bridge = ensurePrintfulBridge();
  const alerts = buildPrintfulProductionPressureDeck();
  const createdTasks = [];
  alerts.forEach(item => {
    const order = bridge.orders.find(row => row.id === item.orderId);
    if (!order) return;
    let title = `Merch rescue — ${order.clientName}`;
    let notes = item.detail;
    if (item.type === 'stalled-proof') title = `Stalled proof follow-up — ${order.clientName}`;
    if (item.type === 'deposit-pressure') title = `Deposit pressure follow-up — ${order.clientName}`;
    if (item.type === 'delivery-follow-through') title = `Delivery follow-through — ${order.clientName}`;
    const task = createPrintfulFollowupTask(order, title, notes, item.severity === 'high' ? 0 : 1, item.type);
    if (task) createdTasks.push(task.id);
  });
  const run = { id: uid('pf-rescue-run'), mode, createdAt: nowIso(), alertCount: alerts.length, createdTaskIds: createdTasks };
  bridge.rescueRuns.unshift(run);
  pushPrintfulContractPacket('rescue-run', 'completed', `Completed merch rescue sweep with ${alerts.length} surfaced issue(s).`, {}, run);
  persist();
  return run;
}

function buildPrintfulArtPacketDeck() {
  const bridge = ensurePrintfulBridge();
  return {
    generatedAt: nowIso(),
    packetCount: bridge.artPackets.length,
    queued: bridge.artPackets.filter(item => item.status === 'queued-review').length,
    proofSent: bridge.artPackets.filter(item => item.status === 'proof-sent').length,
    revisions: bridge.artPackets.filter(item => item.status === 'revision-requested').length,
    approved: bridge.artPackets.filter(item => item.status === 'client-approved').length,
    packets: bridge.artPackets.slice(0, 100),
  };
}

function buildPrintfulProfitabilityDeck() {
  const bridge = ensurePrintfulBridge();
  const orders = bridge.orders.map(recalcPrintfulOrderFinancials).filter(Boolean);
  const payload = {
    generatedAt: nowIso(),
    orderCount: orders.length,
    quotedValue: orders.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    collectedValue: orders.reduce((sum, row) => sum + Number(row.collectedValue || 0), 0),
    productionReserve: orders.reduce((sum, row) => sum + Number(row.productionCost || 0) + Number(row.shippingReserve || 0) + Number(row.platformReserve || 0), 0),
    netPosition: orders.reduce((sum, row) => sum + Number(row.netPosition || 0), 0),
    marginWatch: orders.filter(row => Number(row.marginPct || 0) < 18).map(row => ({ orderId: row.id, clientName: row.clientName, marginPct: row.marginPct, netPosition: row.netPosition })),
    orders: orders.slice(0, 100),
  };
  bridge.profitabilitySnapshots.unshift({ id: uid('pf-profitability'), generatedAt: payload.generatedAt, netPosition: payload.netPosition, orderCount: payload.orderCount });
  bridge.profitabilitySnapshots = bridge.profitabilitySnapshots.slice(0, 50);
  return payload;
}

function buildPrintfulSharedContractDeck() {
  const bridge = ensurePrintfulBridge();
  const contract = normalizePrintfulSharedContract();
  return {
    generatedAt: nowIso(),
    version: contract.version,
    fields: contract.fields,
    lastNormalizedAt: contract.lastNormalizedAt,
    validationRuns: contract.validationRuns.slice(0, 20),
    packetCount: bridge.contractPackets.length,
    replayQueue: bridge.replayQueue.slice(0, 50),
    contractPackets: bridge.contractPackets.slice(0, 100),
  };
}

function buildPrintfulFounderPacket() {
  return {
    exportedAt: nowIso(),
    queue: buildPrintfulCommerceBrief(),
    catalog: buildPrintfulCatalogDeck(),
    production: { alerts: buildPrintfulProductionPressureDeck(), rescueRuns: ensurePrintfulBridge().rescueRuns.slice(0, 25) },
    performance: buildPrintfulProfitabilityDeck(),
    artPackets: buildPrintfulArtPacketDeck(),
    contract: buildPrintfulSharedContractDeck(),
  };
}

function exportPrintfulDeck(type = 'queue', format = 'json') {
  let payload;
  let filenameBase;
  if (type === 'queue') { payload = buildPrintfulCommerceBrief(); filenameBase = 'ae-printful-queue'; }
  else if (type === 'catalog') { payload = buildPrintfulCatalogDeck(); filenameBase = 'ae-printful-catalog'; }
  else if (type === 'production') { payload = { exportedAt: nowIso(), alerts: buildPrintfulProductionPressureDeck(), rescueRuns: ensurePrintfulBridge().rescueRuns.slice(0, 50) }; filenameBase = 'ae-printful-production'; }
  else if (type === 'performance') { payload = buildPrintfulProfitabilityDeck(); filenameBase = 'ae-printful-performance'; }
  else if (type === 'art') { payload = buildPrintfulArtPacketDeck(); filenameBase = 'ae-printful-art-packets'; }
  else if (type === 'contract') { payload = buildPrintfulSharedContractDeck(); filenameBase = 'ae-printful-contract'; }
  else { payload = buildPrintfulFounderPacket(); filenameBase = 'ae-printful-founder-packet'; }
  if (format === 'json') return download(`${filenameBase}.json`, JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    `# ${filenameBase.replaceAll('-', ' ')}`,
    '',
    `- Exported at: ${payload.exportedAt || payload.generatedAt || nowIso()}`,
    '',
    '```json',
    JSON.stringify(payload, null, 2),
    '```'
  ].join('\n');
  return download(`${filenameBase}.md`, md, 'text/markdown');
}

function exportPrintfulFounderPacket(format = 'json') {
  return exportPrintfulDeck('founder', format);
}

function renderPrintfulCatalogDeck() {
  const deck = buildPrintfulCatalogDeck();
  return `<section class="grid-2"><div class="card"><div class="eyebrow">Catalog control</div><h3>Product-family pressure + quote mix</h3><div class="toolbar"><button class="btn-soft" id="printful-export-catalog-json">Catalog JSON</button><button class="btn-soft" id="printful-export-catalog-md">Catalog MD</button></div><div class="list">${deck.familyPressure.length ? deck.familyPressure.map(item => `<div class="item"><h4>${escapeHtml(item.family)}</h4><div class="meta">${escapeHtml(item.label)} · leads ${item.leadCount} · orders ${item.orderCount} · ${formatCurrency(item.estimatedValue || 0)}</div></div>`).join('') : '<div class="item"><div class="meta">No catalog pressure rows yet.</div></div>'}</div><div class="meta">Quote mix: ${deck.quoteMix.map(item => `${item.status} ${item.count}`).join(' · ') || 'none'}</div></div><div class="card"><div class="eyebrow">Demand routing</div><h3>Merch demand by AE and client type</h3><div class="list">${deck.aeDemand.length ? deck.aeDemand.map(item => `<div class="item"><h4>${escapeHtml(item.aeName)}</h4><div class="meta">${item.count} merch lead(s)</div></div>`).join('') : '<div class="item"><div class="meta">No AE demand rows yet.</div></div>'}${deck.clientTypeDemand.length ? deck.clientTypeDemand.map(item => `<div class="item"><h4>${escapeHtml(item.clientType)}</h4><div class="meta">${item.count} merch lead(s)</div></div>`).join('') : ''}</div></div></section>`;
}

function renderPrintfulOrderControlCard() {
  const bridge = ensurePrintfulBridge();
  return `<div class="card"><div class="eyebrow">Order control</div><h3>Quote approvals, deposits, promotion, returns</h3><div class="list">${bridge.orders.length ? bridge.orders.map(item => { recalcPrintfulOrderFinancials(item); return `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.productLabel)} · ${escapeHtml(item.status)} · quote ${escapeHtml(item.quoteStatus || 'draft')} · deposit ${escapeHtml(item.depositStatus || 'not-requested')} · balance ${escapeHtml(item.balanceStatus || 'not-requested')}</div><div class="meta">${formatCurrency(item.amount || 0)} · deposit ${formatCurrency(item.depositDue || 0)} · balance ${formatCurrency(item.balanceDue || 0)}</div><div class="toolbar"><button class="btn-soft" data-act="printful-quote-request" data-id="${item.id}">Request quote</button><button class="btn-soft" data-act="printful-quote-approve" data-id="${item.id}">Approve quote</button><button class="btn-soft" data-act="printful-deposit-request" data-id="${item.id}">Request deposit</button><button class="btn-soft" data-act="printful-deposit-paid" data-id="${item.id}">Deposit paid</button><button class="btn-soft" data-act="printful-promote-production" data-id="${item.id}">Promote</button><button class="btn-soft" data-act="printful-balance-request" data-id="${item.id}">Request balance</button><button class="btn-soft" data-act="printful-balance-paid" data-id="${item.id}">Balance paid</button><button class="btn-soft" data-act="printful-return-ae" data-id="${item.id}">Return to AE</button></div></div>`; }).join('') : '<div class="item"><div class="meta">No merch orders yet.</div></div>'}</div></div>`;
}

function renderPrintfulArtPacketCard() {
  const deck = buildPrintfulArtPacketDeck();
  return `<div class="card"><div class="eyebrow">Art packet board</div><h3>Proof send, approvals, revision handling</h3><div class="toolbar"><button class="btn-soft" id="printful-export-art-json">Art JSON</button><button class="btn-soft" id="printful-export-art-md">Art MD</button></div><div class="list">${deck.packets.length ? deck.packets.map(packet => `<div class="item"><h4>${escapeHtml(packet.clientName)}</h4><div class="meta">${escapeHtml(packet.productLabel || 'Product')} · ${escapeHtml(packet.status)} · revisions ${packet.revisionCount || 0}</div><div class="toolbar"><button class="btn-soft" data-act="printful-art-proof-send" data-id="${packet.id}">Proof sent</button><button class="btn-soft" data-act="printful-art-approved" data-id="${packet.id}">Approved</button><button class="btn-soft" data-act="printful-art-revise" data-id="${packet.id}">Revision</button></div></div>`).join('') : '<div class="item"><div class="meta">No art packets yet.</div></div>'}</div></div>`;
}

function renderPrintfulAutomationCard() {
  const bridge = ensurePrintfulBridge();
  const alerts = buildPrintfulProductionPressureDeck();
  return `<section class="grid-2"><div class="card"><div class="eyebrow">Ops automation</div><h3>Production pressure alerts + rescue runs</h3><div class="toolbar"><button class="btn-soft" id="printful-run-rescue">Run rescue sweep</button><button class="btn-soft" id="printful-export-queue-json">Queue JSON</button><button class="btn-soft" id="printful-export-queue-md">Queue MD</button><button class="btn-soft" id="printful-export-production-json">Production JSON</button><button class="btn-soft" id="printful-export-production-md">Production MD</button></div><div class="list">${alerts.length ? alerts.map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.type)} · ${escapeHtml(item.severity)} · ${escapeHtml(item.detail)}</div><div class="toolbar"><button class="btn-soft" data-act="printful-open-client" data-id="${item.clientId}">Open client</button><button class="btn-soft" data-act="printful-return-ae" data-id="${item.orderId}">Return to AE</button></div></div>`).join('') : '<div class="item"><div class="meta">No production pressure alerts are active right now.</div></div>'}</div></div><div class="card"><div class="eyebrow">Founder-grade export</div><h3>Commercial performance + packet archive</h3><div class="toolbar"><button class="btn-soft" id="printful-export-performance-json">Performance JSON</button><button class="btn-soft" id="printful-export-performance-md">Performance MD</button><button class="btn-soft" id="printful-export-founder-json">Founder packet JSON</button><button class="btn-soft" id="printful-export-founder-md">Founder packet MD</button></div><div class="list">${bridge.rescueRuns.length ? bridge.rescueRuns.slice(0, 8).map(run => `<div class="item"><h4>${escapeHtml(run.mode || 'full')} rescue</h4><div class="meta">${escapeHtml(run.createdAt || '')} · alerts ${run.alertCount || 0} · tasks ${Array.isArray(run.createdTaskIds) ? run.createdTaskIds.length : 0}</div></div>`).join('') : '<div class="item"><div class="meta">No rescue runs have been executed yet.</div></div>'}</div></div></section>`;
}

function renderPrintfulProfitabilityCard() {
  const deck = buildPrintfulProfitabilityDeck();
  return `<div class="card"><div class="eyebrow">Profitability</div><h3>Merch profitability, deposit/balance collection, founder margin view</h3><div class="toolbar"><button class="btn-soft" id="printful-export-profitability-json">Profitability JSON</button><button class="btn-soft" id="printful-export-profitability-md">Profitability MD</button></div><div class="tag-row"><span class="tag">Quoted ${formatCurrency(deck.quotedValue || 0)}</span><span class="tag">Collected ${formatCurrency(deck.collectedValue || 0)}</span><span class="tag">Reserve ${formatCurrency(deck.productionReserve || 0)}</span><span class="tag">Net ${formatCurrency(deck.netPosition || 0)}</span></div><div class="list">${deck.marginWatch.length ? deck.marginWatch.map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">margin ${item.marginPct}% · net ${formatCurrency(item.netPosition || 0)}</div></div>`).join('') : '<div class="item"><div class="meta">No margin-watch rows right now.</div></div>'}</div></div>`;
}

function renderPrintfulSharedContractCard() {
  const deck = buildPrintfulSharedContractDeck();
  return `<div class="card"><div class="eyebrow">Shared-state contract</div><h3>Normalized bridge contract, replay queue, donor hardening</h3><div class="toolbar"><button class="btn-soft" id="printful-export-contract-json">Contract JSON</button><button class="btn-soft" id="printful-export-contract-md">Contract MD</button></div><div class="meta">Version ${escapeHtml(deck.version || 'printful-bridge-v38')} · fields ${deck.fields.length} · last normalized ${escapeHtml(deck.lastNormalizedAt || '')}</div><div class="list">${deck.replayQueue.length ? deck.replayQueue.map(item => `<div class="item"><h4>${escapeHtml(item.reason)}</h4><div class="meta">${escapeHtml(item.status)} · ${escapeHtml(item.createdAt || '')}</div><div class="toolbar"><button class="btn-soft" data-act="printful-replay-resolve" data-id="${item.id}">Resolve</button></div></div>`).join('') : '<div class="item"><div class="meta">No replay queue rows are active.</div></div>'}${deck.contractPackets.length ? deck.contractPackets.slice(0, 12).map(item => `<div class="item"><h4>${escapeHtml(item.kind)}</h4><div class="meta">${escapeHtml(item.status)} · ${escapeHtml(item.at || '')}</div><p>${escapeHtml(item.message || '')}</p></div>`).join('') : ''}</div></div>`;
}

const __v38BaseRenderPrintfulBrain = renderPrintfulBrain;
renderPrintfulBrain = function() {
  ensurePrintfulBridge();
  const summary = getPrintfulSummary();
  return `<section class="hero"><div><div class="eyebrow">0megaCommerce Printful Brain</div><h2>Catalog control, quote approvals, deposit visibility, order promotion, proof handling, profitability, and shared-contract replay now live inside the command lane.</h2><p>Manage merch/POD demand without patchwork. The command layer can now watch family pressure, approval state, deposit exposure, art packet status, production alerts, replay packets, return-to-AE flow, and founder-grade export packets from the same system surface.</p></div><div class="toolbar"><button class="btn-soft" id="printful-import-selected">Import selected clients</button><button class="btn-soft" id="export-printful-brief-json-page">Legacy brief JSON</button><button class="btn-soft" id="export-printful-brief-md-page">Legacy brief MD</button></div></section><section class="grid-4 stats"><div class="stat"><span>Leads</span><strong>${summary.leads}</strong></div><div class="stat"><span>Draft orders</span><strong>${summary.draftOrders}</strong></div><div class="stat"><span>Production</span><strong>${summary.production}</strong></div><div class="stat"><span>Estimated value</span><strong>${formatCurrency(summary.estimatedValue || 0)}</strong></div></section>${renderPrintfulCatalogDeck()}${__v38BaseRenderPrintfulBrain()}<section class="grid-2">${renderPrintfulOrderControlCard()}${renderPrintfulArtPacketCard()}</section>${renderPrintfulAutomationCard()}<section class="grid-2">${renderPrintfulProfitabilityCard()}${renderPrintfulSharedContractCard()}</section>`;
};

const __v38BaseBindPrintfulBrain = bindPrintfulBrain;
bindPrintfulBrain = function() {
  __v38BaseBindPrintfulBrain();
  $('#printful-export-catalog-json')?.addEventListener('click', () => exportPrintfulDeck('catalog', 'json'));
  $('#printful-export-catalog-md')?.addEventListener('click', () => exportPrintfulDeck('catalog', 'markdown'));
  $('#printful-run-rescue')?.addEventListener('click', () => { runPrintfulRescueSweep('full'); render(); });
  $('#printful-export-queue-json')?.addEventListener('click', () => exportPrintfulDeck('queue', 'json'));
  $('#printful-export-queue-md')?.addEventListener('click', () => exportPrintfulDeck('queue', 'markdown'));
  $('#printful-export-production-json')?.addEventListener('click', () => exportPrintfulDeck('production', 'json'));
  $('#printful-export-production-md')?.addEventListener('click', () => exportPrintfulDeck('production', 'markdown'));
  $('#printful-export-performance-json')?.addEventListener('click', () => exportPrintfulDeck('performance', 'json'));
  $('#printful-export-performance-md')?.addEventListener('click', () => exportPrintfulDeck('performance', 'markdown'));
  $('#printful-export-founder-json')?.addEventListener('click', () => exportPrintfulFounderPacket('json'));
  $('#printful-export-founder-md')?.addEventListener('click', () => exportPrintfulFounderPacket('markdown'));
  $('#printful-export-contract-json')?.addEventListener('click', () => exportPrintfulDeck('contract', 'json'));
  $('#printful-export-contract-md')?.addEventListener('click', () => exportPrintfulDeck('contract', 'markdown'));
  $('#printful-export-art-json')?.addEventListener('click', () => exportPrintfulDeck('art', 'json'));
  $('#printful-export-art-md')?.addEventListener('click', () => exportPrintfulDeck('art', 'markdown'));
  $('#printful-export-profitability-json')?.addEventListener('click', () => exportPrintfulDeck('performance', 'json'));
  $('#printful-export-profitability-md')?.addEventListener('click', () => exportPrintfulDeck('performance', 'markdown'));
  document.querySelectorAll('[data-act="printful-quote-request"]').forEach(btn => btn.addEventListener('click', () => { requestPrintfulQuoteApproval(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="printful-quote-approve"]').forEach(btn => btn.addEventListener('click', () => { approvePrintfulQuote(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="printful-deposit-request"]').forEach(btn => btn.addEventListener('click', () => { requestPrintfulDeposit(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="printful-deposit-paid"]').forEach(btn => btn.addEventListener('click', () => { markPrintfulDepositPaid(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="printful-balance-request"]').forEach(btn => btn.addEventListener('click', () => { requestPrintfulBalance(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="printful-balance-paid"]').forEach(btn => btn.addEventListener('click', () => { markPrintfulBalancePaid(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="printful-promote-production"]').forEach(btn => btn.addEventListener('click', () => { setPrintfulOrderStatus(btn.dataset.id, 'production'); render(); }));
  document.querySelectorAll('[data-act="printful-return-ae"]').forEach(btn => btn.addEventListener('click', () => { returnPrintfulOrderToAe(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="printful-art-proof-send"]').forEach(btn => btn.addEventListener('click', () => { setPrintfulArtPacketStatus(btn.dataset.id, 'proof-sent'); render(); }));
  document.querySelectorAll('[data-act="printful-art-approved"]').forEach(btn => btn.addEventListener('click', () => { setPrintfulArtPacketStatus(btn.dataset.id, 'client-approved'); render(); }));
  document.querySelectorAll('[data-act="printful-art-revise"]').forEach(btn => btn.addEventListener('click', () => { setPrintfulArtPacketStatus(btn.dataset.id, 'revision-requested'); render(); }));
  document.querySelectorAll('[data-act="printful-replay-resolve"]').forEach(btn => btn.addEventListener('click', () => { resolvePrintfulReplay(btn.dataset.id); render(); }));
};

const __v38BaseRenderClientHistory = renderClientHistory;
renderClientHistory = function(clientId, openInForm = false) {
  __v38BaseRenderClientHistory(clientId, openInForm);
  const panel = $('#client-history-panel');
  const client = state.clients.find(item => item.id === clientId);
  if (!panel || !client) return;
  const history = getClientPrintfulHistory(clientId);
  const artPackets = ensurePrintfulBridge().artPackets.filter(item => item.clientId === clientId);
  panel.innerHTML = panel.innerHTML.replace('</div>\n    <div class="item"><div class="eyebrow">Activity timeline</div>', `</div>\n    <div class="item"><div class="eyebrow">Printful commerce control</div>${history.orders.length ? history.orders.map(row => `<div class="meta">order · ${escapeHtml(row.productLabel || 'Product')} · quote ${escapeHtml(row.quoteStatus || 'draft')} · deposit ${escapeHtml(row.depositStatus || 'not-requested')} · balance ${escapeHtml(row.balanceStatus || 'not-requested')}</div>`).join('') : '<div class="meta">No merch order controls yet.</div>'}${artPackets.length ? artPackets.map(row => `<div class="meta">art packet · ${escapeHtml(row.status || 'queued-review')} · revisions ${row.revisionCount || 0}</div>`).join('') : ''}</div>\n    <div class="item"><div class="eyebrow">Activity timeline</div>`);
};


function ensurePrintfulCollabState() {
  const bridge = ensurePrintfulBridge();
  bridge.operatorSessions = Array.isArray(bridge.operatorSessions) ? bridge.operatorSessions : [];
  bridge.orderLocks = Array.isArray(bridge.orderLocks) ? bridge.orderLocks : [];
  bridge.deploymentChecks = Array.isArray(bridge.deploymentChecks) ? bridge.deploymentChecks : [];
  if (!bridge.operatorSessions.length) {
    bridge.operatorSessions.push({
      id: uid('pf-session'),
      operatorName: 'Founder Admin',
      role: 'admin',
      status: 'active',
      touchedAt: nowIso(),
      claimedOrderIds: [],
      note: 'Seeded local multi-operator control lane.'
    });
  }
  return bridge;
}

function upsertPrintfulOperatorSession(operatorName = 'Founder Admin', role = 'admin', status = 'active', note = '') {
  const bridge = ensurePrintfulCollabState();
  const key = String(operatorName || 'Founder Admin').trim().toLowerCase();
  let session = bridge.operatorSessions.find(item => String(item.operatorName || '').trim().toLowerCase() === key);
  if (!session) {
    session = { id: uid('pf-session'), operatorName: operatorName || 'Founder Admin', role, status, touchedAt: nowIso(), claimedOrderIds: [], note: note || '' };
    bridge.operatorSessions.unshift(session);
  }
  session.role = role || session.role || 'admin';
  session.status = status || session.status || 'active';
  session.touchedAt = nowIso();
  session.note = note || session.note || '';
  session.claimedOrderIds = Array.isArray(session.claimedOrderIds) ? session.claimedOrderIds : [];
  return session;
}

function cleanupPrintfulOrderLocks() {
  const bridge = ensurePrintfulCollabState();
  const now = Date.now();
  bridge.orderLocks.forEach(lock => {
    if (!lock.expiresAt) return;
    if (new Date(lock.expiresAt).getTime() <= now && lock.status === 'active') lock.status = 'expired';
  });
  return bridge.orderLocks;
}

function claimPrintfulOrderLock(orderId, operatorName = 'Founder Admin') {
  const bridge = ensurePrintfulCollabState();
  const order = bridge.orders.find(item => item.id === orderId);
  if (!order) return null;
  cleanupPrintfulOrderLocks();
  const session = upsertPrintfulOperatorSession(operatorName, 'admin', 'active', 'Managing live Printful order control.');
  let lock = bridge.orderLocks.find(item => item.orderId === orderId && item.status === 'active' && String(item.operatorName || '').trim().toLowerCase() === String(operatorName).trim().toLowerCase());
  if (!lock) {
    lock = {
      id: uid('pf-lock'),
      orderId,
      clientId: order.clientId,
      clientName: order.clientName,
      operatorName: session.operatorName,
      status: 'active',
      createdAt: nowIso(),
      touchedAt: nowIso(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
      note: `Claimed ${order.productLabel || 'Printful order'} control.`
    };
    bridge.orderLocks.unshift(lock);
  }
  lock.touchedAt = nowIso();
  lock.status = 'active';
  if (!Array.isArray(session.claimedOrderIds)) session.claimedOrderIds = [];
  if (!session.claimedOrderIds.includes(orderId)) session.claimedOrderIds.unshift(orderId);
  session.touchedAt = nowIso();
  bridge.adminNotes.unshift({ id: uid('pf-note'), kind: 'presence-lock', at: nowIso(), message: `${session.operatorName} claimed lock for ${order.clientName}` });
  pushPrintfulContractPacket('presence-lock', 'active', `Claimed Printful order lock for ${order.clientName}`, { clientId: order.clientId, aeId: order.aeId || '' }, { orderId, operatorName: session.operatorName });
  return lock;
}

function releasePrintfulOrderLock(lockId) {
  const bridge = ensurePrintfulCollabState();
  cleanupPrintfulOrderLocks();
  const lock = bridge.orderLocks.find(item => item.id === lockId);
  if (!lock) return null;
  lock.status = 'released';
  lock.touchedAt = nowIso();
  const session = bridge.operatorSessions.find(item => String(item.operatorName || '').trim().toLowerCase() === String(lock.operatorName || '').trim().toLowerCase());
  if (session && Array.isArray(session.claimedOrderIds)) session.claimedOrderIds = session.claimedOrderIds.filter(item => item !== lock.orderId);
  bridge.adminNotes.unshift({ id: uid('pf-note'), kind: 'presence-release', at: nowIso(), message: `${lock.operatorName || 'Operator'} released lock for ${lock.clientName || 'client'}` });
  pushPrintfulContractPacket('presence-lock', 'released', `Released Printful order lock for ${lock.clientName || 'client'}`, { clientId: lock.clientId || '' }, { orderId: lock.orderId, operatorName: lock.operatorName || '' });
  return lock;
}

function buildPrintfulPresenceDeck() {
  const bridge = ensurePrintfulCollabState();
  cleanupPrintfulOrderLocks();
  const sessions = bridge.operatorSessions.slice(0, 20).map(session => ({
    ...session,
    claimedOrderIds: Array.isArray(session.claimedOrderIds) ? session.claimedOrderIds : []
  }));
  const activeLocks = bridge.orderLocks.filter(item => item.status === 'active');
  const conflicts = activeLocks.reduce((acc, lock) => {
    const count = activeLocks.filter(item => item.orderId === lock.orderId).length;
    if (count > 1 && !acc.find(item => item.orderId === lock.orderId)) acc.push({ orderId: lock.orderId, clientName: lock.clientName, count });
    return acc;
  }, []);
  return {
    exportedAt: nowIso(),
    sessions,
    activeLocks,
    conflicts,
    summary: {
      sessions: sessions.length,
      activeLocks: activeLocks.length,
      conflicts: conflicts.length,
      admins: sessions.filter(item => item.role === 'admin').length
    }
  };
}

function runPrintfulDeploymentHardeningAudit() {
  const bridge = ensurePrintfulCollabState();
  const runtime = bridge.importedRuntime && typeof bridge.importedRuntime === 'object' ? bridge.importedRuntime : {};
  const checks = [
    { id: uid('pf-check'), key: 'contract-normalized', label: 'Shared contract normalized', status: bridge.sharedContract?.lastNormalizedAt ? 'ready' : 'watch', detail: bridge.sharedContract?.lastNormalizedAt ? `Normalized ${bridge.sharedContract.lastNormalizedAt}` : 'Normalize contract packets before deeper deployment.' },
    { id: uid('pf-check'), key: 'replay-queue-clear', label: 'Replay queue pressure', status: (bridge.replayQueue || []).filter(item => item.status !== 'resolved').length ? 'watch' : 'ready', detail: `${(bridge.replayQueue || []).filter(item => item.status !== 'resolved').length} unresolved replay row(s).` },
    { id: uid('pf-check'), key: 'operator-presence', label: 'Operator presence + locks', status: buildPrintfulPresenceDeck().summary.conflicts ? 'watch' : 'ready', detail: `${buildPrintfulPresenceDeck().summary.sessions} session(s) · ${buildPrintfulPresenceDeck().summary.activeLocks} active lock(s).` },
    { id: uid('pf-check'), key: 'catalog-mirror', label: 'Catalog mirror ready', status: (bridge.productCatalog || []).length ? 'ready' : 'action', detail: `${(bridge.productCatalog || []).length} catalog family row(s) mirrored.` },
    { id: uid('pf-check'), key: 'profitability-snapshots', label: 'Profitability snapshots populated', status: (bridge.profitabilitySnapshots || []).length ? 'ready' : 'watch', detail: `${(bridge.profitabilitySnapshots || []).length} profitability snapshot row(s) saved.` },
    { id: uid('pf-check'), key: 'runtime-endpoints', label: 'Donor runtime metadata present', status: runtime.status || runtime.endpoints ? 'ready' : 'watch', detail: runtime.status ? `Runtime ${runtime.status}` : 'Imported runtime metadata has not been refreshed recently.' },
    { id: uid('pf-check'), key: 'contract-packet-volume', label: 'Contract packet volume', status: (bridge.contractPackets || []).length >= 3 ? 'ready' : 'watch', detail: `${(bridge.contractPackets || []).length} contract packet(s) logged.` }
  ].map(item => ({ ...item, checkedAt: nowIso() }));
  bridge.deploymentChecks = checks;
  bridge.exports.unshift({ id: uid('pf-export'), kind: 'hardening-audit', createdAt: nowIso(), summary: checks.map(item => `${item.label}: ${item.status}`).join(' | ') });
  bridge.adminNotes.unshift({ id: uid('pf-note'), kind: 'hardening-audit', at: nowIso(), message: `Printful deployment hardening audit ran with ${checks.filter(item => item.status === 'ready').length}/${checks.length} ready checks.` });
  return checks;
}

function buildPrintfulHardeningDeck() {
  const bridge = ensurePrintfulCollabState();
  const checks = (bridge.deploymentChecks && bridge.deploymentChecks.length ? bridge.deploymentChecks : runPrintfulDeploymentHardeningAudit()).slice(0, 20);
  const readyCount = checks.filter(item => item.status === 'ready').length;
  const watchCount = checks.filter(item => item.status === 'watch').length;
  const actionCount = checks.filter(item => item.status === 'action').length;
  const readinessPct = checks.length ? Math.round((readyCount / checks.length) * 100) : 0;
  return {
    exportedAt: nowIso(),
    checks,
    summary: { readinessPct, readyCount, watchCount, actionCount }
  };
}

function renderPrintfulPresenceCard() {
  const deck = buildPrintfulPresenceDeck();
  return `<div class="card"><div class="eyebrow">Multi-user presence</div><h3>Admin/operator session proof and order ownership</h3><div class="toolbar"><button class="btn-soft" id="printful-export-presence-json">Presence JSON</button><button class="btn-soft" id="printful-export-presence-md">Presence MD</button></div><div class="tag-row"><span class="tag">Sessions ${deck.summary.sessions}</span><span class="tag">Active locks ${deck.summary.activeLocks}</span><span class="tag">Conflicts ${deck.summary.conflicts}</span></div><div class="list">${deck.sessions.length ? deck.sessions.map(item => `<div class="item"><h4>${escapeHtml(item.operatorName || 'Operator')}</h4><div class="meta">${escapeHtml(item.role || 'admin')} · ${escapeHtml(item.status || 'active')} · touched ${escapeHtml(String(item.touchedAt || '').slice(0, 16))}</div><div class="meta">Claimed orders ${(item.claimedOrderIds || []).length}</div></div>`).join('') : '<div class="item"><div class="meta">No operator session rows yet.</div></div>'}${deck.activeLocks.length ? deck.activeLocks.slice(0, 12).map(item => `<div class="item"><h4>${escapeHtml(item.clientName || 'Client')}</h4><div class="meta">${escapeHtml(item.operatorName || 'Operator')} · expires ${escapeHtml(String(item.expiresAt || '').slice(0, 16))}</div><div class="toolbar"><button class="btn-soft" data-act="printful-release-lock" data-id="${item.id}">Release lock</button></div></div>`).join('') : '<div class="item"><div class="meta">No active order locks yet.</div></div>'}</div></div>`;
}

function renderPrintfulHardeningCard() {
  const deck = buildPrintfulHardeningDeck();
  return `<div class="card"><div class="eyebrow">Deployment hardening</div><h3>Shared-state proof, operator safety, and deployment readiness</h3><div class="toolbar"><button class="btn-soft" id="printful-run-hardening-audit">Run hardening audit</button><button class="btn-soft" id="printful-export-hardening-json">Hardening JSON</button><button class="btn-soft" id="printful-export-hardening-md">Hardening MD</button></div><div class="tag-row"><span class="tag">Readiness ${deck.summary.readinessPct}%</span><span class="tag">Ready ${deck.summary.readyCount}</span><span class="tag">Watch ${deck.summary.watchCount}</span><span class="tag">Action ${deck.summary.actionCount}</span></div><div class="list">${deck.checks.map(item => `<div class="item"><h4>${escapeHtml(item.label)}</h4><div class="meta">${escapeHtml(item.status)} · ${escapeHtml(String(item.checkedAt || '').slice(0, 16))}</div><p>${escapeHtml(item.detail || '')}</p></div>`).join('')}</div></div>`;
}

const __v39BaseExportPrintfulDeck = exportPrintfulDeck;
exportPrintfulDeck = function(type = 'queue', format = 'json') {
  if (type === 'presence') {
    const payload = buildPrintfulPresenceDeck();
    if (format === 'json') return download('ae-printful-presence.json', JSON.stringify(payload, null, 2), 'application/json');
    const md = ['# ae printful presence', '', `- Exported at: ${payload.exportedAt}`, '', ...payload.sessions.map(item => `- ${item.operatorName} · ${item.role} · claimed ${(item.claimedOrderIds || []).length} order(s)`)];
    return download('ae-printful-presence.md', md.join('\n'), 'text/markdown');
  }
  if (type === 'hardening') {
    const payload = buildPrintfulHardeningDeck();
    if (format === 'json') return download('ae-printful-hardening.json', JSON.stringify(payload, null, 2), 'application/json');
    const md = ['# ae printful hardening', '', `- Exported at: ${payload.exportedAt}`, `- Readiness: ${payload.summary.readinessPct}%`, '', ...payload.checks.map(item => `- ${item.label}: ${item.status} · ${item.detail}`)];
    return download('ae-printful-hardening.md', md.join('\n'), 'text/markdown');
  }
  return __v39BaseExportPrintfulDeck(type, format);
};

const __v39BaseRenderPrintfulOrderControlCard = renderPrintfulOrderControlCard;
renderPrintfulOrderControlCard = function() {
  ensurePrintfulCollabState();
  return `<div class="card"><div class="eyebrow">Order control</div><h3>Quote approvals, deposits, promotion, returns, and order locks</h3><div class="list">${ensurePrintfulBridge().orders.length ? ensurePrintfulBridge().orders.map(item => { recalcPrintfulOrderFinancials(item); const activeLock = ensurePrintfulCollabState().orderLocks.find(lock => lock.orderId === item.id && lock.status === 'active'); return `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.productLabel)} · ${escapeHtml(item.status)} · quote ${escapeHtml(item.quoteStatus || 'draft')} · deposit ${escapeHtml(item.depositStatus || 'not-requested')} · balance ${escapeHtml(item.balanceStatus || 'not-requested')}</div><div class="meta">${formatCurrency(item.amount || 0)} · deposit ${formatCurrency(item.depositDue || 0)} · balance ${formatCurrency(item.balanceDue || 0)}${activeLock ? ` · lock ${escapeHtml(activeLock.operatorName || 'operator')}` : ''}</div><div class="toolbar"><button class="btn-soft" data-act="printful-quote-request" data-id="${item.id}">Request quote</button><button class="btn-soft" data-act="printful-quote-approve" data-id="${item.id}">Approve quote</button><button class="btn-soft" data-act="printful-deposit-request" data-id="${item.id}">Request deposit</button><button class="btn-soft" data-act="printful-deposit-paid" data-id="${item.id}">Deposit paid</button><button class="btn-soft" data-act="printful-promote-production" data-id="${item.id}">Promote</button><button class="btn-soft" data-act="printful-balance-request" data-id="${item.id}">Request balance</button><button class="btn-soft" data-act="printful-balance-paid" data-id="${item.id}">Balance paid</button><button class="btn-soft" data-act="printful-claim-lock" data-id="${item.id}">Claim lock</button><button class="btn-soft" data-act="printful-return-ae" data-id="${item.id}">Return to AE</button></div></div>`; }).join('') : '<div class="item"><div class="meta">No merch orders yet.</div></div>'}</div></div>`;
};

const __v39BaseRenderPrintfulBrain = renderPrintfulBrain;
renderPrintfulBrain = function() {
  ensurePrintfulCollabState();
  upsertPrintfulOperatorSession('Founder Admin', 'admin', 'active', 'Founder supervision active for Printful brain.');
  const base = __v39BaseRenderPrintfulBrain();
  return base + `<section class="grid-2">${renderPrintfulPresenceCard()}${renderPrintfulHardeningCard()}</section>`;
};

const __v39BaseBindPrintfulBrain = bindPrintfulBrain;
bindPrintfulBrain = function() {
  __v39BaseBindPrintfulBrain();
  $('#printful-export-presence-json')?.addEventListener('click', () => exportPrintfulDeck('presence', 'json'));
  $('#printful-export-presence-md')?.addEventListener('click', () => exportPrintfulDeck('presence', 'markdown'));
  $('#printful-run-hardening-audit')?.addEventListener('click', () => { runPrintfulDeploymentHardeningAudit(); render(); });
  $('#printful-export-hardening-json')?.addEventListener('click', () => exportPrintfulDeck('hardening', 'json'));
  $('#printful-export-hardening-md')?.addEventListener('click', () => exportPrintfulDeck('hardening', 'markdown'));
  document.querySelectorAll('[data-act="printful-claim-lock"]').forEach(btn => btn.addEventListener('click', () => { claimPrintfulOrderLock(btn.dataset.id, 'Founder Admin'); render(); }));
  document.querySelectorAll('[data-act="printful-release-lock"]').forEach(btn => btn.addEventListener('click', () => { releasePrintfulOrderLock(btn.dataset.id); render(); }));
};

const __v39BaseBuildPrintfulFounderPacket = buildPrintfulFounderPacket;
buildPrintfulFounderPacket = function() {
  const payload = __v39BaseBuildPrintfulFounderPacket();
  payload.presence = buildPrintfulPresenceDeck();
  payload.hardening = buildPrintfulHardeningDeck();
  return payload;
};



/* OMEGACOMMERCE PRINTFUL V40 EXTENSION */
function ensurePrintfulServiceRecoveryState() {
  const bridge = ensurePrintfulCollabState();
  bridge.returnTickets = Array.isArray(bridge.returnTickets) ? bridge.returnTickets : [];
  bridge.incidents = Array.isArray(bridge.incidents) ? bridge.incidents : [];
  return bridge;
}

function getPrintfulOpenReturnTicket(orderId) {
  return ensurePrintfulServiceRecoveryState().returnTickets.find(item => item.orderId === orderId && !['closed', 'resolved'].includes(String(item.status || '').toLowerCase())) || null;
}

function requestPrintfulReturn(orderId, reason = 'quality-issue') {
  const bridge = ensurePrintfulServiceRecoveryState();
  const order = bridge.orders.find(item => item.id === orderId);
  if (!order) return null;
  let ticket = getPrintfulOpenReturnTicket(orderId);
  if (!ticket) {
    ticket = {
      id: uid('pf-return'),
      orderId: order.id,
      leadId: order.leadId || '',
      clientId: order.clientId,
      clientName: order.clientName,
      aeId: order.aeId || '',
      aeName: order.aeName || '',
      productLabel: order.productLabel || 'Product',
      reason,
      status: 'requested',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      refundAmount: Number(order.depositDue || 0),
      replacementCost: Number(order.balanceDue || order.depositDue || order.amount || 0),
      note: 'Return or replacement review opened from AE Command.'
    };
    bridge.returnTickets.unshift(ticket);
  }
  ticket.reason = reason || ticket.reason || 'quality-issue';
  ticket.status = 'requested';
  ticket.updatedAt = nowIso();
  order.returnStatus = 'requested';
  order.updatedAt = nowIso();
  const client = state.clients.find(item => item.id === order.clientId);
  if (client) {
    client.printfulStatus = 'return-requested';
    client.nextStep = `Review Printful return request for ${order.productLabel || 'merch order'} and decide refund or reprint.`;
    logClientActivity(client, 'printful-return-request', 'Printful return request opened', ticket.reason);
  }
  createPrintfulFollowupTask(order, `Printful return — ${order.clientName}`, `Review ${ticket.reason} for ${order.productLabel || 'merch order'} and decide refund or reprint.`, 1, 'printful-return');
  pushPrintfulSyncPacket('outbound', 'return-ticket', 'requested', `Opened Printful return request for ${order.clientName}`, { clientId: order.clientId, aeId: order.aeId || '' }, { orderId: order.id, returnId: ticket.id, reason: ticket.reason });
  pushPrintfulContractPacket('return-ticket', 'requested', `Opened Printful return request for ${order.clientName}`, { clientId: order.clientId, aeId: order.aeId || '' }, { orderId: order.id, returnId: ticket.id, reason: ticket.reason });
  persist();
  return ticket;
}

function setPrintfulReturnStatus(returnId, status = 'approved-reprint') {
  const bridge = ensurePrintfulServiceRecoveryState();
  const ticket = bridge.returnTickets.find(item => item.id === returnId);
  if (!ticket) return null;
  ticket.status = status;
  ticket.updatedAt = nowIso();
  const order = bridge.orders.find(item => item.id === ticket.orderId);
  if (order) {
    order.returnStatus = status;
    order.updatedAt = nowIso();
    if (status === 'approved-reprint') {
      order.status = 'reprint-production';
      order.productionStatus = 'reprint-production';
      createPrintfulFollowupTask(order, `Printful reprint watch — ${order.clientName}`, `Monitor reprint production and confirm updated delivery timing for ${order.productLabel || 'merch order'}.`, 2, 'printful-reprint-watch');
    }
    if (status === 'approved-refund') {
      order.status = 'refund-approved';
      order.productionStatus = 'refund-approved';
      createPrintfulFollowupTask(order, `Printful refund confirm — ${order.clientName}`, `Confirm refund completion and customer closeout for ${order.productLabel || 'merch order'}.`, 1, 'printful-refund-watch');
    }
    if (status === 'closed') {
      createPrintfulFollowupTask(order, `Printful closeout — ${order.clientName}`, `Confirm post-return satisfaction and decide whether to reopen AE follow-through.`, 3, 'printful-closeout');
    }
  }
  const client = state.clients.find(item => item.id === ticket.clientId);
  if (client) {
    client.printfulStatus = status;
    if (status === 'approved-reprint') client.nextStep = 'Track reprint production and confirm replacement delivery.';
    if (status === 'approved-refund') client.nextStep = 'Confirm refund completion and evaluate follow-on recovery options.';
    if (status === 'closed') client.nextStep = 'Return post-sale recovery to AE for satisfaction follow-through.';
    logClientActivity(client, 'printful-return-status', `Printful return status updated: ${status}`, ticket.productLabel || '');
  }
  pushPrintfulSyncPacket('inbound', 'return-ticket', status, `Printful return moved to ${status} for ${ticket.clientName}`, { clientId: ticket.clientId, aeId: ticket.aeId || '' }, { orderId: ticket.orderId, returnId: ticket.id });
  pushPrintfulContractPacket('return-ticket', status, `Printful return moved to ${status} for ${ticket.clientName}`, { clientId: ticket.clientId, aeId: ticket.aeId || '' }, { orderId: ticket.orderId, returnId: ticket.id });
  persist();
  return ticket;
}

function derivePrintfulIncidentRows() {
  const bridge = ensurePrintfulServiceRecoveryState();
  const now = Date.now();
  const rows = [];
  const addIncident = (incident) => {
    if (!rows.find(item => item.id === incident.id)) rows.push(incident);
  };
  bridge.orders.forEach(order => {
    const updatedAt = new Date(order.updatedAt || order.createdAt || Date.now()).getTime();
    const ageDays = Math.max(0, Math.floor((now - updatedAt) / (1000 * 60 * 60 * 24)));
    if (String(order.depositStatus || '') === 'requested' && String(order.status || '') !== 'fulfilled' && ageDays >= 2) {
      addIncident({
        id: `incident-deposit-${order.id}`,
        type: 'deposit-pressure',
        severity: ageDays >= 4 ? 'critical' : 'high',
        clientId: order.clientId,
        clientName: order.clientName,
        aeId: order.aeId || '',
        aeName: order.aeName || '',
        orderId: order.id,
        detail: `${order.clientName} has a deposit request aging ${ageDays} day(s).`,
        suggestedAction: 'Create a payment rescue task and re-engage approval flow.',
        updatedAt: order.updatedAt || order.createdAt || nowIso()
      });
    }
    if (['production', 'reprint-production'].includes(String(order.status || '')) && ageDays >= 5) {
      addIncident({
        id: `incident-production-${order.id}`,
        type: 'production-delay',
        severity: ageDays >= 8 ? 'critical' : 'high',
        clientId: order.clientId,
        clientName: order.clientName,
        aeId: order.aeId || '',
        aeName: order.aeName || '',
        orderId: order.id,
        detail: `${order.clientName} has a ${order.status} row aging ${ageDays} day(s).`,
        suggestedAction: 'Create a production chase task and verify vendor timeline.',
        updatedAt: order.updatedAt || order.createdAt || nowIso()
      });
    }
    if (String(order.artStatus || '') === 'revision-requested' && ageDays >= 2) {
      addIncident({
        id: `incident-art-${order.id}`,
        type: 'art-revision-pressure',
        severity: ageDays >= 4 ? 'high' : 'watch',
        clientId: order.clientId,
        clientName: order.clientName,
        aeId: order.aeId || '',
        aeName: order.aeName || '',
        orderId: order.id,
        detail: `${order.clientName} still has a revision-requested art packet aging ${ageDays} day(s).`,
        suggestedAction: 'Create a proof follow-up task and push art packet resolution.',
        updatedAt: order.updatedAt || order.createdAt || nowIso()
      });
    }
  });
  bridge.returnTickets.forEach(ticket => {
    const updatedAt = new Date(ticket.updatedAt || ticket.createdAt || Date.now()).getTime();
    const ageDays = Math.max(0, Math.floor((now - updatedAt) / (1000 * 60 * 60 * 24)));
    if (!['closed', 'resolved'].includes(String(ticket.status || '').toLowerCase())) {
      addIncident({
        id: `incident-return-${ticket.id}`,
        type: 'return-recovery',
        severity: ageDays >= 3 ? 'critical' : 'high',
        clientId: ticket.clientId,
        clientName: ticket.clientName,
        aeId: ticket.aeId || '',
        aeName: ticket.aeName || '',
        orderId: ticket.orderId,
        returnId: ticket.id,
        detail: `${ticket.clientName} has an open ${ticket.status} return aging ${ageDays} day(s).`,
        suggestedAction: 'Create a recovery task and close refund or reprint path.',
        updatedAt: ticket.updatedAt || ticket.createdAt || nowIso()
      });
    }
  });
  return rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

function runPrintfulIncidentSweep(mode = 'full') {
  const bridge = ensurePrintfulServiceRecoveryState();
  const incidents = derivePrintfulIncidentRows();
  bridge.incidents = incidents;
  bridge.exports.unshift({ id: uid('pf-export'), kind: 'incident-sweep', createdAt: nowIso(), summary: `${incidents.length} incident row(s) after ${mode} sweep.` });
  bridge.adminNotes.unshift({ id: uid('pf-note'), kind: 'incident-sweep', at: nowIso(), message: `Printful incident sweep ran in ${mode} mode with ${incidents.length} surfaced incident row(s).` });
  persist();
  return incidents;
}

function createPrintfulIncidentTask(incidentId) {
  const incident = buildPrintfulIncidentDeck().incidents.find(item => item.id === incidentId);
  if (!incident) return null;
  const order = ensurePrintfulBridge().orders.find(item => item.id === incident.orderId) || { clientId: incident.clientId, clientName: incident.clientName, aeId: incident.aeId || '', aeName: incident.aeName || '' };
  return createPrintfulFollowupTask(order, `Printful incident — ${incident.clientName}`, `${incident.type}: ${incident.detail} ${incident.suggestedAction || ''}`.trim(), 1, 'printful-incident');
}

function buildPrintfulReturnsDeck() {
  const bridge = ensurePrintfulServiceRecoveryState();
  const tickets = bridge.returnTickets.slice().sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
  const open = tickets.filter(item => !['closed', 'resolved'].includes(String(item.status || '').toLowerCase()));
  return {
    exportedAt: nowIso(),
    tickets,
    summary: {
      total: tickets.length,
      open: open.length,
      refunds: tickets.filter(item => String(item.status || '') === 'approved-refund').length,
      reprints: tickets.filter(item => String(item.status || '') === 'approved-reprint').length,
      closed: tickets.filter(item => String(item.status || '') === 'closed').length
    }
  };
}

function buildPrintfulIncidentDeck() {
  const bridge = ensurePrintfulServiceRecoveryState();
  const incidents = (bridge.incidents && bridge.incidents.length ? bridge.incidents : runPrintfulIncidentSweep('auto')).slice(0, 50);
  return {
    exportedAt: nowIso(),
    incidents,
    summary: {
      total: incidents.length,
      critical: incidents.filter(item => item.severity === 'critical').length,
      high: incidents.filter(item => item.severity === 'high').length,
      watch: incidents.filter(item => item.severity === 'watch').length,
    }
  };
}

function renderPrintfulReturnsCard() {
  const deck = buildPrintfulReturnsDeck();
  return `<div class="card"><div class="eyebrow">Returns + remediation</div><h3>Refund, reprint, replacement, and closeout control</h3><div class="toolbar"><button class="btn-soft" id="printful-export-returns-json">Returns JSON</button><button class="btn-soft" id="printful-export-returns-md">Returns MD</button></div><div class="tag-row"><span class="tag">Open ${deck.summary.open}</span><span class="tag">Refunds ${deck.summary.refunds}</span><span class="tag">Reprints ${deck.summary.reprints}</span><span class="tag">Closed ${deck.summary.closed}</span></div><div class="list">${deck.tickets.length ? deck.tickets.map(ticket => `<div class="item"><h4>${escapeHtml(ticket.clientName)}</h4><div class="meta">${escapeHtml(ticket.productLabel || 'Product')} · ${escapeHtml(ticket.reason || 'quality-issue')} · ${escapeHtml(ticket.status || 'requested')}</div><div class="meta">Refund ${formatCurrency(ticket.refundAmount || 0)} · Replacement ${formatCurrency(ticket.replacementCost || 0)}</div><div class="toolbar"><button class="btn-soft" data-act="printful-return-approve-reprint" data-id="${ticket.id}">Approve reprint</button><button class="btn-soft" data-act="printful-return-approve-refund" data-id="${ticket.id}">Approve refund</button><button class="btn-soft" data-act="printful-return-close" data-id="${ticket.id}">Close return</button><button class="btn-soft" data-act="printful-open-client" data-id="${ticket.clientId}">Open client</button></div></div>`).join('') : '<div class="item"><div class="meta">No return or remediation rows yet.</div></div>'}</div></div>`;
}

function renderPrintfulIncidentCard() {
  const deck = buildPrintfulIncidentDeck();
  return `<div class="card"><div class="eyebrow">Incident + SLA control</div><h3>Aging deposits, production delays, art stalls, and return recovery pressure</h3><div class="toolbar"><button class="btn-soft" id="printful-run-incident-sweep">Run incident sweep</button><button class="btn-soft" id="printful-export-incidents-json">Incidents JSON</button><button class="btn-soft" id="printful-export-incidents-md">Incidents MD</button></div><div class="tag-row"><span class="tag">Critical ${deck.summary.critical}</span><span class="tag">High ${deck.summary.high}</span><span class="tag">Watch ${deck.summary.watch}</span><span class="tag">Total ${deck.summary.total}</span></div><div class="list">${deck.incidents.length ? deck.incidents.map(item => `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.type)} · ${escapeHtml(item.severity)} · ${escapeHtml(item.updatedAt || '').slice(0,16)}</div><p>${escapeHtml(item.detail || '')}</p><div class="toolbar"><button class="btn-soft" data-act="printful-incident-task" data-id="${item.id}">Create rescue task</button><button class="btn-soft" data-act="printful-open-client" data-id="${item.clientId}">Open client</button></div></div>`).join('') : '<div class="item"><div class="meta">No incident or SLA pressure rows yet.</div></div>'}</div></div>`;
}

const __v40BaseExportPrintfulDeck = exportPrintfulDeck;
exportPrintfulDeck = function(type = 'queue', format = 'json') {
  if (type === 'returns') {
    const payload = buildPrintfulReturnsDeck();
    if (format === 'json') return download('ae-printful-returns.json', JSON.stringify(payload, null, 2), 'application/json');
    const md = ['# ae printful returns', '', `- Exported at: ${payload.exportedAt}`, '', ...payload.tickets.map(item => `- ${item.clientName} · ${item.reason} · ${item.status}`)];
    return download('ae-printful-returns.md', md.join('\n'), 'text/markdown');
  }
  if (type === 'incidents') {
    const payload = buildPrintfulIncidentDeck();
    if (format === 'json') return download('ae-printful-incidents.json', JSON.stringify(payload, null, 2), 'application/json');
    const md = ['# ae printful incidents', '', `- Exported at: ${payload.exportedAt}`, '', ...payload.incidents.map(item => `- ${item.clientName} · ${item.type} · ${item.severity} · ${item.detail}`)];
    return download('ae-printful-incidents.md', md.join('\n'), 'text/markdown');
  }
  return __v40BaseExportPrintfulDeck(type, format);
};

const __v40BaseRenderPrintfulOrderControlCard = renderPrintfulOrderControlCard;
renderPrintfulOrderControlCard = function() {
  ensurePrintfulServiceRecoveryState();
  return `<div class="card"><div class="eyebrow">Order control</div><h3>Quote approvals, deposits, promotion, returns, and order locks</h3><div class="list">${ensurePrintfulBridge().orders.length ? ensurePrintfulBridge().orders.map(item => { recalcPrintfulOrderFinancials(item); const activeLock = ensurePrintfulCollabState().orderLocks.find(lock => lock.orderId === item.id && lock.status === 'active'); const openReturn = getPrintfulOpenReturnTicket(item.id); return `<div class="item"><h4>${escapeHtml(item.clientName)}</h4><div class="meta">${escapeHtml(item.productLabel)} · ${escapeHtml(item.status)} · quote ${escapeHtml(item.quoteStatus || 'draft')} · deposit ${escapeHtml(item.depositStatus || 'not-requested')} · balance ${escapeHtml(item.balanceStatus || 'not-requested')}</div><div class="meta">${formatCurrency(item.amount || 0)} · deposit ${formatCurrency(item.depositDue || 0)} · balance ${formatCurrency(item.balanceDue || 0)}${activeLock ? ` · lock ${escapeHtml(activeLock.operatorName || 'operator')}` : ''}${openReturn ? ` · return ${escapeHtml(openReturn.status || 'requested')}` : ''}</div><div class="toolbar"><button class="btn-soft" data-act="printful-quote-request" data-id="${item.id}">Request quote</button><button class="btn-soft" data-act="printful-quote-approve" data-id="${item.id}">Approve quote</button><button class="btn-soft" data-act="printful-deposit-request" data-id="${item.id}">Request deposit</button><button class="btn-soft" data-act="printful-deposit-paid" data-id="${item.id}">Deposit paid</button><button class="btn-soft" data-act="printful-promote-production" data-id="${item.id}">Promote</button><button class="btn-soft" data-act="printful-balance-request" data-id="${item.id}">Request balance</button><button class="btn-soft" data-act="printful-balance-paid" data-id="${item.id}">Balance paid</button><button class="btn-soft" data-act="printful-return-request" data-id="${item.id}">Open return</button><button class="btn-soft" data-act="printful-claim-lock" data-id="${item.id}">Claim lock</button><button class="btn-soft" data-act="printful-return-ae" data-id="${item.id}">Return to AE</button></div></div>`; }).join('') : '<div class="item"><div class="meta">No merch orders yet.</div></div>'}</div></div>`;
};

const __v40BaseRenderPrintfulBrain = renderPrintfulBrain;
renderPrintfulBrain = function() {
  ensurePrintfulServiceRecoveryState();
  const base = __v40BaseRenderPrintfulBrain();
  return base + `<section class="grid-2">${renderPrintfulReturnsCard()}${renderPrintfulIncidentCard()}</section>`;
};

const __v40BaseBindPrintfulBrain = bindPrintfulBrain;
bindPrintfulBrain = function() {
  __v40BaseBindPrintfulBrain();
  $('#printful-export-returns-json')?.addEventListener('click', () => exportPrintfulDeck('returns', 'json'));
  $('#printful-export-returns-md')?.addEventListener('click', () => exportPrintfulDeck('returns', 'markdown'));
  $('#printful-run-incident-sweep')?.addEventListener('click', () => { runPrintfulIncidentSweep('manual'); render(); });
  $('#printful-export-incidents-json')?.addEventListener('click', () => exportPrintfulDeck('incidents', 'json'));
  $('#printful-export-incidents-md')?.addEventListener('click', () => exportPrintfulDeck('incidents', 'markdown'));
  document.querySelectorAll('[data-act="printful-return-request"]').forEach(btn => btn.addEventListener('click', () => { requestPrintfulReturn(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="printful-return-approve-reprint"]').forEach(btn => btn.addEventListener('click', () => { setPrintfulReturnStatus(btn.dataset.id, 'approved-reprint'); render(); }));
  document.querySelectorAll('[data-act="printful-return-approve-refund"]').forEach(btn => btn.addEventListener('click', () => { setPrintfulReturnStatus(btn.dataset.id, 'approved-refund'); render(); }));
  document.querySelectorAll('[data-act="printful-return-close"]').forEach(btn => btn.addEventListener('click', () => { setPrintfulReturnStatus(btn.dataset.id, 'closed'); render(); }));
  document.querySelectorAll('[data-act="printful-incident-task"]').forEach(btn => btn.addEventListener('click', () => { createPrintfulIncidentTask(btn.dataset.id); render(); }));
};

const __v40BaseBuildPrintfulFounderPacket = buildPrintfulFounderPacket;
buildPrintfulFounderPacket = function() {
  const payload = __v40BaseBuildPrintfulFounderPacket();
  payload.returns = buildPrintfulReturnsDeck();
  payload.incidents = buildPrintfulIncidentDeck();
  return payload;
};

const __v40BaseRenderClientHistory = renderClientHistory;
renderClientHistory = function(clientId, openInForm = false) {
  __v40BaseRenderClientHistory(clientId, openInForm);
  const panel = $('#client-history-panel');
  if (!panel) return;
  const returns = ensurePrintfulServiceRecoveryState().returnTickets.filter(item => item.clientId === clientId);
  const incidents = buildPrintfulIncidentDeck().incidents.filter(item => item.clientId === clientId);
  panel.innerHTML = panel.innerHTML.replace('</div>\n    <div class="item"><div class="eyebrow">Activity timeline</div>', `</div>\n    <div class="item"><div class="eyebrow">Printful service recovery</div>${returns.length ? returns.map(row => `<div class="meta">return · ${escapeHtml(row.reason || 'quality-issue')} · ${escapeHtml(row.status || 'requested')}</div>`).join('') : '<div class="meta">No return tickets yet.</div>'}${incidents.length ? incidents.slice(0,4).map(row => `<div class="meta">incident · ${escapeHtml(row.type)} · ${escapeHtml(row.severity)}</div>`).join('') : ''}</div>\n    <div class="item"><div class="eyebrow">Activity timeline</div>`);
};



function getAssignmentConfidence(client) {
  if (!client) return { status: 'unassigned', label: 'Unassigned', score: 0, topCandidate: null, activeCandidate: null, gap: 0, reasons: ['No client selected.'] };
  const candidates = getAeMatchCandidates(client, 3) || [];
  const topCandidate = candidates[0] || null;
  const activeCandidate = candidates.find(item => item.id === client.assignedAeId) || null;
  let score = 100;
  const reasons = [];
  if (!client.assignedAeId) {
    score = 0;
    reasons.push('Client is not assigned to an AE yet.');
  } else {
    reasons.push(`Assigned AE: ${client.assignedAeName || 'Unknown AE'}.`);
  }
  if (topCandidate) reasons.push(`Top candidate is ${topCandidate.name} with score ${topCandidate.score}.`);
  if (topCandidate && client.assignedAeId && topCandidate.id !== client.assignedAeId) {
    score -= 34;
    reasons.push('Assigned AE differs from current best-fit routing candidate.');
  }
  const gap = topCandidate && activeCandidate ? Math.max(0, Number(topCandidate.score || 0) - Number(activeCandidate.score || 0)) : 0;
  if (gap >= 20) {
    score -= 26;
    reasons.push(`Assignment gap is high at ${gap} points.`);
  } else if (gap >= 8) {
    score -= 14;
    reasons.push(`Assignment gap is moderate at ${gap} points.`);
  } else if (gap > 0) {
    score -= 6;
    reasons.push(`Assignment gap is minor at ${gap} points.`);
  } else if (client.assignedAeId) {
    reasons.push('Assigned AE aligns with the current best-fit candidate set.');
  }
  if ((client.priority || '') === 'urgent') {
    score -= 8;
    reasons.push('Urgent priority requires tighter routing review.');
  }
  if ((client.stage || '') === 'blocked') {
    score -= 12;
    reasons.push('Blocked stage increases routing risk.');
  }
  const escalation = getClientEscalationState(client);
  if (escalation.level !== 'none') {
    score -= escalation.level === 'founder' ? 26 : escalation.level === 'executive' ? 18 : 10;
    reasons.push(`Escalation is active at ${escalation.label}.`);
  }
  score = Math.max(0, Math.min(100, score));
  let status = 'high';
  let label = 'High confidence';
  if (!client.assignedAeId) {
    status = 'unassigned';
    label = 'Unassigned';
  } else if (score < 55) {
    status = 'review';
    label = 'Review now';
  } else if (score < 78) {
    status = 'medium';
    label = 'Medium confidence';
  }
  return { status, label, score, topCandidate, activeCandidate, gap, reasons };
}

function getAssignmentReviewQueue(limit = 8) {
  return state.clients
    .map(client => ({ client, confidence: getAssignmentConfidence(client) }))
    .filter(row => ['review', 'unassigned', 'medium'].includes(row.confidence.status))
    .sort((a, b) => a.confidence.score - b.confidence.score)
    .slice(0, limit);
}

function getClientEscalationState(client) {
  const level = String(client?.escalationLevel || 'none').toLowerCase();
  const labelMap = { none: 'No escalation', watch: 'Watch', executive: 'Executive', founder: 'Founder' };
  const severityMap = { none: 0, watch: 1, executive: 2, founder: 3 };
  return {
    level,
    label: labelMap[level] || 'No escalation',
    severity: severityMap[level] ?? 0,
    reason: String(client?.escalationReason || '').trim()
  };
}

function getEscalationCounts() {
  const counts = { total: 0, watch: 0, executive: 0, founder: 0 };
  state.clients.forEach(client => {
    const level = getClientEscalationState(client).level;
    if (level !== 'none') {
      counts.total += 1;
      counts[level] = Number(counts[level] || 0) + 1;
    }
  });
  return counts;
}

function getEscalationQueue(limit = 8) {
  return state.clients
    .map(client => ({ client, escalation: getClientEscalationState(client), confidence: getAssignmentConfidence(client) }))
    .filter(row => row.escalation.level !== 'none')
    .sort((a, b) => (b.escalation.severity - a.escalation.severity) || (a.confidence.score - b.confidence.score))
    .slice(0, limit);
}

function setClientEscalation(clientId, level = 'watch', reason = '', source = 'manual-escalation') {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  client.escalationLevel = level;
  client.escalationReason = String(reason || client.escalationReason || '').trim();
  client.tags = buildClientTags(client);
  client.updatedAt = nowIso();
  logClientActivity(client, source, `Escalation set to ${level}`, client.escalationReason || 'No escalation reason recorded.');
  state.auditLog.unshift({ id: uid('audit'), kind: source, message: `${client.name} escalation set to ${level}`, at: nowIso() });
  remoteUpsert?.('clients', client);
  persist();
  return client;
}

function clearClientEscalation(clientId, source = 'manual-clear') {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const prior = getClientEscalationState(client);
  client.escalationLevel = 'none';
  client.escalationReason = '';
  client.tags = buildClientTags(client);
  client.updatedAt = nowIso();
  logClientActivity(client, source, 'Escalation cleared', prior.reason || prior.label);
  state.auditLog.unshift({ id: uid('audit'), kind: source, message: `${client.name} escalation cleared`, at: nowIso() });
  remoteUpsert?.('clients', client);
  persist();
  return client;
}

function createEscalationRescueTask(clientId, source = 'escalation-rescue') {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const escalation = getClientEscalationState(client);
  const confidence = getAssignmentConfidence(client);
  const title = `Escalation rescue — ${client.name}`;
  const existing = state.tasks.find(task => task.clientId === client.id && String(task.status || 'todo') !== 'done' && String(task.title || '').trim() === title);
  if (existing) return existing;
  const task = {
    id: uid('task'),
    title,
    dueDate: plusDaysIso(escalation.level === 'founder' ? 0 : escalation.level === 'executive' ? 1 : 2),
    assignedAeId: client.assignedAeId || '',
    assignedAeName: client.assignedAeName || '',
    clientId: client.id,
    clientName: client.name,
    notes: `Escalation level: ${escalation.label}\nReason: ${escalation.reason || 'No escalation reason recorded.'}\nAssignment confidence: ${confidence.label} (${confidence.score})\nNext step: ${client.nextStep || 'Not set.'}`,
    status: 'todo',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    dependencyTaskId: '',
    kind: source,
  };
  state.tasks.unshift(task);
  logClientActivity(client, source, 'Escalation rescue task created', title);
  state.auditLog.unshift({ id: uid('audit'), kind: source, message: `Escalation rescue task created for ${client.name}`, at: nowIso() });
  remoteUpsert?.('tasks', task);
  remoteUpsert?.('clients', client);
  persist();
  return task;
}

function buildAePrepBrief(clientId) {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const candidates = getAeMatchCandidates(client, 3);
  const confidence = getAssignmentConfidence(client);
  const escalation = getClientEscalationState(client);
  const health = getClientHealth(client);
  const touch = getClientTouchStatus(client);
  const riskFlags = [
    ...(health.reasons || []),
    ...(confidence.status === 'review' ? ['Assignment review is required.'] : []),
    ...(escalation.reason ? [escalation.reason] : []),
  ].filter(Boolean);
  const opener = client.assignedAeName
    ? `${client.assignedAeName}, open with clarity around ${client.nextStep || 'the current next step'} and confirm the client’s top need: ${client.needs || 'general support'}.`
    : `Open with intake clarity, confirm the client’s top need (${client.needs || 'general support'}), and assign the right AE immediately.`;
  const recommendedActions = getClientRecommendedActions(client).slice(0, 3).map(action => `${action.label}: ${action.detail}`);
  return {
    generatedAt: nowIso(),
    client: {
      id: client.id,
      name: client.name,
      company: client.company || '',
      stage: client.stage || 'intake',
      priority: client.priority || 'normal',
      needs: client.needs || '',
      nextStep: client.nextStep || '',
      followUpDate: client.followUpDate || '',
      estimatedValue: getClientEstimatedValue(client),
      weightedValue: getClientWeightedValue(client),
      monthlyValue: getClientMonthlyValue(client),
    },
    assignedAe: client.assignedAeId ? { id: client.assignedAeId, name: client.assignedAeName || '', topLane: candidates[0]?.title || '' } : null,
    topCandidates: candidates,
    assignmentConfidence: confidence,
    escalation,
    health,
    touch,
    opener,
    discoveryQuestions: [
      `What is the single most important outcome you need from us next on ${client.name}?`,
      `What would make this engagement feel fully on track over the next 7 days?`,
      `Is there any blocker, concern, or decision risk we should surface now?`
    ],
    riskFlags,
    recommendedActions,
  };
}

function exportAePrepBrief(clientId, format = 'json') {
  const brief = buildAePrepBrief(clientId);
  if (!brief) return null;
  if (format === 'json') return download('ae-prep-brief.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    '# AE Prep Brief',
    '',
    `Generated: ${brief.generatedAt}`,
    '',
    '## Client',
    `- Name: ${brief.client.name}`,
    `- Company: ${brief.client.company || 'No company'}`,
    `- Stage: ${brief.client.stage}`,
    `- Priority: ${brief.client.priority}`,
    `- Needs: ${brief.client.needs || 'Not specified'}`,
    `- Next step: ${brief.client.nextStep || 'Not set'}`,
    `- Estimated value: ${formatCurrency(brief.client.estimatedValue || 0)}`,
    `- Weighted value: ${formatCurrency(brief.client.weightedValue || 0)}`,
    `- Monthly value: ${formatCurrency(brief.client.monthlyValue || 0)}`,
    '',
    '## Assignment',
    `- Confidence: ${brief.assignmentConfidence.label} (${brief.assignmentConfidence.score})`,
    `- Assigned AE: ${brief.assignedAe?.name || 'Unassigned'}`,
    `- Escalation: ${brief.escalation.label}${brief.escalation.reason ? ` — ${brief.escalation.reason}` : ''}`,
    '',
    '## Opener',
    brief.opener,
    '',
    '## Discovery questions',
    ...brief.discoveryQuestions.map(item => `- ${item}`),
    '',
    '## Risk flags',
    ...(brief.riskFlags.length ? brief.riskFlags.map(item => `- ${item}`) : ['- None surfaced.']),
    '',
    '## Recommended actions',
    ...(brief.recommendedActions.length ? brief.recommendedActions.map(item => `- ${item}`) : ['- No recommended actions surfaced.'])
  ].join('\n');
  return download('ae-prep-brief.md', md, 'text/markdown');
}

function exportEscalationBrief(format = 'json') {
  const payload = {
    generatedAt: nowIso(),
    counts: getEscalationCounts(),
    queue: getEscalationQueue(50).map(row => ({
      clientId: row.client.id,
      clientName: row.client.name,
      company: row.client.company || '',
      escalation: row.escalation,
      assignmentConfidence: { label: row.confidence.label, score: row.confidence.score },
      assignedAeName: row.client.assignedAeName || '',
      nextStep: row.client.nextStep || '',
      followUpDate: row.client.followUpDate || ''
    }))
  };
  if (format === 'json') return download('ae-escalation-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# AE Escalation Brief',
    '',
    `Generated: ${payload.generatedAt}`,
    '',
    `- Total escalations: ${payload.counts.total}`,
    `- Watch: ${payload.counts.watch}`,
    `- Executive: ${payload.counts.executive}`,
    `- Founder: ${payload.counts.founder}`,
    '',
    '## Queue',
    ...(payload.queue.length ? payload.queue.map(item => `- ${item.clientName} (${item.company || 'No company'}) · ${item.escalation.label} · confidence ${item.assignmentConfidence.score} · ${item.nextStep || 'No next step'}`) : ['- No escalations in queue.'])
  ].join('\n');
  return download('ae-escalation-brief.md', md, 'text/markdown');
}

const __v41BaseRenderDashboard = renderDashboard;
renderDashboard = function() {
  const escalationCounts = getEscalationCounts();
  const escalationQueue = getEscalationQueue();
  const assignmentReviewQueue = getAssignmentReviewQueue();
  const extra = `
    <section class="grid-2">
      <div class="card"><div class="eyebrow">Assignment review</div><h3>Confidence queue and prep exports</h3><div class="meta">Review low-confidence or unassigned clients before routing drift compounds.</div><div class="list">${assignmentReviewQueue.length ? assignmentReviewQueue.map(row => `<div class="item"><h4>${escapeHtml(row.client.name)}</h4><div class="meta">${escapeHtml(row.confidence.label)} · score ${row.confidence.score} · assigned ${escapeHtml(row.client.assignedAeName || 'Unassigned')}</div><div class="meta">Top candidate: ${escapeHtml(row.confidence.topCandidate?.name || 'None')}</div><div class="toolbar"><button class="btn-soft" data-act="dashboard-open-client" data-id="${row.client.id}">Open client</button><button class="btn-soft" data-act="confidence-prep-export" data-id="${row.client.id}" data-format="json">Prep JSON</button><button class="btn-soft" data-act="confidence-prep-export" data-id="${row.client.id}" data-format="markdown">Prep MD</button></div></div>`).join('') : '<div class="item"><div class="meta">No confidence review queue is currently open.</div></div>'}</div></div>
      <div class="card"><div class="eyebrow">Escalation queue</div><h3>Watch, executive, and founder surfacing</h3><div class="toolbar"><button class="btn-soft" id="export-escalation-brief-json">Escalation JSON</button><button class="btn-soft" id="export-escalation-brief-md">Escalation MD</button></div><div class="tag-row"><span class="tag">Total ${escalationCounts.total}</span><span class="tag">Watch ${escalationCounts.watch}</span><span class="tag">Executive ${escalationCounts.executive}</span><span class="tag">Founder ${escalationCounts.founder}</span></div><div class="list">${escalationQueue.length ? escalationQueue.map(row => `<div class="item"><h4>${escapeHtml(row.client.name)}</h4><div class="meta">${escapeHtml(row.escalation.label)} · ${escapeHtml(row.client.assignedAeName || 'Unassigned')} · confidence ${row.confidence.score}</div><p>${escapeHtml(row.escalation.reason || 'No escalation reason recorded.')}</p><div class="toolbar"><button class="btn-soft" data-act="dashboard-open-client" data-id="${row.client.id}">Open client</button><button class="btn-soft" data-act="escalation-create-task" data-id="${row.client.id}">Create rescue task</button><button class="btn-soft" data-act="escalation-clear" data-id="${row.client.id}">Clear</button></div></div>`).join('') : '<div class="item"><div class="meta">No escalated clients are currently surfaced.</div></div>'}</div></div>
    </section>`;
  return __v41BaseRenderDashboard() + extra;
};

const __v41BaseRenderClients = renderClients;
renderClients = function() {
  const html = __v41BaseRenderClients();
  const fieldNeedle = '<label><span>Priority</span><select id="client-priority"><option value="low">low</option><option value="normal" selected>normal</option><option value="high">high</option><option value="urgent">urgent</option></select></label>';
  const fieldInsert = fieldNeedle + '<label><span>Escalation level</span><select id="client-escalation-level"><option value="none" selected>none</option><option value="watch">watch</option><option value="executive">executive</option><option value="founder">founder</option></select></label><label><span>Escalation reason</span><input id="client-escalation-reason" placeholder="Why this client needs escalation attention"></label>';
  return html.replace(fieldNeedle, fieldInsert);
};

const __v41BaseBuildClientRows = buildClientRows;
buildClientRows = function(clients) {
  return __v41BaseBuildClientRows(clients).replace(/<td>([^<]+|Unassigned)<\/td>\s*<td><span class="tag">([^<]+)<\/span><\/td>\s*<td><span class="tag">([^<]+)<\/span><div class="meta">([^<]+)<\/div><div class="meta">([^<]+)<\/div><\/td>/g, (match, aeCell, stageLabel, priorityLabel, dueLabel, milestoneLabel) => {
    const rowText = match;
    const nameMatch = rowText.match(/<td>([^<]+)<div class="meta">/);
    const clientName = nameMatch ? nameMatch[1] : '';
    const client = state.clients.find(item => item.name === clientName);
    if (!client) return match;
    const escalation = getClientEscalationState(client);
    const confidence = getAssignmentConfidence(client);
    const aeHtml = `<td>${client.assignedAeName || 'Unassigned'}<div class="meta">${escapeHtml(confidence.label)} · score ${confidence.score}</div></td>`;
    const priorityHtml = `<td><span class="tag">${client.priority || 'normal'}</span><div class="meta">${escapeHtml(getClientDueState(client).label)}</div><div class="meta">${escapeHtml(getClientMilestoneState(client).label)}</div>${escalation.level !== 'none' ? `<div class="meta">${escapeHtml(escalation.label)} · ${escapeHtml(escalation.reason || 'No reason logged')}</div>` : ''}</td>`;
    return rowText.replace(/<td>([^<]+|Unassigned)<\/td>/, aeHtml).replace(/<td><span class="tag">([^<]+)<\/span><div class="meta">([^<]+)<\/div><div class="meta">([^<]+)<\/div><\/td>/, priorityHtml);
  });
};

const __v41BaseBindDashboard = bindDashboard;
bindDashboard = function() {
  __v41BaseBindDashboard();
  document.querySelectorAll('[data-act="confidence-prep-export"]').forEach(btn => btn.addEventListener('click', () => exportAePrepBrief(btn.dataset.id, btn.dataset.format || 'json')));
  document.querySelectorAll('[data-act="escalation-create-task"]').forEach(btn => btn.addEventListener('click', () => { createEscalationRescueTask(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="escalation-clear"]').forEach(btn => btn.addEventListener('click', () => { clearClientEscalation(btn.dataset.id); render(); }));
  $('#export-escalation-brief-json')?.addEventListener('click', () => exportEscalationBrief('json'));
  $('#export-escalation-brief-md')?.addEventListener('click', () => exportEscalationBrief('markdown'));
};

const __v41BaseBindClients = bindClients;
bindClients = function() {
  __v41BaseBindClients();
  ['#client-name','#client-company','#client-type','#client-needs','#client-stage','#client-priority','#client-follow-up','#client-next-step','#client-notes','#client-estimated-value','#client-monthly-value','#client-close-probability','#client-target-close','#client-escalation-level','#client-escalation-reason'].forEach(id => {
    $(id)?.addEventListener('input', renderDuplicateWatch);
    $(id)?.addEventListener('change', renderDuplicateWatch);
  });
};

const __v41BaseRenderClientHistory = renderClientHistory;
renderClientHistory = function(clientId, openInForm = false) {
  __v41BaseRenderClientHistory(clientId, openInForm);
  const client = state.clients.find(item => item.id === clientId);
  const panel = $('#client-history-panel');
  if (!client || !panel) return;
  const escalation = getClientEscalationState(client);
  const confidence = getAssignmentConfidence(client);
  const prepBrief = buildAePrepBrief(client.id);
  const afterCandidates = `<div class="item"><div class="eyebrow">Assignment confidence</div><div class="meta">${escapeHtml(confidence.label)} · score ${confidence.score}</div>${confidence.reasons.length ? confidence.reasons.map(reason => `<div class="meta">${escapeHtml(reason)}</div>`).join('') : '<div class="meta">No confidence reasons captured.</div>'}</div><div class="item"><div class="eyebrow">Escalation control</div><div class="meta">${escapeHtml(escalation.label)}${escalation.reason ? ` · ${escapeHtml(escalation.reason)}` : ''}</div><div class="toolbar"><button class="btn-soft" id="client-escalate-watch">Set watch</button><button class="btn-soft" id="client-escalate-executive">Set executive</button><button class="btn-soft" id="client-clear-escalation">Clear escalation</button><button class="btn-soft" id="client-escalation-task">Create rescue task</button></div></div><div class="item"><div class="eyebrow">AE prep brief preview</div>${prepBrief ? `<div class="meta">Opener: ${escapeHtml(prepBrief.opener)}</div>${prepBrief.discoveryQuestions.map(item => `<div class="meta">Q · ${escapeHtml(item)}</div>`).join('')}<div class="toolbar"><button class="btn-soft" id="export-ae-prep-json">Prep JSON</button><button class="btn-soft" id="export-ae-prep-md">Prep MD</button></div>` : '<div class="meta">Prep brief unavailable.</div>'}</div>`;
  panel.innerHTML = panel.innerHTML
    .replace('score ' + confidence.score, 'score ' + confidence.score)
    .replace('<div class="item"><div class="eyebrow">Recommended actions</div>', afterCandidates + '<div class="item"><div class="eyebrow">Recommended actions</div>')
    .replace('id="create-client-followup-task">Create follow-up task</button>', 'id="create-client-followup-task">Create follow-up task</button><button class="btn-soft" id="client-escalation-task-inline">Rescue task</button>')
    .replace('id="export-client-handoff-md">Export handoff Markdown</button>', 'id="export-client-handoff-md">Export handoff Markdown</button><button class="btn-soft" id="client-clear-escalation-inline">Clear escalation</button>');
  const summaryMeta = panel.querySelector('.item .meta:nth-of-type(2)');
  if (summaryMeta) {
    const extra = document.createElement('div');
    extra.className = 'meta';
    extra.textContent = `Assignment confidence: ${confidence.label} · score ${confidence.score} · escalation: ${escalation.label}${escalation.reason ? ` · ${escalation.reason}` : ''}`;
    summaryMeta.parentNode.insertBefore(extra, summaryMeta.nextSibling);
  }
  $('#client-escalate-watch')?.addEventListener('click', () => { const reason = globalThis.prompt('Escalation reason?', client.escalationReason || client.nextStep || '') || ''; setClientEscalation(client.id, 'watch', reason, 'client-watch-escalation'); render(); renderClientHistory(client.id, true); });
  $('#client-escalate-executive')?.addEventListener('click', () => { const reason = globalThis.prompt('Executive escalation reason?', client.escalationReason || client.nextStep || '') || ''; setClientEscalation(client.id, 'executive', reason, 'client-executive-escalation'); render(); renderClientHistory(client.id, true); });
  $('#client-clear-escalation')?.addEventListener('click', () => { clearClientEscalation(client.id, 'client-clear-escalation'); render(); renderClientHistory(client.id, true); });
  $('#client-clear-escalation-inline')?.addEventListener('click', () => { clearClientEscalation(client.id, 'client-clear-escalation-inline'); render(); renderClientHistory(client.id, true); });
  $('#client-escalation-task')?.addEventListener('click', () => { createEscalationRescueTask(client.id, 'client-escalation-task'); render(); renderClientHistory(client.id, true); });
  $('#client-escalation-task-inline')?.addEventListener('click', () => { createEscalationRescueTask(client.id, 'client-escalation-task-inline'); render(); renderClientHistory(client.id, true); });
  $('#export-ae-prep-json')?.addEventListener('click', () => exportAePrepBrief(client.id, 'json'));
  $('#export-ae-prep-md')?.addEventListener('click', () => exportAePrepBrief(client.id, 'markdown'));
};


function buildRenewalCommandDeck() {
  const summary = buildRenewalRiskSummary(state.clients);
  const queue = summary.rows
    .filter(row => ['critical', 'high', 'watch'].includes(row.risk.status))
    .map(row => ({
      client: row.client,
      risk: row.risk,
      confidence: getAssignmentConfidence(row.client),
      escalation: getClientEscalationState(row.client)
    }))
    .sort((a, b) => (b.risk.score - a.risk.score) || (b.risk.atRiskValue - a.risk.atRiskValue) || (a.confidence.score - b.confidence.score))
    .slice(0, 10);
  return { generatedAt: nowIso(), summary, queue };
}

function buildRenewalSaveBrief(clientId) {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const renewalRisk = getClientRenewalRiskState(client);
  const escalation = getClientEscalationState(client);
  const opener = `Open directly on retained value, confirm the blocker on ${client.name}, and ask for a committed renewal decision window.`;
  const saveLevers = [
    `Recap delivered value tied to ${formatCurrency(getClientMonthlyValue(client) || getClientEstimatedValue(client) || 0)} in account value.`,
    `Surface the next-step blocker: ${client.nextStep || 'No next step is currently set.'}`,
    `Use ${escalation.level !== 'none' ? escalation.label : 'standard'} follow-through pressure if the decision stays soft.`
  ];
  const agenda = [
    'Confirm whether the client intends to continue or pause.',
    'Clarify the commercial or delivery blocker.',
    'Lock the next meeting or payment checkpoint before closing the call.'
  ];
  return {
    generatedAt: nowIso(),
    client: {
      id: client.id,
      name: client.name,
      company: client.company || '',
      assignedAeName: client.assignedAeName || '',
      nextStep: client.nextStep || '',
      followUpDate: client.followUpDate || '',
      monthlyValue: getClientMonthlyValue(client),
      estimatedValue: getClientEstimatedValue(client)
    },
    renewalRisk,
    escalation,
    opener,
    saveLevers,
    agenda
  };
}

function exportRenewalCommandBrief(format = 'json') {
  const deck = buildRenewalCommandDeck();
  const payload = {
    generatedAt: deck.generatedAt,
    summary: {
      critical: deck.summary.critical,
      high: deck.summary.high,
      watch: deck.summary.watch,
      stable: deck.summary.stable,
      atRiskRevenue: deck.summary.atRiskRevenue
    },
    queue: deck.queue.map(row => ({
      clientId: row.client.id,
      clientName: row.client.name,
      assignedAeName: row.client.assignedAeName || '',
      renewalRisk: row.risk,
      escalation: row.escalation,
      assignmentConfidence: { label: row.confidence.label, score: row.confidence.score },
      nextStep: row.client.nextStep || '',
      followUpDate: row.client.followUpDate || ''
    }))
  };
  if (format === 'json') return download('ae-renewal-command-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# AE Renewal Command Brief',
    '',
    `Generated: ${payload.generatedAt}`,
    '',
    `- Critical: ${payload.summary.critical}`,
    `- High: ${payload.summary.high}`,
    `- Watch: ${payload.summary.watch}`,
    `- Stable: ${payload.summary.stable}`,
    `- At-risk revenue: ${formatCurrency(payload.summary.atRiskRevenue || 0)}`,
    '',
    '## Queue',
    ...(payload.queue.length ? payload.queue.map(item => `- ${item.clientName} · ${item.renewalRisk.label} · ${formatCurrency(item.renewalRisk.atRiskValue || 0)} at risk · ${item.assignmentConfidence.label} · ${item.nextStep || 'No next step set'}`) : ['- No renewal queue is currently open.'])
  ].join('
');
  return download('ae-renewal-command-brief.md', md, 'text/markdown');
}

function exportRenewalSaveBrief(clientId, format = 'json') {
  const brief = buildRenewalSaveBrief(clientId);
  if (!brief) return null;
  if (format === 'json') return download('ae-renewal-save-brief.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    '# AE Renewal Save Brief',
    '',
    `Generated: ${brief.generatedAt}`,
    '',
    `- Client: ${brief.client.name}`,
    `- Company: ${brief.client.company || 'No company'}`,
    `- Assigned AE: ${brief.client.assignedAeName || 'Unassigned'}`,
    `- Renewal risk: ${brief.renewalRisk.label} (${brief.renewalRisk.score})`,
    `- At-risk revenue: ${formatCurrency(brief.renewalRisk.atRiskValue || 0)}`,
    `- Escalation: ${brief.escalation.label}`,
    '',
    '## Opener',
    brief.opener,
    '',
    '## Save levers',
    ...brief.saveLevers.map(item => `- ${item}`),
    '',
    '## Next-meeting agenda',
    ...brief.agenda.map(item => `- ${item}`)
  ].join('
');
  return download('ae-renewal-save-brief.md', md, 'text/markdown');
}

function createRenewalRescueTask(clientId, source = 'renewal-rescue') {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const renewalRisk = getClientRenewalRiskState(client);
  const title = `Renewal rescue — ${client.name}`;
  const existing = state.tasks.find(task => task.clientId === client.id && String(task.status || 'todo') !== 'done' && String(task.title || '').trim() === title);
  if (existing) return existing;
  const task = {
    id: uid('task'),
    title,
    dueDate: plusDaysIso(renewalRisk.status === 'critical' ? 0 : renewalRisk.status === 'high' ? 1 : 2),
    assignedAeId: client.assignedAeId || '',
    assignedAeName: client.assignedAeName || '',
    clientId: client.id,
    clientName: client.name,
    notes: `Renewal risk: ${renewalRisk.label} (${renewalRisk.score})
At-risk value: ${formatCurrency(renewalRisk.atRiskValue || 0)}
Next step: ${client.nextStep || 'Not set.'}`,
    status: 'todo',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    dependencyTaskId: '',
    kind: source,
  };
  state.tasks.unshift(task);
  state.renewalRuns = Array.isArray(state.renewalRuns) ? state.renewalRuns : [];
  state.renewalRuns.unshift({ id: uid('renewal-run'), createdAt: nowIso(), clientId: client.id, clientName: client.name, action: 'renewal-rescue-task', risk: renewalRisk.status, atRiskValue: renewalRisk.atRiskValue });
  logClientActivity(client, source, 'Renewal rescue task created', title);
  state.auditLog.unshift({ id: uid('audit'), kind: source, message: `Renewal rescue task created for ${client.name}`, at: nowIso() });
  persist();
  return task;
}

function buildAeCoveragePressureDeck() {
  const summary = buildAeCoverageSummary(state.aeProfiles);
  const queue = summary.rows
    .map(row => ({
      ae: row.ae,
      pressure: row.pressure,
      assignedClients: state.clients.filter(client => client.assignedAeId === row.ae.id).length
    }))
    .filter(row => ['critical', 'high', 'watch'].includes(row.pressure.status))
    .sort((a, b) => (b.pressure.score - a.pressure.score) || (b.assignedClients - a.assignedClients))
    .slice(0, 10);
  return { generatedAt: nowIso(), summary, queue };
}

function exportCoveragePressureBrief(format = 'json') {
  const deck = buildAeCoveragePressureDeck();
  const payload = {
    generatedAt: deck.generatedAt,
    summary: {
      critical: deck.summary.critical,
      high: deck.summary.high,
      watch: deck.summary.watch,
      healthy: deck.summary.healthy
    },
    queue: deck.queue.map(row => ({
      aeId: row.ae.id,
      aeName: row.ae.name,
      title: row.ae.title,
      pressure: row.pressure,
      assignedClients: row.assignedClients
    }))
  };
  if (format === 'json') return download('ae-coverage-pressure-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# AE Coverage Pressure Brief',
    '',
    `Generated: ${payload.generatedAt}`,
    '',
    `- Critical: ${payload.summary.critical}`,
    `- High: ${payload.summary.high}`,
    `- Watch: ${payload.summary.watch}`,
    `- Healthy: ${payload.summary.healthy}`,
    '',
    '## Queue',
    ...(payload.queue.length ? payload.queue.map(item => `- ${item.aeName} · ${item.pressure.label} (${item.pressure.score}) · assignments ${item.assignedClients}`) : ['- No AE coverage queue is currently open.'])
  ].join('
');
  return download('ae-coverage-pressure-brief.md', md, 'text/markdown');
}

function createCoverageReliefTask(aeId, source = 'coverage-relief-task') {
  const ae = state.aeProfiles.find(item => item.id === aeId);
  if (!ae) return null;
  const pressure = getAeCoveragePressureState(ae);
  const title = `Coverage relief — ${ae.name}`;
  const existing = state.tasks.find(task => String(task.status || 'todo') !== 'done' && String(task.title || '').trim() === title);
  if (existing) return existing;
  const affectedClients = state.clients.filter(client => client.assignedAeId === ae.id).map(client => client.name).join(', ');
  const task = {
    id: uid('task'),
    title,
    dueDate: plusDaysIso(pressure.status === 'critical' ? 0 : 1),
    assignedAeId: ae.id,
    assignedAeName: ae.name,
    clientId: '',
    clientName: '',
    notes: `Coverage pressure: ${pressure.label} (${pressure.score})
Reasons: ${(pressure.reasons || []).join(' | ') || 'No reasons captured.'}
Affected clients: ${affectedClients || 'No assigned clients surfaced.'}`,
    status: 'todo',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    dependencyTaskId: '',
    kind: source,
  };
  state.tasks.unshift(task);
  state.coverageRuns = Array.isArray(state.coverageRuns) ? state.coverageRuns : [];
  state.coverageRuns.unshift({ id: uid('coverage-run'), createdAt: nowIso(), aeId: ae.id, aeName: ae.name, action: 'coverage-relief-task', pressure: pressure.status, score: pressure.score });
  state.auditLog.unshift({ id: uid('audit'), kind: source, message: `Coverage relief task created for ${ae.name}`, at: nowIso() });
  persist();
  return task;
}

function runCoverageReliefSweep(limit = 5) {
  const pressuredAeIds = new Set(buildAeCoveragePressureDeck().queue.filter(item => item.pressure.score >= 50).map(item => item.ae.id));
  const moves = [];
  if (!pressuredAeIds.size) {
    const emptyRun = { id: uid('coverage-run'), createdAt: nowIso(), action: 'coverage-relief-sweep', moved: 0, moves: [] };
    state.coverageRuns = Array.isArray(state.coverageRuns) ? state.coverageRuns : [];
    state.coverageRuns.unshift(emptyRun);
    persist();
    return emptyRun;
  }
  const healthyAeIds = new Set(state.aeProfiles.filter(ae => getAeCoveragePressureState(ae).score < 28).map(ae => ae.id));
  const candidateRows = state.clients
    .filter(client => pressuredAeIds.has(client.assignedAeId || ''))
    .map(client => ({ client, confidence: getAssignmentConfidence(client), risk: getClientRenewalRiskState(client) }))
    .sort((a, b) => (b.risk.score - a.risk.score) || (a.confidence.score - b.confidence.score));
  for (const row of candidateRows) {
    if (moves.length >= limit) break;
    const next = getAeMatchCandidates(row.client, 6).find(candidate => candidate.id !== row.client.assignedAeId && healthyAeIds.has(candidate.id));
    if (!next) continue;
    const fromAe = row.client.assignedAeName || row.client.assignedAeId || 'Unassigned';
    assignClient(state, row.client.id, next.id, 'coverage-relief-sweep');
    logClientActivity(row.client, 'coverage-relief-sweep', `Coverage relief reassigned ${row.client.name}`, `${fromAe} -> ${next.name}`);
    state.auditLog.unshift({ id: uid('audit'), kind: 'coverage-relief-sweep', message: `${row.client.name} moved from ${fromAe} to ${next.name}`, at: nowIso() });
    moves.push({ clientId: row.client.id, clientName: row.client.name, fromAe, toAe: next.name, risk: row.risk.status, confidence: row.confidence.label });
  }
  const run = { id: uid('coverage-run'), createdAt: nowIso(), action: 'coverage-relief-sweep', moved: moves.length, moves };
  state.coverageRuns = Array.isArray(state.coverageRuns) ? state.coverageRuns : [];
  state.coverageRuns.unshift(run);
  persist();
  return run;
}

function renderRenewalCommandCard() {
  const deck = buildRenewalCommandDeck();
  return `<div class="card"><div class="eyebrow">Renewal command center</div><h3>At-risk revenue, renewal pressure, and rescue execution</h3><div class="toolbar"><button class="btn-soft" id="export-renewal-brief-json">Renewal JSON</button><button class="btn-soft" id="export-renewal-brief-md">Renewal MD</button></div><div class="tag-row"><span class="tag">Critical ${deck.summary.critical}</span><span class="tag">High ${deck.summary.high}</span><span class="tag">Watch ${deck.summary.watch}</span><span class="tag">At-risk ${formatCurrency(deck.summary.atRiskRevenue || 0)}</span></div><div class="list">${deck.queue.length ? deck.queue.map(row => `<div class="item"><h4>${escapeHtml(row.client.name)}</h4><div class="meta">${escapeHtml(row.risk.label)} · ${escapeHtml(row.client.assignedAeName || 'Unassigned')} · ${formatCurrency(row.risk.atRiskValue || 0)} at risk</div><p>${escapeHtml((row.risk.reasons || []).slice(0, 2).join(' '))}</p><div class="toolbar"><button class="btn-soft" data-act="renewal-open-client" data-id="${row.client.id}">Open client</button><button class="btn-soft" data-act="renewal-save-export" data-id="${row.client.id}" data-format="markdown">Save brief</button><button class="btn-soft" data-act="renewal-create-task" data-id="${row.client.id}">Create rescue task</button></div></div>`).join('') : '<div class="item"><div class="meta">No renewal risk queue is currently open.</div></div>'}</div></div>`;
}

function renderCoveragePressureCard() {
  const deck = buildAeCoveragePressureDeck();
  return `<div class="card"><div class="eyebrow">AE coverage pressure</div><h3>Overload visibility, relief actions, and rebalance command</h3><div class="toolbar"><button class="btn-soft" id="run-coverage-relief-sweep">Run relief sweep</button><button class="btn-soft" id="export-coverage-brief-json">Coverage JSON</button><button class="btn-soft" id="export-coverage-brief-md">Coverage MD</button></div><div class="tag-row"><span class="tag">Critical ${deck.summary.critical}</span><span class="tag">High ${deck.summary.high}</span><span class="tag">Watch ${deck.summary.watch}</span><span class="tag">Healthy ${deck.summary.healthy}</span></div><div class="list">${deck.queue.length ? deck.queue.map(row => `<div class="item"><h4>${escapeHtml(row.ae.name)}</h4><div class="meta">${escapeHtml(row.pressure.label)} · assignments ${row.assignedClients} · availability ${escapeHtml(row.pressure.availabilityState || 'available')}</div><p>${escapeHtml((row.pressure.reasons || []).slice(0, 2).join(' '))}</p><div class="toolbar"><button class="btn-soft" data-act="coverage-create-task" data-id="${row.ae.id}">Create relief task</button><button class="btn-soft" data-act="coverage-open-ae" data-id="${row.ae.id}">Open AE tab</button></div></div>`).join('') : '<div class="item"><div class="meta">No AE coverage pressure queue is currently open.</div></div>'}</div></div>`;
}

const __v42BaseRenderDashboard = renderDashboard;
renderDashboard = function() {
  return __v42BaseRenderDashboard() + `<section class="grid two">${renderRenewalCommandCard()}${renderCoveragePressureCard()}</section>`;
};

const __v42BaseBindDashboard = bindDashboard;
bindDashboard = function() {
  __v42BaseBindDashboard();
  $('#export-renewal-brief-json')?.addEventListener('click', () => exportRenewalCommandBrief('json'));
  $('#export-renewal-brief-md')?.addEventListener('click', () => exportRenewalCommandBrief('markdown'));
  $('#export-coverage-brief-json')?.addEventListener('click', () => exportCoveragePressureBrief('json'));
  $('#export-coverage-brief-md')?.addEventListener('click', () => exportCoveragePressureBrief('markdown'));
  $('#run-coverage-relief-sweep')?.addEventListener('click', () => { runCoverageReliefSweep(6); render(); });
  document.querySelectorAll('[data-act="renewal-open-client"]').forEach(btn => btn.addEventListener('click', () => { page = 'clients'; render(); renderClientHistory(btn.dataset.id, true); }));
  document.querySelectorAll('[data-act="renewal-save-export"]').forEach(btn => btn.addEventListener('click', () => exportRenewalSaveBrief(btn.dataset.id, btn.dataset.format || 'json')));
  document.querySelectorAll('[data-act="renewal-create-task"]').forEach(btn => btn.addEventListener('click', () => { createRenewalRescueTask(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="coverage-create-task"]').forEach(btn => btn.addEventListener('click', () => { createCoverageReliefTask(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="coverage-open-ae"]').forEach(btn => btn.addEventListener('click', () => { page = 'ae-brains'; render(); const target = document.querySelector(`[data-ae-card="${btn.dataset.id}"]`); target?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
};

const __v42BaseRenderAeBrains = renderAeBrains;
renderAeBrains = function() {
  const html = __v42BaseRenderAeBrains();
  return html.replace(/<div class="ae-card" data-ae-id="([^"]+)">/g, '<div class="ae-card" data-ae-id="$1" data-ae-card="$1">');
};

const __v42BaseRenderClientHistory = renderClientHistory;
renderClientHistory = function(clientId, openInForm = false) {
  __v42BaseRenderClientHistory(clientId, openInForm);
  const client = state.clients.find(item => item.id === clientId);
  const panel = $('#client-history-panel');
  if (!client || !panel) return;
  const brief = buildRenewalSaveBrief(client.id);
  if (!brief) return;
  const insertion = `<div class="item"><div class="eyebrow">Renewal save brief preview</div><div class="meta">${escapeHtml(brief.renewalRisk.label)} · ${formatCurrency(brief.renewalRisk.atRiskValue || 0)} at risk</div><div class="meta">${escapeHtml(brief.opener)}</div>${brief.saveLevers.map(item => `<div class="meta">Lever · ${escapeHtml(item)}</div>`).join('')}<div class="toolbar"><button class="btn-soft" id="export-renewal-save-json">Save JSON</button><button class="btn-soft" id="export-renewal-save-md">Save MD</button><button class="btn-soft" id="create-renewal-rescue-task">Create renewal rescue task</button></div></div>`;
  if (!panel.innerHTML.includes('Renewal save brief preview')) {
    panel.innerHTML = panel.innerHTML.replace('<div class="item"><div class="eyebrow">Recommended actions</div>', insertion + '<div class="item"><div class="eyebrow">Recommended actions</div>');
  }
  $('#export-renewal-save-json')?.addEventListener('click', () => exportRenewalSaveBrief(client.id, 'json'));
  $('#export-renewal-save-md')?.addEventListener('click', () => exportRenewalSaveBrief(client.id, 'markdown'));
  $('#create-renewal-rescue-task')?.addEventListener('click', () => { createRenewalRescueTask(client.id, 'client-renewal-rescue'); render(); renderClientHistory(client.id, true); });
};



function buildReactivationCommandDeck() {
  const summary = buildReactivationSummary(state.clients || []);
  const queue = (summary.rows || [])
    .filter(row => ['critical', 'high', 'watch'].includes(row.reactivation.status))
    .sort((a, b) => (b.reactivation.score - a.reactivation.score) || (Number(b.reactivation.recoverableValue || 0) - Number(a.reactivation.recoverableValue || 0)))
    .slice(0, 8)
    .map(row => ({
      client: row.client,
      reactivation: row.reactivation,
      confidence: getAssignmentConfidence(row.client),
      assignedAeName: row.client.assignedAeName || 'Unassigned'
    }));
  return { generatedAt: nowIso(), summary, queue };
}

function buildReactivationBrief(clientId) {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const reactivation = getClientReactivationState(client);
  const confidence = getAssignmentConfidence(client);
  const candidates = getAeMatchCandidates(client, 3);
  const saveLevers = [
    client.monthlyValue ? `Recover recurring value lane worth ${formatCurrency(getClientMonthlyValue(client) * 2)} over the next 60 days.` : 'Recover the opportunity before it decays further.',
    `Start with one concrete next step tied to ${client.nextStep || 'the client’s highest-priority blocker'}.`,
    confidence.status === 'review' ? 'Confirm the AE owner before outreach so the client does not see internal drift.' : `Keep ${client.assignedAeName || 'the assigned AE'} as the visible owner during recovery.`
  ];
  return {
    generatedAt: nowIso(),
    client: {
      id: client.id,
      name: client.name,
      company: client.company || '',
      stage: client.stage || 'intake',
      priority: client.priority || 'normal',
      followUpDate: client.followUpDate || '',
      lastContactAt: client.lastContactAt || client.updatedAt || '',
      estimatedValue: getClientEstimatedValue(client),
      monthlyValue: getClientMonthlyValue(client)
    },
    reactivation,
    assignmentConfidence: confidence,
    topCandidates: candidates,
    opener: `Reconnect ${client.name} with a concise status reset, acknowledge the stale gap, and offer one simple next step tied to ${client.needs || 'their main need'}.`,
    rescueSteps: [
      'Acknowledge the gap without sounding defensive.',
      'Offer one concrete recovery move with a due date.',
      'Ask for a direct yes/no on the next checkpoint.',
      'Create internal follow-through work before the conversation ends.'
    ],
    saveLevers
  };
}

function exportReactivationCommandBrief(format = 'json') {
  const deck = buildReactivationCommandDeck();
  const payload = {
    generatedAt: deck.generatedAt,
    summary: {
      critical: deck.summary.critical,
      high: deck.summary.high,
      watch: deck.summary.watch,
      recoverableValue: deck.summary.recoverableValue
    },
    queue: deck.queue.map(row => ({
      clientId: row.client.id,
      clientName: row.client.name,
      assignedAeName: row.assignedAeName,
      reactivation: row.reactivation,
      assignmentConfidence: { label: row.confidence.label, score: row.confidence.score }
    }))
  };
  if (format === 'json') return download('ae-reactivation-command-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# AE Reactivation Command Brief',
    '',
    `Generated: ${payload.generatedAt}`,
    '',
    `- Critical: ${payload.summary.critical}`,
    `- High: ${payload.summary.high}`,
    `- Watch: ${payload.summary.watch}`,
    `- Recoverable value: ${formatCurrency(payload.summary.recoverableValue || 0)}`,
    '',
    '## Queue',
    ...(payload.queue.length ? payload.queue.map(item => `- ${item.clientName} · ${item.reactivation.label} · ${formatCurrency(item.reactivation.recoverableValue || 0)} recoverable · assigned ${item.assignedAeName}`) : ['- No reactivation queue is currently open.'])
  ].join('
');
  return download('ae-reactivation-command-brief.md', md, 'text/markdown');
}

function exportReactivationBrief(clientId, format = 'json') {
  const brief = buildReactivationBrief(clientId);
  if (!brief) return null;
  if (format === 'json') return download('ae-reactivation-brief.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    '# AE Reactivation Brief',
    '',
    `Generated: ${brief.generatedAt}`,
    '',
    '## Client',
    `- Name: ${brief.client.name}`,
    `- Company: ${brief.client.company || 'No company'}`,
    `- Stage: ${brief.client.stage}`,
    `- Priority: ${brief.client.priority}`,
    `- Follow-up date: ${brief.client.followUpDate || 'Not set'}`,
    `- Last contact: ${brief.client.lastContactAt || 'Not recorded'}`,
    `- Monthly value: ${formatCurrency(brief.client.monthlyValue || 0)}`,
    `- Estimated value: ${formatCurrency(brief.client.estimatedValue || 0)}`,
    '',
    '## Reactivation state',
    `- Status: ${brief.reactivation.label}`,
    `- Score: ${brief.reactivation.score}`,
    `- Recoverable value: ${formatCurrency(brief.reactivation.recoverableValue || 0)}`,
    '',
    '## Opener',
    brief.opener,
    '',
    '## Rescue steps',
    ...brief.rescueSteps.map(item => `- ${item}`),
    '',
    '## Save levers',
    ...brief.saveLevers.map(item => `- ${item}`)
  ].join('
');
  return download('ae-reactivation-brief.md', md, 'text/markdown');
}

function createReactivationTask(clientId, source = 'reactivation-recovery') {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const title = `Reactivation rescue — ${client.name}`;
  const existing = state.tasks.find(task => String(task.status || 'todo') !== 'done' && String(task.title || '').trim() === title);
  if (existing) return existing;
  const reactivation = getClientReactivationState(client);
  const task = {
    id: uid('task'),
    title,
    dueDate: plusDaysIso(reactivation.status === 'critical' ? 0 : reactivation.status === 'high' ? 1 : 2),
    assignedAeId: client.assignedAeId || '',
    assignedAeName: client.assignedAeName || '',
    clientId: client.id,
    clientName: client.name,
    notes: `Reactivation status: ${reactivation.label} (${reactivation.score})
Recoverable value: ${formatCurrency(reactivation.recoverableValue || 0)}
Reason: ${(reactivation.reasons || []).join(' | ') || 'No reasons captured.'}`,
    status: 'todo',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    dependencyTaskId: '',
    kind: source,
  };
  state.tasks.unshift(task);
  state.reactivationRuns = Array.isArray(state.reactivationRuns) ? state.reactivationRuns : [];
  state.reactivationRuns.unshift({ id: uid('reactivation-run'), createdAt: nowIso(), clientId: client.id, clientName: client.name, action: 'reactivation-task', status: reactivation.status, recoverableValue: reactivation.recoverableValue });
  logClientActivity(client, source, 'Reactivation rescue task created', title);
  state.auditLog.unshift({ id: uid('audit'), kind: source, message: `Reactivation rescue task created for ${client.name}`, at: nowIso() });
  remoteUpsert?.('tasks', task);
  remoteUpsert?.('clients', client);
  persist();
  return task;
}

function getClientHandoffState(client) {
  const confidence = getAssignmentConfidence(client);
  const escalation = getClientEscalationState(client);
  const renewal = getClientRenewalRiskState(client);
  const reactivation = getClientReactivationState(client);
  const openTasks = state.tasks.filter(task => task.clientId === client.id && String(task.status || 'todo') !== 'done').length;
  const openThreads = state.threads.filter(thread => thread.clientId === client.id).length;
  const reasons = [];
  let score = 0;
  if (!client.assignedAeId) { score += 24; reasons.push('Client has no assigned AE owner.'); }
  if (!String(client.nextStep || '').trim()) { score += 18; reasons.push('Next step is missing.'); }
  if (openTasks === 0) { score += 10; reasons.push('No open task is protecting the handoff.'); }
  if (openThreads === 0) { score += 8; reasons.push('No transcript thread is attached to the client.'); }
  if (confidence.status === 'review') { score += 18; reasons.push('Assignment confidence still needs review.'); }
  if (['executive', 'founder'].includes(escalation.level)) { score += 16; reasons.push('Escalation is active during handoff.'); }
  if (['critical', 'high'].includes(renewal.status)) { score += 14; reasons.push('Renewal pressure increases handoff fragility.'); }
  if (['critical', 'high'].includes(reactivation.status)) { score += 14; reasons.push('Reactivation pressure increases handoff fragility.'); }
  const status = score >= 70 ? 'fragile' : score >= 40 ? 'watch' : 'ready';
  const label = status === 'fragile' ? 'Fragile handoff continuity' : status === 'watch' ? 'Watch handoff continuity' : 'Ready handoff continuity';
  return { score, label, status, reasons, openTasks, openThreads, confidence, escalation, renewal, reactivation };
}

function buildClientHandoffPacket(clientId) {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const handoff = getClientHandoffState(client);
  const tasks = state.tasks.filter(task => task.clientId === client.id).slice(0, 6);
  const threads = state.threads.filter(thread => thread.clientId === client.id).slice(0, 4);
  const activities = Array.isArray(client.activityLog) ? client.activityLog.slice(0, 6) : [];
  return {
    generatedAt: nowIso(),
    client: {
      id: client.id,
      name: client.name,
      company: client.company || '',
      stage: client.stage || 'intake',
      priority: client.priority || 'normal',
      needs: client.needs || '',
      nextStep: client.nextStep || '',
      followUpDate: client.followUpDate || '',
      assignedAeId: client.assignedAeId || '',
      assignedAeName: client.assignedAeName || ''
    },
    handoff,
    tasks: tasks.map(task => ({ title: task.title, status: task.status, dueDate: task.dueDate || '' })),
    threads: threads.map(thread => ({ subject: thread.subject || '', state: thread.state || 'open', updatedAt: thread.updatedAt || thread.createdAt || '' })),
    activity: activities,
    checklist: [
      'Confirm visible owner and next checkpoint.',
      'Make sure one open task and one thread are attached to the client.',
      'Carry forward renewal/reactivation pressure notes into the handoff.',
      'Give the receiving AE a direct opener and recovery context.'
    ]
  };
}

function exportClientHandoffPacket(clientId, format = 'json') {
  const packet = buildClientHandoffPacket(clientId);
  if (!packet) return null;
  if (format === 'json') return download('ae-client-handoff-packet.json', JSON.stringify(packet, null, 2), 'application/json');
  const md = [
    '# AE Client Handoff Packet',
    '',
    `Generated: ${packet.generatedAt}`,
    '',
    '## Client',
    `- Name: ${packet.client.name}`,
    `- Company: ${packet.client.company || 'No company'}`,
    `- Stage: ${packet.client.stage}`,
    `- Priority: ${packet.client.priority}`,
    `- Assigned AE: ${packet.client.assignedAeName || 'Unassigned'}`,
    `- Next step: ${packet.client.nextStep || 'Not set'}`,
    '',
    '## Handoff continuity',
    `- Status: ${packet.handoff.label}`,
    `- Score: ${packet.handoff.score}`,
    ...packet.handoff.reasons.map(item => `- ${item}`),
    '',
    '## Active tasks',
    ...(packet.tasks.length ? packet.tasks.map(item => `- ${item.title} · ${item.status} · due ${item.dueDate || 'not set'}`) : ['- No client tasks attached.']),
    '',
    '## Transcript threads',
    ...(packet.threads.length ? packet.threads.map(item => `- ${item.subject || 'Untitled thread'} · ${item.state}`) : ['- No client threads attached.']),
    '',
    '## Handoff checklist',
    ...packet.checklist.map(item => `- ${item}`)
  ].join('
');
  return download('ae-client-handoff-packet.md', md, 'text/markdown');
}

function createHandoffFollowThroughTask(clientId, source = 'handoff-follow-through') {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const title = `Handoff follow-through — ${client.name}`;
  const existing = state.tasks.find(task => String(task.status || 'todo') !== 'done' && String(task.title || '').trim() === title);
  if (existing) return existing;
  const handoff = getClientHandoffState(client);
  const task = {
    id: uid('task'),
    title,
    dueDate: plusDaysIso(handoff.status === 'fragile' ? 0 : handoff.status === 'watch' ? 1 : 2),
    assignedAeId: client.assignedAeId || '',
    assignedAeName: client.assignedAeName || '',
    clientId: client.id,
    clientName: client.name,
    notes: `Handoff continuity: ${handoff.label} (${handoff.score})
Reasons: ${(handoff.reasons || []).join(' | ') || 'No reasons captured.'}
Checklist: confirm owner, next step, thread, and follow-through tasking.`,
    status: 'todo',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    dependencyTaskId: '',
    kind: source,
  };
  state.tasks.unshift(task);
  state.handoffRuns = Array.isArray(state.handoffRuns) ? state.handoffRuns : [];
  state.handoffRuns.unshift({ id: uid('handoff-run'), createdAt: nowIso(), clientId: client.id, clientName: client.name, action: 'handoff-follow-through', status: handoff.status, score: handoff.score });
  logClientActivity(client, source, 'Handoff follow-through task created', title);
  state.auditLog.unshift({ id: uid('audit'), kind: source, message: `Handoff follow-through task created for ${client.name}`, at: nowIso() });
  remoteUpsert?.('tasks', task);
  remoteUpsert?.('clients', client);
  persist();
  return task;
}

function buildHandoffCommandDeck() {
  const queue = (state.clients || [])
    .map(client => ({ client, handoff: getClientHandoffState(client) }))
    .filter(row => ['fragile', 'watch'].includes(row.handoff.status))
    .sort((a, b) => (b.handoff.score - a.handoff.score) || (getClientEstimatedValue(b.client) - getClientEstimatedValue(a.client)))
    .slice(0, 8);
  return {
    generatedAt: nowIso(),
    summary: {
      fragile: queue.filter(row => row.handoff.status === 'fragile').length,
      watch: queue.filter(row => row.handoff.status === 'watch').length,
      total: queue.length,
      openTasks: queue.reduce((sum, row) => sum + Number(row.handoff.openTasks || 0), 0)
    },
    queue
  };
}

function exportHandoffCommandBrief(format = 'json') {
  const deck = buildHandoffCommandDeck();
  const payload = {
    generatedAt: deck.generatedAt,
    summary: deck.summary,
    queue: deck.queue.map(row => ({
      clientId: row.client.id,
      clientName: row.client.name,
      assignedAeName: row.client.assignedAeName || 'Unassigned',
      handoff: row.handoff
    }))
  };
  if (format === 'json') return download('ae-handoff-command-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# AE Handoff Continuity Brief',
    '',
    `Generated: ${payload.generatedAt}`,
    '',
    `- Fragile: ${payload.summary.fragile}`,
    `- Watch: ${payload.summary.watch}`,
    `- Total queued: ${payload.summary.total}`,
    `- Open tasks across queued clients: ${payload.summary.openTasks}`,
    '',
    '## Queue',
    ...(payload.queue.length ? payload.queue.map(item => `- ${item.clientName} · ${item.handoff.label} · assigned ${item.assignedAeName} · score ${item.handoff.score}`) : ['- No handoff continuity queue is currently open.'])
  ].join('
');
  return download('ae-handoff-command-brief.md', md, 'text/markdown');
}

function runCommandRecoverySweep(limit = 6) {
  const actions = [];
  const escalationTarget = getEscalationQueue(1)[0];
  if (escalationTarget && actions.length < limit) {
    const task = createEscalationRescueTask(escalationTarget.client.id, 'command-recovery-sweep');
    if (task) actions.push({ kind: 'escalation', target: escalationTarget.client.name, taskId: task.id });
  }
  const renewalTarget = buildRenewalCommandDeck().queue[0];
  if (renewalTarget && actions.length < limit) {
    const task = createRenewalRescueTask(renewalTarget.client.id, 'command-recovery-sweep');
    if (task) actions.push({ kind: 'renewal', target: renewalTarget.client.name, taskId: task.id });
  }
  const reactivationTarget = buildReactivationCommandDeck().queue[0];
  if (reactivationTarget && actions.length < limit) {
    const task = createReactivationTask(reactivationTarget.client.id, 'command-recovery-sweep');
    if (task) actions.push({ kind: 'reactivation', target: reactivationTarget.client.name, taskId: task.id });
  }
  const coverageTarget = buildAeCoveragePressureDeck().queue[0];
  if (coverageTarget && actions.length < limit) {
    const task = createCoverageReliefTask(coverageTarget.ae.id, 'command-recovery-sweep');
    if (task) actions.push({ kind: 'coverage', target: coverageTarget.ae.name, taskId: task.id });
  }
  const handoffTarget = buildHandoffCommandDeck().queue[0];
  if (handoffTarget && actions.length < limit) {
    const task = createHandoffFollowThroughTask(handoffTarget.client.id, 'command-recovery-sweep');
    if (task) actions.push({ kind: 'handoff', target: handoffTarget.client.name, taskId: task.id });
  }
  const run = { id: uid('macro-run'), createdAt: nowIso(), kind: 'command-recovery-sweep', actions };
  state.macroRuns = Array.isArray(state.macroRuns) ? state.macroRuns : [];
  state.macroRuns.unshift(run);
  state.auditLog.unshift({ id: uid('audit'), kind: 'command-recovery-sweep', message: `Command recovery sweep ran ${actions.length} actions`, at: nowIso() });
  persist();
  return run;
}

function renderReactivationCommandCard() {
  const deck = buildReactivationCommandDeck();
  return `<div class="card"><div class="eyebrow">Reactivation command</div><h3>Dormant revenue, stale follow-up, and recovery pressure</h3><div class="toolbar"><button class="btn-soft" id="export-reactivation-brief-json">Reactivation JSON</button><button class="btn-soft" id="export-reactivation-brief-md">Reactivation MD</button></div><div class="tag-row"><span class="tag">Critical ${deck.summary.critical}</span><span class="tag">High ${deck.summary.high}</span><span class="tag">Watch ${deck.summary.watch}</span><span class="tag">Recoverable ${formatCurrency(deck.summary.recoverableValue || 0)}</span></div><div class="list">${deck.queue.length ? deck.queue.map(row => `<div class="item"><h4>${escapeHtml(row.client.name)}</h4><div class="meta">${escapeHtml(row.reactivation.label)} · ${escapeHtml(row.assignedAeName)} · ${formatCurrency(row.reactivation.recoverableValue || 0)} recoverable</div><p>${escapeHtml((row.reactivation.reasons || []).slice(0, 2).join(' '))}</p><div class="toolbar"><button class="btn-soft" data-act="reactivation-open-client" data-id="${row.client.id}">Open client</button><button class="btn-soft" data-act="reactivation-export" data-id="${row.client.id}" data-format="markdown">Brief MD</button><button class="btn-soft" data-act="reactivation-task" data-id="${row.client.id}">Create rescue task</button></div></div>`).join('') : '<div class="item"><div class="meta">No reactivation queue is currently open.</div></div>'}</div></div>`;
}

function renderHandoffCommandCard() {
  const deck = buildHandoffCommandDeck();
  return `<div class="card"><div class="eyebrow">Handoff continuity</div><h3>Transfer packets, fragile handoffs, and recovery sweep</h3><div class="toolbar"><button class="btn-soft" id="run-command-recovery-sweep">Run command recovery sweep</button><button class="btn-soft" id="export-handoff-brief-json">Handoff JSON</button><button class="btn-soft" id="export-handoff-brief-md">Handoff MD</button></div><div class="tag-row"><span class="tag">Fragile ${deck.summary.fragile}</span><span class="tag">Watch ${deck.summary.watch}</span><span class="tag">Queued ${deck.summary.total}</span><span class="tag">Open tasks ${deck.summary.openTasks}</span></div><div class="list">${deck.queue.length ? deck.queue.map(row => `<div class="item"><h4>${escapeHtml(row.client.name)}</h4><div class="meta">${escapeHtml(row.handoff.label)} · assigned ${escapeHtml(row.client.assignedAeName || 'Unassigned')} · score ${row.handoff.score}</div><p>${escapeHtml((row.handoff.reasons || []).slice(0, 2).join(' '))}</p><div class="toolbar"><button class="btn-soft" data-act="handoff-open-client" data-id="${row.client.id}">Open client</button><button class="btn-soft" data-act="handoff-export" data-id="${row.client.id}" data-format="markdown">Packet MD</button><button class="btn-soft" data-act="handoff-task" data-id="${row.client.id}">Create follow-through</button></div></div>`).join('') : '<div class="item"><div class="meta">No handoff continuity queue is currently open.</div></div>'}</div></div>`;
}

const __v43BaseRenderDashboard = renderDashboard;
renderDashboard = function() {
  return __v43BaseRenderDashboard() + `<section class="grid two">${renderReactivationCommandCard()}${renderHandoffCommandCard()}</section>`;
};

const __v43BaseBindDashboard = bindDashboard;
bindDashboard = function() {
  __v43BaseBindDashboard();
  $('#export-reactivation-brief-json')?.addEventListener('click', () => exportReactivationCommandBrief('json'));
  $('#export-reactivation-brief-md')?.addEventListener('click', () => exportReactivationCommandBrief('markdown'));
  $('#export-handoff-brief-json')?.addEventListener('click', () => exportHandoffCommandBrief('json'));
  $('#export-handoff-brief-md')?.addEventListener('click', () => exportHandoffCommandBrief('markdown'));
  $('#run-command-recovery-sweep')?.addEventListener('click', () => { runCommandRecoverySweep(6); render(); });
  document.querySelectorAll('[data-act="reactivation-open-client"]').forEach(btn => btn.addEventListener('click', () => { page = 'clients'; render(); renderClientHistory(btn.dataset.id, true); }));
  document.querySelectorAll('[data-act="reactivation-export"]').forEach(btn => btn.addEventListener('click', () => exportReactivationBrief(btn.dataset.id, btn.dataset.format || 'json')));
  document.querySelectorAll('[data-act="reactivation-task"]').forEach(btn => btn.addEventListener('click', () => { createReactivationTask(btn.dataset.id); render(); }));
  document.querySelectorAll('[data-act="handoff-open-client"]').forEach(btn => btn.addEventListener('click', () => { page = 'clients'; render(); renderClientHistory(btn.dataset.id, true); }));
  document.querySelectorAll('[data-act="handoff-export"]').forEach(btn => btn.addEventListener('click', () => exportClientHandoffPacket(btn.dataset.id, btn.dataset.format || 'json')));
  document.querySelectorAll('[data-act="handoff-task"]').forEach(btn => btn.addEventListener('click', () => { createHandoffFollowThroughTask(btn.dataset.id); render(); }));
};

const __v43BaseRenderClientHistory = renderClientHistory;
renderClientHistory = function(clientId, openInForm = false) {
  __v43BaseRenderClientHistory(clientId, openInForm);
  const client = state.clients.find(item => item.id === clientId);
  const panel = $('#client-history-panel');
  if (!client || !panel) return;
  const reactivationBrief = buildReactivationBrief(client.id);
  const handoffPacket = buildClientHandoffPacket(client.id);
  const insertion = `${reactivationBrief ? `<div class="item"><div class="eyebrow">Reactivation brief preview</div><div class="meta">${escapeHtml(reactivationBrief.reactivation.label)} · ${formatCurrency(reactivationBrief.reactivation.recoverableValue || 0)} recoverable</div><div class="meta">${escapeHtml(reactivationBrief.opener)}</div><div class="toolbar"><button class="btn-soft" id="export-reactivation-client-json">Reactivation JSON</button><button class="btn-soft" id="export-reactivation-client-md">Reactivation MD</button><button class="btn-soft" id="create-reactivation-task">Create reactivation task</button></div></div>` : ''}${handoffPacket ? `<div class="item"><div class="eyebrow">Client handoff packet preview</div><div class="meta">${escapeHtml(handoffPacket.handoff.label)} · score ${handoffPacket.handoff.score}</div><div class="meta">${escapeHtml(handoffPacket.checklist[0] || 'Confirm visible owner and next checkpoint.')}</div><div class="toolbar"><button class="btn-soft" id="export-handoff-client-json">Handoff JSON</button><button class="btn-soft" id="export-handoff-client-md">Handoff MD</button><button class="btn-soft" id="create-handoff-task">Create handoff task</button></div></div>` : ''}`;
  if (insertion && !panel.innerHTML.includes('Reactivation brief preview') && !panel.innerHTML.includes('Client handoff packet preview')) {
    panel.innerHTML = panel.innerHTML.replace('<div class="item"><div class="eyebrow">Recommended actions</div>', insertion + '<div class="item"><div class="eyebrow">Recommended actions</div>');
  }
  $('#export-reactivation-client-json')?.addEventListener('click', () => exportReactivationBrief(client.id, 'json'));
  $('#export-reactivation-client-md')?.addEventListener('click', () => exportReactivationBrief(client.id, 'markdown'));
  $('#create-reactivation-task')?.addEventListener('click', () => { createReactivationTask(client.id, 'client-reactivation-rescue'); render(); renderClientHistory(client.id, true); });
  $('#export-handoff-client-json')?.addEventListener('click', () => exportClientHandoffPacket(client.id, 'json'));
  $('#export-handoff-client-md')?.addEventListener('click', () => exportClientHandoffPacket(client.id, 'markdown'));
  $('#create-handoff-task')?.addEventListener('click', () => { createHandoffFollowThroughTask(client.id, 'client-handoff-follow-through'); render(); renderClientHistory(client.id, true); });
};

renderDirectiveText();
init();
render();


function buildPromiseIntegrityCommandDeck() {
  const summary = buildPromiseIntegritySummary(state.clients || [], state.tasks || [], state.threads || []);
  const queue = (summary.rows || [])
    .filter(row => ['critical', 'high', 'watch'].includes(row.promise.status))
    .sort((a, b) => (b.promise.score - a.promise.score) || (Number(b.promise.exposedValue || 0) - Number(a.promise.exposedValue || 0)))
    .slice(0, 8)
    .map(row => ({ ...row, assignedAeName: row.client.assignedAeName || 'Unassigned' }));
  return { generatedAt: summary.generatedAt, summary: { critical: summary.critical, high: summary.high, watch: summary.watch, exposedValue: summary.exposedValue, total: queue.length }, queue };
}

function buildServiceRecoveryBrief(clientId) {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const promise = getClientPromiseIntegrityState(client, state.tasks || [], state.threads || []);
  const overdueTasks = (state.tasks || []).filter(task => String(task.clientId || '') === String(client.id) && String(task.status || 'todo') !== 'done').filter(task => {
    const delta = getDaysDelta(task.dueDate || '', nowIso().slice(0, 10));
    return delta !== null && delta < 0;
  });
  const staleThreads = (state.threads || []).filter(thread => String(thread.clientId || '') === String(client.id)).filter(thread => {
    const raw = String(thread.updatedAt || thread.createdAt || '').trim();
    if (!raw) return true;
    const deltaRaw = getDaysDelta(raw, nowIso().slice(0, 10));
    const delta = deltaRaw === null ? null : Math.abs(deltaRaw);
    return delta === null || delta >= 7;
  });
  return {
    generatedAt: nowIso(),
    client: {
      id: client.id,
      name: client.name,
      company: client.company || '',
      assignedAeName: client.assignedAeName || 'Unassigned',
      stage: client.stage || 'intake',
      priority: client.priority || 'normal',
      monthlyValue: getClientMonthlyValue(client),
      estimatedValue: getClientEstimatedValue(client)
    },
    promise,
    opener: `Own the miss quickly with ${client.name}, give one visible recovery checkpoint, and confirm who is carrying it before the conversation ends.`,
    recoveryMoves: [
      `Reset the next checkpoint within ${promise.status === 'critical' ? '24 hours' : promise.status === 'high' ? '48 hours' : '72 hours'}.`,
      overdueTasks.length ? `Close or re-date ${overdueTasks.length} overdue task(s) before promising anything new.` : 'Confirm all open tasks are sequenced against the next promise.',
      staleThreads.length ? `Reply into ${staleThreads.length} stale thread(s) with one owner and one date.` : 'Keep the active thread warm with a written recap.',
      client.monthlyValue ? `Protect recurring value lane worth ${formatCurrency(getClientMonthlyValue(client) * 2)} over the next 60 days.` : 'Protect the weighted opportunity before trust decays further.'
    ],
    compensationLevers: [
      'Priority execution window on the next checkpoint.',
      'Direct founder/executive visibility if the account remains unstable.',
      'Written recovery summary with visible owner and date.',
      'Goodwill gesture only if timeline or quality actually slipped.'
    ],
    overdueTasks: overdueTasks.map(task => ({ title: task.title, dueDate: task.dueDate || '', status: task.status || 'todo' })),
    staleThreads: staleThreads.map(thread => ({ subject: thread.subject || 'Untitled thread', state: thread.state || 'open', updatedAt: thread.updatedAt || thread.createdAt || '' }))
  };
}

function exportPromiseIntegrityCommandBrief(format = 'json') {
  const deck = buildPromiseIntegrityCommandDeck();
  const payload = {
    generatedAt: deck.generatedAt,
    summary: deck.summary,
    queue: deck.queue.map(row => ({
      clientId: row.client.id,
      clientName: row.client.name,
      assignedAeName: row.assignedAeName,
      promise: row.promise
    }))
  };
  if (format === 'json') return download('ae-promise-integrity-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# AE Promise Integrity Brief',
    '',
    `Generated: ${payload.generatedAt}`,
    '',
    `- Critical: ${payload.summary.critical}`,
    `- High: ${payload.summary.high}`,
    `- Watch: ${payload.summary.watch}`,
    `- Exposed value: ${formatCurrency(payload.summary.exposedValue || 0)}`,
    '',
    '## Queue',
    ...(payload.queue.length ? payload.queue.map(item => `- ${item.clientName} · ${item.promise.label} · assigned ${item.assignedAeName} · ${formatCurrency(item.promise.exposedValue || 0)} exposed`) : ['- No promise-integrity queue is currently open.'])
  ].join('
');
  return download('ae-promise-integrity-brief.md', md, 'text/markdown');
}

function exportServiceRecoveryBrief(clientId, format = 'json') {
  const brief = buildServiceRecoveryBrief(clientId);
  if (!brief) return null;
  if (format === 'json') return download('ae-service-recovery-brief.json', JSON.stringify(brief, null, 2), 'application/json');
  const md = [
    '# AE Service Recovery Brief',
    '',
    `Generated: ${brief.generatedAt}`,
    '',
    '## Client',
    `- Name: ${brief.client.name}`,
    `- Company: ${brief.client.company || 'No company'}`,
    `- Assigned AE: ${brief.client.assignedAeName}`,
    `- Stage: ${brief.client.stage}`,
    `- Priority: ${brief.client.priority}`,
    `- Monthly value: ${formatCurrency(brief.client.monthlyValue || 0)}`,
    `- Estimated value: ${formatCurrency(brief.client.estimatedValue || 0)}`,
    '',
    '## Promise integrity',
    `- Status: ${brief.promise.label}`,
    `- Score: ${brief.promise.score}`,
    `- Exposed value: ${formatCurrency(brief.promise.exposedValue || 0)}`,
    ...(brief.promise.reasons || []).map(item => `- ${item}`),
    '',
    '## Recovery opener',
    `- ${brief.opener}`,
    '',
    '## Recovery moves',
    ...brief.recoveryMoves.map(item => `- ${item}`),
    '',
    '## Compensation levers',
    ...brief.compensationLevers.map(item => `- ${item}`),
    '',
    '## Overdue tasks',
    ...(brief.overdueTasks.length ? brief.overdueTasks.map(item => `- ${item.title} · due ${item.dueDate || 'not set'} · ${item.status}`) : ['- No overdue tasks are attached.']),
    '',
    '## Stale threads',
    ...(brief.staleThreads.length ? brief.staleThreads.map(item => `- ${item.subject} · ${item.state} · updated ${item.updatedAt || 'not set'}`) : ['- No stale client threads are attached.'])
  ].join('
');
  return download('ae-service-recovery-brief.md', md, 'text/markdown');
}

function createServiceRecoveryTask(clientId, source = 'service-recovery') {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const title = `Service recovery — ${client.name}`;
  const existing = state.tasks.find(task => String(task.status || 'todo') !== 'done' && String(task.title || '').trim() === title);
  if (existing) return existing;
  const brief = buildServiceRecoveryBrief(clientId);
  const task = {
    id: uid('task'),
    title,
    dueDate: plusDaysIso(brief.promise.status === 'critical' ? 0 : brief.promise.status === 'high' ? 1 : 2),
    assignedAeId: client.assignedAeId || '',
    assignedAeName: client.assignedAeName || '',
    clientId: client.id,
    clientName: client.name,
    notes: `Promise integrity: ${brief.promise.label} (${brief.promise.score})
Exposed value: ${formatCurrency(brief.promise.exposedValue || 0)}
Recovery opener: ${brief.opener}
Moves: ${(brief.recoveryMoves || []).join(' | ')}`,
    status: 'todo',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    dependencyTaskId: '',
    kind: source,
  };
  state.tasks.unshift(task);
  state.serviceRecoveryRuns = Array.isArray(state.serviceRecoveryRuns) ? state.serviceRecoveryRuns : [];
  state.serviceRecoveryRuns.unshift({ id: uid('service-recovery-run'), createdAt: nowIso(), clientId: client.id, clientName: client.name, action: source, status: brief.promise.status, exposedValue: brief.promise.exposedValue });
  logClientActivity(client, source, 'Service recovery task created', title);
  state.auditLog.unshift({ id: uid('audit'), kind: source, message: `Service recovery task created for ${client.name}`, at: nowIso() });
  remoteUpsert?.('tasks', task);
  remoteUpsert?.('clients', client);
  persist();
  return task;
}

function buildAePromiseLoadDeck() {
  const summary = buildAePromiseLoadSummary(state.aeProfiles || [], state.clients || [], state.tasks || [], state.threads || []);
  const rows = (summary.rows || []).filter(row => ['critical', 'high', 'watch'].includes(row.status)).sort((a, b) => (b.score - a.score) || (Number(b.exposedValue || 0) - Number(a.exposedValue || 0))).slice(0, 8);
  return { generatedAt: summary.generatedAt, summary: { critical: summary.critical, high: summary.high, watch: summary.watch, exposedValue: summary.exposedValue, total: rows.length }, rows };
}

function exportAePromiseLoadBrief(format = 'json') {
  const deck = buildAePromiseLoadDeck();
  const payload = {
    generatedAt: deck.generatedAt,
    summary: deck.summary,
    rows: deck.rows.map(row => ({ aeId: row.ae.id, aeName: row.ae.name, status: row.status, score: row.score, criticalClients: row.criticalClients, highClients: row.highClients, overdueTasks: row.overdueTasks, exposedValue: row.exposedValue }))
  };
  if (format === 'json') return download('ae-promise-load-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# AE Promise Load Brief',
    '',
    `Generated: ${payload.generatedAt}`,
    '',
    `- Critical AEs: ${payload.summary.critical}`,
    `- High AEs: ${payload.summary.high}`,
    `- Watch AEs: ${payload.summary.watch}`,
    `- Exposed value: ${formatCurrency(payload.summary.exposedValue || 0)}`,
    '',
    '## AE pressure rows',
    ...(payload.rows.length ? payload.rows.map(item => `- ${item.aeName} · ${item.status} · score ${item.score} · critical clients ${item.criticalClients} · overdue tasks ${item.overdueTasks} · exposed ${formatCurrency(item.exposedValue || 0)}`) : ['- No AE promise load rows are currently open.'])
  ].join('
');
  return download('ae-promise-load-brief.md', md, 'text/markdown');
}

function runPromiseRecoverySweep(limit = 5) {
  const deck = buildPromiseIntegrityCommandDeck();
  const actions = [];
  for (const row of deck.queue) {
    if (actions.length >= limit) break;
    const task = createServiceRecoveryTask(row.client.id, 'promise-recovery-sweep');
    if (task) actions.push({ clientId: row.client.id, clientName: row.client.name, taskId: task.id, status: row.promise.status, exposedValue: row.promise.exposedValue });
  }
  const run = { id: uid('promise-run'), createdAt: nowIso(), kind: 'promise-recovery-sweep', actions, summary: deck.summary };
  state.promiseRuns = Array.isArray(state.promiseRuns) ? state.promiseRuns : [];
  state.promiseRuns.unshift(run);
  state.auditLog.unshift({ id: uid('audit'), kind: 'promise-recovery-sweep', message: `Promise recovery sweep ran ${actions.length} actions`, at: nowIso() });
  persist();
  return run;
}

function renderPromiseIntegrityCommandCard() {
  const deck = buildPromiseIntegrityCommandDeck();
  return `<div class="card"><div class="eyebrow">Promise integrity</div><h3>Service promises, breach risk, and recovery execution</h3><div class="toolbar"><button class="btn-soft" id="export-promise-brief-json">Promise JSON</button><button class="btn-soft" id="export-promise-brief-md">Promise MD</button><button class="btn-soft" id="run-promise-recovery-sweep">Run promise recovery sweep</button></div><div class="tag-row"><span class="tag">Critical ${deck.summary.critical}</span><span class="tag">High ${deck.summary.high}</span><span class="tag">Watch ${deck.summary.watch}</span><span class="tag">Exposed ${formatCurrency(deck.summary.exposedValue || 0)}</span></div><div class="list">${deck.queue.length ? deck.queue.map(row => `<div class="item"><h4>${escapeHtml(row.client.name)}</h4><div class="meta">${escapeHtml(row.promise.label)} · ${escapeHtml(row.assignedAeName)} · ${formatCurrency(row.promise.exposedValue || 0)} exposed</div><p>${escapeHtml((row.promise.reasons || []).slice(0, 2).join(' '))}</p><div class="toolbar"><button class="btn-soft" data-act="promise-open-client" data-id="${row.client.id}">Open client</button><button class="btn-soft" data-act="promise-export" data-id="${row.client.id}" data-format="markdown">Recovery MD</button><button class="btn-soft" data-act="promise-task" data-id="${row.client.id}">Create recovery task</button></div></div>`).join('') : '<div class="item"><div class="meta">No promise-integrity queue is currently open.</div></div>'}</div></div>`;
}

function renderAePromiseLoadCard() {
  const deck = buildAePromiseLoadDeck();
  return `<div class="card"><div class="eyebrow">AE promise load</div><h3>AE-by-AE trust exposure, overdue work, and pressure summary</h3><div class="toolbar"><button class="btn-soft" id="export-promise-load-json">Promise load JSON</button><button class="btn-soft" id="export-promise-load-md">Promise load MD</button></div><div class="tag-row"><span class="tag">Critical ${deck.summary.critical}</span><span class="tag">High ${deck.summary.high}</span><span class="tag">Watch ${deck.summary.watch}</span><span class="tag">Exposed ${formatCurrency(deck.summary.exposedValue || 0)}</span></div><div class="table-wrap"><table><thead><tr><th>AE</th><th>Status</th><th>Critical clients</th><th>High clients</th><th>Overdue tasks</th><th>Exposed value</th></tr></thead><tbody>${deck.rows.length ? deck.rows.map(row => `<tr><td>${escapeHtml(row.ae.name)}</td><td><span class="tag">${escapeHtml(row.label)}</span></td><td>${row.criticalClients}</td><td>${row.highClients}</td><td>${row.overdueTasks}</td><td>${formatCurrency(row.exposedValue || 0)}</td></tr>`).join('') : '<tr><td colspan="6">No AE promise load rows are currently open.</td></tr>'}</tbody></table></div></div>`;
}

const __v44BaseRenderDashboard = renderDashboard;
renderDashboard = function() {
  return __v44BaseRenderDashboard() + `<section class="grid two">${renderPromiseIntegrityCommandCard()}${renderAePromiseLoadCard()}</section>`;
};

const __v44BaseBindDashboard = bindDashboard;
bindDashboard = function() {
  __v44BaseBindDashboard();
  $('#export-promise-brief-json')?.addEventListener('click', () => exportPromiseIntegrityCommandBrief('json'));
  $('#export-promise-brief-md')?.addEventListener('click', () => exportPromiseIntegrityCommandBrief('markdown'));
  $('#export-promise-load-json')?.addEventListener('click', () => exportAePromiseLoadBrief('json'));
  $('#export-promise-load-md')?.addEventListener('click', () => exportAePromiseLoadBrief('markdown'));
  $('#run-promise-recovery-sweep')?.addEventListener('click', () => { runPromiseRecoverySweep(5); render(); });
  document.querySelectorAll('[data-act="promise-open-client"]').forEach(btn => btn.addEventListener('click', () => { page = 'clients'; render(); renderClientHistory(btn.dataset.id, true); }));
  document.querySelectorAll('[data-act="promise-export"]').forEach(btn => btn.addEventListener('click', () => exportServiceRecoveryBrief(btn.dataset.id, btn.dataset.format || 'json')));
  document.querySelectorAll('[data-act="promise-task"]').forEach(btn => btn.addEventListener('click', () => { createServiceRecoveryTask(btn.dataset.id); render(); }));
};

const __v44BaseRenderClientHistory = renderClientHistory;
renderClientHistory = function(clientId, openInForm = false) {
  __v44BaseRenderClientHistory(clientId, openInForm);
  const client = state.clients.find(item => item.id === clientId);
  const panel = $('#client-history-panel');
  if (!client || !panel) return;
  const brief = buildServiceRecoveryBrief(client.id);
  const insertion = `${brief ? `<div class="item"><div class="eyebrow">Service recovery brief preview</div><div class="meta">${escapeHtml(brief.promise.label)} · ${formatCurrency(brief.promise.exposedValue || 0)} exposed</div><div class="meta">${escapeHtml(brief.opener)}</div><div class="toolbar"><button class="btn-soft" id="export-service-recovery-json">Recovery JSON</button><button class="btn-soft" id="export-service-recovery-md">Recovery MD</button><button class="btn-soft" id="create-service-recovery-task">Create service recovery task</button></div></div>` : ''}`;
  if (insertion && !panel.innerHTML.includes('Service recovery brief preview')) {
    panel.innerHTML = panel.innerHTML.replace('<div class="item"><div class="eyebrow">Recommended actions</div>', insertion + '<div class="item"><div class="eyebrow">Recommended actions</div>');
  }
  $('#export-service-recovery-json')?.addEventListener('click', () => exportServiceRecoveryBrief(client.id, 'json'));
  $('#export-service-recovery-md')?.addEventListener('click', () => exportServiceRecoveryBrief(client.id, 'markdown'));
  $('#create-service-recovery-task')?.addEventListener('click', () => { createServiceRecoveryTask(client.id, 'client-service-recovery'); render(); renderClientHistory(client.id, true); });
};


function buildChurnDefenseCommandDeck() {
  const summary = buildChurnRiskSummary(state.clients || [], state.tasks || [], state.threads || []);
  const queue = (summary.rows || [])
    .filter(row => ['critical', 'high', 'watch'].includes(row.churn.status))
    .sort((a, b) => (b.churn.score - a.churn.score) || (Number(b.churn.exposedValue || 0) - Number(a.churn.exposedValue || 0)))
    .slice(0, 8)
    .map(row => ({ ...row, assignedAeName: row.client.assignedAeName || 'Unassigned' }));
  return { generatedAt: summary.generatedAt, summary: { critical: summary.critical, high: summary.high, watch: summary.watch, exposedValue: summary.exposedValue, total: queue.length }, queue };
}

function exportChurnDefenseBrief(format = 'json') {
  const deck = buildChurnDefenseCommandDeck();
  const payload = {
    generatedAt: deck.generatedAt,
    summary: deck.summary,
    queue: deck.queue.map(row => ({
      clientId: row.client.id,
      clientName: row.client.name,
      assignedAeId: row.client.assignedAeId || '',
      assignedAeName: row.assignedAeName,
      churn: row.churn
    }))
  };
  if (format === 'json') return download('ae-churn-defense-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# AE Churn Defense Brief',
    '',
    `Generated: ${payload.generatedAt}`,
    '',
    `- Critical: ${payload.summary.critical}`,
    `- High: ${payload.summary.high}`,
    `- Watch: ${payload.summary.watch}`,
    `- Exposed value: ${formatCurrency(payload.summary.exposedValue || 0)}`,
    '',
    '## Churn queue',
    ...(payload.queue.length ? payload.queue.map(item => `- ${item.clientName} · ${item.churn.label} · ${item.assignedAeName} · exposed ${formatCurrency(item.churn.exposedValue || 0)} · ${item.churn.saveWindow}`) : ['- No churn-defense queue is currently open.'])
  ].join('
');
  return download('ae-churn-defense-brief.md', md, 'text/markdown');
}

function buildExecutiveSavePlan(clientId) {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const churn = getClientChurnRiskState(client, state.tasks || [], state.threads || []);
  const overdueTasks = (state.tasks || []).filter(task => String(task.clientId || '') === String(client.id) && String(task.status || 'todo') !== 'done').filter(task => {
    const delta = getDaysDelta(task.dueDate || '', nowIso().slice(0, 10));
    return delta !== null && delta < 0;
  });
  const staleThreads = (state.threads || []).filter(thread => String(thread.clientId || '') === String(client.id)).filter(thread => {
    const raw = String(thread.updatedAt || thread.createdAt || '').trim();
    if (!raw) return true;
    const deltaRaw = getDaysDelta(raw, nowIso().slice(0, 10));
    const delta = deltaRaw === null ? null : Math.abs(deltaRaw);
    return delta === null || delta >= 8;
  });
  const opener = churn.status === 'critical'
    ? `I want to address the friction directly and put an executive save plan around ${client.name}'s account today.`
    : churn.status === 'high'
      ? `I want to stabilize the account quickly and make the recovery path obvious for ${client.name}.`
      : `I want to reinforce the relationship before risk compounds for ${client.name}.`;
  const saveMoves = [
    'Acknowledge the friction in direct language and confirm ownership.',
    'Reset the next checkpoint with a named owner and visible due date.',
    'Offer one concrete corrective move tied to the account context.',
    churn.status === 'critical' ? 'Bring founder or executive oversight into the save conversation.' : 'Escalate only if the save plan is not accepted within the next checkpoint.'
  ];
  const retentionLevers = [
    Number(client.monthlyValue || 0) > 0 ? 'Protect recurring revenue by reaffirming immediate next-step ownership.' : 'Re-anchor value around the committed outcome and timing.',
    churn.missingNextStep ? 'Publish a visible next step before the save call ends.' : 'Re-state the current next step and confirm the client accepts it.',
    staleThreads.length ? 'Collapse stale thread drift into one clean executive summary.' : 'Keep the communication lane singular and accountable.'
  ];
  const nextMeetingAgenda = [
    'Name the friction without defensiveness.',
    'Confirm what is being corrected now.',
    'Lock the next milestone and date.',
    'Confirm the single accountable owner.',
    'Close with a written recap and recovery checkpoint.'
  ];
  return {
    generatedAt: nowIso(),
    client: {
      id: client.id,
      name: client.name,
      company: client.company || '',
      assignedAeId: client.assignedAeId || '',
      assignedAeName: client.assignedAeName || '',
      stage: client.stage || '',
      priority: client.priority || '',
      monthlyValue: Number(client.monthlyValue || 0),
      estimatedValue: Number(client.estimatedValue || 0),
      followUpDate: client.followUpDate || '',
      targetCloseDate: client.targetCloseDate || ''
    },
    churn,
    opener,
    saveMoves,
    retentionLevers,
    nextMeetingAgenda,
    overdueTasks: overdueTasks.map(task => ({ id: task.id, title: task.title, dueDate: task.dueDate || '', status: task.status || 'todo' })),
    staleThreads: staleThreads.map(thread => ({ id: thread.id, subject: thread.subject || 'Untitled thread', state: thread.state || 'open', updatedAt: thread.updatedAt || thread.createdAt || '' }))
  };
}

function exportExecutiveSavePlan(clientId, format = 'json') {
  const plan = buildExecutiveSavePlan(clientId);
  if (!plan) return;
  if (format === 'json') return download('ae-executive-save-plan.json', JSON.stringify(plan, null, 2), 'application/json');
  const md = [
    '# AE Executive Save Plan',
    '',
    `Generated: ${plan.generatedAt}`,
    '',
    `- Client: ${plan.client.name}`,
    `- Company: ${plan.client.company || '—'}`,
    `- Assigned AE: ${plan.client.assignedAeName || 'Unassigned'}`,
    `- Churn status: ${plan.churn.label}`,
    `- Exposed value: ${formatCurrency(plan.churn.exposedValue || 0)}`,
    `- Save window: ${plan.churn.saveWindow}`,
    '',
    '## Executive opener',
    plan.opener,
    '',
    '## Save moves',
    ...plan.saveMoves.map(item => `- ${item}`),
    '',
    '## Retention levers',
    ...plan.retentionLevers.map(item => `- ${item}`),
    '',
    '## Next-meeting agenda',
    ...plan.nextMeetingAgenda.map(item => `- ${item}`),
    '',
    '## Overdue tasks',
    ...(plan.overdueTasks.length ? plan.overdueTasks.map(task => `- ${task.title} · due ${task.dueDate || 'unscheduled'}`) : ['- No overdue tasks are attached.']),
    '',
    '## Stale threads',
    ...(plan.staleThreads.length ? plan.staleThreads.map(thread => `- ${thread.subject} · ${thread.state} · ${thread.updatedAt || 'not set'}`) : ['- No stale client threads are attached.'])
  ].join('
');
  return download('ae-executive-save-plan.md', md, 'text/markdown');
}

function createChurnDefenseTask(clientId, source = 'churn-defense') {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const title = `Churn defense — ${client.name}`;
  const existing = state.tasks.find(task => String(task.status || 'todo') !== 'done' && String(task.title || '').trim() === title);
  if (existing) return existing;
  const plan = buildExecutiveSavePlan(clientId);
  const task = {
    id: uid('task'),
    title,
    dueDate: plusDaysIso(plan.churn.status === 'critical' ? 0 : plan.churn.status === 'high' ? 1 : 2),
    assignedAeId: client.assignedAeId || '',
    assignedAeName: client.assignedAeName || '',
    clientId: client.id,
    clientName: client.name,
    notes: `Churn risk: ${plan.churn.label} (${plan.churn.score})
Exposed value: ${formatCurrency(plan.churn.exposedValue || 0)}
Executive opener: ${plan.opener}
Save moves: ${(plan.saveMoves || []).join(' | ')}`,
    status: 'todo',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    dependencyTaskId: '',
    kind: source,
  };
  state.tasks.unshift(task);
  state.savePlanRuns = Array.isArray(state.savePlanRuns) ? state.savePlanRuns : [];
  state.savePlanRuns.unshift({ id: uid('save-plan-run'), createdAt: nowIso(), clientId: client.id, clientName: client.name, action: source, status: plan.churn.status, exposedValue: plan.churn.exposedValue });
  logClientActivity(client, source, 'Churn defense task created', title);
  state.auditLog.unshift({ id: uid('audit'), kind: source, message: `Churn defense task created for ${client.name}`, at: nowIso() });
  remoteUpsert?.('tasks', task);
  remoteUpsert?.('clients', client);
  persist();
  return task;
}

function buildAeChurnExposureDeck() {
  const summary = buildAeChurnExposureSummary(state.aeProfiles || [], state.clients || [], state.tasks || [], state.threads || []);
  const rows = (summary.rows || []).filter(row => ['critical', 'high', 'watch'].includes(row.status)).sort((a, b) => (b.score - a.score) || (Number(b.exposedValue || 0) - Number(a.exposedValue || 0))).slice(0, 8);
  return { generatedAt: summary.generatedAt, summary: { critical: summary.critical, high: summary.high, watch: summary.watch, exposedValue: summary.exposedValue, total: rows.length }, rows };
}

function exportAeChurnExposureBrief(format = 'json') {
  const deck = buildAeChurnExposureDeck();
  const payload = {
    generatedAt: deck.generatedAt,
    summary: deck.summary,
    rows: deck.rows.map(row => ({ aeId: row.ae.id, aeName: row.ae.name, status: row.status, score: row.score, criticalClients: row.criticalClients, highClients: row.highClients, overdueTasks: row.overdueTasks, stalledThreads: row.stalledThreads, exposedValue: row.exposedValue }))
  };
  if (format === 'json') return download('ae-churn-exposure-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# AE Churn Exposure Brief',
    '',
    `Generated: ${payload.generatedAt}`,
    '',
    `- Critical AEs: ${payload.summary.critical}`,
    `- High AEs: ${payload.summary.high}`,
    `- Watch AEs: ${payload.summary.watch}`,
    `- Exposed value: ${formatCurrency(payload.summary.exposedValue || 0)}`,
    '',
    '## AE exposure rows',
    ...(payload.rows.length ? payload.rows.map(item => `- ${item.aeName} · ${item.status} · score ${item.score} · critical clients ${item.criticalClients} · overdue tasks ${item.overdueTasks} · exposed ${formatCurrency(item.exposedValue || 0)}`) : ['- No AE churn exposure rows are currently open.'])
  ].join('
');
  return download('ae-churn-exposure-brief.md', md, 'text/markdown');
}

function runChurnDefenseSweep(limit = 5) {
  const deck = buildChurnDefenseCommandDeck();
  const actions = [];
  for (const row of deck.queue) {
    if (actions.length >= limit) break;
    const task = createChurnDefenseTask(row.client.id, 'churn-defense-sweep');
    if (task) actions.push({ clientId: row.client.id, clientName: row.client.name, taskId: task.id, status: row.churn.status, exposedValue: row.churn.exposedValue });
  }
  const run = { id: uid('churn-run'), createdAt: nowIso(), kind: 'churn-defense-sweep', actions, summary: deck.summary };
  state.churnRuns = Array.isArray(state.churnRuns) ? state.churnRuns : [];
  state.churnRuns.unshift(run);
  state.auditLog.unshift({ id: uid('audit'), kind: 'churn-defense-sweep', message: `Churn defense sweep ran ${actions.length} actions`, at: nowIso() });
  persist();
  return run;
}

function renderChurnDefenseCommandCard() {
  const deck = buildChurnDefenseCommandDeck();
  return `<div class="card"><div class="eyebrow">Churn defense</div><h3>Churn risk queue, exposed revenue, and executive save action</h3><div class="toolbar"><button class="btn-soft" id="export-churn-defense-json">Churn JSON</button><button class="btn-soft" id="export-churn-defense-md">Churn MD</button><button class="btn-soft" id="run-churn-defense-sweep">Run churn defense sweep</button></div><div class="tag-row"><span class="tag">Critical ${deck.summary.critical}</span><span class="tag">High ${deck.summary.high}</span><span class="tag">Watch ${deck.summary.watch}</span><span class="tag">Exposed ${formatCurrency(deck.summary.exposedValue || 0)}</span></div><div class="list">${deck.queue.length ? deck.queue.map(row => `<div class="item"><h4>${escapeHtml(row.client.name)}</h4><div class="meta">${escapeHtml(row.churn.label)} · ${escapeHtml(row.assignedAeName)} · ${formatCurrency(row.churn.exposedValue || 0)} exposed</div><p>${escapeHtml((row.churn.reasons || []).slice(0, 2).join(' '))}</p><div class="toolbar"><button class="btn-soft" data-act="churn-open-client" data-id="${row.client.id}">Open client</button><button class="btn-soft" data-act="churn-export" data-id="${row.client.id}" data-format="markdown">Save MD</button><button class="btn-soft" data-act="churn-task" data-id="${row.client.id}">Create save task</button></div></div>`).join('') : '<div class="item"><div class="meta">No churn-defense queue is currently open.</div></div>'}</div></div>`;
}

function renderAeChurnExposureCard() {
  const deck = buildAeChurnExposureDeck();
  return `<div class="card"><div class="eyebrow">AE churn exposure</div><h3>AE-by-AE retention pressure, stalled communication, and save coverage</h3><div class="toolbar"><button class="btn-soft" id="export-churn-exposure-json">Exposure JSON</button><button class="btn-soft" id="export-churn-exposure-md">Exposure MD</button></div><div class="tag-row"><span class="tag">Critical ${deck.summary.critical}</span><span class="tag">High ${deck.summary.high}</span><span class="tag">Watch ${deck.summary.watch}</span><span class="tag">Exposed ${formatCurrency(deck.summary.exposedValue || 0)}</span></div><div class="table-wrap"><table><thead><tr><th>AE</th><th>Status</th><th>Critical clients</th><th>High clients</th><th>Overdue tasks</th><th>Exposed value</th></tr></thead><tbody>${deck.rows.length ? deck.rows.map(row => `<tr><td>${escapeHtml(row.ae.name)}</td><td><span class="tag">${escapeHtml(row.label)}</span></td><td>${row.criticalClients}</td><td>${row.highClients}</td><td>${row.overdueTasks}</td><td>${formatCurrency(row.exposedValue || 0)}</td></tr>`).join('') : '<tr><td colspan="6">No AE churn exposure rows are currently open.</td></tr>'}</tbody></table></div></div>`;
}

const __v45BaseRenderDashboard = renderDashboard;
renderDashboard = function() {
  return __v45BaseRenderDashboard() + `<section class="grid two">${renderChurnDefenseCommandCard()}${renderAeChurnExposureCard()}</section>`;
};

const __v45BaseBindDashboard = bindDashboard;
bindDashboard = function() {
  __v45BaseBindDashboard();
  $('#export-churn-defense-json')?.addEventListener('click', () => exportChurnDefenseBrief('json'));
  $('#export-churn-defense-md')?.addEventListener('click', () => exportChurnDefenseBrief('markdown'));
  $('#export-churn-exposure-json')?.addEventListener('click', () => exportAeChurnExposureBrief('json'));
  $('#export-churn-exposure-md')?.addEventListener('click', () => exportAeChurnExposureBrief('markdown'));
  $('#run-churn-defense-sweep')?.addEventListener('click', () => { runChurnDefenseSweep(5); render(); });
  document.querySelectorAll('[data-act="churn-open-client"]').forEach(btn => btn.addEventListener('click', () => { page = 'clients'; render(); renderClientHistory(btn.dataset.id, true); }));
  document.querySelectorAll('[data-act="churn-export"]').forEach(btn => btn.addEventListener('click', () => exportExecutiveSavePlan(btn.dataset.id, btn.dataset.format || 'json')));
  document.querySelectorAll('[data-act="churn-task"]').forEach(btn => btn.addEventListener('click', () => { createChurnDefenseTask(btn.dataset.id); render(); }));
};

const __v45BaseRenderClientHistory = renderClientHistory;
renderClientHistory = function(clientId, openInForm = false) {
  __v45BaseRenderClientHistory(clientId, openInForm);
  const client = state.clients.find(item => item.id === clientId);
  const panel = $('#client-history-panel');
  if (!client || !panel) return;
  const plan = buildExecutiveSavePlan(client.id);
  const insertion = `${plan ? `<div class="item"><div class="eyebrow">Executive save plan preview</div><div class="meta">${escapeHtml(plan.churn.label)} · ${formatCurrency(plan.churn.exposedValue || 0)} exposed</div><div class="meta">${escapeHtml(plan.opener)}</div><div class="toolbar"><button class="btn-soft" id="export-executive-save-json">Save JSON</button><button class="btn-soft" id="export-executive-save-md">Save MD</button><button class="btn-soft" id="create-churn-defense-task">Create churn defense task</button></div></div>` : ''}`;
  if (insertion && !panel.innerHTML.includes('Executive save plan preview')) {
    panel.innerHTML = panel.innerHTML.replace('<div class="item"><div class="eyebrow">Recommended actions</div>', insertion + '<div class="item"><div class="eyebrow">Recommended actions</div>');
  }
  $('#export-executive-save-json')?.addEventListener('click', () => exportExecutiveSavePlan(client.id, 'json'));
  $('#export-executive-save-md')?.addEventListener('click', () => exportExecutiveSavePlan(client.id, 'markdown'));
  $('#create-churn-defense-task')?.addEventListener('click', () => { createChurnDefenseTask(client.id, 'client-churn-defense'); render(); renderClientHistory(client.id, true); });
};


function buildOfferCommandDeck() {
  const summary = buildOfferCommandSummary(state.clients || [], state.offerCatalog || []);
  const queue = (summary.rows || [])
    .filter(row => ['hot', 'warm', 'watch'].includes(row.fit.status))
    .sort((a, b) => (b.fit.score - a.fit.score) || (Number(b.fit.totalProjectedValue || 0) - Number(a.fit.totalProjectedValue || 0)))
    .slice(0, 8)
    .map(row => ({ ...row, assignedAeName: row.client.assignedAeName || 'Unassigned' }));
  return { generatedAt: summary.generatedAt, summary: { hot: summary.hot, warm: summary.warm, watch: summary.watch, projectedValue: summary.projectedValue, total: queue.length }, queue };
}

function exportOfferCommandBrief(format = 'json') {
  const deck = buildOfferCommandDeck();
  const payload = {
    generatedAt: deck.generatedAt,
    summary: deck.summary,
    queue: deck.queue.map(row => ({
      clientId: row.client.id,
      clientName: row.client.name,
      assignedAeId: row.client.assignedAeId || '',
      assignedAeName: row.assignedAeName,
      fit: row.fit,
      topOffers: (row.fit.topOffers || []).map(item => ({ id: item.offer.id, name: item.offer.name, projectedValue: item.projectedValue, score: item.score }))
    }))
  };
  state.offerRuns = Array.isArray(state.offerRuns) ? state.offerRuns : [];
  state.offerRuns.unshift({ id: uid('offer-run'), createdAt: nowIso(), kind: 'offer-command-export', summary: deck.summary });
  persist();
  if (format === 'json') return download('ae-offer-command-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# AE Offer Command Brief',
    '',
    `Generated: ${payload.generatedAt}`,
    '',
    `- Hot: ${payload.summary.hot}`,
    `- Warm: ${payload.summary.warm}`,
    `- Watch: ${payload.summary.watch}`,
    `- Projected value: ${formatCurrency(payload.summary.projectedValue || 0)}`,
    '',
    '## Offer queue',
    ...(payload.queue.length ? payload.queue.map(item => `- ${item.clientName} · ${item.fit.label} · ${item.assignedAeName} · projected ${formatCurrency(item.fit.totalProjectedValue || 0)} · top ${item.topOffers.map(offer => offer.name).join(', ')}`) : ['- No offer-command queue is currently open.'])
  ].join('\n');
  return download('ae-offer-command-brief.md', md, 'text/markdown');
}

function buildClientOfferPacket(clientId) {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const fit = getClientOfferFitState(client, state.offerCatalog || []);
  const recommendedOffers = (fit.topOffers || []).slice(0, 3).map(item => ({
    id: item.offer.id,
    name: item.offer.name,
    category: item.offer.category,
    oneTimePrice: Number(item.offer.oneTimePrice || 0),
    monthlyPrice: Number(item.offer.monthlyPrice || 0),
    projectedValue: Number(item.projectedValue || 0),
    score: item.score,
    pitch: item.offer.pitch,
    reasons: item.reasons
  }));
  const objections = [
    client.priority === 'urgent' ? 'Client may think the timeline is too tight.' : 'Client may assume the current setup is good enough.',
    Number(client.monthlyValue || 0) > 0 ? 'Client may compare this against current recurring spend.' : 'Client may ask why the investment is justified now.',
    recommendedOffers[0]?.category === 'inspection' ? 'Client may underestimate the value of deep-scan sales material.' : 'Client may need proof that this is not just another dashboard.'
  ];
  const closingSequence = [
    'Open with the most immediate pain or missed upside.',
    `Position ${recommendedOffers[0]?.name || 'the lead offer'} as the first solve, not the entire burden.`,
    'Tie the recommendation to revenue protection, delivery clarity, or operational speed.',
    'Offer one clear next step with a dated checkpoint.'
  ];
  const packet = {
    generatedAt: nowIso(),
    client: {
      id: client.id,
      name: client.name,
      company: client.company || '',
      assignedAeId: client.assignedAeId || '',
      assignedAeName: client.assignedAeName || '',
      stage: client.stage || '',
      priority: client.priority || '',
      monthlyValue: Number(client.monthlyValue || 0),
      estimatedValue: Number(client.estimatedValue || 0)
    },
    fit,
    recommendedOffers,
    whyNow: fit.status === 'hot' ? 'The client is already showing a high-fit buying pattern and should be moved while the signal is strong.' : fit.status === 'warm' ? 'The client fits multiple products and needs a tighter pitch to convert.' : 'The client is worth keeping on the board with a lighter-touch commercial packet.',
    objections,
    closingSequence,
    bundleValue: recommendedOffers.slice(0, 2).reduce((sum, item) => sum + Number(item.projectedValue || 0), 0)
  };
  state.offerPacketRuns = Array.isArray(state.offerPacketRuns) ? state.offerPacketRuns : [];
  state.offerPacketRuns.unshift({ id: uid('offer-packet-run'), createdAt: nowIso(), clientId: client.id, clientName: client.name, topOfferId: recommendedOffers[0]?.id || '', bundleValue: packet.bundleValue, status: fit.status });
  persist();
  return packet;
}

function exportClientOfferPacket(clientId, format = 'json') {
  const packet = buildClientOfferPacket(clientId);
  if (!packet) return;
  if (format === 'json') return download('ae-client-offer-packet.json', JSON.stringify(packet, null, 2), 'application/json');
  const md = [
    '# AE Client Offer Packet',
    '',
    `Generated: ${packet.generatedAt}`,
    '',
    `- Client: ${packet.client.name}`,
    `- Company: ${packet.client.company || '—'}`,
    `- Assigned AE: ${packet.client.assignedAeName || 'Unassigned'}`,
    `- Opportunity status: ${packet.fit.label}`,
    `- Bundle value: ${formatCurrency(packet.bundleValue || 0)}`,
    '',
    '## Recommended offers',
    ...(packet.recommendedOffers.length ? packet.recommendedOffers.map(item => `- ${item.name} · ${formatCurrency(item.oneTimePrice || 0)} one-time${item.monthlyPrice ? ` + ${formatCurrency(item.monthlyPrice)} monthly` : ''} · score ${item.score}`) : ['- No recommended offers surfaced.']),
    '',
    '## Why now',
    packet.whyNow,
    '',
    '## Likely objections',
    ...packet.objections.map(item => `- ${item}`),
    '',
    '## Closing sequence',
    ...packet.closingSequence.map(item => `- ${item}`)
  ].join('\n');
  return download('ae-client-offer-packet.md', md, 'text/markdown');
}

function createOfferPursuitTask(clientId, source = 'offer-command') {
  const client = state.clients.find(item => item.id === clientId);
  if (!client) return null;
  const title = `Offer pursuit — ${client.name}`;
  const existing = state.tasks.find(task => String(task.status || 'todo') !== 'done' && String(task.title || '').trim() === title);
  if (existing) return existing;
  const packet = buildClientOfferPacket(clientId);
  const task = {
    id: uid('task'),
    title,
    dueDate: plusDaysIso(packet.fit.status === 'hot' ? 0 : packet.fit.status === 'warm' ? 1 : 3),
    assignedAeId: client.assignedAeId || '',
    assignedAeName: client.assignedAeName || '',
    clientId: client.id,
    clientName: client.name,
    notes: `Offer status: ${packet.fit.label} (${packet.fit.score})\nBundle value: ${formatCurrency(packet.bundleValue || 0)}\nTop offers: ${(packet.recommendedOffers || []).map(item => item.name).join(' | ')}\nWhy now: ${packet.whyNow}`,
    status: 'todo',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    dependencyTaskId: '',
    kind: source,
  };
  state.tasks.unshift(task);
  state.offerRuns = Array.isArray(state.offerRuns) ? state.offerRuns : [];
  state.offerRuns.unshift({ id: uid('offer-run'), createdAt: nowIso(), clientId: client.id, clientName: client.name, action: source, status: packet.fit.status, bundleValue: packet.bundleValue });
  logClientActivity(client, source, 'Offer pursuit task created', title);
  state.auditLog.unshift({ id: uid('audit'), kind: source, message: `Offer pursuit task created for ${client.name}`, at: nowIso() });
  remoteUpsert?.('tasks', task);
  remoteUpsert?.('clients', client);
  persist();
  return task;
}

function buildAeOfferCoverageDeck() {
  const summary = buildAeOfferCoverageSummary(state.aeProfiles || [], state.clients || [], state.offerCatalog || []);
  const rows = (summary.rows || []).filter(row => ['critical', 'high', 'watch'].includes(row.status)).sort((a, b) => (b.score - a.score) || (Number(b.projectedValue || 0) - Number(a.projectedValue || 0))).slice(0, 8);
  return { generatedAt: summary.generatedAt, summary: { critical: summary.critical, high: summary.high, watch: summary.watch, projectedValue: summary.projectedValue, total: rows.length }, rows };
}

function exportAeOfferCoverageBrief(format = 'json') {
  const deck = buildAeOfferCoverageDeck();
  const payload = {
    generatedAt: deck.generatedAt,
    summary: deck.summary,
    rows: deck.rows.map(row => ({ aeId: row.ae.id, aeName: row.ae.name, status: row.status, score: row.score, hotClients: row.hotClients, warmClients: row.warmClients, clientCount: row.clientCount, projectedValue: row.projectedValue }))
  };
  if (format === 'json') return download('ae-offer-coverage-brief.json', JSON.stringify(payload, null, 2), 'application/json');
  const md = [
    '# AE Offer Coverage Brief',
    '',
    `Generated: ${payload.generatedAt}`,
    '',
    `- Critical AEs: ${payload.summary.critical}`,
    `- High AEs: ${payload.summary.high}`,
    `- Watch AEs: ${payload.summary.watch}`,
    `- Projected value: ${formatCurrency(payload.summary.projectedValue || 0)}`,
    '',
    '## AE offer rows',
    ...(payload.rows.length ? payload.rows.map(item => `- ${item.aeName} · ${item.status} · hot clients ${item.hotClients} · warm clients ${item.warmClients} · projected ${formatCurrency(item.projectedValue || 0)}`) : ['- No AE offer coverage rows are currently open.'])
  ].join('\n');
  return download('ae-offer-coverage-brief.md', md, 'text/markdown');
}

function runOfferCommandSweep(limit = 5) {
  const deck = buildOfferCommandDeck();
  const actions = [];
  for (const row of deck.queue) {
    if (actions.length >= limit) break;
    const task = createOfferPursuitTask(row.client.id, 'offer-command-sweep');
    if (task) actions.push({ clientId: row.client.id, clientName: row.client.name, taskId: task.id, status: row.fit.status, bundleValue: row.fit.totalProjectedValue });
  }
  const run = { id: uid('offer-run'), createdAt: nowIso(), kind: 'offer-command-sweep', actions, summary: deck.summary };
  state.offerRuns = Array.isArray(state.offerRuns) ? state.offerRuns : [];
  state.offerRuns.unshift(run);
  state.auditLog.unshift({ id: uid('audit'), kind: 'offer-command-sweep', message: `Offer command sweep ran ${actions.length} actions`, at: nowIso() });
  persist();
  return run;
}

function renderOfferCommandCard() {
  const deck = buildOfferCommandDeck();
  return `<div class="card"><div class="eyebrow">Product offer command</div><h3>Offer-fit queue, projected bundle value, and client sales packet export</h3><div class="toolbar"><button class="btn-soft" id="export-offer-command-json">Offer JSON</button><button class="btn-soft" id="export-offer-command-md">Offer MD</button><button class="btn-soft" id="run-offer-command-sweep">Run offer sweep</button></div><div class="tag-row"><span class="tag">Hot ${deck.summary.hot}</span><span class="tag">Warm ${deck.summary.warm}</span><span class="tag">Watch ${deck.summary.watch}</span><span class="tag">Projected ${formatCurrency(deck.summary.projectedValue || 0)}</span></div><div class="list">${deck.queue.length ? deck.queue.map(row => `<div class="item"><h4>${escapeHtml(row.client.name)}</h4><div class="meta">${escapeHtml(row.fit.label)} · ${escapeHtml(row.assignedAeName)} · ${formatCurrency(row.fit.totalProjectedValue || 0)} projected</div><p>${escapeHtml((row.fit.topOffers || []).slice(0, 2).map(item => item.offer.name).join(' · ') || 'No offers surfaced.')}</p><div class="toolbar"><button class="btn-soft" data-act="offer-open-client" data-id="${row.client.id}">Open client</button><button class="btn-soft" data-act="offer-export" data-id="${row.client.id}" data-format="markdown">Packet MD</button><button class="btn-soft" data-act="offer-task" data-id="${row.client.id}">Create pursuit task</button></div></div>`).join('') : '<div class="item"><div class="meta">No offer-command queue is currently open.</div></div>'}</div></div>`;
}

function renderAeOfferCoverageCard() {
  const deck = buildAeOfferCoverageDeck();
  return `<div class="card"><div class="eyebrow">AE offer coverage</div><h3>AE-by-AE sell-through opportunity, hot accounts, and bundle projection</h3><div class="toolbar"><button class="btn-soft" id="export-offer-coverage-json">Coverage JSON</button><button class="btn-soft" id="export-offer-coverage-md">Coverage MD</button></div><div class="tag-row"><span class="tag">Critical ${deck.summary.critical}</span><span class="tag">High ${deck.summary.high}</span><span class="tag">Watch ${deck.summary.watch}</span><span class="tag">Projected ${formatCurrency(deck.summary.projectedValue || 0)}</span></div><div class="table-wrap"><table><thead><tr><th>AE</th><th>Status</th><th>Hot clients</th><th>Warm clients</th><th>Managed clients</th><th>Projected value</th></tr></thead><tbody>${deck.rows.length ? deck.rows.map(row => `<tr><td>${escapeHtml(row.ae.name)}</td><td><span class="tag">${escapeHtml(row.label)}</span></td><td>${row.hotClients}</td><td>${row.warmClients}</td><td>${row.clientCount}</td><td>${formatCurrency(row.projectedValue || 0)}</td></tr>`).join('') : '<tr><td colspan="6">No AE offer coverage rows are currently open.</td></tr>'}</tbody></table></div></div>`;
}

const __v46BaseRenderDashboard = renderDashboard;
renderDashboard = function() {
  return __v46BaseRenderDashboard() + `<section class="grid two">${renderOfferCommandCard()}${renderAeOfferCoverageCard()}</section>`;
};

const __v46BaseBindDashboard = bindDashboard;
bindDashboard = function() {
  __v46BaseBindDashboard();
  $('#export-offer-command-json')?.addEventListener('click', () => exportOfferCommandBrief('json'));
  $('#export-offer-command-md')?.addEventListener('click', () => exportOfferCommandBrief('markdown'));
  $('#export-offer-coverage-json')?.addEventListener('click', () => exportAeOfferCoverageBrief('json'));
  $('#export-offer-coverage-md')?.addEventListener('click', () => exportAeOfferCoverageBrief('markdown'));
  $('#run-offer-command-sweep')?.addEventListener('click', () => { runOfferCommandSweep(5); render(); });
  document.querySelectorAll('[data-act="offer-open-client"]').forEach(btn => btn.addEventListener('click', () => { page = 'clients'; render(); renderClientHistory(btn.dataset.id, true); }));
  document.querySelectorAll('[data-act="offer-export"]').forEach(btn => btn.addEventListener('click', () => exportClientOfferPacket(btn.dataset.id, btn.dataset.format || 'json')));
  document.querySelectorAll('[data-act="offer-task"]').forEach(btn => btn.addEventListener('click', () => { createOfferPursuitTask(btn.dataset.id, 'offer-command'); render(); }));
};
