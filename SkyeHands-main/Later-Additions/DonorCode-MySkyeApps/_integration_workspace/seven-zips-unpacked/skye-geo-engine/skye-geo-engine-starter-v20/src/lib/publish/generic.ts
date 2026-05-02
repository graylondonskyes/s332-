import type { PublishRunRecord } from '../db.ts';

export type PublishExecutionInput = {
  publishRun: PublishRunRecord;
  targetUrl: string;
  authToken?: string | null;
};

export function buildGenericRequest(input: PublishExecutionInput): RequestInit & { url: string } {
  return {
    url: input.targetUrl,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(input.authToken ? { authorization: `Bearer ${input.authToken}` } : {})
    },
    body: JSON.stringify((input.publishRun.payload as any).payload || input.publishRun.payload)
  };
}
