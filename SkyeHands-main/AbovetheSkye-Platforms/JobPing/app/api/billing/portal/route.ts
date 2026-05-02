import { requireAccountUser } from "@/lib/auth";
import { createStripePortalSession } from "@/lib/billing/stripe";
import { badRequest, ok } from "@/lib/http";

export async function POST(request: Request) {
  const user = await requireAccountUser();
  const customerId = user.account?.subscription?.providerCustomerId;
  if (!customerId) return badRequest("No Stripe customer id is stored for this account yet. Start checkout first.");
  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const portal = await createStripePortalSession({ customerId, returnUrl: `${origin}/billing` });
  return ok({ portalUrl: portal.url, portalId: portal.id });
}
