import { spawnSync } from 'child_process';

const cases = [
  { name: 'database_postgres_missing_url_guard', env: { DATABASE_DRIVER: 'postgres' }, expect: 'DATABASE_DRIVER=postgres requires DATABASE_URL or POSTGRES_URL' },
  { name: 'storage_s3_compatible_missing_config_guard', env: { STORAGE_DRIVER: 's3-compatible' }, expect: 'STORAGE_DRIVER=s3-compatible requires STORAGE_ENDPOINT, STORAGE_BUCKET, STORAGE_REGION, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY' },
  { name: 'storage_unsupported_driver_guard', env: { STORAGE_DRIVER: 's3' }, expect: 'STORAGE_DRIVER=s3 is unsupported' },
  { name: 'stripe_missing_secret_guard', env: { PAYMENT_PROVIDER: 'stripe' }, expect: 'PAYMENT_PROVIDER=stripe requires STRIPE_SECRET_KEY' },
  { name: 'twilio_missing_config_guard', env: { NOTIFICATION_PROVIDER: 'twilio' }, expect: 'NOTIFICATION_PROVIDER=twilio requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_DEFAULT_TO' },
  { name: 'mapbox_missing_token_guard', env: { ROUTE_INTELLIGENCE_PROVIDER: 'mapbox' }, expect: 'ROUTE_INTELLIGENCE_PROVIDER=mapbox requires MAPBOX_ACCESS_TOKEN' },
  { name: 'checkr_missing_config_guard', env: { IDENTITY_COMPLIANCE_PROVIDER: 'checkr' }, expect: 'IDENTITY_COMPLIANCE_PROVIDER=checkr requires CHECKR_API_KEY, CHECKR_PACKAGE' },
  { name: 'runtime_unsupported_driver_guard', env: { SKYEHANDS_RUNTIME_PROVIDER: 'missing-runtime-driver' }, expect: 'SKYEHANDS_RUNTIME_PROVIDER=missing-runtime-driver is unsupported' }
];

const proof = { started_at: new Date().toISOString(), checks: [] };
let failed = false;

for (const item of cases) {
  const result = spawnSync(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: '5997', ...item.env },
    encoding: 'utf8',
    timeout: 3000
  });
  const combined = `${result.stdout}\n${result.stderr}`;
  const ok = result.status !== 0 && combined.includes(item.expect);
  proof.checks.push({ status: ok ? 'PASS' : 'FAIL', name: item.name, exit_status: result.status, expect: item.expect, excerpt: combined.slice(-800) });
  if (!ok) failed = true;
}

proof.completed_at = new Date().toISOString();
proof.status = failed ? 'FAIL' : 'PASS';
console.log(JSON.stringify(proof, null, 2));
if (failed) process.exit(1);
