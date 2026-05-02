import { requireAccountUser } from "@/lib/auth";
import { ok } from "@/lib/http";
import { getAccountUsage } from "@/lib/usage";

export async function GET() {
  const user = await requireAccountUser();
  const usage = await getAccountUsage(user.accountId!);
  return ok(usage);
}
