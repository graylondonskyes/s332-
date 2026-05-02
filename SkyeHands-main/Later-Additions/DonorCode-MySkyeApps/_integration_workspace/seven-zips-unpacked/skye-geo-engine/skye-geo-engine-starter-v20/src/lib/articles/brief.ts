import type { SourceRecord } from '../db.ts';

export type ArticleBriefInput = {
  title: string;
  primaryKeyword: string;
  audience: string;
  goal: string;
  brand: string;
  sourceRows: SourceRecord[];
};

export function buildArticleBrief(input: ArticleBriefInput): { title: string; primaryKeyword: string; summary: string; outline: string[]; keyPoints: string[]; sourceSummaries: Array<{ sourceId: string; title: string; canonicalUrl: string | null }> } {
  const opening = input.sourceRows.slice(0, 3).map((source) => source.title).filter(Boolean);
  const outline = [
    `What ${input.audience} need to understand about ${input.primaryKeyword}`,
    `The main operational problems blocking ${input.goal}`,
    `A step-by-step execution framework using ${input.brand}`,
    `Implementation checklist and FAQs`,
    `Decision CTA for ${input.audience}`
  ];
  const keyPoints = [
    `Use the source ledger to ground every major claim for ${input.primaryKeyword}.`,
    `Frame the article around ${input.goal} rather than generic awareness copy.`,
    `Link the solution back to ${input.brand} without losing source provenance.`,
    `End with a concrete next step for ${input.audience}.`
  ];

  return {
    title: input.title,
    primaryKeyword: input.primaryKeyword,
    summary: `This brief targets ${input.audience} and aims to ${input.goal}. Source coverage starts from ${opening.join(', ') || 'the persisted research ledger'}.`,
    outline,
    keyPoints,
    sourceSummaries: input.sourceRows.map((source) => ({ sourceId: source.id, title: source.title, canonicalUrl: source.canonicalUrl }))
  };
}
