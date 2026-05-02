import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { createWorkspace, getWorkspace, getWorkspaceRuntime, startWorkspace } from '../lib/workspace-manager.mjs';
import { setWorkspacePrebuildPreference, upsertPrebuildTemplate, queuePrebuildJob, hydrateWorkspacePrebuild, getPrebuildStatus } from '../lib/prebuild-manager.mjs';
import { getWorkspaceSandboxPaths } from '../lib/workspace-runtime.mjs';

function assertCheck(pass, message, detail = null) {
  return { pass: Boolean(pass), message, detail };
}

async function main() {
  const strict = process.argv.includes('--strict');
  const config = getStackConfig(process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section23-onboarding.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_23_WORKSPACE_ONBOARDING.json');

  const templateId = `section23-template-${Date.now()}`;
  const templateSource = path.join(config.rootDir, '.skyequanta', 'templates', templateId);
  fs.mkdirSync(path.join(templateSource, 'src'), { recursive: true });
  fs.writeFileSync(path.join(templateSource, 'src', 'index.js'), 'export const ready = true;\n', 'utf8');
  fs.writeFileSync(path.join(templateSource, 'README.md'), '# Section 23 Template\n', 'utf8');

  upsertPrebuildTemplate(config, {
    templateId,
    label: 'Section 23 Template',
    profileId: 'standard',
    mode: 'warm-start',
    startupRecipe: 'npm install && npm run dev',
    stackPreset: 'node',
    actorId: 'section23-proof'
  });

  const workspaceId = `section23-onboarded-${Date.now()}`;
  const created = createWorkspace(config, workspaceId, {
    name: 'Section 23 Onboarded',
    source: 'section23-proof',
    templatePath: path.relative(config.rootDir, templateSource),
    machineProfile: 'standard',
    secretScope: 'local-dev'
  });

  const preference = setWorkspacePrebuildPreference(config, {
    workspaceId,
    templateId,
    mode: 'warm-start',
    hydrationPolicy: 'hydrate_on_create',
    actorId: 'section23-proof'
  });
  const queuedJob = queuePrebuildJob(config, {
    workspaceId,
    templateId,
    actorId: 'section23-proof',
    source: 'section23-proof'
  });
  const hydration = hydrateWorkspacePrebuild(config, {
    workspaceId,
    templateId,
    actorId: 'section23-proof'
  });

  const started = await startWorkspace(config, workspaceId, 'section23-proof-start');
  const workspace = getWorkspace(config, workspaceId);
  const runtime = getWorkspaceRuntime(config, workspaceId);
  const paths = getWorkspaceSandboxPaths(config, workspaceId);
  const rootDir = fs.existsSync(path.join(paths.fsDir, 'project')) ? path.join(paths.fsDir, 'project') : paths.fsDir;
  const seededReadme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
  const prebuildStatus = getPrebuildStatus(config, workspaceId);

  const checks = [
    assertCheck(created.created === true && Boolean(created.seed) && created.seed.type === 'template', 'workspace onboarding seeds a workspace directly from a template path', created),
    assertCheck(preference.preference.templateId === templateId && preference.preference.mode === 'warm-start', 'workspace onboarding attaches a prebuild preference with explicit warm-start mode', preference),
    assertCheck(queuedJob.job.status === 'ready' && hydration.hydration.jobId === queuedJob.job.jobId, 'workspace onboarding can queue and hydrate a prebuild artifact for the workspace', { queuedJob: queuedJob.job, hydration: hydration.hydration }),
    assertCheck(started.workspace.status === 'running' && Boolean(runtime.runtime) && Boolean(runtime.state?.paths?.fsDir), 'workspace onboarding can start the workspace and return runtime state', { started: started.workspace, runtime }),
    assertCheck(seededReadme.includes('Section 23 Template'), 'workspace onboarding preserves seeded template files under the workspace root', seededReadme),
    assertCheck(workspace?.metadata?.machineProfile === 'standard' && workspace?.metadata?.secretScope === 'local-dev' && prebuildStatus.summary.hydratedJobs >= 1, 'workspace onboarding persists machine profile, secret scope, and hydrated prebuild summary', { metadata: workspace?.metadata, prebuildSummary: prebuildStatus.summary })
  ];

  let payload = {
    section: 23,
    label: 'section-23-workspace-onboarding',
    generatedAt: new Date().toISOString(),
    strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section23-onboarding.mjs --strict',
    pass: checks.every(item => item.pass),
    checks,
    evidence: {
      created,
      preference,
      queuedJob: queuedJob.job,
      hydration: hydration.hydration,
      started: started.workspace,
      runtime,
      prebuildSummary: prebuildStatus.summary,
      seededReadme
    }
  };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section23-onboarding.mjs');
  if (strict && !payload.pass) throw new Error('Section 23 workspace onboarding proof failed in strict mode.');
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
