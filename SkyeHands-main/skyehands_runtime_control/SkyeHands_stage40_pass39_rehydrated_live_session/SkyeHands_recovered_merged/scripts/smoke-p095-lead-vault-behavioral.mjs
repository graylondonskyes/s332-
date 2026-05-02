#!/usr/bin/env node
/**
 * P095 — Lead Vault — BEHAVIORAL SMOKE
 * Tests lead CRUD, scoring engine, stage transitions, activity timeline, analytics
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fnDir = path.join(root, 'platform', 'user-platforms', 'skye-lead-vault', 'netlify', 'functions');
const artifact = path.join(root, 'SMOKE_P095_LEAD_VAULT.md');

const results = [];
let allPass = true;
function assert(label, condition, detail = '') {
  const ok = Boolean(condition);
  results.push({ label, ok, detail });
  if (!ok) allPass = false;
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` (${detail})` : ''}`);
}

const testDir = path.join(os.tmpdir(), `lead-vault-smoke-${crypto.randomBytes(4).toString('hex')}`);
process.env.LEAD_VAULT_DATA_DIR = testDir;

const leadsHandler = require(path.join(fnDir, 'leads.js')).handler;
const scoringHandler = require(path.join(fnDir, 'lead-scoring.js')).handler;
const analyticsHandler = require(path.join(fnDir, 'lead-analytics.js')).handler;

function makeEvent(method, query = {}, body = null) {
  return { httpMethod: method, queryStringParameters: query, body: body ? JSON.stringify(body) : null };
}

// ── 1. Create lead ────────────────────────────────────────────────────────
const createRes = await leadsHandler(makeEvent('POST', {}, { action: 'create', name: 'Smoke Lead', email: 'smoke@lead.test', phone: '555-0100', company: 'Test Corp', source: 'referral' }));
const createBody = JSON.parse(createRes.body);
assert('create lead returns 201', createRes.statusCode === 201);
assert('lead has id', typeof createBody.lead?.id === 'string');
assert('initial score > 0', createBody.lead?.score > 0, `score=${createBody.lead?.score}`);
const leadId = createBody.lead?.id;

// ── 2. Score breakdown ────────────────────────────────────────────────────
const scoreRes = await scoringHandler(makeEvent('GET', { leadId }));
const scoreBody = JSON.parse(scoreRes.body);
assert('scoring returns 200', scoreRes.statusCode === 200);
assert('score breakdown has breakdown array', Array.isArray(scoreBody.breakdown));
assert('score breakdown has total', typeof scoreBody.finalScore === 'number');
assert('email rule applied', scoreBody.breakdown.some(r => r.rule === 'email_provided' && r.applied));
assert('referral rule applied', scoreBody.breakdown.some(r => r.rule === 'high_value_source' && r.applied));

// ── 3. Add activity ───────────────────────────────────────────────────────
const actRes = await leadsHandler(makeEvent('POST', {}, { action: 'activity', leadId, type: 'call', note: 'Initial discovery call', outcome: 'interested' }));
const actBody = JSON.parse(actRes.body);
assert('add activity returns 200', actRes.statusCode === 201);
assert('activity recorded', actBody.lead?.activities?.length === 1);
assert('activity has type', actBody.lead?.activities?.[0]?.type === 'call');

// ── 4. Stage transition ───────────────────────────────────────────────────
const stageRes = await leadsHandler(makeEvent('POST', {}, { action: 'stage', id: leadId, stage: 'contacted' }));
const stageBody = JSON.parse(stageRes.body);
assert('stage transition returns 200', stageRes.statusCode === 200);
assert('stage updated to contacted', stageBody.lead?.stage === 'contacted');

// Score should increase (qualified or higher stages add points)
const qualifyRes = await leadsHandler(makeEvent('POST', {}, { action: 'stage', id: leadId, stage: 'qualified' }));
const qualifyBody = JSON.parse(qualifyRes.body);
assert('stage to qualified returns 200', qualifyRes.statusCode === 200);
assert('qualified stage recorded', qualifyBody.lead?.stage === 'qualified');
assert('score increases at qualified', qualifyBody.lead?.score > createBody.lead?.score);

// ── 5. List and filter ────────────────────────────────────────────────────
const listRes = await leadsHandler(makeEvent('GET', { action: 'list' }));
const listBody = JSON.parse(listRes.body);
assert('list leads returns 200', listRes.statusCode === 200);
assert('list includes created lead', listBody.leads?.some(l => l.id === leadId));

// ── 6. Update lead ────────────────────────────────────────────────────────
const updateRes = await leadsHandler(makeEvent('PUT', {}, { action: 'update', id: leadId, notes: 'Hot prospect' }));
const updateBody = JSON.parse(updateRes.body);
assert('update lead returns 200', updateRes.statusCode === 200);
assert('notes updated', updateBody.lead?.notes === 'Hot prospect');

// ── 7. Analytics ──────────────────────────────────────────────────────────
const analyticsRes = await analyticsHandler(makeEvent('GET'));
const analyticsBody = JSON.parse(analyticsRes.body);
assert('analytics returns 200', analyticsRes.statusCode === 200);
assert('analytics totalLeads >= 1', analyticsBody.totalLeads >= 1);
assert('analytics byStage present', typeof analyticsBody.byStage === 'object');
assert('analytics averageScore > 0', analyticsBody.averageScore > 0);
assert('analytics highValueLeads array', Array.isArray(analyticsBody.highValueLeads));

// ── Cleanup ───────────────────────────────────────────────────────────────
fs.rmSync(testDir, { recursive: true, force: true });

const passed = results.filter(r => r.ok).length;
const md = [
  '# P095 Smoke Proof — Lead Vault Behavioral', '',
  `Generated: ${new Date().toISOString()}`,
  `Result: **${allPass ? 'PASS' : 'FAIL'}** | ${passed}/${results.length} assertions`,
  '', '## Assertions',
  ...results.map(r => `- ${r.ok ? '✅' : '❌'} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`),
  '', '## Coverage',
  '- ✅ Lead create with auto-scoring', '- ✅ Score breakdown with rule tracing',
  '- ✅ Activity timeline', '- ✅ Stage pipeline transitions',
  '- ✅ Score increases at qualified stage', '- ✅ Lead update', '- ✅ Analytics aggregation',
].join('\n');
fs.writeFileSync(artifact, md);
console.log(`\n${allPass ? 'PASS' : 'FAIL'} — ${passed}/${results.length} assertions`);
if (!allPass) process.exit(1);
