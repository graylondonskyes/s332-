import { prisma } from "@/lib/db";
import { requireAccountUser } from "@/lib/auth";
import { ok } from "@/lib/http";

export async function GET() {
  const user = await requireAccountUser();
  const events = await prisma.messageEvent.findMany({
    where: { accountId: user.accountId! },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok(events);
}
