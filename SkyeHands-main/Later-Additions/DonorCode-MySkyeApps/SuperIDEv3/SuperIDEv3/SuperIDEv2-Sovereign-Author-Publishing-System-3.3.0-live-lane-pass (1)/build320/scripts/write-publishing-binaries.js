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
  const result = spawnSync('python', [repoPath('scripts','write-publishing-binaries.py'), '--workspace', workspacePath, '--output_dir', outputDir], { cwd:repoPath(), encoding:'utf8', stdio:'pipe' });
  if (result.status !== 0) fail(`[publishing-binaries] FAIL :: ${id}\n${result.stdout}\n${result.stderr}`);
  return JSON.parse((result.stdout || '{}').trim());
}
const baseOut = repoPath('artifacts','publishing-binaries');
ensureCleanDir(baseOut);
const jobs = fixtures.map((entry) => runJob(entry.id, entry.workspace, baseOut));
writeJson(path.join(baseOut, 'manifest.json'), { generated_at:new Date().toISOString(), ok:true, jobs });
ok(`[publishing-binaries] PASS :: jobs=${jobs.length}`);
