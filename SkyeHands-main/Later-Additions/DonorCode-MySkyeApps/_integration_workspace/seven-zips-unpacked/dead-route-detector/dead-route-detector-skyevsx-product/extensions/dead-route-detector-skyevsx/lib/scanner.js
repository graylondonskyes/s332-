const fs = require('node:fs');
const path = require('node:path');
const core = require('../../../shared/scanner-core');

const TEXT_EXTENSIONS = new Set(core.TEXT_EXTENSIONS);
const DEFAULT_EXCLUDES = new Set(core.DEFAULT_EXCLUDES);

function collectFiles(rootDir, excludes = DEFAULT_EXCLUDES) {
  const results = [];
  const walk = (current) => {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (excludes.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(absolute);
      }
    }
  };
  walk(rootDir);
  return results;
}

function scanWorkspaceFromPath(rootDir, options = {}) {
  const excludes = new Set(Array.isArray(options.exclude) && options.exclude.length ? options.exclude : Array.from(DEFAULT_EXCLUDES));
  const files = collectFiles(rootDir, excludes);
  const entries = files.map((absoluteFile) => ({
    path: path.relative(rootDir, absoluteFile).replace(/\\/g, '/'),
    text: fs.readFileSync(absoluteFile, 'utf8')
  }));
  return core.scanWorkspaceEntries(entries, {
    ...options,
    workspaceRoot: rootDir,
    workspaceName: options.workspaceName || path.basename(rootDir)
  });
}

module.exports = {
  scanWorkspaceFromPath,
  normalizeLocalPath: core.normalizeLocalPath,
  normalizeReferencePath: core.normalizeReferencePath,
  matchesDeclaredRoute: core.matchesDeclaredRoute,
  scanWorkspaceEntries: core.scanWorkspaceEntries
};
