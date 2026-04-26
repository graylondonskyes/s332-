import { unauthorized } from "@/lib/http";

export function assertInternalRequest(request: Request) {
  const secret = process.env.INTERNAL_CRON_SECRET;
  if (!secret) throw new Error("INTERNAL_CRON_SECRET is required for internal automation routes.");
  const header = request.headers.get("x-jobping-internal-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (header !== secret) return unauthorized("Unauthorized internal request.");
  return null;
}
