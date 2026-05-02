import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

import { writeProofJson } from '../lib/proof-runtime.mjs';
import { saveProviderProfile } from '../lib/provider-vault.mjs';
import { upsertWorkspaceProviderBinding } from '../lib/provider-bindings.mjs';
import { upsertGovernanceSecret } from '../lib/governance-manager.mjs';
import { buildProviderProofConfig, assertCheck, authHeaders, ensureProofWorkspace, fetchJson, operatorStart } from './provider-proof-helpers.mjs';

function pgMessage(type, payload = Buffer.alloc(0)) {
  const header = Buffer.allocUnsafe(5);
  header.writeUInt8(type.charCodeAt(0), 0);
  header.writeInt32BE(payload.length + 4, 1);
  return Buffer.concat([header, payload]);
}
function pgAuthOk() { const payload = Buffer.allocUnsafe(4); payload.writeInt32BE(0, 0); return pgMessage('R', payload); }
function pgParameterStatus(key, value) { return pgMessage('S', Buffer.concat([Buffer.from(key), Buffer.from([0]), Buffer.from(value), Buffer.from([0])])); }
function pgReady() { return pgMessage('Z', Buffer.from('I')); }
function pgCommandComplete(command) { return pgMessage('C', Buffer.from(`${command}\0`)); }

async function startFakePostgresServer() {
  const server = net.createServer(socket => {
    let buffer = Buffer.alloc(0);
    let startupSeen = false;
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 4) {
        if (!startupSeen) {
          const length = buffer.readInt32BE(0);
          if (buffer.length < length) break;
          buffer = buffer.subarray(length);
          startupSeen = true;
          socket.write(Buffer.concat([pgAuthOk(), pgParameterStatus('server_version', '16.0-skyehands-fixture'), pgReady()]));
          continue;
        }
        if (buffer.length < 5) break;
        const type = String.fromCharCode(buffer[0]);
        const length = buffer.readInt32BE(1);
        const total = length + 1;
        if (buffer.length < total) break;
        buffer = buffer.subarray(total);
        if (type === 'Q') socket.write(Buffer.concat([pgCommandComplete('SELECT 1'), pgReady()]));
        if (type === 'X') { socket.end(); break; }
      }
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  return { port: address.port, close: () => new Promise(resolve => server.close(() => resolve())) };
}

async function startFakeProviderApiServer(runId) {
  const marker = `fixture-${runId}`;
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    const auth = String(request.headers.authorization || '');
    const send = (status, payload) => { response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(payload)); };
    if (!auth.startsWith('Bearer ') || auth.length < 18) { send(401, { ok: false, error: 'missing_bearer' }); return; }
    if (/^\/client\/v4\/accounts\/[^/]+$/.test(url.pathname)) { const accountId = url.pathname.split('/').pop(); send(200, { success: true, result: { id: accountId, name: `cf-${marker}` } }); return; }
    if (/^\/client\/v4\/accounts\/[^/]+\/workers\/subdomain$/.test(url.pathname)) { send(200, { success: true, result: { enabled: true, subdomain: `${marker}.workers.dev` } }); return; }
    if (/^\/client\/v4\/accounts\/[^/]+\/r2\/buckets\/[^/]+$/.test(url.pathname)) { const bucket = url.pathname.split('/').pop(); send(200, { success: true, result: { name: bucket, created_at: '2026-04-05T00:00:00.000Z' } }); return; }
    if (/^\/client\/v4\/zones\/[^/]+$/.test(url.pathname)) { const zoneId = url.pathname.split('/').pop(); send(200, { success: true, result: { id: zoneId, status: 'active' } }); return; }
    if (/^\/api\/v1\/sites\/[^/]+$/.test(url.pathname)) { const siteId = url.pathname.split('/').pop(); send(200, { id: siteId, name: `netlify-${marker}`, url: `https://${marker}.netlify.app` }); return; }
    if (/^\/repos\/[^/]+\/[^/]+$/.test(url.pathname)) { const [, owner, repo] = url.pathname.split('/').filter(Boolean); send(200, { full_name: `${owner}/${repo}`, default_branch: 'main', private: false }); return; }
    send(404, { ok: false, error: 'not_found', path: url.pathname });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  return { baseUrl: `http://127.0.0.1:${address.port}`, close: () => new Promise(resolve => server.close(() => resolve())) };
}

