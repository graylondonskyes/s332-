#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const directivePath = path.join(root, 'ULTIMATE_SYSTEM_DIRECTIVE.md');
const taskRegex = /^(✅|⬜)\s+(P\d{3})\s+\|\s+(Easy|Medium|Complex)\s+\|\s+(.+)$/;
const smokeRefRegex = /`SMOKE:\s*([^`]+)`/;

const extractFileTokens = (smokeRef) => {
  const direct = smokeRef.split('+').map((token) => token.trim()).filter(Boolean);
  const extracted = [];
  for (const token of direct) {
    const matches = token.match(/[A-Za-z0-9_./-]+\.(?:md|json|mjs|yml|yaml)/g) || [];
    if (matches.length) extracted.push(...matches);
  }
  return [...new Set(extracted)];
};

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lines = fs.readFileSync(directivePath, 'utf8').split('\n');

const checked = lines
  .map((line, index) => ({ line, lineNumber: index + 1, match: line.match(taskRegex) }))
  .filter((row) => row.match && row.match[1] === '✅')
  .map((row) => {
    const smokeRef = row.line.match(smokeRefRegex)?.[1] ?? '';
    const fileTokens = extractFileTokens(smokeRef);
    return { patch: row.match[2], lineNumber: row.lineNumber, smokeRef, fileTokens };
  });

const artifactChecks = [];
for (const item of checked) {
  if (!item.smokeRef) {
    artifactChecks.push({ ...item, artifact: null, severity: 'error', issue: 'missing-smoke-ref' });
    continue;
  }

  if (item.fileTokens.length === 0) {
    artifactChecks.push({ ...item, artifact: null, severity: 'warning', issue: 'non-file-smoke-ref' });
    continue;
  }

  for (const artifact of item.fileTokens) {
    const absolute = path.join(root, artifact);
    const exists = fs.existsSync(absolute);
    const text = exists ? fs.readFileSync(absolute, 'utf8') : '';
    const passMarker = /Status:\s*PASS/i.test(text) || /"status"\s*:\s*"PASS"/i.test(text);
    const needsPassMarker = /^SMOKE_/i.test(path.basename(artifact));
    const issue = !exists ? 'missing-file' : needsPassMarker && !passMarker ? 'missing-pass-marker' : null;

    artifactChecks.push({
      patch: item.patch,
      lineNumber: item.lineNumber,
      smokeRef: item.smokeRef,
      artifact,
      exists,
      passMarker,
      severity: issue ? 'warning' : 'ok',
      issue
    });
  }
}

const smokeScripts = Object.keys(pkg.scripts || {})
  .filter((name) => /^smoke:p\d{3}$/i.test(name))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const runtimeRuns = smokeScripts.map((script) => {
  const startedAt = Date.now();
  const run = spawnSync('npm', ['run', script, '--silent'], { cwd: root, encoding: 'utf8' });
  return {
    script,
    status: run.status,
    elapsedMs: Date.now() - startedAt,
    ok: run.status === 0,
    stdoutTail: (run.stdout || '').trim().split('\n').slice(-3),
    stderrTail: (run.stderr || '').trim().split('\n').slice(-3)
  };
});

const errors = artifactChecks.filter((r) => r.severity === 'error');
const warnings = artifactChecks.filter((r) => r.severity === 'warning');
const runtimeFailures = runtimeRuns.filter((r) => !r.ok);

const summaryStatus = errors.length === 0 && runtimeFailures.length === 0
  ? (warnings.length === 0 ? 'PASS' : 'PASS_WITH_WARNINGS')
  : 'FAIL';

const report = {
  generatedAt: new Date().toISOString(),
  directive: path.relative(root, directivePath),
  checkedPatches: checked.length,
  smokeScriptCount: smokeScripts.length,
  status: summaryStatus,
  errors,
  warnings,
  runtimeFailures,
  artifactChecks,
  runtimeRuns
};

const outDir = path.join(root, 'skydexia', 'proofs');
fs.mkdirSync(outDir, { recursive: true });
const jsonPath = path.join(outDir, 'directive-runtime-audit.json');
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

const mdPath = path.join(root, 'SMOKE_P081_DIRECTIVE_RUNTIME_AUDIT.md');
fs.writeFileSync(mdPath, [
  '# P081 Smoke Proof — Directive Runtime Audit',
  '',
  `Status: ${summaryStatus}`,
  `Checked patches: ${checked.length}`,
  `Smoke scripts executed: ${smokeScripts.length}`,
  `Errors: ${errors.length}`,
  `Warnings: ${warnings.length}`,
  `Runtime failures: ${runtimeFailures.length}`,
  `JSON report: ${path.relative(root, jsonPath)}`,
  ''
].join('\n'), 'utf8');

console.log(JSON.stringify({
  status: summaryStatus,
  checkedPatches: checked.length,
  smokeScriptCount: smokeScripts.length,
  errors: errors.length,
  warnings: warnings.length,
  runtimeFailures: runtimeFailures.length,
  report: path.relative(root, jsonPath),
  artifact: path.relative(root, mdPath)
}, null, 2));

if (summaryStatus === 'FAIL') process.exit(1);
