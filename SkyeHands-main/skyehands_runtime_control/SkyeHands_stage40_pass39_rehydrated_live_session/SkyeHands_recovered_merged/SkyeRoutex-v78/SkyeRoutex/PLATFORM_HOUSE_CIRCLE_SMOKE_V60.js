const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appDir = __dirname;
const src59 = fs.readFileSync(path.join(appDir, 'housecircle.integral.v59.js'), 'utf8');
const src60 = fs.readFileSync(path.join(appDir, 'housecircle.integral.v60.js'), 'utf8');
const tours60 = fs.readFileSync(path.join(appDir, 'housecircle.integral.tours.v60.js'), 'utf8');

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
vm.runInContext(src59, context, { filename: 'housecircle.integral.v59.js' });
vm.runInContext(src60, context, { filename: 'housecircle.integral.v60.js' });
vm.runInContext(tours60, context, { filename: 'housecircle.integral.tours.v60.js' });

if (!context.RoutexPlatformHouseCircle || !context.RoutexPlatformHouseCircleV60) {
  throw new Error('V60 API missing');
}

const baseState = context.RoutexPlatformHouseCircle.readState();
if (!baseState.locations.length) throw new Error('No base locations after v59 seed');
const locationId = baseState.locations[0].id;

const operator = context.RoutexPlatformHouseCircleV60.createOperator({
  name: 'Venue Captain',
  email: 'captain@example.com',
  role: 'hospitality_manager',
  notes: 'Smoke operator'
});
context.RoutexPlatformHouseCircleV60.switchOperator(operator.id);

const packet = context.RoutexPlatformHouseCircleV60.createJoinPacket({
  locationId,
  tier: 'Insider',
  offer: 'Dinner club access'
});
if (!packet.code) throw new Error('Join packet missing code');

const redeemed = context.RoutexPlatformHouseCircleV60.redeemJoinPacket(packet.code, {
  name: 'Jordan Guest',
  email: 'jordan@example.com',
  phone: '555-2222',
  note: 'VIP table interest'
});
if (!redeemed.checkin || !redeemed.checkin.guestId) throw new Error('Redeem failed');

const sale = context.RoutexPlatformHouseCircleV60.recordPosTicket({
  locationId,
  guestName: 'Jordan Guest',
  guestEmail: 'jordan@example.com',
  amount: 84.5,
  items: 3,
  channel: 'manual-pos',
  note: 'Bottle service'
});
if (!sale.ticket || sale.ticket.amount !== 84.5) throw new Error('POS ticket failed');

const audit = context.RoutexPlatformHouseCircleV60.readAudit();
if (!audit.length) throw new Error('Audit should not be empty');

const stats = context.RoutexPlatformHouseCircleV60.buildExtendedStats();
if (stats.posRevenue < 84.5) throw new Error('POS revenue did not update');
if (stats.checkins < 1) throw new Error('Checkins did not update');

const bundle = context.RoutexPlatformHouseCircle.exportUnifiedBundle();
if (bundle.type !== 'skye-routex-platform-house-circle-v60') throw new Error('Bad v60 bundle type');

console.log(JSON.stringify({
  ok: true,
  operator: operator.name,
  packet: packet.code,
  checkins: stats.checkins,
  posRevenue: stats.posRevenue,
  audit: audit.length,
  bundleType: bundle.type
}, null, 2));
