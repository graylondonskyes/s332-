import type { PublishRunRecord } from '../db.ts';

export type PublishExecutionInput = {
  publishRun: PublishRunRecord;
  targetUrl: string;
  authToken?: string | null;
};

export function buildWordpressRequest(input: PublishExecutionInput): RequestInit & { url: string } {
  return {
    url: input.targetUrl.replace(/\/$/, '') + '/wp-json/wp/v2/posts',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(input.authToken ? { authorization: `Bearer ${input.authToken}` } : {})
    },
    body: JSON.stringify((input.publishRun.payload as any).payload || input.publishRun.payload)
  };
}
