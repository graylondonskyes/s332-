#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const EXCLUDE_DIRS = new Set(['.git', 'node_modules', 'dist', '.next', '.cache', 'workspace']);
const TEXT_EXTS = new Set(['.js', '.mjs', '.ts', '.tsx', '.json', '.md', '.yml', '.yaml', '.sh']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github' && entry.name !== '.ae-runtime') continue;
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs);
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(abs, out);
      continue;
    }
    if (!TEXT_EXTS.has(path.extname(entry.name))) continue;
    out.push(rel);
  }
  return out;
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}


const isGeneratedLike = (rel) => rel.startsWith('SMOKE_')
  || rel.startsWith('skydexia/proofs/')
  || rel.startsWith('skydexia/snapshots/')
  || rel.startsWith('docs/proof/')
  || rel.startsWith('.skyequanta/');

// upstream Theia IDE dependency — not first-party code, excluded from all auditing
const isUpstream = (rel) => rel.startsWith('platform/ide-core/');

const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
// meta/reporting scripts whose pattern hits are false positives (they scan FOR these patterns)
const blockingIgnoreFiles = new Set([
  'scripts/bullshit-audit.mjs',
  'scripts/skydexia-ae-stub-replacement-and-smoke.mjs',
<<<<<<< Updated upstream:stage_44rebuild/SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/scripts/bullshit-audit.mjs
  // sync-directive script contains the audit pattern strings as string literals in its output templates — not real debt
=======
>>>>>>> Stashed changes:SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/scripts/bullshit-audit.mjs
  'scripts/sync-directive-audit-baseline.mjs'
]);

const files = walk(root);

