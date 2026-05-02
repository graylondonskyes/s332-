import type { PublishRunRecord } from '../db.ts';
import { AppError } from '../errors.ts';

export type PublishExecutionInput = {
  publishRun: PublishRunRecord;
  targetUrl: string;
  blogId?: string | null;
  authToken?: string | null;
};

export function buildShopifyRequest(input: PublishExecutionInput): RequestInit & { url: string } {
  const blogId = input.blogId?.trim();
  if (!blogId) throw new AppError(400, 'missing_blog_id', 'blogId is required for Shopify publishing.');
  return {
    url: input.targetUrl.replace(/\/$/, '') + `/admin/api/2025-10/blogs/${blogId}/articles.json`,
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(input.authToken ? { 'x-shopify-access-token': input.authToken } : {})
    },
    body: JSON.stringify((input.publishRun.payload as any).payload || input.publishRun.payload)
  };
}
