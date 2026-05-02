import { bootstrapSchema, getSql, json, noContent, requireMember } from './_lib/kaixu-platform.js';

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return noContent();
  try {
    await requireMember(context, { requireAdmin: true });
    const sql = getSql();
    await bootstrapSchema(sql);
    const check = await sql`SELECT COUNT(*)::int AS count FROM kaixu_logs`;
    return json(200, { ok: true, message: 'kaixu_logs table ready', existing_rows: check[0].count });
  } catch (error) {
    return json(error.statusCode || 500, { ok: false, error: error.message || 'Setup failed' });
  }
};
