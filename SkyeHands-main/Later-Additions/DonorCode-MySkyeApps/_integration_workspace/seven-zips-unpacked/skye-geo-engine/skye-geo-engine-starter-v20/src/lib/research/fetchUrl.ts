import { fetchText, normalizeUrl } from '../fetcher.ts';

export async function fetchUrlSource(input: string): Promise<{ sourceUrl: string; html: string; status: number }> {
  const normalized = normalizeUrl(input);
  const response = await fetchText(normalized);
  return {
    sourceUrl: response.url,
    html: response.html,
    status: response.status
  };
}
