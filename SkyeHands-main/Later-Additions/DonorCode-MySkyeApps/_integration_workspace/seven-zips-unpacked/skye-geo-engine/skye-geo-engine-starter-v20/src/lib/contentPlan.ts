import type { SiteAuditResult } from "./audit.ts";

export type ContentPlanRequest = {
  brand: string;
  niche: string;
  audience: string;
  primaryGoal?: string;
  country?: string;
  language?: string;
  url?: string;
  competitors?: string[];
  painPoints?: string[];
  offers?: string[];
};

export type ContentPlanItem = {
  day: number;
  week: number;
  title: string;
  format: "how-to" | "comparison" | "faq" | "listicle" | "template" | "case-study" | "problem-solution" | "checklist" | "landing-page" | "integration";
  intent: "awareness" | "consideration" | "decision" | "retention";
  targetKeyword: string;
  angle: string;
  suggestedSchema: string;
  callToAction: string;
};

const formatCycle: ContentPlanItem["format"][] = [
  "how-to",
  "comparison",
  "faq",
  "listicle",
  "template",
  "case-study",
  "problem-solution",
  "checklist",
  "landing-page",
  "integration"
];

const schemaByFormat: Record<ContentPlanItem["format"], string> = {
  "how-to": "HowTo",
  "comparison": "Article",
  "faq": "FAQPage",
  "listicle": "ItemList",
  "template": "CreativeWork",
  "case-study": "Article",
  "problem-solution": "Article",
  "checklist": "HowTo",
  "landing-page": "WebPage",
  "integration": "TechArticle"
};

const intents: ContentPlanItem["intent"][] = ["awareness", "consideration", "decision", "awareness", "decision"];

function pick<T>(array: T[], index: number): T {
  return array[index % array.length];
}

function competitorsLabel(competitors: string[]): string {
  if (competitors.length === 0) return "other tools";
  if (competitors.length === 1) return competitors[0];
  return `${competitors[0]} and alternatives`;
}

export function generateContentPlan(input: ContentPlanRequest, audit?: SiteAuditResult | null): { summary: string; items: ContentPlanItem[] } {
  const brand = input.brand.trim();
  const niche = input.niche.trim();
  const audience = input.audience.trim();
  const goal = input.primaryGoal?.trim() || "increase qualified organic traffic";
  const country = input.country?.trim() || "your market";
  const language = input.language?.trim() || "English";
  const competitors = (input.competitors || []).map((x) => x.trim()).filter(Boolean);
  const painPoints = (input.painPoints || []).map((x) => x.trim()).filter(Boolean);
  const offers = (input.offers || []).map((x) => x.trim()).filter(Boolean);

  const contentSeeds = [
    `${niche} strategy`,
    `${niche} pricing`,
    `${niche} alternatives`,
    `${niche} checklist`,
    `${niche} examples`,
    `${niche} best practices`,
    `${niche} workflow`,
    `${niche} implementation`,
    `${niche} software`,
    `${niche} guide`
  ];

  const auditAngles = audit?.issues.slice(0, 5).map((issue) => issue.recommendation) || [];
  const pain = painPoints.length ? painPoints : [
    `slow results in ${niche}`,
    `manual workflows for ${niche}`,
    `difficulty proving ROI to ${audience}`,
    `low visibility in ${country}`
  ];
  const offer = offers.length ? offers : [
    `${brand} platform`,
    `${brand} audit`,
    `${brand} content engine`,
    `${brand} agency workflow`
  ];

  const items: ContentPlanItem[] = Array.from({ length: 30 }, (_, idx) => {
    const day = idx + 1;
    const week = Math.floor(idx / 7) + 1;
    const format = pick(formatCycle, idx);
    const intent = pick(intents, idx);
    const keyword = pick(contentSeeds, idx);
    const painLine = pick(pain, idx);
    const offerLine = pick(offer, idx);
    const competitorLine = competitorsLabel(competitors);
    const titles: Record<ContentPlanItem["format"], string> = {
      "how-to": `How ${audience} can improve ${keyword} in ${country}`,
      "comparison": `${brand} vs ${competitorLine}: which approach wins for ${niche}?`,
      "faq": `${niche} FAQ: what ${audience} ask before they buy`,
      "listicle": `Top ${Math.min(12, 7 + week)} ${keyword} tactics that actually move results`,
      "template": `${niche} template pack for ${audience}: brief, workflow, and reporting`,
      "case-study": `How teams use ${offerLine} to fix ${painLine}`,
      "problem-solution": `Why ${painLine} happens and how to fix it`,
      "checklist": `${niche} checklist for teams that want ${goal}`,
      "landing-page": `${brand} for ${audience}: ${niche} built to ${goal}`,
      "integration": `${brand} integration guide: connect ${niche} workflows without friction`
    };

    return {
      day,
      week,
      title: titles[format],
      format,
      intent,
      targetKeyword: keyword,
      angle: auditAngles[idx % Math.max(1, auditAngles.length)] || `Focus on ${painLine} with a ${language}-ready, citation-backed angle.`,
      suggestedSchema: schemaByFormat[format],
      callToAction: `Invite readers to ${goal} with ${offerLine}.`
    };
  });

  const summary = `${brand} gets a 30-day plan focused on ${goal} for ${audience} in ${country}. The mix leans into ${language} content, commercial-intent comparisons, educational how-to posts, FAQ coverage, and conversion pages. ${audit ? `The current site audit score is ${audit.score}, so the plan also addresses technical gaps and thin-content signals.` : "Add a site URL to tighten the plan around live technical gaps."}`;

  return { summary, items };
}
