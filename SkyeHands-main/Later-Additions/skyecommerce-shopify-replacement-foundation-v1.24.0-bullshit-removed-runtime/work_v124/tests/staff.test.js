import test from 'node:test';
import assert from 'node:assert/strict';
import { hasStaffPermission, normalizeStaffInvitationInput, normalizeStaffMemberInput, normalizeStaffRoleInput, staffMemberRecord, staffRoleRecord } from '../src/lib/staff.js';

test('staff roles normalize effective permissions and wildcard checks', () => {
  const roleInput = normalizeStaffRoleInput({ name: 'Ops Manager', permissions: ['orders:*', 'inventory:read', 'orders:*'] });
  assert.equal(roleInput.key, 'ops_manager');
  assert.deepEqual(roleInput.permissions, ['orders:*', 'inventory:read']);
  const role = staffRoleRecord({ id: 'role_1', merchant_id: 'm1', role_key: roleInput.key, name: roleInput.name, permissions_json: JSON.stringify(roleInput.permissions), active: 1 });
  const member = staffMemberRecord({ id: 'stm_1', merchant_id: 'm1', role_id: role.id, email: 'ops@example.com', name: 'Ops', status: 'active', permissions_json: JSON.stringify(['pos:operate']) }, role);
  assert.equal(hasStaffPermission(member, 'orders:write'), true);
  assert.equal(hasStaffPermission(member, 'pos:operate'), true);
  assert.equal(hasStaffPermission(member, 'settings:write'), false);
});

test('staff member and invitation inputs normalize email and permission payloads', () => {
  const member = normalizeStaffMemberInput({ email: ' USER@Example.COM ', name: 'User', permissions: ['catalog:read'] });
  const invite = normalizeStaffInvitationInput({ email: 'INVITE@Example.COM', roleId: 'role_1', permissions: ['customers:read'] });
  assert.equal(member.email, 'user@example.com');
  assert.equal(invite.email, 'invite@example.com');
  assert.deepEqual(invite.permissions, ['customers:read']);
});
