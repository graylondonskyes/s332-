import type { ArticleBriefRecord, ArticleRecord, ProjectRecord, SourceRecord, WorkspaceRecord } from '../db.ts';
import { nowIso } from '../time.ts';
import { buildArticleEnrichmentPack, type ArticleEnrichmentPack } from './enrich.ts';

export type ArticleReviewSeverity = 'high' | 'medium' | 'low';

export type ArticleReviewDimension = {
  id: 'content_depth' | 'evidence_coverage' | 'seo_readiness' | 'conversion_readiness' | 'source_diversity';
  label: string;
  score: number;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
};

export type ArticleReviewIssue = {
  severity: ArticleReviewSeverity;
  code: string;
  message: string;
  fix: string;
};

export type ArticleClaimCoverage = {
  claimId: string;
  text: string;
  sourceCount: number;
  supported: boolean;
  sourceTitles: string[];
};

export type ArticleReviewPack = {
  generatedAt: string;
  articleId: string;
  briefId: string;
  workspaceId: string;
  projectId: string | null;
  title: string;
  primaryKeyword: string;
  brand: string;
  verdict: 'pass' | 'warn' | 'fail';
  overallScore: number;
  publishReadiness: {
    gate: 'ready' | 'conditional' | 'blocked';
    ready: boolean;
    reasons: string[];
    nextActions: string[];
  };
  metrics: {
    wordCount: number;
    claimCount: number;
    supportedClaimCount: number;
    unsupportedClaimCount: number;
    citationCount: number;
    uniqueCitationSourceCount: number;
    faqCount: number;
    internalLinkCount: number;
    metaTitleLength: number;
    metaDescriptionLength: number;
    canonicalResolved: boolean;
    schemaPresent: boolean;
    ctaPresent: boolean;
  };
  dimensions: ArticleReviewDimension[];
  issues: ArticleReviewIssue[];
  strengths: string[];
  claimCoverage: ArticleClaimCoverage[];
  enrichment: Pick<ArticleEnrichmentPack, 'canonicalUrl' | 'metaTitle' | 'metaDescription' | 'excerpt' | 'openGraph' | 'internalLinks' | 'publishNotes'>;
  reviewNotes: string[];
};

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
  return normalized.length <= max ? normalized : normalized.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

function htmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toStatus(score: number): 'pass' | 'warn' | 'fail' {
  if (score >= 80) return 'pass';
  if (score >= 60) return 'warn';
  return 'fail';
}

function normalizeScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreContentDepth(wordCount: number): number {
  if (wordCount >= 1000) return 100;
  if (wordCount >= 850) return 92;
  if (wordCount >= 700) return 84;
  if (wordCount >= 550) return 72;
  if (wordCount >= 400) return 56;
  return 30;
}

function scoreEvidenceCoverage(claimCount: number, supportedClaimCount: number, uniqueCitationSourceCount: number, unsupportedClaimCount: number): number {
  const base = claimCount ? (supportedClaimCount / claimCount) * 100 : 45;
  const sourceLift = Math.min(10, uniqueCitationSourceCount * 2);
  const unsupportedPenalty = unsupportedClaimCount * 12;
  return normalizeScore(base + sourceLift - unsupportedPenalty);
}

function scoreSeoReadiness(input: { canonicalResolved: boolean; metaTitleLength: number; metaDescriptionLength: number; schemaPresent: boolean; internalLinkCount: number; faqCount: number }): number {
  const { canonicalResolved, metaTitleLength, metaDescriptionLength, schemaPresent, internalLinkCount, faqCount } = input;
  let score = 0;
  score += canonicalResolved ? 20 : 0;
  score += metaTitleLength >= 35 && metaTitleLength <= 60 ? 20 : metaTitleLength >= 25 ? 10 : 0;
  score += metaDescriptionLength >= 120 && metaDescriptionLength <= 160 ? 20 : metaDescriptionLength >= 90 ? 10 : 0;
  score += schemaPresent ? 20 : 0;
  score += internalLinkCount >= 3 ? 12 : internalLinkCount >= 1 ? 6 : 0;
  score += faqCount >= 2 ? 8 : faqCount >= 1 ? 4 : 0;
  return normalizeScore(score);
}

