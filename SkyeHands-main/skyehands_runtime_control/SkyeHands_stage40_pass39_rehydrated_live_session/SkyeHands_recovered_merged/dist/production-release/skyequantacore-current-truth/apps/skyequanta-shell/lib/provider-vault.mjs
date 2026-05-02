import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildProviderAccountHints,
  inferProviderCapabilities,
  normalizeProvider,
  testProviderConnection,
  validateProviderPayload
} from './provider-connectors.mjs';
import { appendAuditEvent } from './governance-manager.mjs';

function nowIso() {
  return new Date().toISOString();
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function normalizeTenantId(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || 'local';
}

function readString(value) {
  return String(value ?? '').trim();
}

function readInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return parsed;
}

function nowMs() {
  return Date.now();
}

export function getProviderVaultPath(config) {
  return path.join(config.rootDir, '.skyequanta', 'provider-vault.json');
}

export function getProviderVaultLockoutPath(config) {
  return path.join(config.rootDir, '.skyequanta', 'provider-vault-lockout.json');
}

export function getProviderVaultPolicy(config) {
  return {
    minUnlockSecretLength: readInteger(process.env.SKYEQUANTA_PROVIDER_UNLOCK_SECRET_MIN_LENGTH, 16),
    minUnlockSecretClasses: readInteger(process.env.SKYEQUANTA_PROVIDER_UNLOCK_SECRET_MIN_CLASSES, 3),
    minUniqueCharacters: readInteger(process.env.SKYEQUANTA_PROVIDER_UNLOCK_SECRET_MIN_UNIQUE, 10),
    maxFailedUnlockAttempts: readInteger(process.env.SKYEQUANTA_PROVIDER_UNLOCK_MAX_FAILURES, 5),
    lockoutMs: readInteger(process.env.SKYEQUANTA_PROVIDER_UNLOCK_LOCKOUT_MS, 15 * 60 * 1000),
    failureWindowMs: readInteger(process.env.SKYEQUANTA_PROVIDER_UNLOCK_FAILURE_WINDOW_MS, 15 * 60 * 1000)
  };
}

function classifyUnlockSecret(secret) {
  const value = readString(secret);
  const classes = {
    lowercase: /[a-z]/.test(value),
    uppercase: /[A-Z]/.test(value),
    digit: /\d/.test(value),
    symbol: /[^A-Za-z0-9]/.test(value)
  };
  return {
    length: value.length,
    classes,
    classCount: Object.values(classes).filter(Boolean).length,
    uniqueCharacters: new Set(value.split('')).size
  };
}

export function validateUnlockSecretStrength(config, unlockSecret) {
  const policy = getProviderVaultPolicy(config);
  const metrics = classifyUnlockSecret(unlockSecret);
  const errors = [];
  if (metrics.length < policy.minUnlockSecretLength) {
    errors.push(`unlockSecret must be at least ${policy.minUnlockSecretLength} characters long.`);
  }
  if (metrics.classCount < policy.minUnlockSecretClasses) {
    errors.push(`unlockSecret must include at least ${policy.minUnlockSecretClasses} character classes (uppercase, lowercase, digits, symbols).`);
  }
  if (metrics.uniqueCharacters < policy.minUniqueCharacters) {
    errors.push(`unlockSecret must contain at least ${policy.minUniqueCharacters} unique characters.`);
  }
  return {
    ok: errors.length === 0,
    policy,
    metrics,
    errors
  };
}

function enforceUnlockSecretStrength(config, unlockSecret) {
  const validation = validateUnlockSecretStrength(config, unlockSecret);
  if (!validation.ok) {
    throw new Error(`Unlock secret policy failed: ${validation.errors.join(' ')}`.trim());
  }
  return validation;
}

function deriveEnvelopeKey(unlockSecret, salt) {
  const secret = readString(unlockSecret);
  if (!secret) {
    throw new Error('unlockSecret is required for sovereign provider storage.');
  }
  return crypto.pbkdf2Sync(secret, Buffer.from(salt, 'hex'), 210000, 32, 'sha256');
}

function encryptProviderPayload(payload, unlockSecret) {
  const salt = crypto.randomBytes(16).toString('hex');
  const iv = crypto.randomBytes(12).toString('hex');
  const key = deriveEnvelopeKey(unlockSecret, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  const plaintext = JSON.stringify(payload || {});
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    algorithm: 'aes-256-gcm',
    kdf: 'pbkdf2-sha256',
    iterations: 210000,
    salt,
    iv,
    authTag: authTag.toString('hex'),
    ciphertext: ciphertext.toString('hex')
  };
}

