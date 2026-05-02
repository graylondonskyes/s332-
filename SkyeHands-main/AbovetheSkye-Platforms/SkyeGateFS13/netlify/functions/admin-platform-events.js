import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { requireAdmin } from "./_lib/admin.js";
import { q } from "./_lib/db.js";

function normalizeLimit(value) {
  const parsed = parseInt(String(value || "100"), 10);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(500, parsed));
}

function buildSummary(event) {
  const lane = event.lane || event.kind || "platform";
  if (event.source === "audit") {
    return `${lane} · ${event.type || event.action || "event"}`;
  }
  if (event.summary) return event.summary;
  return `${lane} · ${event.kind || event.type || "event"}`;
}

function buildTargetLabel(event) {
  if (event.ws_id) return `workspace:${event.ws_id}`;
  if (event.org_id) return `org:${event.org_id}`;
  if (event.app_id) return `app:${event.app_id}`;
  return event.target || "";
}

function formatAuditRow(row) {
  const meta = row.meta || {};
  return {
    id: `audit:${row.id}`,
    source: "audit",
    created_at: row.created_at,
    actor: row.actor,
    action: meta.type || row.action,
    type: meta.type || row.action,
    lane: meta.lane || "platform",
    billable: !!meta.billable,
    privileged: !!meta.privileged,
    app_id: meta.source_app || null,
    org_id: meta.org_id || null,
    ws_id: meta.ws_id || null,
    customer_id: meta.customer_id || null,
    user_id: meta.user_id || null,
    event_ts: meta.event_ts || null,
    status: meta.privileged ? "privileged" : "mirrored",
    target: row.target || null,
    targetLabel: buildTargetLabel({ ...meta, target: row.target }),
    groupLabel: meta.lane || "platform",
    summary: buildSummary({ source: "audit", lane: meta.lane, type: meta.type || row.action }),
    meta
  };
}

function formatMonitorRow(row) {
  const extra = row.extra || {};
  return {
    id: `monitor:${row.id}`,
    source: "monitor",
    created_at: row.created_at,
    actor: extra.mirrored_actor || "",
    action: extra.mirrored_type || row.kind,
    type: extra.mirrored_type || row.kind,
    lane: extra.mirrored_lane || "platform",
    billable: !!extra.mirrored_billable,
    privileged: !!extra.mirrored_privileged,
    app_id: row.app_id || null,
    org_id: extra.mirrored_org_id || null,
    ws_id: extra.mirrored_ws_id || null,
    customer_id: row.customer_id || null,
    user_id: extra.mirrored_user_id || null,
    event_ts: extra.mirrored_event_ts || null,
    status: row.level || "info",
    http_status: row.http_status || null,
    kind: row.kind || null,
    target: row.function_name || null,
    targetLabel: buildTargetLabel({ app_id: row.app_id, ws_id: extra.mirrored_ws_id, org_id: extra.mirrored_org_id }),
    groupLabel: extra.mirrored_lane || row.kind || "platform",
    summary: buildSummary({ summary: extra.mirrored_type, lane: extra.mirrored_lane, kind: row.kind }),
    meta: extra.mirrored_meta || {},
    raw_extra: extra
  };
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  const url = new URL(req.url);
  const app_id = String(url.searchParams.get("app_id") || "").trim();
  const limit = normalizeLimit(url.searchParams.get("limit"));

  const auditRows = await q(
    `select id, actor, action, target, meta, created_at
     from audit_events
     where action='PLATFORM_EVENT_MIRROR'
       and ($1 = '' or meta->>'source_app' = $1)
     order by created_at desc
     limit $2`,
    [app_id, limit]
  );

  const monitorRows = await q(
    `select id, app_id, customer_id, level, kind, function_name, http_status, extra, created_at
     from gateway_events
     where kind='platform.audit'
       and ($1 = '' or app_id = $1)
     order by created_at desc
     limit $2`,
    [app_id, limit]
  );

  const events = [
    ...auditRows.rows.map(formatAuditRow),
    ...monitorRows.rows.map(formatMonitorRow)
  ].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, limit);

  const summary = events.reduce((acc, event) => {
    acc.total += 1;
    acc.by_lane[event.lane] = (acc.by_lane[event.lane] || 0) + 1;
    if (event.billable) acc.billable += 1;
    if (event.privileged) acc.privileged += 1;
    return acc;
  }, { total: 0, billable: 0, privileged: 0, by_lane: {} });

  return json(200, {
    app_id: app_id || null,
    limit,
    summary,
    events
  }, cors);
});
