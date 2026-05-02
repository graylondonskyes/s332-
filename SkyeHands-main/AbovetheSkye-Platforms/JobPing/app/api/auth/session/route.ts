import { getCurrentUser } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/http";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return ok({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    accountId: user.accountId,
  });
}
