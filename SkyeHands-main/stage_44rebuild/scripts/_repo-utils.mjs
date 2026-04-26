import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const repoRoot = path.resolve(__dirname, '..');

const CANDIDATE_APP_ROOTS = [
  'SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged',
  'SkyeHands_recovered_merged',
  'app',
  '.'
];

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function looksLikeAppRoot(candidateAbs) {
  const pkgPath = path.join(candidateAbs, 'package.json');
  const pkg = readJsonSafe(pkgPath);
  if (!pkg || !pkg.scripts || typeof pkg.scripts !== 'object') return false;
  const hasCoreScripts = ['doctor', 'operator:start', 'ship:candidate'].every((key) => key in pkg.scripts);
  const hasSkyequanta = fs.existsSync(path.join(candidateAbs, 'skyequanta.mjs')) || fs.existsSync(path.join(candidateAbs, 'apps', 'skyequanta-shell'));
  return hasCoreScripts && hasSkyequanta;
}

export function findAppRoot() {
  if (process.env.SKYEHANDS_APP_ROOT) {
    const abs = path.resolve(repoRoot, process.env.SKYEHANDS_APP_ROOT);
    if (!fs.existsSync(abs)) {
      throw new Error(`SKYEHANDS_APP_ROOT does not exist: ${process.env.SKYEHANDS_APP_ROOT}`);
    }
    return abs;
  }

  for (const rel of CANDIDATE_APP_ROOTS) {
    const abs = path.resolve(repoRoot, rel);
    if (looksLikeAppRoot(abs)) return abs;
  }

  const queue = [repoRoot];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    if (looksLikeAppRoot(current)) return current;

    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.skyequanta')) continue;
      const next = path.join(current, entry.name);
      const depth = path.relative(repoRoot, next).split(path.sep).filter(Boolean).length;
      if (depth <= 4) queue.push(next);
    }
  }

  throw new Error('Unable to locate the canonical SkyeHands application root.');
}

export function getAppPackage() {
  const appRoot = findAppRoot();
  const pkgPath = path.join(appRoot, 'package.json');
  const pkg = readJsonSafe(pkgPath);
  if (!pkg) {
    throw new Error(`Unable to parse package.json at ${pkgPath}`);
  }
  return { appRoot, pkgPath, pkg };
}

export function listAppScripts() {
  const { pkg } = getAppPackage();
  return Object.keys(pkg.scripts || {}).sort();
}

export function runInApp(args, options = {}) {
  const { appRoot } = getAppPackage();
  const result = spawnSync(args[0], args.slice(1), {
    cwd: appRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...(options.env || {}) }
  });

  if (result.error) throw result.error;
  return result.status ?? 0;
}

export function relativeToRepo(absPath) {
  return path.relative(repoRoot, absPath) || '.';
}
