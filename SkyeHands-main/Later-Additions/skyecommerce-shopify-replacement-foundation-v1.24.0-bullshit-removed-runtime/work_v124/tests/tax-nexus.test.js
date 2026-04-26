import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOrderToNexusRollup, nexusRollupRecord, normalizeTaxNexusRuleInput, taxNexusRuleRecord } from '../src/lib/tax-nexus.js';

test('normalizeTaxNexusRuleInput and applyOrderToNexusRollup track thresholds', () => {
  const rule = normalizeTaxNexusRuleInput({ label: 'AZ Nexus', countryCode: 'us', stateCode: 'az', thresholdCents: 10000, thresholdOrders: 2 });
  assert.equal(rule.stateCode, 'AZ');
  const rollup1 = applyOrderToNexusRollup({}, { totalCents: 6000 }, taxNexusRuleRecord({ ...rule, merchant_id: 'm1', country_code: 'US', state_code: 'AZ', active: 1 }));
  assert.equal(rollup1.thresholdMet, false);
  const rollup2 = applyOrderToNexusRollup(nexusRollupRecord({ merchant_id: 'm1', country_code: 'US', state_code: 'AZ', order_count: rollup1.orderCount, gross_cents: rollup1.grossCents, threshold_met: 0 }), { totalCents: 5000 }, taxNexusRuleRecord({ ...rule, merchant_id: 'm1', country_code: 'US', state_code: 'AZ', active: 1 }));
  assert.equal(rollup2.thresholdMet, true);
});
