import type { SavedPromptPackRecord, SourceRecord } from '../db.ts';

export type ReplayAnswerInput = {
  provider: string;
  prompt: string;
  answerText: string;
};

export type ReplaySummary = {
  brandMentioned: boolean;
  ownedCitationCount: number;
  competitorMentionCount: number;
  mentionedCompetitors: string[];
  citedOwnedUrls: string[];
  scores: {
    mentionShare: number;
    citationShare: number;
    competitorOverlap: number;
  };
};

function lower(value: string): string {
  return value.toLowerCase();
}

export function evaluateReplay(input: {
  promptPack: SavedPromptPackRecord;
  answer: ReplayAnswerInput;
  ownedSources: SourceRecord[];
}): ReplaySummary {
  const pack = input.promptPack.result as { competitors?: string[]; brand?: string; prompts?: Array<{ provider?: string; prompt?: string }> };
  const brand = (pack.brand || input.promptPack.brand || '').trim();
  const competitors = ((pack.competitors || []) as string[]).map((item) => item.trim()).filter(Boolean);
  const answerLower = lower(input.answer.answerText);
  const ownedUrls = input.ownedSources.map((source) => source.canonicalUrl || source.sourceUrl).filter(Boolean) as string[];
  const citedOwnedUrls = ownedUrls.filter((url) => answerLower.includes(lower(url)));
  const mentionedCompetitors = competitors.filter((name) => answerLower.includes(lower(name)));
  const brandMentioned = brand ? answerLower.includes(lower(brand)) : false;
  const promptCount = ((input.promptPack.result as any).prompts || []).length || 1;
  const mentionShare = brandMentioned ? 1 : 0;
  const citationShare = Math.min(1, citedOwnedUrls.length / Math.max(1, input.ownedSources.length));
  const competitorOverlap = mentionedCompetitors.length / Math.max(1, competitors.length || promptCount);
  return {
    brandMentioned,
    ownedCitationCount: citedOwnedUrls.length,
    competitorMentionCount: mentionedCompetitors.length,
    mentionedCompetitors,
    citedOwnedUrls,
    scores: {
      mentionShare,
      citationShare,
      competitorOverlap
    }
  };
}

export function summarizeVisibilityRuns(runs: Array<{ result: Record<string, unknown> }>): {
  totalRuns: number;
  averageMentionShare: number;
  averageCitationShare: number;
  averageCompetitorOverlap: number;
} {
  const totalRuns = runs.length;
  if (totalRuns === 0) {
    return { totalRuns: 0, averageMentionShare: 0, averageCitationShare: 0, averageCompetitorOverlap: 0 };
  }
  const totals = runs.reduce((acc, run) => {
    const scores = (run.result.scores || {}) as Record<string, unknown>;
    acc.mention += Number(scores.mentionShare || 0);
    acc.citation += Number(scores.citationShare || 0);
    acc.overlap += Number(scores.competitorOverlap || 0);
    return acc;
  }, { mention: 0, citation: 0, overlap: 0 });
  return {
    totalRuns,
    averageMentionShare: totals.mention / totalRuns,
    averageCitationShare: totals.citation / totalRuns,
    averageCompetitorOverlap: totals.overlap / totalRuns
  };
}
