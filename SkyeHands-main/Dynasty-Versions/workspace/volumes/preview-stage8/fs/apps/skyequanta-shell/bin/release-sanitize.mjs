#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getStackConfig } from './config.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function parseArgs(argv) {
  const options = {
    json: false,
    strict: false,
    outputDir: null,
    archiveFile: null
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') {
      options.json = true;
      continue;
    }
    if (value === '--strict') {
      options.strict = true;
      continue;
    }
    if ((value === '--output-dir' || value === '--output') && argv[index + 1]) {
      options.outputDir = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (value.startsWith('--output-dir=')) {
      options.outputDir = String(value.split('=').slice(1).join('=')).trim();
      continue;
    }
    if ((value === '--archive' || value === '--archive-file') && argv[index + 1]) {
      options.archiveFile = String(argv[index + 1]).trim();
      index += 1;
      continue;
    }
    if (value.startsWith('--archive=')) {
      options.archiveFile = String(value.split('=').slice(1).join('=')).trim();
    }
  }
  return options;
}

function getCurrentTruthDocs() {
  return new Set([
    'docs/ARCHITECTURE_OVERVIEW.html',
    'docs/ARTIFACT_MANIFEST_SPEC.md',
    'docs/CANONICAL_OPERATOR_SURFACE.md',
    'docs/CANONICAL_RUNTIME_PATHS.md',
    'docs/CLAIMS_REGISTER.md',
    'docs/CURRENT_TRUTH_INDEX.md',
    'docs/DEPLOYMENT_MODES.md',
    'docs/FIRST_RUN_OPERATOR_CHECKLIST.md',
    'docs/GATE_RUNTIME_MODES.md',
    'docs/IDE_AGENT_CONVERGENCE_CONTRACT.md',
    'docs/LAUNCH_READINESS.md',
    'docs/NONEXPERT_OPERATOR_QUICKSTART.md',
    'docs/PREVIEW_ROUTING_CONTRACT.md',
    'docs/PROCUREMENT_PACKET_INDEX.md',
    'docs/SKYEHANDS_BRIDGE_RUNTIME_CLOSURE_DIRECTIVE.md',
    'docs/SKYEHANDS_SOVEREIGN_PROVIDER_BINDINGS_IMPLEMENTATION_DIRECTIVE.md',
    'docs/VENDOR_DETACHMENT.md',
    'docs/VERSION_STAMP.json',
    'docs/hardening/SKYEHANDS_SKEPTIC_PROOF_HARDENING_DIRECTIVE.md',
    'docs/hardening/SECTION_38_PRODUCTION_HARDENING_PLUS_DIRECTIVE.md',
    'docs/hardening/SECTION_39_RUNTIME_ISOLATION_AND_TENANT_PROOF_DIRECTIVE.md',
    'docs/hardening/SECTION_40_RUNTIME_RECOVERY_AND_DR_DIRECTIVE.md',
    'docs/hardening/SECTION_41_ROOTLESS_NAMESPACE_AND_DEPLOY_TRUST_DIRECTIVE.md',
    'docs/hardening/SECTION_42_KERNEL_CONTAINMENT_AND_ARTIFACT_IDENTITY_DIRECTIVE.md'
  ]);
}

function shouldIncludeRelativePath(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
  const topLevel = normalized.split('/')[0];
  const allowedTopLevel = new Set(['apps', 'branding', 'config', 'docs', 'platform', 'public', 'scripts', 'src', '.devcontainer']);
  if (!allowedTopLevel.has(topLevel)) {
    return false;
  }

  const segments = normalized.split('/');
  const bannedSegments = new Set(['.git', '.skyequanta', 'logs', 'node_modules', '__pycache__', 'reports']);
  if (segments.some(segment => bannedSegments.has(segment))) {
    return false;
  }
  if (normalized.startsWith('workspace/')) {
    return false;
  }
  if (normalized.startsWith('dist/')) {
    return false;
  }
  if (normalized.startsWith('docs/proof/')) {
    return false;
  }
  if (normalized.startsWith('docs/')) {
    if (normalized.startsWith('docs/hardening/')) {
      return true;
    }
    const currentTruthDocs = getCurrentTruthDocs();
    return currentTruthDocs.has(normalized);
  }
  return true;
}

function walkFiles(rootDir, rel = '.', bucket = { included: [], omitted: [] }) {
  const target = rel === '.' ? rootDir : path.join(rootDir, rel);
  const entries = fs.readdirSync(target, { withFileTypes: true });
  for (const entry of entries) {
    const childRel = rel === '.' ? entry.name : path.join(rel, entry.name);
    const normalized = childRel.replace(/\\/g, '/');
    if (!shouldIncludeRelativePath(normalized)) {
      bucket.omitted.push(normalized);
      continue;
    }
    const childPath = path.join(rootDir, childRel);
    if (entry.isDirectory()) {
      walkFiles(rootDir, childRel, bucket);
      continue;
    }
    bucket.included.push(normalized);
  }
  return bucket;
}

function createTarball(parentDir, sourceDir, archiveFile) {
  ensureDirectory(path.dirname(archiveFile));
  fs.rmSync(archiveFile, { force: true });
  const result = spawnSync('tar', ['-czf', archiveFile, '-C', parentDir, path.basename(sourceDir)], {
    cwd: parentDir,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(`tar failed for ${archiveFile}: ${result.stderr || result.stdout || 'unknown error'}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = getStackConfig(process.env);
  const outputDir = path.resolve(config.rootDir, options.outputDir || 'dist/production-release/skyequantacore-current-truth');
  const archiveFile = path.resolve(config.rootDir, options.archiveFile || 'dist/production-release/skyequantacore-current-truth.tar.gz');
  const manifestFile = path.join(path.dirname(outputDir), 'SANITIZED_RELEASE_MANIFEST.json');

  fs.rmSync(outputDir, { recursive: true, force: true });
  ensureDirectory(outputDir);

  const walked = walkFiles(config.rootDir);
  const includedFiles = [];
  for (const relativePath of walked.included.sort()) {
    const source = path.join(config.rootDir, relativePath);
    const dest = path.join(outputDir, relativePath);
    ensureDirectory(path.dirname(dest));
    fs.copyFileSync(source, dest);
    includedFiles.push({
      path: relativePath,
      sizeBytes: fs.statSync(source).size,
      sha256: sha256File(source)
    });
  }

  createTarball(path.dirname(outputDir), outputDir, archiveFile);

  const payload = {
    ok: true,
    generatedAt: new Date().toISOString(),
    productName: config.productName,
    outputDir: path.relative(config.rootDir, outputDir),
    archiveFile: path.relative(config.rootDir, archiveFile),
    includedFileCount: includedFiles.length,
    omittedCount: walked.omitted.length,
    excludedPatterns: [
      '.git',
      '.skyequanta',
      'logs',
      'reports',
      'docs/proof',
      'dist',
      'workspace runtime state',
      'historical stage docs/docx'
    ],
    includedFiles,
    omittedSample: walked.omitted.sort().slice(0, 200)
  };
  writeJson(manifestFile, payload);

  if (options.json) {
    console.log(JSON.stringify({ ...payload, manifestFile: path.relative(config.rootDir, manifestFile) }, null, 2));
  } else {
    console.log(`Current-truth sanitized release: ${path.relative(config.rootDir, outputDir)}`);
    console.log(`Archive: ${path.relative(config.rootDir, archiveFile)}`);
    console.log(`Manifest: ${path.relative(config.rootDir, manifestFile)}`);
  }

  if (options.strict && includedFiles.length === 0) {
    process.exitCode = 1;
  }
}

main();
