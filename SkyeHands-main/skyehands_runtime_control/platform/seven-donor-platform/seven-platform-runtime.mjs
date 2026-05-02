import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { repoRoot } from '../../scripts/repo-paths.mjs';
import { loadSevenDonorRegistry, listDonors, runQualityGate, PROOFS_DIR } from './quality-gate-service.mjs';

export const RUNTIME_DIR = path.resolve(repoRoot(), '.skyequanta/skyeforgemax-runtime');
export const STORE_PATH = path.join(RUNTIME_DIR, 'store.json');
export const ARTIFACTS_DIR = path.join(RUNTIME_DIR, 'artifacts');
export const PUBLIC_APP_DIR = path.resolve(repoRoot(), 'public/skyeforgemax');

export const BRAND = {
  productName: 'SkyeForgeMax',
  systemName: 'skye-forge-max',
  tagline: 'Volcanic proof, certification, and launch command for sovereign app portfolios.',
  voice: 'molten, premium, direct, proof-first',
  palette: {
    obsidian: '#170b08',
    magmaRed: '#d7261e',
    lavaCrimson: '#8f120d',
    forgeGold: '#f6b73c',
    emberGold: '#ffdd75',
    ashWhite: '#fff3df'
  },
  gradient: 'linear-gradient(135deg, #170b08 0%, #8f120d 38%, #d7261e 68%, #f6b73c 100%)'
};

const LIVE_VAR_CONTRACTS = {
  providerGateway: ['OPENAI_API_KEY'],
  persistentDatabase: ['NEON_SQL_URL'],
  publicDeploy: ['NETLIFY_AUTH_TOKEN', 'NETLIFY_SITE_ID']
};

