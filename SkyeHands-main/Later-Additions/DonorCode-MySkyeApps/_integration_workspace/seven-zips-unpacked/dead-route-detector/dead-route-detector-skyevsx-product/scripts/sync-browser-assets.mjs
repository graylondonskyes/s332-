import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { scanWorkspaceFromPath } = require('../extensions/dead-route-detector-skyevsx/lib/scanner');

const productRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fixtureRoot = path.join(productRoot, 'examples', 'broken-ui');
const scannerCoreSource = path.join(productRoot, 'shared', 'scanner-core.js');
const reportToolsSource = path.join(productRoot, 'shared', 'report-tools.js');
const sampleReport = scanWorkspaceFromPath(fixtureRoot, { workspaceName: 'broken-ui-proof-fixture' });

function collectEntries(currentRoot, currentDir = currentRoot, items = []) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const absolute = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      collectEntries(currentRoot, absolute, items);
      continue;
    }
    const relPath = path.relative(currentRoot, absolute).replace(/\\/g, '/');
    items.push({ path: relPath, text: fs.readFileSync(absolute, 'utf8') });
  }
  return items;
}

const proofFixture = {
  generatedAt: new Date().toISOString(),
  workspaceName: 'broken-ui-proof-fixture',
  entries: collectEntries(fixtureRoot)
};

const outputMap = [
  path.join(productRoot, 'shared', 'sample-report.json'),
  path.join(productRoot, 'webapp', 'dead-route-detector-skyevsx', 'assets', 'sample-report.json'),
  path.join(productRoot, 'github', 'dead-route-detector-skyevsx', 'assets', 'sample-report.json')
];

const fixtureTargets = [
  path.join(productRoot, 'shared', 'proof-fixture.json'),
  path.join(productRoot, 'webapp', 'dead-route-detector-skyevsx', 'assets', 'proof-fixture.json'),
  path.join(productRoot, 'github', 'dead-route-detector-skyevsx', 'assets', 'proof-fixture.json')
];

for (const target of outputMap) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(sampleReport, null, 2), 'utf8');
}

for (const target of fixtureTargets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(proofFixture, null, 2), 'utf8');
}

for (const target of [
  path.join(productRoot, 'webapp', 'dead-route-detector-skyevsx', 'scanner-core.js'),
  path.join(productRoot, 'github', 'dead-route-detector-skyevsx', 'scanner-core.js')
]) {
  fs.copyFileSync(scannerCoreSource, target);
}

for (const target of [
  path.join(productRoot, 'webapp', 'dead-route-detector-skyevsx', 'report-tools.js'),
  path.join(productRoot, 'github', 'dead-route-detector-skyevsx', 'report-tools.js')
]) {
  fs.copyFileSync(reportToolsSource, target);
}

console.log('Browser assets synced.');
