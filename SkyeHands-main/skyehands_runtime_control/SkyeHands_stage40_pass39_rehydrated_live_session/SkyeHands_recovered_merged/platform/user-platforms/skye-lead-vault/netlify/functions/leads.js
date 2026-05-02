'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const DATA_DIR = process.env.LEAD_VAULT_DATA_DIR || path.join(os.tmpdir(), 'lead-vault');
const LEADS_DIR = path.join(DATA_DIR, 'leads');

function ensureDirs() {
  if (!fs.existsSync(LEADS_DIR)) {
    fs.mkdirSync(LEADS_DIR, { recursive: true });
  }
}

function genId() {
  return crypto.randomUUID();
}

function nowISO() {
  return new Date().toISOString();
}

function leadPath(id) {
  // Sanitise: only allow safe characters to prevent path traversal
  const safe = String(id).replace(/[^a-zA-Z0-9\-_]/g, '');
  if (!safe) throw new Error('Invalid lead id');
  return path.join(LEADS_DIR, `${safe}.json`);
}

function readLead(id) {
  const p = leadPath(id);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeLead(lead) {
  ensureDirs();
  fs.writeFileSync(leadPath(lead.id), JSON.stringify(lead, null, 2), 'utf8');
}

function deleteLead(id) {
  const p = leadPath(id);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function listLeads() {
  ensureDirs();
  const files = fs.readdirSync(LEADS_DIR).filter((f) => f.endsWith('.json'));
  const leads = [];
  for (const f of files) {
    try {
      const lead = JSON.parse(fs.readFileSync(path.join(LEADS_DIR, f), 'utf8'));
      leads.push(lead);
    } catch {
      // skip corrupt files
    }
  }
  return leads;
}

// ---------------------------------------------------------------------------
// Scoring (see lead-scoring.js for the authoritative breakdown)
// ---------------------------------------------------------------------------

/**
 * Calculate lead score from 0-100 using the Lead Vault scoring algorithm.
 */
function calculateScore(lead) {
  let score = 0;

  if (lead.email) score += 20;
  if (lead.phone) score += 15;
  if (lead.company) score += 10;

  const source = String(lead.source || '').toLowerCase();
  if (source === 'referral' || source === 'inbound') score += 10;

  const activityCount = Array.isArray(lead.activities) ? lead.activities.length : 0;
  score += Math.min(20, activityCount * 5);

  const stage = String(lead.stage || 'new').toLowerCase();
  const stageOrder = ['new', 'contacted', 'qualified', 'proposal', 'closed_won', 'closed_lost'];
  const stageIdx = stageOrder.indexOf(stage);

  if (stage === 'proposal') {
    score += 15;
  } else if (stageIdx >= stageOrder.indexOf('qualified')) {
    score += 10;
  }

  // Recency bonuses / penalties
  const lastActivity = latestActivityDate(lead);
  if (lastActivity) {
    const daysAgo = Math.floor((Date.now() - lastActivity.getTime()) / 86400000);
    if (daysAgo <= 7) score += 5;
    if (daysAgo > 30) score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Returns a Date for the most recent activity, or null if none.
 */
function latestActivityDate(lead) {
  if (!Array.isArray(lead.activities) || lead.activities.length === 0) return null;
  const sorted = lead.activities
    .map((a) => new Date(a.at || a.createdAt || 0))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => b - a);
  return sorted.length ? sorted[0] : null;
}

// ---------------------------------------------------------------------------
// Lead normalization
// ---------------------------------------------------------------------------

const VALID_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'closed_won', 'closed_lost'];

function normalizeLead(raw) {
  const now = nowISO();
  const lead = {
    id: raw.id || genId(),
    name: String(raw.name || '').trim(),
    email: String(raw.email || '').trim().toLowerCase(),
    phone: String(raw.phone || '').trim(),
    company: String(raw.company || '').trim(),
    source: String(raw.source || '').trim().toLowerCase(),
    stage: VALID_STAGES.includes(String(raw.stage || '').toLowerCase())
      ? String(raw.stage).toLowerCase()
      : 'new',
    notes: String(raw.notes || '').trim(),
    activities: Array.isArray(raw.activities) ? raw.activities : [],
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
    score: 0,
  };
  lead.score = calculateScore(lead);
  return lead;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  };
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

function parseQuery(event) {
  return event.queryStringParameters || {};
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

function handleList(qs) {
  const { status, search } = qs;
  let leads = listLeads();

  if (status) {
    leads = leads.filter((l) => l.stage === String(status).toLowerCase());
  }

  if (search) {
    const term = String(search).toLowerCase();
    leads = leads.filter(
      (l) =>
        l.name.toLowerCase().includes(term) ||
        l.email.toLowerCase().includes(term) ||
        l.company.toLowerCase().includes(term) ||
        l.source.toLowerCase().includes(term) ||
        l.notes.toLowerCase().includes(term)
    );
  }

  // Sort by score descending
  leads.sort((a, b) => (b.score || 0) - (a.score || 0));

  return json(200, { leads, count: leads.length });
}

function handleGet(qs) {
  const { id } = qs;
  if (!id) return json(400, { error: 'id is required' });
  const lead = readLead(id);
  if (!lead) return json(404, { error: 'Lead not found' });
  return json(200, { lead });
}

function handleCreate(body) {
  const { name, email, phone, company, source, notes } = body;
  if (!name || !String(name).trim()) {
    return json(400, { error: 'name is required' });
  }
  const now = nowISO();
  const lead = normalizeLead({
    id: genId(),
    name,
    email: email || '',
    phone: phone || '',
    company: company || '',
    source: source || '',
    notes: notes || '',
    stage: 'new',
    activities: [],
    createdAt: now,
    updatedAt: now,
  });
  writeLead(lead);
  return json(201, { lead });
}

function handleUpdate(body) {
  const { id } = body;
  if (!id) return json(400, { error: 'id is required' });
  const existing = readLead(id);
  if (!existing) return json(404, { error: 'Lead not found' });

  const updatable = ['name', 'email', 'phone', 'company', 'source', 'notes'];
  for (const field of updatable) {
    if (body[field] !== undefined) {
      existing[field] = String(body[field]);
    }
  }
  // Stage updates go through handleStage, but allow direct update too with validation
  if (body.stage !== undefined) {
    const s = String(body.stage).toLowerCase();
    if (!VALID_STAGES.includes(s)) {
      return json(400, { error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}` });
    }
    existing.stage = s;
  }

  existing.updatedAt = nowISO();
  existing.score = calculateScore(existing);
  writeLead(existing);
  return json(200, { lead: existing });
}

function handleActivity(body) {
  const { leadId, type, note, outcome } = body;
  if (!leadId) return json(400, { error: 'leadId is required' });
  if (!type) return json(400, { error: 'type is required' });

  const lead = readLead(leadId);
  if (!lead) return json(404, { error: 'Lead not found' });

  const activity = {
    id: genId(),
    type: String(type).trim(),
    note: String(note || '').trim(),
    outcome: String(outcome || '').trim(),
    at: nowISO(),
    createdAt: nowISO(),
  };

  if (!Array.isArray(lead.activities)) lead.activities = [];
  lead.activities.push(activity);
  lead.updatedAt = nowISO();
  lead.score = calculateScore(lead);
  writeLead(lead);

  return json(201, { activity, lead });
}

function handleStage(body) {
  const { id, stage } = body;
  if (!id) return json(400, { error: 'id is required' });
  if (!stage) return json(400, { error: 'stage is required' });

  const s = String(stage).toLowerCase();
  if (!VALID_STAGES.includes(s)) {
    return json(400, {
      error: `Invalid stage '${stage}'. Valid stages: ${VALID_STAGES.join(' → ')}`,
    });
  }

  const lead = readLead(id);
  if (!lead) return json(404, { error: 'Lead not found' });

  // Enforce forward-only movement unless moving to closed_lost
  const currentIdx = VALID_STAGES.indexOf(lead.stage);
  const targetIdx = VALID_STAGES.indexOf(s);
  if (targetIdx < currentIdx && s !== 'closed_lost') {
    return json(400, {
      error: `Cannot move lead backwards from '${lead.stage}' to '${s}'. Use closed_lost to abandon a lead.`,
    });
  }

  const previousStage = lead.stage;
  lead.stage = s;
  lead.updatedAt = nowISO();

  // Auto-log a stage transition activity
  if (!Array.isArray(lead.activities)) lead.activities = [];
  lead.activities.push({
    id: genId(),
    type: 'stage_change',
    note: `Stage moved from '${previousStage}' to '${s}'`,
    outcome: '',
    at: nowISO(),
    createdAt: nowISO(),
  });

  lead.score = calculateScore(lead);
  writeLead(lead);

  return json(200, { lead, previousStage });
}

function handleDelete(qs) {
  const { id } = qs;
  if (!id) return json(400, { error: 'id is required' });
  const lead = readLead(id);
  if (!lead) return json(404, { error: 'Lead not found' });
  deleteLead(id);
  return json(200, { deleted: true, id });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

module.exports.handler = async (event) => {
  try {
    ensureDirs();

    const method = (event.httpMethod || 'GET').toUpperCase();
    const qs = parseQuery(event);
    const body = parseBody(event);

    // OPTIONS preflight
    if (method === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: '',
      };
    }

    if (method === 'GET') {
      const action = qs.action || 'list';
      if (action === 'list') return handleList(qs);
      if (action === 'get') return handleGet(qs);
      return json(400, { error: `Unknown GET action '${action}'. Use: list, get` });
    }

    if (method === 'POST') {
      const action = body.action || qs.action;
      if (action === 'create') return handleCreate(body);
      if (action === 'activity') return handleActivity(body);
      if (action === 'stage') return handleStage(body);
      // Fall back: if no action but name field present, treat as create
      if (!action && body.name) return handleCreate(body);
      return json(400, { error: `Unknown POST action '${action}'. Use: create, activity, stage` });
    }

    if (method === 'PUT') {
      const action = body.action || qs.action || 'update';
      if (action === 'update') return handleUpdate(body);
      return json(400, { error: `Unknown PUT action '${action}'. Use: update` });
    }

    if (method === 'DELETE') {
      return handleDelete(qs);
    }

    return json(405, { error: `Method '${method}' not allowed` });
  } catch (err) {
    console.error('[leads] Unhandled error:', err);
    return json(500, { error: 'Internal server error', detail: err.message });
  }
};
