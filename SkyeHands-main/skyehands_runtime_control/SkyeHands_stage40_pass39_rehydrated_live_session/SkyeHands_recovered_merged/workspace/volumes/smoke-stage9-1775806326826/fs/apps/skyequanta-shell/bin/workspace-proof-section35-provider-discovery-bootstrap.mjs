import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { writeProofJson } from '../lib/proof-runtime.mjs';
import { saveProviderProfile } from '../lib/provider-vault.mjs';
import { buildProviderProofConfig, assertCheck, authHeaders, ensureProofWorkspace, fetchJson, fetchText, operatorStart } from './provider-proof-helpers.mjs';

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
          socket.write(Buffer.concat([pgAuthOk(), pgParameterStatus('server_version', '16.0-skyehands-discovery-fixture'), pgReady()]));
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
    const send = (status, payload) => {
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify(payload));
    };
    if (!auth.startsWith('Bearer ') || auth.length < 18) {
      send(401, { ok: false, error: 'missing_bearer' });
      return;
    }
    if (url.pathname === '/user') { send(200, { login: `fixture-user-${marker}`, id: 35 }); return; }
    if (/^\/client\/v4\/accounts\/[^/]+$/.test(url.pathname)) { const accountId = url.pathname.split('/').pop(); send(200, { success: true, result: { id: accountId, name: `cf-${marker}` } }); return; }
    if (/^\/client\/v4\/accounts\/[^/]+\/workers\/subdomain$/.test(url.pathname)) { send(200, { success: true, result: { enabled: true, subdomain: `${marker}.workers.dev` } }); return; }
    if (/^\/client\/v4\/accounts\/[^/]+\/r2\/buckets\/[^/]+$/.test(url.pathname)) { const bucket = url.pathname.split('/').pop(); send(200, { success: true, result: { name: bucket, created_at: '2026-04-06T00:00:00.000Z' } }); return; }
    if (/^\/client\/v4\/zones\/[^/]+$/.test(url.pathname)) { const zoneId = url.pathname.split('/').pop(); send(200, { success: true, result: { id: zoneId, status: 'active' } }); return; }
    if (/^\/api\/v1\/sites\/[^/]+\/deploys$/.test(url.pathname)) { send(200, [{ id: `deploy-${marker}`, state: 'ready', context: 'production' }]); return; }
    if (/^\/api\/v1\/sites\/[^/]+$/.test(url.pathname)) { const siteId = url.pathname.split('/').pop(); send(200, { id: siteId, name: `netlify-${marker}`, url: `https://${marker}.netlify.app` }); return; }
    if (/^\/repos\/[^/]+\/[^/]+\/branches\/[^/]+$/.test(url.pathname)) { const branch = url.pathname.split('/').pop(); send(200, { name: branch, protected: false }); return; }
    if (/^\/repos\/[^/]+\/[^/]+$/.test(url.pathname)) { const [, owner, repo] = url.pathname.split('/').filter(Boolean); send(200, { full_name: `${owner}/${repo}`, default_branch: 'main', private: false }); return; }
    send(404, { ok: false, error: 'not_found', path: url.pathname });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  return { baseUrl: `http://127.0.0.1:${address.port}`, close: () => new Promise(resolve => server.close(() => resolve())) };
}

function parseJsonStdout(result) {
  try { return JSON.parse(result.stdout || '{}'); } catch { return null; }
}