const patternDefs = [
  { name: 'todo_fixme_xxx', regex: /\b(?:TODO|FIXME|XXX)\b/g },
  { name: 'stub_placeholder', regex: /\b(?:stub|placeholder|dummy|mock)\b/gi },
  { name: 'not_implemented', regex: /\b(?:not implemented|throw new Error\(['"`]not implemented)/gi },
  { name: 'force_pass_strings', regex: /Status:\s*PASS/gi }
];

const patternHits = {};
for (const def of patternDefs) patternHits[def.name] = [];

for (const rel of files) {
  if (isUpstream(rel)) continue; // exclude upstream Theia IDE from all telemetry
  const txt = read(rel);
  for (const def of patternDefs) {
    const matches = txt.match(def.regex);
    if (matches?.length) {
      patternHits[def.name].push({ file: rel, count: matches.length });
    }
  }
}

const smokeScriptFiles = files.filter((f) => f.startsWith('scripts/smoke-p') && f.endsWith('.mjs'));
const weakSmokeScripts = [];

for (const rel of smokeScriptFiles) {
  const txt = read(rel);
  const passAssign = txt.match(/const\s+pass\s*=([^;]+);/);
  if (!passAssign) continue;
  const expr = passAssign[1].replace(/\s+/g, ' ').trim();
  const heuristicWeak = /run\.status\s*===\s*0/.test(expr) && !/payload\.|existsSync|Status|stale|fail/i.test(expr);
  if (heuristicWeak) weakSmokeScripts.push({ file: rel, passExpr: expr });
}

const directivePath = 'ULTIMATE_SYSTEM_DIRECTIVE.md';
const directiveText = read(directivePath);
const checkedLines = directiveText.split('\n').filter((line) => /^✅\s+P\d{3}/.test(line));
const checkedWithoutScriptRef = checkedLines
  .filter((line) => !/scripts\//.test(line))
  .map((line) => line.match(/^✅\s+(P\d{3})/)?.[1])
  .filter(Boolean);

// markdown docs, generated reports, and intentional proof-plane services are excluded from
// actionable stub counting — only first-party executable code matters
const isMarkdownOrReport = (rel) => rel.endsWith('.md') || rel.endsWith('.json') || rel.endsWith('.yml') || rel.endsWith('.yaml') || rel.endsWith('.sh');
const actionableStubHits = patternHits.stub_placeholder.filter((row) =>
  !isGeneratedLike(row.file) && !isMarkdownOrReport(row.file) && !blockingIgnoreFiles.has(row.file)
);

const executableFiles = files.filter((rel) => /\.(?:mjs|js|ts|tsx|sh)$/i.test(rel)
  && !/\.spec\./i.test(rel)
  && !/\.d\.ts$/i.test(rel)
  && !rel.startsWith('platform/ide-core/')
  && !rel.startsWith('docs/')
  && !isGeneratedLike(rel)
  && !blockingIgnoreFiles.has(rel)
  && !/^scripts\/smoke-p\d+/.test(rel)); // smoke proof scripts excluded — they reference these patterns intentionally

const blockingPatterns = [
  { name: 'todo_fixme_xxx', regex: /\b(?:TODO|FIXME|XXX)\b/g },
  { name: 'not_implemented', regex: /\b(?:not implemented|throw new Error\(['"`]not implemented)/gi }
];

const blockingFindings = [];
for (const rel of executableFiles) {
  const txt = read(rel);
  for (const def of blockingPatterns) {
    const matches = txt.match(def.regex);
    if (matches?.length) {
      blockingFindings.push({ file: rel, type: def.name, count: matches.length });
    }
  }
}


const blockingBullshitCount = blockingFindings.reduce((a,b)=>a+b.count,0) + checkedWithoutScriptRef.length + weakSmokeScripts.length;

const summary = {
  generatedAt: new Date().toISOString(),
  scannedFiles: files.length,
  suspiciousPatternCounts: Object.fromEntries(
    Object.entries(patternHits).map(([key, rows]) => [key, rows.reduce((a, b) => a + b.count, 0)])
  ),
  weakSmokeScriptCount: weakSmokeScripts.length,
  checkedDirectiveItemsWithoutScriptRef: checkedWithoutScriptRef.length,
  checkedDirectiveItemsWithoutScriptRefList: checkedWithoutScriptRef,
  actionableStubPlaceholderCount: actionableStubHits.reduce((a, b) => a + b.count, 0),
  executableFilesScanned: executableFiles.length,
  blockingExecutableFindingCount: blockingFindings.reduce((a,b)=>a+b.count,0),
  blockingBullshitCount,
  blockingFindings,
  topStubPlaceholderFiles: [...patternHits.stub_placeholder]
    .sort((a, b) => b.count - a.count)
    .slice(0, 25),
  weakSmokeScripts,
  topActionableStubPlaceholderFiles: [...actionableStubHits].sort((a,b)=>b.count-a.count).slice(0,25),
  patternHits
};

const outJson = path.join(root, 'skydexia', 'proofs', 'bullshit-audit.json');
const outMd = path.join(root, 'BULLSHIT_AUDIT_REPORT.md');
fs.mkdirSync(path.dirname(outJson), { recursive: true });
fs.writeFileSync(outJson, JSON.stringify(summary, null, 2) + '\n', 'utf8');

const md = [
  '# Bullshit Audit Report (Heuristic)',
  '',
  `Generated: ${summary.generatedAt}`,
  `Scanned files: ${summary.scannedFiles}`,
  '',
  '## Blocking Bullshit Status (gated)',
  `- Blocking bullshit total: ${summary.blockingBullshitCount}`,
  `- Blocking findings in executable files: ${summary.blockingExecutableFindingCount}`,
  `- Checked directive items without script refs: ${summary.checkedDirectiveItemsWithoutScriptRef}`,
  `- Weak smoke pass-expression scripts: ${summary.weakSmokeScriptCount}`,
  `- Executable files scanned (first-party scope): ${summary.executableFilesScanned}`,
  '',
  '## Non-blocking telemetry (noise-including, informational only)',
  `- TODO/FIXME/XXX hits: ${summary.suspiciousPatternCounts.todo_fixme_xxx}`,
  `- Stub/placeholder/mock/dummy hits: ${summary.suspiciousPatternCounts.stub_placeholder}`,
  `- Actionable stub/placeholder hits (excluding generated/proof artifacts): ${summary.actionableStubPlaceholderCount}`,
  `- "Not implemented" hits: ${summary.suspiciousPatternCounts.not_implemented}`,
  `- Literal "Status: PASS" hits: ${summary.suspiciousPatternCounts.force_pass_strings}`,
  '',
  '## Checked Directive Items Without Script Refs',
  ...summary.checkedDirectiveItemsWithoutScriptRefList.map((id) => `- ${id}`),
  '',
  '## Top Stub/Placeholder Files (all)',
  ...summary.topStubPlaceholderFiles.map((row) => `- ${row.file} (${row.count})`),
  '',
  '',
  '## Top Actionable Stub/Placeholder Files (generated artifacts excluded)',
  ...summary.topActionableStubPlaceholderFiles.map((row) => `- ${row.file} (${row.count})`),
  '',
  '',
  '## Blocking Findings in Executable Files',
  ...summary.blockingFindings.map((row) => `- ${row.file} [${row.type}] (${row.count})`),
  '',
  '## Weak Smoke Scripts (heuristic)',
  ...summary.weakSmokeScripts.map((row) => `- ${row.file}: ${row.passExpr}`),
  ''
].join('\n');

fs.writeFileSync(outMd, md, 'utf8');
console.log(JSON.stringify({ ok: true, strict, json: path.relative(root, outJson), report: path.relative(root, outMd), summary }, null, 2));
if (strict && summary.blockingBullshitCount > 0) process.exit(1);
