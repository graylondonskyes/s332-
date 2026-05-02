import { getMonthUsage, json, noContent, requireMember } from './_lib/kaixu-platform.js';

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return noContent();
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    const { sql, member } = await requireMember(context, { requireAdmin: true });
    const month = await getMonthUsage(sql, member.id);
    const members = await sql`
      SELECT id, email, full_name, role, status, monthly_request_cap, monthly_token_cap, total_requests, total_tokens, last_login_at, updated_at
      FROM kaixu_members
      ORDER BY updated_at DESC
      LIMIT 200
    `;
    const usage = await sql`
      SELECT u.id, u.member_id, m.email, m.full_name, u.route, u.model, u.total_tokens, u.input_tokens, u.output_tokens, u.created_at, u.status
      FROM kaixu_ai_usage u
      JOIN kaixu_members m ON m.id = u.member_id
      ORDER BY u.created_at DESC
      LIMIT 200
    `;
    const workspace = await sql`
      SELECT m.email, m.full_name, w.project_count, w.file_count, w.updated_at
      FROM kaixu_workspaces w
      JOIN kaixu_members m ON m.id = w.member_id
      ORDER BY w.updated_at DESC
      LIMIT 100
    `;
    const topUsers = await sql`
      SELECT m.email, m.full_name,
             COUNT(*)::int AS request_count,
             COALESCE(SUM(u.total_tokens),0)::bigint AS total_tokens
      FROM kaixu_ai_usage u
      JOIN kaixu_members m ON m.id = u.member_id
      WHERE u.created_at >= date_trunc('month', NOW())
      GROUP BY m.email, m.full_name
      ORDER BY total_tokens DESC, request_count DESC
      LIMIT 20
    `;
    const appStateSummary = await sql`
      SELECT app_key, MAX(title) AS title, COUNT(*)::int AS member_count, MAX(updated_at) AS updated_at, COALESCE(SUM(state_size),0)::bigint AS total_bytes
      FROM kaixu_app_state
      GROUP BY app_key
      ORDER BY MAX(updated_at) DESC
      LIMIT 100
    `;
    return json(200, {
      ok: true,
      provider: 'SKYES OVER LONDON',
      ai_name: 'kAIxU',
      month,
      members,
      usage,
      workspace,
      topUsers,
      appStateSummary
    });
  } catch (error) {
    return json(error.statusCode || 500, { ok: false, error: error.message || 'admin overview failed' });
  }
};
