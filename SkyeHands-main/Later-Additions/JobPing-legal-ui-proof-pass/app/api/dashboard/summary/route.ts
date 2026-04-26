import { requireAccountUser } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/dashboard";
import { ok } from "@/lib/http";

export async function GET() {
  const user = await requireAccountUser();
  return ok(await getDashboardSummary(user.accountId!));
}
