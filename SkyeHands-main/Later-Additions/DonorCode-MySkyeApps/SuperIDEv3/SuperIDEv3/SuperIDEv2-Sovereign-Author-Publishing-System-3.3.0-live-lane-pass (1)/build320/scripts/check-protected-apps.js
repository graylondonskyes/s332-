const { repoPath, readJson, sha256File, fail, ok } = require('./lib');
const manifest = readJson(repoPath('artifacts','protected-app-manifest.json')); const mismatches=[];
for (const target of manifest.targets){ const actual=sha256File(repoPath(target.path)); if(actual!==target.sha256) mismatches.push(target.path); }
if (mismatches.length) fail(`[protected-apps] FAIL :: ${mismatches.join(', ')}`);
ok(`[protected-apps] PASS (${manifest.targets.length} targets)`);