function scoreConversionReadiness(input: { ctaPresent: boolean; internalLinkCount: number; faqCount: number; excerptLength: number; projectUrlPresent: boolean }): number {
  const { ctaPresent, internalLinkCount, faqCount, excerptLength, projectUrlPresent } = input;
  let score = 0;
  score += ctaPresent ? 35 : 0;
  score += internalLinkCount >= 2 ? 25 : internalLinkCount >= 1 ? 12 : 0;
  score += faqCount >= 2 ? 20 : faqCount >= 1 ? 10 : 0;
  score += excerptLength >= 90 ? 10 : excerptLength >= 60 ? 5 : 0;
  score += projectUrlPresent ? 10 : 0;
  return normalizeScore(score);
}

function scoreSourceDiversity(uniqueCitationSourceCount: number, totalSources: number): number {
  if (uniqueCitationSourceCount >= 4 || totalSources >= 4) return 100;
  if (uniqueCitationSourceCount >= 3 || totalSources >= 3) return 86;
  if (uniqueCitationSourceCount >= 2 || totalSources >= 2) return 72;
  if (uniqueCitationSourceCount >= 1 || totalSources >= 1) return 52;
  return 24;
}

export function buildArticleReviewPack(input: {
  workspace: WorkspaceRecord | null;
  project: ProjectRecord | null;
  brief: ArticleBriefRecord;
  article: ArticleRecord;
  sources: SourceRecord[];
}): ArticleReviewPack {
  const { workspace, project, brief, article, sources } = input;
  const enrichment = buildArticleEnrichmentPack({ workspace, project, brief, article, sources });
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const wordCount = stripTags(article.bodyHtml).split(/\s+/).filter(Boolean).length;
  const uniqueCitationSourceCount = new Set(article.citations.map((item) => item.sourceId).filter(Boolean)).size;
  const claimCoverage: ArticleClaimCoverage[] = article.claimMap.map((claim) => {
    const resolvedSources = claim.sourceIds.map((id) => sourceMap.get(id)).filter(Boolean) as SourceRecord[];
    return {
      claimId: claim.claimId,
      text: claim.text,
      sourceCount: resolvedSources.length,
      supported: resolvedSources.length > 0,
      sourceTitles: resolvedSources.map((item) => item.title)
    } satisfies ArticleClaimCoverage;
  });
  const supportedClaimCount = claimCoverage.filter((item) => item.supported).length;
  const unsupportedClaimCount = claimCoverage.length - supportedClaimCount;
  const faqCount = article.faqItems.length;
  const internalLinkCount = enrichment.internalLinks.length;
  const ctaPresent = article.callToAction.trim().length >= 20;
  const schemaPresent = enrichment.schemaJsonLd.trim().length > 20;
  const canonicalResolved = !!enrichment.canonicalUrl;
  const metaTitleLength = enrichment.metaTitle.length;
  const metaDescriptionLength = enrichment.metaDescription.length;

  const dimensions = [
    {
      id: 'content_depth',
      label: 'Content depth',
      score: scoreContentDepth(wordCount),
      status: 'fail',
      detail: `${wordCount} estimated words in the stored article body.`
    },
    {
      id: 'evidence_coverage',
      label: 'Evidence coverage',
      score: scoreEvidenceCoverage(claimCoverage.length, supportedClaimCount, uniqueCitationSourceCount, unsupportedClaimCount),
      status: 'fail',
      detail: `${supportedClaimCount}/${claimCoverage.length || 0} mapped claims resolve to stored sources.`
    },
    {
      id: 'seo_readiness',
      label: 'SEO readiness',
      score: scoreSeoReadiness({ canonicalResolved, metaTitleLength, metaDescriptionLength, schemaPresent, internalLinkCount, faqCount }),
      status: 'fail',
      detail: `Canonical ${canonicalResolved ? 'resolved' : 'missing'}, ${internalLinkCount} internal links, meta title ${metaTitleLength} chars, meta description ${metaDescriptionLength} chars.`
    },
    {
      id: 'conversion_readiness',
      label: 'Conversion readiness',
      score: scoreConversionReadiness({ ctaPresent, internalLinkCount, faqCount, excerptLength: enrichment.excerpt.length, projectUrlPresent: !!project?.primaryUrl }),
      status: 'fail',
      detail: `${ctaPresent ? 'CTA present' : 'CTA weak or missing'}, ${faqCount} FAQ items, ${internalLinkCount} internal links.`
    },
    {
      id: 'source_diversity',
      label: 'Source diversity',
      score: scoreSourceDiversity(uniqueCitationSourceCount, sources.length),
      status: 'fail',
      detail: `${uniqueCitationSourceCount} unique cited sources from ${sources.length} workspace sources.`
    }
  ].map((item) => ({ ...item, status: toStatus(item.score) as ArticleReviewDimension['status'] })) as ArticleReviewDimension[];

  const overallScore = normalizeScore(
    dimensions.find((item) => item.id === 'content_depth')!.score * 0.18 +
    dimensions.find((item) => item.id === 'evidence_coverage')!.score * 0.34 +
    dimensions.find((item) => item.id === 'seo_readiness')!.score * 0.22 +
    dimensions.find((item) => item.id === 'conversion_readiness')!.score * 0.12 +
    dimensions.find((item) => item.id === 'source_diversity')!.score * 0.14
  );

  const issues: ArticleReviewIssue[] = [];
  if (unsupportedClaimCount > 0) {
    issues.push({ severity: 'high', code: 'unsupported_claims', message: `${unsupportedClaimCount} claim${unsupportedClaimCount === 1 ? '' : 's'} do not resolve to stored source evidence.`, fix: 'Revise or remove unsupported claims, or ingest the missing sources and regenerate the article review.' });
  }
  if (wordCount < 550) {
    issues.push({ severity: wordCount < 400 ? 'high' : 'medium', code: 'thin_article_body', message: `Article body is only ${wordCount} estimated words.`, fix: 'Expand the article with source-backed sections, examples, and implementation detail before publish.' });
  }
  if (!canonicalResolved) {
    issues.push({ severity: 'medium', code: 'missing_canonical', message: 'Canonical URL could not be resolved from the project or source ledger.', fix: 'Set a valid project primary URL or publish target so the article ships with a stable canonical URL.' });
  }
  if (metaTitleLength < 35 || metaTitleLength > 60) {
    issues.push({ severity: 'medium', code: 'meta_title_length', message: `Meta title is ${metaTitleLength} characters.`, fix: 'Adjust the meta title into the 35–60 character range before publish.' });
  }
  if (metaDescriptionLength < 120 || metaDescriptionLength > 160) {
    issues.push({ severity: 'medium', code: 'meta_description_length', message: `Meta description is ${metaDescriptionLength} characters.`, fix: 'Adjust the meta description into the 120–160 character range before publish.' });
  }
  if (internalLinkCount < 2) {
    issues.push({ severity: 'medium', code: 'internal_link_depth', message: `Only ${internalLinkCount} internal link${internalLinkCount === 1 ? '' : 's'} are planned.`, fix: 'Add at least two internal links so the article contributes to internal distribution and conversion paths.' });
  }
  if (!ctaPresent) {
    issues.push({ severity: 'high', code: 'missing_cta', message: 'The stored CTA is weak or missing.', fix: 'Add a real CTA tied to an audit, demo, consultation, or proof-backed next step.' });
  }
  if (uniqueCitationSourceCount < 2) {
    issues.push({ severity: 'medium', code: 'low_source_diversity', message: 'The article cites fewer than two unique sources.', fix: 'Broaden the research ledger and regenerate the draft or revise the claim map with more source variety.' });
  }

  const strengths: string[] = [];
  if (supportedClaimCount === claimCoverage.length && claimCoverage.length > 0) strengths.push('Every mapped claim resolves to stored source evidence.');
  if (internalLinkCount >= 3) strengths.push(`Internal-link planning already covers ${internalLinkCount} placements.`);
  if (schemaPresent && faqCount >= 2) strengths.push('Schema graph and FAQ carry-through are ready for CMS handoff.');
  if (overallScore >= 85) strengths.push('The article review score is already in the premium publish-ready band.');
  if (uniqueCitationSourceCount >= 3) strengths.push(`The article draws from ${uniqueCitationSourceCount} unique cited sources.`);

  const highIssues = issues.filter((item) => item.severity === 'high');
  const mediumIssues = issues.filter((item) => item.severity === 'medium');
  const publishReadiness = {
    gate: (highIssues.length || overallScore < 68) ? 'blocked' : (mediumIssues.length || overallScore < 82) ? 'conditional' : 'ready',
    ready: highIssues.length === 0 && overallScore >= 82,
    reasons: highIssues.length
      ? highIssues.map((item) => item.message)
      : mediumIssues.length
        ? mediumIssues.map((item) => item.message)
        : ['All major review checks cleared without publish blockers.'],
    nextActions: issues.slice(0, 5).map((item) => item.fix)
  } as ArticleReviewPack['publishReadiness'];

  const verdict: ArticleReviewPack['verdict'] = publishReadiness.gate === 'ready' ? 'pass' : publishReadiness.gate === 'conditional' ? 'warn' : 'fail';
  const reviewNotes = [
    `Overall article review score: ${overallScore}/100.`,
    `Publish gate: ${publishReadiness.gate}.`,
    claimCoverage.length ? `${supportedClaimCount} of ${claimCoverage.length} mapped claims are currently supported by stored sources.` : 'No claim map was present on the article.',
    canonicalResolved ? 'Canonical URL is resolved for publish handoff.' : 'Canonical URL is still unresolved and should be fixed before publish.',
    internalLinkCount ? `${internalLinkCount} internal link placements are already planned.` : 'No internal link plan is currently present.'
  ];

  return {
    generatedAt: nowIso(),
    articleId: article.id,
    briefId: brief.id,
    workspaceId: article.workspaceId,
    projectId: article.projectId,
    title: article.title,
    primaryKeyword: brief.primaryKeyword,
    brand: workspace?.brand || workspace?.name || 'Skye GEO Engine',
    verdict,
    overallScore,
    publishReadiness,
    metrics: {
      wordCount,
      claimCount: claimCoverage.length,
      supportedClaimCount,
      unsupportedClaimCount,
      citationCount: article.citations.length,
      uniqueCitationSourceCount,
      faqCount,
      internalLinkCount,
      metaTitleLength,
      metaDescriptionLength,
      canonicalResolved,
      schemaPresent,
      ctaPresent
    },
    dimensions,
    issues,
    strengths,
    claimCoverage,
    enrichment: {
      canonicalUrl: enrichment.canonicalUrl,
      metaTitle: enrichment.metaTitle,
      metaDescription: enrichment.metaDescription,
      excerpt: enrichment.excerpt,
      openGraph: enrichment.openGraph,
      internalLinks: enrichment.internalLinks,
      publishNotes: enrichment.publishNotes
    },
    reviewNotes
  };
}

