import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function resolvePackRoot() {
  const cwd = process.cwd();
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const branchRootFromScript = path.resolve(scriptDir, '..');
  const launcherRootFromScript = path.resolve(branchRootFromScript, '..', '..');
  if (fs.existsSync(path.join(cwd, 'Branching Apps', 'AE-Brain-Command-Site-v8-Additive', 'index.html'))) return cwd;
  if (fs.existsSync(path.join(cwd, 'index.html')) && fs.existsSync(path.join(cwd, 'assets', 'app.js')) && path.basename(cwd) === 'AE-Brain-Command-Site-v8-Additive') return path.resolve(cwd, '..', '..');
  if (fs.existsSync(path.join(launcherRootFromScript, 'Branching Apps', 'AE-Brain-Command-Site-v8-Additive', 'index.html'))) return launcherRootFromScript;
  return cwd;
}

export function buildDirectiveMarkdown(source, passedKeys = new Set()) {
  const lines = [];
  lines.push(source.title);
  lines.push(source.subtitle);
  lines.push('');
  lines.push('Rule:');
  for (const row of source.rule || []) lines.push(`- ${row}`);
  lines.push('');
  for (const section of source.sections || []) {
    lines.push(section.title);
    for (const item of section.items || []) {
      const done = (item.smokeKeys || []).length > 0 && item.smokeKeys.every(key => passedKeys.has(key));
      const prefix = done ? '✅ ' : '';
      const valueTail = done && item.value ? ` — 2026 upgrade value: ${item.value}` : '';
      lines.push(`${prefix}${item.label}${valueTail}`);
    }
    lines.push('');
  }
  lines.push('Smoke-backed proof source:');
  lines.push('./docs/SMOKE_PROOF.md');
  lines.push('');
  return lines.join('\n');
}

function run() {
  const packRoot = resolvePackRoot();
  const root = path.resolve(packRoot, 'Branching Apps/AE-Brain-Command-Site-v8-Additive');
  const sourcePath = path.join(root, 'docs/directive-source.json');
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const passedKeys = new Set(JSON.parse(process.env.PASSED_KEYS_JSON || '[]'));
  const output = buildDirectiveMarkdown(source, passedKeys);
  fs.writeFileSync(path.join(root, 'docs/BUILD_DIRECTIVE.md'), output, 'utf8');
  fs.writeFileSync(path.join(packRoot, 'BUILD_DIRECTIVE_AE_BRAIN_COMMAND_SITE.md'), output, 'utf8');
}

if (import.meta.url === `file://${process.argv[1]}`) run();
