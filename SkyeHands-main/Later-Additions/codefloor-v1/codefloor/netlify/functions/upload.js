// netlify/functions/upload.js
// Returns a presigned PUT URL for direct R2 upload from browser
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { neon } from "@neondatabase/serverless";
import { jwtDecode } from "jwt-decode";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY, secretAccessKey: process.env.R2_SECRET_KEY },
});
const sql = neon(process.env.DATABASE_URL);
const BUCKET = process.env.R2_BUCKET || "codefloor-evidence";

function getUser(e) {
  const a = e.headers?.authorization || "";
  if (!a.startsWith("Bearer ")) return null;
  try { const d = jwtDecode(a.slice(7)); return d.exp * 1000 < Date.now() ? null : { id: d.sub }; }
  catch { return null; }
}

const H = {
  "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Content-Type": "application/json",
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: H, body: "" };
  const user = getUser(event);
  if (!user) return { statusCode: 401, headers: H, body: JSON.stringify({ error: "Unauthorized" }) };

  const { projectId, sectionId, filename, mimeType, sizeBytes } = JSON.parse(event.body || "{}");
  if (!projectId || !filename) return { statusCode: 400, headers: H, body: JSON.stringify({ error: "projectId and filename required" }) };

  const [project] = await sql`SELECT id FROM projects WHERE id = ${projectId} AND owner_id = ${user.id}`;
  if (!project) return { statusCode: 403, headers: H, body: JSON.stringify({ error: "Forbidden" }) };

  const ext = filename.split(".").pop().toLowerCase();
  const r2Key = `evidence/${user.id}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    ContentType: mimeType || "application/octet-stream",
    ContentLength: sizeBytes,
    Metadata: { projectId, userId: user.id, originalName: encodeURIComponent(filename) },
  });

  const url = await getSignedUrl(r2, command, { expiresIn: 300 }); // 5 min

  // Register in DB (uploader confirms after upload)
  const [file] = await sql`
    INSERT INTO evidence_files (project_id, section_id, uploader_id, filename, r2_key, mime_type, size_bytes)
    VALUES (${projectId}, ${sectionId || null}, ${user.id}, ${filename}, ${r2Key}, ${mimeType}, ${sizeBytes || null})
    RETURNING id, r2_key`;

  return { statusCode: 200, headers: H, body: JSON.stringify({ uploadUrl: url, fileId: file.id, r2Key }) };
};

// ─────────────────────────────────────────────────────────────────────────────
// netlify/functions/identity-signup.js
// Netlify Identity webhook — fires on every signup
// Configure in Netlify UI: Identity → Events → Registration → URL: /.netlify/functions/identity-signup
// ─────────────────────────────────────────────────────────────────────────────
// (Save as separate file in production)
export const identitySignupHandler = async (event) => {
  const payload = JSON.parse(event.body || "{}");
  const { user } = payload;
  if (!user) return { statusCode: 200, body: "" };

  const sql2 = neon(process.env.DATABASE_URL);
  const resend = (await import("resend")).Resend ? new (await import("resend")).Resend(process.env.RESEND_API_KEY) : null;

  // Upsert user
  await sql2`
    INSERT INTO users (id, email, name)
    VALUES (${user.id}, ${user.email}, ${user.user_metadata?.full_name || null})
    ON CONFLICT (id) DO NOTHING`;

  // Welcome email
  if (resend) {
    await resend.emails.send({
      from: `CodeFloor <hello@${process.env.EMAIL_DOMAIN || "codefloor.io"}>`,
      to: [user.email],
      subject: "Welcome to CodeFloor",
      html: `<p>Your account is ready. <a href="${process.env.SITE_URL}">Open CodeFloor →</a></p>
             <p style="color:#71717a;font-size:12px;">Devil's-advocate code-floor valuation for serious builders.</p>`,
    });
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
