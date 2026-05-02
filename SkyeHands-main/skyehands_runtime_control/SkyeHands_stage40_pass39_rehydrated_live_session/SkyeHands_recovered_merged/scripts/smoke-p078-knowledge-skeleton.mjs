#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'); const artifact=path.join(root,'SMOKE_P078_KNOWLEDGE_SKELETON.md');
const run=spawnSync(process.execPath,[path.join(root,'scripts','skydexia-knowledge-skeleton-bootstrap.mjs')],{cwd:root,encoding:'utf8'}); const payload=JSON.parse((run.stdout||'{}').trim()||'{}');
const pass=run.status===0 && payload.lanes>=6;
fs.writeFileSync(artifact,`# P078 Smoke Proof — Knowledge Skeleton\n\nStatus: ${pass?'PASS':'FAIL'}\nLanes: ${payload.lanes??0}\n`,'utf8');
console.log(JSON.stringify({pass,artifact:path.relative(root,artifact)},null,2)); if(!pass) process.exit(1);
