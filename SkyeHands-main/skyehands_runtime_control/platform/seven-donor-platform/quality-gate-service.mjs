import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { repoRoot } from '../../scripts/repo-paths.mjs';

const require = createRequire(import.meta.url);

export const PLATFORM_DIR = path.resolve(repoRoot(), 'platform/seven-donor-platform');
export const REGISTRY_PATH = path.join(PLATFORM_DIR, 'registry.json');
export const PROOFS_DIR = path.resolve(repoRoot(), '.skyequanta/proofs');
export const QUALITY_PROOFS_DIR = path.join(PROOFS_DIR, 'skye-forge-max-quality-gate');

const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.html', '.htm', '.vue', '.svelte', '.astro', '.md', '.txt', '.css'
]);

const SKIP_NAMES = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.turbo', '.cache', 'coverage', 'out']);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}

function skyeHandsRoot() {
  return path.resolve(repoRoot(), '..');
}

function workspaceRootFromRegistry(registry) {
  const marker = 'SkyeHands-main/';
  const source = registry.unpackedRoot || registry.sourceWorkspace || '';
  const relativeToSkyeHands = source.includes(marker) ? source.slice(source.indexOf(marker) + marker.length) : source;
  return path.resolve(skyeHandsRoot(), relativeToSkyeHands);
}

function resolveScannerPaths(registry) {
  const unpackedRoot = workspaceRootFromRegistry(registry);
  const qualityFamily = registry.families.find((family) => family.familyId === 'skye.quality.gate');
  if (!qualityFamily) throw new Error('Missing skye.quality.gate family in seven donor registry.');
  const donorRoot = path.join(unpackedRoot, qualityFamily.unpackedPath);
  return {
    scannerPath: path.join(donorRoot, 'extensions/dead-route-detector-skyevsx/lib/scanner.js'),
    reportToolsPath: path.join(donorRoot, 'shared/report-tools.js')
  };
}

function loadScanner(registry) {
  const { scannerPath, reportToolsPath } = resolveScannerPaths(registry);
  if (!fs.existsSync(scannerPath)) throw new Error(`Dead Route scanner entrypoint not found: ${scannerPath}`);
  if (!fs.existsSync(reportToolsPath)) throw new Error(`Dead Route report tools not found: ${reportToolsPath}`);
  return {
    scanner: require(scannerPath),
    reportTools: require(reportToolsPath)
  };
}

function countFiles(rootDir) {
  const counts = {
    totalFiles: 0,
    textFiles: 0
  };
  const stack = [rootDir];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (SKIP_NAMES.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
      } else if (entry.isFile()) {
        counts.totalFiles += 1;
        if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) counts.textFiles += 1;
      }
    }
  }
  return counts;
}

function commandFindingCount(report) {
  return (report.summary.unregisteredContributedCommands || 0)
    + (report.summary.deadExecutedCommands || 0)
    + (report.summary.deadMenuCommands || 0)
    + (report.summary.deadKeybindingCommands || 0);
}

export function loadSevenDonorRegistry() {
  return readJson(REGISTRY_PATH);
}

export function listDonors(registry = loadSevenDonorRegistry()) {
  const unpackedRoot = workspaceRootFromRegistry(registry);
  return registry.families.map((family) => {
    const absolutePath = path.join(unpackedRoot, family.unpackedPath);
    const exists = fs.existsSync(absolutePath);
    const counts = exists ? countFiles(absolutePath) : { totalFiles: 0, textFiles: 0 };
    return {
      platformId: family.platformId,
      familyId: family.familyId,
      name: family.name,
      sourceDonor: family.sourceDonor,
      status: family.status,
      targetSurfaces: family.targetSurfaces || [],
      unpackedPath: family.unpackedPath,
      absolutePath,
      exists,
      ...counts
    };
  });
}

