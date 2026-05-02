const requiredForBuild = ['DATABASE_URL','SESSION_COOKIE_NAME','SESSION_SECRET','INTERNAL_CRON_SECRET','NEXT_PUBLIC_APP_URL'];
const providerVars = ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','STRIPE_PRICE_ID','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM_NUMBER','RESEND_API_KEY','RESEND_FROM_EMAIL'];
const missingBuild = requiredForBuild.filter((key) => !process.env[key]);
const missingProviders = providerVars.filter((key) => !process.env[key]);
if (missingBuild.length) {
  console.error('PRE-FLIGHT FAILED: required runtime env vars missing:');
  for (const key of missingBuild) console.error(`- ${key}`);
  process.exit(1);
}
if (missingProviders.length) {
  console.warn('PRE-FLIGHT WARNING: provider vars missing; live sending/billing will remain disabled or fail honestly:');
  for (const key of missingProviders) console.warn(`- ${key}`);
}
console.log('PRE-FLIGHT PASSED: required runtime env vars are present.');
