const TEXT_MARKER = "SKYESEC1";
const FORMAT = "skye-secure-v1";
const ITERATIONS = 150000;

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export function bytesToBase64(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

export function base64ToBytes(value) {
  const binary = atob(value);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
}

export async function deriveSkyeKey(passphrase, salt) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toArrayBuffer(salt), iterations: ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptSkyePayload(plainText, passphrase) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveSkyeKey(passphrase, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(new TextEncoder().encode(plainText))
  );
  return {
    cipher: bytesToBase64(new Uint8Array(cipher)),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
  };
}

export async function decryptSkyePayload(encrypted, passphrase) {
  const block = typeof encrypted === "string" ? JSON.parse(encrypted) : encrypted;
  if (!isSkyeEncryptedBlock(block)) throw new Error("Invalid encrypted .skye block.");
  const iv = base64ToBytes(block.iv);
  const salt = base64ToBytes(block.salt);
  const key = await deriveSkyeKey(passphrase, salt);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(base64ToBytes(block.cipher))
  );
  return new TextDecoder().decode(plain);
}

export function isSkyeEncryptedBlock(block) {
  return Boolean(
    block &&
      typeof block === "object" &&
      typeof block.cipher === "string" &&
      typeof block.iv === "string" &&
      typeof block.salt === "string" &&
      block.cipher.length > 0 &&
      block.iv.length > 0 &&
      block.salt.length > 0
  );
}

export function buildSkyeSecureEnvelope({ primary, failsafe = null, hint = "" }) {
  if (!isSkyeEncryptedBlock(primary)) throw new Error("Primary encrypted .skye payload is invalid.");
  if (failsafe && !isSkyeEncryptedBlock(failsafe)) throw new Error("Failsafe encrypted .skye payload is invalid.");
  return {
    format: FORMAT,
    encrypted: true,
    app: "SkyeDocxMax",
    alg: "AES-256-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: ITERATIONS,
    hint: String(hint || ""),
    payload: { primary, failsafe: failsafe || null },
    created_at: new Date().toISOString(),
  };
}

export function validateSkyeEnvelope(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.format === FORMAT &&
      value.encrypted === true &&
      value.alg === "AES-256-GCM" &&
      value.kdf === "PBKDF2-SHA256" &&
      Number(value.iterations) === ITERATIONS &&
      value.payload &&
      isSkyeEncryptedBlock(value.payload.primary)
  );
}

export function serializeSkyeEnvelope(envelope) {
  if (!validateSkyeEnvelope(envelope)) throw new Error("Invalid .skye secure envelope.");
  const marker = new TextEncoder().encode(TEXT_MARKER);
  const payload = new TextEncoder().encode(JSON.stringify(envelope));
  return new Blob([marker, new Uint8Array([0]), payload], { type: "application/octet-stream" });
}

export async function readSkyeEnvelopeFromBlob(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const marker = new TextEncoder().encode(TEXT_MARKER);
  const hasMarker =
    bytes.length > marker.length + 1 &&
    marker.every((value, index) => bytes[index] === value) &&
    bytes[marker.length] === 0;
  if (!hasMarker) throw new Error("File is not a secure .skye envelope.");
  const raw = new TextDecoder().decode(bytes.slice(marker.length + 1));
  const parsed = JSON.parse(raw);
  if (!validateSkyeEnvelope(parsed)) throw new Error("Secure .skye envelope failed validation.");
  return parsed;
}

export function normalizeLegacySkyeEnvelope(rawText) {
  const text = String(rawText || "").trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (validateSkyeEnvelope(parsed)) {
      return { kind: "text-prefixed-secure-envelope", envelope: parsed };
    }
  } catch {}
  const markerIndex = text.indexOf(TEXT_MARKER);
  if (markerIndex < 0) return null;
  const jsonStart = text.indexOf("{", markerIndex);
  if (jsonStart < 0) return null;
  const parsed = JSON.parse(text.slice(jsonStart));
  if (!validateSkyeEnvelope(parsed)) return null;
  return { kind: "text-prefixed-secure-envelope", envelope: parsed };
}

export function validateSkyePlainPayload(payload) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      (!payload.format || payload.format === "skyedocxmax-package") &&
      (!payload.version || payload.version === "1.0.0") &&
      payload.meta &&
      typeof payload.meta === "object" &&
      typeof payload.state?.content === "string"
  );
}
