"use server";

import { revalidatePath } from "next/cache";
import { SubscriptionStatus } from "@prisma/client";
import { requireAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/db";

export async function updateSubscriptionStatus(formData: FormData) {
  await requireAdminUser();
  const accountId = String(formData.get("accountId") || "");
  const status = String(formData.get("status") || "");
  if (!accountId || !Object.values(SubscriptionStatus).includes(status as SubscriptionStatus)) {
    throw new Error("Invalid account/status payload.");
  }

  await prisma.subscription.upsert({
    where: { accountId },
    update: { status: status as SubscriptionStatus, provider: "manual", planName: "starter" },
    create: { accountId, status: status as SubscriptionStatus, provider: "manual", planName: "starter" },
  });

  await prisma.billingEvent.create({
    data: {
      accountId,
      eventType: "admin.subscription_status_changed",
      payloadJson: { status, source: "support_console" },
    },
  });

  revalidatePath("/admin");
}

export async function cancelFailedFutureSends(formData: FormData) {
  await requireAdminUser();
  const accountId = String(formData.get("accountId") || "");
  if (!accountId) throw new Error("accountId is required.");

  const pending = await prisma.messageEvent.findMany({
    where: { accountId, status: { in: ["queued", "scheduled", "retrying"] } },
    select: { id: true },
  });

  await prisma.messageEvent.updateMany({
    where: { accountId, status: { in: ["queued", "scheduled", "retrying"] } },
    data: { status: "canceled", failureReason: "Canceled by support console.", updatedAt: new Date() },
  });

  await prisma.usageLedger.updateMany({
    where: { accountId, usageType: "sms_segment", status: "reserved", reservationKey: { in: pending.map((event) => event.id) } },
    data: { status: "released", releasedAt: new Date(), note: "released_after_support_console_cancel" },
  });

  await prisma.billingEvent.create({
    data: {
      accountId,
      eventType: "admin.pending_sends_canceled",
      payloadJson: { source: "support_console", canceledCount: pending.length },
    },
  });

  revalidatePath("/admin");
}
