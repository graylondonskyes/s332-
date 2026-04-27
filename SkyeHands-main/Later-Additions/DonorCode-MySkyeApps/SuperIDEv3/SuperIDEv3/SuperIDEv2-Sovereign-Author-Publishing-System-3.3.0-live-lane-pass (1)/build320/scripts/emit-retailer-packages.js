const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { repoPath, ensureCleanDir, writeJson, ok, fail } = require('./lib');
const fixtures = [
  { id:'skydocx', workspace:repoPath('fixtures','publishing','skydocx-workspace.json') },
  { id:'skyeblog', workspace:repoPath('fixtures','publishing','skyeblog-workspace.json') }
];
function runJob(id, workspacePath, baseOut) {
  const outputDir = path.join(baseOut, id);
  fs.mkdirSync(outputDir, { recursive: true });
  const result = spawnSync('python3', [repoPath('scripts','emit-retailer-packages.py'), '--workspace', workspacePath, '--output_dir', outputDir], { cwd:repoPath(), encoding:'utf8', stdio:'pipe' });
  if (result.status !== 0) fail(`[retailer-packages] FAIL :: ${id}\n${result.stdout}\n${result.stderr}`);
  return JSON.parse((result.stdout || '{}').trim());
}
const baseOut = repoPath('artifacts','retailer-packages');
ensureCleanDir(baseOut);
const jobs = fixtures.map((entry) => runJob(entry.id, entry.workspace, baseOut)).map((job) => ({
  ...job,
  packages: (job.packages || []).map((pkg) => ({
    ...pkg,
    absolute_path: pkg.path,
    path: path.relative(repoPath(), pkg.path).split(path.sep).join('/')
  }))
}));
writeJson(path.join(baseOut, 'manifest.json'), { generated_at:new Date().toISOString(), ok:true, jobs });
ok(`[retailer-packages] PASS :: jobs=${jobs.length}`);