function isoNow() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, String(value), 'utf8');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function hasRealLiveVar(value) {
  const normalized = String(value || '').trim();
  return Boolean(normalized && normalized !== 'live-var-required' && normalized !== 'changeme' && normalized !== 'placeholder');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function freshStore() {
  return {
    schemaVersion: '2026-04-30.seven-platform-runtime',
    brand: BRAND,
    createdAt: isoNow(),
    updatedAt: isoNow(),
    tenants: [],
    actors: [],
    workspaces: [],
    sovereign: {
      envSets: [],
      variables: [],
      providerBindings: [],
      secretReferences: [],
      deploymentNotes: [],
      handoffPackages: [],
      auditEvidence: []
    },
    intake: {
      submissions: []
    },
    aeCentral: {
      projects: [],
      contentPlans: [],
      publishPayloads: []
    },
    roleAssistant: {
      personas: [],
      messages: []
    },
    qualityGate: {
      runs: []
    },
    valuation: {
      assets: [],
      certificationRuns: [],
      portfolioRuns: []
    },
    houseCommand: {
      dashboards: []
    },
    auditEvents: [],
    liveVarContracts: LIVE_VAR_CONTRACTS
  };
}

export function loadStore() {
  const store = readJson(STORE_PATH, null) || freshStore();
  return store;
}

export function saveStore(store) {
  store.updatedAt = isoNow();
  writeJson(STORE_PATH, store);
  return store;
}

export function resetRuntimeStore() {
  const store = freshStore();
  saveStore(store);
  return store;
}

function audit(store, event) {
  const record = {
    eventId: id('evt'),
    at: isoNow(),
    ...event
  };
  store.auditEvents.push(record);
  return record;
}

function requireWorkspace(store, workspaceId) {
  const workspace = store.workspaces.find((item) => item.workspaceId === workspaceId);
  if (!workspace) throw new Error(`workspace_not_found:${workspaceId}`);
  return workspace;
}

function latestQualityRun(store) {
  return store.qualityGate.runs[store.qualityGate.runs.length - 1] || null;
}

function scoreFromQuality(result) {
  const findings = Number(result?.summary?.totalFindings || 0);
  const scanned = Math.max(1, Number(result?.summary?.filesScanned || 1));
  const pressure = findings / scanned;
  return Math.max(0, Math.round(100 - Math.min(85, pressure * 120)));
}

function certificationLabel(score) {
  if (score >= 90) return 'Sovereign / Platform Grade';
  if (score >= 78) return 'Enterprise-Ready';
  if (score >= 64) return 'Integration-Ready';
  if (score >= 48) return 'Repair-Required';
  return 'Quarantine';
}

function assetWeight(platformId) {
  const weights = {
    'skye-quality-gate': 1.25,
    'skye-valuation-certification': 1.2,
    'skye-sovereign-primitives': 1.15,
    'skye-ae-central-growth': 1.1,
    'skye-house-command': 1,
    'skye-intake-funnel': 0.85,
    'skye-role-assistant': 0.8
  };
  return weights[platformId] || 1;
}

export function bootstrapRuntime(options = {}) {
  const store = options.reset ? resetRuntimeStore() : loadStore();
  const registry = loadSevenDonorRegistry();
  const donors = listDonors(registry);

  const tenant = store.tenants[0] || {
    tenantId: id('ten'),
    name: options.tenantName || 'SkyeHands Sovereign Tenant',
    plan: 'runtime-integrated',
    createdAt: isoNow()
  };
  if (!store.tenants.length) store.tenants.push(tenant);

  const actor = store.actors[0] || {
    actorId: id('act'),
    tenantId: tenant.tenantId,
    displayName: 'Runtime Operator',
    role: 'owner',
    createdAt: isoNow()
  };
  if (!store.actors.length) store.actors.push(actor);

  const workspace = store.workspaces[0] || {
    workspaceId: id('wks'),
    tenantId: tenant.tenantId,
    ownerActorId: actor.actorId,
    name: options.workspaceName || 'Seven Donor Integrated Workspace',
    status: 'active',
    donorPlatformIds: donors.map((donor) => donor.platformId),
    createdAt: isoNow(),
    updatedAt: isoNow()
  };
  if (!store.workspaces.length) store.workspaces.push(workspace);

  audit(store, {
    tenantId: tenant.tenantId,
    actorId: actor.actorId,
    workspaceId: workspace.workspaceId,
    action: 'runtime.bootstrap',
    entityType: 'workspace',
    entityId: workspace.workspaceId,
    detail: { donorCount: donors.length }
  });

  saveStore(store);
  return { store, tenant, actor, workspace, donors };
}

export function importSovereignEnvSet({ workspaceId, actorId, name = 'default-live-vars', env = {} } = {}) {
  const store = loadStore();
  const workspace = requireWorkspace(store, workspaceId);
  const envSet = {
    envSetId: id('env'),
    workspaceId,
    name,
    source: 'skye.sovereign.primitives',
    status: 'active',
    createdAt: isoNow()
  };
  store.sovereign.envSets.push(envSet);

  const entries = Object.entries(env);
  for (const [key, value] of entries) {
    const isSecret = /KEY|TOKEN|SECRET|PASSWORD|URL/i.test(key);
    const variable = {
      variableId: id('var'),
      envSetId: envSet.envSetId,
      workspaceId,
      key,
      classification: isSecret ? 'secret-reference' : 'plain',
      valuePreview: isSecret ? `${String(value).slice(0, 3)}...redacted` : String(value),
      valueHash: sha256(value),
      createdAt: isoNow()
    };
    store.sovereign.variables.push(variable);
    if (isSecret) {
      store.sovereign.secretReferences.push({
        secretReferenceId: id('sec'),
        variableId: variable.variableId,
        workspaceId,
        provider: key.includes('OPENAI') ? 'openai' : 'runtime',
        policy: 'redacted-at-rest-in-runtime-store',
        createdAt: isoNow()
      });
    }
  }

  for (const [provider, vars] of Object.entries(LIVE_VAR_CONTRACTS)) {
    const present = vars.filter((key) => hasRealLiveVar(env[key]) || hasRealLiveVar(process.env[key]));
    store.sovereign.providerBindings.push({
      providerBindingId: id('pvd'),
      envSetId: envSet.envSetId,
      workspaceId,
      provider,
      requiredVars: vars,
      presentVars: present,
      status: present.length === vars.length ? 'live-ready' : 'needs-live-vars',
      createdAt: isoNow()
    });
  }

  const evidence = {
    auditEvidenceId: id('sev'),
    workspaceId,
    envSetId: envSet.envSetId,
    evidenceType: 'sovereign.envSet.import',
    variableCount: entries.length,
    redactedSecretCount: store.sovereign.variables.filter((item) => item.envSetId === envSet.envSetId && item.classification === 'secret-reference').length,
    providerBindingIds: store.sovereign.providerBindings.filter((item) => item.envSetId === envSet.envSetId).map((item) => item.providerBindingId),
    createdAt: isoNow()
  };
  store.sovereign.auditEvidence.push(evidence);
  workspace.updatedAt = isoNow();
  audit(store, {
    tenantId: workspace.tenantId,
    actorId,
    workspaceId,
    action: 'sovereign.env.import',
    entityType: 'sovereign.envSet',
    entityId: envSet.envSetId,
    detail: { variableCount: entries.length, evidenceId: evidence.auditEvidenceId }
  });
  saveStore(store);
  return { envSet, evidence };
}

export function submitIntake({ workspaceId, actorId, lane = 'jobseeker', name = 'Example Lead', email = 'lead@example.com', company = 'Example Co', need = 'Growth and platform proof' } = {}) {
  const store = loadStore();
  const workspace = requireWorkspace(store, workspaceId);
  const submission = {
    submissionId: id('sub'),
    workspaceId,
    lane,
    name,
    email,
    company,
    need,
    status: 'accepted',
    source: 'skye.intake.funnel',
    createdAt: isoNow()
  };
  store.intake.submissions.push(submission);
  audit(store, {
    tenantId: workspace.tenantId,
    actorId,
    workspaceId,
    action: 'intake.submission.accepted',
    entityType: 'intake.submission',
    entityId: submission.submissionId,
    detail: { lane }
  });
  saveStore(store);
  return submission;
}

export function createAeProjectFromIntake({ workspaceId, actorId, submissionId } = {}) {
  const store = loadStore();
  const workspace = requireWorkspace(store, workspaceId);
  const submission = store.intake.submissions.find((item) => item.submissionId === submissionId);
  if (!submission) throw new Error(`submission_not_found:${submissionId}`);
  const project = {
    projectId: id('prj'),
    workspaceId,
    submissionId,
    accountName: submission.company || submission.name,
    status: 'active',
    source: 'skye.ae.central',
    workflow: ['intake', 'research', 'content-plan', 'brief', 'draft', 'publish-payload'],
    createdAt: isoNow(),
    updatedAt: isoNow()
  };
  store.aeCentral.projects.push(project);
  audit(store, {
    tenantId: workspace.tenantId,
    actorId,
    workspaceId,
    action: 'ae.project.created',
    entityType: 'ae.project',
    entityId: project.projectId,
    detail: { submissionId }
  });
  saveStore(store);
  return project;
}

export function runAeGrowthWorkflow({ workspaceId, actorId, projectId, topic = 'sovereign AI platform proof' } = {}) {
  const store = loadStore();
  const workspace = requireWorkspace(store, workspaceId);
  const project = store.aeCentral.projects.find((item) => item.projectId === projectId);
  if (!project) throw new Error(`project_not_found:${projectId}`);

  const contentPlan = {
    contentPlanId: id('plan'),
    workspaceId,
    projectId,
    topic,
    source: 'skye.geo.engine',
    researchLedger: [
      { source: 'intake', signal: 'customer need', confidence: 'high' },
      { source: 'quality-gate', signal: 'proof-backed platform readiness', confidence: latestQualityRun(store) ? 'high' : 'pending' }
    ],
    briefs: [
      { title: `How ${project.accountName} can prove ${topic}`, format: 'article-brief' },
      { title: `${project.accountName} launch proof checklist`, format: 'operator-checklist' }
    ],
    createdAt: isoNow()
  };
  store.aeCentral.contentPlans.push(contentPlan);

  const publishPayload = {
    publishPayloadId: id('pub'),
    workspaceId,
    projectId,
    contentPlanId: contentPlan.contentPlanId,
    status: 'ready-for-provider',
    requiresLiveVars: ['OPENAI_API_KEY'],
    payload: {
      headline: contentPlan.briefs[0].title,
      channels: ['SkyeSol public report', 'AE Central follow-up', 'House Command digest'],
      proofLinks: []
    },
    createdAt: isoNow()
  };
  store.aeCentral.publishPayloads.push(publishPayload);

  audit(store, {
    tenantId: workspace.tenantId,
    actorId,
    workspaceId,
    action: 'ae.growth.workflow.completed',
    entityType: 'ae.project',
    entityId: projectId,
    detail: { contentPlanId: contentPlan.contentPlanId, publishPayloadId: publishPayload.publishPayloadId }
  });
  saveStore(store);
  return { contentPlan, publishPayload };
}

export function upsertRolePersona({ workspaceId, actorId, displayName = 'Operator Assistant', role = 'AE follow-up specialist', communicationStyle = 'direct, useful, proof-aware' } = {}) {
  const store = loadStore();
  const workspace = requireWorkspace(store, workspaceId);
  const persona = {
    personaId: id('per'),
    workspaceId,
    displayName,
    role,
    communicationStyle,
    guardrail: 'This is a role assistant, not a real human clone.',
    source: 'skye.assistant.personaRoles',
    createdAt: isoNow()
  };
  store.roleAssistant.personas.push(persona);
  audit(store, {
    tenantId: workspace.tenantId,
    actorId,
    workspaceId,
    action: 'assistant.persona.created',
    entityType: 'assistant.persona',
    entityId: persona.personaId
  });
  saveStore(store);
  return persona;
}

export function runRoleAssistant({ workspaceId, actorId, personaId, projectId, message = 'Draft a follow-up.' } = {}) {
  const store = loadStore();
  const workspace = requireWorkspace(store, workspaceId);
  const persona = store.roleAssistant.personas.find((item) => item.personaId === personaId);
  if (!persona) throw new Error(`persona_not_found:${personaId}`);
  const project = store.aeCentral.projects.find((item) => item.projectId === projectId);
  const hasLiveProvider = Boolean(process.env.OPENAI_API_KEY);
  const response = hasLiveProvider
    ? 'Provider gateway ready: live model response requires outbound provider execution in deployment.'
    : `Draft for ${project?.accountName || 'the account'}: I pulled the intake, current proof status, and readiness signals. Next step is a short proof-backed call focused on outcomes, live variables, and deployment timing.`;
  const record = {
    messageId: id('msg'),
    workspaceId,
    personaId,
    projectId,
    mode: hasLiveProvider ? 'provider-ready' : 'deterministic-local',
    request: message,
    response,
    requiredLiveVars: hasLiveProvider ? [] : ['OPENAI_API_KEY'],
    createdAt: isoNow()
  };
  store.roleAssistant.messages.push(record);
  audit(store, {
    tenantId: workspace.tenantId,
    actorId,
    workspaceId,
    action: 'assistant.message.completed',
    entityType: 'assistant.message',
    entityId: record.messageId,
    detail: { mode: record.mode }
  });
  saveStore(store);
  return record;
}

export function runIntegratedQualityGate({ workspaceId, actorId } = {}) {
  const store = loadStore();
  const workspace = requireWorkspace(store, workspaceId);
  const quality = runQualityGate();
  const run = {
    qualityRunId: id('qgt'),
    workspaceId,
    sourceRunId: quality.manifest.runId,
    status: 'completed',
    manifestPath: path.relative(repoRoot(), quality.manifestPath),
    latestPath: path.relative(repoRoot(), quality.latestPath),
    scannedDonorCount: quality.manifest.scannedDonorCount,
    totalFindings: quality.manifest.totalFindings,
    results: quality.manifest.results,
    createdAt: isoNow()
  };
  store.qualityGate.runs.push(run);
  audit(store, {
    tenantId: workspace.tenantId,
    actorId,
    workspaceId,
    action: 'quality.gate.completed',
    entityType: 'quality.run',
    entityId: run.qualityRunId,
    detail: { totalFindings: run.totalFindings, scannedDonorCount: run.scannedDonorCount }
  });
  saveStore(store);
  return run;
}

export function runValuationCertification({ workspaceId, actorId, qualityRunId = null } = {}) {
  const store = loadStore();
  const workspace = requireWorkspace(store, workspaceId);
  const qualityRun = qualityRunId
    ? store.qualityGate.runs.find((item) => item.qualityRunId === qualityRunId)
    : latestQualityRun(store);
  if (!qualityRun) throw new Error('quality_run_required_before_valuation');

  const sovereignEvidence = store.sovereign.auditEvidence.filter((item) => item.workspaceId === workspaceId);
  const certificationRun = {
    certificationRunId: id('cert'),
    workspaceId,
    qualityRunId: qualityRun.qualityRunId,
    sovereignEvidenceIds: sovereignEvidence.map((item) => item.auditEvidenceId),
    methodologyVersion: 'skyehands-runtime-2026-04-30',
    source: 'skye.valuation.certification',
    status: 'completed',
    createdAt: isoNow(),
    assets: []
  };

  for (const result of qualityRun.results) {
    const qualityScore = scoreFromQuality(result);
    const sovereignBonus = sovereignEvidence.length ? 5 : 0;
    const score = Math.min(100, qualityScore + sovereignBonus);
    const issuedTechnicalValue = Number((score * assetWeight(result.platformId) * 1000).toFixed(2));
    const asset = {
      assetId: id('ast'),
      workspaceId,
      platformId: result.platformId,
      familyId: result.familyId,
      name: result.name,
      qualityScanArtifact: result.artifacts?.json || null,
      qualityFindings: result.summary.totalFindings,
      readinessScore: score,
      certification: certificationLabel(score),
      issuedTechnicalValue,
      repairPriority: result.summary.totalFindings > 10 ? 'high' : result.summary.totalFindings > 0 ? 'medium' : 'low',
      createdAt: isoNow()
    };
    certificationRun.assets.push(asset);
    store.valuation.assets.push(asset);
  }

  const totalValue = certificationRun.assets.reduce((sum, asset) => sum + asset.issuedTechnicalValue, 0);
  const averageScore = certificationRun.assets.length
    ? certificationRun.assets.reduce((sum, asset) => sum + asset.readinessScore, 0) / certificationRun.assets.length
    : 0;
  certificationRun.summary = {
    assetCount: certificationRun.assets.length,
    averageReadinessScore: Number(averageScore.toFixed(2)),
    portfolioCertification: certificationLabel(averageScore),
    issuedTechnicalValueTotal: Number(totalValue.toFixed(2)),
    claimGuardrail: 'Technical readiness and platform integration support only; not legal, tax, or formal financial appraisal.'
  };

  store.valuation.certificationRuns.push(certificationRun);
  store.valuation.portfolioRuns.push({
    portfolioRunId: id('port'),
    workspaceId,
    certificationRunId: certificationRun.certificationRunId,
    summary: certificationRun.summary,
    createdAt: isoNow()
  });

  const artifactPath = path.join(ARTIFACTS_DIR, `${certificationRun.certificationRunId}.json`);
  writeJson(artifactPath, certificationRun);
  audit(store, {
    tenantId: workspace.tenantId,
    actorId,
    workspaceId,
    action: 'valuation.certification.completed',
    entityType: 'valuation.certificationRun',
    entityId: certificationRun.certificationRunId,
    detail: certificationRun.summary
  });
  saveStore(store);
  return { certificationRun, artifactPath: path.relative(repoRoot(), artifactPath) };
}

export function buildHouseCommandDashboard({ workspaceId, actorId } = {}) {
  const store = loadStore();
  const workspace = requireWorkspace(store, workspaceId);
  const latestCertification = [...store.valuation.certificationRuns].reverse().find((item) => item.workspaceId === workspaceId) || null;
  const dashboard = {
    dashboardId: id('dash'),
    workspaceId,
    source: 'skye.house.command',
    generatedAt: isoNow(),
    widgets: {
      intakeInbox: {
        count: store.intake.submissions.filter((item) => item.workspaceId === workspaceId).length
      },
      envVault: {
        envSetCount: store.sovereign.envSets.filter((item) => item.workspaceId === workspaceId).length,
        bindings: store.sovereign.providerBindings.filter((item) => item.workspaceId === workspaceId).map((item) => ({
          provider: item.provider,
          status: item.status,
          missingVars: item.requiredVars.filter((required) => !item.presentVars.includes(required))
        }))
      },
      growth: {
        projects: store.aeCentral.projects.filter((item) => item.workspaceId === workspaceId).length,
        publishPayloads: store.aeCentral.publishPayloads.filter((item) => item.workspaceId === workspaceId).length
      },
      quality: {
        latestRunId: latestQualityRun(store)?.qualityRunId || null,
        totalFindings: latestQualityRun(store)?.totalFindings || 0
      },
      valuation: latestCertification ? latestCertification.summary : null,
      assistant: {
        personas: store.roleAssistant.personas.filter((item) => item.workspaceId === workspaceId).length,
        messages: store.roleAssistant.messages.filter((item) => item.workspaceId === workspaceId).length
      }
    }
  };
  store.houseCommand.dashboards.push(dashboard);
  const artifactPath = path.join(ARTIFACTS_DIR, `${dashboard.dashboardId}.json`);
  writeJson(artifactPath, dashboard);
  audit(store, {
    tenantId: workspace.tenantId,
    actorId,
    workspaceId,
    action: 'house.dashboard.generated',
    entityType: 'house.dashboard',
    entityId: dashboard.dashboardId
  });
  saveStore(store);
  return { dashboard, artifactPath: path.relative(repoRoot(), artifactPath) };
}

export function exportSovereignHandoff({ workspaceId, actorId } = {}) {
  const store = loadStore();
  const workspace = requireWorkspace(store, workspaceId);
  const payload = {
    handoffPackageId: id('skye'),
    workspaceId,
    generatedAt: isoNow(),
    envSets: store.sovereign.envSets.filter((item) => item.workspaceId === workspaceId),
    variables: store.sovereign.variables.filter((item) => item.workspaceId === workspaceId).map((item) => ({
      ...item,
      valuePreview: item.classification === 'secret-reference' ? 'redacted' : item.valuePreview
    })),
    providerBindings: store.sovereign.providerBindings.filter((item) => item.workspaceId === workspaceId),
    qualityRunIds: store.qualityGate.runs.filter((item) => item.workspaceId === workspaceId).map((item) => item.qualityRunId),
    certificationRunIds: store.valuation.certificationRuns.filter((item) => item.workspaceId === workspaceId).map((item) => item.certificationRunId)
  };
  const artifactPath = path.join(ARTIFACTS_DIR, `${payload.handoffPackageId}.skye.json`);
  writeJson(artifactPath, payload);
  const record = {
    handoffPackageId: payload.handoffPackageId,
    workspaceId,
    artifactPath: path.relative(repoRoot(), artifactPath),
    status: 'exported-redacted',
    createdAt: isoNow()
  };
  store.sovereign.handoffPackages.push(record);
  audit(store, {
    tenantId: workspace.tenantId,
    actorId,
    workspaceId,
    action: 'sovereign.handoff.exported',
    entityType: 'sovereign.handoffPackage',
    entityId: record.handoffPackageId
  });
  saveStore(store);
  return record;
}

export function runSevenPlatformE2E(options = {}) {
  const { tenant, actor, workspace } = bootstrapRuntime({ reset: options.reset !== false });
  const env = importSovereignEnvSet({
    workspaceId: workspace.workspaceId,
    actorId: actor.actorId,
    env: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'live-var-required',
      NEON_SQL_URL: process.env.NEON_SQL_URL || 'live-var-required',
      NETLIFY_AUTH_TOKEN: process.env.NETLIFY_AUTH_TOKEN || 'live-var-required',
      NETLIFY_SITE_ID: process.env.NETLIFY_SITE_ID || 'live-var-required'
    }
  });
  const intake = submitIntake({ workspaceId: workspace.workspaceId, actorId: actor.actorId });
  const project = createAeProjectFromIntake({ workspaceId: workspace.workspaceId, actorId: actor.actorId, submissionId: intake.submissionId });
  const ae = runAeGrowthWorkflow({ workspaceId: workspace.workspaceId, actorId: actor.actorId, projectId: project.projectId });
  const persona = upsertRolePersona({ workspaceId: workspace.workspaceId, actorId: actor.actorId });
  const assistant = runRoleAssistant({ workspaceId: workspace.workspaceId, actorId: actor.actorId, personaId: persona.personaId, projectId: project.projectId });
  const quality = runIntegratedQualityGate({ workspaceId: workspace.workspaceId, actorId: actor.actorId });
  const valuation = runValuationCertification({ workspaceId: workspace.workspaceId, actorId: actor.actorId, qualityRunId: quality.qualityRunId });
  const handoff = exportSovereignHandoff({ workspaceId: workspace.workspaceId, actorId: actor.actorId });
  const house = buildHouseCommandDashboard({ workspaceId: workspace.workspaceId, actorId: actor.actorId });
  const store = loadStore();

  const proof = {
    proofType: 'skye-forge-max-full-e2e',
    brand: BRAND,
    ok: true,
    generatedAt: isoNow(),
    tenantId: tenant.tenantId,
    actorId: actor.actorId,
    workspaceId: workspace.workspaceId,
    flow: {
      envSetId: env.envSet.envSetId,
      sovereignEvidenceId: env.evidence.auditEvidenceId,
      submissionId: intake.submissionId,
      projectId: project.projectId,
      contentPlanId: ae.contentPlan.contentPlanId,
      publishPayloadId: ae.publishPayload.publishPayloadId,
      personaId: persona.personaId,
      assistantMessageId: assistant.messageId,
      qualityRunId: quality.qualityRunId,
      certificationRunId: valuation.certificationRun.certificationRunId,
      handoffPackageId: handoff.handoffPackageId,
      dashboardId: house.dashboard.dashboardId
    },
    liveVarStatus: store.sovereign.providerBindings.filter((item) => item.workspaceId === workspace.workspaceId).map((item) => ({
      provider: item.provider,
      status: item.status,
      requiredVars: item.requiredVars,
      presentVars: item.presentVars
    })),
    qualitySummary: {
      scannedDonorCount: quality.scannedDonorCount,
      totalFindings: quality.totalFindings
    },
    valuationSummary: valuation.certificationRun.summary,
    artifacts: {
      store: path.relative(repoRoot(), STORE_PATH),
      qualityManifest: quality.manifestPath,
      valuation: valuation.artifactPath,
      handoff: handoff.artifactPath,
      dashboard: house.artifactPath
    }
  };

  const proofPath = path.join(PROOFS_DIR, 'skye-forge-max-full-e2e.json');
  writeJson(proofPath, proof);
  return { proof, proofPath };
}

