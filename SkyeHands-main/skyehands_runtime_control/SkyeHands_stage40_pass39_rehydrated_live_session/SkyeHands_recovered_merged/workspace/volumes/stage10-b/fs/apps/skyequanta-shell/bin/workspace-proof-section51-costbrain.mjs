#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  buildCostProviderGraph,
  planBudgetAwareRun,
  evaluatePriceSpike,
  validateCostAwareProvider,
  writeCostExplanationSurface
} from '../lib/costbrain.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const proofDir = path.join(repoRoot, 'docs/proof');
const distDir = path.join(repoRoot, 'dist/section51/costbrain');
const versionStampPath = path.join(repoRoot, 'docs/VERSION_STAMP.json');
const proofFile = path.join(proofDir, 'SECTION_51_COSTBRAIN.json');
const explanationFile = path.join(distDir, 'costbrain-explanation.html');
const denialFile = path.join(distDir, 'costbrain-denial.html');

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function buildFixtures() {
  return [
    {
      providerId: 'economy-public',
      label: 'Economy Public',
      capabilities: ['patch', 'test', 'review'],
      costPerUnit: 0.0020,
      latencyMs: 260,
      trustTier: 'standard',
      tenancyScope: 'shared',
      policyLimits: { regulated: false },
      healthState: 'healthy',
      secretStatus: 'ok',
      costModel: { tokenPerK: 0.0020, computePerMinute: 0.0300, buildPerMinute: 0.0200, deployFlat: 0.3000, storagePerGbHour: 0.0040, rollbackRiskMultiplier: 0.0700 }
    },
    {
      providerId: 'regulated-private',
      label: 'Regulated Private',
      capabilities: ['patch', 'test', 'review'],
      costPerUnit: 0.0065,
      latencyMs: 340,
      trustTier: 'sovereign',
      tenancyScope: 'private',
      policyLimits: { regulated: true },
      healthState: 'healthy',
      secretStatus: 'ok',
      costModel: { tokenPerK: 0.0065, computePerMinute: 0.0500, buildPerMinute: 0.0250, deployFlat: 0.4500, storagePerGbHour: 0.0080, rollbackRiskMultiplier: 0.0250 }
    },
    {
      providerId: 'rapid-tenant',
      label: 'Rapid Tenant',
      capabilities: ['patch', 'test', 'review'],
      costPerUnit: 0.0045,
      latencyMs: 90,
      trustTier: 'private',
      tenancyScope: 'tenant',
      policyLimits: { regulated: true },
      healthState: 'healthy',
      secretStatus: 'ok',
      costModel: { tokenPerK: 0.0045, computePerMinute: 0.0650, buildPerMinute: 0.0300, deployFlat: 0.3800, storagePerGbHour: 0.0065, rollbackRiskMultiplier: 0.0450 }
    },
    {
      providerId: 'broken-metadata',
      label: 'Broken Metadata',
      capabilities: ['patch'],
      costPerUnit: 0.0045,
      latencyMs: 125,
      trustTier: 'private',
      tenancyScope: 'tenant',
      policyLimits: { regulated: true },
      healthState: 'healthy',
      secretStatus: 'ok',
      costModel: { tokenPerK: 'bad', computePerMinute: 0.0500, buildPerMinute: 0.0200, deployFlat: 0.2500, storagePerGbHour: 0.0060, rollbackRiskMultiplier: 0.0300 }
    }
  ];
}

const task = {
  capability: 'patch',
  usageForecast: {
    tokens: 18000,
    computeMinutes: 22,
    buildMinutes: 14,
    deployCount: 1,
    storageGbHours: 5,
    rollbackRiskUnits: 3
  }
};

