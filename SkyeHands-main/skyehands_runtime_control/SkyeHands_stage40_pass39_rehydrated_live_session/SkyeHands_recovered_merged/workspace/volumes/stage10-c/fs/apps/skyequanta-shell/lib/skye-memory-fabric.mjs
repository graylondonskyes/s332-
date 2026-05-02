import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { getRuntimePaths } from './runtime.mjs';

const NODE_CLASSES = [
  'workspace',
  'repo',
  'file',
  'symbol',
  'issue',
  'task',
  'run',
  'failure',
  'fix',
  'deployment',
  'policy-decision',
  'user-correction',
  'dependency',
  'test-case'
];

const EDGE_CLASSES = [
  'touched',
  'caused',
  'fixed-by',
  'related-to',
  'blocked-by',
  'approved-by',
  'failed-under',
  'reoccurred-in'
];

const EVENT_TYPES = [
  'agent-planning',
  'file-edit',
  'command-execution',
  'test-failure',
  'deploy',
  'policy-denial',
  'runtime-repair',
  'audit-verification',
  'user-override'
];

const CORRECTION_PRECEDENCE = {
  automated: 10,
  repair: 20,
  policy: 30,
  human: 40
};

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function stableHash(value) {
  return sha256(canonicalJson(value));
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizePathLike(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\/+/g, '');
}

function normalizeArray(values, mapper = value => value) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(mapper)
    .filter(Boolean))];
}

function correctionPriority(source) {
  return CORRECTION_PRECEDENCE[String(source || '').trim().toLowerCase()] || 0;
}

function eventFingerprint(eventType, detail) {
  return stableHash({ eventType, detail });
}

function defaultGraph(now = new Date().toISOString()) {
  return {
    version: 1,
    generatedAt: now,
    updatedAt: now,
    nodeClasses: [...NODE_CLASSES],
    edgeClasses: [...EDGE_CLASSES],
    eventTypes: [...EVENT_TYPES],
    correctionPrecedence: { ...CORRECTION_PRECEDENCE },
    nodes: [],
    edges: [],
    events: [],
    eventFingerprints: [],
    journals: [],
    verification: {
      lastVerifiedAt: null,
      lastVerificationHash: null,
      lastVerificationResult: null
    }
  };
}

function getMemoryFabricPaths(config) {
  const runtimePaths = getRuntimePaths(config);
  const baseDir = path.join(runtimePaths.runtimeDir, 'memory-fabric');
  return {
    baseDir,
    graphFile: path.join(baseDir, 'graph.json'),
    journalFile: path.join(baseDir, 'journal.ndjson'),
    panelFile: path.join(baseDir, 'panel.html')
  };
}

export function ensureMemoryFabricStore(config) {
  const paths = getMemoryFabricPaths(config);
  ensureDirectory(paths.baseDir);
  if (!fs.existsSync(paths.graphFile)) {
    writeJson(paths.graphFile, defaultGraph());
  }
  if (!fs.existsSync(paths.journalFile)) {
    fs.writeFileSync(paths.journalFile, '', 'utf8');
  }
  return paths;
}

export function resetMemoryFabricStore(config) {
  const paths = getMemoryFabricPaths(config);
  ensureDirectory(paths.baseDir);
  writeJson(paths.graphFile, defaultGraph());
  fs.writeFileSync(paths.journalFile, '', 'utf8');
  return paths;
}

export function loadMemoryGraph(config, options = {}) {
  const paths = ensureMemoryFabricStore(config);
  const graph = readJson(options.graphFile || paths.graphFile, defaultGraph());
  graph.nodeClasses = [...new Set([...(graph.nodeClasses || []), ...NODE_CLASSES])];
  graph.edgeClasses = [...new Set([...(graph.edgeClasses || []), ...EDGE_CLASSES])];
  graph.eventTypes = [...new Set([...(graph.eventTypes || []), ...EVENT_TYPES])];
  graph.correctionPrecedence = { ...CORRECTION_PRECEDENCE, ...(graph.correctionPrecedence || {}) };
  graph.nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  graph.edges = Array.isArray(graph.edges) ? graph.edges : [];
  graph.events = Array.isArray(graph.events) ? graph.events : [];
  graph.eventFingerprints = normalizeArray(graph.eventFingerprints, value => String(value || '').trim());
  graph.journals = Array.isArray(graph.journals) ? graph.journals : [];
  graph.verification = graph.verification || {
    lastVerifiedAt: null,
    lastVerificationHash: null,
    lastVerificationResult: null
  };
  return { graph, paths };
}

