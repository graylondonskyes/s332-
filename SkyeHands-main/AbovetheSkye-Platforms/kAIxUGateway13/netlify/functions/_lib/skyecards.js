import crypto from "node:crypto";
import { q } from "./db.js";
import { monthKeyUTC } from "./http.js";

export const SKYE_CARD_TYPES = {
  dev_starter: {
    card_type: "dev_starter",
    label: "SkyeCard Dev Starter",
    requires_mandate: true,
    upfront_usage_cents: 5000,
    monthly_ai_cents: 1500,
    monthly_product_cents: 5000,
    product_stack_cap_cents: 25000,
    product_credit_ttl_months: 8,
    product_credit_stores: ["SkyeSol", "SOLEnterprises.org"],
    allowed_buckets: ["ai_usage", "tokens", "pushes", "product_credit", "service_credit"],
  },
  member_plus: {
    card_type: "member_plus",
    label: "SkyeCard Member Plus",
    requires_mandate: true,
    upfront_usage_cents: 0,
    monthly_ai_cents: 1500,
    monthly_product_cents: 5000,
    product_stack_cap_cents: 25000,
    product_credit_ttl_months: 8,
    product_credit_stores: ["SkyeSol", "SOLEnterprises.org"],
    skyeverse_currency: true,
    allowed_buckets: ["ai_usage", "tokens", "pushes", "product_credit", "service_credit", "skyeverse"],
  },
};

export const SKYE_CARD_OFFERS = {
  ai_boost_25: {
    offer_id: "ai_boost_25",
    label: "SkyeCard AI Boost",
    price_cents: 2500,
    description: "$25 checkout that loads $30 AI usage credit.",
    credits: [
      { bucket: "ai_usage", amount_cents: 3000, unit_type: "cents", source: "skye_card_offer_ai_boost" },
    ],
  },
  push_pack_49: {
    offer_id: "push_pack_49",
    label: "SkyeCard Push Pack",
    price_cents: 4900,
    description: "$49 checkout that loads 12 deployment/push credits plus $10 AI usage.",
    credits: [
      { bucket: "pushes", amount_cents: 0, unit_count: 12, unit_type: "push", source: "skye_card_offer_push_pack" },
      { bucket: "ai_usage", amount_cents: 1000, unit_type: "cents", source: "skye_card_offer_push_pack_ai" },
    ],
  },
  launch_credit_99: {
    offer_id: "launch_credit_99",
    label: "SkyeCard Launch Credit",
    price_cents: 9900,
    description: "$99 checkout that loads $150 restricted product/service credit for SkyeSol and SOLEnterprises.org.",
    expires_after_months: 8,
    credits: [
      { bucket: "product_credit", amount_cents: 10000, unit_type: "cents", source: "skye_card_offer_launch_product" },
      { bucket: "service_credit", amount_cents: 5000, unit_type: "cents", source: "skye_card_offer_launch_service" },
    ],
  },
  audit_pack_299: {
    offer_id: "audit_pack_299",
    label: "SkyeCard Audit Pack",
    price_cents: 29900,
    description: "$299 checkout for an investor/procurement audit-readiness credit pack.",
    expires_after_months: 8,
    credits: [
      { bucket: "service_credit", amount_cents: 29900, unit_type: "cents", source: "skye_card_offer_audit_pack" },
      { bucket: "ai_usage", amount_cents: 2500, unit_type: "cents", source: "skye_card_offer_audit_ai_bonus" },
    ],
  },
};

export function cardTypeConfig(cardType = "dev_starter") {
  return SKYE_CARD_TYPES[cardType] || SKYE_CARD_TYPES.dev_starter;
}

export function offerConfig(offerId = "ai_boost_25") {
  return SKYE_CARD_OFFERS[offerId] || null;
}

export function normalizeProvider(value = "stripe") {
  const provider = String(value || "stripe").trim().toLowerCase();
  if (["stripe", "paypal", "manual"].includes(provider)) return provider;
  return "stripe";
}

export function computeProductExpiry(createdAt = new Date(), ttlMonths = 8) {
  const d = new Date(createdAt);
  d.setUTCMonth(d.getUTCMonth() + Number(ttlMonths || 8));
  return d.toISOString();
}

export function newCardId() {
  return `skc_${crypto.randomBytes(12).toString("hex")}`;
}

export async function getActiveSkyeCard(customerId) {
  const r = await q(
    `select * from skye_cards
     where customer_id=$1 and status='active'
     order by created_at desc
     limit 1`,
    [customerId]
  );
  return r.rowCount ? r.rows[0] : null;
}

