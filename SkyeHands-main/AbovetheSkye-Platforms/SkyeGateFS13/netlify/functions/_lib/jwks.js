import crypto from "crypto";
import { decryptSecret, encryptSecret } from "./crypto.js";
import { q } from "./db.js";

const DEFAULT_ISSUER = process.env.SKYGATE_ISSUER || process.env.PUBLIC_APP_ORIGIN || process.env.URL || "https://example.invalid";

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function parseJsonBase64url(input) {
  return JSON.parse(Buffer.from(String(input || ""), "base64url").toString("utf8"));
}

function signInput(header, payload) {
  return `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
}

function uuid() {
  return crypto.randomUUID();
}

export function issuerUrl(req = null) {
  if (req) {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
  }
  return DEFAULT_ISSUER.replace(/\/+$/, "");
}

export async function listSigningKeys() {
  const res = await q(
    `select id, kid, alg, is_active, activated_at, retired_at, created_at, metadata
     from oauth_signing_keys
     order by created_at desc`
  );
  return res.rows;
}

export async function getSigningKeyByKid(kid) {
  const res = await q(`select * from oauth_signing_keys where kid=$1 limit 1`, [kid]);
  return res.rowCount ? res.rows[0] : null;
}

export async function ensureActiveSigningKey() {
  const current = await q(`select * from oauth_signing_keys where is_active=true limit 1`);
  if (current.rowCount) return current.rows[0];
  return await rotateSigningKey({ retireExisting: false });
}

export async function rotateSigningKey({ retireExisting = true } = {}) {
  const pair = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  const id = uuid();
  const kid = `sgfs13-${Date.now().toString(36)}-${id.slice(0, 8)}`;
  if (retireExisting) {
    await q(
      `update oauth_signing_keys
       set is_active=false, retired_at=coalesce(retired_at, now())
       where is_active=true`
    );
  }
  await q(
    `insert into oauth_signing_keys(id, kid, alg, public_pem, private_pem_enc, is_active, activated_at)
     values ($1,$2,'RS256',$3,$4,true,now())`,
    [id, kid, pair.publicKey, encryptSecret(pair.privateKey)]
  );
  return await getSigningKeyByKid(kid);
}

function signJwtRs256({ payload, privateKey, kid }) {
  const header = { alg: "RS256", typ: "JWT", kid };
  const input = signInput(header, payload);
  const signature = crypto.sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url");
  return `${input}.${signature}`;
}

export async function issueSignedJwt(payload, { ttlSeconds = 3600, subject = null, audience = null, issuer = null, kid = null } = {}) {
  const active = await ensureActiveSigningKey();
  const privateKey = decryptSecret(active.private_pem_enc);
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: issuer || issuerUrl(),
    iat: now,
    exp: now + ttlSeconds,
    jti: uuid(),
    ...payload
  };
  if (subject) claims.sub = subject;
  if (audience) claims.aud = audience;
  return {
    token: signJwtRs256({ payload: claims, privateKey, kid: kid || active.kid }),
    claims,
    signing_key: active
  };
}

export async function verifySignedJwt(token, { expectedAudience = null, expectedIssuer = null } = {}) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  let header;
  let payload;
  try {
    header = parseJsonBase64url(parts[0]);
    payload = parseJsonBase64url(parts[1]);
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;
  const key = await getSigningKeyByKid(header.kid);
  if (!key) return null;
  const valid = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    key.public_pem,
    Buffer.from(parts[2], "base64url")
  );
  if (!valid) return null;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return null;
  if (payload.nbf && now < payload.nbf) return null;
  if (expectedAudience) {
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud].filter(Boolean);
    if (!audiences.includes(expectedAudience)) return null;
  }
  if (expectedIssuer && payload.iss !== expectedIssuer) return null;
  return { header, payload, key };
}

export function publicJwkFromPem(key) {
  const obj = crypto.createPublicKey(key.public_pem).export({ format: "jwk" });
  return {
    ...obj,
    kid: key.kid,
    alg: key.alg,
    use: "sig",
    kty: obj.kty || "RSA"
  };
}

export async function getPublicJwks() {
  const rows = await q(
    `select kid, alg, public_pem, is_active, activated_at, retired_at, created_at
     from oauth_signing_keys
     where retired_at is null or retired_at > now() - interval '30 days'
     order by is_active desc, created_at desc`
  );
  return {
    keys: rows.rows.map(publicJwkFromPem)
  };
}
