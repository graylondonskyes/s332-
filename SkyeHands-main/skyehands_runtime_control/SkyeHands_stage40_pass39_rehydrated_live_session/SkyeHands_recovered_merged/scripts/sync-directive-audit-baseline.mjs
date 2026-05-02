#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const directivePath = path.join(root, 'ULTIMATE_SYSTEM_DIRECTIVE.md');
const auditPath = path.join(root, 'skydexia', 'proofs', 'bullshit-audit.json');

if (!fs.existsSync(directivePath)) throw new Error('Directive file not found');
if (!fs.existsSync(auditPath)) throw new Error('Audit summary not found');

const directive = fs.readFileSync(directivePath, 'utf8');
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));

const pct = (count, scanned) => (scanned > 0 ? ((count / scanned) * 100).toFixed(2) : '0.00');
const scanned = Number(audit.scannedFiles || 0);
const todo = Number(audit?.suspiciousPatternCounts?.todo_fixme_xxx || 0);
const stubs = Number(audit?.suspiciousPatternCounts?.stub_placeholder || 0);
const notImplemented = Number(audit?.suspiciousPatternCounts?.not_implemented || 0);
const actionable = Number(audit?.actionableStubPlaceholderCount || 0);

const syncedBlock = [
  '### Audit backlog source snapshot to fix (synced from `skydexia/proofs/bullshit-audit.json`)',
  `- Audit generatedAt: **${audit.generatedAt || 'unknown'}**`,
  `- scannedFiles: **${scanned}**`,
  `- TODO/FIXME/XXX: **${todo} hits** (~${pct(todo, scanned)}% of scanned files)`,
  `- stub/placeholder/mock/dummy: **${stubs} hits** (~${pct(stubs, scanned)}%)`,
  `- “not implemented”: **${notImplemented} hits** (~${pct(notImplemented, scanned)}%)`,
  `- actionable stub/placeholder (generated/proof excluded): **${actionable}** (~${pct(actionable, scanned)}%)`
].join('\n');

const startHeader = '### Audit backlog source snapshot to fix';
const endHeader = '##';

const start = directive.indexOf(startHeader);
if (start === -1) throw new Error('Audit backlog section not found in directive');
const afterStart = directive.slice(start);
const nextSectionOffset = afterStart.indexOf('\n\n## ');
const end = nextSectionOffset === -1 ? directive.length : start + nextSectionOffset + 2;

const next = directive.slice(0, start) + syncedBlock + directive.slice(end);
fs.writeFileSync(directivePath, next, 'utf8');

console.log(JSON.stringify({
  ok: true,
  directive: path.relative(root, directivePath),
  audit: path.relative(root, auditPath),
  generatedAt: audit.generatedAt,
  counts: { todo, stubs, notImplemented, actionable, scanned }
}, null, 2));
