import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest, getBearer } from "./_lib/http.js";
import { resolveAuth } from "./_lib/authz.js";
import { cardTypeConfig } from "./_lib/skyecards.js";

/**
 * Creates a Stripe Checkout setup session so SkyeCard credit is backed by a
 * recurring-payment mandate without charging upfront.
 */
export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const token = getBearer(req);
  if (!token) return json(401, { error: "Missing Authorization" }, cors);

  const keyRow = await resolveAuth(token);
  if (!keyRow) return json(401, { error: "Invalid or revoked key" }, cors);

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return json(501, { error: "Stripe not configured (missing STRIPE_SECRET_KEY)" }, cors);

  let body;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON", cors); }

  const cardType = String(body.card_type || "dev_starter");
  const cfg = cardTypeConfig(cardType);
  const origin = req.headers.get("origin") || process.env.PUBLIC_APP_ORIGIN || "";
  const success_url = body.success_url || process.env.SKYE_CARD_SUCCESS_URL || (origin ? `${origin}/gateway/dashboard.html?skyecard=setup-success` : "");
  const cancel_url = body.cancel_url || process.env.SKYE_CARD_CANCEL_URL || (origin ? `${origin}/gateway/dashboard.html?skyecard=setup-cancel` : "");
  if (!success_url || !cancel_url) return badRequest("Missing success/cancel URL", cors);

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(secret, { apiVersion: "2024-06-20" });
  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer_email: keyRow.customer_email || undefined,
    success_url,
    cancel_url,
    payment_method_types: ["card"],
    metadata: {
      purpose: "skye_card_setup",
      customer_id: String(keyRow.customer_id),
      card_type: cfg.card_type,
      upfront_usage_cents: String(cfg.upfront_usage_cents),
      monthly_ai_cents: String(cfg.monthly_ai_cents),
      monthly_product_cents: String(cfg.monthly_product_cents),
    },
  });

  return json(200, { ok: true, id: session.id, url: session.url, card_type: cfg.card_type }, cors);
});
