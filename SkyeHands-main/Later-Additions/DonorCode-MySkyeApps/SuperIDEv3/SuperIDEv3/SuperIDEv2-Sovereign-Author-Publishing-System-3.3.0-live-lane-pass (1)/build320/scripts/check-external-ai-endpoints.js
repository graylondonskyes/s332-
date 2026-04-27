const fs = require('fs');
const { canonicalFiles, loadManifest, fail, ok } = require('./lib');
const manifest = loadManifest(); const banned = manifest.banned_external_endpoints; const offenders = []; const files = canonicalFiles();
for (const file of files) { const norm=file.replace(/\\/g,'/'); if(norm.endsWith('/config/release-manifest.json') || norm.endsWith('/scripts/check-external-ai-endpoints.js')) continue; const content = fs.readFileSync(file,'utf8'); for (const endpoint of banned) if (content.includes(endpoint)) offenders.push({file,endpoint}); }
if (offenders.length) fail(`[external-endpoints] FAIL :: ${offenders.map((o)=>`${o.file} => ${o.endpoint}`).join(', ')}`);
ok(`[external-endpoints] PASS (${files.length} files scanned)`);
