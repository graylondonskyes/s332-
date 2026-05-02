import type { Env } from '../types'
import { json } from '../utils/json'
import { verifyAdminToken } from '../auth/verifyAdminToken'

export async function handleKeysRevoke(request: Request, env: Env): Promise<Response> {
  verifyAdminToken(request, env)

  let body: { token_id?: string; app_id?: string }
  try {
    body = await request.json() as typeof body
  } catch {
    return json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Invalid JSON body.' } }, 400)
  }

  if (!body.token_id && !body.app_id) {
    return json({ ok: false, error: { code: 'BAD_REQUEST', message: 'Provide token_id or app_id.' } }, 400)
  }

  const result = body.token_id
    ? await env.DB.prepare(`DELETE FROM app_tokens WHERE id=?`).bind(body.token_id).run()
    : await env.DB.prepare(`DELETE FROM app_tokens WHERE app_id=?`).bind(body.app_id).run()

  const deleted = result.meta?.changes ?? 0
  if (deleted === 0) return json({ ok: false, error: { code: 'NOT_FOUND', message: 'No matching key found.' } }, 404)

  return json({ ok: true, deleted, token_id: body.token_id || null, app_id: body.app_id || null })
}
