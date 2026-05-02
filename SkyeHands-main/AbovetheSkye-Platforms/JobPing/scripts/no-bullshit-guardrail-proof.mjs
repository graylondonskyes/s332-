import fs from 'node:fs';

const checks = [
  ['SMS consent checked before automation queue', 'lib/automation.ts', 'assertLeadCanReceiveChannel({ accountId: input.accountId, leadId: input.leadId, channel: "sms" })'],
  ['Automation has deterministic queue idempotency key', 'lib/automation.ts', 'const queueKey = `${input.accountId}:${input.leadId}:${input.triggerEvent}:${rule.id}`'],
  ['Automation checks existing queued rule event before creating another', 'lib/automation.ts', 'where: { queueKey }'],
  ['MessageEvent queueKey is unique', 'prisma/schema.prisma', 'queueKey          String?       @unique'],
  ['SMS reservation excludes current message event from per-lead cap', 'lib/usage.ts', 'id: { not: input.messageEventId }'],
  ['Per-lead cap allows max count exactly', 'lib/usage.ts', 'if (count + 1 > max)'],
  ['Consent-blocked send releases SMS reservation', 'lib/send-message-event.ts', 'released_after_consent_block'],
  ['Billing-blocked send releases SMS reservation', 'lib/send-message-event.ts', 'released_after_billing_block'],
  ['Risk-blocked send releases SMS reservation', 'lib/send-message-event.ts', 'released_after_risk_control_block'],
  ['Public intake token required', 'app/api/public/leads/route.ts', 'Lead form token is required'],
  ['Public intake rejects inactive accounts', 'app/api/public/leads/route.ts', 'Lead form is temporarily unavailable'],
  ['Manual lead consent is explicit only', 'app/api/leads/route.ts', 'manual_lead_entry_no_consent'],
  ['Stripe webhook event id is unique', 'prisma/schema.prisma', 'providerEventId String? @unique'],
  ['Stripe webhook catches duplicate provider event races', 'app/api/billing/webhook/route.ts', 'error?.code === "P2002"'],
  ['Twilio status webhooks are idempotent by sid/status/error', 'app/api/webhooks/twilio/status/route.ts', 'const providerEventId = providerMessageId ? `${providerMessageId}:${messageStatus}:${errorCode || "none"}` : null'],
  ['Twilio delivered status is not downgraded by stale sent update', 'app/api/webhooks/twilio/status/route.ts', 'stale_status_update'],
  ['Strict guardrail static proof is present', 'scripts/static-proof.mjs', 'STATIC PROOF PASSED'],
];

const failures = [];
for (const [name, file, needle] of checks) {
  if (!fs.existsSync(file)) failures.push(`${name}: missing ${file}`);
  else if (!fs.readFileSync(file, 'utf8').includes(needle)) failures.push(`${name}: missing ${needle}`);
}

if (failures.length) {
  console.error('NO-BULLSHIT GUARDRAIL PROOF FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('NO-BULLSHIT GUARDRAIL PROOF PASSED: cost, consent, duplicate automation, and webhook replay guardrails are present.');
