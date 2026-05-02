import { requireAccountUser } from "@/lib/auth";
import { getOptionalEnv } from "@/lib/env";
import { ok } from "@/lib/http";
import { ensureAccountIntakeToken } from "@/lib/intake-token";

export async function GET() {
  const user = await requireAccountUser();
  const baseUrl = getOptionalEnv("NEXT_PUBLIC_APP_URL") || "https://your-jobping-domain.example";
  const tokenState = await ensureAccountIntakeToken(user.accountId!);
  const token = tokenState.token || "COPY-FRESH-TOKEN-FROM-THIS-ENDPOINT";
  const snippet = `<form method="post" action="${baseUrl}/api/public/leads" data-jobping-lead-form>\n  <input type="hidden" name="intakeToken" value="${token}" />\n  <input name="firstName" placeholder="First name" required />\n  <input name="phone" placeholder="Phone" required />\n  <input name="email" placeholder="Email" />\n  <input name="serviceType" placeholder="Service needed" />\n  <textarea name="notes" placeholder="Tell us what you need"></textarea>\n  <label><input type="checkbox" name="smsConsent" required /> I agree to receive follow-up messages about my request.</label>\n  <button type="submit">Request a callback</button>\n</form>`;
  return ok({ snippet, tokenShownOnce: Boolean(tokenState.token), tokenLast4: tokenState.last4 });
}
