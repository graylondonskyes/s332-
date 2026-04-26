import fs from 'node:fs';
import path from 'node:path';

import { attachCanonicalRuntimeProof, getCanonicalRuntimePaths, printCanonicalRuntimeBanner } from './canonical-runtime.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function buildProofPayloadWithCanonicalRuntime(payload, config, invokedBy) {
  const next = attachCanonicalRuntimeProof(payload, config, invokedBy);
  return {
    ...next,
    canonicalRuntimePath: next?.canonicalRuntime?.operatorCli?.entry || getCanonicalRuntimePaths(config).operatorCli.entry
  };
}

export function writeProofJson(filePath, payload, config, invokedBy) {
  ensureDirectory(path.dirname(filePath));
  const next = buildProofPayloadWithCanonicalRuntime(payload, config, invokedBy);
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

export function printCanonicalRuntimeBannerForCommand(config, invokedBy, options = {}) {
  const stream = options.stderr
    ? { log: (...args) => console.error(...args) }
    : (options.stream || console);
  return printCanonicalRuntimeBanner(config, invokedBy, { stream });
}

export function canonicalizeExistingProofPayload(payload, config, invokedBy) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  return buildProofPayloadWithCanonicalRuntime(payload, config, invokedBy);
}