function saveMemoryGraph(config, graph, options = {}) {
  const paths = ensureMemoryFabricStore(config);
  graph.updatedAt = new Date().toISOString();
  writeJson(options.graphFile || paths.graphFile, graph);
  return paths;
}

function appendJournalLine(filePath, payload) {
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, 'utf8');
}

function getNode(graph, id) {
  return graph.nodes.find(node => node.id === id) || null;
}

function upsertNode(graph, nodeClass, key, attributes = {}, options = {}) {
  const normalizedClass = String(nodeClass || '').trim();
  if (!NODE_CLASSES.includes(normalizedClass)) {
    throw new Error(`Unsupported memory node class '${nodeClass}'.`);
  }
  const nodeId = `${normalizedClass}:${normalizeKey(key || attributes.key || attributes.label || normalizedClass)}`;
  const now = options.at || new Date().toISOString();
  let existing = getNode(graph, nodeId);
  if (!existing) {
    existing = {
      id: nodeId,
      class: normalizedClass,
      key: normalizeKey(key || attributes.key || attributes.label || normalizedClass),
      label: String(attributes.label || key || nodeId),
      createdAt: now,
      updatedAt: now,
      attributes: {},
      sourceEvents: []
    };
    graph.nodes.push(existing);
  }
  existing.updatedAt = now;
  existing.label = String(attributes.label || existing.label || key || nodeId);
  existing.attributes = {
    ...(existing.attributes || {}),
    ...attributes
  };
  const sourceEvent = options.sourceEventFingerprint || options.sourceEvent || null;
  if (sourceEvent) {
    existing.sourceEvents = normalizeArray([...(existing.sourceEvents || []), sourceEvent], value => String(value || '').trim());
  }
  return existing;
}

function edgeHash(edge) {
  return stableHash({
    from: edge.from,
    to: edge.to,
    type: edge.type,
    sourceEventFingerprint: edge.sourceEventFingerprint,
    attributes: edge.attributes || {}
  });
}

function upsertEdge(graph, type, fromNodeId, toNodeId, attributes = {}, options = {}) {
  const normalizedType = String(type || '').trim();
  if (!EDGE_CLASSES.includes(normalizedType)) {
    throw new Error(`Unsupported memory edge class '${type}'.`);
  }
  const sourceEventFingerprint = options.sourceEventFingerprint || null;
  const edgeId = `${normalizedType}:${normalizeKey(fromNodeId)}:${normalizeKey(toNodeId)}:${sourceEventFingerprint ? sourceEventFingerprint.slice(0, 12) : 'manual'}`;
  let existing = graph.edges.find(edge => edge.id === edgeId);
  const now = options.at || new Date().toISOString();
  if (!existing) {
    existing = {
      id: edgeId,
      type: normalizedType,
      from: fromNodeId,
      to: toNodeId,
      createdAt: now,
      updatedAt: now,
      sourceEventFingerprint,
      attributes: {}
    };
    graph.edges.push(existing);
  }
  existing.updatedAt = now;
  existing.attributes = { ...(existing.attributes || {}), ...attributes };
  existing.hash = edgeHash(existing);
  return existing;
}

