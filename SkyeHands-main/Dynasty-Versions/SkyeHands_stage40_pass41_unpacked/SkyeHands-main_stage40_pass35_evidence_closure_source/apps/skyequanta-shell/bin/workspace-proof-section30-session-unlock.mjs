import path from 'node:path';

import { writeProofJson } from '../lib/proof-runtime.mjs';
import { saveProviderProfile } from '../lib/provider-vault.mjs';
import { upsertWorkspaceProviderBinding } from '../lib/provider-bindings.mjs';
import { resolveWorkspaceProviderProjection } from '../lib/provider-env-projection.mjs';
import { getSessionProviderUnlockState, lockProviderProfilesForSession, unlockProviderProfileForSession } from '../lib/session-manager.mjs';
import { buildProviderProofConfig, assertCheck, ensureProofWorkspace, searchPathForMarker, relative } from './provider-proof-helpers.mjs';

async function main() {
  const strict = process.argv.includes('--strict');
  const config = buildProviderProofConfig('workspace-proof-section30-session-unlock.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_30_SESSION_UNLOCK.json');
  const runId = Date.now();
  const workspaceId = `section30-session-unlock-${runId}`;
  const tenantId = 'section30';
  const unlockSecret = 'section30-unlock-secret';
  const rawMarker = `S30_UNLOCK_SECRET_${Date.now()}`;
  const profileId = `section30-env-${Date.now()}`;

  const { workspace, session } = await ensureProofWorkspace(config, workspaceId, {
    tenantId,
    source: 'section30-proof',
    clientName: 'section30-client'
  });

  saveProviderProfile(config, {
    profileId,
    tenantId,
    provider: 'env_bundle',
    alias: 'Section 30 Session Unlock',
    unlockSecret,
    actorType: 'proof',
    actorId: 'section30-proof',
    source: 'section30-proof',
    secretPayload: {
      bundleName: 'Section 30 Bundle',
      env: {
        DATABASE_URL: `postgresql://section30:${rawMarker}@db.example.com:5432/section30`,
        NETLIFY_AUTH_TOKEN: rawMarker,
        GITHUB_OWNER: 'skyesoverlondon',
        GITHUB_REPO: 'skyehands-proof'
      }
    }
  });

  upsertWorkspaceProviderBinding(config, {
    workspaceId,
    tenantId,
    profileId,
    capability: 'runtime',
    envTarget: 'workspace_runtime',
    projectionMode: 'ephemeral',
    actorType: 'proof',
    actorId: 'section30-proof'
  });

  const lockedProjection = resolveWorkspaceProviderProjection(config, {
    workspaceId,
    tenantId,
    sessionId: session.id,
    action: 'provider_runtime_execution'
  });
  const unlock = unlockProviderProfileForSession(config, {
    sessionId: session.id,
    profileId,
    tenantId,
    workspaceId,
    unlockSecret,
    ttlMs: 60_000,
    actorType: 'proof',
    actorId: 'section30-proof'
  });
  const unlockState = getSessionProviderUnlockState(config, { sessionId: session.id });
  const unlockedProjection = resolveWorkspaceProviderProjection(config, {
    workspaceId,
    tenantId,
    sessionId: session.id,
    action: 'provider_runtime_execution'
  });
  const relock = lockProviderProfilesForSession(config, {
    sessionId: session.id,
    profileId,
    tenantId,
    workspaceId,
    actorType: 'proof',
    actorId: 'section30-proof'
  });
  const relockedProjection = resolveWorkspaceProviderProjection(config, {
    workspaceId,
    tenantId,
    sessionId: session.id,
    action: 'provider_runtime_execution'
  });

  const runtimeDir = path.join(config.rootDir, '.skyequanta');
  const markerFoundInRuntimeState = searchPathForMarker(runtimeDir, rawMarker);

  const checks = [
    assertCheck(lockedProjection.requiresUnlock === true && lockedProjection.missingUnlock.length === 1, 'locked sessions hard-fail provider-backed runtime projection with requires_unlock instead of silently continuing', lockedProjection),
    assertCheck(unlock.ok === true && unlock.profile.profileId === profileId && unlockState.unlocked === true, 'session unlock grants ephemeral access to the selected provider profile only for the current session', unlockState),
    assertCheck(unlockedProjection.ok === true && unlockedProjection.requiresUnlock === false && unlockedProjection.envKeys.includes('DATABASE_URL') && unlockedProjection.projections.every(item => item.unlockMode === 'session'), 'unlocked sessions can materialize provider-backed runtime projection without exposing raw values', { envKeys: unlockedProjection.envKeys, projections: unlockedProjection.projections }),
    assertCheck(relock.locked === 1 && relockedProjection.requiresUnlock === true, 'relocking removes provider-backed runtime access again for the session', { relock, relockedProjection }),
    assertCheck(markerFoundInRuntimeState === false, 'unlock secrets and decrypted provider values do not land in runtime files or persisted session state on disk', { runtimeDir: relative(config, runtimeDir) })
  ];

  let payload = {
    section: 30,
    label: 'section-30-session-unlock',
    generatedAt: new Date().toISOString(),
    strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section30-session-unlock.mjs --strict',
    pass: checks.every(item => item.pass),
    checks,
    evidence: {
      workspaceId: workspace.id,
      sessionId: session.id,
      unlockState,
      lockedProjection: {
        requiresUnlock: lockedProjection.requiresUnlock,
        missingUnlockCount: lockedProjection.missingUnlock.length
      },
      unlockedProjection: {
        envKeys: unlockedProjection.envKeys,
        projections: unlockedProjection.projections
      },
      relockedProjection: {
        requiresUnlock: relockedProjection.requiresUnlock,
        missingUnlockCount: relockedProjection.missingUnlock.length
      }
    }
  };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section30-session-unlock.mjs');
  if (strict && !payload.pass) {
    throw new Error('Section 30 session unlock proof failed in strict mode.');
  }
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
