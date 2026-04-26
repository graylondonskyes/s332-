import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const platformRoot = path.resolve(__dirname, '..', '..');
const directivePath = path.resolve(platformRoot, 'BRANCH_DIRECTIVE_AE_AUTONOMOUS_STORE_SYSTEM_MAGGIES.md');
const proofMapPath = path.resolve(__dirname, 'directive-proof-map.json');
const evidencePath = path.resolve(__dirname, 'directive-proof-evidence.json');

const directive = fs.readFileSync(directivePath, 'utf8');
const proofMap = JSON.parse(fs.readFileSync(proofMapPath, 'utf8'));

function existsRelative(relativePath) {
  const fullPath = path.resolve(__dirname, relativePath);
  return fs.existsSync(fullPath);
}

const evaluations = proofMap.items.map((item) => {
  const checks = item.proof.map((proofPath) => ({ proofPath, exists: existsRelative(proofPath) }));
  const pass = checks.every((row) => row.exists);
  return { ...item, pass, checks };
});

let updatedDirective = directive;
for (const row of evaluations) {
  const escaped = row.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`- \\[.\\] ${escaped}`, 'g');
  updatedDirective = updatedDirective.replace(pattern, `- [${row.pass ? 'x' : ' '}] ${row.label}`);
}

const complete = evaluations.filter((row) => row.pass).length;
const total = evaluations.length;
const completionPercent = Math.round((complete / total) * 100);
const evidence = {
  platform: proofMap.platform,
  generatedAt: new Date().toISOString(),
  completionPercent,
  complete,
  total,
  evaluations
};

fs.writeFileSync(directivePath, updatedDirective);
fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({ ok: true, completionPercent, complete, total, evidencePath }, null, 2));
