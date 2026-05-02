import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { blankDb } from '../src/adapters/workforce-db.js';
import { appendAuditChainFields } from '../src/audit-chain.js';
const dbPath = path.resolve(process.env.DATABASE_PATH || './data/skyeroutex-db.json');
const driver = process.env.DATABASE_DRIVER || 'local-json';
if (driver !== 'local-json') {
  throw new Error(`reset-db currently supports DATABASE_DRIVER=local-json only. ${driver} must provide its own migration/reset command.`);
}
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
function id(prefix){return `${prefix}_${crypto.randomBytes(9).toString('hex')}`;}
function hash(password, salt = crypto.randomBytes(16).toString('hex')){const digest=crypto.pbkdf2Sync(password,salt,120000,32,'sha256').toString('hex');return `${salt}:${digest}`;}
const uid=id('usr');
const now=new Date().toISOString();
const adminEmail = String(process.env.SKYE_ADMIN_EMAIL || '').trim();
const adminPassword = String(process.env.SKYE_ADMIN_PASSWORD || '').trim();
const db={...blankDb(),users:[]};
if(adminEmail && adminPassword){
  db.users.push({id:uid,email:adminEmail,password_hash:hash(adminPassword),role:'admin',status:'active',name:'House Command Admin',city:null,state:null,created_at:now,updated_at:now});
  db.audit_events.push(appendAuditChainFields(db, {id:id('aud'),actor_user_id:uid,event_type:'admin_seeded',entity_type:'user',entity_id:uid,metadata:{email:adminEmail},created_at:now}));
}
fs.writeFileSync(dbPath, JSON.stringify(db,null,2));
console.log(`Database reset: ${dbPath}`);
console.log(adminEmail && adminPassword
  ? `Admin seed created for ${adminEmail}`
  : 'No admin seed created. Set SKYE_ADMIN_EMAIL and SKYE_ADMIN_PASSWORD to bootstrap an operator account.');
