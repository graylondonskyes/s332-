import { getSql, bootstrapSchema, ensureMember, json } from './_lib/kaixu-platform.js';

export const handler = async (event) => {
  try {
    const payload = JSON.parse(event.body || '{}');
    const user = payload.user || {};
    const sql = getSql();
    await bootstrapSchema(sql);
    await ensureMember(sql, user);
    return json(200, { ok: true });
  } catch (error) {
    return json(error.statusCode || 500, { ok: false, error: error.message || 'identity login sync failed' });
  }
};
