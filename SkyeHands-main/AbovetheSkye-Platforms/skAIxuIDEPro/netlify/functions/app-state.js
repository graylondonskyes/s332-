import { json, noContent, normalizeAppStateKey, parseBody, requireMember, readAppState, upsertAppState } from './_lib/kaixu-platform.js';

function resolveAppKey(event, body = {}) {
  const query = event?.queryStringParameters || {};
  return normalizeAppStateKey(body.app_key || query.app_key || body.route || '/');
}

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return noContent();
  try {
    const { sql, member } = await requireMember(context);
    const body = parseBody(event);
    const appKey = resolveAppKey(event, body);

    if (event.httpMethod === 'GET') {
      const row = await readAppState(sql, member.id, appKey);
      return json(200, { ok: true, app_key: appKey, state: row?.state || null, meta: row || null });
    }

    if (event.httpMethod === 'POST') {
      const snapshot = body?.state && typeof body.state === 'object' ? body.state : {};
      snapshot.title = snapshot.title || body.title || '';
      snapshot.route = snapshot.route || appKey;
      const saved = await upsertAppState(sql, member.id, appKey, snapshot);
      return json(200, { ok: true, app_key: appKey, saved });
    }

    return json(405, { error: 'Method not allowed' });
  } catch (error) {
    return json(error.statusCode || 500, { ok: false, error: error.message || 'app-state failure' });
  }
};
