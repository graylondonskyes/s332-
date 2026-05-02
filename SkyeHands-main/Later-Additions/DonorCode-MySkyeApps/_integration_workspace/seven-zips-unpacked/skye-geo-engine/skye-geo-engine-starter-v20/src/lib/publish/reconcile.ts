import { AppError } from '../errors.ts';

export type PublishResponseSummary = {
  status: 'success' | 'failed';
  responseStatus: number;
  remoteId: string | null;
  responseExcerpt: string;
  lastError: string | null;
};

export async function parsePublishResponse(response: Response): Promise<PublishResponseSummary> {
  const text = await response.text();
  let parsed: Record<string, unknown> | null = null;
  try { parsed = text ? JSON.parse(text) as Record<string, unknown> : null; } catch { parsed = null; }
  const remoteId = parsed && typeof parsed.id === 'string'
    ? parsed.id
    : parsed && parsed.data && typeof (parsed.data as any).id === 'string'
    ? String((parsed.data as any).id)
    : parsed && parsed.post && typeof (parsed.post as any).id === 'string'
    ? String((parsed.post as any).id)
    : null;
  const excerpt = text.slice(0, 500);
  if (!response.ok) {
    return { status: 'failed', responseStatus: response.status, remoteId, responseExcerpt: excerpt, lastError: excerpt || `Remote publish failed with ${response.status}.` };
  }
  return { status: 'success', responseStatus: response.status, remoteId, responseExcerpt: excerpt, lastError: null };
}

export function ensureRetryableStatus(status: string): void {
  if (status !== 'failed') throw new AppError(400, 'publish_not_retryable', 'Only failed publish runs can be retried.');
}
