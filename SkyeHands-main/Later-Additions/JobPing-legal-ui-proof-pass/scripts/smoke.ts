/*
  JobPing production-lane smoke contract.
  Run after migrations, seed, and server start. This script does not fake third-party success.
*/

const requiredEnv = ["DATABASE_URL", "SESSION_COOKIE_NAME", "SESSION_SECRET", "INTERNAL_CRON_SECRET"];
const providerEnv = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID",
  "STRIPE_PORTAL_RETURN_URL",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
];

let failed = false;
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`FAIL missing required env: ${key}`);
    failed = true;
  }
}
for (const key of providerEnv) if (!process.env[key]) console.warn(`WARN live-provider env not set: ${key}`);

const checks = [
  "Create account and confirm account-scoped defaults are seeded",
  "Complete onboarding with business profile, review URL, and templates",
  "Create lead and confirm lead.created timeline entry",
  "Confirm enabled welcome rule queues a message event",
  "Confirm SMS/email sends are blocked for opted-out or missing-destination leads",
  "Call /api/internal/due-messages with x-jobping-internal-secret and confirm due events dispatch",
  "Call /api/internal/send-message with x-jobping-internal-secret",
  "Without Twilio/Resend envs, confirm message fails honestly with PROVIDER_NOT_CONFIGURED",
  "With Twilio/Resend envs, confirm provider_message_id is stored after successful send",
  "Post Twilio inbound SMS STOP with invalid signature and confirm 401",
  "Post Twilio inbound SMS STOP with valid signature and confirm consent.revoked, pending SMS canceled",
  "Post Twilio inbound SMS START with valid signature and confirm consent.granted",
  "Post Twilio status webhook with invalid signature and confirm 401",
  "Post Twilio status webhook with valid signature and confirm message status/timeline updates",
  "Post Twilio missed-call webhook with valid signature and confirm lead creation plus automation dispatch",
  "Retry a failed message and confirm a new queued retry event is created",
  "Mark lead lost and confirm queued/scheduled sends are canceled",
  "Mark lead completed and confirm review_request message queues",
  "Set subscription to past_due and confirm sends are skipped, not silently sent",
  "Call Stripe webhook with invalid signature and confirm 401",
  "Call Stripe webhook with valid signature and account_id metadata and confirm subscription status updates",
  "Open Stripe customer portal after providerCustomerId is stored",
  "Attempt cross-account lead access and confirm it is blocked",
];

console.log("JobPing production-lane smoke checklist");
for (const [index, check] of checks.entries()) console.log(`${index + 1}. ${check}`);
if (failed) process.exitCode = 1;
