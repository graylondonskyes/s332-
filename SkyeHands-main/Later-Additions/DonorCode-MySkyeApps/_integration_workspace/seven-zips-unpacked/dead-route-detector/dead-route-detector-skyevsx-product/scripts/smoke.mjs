import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { runBrowserSmoke } from './browser-smoke.mjs';
import { runExtensionHostSmoke } from './extension-host-smoke.mjs';
import './sync-browser-assets.mjs';

const require = createRequire(import.meta.url);
const { scanWorkspaceFromPath } = require('../extensions/dead-route-detector-skyevsx/lib/scanner');

const productRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const distDir = path.join(productRoot, 'dist');
const reportDir = path.join(productRoot, 'PROJECT_DOCS');
const screenshotDir = path.join(reportDir, 'SMOKE_SCREENSHOTS');
const smokeReportPath = path.join(reportDir, 'DEAD_ROUTE_DETECTOR_SMOKE_REPORT.json');
const skipDistChecks = process.argv.includes('--skip-dist-checks');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function isLocalValue(value) {
  return value
    && !/^(https?:|mailto:|tel:|data:)/i.test(value)
    && value !== '#'
    && !/^javascript:/i.test(value);
}

function resolveLocalAsset(rootPath, filePath, refValue) {
  const cleaned = String(refValue).split('#')[0].split('?')[0];
  if (!cleaned) return null;
  if (cleaned.startsWith('/')) {
    return path.join(rootPath, cleaned.slice(1));
  }
  return path.resolve(path.dirname(filePath), cleaned);
}

