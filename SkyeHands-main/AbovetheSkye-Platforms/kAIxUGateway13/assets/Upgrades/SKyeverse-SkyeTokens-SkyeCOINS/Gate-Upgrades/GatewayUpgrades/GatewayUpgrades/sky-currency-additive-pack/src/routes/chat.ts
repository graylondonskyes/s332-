import { assertAliasAllowed } from '../auth/policyGuard'
import { verifyAppToken } from '../auth/verifyAppToken'
import { insertKaixuTrace } from '../db/queries'
import { getEnvBoolean, isLaneEnabled } from '../env'
import { executeChatWithFallback } from '../routing/applyFallback'
import { chooseProvider } from '../routing/chooseProvider'
import { laneForAlias, normalizeAlias } from '../routing/kaixu-engines'
import { resolveAlias } from '../routing/resolveAlias'
import type { Env, SkyChatRequest } from '../types'
import { publicEngineName } from '../utils/branding'
import { KaixuError, toHttpError } from '../utils/errors'
import { json, readJson } from '../utils/json'
import { estimateSize } from '../utils/openai-response'
import { createTraceId } from '../utils/trace'

export async function handleChat(request: Request, env: Env): Promise<Response> {
  const traceId = createTraceId()
  const started = Date.now()
  const auth = await verifyAppToken(request, env)
  const body = await readJson<SkyChatRequest>(request)
  const alias = normalizeAlias(body.engine || body.alias, 'chat')
  if (laneForAlias(alias) !== 'chat') {
    throw new KaixuError(400, 'KAIXU_INVALID_INPUT', 'The requested Kaixu engine is not a chat lane alias.')
  }
  assertAliasAllowed(auth, alias)

  if (!isLaneEnabled(env, 'chat')) {
    throw new KaixuError(503, 'KAIXU_LANE_DISABLED', 'This Kaixu lane is disabled or not configured.')
  }

  const routes = await resolveAlias(alias, env)
  const routing = await chooseProvider({ alias, appId: auth.appId, orgId: auth.orgId, routes, env })

  try {
    const { route, result } = await executeChatWithFallback({
      traceId,
      primary: routing.primary,
      fallbacks: routing.fallbacks,
      allowFallback: routing.allowFallback && getEnvBoolean(env, 'ENABLE_FALLBACKS', true),
      request: { ...body, alias },
      env,
    })
    const payload = {
      ok: true,
      trace_id: traceId,
      engine: publicEngineName(alias),
      output: result.output,
      usage: result.usage,
    }
    await insertKaixuTrace(env.DB, {
      traceId,
      appId: auth.appId,
      userId: body.metadata?.user_id,
      orgId: auth.orgId,
      lane: 'chat',
      engineAlias: alias,
      publicStatus: 'success',
      upstreamVendor: route.provider,
      upstreamModel: route.model,
      inputSizeEstimate: estimateSize(body),
      outputSizeEstimate: estimateSize(result.output),
      usageJson: result.usage,
      latencyMs: Date.now() - started,
      publicResponseJson: payload,
      requestMethod: request.method,
      requestPath: new URL(request.url).pathname,
      internalResponseJson: result.raw,
    })
    return json(payload)
  } catch (error) {
    const httpError = toHttpError(error)
    await insertKaixuTrace(env.DB, {
      traceId,
      appId: auth.appId,
      userId: body.metadata?.user_id,
      orgId: auth.orgId,
      lane: 'chat',
      engineAlias: alias,
      publicStatus: 'error',
      upstreamVendor: routing.primary.provider,
      upstreamModel: routing.primary.model,
      inputSizeEstimate: estimateSize(body),
      latencyMs: Date.now() - started,
      publicErrorCode: httpError.code,
      publicErrorMessage: httpError.message,
      requestMethod: request.method,
      requestPath: new URL(request.url).pathname,
      internalErrorJson: { adminDetail: httpError.adminDetail, raw: httpError.raw },
    })
    return json({ ok: false, trace_id: traceId, error: { code: httpError.code, message: httpError.message } }, httpError.status)
  }
}
