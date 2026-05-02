import { parseSite } from '../html.ts';
import { stripHtml } from './extractText.ts';

export type NormalizeSourceInput = {
  sourceUrl?: string | null;
  html?: string | null;
  rawText?: string | null;
  retrievalOrigin: string;
};

export type NormalizedSource = {
  sourceUrl: string | null;
  canonicalUrl: string | null;
  siteName: string | null;
  title: string;
  snippet: string;
  contentText: string;
  contentHash: string;
  retrievalOrigin: string;
  retrievedAt: string;
  publishedAt: string | null;
};

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function normalizeSource(input: NormalizeSourceInput): Promise<NormalizedSource> {
  const retrievedAt = new Date().toISOString();
  const html = input.html?.trim() || '';
  const text = input.rawText?.trim() || (html ? stripHtml(html) : '');
  let title = 'Untitled Source';
  let canonicalUrl: string | null = input.sourceUrl || null;
  let siteName: string | null = input.sourceUrl ? new URL(input.sourceUrl).hostname.replace(/^www\./, '') : null;
  let publishedAt: string | null = null;
  let snippet = text.slice(0, 320);

  if (html && input.sourceUrl) {
    const parsed = parseSite(html, input.sourceUrl);
    title = parsed.title || title;
    canonicalUrl = parsed.canonical || canonicalUrl;
    snippet = parsed.textSample || snippet;
  } else if (text) {
    title = text.split(/[.!?]/)[0]?.slice(0, 120) || title;
  }

  const contentText = text;
  const contentHash = await sha256(`${canonicalUrl || input.sourceUrl || 'inline'}::${contentText}`);

  return {
    sourceUrl: input.sourceUrl || null,
    canonicalUrl,
    siteName,
    title,
    snippet,
    contentText,
    contentHash,
    retrievalOrigin: input.retrievalOrigin,
    retrievedAt,
    publishedAt
  };
}
