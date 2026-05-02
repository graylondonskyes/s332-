import { STORE_SYSTEM_SEED } from '../shared/data/system-seed.mjs';
import { defaultState } from '../shared/core/autonomous-store.mjs';
import { buildSystemProgress, registerMerchantAccount } from '../shared/core/autonomous-store-extensions.mjs';

const state = defaultState(STORE_SYSTEM_SEED);
state.merchantUsers = [];
state.merchantAssignments = [];
registerMerchantAccount(state, {
  storeName: 'North Store',
  ownerName: 'Owner One',
  email: 'owner1@example.local',
  contactPhone: '623-222-0000',
  pin: '8642'
});
const progress = buildSystemProgress(state);
const ok = Boolean(state.merchant.contactEmail === 'owner1@example.local' && state.merchantUsers.length === 1 && progress.completionPercent >= 50);
console.log(JSON.stringify({ ok, merchant: state.merchant.storeName, percent: progress.completionPercent }, null, 2));
if (!ok) process.exit(1);
