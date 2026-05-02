#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const scanPath = path.join(root, 'AE_COMMANDHUB_REALITY_SCAN_2026-04-16.md');
const exists = fs.existsSync(scanPath);
const text = exists ? fs.readFileSync(scanPath, 'utf8') : '';
const pass = exists && /AE|CommandHub|CRM/i.test(text) && text.length > 200;
const artifact = path.join(root, 'SMOKE_P024_AE_COMMANDHUB_REALITY_SCAN.md');
fs.writeFileSync(artifact, `# P024 Smoke Proof — AE/CommandHub Reality Scan\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\nScan file: ${path.relative(root, scanPath)}\nLength: ${text.length}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact), scanPath: path.relative(root, scanPath) }, null, 2));
if (!pass) process.exit(1);
