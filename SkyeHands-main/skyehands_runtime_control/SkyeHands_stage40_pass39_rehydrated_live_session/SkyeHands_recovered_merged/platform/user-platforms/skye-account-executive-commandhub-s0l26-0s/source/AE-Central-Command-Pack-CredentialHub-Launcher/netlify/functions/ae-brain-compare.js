const { callAeBrain } = require('./_shared/ae_brain');
const { appendAuditEvent, writeUsageEvent } = require('./_shared/ae_state');

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  };
}

module.exports.handler = async (event = {}) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const prompt = String(body.message || body.prompt || 'compare active AE strategies');
    const aeIds = Array.isArray(body.aeIds) && body.aeIds.length ? body.aeIds : ['ae-default'];

    const comparisons = await Promise.all(
      aeIds.map(async (aeId) => {
        const result = await callAeBrain({ aeId, message: prompt, context: { mode: 'compare' } });
        return {
          aeId: result.aeId,
          aeName: result.aeName,
          provider: result.provider,
          model: result.model,
          keySlot: result.keySlot,
          responseId: result.responseId
        };
      })
    );

    await writeUsageEvent({ route: 'ae-brain-compare', action: 'compare', detail: { compared: comparisons.length } });
    await appendAuditEvent({ action: 'ae_brain_compare', resource: 'ae-brain-compare', detail: { compared: comparisons.length } });

    return json(200, { ok: true, comparedAt: new Date().toISOString(), prompt, comparisons });
  } catch (error) {
    return json(400, { ok: false, error: error.message || 'invalid_request' });
  }
};
