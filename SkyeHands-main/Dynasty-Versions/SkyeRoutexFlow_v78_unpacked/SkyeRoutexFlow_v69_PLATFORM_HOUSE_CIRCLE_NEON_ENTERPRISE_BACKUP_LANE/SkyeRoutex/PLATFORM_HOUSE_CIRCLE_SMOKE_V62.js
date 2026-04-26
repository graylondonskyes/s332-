const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appDir = __dirname;
const files = [
  'housecircle.integral.v59.js',
  'housecircle.integral.v60.js',
  'housecircle.integral.tours.v60.js',
  'housecircle.integral.v61.js',
  'housecircle.integral.tours.v61.js',
  'housecircle.integral.v62.js',
  'housecircle.integral.tours.v62.js'
].map(name => ({ name, src: fs.readFileSync(path.join(appDir, name), 'utf8') }));

const storage = new Map();
function fakeEl(tag){
  return {
    tagName: tag,
    style: {},
    innerHTML: '',
    textContent: '',
    children: [],
    dataset: {},
    className: '',
    id: '',
    value: '',
    appendChild(child){ this.children.push(child); return child; },
    insertBefore(child){ this.children.push(child); return child; },
    setAttribute(name, value){ this[name] = value; },
    getAttribute(name){ return this[name]; },
    addEventListener(){},
    remove(){},
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    click(){},
    closest(){ return this; }
  };
}

const fakeDocument = {
  readyState: 'complete',
  body: fakeEl('body'),
  head: fakeEl('head'),
  getElementById(){ return null; },
  querySelector(){ return null; },
  querySelectorAll(){ return []; },
  createElement(tag){ return fakeEl(tag); },
  addEventListener(){}
};

const context = {
  console,
  setTimeout,
  clearTimeout,
  Blob,
  requestAnimationFrame(cb){ return setTimeout(cb, 0); },
  cancelAnimationFrame(id){ clearTimeout(id); },
  URL: { createObjectURL(){ return 'blob:fake'; }, revokeObjectURL(){} },
  navigator: { onLine: true },
  innerWidth: 1280,
  location: { hash: '#platform-house', origin: 'https://example.com', pathname: '/index.html' },
  addEventListener(){},
  localStorage: {
    getItem(key){ return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value){ storage.set(key, String(value)); },
    removeItem(key){ storage.delete(key); }
  },
  document: fakeDocument,
  window: null,
  __tasks: [],
  APP: {
    view: 'platform-house',
    routeId: '',
    cached: {
      routes: [{ id: 'route-1', name: 'Morning Run', territory: 'Downtown', date: '2026-04-04', status: 'planned', updatedAt: '2026-04-04T12:00:00.000Z' }],
      stops: [{ id: 'stop-1', routeId: 'route-1', label: 'House Circle Downtown', serviceArea: 'Downtown', address: '1 Main St', businessEmail: 'venue@example.com', contact: 'Venue Lead', phone: '555-1111', status: 'delivered', completedAt: '2026-04-04T13:00:00.000Z', updatedAt: '2026-04-04T13:00:00.000Z' }]
    }
  },
  NAV_ITEMS: [{ id: 'dashboard', label: 'Dashboard', desc: 'Ops', icon: 'D' }],
  ICONS: { aeflow: 'A' },
  cleanStr(v){ return String(v == null ? '' : v).trim(); },
  escapeHTML(v){ return String(v == null ? '' : v); },
  uid(){ return 'uid-' + Math.random().toString(36).slice(2,8); },
  nowISO(){ return '2026-04-04T13:30:00.000Z'; },
  dayISO(){ return '2026-04-04'; },
  fmt(v){ return String(v); },
  fmtMoney(v){ return '$' + Number(v || 0).toFixed(2); },
  toast(){},
  downloadText(){},
  renderNav(){},
  updateStatusLine(){},
  openSidebar(){},
  closeSidebar(){},
  setPage(){},
  setPrimary(){},
  openModal(){},
  closeModal(){},
  render: async function(){},
  viewDashboard: async function(){},
  viewRouteDetail: async function(){},
  viewSettings: async function(){},
  readRouteTasks(){ return context.__tasks; },
  writeRouteTasks(items){ context.__tasks = items; return items; },
  readVaultDocs(){ return []; },
  getAEFlowAccounts(){ return [{ id: 'acct-1', business_name: 'House Circle Downtown', business_email: 'venue@example.com', contact_name: 'Venue Lead', service_area: 'Downtown', notes: 'Seed account' }]; },
  createRoute: async function(data){ return { id: 'new-route', name: data.name, date: data.date }; },
  createStop: async function(routeId, data){ return { id: 'new-stop', routeId, label: data.label, status: 'pending' }; },
  updateStop: async function(id, patch){ return { id, ...patch }; },
  normalizeRouteTask(task){ return task; }
};
context.window = context;
vm.createContext(context);
files.forEach(file => vm.runInContext(file.src, context, { filename: file.name }));

