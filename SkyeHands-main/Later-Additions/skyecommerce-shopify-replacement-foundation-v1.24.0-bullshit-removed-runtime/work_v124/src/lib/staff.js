const text = (v = '') => String(v || '').trim();
const bool = (v, f = false) => v === undefined || v === null || v === '' ? f : v === true || v === 'true' || v === '1' || v === 1;
const asJson = (v, f) => Array.isArray(v) || (v && typeof v === 'object') ? v : (() => { try { return JSON.parse(v || ''); } catch { return f; } })();
const cleanKey = (v = '') => text(v).toLowerCase().replace(/[^a-z0-9._:*:-]+/g, '_').replace(/^_+|_+$/g, '') || 'custom';
export const DEFAULT_STAFF_PERMISSIONS = ['catalog:read', 'orders:read', 'orders:write', 'customers:read', 'inventory:read', 'pos:operate'];
export function normalizeStaffRoleInput(body = {}, existing = {}) {
  const name = text(body.name || existing.name || 'Staff');
  const permissions = asJson(body.permissions, body.permissions || existing.permissions || DEFAULT_STAFF_PERMISSIONS).map((p) => cleanKey(p)).filter(Boolean);
  return { name, key: cleanKey(body.key || existing.key || name), permissions: [...new Set(permissions)], active: bool(body.active, existing.active ?? true) };
}
export function staffRoleRecord(row) {
  if (!row) return null;
  let permissions = [];
  try { permissions = JSON.parse(row.permissions_json || row.permissions || '[]'); } catch {}
  return { id: row.id || '', merchantId: row.merchant_id || row.merchantId || '', key: row.role_key || row.key || '', name: row.name || '', permissions, active: Boolean(Number(row.active ?? 1)), createdAt: row.created_at || row.createdAt || '', updatedAt: row.updated_at || row.updatedAt || '' };
}
export function normalizeStaffMemberInput(body = {}, existing = {}) {
  const direct = asJson(body.permissions, body.permissions || existing.permissions || []);
  return { email: text(body.email || existing.email).toLowerCase(), name: text(body.name || existing.name), roleId: text(body.roleId || existing.roleId), status: cleanKey(body.status || existing.status || 'active'), permissions: [...new Set(direct.map((p) => cleanKey(p)).filter(Boolean))] };
}
export function staffMemberRecord(row, role = null) {
  if (!row) return null;
  let permissions = [];
  try { permissions = JSON.parse(row.permissions_json || row.permissions || '[]'); } catch {}
  return { id: row.id || '', merchantId: row.merchant_id || row.merchantId || '', roleId: row.role_id || row.roleId || '', roleName: row.role_name || role?.name || '', email: row.email || '', name: row.name || '', status: row.status || 'active', permissions, effectivePermissions: [...new Set([...(role?.permissions || []), ...permissions])], lastLoginAt: row.last_login_at || row.lastLoginAt || '', createdAt: row.created_at || row.createdAt || '', updatedAt: row.updated_at || row.updatedAt || '' };
}
export function normalizeStaffInvitationInput(body = {}, existing = {}) {
  const permissions = asJson(body.permissions, body.permissions || existing.permissions || []).map((p) => cleanKey(p)).filter(Boolean);
  return { email: text(body.email || existing.email).toLowerCase(), name: text(body.name || existing.name), roleId: text(body.roleId || existing.roleId), permissions: [...new Set(permissions)], expiresAt: text(body.expiresAt || existing.expiresAt), status: cleanKey(body.status || existing.status || 'pending') };
}
export function staffInvitationRecord(row, role = null) {
  if (!row) return null;
  let permissions = [];
  try { permissions = JSON.parse(row.permissions_json || row.permissions || '[]'); } catch {}
  return { id: row.id || '', merchantId: row.merchant_id || row.merchantId || '', roleId: row.role_id || row.roleId || '', roleName: row.role_name || role?.name || '', email: row.email || '', name: row.name || '', permissions, status: row.status || 'pending', expiresAt: row.expires_at || row.expiresAt || '', acceptedAt: row.accepted_at || row.acceptedAt || '', createdAt: row.created_at || row.createdAt || '' };
}
export function hasStaffPermission(member = {}, permission = '') {
  const wanted = cleanKey(permission);
  const perms = new Set((member.effectivePermissions || member.permissions || []).map(cleanKey));
  if (perms.has('*') || perms.has(wanted)) return true;
  const [scope] = wanted.split(':');
  return perms.has(`${scope}:*`);
}
