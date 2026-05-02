#!/usr/bin/env node
import { createAgentCoreRuntime } from '../lib/server.mjs';

const runtime = createAgentCoreRuntime({ host: '127.0.0.1', port: 8954 });
await runtime.listen();
const health = await fetch('http://127.0.0.1:8954/health').then(r => r.json());
const manifest = await fetch('http://127.0.0.1:8954/manifest').then(r => r.json());
await runtime.close();
const payload = { pass: Boolean(health?.ok && manifest?.ok), health, manifest };
console.log(JSON.stringify(payload, null, 2));
if (!payload.pass) process.exitCode = 1;
