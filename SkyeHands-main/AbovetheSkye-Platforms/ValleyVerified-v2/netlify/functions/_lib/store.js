'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const DATA_DIR = process.env.VALLEYVERIFIED_DATA_DIR || path.join(os.tmpdir(), 'valleyverified-v2');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

const JOB_TYPES = new Set(['restaurant_shift', 'open_house', 'courier_run', 'field_service', 'event_staffing', 'general']);
const JOB_STATUSES = new Set(['posted', 'claimed', 'in_progress', 'fulfilled', 'cancelled']);
const CONTRACTOR_STATUSES = new Set(['pending', 'verified', 'suspended']);

function nowISO() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }
function ensureDir() { fs.mkdirSync(DATA_DIR, { recursive: true }); }
function seedState() {
  return {
    version: 2,
    jobs: [],
    contractors: [],
    claims: [],
    fulfillments: [],
    events: [],
  };
}
function readState() {
  ensureDir();
  if (!fs.existsSync(STATE_FILE)) return seedState();
  try {
    return { ...seedState(), ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) };
  } catch {
    return seedState();
  }
}
function writeState(state) {
  ensureDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}
function emit(state, type, payload) {
  const event = { id: id('evt'), type, payload, createdAt: nowISO() };
  state.events.unshift(event);
  state.events = state.events.slice(0, 500);
  return event;
}
function normalizeJob(raw = {}, claims = {}) {
  const type = JOB_TYPES.has(String(raw.type || '').toLowerCase()) ? String(raw.type).toLowerCase() : 'general';
  return {
    id: raw.id || id('job'),
    company: String(raw.company || raw.business || '').trim(),
    contactName: String(raw.contactName || raw.name || '').trim(),
    contactEmail: String(raw.contactEmail || raw.email || '').trim().toLowerCase(),
    contactPhone: String(raw.contactPhone || raw.phone || '').trim(),
    title: String(raw.title || '').trim(),
    description: String(raw.description || raw.notes || '').trim(),
    type,
    location: String(raw.location || '').trim(),
    rate_cents: Math.max(0, parseInt(raw.rate_cents || raw.budget_cents || 0, 10) || 0),
    slots: Math.max(1, parseInt(raw.slots || 1, 10) || 1),
    startsAt: raw.startsAt || raw.start_at || null,
    status: JOB_STATUSES.has(raw.status) ? raw.status : 'posted',
    source: raw.source || 'valleyverified-v2',
    integrations: {
      jobping: true,
      ae_flow: true,
      skye_routex: true,
      contractor_network: true,
    },
    createdBy: claims.sub || claims.email || 'unknown',
    createdAt: raw.createdAt || nowISO(),
    updatedAt: nowISO(),
  };
}
function normalizeContractor(raw = {}, claims = {}) {
  const skills = Array.isArray(raw.skills) ? raw.skills.map(String) : String(raw.skills || '').split(',').map((v) => v.trim()).filter(Boolean);
  return {
    id: raw.id || id('ctr'),
    name: String(raw.name || '').trim(),
    email: String(raw.email || claims.email || '').trim().toLowerCase(),
    phone: String(raw.phone || '').trim(),
    company: String(raw.company || '').trim(),
    serviceArea: String(raw.serviceArea || raw.location || '').trim(),
    skills,
    status: CONTRACTOR_STATUSES.has(raw.status) ? raw.status : 'pending',
    verification: {
      identity: Boolean(raw.identity_verified || raw.verification?.identity),
      income: Boolean(raw.income_verified || raw.verification?.income),
      insurance: Boolean(raw.insurance_verified || raw.verification?.insurance),
    },
    source: raw.source || 'contractor_onboarding',
    createdBy: claims.sub || claims.email || 'unknown',
    createdAt: raw.createdAt || nowISO(),
    updatedAt: nowISO(),
  };
}
function scoreMatch(job, contractor) {
  const hay = [job.type, job.title, job.description, job.location].join(' ').toLowerCase();
  const skillHits = (contractor.skills || []).filter((skill) => hay.includes(String(skill).toLowerCase())).length;
  const locationHit = contractor.serviceArea && job.location && job.location.toLowerCase().includes(contractor.serviceArea.toLowerCase());
  const verifiedBonus = contractor.status === 'verified' ? 30 : 10;
  return Math.min(100, verifiedBonus + skillHits * 20 + (locationHit ? 20 : 0));
}
function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}
function parseBody(event) {
  if (!event.body) return {};
  try { return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); } catch { return {}; }
}

module.exports = {
  JOB_STATUSES,
  CONTRACTOR_STATUSES,
  emit,
  id,
  json,
  normalizeContractor,
  normalizeJob,
  nowISO,
  parseBody,
  readState,
  scoreMatch,
  writeState,
};
