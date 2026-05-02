import type { PublishRunRecord } from '../db.ts';

export type PublishExecutionInput = {
  publishRun: PublishRunRecord;
  targetUrl: string;
  authToken?: string | null;
  acceptVersion?: string | null;
};

export function buildGhostRequest(input: PublishExecutionInput): RequestInit & { url: string } {
  return {
    url: input.targetUrl.replace(/\/$/, '') + '/ghost/api/admin/posts/?source=html',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'accept-version': input.acceptVersion?.trim() || 'v5.0',
      ...(input.authToken ? { authorization: `Ghost ${input.authToken}` } : {})
    },
    body: JSON.stringify((input.publishRun.payload as any).payload || input.publishRun.payload)
  };
}
