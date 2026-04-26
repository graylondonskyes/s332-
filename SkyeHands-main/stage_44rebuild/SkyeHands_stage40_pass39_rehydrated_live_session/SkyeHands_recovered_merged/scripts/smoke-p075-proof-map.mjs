#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'); const artifact=path.join(root,'SMOKE_P075_PROOF_MAP.md');
const run=spawnSync(process.execPath,[path.join(root,'scripts','skydexia-generate-proof-map.mjs')],{cwd:root,encoding:'utf8'}); const payload=JSON.parse((run.stdout||'{}').trim()||'{}');
const pass=run.status===0 && payload.suites>=4;
fs.writeFileSync(artifact,`# P075 Smoke Proof — Proof Map\n\nStatus: ${pass?'PASS':'FAIL'}\nSuites: ${payload.suites??0}\n`,'utf8');
console.log(JSON.stringify({pass,artifact:path.relative(root,artifact)},null,2)); if(!pass) process.exit(1);
