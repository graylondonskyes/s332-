import { neon } from '@neondatabase/serverless';

export const DEFAULT_ADMIN_EMAILS = [
  'skyesoverlondonlc@solenterprises.org',
  'skyesoverlondon@gmail.com'
];

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders
    },
    body: JSON.stringify(payload)
  };
}

export function noContent() {
  return { statusCode: 204, headers: CORS_HEADERS };
}

export function parseBody(event) {
  if (!event?.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

export function getSql() {
  const dbUrl = process.env.NEON_DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
  if (!dbUrl) {
    const err = new Error('Missing NEON_DATABASE_URL');
    err.statusCode = 500;
    throw err;
  }
  return neon(dbUrl);
}

export async function bootstrapSchema(sql) {
  await sql`CREATE TABLE IF NOT EXISTS kaixu_members (
    id BIGSERIAL PRIMARY KEY,
    identity_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'active',
    monthly_request_cap INTEGER NOT NULL DEFAULT 250,
    monthly_token_cap INTEGER NOT NULL DEFAULT 250000,
    total_requests BIGINT NOT NULL DEFAULT 0,
    total_tokens BIGINT NOT NULL DEFAULT 0,
    user_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    app_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
  )`;

  await sql`CREATE TABLE IF NOT EXISTS kaixu_workspaces (
    member_id BIGINT PRIMARY KEY REFERENCES kaixu_members(id) ON DELETE CASCADE,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    project_count INTEGER NOT NULL DEFAULT 0,
    file_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS kaixu_ai_usage (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT NOT NULL REFERENCES kaixu_members(id) ON DELETE CASCADE,
    route TEXT NOT NULL DEFAULT 'gateway-chat',
    request_id TEXT,
    status TEXT NOT NULL DEFAULT 'ok',
    provider TEXT NOT NULL DEFAULT 'SKYES OVER LONDON',
    model TEXT NOT NULL DEFAULT 'kAIxU',
    prompt_chars INTEGER NOT NULL DEFAULT 0,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    meta JSONB NOT NULL DEFAULT '{}'::jsonb
  )`;

  await sql`CREATE TABLE IF NOT EXISTS kaixu_activity (
    id BIGSERIAL PRIMARY KEY,
    member_id BIGINT REFERENCES kaixu_members(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    detail TEXT,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS kaixu_logs (
    id BIGSERIAL PRIMARY KEY,
    ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source VARCHAR(64) NOT NULL DEFAULT 'unknown',
    type VARCHAR(16) NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    session_id VARCHAR(64),
    user_agent TEXT,
    hostname VARCHAR(255),
    identity_id TEXT,
    email TEXT
  )`;

  await sql`CREATE TABLE IF NOT EXISTS kaixu_app_state (
    member_id BIGINT NOT NULL REFERENCES kaixu_members(id) ON DELETE CASCADE,
    app_key TEXT NOT NULL,
    title TEXT,
    route TEXT,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    state_size INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (member_id, app_key)
  )`;

  await sql`ALTER TABLE kaixu_logs ADD COLUMN IF NOT EXISTS identity_id TEXT`;
  await sql`ALTER TABLE kaixu_logs ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_kaixu_members_email ON kaixu_members(email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_kaixu_usage_member_created ON kaixu_ai_usage(member_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_kaixu_activity_member_created ON kaixu_activity(member_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_logs_ts ON kaixu_logs (ts DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_logs_source ON kaixu_logs (source)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_logs_email ON kaixu_logs (email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_kaixu_app_state_updated ON kaixu_app_state (updated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_kaixu_app_state_app_key ON kaixu_app_state (app_key)`;
}


export function decodeNetlifyContext(context) {
  try {
    const directUser = context?.clientContext?.user || null;
    const directIdentity = context?.clientContext?.identity || null;
    if (directUser || directIdentity) {
      return { identity: directIdentity, user: directUser };
    }

    const raw = context?.clientContext?.custom?.netlify;
    if (raw) {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      return {
        identity: parsed?.identity || null,
        user: parsed?.user || null
      };
    }

    return { identity: null, user: null };
  } catch {
    return { identity: null, user: null };
  }
}

export function adminEmails() {
  return Array.from(
    new Set(
      [
        ...DEFAULT_ADMIN_EMAILS,
        ...(process.env.ADMIN_EMAILS || '').split(',')
      ]
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export function isAdminIdentityUser(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  const roles = Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : [];
  return adminEmails().includes(email) || roles.includes('admin') || user?.role === 'admin';
}

export async function requireMember(context, { requireAdmin = false } = {}) {
  const { user, identity } = decodeNetlifyContext(context);
  if (!user?.sub && !user?.email) {
    const err = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }

  const sql = getSql();
  await bootstrapSchema(sql);
  const member = await ensureMember(sql, user);
  if (requireAdmin && member.role !== 'admin') {
    const err = new Error('Admin access required');
    err.statusCode = 403;
    throw err;
  }
  return { sql, member, user, identity };
}

export async function ensureMember(sql, user) {
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email) {
    const err = new Error('Missing member email');
    err.statusCode = 400;
    throw err;
  }

  const identityId = String(user?.sub || email).trim();
  const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.full_name || email || 'Member';
  const role = isAdminIdentityUser(user) ? 'admin' : 'member';
  const defaultRequestCap = clampInt(process.env.DEFAULT_MONTHLY_REQUEST_CAP, 250, 1, 100000);
  const defaultTokenCap = clampInt(process.env.DEFAULT_MONTHLY_TOKEN_CAP, 250000, 5000, 500000000);

  const byEmail = await sql`
    SELECT * FROM kaixu_members
    WHERE email = ${email}
    ORDER BY id ASC
    LIMIT 1
  `;

  const byIdentity = await sql`
    SELECT * FROM kaixu_members
    WHERE identity_id = ${identityId}
    ORDER BY id ASC
    LIMIT 1
  `;

  let target = byEmail[0] || byIdentity[0] || null;

  if (byEmail[0] && byIdentity[0] && byEmail[0].id !== byIdentity[0].id) {
    const keepId = byEmail[0].id;
    const dropId = byIdentity[0].id;

    await sql`
      UPDATE kaixu_ai_usage
      SET member_id = ${keepId}
      WHERE member_id = ${dropId}
    `;

    await sql`
      UPDATE kaixu_activity
      SET member_id = ${keepId}
      WHERE member_id = ${dropId}
    `;

    await sql`
      INSERT INTO kaixu_workspaces (member_id, state, project_count, file_count, updated_at)
      SELECT ${keepId}, state, project_count, file_count, updated_at
      FROM kaixu_workspaces
      WHERE member_id = ${dropId}
      ON CONFLICT (member_id) DO UPDATE SET
        state = EXCLUDED.state,
        project_count = EXCLUDED.project_count,
        file_count = EXCLUDED.file_count,
        updated_at = EXCLUDED.updated_at
    `;

    await sql`
      DELETE FROM kaixu_workspaces
      WHERE member_id = ${dropId}
    `;

    await sql`
      INSERT INTO kaixu_app_state (member_id, app_key, title, route, state, state_size, updated_at)
      SELECT ${keepId}, app_key, title, route, state, state_size, updated_at
      FROM kaixu_app_state
      WHERE member_id = ${dropId}
      ON CONFLICT (member_id, app_key) DO UPDATE SET
        title = EXCLUDED.title,
        route = EXCLUDED.route,
        state = EXCLUDED.state,
        state_size = EXCLUDED.state_size,
        updated_at = EXCLUDED.updated_at
    `;

    await sql`
      DELETE FROM kaixu_app_state
      WHERE member_id = ${dropId}
    `;

    await sql`
      DELETE FROM kaixu_members
      WHERE id = ${dropId}
    `;

    target = byEmail[0];
  }

  if (target) {
    const rows = await sql`
      UPDATE kaixu_members
      SET
        identity_id = ${identityId},
        email = ${email},
        full_name = ${fullName},
        role = ${role},
        status = COALESCE(status, 'active'),
        monthly_request_cap = COALESCE(monthly_request_cap, ${defaultRequestCap}),
        monthly_token_cap = COALESCE(monthly_token_cap, ${defaultTokenCap}),
        user_metadata = ${JSON.stringify(user?.user_metadata || {})}::jsonb,
        app_metadata = ${JSON.stringify(user?.app_metadata || {})}::jsonb,
        last_login_at = NOW(),
        updated_at = NOW()
      WHERE id = ${target.id}
      RETURNING *
    `;

    await sql`
      INSERT INTO kaixu_activity (member_id, event_type, detail, meta)
      VALUES (${rows[0].id}, 'identity-sync', ${role}, ${JSON.stringify({ email, mode: 'update' })}::jsonb)
    `;

    return rows[0];
  }

  const inserted = await sql`
    INSERT INTO kaixu_members (
      identity_id, email, full_name, role, status, monthly_request_cap, monthly_token_cap, user_metadata, app_metadata, last_login_at, updated_at
    ) VALUES (
      ${identityId}, ${email}, ${fullName}, ${role}, 'active', ${defaultRequestCap}, ${defaultTokenCap},
      ${JSON.stringify(user?.user_metadata || {})}::jsonb,
      ${JSON.stringify(user?.app_metadata || {})}::jsonb,
      NOW(), NOW()
    )
    RETURNING *
  `;

  await sql`
    INSERT INTO kaixu_activity (member_id, event_type, detail, meta)
    VALUES (${inserted[0].id}, 'identity-sync', ${role}, ${JSON.stringify({ email, mode: 'insert' })}::jsonb)
  `;

  return inserted[0];
}

export function monthStart(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return new Date(Date.UTC(year, month, 1, 0, 0, 0)).toISOString();
}

export async function getMonthUsage(sql, memberId) {
  const start = monthStart();
  const rows = await sql`
    SELECT
      COUNT(*)::int AS request_count,
      COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
      COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
      COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens
    FROM kaixu_ai_usage
    WHERE member_id = ${memberId}
      AND created_at >= ${start}::timestamptz
      AND status = 'ok'
  `;
  const row = rows[0] || {};
  return {
    month_start: start,
    request_count: Number(row.request_count || 0),
    total_tokens: Number(row.total_tokens || 0),
    input_tokens: Number(row.input_tokens || 0),
    output_tokens: Number(row.output_tokens || 0)
  };
}

export async function recordUsage(sql, member, payload) {
  const requestId = payload.request_id || `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const usage = payload.usage || {};
  const inputTokens = Number(usage.input_tokens || 0);
  const outputTokens = Number(usage.output_tokens || 0);
  const totalTokens = Number(usage.total_tokens || 0);
  await sql`
    INSERT INTO kaixu_ai_usage (
      member_id, route, request_id, status, provider, model, prompt_chars, input_tokens, output_tokens, total_tokens, meta
    ) VALUES (
      ${member.id}, ${payload.route || 'gateway-chat'}, ${requestId}, ${payload.status || 'ok'}, 'SKYES OVER LONDON', ${payload.model || 'kAIxU'},
      ${Number(payload.prompt_chars || 0)}, ${inputTokens}, ${outputTokens}, ${totalTokens},
      ${JSON.stringify(payload.meta || {})}::jsonb
    )
  `;
  await sql`
    UPDATE kaixu_members
    SET total_requests = total_requests + 1,
        total_tokens = total_tokens + ${totalTokens},
        updated_at = NOW()
    WHERE id = ${member.id}
  `;
  await sql`
    INSERT INTO kaixu_activity (member_id, event_type, detail, meta)
    VALUES (${member.id}, 'ai-usage', ${payload.route || 'gateway-chat'}, ${JSON.stringify({ totalTokens, model: payload.model || 'kAIxU' })}::jsonb)
  `;
}

export function enforceCap(member, usageMonth) {
  const reqCap = Number(member.monthly_request_cap || 0);
  const tokCap = Number(member.monthly_token_cap || 0);
  if (member.status !== 'active') {
    const err = new Error(`Account status is ${member.status}`);
    err.statusCode = 403;
    throw err;
  }
  if (reqCap > 0 && usageMonth.request_count >= reqCap) {
    const err = new Error('Monthly request cap reached');
    err.statusCode = 402;
    throw err;
  }
  if (tokCap > 0 && usageMonth.total_tokens >= tokCap) {
    const err = new Error('Monthly token cap reached');
    err.statusCode = 402;
    throw err;
  }
}

export async function upsertWorkspace(sql, memberId, snapshot) {
  const state = snapshot || {};
  const counts = summarizeWorkspace(state.fileSystem || {});
  const rows = await sql`
    INSERT INTO kaixu_workspaces (member_id, state, project_count, file_count, updated_at)
    VALUES (${memberId}, ${JSON.stringify(state)}::jsonb, ${counts.projectCount}, ${counts.fileCount}, NOW())
    ON CONFLICT (member_id) DO UPDATE SET
      state = EXCLUDED.state,
      project_count = EXCLUDED.project_count,
      file_count = EXCLUDED.file_count,
      updated_at = NOW()
    RETURNING updated_at, project_count, file_count
  `;
  await sql`
    INSERT INTO kaixu_activity (member_id, event_type, detail, meta)
    VALUES (${memberId}, 'workspace-sync', 'save', ${JSON.stringify(counts)}::jsonb)
  `;
  return rows[0];
}

export async function readWorkspace(sql, memberId) {
  const rows = await sql`SELECT state, updated_at, project_count, file_count FROM kaixu_workspaces WHERE member_id = ${memberId} LIMIT 1`;
  return rows[0] || null;
}

export async function upsertAppState(sql, memberId, appKey, snapshot = {}) {
  const safeKey = String(appKey || 'app').slice(0, 240);
  const title = String(snapshot?.title || '').slice(0, 240);
  const route = String(snapshot?.route || safeKey).slice(0, 240);
  const encoded = JSON.stringify(snapshot || {});
  const rows = await sql`
    INSERT INTO kaixu_app_state (member_id, app_key, title, route, state, state_size, updated_at)
    VALUES (${memberId}, ${safeKey}, ${title}, ${route}, ${encoded}::jsonb, ${encoded.length}, NOW())
    ON CONFLICT (member_id, app_key) DO UPDATE SET
      title = EXCLUDED.title,
      route = EXCLUDED.route,
      state = EXCLUDED.state,
      state_size = EXCLUDED.state_size,
      updated_at = NOW()
    RETURNING app_key, title, route, state_size, updated_at
  `;
  await sql`
    INSERT INTO kaixu_activity (member_id, event_type, detail, meta)
    VALUES (${memberId}, 'app-state-sync', ${safeKey}, ${JSON.stringify({ title, route, state_size: encoded.length })}::jsonb)
  `;
  return rows[0];
}

export async function readAppState(sql, memberId, appKey) {
  const safeKey = String(appKey || 'app').slice(0, 240);
  const rows = await sql`
    SELECT app_key, title, route, state, state_size, updated_at
    FROM kaixu_app_state
    WHERE member_id = ${memberId} AND app_key = ${safeKey}
    LIMIT 1
  `;
  return rows[0] || null;
}

export function summarizeWorkspace(fileSystem) {
  const projectNames = Object.keys(fileSystem || {});
  let fileCount = 0;
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    for (const value of Object.values(node)) {
      if (!value || typeof value !== 'object') continue;
      if (value.type === 'folder') walk(value.children || {});
      else fileCount += 1;
    }
  };
  for (const project of projectNames) walk(fileSystem[project]);
  return { projectCount: projectNames.length, fileCount };
}

export function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}
