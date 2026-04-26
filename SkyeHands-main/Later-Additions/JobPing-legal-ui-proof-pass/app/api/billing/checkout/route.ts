import { requireAccountUser } from "@/lib/auth";
import { badRequest, ok } from "@/lib/http";
import { createStripeCheckoutSession } from "@/lib/billing/stripe";

export async function POST(request: Request) {
  const user = await requireAccountUser();
  const priceId = process.env.STRIPE_PRICE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  if (!priceId) return badRequest("Stripe price ID is missing. Set STRIPE_PRICE_ID.");

  try {
    const session = await createStripeCheckoutSession({
      accountId: user.accountId!,
      userEmail: user.email,
      priceId,
      successUrl: `${appUrl}/billing?checkout=success`,
      cancelUrl: `${appUrl}/billing?checkout=cancelled`,
    });
    return ok({ checkoutSessionId: session.id, checkoutUrl: session.url });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Stripe checkout failed.");
  }
}
