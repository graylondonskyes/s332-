#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(runtimeRoot, '..');
const proofDir = path.join(runtimeRoot, '.skyequanta', 'proofs');
const outFile = path.join(proofDir, 'repo-doctor.json');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

const pkg = readJson(path.join(runtimeRoot, 'package.json'));
const scripts = pkg?.scripts || {};
const localScriptRefs = Object.entries(scripts)
  .map(([name, command]) => {
    const match = /^node \.\/(scripts\/[^ ]+\.mjs)\b/.exec(command);
    if (!match) return null;
    return { name, file: match[1], exists: fs.existsSync(path.join(runtimeRoot, match[1])) };
  })
  .filter(Boolean);

const requiredPaths = [
  'skyequanta.mjs',
  'package.json',
  '../AbovetheSkye-Platforms',
  '../Dynasty-Versions/package.json',
  '../Dynasty-Versions/platform/user-platforms/REGISTRY.json',
];

const requiredScripts = [
  'repo:doctor',
  'repo:clean',
  'repo:smoke',
  'smoke:abovetheskye-mesh',
  'smoke:company-flow',
  'smoke:creator-ide-mesh',
  'smoke:platform-bus-bridge',
  'smoke:platform-registry-sync',
  'smoke:skyewebcreator',
  'smoke:gateway-additive-routes',
  'typecheck:gateway-additive-packs',
  'stub-check:abovetheskye',
];

const missingPaths = requiredPaths.filter((relativePath) => !fs.existsSync(path.join(runtimeRoot, relativePath)));
const missingScripts = requiredScripts.filter((scriptName) => !scripts[scriptName]);
const missingLocalScriptFiles = localScriptRefs.filter((ref) => !ref.exists);

const result = {
  generatedAt: new Date().toISOString(),
  smoke: 'repo-doctor',
  runtimeRoot: path.relative(repoRoot, runtimeRoot),
  checkedLocalScriptCount: localScriptRefs.length,
  checks: {
    packageReadable: !!pkg,
    requiredPathsPresent: missingPaths.length === 0,
    requiredScriptsPresent: missingScripts.length === 0,
    referencedLocalScriptsPresent: missingLocalScriptFiles.length === 0,
  },
  missingPaths,
  missingScripts,
  missingLocalScriptFiles,
};

result.passed = Object.values(result.checks).every(Boolean);

fs.mkdirSync(proofDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ...result, proof: path.relative(runtimeRoot, outFile) }, null, 2));

if (!result.passed) process.exit(1);
