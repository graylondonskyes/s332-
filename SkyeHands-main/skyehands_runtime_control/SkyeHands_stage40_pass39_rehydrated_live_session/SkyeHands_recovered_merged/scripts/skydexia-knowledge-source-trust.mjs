#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const updatesDir = path.join(root, 'skydexia', 'knowledge-updates');
const policyPath = path.join(updatesDir, 'source-trust-policy.json');
const provenancePath = path.join(updatesDir, 'source-provenance-log.json');

fs.mkdirSync(updatesDir, { recursive: true });
const defaultSource = `file://${path.join(root, 'skydexia', 'knowledge-base', 'import-fixture.txt')}`;

let policy = null;
if (fs.existsSync(policyPath)) {
  policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
} else {
  policy = {
    version: 1,
    updatedAt: new Date().toISOString(),
    trustPolicy: {
      allowSchemes: ['file', 'https'],
      requireExplicitAllowlist: true,
      blockedHosts: []
    },
    allowlist: [
      {
        sourceId: 'local-import-fixture',
        uri: defaultSource,
        trustTier: 'high',
        owner: 'skydexia-core',
        maxPayloadBytes: 200000
      }
    ]
  };
  fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n', 'utf8');
}

const provenanceEntries = [];
for (const source of policy.allowlist || []) {
  const record = JSON.stringify(source);
  provenanceEntries.push({
    sourceId: source.sourceId,
    uri: source.uri,
    trustTier: source.trustTier,
    recordedAt: new Date().toISOString(),
    fingerprint: crypto.createHash('sha256').update(record).digest('hex')
  });
}

const provenance = {
  version: 1,
  generatedAt: new Date().toISOString(),
  totalSources: provenanceEntries.length,
  entries: provenanceEntries
};

fs.writeFileSync(provenancePath, JSON.stringify(provenance, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  policy: path.relative(root, policyPath),
  provenance: path.relative(root, provenancePath),
  totalSources: provenanceEntries.length
}, null, 2));
