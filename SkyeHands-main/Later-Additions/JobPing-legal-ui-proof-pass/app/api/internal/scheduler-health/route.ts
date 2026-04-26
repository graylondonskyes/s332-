import { ok } from "@/lib/http";
import { assertInternalRequest } from "@/lib/internal-auth";
import { getSchedulerHealth } from "@/lib/scheduler-lock";

export async function GET(request: Request) {
  const denied = assertInternalRequest(request);
  if (denied) return denied;
  return ok(await getSchedulerHealth("due-messages"));
}
