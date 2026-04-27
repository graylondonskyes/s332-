'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

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
// Analytics computation
// ---------------------------------------------------------------------------

const ALL_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'closed_won', 'closed_lost'];

/**
 * Build full pipeline analytics from all persisted leads.
 *
 * Returns:
 *   totalLeads        — total lead count
 *   byStage           — count per pipeline stage
 *   averageScore      — mean score across all leads (0 if no leads)
 *   highValueLeads    — top 5 leads by score (id, name, score, stage, email)
 *   recentActivity    — last 10 activities across all leads, newest first
 *   conversionRate    — closed_won / (closed_won + closed_lost), null if no closed leads
 */
function computeAnalytics(leads) {
  const totalLeads = leads.length;

  // By-stage counts — initialize all known stages to 0
  const byStage = {};
  for (const s of ALL_STAGES) {
    byStage[s] = 0;
  }
  for (const lead of leads) {
    const s = String(lead.stage || 'new').toLowerCase();
    byStage[s] = (byStage[s] || 0) + 1;
  }

  // Average score
  const averageScore =
    totalLeads > 0
      ? Math.round(leads.reduce((sum, l) => sum + Number(l.score || 0), 0) / totalLeads)
      : 0;

  // Top 5 by score
  const highValueLeads = [...leads]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 5)
    .map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      company: l.company,
      stage: l.stage,
      score: l.score,
    }));

  // Recent activity — collect all activities from all leads, sort newest first, take 10
  const allActivities = [];
  for (const lead of leads) {
    if (!Array.isArray(lead.activities)) continue;
    for (const activity of lead.activities) {
      allActivities.push({
        leadId: lead.id,
        leadName: lead.name,
        activityId: activity.id,
        type: activity.type,
        note: activity.note,
        outcome: activity.outcome,
        at: activity.at || activity.createdAt || null,
      });
    }
  }
  const recentActivity = allActivities
    .filter((a) => a.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 10);

  // Conversion rate
  const wonCount = byStage['closed_won'] || 0;
  const lostCount = byStage['closed_lost'] || 0;
  const closedTotal = wonCount + lostCount;
  const conversionRate = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 10000) / 100 : null;

  return {
    totalLeads,
    byStage,
    averageScore,
    highValueLeads,
    recentActivity,
    conversionRate,
    generatedAt: new Date().toISOString(),
  };
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

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

module.exports.handler = async (event) => {
  try {
    ensureDirs();

    const method = (event.httpMethod || 'GET').toUpperCase();

    if (method === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
        body: '',
      };
    }

    if (method === 'GET') {
      const leads = listLeads();
      const analytics = computeAnalytics(leads);
      return json(200, analytics);
    }

    return json(405, { error: `Method '${method}' not allowed. Use GET.` });
  } catch (err) {
    console.error('[lead-analytics] Unhandled error:', err);
    return json(500, { error: 'Internal server error', detail: err.message });
  }
};
