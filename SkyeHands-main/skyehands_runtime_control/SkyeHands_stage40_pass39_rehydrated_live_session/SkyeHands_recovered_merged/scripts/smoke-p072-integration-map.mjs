#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'); const artifact=path.join(root,'SMOKE_P072_INTEGRATION_MAP.md');
const run=spawnSync(process.execPath,[path.join(root,'scripts','skydexia-generate-integration-map.mjs')],{cwd:root,encoding:'utf8'}); const payload=JSON.parse((run.stdout||'{}').trim()||'{}');
const pass=run.status===0 && fs.existsSync(path.join(root,payload.output||''));
fs.writeFileSync(artifact,`# P072 Smoke Proof — Integration Map\n\nStatus: ${pass?'PASS':'FAIL'}\nOutput: ${payload.output??'n/a'}\n`,'utf8');
console.log(JSON.stringify({pass,artifact:path.relative(root,artifact)},null,2)); if(!pass) process.exit(1);
