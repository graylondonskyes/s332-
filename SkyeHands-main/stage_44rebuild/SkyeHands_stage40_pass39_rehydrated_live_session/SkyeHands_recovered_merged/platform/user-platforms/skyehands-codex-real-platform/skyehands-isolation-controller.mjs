#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';

const VERSION='12.0.0';
const ROOT=process.cwd();
const STATE=path.join(ROOT,'.skyehands-codex-real-platform');
const WORKSPACES=path.join(STATE,'workspaces');
const PROOF=path.join(ROOT,'docs/proof');
function mkdirs(){for(const d of [STATE,WORKSPACES,PROOF])fs.mkdirSync(d,{recursive:true})}
function now(){return new Date().toISOString()}
function hash(x){return crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex')}
function proof(name,payload){mkdirs();const p={ok:true,name,version:VERSION,createdAt:now(),...payload};p.proofHash=hash(p);const file=path.join(PROOF,`${name}.json`);fs.writeFileSync(file,JSON.stringify(p,null,2));return{file,proof:p}}
function wid(x='default'){return String(x).replace(/[^a-zA-Z0-9_.-]/g,'-').toLowerCase()||'default'}
function workspace(id='default'){mkdirs();const root=path.join(WORKSPACES,wid(id));fs.mkdirSync(root,{recursive:true});return{id:wid(id),root}}
function which(bin){const r=spawnSync('sh',['-lc',`command -v ${bin}`],{encoding:'utf8'});return r.status===0?r.stdout.trim():null}
function capabilities(){return{podman:which('podman'),docker:which('docker'),uname:spawnSync('uname',['-a'],{encoding:'utf8'}).stdout.trim(),rootlessHint:process.getuid?.()!==0}}
function plan({workspaceId='default',image='node:22-alpine',command=['node','--version'],network='none',memory='512m',cpus='1'}={}){const ws=workspace(workspaceId);const caps=capabilities();const runtime=caps.podman?'podman':caps.docker?'docker':null;const args=['run','--rm','--network',network,'--memory',memory,'--cpus',cpus,'--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=128m','-v',`${ws.root}:/workspace:rw`,'-w','/workspace',image,...command];return{workspace:ws,runtime,args,policy:{network,memory,cpus,readOnlyRootfs:true,tmpfs:'/tmp',workspaceMount:'rw',secretsMounted:false},liveReady:Boolean(runtime)}}
function validatePlan(p){const joined=p.args.join(' ');const checks={hasNetworkNone:p.args.includes('--network')&&p.args.includes('none'),hasMemory:p.args.includes('--memory'),hasCpus:p.args.includes('--cpus'),hasReadOnly:p.args.includes('--read-only'),hasTmpfs:p.args.includes('--tmpfs'),hasWorkspaceMount:p.args.includes('-v')&&joined.includes('/workspace'),hasNoPrivileged:!p.args.includes('--privileged'),hasNoHostNetwork:!joined.includes('host')};checks.ok=Object.values(checks).every(Boolean);return checks}
function runLive(p,timeoutMs=45000){if(process.env.SKYEHANDS_ALLOW_CONTAINER_RUN!=='1')throw new Error('Live container run disabled; set SKYEHANDS_ALLOW_CONTAINER_RUN=1');if(!p.runtime)throw new Error('No podman/docker runtime available');return new Promise(resolve=>{const child=spawn(p.runtime,p.args,{env:{PATH:process.env.PATH},stdio:['ignore','pipe','pipe']});let stdout='',stderr='',timedOut=false;const t=setTimeout(()=>{timedOut=true;child.kill('SIGKILL')},timeoutMs);child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.on('close',code=>{clearTimeout(t);resolve({ok:code===0&&!timedOut,code,timedOut,stdout,stderr})})})}
async function smoke(){const ws=workspace('isolation-smoke');fs.writeFileSync(path.join(ws.root,'index.js'),'console.log(JSON.stringify({ok:true,inside:"workspace"}))');const p=plan({workspaceId:ws.id,command:['node','index.js']});const checks=validatePlan(p);let liveDenied=false;try{await runLive(p,1000)}catch{liveDenied=true}if(!checks.ok)throw new Error('isolation plan policy failed');if(!liveDenied && process.env.SKYEHANDS_ALLOW_CONTAINER_RUN!=='1')throw new Error('live run was not denied');const out=proof('SKYEHANDS_ISOLATION_CONTROLLER_PROOF',{plan:p,checks,liveDenied,capabilities:capabilities(),capabilityList:['container-plan','rootless-runtime-detection','network-none','memory-limit','cpu-limit','read-only-rootfs','tmpfs','workspace-mount','live-run-gated']});console.log(JSON.stringify({ok:true,proofFile:out.file,proofHash:out.proof.proofHash},null,2))}
const cmd=process.argv[2]||'help';if(cmd==='smoke')await smoke();else if(cmd==='plan')console.log(JSON.stringify(plan({workspaceId:process.argv[3]||'default'}),null,2));else console.log('Usage: node skyehands-isolation-controller.mjs smoke|plan');
