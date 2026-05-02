import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function stableStringify(value) {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(item => stableStringify(item)).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stableHash(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function validateProviderFixture(provider = {}) {
  const errors = [];
  if (!provider.providerId) errors.push('providerId is required');
  if (!provider.label) errors.push('label is required');
  if (!Array.isArray(provider.capabilities) || provider.capabilities.length === 0) errors.push('capabilities must be a non-empty array');
  if (!Number.isFinite(Number(provider.costPerUnit))) errors.push('costPerUnit must be numeric');
  if (!Number.isFinite(Number(provider.latencyMs))) errors.push('latencyMs must be numeric');
  if (!['public', 'standard', 'private', 'sovereign'].includes(provider.trustTier)) errors.push('trustTier must be public|standard|private|sovereign');
  if (!['shared', 'tenant', 'private'].includes(provider.tenancyScope)) errors.push('tenancyScope must be shared|tenant|private');
  if (!provider.policyLimits || typeof provider.policyLimits !== 'object') errors.push('policyLimits must be an object');
  if (!['healthy', 'degraded', 'outage'].includes(provider.healthState)) errors.push('healthState must be healthy|degraded|outage');
  if (!['ok', 'mismatch', 'missing'].includes(provider.secretStatus)) errors.push('secretStatus must be ok|mismatch|missing');
  return {
    ok: errors.length === 0,
    errors,
    fingerprint: stableHash({
      providerId: provider.providerId,
      capabilities: provider.capabilities,
      costPerUnit: provider.costPerUnit,
      latencyMs: provider.latencyMs,
      trustTier: provider.trustTier,
      tenancyScope: provider.tenancyScope,
      policyLimits: provider.policyLimits,
      healthState: provider.healthState,
      secretStatus: provider.secretStatus
    })
  };
}

const TRUST_SCORE = { public: 1, standard: 2, private: 3, sovereign: 4 };
const TENANCY_SCORE = { shared: 1, tenant: 2, private: 3 };

export function buildProviderGraph(fixtures = []) {
  const nodes = [];
  const errors = [];
  for (const fixture of fixtures) {
    const validation = validateProviderFixture(fixture);
    if (!validation.ok) {
      errors.push({ providerId: fixture.providerId || 'unknown', errors: validation.errors });
      continue;
    }
    nodes.push({
      ...fixture,
      trustScore: TRUST_SCORE[fixture.trustTier],
      tenancyScore: TENANCY_SCORE[fixture.tenancyScope],
      healthScore: fixture.healthState === 'healthy' ? 3 : fixture.healthState === 'degraded' ? 2 : 0,
      validationFingerprint: validation.fingerprint
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    nodes,
    errors,
    pass: errors.length === 0,
    graphFingerprint: stableHash({ nodes: nodes.map(node => node.validationFingerprint), errors })
  };
}

function supportsCapability(provider, capability) {
  return (provider.capabilities || []).includes(capability);
}

function denial(reason, explanation, candidates = []) {
  return { ok: false, reason, explanation, candidates };
}

function candidateSummary(provider) {
  return {
    providerId: provider.providerId,
    label: provider.label,
    costPerUnit: provider.costPerUnit,
    latencyMs: provider.latencyMs,
    trustTier: provider.trustTier,
    tenancyScope: provider.tenancyScope,
    healthState: provider.healthState,
    secretStatus: provider.secretStatus
  };
}

export function routeSovereignTask(graph, request = {}) {
  const capability = request.capability;
  let candidates = graph.nodes.filter(node => supportsCapability(node, capability));
  if (candidates.length === 0) {
    return denial('no_capability_match', `No provider advertises capability ${capability}.`, []);
  }

  const explanation = [];
  explanation.push(`Capability requested: ${capability}.`);

  if (request.trustFloor) {
    candidates = candidates.filter(node => node.trustScore >= TRUST_SCORE[request.trustFloor]);
    explanation.push(`Applied trust floor ${request.trustFloor}.`);
  }
  if (request.privateOnly) {
    candidates = candidates.filter(node => node.tenancyScope === 'private');
    explanation.push('Applied private-only tenancy filter.');
  }
  if (request.enterprisePolicyMode) {
    candidates = candidates.filter(node => node.trustScore >= TRUST_SCORE.private && node.tenancyScore >= TENANCY_SCORE.tenant);
    explanation.push('Applied enterprise policy filter: trust >= private and tenancy >= tenant.');
  }
  if (request.maxCostPerUnit !== undefined) {
    candidates = candidates.filter(node => Number(node.costPerUnit) <= Number(request.maxCostPerUnit));
    explanation.push(`Applied cost cap ${request.maxCostPerUnit}.`);
  }
  if (request.requireHealthy !== false) {
    candidates = candidates.filter(node => node.healthState !== 'outage');
    explanation.push('Filtered outage providers.');
  }
  if (request.requireSecrets !== false) {
    candidates = candidates.filter(node => node.secretStatus === 'ok');
    explanation.push('Filtered providers with missing or mismatched secrets.');
  }

  if (candidates.length === 0) {
    return denial('no_valid_route', explanation.concat('All providers were denied by policy, health, cost, or secret posture.').join(' '), []);
  }

  let sorted = [...candidates];
  switch (request.mode) {
    case 'lowest_cost':
      sorted.sort((a, b) => Number(a.costPerUnit) - Number(b.costPerUnit) || b.trustScore - a.trustScore || a.latencyMs - b.latencyMs);
      explanation.push('Selected lowest-cost route.');
      break;
    case 'highest_trust':
      sorted.sort((a, b) => b.trustScore - a.trustScore || b.tenancyScore - a.tenancyScore || Number(a.costPerUnit) - Number(b.costPerUnit));
      explanation.push('Selected highest-trust route.');
      break;
    case 'private_only':
      sorted = sorted.filter(node => node.tenancyScope === 'private').sort((a, b) => b.trustScore - a.trustScore || Number(a.costPerUnit) - Number(b.costPerUnit));
      explanation.push('Selected private-only route.');
      break;
    case 'fastest_acceptable':
      sorted.sort((a, b) => a.latencyMs - b.latencyMs || Number(a.costPerUnit) - Number(b.costPerUnit));
      explanation.push('Selected fastest acceptable route.');
      break;
    case 'enterprise_policy':
      sorted.sort((a, b) => b.trustScore - a.trustScore || b.tenancyScore - a.tenancyScore || a.latencyMs - b.latencyMs);
      explanation.push('Selected enterprise-policy route.');
      break;
    case 'failover_only': {
      const preferredId = request.preferredProviderId || '';
      const preferred = sorted.find(node => node.providerId === preferredId);
      if (preferred && preferred.healthState === 'healthy' && preferred.secretStatus === 'ok') {
        return denial('failover_not_needed', `Preferred provider ${preferredId} remains healthy, so failover-only mode declined to reroute.`, sorted.map(candidateSummary));
      }
      sorted = sorted.filter(node => node.providerId !== preferredId).sort((a, b) => b.trustScore - a.trustScore || a.latencyMs - b.latencyMs);
      explanation.push(`Preferred provider ${preferredId} unavailable; failover-only mode selected backup.`);
      break;
    }
    case 'human_approval_required':
      sorted.sort((a, b) => b.trustScore - a.trustScore || Number(a.costPerUnit) - Number(b.costPerUnit));
      explanation.push('Human approval is required before runtime execution may continue.');
      return {
        ok: true,
        pendingApproval: true,
        provider: candidateSummary(sorted[0]),
        explanation: explanation.join(' '),
        candidates: sorted.map(candidateSummary)
      };
    default:
      sorted.sort((a, b) => b.trustScore - a.trustScore || Number(a.costPerUnit) - Number(b.costPerUnit));
      explanation.push('Selected default best-trust route.');
      break;
  }

  if (sorted.length === 0) {
    return denial('no_valid_route', explanation.concat('No provider survived the requested mode filter.').join(' '), candidates.map(candidateSummary));
  }

  const provider = sorted[0];
  return {
    ok: true,
    pendingApproval: false,
    provider: candidateSummary(provider),
    explanation: explanation.join(' '),
    candidates: sorted.map(candidateSummary)
  };
}

export function renderRoutingExplanationSurface(result, options = {}) {
  const title = options.title || 'SkyeSovereign Runtime Routing Explanation';
  const candidateRows = (result.candidates || []).map(item => `<tr><td>${item.providerId}</td><td>${item.costPerUnit}</td><td>${item.latencyMs}</td><td>${item.trustTier}</td><td>${item.tenancyScope}</td><td>${item.healthState}</td><td>${item.secretStatus}</td></tr>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
body{font-family:system-ui,sans-serif;background:#0d1022;color:#f6f7ff;margin:24px}
.card{background:#151a33;border:1px solid #313c6f;border-radius:16px;padding:16px;margin-bottom:16px}
table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #27325d;text-align:left}
code{color:#d8b4fe}
</style>
</head>
<body>
<h1>${title}</h1>
<div class="card"><strong>Status:</strong> ${result.ok ? 'route available' : 'denied'}<br><strong>Explanation:</strong> ${result.explanation}</div>
<div class="card"><strong>Chosen provider:</strong> <code>${result.provider ? result.provider.providerId : 'none'}</code></div>
<div class="card"><table><thead><tr><th>Provider</th><th>Cost</th><th>Latency</th><th>Trust</th><th>Tenancy</th><th>Health</th><th>Secrets</th></tr></thead><tbody>${candidateRows}</tbody></table></div>
</body>
</html>\n`;
}

export function writeRoutingExplanationSurface(filePath, result, options = {}) {
  ensureDirectory(path.dirname(filePath));
  const html = renderRoutingExplanationSurface(result, options);
  fs.writeFileSync(filePath, html, 'utf8');
  return { filePath, html };
}
