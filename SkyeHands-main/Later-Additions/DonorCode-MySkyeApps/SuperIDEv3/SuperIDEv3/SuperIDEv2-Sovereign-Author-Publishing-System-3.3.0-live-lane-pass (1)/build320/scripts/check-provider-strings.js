const fs = require('fs');
const { canonicalFiles, loadManifest, fail, ok } = require('./lib');
const banned = loadManifest().banned_provider_strings; const offenders = [];
for (const file of canonicalFiles()) { const norm=file.replace(/\\/g,'/'); if(norm.endsWith('/config/release-manifest.json') || norm.endsWith('/scripts/check-provider-strings.js') || norm.endsWith('/scripts/check-external-ai-endpoints.js') || norm.endsWith('/scripts/normalize-legacy-archives.js') || norm.endsWith('/scripts/check-legacy-archives.js')) continue; const content = fs.readFileSync(file,'utf8').toLowerCase(); for (const term of banned) if (content.includes(term.toLowerCase())) offenders.push({file,term}); }
if (offenders.length) fail(`[provider-strings] FAIL :: ${offenders.map((o)=>`${o.file} => ${o.term}`).join(', ')}`);
ok('[provider-strings] PASS');
