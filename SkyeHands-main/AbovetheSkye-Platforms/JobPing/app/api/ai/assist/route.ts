import { requireAccountUser } from "@/lib/auth";
import { badRequest, ok } from "@/lib/http";
import { runAiAssist } from "@/lib/ai";
import { z } from "zod";

const schema = z.object({
  actionType: z.enum(["rewrite_template", "lead_summary", "reply_suggestion"]),
  prompt: z.string().min(3).max(5000),
  leadId: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await requireAccountUser();
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid AI assist payload", parsed.error.flatten());
  const result = await runAiAssist({ accountId: user.accountId!, ...parsed.data });
  return ok(result);
}
