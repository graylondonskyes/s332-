const fs = require('fs');
const { fail, ok, repoPath, readJson } = require('./lib');
const pkg = readJson(repoPath('package.json'));
const expectedVersion = pkg.version;
const directivePath = repoPath(`CURRENT_DIRECTIVE_${expectedVersion}.md`);
const statusPath = repoPath(`CURRENT_COMPLETION_STATUS_${expectedVersion}.md`);
const issues = [];
if (!fs.existsSync(directivePath)) issues.push('directive-missing');
if (!fs.existsSync(statusPath)) issues.push('status-missing');
if (!issues.length) {
  const directive = fs.readFileSync(directivePath, 'utf8');
  const status = fs.readFileSync(statusPath, 'utf8');
  if (!directive.includes(expectedVersion)) issues.push('directive-version');
  if (!status.includes(expectedVersion)) issues.push('status-version');
}
if (issues.length) fail(`[artifact-consistency] FAIL :: ${issues.join(', ')}`);
ok('[artifact-consistency] PASS');
