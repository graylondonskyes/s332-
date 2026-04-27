const fs = require('fs');
const { repoPath, writeJson, fail, ok } = require('./lib');
const { getTruthBoundaryStatus, assertCapability } = require('../platform/truth-boundaries');

const boundaries = getTruthBoundaryStatus({
  SKYE_AUTH_SECRET: 'present',
  STRIPE_SECRET_KEY: 'sk_test_present',
  SKYE_SUBMIT_APPLE_URL: 'https://submit.example.com/apple'
});
if (boundaries.auth.mode !== 'server-token-capable' || boundaries.auth.live_ready !== true) fail('[truth-boundaries] FAIL :: auth');
if (boundaries.payments.mode !== 'stripe-gateway-capable' || boundaries.payments.live_ready !== true) fail('[truth-boundaries] FAIL :: payments');
if (boundaries.submissions.mode !== 'vendor-portal-workflow-capable' || boundaries.submissions.live_ready !== true) fail('[truth-boundaries] FAIL :: submissions');
if (assertCapability('payments', { STRIPE_SECRET_KEY: 'sk_test_present' }).ok !== true) fail('[truth-boundaries] FAIL :: payments assertion');
if (assertCapability('submissions', { SKYE_SUBMIT_APPLE_URL: 'https://submit.example.com/apple' }).ok !== true) fail('[truth-boundaries] FAIL :: submissions assertion');
fs.mkdirSync(repoPath('artifacts','truth-boundaries'), { recursive: true });
writeJson(repoPath('artifacts','truth-boundaries','manifest.json'), { generated_at: new Date().toISOString(), ok: true, boundaries });
ok('[truth-boundaries] PASS (5 vectors)');
