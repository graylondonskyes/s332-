import fs from 'node:fs';
import path from 'node:path';

import { writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureProviderVaultStore, getProviderProfile, getProviderVaultPath, listProviderProfiles, saveProviderProfile } from '../lib/provider-vault.mjs';
import { listAuditEvents, listGovernanceSecrets, upsertGovernanceSecret } from '../lib/governance-manager.mjs';
import { listGovernanceSecretMigrationCandidates, markGovernanceSecretsFounderManaged, migrateGovernanceSecretScopeToProviderProfile } from '../lib/provider-governance-lane.mjs';
import { buildProviderProofConfig, assertCheck, relative } from './provider-proof-helpers.mjs';

async function main() {
  const strict = process.argv.includes('--strict');
  const config = buildProviderProofConfig('workspace-proof-section29-provider-vault.mjs');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_29_PROVIDER_VAULT.json');
  const tenantId = `section29-${Date.now()}`;
  const profileId = `section29-neon-${Date.now()}`;
  const unlockSecret = 'section29-unlock-passphrase';
  const rawMarker = `S29_RAW_SECRET_${Date.now()}`;
  const legacyScope = `provider:cloudflare:legacy-${Date.now()}`;
  const legacyMigrationSecret = `${rawMarker}_LEGACY_CF_TOKEN_LONG`;

  ensureProviderVaultStore(config);
  const saved = saveProviderProfile(config, {
    profileId,
    tenantId,
    provider: 'neon',
    alias: 'Section 29 Neon Vault',
    description: 'Provider vault proof profile',
    unlockSecret,
    source: 'section29-proof',
    actorType: 'proof',
    actorId: 'section29-proof',
    scopesSummary: ['database', 'storage'],
    secretPayload: {
      projectId: 'section29-project',
      databaseName: 'section29_db',
      databaseUrl: `postgresql://section29:${rawMarker}@db.example.com:5432/section29`
    }
  });
  upsertGovernanceSecret(config, {
    tenantId,
    scope: legacyScope,
    key: 'apiToken',
    value: legacyMigrationSecret,
    description: 'legacy cloudflare token for migration proof',
    actorType: 'proof',
    actorId: 'section29-proof',
    source: 'section29-proof'
  });
  upsertGovernanceSecret(config, {
    tenantId,
    scope: legacyScope,
    key: 'accountId',
    value: 'section29-founder-account-12345',
    description: 'legacy cloudflare account for migration proof',
    actorType: 'proof',
    actorId: 'section29-proof',
    source: 'section29-proof'
  });

  const founderMarked = markGovernanceSecretsFounderManaged(config, {
    tenantId,
    scope: legacyScope,
    actorType: 'proof',
    actorId: 'section29-proof'
  });
  const migrationCandidates = listGovernanceSecretMigrationCandidates(config, { tenantId, includeValues: true });
  const safeMigrationCandidates = listGovernanceSecretMigrationCandidates(config, { tenantId, includeValues: false });
  const migrated = migrateGovernanceSecretScopeToProviderProfile(config, {
    tenantId,
    scope: legacyScope,
    alias: 'Section 29 Migrated Cloudflare',
    unlockSecret: 'section29-migration-unlock',
    stripSourceValues: true,
    actorType: 'proof',
    actorId: 'section29-proof'
  });

  const listed = listProviderProfiles(config, { tenantId });
  const detail = getProviderProfile(config, profileId, { tenantId });
  const migratedProfile = getProviderProfile(config, migrated.profile.profileId, { tenantId });
  const vaultPath = getProviderVaultPath(config);
  const vaultText = fs.readFileSync(vaultPath, 'utf8');
  const audit = listAuditEvents(config, { tenantId, limit: 100 });
  const relevantAudit = (audit.events || []).filter(event => event.detail?.profileId === profileId || event.detail?.migrationTargetProfileId === migrated.profile.profileId || event.detail?.scope === legacyScope);
  const governanceSecretsPath = path.join(config.rootDir, '.skyequanta', 'governance-secrets.json');
  const governanceSecretsText = fs.existsSync(governanceSecretsPath) ? fs.readFileSync(governanceSecretsPath, 'utf8') : '';
  const migrationLogPath = path.join(config.rootDir, '.skyequanta', 'governance-secret-migration.json');
  const migrationLogText = fs.existsSync(migrationLogPath) ? fs.readFileSync(migrationLogPath, 'utf8') : '';
  const governanceSecrets = listGovernanceSecrets(config, { tenantId, scope: legacyScope, includeValue: true }).secrets || [];
  const safeApiText = JSON.stringify({ listed, detail, migratedProfile, safeMigrationCandidates });

  const checks = [
    assertCheck(saved.saved === true && saved.profile.profileId === profileId, 'provider vault can save a sovereign provider profile and return only safe metadata', { profileId: saved.profile.profileId, provider: saved.profile.provider }),
    assertCheck(detail?.vault?.encryptedAtRest === true && detail?.vault?.ciphertextPresent === true, 'provider profile detail reports ciphertext-at-rest posture instead of plaintext storage', detail?.vault),
    assertCheck(vaultText.includes('"ciphertext"') && !vaultText.includes(rawMarker) && !vaultText.includes(legacyMigrationSecret), 'on-disk provider vault store contains ciphertext envelopes and omits raw credential values', { providerVaultPath: relative(config, vaultPath) }),
    assertCheck(!safeApiText.includes(rawMarker) && !safeApiText.includes(legacyMigrationSecret) && !safeApiText.includes('authTag') && !safeApiText.includes('salt') && !safeApiText.includes('iv'), 'provider list/get surfaces omit raw provider secret values and never return encrypted payload bodies', { listedCount: listed.total, hasSafeDetail: Boolean(detail), migratedProfileId: migrated.profile.profileId }),
    assertCheck(relevantAudit.length >= 3 && !JSON.stringify(relevantAudit).includes(rawMarker) && !JSON.stringify(relevantAudit).includes(legacyMigrationSecret), 'audit events keep provider and migration metadata while omitting raw provider credential values', { auditCount: relevantAudit.length }),
    assertCheck(founderMarked.updatedCount === 2 && governanceSecrets.every(secret => secret.credentialLane === 'founder-only' && secret.founderManaged === true), 'legacy governance secrets can be left in the founder-only governance lane and are clearly labeled founder-managed', { scope: legacyScope, updatedCount: founderMarked.updatedCount }),
    assertCheck(migrationCandidates.total >= 1 && migrationCandidates.candidates.some(candidate => candidate.scope === legacyScope && candidate.provider === 'cloudflare' && candidate.validation.ok === true), 'legacy governance secrets surface as explicit migration candidates before provider-vault migration', { candidateScopes: migrationCandidates.candidates.map(candidate => candidate.scope) }),
    assertCheck(migrated.ok === true && Boolean(migratedProfile) && governanceSecrets.every(secret => secret.migrationStatus === 'migrated_to_provider_vault' && secret.migrationTargetProfileId === migrated.profile.profileId && secret.value === '[MIGRATED_TO_PROVIDER_VAULT]'), 'legacy governance secrets can be explicitly migrated into encrypted user-owned provider profiles with source values archived out of the founder lane', { migratedProfileId: migrated.profile.profileId, scope: legacyScope }),
    assertCheck(migrationLogText.includes('migrate_to_provider_vault') && migrationLogText.includes('mark_founder_lane') && !migrationLogText.includes(legacyMigrationSecret), 'governance-secret migration log records founder-lane marking and provider-vault migration without leaking raw values', { migrationLogPath: relative(config, migrationLogPath) }),
    assertCheck(!governanceSecretsText.includes(rawMarker) && !governanceSecretsText.includes(legacyMigrationSecret), 'provider vault writes and legacy-secret migration do not leave raw values behind in the governance secret lane', { governanceSecretsPath: relative(config, governanceSecretsPath) })
  ];

  let payload = {
    section: 29,
    label: 'section-29-provider-vault',
    generatedAt: new Date().toISOString(),
    strict,
    proofCommand: 'node apps/skyequanta-shell/bin/workspace-proof-section29-provider-vault.mjs --strict',
    pass: checks.every(item => item.pass),
    checks,
    evidence: {
      tenantId,
      profileId,
      migratedProfileId: migrated.profile.profileId,
      providerVaultPath: relative(config, vaultPath),
      governanceSecretsPath: relative(config, governanceSecretsPath),
      migrationLogPath: relative(config, migrationLogPath),
      listedCount: listed.total,
      auditCount: relevantAudit.length,
      profile: detail,
      migratedProfile,
      governanceSecretScope: legacyScope
    }
  };
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section29-provider-vault.mjs');
  if (strict && !payload.pass) {
    throw new Error('Section 29 provider vault proof failed in strict mode.');
  }
  console.log(JSON.stringify(payload, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
