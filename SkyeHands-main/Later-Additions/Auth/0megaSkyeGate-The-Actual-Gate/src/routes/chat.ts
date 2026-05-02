import { assertAliasAllowed } from '../auth/policyGuard'
import { verifyAppToken } from '../auth/verifyAppToken'
import { insertKaixuTrace } from '../db/queries'
import { getBackupBrainBaseUrl, getBackupBrainToken, isLaneEnabled } from '../env'
import { executeChatWithFallback } from '../routing/applyFallback'
import { normalizeAlias } from '../routing/kaixu-engines'
import { chooseProvider } from '../routing/chooseProvider'
import { resolveAlias } from '../routing/resolveAlias'
import type { Env, SkyChatRequest } from '../types'
import { publicEngineName } from '../utils/branding'
import { KaixuError, toHttpError } from '../utils/errors'
import { json, readJson } from '../utils/json'
import { estimateSize } from '../utils/openai-response'
import { createTraceId } from '../utils/trace'

function normalizeBaseUrl(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '')
}

function summarizePrompt(request: SkyChatRequest): string {
  return request.messages
    .map((message) => {
      if (Array.isArray(message.content)) {
        const text = message.content
          .filter((part): part is { type: 'text'; text: string } => part?.type === 'text' && typeof part.text === 'string')
          .map((part) => part.text)
          .join('\n')
          .trim()
        return `${message.role}: ${text}`.trim()
      }
      return `${message.role}: ${String(message.content || '')}`.trim()
    })
    .filter(Boolean)
    .join('\n\n')
}

function extractBackupText(payload: any): string {
  return String(
    payload?.text
      || payload?.output?.text
      || payload?.output
      || payload?.choices?.[0]?.message?.content
      || '',
  ).trim()
}

async function callBackupBrainChat(alias: string, request: SkyChatRequest, env: Env) {
  const baseUrl = normalizeBaseUrl(getBackupBrainBaseUrl(env))
  if (!baseUrl) {
    throw new KaixuError(503, 'BACKUP_BRAIN_UNAVAILABLE', 'The backup brain is not configured for this gate runtime.')
  }

  const serviceToken = getBackupBrainToken(env)
  if (!serviceToken) {
    throw new KaixuError(503, 'BACKUP_BRAIN_TOKEN_MISSING', 'The backup brain token is not configured for this gate runtime.')
  }

  const response = await fetch(`${baseUrl}/v1/brain/backup/generate`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${serviceToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      alias,
      engine: alias,
      model: alias,
      prompt: summarizePrompt(request),
      messages: request.messages,
      metadata: request.metadata,
      brain_policy: {
        allow_backup: false,
        allow_user_direct: false,
      },
    }),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new KaixuError(
      response.status,
      'BACKUP_BRAIN_ERROR',
      String(payload?.error || payload?.message || 'The backup brain request failed.').trim() || 'The backup brain request failed.',
      { raw: payload },
    )
  }

  const text = extractBackupText(payload)
  if (!text) {
    throw new KaixuError(502, 'BACKUP_BRAIN_INVALID_RESPONSE', 'The backup brain returned an empty response.', { raw: payload })
  }

  return {
    output: { text },
    usage: {
      estimated_cost_usd: Number(payload?.usage?.estimated_cost_usd ?? 0),
      input_tokens: Number(payload?.usage?.prompt_tokens ?? payload?.usage?.input_tokens ?? 0),
      output_tokens: Number(payload?.usage?.completion_tokens ?? payload?.usage?.output_tokens ?? 0),
    },
    route: String(payload?.brain?.route || 'backup'),
    model: payload?.brain?.model ? String(payload.brain.model) : null,
    raw: payload,
  }
}

export async function handleChat(request: Request, env: Env): Promise<Response> {
  const traceId = createTraceId()
  const started = Date.now()
  const auth = await verifyAppToken(request, env)
  const body = await readJson<SkyChatRequest>(request)
  const alias = normalizeAlias(body.engine || body.alias, 'chat')
  assertAliasAllowed(auth, alias)

  if (!isLaneEnabled(env, 'chat')) {
    throw new KaixuError(503, 'KAIXU_LANE_DISABLED', 'This Kaixu lane is disabled or not configured.')
  }

  try {
    const normalizedRequest = { ...body, alias }
    let result
    let upstreamVendor: string | null = null
    let upstreamModel: string | null = null

    if (auth.founderGateway) {
      result = await callBackupBrainChat(alias, normalizedRequest, env)
      upstreamVendor = 'backup-brain'
      upstreamModel = result.model ?? alias
    } else {
      const routes = await resolveAlias(alias, env)
      const routing = await chooseProvider({ alias, appId: auth.appId, orgId: auth.orgId, routes, env })
      const executed = await executeChatWithFallback({
        traceId,
        primary: routing.primary,
        fallbacks: routing.fallbacks,
        allowFallback: routing.allowFallback,
        request: normalizedRequest,
        env,
      })
      result = executed.result
      upstreamVendor = executed.route.provider
      upstreamModel = executed.route.model
    }

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
      upstreamVendor,
      upstreamModel,
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
