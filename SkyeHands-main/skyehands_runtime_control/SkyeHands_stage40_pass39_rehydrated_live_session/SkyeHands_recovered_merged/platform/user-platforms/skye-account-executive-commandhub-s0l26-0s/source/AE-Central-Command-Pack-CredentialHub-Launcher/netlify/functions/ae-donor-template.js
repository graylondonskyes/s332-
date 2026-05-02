const shared = require('./_shared/ae_donor_template');
const { appendAuditEvent, writeUsageEvent } = require('./_shared/ae_state');

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload)
  };
}

module.exports.handler = async () => {
  const template = shared.getTemplate();
  const templateId = String(template?.id || template?.templateId || 'ae-donor-template');

  await writeUsageEvent({
    route: 'ae-donor-template',
    action: 'get_template',
    detail: { templateId }
  });

  await appendAuditEvent({
    action: 'ae_donor_template_read',
    resource: templateId,
    detail: {
      keys: Object.keys(template || {}),
      generatedAt: new Date().toISOString()
    }
  });

  return json(200, {
    ok: true,
    templateId,
    template
  });
};
