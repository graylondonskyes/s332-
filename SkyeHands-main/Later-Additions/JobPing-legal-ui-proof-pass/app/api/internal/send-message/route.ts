import { ok, badRequest } from "@/lib/http";
import { assertInternalRequest } from "@/lib/internal-auth";
import { sendMessageEventById } from "@/lib/send-message-event";

export async function POST(request: Request) {
  const denied = assertInternalRequest(request);
  if (denied) return denied;

  const body = await request.json();
  const eventId = body.eventId as string | undefined;
  if (!eventId) return badRequest("eventId is required.");

  const result = await sendMessageEventById(eventId);
  if (!result.ok) return badRequest(result.reason, result.event);
  return ok(result.event);
}
