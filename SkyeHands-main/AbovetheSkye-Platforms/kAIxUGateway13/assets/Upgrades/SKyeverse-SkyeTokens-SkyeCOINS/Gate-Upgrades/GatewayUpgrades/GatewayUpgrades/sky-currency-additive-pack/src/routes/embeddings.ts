import { assertAliasAllowed } from '../auth/policyGuard'
import { verifyAppToken } from '../auth/verifyAppToken'
import { reserveBudget } from '../ledger/reserveBudget'
import { finalizeUsage } from '../ledger/finalizeUsage'
import { refundUsage } from '../ledger/refundUsage'
import { callGeminiEmbeddings } from '../providers/gemini'
import { callOpenAIEmbeddings } from '../providers/openai'
import { isLaneEnabled } from '../env'
import { chooseProvider } from '../routing/chooseProvider'
import { laneForAlias, normalizeAlias } from '../routing/kaixu-engines'
import { estimateReserveForEmbeddings, calculateFinalBurn } from '../routing/pricing'
import { resolveAlias } from '../routing/resolveAlias'
import type { Env, SkyEmbeddingsRequest } from '../types'
import { publicEngineName, publicError } from '../utils/branding'
import { HttpError, toHttpError } from '../utils/errors'
import { json, readJson } from '../utils/json'
import { createTraceId } from '../utils/trace'

export async function handleEmbeddings(request: Request, env: Env): Promise<Response> {
  const traceId = createTraceId()
  const started = Date.now()
  const auth = await verifyAppToken(request, env)
  const body = await readJson<SkyEmbeddingsRequest>(request)
  const alias = normalizeAlias(body.alias, 'embeddings')

  if (laneForAlias(alias) !== 'embeddings') {
    throw new HttpError(400, 'KAIXU_INVALID_INPUT', 'The requested Kaixu engine is not an embeddings lane alias.')
  }
  assertAliasAllowed(auth, alias)

  if (!isLaneEnabled(env, 'embeddings')) {
    throw new HttpError(503, 'KAIXU_LANE_DISABLED', 'This Kaixu lane is disabled or not configured.')
  }

  const requestBody = { ...body, alias }
  const reserve = await estimateReserveForEmbeddings(alias, requestBody, env)
  await reserveBudget({ walletId: auth.walletId, reserve, traceId, env })

  try {
    const routes = await resolveAlias(alias, env)
    const routing = await chooseProvider({ alias, appId: auth.appId, orgId: auth.orgId, routes, env })
    const route = routing.primary

    let result
    switch (route.provider) {
      case 'openai':
        result = await callOpenAIEmbeddings(route.model, requestBody, env)
        break
      case 'gemini':
        result = await callGeminiEmbeddings(route.model, requestBody, env)
        break
      default:
        throw new HttpError(400, 'EMBEDDINGS_PROVIDER_UNSUPPORTED', `The requested Kaixu embeddings provider is not supported by this gateway adapter: ${route.provider}.`)
    }

    const finalBurn = await calculateFinalBurn(alias, result.usage, env)
    const finalized = await finalizeUsage({
      walletId: auth.walletId,
      reservedAmount: reserve,
      finalBurn,
      traceId,
      env,
      usageRecord: {
        orgId: auth.orgId,
        appId: auth.appId,
        userId: body.metadata?.user_id,
        alias,
        provider: route.provider,
        resolvedModel: route.model,
        requestType: 'embeddings',
        estimatedCostUsd: result.usage.estimated_cost_usd,
        inputTokens: result.usage.input_tokens,
        outputTokens: 0,
        latencyMs: Date.now() - started,
      },
    })

    return json({
      ok: true,
      trace_id: traceId,
      alias,
      engine: publicEngineName(alias),
      vectors: result.vectors,
      usage: {
        skyfuel_burned: finalBurn,
        estimated_cost_usd: result.usage.estimated_cost_usd,
        input_tokens: result.usage.input_tokens ?? 0,
        output_tokens: 0,
      },
      wallet: {
        refunded: finalized.refunded,
        balance: finalized.balance,
      },
    })
  } catch (error) {
    const httpError = toHttpError(error)
    await refundUsage({
      walletId: auth.walletId,
      reservedAmount: reserve,
      traceId,
      alias,
      appId: auth.appId,
      orgId: auth.orgId,
      userId: body.metadata?.user_id,
      requestType: 'embeddings',
      env,
      errorCode: httpError.code,
      errorMessage: httpError.message,
    })

    return json({
      ok: false,
      trace_id: traceId,
      error: publicError(httpError),
    }, httpError.status)
  }
}
