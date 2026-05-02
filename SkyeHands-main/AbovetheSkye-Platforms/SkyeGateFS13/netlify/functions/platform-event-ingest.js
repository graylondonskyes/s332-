import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { q } from "./_lib/db.js";
import { audit } from "./_lib/audit.js";
import { emitEvent, getRequestId } from "./_lib/monitor.js";

function readMirrorSecret(req) {
  return String(
    req.headers.get("x-skygate-mirror-secret") ||
    req.headers.get("x-skygate-event-mirror-secret") ||
    ""
  ).trim();
}

function configuredMirrorSecret() {
  return String(
    process.env.SKYGATE_EVENT_MIRROR_SECRET ||
    process.env.SKYGATEFS13_EVENT_MIRROR_SECRET ||
    ""
  ).trim();
}

function normalizeText(value, max = 400) {
  return String(value || "").trim().slice(0, max);
}

function normalizeMeta(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  return {};
}

function inferLane(type, meta) {
  const t = normalizeText(type, 160).toLowerCase();
  const joined = `${t} ${JSON.stringify(meta || {})}`.toLowerCase();
  if (joined.includes("auth")) return "auth";
  if (joined.includes("push") || joined.includes("deploy") || joined.includes("github")) return "push";
  if (joined.includes("invoice") || joined.includes("billing") || joined.includes("payment") || joined.includes("checkout")) return "billing";
  if (joined.includes("voice") || joined.includes("twilio") || joined.includes("call")) return "voice";
  if (joined.includes("mail") || joined.includes("smtp") || joined.includes("gmail") || joined.includes("resend")) return "mail";
  if (joined.includes("workspace") || joined.includes("document") || joined.includes("save")) return "workspace";
  if (joined.includes("ai") || joined.includes("prompt") || joined.includes("generation") || joined.includes("provider")) return "ai";
  if (joined.includes("org") || joined.includes("team") || joined.includes("member")) return "org";
  return "platform";
}

function inferBillable(lane, meta) {
  if (meta?.billable === true) return true;
  if (meta?.billable === false) return false;
  return ["ai", "push", "voice", "mail", "billing"].includes(lane);
}

function inferPrivileged(lane, type) {
  const t = normalizeText(type, 160).toLowerCase();
  if (["auth", "billing", "push", "org"].includes(lane)) return true;
  return /(revoke|issue|admin|delete|rotate|deploy|invite|grant|reset)/.test(t);
}

async function resolveActorContext(actor) {
  const email = normalizeText(actor, 320).toLowerCase();
  if (!email || !email.includes("@")) {
    return { actor_email: email || null, user_id: null, customer_id: null };
  }
  const res = await q(
    "select id, email, primary_customer_id from users where lower(email)=lower($1) limit 1",
    [email]
  );
  const row = res.rows?.[0];
  return {
    actor_email: row?.email || email,
    user_id: row?.id || null,
    customer_id: Number.isFinite(row?.primary_customer_id) ? row.primary_customer_id : null
  };
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, cors);

  const expected = configuredMirrorSecret();
  if (!expected) {
    return json(501, { error: "SkyeGate event mirror secret is not configured." }, cors);
  }

  const provided = readMirrorSecret(req);
  if (!provided || provided !== expected) {
    return json(401, { error: "Unauthorized" }, cors);
  }

  const body = await req.json().catch(() => ({}));
  const source_app = normalizeText(body?.source_app || "unknown-app", 120);
  const actor = normalizeText(body?.actor || "", 320);
  const org_id = normalizeText(body?.org_id || "", 120) || null;
  const ws_id = normalizeText(body?.ws_id || "", 120) || null;
  const type = normalizeText(body?.type || "platform.event", 160) || "platform.event";
  const meta = normalizeMeta(body?.meta);
  const event_ts = normalizeText(body?.event_ts || new Date().toISOString(), 80);
  const lane = inferLane(type, meta);
  const billable = inferBillable(lane, meta);
  const privileged = inferPrivileged(lane, type);

  const request_id = getRequestId(req);
  const actorContext = await resolveActorContext(actor);

  await emitEvent({
    request_id,
    level: "info",
    kind: "platform.audit",
    function_name: "platform-event-ingest",
    method: req.method,
    path: new URL(req.url).pathname,
    app_id: source_app,
    customer_id: actorContext.customer_id,
    extra: {
      mirrored_type: type,
      mirrored_actor: actorContext.actor_email,
      mirrored_user_id: actorContext.user_id,
      mirrored_org_id: org_id,
      mirrored_ws_id: ws_id,
      mirrored_event_ts: event_ts,
      mirrored_lane: lane,
      mirrored_billable: billable,
      mirrored_privileged: privileged,
      mirrored_meta: meta
    }
  });

  await audit(
    actorContext.actor_email ? `platform:${source_app}:${actorContext.actor_email}` : `platform:${source_app}`,
    "PLATFORM_EVENT_MIRROR",
    ws_id ? `workspace:${ws_id}` : (org_id ? `org:${org_id}` : `app:${source_app}`),
    {
      request_id,
      source_app,
      actor_email: actorContext.actor_email,
      user_id: actorContext.user_id,
      customer_id: actorContext.customer_id,
      org_id,
      ws_id,
      type,
      lane,
      billable,
      privileged,
      event_ts,
      meta
    }
  );

  return json(200, { ok: true, request_id }, cors);
});
