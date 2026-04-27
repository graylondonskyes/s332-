const fs = require('fs');
const { spawnSync } = require('child_process');
const { fail, ok, repoPath } = require('./lib');

const run = spawnSync('node', [repoPath('scripts','emit-retailer-packages.js')], { cwd:repoPath(), encoding:'utf8', stdio:'pipe' });
if (run.status !== 0) fail(run.stdout + run.stderr);

const manifest = JSON.parse(fs.readFileSync(repoPath('artifacts','retailer-packages','manifest.json'), 'utf8'));
if (!manifest.ok || manifest.jobs.length !== 2) fail('[retailer-packages] FAIL :: manifest');
for (const job of manifest.jobs) {
  if (job.packages.length !== 4) fail(`[retailer-packages] FAIL :: count ${job.slug}`);
  for (const entry of job.packages) {
    const zipPath = require('path').isAbsolute(entry.path || entry) ? (entry.path || entry) : repoPath(...String(entry.path || entry).split('/'));
    if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 900) fail(`[retailer-packages] FAIL :: missing ${zipPath}`);
    const listed = spawnSync('python3', ['-c', 'import sys, zipfile, json; z=zipfile.ZipFile(sys.argv[1]); names=set(z.namelist()); report=json.loads(z.read("validation/validation-report.json")); assert "package-manifest.json" in names and "metadata.json" in names and "rights.json" in names and report["ok"] is True; print("ok")', zipPath], { cwd:repoPath(), encoding:'utf8', stdio:'pipe' });
    if (listed.status !== 0) fail(`[retailer-packages] FAIL :: inspect ${zipPath}\n${listed.stdout}\n${listed.stderr}`);
  }
}
ok('[retailer-packages] PASS (8 zips verified)');
