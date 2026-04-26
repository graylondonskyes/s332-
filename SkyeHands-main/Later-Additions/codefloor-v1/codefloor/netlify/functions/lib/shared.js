// netlify/functions/lib/db.js
import { neon } from "@neondatabase/serverless";

let _sql;
export function sql() {
  if (!_sql) _sql = neon(process.env.DATABASE_URL);
  return _sql;
}

// netlify/functions/lib/auth.js
import { jwtDecode } from "jwt-decode";

export function getUser(event) {
  const auth = event.headers?.authorization || event.headers?.Authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const token = auth.slice(7);
    const decoded = jwtDecode(token);
    if (decoded.exp && decoded.exp * 1000 < Date.now()) return null;
    return { id: decoded.sub, email: decoded.email, name: decoded.user_metadata?.full_name, role: decoded.app_metadata?.roles?.[0] || "user" };
  } catch { return null; }
}

export function requireUser(user, res) {
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}

export function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}
