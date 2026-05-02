import fs from 'node:fs';
import path from 'node:path';

export const SKYDEXIA_IDENTITY = 'SkyDexia model by Skyes Over London';

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

export function loadCapabilityRegistry(rootDir) {
  const registryPath = path.join(rootDir, 'skydexia', 'capability-registry.json');
  return readJson(registryPath, { version: 1, capabilities: [] });
}

export function loadRuntimeBoundaries(rootDir) {
  const boundariesPath = path.join(rootDir, 'docs', 'SKYDEXIA_RUNTIME_BOUNDARIES.json');
  return readJson(boundariesPath, { identity: SKYDEXIA_IDENTITY, planes: [], lanes: [], boundaryRules: [] });
}

export function assertIdentity(boundaries) {
  if (boundaries?.identity !== SKYDEXIA_IDENTITY) {
    throw new Error(`SkyDexia identity mismatch. Expected '${SKYDEXIA_IDENTITY}'`);
  }
}

export function resolveBuildPlan(registry, capabilityIds = []) {
  const selected = capabilityIds.length
    ? registry.capabilities.filter((cap) => capabilityIds.includes(cap.id))
    : registry.capabilities;
  return selected.map((cap) => ({
    id: cap.id,
    lane: cap.lane,
    requires: cap.requires || [],
    entrypoint: cap.entrypoint
  }));
}

export async function invokeAeBrainCapability(rootDir, payload = {}) {
  const handlerPath = path.join(rootDir, 'platform', 'user-platforms', 'skye-account-executive-commandhub-s0l26-0s', 'source', 'AE-Central-Command-Pack-CredentialHub-Launcher', 'netlify', 'functions', 'ae-brain-chat.js');
  const mod = await import(`file://${handlerPath}`);
  const handler = mod?.default?.handler || mod?.default || mod?.handler || (await import('node:module')).createRequire(import.meta.url)(handlerPath).handler;
  return handler({ httpMethod: 'POST', body: JSON.stringify(payload) });
}

export function composeOrchestrationSnapshot(rootDir, capabilityIds = []) {
  const boundaries = loadRuntimeBoundaries(rootDir);
  assertIdentity(boundaries);
  const registry = loadCapabilityRegistry(rootDir);
  const plan = resolveBuildPlan(registry, capabilityIds);
  return {
    ok: true,
    identity: SKYDEXIA_IDENTITY,
    boundaries,
    capabilityCount: plan.length,
    plan
  };
}
