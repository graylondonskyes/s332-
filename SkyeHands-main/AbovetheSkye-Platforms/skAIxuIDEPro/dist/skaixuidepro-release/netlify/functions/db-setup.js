import { getStore } from '@netlify/blobs';
import { bootstrapSchema, getSql, json, noContent, requireMember } from './_lib/kaixu-platform.js';


export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return noContent();
  if (!['GET', 'POST'].includes(event.httpMethod)) return json(405, { error: 'Method not allowed' });
  try {
    await requireMember(context, { requireAdmin: true });
    const sql = getSql();
    const store = getStore({ name: 'skaixuide-runtime', consistency: 'strong' });
    await bootstrapSchema(sql);
    const members = await sql`SELECT COUNT(*)::int AS count FROM kaixu_members`;
    const usage = await sql`SELECT COUNT(*)::int AS count FROM kaixu_ai_usage`;
    const workspaces = await sql`SELECT COUNT(*)::int AS count FROM kaixu_workspaces`;
    const current = await store.getJSON('site-config');
    if (!current) {
      await store.setJSON('site-config', {
        announcement: 's0l26 0s · skAIxuIDEpro is part of the Creative Environment Eco-System by Skyes Over London and kAIxU.',
        footer_collapsed: true,
        support_email: 'SkyesOverLondonLC@SOLEnterprises.org',
        support_phone: '(480) 469-5416'
      });
    }
    return json(200, {
      ok: true,
      members: members[0].count,
      usage_rows: usage[0].count,
      workspaces: workspaces[0].count,
      blobs_ready: true
    });
  } catch (error) {
    return json(error.statusCode || 500, { ok: false, error: error.message || 'db setup failed' });
  }
};
