#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const alertsDir = path.join(root, 'skydexia', 'alerts');
const outputPath = path.join(alertsDir, 'smoke-drift-alerts.json');

const smokeFiles = fs.readdirSync(root).filter((name) => /^SMOKE_.*\.md$/i.test(name));
const regressions = [];
for (const file of smokeFiles) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (!/Status:\s*PASS/i.test(text)) {
    regressions.push({ type: 'SMOKE_REGRESSION', artifact: file, message: 'Smoke artifact not PASS' });
  }
}

const completionRun = spawnSync(process.execPath, [path.join(root, 'scripts', 'directive-completion.mjs')], { cwd: root, encoding: 'utf8' });
const completion = JSON.parse((completionRun.stdout || '{}').trim() || '{}');
if (completionRun.status !== 0) {
  regressions.push({ type: 'PLATFORM_DRIFT', artifact: 'ULTIMATE_SYSTEM_DIRECTIVE.md', message: 'Completion calculator failed' });
}

const alert = {
  version: 1,
  generatedAt: new Date().toISOString(),
  category: 'smoke-regression-platform-drift',
  priority: regressions.length ? 'critical' : 'normal',
  completionPercent: completion.completionPercent ?? null,
  regressions
};

fs.mkdirSync(alertsDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(alert, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outputPath), regressions: regressions.length, priority: alert.priority }, null, 2));