async function readRequestJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function renderSkyeForgeMaxApp() {
  const store = loadStore();
  const dashboard = store.houseCommand.dashboards.at(-1);
  const quality = store.qualityGate.runs.at(-1);
  const certification = store.valuation.certificationRuns.at(-1);
  const bindings = store.sovereign.providerBindings;
  const auditEvents = store.auditEvents.slice(-8).reverse();
  const widgets = dashboard?.widgets || {};
  const palette = BRAND.palette;
  const flowStats = [
    ['Donors Forged', quality?.scannedDonorCount || 0],
    ['Quality Findings', quality?.totalFindings || 0],
    ['Certified Assets', certification?.summary?.assetCount || 0],
    ['Portfolio Value', `$${Number(certification?.summary?.issuedTechnicalValueTotal || 0).toLocaleString()}`]
  ];
  const liveVars = bindings.map((binding) => {
    const missing = binding.requiredVars.filter((key) => !binding.presentVars.includes(key));
    return `
      <div class="binding">
        <div>
          <strong>${escapeHtml(binding.provider)}</strong>
          <span>${escapeHtml(binding.status)}</span>
        </div>
        <code>${escapeHtml(missing.length ? missing.join(', ') : 'live-ready')}</code>
      </div>
    `;
  }).join('');
  const eventRows = auditEvents.map((event) => `
    <li>
      <span>${escapeHtml(event.action)}</span>
      <small>${escapeHtml(event.entityType || 'runtime')} · ${escapeHtml(event.at)}</small>
    </li>
  `).join('');
  const assetRows = (certification?.assets || []).map((asset) => `
    <tr>
      <td>${escapeHtml(asset.name)}</td>
      <td>${escapeHtml(asset.certification)}</td>
      <td>${asset.readinessScore}</td>
      <td>${asset.qualityFindings}</td>
      <td>$${Number(asset.issuedTechnicalValue).toLocaleString()}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${BRAND.productName}</title>
  <style>
    :root {
      --obsidian: ${palette.obsidian};
      --magma: ${palette.magmaRed};
      --crimson: ${palette.lavaCrimson};
      --gold: ${palette.forgeGold};
      --ember: ${palette.emberGold};
      --ash: ${palette.ashWhite};
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at 18% 8%, rgba(255, 221, 117, 0.24), transparent 28%),
        radial-gradient(circle at 82% 12%, rgba(215, 38, 30, 0.35), transparent 32%),
        linear-gradient(135deg, #0d0605 0%, var(--obsidian) 28%, #38100b 62%, #110604 100%);
      color: var(--ash);
    }
    .shell {
      width: min(1420px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 40px;
    }
    header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 24px;
      align-items: end;
      padding: 28px 0 26px;
      border-bottom: 1px solid rgba(255, 221, 117, 0.22);
    }
    .brand-mark {
      width: 58px;
      height: 58px;
      display: inline-grid;
      place-items: center;
      margin-bottom: 18px;
      border-radius: 6px;
      background: linear-gradient(145deg, var(--magma), var(--gold));
      color: #170b08;
      font-weight: 1000;
      font-size: 25px;
      box-shadow: 0 18px 50px rgba(215, 38, 30, 0.35), inset 0 0 0 1px rgba(255,255,255,0.28);
    }
    h1 {
      margin: 0;
      font-size: clamp(44px, 7vw, 96px);
      line-height: 0.9;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .tagline {
      max-width: 780px;
      margin: 18px 0 0;
      color: rgba(255, 243, 223, 0.78);
      font-size: 19px;
      line-height: 1.45;
    }
    .status-pill {
      border: 1px solid rgba(246, 183, 60, 0.45);
      background: rgba(23, 11, 8, 0.72);
      padding: 12px 14px;
      color: var(--ember);
      font-weight: 800;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 0.08em;
      border-radius: 6px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-top: 24px;
    }
    .metric, .panel {
      border: 1px solid rgba(255, 221, 117, 0.18);
      background: rgba(23, 11, 8, 0.68);
      border-radius: 8px;
      box-shadow: 0 22px 80px rgba(0, 0, 0, 0.28);
    }
    .metric { padding: 20px; min-height: 122px; }
    .metric span, .panel h2 span {
      color: rgba(255, 243, 223, 0.62);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-weight: 800;
    }
    .metric strong {
      display: block;
      margin-top: 16px;
      color: var(--ember);
      font-size: 34px;
      line-height: 1;
    }
    .main {
      display: grid;
      grid-template-columns: 1.25fr 0.75fr;
      gap: 16px;
      margin-top: 16px;
    }
    .panel { padding: 22px; overflow: hidden; }
    .panel h2 { margin: 0 0 18px; font-size: 22px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { padding: 12px 10px; border-bottom: 1px solid rgba(255, 221, 117, 0.12); text-align: left; }
    th { color: rgba(255, 243, 223, 0.58); font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; }
    td:nth-child(3), td:nth-child(4), td:nth-child(5) { color: var(--ember); font-weight: 800; }
    .binding {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
      padding: 13px 0;
      border-bottom: 1px solid rgba(255, 221, 117, 0.12);
    }
    .binding div { display: flex; justify-content: space-between; gap: 12px; }
    .binding span { color: var(--gold); font-size: 12px; text-transform: uppercase; font-weight: 900; }
    code {
      color: rgba(255, 243, 223, 0.72);
      font-family: "SFMono-Regular", Consolas, monospace;
      white-space: normal;
      word-break: break-word;
    }
    ul { margin: 0; padding: 0; list-style: none; }
    li { padding: 11px 0; border-bottom: 1px solid rgba(255, 221, 117, 0.12); }
    li span { display: block; color: var(--ash); font-weight: 750; }
    li small { display: block; margin-top: 5px; color: rgba(255, 243, 223, 0.52); }
    .footer {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
      color: rgba(255, 243, 223, 0.62);
      font-size: 13px;
    }
    .footer code {
      border: 1px solid rgba(255, 221, 117, 0.2);
      padding: 8px 10px;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.24);
      color: var(--ember);
    }
    @media (max-width: 980px) {
      header, .main { grid-template-columns: 1fr; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 620px) {
      .shell { width: min(100% - 22px, 1420px); }
      .grid { grid-template-columns: 1fr; }
      th:nth-child(2), td:nth-child(2) { display: none; }
      h1 { font-size: 43px; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header>
      <section>
        <div class="brand-mark">SF</div>
        <h1>${BRAND.productName}</h1>
        <p class="tagline">${escapeHtml(BRAND.tagline)}</p>
      </section>
      <aside class="status-pill">Runtime Forged · ${escapeHtml(certification?.summary?.portfolioCertification || 'Pending')}</aside>
    </header>
    <section class="grid">
      ${flowStats.map(([label, value]) => `<article class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join('')}
    </section>
    <section class="main">
      <article class="panel">
        <h2><span>Certification Matrix</span></h2>
        <table>
          <thead><tr><th>Asset</th><th>Certification</th><th>Score</th><th>Findings</th><th>Value</th></tr></thead>
          <tbody>${assetRows}</tbody>
        </table>
      </article>
      <aside class="panel">
        <h2><span>Live Var Forge</span></h2>
        ${liveVars}
      </aside>
    </section>
    <section class="main">
      <article class="panel">
        <h2><span>House Command Widgets</span></h2>
        <div class="grid" style="grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 0;">
          <article class="metric"><span>Intake</span><strong>${widgets.intakeInbox?.count || 0}</strong></article>
          <article class="metric"><span>Projects</span><strong>${widgets.growth?.projects || 0}</strong></article>
          <article class="metric"><span>Assistant</span><strong>${widgets.assistant?.messages || 0}</strong></article>
        </div>
      </article>
      <aside class="panel">
        <h2><span>Audit Flame</span></h2>
        <ul>${eventRows}</ul>
      </aside>
    </section>
    <section class="footer">
      <code>npm run forge:e2e</code>
      <code>npm run forge:server</code>
      <code>GET /v1/state</code>
      <code>POST /v1/e2e/run</code>
    </section>
  </main>
</body>
</html>`;
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(html);
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(res, 404, { ok: false, error: 'asset_not_found' });
    return;
  }
  res.writeHead(200, {
    'content-type': mimeType(filePath),
    'cache-control': 'no-store'
  });
  fs.createReadStream(filePath).pipe(res);
}

function publicAppFile(urlPath) {
  if (urlPath === '/' || urlPath === '/app' || urlPath === '/skyeforgemax' || urlPath === '/skyeforgemax/') {
    return path.join(PUBLIC_APP_DIR, 'index.html');
  }
  if (!urlPath.startsWith('/skyeforgemax/')) return null;
  const relative = urlPath.slice('/skyeforgemax/'.length);
  const resolved = path.resolve(PUBLIC_APP_DIR, relative);
  if (!resolved.startsWith(PUBLIC_APP_DIR)) return null;
  return resolved;
}

export function createSevenPlatformServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      const staticFile = req.method === 'GET' ? publicAppFile(url.pathname) : null;
      if (staticFile) {
        sendFile(res, staticFile);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/v1/health') {
        sendJson(res, 200, { ok: true, service: BRAND.systemName, productName: BRAND.productName, brand: BRAND, date: isoNow() });
        return;
      }
      if (req.method === 'GET' && url.pathname === '/v1/state') {
        sendJson(res, 200, loadStore());
        return;
      }
      if (req.method === 'POST' && url.pathname === '/v1/e2e/run') {
        const body = await readRequestJson(req);
        const result = runSevenPlatformE2E({ reset: body.reset !== false });
        sendJson(res, 200, { ok: true, proof: result.proof, proofPath: path.relative(repoRoot(), result.proofPath) });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/v1/quality/run') {
        const body = await readRequestJson(req);
        const result = runIntegratedQualityGate(body);
        sendJson(res, 200, { ok: true, result });
        return;
      }
      if (req.method === 'POST' && url.pathname === '/v1/valuation/run') {
        const body = await readRequestJson(req);
        const result = runValuationCertification(body);
        sendJson(res, 200, { ok: true, result });
        return;
      }
      sendJson(res, 404, { ok: false, error: 'not_found' });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error.message || String(error) });
    }
  });
}
