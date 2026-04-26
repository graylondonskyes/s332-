const { AE_ROSTER } = require('./_shared/ae_roster');
const { getMergedAeProfile } = require('./_shared/ae_brain');
const { writeUsageEvent } = require('./_shared/ae_state');

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  };
}

module.exports.handler = async () => {
  const profiles = AE_ROSTER.map((ae) => {
    const merged = getMergedAeProfile(ae) || ae;
    return {
      id: merged.id,
      name: merged.name,
      department: merged.department || null,
      model: merged.model || null,
      keySlot: merged.keySlot || null,
      timezone: merged.timezone || null
    };
  });

  await writeUsageEvent({ route: 'ae-brains', action: 'list_profiles', detail: { count: profiles.length } });
  return json(200, { ok: true, total: profiles.length, profiles });
};
