#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifactPath = path.join(root, 'SMOKE_P071_RELEASE_NOTE_GENERATOR.md');

const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'generate-directive-release-notes.mjs')], { cwd: root, encoding: 'utf8' });
const payload = JSON.parse((run.stdout || '{}').trim() || '{}');
const notesPath = path.join(root, payload.output || '');
const noteText = fs.existsSync(notesPath) ? fs.readFileSync(notesPath, 'utf8') : '';
const includesHeader = noteText.includes('# Directive Release Notes');
const includesCompleted = noteText.includes('Smoke-backed completed work only');
const pass = run.status === 0 && includesHeader && includesCompleted && Number.isInteger(payload.checkedItems);

const body = [
  '# P071 Smoke Proof — Release Note Generator',
  '',
  `Status: ${pass ? 'PASS' : 'FAIL'}`,
  `Output: ${payload.output ?? 'n/a'}`,
  `Checked Items Emitted: ${payload.checkedItems ?? 0}`,
  ''
].join('\n');

fs.writeFileSync(artifactPath, body, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifactPath), output: payload.output }, null, 2));
if (!pass) process.exit(1);