export async function recordMandate({ customer_id, provider = "stripe", mandate_reference, status = "active", recurring_amount_cents = 0, meta = {} }) {
  if (!mandate_reference) throw Object.assign(new Error("Missing mandate_reference"), { status: 400 });
  const p = normalizeProvider(provider);
  const r = await q(
    `insert into skye_card_payment_mandates(customer_id, provider, mandate_reference, status, recurring_amount_cents, meta)
     values ($1,$2,$3,$4,$5,$6::jsonb)
     on conflict(provider, mandate_reference)
     do update set status=excluded.status, recurring_amount_cents=excluded.recurring_amount_cents, meta=excluded.meta, updated_at=now()
     returning *`,
    [customer_id, p, mandate_reference, status, recurring_amount_cents || 0, JSON.stringify(meta || {})]
  );
  return r.rows[0];
}

export async function issueSkyeCard({ customer_id, user_id = null, card_type = "dev_starter", payment_provider = "stripe", mandate_reference = "", setup_status = "required", recurring_amount_cents = 0, meta = {} }) {
  const cfg = cardTypeConfig(card_type);
  const provider = normalizeProvider(payment_provider);

  if (cfg.requires_mandate && !mandate_reference) {
    throw Object.assign(new Error("SkyeCard requires a recurring payment mandate before credit is issued."), { status: 402, code: "SKYECARD_MANDATE_REQUIRED" });
  }

  if (mandate_reference) {
    await recordMandate({ customer_id, provider, mandate_reference, status: setup_status === "complete" ? "active" : setup_status, recurring_amount_cents, meta });
  }

  const existing = await getActiveSkyeCard(customer_id);
  if (existing) return existing;

  const cardId = newCardId();
  const r = await q(
    `insert into skye_cards(
       card_id, customer_id, user_id, card_type, status, payment_provider, mandate_reference, setup_status,
       upfront_usage_cents, monthly_ai_cents, monthly_product_cents, product_stack_cap_cents, product_credit_ttl_months, meta
     )
     values ($1,$2,$3,$4,'active',$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
     returning *`,
    [
      cardId,
      customer_id,
      user_id,
      cfg.card_type,
      provider,
      mandate_reference || null,
      setup_status,
      cfg.upfront_usage_cents,
      cfg.monthly_ai_cents,
      cfg.monthly_product_cents,
      cfg.product_stack_cap_cents,
      cfg.product_credit_ttl_months,
      JSON.stringify({ label: cfg.label, ...meta }),
    ]
  );
  const card = r.rows[0];

  if (cfg.upfront_usage_cents > 0) {
    await creditSkyeCard({
      card,
      bucket: "ai_usage",
      amount_cents: cfg.upfront_usage_cents,
      source: "skye_card_upfront_usage",
      reference: `${card.card_id}:upfront:${monthKeyUTC()}`,
      meta: { policy: "no_upfront_charge_requires_recurring_mandate" },
    });
  }

  await applyMonthlySkyeCardBenefits(card, monthKeyUTC());
  return card;
}

export async function creditSkyeCard({ card, bucket, amount_cents, unit_count = 0, unit_type = "cents", source, reference = null, expires_at = null, meta = {} }) {
  if (!card?.card_id) throw Object.assign(new Error("Missing card"), { status: 400 });
  const amount = Math.max(0, parseInt(amount_cents, 10) || 0);
  const units = Math.max(0, parseInt(unit_count, 10) || 0);
  if (amount <= 0 && units <= 0) return null;
  const r = await q(
    `insert into skye_card_ledger(card_id, customer_id, bucket, direction, amount_cents, unit_count, unit_type, source, reference, expires_at, meta)
     values ($1,$2,$3,'credit',$4,$5,$6,$7,$8,$9,$10::jsonb)
     on conflict do nothing
     returning *`,
    [card.card_id, card.customer_id, bucket, amount, units, unit_type, source, reference, expires_at, JSON.stringify(meta || {})]
  );
  return r.rowCount ? r.rows[0] : null;
}

export async function spendSkyeCard({ card, bucket, amount_cents, unit_count = 0, unit_type = "cents", source = "usage", reference = null, meta = {} }) {
  if (!card?.card_id) throw Object.assign(new Error("Missing card"), { status: 400 });
  const amount = Math.max(0, parseInt(amount_cents, 10) || 0);
  if (amount <= 0) throw Object.assign(new Error("amount_cents must be > 0"), { status: 400 });
  const summary = await getSkyeCardSummary(card.customer_id);
  const balance = summary?.balances?.[bucket]?.available_cents || 0;
  if (balance < amount) throw Object.assign(new Error("Insufficient SkyeCard balance"), { status: 402, code: "SKYECARD_INSUFFICIENT_BALANCE" });
  const r = await q(
    `insert into skye_card_ledger(card_id, customer_id, bucket, direction, amount_cents, unit_count, unit_type, source, reference, meta)
     values ($1,$2,$3,'debit',$4,$5,$6,$7,$8,$9::jsonb)
     returning *`,
    [card.card_id, card.customer_id, bucket, amount, unit_count || 0, unit_type, source, reference, JSON.stringify(meta || {})]
  );
  return r.rows[0];
}

