import { getSql, bootstrapSchema, ensureMember, json } from './_lib/kaixu-platform.js';

export const handler = async (event) => {
  try {
    const payload = JSON.parse(event.body || '{}');
    const user = payload.user || {};
    const sql = getSql();
    await bootstrapSchema(sql);
    await ensureMember(sql, user);
    const roles = Array.isArray(user?.app_metadata?.roles) ? [...new Set(user.app_metadata.roles)] : [];
    const email = String(user?.email || '').trim().toLowerCase();
    if (['skyesoverlondonlc@solenterprises.org', 'skyesoverlondon@gmail.com'].includes(email) && !roles.includes('admin')) {
      roles.push('admin');
    }
    return json(200, {
      ...user,
      app_metadata: {
        ...(user.app_metadata || {}),
        roles
      }
    });
  } catch (error) {
    return json(error.statusCode || 500, { ok: false, error: error.message || 'identity signup sync failed' });
  }
};
