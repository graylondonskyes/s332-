import type { SourceRecord, StorageAdapter } from '../db.ts';
import type { NormalizedSource } from './normalizeSource.ts';

export async function persistSourceLedger(db: StorageAdapter, scope: { orgId: string; workspaceId: string; projectId: string | null }, normalized: NormalizedSource[]) {
  return db.upsertSources(normalized.map((item) => ({
    orgId: scope.orgId,
    workspaceId: scope.workspaceId,
    projectId: scope.projectId,
    sourceUrl: item.sourceUrl,
    canonicalUrl: item.canonicalUrl,
    siteName: item.siteName,
    title: item.title,
    snippet: item.snippet,
    contentText: item.contentText,
    contentHash: item.contentHash,
    retrievalOrigin: item.retrievalOrigin,
    retrievedAt: item.retrievedAt,
    publishedAt: item.publishedAt
  })));
}

export function toSourceSummary(source: SourceRecord): { sourceId: string; title: string; canonicalUrl: string | null; snippet: string } {
  return {
    sourceId: source.id,
    title: source.title,
    canonicalUrl: source.canonicalUrl,
    snippet: source.snippet
  };
}
