import { requireAccountUser } from "@/lib/auth";
import { ok } from "@/lib/http";
import { rotateAccountIntakeToken } from "@/lib/intake-token";
import { audit } from "@/lib/admin";

export async function POST() {
  const user = await requireAccountUser();
  const rotated = await rotateAccountIntakeToken(user.accountId!);
  await audit({ accountId: user.accountId!, actorUserId: user.id, action: "public_intake_token_rotated", details: { tokenLast4: rotated.last4 } });
  return ok({ token: rotated.token, tokenLast4: rotated.last4 });
}
