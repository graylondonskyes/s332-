import type { PublishRunRecord } from '../db.ts';
import { AppError } from '../errors.ts';

export type PublishExecutionInput = {
  publishRun: PublishRunRecord;
  targetUrl: string;
  collectionId?: string | null;
  authToken?: string | null;
};

export function buildWebflowRequest(input: PublishExecutionInput): RequestInit & { url: string } {
  const collectionId = input.collectionId?.trim();
  if (!collectionId) throw new AppError(400, 'missing_collection_id', 'collectionId is required for Webflow publishing.');
  return {
    url: input.targetUrl.replace(/\/$/, '') + `/collections/${collectionId}/items`,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(input.authToken ? { authorization: `Bearer ${input.authToken}` } : {})
    },
    body: JSON.stringify((input.publishRun.payload as any).payload || input.publishRun.payload)
  };
}
