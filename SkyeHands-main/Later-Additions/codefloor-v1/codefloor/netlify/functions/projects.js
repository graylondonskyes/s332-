// netlify/functions/projects.js
import { neon } from "@neondatabase/serverless";
import { jwtDecode } from "jwt-decode";

const sql = neon(process.env.DATABASE_URL);

function getUser(event) {
  const auth = event.headers?.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    const d = jwtDecode(auth.slice(7));
    if (d.exp * 1000 < Date.now()) return null;
    return { id: d.sub, email: d.email, name: d.user_metadata?.full_name };
  } catch { return null; }
}

const CORS = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Content-Type": "application/json",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  const user = getUser(event);
  if (!user) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };

  // Ensure user exists in DB (upsert on every authenticated call)
  await sql`INSERT INTO users (id, email, name) VALUES (${user.id}, ${user.email}, ${user.name})
            ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = COALESCE(EXCLUDED.name, users.name), updated_at = now()`;

  const id = event.path.split("/").pop();
  const isId = id && id !== "projects" && !id.includes(".");

  try {
    // ── LIST ──────────────────────────────────────────────────────────────────
    if (event.httpMethod === "GET" && !isId) {
      const projects = await sql`
        SELECT p.*,
          (SELECT COUNT(*) FROM sections s WHERE s.project_id = p.id AND s.status = 'proven') AS proven_count,
          (SELECT COUNT(*) FROM sections s WHERE s.project_id = p.id) AS section_count,
          (SELECT COALESCE(SUM(s.value_m),0) FROM sections s WHERE s.project_id = p.id) AS section_total
        FROM projects p
        WHERE p.owner_id = ${user.id} AND p.status = 'active'
        ORDER BY p.updated_at DESC`;
      return { statusCode: 200, headers: CORS, body: JSON.stringify(projects) };
    }

    // ── GET ONE ───────────────────────────────────────────────────────────────
    if (event.httpMethod === "GET" && isId) {
      const [project] = await sql`SELECT * FROM projects WHERE id = ${id} AND owner_id = ${user.id}`;
      if (!project) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Not found" }) };
      const sections = await sql`SELECT * FROM sections WHERE project_id = ${id} ORDER BY position`;
      const gaps = await sql`SELECT * FROM gaps WHERE project_id = ${id} ORDER BY position`;
      const comps = await sql`SELECT * FROM comps WHERE project_id = ${id} ORDER BY position`;
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ...project, sections, gaps, comps }) };
    }

    // ── CREATE ────────────────────────────────────────────────────────────────
    if (event.httpMethod === "POST") {
      const b = JSON.parse(event.body || "{}");
      const [project] = await sql`
        INSERT INTO projects (owner_id, name, description, category, pass_name, version,
          file_count, proof_count, highest_stage, team_size, has_revenue, monthly_revenue,
          base_floor, notes)
        VALUES (${user.id}, ${b.name || "Untitled"}, ${b.description}, ${b.category}, ${b.passName},
          ${b.version}, ${b.fileCount || null}, ${b.proofCount || null}, ${b.highestStage},
          ${b.teamSize || null}, ${!!b.hasRevenue}, ${b.monthlyRevenue || null},
          ${b.baseFloor || 0}, ${b.notes})
        RETURNING *`;
      await sql`INSERT INTO audit_log (user_id, project_id, action) VALUES (${user.id}, ${project.id}, 'project.create')`;
      return { statusCode: 201, headers: CORS, body: JSON.stringify(project) };
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────
    if (event.httpMethod === "PUT" && isId) {
      const [exists] = await sql`SELECT id FROM projects WHERE id = ${id} AND owner_id = ${user.id}`;
      if (!exists) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Not found" }) };
      const b = JSON.parse(event.body || "{}");
      const [project] = await sql`
        UPDATE projects SET
          name = COALESCE(${b.name}, name),
          description = COALESCE(${b.description}, description),
          category = COALESCE(${b.category}, category),
          pass_name = COALESCE(${b.passName}, pass_name),
          version = COALESCE(${b.version}, version),
          file_count = COALESCE(${b.fileCount || null}, file_count),
          proof_count = COALESCE(${b.proofCount || null}, proof_count),
          highest_stage = COALESCE(${b.highestStage}, highest_stage),
          team_size = COALESCE(${b.teamSize || null}, team_size),
          has_revenue = COALESCE(${b.hasRevenue ?? null}, has_revenue),
          monthly_revenue = COALESCE(${b.monthlyRevenue || null}, monthly_revenue),
          base_floor = COALESCE(${b.baseFloor ?? null}, base_floor),
          notes = COALESCE(${b.notes}, notes),
          share_enabled = COALESCE(${b.shareEnabled ?? null}, share_enabled)
        WHERE id = ${id}
        RETURNING *`;
      return { statusCode: 200, headers: CORS, body: JSON.stringify(project) };
    }

    // ── DELETE (archive) ──────────────────────────────────────────────────────
    if (event.httpMethod === "DELETE" && isId) {
      await sql`UPDATE projects SET status = 'archived' WHERE id = ${id} AND owner_id = ${user.id}`;
      await sql`INSERT INTO audit_log (user_id, project_id, action) VALUES (${user.id}, ${id}, 'project.archive')`;
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    console.error("projects error:", err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Internal error" }) };
  }
};
