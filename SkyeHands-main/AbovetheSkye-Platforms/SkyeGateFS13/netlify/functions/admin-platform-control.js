import fs from "node:fs";
import path from "node:path";

import { wrap } from "./_lib/wrap.js";
import { buildCors, json } from "./_lib/http.js";
import { requireAdmin } from "./_lib/admin.js";
import { q } from "./_lib/db.js";

const PLATFORM_CATALOG = [
  {
    app_id: "skygatefs13",
    title: "SkyeGateFS13",
    description: "Parent auth, billing, vendor, push, and monitoring control plane.",
    visibility: "admin",
    storage_mode: "server-state",
    launch_url: "/index.html"
  },
  {
    app_id: "superidev3-8",
    title: "SuperIDEv3.8",
    description: "Primary app surface currently bridged into SkyeGateFS13 auth and parent audit.",
    visibility: "operator",
    storage_mode: "hybrid-bridge",
    launch_url: "/Platforms-Apps-Infrastructure/"
  },
  {
    app_id: "skyehands-runtime-control",
    title: "SkyeHands Runtime Control",
    description: "Modified Theia/OpenHands shell runtime with gate env wiring and parent event mirror hooks.",
    visibility: "operator",
    storage_mode: "runtime-control",
    launch_url: null
  },
  {
    app_id: "0s-auth-sdk",
    title: "0s Auth SDK",
    description: "Compatibility client reduced toward a SkyeGateFS13 login bridge.",
    visibility: "bridge",
    storage_mode: "client-bridge",
    launch_url: null
  },
  {
    app_id: "skymail-standalone",
    title: "SkyeMail Standalone",
    description: "Integrated mail suite lane hosted under SuperIDE with its own platform state.",
    visibility: "operator",
    storage_mode: "app-local-plus-gate",
    launch_url: null
  }
];

function integrationDocsRoot() {
  return path.join(process.cwd(), "docs", "integration-dossiers");
}

function countIntegrationDocs() {
  try {
    const dir = integrationDocsRoot();
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter((name) => name.endsWith(".md")).length;
  } catch {
    return 0;
  }
}

function getBackupBrainState() {
  const openai = String(process.env.OPENAI_API_KEY || "").trim();
  const anthropic = String(process.env.ANTHROPIC_API_KEY || "").trim();
  const gemini = String(process.env.GEMINI_API_KEY || "").trim();
  const model = String(process.env.SKYGATEFS13_GATE_MODEL || process.env.SKYGATE_GATE_MODEL || "kaixu/deep").trim();
  if (openai) return { configured: true, provider: "openai", model, locked: true };
  if (anthropic) return { configured: true, provider: "anthropic", model, locked: true };
  if (gemini) return { configured: true, provider: "gemini", model, locked: true };
  return { configured: false, provider: null, model: null, locked: false };
}

function summarizePlatform(platform, ops) {
  if (ops?.notes) return String(ops.notes).slice(0, 200);
  if (platform.app_id === "superidev3-8") return "Gate login bridge, parent audit mirror, and local app provisioning coexist here.";
  if (platform.app_id === "skyehands-runtime-control") return "Runtime shell can target SkyeGateFS13 through aliased env vars and mirror audit events upward.";
  if (platform.app_id === "0s-auth-sdk") return "Client-side compatibility lane points at gate login but still needs fuller runtime/env adoption.";
  if (platform.app_id === "skymail-standalone") return "Standalone mail suite remains app-local in behavior while the host app moves toward gate ownership.";
  return platform.description;
}

export default wrap(async (req) => {
  const cors = buildCors(req);
  if (req.method === "OPTIONS") return new Response("", { status: 204, headers: cors });
  const admin = requireAdmin(req);
  if (!admin) return json(401, { error: "Unauthorized" }, cors);
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, cors);

  const [opsRes, customerRes, threadRes, remoteDocRes] = await Promise.all([
    q(`select app_id, health_status, onboarding_stage, lifecycle_status, owner, notes, last_checked_at, updated_at
       from platform_operator_state`, []),
    q(`select
          count(*)::int as total,
          count(*) filter (where is_active=true)::int as active,
          coalesce(sum(max_devices_per_key),0)::int as cohort_seats
       from customers`, []),
    q(`select count(*)::int as audit_rows
       from audit_events
       where action='PLATFORM_EVENT_MIRROR'`, []),
    q(`select count(*)::int as doc_count
       from audit_events
       where action='PLATFORM_EVENT_MIRROR'
         and coalesce(meta->>'lane','')='workspace'`, [])
  ]);

  const opsMap = new Map((opsRes.rows || []).map((row) => [row.app_id, row]));
  const customerStats = customerRes.rows?.[0] || {};
  const integrationDocCount = countIntegrationDocs();
  const backup_brain = getBackupBrainState();

  const platforms = PLATFORM_CATALOG.map((platform) => {
    const ops = opsMap.get(platform.app_id) || null;
    return {
      ...platform,
      storage_status: ops ? "operator-reviewed" : "linked-only",
      summary_text: summarizePlatform(platform, ops),
      updated_at: ops?.updated_at || null,
      platform_ops: ops || null
    };
  });

  const attentionNeeded = platforms.filter((platform) => {
    const health = platform.platform_ops?.health_status || "unreviewed";
    const onboarding = platform.platform_ops?.onboarding_stage || "untracked";
    return ["warning", "critical", "unreviewed"].includes(health) || ["queued", "in-progress", "blocked", "untracked"].includes(onboarding);
  }).length;

  const onboardingInflight = platforms.filter((platform) => {
    const onboarding = platform.platform_ops?.onboarding_stage || "untracked";
    return ["queued", "in-progress", "blocked"].includes(onboarding);
  }).length;

  return json(200, {
    storage_ready: true,
    backup_brain,
    counts: {
      surfaces: platforms.length,
      connected_remote_docs: Math.max(integrationDocCount, Number(remoteDocRes.rows?.[0]?.doc_count || 0)),
      cohort_seats: Number(customerStats.cohort_seats || 0),
      skymail_threads: Number(threadRes.rows?.[0]?.audit_rows || 0),
      attention_needed: attentionNeeded,
      onboarding_inflight: onboardingInflight,
      station_active_customers: Number(customerStats.active || 0),
      reviewed_platforms: opsMap.size
    },
    platforms
  }, cors);
});