export function renderArticleReviewPack(pack: ArticleReviewPack): string {
  const scoreRows = pack.dimensions.map((item) => `<tr><td>${htmlEscape(item.label)}</td><td>${item.score}</td><td>${htmlEscape(item.status)}</td><td>${htmlEscape(item.detail)}</td></tr>`).join('');
  const issueCards = pack.issues.map((item) => `<article class="card issue ${htmlEscape(item.severity)}"><h3>${htmlEscape(item.code)}</h3><p><strong>${htmlEscape(item.message)}</strong></p><p>${htmlEscape(item.fix)}</p></article>`).join('');
  const claimRows = pack.claimCoverage.map((item) => `<tr><td>${htmlEscape(clamp(item.text, 140))}</td><td>${item.sourceCount}</td><td>${htmlEscape(item.supported ? 'supported' : 'unsupported')}</td><td>${htmlEscape(item.sourceTitles.join(' · ') || '—')}</td></tr>`).join('');
  const strengthItems = pack.strengths.map((item) => `<li>${htmlEscape(item)}</li>`).join('');
  const noteItems = pack.reviewNotes.map((item) => `<li>${htmlEscape(item)}</li>`).join('');
  const actionItems = pack.publishReadiness.nextActions.map((item) => `<li>${htmlEscape(item)}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Article review pack · ${htmlEscape(pack.title)}</title><style>:root{color-scheme:dark;--bg:#07111f;--panel:#0f1b31;--line:#223557;--text:#f4f7fb;--muted:#9fb3cf;--bad:#ff6b8b;--warn:#ffcb6b;--good:#79f2c0}body{margin:0;background:radial-gradient(circle at top,#16274e 0%,#07111f 55%);font-family:Inter,system-ui,sans-serif;color:var(--text)}.shell{max-width:1320px;margin:0 auto;padding:24px}.hero,.card{background:rgba(10,18,34,.88);border:1px solid var(--line);border-radius:24px;padding:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-top:16px}.issue.high{border-color:rgba(255,107,139,.6)}.issue.medium{border-color:rgba(255,203,107,.6)}.issue.low{border-color:rgba(121,242,192,.4)}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-top:1px solid var(--line);text-align:left;font-size:13px;vertical-align:top}ul{margin:0;padding-left:18px}p,li{color:var(--muted)}h1,h2,h3{margin:0 0 8px 0}.metric{font-size:14px;color:#dce7ff}.pill{display:inline-block;border-radius:999px;padding:6px 10px;font-size:12px;border:1px solid var(--line);margin-right:8px}</style></head><body><div class="shell"><section class="hero"><h1>Article review pack · ${htmlEscape(pack.title)}</h1><p>Generated from the stored article, brief, source ledger, and enrichment pack only. This review exists to create a real publish gate instead of trusting drafts blindly.</p><div class="metric">Generated: ${htmlEscape(pack.generatedAt)} · Overall score: ${pack.overallScore}/100 · Verdict: ${htmlEscape(pack.verdict)} · Publish gate: ${htmlEscape(pack.publishReadiness.gate)}</div><div style="margin-top:12px"><span class="pill">Keyword: ${htmlEscape(pack.primaryKeyword)}</span><span class="pill">Words: ${pack.metrics.wordCount}</span><span class="pill">Claims: ${pack.metrics.claimCount}</span><span class="pill">Internal links: ${pack.metrics.internalLinkCount}</span></div></section><section class="grid"><article class="card"><h2>Review dimensions</h2><table><thead><tr><th>Dimension</th><th>Score</th><th>Status</th><th>Detail</th></tr></thead><tbody>${scoreRows}</tbody></table></article><article class="card"><h2>Publish readiness</h2><p><strong>Ready now:</strong> ${htmlEscape(pack.publishReadiness.ready ? 'yes' : 'no')}</p><p><strong>Reasons</strong></p><ul>${pack.publishReadiness.reasons.map((item) => `<li>${htmlEscape(item)}</li>`).join('')}</ul><p style="margin-top:12px"><strong>Next actions</strong></p><ul>${actionItems || '<li>No next actions required.</li>'}</ul></article></section><section class="grid"><article class="card"><h2>Issues</h2><div class="grid">${issueCards || '<p>No blocking review issues were detected.</p>'}</div></article><article class="card"><h2>Strengths and notes</h2><p><strong>Strengths</strong></p><ul>${strengthItems || '<li>No standout strengths recorded yet.</li>'}</ul><p style="margin-top:12px"><strong>Review notes</strong></p><ul>${noteItems}</ul></article></section><section class="grid"><article class="card"><h2>Claim support ledger</h2><table><thead><tr><th>Claim</th><th>Sources</th><th>Status</th><th>Resolved titles</th></tr></thead><tbody>${claimRows}</tbody></table></article><article class="card"><h2>SEO and enrichment snapshot</h2><p><strong>Canonical</strong><br/>${htmlEscape(pack.enrichment.canonicalUrl || 'not resolved')}</p><p><strong>Meta title</strong><br/>${htmlEscape(pack.enrichment.metaTitle)}</p><p><strong>Meta description</strong><br/>${htmlEscape(pack.enrichment.metaDescription)}</p><p><strong>Excerpt</strong><br/>${htmlEscape(pack.enrichment.excerpt)}</p><p><strong>Publish notes</strong></p><ul>${pack.enrichment.publishNotes.map((item) => `<li>${htmlEscape(item)}</li>`).join('')}</ul></article></section></div></body></html>`;
}