export async function applyMonthlySkyeCardBenefits(card, month = monthKeyUTC()) {
  if (!card?.card_id) return [];
  const expiresAt = computeProductExpiry(new Date(`${month}-01T00:00:00.000Z`), card.product_credit_ttl_months || 8);
  const credits = [];
  credits.push(await creditSkyeCard({
    card,
    bucket: "ai_usage",
    amount_cents: card.monthly_ai_cents || 1500,
    source: "skye_card_monthly_ai",
    reference: `${card.card_id}:monthly_ai:${month}`,
    meta: { month },
  }));
  credits.push(await creditSkyeCard({
    card,
    bucket: "product_credit",
    amount_cents: card.monthly_product_cents || 5000,
    source: "skye_card_monthly_product",
    reference: `${card.card_id}:monthly_product:${month}`,
    expires_at: expiresAt,
    meta: {
      month,
      stack_cap_cents: card.product_stack_cap_cents || 25000,
      expires_after_months: card.product_credit_ttl_months || 8,
      stores: cardTypeConfig(card.card_type).product_credit_stores || ["SkyeSol", "SOLEnterprises.org"],
    },
  }));
  return credits.filter(Boolean);
}

export async function applySkyeCardOffer({ customer_id, offer_id, payment_provider = "stripe", payment_reference, meta = {} }) {
  const offer = offerConfig(offer_id);
  if (!offer) throw Object.assign(new Error("Unknown SkyeCard offer"), { status: 400, code: "SKYECARD_UNKNOWN_OFFER" });
  if (!payment_reference) throw Object.assign(new Error("Missing payment_reference"), { status: 400 });

  const card = await getActiveSkyeCard(customer_id);
  if (!card) throw Object.assign(new Error("No active SkyeCard for offer credit"), { status: 404, code: "SKYECARD_REQUIRED" });

  const expiresAt = offer.expires_after_months
    ? computeProductExpiry(new Date(), offer.expires_after_months)
    : null;
  const entries = [];
  for (const credit of offer.credits || []) {
    entries.push(await creditSkyeCard({
      card,
      bucket: credit.bucket,
      amount_cents: credit.amount_cents || 0,
      unit_count: credit.unit_count || 0,
      unit_type: credit.unit_type || "cents",
      source: credit.source || "skye_card_offer",
      reference: `${card.card_id}:offer:${offer.offer_id}:${payment_provider}:${payment_reference}:${credit.bucket}`,
      expires_at: ["product_credit", "service_credit"].includes(credit.bucket) ? expiresAt : null,
      meta: {
        offer_id: offer.offer_id,
        offer_label: offer.label,
        offer_price_cents: offer.price_cents,
        payment_provider,
        payment_reference,
        restricted_credit: ["product_credit", "service_credit"].includes(credit.bucket),
        stores: ["SkyeSol", "SOLEnterprises.org"],
        ...meta,
      },
    }));
  }

  return { card, offer, entries: entries.filter(Boolean) };
}

export async function getSkyeCardSummary(customerId) {
  const card = await getActiveSkyeCard(customerId);
  if (!card) return null;
  const rows = await q(
    `select bucket,
            coalesce(sum(case when direction='credit' and (expires_at is null or expires_at > now()) then amount_cents else 0 end),0)::int as credits_cents,
            coalesce(sum(case when direction='debit' then amount_cents else 0 end),0)::int as debits_cents,
            coalesce(sum(case when direction='credit' and (expires_at is null or expires_at > now()) then unit_count else 0 end),0)::int as credit_units,
            coalesce(sum(case when direction='debit' then unit_count else 0 end),0)::int as debit_units
     from skye_card_ledger
     where card_id=$1
     group by bucket`,
    [card.card_id]
  );
  const balances = {};
  for (const row of rows.rows) {
    const available = Math.max(0, (row.credits_cents || 0) - (row.debits_cents || 0));
    const capped = row.bucket === "product_credit" ? Math.min(available, card.product_stack_cap_cents || 25000) : available;
    balances[row.bucket] = {
      credits_cents: row.credits_cents || 0,
      debits_cents: row.debits_cents || 0,
      available_cents: capped,
      credit_units: row.credit_units || 0,
      debit_units: row.debit_units || 0,
      available_units: Math.max(0, (row.credit_units || 0) - (row.debit_units || 0)),
    };
  }
  return { card, balances, policy: cardTypeConfig(card.card_type), offers: Object.values(SKYE_CARD_OFFERS) };
}