async function main() {
  const strict = process.argv.includes('--strict');
  const config = buildProviderProofConfig('workspace-proof-section33-provider-runtime-execution.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_33_PROVIDER_RUNTIME_EXECUTION.json');
  const runId = Date.now();
  const workspaceId = `section33-provider-runtime-${runId}`;
  const tenantId = 'section33';
  const marker = `S33_RUNTIME_SECRET_${Date.now()}`;
  const postgresFixture = await startFakePostgresServer();
  const providerFixture = await startFakeProviderApiServer(runId);

  try {
    const { session } = await ensureProofWorkspace(config, workspaceId, { tenantId, source: 'section33-proof', clientName: 'section33-client' });
    upsertGovernanceSecret(config, { tenantId, scope: `provider:cloudflare:founder-shadow-${runId}`, key: 'apiToken', value: `${marker}_FOUNDER_CF_TOKEN_LONG`, description: 'founder-only cloudflare shadow lane for declaration proof', actorType: 'proof', actorId: 'section33-proof', source: 'section33-proof' });
    upsertGovernanceSecret(config, { tenantId, scope: `provider:cloudflare:founder-shadow-${runId}`, key: 'accountId', value: 'section33-founder-account-12345', description: 'founder-only cloudflare shadow lane for declaration proof', actorType: 'proof', actorId: 'section33-proof', source: 'section33-proof' });

    const profiles = {
      neon: saveProviderProfile(config, { profileId: `section33-neon-${runId}`, tenantId, provider: 'neon', alias: 'Section 33 Neon', unlockSecret: 'section33-neon-unlock', actorType: 'proof', actorId: 'section33-proof', source: 'section33-proof', secretPayload: { projectId: 'section33-neon-project', databaseName: 'section33_db', connectionTimeoutMs: '3000', databaseUrl: `postgresql://section33:${marker}@127.0.0.1:${postgresFixture.port}/section33?sslmode=disable` } }),
      cloudflare: saveProviderProfile(config, { profileId: `section33-cloudflare-${runId}`, tenantId, provider: 'cloudflare', alias: 'Section 33 Cloudflare', unlockSecret: 'section33-cf-unlock', actorType: 'proof', actorId: 'section33-proof', source: 'section33-proof', secretPayload: { apiToken: `${marker}_CF_TOKEN_LONG`, accountId: 'section33-account-12345', zoneId: 'section33-zone-12345', workerName: 'section33-worker', r2Bucket: 'section33-r2', apiBaseUrl: providerFixture.baseUrl } }),
      netlify: saveProviderProfile(config, { profileId: `section33-netlify-${runId}`, tenantId, provider: 'netlify', alias: 'Section 33 Netlify', unlockSecret: 'section33-netlify-unlock', actorType: 'proof', actorId: 'section33-proof', source: 'section33-proof', secretPayload: { authToken: `${marker}_NETLIFY_TOKEN_LONG`, siteId: 'section33-site-12345', teamSlug: 'section33-team', siteName: 'section33-site', apiBaseUrl: providerFixture.baseUrl } }),
      github: saveProviderProfile(config, { profileId: `section33-github-${runId}`, tenantId, provider: 'github', alias: 'Section 33 GitHub', unlockSecret: 'section33-github-unlock', actorType: 'proof', actorId: 'section33-proof', source: 'section33-proof', secretPayload: { token: `${marker}_GITHUB_TOKEN_LONG`, owner: 'skyesoverlondon', repo: 'section33-proof', branch: 'main', apiBaseUrl: providerFixture.baseUrl } })
    };

    upsertWorkspaceProviderBinding(config, { workspaceId, tenantId, profileId: profiles.neon.profile.profileId, bindingRole: 'primary_database', capability: 'database', envTarget: 'workspace_runtime', projectionMode: 'minimum', actorType: 'proof', actorId: 'section33-proof' });
    upsertWorkspaceProviderBinding(config, { workspaceId, tenantId, profileId: profiles.cloudflare.profile.profileId, bindingRole: 'worker_deploy', capability: 'worker_runtime', envTarget: 'deployment_runtime', projectionMode: 'minimum', actorType: 'proof', actorId: 'section33-proof' });
    upsertWorkspaceProviderBinding(config, { workspaceId, tenantId, profileId: profiles.cloudflare.profile.profileId, bindingRole: 'object_storage', capability: 'object_storage', envTarget: 'workspace_runtime', projectionMode: 'minimum', actorType: 'proof', actorId: 'section33-proof' });
    upsertWorkspaceProviderBinding(config, { workspaceId, tenantId, profileId: profiles.netlify.profile.profileId, bindingRole: 'site_deploy', capability: 'site_runtime', envTarget: 'deployment_runtime', projectionMode: 'minimum', actorType: 'proof', actorId: 'section33-proof' });
    upsertWorkspaceProviderBinding(config, { workspaceId, tenantId, profileId: profiles.github.profile.profileId, bindingRole: 'scm_origin', capability: 'scm', envTarget: 'workspace_runtime', projectionMode: 'minimum', actorType: 'proof', actorId: 'section33-proof' });

    const bridgePort = 3720 + (Date.now() % 300);
    const started = operatorStart(config, workspaceId, bridgePort);
    const base = started.payload.bridge?.baseUrl || `http://127.0.0.1:${bridgePort}`;
    const headers = authHeaders(session.accessToken, tenantId);

    const lockedWorker = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-runtime-execution`, { method: 'POST', headers, body: JSON.stringify({ action: 'worker_deploy', bindingRole: 'worker_deploy' }) });
    const missingPreviewDeploy = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-runtime-plan`, { method: 'POST', headers, body: JSON.stringify({ action: 'preview_deploy', bindingRole: 'preview_deploy' }) });
    const founderLane = await fetchJson(`${base}/api/founder-lanes?action=worker_deploy&tenantId=${encodeURIComponent(tenantId)}&workspaceId=${encodeURIComponent(workspaceId)}`, { headers });

    for (const [profileId, secret] of [[profiles.neon.profile.profileId, 'section33-neon-unlock'], [profiles.cloudflare.profile.profileId, 'section33-cf-unlock'], [profiles.netlify.profile.profileId, 'section33-netlify-unlock'], [profiles.github.profile.profileId, 'section33-github-unlock']]) {
      await fetchJson(`${base}/api/providers/${encodeURIComponent(profileId)}/unlock`, { method: 'POST', headers, body: JSON.stringify({ workspaceId, unlockSecret: secret, ttlMs: 60000 }) });
    }

    const providerTests = {
      neon: await fetchJson(`${base}/api/providers/${encodeURIComponent(profiles.neon.profile.profileId)}/test`, { method: 'POST', headers, body: JSON.stringify({ workspaceId, action: 'db_connect', capability: 'database', bindingRole: 'primary_database', timeoutMs: 3000 }) }),
      cloudflare: await fetchJson(`${base}/api/providers/${encodeURIComponent(profiles.cloudflare.profile.profileId)}/test`, { method: 'POST', headers, body: JSON.stringify({ workspaceId, action: 'worker_deploy', capability: 'worker_runtime', bindingRole: 'worker_deploy', timeoutMs: 3000 }) }),
      netlify: await fetchJson(`${base}/api/providers/${encodeURIComponent(profiles.netlify.profile.profileId)}/test`, { method: 'POST', headers, body: JSON.stringify({ workspaceId, action: 'site_deploy', capability: 'site_runtime', bindingRole: 'site_deploy', timeoutMs: 3000 }) }),
      github: await fetchJson(`${base}/api/providers/${encodeURIComponent(profiles.github.profile.profileId)}/test`, { method: 'POST', headers, body: JSON.stringify({ workspaceId, action: 'scm_sync', capability: 'scm', bindingRole: 'scm_origin', timeoutMs: 3000 }) })
    };

    const dbPlan = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-runtime-plan`, { method: 'POST', headers, body: JSON.stringify({ action: 'db_connect', bindingRole: 'primary_database' }) });
    const dbExec = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-runtime-execution`, { method: 'POST', headers, body: JSON.stringify({ action: 'db_connect', bindingRole: 'primary_database', timeoutMs: 3000 }) });
    const workerExec = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-runtime-execution`, { method: 'POST', headers, body: JSON.stringify({ action: 'worker_deploy', bindingRole: 'worker_deploy', timeoutMs: 3000 }) });
    const storageExec = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-runtime-execution`, { method: 'POST', headers, body: JSON.stringify({ action: 'object_storage', bindingRole: 'object_storage', timeoutMs: 3000 }) });
    const siteExec = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-runtime-execution`, { method: 'POST', headers, body: JSON.stringify({ action: 'site_deploy', bindingRole: 'site_deploy', timeoutMs: 3000 }) });
    const scmExec = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-runtime-execution`, { method: 'POST', headers, body: JSON.stringify({ action: 'scm_sync', bindingRole: 'scm_origin', timeoutMs: 3000 }) });
    const runtimeEvents = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/runtime-events?limit=20`, { headers });
    const providerEvent = (runtimeEvents.json?.events || []).find(item => item.action === 'provider-runtime-execution' || item.action === 'provider-runtime-plan');
    const runtimePayloadText = JSON.stringify(runtimeEvents.json || {});

    const checks = [
      assertCheck(started.result.status === 0 && started.payload.ok === true, 'operator start returns a live bridge for provider runtime execution proofing', { status: started.result.status, bridge: started.payload.bridge }),
      assertCheck(lockedWorker.status === 409 && lockedWorker.json?.error === 'requires_unlock' && lockedWorker.json?.founderFallback === false && lockedWorker.json?.founderLaneDeclared === true, 'provider runtime execution fails closed while locked, declares founder-only lanes explicitly, and never silently falls back to founder credentials', lockedWorker.json),
      assertCheck(missingPreviewDeploy.status === 409 && missingPreviewDeploy.json?.error === 'binding_missing' && missingPreviewDeploy.json?.founderFallback === false, 'runtime brokerage surfaces binding_missing when the required binding role is absent instead of silently crossing into another credential lane', missingPreviewDeploy.json),
      assertCheck(founderLane.ok && founderLane.json?.founderLane?.declared === true && founderLane.json?.founderLane?.available === true && (founderLane.json?.founderLane?.providerCandidates || []).some(item => item.provider === 'cloudflare'), 'founder-only governance credentials are surfaced as an explicit separate declaration lane for the relevant action', founderLane.json?.founderLane),
      assertCheck(providerTests.neon.status === 200 && providerTests.neon.json?.result?.ok === true && providerTests.neon.json?.result?.mode === 'live_protocol_probe', 'provider test lane runs a real Postgres wire-protocol probe for Neon/Postgres bindings when the profile is unlocked', providerTests.neon.json?.result),
      assertCheck(providerTests.cloudflare.status === 200 && providerTests.cloudflare.json?.result?.ok === true && providerTests.cloudflare.json?.result?.mode === 'live_http_probe', 'provider test lane runs a real Cloudflare capability probe against the user-owned account API when the profile is unlocked', providerTests.cloudflare.json?.result),
      assertCheck(providerTests.netlify.status === 200 && providerTests.netlify.json?.result?.ok === true && providerTests.netlify.json?.result?.mode === 'live_http_probe', 'provider test lane runs a real Netlify site capability probe against the user-owned site API when the profile is unlocked', providerTests.netlify.json?.result),
      assertCheck(providerTests.github.status === 200 && providerTests.github.json?.result?.ok === true && providerTests.github.json?.result?.mode === 'live_http_probe', 'provider test lane runs a real GitHub repo/auth probe against the user-owned repo API when the profile is unlocked', providerTests.github.json?.result),
      assertCheck(dbPlan.ok && dbPlan.json?.selectedLane === 'user-owned' && dbPlan.json?.founderFallback === false && dbPlan.json?.selectedBindingRoles?.includes('primary_database') && dbPlan.json?.executionPlans?.[0]?.envKeys?.includes('DATABASE_URL'), 'provider runtime plan API declares user-owned binding selection for database brokerage with no founder fallback', { selectedBindingRoles: dbPlan.json?.selectedBindingRoles, executionPlans: dbPlan.json?.executionPlans }),
      assertCheck(dbExec.status === 200 && dbExec.json?.executionResults?.[0]?.ok === true && dbExec.json?.executionResults?.[0]?.mode === 'live_protocol_probe' && !JSON.stringify(dbExec.json).includes(marker), 'bound unlocked Neon profile can back a real workspace DB connectivity proof with redacted output and no founder fallback', dbExec.json),
      assertCheck(workerExec.status === 200 && workerExec.json?.selectedBindingRoles?.includes('worker_deploy') && workerExec.json?.executionResults?.every(item => item.ok === true) && workerExec.json?.executionResults?.[0]?.mode === 'live_http_probe' && !JSON.stringify(workerExec.json).includes(marker), 'bound unlocked Cloudflare profile can back a real worker/runtime capability proof with redacted output and no founder fallback', workerExec.json),
      assertCheck(storageExec.status === 200 && storageExec.json?.selectedBindingRoles?.includes('object_storage') && storageExec.json?.executionResults?.[0]?.ok === true && String(JSON.stringify(storageExec.json?.executionResults?.[0]?.verification || {})).includes('r2/buckets') && !JSON.stringify(storageExec.json).includes(marker), 'bound unlocked object-storage provider can back a real storage capability proof with action-specific projection and redacted output', storageExec.json),
      assertCheck(siteExec.status === 200 && siteExec.json?.selectedBindingRoles?.includes('site_deploy') && siteExec.json?.executionResults?.[0]?.ok === true && siteExec.json?.executionResults?.[0]?.mode === 'live_http_probe' && !JSON.stringify(siteExec.json).includes(marker), 'bound unlocked Netlify profile can back a real site/runtime capability proof with action-specific env projection', siteExec.json),
      assertCheck(scmExec.status === 200 && scmExec.json?.selectedBindingRoles?.includes('scm_origin') && scmExec.json?.executionResults?.[0]?.ok === true && scmExec.json?.executionResults?.[0]?.mode === 'live_http_probe' && !JSON.stringify(scmExec.json).includes(marker), 'bound unlocked GitHub profile can back a real repo/auth capability proof with action-specific env projection', scmExec.json),
      assertCheck(runtimeEvents.ok && Boolean(providerEvent) && runtimePayloadText.includes('selectedLane') && runtimePayloadText.includes('founderLaneDeclared') && runtimePayloadText.includes('executionResults') && !runtimePayloadText.includes(marker), 'operator-visible runtime events record provider alias, role, action, execution mode, and founder-lane separation with redacted execution summaries only', { eventCount: runtimeEvents.json?.count, providerEvent })
    ];

    let payload = {
      section: 33,
      label: 'section-33-provider-runtime-execution',
      generatedAt: new Date().toISOString(),
      strict,
      proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section33-provider-runtime-execution.mjs --strict',
      pass: checks.every(item => item.pass),
      checks,
      evidence: {
        workspaceId,
        sessionId: session.id,
        bridgeBaseUrl: base,
        providerFixtureBaseUrl: providerFixture.baseUrl,
        postgresFixturePort: postgresFixture.port,
        lockedStatus: lockedWorker.status,
        founderLaneDeclared: founderLane.json?.founderLane?.declared || false,
        databaseEnvKeys: dbPlan.json?.envKeys || [],
        databaseExecution: dbExec.json?.executionResults || [],
        storageExecution: storageExec.json?.executionResults || [],
        workerExecution: workerExec.json?.executionResults || [],
        siteExecution: siteExec.json?.executionResults || [],
        scmExecution: scmExec.json?.executionResults || []
      }
    };
    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section33-provider-runtime-execution.mjs');
    if (strict && !payload.pass) throw new Error('Section 33 provider runtime execution proof failed in strict mode.');
    console.log(JSON.stringify(payload, null, 2));
  } finally {
    await providerFixture.close();
    await postgresFixture.close();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
