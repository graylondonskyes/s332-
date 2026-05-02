import { STORE_SYSTEM_SEED } from '../shared/data/system-seed.mjs';
import { defaultState, authenticateMerchant, buildAeRosterView, buildStorefrontView } from '../shared/core/autonomous-store.mjs';

const state = defaultState(STORE_SYSTEM_SEED);
const session = authenticateMerchant(state, 'owner@maggies.local', '2468');
const storefront = buildStorefrontView(state);
const aeView = buildAeRosterView(state);

const checks = [
  { name: 'merchant auth shell seed user works', pass: Boolean(session?.role === 'merchant-admin') },
  { name: 'published inventory is available to storefront renderer', pass: storefront.metrics.publishedCount >= 1 },
  { name: 'ae roster view resolves merchant assignment', pass: aeView.merchantRows[0]?.assignedAe === 'Avery Lane' },
  { name: 'launch readiness score is computed', pass: Number(aeView.readiness.score) >= 80 }
];

const status = checks.every((check) => check.pass);
console.log(JSON.stringify({ status, checks }, null, 2));
if (!status) process.exit(1);
