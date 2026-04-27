const fs = require('fs');
const path = require('path');
const { repoPath, loadManifest, ok } = require('./lib');
const dir = repoPath('artifacts','legacy-archive'); const banned = loadManifest().banned_provider_strings.map((term)=>new RegExp(term,'gi')); let touched=0;
for (const name of fs.readdirSync(dir)){ const file=path.join(dir,name); if(!fs.statSync(file).isFile()) continue; let text=fs.readFileSync(file,'utf8'); const original=text; for(const regex of banned) text=text.replace(regex,'[normalized-provider]'); if(text!==original){ fs.writeFileSync(file,text,'utf8'); touched+=1; } }
ok(`[legacy-archive-normalize] PASS :: normalized=${touched}`);
