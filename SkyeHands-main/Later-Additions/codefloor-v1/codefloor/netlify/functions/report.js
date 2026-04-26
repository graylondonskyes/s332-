// netlify/functions/report.js
// Generates a shareable report snapshot. For PDF, trigger browser print or
// use a headless renderer (Playwright via Netlify background function).
import { neon } from "@neondatabase/serverless";
import { jwtDecode } from "jwt-decode";
import { Resend } from "resend";

const sql = neon(process.env.DATABASE_URL);
const resend = new Resend(process.env.RESEND_API_KEY);

const H = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Content-Type": "application/json",
};

function getUser(e) {
  const a = e.headers?.authorization || "";
  if (!a.startsWith("Bearer ")) return null;
  try { const d = jwtDecode(a.slice(7)); return d.exp * 1000 < Date.now() ? null : { id: d.sub, email: d.email, name: d.user_metadata?.full_name }; }
  catch { return null; }
}

function fmt(n) {
  const m = parseFloat(n) || 0;
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  return `$${m.toFixed(2)}M`;
}

// ── PUBLIC SHARE (no auth) ────────────────────────────────────────────────────
// GET /report?token=SHARE_TOKEN
async function publicShare(token) {
  const [project] = await sql`
    SELECT p.*, u.name AS owner_name FROM projects p
    JOIN users u ON u.id = p.owner_id
    WHERE p.share_token = ${token} AND p.share_enabled = true AND p.status = 'active'`;
  if (!project) return { statusCode: 404, headers: H, body: JSON.stringify({ error: "Report not found or sharing disabled" }) };

  const sections = await sql`SELECT * FROM sections WHERE project_id = ${project.id} ORDER BY position`;
  const gaps = await sql`SELECT * FROM gaps WHERE project_id = ${project.id} ORDER BY position`;
  const comps = await sql`SELECT * FROM comps WHERE project_id = ${project.id} ORDER BY position`;

  const sectionTotal = sections.reduce((a, s) => a + parseFloat(s.value_m), 0);
  const floor = parseFloat(project.base_floor) + sectionTotal;

  return {
    statusCode: 200,
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({ project, sections, gaps, comps, floor, generatedAt: new Date().toISOString() })
  };
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: H, body: "" };

  // Public share link
  const token = event.queryStringParameters?.token;
  if (event.httpMethod === "GET" && token) return publicShare(token);

  // Auth required below
  const user = getUser(event);
  if (!user) return { statusCode: 401, headers: H, body: JSON.stringify({ error: "Unauthorized" }) };

  const projectId = event.queryStringParameters?.projectId;
  if (!projectId) return { statusCode: 400, headers: H, body: JSON.stringify({ error: "projectId required" }) };

  const [project] = await sql`SELECT * FROM projects WHERE id = ${projectId} AND owner_id = ${user.id}`;
  if (!project) return { statusCode: 404, headers: H, body: JSON.stringify({ error: "Not found" }) };

  // ── TOGGLE SHARE ─────────────────────────────────────────────────────────────
  if (event.httpMethod === "POST" && event.queryStringParameters?.action === "toggle-share") {
    const [updated] = await sql`
      UPDATE projects SET share_enabled = NOT share_enabled WHERE id = ${projectId} RETURNING share_enabled, share_token`;
    return { statusCode: 200, headers: H, body: JSON.stringify(updated) };
  }

  // ── EMAIL REPORT ─────────────────────────────────────────────────────────────
  if (event.httpMethod === "POST" && event.queryStringParameters?.action === "email") {
    const { to } = JSON.parse(event.body || "{}");
    if (!to) return { statusCode: 400, headers: H, body: JSON.stringify({ error: "to required" }) };

    const sections = await sql`SELECT * FROM sections WHERE project_id = ${projectId} ORDER BY position`;
    const gaps = await sql`SELECT * FROM gaps WHERE project_id = ${projectId} ORDER BY position`;
    const floor = parseFloat(project.base_floor) + sections.reduce((a, s) => a + parseFloat(s.value_m), 0);
    const shareUrl = `${process.env.SITE_URL}/share/${project.share_token}`;

    const proven = sections.filter(s => s.status === "proven");
    const provenTotal = parseFloat(project.base_floor) + proven.reduce((a, s) => a + parseFloat(s.value_m), 0);
    const provenPct = floor > 0 ? Math.round((provenTotal / floor) * 100) : 0;

    await resend.emails.send({
      from: `CodeFloor <reports@${process.env.EMAIL_DOMAIN || "codefloor.io"}>`,
      to: [to],
      reply_to: user.email,
      subject: `Valuation Report: ${project.name}`,
      html: buildEmailHtml({ project, sections, gaps, floor, provenPct, shareUrl, senderName: user.name }),
    });

    await sql`INSERT INTO audit_log (user_id, project_id, action, detail)
              VALUES (${user.id}, ${projectId}, 'report.email', ${JSON.stringify({ to })})`;

    return { statusCode: 200, headers: H, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, headers: H, body: JSON.stringify({ error: "Unknown action" }) };
};

