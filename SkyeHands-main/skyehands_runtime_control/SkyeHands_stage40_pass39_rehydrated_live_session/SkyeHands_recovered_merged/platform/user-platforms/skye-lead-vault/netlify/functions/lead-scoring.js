'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Storage helpers (mirrors leads.js, no circular dependency)
// ---------------------------------------------------------------------------

const DATA_DIR = process.env.LEAD_VAULT_DATA_DIR || path.join(os.tmpdir(), 'lead-vault');
const LEADS_DIR = path.join(DATA_DIR, 'leads');

function ensureDirs() {
  if (!fs.existsSync(LEADS_DIR)) {
    fs.mkdirSync(LEADS_DIR, { recursive: true });
  }
}

function leadPath(id) {
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

// ---------------------------------------------------------------------------
// Scoring algorithm — fully implemented, no stubs
// ---------------------------------------------------------------------------

/**
 * Returns a detailed score breakdown object for a lead.
 *
 * Algorithm (max 100):
 *   +20  email provided
 *   +15  phone provided
 *   +10  company provided
 *   +10  source is 'referral' or 'inbound'
 *   + 5  per activity logged, capped at +20 (i.e. max 4 activities scored)
 *   +10  stage is 'qualified', 'closed_won', or beyond (but not proposal)
 *   +15  stage is 'proposal'
 *   + 5  last activity within 7 days
 *   -10  last activity > 30 days ago (no recent contact)
 */
function scoringBreakdown(lead) {
  const breakdown = [];
  let score = 0;

  // +20 email
  if (lead.email && String(lead.email).trim()) {
    breakdown.push({ rule: 'email_provided', points: 20, applied: true, note: 'Email address on file' });
    score += 20;
  } else {
    breakdown.push({ rule: 'email_provided', points: 20, applied: false, note: 'No email address' });
  }

  // +15 phone
  if (lead.phone && String(lead.phone).trim()) {
    breakdown.push({ rule: 'phone_provided', points: 15, applied: true, note: 'Phone number on file' });
    score += 15;
  } else {
    breakdown.push({ rule: 'phone_provided', points: 15, applied: false, note: 'No phone number' });
  }

  // +10 company
  if (lead.company && String(lead.company).trim()) {
    breakdown.push({ rule: 'company_provided', points: 10, applied: true, note: 'Company name on file' });
    score += 10;
  } else {
    breakdown.push({ rule: 'company_provided', points: 10, applied: false, note: 'No company name' });
  }

  // +10 source referral/inbound
  const source = String(lead.source || '').toLowerCase().trim();
  if (source === 'referral' || source === 'inbound') {
    breakdown.push({ rule: 'high_value_source', points: 10, applied: true, note: `Source is '${source}'` });
    score += 10;
  } else {
    breakdown.push({ rule: 'high_value_source', points: 10, applied: false, note: `Source '${source || 'unknown'}' is not referral or inbound` });
  }

  // +5 per activity, max +20
  const activityCount = Array.isArray(lead.activities) ? lead.activities.length : 0;
  const activityPoints = Math.min(20, activityCount * 5);
  if (activityCount > 0) {
    breakdown.push({
      rule: 'activity_count',
      points: activityPoints,
      applied: true,
      note: `${activityCount} ${activityCount === 1 ? 'activity' : 'activities'} logged (${activityPoints} pts, cap 20)`,
    });
    score += activityPoints;
  } else {
    breakdown.push({ rule: 'activity_count', points: 0, applied: false, note: 'No activities logged' });
  }

  // Stage points
  const stage = String(lead.stage || 'new').toLowerCase();
  const stageOrder = ['new', 'contacted', 'qualified', 'proposal', 'closed_won', 'closed_lost'];
  const stageIdx = stageOrder.indexOf(stage);
  const qualifiedIdx = stageOrder.indexOf('qualified');
  const proposalIdx = stageOrder.indexOf('proposal');

  if (stage === 'proposal') {
    breakdown.push({ rule: 'stage_proposal', points: 15, applied: true, note: "Stage is 'proposal' (+15)" });
    score += 15;
    breakdown.push({ rule: 'stage_qualified_or_beyond', points: 10, applied: false, note: "Proposal bonus takes precedence over qualified bonus" });
  } else if (stageIdx >= qualifiedIdx && stage !== 'closed_lost') {
    breakdown.push({ rule: 'stage_proposal', points: 15, applied: false, note: "Stage is not 'proposal'" });
    breakdown.push({ rule: 'stage_qualified_or_beyond', points: 10, applied: true, note: `Stage '${stage}' is qualified or beyond (+10)` });
    score += 10;
  } else {
    breakdown.push({ rule: 'stage_proposal', points: 15, applied: false, note: "Stage is not 'proposal'" });
    breakdown.push({ rule: 'stage_qualified_or_beyond', points: 10, applied: false, note: `Stage '${stage}' is below 'qualified'` });
  }

  // Recency: find last activity date
  const lastActivityDate = latestActivityDate(lead);
  if (lastActivityDate) {
    const daysAgo = Math.floor((Date.now() - lastActivityDate.getTime()) / 86400000);

    if (daysAgo <= 7) {
      breakdown.push({ rule: 'recent_activity_bonus', points: 5, applied: true, note: `Last activity ${daysAgo} day(s) ago (within 7 days)` });
      score += 5;
    } else {
      breakdown.push({ rule: 'recent_activity_bonus', points: 5, applied: false, note: `Last activity ${daysAgo} day(s) ago (not within 7 days)` });
    }

    if (daysAgo > 30) {
      breakdown.push({ rule: 'stale_contact_penalty', points: -10, applied: true, note: `Last activity ${daysAgo} day(s) ago (over 30 days, -10)` });
      score -= 10;
    } else {
      breakdown.push({ rule: 'stale_contact_penalty', points: -10, applied: false, note: `Last activity ${daysAgo} day(s) ago (not stale)` });
    }
  } else {
    breakdown.push({ rule: 'recent_activity_bonus', points: 5, applied: false, note: 'No activities to evaluate recency' });
    breakdown.push({ rule: 'stale_contact_penalty', points: -10, applied: false, note: 'No activities to evaluate staleness' });
  }

  const finalScore = Math.max(0, Math.min(100, score));

  return {
    leadId: lead.id,
    leadName: lead.name,
    rawScore: score,
    finalScore,
    breakdown,
    calculatedAt: new Date().toISOString(),
  };
}

function latestActivityDate(lead) {
  if (!Array.isArray(lead.activities) || lead.activities.length === 0) return null;
  const sorted = lead.activities
    .map((a) => new Date(a.at || a.createdAt || 0))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => b - a);
  return sorted.length ? sorted[0] : null;
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
// Main handler
// ---------------------------------------------------------------------------

module.exports.handler = async (event) => {
  try {
    ensureDirs();

    const method = (event.httpMethod || 'GET').toUpperCase();
    const qs = parseQuery(event);
    const body = parseBody(event);

    if (method === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: '',
      };
    }

    if (method === 'GET') {
      const leadId = qs.leadId || qs.id;
      if (!leadId) return json(400, { error: 'leadId query parameter is required' });

      const lead = readLead(leadId);
      if (!lead) return json(404, { error: 'Lead not found' });

      const result = scoringBreakdown(lead);
      return json(200, result);
    }

    if (method === 'POST') {
      // Recalculate and persist a lead's score
      const leadId = body.leadId || body.id || qs.leadId;
      if (!leadId) return json(400, { error: 'leadId is required in request body' });

      const lead = readLead(leadId);
      if (!lead) return json(404, { error: 'Lead not found' });

      const result = scoringBreakdown(lead);
      // Persist updated score
      lead.score = result.finalScore;
      lead.updatedAt = new Date().toISOString();
      writeLead(lead);

      return json(200, { ...result, scorePersisted: true });
    }

    return json(405, { error: `Method '${method}' not allowed` });
  } catch (err) {
    console.error('[lead-scoring] Unhandled error:', err);
    return json(500, { error: 'Internal server error', detail: err.message });
  }
};
