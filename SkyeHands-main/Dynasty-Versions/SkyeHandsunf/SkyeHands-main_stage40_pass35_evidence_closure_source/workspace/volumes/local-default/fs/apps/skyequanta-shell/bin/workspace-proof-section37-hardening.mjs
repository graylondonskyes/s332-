#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

import { getStackConfig } from './config.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { appendAuditEvent, ensureGovernanceStores, verifyAuditChain } from '../lib/governance-manager.mjs';
import { createWorkspace, deleteWorkspace, getWorkspace } from '../lib/workspace-manager.mjs';
import { getWorkspaceSandboxPaths } from '../lib/workspace-runtime.mjs';
import { inspectWorkspacePath, readWorkspaceContent } from '../lib/file-ergonomics.mjs';
import {
  deleteProviderProfile,
  decryptProviderProfile,
  ensureProviderVaultStore,
  rotateProviderProfileUnlockSecret,
  saveProviderProfile
} from '../lib/provider-vault.mjs';

function parseArgs(argv) {
  return {
    json: argv.includes('--json'),
    strict: argv.includes('--strict')
  };
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function parseJson(stdout) {
  try {
    return JSON.parse(String(stdout || '').trim());
  } catch {
    return null;
  }
}

async function waitForHealth(url, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // retry
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  return false;
}

async function runBridgeHardeningSmoke(config) {
  const bridgePort = 3920;
  const env = {
    ...process.env,
    SKYEQUANTA_BRIDGE_PORT: String(bridgePort),
    SKYEQUANTA_ADMIN_TOKEN: 'section37-admin-token',
    SKYEQUANTA_MAX_JSON_BODY_BYTES: '128',
    SKYEQUANTA_AUTH_FAILURE_THRESHOLD: '2',
    SKYEQUANTA_AUTH_FAILURE_LOCKOUT_MS: '60000',
    SKYEQUANTA_ALLOWED_CONTROL_ORIGINS: `http://127.0.0.1:${bridgePort},http://localhost:${bridgePort}`
  };
  const child = spawn(process.execPath, ['apps/skyequanta-shell/bin/bridge.mjs'], {
    cwd: config.rootDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const stdout = [];
  const stderr = [];
  child.stdout.on('data', chunk => stdout.push(String(chunk)));
  child.stderr.on('data', chunk => stderr.push(String(chunk)));

  try {
    const healthy = await waitForHealth(`http://127.0.0.1:${bridgePort}/health`);
    if (!healthy) {
      throw new Error('bridge did not become healthy for section37 smoke');
    }

    const badOrigin = await fetch(`http://127.0.0.1:${bridgePort}/api/sessions/open`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://evil.example'
      },
      body: JSON.stringify({ workspaceId: 'default' })
    });
    const badOriginPayload = await badOrigin.json();

    const oversizedBody = await fetch(`http://127.0.0.1:${bridgePort}/api/sessions/open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ workspaceId: 'default', filler: 'x'.repeat(400) })
    });
    const oversizedPayload = await oversizedBody.json();

    const auth1 = await fetch(`http://127.0.0.1:${bridgePort}/control-plane`, {
      headers: { authorization: 'Bearer definitely-wrong' }
    });
    const auth2 = await fetch(`http://127.0.0.1:${bridgePort}/control-plane`, {
      headers: { authorization: 'Bearer definitely-wrong' }
    });
    const auth3 = await fetch(`http://127.0.0.1:${bridgePort}/control-plane`, {
      headers: { authorization: 'Bearer definitely-wrong' }
    });
    const auth3Payload = await auth3.json();

    return {
      ok: badOrigin.status === 403 && oversizedBody.status === 413 && auth1.status === 401 && auth2.status === 401 && auth3.status === 429,
      checks: {
        badOrigin: { status: badOrigin.status, payload: badOriginPayload },
        oversizedBody: { status: oversizedBody.status, payload: oversizedPayload },
        auth1: { status: auth1.status },
        auth2: { status: auth2.status },
        auth3: { status: auth3.status, payload: auth3Payload }
      },
      stdoutTail: stdout.join('').split(/\r?\n/).filter(Boolean).slice(-20),
      stderrTail: stderr.join('').split(/\r?\n/).filter(Boolean).slice(-20)
    };
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
  }
}

