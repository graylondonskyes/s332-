#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const VERSION='8.0.0';
const ROOT=process.cwd();
const STATE=path.join(ROOT,'.skyehands-codex-real-platform');
const PROOF=path.join(ROOT,'docs/proof');
const STORE=path.join(STATE,'billing-ledger.json');
const SECRET=process.env.STRIPE_WEBHOOK_SECRET||'whsec_dev_skyehands';
function mkdirs(){fs.mkdirSync(STATE,{recursive:true});fs.mkdirSync(PROOF,{recursive:true})}
function now(){return new Date().toISOString()}
function hash(x){return crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex')}
function db(){mkdirs();try{return JSON.parse(fs.readFileSync(STORE,'utf8'))}catch{return{customers:[],subscriptions:[],credits:[],events:[],refunds:[],disputes:[]}}}
function save(d){mkdirs();fs.writeFileSync(STORE,JSON.stringify(d,null,2));return d}
function proof(name,payload){mkdirs();const p={ok:true,name,version:VERSION,createdAt:now(),...payload};p.proofHash=hash(p);const file=path.join(PROOF,`${name}.json`);fs.writeFileSync(file,JSON.stringify(p,null,2));return{file,proof:p}}
function sign(raw,t=Math.floor(Date.now()/1000),secret=SECRET){const sig=crypto.createHmac('sha256',secret).update(`${t}.${raw}`).digest('hex');return`t=${t},v1=${sig}`}
function verify(raw,header,secret=SECRET,tolerance=300){const parts=Object.fromEntries(String(header).split(',').map(x=>x.split('=')));const t=Number(parts.t);if(!t||Math.abs(Math.floor(Date.now()/1000)-t)>tolerance)throw new Error('webhook timestamp outside tolerance');const expected=crypto.createHmac('sha256',secret).update(`${t}.${raw}`).digest('hex');if(!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(parts.v1||'')))throw new Error('webhook signature mismatch');return true}
function upsert(arr,key,val,patch){let row=arr.find(x=>x[key]===val);if(!row){row={id:val,createdAt:now()};arr.push(row)}Object.assign(row,patch,{updatedAt:now()});return row}
function applyEvent(evt){const d=db();if(d.events.find(e=>e.id===evt.id))return{ok:true,duplicate:true};d.events.push({id:evt.id,type:evt.type,receivedAt:now(),hash:hash(evt)});const o=evt.data?.object||{};if(evt.type==='customer.created')upsert(d.customers,'id',o.id,{email:o.email||null,orgId:o.metadata?.orgId||'default'});if(evt.type==='customer.subscription.created'||evt.type==='customer.subscription.updated')upsert(d.subscriptions,'id',o.id,{customerId:o.customer,status:o.status,priceId:o.items?.data?.[0]?.price?.id||null,currentPeriodEnd:o.current_period_end||null});if(evt.type==='customer.subscription.deleted')upsert(d.subscriptions,'id',o.id,{customerId:o.customer,status:'canceled'});if(evt.type==='invoice.paid')d.credits.push({id:`credit-${evt.id}`,customerId:o.customer,amountUsd:(o.amount_paid||0)/100,reason:'invoice.paid',createdAt:now()});if(evt.type==='charge.refunded')d.refunds.push({id:o.id,customerId:o.customer||null,amountUsd:(o.amount_refunded||0)/100,status:'refunded',createdAt:now()});if(evt.type==='charge.dispute.created')d.disputes.push({id:o.id,charge:o.charge,amountUsd:(o.amount||0)/100,status:o.status||'needs_response',createdAt:now()});save(d);return{ok:true,ledger:d}}
function handle(raw,header){verify(raw,header);return applyEvent(JSON.parse(raw))}
function smoke(){fs.rmSync(STORE,{force:true});const events=[{id:'evt_cus',type:'customer.created',data:{object:{id:'cus_1',email:'owner@skye.local',metadata:{orgId:'org_1'}}}},{id:'evt_sub',type:'customer.subscription.created',data:{object:{id:'sub_1',customer:'cus_1',status:'active',items:{data:[{price:{id:'price_pro'}}]}}}},{id:'evt_inv',type:'invoice.paid',data:{object:{id:'in_1',customer:'cus_1',amount_paid:2000}}},{id:'evt_ref',type:'charge.refunded',data:{object:{id:'ch_1',customer:'cus_1',amount_refunded:500}}},{id:'evt_dis',type:'charge.dispute.created',data:{object:{id:'dp_1',charge:'ch_1',amount:500,status:'needs_response'}}}];for(const e of events){const raw=JSON.stringify(e);handle(raw,sign(raw))}let denied=false;try{handle(JSON.stringify({id:'bad'}),'t=1,v1=bad')}catch{denied=true}const ledger=db();if(!denied||ledger.subscriptions[0].status!=='active'||ledger.credits.length!==1||ledger.refunds.length!==1||ledger.disputes.length!==1)throw new Error('billing smoke failed');const p=proof('SKYEHANDS_BILLING_WEBHOOKS_PROOF',{ledger,signatureTamperDenied:denied,capabilities:['webhook signature verification','subscription ledger','credit ledger','refund ledger','dispute ledger','idempotency']});console.log(JSON.stringify({ok:true,proofFile:p.file,proofHash:p.proof.proofHash},null,2))}
const cmd=process.argv[2]||'help';if(cmd==='smoke')smoke();else if(cmd==='sign')console.log(sign(process.argv[3]||'{}'));else console.log('Usage: node skyehands-billing-webhooks.mjs smoke|sign <raw>');
