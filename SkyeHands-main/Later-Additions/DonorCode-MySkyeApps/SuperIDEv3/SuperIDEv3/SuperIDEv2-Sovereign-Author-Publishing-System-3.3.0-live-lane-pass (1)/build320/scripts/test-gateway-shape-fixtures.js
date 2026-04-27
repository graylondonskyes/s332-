const fs = require('fs');
const path = require('path');
const { repoPath, readJson, fail, ok } = require('./lib');
const contract = readJson(repoPath('config','gateway-shape-contract.json')); const dir = repoPath('fixtures','gateway'); const files = fs.readdirSync(dir).filter((name)=>name.endsWith('.json'));
for (const file of files){ const value = JSON.parse(fs.readFileSync(path.join(dir,file),'utf8')); for(const key of contract.required_top_level) if(!(key in value)) fail(`[gateway-shape] FAIL: ${file} missing top-level ${key}`); for(const key of contract.required_usage_fields) if(!(key in value.usage)) fail(`[gateway-shape] FAIL: ${file} missing usage.${key}`); for(const key of contract.required_meta_fields) if(!(key in value.meta)) fail(`[gateway-shape] FAIL: ${file} missing meta.${key}`); }
ok(`[gateway-shape] PASS (${files.length} fixtures)`);
