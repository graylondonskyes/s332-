#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadGrayChunksConfig, resolveOwner } from './graychunks-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const findingsPath = path.join(root, 'skydexia', 'alerts', 'graychunks-findings.json');
const outPath = path.join(root, 'skydexia', 'alerts', 'graychunks-priority-queue.json');

if (!fs.existsSync(findingsPath)) {
  console.error('graychunks-findings.json is missing; run graychunks:scan first.');
  process.exit(1);
}

const findings = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
const config = loadGrayChunksConfig(root);
const severityByType = config.severityByType || {};
const scoreBySeverity = { critical: 100, high: 70, medium: 40, low: 10 };

const queue = (findings.issues || []).map((issue, index) => {
  const severity = severityByType[issue.type] || 'low';
  return {
    id: `gc_${index + 1}`,
    type: issue.type,
    severity,
    priorityScore: scoreBySeverity[severity],
    file: issue.file,
    line: issue.line,
    message: issue.message,
    owner: resolveOwner(issue.file, config.ownershipRules),
    suggestedFix: issue.type === 'duplicate_import'
      ? 'Run graychunks:autofix and verify import graph compiles.'
      : issue.type === 'duplicate_object_key'
        ? 'Remove duplicate object keys and preserve canonical value.'
      : issue.type === 'broken_jsx_structure'
          ? 'Repair JSX tag structure and verify render path in UI smoke.'
      : issue.type === 'repeated_chunk'
          ? 'Extract repeated lines into a shared helper or remove duplicate block.'
          : 'Consolidate duplicate config keys into a single authoritative key.'
  };
});

queue.sort((a, b) => b.priorityScore - a.priorityScore);
const top = queue.slice(0, 300);

const payload = {
  generatedAt: new Date().toISOString(),
  configPath: config.configPath ? path.relative(root, config.configPath).replace(/\\/g, '/') : null,
  scannedFiles: findings.scannedFiles,
  totalIssues: findings.issueCount,
  queuedIssues: top.length,
  summaryBySeverity: top.reduce((acc, item) => {
    acc[item.severity] = (acc[item.severity] || 0) + 1;
    return acc;
  }, {}),
  queue: top
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: 'PASS', output: path.relative(root, outPath).replace(/\\/g, '/'), queuedIssues: top.length }, null, 2));
