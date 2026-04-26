import test from 'node:test';
import assert from 'node:assert/strict';
import { apiTokenRecord, appInstallationRecord, commerceAppRecord, hasApiScope, normalizeApiTokenInput, normalizeAppInstallationInput, normalizeCommerceAppInput } from '../src/lib/platform-apps.js';

test('commerce apps normalize scopes and install private apps', () => {
  const appInput = normalizeCommerceAppInput({ name: 'ERP Bridge', developerName: 'Ops Team', scopes: 'orders:read,orders:write,inventory:*', status: 'active' });
  assert.equal(appInput.key, 'erp-bridge');
  assert.deepEqual(appInput.requestedScopes, ['orders:read', 'orders:write', 'inventory:*']);
  const record = commerceAppRecord({ id: 'app_1', merchant_id: 'm1', app_key: appInput.key, name: appInput.name, requested_scopes_json: JSON.stringify(appInput.requestedScopes), status: 'active' });
  const install = normalizeAppInstallationInput({ appId: 'app_1', scopes: ['orders:read'] }, record);
  assert.equal(install.status, 'installed');
  assert.deepEqual(appInstallationRecord({ id: 'ins_1', merchant_id: 'm1', app_id: 'app_1', granted_scopes_json: JSON.stringify(install.grantedScopes) }, record).grantedScopes, ['orders:read']);
});

test('api tokens expose masked records and wildcard scope checks', () => {
  const input = normalizeApiTokenInput({ label: 'Warehouse API', scopes: ['inventory:*', 'orders:read'] });
  assert.equal(input.label, 'Warehouse API');
  assert.equal(hasApiScope(input.scopes, 'inventory:write'), true);
  assert.equal(hasApiScope(input.scopes, 'customers:read'), false);
  const record = apiTokenRecord({ id: 'tok_1', merchant_id: 'm1', label: input.label, secret_preview: 'skct_abc…xyz', scopes_json: JSON.stringify(input.scopes), status: 'active' });
  assert.equal(record.secretPreview, 'skct_abc…xyz');
  assert.deepEqual(record.scopes, ['inventory:*', 'orders:read']);
});