function registerEvent(graph, eventType, detail, options = {}) {
  const at = options.at || detail.occurredAt || new Date().toISOString();
  const normalizedDetail = {
    ...detail,
    occurredAt: at,
    workspaceId: String(detail.workspaceId || 'local'),
    repoId: String(detail.repoId || 'skyehands-core')
  };
  normalizedDetail.filePaths = normalizeArray(normalizedDetail.filePaths, normalizePathLike);
  normalizedDetail.symbols = normalizeArray(normalizedDetail.symbols, value => String(value || '').trim());
  normalizedDetail.dependencies = normalizeArray(normalizedDetail.dependencies, value => String(value || '').trim());
  normalizedDetail.testCases = normalizeArray(normalizedDetail.testCases, value => String(value || '').trim());
  const fingerprint = eventFingerprint(eventType, normalizedDetail);
  const duplicate = graph.eventFingerprints.includes(fingerprint);
  if (duplicate) {
    return {
      duplicate: true,
      fingerprint,
      event: graph.events.find(entry => entry.fingerprint === fingerprint) || null,
      detail: normalizedDetail
    };
  }
  const event = {
    id: `${String(eventType).trim()}-${graph.events.length + 1}`,
    type: String(eventType).trim(),
    occurredAt: at,
    fingerprint,
    detail: normalizedDetail
  };
  graph.events.push(event);
  graph.eventFingerprints.push(fingerprint);
  graph.journals.push({ fingerprint, type: event.type, occurredAt: at });
  return {
    duplicate: false,
    fingerprint,
    event,
    detail: normalizedDetail
  };
}

