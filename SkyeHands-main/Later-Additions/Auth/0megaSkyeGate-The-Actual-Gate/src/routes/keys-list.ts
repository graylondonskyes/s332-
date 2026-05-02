import type { Env } from '../types'
import { json } from '../utils/json'
import { verifyAdminToken } from '../auth/verifyAdminToken'

export async function handleKeysList(request: Request, env: Env): Promise<Response> {
  verifyAdminToken(request, env)

  const url = new URL(request.url)
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)))
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10))
  const appId = url.searchParams.get('app_id') || null

  const rows = appId
    ? await env.DB.prepare(
        `SELECT id, app_id, org_id, wallet_id, allowed_aliases, rate_limit_rpm, created_at,
                substr(token_hash, 1, 8) AS token_prefix
         FROM app_tokens WHERE app_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(appId, limit, offset).all()
    : await env.DB.prepare(
        `SELECT id, app_id, org_id, wallet_id, allowed_aliases, rate_limit_rpm, created_at,
                substr(token_hash, 1, 8) AS token_prefix
         FROM app_tokens ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(limit, offset).all()

  return json({ ok: true, keys: rows.results, limit, offset })
}
