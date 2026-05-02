import { json, noContent, parseBody, readWorkspace, requireMember, upsertWorkspace } from './_lib/kaixu-platform.js';

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return noContent();
  try {
    const { sql, member } = await requireMember(context);

    if (event.httpMethod === 'GET') {
      const row = await readWorkspace(sql, member.id);
      return json(200, {
        ok: true,
        workspace: row?.state || null,
        updated_at: row?.updated_at || null,
        project_count: Number(row?.project_count || 0),
        file_count: Number(row?.file_count || 0)
      });
    }

    if (event.httpMethod === 'POST') {
      const body = parseBody(event);
      const snapshot = body?.workspace || {};
      const raw = JSON.stringify(snapshot);
      if (raw.length > 1_500_000) {
        return json(413, { ok: false, error: 'Workspace snapshot too large' });
      }
      const saved = await upsertWorkspace(sql, member.id, snapshot);
      return json(200, {
        ok: true,
        updated_at: saved.updated_at,
        project_count: Number(saved.project_count || 0),
        file_count: Number(saved.file_count || 0)
      });
    }

    return json(405, { ok: false, error: 'Method not allowed' });
  } catch (error) {
    return json(error.statusCode || 500, { ok: false, error: error.message || 'workspace sync failed' });
  }
};
