#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const artifact = path.join(root, 'SMOKE_P034_KNOWLEDGE_BASE_POLICY.md');
const policyPath = path.join(root, 'skydexia', 'policies', 'knowledge-lifecycle-policy.json');
const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
const rootExists = fs.existsSync(path.join(root, policy.knowledgeRoot));
const laneExists = fs.existsSync(path.join(root, policy.importLane));
const pass = rootExists && laneExists && Array.isArray(policy.requiredMetadata) && policy.requiredMetadata.length >= 4;
fs.writeFileSync(artifact, `# P034 Smoke Proof — Knowledge Base Root & Lifecycle Policy\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
