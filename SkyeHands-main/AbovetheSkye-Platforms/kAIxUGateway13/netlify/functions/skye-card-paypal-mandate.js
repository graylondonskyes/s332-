import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest, getBearer } from "./_lib/http.js";
import { resolveAuth } from "./_lib/authz.js";
import { audit } from "./_lib/audit.js";
import { cardTypeConfig, issueSkyeCard } from "./_lib/skyecards.js";

/**
 * Registers a PayPal recurring-payment mandate reference and issues a SkyeCard.
 * PayPal's hosted agreement approval can be handled by the product UI; SkyGate
 * owns the mandate record and credit issuance after a reference is returned.
 */
export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const token = getBearer(req);
  if (!token) return json(401, { error: "Missing Authorization" }, cors);

  const keyRow = await resolveAuth(token);
  if (!keyRow) return json(401, { error: "Invalid or revoked key" }, cors);
  if (!keyRow.is_active) return json(403, { error: "Customer disabled" }, cors);

  let body;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON", cors); }

  const mandateReference = String(body.mandate_reference || body.paypal_billing_agreement_id || "").trim();
  if (!mandateReference) return badRequest("Missing PayPal mandate reference", cors);

  const cfg = cardTypeConfig(body.card_type || "dev_starter");
  const card = await issueSkyeCard({
    customer_id: keyRow.customer_id,
    card_type: cfg.card_type,
    payment_provider: "paypal",
    mandate_reference: mandateReference,
    setup_status: "complete",
    recurring_amount_cents: parseInt(body.recurring_amount_cents || 0, 10) || 0,
    meta: {
      source: "paypal_mandate_registration",
      customer_email: keyRow.customer_email || null,
      paypal_order_id: body.paypal_order_id || null,
    },
  });

  await audit("customer", "SKYE_CARD_SETUP_PAYPAL", `customer:${keyRow.customer_id}`, {
    card_id: card.card_id,
    card_type: card.card_type,
    mandate_reference: mandateReference,
  });

  return json(200, { ok: true, card }, cors);
});