function main() {
  ensureDirectory(proofDir);
  ensureDirectory(distDir);
  const versionStamp = JSON.parse(fs.readFileSync(versionStampPath, 'utf8'));

  const fixtures = buildFixtures();
  const invalidValidation = validateCostAwareProvider(fixtures.find(item => item.providerId === 'broken-metadata'));
  const graph = buildCostProviderGraph(fixtures.filter(item => item.providerId !== 'broken-metadata'));

  const cheapest = planBudgetAwareRun(graph, task, {
    mode: 'cheapest_acceptable',
    budgetCap: 2.5,
    maxCostPerUnit: 0.01,
    trustFloor: 'standard'
  });

  const safest = planBudgetAwareRun(graph, task, {
    mode: 'safest_regulated_patch',
    budgetCap: 3.5,
    trustFloor: 'private',
    enterprisePolicyMode: true
  });

  const fastest = planBudgetAwareRun(graph, task, {
    mode: 'fastest_fix_under_budget',
    budgetCap: 3.2,
    maxCostPerUnit: 0.01,
    trustFloor: 'private'
  });

  const privateBudget = planBudgetAwareRun(graph, task, {
    mode: 'private_only_budget_mode',
    budgetCap: 3.5,
    privateOnly: true,
    trustFloor: 'private'
  });

  const overBudget = planBudgetAwareRun(graph, task, {
    mode: 'safest_regulated_patch',
    budgetCap: 1.0,
    approvalCap: 2.6,
    enterprisePolicyMode: true,
    trustFloor: 'private'
  });

  const overrideApproved = planBudgetAwareRun(graph, task, {
    mode: 'safest_regulated_patch',
    budgetCap: 1.0,
    approvalCap: 2.6,
    enterprisePolicyMode: true,
    trustFloor: 'private'
  }, { humanOverrideApproved: true });

  const priceSpike = evaluatePriceSpike(graph, task, {
    mode: 'cheapest_acceptable',
    budgetCap: 2.5,
    maxCostPerUnit: 0.01,
    trustFloor: 'standard'
  }, {
    providerId: 'economy-public',
    tokenPerK: 0.1500,
    costPerUnit: 0.1500
  });

  writeCostExplanationSurface(explanationFile, safest, { title: 'CostBrain Explanation — Approved Plan' });
  writeCostExplanationSurface(denialFile, overBudget, { title: 'CostBrain Explanation — Budget Denial' });

  const checks = [
    { id: 'init-graph-build', pass: graph.pass && graph.nodes.length === 3, detail: `graph nodes=${graph.nodes.length}` },
    { id: 'action-budget-mode-a', pass: cheapest.ok && cheapest.provider.providerId === 'economy-public', detail: cheapest.explanation },
    { id: 'action-budget-mode-b', pass: safest.ok && safest.provider.providerId === 'regulated-private', detail: safest.explanation },
    { id: 'action-route-changes-with-budget-policy', pass: cheapest.provider.providerId !== safest.provider.providerId && safest.provider.providerId !== fastest.provider.providerId, detail: `cheapest=${cheapest.provider.providerId} safest=${safest.provider.providerId} fastest=${fastest.provider.providerId}` },
    { id: 'action-private-only-budget-mode', pass: privateBudget.ok && privateBudget.provider.providerId === 'regulated-private', detail: privateBudget.explanation },
    { id: 'persistence-live-spend-accounting', pass: safest.ok && safest.spend.totalCost > 0 && safest.spend.tokens === task.usageForecast.tokens, detail: `total=${safest.spend.totalCost.toFixed(4)}` },
    { id: 'hostile-over-budget-denial', pass: !overBudget.ok && overBudget.reason === 'over_budget_denied', detail: overBudget.explanation },
    { id: 'action-human-override-approval', pass: overrideApproved.ok && overrideApproved.status === 'approved_override', detail: overrideApproved.explanation },
    { id: 'hostile-invalid-cost-metadata', pass: !invalidValidation.ok && invalidValidation.errors.some(item => item.includes('costModel.tokenPerK')), detail: invalidValidation.errors.join('; ') },
    { id: 'hostile-provider-price-spike', pass: priceSpike.before.ok && priceSpike.after.ok && priceSpike.before.provider.providerId !== priceSpike.after.provider.providerId, detail: `before=${priceSpike.before.provider.providerId} after=${priceSpike.after.provider.providerId}` },
    { id: 'explanation-surface-output', pass: fs.existsSync(explanationFile) && fs.existsSync(denialFile), detail: `${explanationFile} | ${denialFile}` }
  ];

  const proof = {
    generatedAt: new Date().toISOString(),
    pass: checks.every(item => item.pass),
    modelVersion: versionStamp.modelVersion,
    runtimeVersion: versionStamp.runtimeVersion,
    directiveVersion: versionStamp.directiveVersion,
    checks,
    evidence: {
      approvedPlans: {
        cheapest: cheapest.provider?.providerId || null,
        safest: safest.provider?.providerId || null,
        fastest: fastest.provider?.providerId || null,
        privateOnly: privateBudget.provider?.providerId || null
      },
      spendSamples: {
        safest: safest.spend,
        fastest: fastest.spend,
        privateOnly: privateBudget.spend
      },
      overBudget,
      overrideApproved,
      priceSpike: {
        before: priceSpike.before.provider?.providerId || null,
        after: priceSpike.after.provider?.providerId || null
      }
    },
    hostileChecks: {
      invalidCostMetadataRejected: !invalidValidation.ok,
      overBudgetDenied: !overBudget.ok,
      priceSpikeReroute: priceSpike.before.provider?.providerId !== priceSpike.after.provider?.providerId
    },
    recoveryChecks: {
      overrideApprovalPath: overrideApproved.ok,
      budgetModeReplanning: cheapest.provider?.providerId !== safest.provider?.providerId
    },
    artifactReferences: {
      proofFile,
      explanationFile,
      denialFile
    }
  };

  fs.writeFileSync(proofFile, JSON.stringify(proof, null, 2));
  proof.artifactHashes = {
    proofFile: sha256File(proofFile),
    explanationFile: sha256File(explanationFile),
    denialFile: sha256File(denialFile)
  };
  fs.writeFileSync(proofFile, JSON.stringify(proof, null, 2));

  console.log(JSON.stringify(proof, null, 2));
  if (!proof.pass) process.exit(1);
}

main();
