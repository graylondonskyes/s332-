import { getMonthUsage, json, noContent, requireMember } from './_lib/kaixu-platform.js';

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return noContent();
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    const { sql, member, user } = await requireMember(context);
    const month = await getMonthUsage(sql, member.id);
    return json(200, {
      ok: true,
      provider: 'SKYES OVER LONDON',
      ai_name: 'kAIxU',
      s0l26_0s: true,
      user: {
        id: user.sub,
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name || member.full_name || user.email
      },
      member: {
        id: member.id,
        role: member.role,
        status: member.status,
        monthly_request_cap: member.monthly_request_cap,
        monthly_token_cap: member.monthly_token_cap,
        total_requests: Number(member.total_requests || 0),
        total_tokens: Number(member.total_tokens || 0)
      },
      month
    });
  } catch (error) {
    return json(error.statusCode || 500, { ok: false, error: error.message || 'auth-me failed' });
  }
};
