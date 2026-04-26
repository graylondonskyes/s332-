import test from 'node:test';
import assert from 'node:assert/strict';
import { hashMerchantPassword, verifyMerchantPassword, legacyMerchantPasswordHash, hashCustomerPassword, verifyCustomerPassword, legacyCustomerPasswordHash } from '../src/lib/passwords.js';

test('PBKDF2 password hardening verifies merchant and customer hashes with legacy fallback', async () => {
  const merchantModern = await hashMerchantPassword('OWNER@Example.COM', 'correct horse');
  assert.match(merchantModern, /^pbkdf2_sha256\$/);
  assert.equal(await verifyMerchantPassword('owner@example.com', 'correct horse', merchantModern), true);
  assert.equal(await verifyMerchantPassword('owner@example.com', 'wrong', merchantModern), false);
  const merchantLegacy = await legacyMerchantPasswordHash('owner@example.com', 'correct horse');
  assert.equal(await verifyMerchantPassword('owner@example.com', 'correct horse', merchantLegacy), true);

  const customerModern = await hashCustomerPassword('m1', 'BUYER@Example.COM', 'cart-pass');
  assert.match(customerModern, /^pbkdf2_sha256\$/);
  assert.equal(await verifyCustomerPassword('m1', 'buyer@example.com', 'cart-pass', customerModern), true);
  assert.equal(await verifyCustomerPassword('m1', 'buyer@example.com', 'bad', customerModern), false);
  const customerLegacy = await legacyCustomerPasswordHash('m1', 'buyer@example.com', 'cart-pass');
  assert.equal(await verifyCustomerPassword('m1', 'buyer@example.com', 'cart-pass', customerLegacy), true);
});
