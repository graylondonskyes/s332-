const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appDir = __dirname;
const src = fs.readFileSync(path.join(appDir, 'housecircle.integral.v59.js'), 'utf8');

const storage = new Map();
const fakeDocument = {
  readyState: 'complete',
  head: { appendChild(){} },
  body: { appendChild(){}, },
  getElementById(){ return null; },
  querySelector(){ return null; },
  querySelectorAll(){ return []; },
  createElement(tag){
    return {
      tagName: tag,
      style: {},
      innerHTML: '',
      textContent: '',
      children: [],
      appendChild(child){ this.children.push(child); return child; },
      insertBefore(child){ this.children.push(child); return child; },
      setAttribute(){},
      addEventListener(){},
      remove(){},
      querySelector(){ return null; },
      querySelectorAll(){ return []; },
      click(){},
    };
  },
  addEventListener(){}
};

const context = {
  console,
  setTimeout,
  clearTimeout,
  Blob,
  URL: { createObjectURL(){ return 'blob:fake'; }, revokeObjectURL(){} },
  navigator: { onLine: true },
  innerWidth: 1280,
  location: { hash: '#dashboard' },
  localStorage: {
    getItem(key){ return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value){ storage.set(key, String(value)); },
    removeItem(key){ storage.delete(key); }
  },
  document: fakeDocument,
  window: null,
  APP: {
    view: 'dashboard',
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
  readRouteTasks(){ return []; },
  writeRouteTasks(items){ context.__lastTasks = items; return items; },
  readVaultDocs(){ return []; },
  getAEFlowAccounts(){ return [{ id: 'acct-1', business_name: 'House Circle Downtown', business_email: 'venue@example.com', contact_name: 'Venue Lead', service_area: 'Downtown', notes: 'Seed account' }]; },
  createRoute: async function(data){ return { id: 'new-route', name: data.name, date: data.date }; },
  createStop: async function(routeId, data){ return { id: 'new-stop', routeId, label: data.label, status: 'pending' }; },
  updateStop: async function(id, patch){ return { id, ...patch }; },
  normalizeRouteTask(task){ return task; }
};
context.window = context;
vm.createContext(context);
vm.runInContext(src, context, { filename: 'housecircle.integral.v59.js' });

if (!context.RoutexPlatformHouseCircle) {
  throw new Error('RoutexPlatformHouseCircle API missing');
}
if (!context.NAV_ITEMS.find((item) => item.id === 'platform-house')) {
  throw new Error('Platform House nav item missing');
}

const synced = context.RoutexPlatformHouseCircle.syncFromRoutex({ silent: true });
const state = context.RoutexPlatformHouseCircle.readState();
if (!state.locations.length) throw new Error('No locations seeded');
if (!state.guests.length) throw new Error('No guests seeded');
if (!state.timeline.length) throw new Error('No timeline entries seeded');

const bundle = context.RoutexPlatformHouseCircle.exportUnifiedBundle();
if (bundle.type !== 'skye-routex-platform-house-circle-v59') throw new Error('Bad bundle type');

console.log(JSON.stringify({ ok: true, locations: state.locations.length, guests: state.guests.length, timeline: state.timeline.length, bundleType: bundle.type }, null, 2));
