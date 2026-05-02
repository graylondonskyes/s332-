#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'); const artifact=path.join(root,'SMOKE_P076_AE_STUBS_FULL_SMOKE.md');
const run=spawnSync(process.execPath,[path.join(root,'scripts','skydexia-ae-stub-replacement-and-smoke.mjs')],{cwd:root,encoding:'utf8'}); const payload=JSON.parse((run.stdout||'{}').trim()||'{}');
const pass=run.status===0 && payload.status==='PASS' && payload.stubHits===0;
fs.writeFileSync(artifact,`# P076 Smoke Proof — AE Stubs + Full Smoke\n\nStatus: ${pass?'PASS':'FAIL'}\nStub Hits: ${payload.stubHits??'n/a'}\nAE Smoke Status: ${payload.status??'unknown'}\n`,'utf8');
console.log(JSON.stringify({pass,artifact:path.relative(root,artifact)},null,2)); if(!pass) process.exit(1);
