import path from 'node:path';

import { writeProofJson } from '../lib/proof-runtime.mjs';
import { buildProviderProofConfig, assertCheck, authHeaders, ensureProofWorkspace, fetchJson, fetchText, operatorStart } from './provider-proof-helpers.mjs';

async function main() {
  const strict = process.argv.includes('--strict');
  const config = buildProviderProofConfig('workspace-proof-section31-provider-center.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_31_PROVIDER_CENTER.json');
  const workspaceId = 'section31-provider-center';
  const tenantId = 'section31';
  const unlockSecret = 'section31-unlock-secret';
  const rotatedSecret = 'section31-rotated-secret';
  const rawMarker = `S31_PROVIDER_CENTER_SECRET_${Date.now()}`;

  const { workspace, session } = await ensureProofWorkspace(config, workspaceId, {
    tenantId,
    source: 'section31-proof',
    clientName: 'section31-client'
  });

  const bridgePort = 3520 + (Date.now() % 300);
  const started = operatorStart(config, workspace.id, bridgePort);
  const base = started.payload.bridge?.baseUrl || `http://127.0.0.1:${bridgePort}`;
  const headers = authHeaders(session.accessToken, tenantId);

  const catalog = await fetchJson(`${base}/api/providers/catalog?workspaceId=${encodeURIComponent(workspaceId)}&tenantId=${encodeURIComponent(tenantId)}`, { headers });
  const created = await fetchJson(`${base}/api/providers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      workspaceId,
      provider: 'netlify',
      alias: 'Section 31 Netlify Profile',
      description: 'Provider center proof profile',
      unlockSecret,
      scopesSummary: ['deploy', 'preview'],
      secretPayload: {
        authToken: rawMarker,
        siteId: 'site-section31',
        siteName: 'section31-proof-site',
        teamSlug: 'sol-proof'
      }
    })
  });
  const profileId = created.json?.profile?.profileId;
  const metadataUpdate = await fetchJson(`${base}/api/providers/${encodeURIComponent(profileId)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      alias: 'Section 31 Netlify Profile Updated',
      description: 'Updated provider center metadata without secret echo'
    })
  });
  const rotationUpdate = await fetchJson(`${base}/api/providers/${encodeURIComponent(profileId)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      alias: 'Section 31 Netlify Profile Updated',
      unlockSecret: rotatedSecret,
      secretPayload: {
        authToken: `${rawMarker}_ROTATED`,
        siteId: 'site-section31',
        siteName: 'section31-proof-site',
        teamSlug: 'sol-proof'
      }
    })
  });
  const tempProfile = await fetchJson(`${base}/api/providers`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      workspaceId,
      provider: 'env_bundle',
      alias: 'Section 31 Temp Bundle',
      unlockSecret,
      secretPayload: { bundleName: 'temp-bundle', env: { SAMPLE_KEY: rawMarker } }
    })
  });
  const tempDelete = await fetchJson(`${base}/api/providers/${encodeURIComponent(tempProfile.json?.profile?.profileId)}`, {
    method: 'DELETE',
    headers
  });
  const listed = await fetchJson(`${base}/api/providers?tenantId=${encodeURIComponent(tenantId)}`, { headers });
  const detail = await fetchJson(`${base}/api/providers/${encodeURIComponent(profileId)}`, { headers });
  const providerCenter = await fetchText(`${base}/provider-center?workspaceId=${encodeURIComponent(workspaceId)}&tenantId=${encodeURIComponent(tenantId)}`, { headers: { authorization: `Bearer ${session.accessToken}`, 'x-skyequanta-tenant-id': tenantId } });
  const storageCenter = await fetchText(`${base}/storage-center?workspaceId=${encodeURIComponent(workspaceId)}&tenantId=${encodeURIComponent(tenantId)}`, { headers: { authorization: `Bearer ${session.accessToken}`, 'x-skyequanta-tenant-id': tenantId } });
  const deploymentCenter = await fetchText(`${base}/deployment-center?workspaceId=${encodeURIComponent(workspaceId)}&tenantId=${encodeURIComponent(tenantId)}`, { headers: { authorization: `Bearer ${session.accessToken}`, 'x-skyequanta-tenant-id': tenantId } });
  const workspaceCenter = await fetchText(`${base}/workspace-center?workspaceId=${encodeURIComponent(workspaceId)}`, { headers: { authorization: `Bearer ${session.accessToken}`, 'x-skyequanta-tenant-id': tenantId } });
  const lockedTest = await fetchJson(`${base}/api/providers/${encodeURIComponent(profileId)}/test`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ workspaceId, action: 'site_deploy' })
  });
  const unlock = await fetchJson(`${base}/api/providers/${encodeURIComponent(profileId)}/unlock`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ workspaceId, unlockSecret: rotatedSecret, ttlMs: 60000 })
  });
  const lock = await fetchJson(`${base}/api/providers/${encodeURIComponent(profileId)}/lock`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ workspaceId })
  });

  const htmlHasMenus = providerCenter.ok
    && providerCenter.text.includes('provider-save')
    && providerCenter.text.includes('provider-bind')
    && providerCenter.text.includes('runtime-plan')
    && providerCenter.text.includes('auth-token');

  const checks = [
    assertCheck(started.result.status === 0 && started.payload.ok === true, 'operator start returns a live bridge for provider-center proofing', { status: started.result.status, bridge: started.payload.bridge }),
    assertCheck(catalog.ok && Array.isArray(catalog.json?.catalog?.providers) && Array.isArray(catalog.json?.roleCatalog?.roles) && catalog.json.catalog.providers.length >= 5, 'provider catalog API exposes provider schemas and binding-role catalog for in-product menus', { providerCount: catalog.json?.catalog?.providers?.length, roleCount: catalog.json?.roleCatalog?.roles?.length }),
    assertCheck(created.ok && Boolean(profileId), 'provider center API can create a user-owned provider profile from a workspace session', { status: created.status, profileId }),
    assertCheck(metadataUpdate.ok && metadataUpdate.json?.profile?.alias === 'Section 31 Netlify Profile Updated' && !JSON.stringify(metadataUpdate.json).includes(rawMarker), 'provider metadata can be edited without echoing back secret payload values', metadataUpdate.json),
    assertCheck(rotationUpdate.ok && rotationUpdate.json?.profile?.alias === 'Section 31 Netlify Profile Updated' && !JSON.stringify(rotationUpdate.json).includes(`${rawMarker}_ROTATED`), 'provider secrets can be rotated through the provider menu lane without reading back old plaintext values', { profileId: rotationUpdate.json?.profile?.profileId }),
    assertCheck(tempDelete.ok === true && tempDelete.json?.ok === true, 'provider profiles can be deleted through the canonical provider API lane', tempDelete.json),
    assertCheck(listed.ok && Array.isArray(listed.json?.profiles) && listed.json.profiles.some(item => item.profileId === profileId) && !JSON.stringify(listed.json).includes(rawMarker), 'provider list API returns safe metadata only and never echoes raw provider secret values', { total: listed.json?.total }),
    assertCheck(detail.ok && detail.json?.profile?.profileId === profileId && !JSON.stringify(detail.json).includes(rawMarker), 'provider detail API returns masked provider posture instead of raw credentials', detail.json),
    assertCheck(htmlHasMenus && storageCenter.ok && storageCenter.text.includes('Storage Center') && deploymentCenter.ok && deploymentCenter.text.includes('Deployment Center'), 'provider, storage, and deployment menu surfaces render real menu controls inside the product shell', { providerCenterStatus: providerCenter.status, storageCenterStatus: storageCenter.status, deploymentCenterStatus: deploymentCenter.status }),
    assertCheck(workspaceCenter.ok && workspaceCenter.text.includes('/provider-center'), 'workspace center exposes the provider-center entry point from the cockpit surface', { workspaceCenterStatus: workspaceCenter.status }),
    assertCheck(lockedTest.status === 409 && lockedTest.json?.error === 'requires_unlock', 'provider-center test lane fails closed while the provider profile remains locked', lockedTest.json),
    assertCheck(unlock.ok && unlock.json?.ok === true && lock.ok && lock.json?.ok === true, 'provider center exposes explicit unlock and relock controls for session-scoped provider use', { unlock: unlock.json, lock: lock.json })
  ];

  let payload = {
    section: 31,
    label: 'section-31-provider-center',
    generatedAt: new Date().toISOString(),
    strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section31-provider-center.mjs --strict',
    pass: checks.every(item => item.pass),
    checks,
    evidence: {
      workspaceId,
      sessionId: session.id,
      profileId,
      bridgeBaseUrl: base,
      profileCount: listed.json?.total || 0
    }
  };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section31-provider-center.mjs');
  if (strict && !payload.pass) {
    throw new Error('Section 31 provider center proof failed in strict mode.');
  }
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
