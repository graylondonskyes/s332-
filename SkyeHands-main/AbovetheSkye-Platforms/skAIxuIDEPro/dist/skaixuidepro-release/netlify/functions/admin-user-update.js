import { clampInt, json, noContent, parseBody, requireMember } from './_lib/kaixu-platform.js';

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return noContent();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  try {
    const { sql, member } = await requireMember(context, { requireAdmin: true });
    const body = parseBody(event);
    const memberId = Number(body.member_id);
    if (!memberId) return json(400, { ok: false, error: 'member_id is required' });
    const role = ['admin', 'member'].includes(body.role) ? body.role : undefined;
    const status = ['active', 'suspended', 'disabled'].includes(body.status) ? body.status : undefined;
    const requestCap = clampInt(body.monthly_request_cap, 250, 1, 1000000);
    const tokenCap = clampInt(body.monthly_token_cap, 250000, 1000, 1000000000);

    const rows = await sql`
      UPDATE kaixu_members
      SET role = COALESCE(${role}, role),
          status = COALESCE(${status}, status),
          monthly_request_cap = ${requestCap},
          monthly_token_cap = ${tokenCap},
          updated_at = NOW()
      WHERE id = ${memberId}
      RETURNING id, email, full_name, role, status, monthly_request_cap, monthly_token_cap, updated_at
    `;

    if (!rows.length) return json(404, { ok: false, error: 'Member not found' });

    await sql`
      INSERT INTO kaixu_activity (member_id, event_type, detail, meta)
      VALUES (${member.id}, 'admin-user-update', ${rows[0].email}, ${JSON.stringify({ target_member_id: memberId, role, status, requestCap, tokenCap })}::jsonb)
    `;

    return json(200, { ok: true, member: rows[0] });
  } catch (error) {
    return json(error.statusCode || 500, { ok: false, error: error.message || 'admin update failed' });
  }
};
