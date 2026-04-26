#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { invokeAeBrainCapability } from '../apps/skyequanta-shell/lib/skydexia-orchestrator.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P032_AE_CAPABILITY_INTEGRATION.md');
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'p032-openai-key';
const result = await invokeAeBrainCapability(root, { provider: 'openai', model: 'gpt-4.1-mini', message: 'integrate AE with SkyDexia' });
const payload = JSON.parse(result.body || '{}');
const pass = result.statusCode === 200 && payload.ok === true;
fs.writeFileSync(artifact, `# P032 Smoke Proof — AE Capability Integration\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
