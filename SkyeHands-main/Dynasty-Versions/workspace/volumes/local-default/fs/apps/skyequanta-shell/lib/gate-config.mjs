import fs from 'node:fs';
import path from 'node:path';

import { collectSecretValues, redactTextAgainstSecrets } from './provider-redaction.mjs';

export const GATE_RUNTIME_MODES = ['offline', 'local-only', 'remote-gated'];

const DEFAULT_GATE_RUNTIME_CONFIG = {
  version: 1,
  mode: 'local-only',
  gate: {
    url: null,
    model: 'kaixu/deep',
    urlEnvVars: ['SKYEQUANTA_GATE_URL', 'OMEGA_GATE_URL'],
    tokenEnvVars: ['SKYEQUANTA_GATE_TOKEN', 'SKYEQUANTA_OSKEY'],
    modelEnvVars: ['SKYEQUANTA_GATE_MODEL'],
    founderGatewayEnabled: true
  },
  redaction: {
    policyPath: 'config/redaction-policy.json',
    supportDumpDir: '.skyequanta/reports/support-dumps'
  }
};

const DEFAULT_REDACTION_POLICY = {
  version: 1,
  replaceWith: '[REDACTED]',
  secretKeys: [
    'token',
    'authorization',
    'apiKey',
    'secret',
    'password',
    'founders-gateway-key',
    'gateToken',
    'gateSessionId',
    'openai_api_key',
    'oh_secret_key'
  ],
  envKeys: [
    'SKYEQUANTA_GATE_TOKEN',
    'SKYEQUANTA_OSKEY',
    'OPENAI_API_KEY',
    'OH_SECRET_KEY',
    'LLM_API_KEY'
  ]
};

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function readString(value) {
  return String(value || '').trim();
}

function readFirstEnv(env, keys = []) {
  for (const key of keys) {
    const value = readString(env?.[key]);
    if (value) {
      return { key, value };
    }
  }
  return { key: null, value: '' };
}

function normalizeMode(value) {
  const normalized = readString(value).toLowerCase();
  if (!normalized) {
    return 'local-only';
  }
  if (!GATE_RUNTIME_MODES.includes(normalized)) {
    throw new Error(`Unsupported gate runtime mode '${value}'. Expected one of: ${GATE_RUNTIME_MODES.join(', ')}.`);
  }
  return normalized;
}

export function getGateRuntimeConfigPath(rootDir) {
  return path.join(rootDir, 'config', 'gate-runtime.json');
}

export function getRedactionPolicyPath(rootDir) {
  return path.join(rootDir, 'config', 'redaction-policy.json');
}

export function ensureGateRuntimeConfigFiles(rootDir) {
  const gateRuntimePath = getGateRuntimeConfigPath(rootDir);
  const redactionPolicyPath = getRedactionPolicyPath(rootDir);
  if (!fs.existsSync(gateRuntimePath)) {
    writeJson(gateRuntimePath, DEFAULT_GATE_RUNTIME_CONFIG);
  }
  if (!fs.existsSync(redactionPolicyPath)) {
    writeJson(redactionPolicyPath, DEFAULT_REDACTION_POLICY);
  }
  return { gateRuntimePath, redactionPolicyPath };
}

export function loadRedactionPolicy(rootDir) {
  ensureGateRuntimeConfigFiles(rootDir);
  const redactionPolicyPath = getRedactionPolicyPath(rootDir);
  const policy = readJson(redactionPolicyPath, DEFAULT_REDACTION_POLICY) || DEFAULT_REDACTION_POLICY;
  return {
    ...DEFAULT_REDACTION_POLICY,
    ...policy,
    secretKeys: Array.isArray(policy.secretKeys) ? policy.secretKeys : DEFAULT_REDACTION_POLICY.secretKeys,
    envKeys: Array.isArray(policy.envKeys) ? policy.envKeys : DEFAULT_REDACTION_POLICY.envKeys
  };
}

