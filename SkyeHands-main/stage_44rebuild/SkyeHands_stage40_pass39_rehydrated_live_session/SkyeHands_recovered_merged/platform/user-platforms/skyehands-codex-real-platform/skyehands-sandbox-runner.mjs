#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const VERSION='6.0.0';
const ROOT=process.cwd();
const STATE=path.join(ROOT,'.skyehands-codex-real-platform');
const WORKSPACES=path.join(STATE,'workspaces');
const PROOF=path.join(ROOT,'docs/proof');
const ALLOW=new Set(['node','npm','npx','pnpm','yarn','git','bash','sh','ls','cat','pwd']);
const SECRET_KEYS=/TOKEN|KEY|SECRET|PASSWORD|DATABASE_URL|OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY/i;
function mkdirs(){for(const d of [STATE,WORKSPACES,PROOF])fs.mkdirSync(d,{recursive:true})}
function now(){return new Date().toISOString()}
function hash(x){return crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex')}
function proof(name,payload){mkdirs();const p={ok:true,name,version:VERSION,createdAt:now(),...payload};p.proofHash=hash(p);const file=path.join(PROOF,`${name}.json`);fs.writeFileSync(file,JSON.stringify(p,null,2));return{file,proof:p}}
function wid(x='default'){return String(x).replace(/[^a-zA-Z0-9_.-]/g,'-').toLowerCase()||'default'}
function workspace(id='default'){mkdirs();const root=path.join(WORKSPACES,wid(id));fs.mkdirSync(root,{recursive:true});return{id:wid(id),root}}
function safe(root,rel=''){const p=path.resolve(root,rel||'.'),b=path.resolve(root);if(p!==b&&!p.startsWith(b+path.sep))throw new Error('cwd escape denied');return p}
function cleanEnv(extra={}){const env={PATH:process.env.PATH||'',HOME:process.env.HOME||'',CI:'1',SKYEHANDS_SANDBOX:'1',...extra};for(const k of Object.keys(env))if(SECRET_KEYS.test(k))delete env[k];return env}
function redact(s=''){return String(s).replace(/sk-[A-Za-z0-9_-]{12,}/g,'[REDACTED_OPENAI_KEY]').replace(/Bearer\s+[A-Za-z0-9._-]+/gi,'Bearer [REDACTED]').replace(/(password|secret|token|key)=([^\s]+)/gi,'$1=[REDACTED]')}
function run({workspaceId='default',command='node',args=['--version'],cwd='.',timeoutMs=30000,env={}}={}){return new Promise(resolve=>{const ws=workspace(workspaceId);if(!ALLOW.has(command))return resolve({ok:false,denied:true,reason:'command_not_allowed',command});let dir;try{dir=safe(ws.root,cwd)}catch(e){return resolve({ok:false,denied:true,reason:e.message})}const started=now();const child=spawn(command,args,{cwd:dir,env:cleanEnv(env),stdio:['ignore','pipe','pipe']});let stdout='',stderr='',timedOut=false;const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL')},timeoutMs);child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);child.on('close',code=>{clearTimeout(timer);const result={ok:code===0&&!timedOut,code,timedOut,command,args,cwd:dir,startedAt:started,endedAt:now(),stdout:redact(stdout).slice(0,20000),stderr:redact(stderr).slice(0,20000)};resolve(result)})})}
async function smoke(){const ws=workspace('sandbox-smoke');fs.writeFileSync(path.join(ws.root,'ok.mjs'),'console.log(JSON.stringify({ok:true,env:process.env.OPENAI_API_KEY||null}))');const allowed=await run({workspaceId:ws.id,command:'node',args:['ok.mjs'],env:{OPENAI_API_KEY:'sk-test-secret-should-not-leak'}});const denied=await run({workspaceId:ws.id,command:'python',args:['--version']});const escape=await run({workspaceId:ws.id,command:'ls',cwd:'../../'});const timeout=await run({workspaceId:ws.id,command:'node',args:['-e','setTimeout(()=>{}, 999999)'],timeoutMs:250});if(!allowed.ok)throw new Error('allowed command failed');if(!denied.denied)throw new Error('denied command was allowed');if(!escape.denied)throw new Error('cwd escape was allowed');if(!timeout.timedOut)throw new Error('timeout did not fire');if(allowed.stdout.includes('sk-test-secret'))throw new Error('secret leaked into stdout');const p=proof('SKYEHANDS_SANDBOX_RUNNER_PROOF',{allowed,denied,escape,timeout,capabilities:['command allowlist','cwd boundary','timeout kill','secret env stripping','output redaction']});console.log(JSON.stringify({ok:true,proofFile:p.file,proofHash:p.proof.proofHash},null,2))}
const cmd=process.argv[2]||'help';if(cmd==='smoke')await smoke();else if(cmd==='run')console.log(JSON.stringify(await run({workspaceId:process.argv[3]||'default',command:process.argv[4]||'node',args:process.argv.slice(5)}),null,2));else console.log('Usage: node skyehands-sandbox-runner.mjs smoke|run <workspace> <command> [...args]');
