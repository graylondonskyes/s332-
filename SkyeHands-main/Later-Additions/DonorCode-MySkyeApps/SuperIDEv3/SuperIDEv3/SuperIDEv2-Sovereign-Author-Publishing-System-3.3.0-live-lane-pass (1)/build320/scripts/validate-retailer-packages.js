const fs = require('fs');
const { spawnSync } = require('child_process');
const { fail, ok, repoPath, readJson } = require('./lib');

const manifest = readJson(repoPath('artifacts','retailer-packages','manifest.json'));
if (!manifest.ok || !Array.isArray(manifest.jobs) || manifest.jobs.length === 0) fail('[retailer-validator] FAIL :: manifest missing');

const requiredFiles = ['package-manifest.json', 'metadata.json', 'rights.json', 'validation/validation-report.json'];
const problems = [];
for (const job of manifest.jobs) {
  for (const entry of job.packages) {
    const zipPath = require('path').isAbsolute(entry.path || entry) ? (entry.path || entry) : repoPath(...String(entry.path || entry).split('/'));
    if (!fs.existsSync(zipPath)) { problems.push(`missing:${zipPath}`); continue; }
    const result = spawnSync('python3', ['-c', 'import sys, zipfile, json; z=zipfile.ZipFile(sys.argv[1]); names=set(z.namelist()); report=json.loads(z.read("validation/validation-report.json")); assert all(name in names for name in sys.argv[2:]); assert report["ok"] is True; print("ok")', zipPath, ...requiredFiles], { encoding:'utf8', stdio:'pipe' });
    if (result.status !== 0) problems.push(`inspect:${zipPath}`);
  }
}
if (problems.length) fail(`[retailer-validator] FAIL :: ${problems.join(', ')}`);
ok('[retailer-validator] PASS');
