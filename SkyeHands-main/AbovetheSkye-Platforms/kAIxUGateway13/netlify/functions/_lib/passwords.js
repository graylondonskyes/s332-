import crypto from "crypto";
import { sha256Hex } from "./crypto.js";

function normalizeSecret(secret) {
  return (secret || "").toString();
}

export async function hashPassword(password) {
  const secret = normalizeSecret(password);
  if (secret.length < 8) {
    const err = new Error("Password must be at least 8 characters");
    err.status = 400;
    err.code = "WEAK_PASSWORD";
    throw err;
  }
  const salt = crypto.randomBytes(16);
  const hash = await new Promise((resolve, reject) => {
    crypto.scrypt(secret, salt, 64, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
  return `s1:${salt.toString("hex")}:${Buffer.from(hash).toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
  const value = (storedHash || "").toString();
  const secret = normalizeSecret(password);
  const parts = value.split(":");
  if (parts.length !== 3 || parts[0] !== "s1") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const actual = await new Promise((resolve, reject) => {
    crypto.scrypt(secret, salt, expected.length, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
  try {
    return crypto.timingSafeEqual(Buffer.from(actual), expected);
  } catch {
    return false;
  }
}

export function hashOpaqueToken(token) {
  return sha256Hex(String(token || ""));
}

export function randomOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}
