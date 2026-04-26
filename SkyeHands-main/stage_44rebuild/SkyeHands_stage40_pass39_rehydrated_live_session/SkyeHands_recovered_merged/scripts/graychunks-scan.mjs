#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanGrayChunks, writeGrayChunkReports, makeRelative, resolveSafeTargetDir } from './graychunks-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetArg = process.argv.find((arg) => arg.startsWith('--target='));
let targetDir = root;

try {
  targetDir = resolveSafeTargetDir(root, targetArg ? targetArg.slice('--target='.length) : '', { enforceWithinRoot: false });
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', error: 'invalid_target', detail: String(error?.message || error) }, null, 2));
  process.exit(1);
}

const report = scanGrayChunks({ rootDir: root, targetDir });
const outputs = writeGrayChunkReports({ rootDir: root, report });

console.log(JSON.stringify({
  status: report.issueCount > 0 ? 'FAIL' : 'PASS',
  scannedFiles: report.scannedFiles,
  issueCount: report.issueCount,
  issuesByType: report.issuesByType,
  targetDir: makeRelative(root, targetDir),
  outputs: {
    json: makeRelative(root, outputs.jsonPath),
    markdown: makeRelative(root, outputs.mdPath)
  }
}, null, 2));

if (report.issueCount > 0) process.exit(2);