function buildEmailHtml({ project, sections, gaps, floor, provenPct, shareUrl, senderName }) {
  const by_cat = {};
  sections.forEach(s => { (by_cat[s.category] = by_cat[s.category] || []).push(s); });

  const STATUS_COLOR = { proven: "#0d9e75", aspirational: "#ef9f27", open: "#e24b4a" };

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Valuation Report: ${project.name}</title>
<style>
  body{margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Arial,sans-serif;}
  .wrap{max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);}
  .header{background:#09090b;padding:32px 36px;color:#fff;}
  .header h1{margin:0 0 4px;font-size:22px;font-weight:600;color:#fff;}
  .header .sub{font-size:13px;color:#71717a;margin:0;}
  .body{padding:32px 36px;}
  .metric-row{display:flex;gap:12px;margin-bottom:24px;}
  .metric{flex:1;background:#f4f4f5;border-radius:8px;padding:16px;text-align:center;}
  .metric-n{font-size:22px;font-weight:600;color:#09090b;}
  .metric-l{font-size:11px;color:#71717a;margin-top:4px;}
  .section-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f4f4f5;font-size:13px;}
  .badge{display:inline-block;padding:2px 8px;border-radius:100px;font-size:10px;font-weight:600;}
  .cta{display:block;margin:24px auto 0;text-align:center;background:#f5c842;color:#09090b;font-weight:700;font-size:14px;padding:14px 28px;border-radius:8px;text-decoration:none;}
  .footer{background:#f4f4f5;padding:20px 36px;text-align:center;font-size:11px;color:#a1a1aa;}
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <div style="font-size:11px;letter-spacing:.1em;color:#71717a;margin-bottom:12px;text-transform:uppercase;">CodeFloor · Platform Valuation</div>
    <h1>${project.name}</h1>
    <p class="sub">${project.description || ""} ${project.pass_name ? `· ${project.pass_name}` : ""}</p>
  </div>
  <div class="body">
    <div class="metric-row">
      <div class="metric"><div class="metric-n" style="color:#0d9e75;">${fmt(floor)}</div><div class="metric-l">Code-floor valuation</div></div>
      <div class="metric"><div class="metric-n">${provenPct}%</div><div class="metric-l">Proven sections</div></div>
      <div class="metric"><div class="metric-n">${sections.length}</div><div class="metric-l">Total sections</div></div>
    </div>
    <h3 style="font-size:13px;font-weight:600;color:#09090b;margin:0 0 12px;">Section breakdown</h3>
    ${Object.entries(by_cat).map(([cat, secs]) => `
      <div style="font-size:10px;color:#a1a1aa;text-transform:uppercase;letter-spacing:.08em;margin:16px 0 4px;">${cat}</div>
      ${secs.map(s => `<div class="section-row">
        <span style="color:#09090b;">${s.name}</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <span class="badge" style="background:${STATUS_COLOR[s.status]}22;color:${STATUS_COLOR[s.status]};">${s.status}</span>
          <span style="font-family:monospace;color:#09090b;">${s.value_m > 0 ? fmt(s.value_m) : '—'}</span>
        </div>
      </div>`).join("")}
    `).join("")}
    <div style="display:flex;justify-content:space-between;padding:14px 0;border-top:2px solid #09090b;margin-top:8px;font-weight:600;">
      <span>Total code-floor</span>
      <span style="color:#0d9e75;font-family:monospace;">${fmt(floor)}</span>
    </div>
    ${gaps.length > 0 ? `
    <h3 style="font-size:13px;font-weight:600;color:#09090b;margin:20px 0 8px;">Honest gaps</h3>
    ${gaps.map(g => `<div style="padding:8px 0;border-bottom:1px solid #f4f4f5;font-size:13px;color:#52525b;">
      <strong style="color:#09090b;">${g.title}</strong> — ${g.detail || ""}
    </div>`).join("")}` : ""}
    ${project.share_enabled ? `<a href="${shareUrl}" class="cta">View full interactive report →</a>` : ""}
    <p style="font-size:12px;color:#a1a1aa;text-align:center;margin-top:16px;">
      Sent by ${senderName || "a CodeFloor user"}. Devil's-advocate code-floor methodology — no ARR multiple, no speculation.
    </p>
  </div>
  <div class="footer">CodeFloor · Platform Valuation · Not financial advice · Qualified investors only</div>
</div>
</body></html>`;
}
