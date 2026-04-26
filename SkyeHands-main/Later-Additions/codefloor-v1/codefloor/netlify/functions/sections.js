// netlify/functions/sections.js
import { neon } from "@neondatabase/serverless";
import { jwtDecode } from "jwt-decode";

const sql = neon(process.env.DATABASE_URL);

function getUser(e) {
  const a = e.headers?.authorization || "";
  if (!a.startsWith("Bearer ")) return null;
  try { const d = jwtDecode(a.slice(7)); return d.exp * 1000 < Date.now() ? null : { id: d.sub }; }
  catch { return null; }
}

const H = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Content-Type": "application/json",
};

async function verifyOwner(user, projectId) {
  const [p] = await sql`SELECT id FROM projects WHERE id = ${projectId} AND owner_id = ${user.id}`;
  return !!p;
}

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: H, body: "" };
  const user = getUser(event);
  if (!user) return { statusCode: 401, headers: H, body: JSON.stringify({ error: "Unauthorized" }) };

  const parts = event.path.split("/").filter(Boolean);
  // paths: /sections?projectId=X  or  /sections/SECTION_ID
  const sectionId = parts[parts.length - 1] !== "sections" ? parts[parts.length - 1] : null;
  const projectId = event.queryStringParameters?.projectId;

  try {
    // ── BULK UPSERT (sync all sections for a project) ────────────────────────
    if (event.httpMethod === "POST" && event.queryStringParameters?.bulk) {
      if (!projectId || !(await verifyOwner(user, projectId)))
        return { statusCode: 403, headers: H, body: JSON.stringify({ error: "Forbidden" }) };
      const { sections } = JSON.parse(event.body || "{}");
      // Delete removed sections, upsert the rest
      const incomingIds = sections.filter(s => !s._new).map(s => s.id);
      if (incomingIds.length > 0) {
        await sql`DELETE FROM sections WHERE project_id = ${projectId} AND id != ALL(${incomingIds}::text[])`;
      } else {
        await sql`DELETE FROM sections WHERE project_id = ${projectId}`;
      }
      for (let i = 0; i < sections.length; i++) {
        const s = sections[i];
        await sql`
          INSERT INTO sections (id, project_id, position, name, category, value_m, status, evidence,
            gate_code, gate_runtime, gate_hostile, gate_artifact, gate_claim)
          VALUES (
            COALESCE(NULLIF(${s.id}, ''), encode(gen_random_bytes(10), 'hex')),
            ${projectId}, ${i}, ${s.name || "Unnamed"}, ${s.category || "Other"},
            ${parseFloat(s.value) || 0}, ${s.status || "open"}, ${s.evidence || null},
            ${!!s.gateCode}, ${!!s.gateRuntime}, ${!!s.gateHostile}, ${!!s.gateArtifact}, ${!!s.gateClaim}
          )
          ON CONFLICT (id) DO UPDATE SET
            position = EXCLUDED.position, name = EXCLUDED.name, category = EXCLUDED.category,
            value_m = EXCLUDED.value_m, status = EXCLUDED.status, evidence = EXCLUDED.evidence,
            gate_code = EXCLUDED.gate_code, gate_runtime = EXCLUDED.gate_runtime,
            gate_hostile = EXCLUDED.gate_hostile, gate_artifact = EXCLUDED.gate_artifact,
            gate_claim = EXCLUDED.gate_claim, updated_at = now()`;
      }
      // Bulk upsert gaps
      const { gaps = [], comps = [] } = JSON.parse(event.body || "{}");
      await sql`DELETE FROM gaps WHERE project_id = ${projectId}`;
      for (let i = 0; i < gaps.length; i++) {
        const g = gaps[i];
        await sql`INSERT INTO gaps (project_id, position, title, detail, status)
                  VALUES (${projectId}, ${i}, ${g.title || "Gap"}, ${g.detail || null}, ${g.status || "open"})`;
      }
      await sql`DELETE FROM comps WHERE project_id = ${projectId}`;
      for (let i = 0; i < comps.length; i++) {
        const c = comps[i];
        await sql`INSERT INTO comps (project_id, position, name, valuation_m, dimension, source)
                  VALUES (${projectId}, ${i}, ${c.name || "Comp"}, ${parseFloat(c.valuation) || 0}, ${c.dimension || null}, ${c.source || null})`;
      }
      return { statusCode: 200, headers: H, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: H, body: JSON.stringify({ error: "Use bulk endpoint" }) };
  } catch (err) {
    console.error("sections error:", err);
    return { statusCode: 500, headers: H, body: JSON.stringify({ error: "Internal error" }) };
  }
};
