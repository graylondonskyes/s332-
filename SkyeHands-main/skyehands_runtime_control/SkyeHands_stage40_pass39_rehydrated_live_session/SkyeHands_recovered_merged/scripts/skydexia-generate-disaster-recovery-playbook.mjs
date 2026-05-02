#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outPath = path.join(root, 'skydexia', 'DR_PLAYBOOK.md');

const body = `# SkyDexia Disaster Recovery Playbook

Generated: ${new Date().toISOString()}

## Scope
- CDE runtime and directive controls
- AE command surfaces and smoke gates
- SkyDexia knowledge updates and alerting state

## Recovery Steps
1. Validate directive integrity via \`npm run directive:validate --silent\`.
2. Create a fresh snapshot via \`node ./scripts/skydexia-snapshot-state.mjs\`.
3. If knowledge sync fails, execute rollback via \`node ./scripts/skydexia-rollback-from-snapshot.mjs\`.
4. Verify rollback and operational readiness via \`node ./scripts/skydexia-rollback-verify.mjs\`.
5. Regenerate alerting outputs via \`node ./scripts/skydexia-admin-notification-service.mjs\` and \`node ./scripts/skydexia-alert-audit-trail.mjs\`.

## Required Evidence
- Snapshot manifest: \`skydexia/snapshots/*/manifest.json\`
- Rollback state: \`skydexia/snapshots/rollback-last.json\`
- Rollback verification: \`skydexia/snapshots/rollback-verify.json\`
- Alert delivery log: \`skydexia/alerts/delivery-log.json\`
`;

fs.writeFileSync(outPath, body, 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outPath) }, null, 2));