function decryptEnvelope(envelope, unlockSecret) {
  const key = deriveEnvelopeKey(unlockSecret, envelope.salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'hex')),
    decipher.final()
  ]).toString('utf8');
  return JSON.parse(plaintext);
}

function normalizeProfileRecord(record = {}) {
  return {
    profileId: readString(record.profileId || crypto.randomUUID()),
    tenantId: normalizeTenantId(record.tenantId),
    provider: normalizeProvider(record.provider || 'env_bundle'),
    alias: readString(record.alias || record.provider || 'provider-profile') || 'provider-profile',
    description: readString(record.description) || null,
    scopesSummary: Array.isArray(record.scopesSummary)
      ? [...new Set(record.scopesSummary.map(item => readString(item)).filter(Boolean))]
      : [],
    capabilities: Array.isArray(record.capabilities)
      ? [...new Set(record.capabilities.map(item => readString(item).toLowerCase()).filter(Boolean))]
      : [],
    accountHints: record.accountHints && typeof record.accountHints === 'object' ? record.accountHints : {},
    createdAt: readString(record.createdAt || nowIso()),
    updatedAt: readString(record.updatedAt || nowIso()),
    lastVerifiedAt: readString(record.lastVerifiedAt) || null,
    source: readString(record.source || 'provider-vault') || 'provider-vault',
    envelope: record.envelope && typeof record.envelope === 'object' ? {
      algorithm: readString(record.envelope.algorithm || 'aes-256-gcm'),
      kdf: readString(record.envelope.kdf || 'pbkdf2-sha256'),
      iterations: Number.parseInt(String(record.envelope.iterations || 210000), 10) || 210000,
      salt: readString(record.envelope.salt),
      iv: readString(record.envelope.iv),
      authTag: readString(record.envelope.authTag),
      ciphertext: readString(record.envelope.ciphertext)
    } : null
  };
}

function loadVaultStore(config) {
  const parsed = readJson(getProviderVaultPath(config), { version: 1, profiles: [] });
  return {
    version: 1,
    profiles: Array.isArray(parsed?.profiles) ? parsed.profiles.map(normalizeProfileRecord) : []
  };
}

function saveVaultStore(config, store) {
  writeJson(getProviderVaultPath(config), {
    version: 1,
    profiles: Array.isArray(store?.profiles) ? store.profiles.map(normalizeProfileRecord) : []
  });
}

function emptyLockoutStore() {
  return {
    version: 1,
    attempts: {}
  };
}

function profileLockKey(profileId, tenantId) {
  return `${normalizeTenantId(tenantId)}:${readString(profileId)}`;
}

function loadLockoutStore(config) {
  const store = readJson(getProviderVaultLockoutPath(config), emptyLockoutStore());
  return {
    version: 1,
    attempts: store && typeof store.attempts === 'object' ? store.attempts : {}
  };
}

function saveLockoutStore(config, store) {
  writeJson(getProviderVaultLockoutPath(config), {
    version: 1,
    attempts: store && typeof store.attempts === 'object' ? store.attempts : {}
  });
}

function pruneLockoutStore(config, store) {
  const now = nowMs();
  const policy = getProviderVaultPolicy(config);
  const attempts = {};
  for (const [key, entry] of Object.entries(store?.attempts || {})) {
    const failures = Array.isArray(entry?.failures)
      ? entry.failures
          .map(item => Number.parseInt(String(item || 0), 10))
          .filter(value => Number.isInteger(value) && (now - value) <= policy.failureWindowMs)
      : [];
    const lockedUntilMs = Number.parseInt(String(entry?.lockedUntilMs || 0), 10) || 0;
    if (failures.length || lockedUntilMs > now) {
      attempts[key] = {
        failures,
        lockedUntilMs,
        lockedUntil: lockedUntilMs > 0 ? new Date(lockedUntilMs).toISOString() : null,
        updatedAt: readString(entry?.updatedAt || nowIso()) || nowIso()
      };
    }
  }
  return { version: 1, attempts };
}

function getLockoutState(config, profileId, tenantId) {
  const store = pruneLockoutStore(config, loadLockoutStore(config));
  saveLockoutStore(config, store);
  const key = profileLockKey(profileId, tenantId);
  const entry = store.attempts[key] || null;
  const now = nowMs();
  return {
    key,
    failures: Array.isArray(entry?.failures) ? entry.failures.length : 0,
    locked: Boolean((entry?.lockedUntilMs || 0) > now),
    lockedUntilMs: entry?.lockedUntilMs || 0,
    lockedUntil: entry?.lockedUntil || null
  };
}

