import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const productRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cliPath = path.join(productRoot, 'scripts', 'cli.mjs');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dead-route-detector-cli-smoke-'));
const healthyDir = path.join(productRoot, 'examples', 'healthy-static-site');
const brokenDir = path.join(productRoot, 'examples', 'broken-ui');
const zipPath = path.join(tempDir, 'broken-ui.zip');

function runNode(args) {
  return spawnSync('node', args, { cwd: productRoot, encoding: 'utf8' });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const healthyJson = path.join(tempDir, 'healthy-report.json');
const healthyMd = path.join(tempDir, 'healthy-report.md');
const healthySarif = path.join(tempDir, 'healthy-report.sarif');
const brokenJson = path.join(tempDir, 'broken-report.json');
const brokenMd = path.join(tempDir, 'broken-report.md');
const brokenSarif = path.join(tempDir, 'broken-report.sarif');
const brokenZipJson = path.join(tempDir, 'broken-zip-report.json');
const diffJson = path.join(tempDir, 'regression-diff.json');
const diffMd = path.join(tempDir, 'regression-diff.md');
const reviewCommentMd = path.join(tempDir, 'review-comment.md');

execFileSync('zip', ['-qr', zipPath, path.basename(brokenDir)], { cwd: path.dirname(brokenDir) });

const healthyRun = runNode([cliPath, 'scan', healthyDir, '--json', healthyJson, '--markdown', healthyMd, '--sarif', healthySarif, '--summary']);
assert(healthyRun.status === 0, `Healthy CLI scan should exit 0, got ${healthyRun.status}. stderr: ${healthyRun.stderr}`);
const healthyReport = JSON.parse(fs.readFileSync(healthyJson, 'utf8'));
assert(healthyReport.summary.deadRouteReferences === 0, 'Healthy CLI scan report should have zero dead routes');
assert(fs.readFileSync(healthyMd, 'utf8').includes('# Dead Route Detector Report'), 'Healthy CLI markdown missing heading');
assert(JSON.parse(fs.readFileSync(healthySarif, 'utf8')).runs[0].tool.driver.name === 'Dead Route Detector - SkyeVSX', 'Healthy CLI SARIF missing driver');

const brokenRun = runNode([cliPath, 'scan', brokenDir, '--json', brokenJson, '--markdown', brokenMd, '--sarif', brokenSarif, '--summary']);
assert(brokenRun.status === 2, `Broken CLI scan should exit 2, got ${brokenRun.status}. stderr: ${brokenRun.stderr}`);
const brokenReport = JSON.parse(fs.readFileSync(brokenJson, 'utf8'));
assert(brokenReport.summary.deadRouteReferences === 4, 'Broken CLI scan should report four dead routes');
assert(fs.readFileSync(brokenMd, 'utf8').includes('/ghost'), 'Broken CLI markdown missing proof issue');
assert(JSON.parse(fs.readFileSync(brokenSarif, 'utf8')).runs[0].results.length >= 7, 'Broken CLI SARIF missing findings');

const brokenZipRun = runNode([cliPath, 'scan', zipPath, '--json', brokenZipJson]);
assert(brokenZipRun.status === 2, `Broken zip CLI scan should exit 2, got ${brokenZipRun.status}. stderr: ${brokenZipRun.stderr}`);
const brokenZipReport = JSON.parse(fs.readFileSync(brokenZipJson, 'utf8'));
assert(brokenZipReport.summary.deadRouteReferences === 4, 'Broken zip CLI scan should report four dead routes');

const compareRun = runNode([cliPath, 'compare', '--baseline', healthyJson, '--candidate', brokenJson, '--json', diffJson, '--markdown', diffMd]);
assert(compareRun.status === 3, `CLI compare should exit 3, got ${compareRun.status}. stderr: ${compareRun.stderr}`);
const diffReport = JSON.parse(fs.readFileSync(diffJson, 'utf8'));
assert(diffReport.addedIssueCount >= 7, 'CLI compare diff should surface added regression issues');
assert(fs.readFileSync(diffMd, 'utf8').includes('Regression Diff'), 'CLI compare markdown missing regression heading');

const reviewRun = runNode([cliPath, 'review-comment', '--baseline', healthyJson, '--candidate', brokenJson, '--markdown', reviewCommentMd, '--owner', 'acme', '--repo', 'route-lab', '--pull', '17']);
assert(reviewRun.status === 3, `CLI review-comment should exit 3, got ${reviewRun.status}. stderr: ${reviewRun.stderr}`);
const reviewComment = fs.readFileSync(reviewCommentMd, 'utf8');
assert(reviewComment.includes('acme/route-lab #17'), 'CLI review comment missing repo and PR context');
assert(reviewComment.includes('/ghost'), 'CLI review comment missing proof regression issue');

const result = {
  status: 'pass',
  tempDir,
  commandsVerified: [
    'scan folder to json',
    'scan folder to markdown',
    'scan folder to sarif',
    'scan zip archive',
    'compare baseline to candidate',
    'render PR review comment markdown'
  ],
  exitCodesVerified: {
    healthyScan: healthyRun.status,
    brokenScan: brokenRun.status,
    brokenZipScan: brokenZipRun.status,
    compare: compareRun.status,
    reviewComment: reviewRun.status
  },
  reportSummaries: {
    healthy: healthyReport.summary,
    broken: brokenReport.summary,
    brokenZip: brokenZipReport.summary,
    diff: {
      addedIssueCount: diffReport.addedIssueCount,
      resolvedIssueCount: diffReport.resolvedIssueCount
    }
  },
  outputFiles: {
    healthyJson,
    healthyMarkdown: healthyMd,
    healthySarif,
    brokenJson,
    brokenMarkdown: brokenMd,
    brokenSarif,
    brokenZipJson,
    diffJson,
    diffMarkdown: diffMd,
    reviewCommentMarkdown: reviewCommentMd
  }
};

console.log(JSON.stringify(result, null, 2));
