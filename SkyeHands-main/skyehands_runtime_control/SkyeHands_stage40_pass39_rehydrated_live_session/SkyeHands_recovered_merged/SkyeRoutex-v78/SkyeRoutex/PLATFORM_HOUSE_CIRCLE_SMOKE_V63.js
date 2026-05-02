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
  'housecircle.integral.tours.v62.js',
  'housecircle.integral.v63.js',
  'housecircle.integral.tours.v63.js'
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
    srcObject: null,
    appendChild(child){ this.children.push(child); return child; },
    insertBefore(child){ this.children.push(child); return child; },
    setAttribute(name, value){ this[name] = value; },
    getAttribute(name){ return this[name]; },
    addEventListener(){},
    remove(){},
    querySelector(){ return null; },
    querySelectorAll(){ return []; },
    click(){},
    closest(){ return this; },
    play(){ return Promise.resolve(); }
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

function FakeBarcodeDetector(){ }
FakeBarcodeDetector.prototype.detect = function(){ return Promise.resolve([]); };

const context = {
  console,
  setTimeout,
  clearTimeout,
  Blob,
  requestAnimationFrame(cb){ return setTimeout(cb, 0); },
  cancelAnimationFrame(id){ clearTimeout(id); },
  URL: { createObjectURL(){ return 'blob:fake'; }, revokeObjectURL(){} },
  navigator: { onLine: true, mediaDevices: { getUserMedia(){ return Promise.resolve({ getTracks(){ return [{ stop(){} }]; } }); } } },
  BarcodeDetector: FakeBarcodeDetector,
  BroadcastChannel: function(){ this.postMessage = function(){}; this.close = function(){}; },
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

if (!context.RoutexPlatformHouseCircleV63) throw new Error('V63 API missing');

const baseState = context.RoutexPlatformHouseCircle.readState();
const locationId = baseState.locations[0].id;
const packet = context.RoutexPlatformHouseCircleV60.createJoinPacket({
  locationId,
  tier: 'VIP Table',
  offer: 'Late seating'
});
context.RoutexPlatformHouseCircleV63.redeemScanPayload(packet.deepLink, {
  name: 'Jordan Guest',
  email: 'jordan@example.com',
  phone: '555-2222',
  note: 'Scanned from V63 smoke'
});

const csv = 'Location,Customer Name,Customer Email,Total Collected,Items,Date\nHouse Circle Downtown,Alex Guest,alex@example.com,184.50,3,2026-04-04T14:00:00Z';
const adapterResult = context.RoutexPlatformHouseCircleV63.importPosAdapterData({ text: csv, adapter: 'auto', locationId });
if (adapterResult.created.length < 1) throw new Error('Adapter import failed');

context.RoutexPlatformHouseCircleV63.enqueueWebhook('square', 'square.pos.sale', {
  locationId,
  customer_name: 'Webhook Guest',
  customer_email: 'webhook@example.com',
  total_collected: 205.20,
  items: 2,
  date: '2026-04-04T15:00:00Z'
});
const jobRuns = context.RoutexPlatformHouseCircleV63.runJobQueue(5);
if (!jobRuns.length) throw new Error('Expected webhook job run');

const bundle = context.RoutexPlatformHouseCircleV62.buildReplicaBundle();
const cloned = JSON.parse(JSON.stringify(bundle));
cloned.assignments.push({
  id: 'sync-assignment-v63',
  title: 'Synced assignment',
  status: 'queued',
  operatorId: context.RoutexPlatformHouseCircleV60.currentOperator().id,
  operatorName: context.RoutexPlatformHouseCircleV60.currentOperator().name,
  locationId,
  scheduledFor: '2026-04-05',
  createdAt: '2026-04-05T00:00:00.000Z',
  updatedAt: '2026-04-05T00:00:00.000Z'
});
const frame = context.RoutexPlatformHouseCircleV63.createSyncFrame('replica-bundle-delta', { reason: 'smoke-sync', bundle: cloned });
frame.peerId = 'peer-remote-smoke';
const apply = context.RoutexPlatformHouseCircleV63.applySyncFrame(frame, { remote: true, via: 'smoke' });
if (apply.status === 'bad') throw new Error('Sync frame apply failed');
if (!context.RoutexPlatformHouseCircleV62.readAssignments().some(item => item.id === 'sync-assignment-v63')) throw new Error('Synced assignment missing');

const metrics = context.RoutexPlatformHouseCircleV63.buildV63Metrics();
if (metrics.adapterRuns < 1) throw new Error('Adapter metrics too low');
if (metrics.scannerEvents < 1) throw new Error('Scanner metrics too low');
if (metrics.completedJobs < 1) throw new Error('Completed jobs metric too low');

console.log(JSON.stringify({
  ok: true,
  adapter: adapterResult.adapter,
  scannerEvents: metrics.scannerEvents,
  completedJobs: metrics.completedJobs,
  deadJobs: metrics.deadJobs,
  assignments: context.RoutexPlatformHouseCircleV62.readAssignments().length,
  peers: context.RoutexPlatformHouseCircleV63.readPeers().length,
  syncFrames: context.RoutexPlatformHouseCircleV63.readSyncLog().length
}, null, 2));
