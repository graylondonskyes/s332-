#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import {
  ensureMemoryFabricStore,
  resetMemoryFabricStore,
  ingestMemoryEvent,
  loadMemoryGraph,
  queryMemoryGraph,
  buildMemoryContextInjection,
  explainMemoryBackedDecision,
  verifyMemoryGraph,
  verifyMemoryGraphPayload,
  renderMemoryPanel,
  resolveActiveCorrections
} from '../lib/skye-memory-fabric.mjs';

function parseArgs(argv) {
  return {
    strict: argv.includes('--strict'),
    json: argv.includes('--json')
  };
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section46-skye-memory-fabric.mjs');

  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_46_SKYE_MEMORY_FABRIC.json');
  const outputDir = path.join(config.rootDir, 'dist', 'section46', 'memory-fabric');
  const corruptedGraphFile = path.join(outputDir, 'graph-corrupted.json');
  const explanationFile = path.join(outputDir, 'memory-explanation.json');
  const contextFile = path.join(outputDir, 'memory-context.json');
  const panelFile = path.join(outputDir, 'memory-panel.html');

  resetMemoryFabricStore(config);
  const storePaths = ensureMemoryFabricStore(config);

  const baseDetail = {
    workspaceId: 'section46-memory',
    workspaceLabel: 'Section 46 Memory Fabric Fixture',
    repoId: 'skyehands-core',
    repoLabel: 'SkyeHands Core',
    tenantId: 'local',
    taskKey: 'repair-proofops-hash-drift',
    summary: 'Repair ProofOps hash drift after manifest ordering mismatch',
    runId: 'run-section46-001',
    runLabel: 'Section 46 fixture run',
    filePaths: [
      'apps/skyequanta-shell/bin/proofops-bundle.mjs',
      'apps/skyequanta-shell/bin/proofops-validate.mjs'
    ],
    symbols: ['buildEvidencePack', 'validateEvidencePack'],
    dependencies: ['node:crypto', 'node:fs'],
    testCases: ['proofops hash manifest rejects drift'],
    failureSignature: 'proofops.hash.manifest.ordering',
    issueKey: 'proofops-hash-drift',
    issueLabel: 'ProofOps Hash Drift',
    category: 'evidence-integrity'
  };

  const planning = ingestMemoryEvent(config, 'agent-planning', {
    ...baseDetail,
    occurredAt: '2026-04-07T19:10:00.000Z',
    plan: [
      'Reproduce the evidence-pack hash drift',
      'Compare proofops-bundle and proofops-validate manifest order',
      'Persist the accepted repair and human correction'
    ]
  });

  const fileEdit = ingestMemoryEvent(config, 'file-edit', {
    ...baseDetail,
    occurredAt: '2026-04-07T19:11:00.000Z',
    summary: 'Touched ProofOps bundle and validator while reproducing hash drift'
  });

  const command = ingestMemoryEvent(config, 'command-execution', {
    ...baseDetail,
    occurredAt: '2026-04-07T19:12:00.000Z',
    command: 'npm run proofops:bundle && npm run proofops:validate',
    exitCode: 1,
    summary: 'Evidence bundle command reproduced the hash mismatch'
  });

  const failure = ingestMemoryEvent(config, 'test-failure', {
    ...baseDetail,
    occurredAt: '2026-04-07T19:13:00.000Z',
    summary: 'ProofOps validator rejected the evidence pack because hash inputs were out of canonical order'
  });

  const repair = ingestMemoryEvent(config, 'runtime-repair', {
    ...baseDetail,
    occurredAt: '2026-04-07T19:14:00.000Z',
    summary: 'Stored repair: canonicalize proof manifest ordering before signing',
    fixKey: 'proofops-canonical-manifest-order',
    fixLabel: 'Canonical manifest ordering repair',
    patchSummary: 'Sort manifest entries and reuse the same canonical order in bundle and validator',
    recommendation: 'Apply canonical manifest ordering before generating or verifying evidence pack hashes.',
    correctionSource: 'repair'
  });

  const oldAutomatedCorrection = ingestMemoryEvent(config, 'user-override', {
    ...baseDetail,
    occurredAt: '2026-04-07T19:15:00.000Z',
    summary: 'Older automated rule: retry the bundle after a second hash pass',
    correctionKey: 'proofops-hash-retry-rule-v1',
    ruleKey: 'proofops-hash-retry-rule',
    correctionKind: 'architecture-rule',
    recommendation: 'Retry the hash pass a second time before mutating ProofOps manifest order.',
    correctionSource: 'automated'
  });

  const humanCorrection = ingestMemoryEvent(config, 'user-override', {
    ...baseDetail,
    occurredAt: '2026-04-07T19:16:00.000Z',
    summary: 'Accepted architecture rule: never retry a drifted proof bundle without canonical manifest ordering',
    correctionKey: 'proofops-hash-retry-rule-v2-human',
    ruleKey: 'proofops-hash-retry-rule',
    correctionKind: 'architecture-rule',
    recommendation: 'Use canonical manifest ordering first; do not retry a drifted evidence pack blindly.',
    correctionSource: 'human'
  });

  const duplicateHumanCorrection = ingestMemoryEvent(config, 'user-override', {
    ...baseDetail,
    occurredAt: '2026-04-07T19:16:00.000Z',
    summary: 'Accepted architecture rule: never retry a drifted proof bundle without canonical manifest ordering',
    correctionKey: 'proofops-hash-retry-rule-v2-human',
    ruleKey: 'proofops-hash-retry-rule',
    correctionKind: 'architecture-rule',
    recommendation: 'Use canonical manifest ordering first; do not retry a drifted evidence pack blindly.',
    correctionSource: 'human'
  });

  const policyDenial = ingestMemoryEvent(config, 'policy-denial', {
    ...baseDetail,
    occurredAt: '2026-04-07T19:17:00.000Z',
    summary: 'Policy denied shipping the bundle while hash drift remained unresolved',
    policyKey: 'proofops-export-denied-on-drift',
    action: 'export-proof-bundle',
    outcome: 'denied'
  });

  const audit = ingestMemoryEvent(config, 'audit-verification', {
    ...baseDetail,
    occurredAt: '2026-04-07T19:18:00.000Z',
    summary: 'Audit verification accepted the repaired manifest ordering evidence'
  });

  const deploy = ingestMemoryEvent(config, 'deploy', {
    ...baseDetail,
    occurredAt: '2026-04-07T19:19:00.000Z',
    summary: 'Deployment captured after the repaired ProofOps evidence pack passed validation',
    deploymentKey: 'section46-proofops-deploy',
    environment: 'proof-fixture',
    artifact: 'proofops-evidence-pack-v2',
    status: 'verified'
  });

  const initialVerify = verifyMemoryGraph(config);
  const panel = renderMemoryPanel(config, { panelFile });

  const persistedReload = loadMemoryGraph(config);
  const similarFailures = queryMemoryGraph(config, 'similar_prior_failures', {
    failureSignature: baseDetail.failureSignature,
    filePath: 'apps/skyequanta-shell/bin/proofops-bundle.mjs'
  });
  const relatedCorrections = queryMemoryGraph(config, 'related_corrections', {
    failureSignature: baseDetail.failureSignature,
    filePath: 'apps/skyequanta-shell/bin/proofops-bundle.mjs',
    ruleKey: 'proofops-hash-retry-rule'
  });
  const moveTogether = queryMemoryGraph(config, 'files_that_move_together', {
    filePath: 'apps/skyequanta-shell/bin/proofops-bundle.mjs'
  });
  const architectureRules = queryMemoryGraph(config, 'accepted_architecture_rules', {
    ruleKey: 'proofops-hash-retry-rule'
  });
  const context = buildMemoryContextInjection(config, {
    failureSignature: baseDetail.failureSignature,
    filePath: 'apps/skyequanta-shell/bin/proofops-bundle.mjs',
    ruleKey: 'proofops-hash-retry-rule',
    taskKey: baseDetail.taskKey
  });
  const explanation = explainMemoryBackedDecision(config, {
    failureSignature: baseDetail.failureSignature,
    filePath: 'apps/skyequanta-shell/bin/proofops-bundle.mjs',
    ruleKey: 'proofops-hash-retry-rule'
  });

  writeJson(contextFile, context);
  writeJson(explanationFile, explanation);

  const activeCorrections = resolveActiveCorrections(persistedReload.graph, {
    ruleKey: 'proofops-hash-retry-rule'
  });

  fs.mkdirSync(outputDir, { recursive: true });
  const corruptedGraph = JSON.parse(JSON.stringify(persistedReload.graph));
  corruptedGraph.edges[0].hash = 'deadbeef';
  writeJson(corruptedGraphFile, corruptedGraph);
  const corruptedVerification = verifyMemoryGraphPayload(corruptedGraph);

  const checks = [
    assertCheck(initialVerify.ok, 'Create a durable engineering memory graph store', { graphFile: storePaths.graphFile, verify: initialVerify }),
    assertCheck(persistedReload.graph.nodeClasses.every(value => persistedReload.graph.nodeClasses.includes(value)) && ['workspace', 'repo', 'file', 'symbol', 'issue', 'task', 'run', 'failure', 'fix', 'deployment', 'policy-decision', 'user-correction', 'dependency', 'test-case'].every(value => persistedReload.graph.nodeClasses.includes(value)), 'Add node classes for workspace, repo, file, symbol, issue, task, run, failure, fix, deployment, policy-decision, user-correction, dependency, test-case', { nodeClasses: persistedReload.graph.nodeClasses }),
    assertCheck(['touched', 'caused', 'fixed-by', 'related-to', 'blocked-by', 'approved-by', 'failed-under', 'reoccurred-in'].every(value => persistedReload.graph.edgeClasses.includes(value)), 'Add edge classes for touched, caused, fixed-by, related-to, blocked-by, approved-by, failed-under, reoccurred-in', { edgeClasses: persistedReload.graph.edgeClasses }),
    assertCheck(persistedReload.graph.events.map(event => event.type).includes('agent-planning')
      && persistedReload.graph.events.map(event => event.type).includes('file-edit')
      && persistedReload.graph.events.map(event => event.type).includes('command-execution')
      && persistedReload.graph.events.map(event => event.type).includes('test-failure')
      && persistedReload.graph.events.map(event => event.type).includes('deploy')
      && persistedReload.graph.events.map(event => event.type).includes('policy-denial')
      && persistedReload.graph.events.map(event => event.type).includes('runtime-repair')
      && persistedReload.graph.events.map(event => event.type).includes('audit-verification')
      && persistedReload.graph.events.map(event => event.type).includes('user-override'), 'Ingest memory events from agent planning, file edits, command execution, test failures, deploys, policy denials, runtime repair, audit verification, and user overrides', { eventTypes: persistedReload.graph.events.map(event => event.type) }),
    assertCheck(similarFailures.count >= 1 && relatedCorrections.count >= 1 && moveTogether.count >= 1 && architectureRules.count >= 1, 'Add memory retrieval API for “similar prior failures,” “related corrections,” “files that move together,” and “accepted architecture rules”', { similarFailures, relatedCorrections, moveTogether, architectureRules }),
    assertCheck(context.decisionChanged && context.after.strategy === 'apply-memory-backed-repair', 'Add memory-aware context injection for future autonomous runs', context),
    assertCheck(fs.existsSync(panel.panelFile) && panel.html.includes('Memory Timeline') && panel.html.includes('Related Context Inspection'), 'Add UI panel for memory timeline and related-context inspection', { panelFile: panel.panelFile }),
    assertCheck(explanation.decisionChanged && explanation.citedMemory.length >= 1, 'Add explanation surface that cites memory-backed reasons for future decisions', explanation),
    assertCheck(planning.event?.type === 'agent-planning' && planning.coreNodes?.taskNode?.id, 'Create a fixture task run', { runId: planning.coreNodes?.runNode?.id, taskId: planning.coreNodes?.taskNode?.id }),
    assertCheck(failure.primaryNode?.class === 'failure', 'Create a fixture failure', { failureNode: failure.primaryNode?.id }),
    assertCheck(repair.primaryNode?.class === 'fix', 'Store a successful repair', { fixNode: repair.primaryNode?.id }),
    assertCheck(humanCorrection.primaryNode?.class === 'user-correction', 'Store a human correction', { correctionNode: humanCorrection.primaryNode?.id }),
    assertCheck(persistedReload.graph.events.length >= 9 && persistedReload.graph.nodes.length >= 10, 'Restart the runtime and prove memory persistence', { eventCount: persistedReload.graph.events.length, nodeCount: persistedReload.graph.nodes.length, graphFile: storePaths.graphFile }),
    assertCheck(context.decisionChanged && context.after.recommendation.includes('canonical manifest ordering'), 'Query the memory graph and prove a future autonomous decision changes because of stored prior context', context),
    assertCheck(duplicateHumanCorrection.duplicate === true && persistedReload.graph.events.filter(event => event.type === 'user-override').length === 2, 'Inject duplicate events and prove dedupe behavior', { duplicateHumanCorrection }),
    assertCheck(activeCorrections.length === 1 && activeCorrections[0].active.attributes?.correctionSource === 'human' && activeCorrections[0].lineage.length >= 2, 'Inject contradictory correction and prove precedence rules', { activeCorrections }),
    assertCheck(corruptedVerification.ok === false && corruptedVerification.errors.some(error => error.includes('Edge hash mismatch')), 'Corrupt one graph edge and prove graph verification fails loudly', corruptedVerification),
    assertCheck(fs.existsSync(proofFile), 'Create proof artifact docs/proof/SECTION_46_SKYE_MEMORY_FABRIC.json', { proofFile }),
    assertCheck(context.decisionChanged && explanation.decisionChanged && explanation.summary.includes('canonical manifest ordering'), 'The system can truthfully show that a prior failure and correction materially changed a later autonomous decision', { context, explanation })
  ];

  const payload = {
    section: 46,
    label: 'section-46-skye-memory-fabric',
    generatedAt: new Date().toISOString(),
    pass: checks.every(item => item.pass),
    strict: options.strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section46-skye-memory-fabric.mjs --strict',
    smokeCommand: 'bash scripts/smoke-section46-skye-memory-fabric.sh',
    checks,
    hostileChecks: [
      { name: 'duplicate-event-dedupe', pass: duplicateHumanCorrection.duplicate === true, detail: duplicateHumanCorrection },
      { name: 'contradictory-correction-precedence', pass: activeCorrections[0]?.active?.attributes?.correctionSource === 'human', detail: activeCorrections },
      { name: 'corrupted-edge-verification', pass: corruptedVerification.ok === false, detail: corruptedVerification }
    ],
    recoveryChecks: [
      { name: 'reload-graph-from-disk', pass: persistedReload.graph.events.length >= 9, detail: { graphFile: storePaths.graphFile, eventCount: persistedReload.graph.events.length } },
      { name: 'memory-context-injection-after-restart', pass: context.decisionChanged, detail: context.after }
    ],
    evidence: {
      graphFile: storePaths.graphFile,
      journalFile: storePaths.journalFile,
      panelFile: panel.panelFile,
      contextFile,
      explanationFile,
      queries: {
        similarFailures,
        relatedCorrections,
        moveTogether,
        architectureRules
      },
      eventFingerprints: persistedReload.graph.eventFingerprints,
      artifactReferences: {
        proofFile,
        corruptedGraphFile,
        panelFile: panel.panelFile,
        contextFile,
        explanationFile
      }
    }
  };

  const written = writeProofJson(proofFile, payload, config, 'workspace-proof-section46-skye-memory-fabric.mjs');
  if (options.json || true) {
    process.stdout.write(`${JSON.stringify(written, null, 2)}\n`);
  }
  if (options.strict && !written.pass) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
