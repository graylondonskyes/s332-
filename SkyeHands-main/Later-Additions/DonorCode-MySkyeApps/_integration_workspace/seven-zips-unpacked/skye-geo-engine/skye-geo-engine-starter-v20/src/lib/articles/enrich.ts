import type { ArticleBriefRecord, ArticleFaqRecord, ArticleRecord, ProjectRecord, SourceRecord, WorkspaceRecord } from '../db.ts';
import { nowIso } from '../time.ts';

export type ArticleInternalLinkSuggestion = {
  anchorText: string;
  targetUrl: string;
  placement: 'introduction' | 'mid-article' | 'faq' | 'cta';
  reason: string;
  source: 'workspace-route' | 'same-origin-source';
};

export type ArticleEnrichmentPack = {
  generatedAt: string;
  articleId: string;
  briefId: string;
  workspaceId: string;
  projectId: string | null;
  brand: string;
  title: string;
  slug: string;
  canonicalUrl: string | null;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  internalLinks: ArticleInternalLinkSuggestion[];
  faqItems: ArticleFaqRecord[];
  schemaGraph: Record<string, unknown>;
  schemaJsonLd: string;
  openGraph: {
    title: string;
    description: string;
    url: string | null;
    type: 'article';
  };
  publishNotes: string[];
};

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'page';
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

function htmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function uniqueLinks(items: ArticleInternalLinkSuggestion[]): ArticleInternalLinkSuggestion[] {
  const seen = new Set<string>();
  const output: ArticleInternalLinkSuggestion[] = [];
  for (const item of items) {
    const key = `${item.targetUrl}::${item.anchorText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function sameOriginInternalSourceLinks(
  articleUrl: string | null,
  sources: SourceRecord[],
  article: ArticleRecord,
  brief: ArticleBriefRecord
): ArticleInternalLinkSuggestion[] {
  if (!articleUrl) return [];
  const articleOrigin = new URL(articleUrl).origin;
  return sources
    .map((source, index) => {
      const candidate = source.canonicalUrl || source.sourceUrl;
      if (!candidate) return null;
      try {
        const parsed = new URL(candidate);
        if (parsed.origin !== articleOrigin) return null;
        if (parsed.href === articleUrl) return null;
        return {
          anchorText: index === 0 ? `supporting research for ${brief.primaryKeyword}` : `proof source: ${source.title}`,
          targetUrl: parsed.href,
          placement: index === 0 ? 'mid-article' : 'faq',
          reason: 'Points readers to already-ingested evidence on the same origin.',
          source: 'same-origin-source'
        } satisfies ArticleInternalLinkSuggestion;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as ArticleInternalLinkSuggestion[];
}

function workspaceRouteLinks(articleUrl: string | null, article: ArticleRecord, brief: ArticleBriefRecord, workspace: WorkspaceRecord | null): ArticleInternalLinkSuggestion[] {
  if (!articleUrl) return [];
  const url = new URL(articleUrl);
  const origin = url.origin;
  const keywordSlug = slugify(brief.primaryKeyword);
  const audienceSlug = slugify((brief.brief as { audience?: string } | undefined)?.audience || 'operators');
  const brandSlug = slugify((workspace?.brand || workspace?.name || 'skye-geo-engine') as string);
  return [
    {
      anchorText: `proof-backed ${brief.primaryKeyword}`,
      targetUrl: `${origin}/services/${keywordSlug}`,
      placement: 'introduction',
      reason: 'Creates a commercial-intent jump from the introduction into the core service lane.',
      source: 'workspace-route'
    },
    {
      anchorText: `${workspace?.brand || 'Skye GEO Engine'} proof site`,
      targetUrl: `${origin}/proof/${brandSlug}`,
      placement: 'mid-article',
      reason: 'Connects educational copy to a proof-oriented destination instead of leaving the article isolated.',
      source: 'workspace-route'
    },
    {
      anchorText: `${audienceSlug.replace(/-/g, ' ')} implementation checklist`,
      targetUrl: `${origin}/guides/${audienceSlug}-implementation-checklist`,
      placement: 'faq',
      reason: 'Supports FAQ and checklist sections with a contextually adjacent internal destination.',
      source: 'workspace-route'
    },
    {
      anchorText: `book a ${brief.primaryKeyword} audit`,
      targetUrl: `${origin}/contact/${keywordSlug}-audit`,
      placement: 'cta',
      reason: 'Turns the CTA into a destination with clear commercial continuity.',
      source: 'workspace-route'
    }
  ];
}

function extractExcerpt(article: ArticleRecord, brief: ArticleBriefRecord): string {
  const firstParagraph = article.bodyHtml.match(/<p>([\s\S]*?)<\/p>/i)?.[1];
  const text = stripTags(firstParagraph || article.bodyHtml);
  if (text) return clamp(text, 220);
  const summary = typeof brief.brief.summary === 'string' ? brief.brief.summary : article.title;
  return clamp(summary, 220);
}

function resolveCanonicalUrl(project: ProjectRecord | null, article: ArticleRecord, sources: SourceRecord[]): string | null {
  const primary = project?.primaryUrl?.trim();
  if (primary) {
    try {
      const parsed = new URL(primary);
      const basePath = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.replace(/\/+$/, '') : '';
      return `${parsed.origin}${basePath}/${article.slug}`.replace(/([^:]\/)\/+?/g, '$1');
    } catch {
      // ignore invalid project URL and try sources
    }
  }
  for (const source of sources) {
    const candidate = source.canonicalUrl || source.sourceUrl;
    if (!candidate) continue;
    try {
      const parsed = new URL(candidate);
      return `${parsed.origin}/articles/${article.slug}`;
    } catch {
      continue;
    }
  }
  return null;
}

export function buildArticleEnrichmentPack(input: {
  workspace: WorkspaceRecord | null;
  project: ProjectRecord | null;
  brief: ArticleBriefRecord;
  article: ArticleRecord;
  sources: SourceRecord[];
}): ArticleEnrichmentPack {
  const { workspace, project, brief, article, sources } = input;
  const brand = workspace?.brand || workspace?.name || 'Skye GEO Engine';
  const excerpt = extractExcerpt(article, brief);
  const canonicalUrl = resolveCanonicalUrl(project, article, sources);
  const metaTitle = clamp(`${article.title} | ${brand}`, 60);
  const metaDescription = clamp(`${excerpt} Built for ${brief.primaryKeyword} with claim-level source mapping, structured FAQ support, and operator-grade proof retention.`, 160);
  const internalLinks = uniqueLinks([
    ...workspaceRouteLinks(canonicalUrl, article, brief, workspace),
    ...sameOriginInternalSourceLinks(canonicalUrl, sources, article, brief)
  ]).slice(0, 5);

  const schemaGraph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': canonicalUrl ? `${canonicalUrl}#org` : '#org',
        name: brand
      },
      {
        '@type': 'Article',
        '@id': canonicalUrl ? `${canonicalUrl}#article` : '#article',
        headline: article.title,
        inLanguage: article.language,
        description: metaDescription,
        url: canonicalUrl,
        mainEntityOfPage: canonicalUrl,
        keywords: [brief.primaryKeyword],
        author: { '@id': canonicalUrl ? `${canonicalUrl}#org` : '#org' },
        citation: article.citations.filter((item) => item.canonicalUrl).map((item) => item.canonicalUrl),
        about: article.claimMap.map((claim) => claim.text)
      },
      {
        '@type': 'FAQPage',
        '@id': canonicalUrl ? `${canonicalUrl}#faq` : '#faq',
        mainEntity: article.faqItems.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer }
        }))
      },
      {
        '@type': 'BreadcrumbList',
        '@id': canonicalUrl ? `${canonicalUrl}#breadcrumbs` : '#breadcrumbs',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: canonicalUrl ? new URL('/', canonicalUrl).toString() : '/' },
          { '@type': 'ListItem', position: 2, name: 'Resources', item: canonicalUrl ? new URL('/resources', canonicalUrl).toString() : '/resources' },
          { '@type': 'ListItem', position: 3, name: article.title, item: canonicalUrl || article.slug }
        ]
      }
    ]
  } as Record<string, unknown>;

  const publishNotes = [
    internalLinks.length ? `Insert ${internalLinks.length} internal links at the planned placements before publish.` : 'Add at least one internal link before publish.',
    'Ship the schema graph with the article body or CMS SEO field so publish receipts retain JSON-LD proof.',
    'Use the meta title and description in the CMS payload instead of ad hoc copy changes after publish.',
    'Preserve FAQ blocks during publish so article schema and FAQ schema stay aligned.'
  ];

  return {
    generatedAt: nowIso(),
    articleId: article.id,
    briefId: brief.id,
    workspaceId: article.workspaceId,
    projectId: article.projectId,
    brand,
    title: article.title,
    slug: article.slug,
    canonicalUrl,
    metaTitle,
    metaDescription,
    excerpt,
    internalLinks,
    faqItems: article.faqItems,
    schemaGraph,
    schemaJsonLd: JSON.stringify(schemaGraph, null, 2),
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      url: canonicalUrl,
      type: 'article'
    },
    publishNotes
  };
}

