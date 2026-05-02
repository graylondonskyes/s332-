import { AppError, toAppError } from './errors.ts';

const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,x-org-id,x-workspace-id,x-project-id,x-api-key'
};

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

export function html(markup: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(markup, { ...init, headers });
}

export async function readJson<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

export function badRequest(message: string, details?: unknown): Response {
  return json({ ok: false, error: message, details }, { status: 400 });
}

export function notFound(): Response {
  return json({ ok: false, error: 'not_found' }, { status: 404 });
}

export function created(data: unknown): Response {
  return json(data, { status: 201 });
}

export function ok(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export function methodNotAllowed(): Response {
  return json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
}

export async function withErrorBoundary(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    const appError = toAppError(error);
    return json({ ok: false, error: appError.code, message: appError.message, details: appError.details }, { status: appError.status });
  }
}

export function assertNonEmpty(value: string | null | undefined, code: string, message: string): string {
  const trimmed = value?.trim() || '';
  if (!trimmed) throw new AppError(400, code, message);
  return trimmed;
}