function assertUnlockAllowed(config, profileId, tenantId) {
  const state = getLockoutState(config, profileId, tenantId);
  if (state.locked) {
    throw new Error(`Provider vault unlock is temporarily locked for profile '${profileId}' until ${state.lockedUntil}.`);
  }
  return state;
}

function recordFailedUnlockAttempt(config, profileId, tenantId) {
  const policy = getProviderVaultPolicy(config);
  const store = pruneLockoutStore(config, loadLockoutStore(config));
  const key = profileLockKey(profileId, tenantId);
  const entry = store.attempts[key] || { failures: [], lockedUntilMs: 0, lockedUntil: null, updatedAt: nowIso() };
  const nextFailures = [...(Array.isArray(entry.failures) ? entry.failures : []), nowMs()]
    .filter(value => Number.isInteger(value) && (nowMs() - value) <= policy.failureWindowMs);
  let lockedUntilMs = Number.parseInt(String(entry.lockedUntilMs || 0), 10) || 0;
  if (nextFailures.length >= policy.maxFailedUnlockAttempts) {
    lockedUntilMs = nowMs() + policy.lockoutMs;
  }
  store.attempts[key] = {
    failures: nextFailures,
    lockedUntilMs,
    lockedUntil: lockedUntilMs > 0 ? new Date(lockedUntilMs).toISOString() : null,
    updatedAt: nowIso()
  };
  saveLockoutStore(config, store);
  return getLockoutState(config, profileId, tenantId);
}

function clearFailedUnlockAttempts(config, profileId, tenantId) {
  const store = pruneLockoutStore(config, loadLockoutStore(config));
  const key = profileLockKey(profileId, tenantId);
  if (store.attempts[key]) {
    delete store.attempts[key];
    saveLockoutStore(config, store);
  }
}

export function ensureProviderVaultStore(config) {
  const store = loadVaultStore(config);
  saveVaultStore(config, store);
  saveLockoutStore(config, pruneLockoutStore(config, loadLockoutStore(config)));
  return {
    providerVaultPath: getProviderVaultPath(config),
    providerVaultLockoutPath: getProviderVaultLockoutPath(config),
    policy: getProviderVaultPolicy(config)
  };
}

export function toSafeProviderProfile(profile) {
  const normalized = normalizeProfileRecord(profile);
  return {
    profileId: normalized.profileId,
    tenantId: normalized.tenantId,
    provider: normalized.provider,
    alias: normalized.alias,
    description: normalized.description,
    scopesSummary: normalized.scopesSummary,
    capabilities: normalized.capabilities,
    accountHints: normalized.accountHints,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    lastVerifiedAt: normalized.lastVerifiedAt,
    source: normalized.source,
    vault: {
      encryptedAtRest: true,
      envelopeAlgorithm: normalized.envelope?.algorithm || null,
      kdf: normalized.envelope?.kdf || null,
      ciphertextPresent: Boolean(normalized.envelope?.ciphertext)
    }
  };
}

export function listProviderProfiles(config, options = {}) {
  const tenantId = options.tenantId ? normalizeTenantId(options.tenantId) : null;
  const provider = readString(options.provider).toLowerCase();
  const profiles = loadVaultStore(config).profiles
    .filter(profile => {
      if (tenantId && profile.tenantId !== tenantId) return false;
      if (provider && profile.provider !== provider) return false;
      return true;
    })
    .sort((a, b) => a.alias.localeCompare(b.alias) || a.provider.localeCompare(b.provider))
    .map(profile => ({
      ...toSafeProviderProfile(profile),
      unlockPolicy: {
        ...getProviderVaultPolicy(config),
        lockout: getLockoutState(config, profile.profileId, profile.tenantId)
      }
    }));
  return {
    total: profiles.length,
    profiles
  };
}

export function getProviderProfile(config, profileId, options = {}) {
  const id = readString(profileId);
  const tenantId = options.tenantId ? normalizeTenantId(options.tenantId) : null;
  const profile = loadVaultStore(config).profiles.find(item => item.profileId === id);
  if (!profile) {
    return null;
  }
  if (tenantId && profile.tenantId !== tenantId) {
    return null;
  }
  return {
    ...toSafeProviderProfile(profile),
    unlockPolicy: {
      ...getProviderVaultPolicy(config),
      lockout: getLockoutState(config, profile.profileId, profile.tenantId)
    }
  };
}

export function resolveProviderProfileRecord(config, profileId, options = {}) {
  const id = readString(profileId);
  const tenantId = options.tenantId ? normalizeTenantId(options.tenantId) : null;
  const profile = loadVaultStore(config).profiles.find(item => item.profileId === id);
  if (!profile) {
    return null;
  }
  if (tenantId && profile.tenantId !== tenantId) {
    return null;
  }
  return normalizeProfileRecord(profile);
}

