import assert from "node:assert/strict";
import {
  cardTypeConfig,
  computeProductExpiry,
  normalizeProvider,
  offerConfig,
} from "../Platforms-Apps-Infrastructure/kAIxUGateway13/netlify/functions/_lib/skyecards.js";

const devStarter = cardTypeConfig("dev_starter");
assert.equal(devStarter.requires_mandate, true);
assert.equal(devStarter.upfront_usage_cents, 5000);
assert.equal(devStarter.monthly_ai_cents, 1500);
assert.equal(devStarter.monthly_product_cents, 5000);
assert.equal(devStarter.product_stack_cap_cents, 25000);
assert.equal(devStarter.product_credit_ttl_months, 8);
assert.deepEqual(devStarter.product_credit_stores, ["SkyeSol", "SOLEnterprises.org"]);
assert(devStarter.allowed_buckets.includes("tokens"));
assert(devStarter.allowed_buckets.includes("pushes"));

const memberPlus = cardTypeConfig("member_plus");
assert.equal(memberPlus.skyeverse_currency, true);
assert(memberPlus.allowed_buckets.includes("skyeverse"));

assert.equal(normalizeProvider("stripe"), "stripe");
assert.equal(normalizeProvider("paypal"), "paypal");
assert.equal(normalizeProvider("bad-provider"), "stripe");

const expiry = computeProductExpiry(new Date("2026-04-01T00:00:00.000Z"), 8);
assert.equal(expiry.slice(0, 10), "2026-12-01");

const aiBoost = offerConfig("ai_boost_25");
assert.equal(aiBoost.price_cents, 2500);
assert.equal(aiBoost.credits[0].bucket, "ai_usage");
assert.equal(aiBoost.credits[0].amount_cents, 3000);

const pushPack = offerConfig("push_pack_49");
assert.equal(pushPack.price_cents, 4900);
assert(pushPack.credits.some((credit) => credit.bucket === "pushes" && credit.unit_count === 12));

const launchCredit = offerConfig("launch_credit_99");
assert.equal(launchCredit.price_cents, 9900);
assert.equal(launchCredit.expires_after_months, 8);
assert.equal(launchCredit.credits.reduce((sum, credit) => sum + (credit.amount_cents || 0), 0), 15000);

const auditPack = offerConfig("audit_pack_299");
assert.equal(auditPack.price_cents, 29900);
assert(auditPack.credits.some((credit) => credit.bucket === "service_credit" && credit.amount_cents === 29900));

console.log(JSON.stringify({
  ok: true,
  policies: {
    dev_starter: {
      no_upfront_usage_cents: devStarter.upfront_usage_cents,
      monthly_ai_cents: devStarter.monthly_ai_cents,
      monthly_product_cents: devStarter.monthly_product_cents,
      product_stack_cap_cents: devStarter.product_stack_cap_cents,
      product_credit_ttl_months: devStarter.product_credit_ttl_months,
    },
    member_plus: {
      skyeverse_currency: memberPlus.skyeverse_currency,
    },
    offers: {
      ai_boost_25: aiBoost.price_cents,
      push_pack_49: pushPack.price_cents,
      launch_credit_99: launchCredit.price_cents,
      audit_pack_299: auditPack.price_cents,
    },
  },
}, null, 2));