function runReleaseSanitizeSmoke(config) {
  const outputDir = 'dist/production-release/section37-current-truth';
  const result = spawnSync(process.execPath, ['apps/skyequanta-shell/bin/release-sanitize.mjs', '--json', '--output-dir', outputDir], {
    cwd: config.rootDir,
    env: { ...process.env },
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });
  const payload = parseJson(result.stdout);
  const outputRoot = path.join(config.rootDir, outputDir);
  const bannedPaths = ['.git', '.skyequanta', 'logs', 'docs/proof'];
  const violations = bannedPaths.filter(item => fs.existsSync(path.join(outputRoot, item)));
  return {
    ok: result.status === 0 && Boolean(payload?.ok) && violations.length === 0 && fs.existsSync(path.join(outputRoot, 'docs', 'CURRENT_TRUTH_INDEX.md')),
    commandStatus: result.status,
    payload,
    violations,
    stdoutTail: String(result.stdout || '').split(/\r?\n/).filter(Boolean).slice(-20),
    stderrTail: String(result.stderr || '').split(/\r?\n/).filter(Boolean).slice(-20)
  };
}

function runProviderVaultSmoke(config) {
  ensureProviderVaultStore(config);
  const profileId = 'section37-provider-vault';
  try {
    deleteProviderProfile(config, { profileId, tenantId: 'local', actorId: 'section37-cleanup' });
  } catch {
    // ignore
  }
  const strongOld = 'Old-Section37-Unlock-Secret-!947';
  const strongNew = 'New-Section37-Unlock-Secret-!958';
  const saved = saveProviderProfile(config, {
    profileId,
    tenantId: 'local',
    provider: 'env_bundle',
    alias: 'section37-vault',
    unlockSecret: strongOld,
    secretPayload: {
      bundleName: 'section37',
      env: {
        SECTION37_PROVIDER_KEY: 'section37-secret-value'
      }
    },
    actorId: 'section37'
  });

  let fail1 = null;
  let fail2 = null;
  let fail3 = null;
  try { decryptProviderProfile(config, { profileId, tenantId: 'local', unlockSecret: 'wrong-one' }); } catch (error) { fail1 = String(error.message || error); }
  try { decryptProviderProfile(config, { profileId, tenantId: 'local', unlockSecret: 'wrong-two' }); } catch (error) { fail2 = String(error.message || error); }
  try { decryptProviderProfile(config, { profileId, tenantId: 'local', unlockSecret: 'wrong-three' }); } catch (error) { fail3 = String(error.message || error); }

  const waitMs = Number.parseInt(String(process.env.SKYEQUANTA_PROVIDER_UNLOCK_LOCKOUT_MS || '150'), 10) || 150;
  const start = Date.now();
  while (Date.now() - start < waitMs + 50) {
    // wait out short lockout for deterministic rotation smoke
  }

  const rotated = rotateProviderProfileUnlockSecret(config, {
    profileId,
    tenantId: 'local',
    oldUnlockSecret: strongOld,
    newUnlockSecret: strongNew,
    actorId: 'section37'
  });

  let oldSecretRejected = false;
  try {
    decryptProviderProfile(config, { profileId, tenantId: 'local', unlockSecret: strongOld });
  } catch {
    oldSecretRejected = true;
  }
  const decrypted = decryptProviderProfile(config, { profileId, tenantId: 'local', unlockSecret: strongNew });

  return {
    ok: Boolean(saved?.saved) && /Invalid unlock secret/.test(fail1 || '') && /Invalid unlock secret/.test(fail2 || '') && /temporarily locked/.test(fail3 || '') && Boolean(rotated?.ok) && oldSecretRejected && decrypted?.payload?.env?.SECTION37_PROVIDER_KEY === 'section37-secret-value',
    fail1,
    fail2,
    fail3,
    rotated,
    decrypted: { envKeys: Object.keys(decrypted?.payload?.env || {}) }
  };
}

function runAuditChainSmoke(config) {
  ensureGovernanceStores(config);
  const event = appendAuditEvent(config, {
    action: 'section37.audit_probe',
    actorType: 'system',
    actorId: 'section37',
    tenantId: 'local',
    detail: { probe: true }
  });
  const verification = verifyAuditChain(config);
  return {
    ok: Boolean(event?.id) && verification.ok,
    eventId: event?.id || null,
    verification
  };
}

