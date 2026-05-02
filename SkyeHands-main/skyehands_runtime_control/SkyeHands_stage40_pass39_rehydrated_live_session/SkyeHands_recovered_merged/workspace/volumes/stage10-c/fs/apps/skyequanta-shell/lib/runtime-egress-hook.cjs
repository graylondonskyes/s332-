const http = require('node:http');
const https = require('node:https');
const net = require('node:net');

function readString(value) { return String(value ?? '').trim(); }
function readBoolean(value, fallback) {
  const normalized = readString(value).toLowerCase();
  if (!normalized) return fallback;
  if (['1','true','yes','on'].includes(normalized)) return true;
  if (['0','false','no','off'].includes(normalized)) return false;
  return fallback;
}
function list(value) { return readString(value).split(',').map(item => item.trim().toLowerCase()).filter(Boolean); }
const policy = {
  enabled: readBoolean(process.env.SKYEQUANTA_RUNTIME_EGRESS_ENABLED, true),
  allowHttp: readBoolean(process.env.SKYEQUANTA_RUNTIME_EGRESS_ALLOW_HTTP, true),
  blockPrivateNetworks: readBoolean(process.env.SKYEQUANTA_RUNTIME_EGRESS_BLOCK_PRIVATE, true),
  blockMetadata: readBoolean(process.env.SKYEQUANTA_RUNTIME_EGRESS_BLOCK_METADATA, true),
  allowedHosts: [...new Set(list(process.env.SKYEQUANTA_RUNTIME_EGRESS_ALLOWED_HOSTS))]
};
function isLocal(hostname) { const n = readString(hostname).toLowerCase(); return !n || n === 'localhost' || n.endsWith('.local') || n.endsWith('.internal'); }
function isMetadata(hostname) { return ['169.254.169.254','metadata.google.internal','metadata','100.100.100.200','169.254.170.2','fd00:ec2::254'].includes(readString(hostname).toLowerCase()); }
function isPrivateIpv4(hostname) {
  const parts = readString(hostname).split('.').map(part => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a,b] = parts;
  return a===10 || a===127 || a===0 || (a===169 && b===254) || (a===172 && b>=16 && b<=31) || (a===192 && b===168) || (a===100 && b>=64 && b<=127) || a>=224;
}
function isBlockedIpv6(hostname) { const n = readString(hostname).replace(/^\[|\]$/g, '').toLowerCase(); return n.includes(':') && (n==='::1' || n==='::' || n.startsWith('fc') || n.startsWith('fd') || n.startsWith('fe80:')); }
function matchesAllowlist(hostname) { const n = readString(hostname).toLowerCase(); return !policy.allowedHosts.length || policy.allowedHosts.some(entry => n===entry || n.endsWith(`.${entry}`)); }
function assertAllowed(hostname, protocol='http:') {
  if (!policy.enabled) return;
  const normalized = readString(hostname).toLowerCase();
  if (!normalized) return;
  if (protocol === 'http:' && !policy.allowHttp) throw new Error(`runtime_egress_blocked: insecure http transport blocked for '${normalized}'`);
  if (policy.blockMetadata && isMetadata(normalized)) throw new Error(`runtime_egress_blocked: metadata target '${normalized}' is blocked`);
  if (policy.blockPrivateNetworks && (isLocal(normalized) || isPrivateIpv4(normalized) || isBlockedIpv6(normalized))) throw new Error(`runtime_egress_blocked: private/local target '${normalized}' is blocked`);
  if (!matchesAllowlist(normalized)) throw new Error(`runtime_egress_blocked: host '${normalized}' is outside the runtime allowlist`);
}
function hostFromArgs(args, secure=false) {
  const first = args[0];
  if (typeof first === 'string' && /^https?:\/\//i.test(first.trim())) { const url = new URL(first.trim()); return { hostname: url.hostname, protocol: url.protocol }; }
  const options = first && typeof first === 'object' ? first : (args[1] && typeof args[1] === 'object' ? args[1] : null);
  if (!options) return { hostname: null, protocol: secure ? 'https:' : 'http:' };
  return { hostname: options.hostname || options.host || options.servername || null, protocol: options.protocol || (secure ? 'https:' : 'http:') };
}
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function patchedConnect(...args) {
  const first = args[0];
  const host = typeof first === 'object' && first ? (first.host || first.hostname || null) : (typeof args[1] === 'string' ? args[1] : null);
  assertAllowed(host, 'tcp:');
  return originalConnect.apply(this, args);
};
function patchRequest(mod, secure) {
  const originalRequest = mod.request;
  mod.request = function patchedRequest(...args) {
    const { hostname, protocol } = hostFromArgs(args, secure);
    assertAllowed(hostname, protocol);
    return originalRequest.apply(this, args);
  };
  mod.get = function patchedGet(...args) { const req = mod.request(...args); req.end(); return req; };
}
patchRequest(http, false);
patchRequest(https, true);
if (typeof globalThis.fetch === 'function') {
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = function patchedFetch(resource, init) {
    const target = resource && typeof resource === 'object' && resource.url ? resource.url : resource;
    const url = new URL(String(target));
    assertAllowed(url.hostname, url.protocol);
    return originalFetch(resource, init);
  };
}
