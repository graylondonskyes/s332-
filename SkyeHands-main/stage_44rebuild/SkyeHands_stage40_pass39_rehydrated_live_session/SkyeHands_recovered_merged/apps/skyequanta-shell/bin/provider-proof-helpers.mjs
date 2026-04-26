import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { createWorkspace, deleteWorkspace, getWorkspace, listWorkspaces, startWorkspace } from '../lib/workspace-manager.mjs';
import { openSession } from '../lib/session-manager.mjs';
import { loadGovernancePolicy, updateGovernancePolicy } from '../lib/governance-manager.mjs';

export function assertCheck(pass, message, detail = null) {
  return { pass: Boolean(pass), message, detail };
}

export function buildProviderProofConfig(scriptName) {
  const baseConfig = getStackConfig();
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, scriptName);
  return config;
}

export function authHeaders(token, tenantId = 'local') {
  return {
    authorization: `Bearer ${token}`,
    'x-skyequanta-tenant-id': tenantId,
    'content-type': 'application/json'
  };
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return {
    ok: response.ok,
    status: response.status,
    json,
    text
  };
}

export async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  return {
    ok: response.ok,
    status: response.status,
    text: await response.text()
  };
}

export function operatorStart(config, workspaceId, bridgePort) {
  const result = spawnSync(process.execPath, ['./skyequanta.mjs', 'operator:start', '--workspace', workspaceId, '--json'], {
    cwd: config.rootDir,
    encoding: 'utf8',
    env: {
      ...process.env,
      SKYEQUANTA_BRIDGE_PORT: String(bridgePort)
    }
  });
  const payload = JSON.parse(result.stdout || '{}');
  return {
    result,
    payload
  };
}

export async function ensureProofWorkspace(config, workspaceId, options = {}) {
  const policy = loadGovernancePolicy(config);
  const workspaceCount = listWorkspaces(config).count;
  const requiredMax = Math.max(policy?.limits?.maxWorkspaces || 16, workspaceCount + 4);
  if ((policy?.limits?.maxWorkspaces || 16) < requiredMax) {
    updateGovernancePolicy(config, {
      limits: {
        ...(policy?.limits || {}),
        maxWorkspaces: requiredMax
      },
      actorType: 'proof',
      actorId: 'provider-proof-helpers'
    });
  }

  if (getWorkspace(config, workspaceId)) {
    await deleteWorkspace(config, workspaceId, { deletedBy: `${options.source || 'provider-proof'}-reset` });
  }
  createWorkspace(config, workspaceId, {
    name: options.name || workspaceId,
    source: options.source || 'provider-proof',
    force: true,
    tenantId: options.tenantId || 'local',
    secretScope: options.secretScope || 'user-owned-provider',
    machineProfile: options.machineProfile || 'standard'
  });
  await startWorkspace(config, workspaceId, `${options.source || 'provider-proof'}-start`);
  const workspace = getWorkspace(config, workspaceId);
  const session = openSession(config, {
    workspaceId,
    tenantId: options.tenantId || 'local',
    clientName: options.clientName || `${workspaceId}-client`,
    authSource: 'provider-proof-session'
  });
  return { workspace, session };
}

export function searchPathForMarker(targetPath, marker) {
  if (!marker || !fs.existsSync(targetPath)) {
    return false;
  }

  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath)) {
      if (searchPathForMarker(path.join(targetPath, entry), marker)) {
        return true;
      }
    }
    return false;
  }

  try {
    return fs.readFileSync(targetPath, 'utf8').includes(marker);
  } catch {
    return false;
  }
}

export function relative(config, filePath) {
  return path.relative(config.rootDir, filePath);
}
