import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptProviderConfig, encryptProviderConfig, isEncryptedConfig, maskSensitiveConfig } from '../src/lib/secure-config.js';

test('provider config encrypts at rest and masks public views', async () => {
  const env = { SESSION_SECRET: 'unit-secret' };
  const encrypted = await encryptProviderConfig(env, { accountId: 'acct_1', secretKey: 'sk_test_1234567890' });
  assert.equal(isEncryptedConfig(encrypted), true);
  assert.equal(encrypted.ciphertext.includes('sk_test'), false);
  const decrypted = await decryptProviderConfig(env, encrypted);
  assert.equal(decrypted.secretKey, 'sk_test_1234567890');
  assert.equal(maskSensitiveConfig(decrypted).secretKey, 'sk_t…7890');
});