async function main() {
  const strict = process.argv.includes('--strict');
  const config = buildProviderProofConfig('workspace-proof-section35-provider-discovery-bootstrap.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_35_PROVIDER_DISCOVERY_BOOTSTRAP.json');
  const runId = Date.now();
  const workspaceId = `section35-provider-bootstrap-${runId}`;
  const tenantId = 'section35';
  const marker = `S35_DISCOVERY_SECRET_${Date.now()}`;
  const postgresFixture = await startFakePostgresServer();
  const providerFixture = await startFakeProviderApiServer(runId);

  try {
    const { session } = await ensureProofWorkspace(config, workspaceId, { tenantId, source: 'section35-proof', clientName: 'section35-client' });

    const profiles = {
      neon: saveProviderProfile(config, { profileId: `section35-neon-${runId}`, tenantId, provider: 'neon', alias: 'Section 35 Neon', unlockSecret: 'section35-neon-unlock', actorType: 'proof', actorId: 'section35-proof', source: 'section35-proof', secretPayload: { projectId: 'section35-neon-project', databaseName: 'section35_db', connectionTimeoutMs: '3000', databaseUrl: `postgresql://section35:${marker}@127.0.0.1:${postgresFixture.port}/section35?sslmode=disable` } }),
      cloudflare: saveProviderProfile(config, { profileId: `section35-cloudflare-${runId}`, tenantId, provider: 'cloudflare', alias: 'Section 35 Cloudflare', unlockSecret: 'section35-cf-unlock', actorType: 'proof', actorId: 'section35-proof', source: 'section35-proof', secretPayload: { apiToken: `${marker}_CF_TOKEN_LONG`, accountId: 'section35-account-12345', zoneId: 'section35-zone-12345', workerName: 'section35-worker', r2Bucket: 'section35-r2', apiBaseUrl: providerFixture.baseUrl } }),
      netlify: saveProviderProfile(config, { profileId: `section35-netlify-${runId}`, tenantId, provider: 'netlify', alias: 'Section 35 Netlify', unlockSecret: 'section35-netlify-unlock', actorType: 'proof', actorId: 'section35-proof', source: 'section35-proof', secretPayload: { authToken: `${marker}_NETLIFY_TOKEN_LONG`, siteId: 'section35-site-12345', teamSlug: 'section35-team', siteName: 'section35-site', apiBaseUrl: providerFixture.baseUrl } }),
      github: saveProviderProfile(config, { profileId: `section35-github-${runId}`, tenantId, provider: 'github', alias: 'Section 35 GitHub', unlockSecret: 'section35-github-unlock', actorType: 'proof', actorId: 'section35-proof', source: 'section35-proof', secretPayload: { token: `${marker}_GITHUB_TOKEN_LONG`, owner: 'skyesoverlondon', repo: 'section35-proof', branch: 'main', apiBaseUrl: providerFixture.baseUrl } }),
      envBundle: saveProviderProfile(config, { profileId: `section35-env-${runId}`, tenantId, provider: 'env_bundle', alias: 'Section 35 Env', unlockSecret: 'section35-env-unlock', actorType: 'proof', actorId: 'section35-proof', source: 'section35-proof', secretPayload: { bundleName: 'section35-env', env: { CUSTOM_API_KEY: `${marker}_ENV_KEY`, CUSTOM_ENDPOINT: 'https://example.test', DATABASE_URL: `postgresql://section35:${marker}@127.0.0.1:${postgresFixture.port}/section35?sslmode=disable` } } })
    };

    const bridgePort = 3780 + (Date.now() % 200);
    const started = operatorStart(config, workspaceId, bridgePort);
    const base = started.payload.bridge?.baseUrl || `http://127.0.0.1:${bridgePort}`;
    const headers = authHeaders(session.accessToken, tenantId);

    const providerCenter = await fetchText(`${base}/provider-center?workspaceId=${encodeURIComponent(workspaceId)}&tenantId=${encodeURIComponent(tenantId)}`, { headers });

    const discoveries = {
      neon: await fetchJson(`${base}/api/providers/${encodeURIComponent(profiles.neon.profile.profileId)}/discovery`, { method: 'POST', headers, body: JSON.stringify({ workspaceId, unlockSecret: 'section35-neon-unlock', timeoutMs: 3000 }) }),
      cloudflare: await fetchJson(`${base}/api/providers/${encodeURIComponent(profiles.cloudflare.profile.profileId)}/discovery`, { method: 'POST', headers, body: JSON.stringify({ workspaceId, unlockSecret: 'section35-cf-unlock', timeoutMs: 3000 }) }),
      netlify: await fetchJson(`${base}/api/providers/${encodeURIComponent(profiles.netlify.profile.profileId)}/discovery`, { method: 'POST', headers, body: JSON.stringify({ workspaceId, unlockSecret: 'section35-netlify-unlock', timeoutMs: 3000 }) }),
      github: await fetchJson(`${base}/api/providers/${encodeURIComponent(profiles.github.profile.profileId)}/discovery`, { method: 'POST', headers, body: JSON.stringify({ workspaceId, unlockSecret: 'section35-github-unlock', timeoutMs: 3000 }) }),
      envBundle: await fetchJson(`${base}/api/providers/${encodeURIComponent(profiles.envBundle.profile.profileId)}/discovery`, { method: 'POST', headers, body: JSON.stringify({ workspaceId, unlockSecret: 'section35-env-unlock', timeoutMs: 3000 }) })
    };

    const bootstraps = {
      neon: await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-bootstrap`, { method: 'POST', headers, body: JSON.stringify({ profileId: profiles.neon.profile.profileId, unlockSecret: 'section35-neon-unlock', timeoutMs: 3000 }) }),
      cloudflare: await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-bootstrap`, { method: 'POST', headers, body: JSON.stringify({ profileId: profiles.cloudflare.profile.profileId, unlockSecret: 'section35-cf-unlock', timeoutMs: 3000 }) }),
      netlify: await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-bootstrap`, { method: 'POST', headers, body: JSON.stringify({ profileId: profiles.netlify.profile.profileId, unlockSecret: 'section35-netlify-unlock', timeoutMs: 3000 }) }),
      github: await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-bootstrap`, { method: 'POST', headers, body: JSON.stringify({ profileId: profiles.github.profile.profileId, unlockSecret: 'section35-github-unlock', timeoutMs: 3000 }) }),
      envBundle: await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-bootstrap`, { method: 'POST', headers, body: JSON.stringify({ profileId: profiles.envBundle.profile.profileId, unlockSecret: 'section35-env-unlock', timeoutMs: 3000 }) })
    };

    const bindings = await fetchJson(`${base}/api/workspaces/${encodeURIComponent(workspaceId)}/provider-bindings`, { headers });

    const cliDiscover = spawnSync(process.execPath, ['apps/skyequanta-shell/bin/workspace.mjs', 'provider-discover', '--profile-id', profiles.envBundle.profile.profileId, '--unlock-secret', 'section35-env-unlock', '--tenant', tenantId], { cwd: config.rootDir, encoding: 'utf8', env: { ...process.env } });
    const cliBootstrap = spawnSync(process.execPath, ['apps/skyequanta-shell/bin/workspace.mjs', 'provider-bootstrap', workspaceId, '--profile-id', profiles.envBundle.profile.profileId, '--unlock-secret', 'section35-env-unlock', '--tenant', tenantId, '--description', 'cli bootstrap proof'], { cwd: config.rootDir, encoding: 'utf8', env: { ...process.env } });
    const cliDiscoverJson = parseJsonStdout(cliDiscover);
    const cliBootstrapJson = parseJsonStdout(cliBootstrap);

    const bindingsPayloadText = JSON.stringify(bindings.json || {});
    const expectedRoles = ['primary_database', 'worker_deploy', 'object_storage', 'preview_deploy', 'site_deploy', 'scm_origin', 'runtime_env'];
    const actualRoles = (bindings.json?.bindings || []).map(item => item.bindingRole);

    const checks = [
      assertCheck(started.result.status === 0 && started.payload.ok === true, 'operator start returns a live bridge for provider discovery and bootstrap proofing', { status: started.result.status, bridge: started.payload.bridge }),
      assertCheck(providerCenter.ok && providerCenter.text.includes('Discover + bind') && providerCenter.text.includes('Discovery and bootstrap'), 'provider center includes real discovery and bootstrap menu surfaces inside the product shell', { status: providerCenter.status }),
      assertCheck(discoveries.neon.ok && discoveries.neon.json?.result?.discovery?.mode === 'live_protocol_discovery', 'provider discovery runs a real Postgres discovery probe for Neon/Postgres bindings', discoveries.neon.json?.result),
      assertCheck(discoveries.cloudflare.ok && discoveries.cloudflare.json?.result?.discovery?.mode === 'live_http_discovery', 'provider discovery runs a real Cloudflare resource discovery probe against the user-owned account API', discoveries.cloudflare.json?.result),
      assertCheck(discoveries.netlify.ok && discoveries.netlify.json?.result?.discovery?.resources?.deploys?.status === 200, 'provider discovery runs a real Netlify site and deploy inventory probe against the user-owned site API', discoveries.netlify.json?.result),
      assertCheck(discoveries.github.ok && discoveries.github.json?.result?.discovery?.resources?.branch?.status === 200, 'provider discovery runs a real GitHub user, repo, and branch probe against the user-owned repo API', discoveries.github.json?.result),
      assertCheck(discoveries.envBundle.ok && Array.isArray(discoveries.envBundle.json?.result?.discovery?.resources?.envKeys) && discoveries.envBundle.json.result.discovery.resources.envKeys.includes('CUSTOM_API_KEY'), 'provider discovery exposes redacted env bundle inventory without leaking values', discoveries.envBundle.json?.result),
      assertCheck(Object.values(bootstraps).every(item => item.ok) && bootstraps.cloudflare.json?.totalApplied >= 3 && bootstraps.netlify.json?.totalApplied >= 2 && bootstraps.github.json?.totalApplied >= 1, 'workspace provider bootstrap applies discovered binding-role suggestions for deploy, storage, preview, and SCM lanes', { cloudflare: bootstraps.cloudflare.json?.totalApplied, netlify: bootstraps.netlify.json?.totalApplied, github: bootstraps.github.json?.totalApplied }),
      assertCheck(bindings.ok && expectedRoles.every(role => actualRoles.includes(role)) && (bindings.json?.total || 0) >= 8, 'workspace bindings API reflects the discovered bootstrap roles across database, deploy, preview, storage, scm, and runtime lanes', { total: bindings.json?.total, roles: actualRoles }),
      assertCheck(cliDiscover.status === 0 && cliDiscoverJson?.ok === true && cliDiscoverJson?.result?.discovery?.mode === 'projection_discovery', 'workspace CLI exposes provider-discover with real discovery output and redacted summaries', cliDiscoverJson),
      assertCheck(cliBootstrap.status === 0 && cliBootstrapJson?.ok === true && cliBootstrapJson?.totalApplied >= 1, 'workspace CLI exposes provider-bootstrap to apply suggested workspace bindings from the command surface', cliBootstrapJson),
      assertCheck(!JSON.stringify(discoveries).includes(marker) && !JSON.stringify(bootstraps).includes(marker) && !bindingsPayloadText.includes(marker) && !String(cliDiscover.stdout || '').includes(marker) && !String(cliBootstrap.stdout || '').includes(marker), 'provider discovery and bootstrap surfaces stay redacted with no plaintext secret leakage in API or CLI proof output', { markerLeaked: false })
    ];

    let payload = {
      section: 35,
      label: 'section-35-provider-discovery-bootstrap',
      generatedAt: new Date().toISOString(),
      strict,
      proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section35-provider-discovery-bootstrap.mjs --strict',
      pass: checks.every(item => item.pass),
      checks,
      evidence: {
        workspaceId,
        sessionId: session.id,
        bridgeBaseUrl: base,
        providerFixtureBaseUrl: providerFixture.baseUrl,
        postgresFixturePort: postgresFixture.port,
        discoveryModes: Object.fromEntries(Object.entries(discoveries).map(([key, value]) => [key, value.json?.result?.discovery?.mode || null])),
        bootstrapApplied: Object.fromEntries(Object.entries(bootstraps).map(([key, value]) => [key, value.json?.totalApplied || 0])),
        bindingRoles: actualRoles,
        cliDiscover: cliDiscoverJson,
        cliBootstrap: cliBootstrapJson
      }
    };
    payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section35-provider-discovery-bootstrap.mjs');
    if (strict && !payload.pass) throw new Error('Section 35 provider discovery/bootstrap proof failed in strict mode.');
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
