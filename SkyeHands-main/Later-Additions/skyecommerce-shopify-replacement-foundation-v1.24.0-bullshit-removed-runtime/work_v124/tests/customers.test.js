import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCustomerDisplayName,
  customerRecord,
  normalizeCustomerProfileInput,
  normalizeCustomerRegistrationInput,
  normalizeSavedCartInput
} from '../src/lib/customers.js';

test('normalizeCustomerRegistrationInput sanitizes customer registration payload', () => {
  const normalized = normalizeCustomerRegistrationInput({
    slug: 'delta-store',
    email: ' USER@Example.COM ',
    password: 'secret',
    firstName: ' Delta ',
    marketingOptIn: 'true',
    defaultAddress: { countryCode: 'us', stateCode: 'az' }
  });
  assert.equal(normalized.slug, 'delta-store');
  assert.equal(normalized.email, 'user@example.com');
  assert.equal(normalized.firstName, 'Delta');
  assert.equal(normalized.marketingOptIn, true);
  assert.equal(normalized.defaultAddress.countryCode, 'US');
});

test('normalizeSavedCartInput constrains line quantities and discount code formatting', () => {
  const normalized = normalizeSavedCartInput({
    note: ' VIP reorder ',
    items: [{ productId: 'p1', quantity: 0 }, { productId: 'p2', quantity: 3 }],
    discountCode: 'save10',
    location: { countryCode: 'us', stateCode: 'ny' }
  });
  assert.equal(normalized.note, 'VIP reorder');
  assert.equal(normalized.items[0].quantity, 1);
  assert.equal(normalized.items[1].quantity, 3);
  assert.equal(normalized.discountCode, 'SAVE10');
  assert.equal(normalized.location.stateCode, 'NY');
});

test('customerRecord parses default address and buildCustomerDisplayName prefers names', () => {
  const customer = customerRecord({
    id: 'cus_1',
    merchant_id: 'm1',
    email: 'buyer@example.com',
    first_name: 'Buyer',
    last_name: 'One',
    marketing_opt_in: 1,
    default_address_json: JSON.stringify({ countryCode: 'us', stateCode: 'ca' })
  });
  assert.equal(customer.defaultAddress.countryCode, 'US');
  assert.equal(customer.marketingOptIn, true);
  assert.equal(buildCustomerDisplayName(customer), 'Buyer One');
  assert.equal(buildCustomerDisplayName({ email: 'fallback@example.com' }), 'fallback@example.com');
});

test('normalizeCustomerProfileInput allows raw field object input', () => {
  const profile = normalizeCustomerProfileInput({
    firstName: 'A',
    lastName: 'B',
    countryCode: 'us',
    stateCode: 'tx',
    address1: '1 Main'
  });
  assert.equal(profile.defaultAddress.countryCode, 'US');
  assert.equal(profile.defaultAddress.stateCode, 'TX');
  assert.equal(profile.defaultAddress.address1, '1 Main');
});
