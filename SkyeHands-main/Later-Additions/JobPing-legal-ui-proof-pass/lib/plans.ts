export type PlanKey = "starter" | "growth" | "pro";

export const JOBPING_PLANS: Record<PlanKey, {
  name: string;
  monthlyPrice: number;
  setupFee: number;
  includedSmsSegments: number;
  smsOverageCents: number;
  includedAiActions: number;
  users: string;
  locations: string;
  description: string;
}> = {
  starter: {
    name: "Starter",
    monthlyPrice: 99,
    setupFee: 199,
    includedSmsSegments: 500,
    smsOverageCents: 4,
    includedAiActions: 100,
    users: "1 user",
    locations: "1 location",
    description: "Lead response, follow-ups, review requests, and email fallback."
  },
  growth: {
    name: "Growth",
    monthlyPrice: 179,
    setupFee: 299,
    includedSmsSegments: 1500,
    smsOverageCents: 3.5,
    includedAiActions: 300,
    users: "3 users",
    locations: "1 location",
    description: "Higher SMS volume, imports/exports, retry tools, and priority support."
  },
  pro: {
    name: "Pro",
    monthlyPrice: 299,
    setupFee: 499,
    includedSmsSegments: 4000,
    smsOverageCents: 3,
    includedAiActions: 1000,
    users: "5 users",
    locations: "Multi-location ready",
    description: "Multi-location workflows, advanced reporting, and done-for-you setup."
  }
};

export function getPlan(planName?: string | null) {
  const normalized = String(planName || "starter").toLowerCase();
  if (normalized.includes("pro")) return JOBPING_PLANS.pro;
  if (normalized.includes("growth")) return JOBPING_PLANS.growth;
  return JOBPING_PLANS.starter;
}