function recordCoreNodes(graph, registration) {
  const { event, fingerprint, detail } = registration;
  const workspaceNode = upsertNode(graph, 'workspace', detail.workspaceId, {
    label: detail.workspaceLabel || detail.workspaceId,
    tenantId: detail.tenantId || 'local'
  }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  const repoNode = upsertNode(graph, 'repo', detail.repoId, {
    label: detail.repoLabel || detail.repoId,
    workspaceId: detail.workspaceId
  }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  const taskNode = upsertNode(graph, 'task', detail.taskKey || detail.summary || event.type, {
    label: detail.summary || detail.taskKey || event.type,
    workspaceId: detail.workspaceId,
    repoId: detail.repoId,
    category: detail.category || event.type
  }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  const runNode = upsertNode(graph, 'run', detail.runId || `${detail.workspaceId}-${detail.taskKey || event.type}`, {
    label: detail.runLabel || detail.runId || `${detail.workspaceId}-${event.type}`,
    taskKey: detail.taskKey || null,
    eventType: event.type,
    policyMode: detail.policyMode || null,
    budgetMode: detail.budgetMode || null
  }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  upsertEdge(graph, 'related-to', workspaceNode.id, repoNode.id, { reason: 'workspace-repo-link' }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  upsertEdge(graph, 'approved-by', taskNode.id, workspaceNode.id, { reason: 'task-owned-by-workspace' }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  upsertEdge(graph, 'related-to', runNode.id, taskNode.id, { reason: 'run-for-task' }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  return { workspaceNode, repoNode, taskNode, runNode };
}

function linkFilesAndSymbols(graph, registration, runNode) {
  const { event, fingerprint, detail } = registration;
  const fileNodes = detail.filePaths.map(filePath => {
    const node = upsertNode(graph, 'file', filePath, {
      label: filePath,
      repoId: detail.repoId,
      workspaceId: detail.workspaceId
    }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
    upsertEdge(graph, 'touched', runNode.id, node.id, { reason: event.type }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
    return node;
  });
  const symbolNodes = detail.symbols.map(symbol => {
    const node = upsertNode(graph, 'symbol', `${detail.repoId}:${symbol}`, {
      label: symbol,
      repoId: detail.repoId,
      workspaceId: detail.workspaceId
    }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
    upsertEdge(graph, 'related-to', runNode.id, node.id, { reason: event.type }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
    return node;
  });
  for (const fileNode of fileNodes) {
    for (const symbolNode of symbolNodes) {
      upsertEdge(graph, 'related-to', fileNode.id, symbolNode.id, { reason: 'symbol-in-file' }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
    }
  }
  return { fileNodes, symbolNodes };
}

function ingestPlanning(graph, registration, core) {
  const { event, fingerprint, detail } = registration;
  core.taskNode.attributes.plan = detail.plan || null;
  core.runNode.attributes.planSummary = detail.summary || null;
  if (detail.issueKey) {
    const issueNode = upsertNode(graph, 'issue', detail.issueKey, {
      label: detail.issueLabel || detail.issueKey,
      workspaceId: detail.workspaceId
    }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
    upsertEdge(graph, 'blocked-by', core.taskNode.id, issueNode.id, { reason: 'issue-linked-to-task' }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  }
}

function ingestCommandExecution(graph, registration, core) {
  const { event, fingerprint, detail } = registration;
  core.runNode.attributes.lastCommand = detail.command || null;
  core.runNode.attributes.lastExitCode = detail.exitCode ?? null;
  if (detail.dependencies?.length) {
    for (const dependency of detail.dependencies) {
      const dependencyNode = upsertNode(graph, 'dependency', `${detail.repoId}:${dependency}`, {
        label: dependency,
        repoId: detail.repoId
      }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
      upsertEdge(graph, 'related-to', core.runNode.id, dependencyNode.id, { reason: 'command-dependency' }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
    }
  }
}

function ingestFailure(graph, registration, core) {
  const { event, fingerprint, detail } = registration;
  const signature = detail.failureSignature || detail.summary || detail.taskKey || `failure-${graph.events.length}`;
  const failureNode = upsertNode(graph, 'failure', signature, {
    label: detail.failureLabel || signature,
    signature,
    category: detail.category || 'test-failure',
    filePath: detail.filePaths?.[0] || null,
    taskKey: detail.taskKey || null
  }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  upsertEdge(graph, 'caused', failureNode.id, core.taskNode.id, { reason: detail.summary || event.type }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  for (const testCaseName of detail.testCases || []) {
    const testCaseNode = upsertNode(graph, 'test-case', `${detail.repoId}:${testCaseName}`, {
      label: testCaseName,
      repoId: detail.repoId
    }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
    upsertEdge(graph, 'failed-under', failureNode.id, testCaseNode.id, { reason: 'test-failure' }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  }
  const priorFailures = graph.nodes
    .filter(node => node.class === 'failure' && node.id !== failureNode.id)
    .filter(node => node.attributes?.signature === signature);
  for (const prior of priorFailures) {
    upsertEdge(graph, 'reoccurred-in', prior.id, failureNode.id, { reason: 'same-signature' }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  }
  return failureNode;
}

function ingestRepair(graph, registration, core) {
  const { event, fingerprint, detail } = registration;
  const fixNode = upsertNode(graph, 'fix', detail.fixKey || detail.summary || `fix-${graph.events.length}`, {
    label: detail.fixLabel || detail.summary || detail.fixKey || 'runtime repair',
    patchSummary: detail.patchSummary || null,
    recommendation: detail.recommendation || null,
    filePaths: detail.filePaths || []
  }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  upsertEdge(graph, 'approved-by', fixNode.id, core.runNode.id, { reason: event.type }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  if (detail.failureSignature) {
    const failureNode = upsertNode(graph, 'failure', detail.failureSignature, {
      label: detail.failureLabel || detail.failureSignature,
      signature: detail.failureSignature
    }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
    upsertEdge(graph, 'fixed-by', failureNode.id, fixNode.id, {
      reason: detail.summary || 'stored repair',
      recommendation: detail.recommendation || null
    }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  }
  return fixNode;
}

function ingestDeploy(graph, registration, core) {
  const { event, fingerprint, detail } = registration;
  const deploymentNode = upsertNode(graph, 'deployment', detail.deploymentKey || detail.environment || `deployment-${graph.events.length}`, {
    label: detail.environment || detail.deploymentKey || 'deployment',
    artifact: detail.artifact || null,
    status: detail.status || null
  }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  upsertEdge(graph, 'approved-by', deploymentNode.id, core.runNode.id, { reason: 'deploy-event' }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
}

function ingestPolicyDecision(graph, registration, core) {
  const { event, fingerprint, detail } = registration;
  const decisionKey = detail.policyKey || detail.summary || `${event.type}-${graph.events.length}`;
  const decisionNode = upsertNode(graph, 'policy-decision', decisionKey, {
    label: detail.summary || decisionKey,
    action: detail.action || null,
    outcome: detail.outcome || (event.type === 'policy-denial' ? 'denied' : 'recorded')
  }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  upsertEdge(graph, 'blocked-by', core.taskNode.id, decisionNode.id, { reason: detail.summary || event.type }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  return decisionNode;
}

function ingestUserCorrection(graph, registration, core) {
  const { event, fingerprint, detail } = registration;
  const correctionKey = detail.correctionKey || detail.ruleKey || detail.summary || `correction-${graph.events.length}`;
  const correctionNode = upsertNode(graph, 'user-correction', correctionKey, {
    label: detail.summary || correctionKey,
    correctionKey,
    ruleKey: detail.ruleKey || correctionKey,
    correctionSource: detail.correctionSource || 'human',
    correctionKind: detail.correctionKind || 'user-override',
    recommendation: detail.recommendation || null,
    appliesToFailureSignature: detail.failureSignature || null,
    appliesToFilePath: detail.filePaths?.[0] || null,
    precedence: correctionPriority(detail.correctionSource || 'human')
  }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  upsertEdge(graph, 'approved-by', correctionNode.id, core.workspaceNode.id, { reason: 'user-override' }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  if (detail.failureSignature) {
    const failureNode = upsertNode(graph, 'failure', detail.failureSignature, {
      label: detail.failureLabel || detail.failureSignature,
      signature: detail.failureSignature
    }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
    upsertEdge(graph, 'related-to', correctionNode.id, failureNode.id, { reason: 'correction-for-failure' }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  }
  if (detail.ruleKey) {
    const decisionNode = upsertNode(graph, 'policy-decision', detail.ruleKey, {
      label: detail.summary || detail.ruleKey,
      action: 'accepted-architecture-rule',
      outcome: 'accepted',
      recommendation: detail.recommendation || null
    }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
    upsertEdge(graph, 'approved-by', decisionNode.id, correctionNode.id, { reason: 'architecture-rule' }, { at: event.occurredAt, sourceEventFingerprint: fingerprint });
  }
  return correctionNode;
}

export function ingestMemoryEvent(config, eventType, detail = {}, options = {}) {
  const { graph, paths } = loadMemoryGraph(config, options);
  if (!EVENT_TYPES.includes(String(eventType || '').trim())) {
    throw new Error(`Unsupported memory event type '${eventType}'.`);
  }
  const registration = registerEvent(graph, String(eventType).trim(), detail, options);
  if (registration.duplicate) {
    return {
      duplicate: true,
      fingerprint: registration.fingerprint,
      graph,
      paths,
      event: registration.event
    };
  }

  const core = recordCoreNodes(graph, registration);
  const { fileNodes, symbolNodes } = linkFilesAndSymbols(graph, registration, core.runNode);

  let primaryNode = null;
  switch (registration.event.type) {
    case 'agent-planning':
      ingestPlanning(graph, registration, core);
      break;
    case 'file-edit':
      core.runNode.attributes.lastEditedFiles = registration.detail.filePaths;
      break;
    case 'command-execution':
      ingestCommandExecution(graph, registration, core);
      break;
    case 'test-failure':
      primaryNode = ingestFailure(graph, registration, core);
      break;
    case 'runtime-repair':
      primaryNode = ingestRepair(graph, registration, core);
      break;
    case 'deploy':
      ingestDeploy(graph, registration, core);
      break;
    case 'policy-denial':
    case 'audit-verification':
      primaryNode = ingestPolicyDecision(graph, registration, core);
      break;
    case 'user-override':
      primaryNode = ingestUserCorrection(graph, registration, core);
      break;
    default:
      break;
  }

  const journalEntry = {
    fingerprint: registration.fingerprint,
    eventType: registration.event.type,
    occurredAt: registration.event.occurredAt,
    workspaceId: registration.detail.workspaceId,
    repoId: registration.detail.repoId,
    taskKey: registration.detail.taskKey || null,
    filePaths: registration.detail.filePaths,
    symbols: registration.detail.symbols,
    primaryNodeId: primaryNode?.id || null,
    summary: registration.detail.summary || null
  };
  appendJournalLine(paths.journalFile, journalEntry);
  saveMemoryGraph(config, graph, options);
  return {
    duplicate: false,
    fingerprint: registration.fingerprint,
    graph,
    paths,
    event: registration.event,
    primaryNode,
    fileNodes,
    symbolNodes,
    coreNodes: core
  };
}

function correctionCandidates(graph, criteria = {}) {
  const failureSignature = String(criteria.failureSignature || '').trim();
  const filePath = normalizePathLike(criteria.filePath || criteria.appliesToFilePath || '');
  const ruleKey = String(criteria.ruleKey || '').trim();
  return graph.nodes
    .filter(node => node.class === 'user-correction')
    .filter(node => {
      if (failureSignature && node.attributes?.appliesToFailureSignature === failureSignature) return true;
      if (filePath && node.attributes?.appliesToFilePath === filePath) return true;
      if (ruleKey && node.attributes?.ruleKey === ruleKey) return true;
      return !failureSignature && !filePath && !ruleKey;
    })
    .sort((a, b) => {
      const precedenceDelta = (b.attributes?.precedence || 0) - (a.attributes?.precedence || 0);
      if (precedenceDelta) return precedenceDelta;
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
}

export function resolveActiveCorrections(graph, criteria = {}) {
  const candidates = correctionCandidates(graph, criteria);
  const grouped = new Map();
  for (const node of candidates) {
    const key = node.attributes?.ruleKey || node.attributes?.correctionKey || node.id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(node);
  }
  const resolved = [];
  for (const [key, entries] of grouped.entries()) {
    const lineage = [...entries].sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)));
    const active = [...entries].sort((a, b) => {
      const precedenceDelta = (b.attributes?.precedence || 0) - (a.attributes?.precedence || 0);
      if (precedenceDelta) return precedenceDelta;
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    })[0];
    resolved.push({ key, active, lineage });
  }
  return resolved;
}

export function queryMemoryGraph(config, queryType, criteria = {}, options = {}) {
  const { graph } = loadMemoryGraph(config, options);
  const normalizedType = String(queryType || '').trim().toLowerCase();
  if (!normalizedType) {
    throw new Error('Memory query type is required.');
  }

  if (normalizedType === 'similar_prior_failures') {
    const failureSignature = String(criteria.failureSignature || '').trim();
    const filePath = normalizePathLike(criteria.filePath || '');
    const matches = graph.nodes
      .filter(node => node.class === 'failure')
      .filter(node => {
        if (failureSignature && node.attributes?.signature === failureSignature) return true;
        if (filePath && node.attributes?.filePath === filePath) return true;
        return !failureSignature && !filePath;
      })
      .map(node => ({
        id: node.id,
        signature: node.attributes?.signature,
        label: node.label,
        filePath: node.attributes?.filePath || null,
        fixedBy: graph.edges
          .filter(edge => edge.type === 'fixed-by' && edge.from === node.id)
          .map(edge => ({ edgeId: edge.id, fixNodeId: edge.to, reason: edge.attributes?.reason || null, recommendation: edge.attributes?.recommendation || null }))
      }));
    return { queryType: normalizedType, criteria, count: matches.length, matches };
  }

  if (normalizedType === 'related_corrections') {
    const resolved = resolveActiveCorrections(graph, criteria).map(entry => ({
      key: entry.key,
      active: {
        id: entry.active.id,
        label: entry.active.label,
        recommendation: entry.active.attributes?.recommendation || null,
        correctionSource: entry.active.attributes?.correctionSource || null,
        precedence: entry.active.attributes?.precedence || 0,
        updatedAt: entry.active.updatedAt
      },
      lineage: entry.lineage.map(node => ({
        id: node.id,
        label: node.label,
        correctionSource: node.attributes?.correctionSource || null,
        precedence: node.attributes?.precedence || 0,
        updatedAt: node.updatedAt
      }))
    }));
    return { queryType: normalizedType, criteria, count: resolved.length, matches: resolved };
  }

  if (normalizedType === 'files_that_move_together') {
    const target = normalizePathLike(criteria.filePath || '');
    const touchedEdges = graph.edges.filter(edge => edge.type === 'touched');
    const runsForTarget = new Set(touchedEdges.filter(edge => edge.to === `file:${normalizeKey(target)}`).map(edge => edge.from));
    const coOccurrences = new Map();
    for (const edge of touchedEdges) {
      if (!runsForTarget.has(edge.from) || edge.to === `file:${normalizeKey(target)}`) continue;
      const node = getNode(graph, edge.to);
      const filePath = node?.label || edge.to;
      const current = coOccurrences.get(filePath) || { filePath, runCount: 0, runs: [] };
      current.runCount += 1;
      current.runs.push(edge.from);
      coOccurrences.set(filePath, current);
    }
    const matches = [...coOccurrences.values()].sort((a, b) => b.runCount - a.runCount || a.filePath.localeCompare(b.filePath));
    return { queryType: normalizedType, criteria, count: matches.length, matches };
  }

  if (normalizedType === 'accepted_architecture_rules') {
    const matches = resolveActiveCorrections(graph, criteria)
      .filter(entry => entry.active.attributes?.correctionKind === 'architecture-rule')
      .map(entry => ({
        ruleKey: entry.key,
        label: entry.active.label,
        recommendation: entry.active.attributes?.recommendation || null,
        correctionSource: entry.active.attributes?.correctionSource || null,
        updatedAt: entry.active.updatedAt
      }));
    return { queryType: normalizedType, criteria, count: matches.length, matches };
  }

  throw new Error(`Unsupported memory query type '${queryType}'.`);
}

export function buildMemoryContextInjection(config, request = {}, options = {}) {
  const similarFailures = queryMemoryGraph(config, 'similar_prior_failures', request, options);
  const relatedCorrections = queryMemoryGraph(config, 'related_corrections', request, options);
  const architectureRules = queryMemoryGraph(config, 'accepted_architecture_rules', request, options);
  const moveTogether = request.filePath
    ? queryMemoryGraph(config, 'files_that_move_together', { filePath: request.filePath }, options)
    : { queryType: 'files_that_move_together', criteria: {}, count: 0, matches: [] };

  const baselineDecision = {
    strategy: 'retry-last-known-flow',
    recommendation: 'Re-run the same failing path without prior-memory overrides.'
  };

  let strategy = 'retry-last-known-flow';
  let recommendation = 'Re-run the same failing path without prior-memory overrides.';
  let citations = [];

  const activeCorrection = relatedCorrections.matches?.[0]?.active || null;
  const similarRepair = similarFailures.matches?.find(match => Array.isArray(match.fixedBy) && match.fixedBy.length)?.fixedBy?.[0] || null;
  const architectureRule = architectureRules.matches?.[0] || null;

  if (activeCorrection || similarRepair || architectureRule) {
    strategy = 'apply-memory-backed-repair';
    recommendation = activeCorrection?.recommendation
      || similarRepair?.recommendation
      || architectureRule?.recommendation
      || 'Apply the stored correction path before retrying the run.';
    citations = [
      activeCorrection ? { type: 'user-correction', id: activeCorrection.id, label: activeCorrection.label } : null,
      similarRepair ? { type: 'fix', id: similarRepair.fixNodeId, label: similarRepair.reason || similarRepair.fixNodeId } : null,
      architectureRule ? { type: 'architecture-rule', id: architectureRule.ruleKey, label: architectureRule.label } : null
    ].filter(Boolean);
  }

  return {
    requestedAt: new Date().toISOString(),
    decisionChanged: strategy !== baselineDecision.strategy || recommendation !== baselineDecision.recommendation,
    before: baselineDecision,
    after: {
      strategy,
      recommendation
    },
    injectedContext: {
      similarFailures: similarFailures.matches,
      relatedCorrections: relatedCorrections.matches,
      filesThatMoveTogether: moveTogether.matches,
      acceptedArchitectureRules: architectureRules.matches
    },
    citations
  };
}

export function explainMemoryBackedDecision(config, request = {}, options = {}) {
  const context = buildMemoryContextInjection(config, request, options);
  const reasons = [];
  for (const citation of context.citations) {
    reasons.push(`${citation.type}:${citation.id}`);
  }
  return {
    summary: context.after.recommendation,
    decisionChanged: context.decisionChanged,
    strategy: context.after.strategy,
    citedMemory: reasons,
    context
  };
}

export function verifyMemoryGraphPayload(graph) {
  const errors = [];
  const nodeIds = new Set(graph.nodes.map(node => node.id));
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from)) errors.push(`Missing from node for edge ${edge.id}`);
    if (!nodeIds.has(edge.to)) errors.push(`Missing to node for edge ${edge.id}`);
    const expected = edgeHash(edge);
    if (edge.hash !== expected) {
      errors.push(`Edge hash mismatch for ${edge.id}`);
    }
  }
  for (const fingerprint of graph.eventFingerprints || []) {
    const event = graph.events.find(entry => entry.fingerprint === fingerprint);
    if (!event) {
      errors.push(`Missing event for fingerprint ${fingerprint}`);
      continue;
    }
    const expected = eventFingerprint(event.type, event.detail);
    if (expected !== fingerprint) {
      errors.push(`Event fingerprint mismatch for ${event.id}`);
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    verifiedAt: new Date().toISOString(),
    verificationHash: stableHash({ nodeCount: graph.nodes.length, edgeCount: graph.edges.length, eventCount: graph.events.length, errors })
  };
}

export function verifyMemoryGraph(config, options = {}) {
  const { graph, paths } = loadMemoryGraph(config, options);
  const result = verifyMemoryGraphPayload(graph);
  graph.verification = {
    lastVerifiedAt: result.verifiedAt,
    lastVerificationHash: result.verificationHash,
    lastVerificationResult: result.ok ? 'pass' : 'fail'
  };
  saveMemoryGraph(config, graph, options);
  return { ...result, graphFile: options.graphFile || paths.graphFile };
}

export function renderMemoryPanel(config, options = {}) {
  const { graph, paths } = loadMemoryGraph(config, options);
  const timelineItems = graph.events
    .map(event => `<tr><td>${event.occurredAt}</td><td>${event.type}</td><td>${String(event.detail.summary || '').replace(/</g, '&lt;')}</td><td>${event.fingerprint.slice(0, 12)}</td></tr>`)
    .join('\n');
  const correctionRows = resolveActiveCorrections(graph)
    .map(entry => `<tr><td>${entry.key}</td><td>${entry.active.label.replace(/</g, '&lt;')}</td><td>${String(entry.active.attributes?.recommendation || '').replace(/</g, '&lt;')}</td><td>${entry.active.attributes?.correctionSource || ''}</td></tr>`)
    .join('\n');
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>SkyeMemory Fabric Panel</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; background: #0d1022; color: #f3f6ff; }
    h1, h2 { margin-bottom: 8px; }
    .card { background: #141a33; border: 1px solid #2d3869; border-radius: 16px; padding: 16px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #28315a; vertical-align: top; }
    code { color: #d6b8ff; }
  </style>
</head>
<body>
  <h1>SkyeMemory Fabric</h1>
  <div class="card">
    <h2>Memory Timeline</h2>
    <table>
      <thead><tr><th>Occurred At</th><th>Event</th><th>Summary</th><th>Fingerprint</th></tr></thead>
      <tbody>${timelineItems}</tbody>
    </table>
  </div>
  <div class="card">
    <h2>Related Context Inspection</h2>
    <table>
      <thead><tr><th>Rule Key</th><th>Active Correction</th><th>Recommendation</th><th>Source</th></tr></thead>
      <tbody>${correctionRows}</tbody>
    </table>
  </div>
</body>
</html>\n`;
  ensureDirectory(path.dirname(options.panelFile || paths.panelFile));
  fs.writeFileSync(options.panelFile || paths.panelFile, html, 'utf8');
  return {
    panelFile: options.panelFile || paths.panelFile,
    html
  };
}
