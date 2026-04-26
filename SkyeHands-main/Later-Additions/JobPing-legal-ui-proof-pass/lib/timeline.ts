import { prisma } from "@/lib/db";

export async function appendTimelineEvent(input: {
  accountId: string;
  leadId: string;
  eventType: string;
  eventLabel: string;
  eventPayloadJson?: Record<string, unknown>;
  createdByUserId?: string;
}) {
  return prisma.leadTimelineEvent.create({
    data: input,
  });
}