export function saveProviderProfile(config, options = {}) {
  const tenantId = normalizeTenantId(options.tenantId);
  const provider = normalizeProvider(options.provider);
  const alias = readString(options.alias || `${provider}-profile`) || `${provider}-profile`;
  const unlockSecret = readString(options.unlockSecret);
  const providedSecretPayload = options.secretPayload && typeof options.secretPayload === 'object' ? options.secretPayload : null;
  const store = loadVaultStore(config);
  const existingIndex = store.profiles.findIndex(profile => profile.profileId === readString(options.profileId));
  const existing = existingIndex >= 0 ? store.profiles[existingIndex] : null;
  const secretPayload = providedSecretPayload;
  if (!existing && !secretPayload) {
    throw new Error('secretPayload is required to save a provider profile.');
  }
  if (secretPayload) {
    const validation = validateProviderPayload(provider, secretPayload);
    if (!validation.ok) {
      throw new Error(`Provider payload validation failed: ${validation.errors.join(' ')}`.trim());
    }
    enforceUnlockSecretStrength(config, unlockSecret);
  }

  const capabilities = Array.isArray(options.capabilities) && options.capabilities.length
    ? [...new Set(options.capabilities.map(item => readString(item).toLowerCase()).filter(Boolean))]
    : secretPayload
      ? inferProviderCapabilities(provider, secretPayload)
      : existing?.capabilities || [];
  const accountHints = secretPayload ? buildProviderAccountHints(provider, secretPayload) : existing?.accountHints || {};
  const next = normalizeProfileRecord({
    ...(existing || {}),
    profileId: existing?.profileId || readString(options.profileId || crypto.randomUUID()),
    tenantId,
    provider,
    alias,
    description: Object.prototype.hasOwnProperty.call(options, 'description') ? options.description : existing?.description,
    scopesSummary: Array.isArray(options.scopesSummary) ? options.scopesSummary : existing?.scopesSummary || [],
    capabilities,
    accountHints,
    source: readString(options.source || existing?.source || 'provider-vault') || 'provider-vault',
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
    envelope: secretPayload ? encryptProviderPayload(secretPayload, unlockSecret) : existing?.envelope || null
  });

  if (existingIndex >= 0) {
    store.profiles[existingIndex] = next;
  } else {
    store.profiles.push(next);
  }
  saveVaultStore(config, store);
  clearFailedUnlockAttempts(config, next.profileId, tenantId);

  appendAuditEvent(config, {
    action: 'provider.profile.save',
    actorType: readString(options.actorType || 'operator') || 'operator',
    actorId: readString(options.actorId || 'provider-vault') || 'provider-vault',
    tenantId,
    workspaceId: readString(options.workspaceId) || null,
    detail: {
      profileId: next.profileId,
      provider,
      alias,
      capabilities,
      scopesSummary: next.scopesSummary,
      accountHints,
      unlockPolicy: getProviderVaultPolicy(config)
    }
  });

  return {
    saved: true,
    profile: {
      ...toSafeProviderProfile(next),
      unlockPolicy: {
        ...getProviderVaultPolicy(config),
        lockout: getLockoutState(config, next.profileId, tenantId)
      }
    }
  };
}

export function deleteProviderProfile(config, options = {}) {
  const profileId = readString(options.profileId);
  const tenantId = options.tenantId ? normalizeTenantId(options.tenantId) : null;
  if (!profileId) {
    throw new Error('profileId is required to delete a provider profile.');
  }
  const store = loadVaultStore(config);
  const index = store.profiles.findIndex(item => item.profileId === profileId && (!tenantId || item.tenantId === tenantId));
  if (index === -1) {
    throw new Error(`Provider profile '${profileId}' was not found.`);
  }
  const [removed] = store.profiles.splice(index, 1);
  saveVaultStore(config, store);
  clearFailedUnlockAttempts(config, removed.profileId, removed.tenantId);
  appendAuditEvent(config, {
    action: 'provider.profile.delete',
    actorType: readString(options.actorType || 'operator') || 'operator',
    actorId: readString(options.actorId || 'provider-vault') || 'provider-vault',
    tenantId: removed.tenantId,
    workspaceId: readString(options.workspaceId) || null,
    detail: {
      profileId: removed.profileId,
      provider: removed.provider,
      alias: removed.alias
    }
  });
  return {
    ok: true,
    profile: toSafeProviderProfile(removed)
  };
}

