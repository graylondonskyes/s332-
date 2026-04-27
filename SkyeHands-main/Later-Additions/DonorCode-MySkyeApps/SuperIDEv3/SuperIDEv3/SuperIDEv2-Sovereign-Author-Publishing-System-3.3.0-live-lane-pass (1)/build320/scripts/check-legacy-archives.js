const fs = require('fs');
const path = require('path');
const { repoPath, loadManifest, fail, ok } = require('./lib');
const dir = repoPath('artifacts','legacy-archive'); const banned = loadManifest().banned_provider_strings.map((term)=>term.toLowerCase()); const offenders=[]; let scanned=0;
for (const name of fs.readdirSync(dir)){ const file=path.join(dir,name); if(!fs.statSync(file).isFile()) continue; const content=fs.readFileSync(file,'utf8').toLowerCase(); scanned += 1; for(const term of banned) if(content.includes(term)) offenders.push({file,term}); }
if (offenders.length) fail(`[legacy-archives] FAIL :: ${offenders.map((o)=>`${o.file} => ${o.term}`).join(', ')}`);
ok(`[legacy-archives] PASS :: scanned=${scanned}`);
