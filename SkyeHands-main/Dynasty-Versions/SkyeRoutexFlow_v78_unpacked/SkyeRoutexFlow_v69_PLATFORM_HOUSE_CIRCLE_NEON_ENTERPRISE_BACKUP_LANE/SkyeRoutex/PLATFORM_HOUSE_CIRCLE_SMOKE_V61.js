const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appDir = __dirname;
const src59 = fs.readFileSync(path.join(appDir, 'housecircle.integral.v59.js'), 'utf8');
const src60 = fs.readFileSync(path.join(appDir, 'housecircle.integral.v60.js'), 'utf8');
const src61 = fs.readFileSync(path.join(appDir, 'housecircle.integral.v61.js'), 'utf8');
const tours60 = fs.readFileSync(path.join(appDir, 'housecircle.integral.tours.v60.js'), 'utf8');
const tours61 = fs.readFileSync(path.join(appDir, 'housecircle.integral.tours.v61.js'), 'utf8');

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
vm.runInContext(src59, context, { filename: 'housecircle.integral.v59.js' });
vm.runInContext(src60, context, { filename: 'housecircle.integral.v60.js' });
vm.runInContext(tours60, context, { filename: 'housecircle.integral.tours.v60.js' });
vm.runInContext(src61, context, { filename: 'housecircle.integral.v61.js' });
vm.runInContext(tours61, context, { filename: 'housecircle.integral.tours.v61.js' });

if (!context.RoutexPlatformHouseCircle || !context.RoutexPlatformHouseCircleV60 || !context.RoutexPlatformHouseCircleV61) {
  throw new Error('V61 API missing');
}

const baseState = context.RoutexPlatformHouseCircle.readState();
if (!baseState.locations.length) throw new Error('No base locations after v59 seed');
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
context.APP.cached.stops[0].updatedAt = '2026-04-04T14:00:00.000Z';
context.RoutexPlatformHouseCircle.syncStopIntoHospitality('stop-1');

const metrics = context.RoutexPlatformHouseCircleV61.buildMetrics();
const cases = context.RoutexPlatformHouseCircleV61.readServiceCases();
const rules = context.RoutexPlatformHouseCircleV61.readAutomationRules();
const runs = context.RoutexPlatformHouseCircleV61.readSignalRuns();

if (rules.length < 4) throw new Error('Default automation rules missing');
if (cases.length < 2) throw new Error('Expected multiple service cases from signals');
if (runs.filter(item => item.trigger !== 'seed').length < 2) throw new Error('Signal runs missing');
if (!context.__tasks.length) throw new Error('Expected Routex tasks from V61 automation');
if (metrics.openCases < 2) throw new Error('Open case metric too low');

const bundle = context.RoutexPlatformHouseCircleV61.exportV61Bundle();
if (bundle.type !== 'skye-routex-platform-house-circle-v61') throw new Error('Bad v61 bundle type');

console.log(JSON.stringify({
  ok: true,
  rules: rules.length,
  cases: cases.length,
  tasks: context.__tasks.length,
  runs: runs.length,
  openCases: metrics.openCases,
  bundleType: bundle.type
}, null, 2));