export function decryptProviderProfile(config, options = {}) {
  const profile = resolveProviderProfileRecord(config, options.profileId, { tenantId: options.tenantId });
  if (!profile) {
    throw new Error(`Provider profile '${options.profileId}' was not found.`);
  }
  if (!profile.envelope?.ciphertext) {
    throw new Error(`Provider profile '${options.profileId}' does not contain an encrypted envelope.`);
  }
  assertUnlockAllowed(config, profile.profileId, profile.tenantId);
  try {
    const payload = decryptEnvelope(profile.envelope, options.unlockSecret);
    clearFailedUnlockAttempts(config, profile.profileId, profile.tenantId);
    return {
      profile,
      payload
    };
  } catch {
    const lockout = recordFailedUnlockAttempt(config, profile.profileId, profile.tenantId);
    throw new Error(
      lockout.locked
        ? `Invalid unlock secret. Provider vault temporarily locked until ${lockout.lockedUntil}.`
        : 'Invalid unlock secret or tampered provider envelope.'
    );
  }
}

export function rotateProviderProfileUnlockSecret(config, options = {}) {
  const profileId = readString(options.profileId);
  if (!profileId) {
    throw new Error('profileId is required to rotate a provider unlock secret.');
  }
  const profile = resolveProviderProfileRecord(config, profileId, { tenantId: options.tenantId });
  if (!profile) {
    throw new Error(`Provider profile '${profileId}' was not found.`);
  }
  const oldUnlockSecret = readString(options.oldUnlockSecret);
  const newUnlockSecret = readString(options.newUnlockSecret);
  if (!oldUnlockSecret) {
    throw new Error('oldUnlockSecret is required to rotate a provider unlock secret.');
  }
  enforceUnlockSecretStrength(config, newUnlockSecret);
  const { payload } = decryptProviderProfile(config, {
    profileId,
    tenantId: profile.tenantId,
    unlockSecret: oldUnlockSecret
  });
  const store = loadVaultStore(config);
  const index = store.profiles.findIndex(item => item.profileId === profileId && item.tenantId === profile.tenantId);
  if (index === -1) {
    throw new Error(`Provider profile '${profileId}' was not found during rotation.`);
  }
  const next = normalizeProfileRecord({
    ...store.profiles[index],
    envelope: encryptProviderPayload(payload, newUnlockSecret),
    updatedAt: nowIso()
  });
  store.profiles[index] = next;
  saveVaultStore(config, store);
  clearFailedUnlockAttempts(config, profileId, profile.tenantId);
  appendAuditEvent(config, {
    action: 'provider.profile.rotate_unlock_secret',
    actorType: readString(options.actorType || 'operator') || 'operator',
    actorId: readString(options.actorId || 'provider-vault') || 'provider-vault',
    tenantId: profile.tenantId,
    workspaceId: readString(options.workspaceId) || null,
    detail: {
      profileId: next.profileId,
      provider: next.provider,
      alias: next.alias,
      rotatedAt: next.updatedAt
    }
  });
  return {
    ok: true,
    rotated: true,
    profile: {
      ...toSafeProviderProfile(next),
      unlockPolicy: {
        ...getProviderVaultPolicy(config),
        lockout: getLockoutState(config, next.profileId, next.tenantId)
      }
    }
  };
}

export function markProviderProfileVerified(config, options = {}) {
  const store = loadVaultStore(config);
  const index = store.profiles.findIndex(item => item.profileId === readString(options.profileId));
  if (index === -1) {
    return null;
  }
  store.profiles[index] = normalizeProfileRecord({
    ...store.profiles[index],
    lastVerifiedAt: nowIso(),
    updatedAt: nowIso()
  });
  saveVaultStore(config, store);
  return toSafeProviderProfile(store.profiles[index]);
}

export async function testDecryptedProviderProfile(config, options = {}) {
  const { profile, payload } = decryptProviderProfile(config, options);
  const result = await testProviderConnection(profile, payload, options);
  if (result.ok) {
    markProviderProfileVerified(config, { profileId: profile.profileId });
  }
  appendAuditEvent(config, {
    action: 'provider.profile.test',
    actorType: readString(options.actorType || 'operator') || 'operator',
    actorId: readString(options.actorId || 'provider-vault-test') || 'provider-vault-test',
    tenantId: profile.tenantId,
    workspaceId: readString(options.workspaceId) || null,
    detail: {
      profileId: profile.profileId,
      provider: profile.provider,
      alias: profile.alias,
      ok: result.ok,
      projectedEnvKeys: result.projectedEnvKeys,
      capabilities: result.capabilities,
      accountHints: result.accountHints
    }
  });
  return {
    profile: toSafeProviderProfile(profile),
    result
  };
}
