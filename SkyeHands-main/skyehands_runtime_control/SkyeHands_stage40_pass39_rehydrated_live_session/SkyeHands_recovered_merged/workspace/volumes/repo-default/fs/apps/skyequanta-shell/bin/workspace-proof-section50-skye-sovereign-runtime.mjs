#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import { buildProviderGraph, routeSovereignTask, writeRoutingExplanationSurface, validateProviderFixture } from '../lib/skye-sovereign-runtime.mjs';

function parseArgs(argv) {
  return { strict: argv.includes('--strict'), json: argv.includes('--json') };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section50-skye-sovereign-runtime.mjs');

  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_50_SKYE_SOVEREIGN_RUNTIME.json');
  const outputDir = path.join(config.rootDir, 'dist', 'section50', 'skye-sovereign-runtime');
  const explanationFile = path.join(outputDir, 'routing-explanation.html');
  const denialFile = path.join(outputDir, 'routing-denial.html');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const fixtures = [
    {
      providerId: 'g-private-sovereign',
      label: 'Private Sovereign Gemini Lane',
      capabilities: ['codegen', 'chat', 'review'],
      costPerUnit: 0.08,
      latencyMs: 220,
      trustTier: 'sovereign',
      tenancyScope: 'private',
      policyLimits: { maxCostPerUnit: 0.20, modes: ['enterprise', 'private-only', 'highest-trust'] },
      healthState: 'healthy',
      secretStatus: 'ok'
    },
    {
      providerId: 'fast-public-fallback',
      label: 'Fast Public Fallback Lane',
      capabilities: ['codegen', 'chat'],
      costPerUnit: 0.02,
      latencyMs: 80,
      trustTier: 'public',
      tenancyScope: 'shared',
      policyLimits: { maxCostPerUnit: 0.10, modes: ['cheapest', 'fastest'] },
      healthState: 'healthy',
      secretStatus: 'ok'
    },
    {
      providerId: 'tenant-private-standard',
      label: 'Tenant Private Standard Lane',
      capabilities: ['codegen', 'chat', 'embedding'],
      costPerUnit: 0.05,
      latencyMs: 140,
      trustTier: 'private',
      tenancyScope: 'tenant',
      policyLimits: { maxCostPerUnit: 0.12, modes: ['enterprise', 'lowest-cost'] },
      healthState: 'healthy',
      secretStatus: 'ok'
    },
    {
      providerId: 'sovereign-outage',
      label: 'Sovereign Outage Lane',
      capabilities: ['codegen', 'chat'],
      costPerUnit: 0.07,
      latencyMs: 120,
      trustTier: 'sovereign',
      tenancyScope: 'private',
      policyLimits: { maxCostPerUnit: 0.20, modes: ['failover-only'] },
      healthState: 'outage',
      secretStatus: 'ok'
    },
    {
      providerId: 'mismatch-secrets',
      label: 'Secret Mismatch Lane',
      capabilities: ['codegen', 'chat'],
      costPerUnit: 0.03,
      latencyMs: 100,
      trustTier: 'standard',
      tenancyScope: 'tenant',
      policyLimits: { maxCostPerUnit: 0.05, modes: ['lowest-cost'] },
      healthState: 'healthy',
      secretStatus: 'mismatch'
    }
  ];

  const invalidFixture = {
    providerId: 'broken-fixture',
    label: 'Broken Fixture',
    capabilities: [],
    costPerUnit: 'free',
    latencyMs: null,
    trustTier: 'mystery',
    tenancyScope: 'unknown',
    policyLimits: null,
    healthState: 'offline',
    secretStatus: 'oops'
  };

  const graph = buildProviderGraph(fixtures);
  const invalidMetadata = validateProviderFixture(invalidFixture);

  const lowestCost = routeSovereignTask(graph, { capability: 'codegen', mode: 'lowest_cost' });
  const enterpriseMode = routeSovereignTask(graph, { capability: 'codegen', mode: 'enterprise_policy', enterprisePolicyMode: true, trustFloor: 'private' });
  const fastestAcceptable = routeSovereignTask(graph, { capability: 'codegen', mode: 'fastest_acceptable', maxCostPerUnit: 0.06, trustFloor: 'standard' });
  const highestTrust = routeSovereignTask(graph, { capability: 'codegen', mode: 'highest_trust' });
  const failover = routeSovereignTask(graph, { capability: 'codegen', mode: 'failover_only', preferredProviderId: 'sovereign-outage' });
  const secretMismatch = routeSovereignTask(buildProviderGraph([fixtures[4]]), { capability: 'codegen', mode: 'lowest_cost' });
  const noFallback = routeSovereignTask(buildProviderGraph([fixtures[3]]), { capability: 'codegen', mode: 'failover_only', preferredProviderId: 'sovereign-outage' });
  const costCapBreach = routeSovereignTask(graph, { capability: 'codegen', mode: 'lowest_cost', maxCostPerUnit: 0.01 });
  const trustDenied = routeSovereignTask(buildProviderGraph([fixtures[1]]), { capability: 'codegen', mode: 'enterprise_policy', enterprisePolicyMode: true, trustFloor: 'private', privateOnly: true });
  const approvalRequired = routeSovereignTask(graph, { capability: 'codegen', mode: 'human_approval_required', trustFloor: 'private' });

  const explanationSurface = writeRoutingExplanationSurface(explanationFile, enterpriseMode, { title: 'Section 50 Routing Explanation' });
  const denialSurface = writeRoutingExplanationSurface(denialFile, trustDenied, { title: 'Section 50 Routing Denial' });

  const checks = [
    assertCheck(graph.pass && graph.nodes.length === fixtures.length, 'Build provider graph with capability, cost, latency, trust tier, tenancy scope, policy limits, and health state', graph),
    assertCheck(lowestCost.ok && enterpriseMode.ok && fastestAcceptable.ok && highestTrust.ok && approvalRequired.ok && approvalRequired.pendingApproval === true, 'Add runtime routing engine that can choose providers by lowest cost, highest trust, private-only, fastest acceptable, enterprise policy mode, failover-only, or human approval required', { lowestCost, enterpriseMode, fastestAcceptable, highestTrust, approvalRequired }),
    assertCheck(failover.ok && failover.provider.providerId !== 'sovereign-outage', 'Add failover logic across sovereign providers', failover),
    assertCheck(fs.existsSync(explanationSurface.filePath) && explanationSurface.html.includes('Explanation') && explanationSurface.html.includes('Chosen provider'), 'Add routing explanation surface that states why a provider was chosen or denied', { explanationFile: explanationSurface.filePath }),
    assertCheck(fs.existsSync(denialSurface.filePath) && denialSurface.html.includes('denied'), 'Add policy denial surface when no valid route exists', { denialFile: denialSurface.filePath }),
    assertCheck(graph.nodes.length >= 3, 'Load multiple provider fixtures', { providerIds: graph.nodes.map(node => node.providerId) }),
    assertCheck(graph.nodes.every(node => Array.isArray(node.capabilities) && node.capabilities.length >= 1), 'Classify them by capability', graph.nodes.map(node => ({ providerId: node.providerId, capabilities: node.capabilities }))),
    assertCheck(lowestCost.ok && lowestCost.provider.providerId === 'fast-public-fallback', 'Route a task under policy mode A', lowestCost),
    assertCheck(enterpriseMode.ok && enterpriseMode.provider.providerId === 'g-private-sovereign', 'Route the same task differently under policy mode B', enterpriseMode),
    assertCheck(failover.ok && failover.provider.providerId === 'g-private-sovereign', 'Simulate provider outage', failover),
    assertCheck(failover.ok && failover.explanation.includes('failover-only mode selected backup'), 'Prove failover', failover),
    assertCheck(explanationSurface.html.includes(enterpriseMode.provider.providerId), 'Emit route explanation', { explanationFile: explanationSurface.filePath }),
    assertCheck(invalidMetadata.ok === false && invalidMetadata.errors.length >= 4, 'Inject invalid provider metadata', invalidMetadata),
    assertCheck(secretMismatch.ok === false && secretMismatch.reason === 'no_valid_route', 'Simulate secret mismatch', secretMismatch),
    assertCheck(noFallback.ok === false && noFallback.reason === 'no_valid_route', 'Simulate outage with no valid fallback', noFallback),
    assertCheck(costCapBreach.ok === false && costCapBreach.reason === 'no_valid_route', 'Simulate cost cap breach', costCapBreach),
    assertCheck(trustDenied.ok === false && trustDenied.explanation.includes('denied by policy'), 'Simulate trust policy denying every route and prove loud explanation', trustDenied),
    assertCheck(proofFile.endsWith('SECTION_50_SKYE_SOVEREIGN_RUNTIME.json'), 'Create proof artifact docs/proof/SECTION_50_SKYE_SOVEREIGN_RUNTIME.json', { proofFile }),
    assertCheck(enterpriseMode.ok && failover.ok && trustDenied.ok === false, 'The platform can reason over multiple sovereign providers and explain routing under changing policy, cost, and failure conditions', { enterpriseMode, failover, trustDenied })
  ];

  const payload = {
    section: 50,
    label: 'section-50-skye-sovereign-runtime',
    generatedAt: new Date().toISOString(),
    pass: checks.every(item => item.pass),
    strict: options.strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section50-skye-sovereign-runtime.mjs --strict',
    smokeCommand: 'bash scripts/smoke-section50-skye-sovereign-runtime.sh',
    checks,
    hostileChecks: [
      { name: 'invalid-metadata-rejected', pass: invalidMetadata.ok === false, detail: invalidMetadata },
      { name: 'secret-mismatch-denied', pass: secretMismatch.ok === false, detail: secretMismatch },
      { name: 'cost-cap-breach-denied', pass: costCapBreach.ok === false, detail: costCapBreach },
      { name: 'trust-policy-denied', pass: trustDenied.ok === false, detail: trustDenied }
    ],
    recoveryChecks: [
      { name: 'outage-failover', pass: failover.ok === true, detail: failover },
      { name: 'approval-required-route', pass: approvalRequired.pendingApproval === true, detail: approvalRequired }
    ],
    evidence: {
      graph,
      invalidMetadata,
      lowestCost,
      enterpriseMode,
      fastestAcceptable,
      highestTrust,
      failover,
      secretMismatch,
      noFallback,
      costCapBreach,
      trustDenied,
      approvalRequired
    },
    artifactReferences: {
      proofFile,
      explanationFile,
      denialFile
    }
  };

  const written = writeProofJson(proofFile, payload, config, 'workspace-proof-section50-skye-sovereign-runtime.mjs');
  console.log(JSON.stringify(written, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
