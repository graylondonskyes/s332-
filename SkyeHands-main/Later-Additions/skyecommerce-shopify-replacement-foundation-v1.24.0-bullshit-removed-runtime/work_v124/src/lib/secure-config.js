const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64(bytes = new Uint8Array()) {
  return btoa(String.fromCharCode(...bytes));
}

function unb64(value = '') {
  return Uint8Array.from(atob(String(value || '')), (char) => char.charCodeAt(0));
}

function stableSecret(env = {}) {
  return String(env.PROVIDER_CONFIG_SECRET || env.SECURE_CONFIG_SECRET || env.SESSION_SECRET || 'dev-secure-config-secret');
}

async function aesKey(env = {}) {
  const raw = await crypto.subtle.digest('SHA-256', encoder.encode(`skyecommerce-provider-config::${stableSecret(env)}`));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

function safeObject(value = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try { return JSON.parse(String(value || '{}')); } catch { return {}; }
}

export function isEncryptedConfig(value = {}) {
  const parsed = safeObject(value);
  return Boolean(parsed && parsed._encrypted === true && parsed.alg === 'AES-256-GCM' && parsed.iv && parsed.ciphertext);
}

export async function encryptProviderConfig(env = {}, config = {}) {
  const clean = safeObject(config);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(env), encoder.encode(JSON.stringify(clean)));
  return {
    _encrypted: true,
    v: 1,
    alg: 'AES-256-GCM',
    iv: b64(iv),
    ciphertext: b64(new Uint8Array(encrypted))
  };
}

export async function decryptProviderConfig(env = {}, stored = {}) {
  const parsed = safeObject(stored);
  if (!isEncryptedConfig(parsed)) return parsed;
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(parsed.iv) }, await aesKey(env), unb64(parsed.ciphertext));
  return safeObject(decoder.decode(decrypted));
}

export function maskSensitiveConfig(config = {}) {
  const source = safeObject(config);
  const masked = {};
  for (const [key, value] of Object.entries(source)) {
    const lower = key.toLowerCase();
    if (/secret|token|key|password|private|credential|access|refresh/.test(lower)) {
      const text = String(value || '');
      masked[key] = text ? `${text.slice(0, 4)}…${text.slice(-4)}` : '';
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export async function secureConfigRecord(env = {}, row = {}, { expose = false } = {}) {
  const stored = safeObject(row.config_json || row.config || {});
  const decrypted = await decryptProviderConfig(env, stored);
  return {
    ...row,
    config_json: JSON.stringify(expose ? decrypted : maskSensitiveConfig(decrypted)),
    config_encrypted: isEncryptedConfig(stored) ? 1 : 0
  };
}
