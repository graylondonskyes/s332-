import { prisma } from "@/lib/db";
import { badRequest, ok, unauthorized } from "@/lib/http";
import { mapStripeSubscriptionStatus, verifyStripeWebhookSignature } from "@/lib/billing/stripe";

function getAccountIdFromStripeEvent(event: any): string | undefined {
  return event?.data?.object?.metadata?.account_id || event?.data?.object?.subscription_details?.metadata?.account_id;
}

async function resolveAccountId(event: any): Promise<string | undefined> {
  const direct = getAccountIdFromStripeEvent(event);
  if (direct) return direct;
  const object = event?.data?.object || {};
  const subscriptionId = object.subscription || object.id;
  const customerId = object.customer;
  if (subscriptionId) {
    const sub = await prisma.subscription.findFirst({ where: { providerSubscriptionId: String(subscriptionId) }, select: { accountId: true } });
    if (sub?.accountId) return sub.accountId;
  }
  if (customerId) {
    const sub = await prisma.subscription.findFirst({ where: { providerCustomerId: String(customerId) }, select: { accountId: true } });
    if (sub?.accountId) return sub.accountId;
  }
  return undefined;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature) return unauthorized("Missing Stripe signature header.");
  if (!secret) return unauthorized("Stripe webhook secret is missing. Set STRIPE_WEBHOOK_SECRET.");
  if (!verifyStripeWebhookSignature(rawBody, signature, secret)) return unauthorized("Invalid Stripe webhook signature.");

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return badRequest("Invalid Stripe webhook JSON.");
  }

  const object = event?.data?.object || {};
  const accountId = await resolveAccountId(event);
  if (!accountId) return badRequest("Stripe event could not be matched to a JobPing account. Ensure checkout sessions include account_id metadata.");

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return badRequest("Stripe event account_id does not match a JobPing account.");

  if (event.id) {
    const existing = await prisma.billingEvent.findUnique({ where: { providerEventId: event.id } }).catch(() => null);
    if (existing) return ok({ received: true, duplicate: true, accountId, eventType: event.type });
  }

  try {
    await prisma.billingEvent.create({
      data: { accountId, eventType: event.type || "stripe.event", providerEventId: event.id, payloadJson: event },
    });
  } catch (error: any) {
    if (error?.code === "P2002") return ok({ received: true, duplicate: true, accountId, eventType: event.type });
    throw error;
  }

  if (["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed", "invoice.payment_succeeded"].includes(event.type)) {
    const stripeStatus = event.type === "invoice.payment_failed" ? "past_due" : object.status || (event.type === "checkout.session.completed" || event.type === "invoice.payment_succeeded" ? "active" : undefined);
    const mappedStatus = event.type === "customer.subscription.deleted" ? "canceled" : mapStripeSubscriptionStatus(stripeStatus);
    await prisma.subscription.upsert({
      where: { accountId },
      create: {
        accountId,
        provider: "stripe",
        providerCustomerId: object.customer ? String(object.customer) : null,
        providerSubscriptionId: object.subscription ? String(object.subscription) : object.id ? String(object.id) : null,
        planName: "jobping_starter",
        status: mappedStatus as any,
        currentPeriodStart: object.current_period_start ? new Date(object.current_period_start * 1000) : null,
        currentPeriodEnd: object.current_period_end ? new Date(object.current_period_end * 1000) : null,
        canceledAt: object.canceled_at ? new Date(object.canceled_at * 1000) : null,
      },
      update: {
        provider: "stripe",
        providerCustomerId: object.customer ? String(object.customer) : undefined,
        providerSubscriptionId: object.subscription ? String(object.subscription) : object.id ? String(object.id) : undefined,
        status: mappedStatus as any,
        currentPeriodStart: object.current_period_start ? new Date(object.current_period_start * 1000) : undefined,
        currentPeriodEnd: object.current_period_end ? new Date(object.current_period_end * 1000) : undefined,
        canceledAt: object.canceled_at ? new Date(object.canceled_at * 1000) : null,
      },
    });
  }

  return ok({ received: true, accountId, eventType: event.type });
}
