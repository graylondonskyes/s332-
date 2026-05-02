import type { ArticleClaimRecord, ArticleFaqRecord, ArticleRecord, ProjectRecord, SourceRecord, WorkspaceRecord, ArticleBriefRecord } from '../db.ts';
import { nowIso } from '../time.ts';
import { buildArticleEnrichmentPack, type ArticleEnrichmentPack } from './enrich.ts';
import { buildArticleReviewPack, type ArticleReviewIssue, type ArticleReviewPack } from './review.ts';

export type ArticleRemediationAction = {
  id: string;
  type: 'strengthen_intro' | 'expand_depth' | 'repair_claim' | 'expand_faq' | 'strengthen_cta';
  severity: 'high' | 'medium' | 'low';
  title: string;
  reason: string;
  before: string;
  after: string;
};

export type ArticleRemediationPack = {
  generatedAt: string;
  articleId: string;
  briefId: string;
  workspaceId: string;
  projectId: string | null;
  title: string;
  baselineReview: Pick<ArticleReviewPack, 'verdict' | 'overallScore' | 'issues' | 'publishReadiness' | 'metrics'>;
  actions: ArticleRemediationAction[];
  remediatedArticle: Pick<ArticleRecord, 'title' | 'slug' | 'bodyHtml' | 'jsonLd' | 'language' | 'tone' | 'callToAction' | 'infographicPrompt' | 'claimMap' | 'faqItems' | 'citations'>;
  predictedEnrichment: ArticleEnrichmentPack;
  predictedReview: ArticleReviewPack;
  scoreDelta: number;
  issueDelta: {
    baseline: number;
    remediated: number;
    removed: number;
  };
  notes: string[];
};

function htmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function stripTags(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clamp(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return normalized.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

function dedupeFaqItems(items: ArticleFaqRecord[]): ArticleFaqRecord[] {
  const seen = new Set<string>();
  const output: ArticleFaqRecord[] = [];
  for (const item of items) {
    const key = `${item.question.toLowerCase()}::${item.answer.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function buildIntroParagraph(brief: ArticleBriefRecord, workspace: WorkspaceRecord | null, sources: SourceRecord[]): string {
  const brand = workspace?.brand || workspace?.name || 'Skye GEO Engine';
  const sourceSummary = sources.slice(0, 2).map((source) => `${source.title} shows ${source.snippet}`).join(' ');
  return `${brand} remediation pass: this updated article is tightened for ${brief.primaryKeyword}, anchored to the stored source ledger, and structured to move operators from evidence review into publish-ready execution. ${sourceSummary}`.replace(/\s+/g, ' ').trim();
}

function buildEvidenceSections(brief: ArticleBriefRecord, sources: SourceRecord[]): { html: string; claims: ArticleClaimRecord[] } {
  const sections = sources.slice(0, 4).map((source, index) => {
    const heading = index === 0 ? 'Evidence-backed implementation lane' : index === 1 ? 'Operational proof point' : index === 2 ? 'Commercial continuity' : 'Launch guardrail';
    const claimText = `${source.title} confirms a real operating requirement for ${brief.primaryKeyword}: ${clamp(source.snippet || source.contentText || 'Stored evidence is present.', 220)}`;
    return {
      html: `<section data-remediation-source-id="${htmlEscape(source.id)}"><h2>${htmlEscape(heading)}</h2><p>${htmlEscape(claimText)}</p><p>${htmlEscape(`Source URL: ${source.canonicalUrl || source.sourceUrl || 'stored text evidence'}`)}</p></section>`,
      claim: { claimId: `remediation_claim_${index + 1}`, text: claimText, sourceIds: [source.id] } satisfies ArticleClaimRecord
    };
  });
  return {
    html: sections.map((item) => item.html).join('\n'),
    claims: sections.map((item) => item.claim)
  };
}

function buildRecoveryFaqs(brief: ArticleBriefRecord, sources: SourceRecord[]): ArticleFaqRecord[] {
  const sourceIds = sources.slice(0, 2).map((item) => item.id);
  return [
    {
      question: `How does ${brief.primaryKeyword} move from draft into a safer publish state?`,
      answer: 'It moves into a safer publish state when weak claims are replaced with source-backed statements, the article body is expanded with implementation detail, and the CTA points into a real next step instead of generic filler.',
      sourceIds
    },
    {
      question: `What should operators verify before pushing this article live?`,
      answer: 'Operators should verify evidence coverage, publish-gate verdicts, metadata carry-through, internal-link placement, and that the post-publish surface matches the reviewed version rather than an ad hoc edited version.',
      sourceIds: sourceIds.slice().reverse()
    }
  ];
}

function strengthenCallToAction(project: ProjectRecord | null, brief: ArticleBriefRecord, workspace: WorkspaceRecord | null): string {
  const brand = workspace?.brand || workspace?.name || 'Skye GEO Engine';
  const destination = project?.primaryUrl ? `Review the launch path at ${project.primaryUrl}.` : 'Use the project launch path already attached to this workspace.';
  return `Book the ${brief.primaryKeyword} remediation and publish review with ${brand} so the shipped article keeps its evidence coverage, structured metadata, and launch continuity. ${destination}`;
}

function summarizeIssues(issues: ArticleReviewIssue[]): string {
  if (!issues.length) return 'No review issues were detected.';
  return issues.map((item) => `${item.code}: ${item.message}`).join(' | ');
}

function createRemediatedArticle(input: {
  workspace: WorkspaceRecord | null;
  project: ProjectRecord | null;
  brief: ArticleBriefRecord;
  article: ArticleRecord;
  sources: SourceRecord[];
}): { actions: ArticleRemediationAction[]; article: ArticleRecord } {
  const { workspace, project, brief, article, sources } = input;
  const baselineReview = buildArticleReviewPack({ workspace, project, brief, article, sources });
  const actions: ArticleRemediationAction[] = [];
  const remediated: ArticleRecord = JSON.parse(JSON.stringify(article));

  const openingReplacement = buildIntroParagraph(brief, workspace, sources);
  remediated.bodyHtml = remediated.bodyHtml.replace(/<p>[\s\S]*?<\/p>/i, `<p>${htmlEscape(openingReplacement)}</p>`);
  actions.push({
    id: 'remediation_intro',
    type: 'strengthen_intro',
    severity: 'medium',
    title: 'Strengthen opening paragraph',
    reason: 'The introduction should immediately state why the article is evidence-backed and commercially relevant.',
    before: clamp(stripTags(article.bodyHtml).slice(0, 180), 180),
    after: clamp(openingReplacement, 180)
  });

  const evidenceSections = buildEvidenceSections(brief, sources);
  remediated.bodyHtml = remediated.bodyHtml.replace(/<section><h2>Sources used<\/h2>[\s\S]*?<\/section>/i, (match) => `${evidenceSections.html}\n${match}`);
  remediated.claimMap = [...remediated.claimMap, ...evidenceSections.claims];
  actions.push({
    id: 'remediation_depth',
    type: 'expand_depth',
    severity: baselineReview.metrics.wordCount < 850 ? 'high' : 'medium',
    title: 'Expand article depth with evidence sections',
    reason: 'Review scoring improves when the draft carries more source-backed implementation detail instead of stopping at summary-level coverage.',
    before: `Estimated words: ${baselineReview.metrics.wordCount}`,
    after: `Added ${evidenceSections.claims.length} source-backed sections tied to stored evidence.`
  });

  if (baselineReview.issues.some((item) => item.code === 'unsupported_claims')) {
    const unsupportedClaims = baselineReview.claimCoverage.filter((item) => !item.supported);
    for (const [index, claim] of unsupportedClaims.entries()) {
      const fallbackSource = sources[index % Math.max(1, sources.length)];
      if (!fallbackSource) continue;
      const replacement = `${fallbackSource.title} provides the stored support for this operator requirement: ${clamp(fallbackSource.snippet || fallbackSource.contentText || claim.text, 220)}`;
      remediated.claimMap = remediated.claimMap.map((item) => item.claimId === claim.claimId ? { ...item, text: replacement, sourceIds: [fallbackSource.id] } : item);
      remediated.bodyHtml += `\n<section data-remediation-claim-id="${htmlEscape(claim.claimId)}"><h2>${htmlEscape('Claim repair')}</h2><p>${htmlEscape(replacement)}</p></section>`;
      actions.push({
        id: `remediation_claim_${index + 1}`,
        type: 'repair_claim',
        severity: 'high',
        title: 'Repair unsupported claim',
        reason: 'Unsupported claims block publish readiness and weaken proof credibility.',
        before: clamp(claim.text, 180),
        after: clamp(replacement, 180)
      });
    }
  }

  if (remediated.faqItems.length < 4) {
    const beforeCount = remediated.faqItems.length;
    remediated.faqItems = dedupeFaqItems([...remediated.faqItems, ...buildRecoveryFaqs(brief, sources)]).slice(0, 5);
    const faqHtml = `<section><h2>FAQ</h2>${remediated.faqItems.map((faq) => `<details><summary>${htmlEscape(faq.question)}</summary><p>${htmlEscape(faq.answer)}</p></details>`).join('')}</section>`;
    remediated.bodyHtml = remediated.bodyHtml.replace(/<section><h2>FAQ<\/h2>[\s\S]*?<\/section>/i, faqHtml);
    actions.push({
      id: 'remediation_faq',
      type: 'expand_faq',
      severity: 'medium',
      title: 'Expand publish FAQ coverage',
      reason: 'Extra FAQ coverage strengthens SEO carry-through and operator readiness before CMS execution.',
      before: `FAQ count: ${beforeCount}`,
      after: `FAQ count: ${remediated.faqItems.length}`
    });
  }

  const strongerCta = strengthenCallToAction(project, brief, workspace);
  if (strongerCta !== remediated.callToAction) {
    remediated.callToAction = strongerCta;
    remediated.bodyHtml = remediated.bodyHtml.replace(/<section><h2>Next step<\/h2><p>[\s\S]*?<\/p><\/section>/i, `<section><h2>Next step</h2><p>${htmlEscape(strongerCta)}</p></section>`);
    actions.push({
      id: 'remediation_cta',
      type: 'strengthen_cta',
      severity: 'low',
      title: 'Strengthen CTA continuity',
      reason: 'The next step should point toward a concrete operator action instead of generic copy.',
      before: clamp(article.callToAction, 180),
      after: clamp(strongerCta, 180)
    });
  }

  remediated.jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: remediated.title,
    keywords: [brief.primaryKeyword],
    inLanguage: remediated.language,
    citation: remediated.citations.filter((item) => item.canonicalUrl).map((item) => item.canonicalUrl),
    author: { '@type': 'Organization', name: workspace?.brand || workspace?.name || 'Skye GEO Engine' },
    about: remediated.claimMap.map((claim) => claim.text),
    potentialAction: { '@type': 'CommunicateAction', name: remediated.callToAction }
  }, null, 2);

  return { actions, article: remediated };
}

export function buildArticleRemediationPack(input: {
  workspace: WorkspaceRecord | null;
  project: ProjectRecord | null;
  brief: ArticleBriefRecord;
  article: ArticleRecord;
  sources: SourceRecord[];
}): ArticleRemediationPack {
  const baselineReview = buildArticleReviewPack(input);
  const { actions, article } = createRemediatedArticle(input);
  const predictedEnrichment = buildArticleEnrichmentPack({ ...input, article });
  const predictedReview = buildArticleReviewPack({ ...input, article });
  const scoreDelta = predictedReview.overallScore - baselineReview.overallScore;
  const issueDelta = {
    baseline: baselineReview.issues.length,
    remediated: predictedReview.issues.length,
    removed: Math.max(0, baselineReview.issues.length - predictedReview.issues.length)
  };

  return {
    generatedAt: nowIso(),
    articleId: input.article.id,
    briefId: input.brief.id,
    workspaceId: input.article.workspaceId,
    projectId: input.article.projectId,
    title: input.article.title,
    baselineReview: {
      verdict: baselineReview.verdict,
      overallScore: baselineReview.overallScore,
      issues: baselineReview.issues,
      publishReadiness: baselineReview.publishReadiness,
      metrics: baselineReview.metrics
    },
    actions,
    remediatedArticle: {
      title: article.title,
      slug: article.slug,
      bodyHtml: article.bodyHtml,
      jsonLd: article.jsonLd,
      language: article.language,
      tone: article.tone,
      callToAction: article.callToAction,
      infographicPrompt: article.infographicPrompt,
      claimMap: article.claimMap,
      faqItems: article.faqItems,
      citations: article.citations
    },
    predictedEnrichment,
    predictedReview,
    scoreDelta,
    issueDelta,
    notes: [
      scoreDelta >= 0 ? `Predicted review score improved by ${scoreDelta} point${scoreDelta === 1 ? '' : 's'}.` : `Predicted review score dropped by ${Math.abs(scoreDelta)} points.`,
      issueDelta.removed > 0 ? `Removed ${issueDelta.removed} review issue${issueDelta.removed === 1 ? '' : 's'}.` : 'No review issues were removed, but the publish candidate still changed.',
      `Baseline review: ${summarizeIssues(baselineReview.issues)}`,
      `Predicted review: ${summarizeIssues(predictedReview.issues)}`
    ]
  };
}

export function renderArticleRemediationPack(pack: ArticleRemediationPack): string {
  const actionCards = pack.actions.map((item) => `<article class="card action ${htmlEscape(item.severity)}"><h3>${htmlEscape(item.title)}</h3><p><strong>${htmlEscape(item.reason)}</strong></p><p><strong>Before</strong><br/>${htmlEscape(item.before)}</p><p><strong>After</strong><br/>${htmlEscape(item.after)}</p></article>`).join('');
  const noteItems = pack.notes.map((item) => `<li>${htmlEscape(item)}</li>`).join('');
  const claimRows = pack.remediatedArticle.claimMap.map((item) => `<tr><td>${htmlEscape(clamp(item.text, 180))}</td><td>${htmlEscape(item.sourceIds.join(', ') || '—')}</td></tr>`).join('');
  const faqCards = pack.remediatedArticle.faqItems.map((item) => `<article class="card"><h3>${htmlEscape(item.question)}</h3><p>${htmlEscape(item.answer)}</p></article>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Article remediation pack · ${htmlEscape(pack.title)}</title><style>:root{color-scheme:dark;--bg:#07111f;--panel:#0f1b31;--line:#223557;--text:#f4f7fb;--muted:#9fb3cf;--bad:#ff6b8b;--warn:#ffcb6b;--good:#79f2c0}body{margin:0;background:radial-gradient(circle at top,#16274e 0%,#07111f 55%);font-family:Inter,system-ui,sans-serif;color:var(--text)}.shell{max-width:1320px;margin:0 auto;padding:24px}.hero,.card{background:rgba(10,18,34,.88);border:1px solid var(--line);border-radius:24px;padding:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-top:16px}.action.high{border-color:rgba(255,107,139,.55)}.action.medium{border-color:rgba(255,203,107,.55)}.action.low{border-color:rgba(121,242,192,.45)}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-top:1px solid var(--line);text-align:left;font-size:13px;vertical-align:top}pre{white-space:pre-wrap;overflow:auto;background:#08111f;border:1px solid var(--line);border-radius:18px;padding:16px}p,li{color:var(--muted)}h1,h2,h3{margin:0 0 8px 0}.pill{display:inline-block;border-radius:999px;padding:6px 10px;font-size:12px;border:1px solid var(--line);margin-right:8px}</style></head><body><div class="shell"><section class="hero"><h1>Article remediation pack · ${htmlEscape(pack.title)}</h1><p>This pack turns the stored article review into a publish candidate with stronger depth, stronger CTA continuity, and a new predicted review score before CMS execution.</p><div style="font-size:13px;color:#d6e3ff;">Generated: ${htmlEscape(pack.generatedAt)} · Baseline score: ${pack.baselineReview.overallScore}/100 · Predicted score: ${pack.predictedReview.overallScore}/100 · Score delta: ${pack.scoreDelta >= 0 ? '+' : ''}${pack.scoreDelta}</div><div style="margin-top:12px"><span class="pill">Baseline gate: ${htmlEscape(pack.baselineReview.publishReadiness.gate)}</span><span class="pill">Predicted gate: ${htmlEscape(pack.predictedReview.publishReadiness.gate)}</span><span class="pill">Issues removed: ${pack.issueDelta.removed}</span></div></section><section class="grid"><article class="card"><h2>Remediation actions</h2><div class="grid">${actionCards}</div></article><article class="card"><h2>Remediation notes</h2><ul>${noteItems}</ul><p><strong>Predicted CTA</strong><br/>${htmlEscape(pack.remediatedArticle.callToAction)}</p><p><strong>Predicted canonical</strong><br/>${htmlEscape(pack.predictedEnrichment.canonicalUrl || 'not resolved')}</p></article></section><section class="grid"><article class="card"><h2>Predicted review gate</h2><p><strong>Verdict</strong><br/>${htmlEscape(pack.predictedReview.verdict)}</p><p><strong>Publish gate</strong><br/>${htmlEscape(pack.predictedReview.publishReadiness.gate)}</p><p><strong>Reasons</strong></p><ul>${pack.predictedReview.publishReadiness.reasons.map((item) => `<li>${htmlEscape(item)}</li>`).join('')}</ul></article><article class="card"><h2>Claim ledger after remediation</h2><table><thead><tr><th>Claim</th><th>Source ids</th></tr></thead><tbody>${claimRows}</tbody></table></article></section><section class="grid"><article class="card"><h2>FAQ after remediation</h2><div class="grid">${faqCards}</div></article><article class="card"><h2>JSON-LD after remediation</h2><pre>${htmlEscape(pack.remediatedArticle.jsonLd)}</pre></article></section></div></body></html>`;
}
