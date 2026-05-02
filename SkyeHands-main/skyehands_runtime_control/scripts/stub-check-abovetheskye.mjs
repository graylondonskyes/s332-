#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(runtimeRoot, '..');
const platformsRoot = path.join(repoRoot, 'AbovetheSkye-Platforms');
const proofDir = path.join(runtimeRoot, '.skyequanta', 'proofs');
const outFile = path.join(proofDir, 'abovetheskye-stub-check.json');

const SKIP_DIRS = new Set(['.git', '.next', '.netlify', '.ms-playwright', '.phc_app_fabric_v83_smoke', '.phc_data_v83_smoke', '.venv', 'coverage', 'dist', 'node_modules', 'vendor']);
const FILE_EXTENSIONS = new Set(['.cjs', '.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.ts', '.tsx']);
const HARD_PATTERNS = [
  { id: 'not-wired', re: /\bnot wired\b/i },
  { id: 'fake', re: /\bfake\b/i },
  { id: 'stub', re: /\bstub(?:bed)?\b/i },
  { id: 'mock-route', re: /\bmock (?:api|route|layer|service|data|response|backend)\b/i },
  { id: 'demo-only', re: /\bdemo only\b/i },
  { id: 'coming-soon', re: /\bcoming soon\b/i },
  { id: 'placeholder-secret', re: /\bplaceholder (?:key|secret|token|credential|password)\b/i },
];
const SOFT_PATTERNS = [
  { id: 'todo', re: /\bTODO\b/ },
  { id: 'fixme', re: /\bFIXME\b/ },
  { id: 'hardcoded', re: /\bhardcoded\b/i },
  { id: 'simulation', re: /\bsimulation\b/i },
];

function listPlatformDirs() {
  if (!fs.existsSync(platformsRoot)) return [];
  return fs.readdirSync(platformsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, root: path.join(platformsRoot, entry.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function walkFiles(root, files = []) {
  if (!fs.existsSync(root)) return files;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) walkFiles(full, files);
    else if (entry.isFile() && FILE_EXTENSIONS.has(path.extname(entry.name))) files.push(full);
  }
  return files;
}

function isLikelyUiPlaceholder(line) {
  return /placeholder\s*=|placeholder:|::placeholder|placeholder-text|placeholder\d*/i.test(line)
    && !/placeholder (?:key|secret|token|credential|password)/i.test(line);
}

function isAntiTheaterStatement(line) {
  return /\b(not|no|without|blocks?|prevents?|refuses?|stripped|removed|avoid|avoids|instead of|rather than)\b.{0,80}\b(fake|mock|stub|placeholder)\b/i.test(line)
    || /\b(fake|mock|stub|placeholder)\b.{0,80}\b(not|removed|stripped|disabled|replaced|avoided|refuses)\b/i.test(line);
}

function isAntiHardcodedStatement(line) {
  return /\b(no longer|not|never|instead of|rather than|without|avoids?|replaced|removed|obey)\b.{0,100}\bhardcoded\b/i.test(line)
    || /\bhardcoded\b.{0,100}\b(no longer|not|never|instead|replaced|removed|avoided)\b/i.test(line);
}

function classifyLine(line) {
  if (isLikelyUiPlaceholder(line)) return [];
  if (isAntiTheaterStatement(line)) return [];
  if (isAntiHardcodedStatement(line)) return [];
  return [
    ...HARD_PATTERNS.filter((pattern) => pattern.re.test(line)).map((pattern) => ({ severity: 'hard', id: pattern.id })),
    ...SOFT_PATTERNS.filter((pattern) => pattern.re.test(line)).map((pattern) => ({ severity: 'soft', id: pattern.id })),
  ];
}

function scanFile(filePath, platformRoot) {
  if (/graychunks-findings\.json$|stub-check.*\.json$|[/\\]proofs?[/\\].*\.json$|[/\\]snapshots?[/\\]/i.test(filePath)) return [];
  let text = '';
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }
  const rel = path.relative(platformRoot, filePath);
  const findings = [];
  text.split(/\r?\n/).forEach((line, index) => {
    for (const hit of classifyLine(line)) {
      findings.push({
        file: rel,
        line: index + 1,
        severity: hit.severity,
        signal: hit.id,
        text: line.trim().slice(0, 220),
      });
    }
  });
  return findings;
}

function readPackage(platformRoot) {
  const file = path.join(platformRoot, 'package.json');
  if (!fs.existsSync(file)) return null;
  try {
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { name: pkg.name || null, version: pkg.version || null, scripts: Object.keys(pkg.scripts || {}).sort() };
  } catch {
    return { invalid: true };
  }
}

const platforms = listPlatformDirs().map((platform) => {
  const files = walkFiles(platform.root);
  const findings = files.flatMap((file) => scanFile(file, platform.root));
  const hardFindings = findings.filter((item) => item.severity === 'hard');
  const softFindings = findings.filter((item) => item.severity === 'soft');
  return {
    name: platform.name,
    relativeRoot: path.relative(repoRoot, platform.root),
    fileCount: files.length,
    package: readPackage(platform.root),
    hardFindingCount: hardFindings.length,
    softFindingCount: softFindings.length,
    topHardFindings: hardFindings.slice(0, 12),
    topSoftFindings: softFindings.slice(0, 12),
  };
});

const result = {
  generatedAt: new Date().toISOString(),
  smoke: 'abovetheskye-stub-check',
  platformsRoot: path.relative(repoRoot, platformsRoot),
  checkedPlatformCount: platforms.length,
  totals: {
    files: platforms.reduce((sum, platform) => sum + platform.fileCount, 0),
    hardFindings: platforms.reduce((sum, platform) => sum + platform.hardFindingCount, 0),
    softFindings: platforms.reduce((sum, platform) => sum + platform.softFindingCount, 0),
  },
  highestRiskPlatforms: platforms
    .filter((platform) => platform.hardFindingCount > 0 || platform.softFindingCount > 0)
    .sort((a, b) => (b.hardFindingCount - a.hardFindingCount) || (b.softFindingCount - a.softFindingCount))
    .slice(0, 15)
    .map((platform) => ({
      name: platform.name,
      hardFindingCount: platform.hardFindingCount,
      softFindingCount: platform.softFindingCount,
      firstHardFinding: platform.topHardFindings[0] || null,
    })),
  platforms,
  passed: platforms.length > 0,
};

fs.mkdirSync(proofDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  generatedAt: result.generatedAt,
  checkedPlatformCount: result.checkedPlatformCount,
  totals: result.totals,
  highestRiskPlatforms: result.highestRiskPlatforms,
  proof: path.relative(runtimeRoot, outFile),
  passed: result.passed,
}, null, 2));

if (!result.passed) process.exit(1);
