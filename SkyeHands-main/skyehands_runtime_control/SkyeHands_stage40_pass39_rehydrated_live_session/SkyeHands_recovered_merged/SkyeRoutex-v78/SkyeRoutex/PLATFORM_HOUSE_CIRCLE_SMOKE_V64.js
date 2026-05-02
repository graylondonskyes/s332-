const fs = require('fs');
const path = require('path');
const vm = require('vm');

const authLogin = require('./netlify/functions/phc-auth-login.js');
const syncState = require('./netlify/functions/phc-sync-state.js');
const syncFrame = require('./netlify/functions/phc-sync-frame.js');
const posIngest = require('./netlify/functions/phc-pos-ingest.js');
const webhookSquare = require('./netlify/functions/phc-webhook-square.js');
const jobDrain = require('./netlify/functions/phc-job-drain.js');
const healthFn = require('./netlify/functions/phc-health.js');

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
  'housecircle.integral.tours.v63.js',
  'housecircle.integral.v64.js',
  'housecircle.integral.tours.v64.js'
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
    checked: false,
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
function responseFrom(result){
  return {
    ok: result.statusCode >= 200 && result.statusCode < 300,
    status: result.statusCode,
    async json(){ return JSON.parse(result.body || '{}'); },
    async text(){ return result.body || ''; }
  };
}
async function routeFetch(url, opts){
  opts = opts || {};
  const method = opts.method || 'GET';
  const headers = opts.headers || {};
  const body = opts.body;
  const cleanUrl = String(url).replace(/^https?:\/\/[^/]+/, '');
  const [pathname, query = ''] = cleanUrl.split('?');
  const queryStringParameters = {};
  if(query){
    query.split('&').forEach((pair) => {
      const [k, v] = pair.split('=');
      queryStringParameters[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
  }
  const event = { httpMethod: method, headers, body, queryStringParameters };
  if(pathname.endsWith('/phc-auth-login')) return responseFrom(await authLogin.handler(event));
  if(pathname.endsWith('/phc-sync-state')) return responseFrom(await syncState.handler(event));
  if(pathname.endsWith('/phc-sync-frame')) return responseFrom(await syncFrame.handler(event));
  if(pathname.endsWith('/phc-pos-ingest')) return responseFrom(await posIngest.handler(event));
  if(pathname.endsWith('/phc-webhook-square')) return responseFrom(await webhookSquare.handler(event));
  if(pathname.endsWith('/phc-job-drain')) return responseFrom(await jobDrain.handler(event));
  if(pathname.endsWith('/phc-health')) return responseFrom(await healthFn.handler(event));
  throw new Error('Unhandled fetch URL ' + url);
}

const context = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Blob,
  fetch: routeFetch,
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

async function main(){
  if (!context.RoutexPlatformHouseCircleV64) throw new Error('V64 API missing');
  const locationId = context.RoutexPlatformHouseCircle.readState().locations[0].id;
  context.RoutexPlatformHouseCircleV64.saveCloudConfig({ enabled:true, autoSync:false, orgId:'smoke-org', deviceId:'device-smoke', basePath:'/.netlify/functions' });
  const login = await context.RoutexPlatformHouseCircleV64.loginCloud();
  const push = await context.RoutexPlatformHouseCircleV64.pushCloudBundle('smoke-seed');
  const frame = context.RoutexPlatformHouseCircleV63.createSyncFrame('touch', { reason:'smoke-frame' });
  context.RoutexPlatformHouseCircleV64.queueCloudAction('sync-frame', { frame });
  const csv = 'Location,Customer Name,Customer Email,Total Collected,Items,Date\nHouse Circle Downtown,Alex Guest,alex@example.com,184.50,3,2026-04-04T14:00:00Z';
  const adapterResult = context.RoutexPlatformHouseCircleV63.importPosAdapterData({ text: csv, adapter: 'auto', locationId });
  if (!adapterResult.created.length) throw new Error('Local adapter import failed');
  const flush = await context.RoutexPlatformHouseCircleV64.flushCloudActions(10);
  await routeFetch('/.netlify/functions/phc-webhook-square', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ orgId:'smoke-org', eventType:'square.sale.updated', payload:{ event_id:'evt-1', location_name:'House Circle Downtown', customer_name:'Webhook Guest', customer_email:'webhook@example.com', amount_money:{ amount:20520 }, items:2, created_at:'2026-04-04T15:00:00Z' } }) });
  const drain = await context.RoutexPlatformHouseCircleV64.drainCloudJobs(10);
  const pull = await context.RoutexPlatformHouseCircleV64.pullCloudBundle();
  const health = await context.RoutexPlatformHouseCircleV64.fetchCloudHealth();
  const metrics = context.RoutexPlatformHouseCircleV64.buildV64Metrics();
  const out = {
    ok: true,
    tokenIssued: !!(login && login.token),
    pushedRevision: push.revision,
    flushed: flush.sent,
    drained: drain.completed,
    serverRevision: pull.revision,
    posTickets: (pull.bundle && pull.bundle.posTickets || []).length,
    routeTasks: (pull.bundle && pull.bundle.routeTasks || []).length,
    sessionActive: metrics.sessionActive,
    healthRevision: health.revision,
    queuedActions: metrics.queuedActions
  };
  fs.writeFileSync(path.join(appDir, 'WHITE_GLOVE_V64', 'smoke_output_v64.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err && err.stack || err);
  process.exit(1);
});
