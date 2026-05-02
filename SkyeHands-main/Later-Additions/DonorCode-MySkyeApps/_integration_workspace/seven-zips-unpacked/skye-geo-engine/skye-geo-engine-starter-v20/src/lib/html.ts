export type ParsedSite = {
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  h1: string[];
  h2: string[];
  openGraphTitle: string | null;
  openGraphDescription: string | null;
  jsonLdCount: number;
  internalLinks: string[];
  externalLinks: string[];
  textSample: string;
  wordCountEstimate: number;
  lang: string | null;
};

function stripTags(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function firstMatch(html: string, regex: RegExp): string | null {
  const match = regex.exec(html);
  return match?.[1] ? decodeEntities(stripTags(match[1])) : null;
}

function allMatches(html: string, regex: RegExp): string[] {
  return Array.from(html.matchAll(regex))
    .map((match) => decodeEntities(stripTags(match[1] || "")))
    .filter(Boolean);
}

export function parseSite(html: string, pageUrl: string): ParsedSite {
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i) ||
    firstMatch(html, /<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i);
  const canonical = firstMatch(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([\s\S]*?)["'][^>]*>/i) ||
    firstMatch(html, /<link[^>]+href=["']([\s\S]*?)["'][^>]+rel=["']canonical["'][^>]*>/i);
  const openGraphTitle = firstMatch(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i) ||
    firstMatch(html, /<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:title["'][^>]*>/i);
  const openGraphDescription = firstMatch(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i) ||
    firstMatch(html, /<meta[^>]+content=["']([\s\S]*?)["'][^>]+property=["']og:description["'][^>]*>/i);
  const lang = firstMatch(html, /<html[^>]+lang=["']([\w-]+)["'][^>]*>/i);
  const h1 = allMatches(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi);
  const h2 = allMatches(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi);
  const jsonLdCount = Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi)).length;
  const anchors = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)).map((m) => m[1]);
  const base = new URL(pageUrl);
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];

  for (const href of anchors) {
    try {
      const resolved = new URL(href, base).toString();
      if (new URL(resolved).host === base.host) internalLinks.push(resolved);
      else externalLinks.push(resolved);
    } catch {
      // ignore invalid URLs
    }
  }

  const stripped = decodeEntities(stripTags(html));
  const words = stripped.split(/\s+/).filter(Boolean);

  return {
    title,
    metaDescription,
    canonical,
    h1,
    h2,
    openGraphTitle,
    openGraphDescription,
    jsonLdCount,
    internalLinks: Array.from(new Set(internalLinks)).slice(0, 100),
    externalLinks: Array.from(new Set(externalLinks)).slice(0, 100),
    textSample: words.slice(0, 180).join(" "),
    wordCountEstimate: words.length,
    lang
  };
}
