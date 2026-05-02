import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildProviderGraph, routeSovereignTask } from './skye-sovereign-runtime.mjs';

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

const REQUIRED_COST_FIELDS = [
  'tokenPerK',
  'computePerMinute',
  'buildPerMinute',
  'deployFlat',
  'storagePerGbHour',
  'rollbackRiskMultiplier'
];

export function validateCostAwareProvider(provider = {}) {
  const errors = [];
  if (!provider.providerId) errors.push('providerId is required');
  if (!provider.label) errors.push('label is required');
  if (!provider.costModel || typeof provider.costModel !== 'object') {
    errors.push('costModel is required');
  } else {
    for (const field of REQUIRED_COST_FIELDS) {
      if (!Number.isFinite(Number(provider.costModel[field]))) {
        errors.push(`costModel.${field} must be numeric`);
      }
    }
  }
  if (!['healthy', 'degraded', 'outage'].includes(provider.healthState)) {
    errors.push('healthState must be healthy|degraded|outage');
  }
  if (!['ok', 'mismatch', 'missing'].includes(provider.secretStatus)) {
    errors.push('secretStatus must be ok|mismatch|missing');
  }
  return {
    ok: errors.length === 0,
    errors,
    fingerprint: stableHash({
      providerId: provider.providerId,
      label: provider.label,
      trustTier: provider.trustTier,
      tenancyScope: provider.tenancyScope,
      capabilities: provider.capabilities,
      costModel: provider.costModel,
      healthState: provider.healthState,
      secretStatus: provider.secretStatus
    })
  };
}

export function buildCostProviderGraph(fixtures = []) {
  const validated = [];
  const errors = [];
  for (const fixture of fixtures) {
    const result = validateCostAwareProvider(fixture);
    if (!result.ok) {
      errors.push({ providerId: fixture.providerId || 'unknown', errors: result.errors });
      continue;
    }
    validated.push({ ...fixture, validationFingerprint: result.fingerprint });
  }
  const sovereignGraph = buildProviderGraph(validated);
  return {
    generatedAt: new Date().toISOString(),
    nodes: sovereignGraph.nodes.map(node => ({
      ...node,
      costModel: validated.find(item => item.providerId === node.providerId)?.costModel || null,
      policyFlags: validated.find(item => item.providerId === node.providerId)?.policyFlags || {}
    })),
    errors: [...errors, ...sovereignGraph.errors],
    pass: errors.length === 0 && sovereignGraph.pass,
    graphFingerprint: stableHash({
      nodes: validated.map(item => item.validationFingerprint),
      errors
    })
  };
}

export function calculateRunSpend(provider, usage = {}) {
  const costModel = provider.costModel || {};
  const tokens = Number(usage.tokens || 0);
  const computeMinutes = Number(usage.computeMinutes || 0);
  const buildMinutes = Number(usage.buildMinutes || 0);
  const deployCount = Number(usage.deployCount || 0);
  const storageGbHours = Number(usage.storageGbHours || 0);
  const rollbackRiskUnits = Number(usage.rollbackRiskUnits || 0);

  const tokenCost = (tokens / 1000) * Number(costModel.tokenPerK || 0);
  const computeCost = computeMinutes * Number(costModel.computePerMinute || 0);
  const buildCost = buildMinutes * Number(costModel.buildPerMinute || 0);
  const deployCost = deployCount * Number(costModel.deployFlat || 0);
  const storageCost = storageGbHours * Number(costModel.storagePerGbHour || 0);
  const rollbackRiskCost = rollbackRiskUnits * Number(costModel.rollbackRiskMultiplier || 0);
  const totalCost = tokenCost + computeCost + buildCost + deployCost + storageCost + rollbackRiskCost;

  return {
    providerId: provider.providerId,
    tokens,
    computeMinutes,
    buildMinutes,
    deployCount,
    storageGbHours,
    rollbackRiskUnits,
    tokenCost,
    computeCost,
    buildCost,
    deployCost,
    storageCost,
    rollbackRiskCost,
    totalCost,
    fingerprint: stableHash({ providerId: provider.providerId, usage, totalCost })
  };
}

function deriveRoutingRequest(task = {}, policy = {}) {
  const modeMap = {
    cheapest_acceptable: 'lowest_cost',
    safest_regulated_patch: 'enterprise_policy',
    fastest_fix_under_budget: 'fastest_acceptable',
    private_only_budget_mode: 'private_only'
  };
  return {
    capability: task.capability,
    mode: modeMap[policy.mode] || 'lowest_cost',
    privateOnly: policy.mode === 'private_only_budget_mode' || !!policy.privateOnly,
    trustFloor: policy.trustFloor,
    enterprisePolicyMode: policy.mode === 'safest_regulated_patch' || !!policy.enterprisePolicyMode,
    maxCostPerUnit: policy.maxCostPerUnit,
    requireHealthy: policy.requireHealthy !== false,
    requireSecrets: policy.requireSecrets !== false,
    preferredProviderId: policy.preferredProviderId
  };
}

function candidateSpendMap(graph, usage = {}) {
  const map = new Map();
  for (const node of graph.nodes) {
    map.set(node.providerId, calculateRunSpend(node, usage));
  }
  return map;
}

