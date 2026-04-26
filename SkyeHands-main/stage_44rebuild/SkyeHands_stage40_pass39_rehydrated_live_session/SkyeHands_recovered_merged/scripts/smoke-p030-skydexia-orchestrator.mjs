#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { composeOrchestrationSnapshot } from '../apps/skyequanta-shell/lib/skydexia-orchestrator.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P030_SKYDEXIA_ORCHESTRATOR.md');
const snapshot = composeOrchestrationSnapshot(root);
const pass = snapshot.ok && snapshot.capabilityCount >= 3 && snapshot.plan.some((item) => item.lane === 'ae');
fs.writeFileSync(artifact, `# P030 Smoke Proof — SkyDexia Orchestrator\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nCapabilityCount: ${snapshot.capabilityCount}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), capabilityCount: snapshot.capabilityCount }, null, 2));
if (!pass) process.exit(1);
