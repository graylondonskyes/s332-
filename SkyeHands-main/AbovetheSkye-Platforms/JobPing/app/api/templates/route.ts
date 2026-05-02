import { prisma } from "@/lib/db";
import { requireAccountUser } from "@/lib/auth";
import { ok } from "@/lib/http";

export async function GET() {
  const user = await requireAccountUser();
  const templates = await prisma.messageTemplate.findMany({
    where: { accountId: user.accountId! },
    orderBy: { templateType: "asc" },
  });
  return ok(templates);
}
