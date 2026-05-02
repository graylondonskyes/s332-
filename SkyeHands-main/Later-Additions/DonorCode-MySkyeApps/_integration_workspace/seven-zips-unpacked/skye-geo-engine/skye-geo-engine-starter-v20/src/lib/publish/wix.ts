import type { PublishRunRecord } from '../db.ts';

export type PublishExecutionInput = {
  publishRun: PublishRunRecord;
  targetUrl: string;
  authToken?: string | null;
  memberId?: string | null;
};

export function buildWixRequest(input: PublishExecutionInput): RequestInit & { url: string } {
  const payload = (input.publishRun.payload as any).payload || input.publishRun.payload;
  return {
    url: input.targetUrl.replace(/\/$/, '') + '/blog/v3/draft-posts',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(input.authToken ? { authorization: `Bearer ${input.authToken}` } : {})
    },
    body: JSON.stringify({
      ...payload,
      ...(input.memberId ? { memberId: input.memberId } : {})
    })
  };
}