function runFileBoundarySmoke(config) {
  const workspaceId = 'section37-hardening';
  if (!getWorkspace(config, workspaceId)) {
    createWorkspace(config, workspaceId, { source: 'section37', tenantId: 'local' });
  }
  const paths = getWorkspaceSandboxPaths(config, workspaceId);
  const projectDir = path.join(paths.fsDir, 'project');
  ensureDirectory(projectDir);
  fs.writeFileSync(path.join(projectDir, 'safe.txt'), 'hello\n', 'utf8');
  fs.writeFileSync(path.join(projectDir, 'large.txt'), 'x'.repeat(256), 'utf8');
  const outsideTarget = '/etc/hosts';
  const symlinkPath = path.join(projectDir, 'evil-link');
  try { fs.rmSync(symlinkPath, { force: true }); } catch {}
  try { fs.symlinkSync(outsideTarget, symlinkPath); } catch {
    fs.writeFileSync(path.join(projectDir, 'outside.txt'), 'outside\n', 'utf8');
    fs.symlinkSync(path.join(projectDir, 'outside.txt'), symlinkPath);
  }

  let symlinkError = null;
  let largeFileError = null;
  try { inspectWorkspacePath(config, workspaceId, 'evil-link'); } catch (error) { symlinkError = String(error.message || error); }
  try { readWorkspaceContent(config, workspaceId, 'large.txt'); } catch (error) { largeFileError = String(error.message || error); }

  return {
    ok: (/(Symlink access is blocked|escapes workspace root through a symlink)/.test(symlinkError || '')) && /max readable size/.test(largeFileError || ''),
    symlinkError,
    largeFileError
  };
}

async function main() {
  process.env.SKYEQUANTA_PROVIDER_UNLOCK_MAX_FAILURES = process.env.SKYEQUANTA_PROVIDER_UNLOCK_MAX_FAILURES || '2';
  process.env.SKYEQUANTA_PROVIDER_UNLOCK_LOCKOUT_MS = process.env.SKYEQUANTA_PROVIDER_UNLOCK_LOCKOUT_MS || '150';
  process.env.SKYEQUANTA_WORKSPACE_MAX_READ_BYTES = process.env.SKYEQUANTA_WORKSPACE_MAX_READ_BYTES || '64';

  const options = parseArgs(process.argv.slice(2));
  const config = getStackConfig(process.env);
  ensureRuntimeState(config, process.env);

  const auditChain = runAuditChainSmoke(config);
  const providerVault = runProviderVaultSmoke(config);
  const fileBoundary = runFileBoundarySmoke(config);
  const releaseSanitize = runReleaseSanitizeSmoke(config);
  const bridgeHardening = await runBridgeHardeningSmoke(config);

  const checks = [
    { pass: auditChain.ok, message: 'tamper-evident audit chain verifies after a fresh appended event', detail: auditChain },
    { pass: providerVault.ok, message: 'provider vault enforces unlock-secret policy, lockout, and rotation', detail: providerVault },
    { pass: fileBoundary.ok, message: 'workspace file ergonomics blocks symlink breakout and oversized reads', detail: fileBoundary },
    { pass: releaseSanitize.ok, message: 'current-truth sanitized release strips transient and historical residue', detail: releaseSanitize },
    { pass: bridgeHardening.ok, message: 'bridge request hardening enforces origin policy, body limits, and auth lockout', detail: bridgeHardening }
  ];

  const payload = {
    ok: checks.every(item => item.pass),
    label: 'section-37-skeptic-proof-hardening',
    generatedAt: new Date().toISOString(),
    checks
  };
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_37_SKEPTIC_PROOF_HARDENING.json');
  writeJson(proofFile, payload);

  if (options.json) {
    console.log(JSON.stringify({ ...payload, proofFile: path.relative(config.rootDir, proofFile) }, null, 2));
  } else {
    console.log(`section37: ${payload.ok ? 'PASS' : 'FAIL'}`);
    console.log(`proof: ${path.relative(config.rootDir, proofFile)}`);
  }

  if (options.strict && !payload.ok) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
