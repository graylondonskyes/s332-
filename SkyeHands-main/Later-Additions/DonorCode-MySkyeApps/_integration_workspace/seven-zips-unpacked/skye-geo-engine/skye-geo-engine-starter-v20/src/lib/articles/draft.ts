import type { ArticleBriefRecord, ArticleClaimRecord, ArticleFaqRecord, SourceRecord } from '../db.ts';

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'article';
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sectionIntro(language: string): string {
  const lowered = language.toLowerCase();
  if (lowered.startsWith('spanish')) return 'Resumen con respaldo de fuentes';
  if (lowered.startsWith('french')) return 'Résumé appuyé par des sources';
  return 'Source-backed summary';
}

export type ComposeArticleOptions = {
  brand: string;
  language?: string;
  tone?: string;
  callToAction?: string;
  includeFaq?: boolean;
  includeInfographicPrompt?: boolean;
};

export function composeArticleDraft(
  brief: ArticleBriefRecord,
  sources: SourceRecord[],
  options: ComposeArticleOptions
): {
  title: string;
  slug: string;
  bodyHtml: string;
  jsonLd: string;
  citations: Array<{ sourceId: string; title: string; canonicalUrl: string | null }>;
  language: string;
  tone: string;
  callToAction: string;
  infographicPrompt: string;
  claimMap: ArticleClaimRecord[];
  faqItems: ArticleFaqRecord[];
} {
  const data = brief.brief as {
    summary?: string;
    outline?: string[];
    keyPoints?: string[];
    sourceSummaries?: Array<{ sourceId: string; title: string; canonicalUrl: string | null }>;
  };

  const language = options.language?.trim() || 'English';
  const tone = options.tone?.trim() || 'operator';
  const callToAction = options.callToAction?.trim() || `Use ${options.brand} to move from research to publishable execution with proof preserved.`;
  const outline = data.outline || [];
  const keyPoints = data.keyPoints || [];
  const citations = sources.map((source) => ({ sourceId: source.id, title: source.title, canonicalUrl: source.canonicalUrl }));

  const claimMap: ArticleClaimRecord[] = outline.map((heading, index) => {
    const source = sources[index % Math.max(1, sources.length)];
    const fallbackIds = source ? [source.id] : [];
    return {
      claimId: `claim_${index + 1}`,
      text: `${heading} should be grounded in ${source?.title || 'the persisted source ledger'} and framed for ${brief.primaryKeyword}.`,
      sourceIds: fallbackIds
    };
  });

  const faqItems: ArticleFaqRecord[] = options.includeFaq === false ? [] : [
    {
      question: `What makes ${brief.primaryKeyword} more credible in AI search?`,
      answer: `Credibility improves when every major claim is tied to a source ledger, the content reflects buyer intent, and the publishing workflow preserves structured metadata.`,
      sourceIds: claimMap[0]?.sourceIds || []
    },
    {
      question: `How should operators measure whether this article is working?`,
      answer: `Measure mention share, citation share, competitor overlap, and the movement from research assets into published surfaces and visibility replays.`,
      sourceIds: claimMap[1]?.sourceIds || claimMap[0]?.sourceIds || []
    }
  ];

  const infographicPrompt = options.includeInfographicPrompt === false
    ? ''
    : `Create a ${language} infographic for ${options.brand} that visualizes the workflow from source ingestion, claim mapping, article drafting, structured publish, and visibility replay for ${brief.primaryKeyword}. Tone: ${tone}.`;

  const openingCopy = `${sectionIntro(language)}: ${data.summary || `This article is built from the persisted research ledger for ${brief.primaryKeyword}.`}`;
  const bullets = keyPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('');
  const sections = outline.map((heading, index) => {
    const source = sources[index % Math.max(1, sources.length)];
    const sourceText = source ? `${source.title}: ${source.snippet}` : 'Use the stored research ledger to support this section.';
    const claim = claimMap[index];
    const toneLine = tone === 'executive'
      ? 'Frame this section for decision-makers with concise risk and payoff language.'
      : tone === 'technical'
      ? 'Frame this section with implementation detail and explicit operational steps.'
      : 'Frame this section with operator-level specificity and commercial clarity.';
    return `<section data-claim-id="${escapeHtml(claim.claimId)}"><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(sourceText)}</p><p>${escapeHtml(toneLine)}</p></section>`;
  }).join('\n');

  const faqHtml = faqItems.length
    ? `<section><h2>FAQ</h2>${faqItems.map((faq) => `<details><summary>${escapeHtml(faq.question)}</summary><p>${escapeHtml(faq.answer)}</p></details>`).join('')}</section>`
    : '';
  const infographicHtml = infographicPrompt ? `<section><h2>Infographic brief</h2><p>${escapeHtml(infographicPrompt)}</p></section>` : '';
  const citationHtml = citations.map((citation) => `<li>${escapeHtml(citation.title)}${citation.canonicalUrl ? ` — <a href="${escapeHtml(citation.canonicalUrl)}">${escapeHtml(citation.canonicalUrl)}</a>` : ''}</li>`).join('');

  const bodyHtml = [
    `<article data-language="${escapeHtml(language)}" data-tone="${escapeHtml(tone)}">`,
    `<h1>${escapeHtml(brief.title)}</h1>`,
    `<p>${escapeHtml(openingCopy)}</p>`,
    `<section><h2>What matters most</h2><ul>${bullets}</ul></section>`,
    sections,
    faqHtml,
    infographicHtml,
    `<section><h2>Sources used</h2><ol>${citationHtml}</ol></section>`,
    `<section><h2>Next step</h2><p>${escapeHtml(callToAction)}</p></section>`,
    `</article>`
  ].filter(Boolean).join('\n');

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: brief.title,
    keywords: [brief.primaryKeyword],
    inLanguage: language,
    citation: citations.filter((item) => item.canonicalUrl).map((item) => item.canonicalUrl),
    author: { '@type': 'Organization', name: options.brand },
    about: claimMap.map((claim) => claim.text)
  }, null, 2);

  return {
    title: brief.title,
    slug: slugify(brief.title),
    bodyHtml,
    jsonLd,
    citations,
    language,
    tone,
    callToAction,
    infographicPrompt,
    claimMap,
    faqItems
  };
}