function verifyHtmlAssetLinks(surfaceRoot) {
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (/\.(html|htm|js)$/i.test(entry.name)) {
        files.push(absolute);
      }
    }
  };
  walk(surfaceRoot);

  const checked = [];
  const patterns = [
    /<(?:a|img|script|link)\b[^>]*\b(?:href|src)\s*=\s*["'`]([^"'`]+)["'`]/g,
    /\bfetch\(\s*["'`]([^"'`]+)["'`]/g,
    /serviceWorker\.register\(\s*["'`]([^"'`]+)["'`]/g
  ];

  for (const filePath of files) {
    const text = readUtf8(filePath);
    for (const regex of patterns) {
      let match;
      while ((match = regex.exec(text))) {
        const value = match[1];
        if (!isLocalValue(value)) continue;
        const targetPath = resolveLocalAsset(surfaceRoot, filePath, value);
        assert(fs.existsSync(targetPath), `Missing local asset or linked file: ${path.relative(surfaceRoot, filePath)} -> ${value}`);
        checked.push({
          source: path.relative(surfaceRoot, filePath).replace(/\\/g, '/'),
          target: path.relative(surfaceRoot, targetPath).replace(/\\/g, '/')
        });
      }
    }
  }

  return checked;
}

function verifyZipContains(zipPath, expectedEntries) {
  const listing = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
  for (const entry of expectedEntries) {
    assert(listing.includes(entry), `${path.basename(zipPath)} is missing expected entry: ${entry}`);
  }
}

const proofReport = scanWorkspaceFromPath(path.join(productRoot, 'examples', 'broken-ui'), { workspaceName: 'broken-ui-proof-fixture' });
const healthyStaticReport = scanWorkspaceFromPath(path.join(productRoot, 'examples', 'healthy-static-site'), { workspaceName: 'healthy-static-site' });
const nextFixtureReport = scanWorkspaceFromPath(path.join(productRoot, 'examples', 'next-route-fixture'), { workspaceName: 'next-route-fixture' });
const commandMatrixReport = scanWorkspaceFromPath(path.join(productRoot, 'examples', 'command-matrix'), { workspaceName: 'command-matrix' });
const webappReport = scanWorkspaceFromPath(path.join(productRoot, 'webapp', 'dead-route-detector-skyevsx'), { workspaceName: 'webapp' });
const githubReport = scanWorkspaceFromPath(path.join(productRoot, 'github', 'dead-route-detector-skyevsx'), { workspaceName: 'github' });
const extensionReport = scanWorkspaceFromPath(path.join(productRoot, 'extensions', 'dead-route-detector-skyevsx'), { workspaceName: 'extension' });

assert(proofReport.summary.deadRouteReferences === 4, `Expected 4 proof-fixture dead-route references, got ${proofReport.summary.deadRouteReferences}`);
assert(proofReport.summary.placeholderControls === 2, `Expected 2 proof-fixture placeholder controls, got ${proofReport.summary.placeholderControls}`);
assert(proofReport.summary.deadExecutedCommands === 1, `Expected 1 dead executed command, got ${proofReport.summary.deadExecutedCommands}`);
assert(proofReport.summary.unregisteredContributedCommands === 1, `Expected 1 unregistered contributed command, got ${proofReport.summary.unregisteredContributedCommands}`);

const deadProofPaths = proofReport.deadRouteReferences.map((item) => `${item.file}:${item.path}`).sort();
for (const expected of [
  'src/App.tsx:/ghost',
  'src/App.tsx:/missing-report',
  'src/App.tsx:/nope',
  'src/menu.ts:/ghost'
]) {
  assert(deadProofPaths.includes(expected), `Missing expected proof-fixture dead route: ${expected}`);
}
for (const healthyPath of ['/alive', '/reports/42', '/settings', '/']) {
  assert(!proofReport.deadRouteReferences.some((item) => item.path === healthyPath), `Healthy proof-fixture path was incorrectly flagged: ${healthyPath}`);
}

assert(healthyStaticReport.summary.deadRouteReferences === 0, 'Healthy static fixture has dead route false positives');
assert(healthyStaticReport.summary.orphanRoutes === 0, 'Healthy static fixture has orphan route false positives');
assert(healthyStaticReport.summary.placeholderControls === 0, 'Healthy static fixture has placeholder false positives');
assert(nextFixtureReport.summary.deadRouteReferences === 0, 'Next-style fixture has dead route false positives');
assert(nextFixtureReport.summary.orphanRoutes === 0, 'Next-style fixture has orphan route false positives');
assert(commandMatrixReport.summary.unregisteredContributedCommands === 1, 'Command matrix fixture missing unregistered contributed command');
assert(commandMatrixReport.summary.deadExecutedCommands === 1, 'Command matrix fixture missing dead executed command');
assert(commandMatrixReport.summary.deadMenuCommands === 1, 'Command matrix fixture missing dead menu command');
assert(commandMatrixReport.summary.deadKeybindingCommands === 1, 'Command matrix fixture missing dead keybinding command');

assert(webappReport.summary.deadRouteReferences === 0, `Webapp false-positive dead routes remain: ${webappReport.summary.deadRouteReferences}`);
assert(webappReport.summary.placeholderControls === 0, `Webapp false-positive placeholder findings remain: ${webappReport.summary.placeholderControls}`);
assert(githubReport.summary.deadRouteReferences === 0, `GitHub wrapper false-positive dead routes remain: ${githubReport.summary.deadRouteReferences}`);
assert(githubReport.summary.placeholderControls === 0, `GitHub wrapper false-positive placeholder findings remain: ${githubReport.summary.placeholderControls}`);
assert(extensionReport.summary.deadRouteReferences === 0, `Extension false-positive dead routes remain: ${extensionReport.summary.deadRouteReferences}`);
assert(extensionReport.summary.placeholderControls === 0, `Extension false-positive placeholder findings remain: ${extensionReport.summary.placeholderControls}`);
assert(extensionReport.summary.unregisteredContributedCommands === 0, 'Extension still has unregistered contributed commands');
assert(extensionReport.summary.deadExecutedCommands === 0, 'Extension still has dead executed commands');

const webappLinks = verifyHtmlAssetLinks(path.join(productRoot, 'webapp', 'dead-route-detector-skyevsx'));
const githubLinks = verifyHtmlAssetLinks(path.join(productRoot, 'github', 'dead-route-detector-skyevsx'));
const browserSmoke = await runBrowserSmoke();
const extensionHostSmoke = await runExtensionHostSmoke();
const cliSmoke = JSON.parse(execFileSync('node', [path.join(productRoot, 'scripts', 'cli-smoke.mjs')], { encoding: 'utf8' }));

for (const screenshotPath of [
  'webapp-scan-initial.png',
  'webapp-scan-after-folder-scan.png',
  'webapp-scan-after-baseline-pin.png',
  'webapp-scan-after-proof-fixture.png',
  'webapp-scan-after-compare.png',
  'github-wrapper-repo-scan.png',
  'github-wrapper-repo-baseline.png',
  'github-wrapper-pr-scan.png',
  'github-wrapper-pr-compare.png'
]) {
  assert(fs.existsSync(path.join(screenshotDir, screenshotPath)), `Missing browser smoke screenshot: ${screenshotPath}`);
}

const expectedDist = [
  `dead-route-detector-skyevsx-${JSON.parse(fs.readFileSync(path.join(productRoot, 'extensions', 'dead-route-detector-skyevsx', 'package.json'), 'utf8')).version}.vsix`,
  'dead-route-detector-skyevsx-extension-source.zip',
  'dead-route-detector-skyevsx-webapp.zip',
  'dead-route-detector-skyevsx-github-wrapper.zip',
  'dead-route-detector-skyevsx-product-full.zip'
];

const smokeReport = {
  generatedAt: new Date().toISOString(),
  status: 'runtime-regression-upgrade',
  proofLevel: 'rendered-browser-runtime-with-file-inputs-plus-cli-runtime-plus-extension-harness',
  scannerSummaries: {
    proofFixture: proofReport.summary,
    healthyStaticFixture: healthyStaticReport.summary,
    nextStyleFixture: nextFixtureReport.summary,
    commandMatrixFixture: commandMatrixReport.summary,
    webapp: webappReport.summary,
    github: githubReport.summary,
    extension: extensionReport.summary
  },
  browserRuntimeSmoke: browserSmoke,
  extensionHarnessSmoke: extensionHostSmoke,
  cliRuntimeSmoke: cliSmoke,
  staticAssetChecks: {
    webapp: webappLinks.length,
    github: githubLinks.length
  },
  truthCorpus: {
    healthyStatic: {
      expected: { deadRouteReferences: 0, orphanRoutes: 0, placeholderControls: 0 },
      actual: healthyStaticReport.summary
    },
    nextStyleRoutes: {
      expected: { deadRouteReferences: 0, orphanRoutes: 0 },
      actual: nextFixtureReport.summary
    },
    commandMatrix: {
      expected: {
        unregisteredContributedCommands: 1,
        deadExecutedCommands: 1,
        deadMenuCommands: 1,
        deadKeybindingCommands: 1
      },
      actual: commandMatrixReport.summary
    }
  },
  artifactsVerified: skipDistChecks ? [] : expectedDist,
  screenshotsVerified: browserSmoke.webapp.screenshots.concat(browserSmoke.github.screenshots),
  notProvenNow: [
    'live VS Code or OpenVSX runtime UI proof',
    'platform-wide investor-grade proof across every shipped surface'
  ]
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(smokeReportPath, JSON.stringify(smokeReport, null, 2), 'utf8');

if (!skipDistChecks) {
  for (const name of expectedDist) {
    assert(fs.existsSync(path.join(distDir, name)), `Missing packaged artifact: ${name}`);
  }

  verifyZipContains(path.join(distDir, 'dead-route-detector-skyevsx-product-full.zip'), [
    'dead-route-detector-skyevsx-product/PROJECT_DOCS/DEAD_ROUTE_DETECTOR_IMPLEMENTATION_DIRECTIVE.md',
    'dead-route-detector-skyevsx-product/PROJECT_DOCS/DEAD_ROUTE_DETECTOR_SMOKE_REPORT.json',
    'dead-route-detector-skyevsx-product/PROJECT_DOCS/SMOKE_SCREENSHOTS/webapp-scan-initial.png',
    'dead-route-detector-skyevsx-product/PROJECT_DOCS/SMOKE_SCREENSHOTS/webapp-scan-after-compare.png',
    'dead-route-detector-skyevsx-product/PROJECT_DOCS/SMOKE_SCREENSHOTS/github-wrapper-pr-compare.png',
    'dead-route-detector-skyevsx-product/scripts/smoke.mjs',
    'dead-route-detector-skyevsx-product/scripts/browser-smoke.mjs',
    'dead-route-detector-skyevsx-product/scripts/browser-smoke-real.py',
    'dead-route-detector-skyevsx-product/scripts/extension-host-smoke.mjs',
    'dead-route-detector-skyevsx-product/scripts/cli.mjs',
    'dead-route-detector-skyevsx-product/scripts/cli-smoke.mjs'
  ]);
}

console.log('Smoke passed:', smokeReportPath);
