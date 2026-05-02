#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'); const artifact=path.join(root,'SMOKE_P080_PROVIDER_E2E_HARNESS.md');
const run=spawnSync(process.execPath,[path.join(root,'scripts','skydexia-provider-e2e-proof-harness.mjs')],{cwd:root,encoding:'utf8'}); const payload=JSON.parse((run.stdout||'{}').trim()||'{}');
const pass=run.status===0 && payload.status==='PASS' && payload.steps>=5;
fs.writeFileSync(artifact,`# P080 Smoke Proof — Provider E2E Harness\n\nStatus: ${pass?'PASS':'FAIL'}\nHarness Status: ${payload.status??'unknown'}\nSteps: ${payload.steps??0}\n`,'utf8');
console.log(JSON.stringify({pass,artifact:path.relative(root,artifact)},null,2)); if(!pass) process.exit(1);
