import { callKaixu, jsonResponse } from './_lib/kaixu-openai.js';
import { getMonthUsage, json, noContent, parseBody, recordUsage, requireMember, enforceCap } from './_lib/kaixu-platform.js';

export const handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') return noContent();
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const { sql, member } = await requireMember(context);
    const month = await getMonthUsage(sql, member.id);
    enforceCap(member, month);

    const payload = parseBody(event);
    const result = await callKaixu(payload);
    await recordUsage(sql, member, {
      route: payload.route || 'gateway-chat',
      model: 'kAIxU',
      prompt_chars: JSON.stringify(payload).length,
      usage: result.usage,
      meta: { upstream_model: result.resolvedModel, app_key: payload.app_key || payload.source_app || payload.route || '' }
    });
    const monthAfter = await getMonthUsage(sql, member.id);
    return json(200, jsonResponse(result, monthAfter));
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'kAIxU lane failure' });
  }
};
