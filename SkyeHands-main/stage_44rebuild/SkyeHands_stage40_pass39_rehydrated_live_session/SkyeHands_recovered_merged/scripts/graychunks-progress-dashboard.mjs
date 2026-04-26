#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const findingsPath = path.join(root, 'skydexia', 'alerts', 'graychunks-findings.json');
const queuePath = path.join(root, 'skydexia', 'alerts', 'graychunks-priority-queue.json');
const dashboardJson = path.join(root, 'skydexia', 'alerts', 'graychunks-progress.json');
const dashboardMd = path.join(root, 'GRAYCHUNKS_PROGRESS.md');
const baselineArg = process.argv.find((arg) => arg.startsWith('--baseline='));
const baselinePath = baselineArg ? path.resolve(root, baselineArg.slice('--baseline='.length)) : dashboardJson;

const completion = spawnSync(process.execPath, [path.join(root, 'scripts', 'directive-completion.mjs')], { cwd: root, encoding: 'utf8' });
const completionPayload = JSON.parse(completion.stdout || '{}');
const findings = fs.existsSync(findingsPath) ? JSON.parse(fs.readFileSync(findingsPath, 'utf8')) : null;
const queue = fs.existsSync(queuePath) ? JSON.parse(fs.readFileSync(queuePath, 'utf8')) : null;
const previous = fs.existsSync(baselinePath) ? JSON.parse(fs.readFileSync(baselinePath, 'utf8')) : null;

function delta(current, prior) {
  if (typeof current !== 'number' || typeof prior !== 'number') return null;
  return current - prior;
}

function clamp(min, value, max) {
  return Math.max(min, Math.min(value, max));
}

function contenderGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

const issueDeltas = {};
for (const [type, count] of Object.entries(findings?.issuesByType || {})) {
  issueDeltas[type] = delta(count, previous?.graychunks?.issuesByType?.[type]);
}

const issueCount = Number(findings?.issueCount || 0);
const criticalQueued = Number(queue?.summaryBySeverity?.critical || 0);
const uncheckedItems = Number(completionPayload.uncheckedItems || 0);
const scorePenalty = Math.min(60, issueCount / 20)
  + Math.min(25, criticalQueued * 0.1)
  + Math.min(15, uncheckedItems * 1);
const contenderScore = clamp(0, Math.round(100 - scorePenalty), 100);

const payload = {
  generatedAt: new Date().toISOString(),
  directiveCompletion: {
    percent: completionPayload.completionPercent || null,
    checkedItems: completionPayload.checkedItems || null,
    totalItems: completionPayload.totalItems || null,
    uncheckedItems: completionPayload.uncheckedItems || null
  },
  graychunks: {
    scannedFiles: findings?.scannedFiles ?? null,
    issueCount: findings?.issueCount ?? null,
    issuesByType: findings?.issuesByType || {},
    queuedIssues: queue?.queuedIssues ?? null,
    summaryBySeverity: queue?.summaryBySeverity || {}
  },
  trend: {
    baselinePath: previous ? path.relative(root, baselinePath).replace(/\\/g, '/') : null,
    previousGeneratedAt: previous?.generatedAt || null,
    issueCountDelta: delta(findings?.issueCount, previous?.graychunks?.issueCount),
    queuedIssuesDelta: delta(queue?.queuedIssues, previous?.graychunks?.queuedIssues),
    issuesByTypeDelta: issueDeltas
  },
  contender: {
    score: contenderScore,
    grade: contenderGrade(contenderScore),
    penalties: {
      issueCount: Math.min(60, issueCount / 20),
      criticalQueued: Math.min(25, criticalQueued * 0.1),
      uncheckedItems: Math.min(15, uncheckedItems * 1)
    }
  }
};

fs.mkdirSync(path.dirname(dashboardJson), { recursive: true });
fs.writeFileSync(dashboardJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

const mdLines = [
  '# GrayChunks Progress Dashboard',
  '',
  `GeneratedAt: ${payload.generatedAt}`,
  `Directive completion: ${payload.directiveCompletion.percent}% (${payload.directiveCompletion.checkedItems}/${payload.directiveCompletion.totalItems})`,
  `Unchecked items: ${payload.directiveCompletion.uncheckedItems}`,
  '',
  `GrayChunks scanned files: ${payload.graychunks.scannedFiles}`,
  `GrayChunks issue count: ${payload.graychunks.issueCount}`,
  `GrayChunks queued issues: ${payload.graychunks.queuedIssues}`,
  `GrayChunks trend baseline: ${payload.trend.baselinePath || 'none'}`,
  `GrayChunks issue delta: ${payload.trend.issueCountDelta ?? 'n/a'}`,
  `GrayChunks queue delta: ${payload.trend.queuedIssuesDelta ?? 'n/a'}`,
  '',
  '## GrayChunks issue types',
  ...Object.entries(payload.graychunks.issuesByType).map(([k, v]) => `- ${k}: ${v}`),
  '',
  '## GrayChunks issue type deltas',
  ...Object.entries(payload.trend.issuesByTypeDelta).map(([k, v]) => `- ${k}: ${v ?? 'n/a'}`),
  '',
  '## Queue severity summary',
  ...Object.entries(payload.graychunks.summaryBySeverity).map(([k, v]) => `- ${k}: ${v}`),
  '',
  '## Contender score',
  `- Score: ${payload.contender.score}/100`,
  `- Grade: ${payload.contender.grade}`,
  `- Penalty(issue count): ${payload.contender.penalties.issueCount.toFixed(2)}`,
  `- Penalty(critical queued): ${payload.contender.penalties.criticalQueued.toFixed(2)}`,
  `- Penalty(unchecked directive items): ${payload.contender.penalties.uncheckedItems.toFixed(2)}`
];

fs.writeFileSync(dashboardMd, `${mdLines.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ status: 'PASS', json: path.relative(root, dashboardJson), markdown: path.relative(root, dashboardMd) }, null, 2));
