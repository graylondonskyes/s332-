const fs = require('fs');
const path = require('path');
const { fail, ok, repoPath } = require('./lib');

const forbidden = ['local ledger only', 'validated package emitters only', 'local signed operator gate only'];
const required = ['server-backed auth', 'stripe gateway', 'vendor portal workflows'];

function gather(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['artifacts', 'dist', 'node_modules'].includes(entry.name)) continue;
      gather(full, acc);
    } else if (/\.(md|html|webmanifest|js|json)$/i.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const files = [repoPath('README.md'), repoPath('app', 'index.html'), repoPath('app', 'manifest.webmanifest')];
const issues = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8').toLowerCase();
  for (const phrase of forbidden) {
    if (text.includes(phrase)) issues.push(`${path.relative(repoPath(), file)}::${phrase}`);
  }
}
const rootText = files.map((file) => fs.readFileSync(file, 'utf8').toLowerCase()).join('\n');
for (const phrase of required) {
  if (!rootText.includes(phrase)) issues.push(`missing-required::${phrase}`);
}
if (issues.length) fail(`[no-theater] FAIL :: ${issues.join(', ')}`);
ok('[no-theater] PASS');
