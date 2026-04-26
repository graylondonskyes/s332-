#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'); const artifact=path.join(root,'SMOKE_P073_CAPABILITY_DEPENDENCY_MAP.md');
const run=spawnSync(process.execPath,[path.join(root,'scripts','skydexia-generate-capability-dependency-map.mjs')],{cwd:root,encoding:'utf8'}); const payload=JSON.parse((run.stdout||'{}').trim()||'{}');
const pass=run.status===0 && payload.capabilities>=1;
fs.writeFileSync(artifact,`# P073 Smoke Proof — Capability Dependency Map\n\nStatus: ${pass?'PASS':'FAIL'}\nCapabilities: ${payload.capabilities??0}\n`,'utf8');
console.log(JSON.stringify({pass,artifact:path.relative(root,artifact)},null,2)); if(!pass) process.exit(1);
