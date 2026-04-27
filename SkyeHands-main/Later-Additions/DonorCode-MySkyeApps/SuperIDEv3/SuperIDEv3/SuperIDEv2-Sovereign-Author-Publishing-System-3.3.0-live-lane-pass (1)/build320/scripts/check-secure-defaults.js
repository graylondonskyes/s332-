const fs = require('fs');
const { repoPath, readJson, loadManifest, fail, ok } = require('./lib');
const expected = loadManifest().required_secure_defaults; const actual = readJson(repoPath('config','secure-defaults.json'));
for (const [key, value] of Object.entries(expected)) if (actual[key] !== value) fail(`[secure-defaults] FAIL: ${key} expected ${JSON.stringify(value)} got ${JSON.stringify(actual[key])}`);
const indexHtml = fs.readFileSync(repoPath('app','index.html'),'utf8');
if (!indexHtml.includes('Content-Security-Policy')) fail('[secure-defaults] FAIL: CSP meta missing from app/index.html');
if (!indexHtml.includes("frame-src 'self'")) fail('[secure-defaults] FAIL: frame-src self missing from CSP');
ok('[secure-defaults] PASS: required secure defaults are present.');
