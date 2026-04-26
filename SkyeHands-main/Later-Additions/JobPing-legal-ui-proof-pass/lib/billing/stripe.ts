import { createHmac, timingSafeEqual } from "node:crypto";
import { getOptionalEnv } from "@/lib/env";

export type StripeCheckoutSession = { id: string; url: string | null };
export type StripePortalSession = { id: string; url: string | null };

export async function createStripeCheckoutSession(input: { accountId: string; userEmail: string; priceId: string; successUrl: string; cancelUrl: string; }): Promise<StripeCheckoutSession> {
  const secretKey = getOptionalEnv("STRIPE_SECRET_KEY");
  if (!secretKey) throw new Error("Stripe secret key is missing. Set STRIPE_SECRET_KEY.");
  const params = new URLSearchParams({ mode: "subscription", "line_items[0][price]": input.priceId, "line_items[0][quantity]": "1", customer_email: input.userEmail, success_url: input.successUrl, cancel_url: input.cancelUrl, "metadata[account_id]": input.accountId, "subscription_data[metadata][account_id]": input.accountId, allow_promotion_codes: "true" });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(json.error?.message || `Stripe checkout failed with HTTP ${response.status}.`));
  return { id: json.id, url: json.url ?? null };
}

export async function createStripePortalSession(input: { customerId: string; returnUrl: string; }): Promise<StripePortalSession> {
  const secretKey = getOptionalEnv("STRIPE_SECRET_KEY");
  if (!secretKey) throw new Error("Stripe secret key is missing. Set STRIPE_SECRET_KEY.");
  if (!input.customerId) throw new Error("Stripe customer id is missing. Complete checkout before opening the customer portal.");
  const params = new URLSearchParams({ customer: input.customerId, return_url: input.returnUrl });
  const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", { method: "POST", headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString() });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(json.error?.message || `Stripe portal failed with HTTP ${response.status}.`));
  return { id: json.id, url: json.url ?? null };
}

export function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string, secret: string, toleranceSeconds = 300) {
  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => { const [key, value] = part.split("="); return [key, value]; }));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function mapStripeSubscriptionStatus(status?: string) {
  if (status === "active" || status === "trialing") return status === "trialing" ? "trial" : "active";
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return "past_due";
  return "canceled";
}
