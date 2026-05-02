import { q } from "./neon";
import { json } from "./response";
import { opt } from "./env";

const COOKIE = "kx_session";
const SKYGATE_COOKIE = "kx_gate_token";

// Node crypto for hashing and HMAC
import crypto from "crypto";

function base64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function pbkdf2Hash(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      Buffer.from(salt, "base64"),
      150000,
      32,
      "sha256",
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(base64url(derivedKey));
      }
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("base64");
  const hash = await pbkdf2Hash(password, salt);
  return `pbkdf2$sha256$150000$${salt}$${hash}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length < 6) return false;
  const salt = parts[4];
  const want = parts[5];
  const got = await pbkdf2Hash(password, salt);
  return timingSafeEqual(got, want);
}

function timingSafeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  cookieHeader.split(";").forEach((p) => {
    const [k, ...rest] = p.trim().split("=");
    out[k] = rest.join("=") || "";
  });
  return out;
}

function readHeader(event: any, name: string): string {
  const headers = event?.headers || {};
  return String(headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || "").trim();
}

export function parseBearerToken(headerValue: string | undefined): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(String(headerValue || "").trim());
  return match ? match[1] : null;
}

function getSkyeGateBase(): string {
  return String(
    opt("SKYGATEFS13_ORIGIN", opt("SKYGATE_AUTH_ORIGIN", opt("SKYGATE_ORIGIN", "")))
  ).trim().replace(/\/+$/, "");
}

function allowLegacyLocalSessionAuth(): boolean {
  const configured = getSkyeGateBase();
  const raw = String(
    opt("SUPERIDE_ALLOW_LEGACY_LOCAL_SESSION_AUTH", opt("ALLOW_LEGACY_LOCAL_SESSION_AUTH", ""))
  ).trim().toLowerCase();
  if (raw) {
    return !["0", "false", "no", "off"].includes(raw);
  }
  // When the central gate is configured, default to central identity first and
  // require an explicit opt-in for legacy local-session fallback.
  return !configured;
}

async function fetchSkyeGate(path: string, init: RequestInit = {}) {
  const base = getSkyeGateBase();
  if (!base) throw new Error("Missing SKYGATEFS13_ORIGIN env var.");
  const response = await fetch(`${base}${path.startsWith("/") ? path : `/${path}`}`, init);
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { response, data };
}

async function resolveSkyeGateIdentity(token: string): Promise<{
  email: string;
  subject_id: string | null;
  role: string | null;
  issuer: string | null;
  claims: any;
} | null> {
  if (!token) return null;
  try {
    const { response, data } = await fetchSkyeGate("/auth/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) return null;
    const subject = data?.subject || {};
    const email = String(subject.email || "").trim().toLowerCase();
    if (!email) return null;
    return {
      email,
      subject_id: subject.id ? String(subject.id) : null,
      role: subject.role ? String(subject.role) : null,
      issuer: data?.issuer ? String(data.issuer) : null,
      claims: data?.claims || null,
    };
  } catch {
    return null;
  }
}

function readBridgeToken(event: any): string | null {
  const bearer = parseBearerToken(readHeader(event, "authorization"));
  if (bearer) return bearer;
  const cookies = parseCookies(readHeader(event, "cookie"));
  const token = String(cookies[SKYGATE_COOKIE] || "").trim();
  return token || null;
}

export async function requireUser(event: any): Promise<{
  user_id: string;
  email: string;
  org_id: string | null;
  auth_source?: string;
  bearer_token?: string | null;
  central_subject_id?: string | null;
  central_role?: string | null;
  issuer?: string | null;
} | null> {
  const bridgeToken = readBridgeToken(event);
  if (bridgeToken) {
    const central = await resolveSkyeGateIdentity(bridgeToken);
    if (central?.email) {
      const local = await q(
        "select id, email, org_id from users where lower(email)=lower($1) limit 1",
        [central.email]
      );
      if (local.rows.length) {
        return {
          user_id: local.rows[0].id,
          email: local.rows[0].email,
          org_id: local.rows[0].org_id,
          auth_source: "skygatefs13",
          bearer_token: bridgeToken,
          central_subject_id: central.subject_id,
          central_role: central.role,
          issuer: central.issuer,
        };
      }
    }
    if (!allowLegacyLocalSessionAuth()) return null;
  }

  if (!allowLegacyLocalSessionAuth()) return null;

  const cookies = parseCookies(event.headers?.cookie);
  const token = cookies[COOKIE];
  if (!token) return null;
  const now = new Date().toISOString();
  const sess = await q(
    "select s.token, s.user_id, u.email, u.org_id from sessions s join users u on u.id=s.user_id where s.token=$1 and s.expires_at>$2",
    [token, now]
  );
  if (!sess.rows.length) return null;
  return {
    user_id: sess.rows[0].user_id,
    email: sess.rows[0].email,
    org_id: sess.rows[0].org_id,
    auth_source: "legacy_local_session",
    bearer_token: null,
    central_subject_id: null,
    central_role: null,
    issuer: null,
  };
}

export async function createSession(user_id: string) {
  const token = base64url(crypto.randomBytes(32));
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14); // 14 days
  await q(
    "insert into sessions(user_id, token, expires_at) values($1,$2,$3)",
    [user_id, token, expires.toISOString()]
  );
  return { token, expires };
}

export async function ensureUserRecoveryEmailColumn() {
  await q("alter table if exists users add column if not exists recovery_email text", []);
  await q("create index if not exists idx_users_recovery_email on users(lower(recovery_email))", []);
}

export async function ensureUserPinColumns() {
  await q("alter table if exists users add column if not exists pin_hash text", []);
  await q("alter table if exists users add column if not exists pin_updated_at timestamptz", []);
}

export function setSessionCookie(token: string, expires: Date): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${expires.toUTCString()}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function setSkyeGateCookie(token: string, expiresAt?: string | null): string {
  const value = encodeURIComponent(String(token || "").trim());
  const expires = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 1000 * 60 * 60 * 12);
  return `${SKYGATE_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${expires.toUTCString()}`;
}

export function clearSkyeGateCookie(): string {
  return `${SKYGATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export async function requestSkyeGate(path: string, init: RequestInit = {}) {
  return fetchSkyeGate(path, init);
}

export function forbid() {
  return json(401, { error: "Unauthorized" });
}
