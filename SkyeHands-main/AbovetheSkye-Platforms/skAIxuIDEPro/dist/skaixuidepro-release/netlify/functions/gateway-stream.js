import { KAIXU_CORS, callKaixu, sseResponse } from './_lib/kaixu-openai.js';
import { getMonthUsage, recordUsage, requireMember, enforceCap } from './_lib/kaixu-platform.js';

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: KAIXU_CORS };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: KAIXU_CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { sql, member } = await requireMember(context);
    const month = await getMonthUsage(sql, member.id);
    enforceCap(member, month);
    const payload = JSON.parse(event.body || '{}');
    const result = await callKaixu(payload);
    await recordUsage(sql, member, {
      route: payload.route || 'gateway-stream',
      model: 'kAIxU',
      prompt_chars: JSON.stringify(payload).length,
      usage: result.usage,
      meta: { upstream_model: result.resolvedModel, app_key: payload.app_key || payload.source_app || payload.route || '' }
    });
    const monthAfter = await getMonthUsage(sql, member.id);
    return {
      statusCode: 200,
      headers: { ...KAIXU_CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      body: sseResponse(result, monthAfter)
    };
  } catch (err) {
    return {
      statusCode: err.statusCode || 500,
      headers: { ...KAIXU_CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'kAIxU stream failure' })
    };
  }
};
