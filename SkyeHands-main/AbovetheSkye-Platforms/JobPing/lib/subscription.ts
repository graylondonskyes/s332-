import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export function canUseProduct(status: SubscriptionStatus | undefined) {
  return status === "trial" || status === "active";
}

export async function getAccountAccess(accountId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { accountId } });
  const allowed = canUseProduct(subscription?.status);
  return {
    allowed,
    status: subscription?.status ?? "canceled",
    reason: allowed ? null : `Subscription is ${subscription?.status ?? "missing"}. Operational sends are blocked.`,
  };
}
