const fs = require('fs');
const path = require('path');
function fail(msg){ console.error(msg); process.exit(1); }
function read(p){ return fs.readFileSync(path.join(__dirname, p), 'utf8'); }
const files = [
  'VALUATION_2026_CURRENT_BUILD.json',
  'investor/SKYEROUTEXFLOW_V68_2026_ENTERPRISE_VALUATION.json',
  'netlify/functions/_lib/housecircle-valuation.js',
  'housecircle.integral.v68.js',
  'index.html'
];
files.forEach((p)=>{ if(!fs.existsSync(path.join(__dirname,p))) fail('Missing ' + p); });
const a = JSON.parse(read('VALUATION_2026_CURRENT_BUILD.json'));
const b = JSON.parse(read('investor/SKYEROUTEXFLOW_V68_2026_ENTERPRISE_VALUATION.json'));
if(a.totalValue !== 5450000) fail('Root valuation total mismatch');
if(b.totalValue !== 5450000) fail('Investor valuation total mismatch');
if(!read('netlify/functions/_lib/housecircle-valuation.js').includes('5450000')) fail('Lib total not updated');
if(!read('housecircle.integral.v68.js').includes('5450000') && !read('housecircle.integral.v68.js').includes('650000')) fail('V68 valuation surface not updated');
if(!read('index.html').includes('housecircle.integral.v68.js')) fail('Index missing v68 script');
const out = {
  ok: true,
  checkedAt: new Date().toISOString(),
  totalValue: a.totalValue,
  componentCount: a.components.length,
  filesChecked: files,
  note: 'V68 valuation sync artifacts are aligned to the upgraded codebase valuation.'
};
fs.mkdirSync(path.join(__dirname, 'WHITE_GLOVE_V68'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'WHITE_GLOVE_V68', 'smoke_output_v68.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
