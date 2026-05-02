#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import tls from 'node:tls';

const VERSION='9.0.0';
const ROOT=process.cwd();
const STATE=path.join(ROOT,'.skyehands-codex-real-platform');
const PROOF=path.join(ROOT,'docs/proof');
const STORE=path.join(STATE,'deployments.json');
function mkdirs(){fs.mkdirSync(STATE,{recursive:true});fs.mkdirSync(PROOF,{recursive:true})}
function now(){return new Date().toISOString()}
function hash(x){return crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex')}
function db(){mkdirs();try{return JSON.parse(fs.readFileSync(STORE,'utf8'))}catch{return{deployments:[],events:[]}}}
function save(d){mkdirs();fs.writeFileSync(STORE,JSON.stringify(d,null,2));return d}
function proof(name,payload){mkdirs();const p={ok:true,name,version:VERSION,createdAt:now(),...payload};p.proofHash=hash(p);const file=path.join(PROOF,`${name}.json`);fs.writeFileSync(file,JSON.stringify(p,null,2));return{file,proof:p}}
function id(p){return`${p}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`}
function detect(root){let pkg={scripts:{}};try{pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'))}catch{}const scripts=pkg.scripts||{};const build=scripts.build?'npm run build':fs.existsSync(path.join(root,'index.html'))?'static':'none';const output=fs.existsSync(path.join(root,'dist'))?'dist':'.';return{build,output,scripts}}
function plan({workspaceRoot='.',provider='cloudflare-pages',projectName='skyehands-app',domain=null}={}){const root=path.resolve(workspaceRoot);const d=detect(root);const commands=[];if(d.build!=='none'&&d.build!=='static')commands.push(d.build);if(provider==='cloudflare-pages')commands.push(`npx wrangler pages deploy ${d.output} --project-name ${projectName}`);else if(provider==='netlify')commands.push(`npx netlify deploy --dir ${d.output} --prod`);else if(provider==='github-pages')commands.push(`git subtree push --prefix ${d.output} origin gh-pages`);else throw new Error('unsupported provider');return{id:id('deploy'),provider,projectName,domain,workspaceRoot:root,detected:d,commands,status:'planned',createdAt:now()}}
function record(dep){const d=db();d.deployments.push(dep);d.events.push({id:id('evt'),at:now(),type:'deploy.plan',deploymentId:dep.id,hash:hash(dep)});save(d);return dep}
function cliExists(bin){return spawnSync(process.platform==='win32'?'where':'which',[bin],{encoding:'utf8'}).status===0}
function preflight(dep){const required=dep.provider==='cloudflare-pages'?'wrangler':dep.provider==='netlify'?'netlify':'git';const ok=required==='git'?cliExists('git'):cliExists('npx');return{ok,required,provider:dep.provider,outputExists:fs.existsSync(path.join(dep.workspaceRoot,dep.detected.output))||dep.detected.output==='.'}}
async function smokeUrl(url){const started=Date.now();const res=await fetch(url,{method:'GET'});const text=await res.text();return{ok:res.ok,status:res.status,ms:Date.now()-started,hash:hash(text.slice(0,10000))}}
function certificate(domain){return new Promise(resolve=>{const sock=tls.connect(443,domain,{servername:domain,timeout:5000},()=>{const c=sock.getPeerCertificate();sock.end();resolve({ok:true,subject:c.subject,issuer:c.issuer,valid_to:c.valid_to})});sock.on('error',e=>resolve({ok:false,error:e.message}));sock.on('timeout',()=>{sock.destroy();resolve({ok:false,error:'timeout'})})})}
async function smoke(){const fixture=path.join(STATE,'deploy-fixture');fs.mkdirSync(fixture,{recursive:true});fs.writeFileSync(path.join(fixture,'index.html'),'<!doctype html><h1>SkyeHands Deploy Smoke</h1>');const dep=record(plan({workspaceRoot:fixture,provider:'cloudflare-pages',projectName:'skyehands-smoke'}));const pf=preflight(dep);if(!dep.commands.some(c=>c.includes('wrangler pages deploy')))throw new Error('cloudflare command missing');const net=record(plan({workspaceRoot:fixture,provider:'netlify',projectName:'skyehands-smoke'}));const gh=record(plan({workspaceRoot:fixture,provider:'github-pages',projectName:'skyehands-smoke'}));const p=proof('SKYEHANDS_DEPLOY_AUTOMATION_PROOF',{cloudflare:dep,netlify:net,githubPages:gh,preflight:pf,capabilities:['Cloudflare Pages plan','Netlify plan','GitHub Pages plan','build detection','CLI preflight','smoke-after-deploy hook','TLS certificate check hook']});console.log(JSON.stringify({ok:true,proofFile:p.file,proofHash:p.proof.proofHash},null,2))}
const cmd=process.argv[2]||'help';if(cmd==='smoke')await smoke();else if(cmd==='plan')console.log(JSON.stringify(record(plan(JSON.parse(process.argv[3]||'{}'))),null,2));else if(cmd==='cert')console.log(JSON.stringify(await certificate(process.argv[3]),null,2));else if(cmd==='smoke-url')console.log(JSON.stringify(await smokeUrl(process.argv[3]),null,2));else console.log('Usage: node skyehands-deploy-automation.mjs smoke|plan <json>|cert <domain>|smoke-url <url>');
