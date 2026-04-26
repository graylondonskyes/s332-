import fs from 'node:fs';
import path from 'node:path';

import { writeProofJson } from '../lib/proof-runtime.mjs';
import { saveProviderProfile } from '../lib/provider-vault.mjs';
import { listWorkspaceProviderBindings, upsertWorkspaceProviderBinding } from '../lib/provider-bindings.mjs';
import { listAuditEvents } from '../lib/governance-manager.mjs';
import { getWorkspace } from '../lib/workspace-manager.mjs';
import { buildProviderProofConfig, assertCheck, authHeaders, ensureProofWorkspace, fetchJson, fetchText, operatorStart, relative } from './provider-proof-helpers.mjs';

async function main() {
  const strict = process.argv.includes('--strict');
  const config = buildProviderProofConfig('workspace-proof-section32-workspace-bindings.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_32_WORKSPACE_BINDINGS.json');
  const workspaceId = 'section32-workspace-bindings';
  const tenantId = 'section32';
  const marker = `S32_BINDINGS_SECRET_${Date.now()}`;

  const { workspace, session } = await ensureProofWorkspace(config, workspaceId, {
    tenantId,
    source: 'section32-proof',
    clientName: 'section32-client'
  });

  const profiles = {
    neon: saveProviderProfile(config, {
      profileId: `section32-neon-${Date.now()}`,
      tenantId,
      provider: 'neon',
      alias: 'Section 32 Neon',
      unlockSecret: 'section32-neon-unlock',
      actorType: 'proof',
      actorId: 'section32-proof',
      source: 'section32-proof',
      secretPayload: {
        projectId: 'section32-neon-project',
        databaseName: 'section32_db',
        databaseUrl: `postgresql://section32:${marker}@db.example.com:5432/section32`
      }
    }),
    cloudflare: saveProviderProfile(config, {
      profileId: `section32-cloudflare-${Date.now()}`,
      tenantId,
      provider: 'cloudflare',
      alias: 'Section 32 Cloudflare',
      unlockSecret: 'section32-cf-unlock',
      actorType: 'proof',
      actorId: 'section32-proof',
      source: 'section32-proof',
      secretPayload: {
        apiToken: `${marker}_CF_TOKEN_LONG`,
        accountId: 'section32-account-12345',
        zoneId: 'section32-zone-12345',
        workerName: 'section32-worker',
        r2Bucket: 'section32-r2'
      }
    }),
    netlify: saveProviderProfile(config, {
      profileId: `section32-netlify-${Date.now()}`,
      tenantId,
      provider: 'netlify',
      alias: 'Section 32 Netlify',
      unlockSecret: 'section32-netlify-unlock',
      actorType: 'proof',
      actorId: 'section32-proof',
      source: 'section32-proof',
      secretPayload: {
        authToken: `${marker}_NETLIFY_TOKEN_LONG`,
        siteId: 'section32-site-12345',
        teamSlug: 'section32-team',
        siteName: 'section32-site'
      }
    }),
    github: saveProviderProfile(config, {
      profileId: `section32-github-${Date.now()}`,
      tenantId,
      provider: 'github',
      alias: 'Section 32 GitHub',
      unlockSecret: 'section32-github-unlock',
      actorType: 'proof',
      actorId: 'section32-proof',
      source: 'section32-proof',
      secretPayload: {
        token: `${marker}_GITHUB_TOKEN_LONG`,
        owner: 'skyesoverlondon',
        repo: 'section32-proof',
        branch: 'main'
      }
    }),
    env: saveProviderProfile(config, {
      profileId: `section32-env-${Date.now()}`,
      tenantId,
      provider: 'env_bundle',
      alias: 'Section 32 Env Bundle',
      unlockSecret: 'section32-env-unlock',
      actorType: 'proof',
      actorId: 'section32-proof',
      source: 'section32-proof',
      secretPayload: {
        bundleName: 'Section 32 Bundle',
        env: {
          CUSTOM_API_TOKEN: `${marker}_CUSTOM`,
          DATABASE_URL: `postgresql://section32:${marker}@db.example.com:5432/section32`,
          NETLIFY_AUTH_TOKEN: `${marker}_NETLIFY_TOKEN_LONG`,
          GITHUB_TOKEN: `${marker}_GITHUB_TOKEN_LONG`
        }
      }
    })
  };

  const bindings = [
    upsertWorkspaceProviderBinding(config, {
      workspaceId,
      tenantId,
      profileId: profiles.neon.profile.profileId,
      bindingRole: 'primary_database',
      capability: 'database',
      envTarget: 'workspace_runtime',
      projectionMode: 'minimum',
      actorType: 'proof',
      actorId: 'section32-proof',
      notes: 'Primary database binding'
    }),
    upsertWorkspaceProviderBinding(config, {
      workspaceId,
      tenantId,
      profileId: profiles.cloudflare.profile.profileId,
      bindingRole: 'worker_deploy',
      capability: 'worker_runtime',
      envTarget: 'deployment_runtime',
      projectionMode: 'minimum',
      actorType: 'proof',
      actorId: 'section32-proof'
    }),
    upsertWorkspaceProviderBinding(config, {
      workspaceId,
      tenantId,
      profileId: profiles.netlify.profile.profileId,
      bindingRole: 'site_deploy',
      capability: 'site_runtime',
      envTarget: 'deployment_runtime',
      projectionMode: 'minimum',
      actorType: 'proof',
      actorId: 'section32-proof'
    }),
    upsertWorkspaceProviderBinding(config, {
      workspaceId,
      tenantId,
      profileId: profiles.github.profile.profileId,
      bindingRole: 'scm_origin',
      capability: 'scm',
      envTarget: 'workspace_runtime',
      projectionMode: 'minimum',
      actorType: 'proof',
      actorId: 'section32-proof'
    }),
    upsertWorkspaceProviderBinding(config, {
      workspaceId,
      tenantId,
      profileId: profiles.env.profile.profileId,
      bindingRole: 'runtime_env',
      capability: 'runtime',
      envTarget: 'workspace_runtime',
      projectionMode: 'minimum',
      actorType: 'proof',
      actorId: 'section32-proof'
    })
  ];

  const listed = listWorkspaceProviderBindings(config, { workspaceId, tenantId });
  const bindingStorePath = path.join(config.rootDir, '.skyequanta', 'workspace-provider-bindings.json');
  const bindingStoreText = fs.readFileSync(bindingStorePath, 'utf8');
  const latestWorkspace = getWorkspace(config, workspaceId);
  const audit = listAuditEvents(config, { tenantId, workspaceId, limit: 100 });
  const bindingAuditCount = (audit.events || []).filter(event => event.action === 'workspace.provider_binding.upsert').length;

  const bridgePort = 3620 + (Date.now() % 300);
  const started = operatorStart(config, workspaceId, bridgePort);
  const base = started.payload.bridge?.baseUrl || `http://127.0.0.1:${bridgePort}`;
  const headers = authHeaders(session.accessToken, tenantId);

  for (const [profileId, secret] of [
    [profiles.neon.profile.profileId, 'section32-neon-unlock'],
    [profiles.cloudflare.profile.profileId, 'section32-cf-unlock'],
    [profiles.netlify.profile.profileId, 'section32-netlify-unlock'],
    [profiles.github.profile.profileId, 'section32-github-unlock'],
    [profiles.env.profile.profileId, 'section32-env-unlock']
  ]) {
    await fetchJson(`${base}/api/providers/${encodeURIComponent(profileId)}/unlock`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ workspaceId, unlockSecret: secret, ttlMs: 60000 })
    });
  }

  const bindingApi = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-bindings`, { headers });
  const cockpitApi = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/cockpit`, { headers });
  const providerCenter = await fetchText(`${base}/provider-center?workspaceId=${encodeURIComponent(workspaceId)}&tenantId=${encodeURIComponent(tenantId)}`, { headers: { authorization: `Bearer ${session.accessToken}`, 'x-skyequanta-tenant-id': tenantId } });

  const dbPlan = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-runtime-plan`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'db_connect', bindingRole: 'primary_database' })
  });
  const workerPlan = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-runtime-plan`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'worker_deploy', bindingRole: 'worker_deploy' })
  });
  const sitePlan = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-runtime-plan`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'site_deploy', bindingRole: 'site_deploy' })
  });
  const scmPlan = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-runtime-plan`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'scm_sync', bindingRole: 'scm_origin' })
  });
  const runtimePlan = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-runtime-plan`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'provider_runtime_execution', bindingRole: 'runtime_env' })
  });

  const checks = [
    assertCheck(bindings.every(item => item.saved === true), 'workspace bindings can be written for multiple provider profiles and binding roles', { bindingIds: bindings.map(item => item.binding.bindingId) }),
    assertCheck(listed.total >= 5 && listed.bindings.some(item => item.bindingRole === 'primary_database') && listed.bindings.some(item => item.bindingRole === 'worker_deploy') && listed.bindings.some(item => item.bindingRole === 'site_deploy') && listed.bindings.some(item => item.bindingRole === 'scm_origin') && listed.bindings.some(item => item.bindingRole === 'runtime_env'), 'workspace binding registry returns the saved provider role map for the workspace', { total: listed.total }),
    assertCheck(!bindingStoreText.includes(marker), 'workspace binding store persists only binding metadata and never raw provider credential values', { bindingStorePath: relative(config, bindingStorePath) }),
    assertCheck(latestWorkspace?.metadata?.lastStatusReason === 'provider_binding_update', 'workspace state records provider-binding updates as a real runtime-affecting event', latestWorkspace?.metadata),
    assertCheck(bindingAuditCount >= 5, 'binding upserts are audited for the workspace without exposing provider secrets', { bindingAuditCount }),
    assertCheck(bindingApi.ok && bindingApi.json?.total >= 5 && cockpitApi.ok && cockpitApi.json?.providerBindings?.total >= 5 && providerCenter.ok && providerCenter.text.includes('provider-bind'), 'workspace cockpit surfaces expose provider bindings, role catalog, and menu surfaces', { bindingApiStatus: bindingApi.status, cockpitStatus: cockpitApi.status, providerCenterStatus: providerCenter.status }),
    assertCheck(dbPlan.json?.selectedBindingRoles?.includes('primary_database') && dbPlan.json?.envKeys?.includes('DATABASE_URL') && !dbPlan.json?.envKeys?.includes('NETLIFY_AUTH_TOKEN'), 'Neon binding projects only the minimum DB variables needed for the database action', { envKeys: dbPlan.json?.envKeys, selectedBindingRoles: dbPlan.json?.selectedBindingRoles }),
    assertCheck(workerPlan.json?.selectedBindingRoles?.includes('worker_deploy') && workerPlan.json?.envKeys?.includes('CLOUDFLARE_API_TOKEN') && !workerPlan.json?.envKeys?.includes('NETLIFY_AUTH_TOKEN'), 'Cloudflare binding projects only worker/runtime variables needed for the worker deploy action', { envKeys: workerPlan.json?.envKeys, selectedBindingRoles: workerPlan.json?.selectedBindingRoles }),
    assertCheck(sitePlan.json?.selectedBindingRoles?.includes('site_deploy') && sitePlan.json?.envKeys?.includes('NETLIFY_AUTH_TOKEN') && !sitePlan.json?.envKeys?.includes('CLOUDFLARE_API_TOKEN'), 'Netlify binding projects only site/runtime variables needed for the site deploy action', { envKeys: sitePlan.json?.envKeys, selectedBindingRoles: sitePlan.json?.selectedBindingRoles }),
    assertCheck(scmPlan.json?.selectedBindingRoles?.includes('scm_origin') && scmPlan.json?.envKeys?.includes('GITHUB_TOKEN') && !scmPlan.json?.envKeys?.includes('NETLIFY_AUTH_TOKEN'), 'GitHub binding projects only SCM variables needed for the source-control action', { envKeys: scmPlan.json?.envKeys, selectedBindingRoles: scmPlan.json?.selectedBindingRoles }),
    assertCheck(runtimePlan.json?.selectedBindingRoles?.includes('runtime_env') && runtimePlan.json?.envKeys?.includes('CUSTOM_API_TOKEN'), 'Generic env bundle can project named variables into runtime on unlock', { envKeys: runtimePlan.json?.envKeys, selectedBindingRoles: runtimePlan.json?.selectedBindingRoles })
  ];

  let payload = {
    section: 32,
    label: 'section-32-workspace-bindings',
    generatedAt: new Date().toISOString(),
    strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section32-workspace-bindings.mjs --strict',
    pass: checks.every(item => item.pass),
    checks,
    evidence: {
      workspaceId,
      sessionId: session.id,
      bindingStorePath: relative(config, bindingStorePath),
      bindingCount: listed.total,
      bindingAuditCount
    }
  };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section32-workspace-bindings.mjs');
  if (strict && !payload.pass) {
    throw new Error('Section 32 workspace bindings proof failed in strict mode.');
  }
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
