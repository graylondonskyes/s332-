import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const checks = [
  ['schema has public intake token hash', 'prisma/schema.prisma', 'publicIntakeTokenHash'],
  ['schema has persistent rate limit bucket', 'prisma/schema.prisma', 'model RateLimitBucket'],
  ['public intake requires token', 'app/api/public/leads/route.ts', 'intakeToken'],
  ['public intake does not trust accountId', 'app/api/public/leads/route.ts', 'resolveAccountByIntakeToken'],
  ['SMS consent required on public intake', 'app/api/public/leads/route.ts', 'SMS consent is required'],
  ['SMS reservation before provider call', 'lib/send-message-event.ts', 'reserved_before_provider_call'],
  ['reservation releases on provider failure', 'lib/send-message-event.ts', 'released_after_provider_failure'],
  ['Stripe webhook signature tolerance', 'lib/billing/stripe.ts', 'toleranceSeconds'],
  ['Stripe webhook idempotency', 'app/api/billing/webhook/route.ts', 'duplicate: true'],
  ['manual consent no longer assumed', 'app/api/leads/route.ts', 'manual_lead_entry_no_consent'],
  ['session timing length guard', 'lib/auth.ts', 'signatureBuffer.length !== expectedBuffer.length'],
  ['rotate intake token route exists', 'app/api/embed/rotate-token/route.ts', 'public_intake_token_rotated'],
  ['no-bullshit migration exists', 'prisma/migrations/20260425152000_no_bullshit_guardrails/migration.sql', 'RateLimitBucket'],
];

const failures = [];
for (const [label, file, needle] of checks) {
  const path = join(root, file);
  if (!existsSync(path)) {
    failures.push(`${label}: missing ${file}`);
    continue;
  }
  const content = readFileSync(path, 'utf8');
  if (!content.includes(needle)) failures.push(`${label}: missing ${needle}`);
}

const bannedClaims = [
  ['unlimited SMS claim', /unlimited\s+sms/i],
  ['guaranteed bookings claim', /guaranteed\s+(bookings|revenue|jobs)/i],
  ['full CRM replacement claim', /full\s+crm\s+replacement/i],
];
const claimFiles = ['app/page.tsx','app/pricing/page.tsx','README.md'];
for (const file of claimFiles) {
  if (!existsSync(join(root, file))) continue;
  const content = readFileSync(join(root, file), 'utf8');
  for (const [label, regex] of bannedClaims) {
    if (regex.test(content)) failures.push(`${label}: found in ${file}`);
  }
}

if (failures.length) {
  console.error('STATIC PROOF FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('STATIC PROOF PASSED: strict guardrail files and anti-oversell claims are present.');
