import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function repoRoot() {
  return path.resolve(__dirname, '..');
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function exists(relativeOrAbsolutePath, base = repoRoot()) {
  return fs.existsSync(path.isAbsolute(relativeOrAbsolutePath) ? relativeOrAbsolutePath : path.join(base, relativeOrAbsolutePath));
}

export function loadRepoConfig() {
  const root = repoRoot();
  const configPath = path.join(root, 'skyehands.repo.config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing repo config: ${configPath}`);
  }
  return readJson(configPath);
}

function isAppRoot(candidate) {
  if (!candidate || !fs.existsSync(candidate)) return false;
  const pkg = path.join(candidate, 'package.json');
  return fs.existsSync(pkg);
}

export function findAppRoot() {
  const root = repoRoot();
  const config = loadRepoConfig();
  const envName = config.allowedAppRootEnv || 'SKYEHANDS_APP_ROOT';
  const envValue = process.env[envName];
  const candidates = [];

  if (envValue) candidates.push(path.resolve(root, envValue));
  if (config.canonicalAppRoot) candidates.push(path.resolve(root, config.canonicalAppRoot));
  candidates.push(root);

  for (const candidate of candidates) {
    if (isAppRoot(candidate)) return candidate;
  }

  throw new Error(`Unable to find SkyeHands app root. Checked: ${candidates.join(', ')}`);
}

export function appRelativeRoot() {
  return path.relative(repoRoot(), findAppRoot()) || '.';
}

export function appPackage() {
  const appRoot = findAppRoot();
  return readJson(path.join(appRoot, 'package.json'));
}

export function walkFiles(startDir, options = {}) {
  const root = path.resolve(startDir);
  const maxEntries = options.maxEntries ?? 50000;
  const skipNames = new Set(options.skipNames || ['.git', 'node_modules']);
  const out = [];
  const stack = [root];

  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (skipNames.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
      } else if (entry.isFile()) {
        out.push(absolute);
        if (out.length >= maxEntries) return out;
      }
    }
  }

  return out;
}

export function fileContainsAny(filePath, terms) {
  let text = '';
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return false;
  }
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(String(term).toLowerCase()));
}
