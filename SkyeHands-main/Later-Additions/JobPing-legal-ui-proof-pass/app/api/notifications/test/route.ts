import { requireAccountUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { created } from "@/lib/http";

export async function POST() {
  const user = await requireAccountUser();
  const recipient = user.account?.settings?.ownerAlertEmail || user.account?.settings?.notificationEmail || user.email;
  const event = await prisma.notificationEvent.create({ data: { accountId: user.accountId!, channel: "email", eventType: "notification.test", status: "queued", recipient, subject: "JobPing alert test", bodySnapshot: "This confirms JobPing can queue support and operational alerts for this account." } });
  return created(event);
}