if (!context.RoutexPlatformHouseCircle || !context.RoutexPlatformHouseCircleV60 || !context.RoutexPlatformHouseCircleV61 || !context.RoutexPlatformHouseCircleV62) {
  throw new Error('V62 API missing');
}

const baseState = context.RoutexPlatformHouseCircle.readState();
const locationId = baseState.locations[0].id;
const packet = context.RoutexPlatformHouseCircleV60.createJoinPacket({
  locationId,
  tier: 'VIP Table',
  offer: 'VIP Dinner Club'
});
context.RoutexPlatformHouseCircleV60.redeemJoinPacket(packet.code, {
  name: 'Jordan Guest',
  email: 'jordan@example.com',
  phone: '555-2222',
  note: 'VIP table interest'
});
context.RoutexPlatformHouseCircleV60.recordPosTicket({
  locationId,
  guestName: 'Jordan Guest',
  guestEmail: 'jordan@example.com',
  amount: 220,
  items: 4,
  channel: 'manual-pos',
  note: 'VIP tasting bundle'
});
context.APP.cached.stops[0].status = 'failed';
context.RoutexPlatformHouseCircle.syncStopIntoHospitality('stop-1');

const shift = context.RoutexPlatformHouseCircleV62.createShift({
  title: 'Downtown hospitality dispatch',
  operatorId: context.RoutexPlatformHouseCircleV60.currentOperator().id,
  locationId,
  startAt: '2026-04-04T15:00:00.000Z'
});
const wave = context.RoutexPlatformHouseCircleV62.buildWaveFromOpenCases({
  operatorId: context.RoutexPlatformHouseCircleV60.currentOperator().id,
  shiftId: shift.id,
  count: 3,
  scheduledFor: '2026-04-04'
});
if (!wave.length) throw new Error('Expected dispatch wave assignments');

const run = context.RoutexPlatformHouseCircleV62.createReadinessRun({
  templateId: context.RoutexPlatformHouseCircleV62.readReadinessTemplates()[0].id,
  locationId
});
context.RoutexPlatformHouseCircleV62.updateReadinessItem(run.id, 0, 'failed', 'Packets not staged');
const readinessRuns = context.RoutexPlatformHouseCircleV62.readReadinessRuns();
const failedRun = readinessRuns.find(item => item.id === run.id);
if (!failedRun || !failedRun.failedCritical) throw new Error('Expected failed readiness run');
if (!failedRun.escalatedCaseId || !failedRun.escalatedTaskId) throw new Error('Expected escalation artifacts from readiness failure');

const bundle = context.RoutexPlatformHouseCircleV62.buildReplicaBundle();
const preview = context.RoutexPlatformHouseCircleV62.previewReplicaMerge(bundle);
if (bundle.type !== 'skye-routex-platform-house-circle-v62') throw new Error('Bad v62 bundle type');
if (typeof preview.assignments.creates !== 'number') throw new Error('Preview missing assignment counts');

const cloneBundle = JSON.parse(JSON.stringify(bundle));
cloneBundle.assignments.push({
  id: 'external-assignment',
  title: 'Imported assignment',
  status: 'queued',
  operatorId: context.RoutexPlatformHouseCircleV60.currentOperator().id,
  operatorName: context.RoutexPlatformHouseCircleV60.currentOperator().name,
  locationId,
  scheduledFor: '2026-04-05',
  createdAt: '2026-04-05T00:00:00.000Z',
  updatedAt: '2026-04-05T00:00:00.000Z'
});
const mergePreview = context.RoutexPlatformHouseCircleV62.importV62Bundle(cloneBundle);
if (mergePreview.assignments.creates < 1) throw new Error('Expected incoming assignment create preview');
if (!context.RoutexPlatformHouseCircleV62.readAssignments().some(item => item.id === 'external-assignment')) throw new Error('Imported assignment missing');

const metrics = context.RoutexPlatformHouseCircleV62.buildMeshMetrics();
if (metrics.activeShifts < 1) throw new Error('Active shifts metric too low');
if (metrics.queuedAssignments < 1) throw new Error('Queued assignments metric too low');
if (metrics.readinessAttention < 1) throw new Error('Readiness attention metric too low');

console.log(JSON.stringify({
  ok: true,
  shifts: context.RoutexPlatformHouseCircleV62.readShifts().length,
  assignments: context.RoutexPlatformHouseCircleV62.readAssignments().length,
  readinessRuns: context.RoutexPlatformHouseCircleV62.readReadinessRuns().length,
  routeTasks: context.__tasks.length,
  bundleType: bundle.type,
  previewCreates: mergePreview.assignments.creates,
  readinessAttention: metrics.readinessAttention
}, null, 2));
