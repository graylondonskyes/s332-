import path from 'node:path';
import { getOutboundNetworkPolicy } from './network-policy.mjs';

function readString(value) { return String(value ?? '').trim(); }
function uniq(values = []) { return [...new Set(values.filter(Boolean))]; }
function splitList(value) { return readString(value).split(',').map(item => item.trim()).filter(Boolean); }
function prependPath(originalValue, entry) {
  const items = String(originalValue || '').split(path.delimiter).filter(Boolean);
  if (!items.includes(entry)) items.unshift(entry);
  return items.join(path.delimiter);
}
function appendNodeOption(existing, addition) {
  const current = readString(existing);
  if (!current) return addition;
  if (current.includes(addition)) return current;
  return `${addition} ${current}`;
}

export function getRuntimeEgressPolicy(env = process.env) {
  const outbound = getOutboundNetworkPolicy(env);
  return {
    enabled: readString(env.SKYEQUANTA_RUNTIME_EGRESS_ENABLED).toLowerCase() !== '0',
    allowHttp: readString(env.SKYEQUANTA_RUNTIME_EGRESS_ALLOW_HTTP).toLowerCase() === '1' || outbound.allowHttp,
    blockPrivateNetworks: readString(env.SKYEQUANTA_RUNTIME_EGRESS_BLOCK_PRIVATE).toLowerCase() !== '0',
    blockMetadata: readString(env.SKYEQUANTA_RUNTIME_EGRESS_BLOCK_METADATA).toLowerCase() !== '0',
    allowedHosts: uniq([
      ...splitList(env.SKYEQUANTA_RUNTIME_EGRESS_ALLOWED_HOSTS),
      ...(outbound.allowedHosts || []),
      ...Object.values(outbound.providerAllowHosts || {}).flat()
    ]).map(item => item.toLowerCase())
  };
}

export function applyRuntimeEgressHooks(config, env = {}) {
  const policy = getRuntimeEgressPolicy({ ...process.env, ...env });
  const hookPath = path.join(config.shellDir, 'lib', 'runtime-egress-hook.cjs');
  const pythonHookDir = path.join(config.shellDir, 'python-hooks');
  const nextEnv = {
    ...env,
    SKYEQUANTA_RUNTIME_EGRESS_ENABLED: policy.enabled ? '1' : '0',
    SKYEQUANTA_RUNTIME_EGRESS_ALLOW_HTTP: policy.allowHttp ? '1' : '0',
    SKYEQUANTA_RUNTIME_EGRESS_BLOCK_PRIVATE: policy.blockPrivateNetworks ? '1' : '0',
    SKYEQUANTA_RUNTIME_EGRESS_BLOCK_METADATA: policy.blockMetadata ? '1' : '0',
    SKYEQUANTA_RUNTIME_EGRESS_ALLOWED_HOSTS: policy.allowedHosts.join(',')
  };
  nextEnv.NODE_OPTIONS = appendNodeOption(nextEnv.NODE_OPTIONS, `--require=${hookPath}`);
  nextEnv.PYTHONPATH = prependPath(nextEnv.PYTHONPATH, pythonHookDir);
  return { env: nextEnv, policy, hookPath, pythonHookDir };
}
