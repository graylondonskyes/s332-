#!/usr/bin/env node
import fs from 'node:fs';
const required = ['SKYEHANDS_LAUNCH_MANIFEST.json', 'skyehands.platform.json', 'skyehands.power.json'];
const missing = required.filter(name => !fs.existsSync(name));
if (missing.length) {
  console.error(`Missing required generated files: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, required }));