export function renderArticleEnrichmentPack(pack: ArticleEnrichmentPack): string {
  const linkRows = pack.internalLinks.map((link) => `<tr><td>${htmlEscape(link.anchorText)}</td><td>${htmlEscape(link.targetUrl)}</td><td>${htmlEscape(link.placement)}</td><td>${htmlEscape(link.reason)}</td></tr>`).join('');
  const faqCards = pack.faqItems.map((faq) => `<article class="card"><h3>${htmlEscape(faq.question)}</h3><p>${htmlEscape(faq.answer)}</p></article>`).join('');
  const notes = pack.publishNotes.map((note) => `<li>${htmlEscape(note)}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Article enrichment pack · ${htmlEscape(pack.title)}</title><style>:root{color-scheme:dark;--bg:#07111f;--panel:#0f1b31;--line:#223557;--text:#f4f7fb;--muted:#9fb3cf}body{margin:0;background:radial-gradient(circle at top,#16274e 0%,#07111f 55%);font-family:Inter,system-ui,sans-serif;color:var(--text)}.shell{max-width:1280px;margin:0 auto;padding:24px}.hero,.card{background:rgba(10,18,34,.88);border:1px solid var(--line);border-radius:24px;padding:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-top:16px}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-top:1px solid var(--line);text-align:left;font-size:13px;vertical-align:top}pre{white-space:pre-wrap;overflow:auto;background:#08111f;border:1px solid var(--line);border-radius:18px;padding:16px}p,li{color:var(--muted)}h1,h2,h3{margin:0 0 8px 0}</style></head><body><div class="shell"><section class="hero"><h1>Article enrichment pack · ${htmlEscape(pack.title)}</h1><p>Generated from the stored article, brief, project URL, and source ledger only. This pack exists to turn article output into publish-ready schema, internal links, and metadata without hand edits.</p><div style="font-size:13px;color:#d6e3ff;">Generated: ${htmlEscape(pack.generatedAt)} · Canonical: ${htmlEscape(pack.canonicalUrl || 'not resolved')} · Internal links: ${pack.internalLinks.length}</div></section><section class="grid"><article class="card"><h2>Metadata pack</h2><p><strong>Meta title</strong><br/>${htmlEscape(pack.metaTitle)}</p><p><strong>Meta description</strong><br/>${htmlEscape(pack.metaDescription)}</p><p><strong>Excerpt</strong><br/>${htmlEscape(pack.excerpt)}</p><ul>${notes}</ul></article><article class="card"><h2>Internal-link plan</h2><table><thead><tr><th>Anchor</th><th>Target URL</th><th>Placement</th><th>Reason</th></tr></thead><tbody>${linkRows}</tbody></table></article></section><section class="grid"><article class="card"><h2>FAQ carry-through</h2><div class="grid">${faqCards || '<p>No FAQ items were stored on the article.</p>'}</div></article><article class="card"><h2>Schema graph</h2><pre>${htmlEscape(pack.schemaJsonLd)}</pre></article></section></div></body></html>`;
}
