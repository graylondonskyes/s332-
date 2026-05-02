import { parseSite } from "./html.ts";
import { fetchText, normalizeUrl, probeUrl } from "./fetcher.ts";

export type AuditIssue = {
  severity: "critical" | "high" | "medium" | "low";
  code: string;
  message: string;
  recommendation: string;
};

export type SiteAuditResult = {
  ok: true;
  fetchedUrl: string;
  pageStatus: number;
  meta: {
    title: string | null;
    titleLength: number;
    metaDescription: string | null;
    metaDescriptionLength: number;
    canonical: string | null;
    lang: string | null;
    jsonLdCount: number;
    openGraphTitle: string | null;
    openGraphDescription: string | null;
  };
  structure: {
    h1Count: number;
    h2Count: number;
    wordCountEstimate: number;
    internalLinkCount: number;
    externalLinkCount: number;
    h1: string[];
    h2Preview: string[];
  };
  crawlSignals: {
    robotsTxt: { ok: boolean; status: number | null; url: string };
    sitemapXml: { ok: boolean; status: number | null; url: string };
  };
  score: number;
  issues: AuditIssue[];
  recommendations: string[];
  excerpt: string;
};

export async function runSiteAudit(inputUrl: string): Promise<SiteAuditResult> {
  const normalized = normalizeUrl(inputUrl);
  const { url, html, status } = await fetchText(normalized);
  const parsed = parseSite(html, url);
  const page = new URL(url);
  const robotsTxt = await probeUrl(`${page.origin}/robots.txt`);
  const sitemapXml = await probeUrl(`${page.origin}/sitemap.xml`);
  const issues: AuditIssue[] = [];

  const titleLength = parsed.title?.length ?? 0;
  const descriptionLength = parsed.metaDescription?.length ?? 0;

  if (!parsed.title) {
    issues.push({
      severity: "critical",
      code: "missing_title",
      message: "The page does not include a <title> tag.",
      recommendation: "Add a descriptive title tag near 50–60 characters that clearly describes the page intent."
    });
  } else if (titleLength < 35 || titleLength > 65) {
    issues.push({
      severity: "medium",
      code: "title_length",
      message: `The title length is ${titleLength} characters.` ,
      recommendation: "Keep the title concise and specific, ideally around 50–60 characters."
    });
  }

  if (!parsed.metaDescription) {
    issues.push({
      severity: "high",
      code: "missing_meta_description",
      message: "The page does not include a meta description.",
      recommendation: "Add a meta description around 140–160 characters that explains the page value in plain language."
    });
  } else if (descriptionLength < 110 || descriptionLength > 180) {
    issues.push({
      severity: "low",
      code: "meta_description_length",
      message: `The meta description length is ${descriptionLength} characters.`,
      recommendation: "Aim for a meta description around 140–160 characters."
    });
  }

  if (!parsed.canonical) {
    issues.push({
      severity: "high",
      code: "missing_canonical",
      message: "No canonical URL was found.",
      recommendation: "Add a canonical tag so crawlers and answer engines know the preferred URL for this page."
    });
  }

  if (parsed.h1.length === 0) {
    issues.push({
      severity: "high",
      code: "missing_h1",
      message: "No H1 heading was found.",
      recommendation: "Use one clear H1 that matches the page intent and top query cluster."
    });
  } else if (parsed.h1.length > 1) {
    issues.push({
      severity: "medium",
      code: "multiple_h1",
      message: `The page contains ${parsed.h1.length} H1 headings.`,
      recommendation: "Keep a single primary H1 for clearer information hierarchy."
    });
  }

  if (parsed.jsonLdCount === 0) {
    issues.push({
      severity: "medium",
      code: "missing_schema",
      message: "No JSON-LD schema block was detected.",
      recommendation: "Add JSON-LD for the content type, organization, FAQ, or product where relevant."
    });
  }

  if (!parsed.openGraphTitle || !parsed.openGraphDescription) {
    issues.push({
      severity: "low",
      code: "weak_open_graph",
      message: "Open Graph metadata is incomplete.",
      recommendation: "Add og:title and og:description so content previews are cleaner across platforms."
    });
  }

  if (!robotsTxt.ok) {
    issues.push({
      severity: "medium",
      code: "robots_unavailable",
      message: "robots.txt was not reachable.",
      recommendation: "Publish a valid robots.txt file at the site root."
    });
  }

  if (!sitemapXml.ok) {
    issues.push({
      severity: "medium",
      code: "sitemap_unavailable",
      message: "sitemap.xml was not reachable.",
      recommendation: "Publish a sitemap.xml file and reference it from robots.txt."
    });
  }

  if (parsed.wordCountEstimate < 250) {
    issues.push({
      severity: "medium",
      code: "thin_content",
      message: `Estimated visible word count is ${parsed.wordCountEstimate}.`,
      recommendation: "Expand the page with clearer problem/solution content, FAQs, examples, and citations."
    });
  }

  if (parsed.internalLinks.length < 3) {
    issues.push({
      severity: "low",
      code: "weak_internal_linking",
      message: `Only ${parsed.internalLinks.length} internal links were detected on the page.`,
      recommendation: "Add more contextual internal links to adjacent pages, solutions, and reference content."
    });
  }

  const severityPenalty = { critical: 18, high: 12, medium: 7, low: 3 } as const;
  const score = Math.max(
    5,
    100 - issues.reduce((sum, issue) => sum + severityPenalty[issue.severity], 0)
  );

  const recommendations = Array.from(new Set(issues.map((issue) => issue.recommendation))).slice(0, 10);

  return {
    ok: true,
    fetchedUrl: url,
    pageStatus: status,
    meta: {
      title: parsed.title,
      titleLength,
      metaDescription: parsed.metaDescription,
      metaDescriptionLength: descriptionLength,
      canonical: parsed.canonical,
      lang: parsed.lang,
      jsonLdCount: parsed.jsonLdCount,
      openGraphTitle: parsed.openGraphTitle,
      openGraphDescription: parsed.openGraphDescription
    },
    structure: {
      h1Count: parsed.h1.length,
      h2Count: parsed.h2.length,
      wordCountEstimate: parsed.wordCountEstimate,
      internalLinkCount: parsed.internalLinks.length,
      externalLinkCount: parsed.externalLinks.length,
      h1: parsed.h1,
      h2Preview: parsed.h2.slice(0, 10)
    },
    crawlSignals: {
      robotsTxt,
      sitemapXml
    },
    score,
    issues,
    recommendations,
    excerpt: parsed.textSample
  };
}
