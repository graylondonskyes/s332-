#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const registryPath = path.join(root, 'skydexia', 'capability-registry.json');
const outPath = path.join(root, 'skydexia', 'integration', 'CAPABILITY_DEPENDENCY_MAP.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

const map = {
  version: 1,
  generatedAt: new Date().toISOString(),
  capabilities: (registry.capabilities || []).map((cap) => ({
    id: cap.id,
    dependsOn: cap.dependsOn || [],
    artifacts: cap.artifacts || [],
    smokeSuites: cap.smokeSuites || []
  }))
};

fs.writeFileSync(outPath, JSON.stringify(map, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outPath), capabilities: map.capabilities.length }, null, 2));
