const fs = require('fs');
const path = require('path');
const { repoPath, fail, ok } = require('./lib');
const dir = repoPath('fixtures','skye'); const files = fs.readdirSync(dir).filter((name)=>name.endsWith('.json')); let checked=0;
for (const file of files){ const data = JSON.parse(fs.readFileSync(path.join(dir,file),'utf8')); if(data.schema!=='skye.workspace.snapshot') fail(`[skye-schema] FAIL: ${file} schema mismatch`); if(!data.workspace || !Array.isArray(data.workspace.files)) fail(`[skye-schema] FAIL: ${file} missing workspace.files`); if(typeof data.workspace.files[0]?.name !== 'string') fail(`[skye-schema] FAIL: ${file} invalid file vector`); checked += 1; }
ok(`[skye-schema] PASS (${checked} samples)`);
