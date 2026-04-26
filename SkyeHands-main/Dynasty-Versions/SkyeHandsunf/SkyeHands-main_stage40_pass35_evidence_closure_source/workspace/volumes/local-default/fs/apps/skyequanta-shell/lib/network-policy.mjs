import net from 'node:net';

function readString(value) {
  return String(value ?? '').trim();
}

function readBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  const normalized = readString(value).toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function readCsv(value) {
  return readString(value)
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

function uniq(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function isIPv4Private(hostname) {
  const parts = hostname.split('.').map(part => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function normalizeIpv6(hostname) {
  return readString(hostname).replace(/^\[|\]$/g, '').toLowerCase();
}

function isIPv6Blocked(hostname) {
  const normalized = normalizeIpv6(hostname);
  if (!normalized.includes(':')) return false;
  if (normalized === '::1' || normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe80:')) return true;
  return false;
}

function isHostnameLocal(hostname) {
  const normalized = readString(hostname).toLowerCase();
  if (!normalized) return true;
  if (['localhost', 'localhost.localdomain'].includes(normalized)) return true;
  if (normalized.endsWith('.local') || normalized.endsWith('.internal')) return true;
  return false;
}

function isMetadataHostname(hostname) {
  const normalized = readString(hostname).toLowerCase();
  return [
    '169.254.169.254',
    'metadata.google.internal',
    'metadata',
    '100.100.100.200',
    '169.254.170.2',
    'fd00:ec2::254'
  ].includes(normalized);
}

function matchesAllowlist(hostname, allowlist = []) {
  const normalized = readString(hostname).toLowerCase();
  if (!allowlist.length) return true;
  return allowlist.some(entry => normalized === entry || normalized.endsWith(`.${entry}`));
}

export function getOutboundNetworkPolicy(env = process.env) {
  return {
    enabled: readBoolean(env.SKYEQUANTA_OUTBOUND_POLICY_ENABLED, true),
    blockPrivateNetworks: readBoolean(env.SKYEQUANTA_OUTBOUND_BLOCK_PRIVATE, true),
    blockMetadata: readBoolean(env.SKYEQUANTA_OUTBOUND_BLOCK_METADATA, true),
    allowHttp: readBoolean(env.SKYEQUANTA_OUTBOUND_ALLOW_HTTP, true),
    allowedHosts: uniq(readCsv(env.SKYEQUANTA_OUTBOUND_ALLOWED_HOSTS)),
    providerAllowHosts: {
      cloudflare: uniq(readCsv(env.SKYEQUANTA_OUTBOUND_ALLOWED_HOSTS_CLOUDFLARE || 'api.cloudflare.com')), 
      netlify: uniq(readCsv(env.SKYEQUANTA_OUTBOUND_ALLOWED_HOSTS_NETLIFY || 'api.netlify.com')), 
      github: uniq(readCsv(env.SKYEQUANTA_OUTBOUND_ALLOWED_HOSTS_GITHUB || 'api.github.com')), 
      neon: uniq(readCsv(env.SKYEQUANTA_OUTBOUND_ALLOWED_HOSTS_NEON))
    }
  };
}

export function describeOutboundNetworkPolicy(policy = getOutboundNetworkPolicy()) {
  return {
    enabled: Boolean(policy.enabled),
    blockPrivateNetworks: Boolean(policy.blockPrivateNetworks),
    blockMetadata: Boolean(policy.blockMetadata),
    allowHttp: Boolean(policy.allowHttp),
    allowedHosts: Array.isArray(policy.allowedHosts) ? [...policy.allowedHosts] : [],
    providerAllowHosts: Object.fromEntries(Object.entries(policy.providerAllowHosts || {}).map(([key, value]) => [key, [...value]]))
  };
}

export function assertOutboundUrlAllowed(rawUrl, policy = getOutboundNetworkPolicy(), options = {}) {
  if (!policy.enabled) {
    return { ok: true, url: String(rawUrl) };
  }
  const url = new URL(String(rawUrl));
  const hostname = readString(url.hostname).toLowerCase();
  const provider = readString(options.provider).toLowerCase();
  const allowlist = uniq([...(policy.allowedHosts || []), ...((policy.providerAllowHosts || {})[provider] || [])]);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Outbound network policy blocked '${url.protocol}' protocol for ${url.toString()}.`);
  }
  if (url.protocol === 'http:' && !policy.allowHttp) {
    throw new Error(`Outbound network policy blocked insecure http transport for ${url.toString()}.`);
  }
  if (policy.blockMetadata && isMetadataHostname(hostname)) {
    throw new Error(`Outbound network policy blocked metadata-service target '${hostname}'.`);
  }
  if (policy.blockPrivateNetworks) {
    if (isHostnameLocal(hostname)) {
      throw new Error(`Outbound network policy blocked local hostname '${hostname}'.`);
    }
    if (net.isIP(hostname) === 4 && isIPv4Private(hostname)) {
      throw new Error(`Outbound network policy blocked private/reserved IPv4 target '${hostname}'.`);
    }
    if (net.isIP(hostname) === 6 && isIPv6Blocked(hostname)) {
      throw new Error(`Outbound network policy blocked private/link-local IPv6 target '${hostname}'.`);
    }
  }
  if (!matchesAllowlist(hostname, allowlist)) {
    throw new Error(`Outbound network policy blocked '${hostname}' because it is outside the allowed host policy.`);
  }
  return {
    ok: true,
    url: url.toString(),
    hostname,
    provider: provider || null
  };
}
