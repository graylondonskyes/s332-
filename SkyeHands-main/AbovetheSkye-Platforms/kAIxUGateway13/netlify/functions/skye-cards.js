import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest, getBearer, monthKeyUTC } from "./_lib/http.js";
import { resolveAuth } from "./_lib/authz.js";
import { audit } from "./_lib/audit.js";
import {
  applyMonthlySkyeCardBenefits,
  applySkyeCardOffer,
  getActiveSkyeCard,
  getSkyeCardSummary,
  issueSkyeCard,
  offerConfig,
  spendSkyeCard,
} from "./_lib/skyecards.js";

/**
 * SkyeCards are internal stored-value usage cards layered on top of the existing
 * kAIxu token/key system. They are not external bank cards.
 */
export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });

  const token = getBearer(req);
  if (!token) return json(401, { error: "Missing Authorization" }, cors);

  const keyRow = await resolveAuth(token);
  if (!keyRow) return json(401, { error: "Invalid or revoked key" }, cors);
  if (!keyRow.is_active) return json(403, { error: "Customer disabled" }, cors);

  if (req.method === "GET") {
    const summary = await getSkyeCardSummary(keyRow.customer_id);
    return json(200, { ok: true, has_card: Boolean(summary), ...summary }, cors);
  }

  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  let body;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON", cors); }

  const action = String(body.action || "issue").trim();

  if (action === "issue") {
    try {
      const card = await issueSkyeCard({
        customer_id: keyRow.customer_id,
        card_type: body.card_type || "dev_starter",
        payment_provider: body.payment_provider || "stripe",
        mandate_reference: body.mandate_reference || "",
        setup_status: body.setup_status || "complete",
        recurring_amount_cents: parseInt(body.recurring_amount_cents || 0, 10) || 0,
        meta: { issued_by: "self_serve", customer_email: keyRow.customer_email || null },
      });
      await audit("customer", "SKYE_CARD_ISSUED", `customer:${keyRow.customer_id}`, { card_id: card.card_id, card_type: card.card_type });
      const summary = await getSkyeCardSummary(keyRow.customer_id);
      return json(200, { ok: true, ...summary }, cors);
    } catch (err) {
      return json(err.status || 500, { ok: false, error: err.message, code: err.code || "SKYE_CARD_ISSUE_FAILED" }, cors);
    }
  }

  if (action === "monthly-benefits") {
    const card = await getActiveSkyeCard(keyRow.customer_id);
    if (!card) return json(404, { ok: false, error: "No active SkyeCard" }, cors);
    const month = String(body.month || monthKeyUTC()).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return badRequest("Invalid month", cors);
    const credits = await applyMonthlySkyeCardBenefits(card, month);
    await audit("customer", "SKYE_CARD_MONTHLY_BENEFITS", `customer:${keyRow.customer_id}`, { card_id: card.card_id, month, credits: credits.length });
    const summary = await getSkyeCardSummary(keyRow.customer_id);
    return json(200, { ok: true, credits_applied: credits.length, ...summary }, cors);
  }

  if (action === "redeem-offer") {
    try {
      const result = await applySkyeCardOffer({
        customer_id: keyRow.customer_id,
        offer_id: String(body.offer_id || ""),
        payment_provider: body.payment_provider || "manual",
        payment_reference: body.payment_reference || body.reference || "",
        meta: { redeemed_by: "self_serve", customer_email: keyRow.customer_email || null },
      });
      await audit("customer", "SKYE_CARD_OFFER_REDEEMED", `customer:${keyRow.customer_id}`, {
        card_id: result.card.card_id,
        offer_id: result.offer.offer_id,
        entries: result.entries.length,
      });
      const summary = await getSkyeCardSummary(keyRow.customer_id);
      return json(200, { ok: true, offer: result.offer, entries: result.entries, ...summary }, cors);
    } catch (err) {
      return json(err.status || 500, { ok: false, error: err.message, code: err.code || "SKYE_CARD_OFFER_FAILED" }, cors);
    }
  }

  if (action === "offer") {
    const offer = offerConfig(body.offer_id || "");
    if (!offer) return badRequest("Unknown offer_id", cors);
    return json(200, { ok: true, offer }, cors);
  }

  if (action === "spend") {
    const card = await getActiveSkyeCard(keyRow.customer_id);
    if (!card) return json(404, { ok: false, error: "No active SkyeCard" }, cors);
    try {
      const entry = await spendSkyeCard({
        card,
        bucket: String(body.bucket || "ai_usage"),
        amount_cents: parseInt(body.amount_cents, 10),
        unit_count: parseInt(body.unit_count || 0, 10) || 0,
        unit_type: body.unit_type || "cents",
        source: body.source || "usage",
        reference: body.reference || null,
        meta: body.meta || {},
      });
      await audit("customer", "SKYE_CARD_SPEND", `customer:${keyRow.customer_id}`, { card_id: card.card_id, bucket: entry.bucket, amount_cents: entry.amount_cents });
      const summary = await getSkyeCardSummary(keyRow.customer_id);
      return json(200, { ok: true, entry, ...summary }, cors);
    } catch (err) {
      return json(err.status || 500, { ok: false, error: err.message, code: err.code || "SKYE_CARD_SPEND_FAILED" }, cors);
    }
  }

  return badRequest("Unknown action. Use issue, monthly-benefits, spend, offer, or redeem-offer.", cors);
});
