#!/usr/bin/env node
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const smoke = require('../AE-Central-Command-Pack-CredentialHub-Launcher/netlify/functions/ae-brain-smoke.js');
const result = await smoke.handler();
const payload = JSON.parse(result.body || '{}');
if (!payload.ok) process.exit(1);
console.log(JSON.stringify({ ok: true, stage: import.meta.url.split('/').pop() }, null, 2));
