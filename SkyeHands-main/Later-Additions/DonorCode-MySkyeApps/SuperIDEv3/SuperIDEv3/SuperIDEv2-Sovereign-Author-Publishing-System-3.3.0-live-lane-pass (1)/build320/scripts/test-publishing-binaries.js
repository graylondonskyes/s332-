const fs = require('fs');
const path = require('path');
const { fail, ok, repoPath } = require('./lib');
const { spawnSync } = require('child_process');
const run = spawnSync('node', [repoPath('scripts','write-publishing-binaries.js')], { cwd:repoPath(), encoding:'utf8', stdio:'pipe' });
if (run.status !== 0) fail(run.stdout + run.stderr);
const manifest = JSON.parse(fs.readFileSync(repoPath('artifacts','publishing-binaries','manifest.json'), 'utf8'));
if (!manifest.ok || manifest.jobs.length !== 2) fail('[publishing-binaries] FAIL :: manifest');
for (const job of manifest.jobs) {
  const docx = path.resolve(job.docx_path);
  const pdf = path.resolve(job.pdf_path);
  const m = path.resolve(job.manifest_path);
  if (!fs.existsSync(docx) || fs.statSync(docx).size < 1500) fail(`[publishing-binaries] FAIL :: docx ${job.slug}`);
  if (!fs.existsSync(pdf) || fs.statSync(pdf).size < 1200) fail(`[publishing-binaries] FAIL :: pdf ${job.slug}`);
  if (!fs.existsSync(m)) fail(`[publishing-binaries] FAIL :: manifest ${job.slug}`);
}
ok('[publishing-binaries] PASS (2 jobs verified)');