export function loadGateRuntimeConfig(rootDir, env = process.env) {
  const { gateRuntimePath } = ensureGateRuntimeConfigFiles(rootDir);
  const fileConfig = readJson(gateRuntimePath, DEFAULT_GATE_RUNTIME_CONFIG) || DEFAULT_GATE_RUNTIME_CONFIG;
  const mode = normalizeMode(env.SKYEQUANTA_RUNTIME_MODE || fileConfig.mode || DEFAULT_GATE_RUNTIME_CONFIG.mode);
  const gateUrlSource = readFirstEnv(env, fileConfig?.gate?.urlEnvVars || DEFAULT_GATE_RUNTIME_CONFIG.gate.urlEnvVars);
  const gateTokenSource = readFirstEnv(env, fileConfig?.gate?.tokenEnvVars || DEFAULT_GATE_RUNTIME_CONFIG.gate.tokenEnvVars);
  const gateModelSource = readFirstEnv(env, fileConfig?.gate?.modelEnvVars || DEFAULT_GATE_RUNTIME_CONFIG.gate.modelEnvVars);
  const gateUrl = readString(gateUrlSource.value || fileConfig?.gate?.url || '').replace(/\/+$/, '') || null;
  const gateToken = readString(gateTokenSource.value || fileConfig?.gate?.token || '');
  const gateModel = readString(gateModelSource.value || fileConfig?.gate?.model || DEFAULT_GATE_RUNTIME_CONFIG.gate.model) || DEFAULT_GATE_RUNTIME_CONFIG.gate.model;
  const founderGatewayEnabled = fileConfig?.gate?.founderGatewayEnabled !== false;
  const redactionPolicy = loadRedactionPolicy(rootDir);
  const errors = [];
  if (mode === 'remote-gated') {
    if (!gateUrl) {
      errors.push('Remote-gated mode requires SKYEQUANTA_GATE_URL or OMEGA_GATE_URL.');
    }
    if (!gateToken) {
      errors.push('Remote-gated mode requires SKYEQUANTA_GATE_TOKEN or SKYEQUANTA_OSKEY.');
    }
  }
  return {
    version: Number.parseInt(String(fileConfig.version || 1), 10) || 1,
    mode,
    gate: {
      url: gateUrl,
      token: gateToken,
      model: gateModel,
      founderGatewayEnabled,
      urlSource: gateUrlSource.key || (fileConfig?.gate?.url ? 'config:gate.url' : null),
      tokenSource: gateTokenSource.key || (fileConfig?.gate?.token ? 'config:gate.token' : null),
      modelSource: gateModelSource.key || (fileConfig?.gate?.model ? 'config:gate.model' : null)
    },
    validation: {
      ok: errors.length === 0,
      errors
    },
    redaction: {
      policyPath: path.relative(rootDir, getRedactionPolicyPath(rootDir)),
      supportDumpDir: readString(fileConfig?.redaction?.supportDumpDir || DEFAULT_GATE_RUNTIME_CONFIG.redaction.supportDumpDir) || DEFAULT_GATE_RUNTIME_CONFIG.redaction.supportDumpDir,
      policy: redactionPolicy
    }
  };
}

export function assertGateRuntimeReady(gateRuntime, purpose = 'runtime startup') {
  if (gateRuntime?.mode === 'remote-gated' && !gateRuntime?.validation?.ok) {
    throw new Error(`${purpose} failed gate runtime validation: ${(gateRuntime.validation.errors || []).join(' ')}`.trim());
  }
  return gateRuntime;
}

function keyLooksSensitive(key, policy) {
  const normalized = readString(key).toLowerCase();
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  if (!compact || compact.endsWith('configured') || compact.endsWith('source')) {
    return false;
  }
  const exactMatches = [
    ...((policy?.secretKeys || []).map(secretKey => String(secretKey).toLowerCase().replace(/[^a-z0-9]/g, ''))),
    ...((policy?.envKeys || []).map(secretKey => String(secretKey).toLowerCase().replace(/[^a-z0-9]/g, '')))
  ];
  if (exactMatches.includes(compact)) {
    return true;
  }
  return /(?:token|secret|password|authorization|apikey)$/.test(compact);
}

