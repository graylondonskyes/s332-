import { meterUsage, requireRole } from '../../lib/access.ts';
import { resolveEnv } from '../../lib/env.ts';
import { AppError } from '../../lib/errors.ts';
import { created, json, readJson } from '../../lib/http.ts';
import { createClient, createInvoiceExport, createSeat, getOrgSettings, listClients, listInvoiceExports, listSeats, listUsage, summarizeUsage, upsertOrgSettings, type ClientRecord, type SeatRecord, type UserRole } from '../../lib/platformStore.ts';
import { readTenantScope } from '../../lib/tenant.ts';

const seatRoles: UserRole[] = ['owner', 'admin', 'editor', 'viewer'];
const seatStatuses: SeatRecord['status'][] = ['invited', 'active', 'disabled'];
const clientStatuses: ClientRecord['status'][] = ['active', 'paused'];

export async function handleAgency(request: Request, runtimeEnv: unknown): Promise<Response> {
  resolveEnv(runtimeEnv);
  const path = new URL(request.url).pathname;

  if (path === '/v1/agency/settings') {
    if (request.method === 'GET') {
      const scope = readTenantScope(request, null);
      requireRole(request, scope.orgId, 'viewer');
      return json({ ok: true, settings: getOrgSettings(scope.orgId) });
    }
    if (request.method === 'POST') {
      const body = await readJson<any>(request);
      const scope = readTenantScope(request, body as Record<string, unknown>);
      requireRole(request, scope.orgId, 'admin');
      const settings = upsertOrgSettings(scope.orgId, {
        displayName: body.displayName,
        primaryColor: body.primaryColor,
        logoUrl: body.logoUrl,
        customDomain: body.customDomain,
        quotas: body.quotas,
        pricing: body.pricing
      });
      meterUsage(scope.orgId, { metric: 'agencySettingsUpdates', units: 1, meta: { updatedAt: settings.updatedAt } });
      return json({ ok: true, settings });
    }
  }

  if (path === '/v1/agency/seats') {
    if (request.method === 'GET') {
      const scope = readTenantScope(request, null);
      requireRole(request, scope.orgId, 'viewer');
      return json({ ok: true, items: listSeats(scope.orgId) });
    }
    if (request.method === 'POST') {
      const body = await readJson<any>(request);
      const scope = readTenantScope(request, body as Record<string, unknown>);
      requireRole(request, scope.orgId, 'admin');
      const role = seatRoles.includes(body.role) ? body.role : 'viewer';
      const status = seatStatuses.includes(body.status) ? body.status : 'invited';
      const seat = createSeat(scope.orgId, { email: String(body.email || '').trim(), role, status, clientId: body.clientId || null });
      meterUsage(scope.orgId, { metric: 'seatInvites', units: 1, meta: { seatId: seat.id, role } });
      return created({ ok: true, seat });
    }
  }

  if (path === '/v1/agency/clients') {
    if (request.method === 'GET') {
      const scope = readTenantScope(request, null);
      requireRole(request, scope.orgId, 'viewer');
      return json({ ok: true, items: listClients(scope.orgId) });
    }
    if (request.method === 'POST') {
      const body = await readJson<any>(request);
      const scope = readTenantScope(request, body as Record<string, unknown>);
      requireRole(request, scope.orgId, 'admin');
      const status = clientStatuses.includes(body.status) ? body.status : 'active';
      const client = createClient(scope.orgId, { name: String(body.name || '').trim(), contactEmail: body.contactEmail || null, brandName: body.brandName || null, status });
      meterUsage(scope.orgId, { metric: 'resellerClients', units: 1, meta: { clientId: client.id } });
      return created({ ok: true, client });
    }
  }

  if (path === '/v1/agency/usage') {
    if (request.method === 'GET') {
      const scope = readTenantScope(request, null);
      requireRole(request, scope.orgId, 'viewer');
      return json({ ok: true, summary: summarizeUsage(scope.orgId), items: listUsage(scope.orgId) });
    }
    if (request.method === 'POST') {
      const body = await readJson<any>(request);
      const scope = readTenantScope(request, body as Record<string, unknown>);
      requireRole(request, scope.orgId, 'admin');
      const event = meterUsage(scope.orgId, { workspaceId: scope.workspaceId, projectId: scope.projectId, metric: String(body.metric || 'manualUsageEvent'), units: Number(body.units || 1), meta: body.meta || {} });
      return created({ ok: true, event, summary: summarizeUsage(scope.orgId) });
    }
  }

  if (path === '/v1/agency/invoices/export') {
    if (request.method === 'GET') {
      const scope = readTenantScope(request, null);
      requireRole(request, scope.orgId, 'viewer');
      return json({ ok: true, items: listInvoiceExports(scope.orgId) });
    }
    if (request.method === 'POST') {
      const body = await readJson<any>(request);
      const scope = readTenantScope(request, body as Record<string, unknown>);
      requireRole(request, scope.orgId, 'admin');
      const invoiceExport = createInvoiceExport(scope.orgId, body.periodKey);
      return json({ ok: true, invoiceExport });
    }
  }

  throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
}
