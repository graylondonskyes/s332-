#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const normalizedIndexPath = path.join(root, 'skydexia', 'donors', 'normalized-index.json');
const outRoot = path.join(root, 'skydexia', 'generated-projects');

if (!fs.existsSync(normalizedIndexPath)) {
  console.error('Missing normalized index. Run scripts/skydexia-donor-normalize.mjs first.');
  process.exit(1);
}

const index = JSON.parse(fs.readFileSync(normalizedIndexPath, 'utf8'));
const donorId = process.argv[2] || index.donors[0]?.donorId;
if (!donorId) {
  console.error('No donor available for spin-up.');
  process.exit(1);
}

const normalized = index.donors.find((d) => d.donorId === donorId);
if (!normalized) {
  console.error(`Donor not found in normalized index: ${donorId}`);
  process.exit(1);
}

const normalizedPayload = JSON.parse(fs.readFileSync(path.join(root, normalized.path), 'utf8'));
const projectDir = path.join(outRoot, donorId);
fs.mkdirSync(path.join(projectDir, 'config'), { recursive: true });
fs.mkdirSync(path.join(projectDir, 'runtime'), { recursive: true });
fs.mkdirSync(path.join(projectDir, 'scripts'), { recursive: true });

fs.writeFileSync(path.join(projectDir, 'config', 'donor-runtime.json'), `${JSON.stringify(normalizedPayload.normalized, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(projectDir, 'runtime', 'entrypoint.txt'), `${normalizedPayload.normalized.entrypoint}\n`, 'utf8');
fs.writeFileSync(path.join(projectDir, 'scripts', 'smoke.sh'), '#!/usr/bin/env bash\necho "running donor smoke"\n', 'utf8');
fs.chmodSync(path.join(projectDir, 'scripts', 'smoke.sh'), 0o755);

const manifestPath = path.join(projectDir, 'spinup-manifest.json');
fs.writeFileSync(manifestPath, `${JSON.stringify({
  version: 1,
  donorId,
  spunUpAt: new Date().toISOString(),
  sourceNormalized: normalized.path,
  runtime: normalizedPayload.normalized.runtime,
  providerVars: normalizedPayload.normalized.providerVars
}, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ ok: true, donorId, project: path.relative(root, projectDir), manifest: path.relative(root, manifestPath) }, null, 2));
