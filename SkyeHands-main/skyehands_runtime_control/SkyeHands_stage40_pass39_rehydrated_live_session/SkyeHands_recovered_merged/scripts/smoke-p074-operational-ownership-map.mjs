#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'); const artifact=path.join(root,'SMOKE_P074_OPERATIONAL_OWNERSHIP_MAP.md');
const run=spawnSync(process.execPath,[path.join(root,'scripts','skydexia-generate-operational-ownership-map.mjs')],{cwd:root,encoding:'utf8'}); const payload=JSON.parse((run.stdout||'{}').trim()||'{}');
const pass=run.status===0 && payload.systems>=3;
fs.writeFileSync(artifact,`# P074 Smoke Proof — Operational Ownership Map\n\nStatus: ${pass?'PASS':'FAIL'}\nSystems: ${payload.systems??0}\n`,'utf8');
console.log(JSON.stringify({pass,artifact:path.relative(root,artifact)},null,2)); if(!pass) process.exit(1);
