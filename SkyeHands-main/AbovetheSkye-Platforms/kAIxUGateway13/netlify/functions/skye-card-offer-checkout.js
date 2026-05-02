import { wrap } from "./_lib/wrap.js";
import { buildCors, json, badRequest, getBearer } from "./_lib/http.js";
import { resolveAuth } from "./_lib/authz.js";
import { getActiveSkyeCard, offerConfig } from "./_lib/skyecards.js";

/**
 * Creates one-time Stripe checkouts for SkyeCard currency packs.
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

  const card = await getActiveSkyeCard(keyRow.customer_id);
  if (!card) return json(409, { error: "Active SkyeCard required before buying currency packs", code: "SKYECARD_REQUIRED" }, cors);

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return json(501, { error: "Stripe not configured (missing STRIPE_SECRET_KEY)" }, cors);

  let body;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON", cors); }

  const offer = offerConfig(body.offer_id || "");
  if (!offer) return badRequest("Unknown offer_id", cors);

  const origin = req.headers.get("origin") || process.env.PUBLIC_APP_ORIGIN || "";
  const success_url = body.success_url || process.env.SKYE_CARD_SUCCESS_URL || (origin ? `${origin}/gateway/dashboard.html?skyecard=offer-success` : "");
  const cancel_url = body.cancel_url || process.env.SKYE_CARD_CANCEL_URL || (origin ? `${origin}/gateway/dashboard.html?skyecard=offer-cancel` : "");
  if (!success_url || !cancel_url) return badRequest("Missing success/cancel URL", cors);

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(secret, { apiVersion: "2024-06-20" });
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: keyRow.customer_email || undefined,
    success_url,
    cancel_url,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: process.env.STRIPE_CURRENCY || "usd",
          unit_amount: offer.price_cents,
          product_data: {
            name: offer.label,
            description: offer.description,
          },
        },
      },
    ],
    metadata: {
      purpose: "skye_card_offer",
      customer_id: String(keyRow.customer_id),
      card_id: card.card_id,
      offer_id: offer.offer_id,
      price_cents: String(offer.price_cents),
    },
  });

  return json(200, { ok: true, id: session.id, url: session.url, offer }, cors);
});
