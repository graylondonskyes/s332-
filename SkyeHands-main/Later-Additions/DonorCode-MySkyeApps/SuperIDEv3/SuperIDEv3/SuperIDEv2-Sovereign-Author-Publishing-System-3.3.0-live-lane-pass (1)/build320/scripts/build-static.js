const fs = require('fs');
const path = require('path');
const { repoPath, ensureCleanDir, copyDir, writeJson, sha256File, ok } = require('./lib');
const source = repoPath('app'); const target = repoPath('dist'); ensureCleanDir(target); copyDir(source, target);
const files = ['index.html','styles.css','app.js','manifest.webmanifest','sw.js'];
writeJson(repoPath('artifacts','build-manifest.json'), { built_at:new Date().toISOString(), files: files.map((name)=>({ path:`dist/${name}`, sha256:sha256File(path.join(target,name)), bytes:fs.statSync(path.join(target,name)).size })) });
ok('[build-static] PASS :: dist built and artifacts/build-manifest.json written');
