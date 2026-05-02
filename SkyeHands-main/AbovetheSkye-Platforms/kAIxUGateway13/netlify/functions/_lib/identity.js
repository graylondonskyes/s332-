import crypto from "crypto";
import { q } from "./db.js";

export function normalizeEmail(email) {
  return (email || "").toString().trim().toLowerCase();
}

export function sanitizeDisplayName(name) {
  const value = (name || "").toString().trim();
  return value ? value.slice(0, 120) : null;
}

export async function getUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const res = await q(
    `select u.*, c.email as customer_email, c.plan_name as customer_plan_name
     from users u
     left join customers c on c.id = u.primary_customer_id
     where u.email_normalized=$1
     limit 1`,
    [normalized]
  );
  return res.rowCount ? res.rows[0] : null;
}

export async function getUserById(userId) {
  if (!userId) return null;
  const res = await q(
    `select u.*, c.email as customer_email, c.plan_name as customer_plan_name
     from users u
     left join customers c on c.id = u.primary_customer_id
     where u.id=$1
     limit 1`,
    [userId]
  );
  return res.rowCount ? res.rows[0] : null;
}

export async function ensureCustomerForUser({ email, planName = "starter" }) {
  const normalized = normalizeEmail(email);
  const found = await q(`select * from customers where lower(email)=lower($1) limit 1`, [normalized]);
  if (found.rowCount) return found.rows[0];

  const created = await q(
    `insert into customers(email, plan_name)
     values ($1,$2)
     returning *`,
    [normalized, (planName || "starter").toString().slice(0, 60)]
  );
  return created.rows[0];
}

export async function createUser({ email, passwordHash, displayName = null, customerId = null, role = "user", profile = {} }) {
  const normalized = normalizeEmail(email);
  const id = crypto.randomUUID();
  const res = await q(
    `insert into users(id, email, email_normalized, display_name, primary_customer_id, role, profile)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)
     returning *`,
    [id, normalized, normalized, sanitizeDisplayName(displayName), customerId, role, JSON.stringify(profile || {})]
  );
  await q(
    `insert into user_passwords(user_id, password_hash)
     values ($1,$2)`,
    [id, passwordHash]
  );
  return res.rows[0];
}

export async function updateUserPassword(userId, passwordHash) {
  await q(
    `insert into user_passwords(user_id, password_hash, password_updated_at)
     values ($1,$2,now())
     on conflict (user_id)
     do update set
       password_hash = excluded.password_hash,
       password_updated_at = now()`,
    [userId, passwordHash]
  );
}

export async function getUserPasswordRecord(userId) {
  const res = await q(`select * from user_passwords where user_id=$1 limit 1`, [userId]);
  return res.rowCount ? res.rows[0] : null;
}

export async function markEmailVerified(userId) {
  await q(
    `update users
     set email_verified_at = coalesce(email_verified_at, now()),
         updated_at = now()
     where id=$1`,
    [userId]
  );
}

export async function updateUserLastSeen(userId) {
  await q(`update users set updated_at=now() where id=$1`, [userId]);
}
