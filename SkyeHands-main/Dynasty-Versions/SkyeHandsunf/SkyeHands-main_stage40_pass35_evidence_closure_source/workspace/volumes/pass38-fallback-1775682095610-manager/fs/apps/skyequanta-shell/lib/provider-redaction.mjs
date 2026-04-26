import crypto from 'node:crypto';

function readString(value) {
  return String(value ?? '').trim();
}

export function maskValue(value, options = {}) {
  const normalized = readString(value);
  const visiblePrefix = Number.isInteger(options.visiblePrefix) ? options.visiblePrefix : 3;
  const visibleSuffix = Number.isInteger(options.visibleSuffix) ? options.visibleSuffix : 2;
  if (!normalized) {
    return null;
  }
  if (normalized.length <= visiblePrefix + visibleSuffix) {
    return '*'.repeat(Math.max(4, normalized.length));
  }
  return `${normalized.slice(0, visiblePrefix)}${'*'.repeat(Math.max(4, normalized.length - visiblePrefix - visibleSuffix))}${normalized.slice(-visibleSuffix)}`;
}

export function hashProviderPayload(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload || {})).digest('hex');
}

function keyLooksSensitive(key = '') {
  const normalized = readString(key).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!normalized) {
    return false;
  }
  return [
    'token',
    'secret',
    'password',
    'authorization',
    'apikey',
    'accesskey',
    'privatekey',
    'databaseurl',
    'connectionstring',
    'env'
  ].some(fragment => normalized.includes(fragment));
}

export function redactProviderPayload(value) {
  if (Array.isArray(value)) {
    return value.map(item => redactProviderPayload(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => {
        if (keyLooksSensitive(key)) {
          return [key, '[REDACTED]'];
        }
        return [key, redactProviderPayload(nested)];
      })
    );
  }

  if (typeof value === 'string') {
    return keyLooksSensitive('value') ? '[REDACTED]' : value;
  }

  return value;
}

export function collectSecretValues(payload) {
  const values = new Set();

  const visit = current => {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (current && typeof current === 'object') {
      for (const [key, nested] of Object.entries(current)) {
        if (keyLooksSensitive(key) && typeof nested === 'string' && nested.trim()) {
          values.add(nested.trim());
        }
        if (String(key || '').trim().toLowerCase() === 'env' && nested && typeof nested === 'object' && !Array.isArray(nested)) {
          for (const envValue of Object.values(nested)) {
            if (typeof envValue === 'string' && envValue.trim()) {
              values.add(envValue.trim());
            }
          }
        }
        visit(nested);
      }
    }
  };

  visit(payload);
  return [...values];
}

export function redactTextAgainstSecrets(text, secrets = []) {
  let output = String(text ?? '');
  for (const secret of secrets) {
    const normalized = readString(secret);
    if (!normalized) {
      continue;
    }
    output = output.split(normalized).join('[REDACTED]');
  }
  return output;
}