function redactStringValue(value, secrets, policy) {
  const replaceWith = policy?.replaceWith || '[REDACTED]';
  let output = String(value);
  for (const secret of secrets) {
    if (!secret) {
      continue;
    }
    output = output.split(secret).join(replaceWith);
  }
  return output;
}

export function collectKnownSecrets(gateRuntime, env = process.env) {
  const secrets = new Set();
  const policy = gateRuntime?.redaction?.policy || DEFAULT_REDACTION_POLICY;
  for (const key of policy.envKeys || []) {
    const value = readString(env[key]);
    if (value) {
      secrets.add(value);
    }
  }
  const gateToken = readString(gateRuntime?.gate?.token);
  if (gateToken) {
    secrets.add(gateToken);
  }
  return [...secrets];
}

export function redactSensitivePayload(payload, gateRuntime, env = process.env) {
  const policy = gateRuntime?.redaction?.policy || DEFAULT_REDACTION_POLICY;
  const secrets = [...new Set([
    ...collectKnownSecrets(gateRuntime, env),
    ...collectSecretValues(payload)
  ])];

  const visit = (value, parentKey = '') => {
    if (Array.isArray(value)) {
      return value.map(item => visit(item, parentKey));
    }
    if (value && typeof value === 'object') {
      const next = {};
      for (const [key, nestedValue] of Object.entries(value)) {
        if (keyLooksSensitive(key, policy)) {
          next[key] = policy.replaceWith || '[REDACTED]';
          continue;
        }
        next[key] = visit(nestedValue, key);
      }
      return next;
    }
    if (typeof value === 'string') {
      if (keyLooksSensitive(parentKey, policy)) {
        return policy.replaceWith || '[REDACTED]';
      }
      return redactTextAgainstSecrets(redactStringValue(value, secrets, policy), secrets);
    }
    return value;
  };

  return visit(payload);
}

export function getGateRuntimeAdminSummary(gateRuntime) {
  return {
    mode: gateRuntime?.mode || 'local-only',
    gateUrl: gateRuntime?.gate?.url || null,
    gateUrlConfigured: Boolean(gateRuntime?.gate?.url),
    gateTokenConfigured: Boolean(gateRuntime?.gate?.token),
    gateTokenSource: gateRuntime?.gate?.tokenSource || null,
    gateModel: gateRuntime?.gate?.model || null,
    founderGatewayEnabled: Boolean(gateRuntime?.gate?.founderGatewayEnabled),
    validation: {
      ok: Boolean(gateRuntime?.validation?.ok),
      errors: Array.isArray(gateRuntime?.validation?.errors) ? gateRuntime.validation.errors : []
    },
    redaction: {
      policyPath: gateRuntime?.redaction?.policyPath || null,
      supportDumpDir: gateRuntime?.redaction?.supportDumpDir || null,
      secretKeys: Array.isArray(gateRuntime?.redaction?.policy?.secretKeys) ? gateRuntime.redaction.policy.secretKeys : [],
      envKeys: Array.isArray(gateRuntime?.redaction?.policy?.envKeys) ? gateRuntime.redaction.policy.envKeys : []
    }
  };
}

export function writeRedactedSupportDump(rootDir, fileName, payload, gateRuntime, env = process.env) {
  const summary = getGateRuntimeAdminSummary(gateRuntime);
  const supportDumpRoot = path.join(rootDir, gateRuntime?.redaction?.supportDumpDir || DEFAULT_GATE_RUNTIME_CONFIG.redaction.supportDumpDir);
  const filePath = path.join(supportDumpRoot, fileName);
  const redacted = redactSensitivePayload(payload, gateRuntime, env);
  writeJson(filePath, {
    generatedAt: new Date().toISOString(),
    gateRuntime: summary,
    payload: redacted
  });
  return filePath;
}
