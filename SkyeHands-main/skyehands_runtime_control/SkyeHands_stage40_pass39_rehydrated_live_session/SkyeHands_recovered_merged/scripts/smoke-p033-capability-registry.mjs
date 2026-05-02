#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadCapabilityRegistry, resolveBuildPlan } from '../apps/skyequanta-shell/lib/skydexia-orchestrator.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P033_CAPABILITY_REGISTRY.md');
const registry = loadCapabilityRegistry(root);
const plan = resolveBuildPlan(registry, ['cde.operator.boot', 'ae.brain.chat']);
const pass = plan.length === 2 && plan.every((item) => item.entrypoint && item.requires.length >= 1);
fs.writeFileSync(artifact, `# P033 Smoke Proof — Capability Registry\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nPlanCount: ${plan.length}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), planCount: plan.length }, null, 2));
if (!pass) process.exit(1);
