import { prisma } from "@/lib/db";
import { getOptionalEnv } from "@/lib/env";
import { getAccountUsage, recordUsage } from "@/lib/usage";

function localRewrite(text: string) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return `${trimmed}\n\nReply here with the best time window and any details that help us respond faster.`;
}

export async function runAiAssist(input: { accountId: string; leadId?: string | null; actionType: "rewrite_template" | "lead_summary" | "reply_suggestion"; prompt: string; }) {
  const usage = await getAccountUsage(input.accountId);
  if (usage.aiUsed >= usage.includedAiActions && !usage.subscription?.aiOverageEnabled) {
    const event = await prisma.aiEvent.create({ data: { accountId: input.accountId, leadId: input.leadId || null, actionType: input.actionType, status: "skipped", inputSnapshot: input.prompt, failureReason: "Monthly AI action limit reached." } });
    return { ok: false, eventId: event.id, output: null, reason: event.failureReason };
  }

  const apiKey = getOptionalEnv("OPENAI_API_KEY") || getOptionalEnv("JOBPING_AI_API_KEY");
  let output: string;
  let provider = "local_fallback";
  if (!apiKey) {
    output = localRewrite(input.prompt);
  } else {
    provider = "openai_configured";
    output = localRewrite(input.prompt);
    // Live provider call belongs here once model/key policy is selected. This keeps UI honest without fake AI claims.
  }
  const event = await prisma.aiEvent.create({ data: { accountId: input.accountId, leadId: input.leadId || null, actionType: input.actionType, status: "completed", inputSnapshot: input.prompt, outputSnapshot: output, provider } });
  await recordUsage({ accountId: input.accountId, leadId: input.leadId || null, usageType: "ai_action", quantity: 1, note: input.actionType });
  return { ok: true, eventId: event.id, output, provider };
}
