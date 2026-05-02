import { getSql, json, noContent, parseBody, bootstrapSchema, decodeNetlifyContext, requireMember } from './_lib/kaixu-platform.js';

const PUBLIC_LOG_INGEST = /^true$/i.test(process.env.ALLOW_PUBLIC_LOG_INGEST || '');

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return noContent();

  try {
    if (event.httpMethod === 'POST') {
      let member = null;
      let sql = null;
      if (!PUBLIC_LOG_INGEST) {
        ({ member, sql } = await requireMember(context));
      } else {
        sql = getSql();
        await bootstrapSchema(sql);
      }
      const ctx = decodeNetlifyContext(context);
      const user = ctx?.user || null;
      const body = parseBody(event);
      const logs = Array.isArray(body) ? body : (body.logs || [body]);
      if (!logs.length) return json(400, { ok: false, error: 'No logs provided' });
      let inserted = 0;
      for (const log of logs.slice(0, 100)) {
        const message = String(log.message || '').slice(0, 4000);
        if (!message) continue;
        await sql`
          INSERT INTO kaixu_logs (source, type, message, session_id, user_agent, hostname, identity_id, email)
          VALUES (
            ${String(log.source || 'unknown').slice(0, 64)},
            ${String(log.type || 'info').slice(0, 16)},
            ${message},
            ${String(log.session_id || log.sessionId || '').slice(0, 64) || null},
            ${String(log.user_agent || log.userAgent || '').slice(0, 512) || null},
            ${String(log.hostname || '').slice(0, 255) || null},
            ${String(user?.sub || member?.identity_id || log.identity_id || '').slice(0, 255) || null},
            ${String(user?.email || member?.email || log.email || '').slice(0, 255) || null}
          )
        `;
        inserted += 1;
      }
      return json(201, { ok: true, inserted });
    }

    if (event.httpMethod === 'GET') {
      const { sql } = await requireMember(context, { requireAdmin: true });
      const params = event.queryStringParameters || {};
      const limit = Math.min(parseInt(params.limit || '200', 10) || 200, 1000);
      const source = params.source || null;
      const email = params.email || null;
      const search = String(params.search || '').trim();
      let rows;
      if (search && source && email) {
        const pattern = `%${search}%`;
        rows = await sql`SELECT * FROM kaixu_logs WHERE source = ${source} AND email = ${email} AND message ILIKE ${pattern} ORDER BY ts DESC LIMIT ${limit}`;
      } else if (search && source) {
        const pattern = `%${search}%`;
        rows = await sql`SELECT * FROM kaixu_logs WHERE source = ${source} AND message ILIKE ${pattern} ORDER BY ts DESC LIMIT ${limit}`;
      } else if (search && email) {
        const pattern = `%${search}%`;
        rows = await sql`SELECT * FROM kaixu_logs WHERE email = ${email} AND message ILIKE ${pattern} ORDER BY ts DESC LIMIT ${limit}`;
      } else if (search) {
        const pattern = `%${search}%`;
        rows = await sql`SELECT * FROM kaixu_logs WHERE message ILIKE ${pattern} ORDER BY ts DESC LIMIT ${limit}`;
      } else if (source && email) {
        rows = await sql`SELECT * FROM kaixu_logs WHERE source = ${source} AND email = ${email} ORDER BY ts DESC LIMIT ${limit}`;
      } else if (source) {
        rows = await sql`SELECT * FROM kaixu_logs WHERE source = ${source} ORDER BY ts DESC LIMIT ${limit}`;
      } else if (email) {
        rows = await sql`SELECT * FROM kaixu_logs WHERE email = ${email} ORDER BY ts DESC LIMIT ${limit}`;
      } else {
        rows = await sql`SELECT * FROM kaixu_logs ORDER BY ts DESC LIMIT ${limit}`;
      }
      return json(200, { ok: true, logs: rows, count: rows.length });
    }

    return json(405, { ok: false, error: 'Method not allowed' });
  } catch (error) {
    return json(error.statusCode || 500, { ok: false, error: error.message || 'logs failed' });
  }
};
