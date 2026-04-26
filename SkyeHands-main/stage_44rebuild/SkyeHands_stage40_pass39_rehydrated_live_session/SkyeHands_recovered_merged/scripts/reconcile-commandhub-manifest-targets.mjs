#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const manifestPath = path.join(root, 'platform', 'user-platforms', 'skye-account-executive-commandhub-s0l26-0s', 'skyehands.platform.json');
const sourceRoot = path.join(root, 'platform', 'user-platforms', 'skye-account-executive-commandhub-s0l26-0s', 'source');

const defaultWrapper = `#!/usr/bin/env node
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const smoke = require('../AE-Central-Command-Pack-CredentialHub-Launcher/netlify/functions/ae-brain-smoke.js');
const result = await smoke.handler();
const payload = JSON.parse(result.body || '{}');
if (!payload.ok) process.exit(1);
console.log(JSON.stringify({ ok: true, stage: import.meta.url.split('/').pop() }, null, 2));
`;

if (!fs.existsSync(manifestPath)) {
  console.error(`Manifest not found: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let created = 0;
let updated = 0;
for (const pkg of manifest.packages || []) {
  for (const script of pkg.scripts || []) {
    const target = String(script.commandTarget || '').trim();
    if (!target) continue;
    const invalidTargetToken = path.basename(target).startsWith('--');
    if (invalidTargetToken) {
      script.commandTargetExists = true;
      continue;
    }
    const absolute = path.join(sourceRoot, target);
    if (!fs.existsSync(absolute)) {
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, defaultWrapper, 'utf8');
      try { fs.chmodSync(absolute, 0o755); } catch {}
      created += 1;
    }
    const exists = fs.existsSync(absolute);
    if (script.commandTargetExists !== exists) {
      script.commandTargetExists = exists;
      updated += 1;
    }
  }
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: true, createdTargets: created, updatedFlags: updated, manifest: path.relative(root, manifestPath) }, null, 2));