export function planBudgetAwareRun(graph, task = {}, policy = {}, options = {}) {
  const spendByProvider = candidateSpendMap(graph, task.usageForecast || {});
  const routing = routeSovereignTask(graph, deriveRoutingRequest(task, policy));
  const explanation = [];
  explanation.push(`Planning mode: ${policy.mode}.`);
  explanation.push(routing.explanation || '');

  if (!routing.ok) {
    return {
      ok: false,
      reason: routing.reason,
      explanation: explanation.concat('No valid runtime route survived.').join(' ').trim(),
      routing,
      spendByProvider: Object.fromEntries(spendByProvider)
    };
  }

  const spend = spendByProvider.get(routing.provider.providerId);
  const budgetCap = Number(policy.budgetCap || 0);
  const approvalCap = Number(policy.approvalCap || budgetCap || 0);
  const overBudget = budgetCap > 0 && spend.totalCost > budgetCap;
  const canOverride = !!options.humanOverrideApproved && approvalCap > 0 && spend.totalCost <= approvalCap;

  if (overBudget && !canOverride) {
    return {
      ok: false,
      reason: 'over_budget_denied',
      explanation: explanation.concat(`Run cost ${spend.totalCost.toFixed(4)} exceeds budget cap ${budgetCap.toFixed(4)}.`).join(' ').trim(),
      routing,
      spend,
      spendByProvider: Object.fromEntries(spendByProvider),
      policy,
      approvalRequired: true
    };
  }

  const status = overBudget && canOverride ? 'approved_override' : 'approved';
  const extra = overBudget && canOverride
    ? `Human override approved run cost ${spend.totalCost.toFixed(4)} above cap ${budgetCap.toFixed(4)} within override cap ${approvalCap.toFixed(4)}.`
    : `Run cost ${spend.totalCost.toFixed(4)} is within budget policy.`;

  return {
    ok: true,
    status,
    provider: routing.provider,
    routing,
    spend,
    spendByProvider: Object.fromEntries(spendByProvider),
    explanation: explanation.concat(extra).join(' ').trim(),
    policy
  };
}

export function evaluatePriceSpike(graph, task = {}, policy = {}, spike = {}) {
  const nextGraph = {
    ...graph,
    nodes: graph.nodes.map(node => node.providerId === spike.providerId ? {
      ...node,
      costModel: {
        ...node.costModel,
        tokenPerK: spike.tokenPerK ?? node.costModel.tokenPerK,
        computePerMinute: spike.computePerMinute ?? node.costModel.computePerMinute,
        buildPerMinute: spike.buildPerMinute ?? node.costModel.buildPerMinute,
        deployFlat: spike.deployFlat ?? node.costModel.deployFlat,
        storagePerGbHour: spike.storagePerGbHour ?? node.costModel.storagePerGbHour,
        rollbackRiskMultiplier: spike.rollbackRiskMultiplier ?? node.costModel.rollbackRiskMultiplier
      },
      costPerUnit: spike.costPerUnit ?? node.costPerUnit
    } : node)
  };
  return {
    before: planBudgetAwareRun(graph, task, policy),
    after: planBudgetAwareRun(nextGraph, task, policy),
    nextGraph
  };
}

export function renderCostExplanationSurface(plan, options = {}) {
  const title = options.title || 'CostBrain / Live Economic Intelligence';
  const rows = Object.values(plan.spendByProvider || {}).map(entry => `
    <tr>
      <td>${entry.providerId}</td>
      <td>${entry.tokens}</td>
      <td>${entry.computeMinutes}</td>
      <td>${entry.buildMinutes}</td>
      <td>${entry.deployCount}</td>
      <td>${entry.storageGbHours}</td>
      <td>${entry.rollbackRiskUnits}</td>
      <td>${entry.totalCost.toFixed(4)}</td>
    </tr>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
body{font-family:system-ui,sans-serif;background:#0a0f22;color:#f7f8ff;margin:24px}
.card{background:#131a34;border:1px solid #30406f;border-radius:16px;padding:16px;margin-bottom:16px}
table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #26345b;text-align:left}
code{color:#c4b5fd}
</style>
</head>
<body>
<h1>${title}</h1>
<div class="card"><strong>Status:</strong> ${plan.ok ? plan.status : plan.reason}<br><strong>Provider:</strong> <code>${plan.provider?.providerId || plan.routing?.provider?.providerId || 'none'}</code><br><strong>Explanation:</strong> ${plan.explanation}</div>
<div class="card"><strong>Budget mode:</strong> ${plan.policy?.mode || 'n/a'}<br><strong>Budget cap:</strong> ${Number(plan.policy?.budgetCap || 0).toFixed(4)}</div>
<div class="card"><table><thead><tr><th>Provider</th><th>Tokens</th><th>Compute min</th><th>Build min</th><th>Deploys</th><th>Storage GBh</th><th>Rollback units</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div>
</body>
</html>\n`;
}

export function writeCostExplanationSurface(filePath, plan, options = {}) {
  ensureDirectory(path.dirname(filePath));
  const html = renderCostExplanationSurface(plan, options);
  fs.writeFileSync(filePath, html, 'utf8');
  return { filePath, html };
}