export function writeInventoryProof() {
  const registry = loadSevenDonorRegistry();
  const donors = listDonors(registry);
  const proof = {
    proofType: 'seven-donor-inventory',
    generatedAt: new Date().toISOString(),
    runtimeAuthority: registry.runtimeAuthority,
    registryVersion: registry.registryVersion,
    unpackedRoot: workspaceRootFromRegistry(registry),
    donorCount: donors.length,
    missingDonorCount: donors.filter((donor) => !donor.exists).length,
    donors
  };
  const outputPath = path.join(PROOFS_DIR, 'skye-forge-max-inventory.json');
  writeText(outputPath, JSON.stringify(proof, null, 2));
  return { proof, outputPath };
}

export function scanDonor(donor, context) {
  if (!donor.exists) {
    throw new Error(`Cannot scan missing donor ${donor.platformId}: ${donor.absolutePath}`);
  }
  const report = context.scanner.scanWorkspaceFromPath(donor.absolutePath, {
    workspaceName: donor.platformId,
    workspaceRoot: donor.absolutePath
  });
  const issues = context.reportTools.collectIssues(report);
  const safeId = donor.platformId.replace(/[^a-z0-9._-]+/gi, '-');
  const basePath = path.join(context.runDir, safeId);
  const jsonPath = `${basePath}.json`;
  const markdownPath = `${basePath}.md`;
  const sarifPath = `${basePath}.sarif.json`;
  writeText(jsonPath, JSON.stringify(report, null, 2));
  writeText(markdownPath, context.reportTools.renderReportMarkdown(report));
  writeText(sarifPath, JSON.stringify(context.reportTools.toSarif(report), null, 2));
  return {
    platformId: donor.platformId,
    familyId: donor.familyId,
    name: donor.name,
    sourceDonor: donor.sourceDonor,
    scannedPath: donor.absolutePath,
    artifacts: {
      json: path.relative(repoRoot(), jsonPath),
      markdown: path.relative(repoRoot(), markdownPath),
      sarif: path.relative(repoRoot(), sarifPath)
    },
    summary: {
      filesScanned: report.summary.filesScanned,
      routesDeclared: report.summary.routesDeclared,
      routeReferences: report.summary.routeReferences,
      deadRouteReferences: report.summary.deadRouteReferences,
      orphanRoutes: report.summary.orphanRoutes,
      placeholderControls: report.summary.placeholderControls,
      deadCommandFindings: commandFindingCount(report),
      totalFindings: issues.length
    }
  };
}

export function runQualityGate(options = {}) {
  const registry = loadSevenDonorRegistry();
  const donors = listDonors(registry);
  const targetIds = new Set(options.platformIds || []);
  const selectedDonors = targetIds.size ? donors.filter((donor) => targetIds.has(donor.platformId) || targetIds.has(donor.familyId)) : donors;
  if (!selectedDonors.length) {
    throw new Error(`No donors matched requested ids: ${Array.from(targetIds).join(', ')}`);
  }

  const runId = options.runId || new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(QUALITY_PROOFS_DIR, runId);
  const { scanner, reportTools } = loadScanner(registry);
  const context = { runId, runDir, scanner, reportTools };
  const results = selectedDonors.map((donor) => scanDonor(donor, context));
  const manifest = {
    proofType: 'seven-donor-quality-gate',
    generatedAt: new Date().toISOString(),
    runId,
    runtimeAuthority: registry.runtimeAuthority,
    scannerSource: 'dead-route-detector-skyevsx-product-proofpack-v0.6.0.zip',
    scannedDonorCount: results.length,
    failedDonorCount: 0,
    totalFindings: results.reduce((sum, result) => sum + result.summary.totalFindings, 0),
    results
  };
  const manifestPath = path.join(runDir, 'manifest.json');
  const latestPath = path.join(PROOFS_DIR, 'skye-forge-max-quality-gate-latest.json');
  writeText(manifestPath, JSON.stringify(manifest, null, 2));
  writeText(latestPath, JSON.stringify(manifest, null, 2));
  return { manifest, manifestPath, latestPath, runDir };
}
