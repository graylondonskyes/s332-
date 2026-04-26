const fs = require('fs');
const path = require('path');
const vm = require('vm');

const authLogin = require('./netlify/functions/phc-auth-login.js');
const valuationFn = require('./netlify/functions/phc-valuation.js');
const healthFn = require('./netlify/functions/phc-health.js');

const appDir = __dirname;
const files = [
  'housecircle.integral.v66.js',
  'housecircle.integral.tours.v66.js'
].map(name => ({ name, src: fs.readFileSync(path.join(appDir, name), 'utf8') }));

const storage = new Map();
function fakeEl(tag){
  return {
    tagName: tag,
    style:{}, innerHTML:'', textContent:'', children:[], dataset:{}, className:'', id:'', value:'', checked:false,
    appendChild(child){ this.children.push(child); return child; },
    insertBefore(child){ this.children.push(child); return child; },
    setAttribute(name, value){ this[name] = value; },
    getAttribute(name){ return this[name]; },
    addEventListener(){}, remove(){}, querySelector(){ return null; }, querySelectorAll(){ return []; }, click(){}, closest(){ return this; }
  };
}
function findById(node, id){
  if(!node) return null;
  if(node.id === id) return node;
  const kids = Array.isArray(node.children) ? node.children : [];
  for(const child of kids){ const hit = findById(child, id); if(hit) return hit; }
  return null;
}
const contentEl = fakeEl('div'); contentEl.id = 'content';
const appEl = fakeEl('div'); appEl.id = 'app';
const navEl = fakeEl('div'); navEl.id = 'nav';
const bodyEl = fakeEl('body'); bodyEl.appendChild(navEl); bodyEl.appendChild(contentEl); bodyEl.appendChild(appEl);
const fakeDocument = {
  readyState:'complete', body:bodyEl, head:fakeEl('head'),
  getElementById(id){ return findById(bodyEl, id) || findById(this.head, id); },
  querySelector(sel){ if(sel === '#content' || sel === '#content .grid') return contentEl; if(sel === '#app') return appEl; if(sel === '#nav') return navEl; return null; },
  querySelectorAll(sel){ if(sel === '.topbar .row, #nav') return [navEl]; return []; },
  createElement(tag){ return fakeEl(tag); }, addEventListener(){}
};
function responseFrom(result){ return { ok: result.statusCode >= 200 && result.statusCode < 300, status: result.statusCode, async json(){ return JSON.parse(result.body || '{}'); } }; }
async function routeFetch(url, opts){
  opts = opts || {};
  const method = opts.method || 'GET';
  const headers = opts.headers || {};
  const body = opts.body;
  const cleanUrl = String(url).replace(/^https?:\/\/[^/]+/, '');
  const [pathname, query = ''] = cleanUrl.split('?');
  const queryStringParameters = {};
  if(query){ query.split('&').forEach((pair) => { const [k, v] = pair.split('='); queryStringParameters[decodeURIComponent(k)] = decodeURIComponent(v || ''); }); }
  const event = { httpMethod: method, headers, body, queryStringParameters };
  if(pathname.endsWith('/phc-auth-login')) return responseFrom(await authLogin.handler(event));
  if(pathname.endsWith('/phc-valuation')) return responseFrom(await valuationFn.handler(event));
  if(pathname.endsWith('/phc-health')) return responseFrom(await healthFn.handler(event));
  throw new Error('Unhandled fetch URL ' + url);
}
const context = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, Blob,
  fetch: routeFetch,
  requestAnimationFrame(cb){ return setTimeout(cb, 0); }, cancelAnimationFrame(id){ clearTimeout(id); },
  URL:{ createObjectURL(){ return 'blob:fake'; }, revokeObjectURL(){} },
  navigator:{ onLine:true }, location:{ hash:'#platform-house', origin:'https://example.com', pathname:'/index.html' }, addEventListener(){},
  localStorage:{ getItem(key){ return storage.has(key) ? storage.get(key) : null; }, setItem(key, value){ storage.set(key, String(value)); }, removeItem(key){ storage.delete(key); } },
  document: fakeDocument, window:null,
  APP:{ view:'platform-house' },
  cleanStr(v){ return String(v == null ? '' : v).trim(); }, escapeHTML(v){ return String(v == null ? '' : v); }, nowISO(){ return '2026-04-04T14:00:00.000Z'; },
  toast(){}, downloadText(){}, openModal(){}, render: async function(){},
  RoutexPlatformHouseCircleV64: {
    _cfg:{ enabled:true, orgId:'smoke-org-v66', deviceId:'device-v66', basePath:'/.netlify/functions' },
    _session:null,
    saveCloudConfig(input){ this._cfg = { ...this._cfg, ...(input || {}) }; return this._cfg; },
    readCloudConfig(){ return this._cfg; },
    readCloudSession(){ return this._session; },
    saveCloudSession(input){ this._session = input; return input; }
  }
};
context.window = context;
vm.createContext(context);
files.forEach(file => vm.runInContext(file.src, context, { filename:file.name }));

async function main(){
  if(!context.RoutexPlatformHouseCircleV66) throw new Error('V66 API missing');
  const loginRes = await routeFetch('/.netlify/functions/phc-auth-login', { method:'POST', headers:{ 'content-type':'application/json' }, body: JSON.stringify({ orgId:'smoke-org-v66', deviceId:'device-v66', operatorId:'founder-admin', operatorName:'Skyes Over London', role:'founder_admin' }) }).then(r => r.json());
  context.RoutexPlatformHouseCircleV64.saveCloudSession({ token: loginRes.token, orgId:'smoke-org-v66' });
  const record = context.RoutexPlatformHouseCircleV66.buildRecord();
  const synced = await context.RoutexPlatformHouseCircleV66.syncValuationCloud('Smoke V66 valuation sync');
  const fetched = await context.RoutexPlatformHouseCircleV66.fetchValuationCloud();
  const health = await routeFetch('/.netlify/functions/phc-health?orgId=smoke-org-v66', { method:'GET' }).then(r => r.json());
  const out = {
    ok:true,
    tokenIssued: !!loginRes.token,
    expectedValue: record.totalValue,
    syncedValue: synced.record && synced.record.totalValue,
    fetchedValue: fetched.record && fetched.record.totalValue,
    componentCount: (record.components || []).length,
    healthValuation: health.valuation && health.valuation.totalValue,
    discoverableHtml: record.discoverability && record.discoverability.html,
    valuationButtonInjected: !!fakeDocument.getElementById('hc66_toolbar_btn')
  };
  fs.mkdirSync(path.join(appDir, 'WHITE_GLOVE_V66'), { recursive:true });
  fs.writeFileSync(path.join(appDir, 'WHITE_GLOVE_V66', 'smoke_output_v66.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => { console.error(err && err.stack || err); process.exit(1); });
