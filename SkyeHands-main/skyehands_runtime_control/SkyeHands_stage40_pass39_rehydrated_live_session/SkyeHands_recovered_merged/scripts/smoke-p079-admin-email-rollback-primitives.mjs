#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'); const artifact=path.join(root,'SMOKE_P079_ADMIN_EMAIL_ROLLBACK_PRIMITIVES.md');
const run=spawnSync(process.execPath,[path.join(root,'scripts','skydexia-admin-email-rollback-primitives.mjs')],{cwd:root,encoding:'utf8'}); const payload=JSON.parse((run.stdout||'{}').trim()||'{}');
const pass=run.status===0 && payload.status==='PASS';
fs.writeFileSync(artifact,`# P079 Smoke Proof — Admin Email + Rollback Primitives\n\nStatus: ${pass?'PASS':'FAIL'}\nPrimitive Status: ${payload.status??'unknown'}\n`,'utf8');
console.log(JSON.stringify({pass,artifact:path.relative(root,artifact)},null,2)); if(!pass) process.exit(1);
