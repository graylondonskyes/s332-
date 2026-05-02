import fs from 'node:fs';
import path from 'node:path';
import { sha256File } from './deployment-packaging.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function proofPass(payload) {
  return Boolean(payload?.pass ?? payload?.passed ?? payload?.ok);
}

export const CANONICAL_STAGE_SPECS = [
  { stageKey: '1', numericStage: 1, artifact: 'docs/proof/STAGE_1_TRUTH_AND_PROOF.json', command: 'npm run workspace:proof:stage1 -- --strict' },
  { stageKey: '2', numericStage: 2, artifact: 'docs/proof/STAGE_2_REAL_LOCAL_EXECUTOR.json', command: 'npm run workspace:proof:stage2 -- --strict' },
  { stageKey: '2B', numericStage: 2, artifact: 'docs/proof/STAGE_2B_UPSTREAM_PARITY.json', command: 'npm run workspace:proof:stage2b -- --strict' },
  { stageKey: '3', numericStage: 3, artifact: 'docs/proof/STAGE_3_REPO_PROVISIONING.json', command: 'npm run workspace:proof:stage3 -- --strict' },
  { stageKey: '4', numericStage: 4, artifact: 'docs/proof/STAGE_4_REMOTE_EXECUTOR.json', command: 'npm run workspace:proof:stage4 -- --strict' },
  { stageKey: '5', numericStage: 5, artifact: 'docs/proof/STAGE_5_LIFECYCLE_AND_SECRETS.json', command: 'npm run workspace:proof:stage5 -- --strict' },
  { stageKey: '6', numericStage: 6, artifact: 'docs/proof/STAGE_6_ADMIN_CONTROL_PLANE.json', command: 'npm run workspace:proof:stage6 -- --strict' },
  { stageKey: '7', numericStage: 7, artifact: 'docs/proof/STAGE_7_SMOKE_MATRIX.json', command: 'npm run workspace:proof:stage7 -- --strict' },
  { stageKey: '8', numericStage: 8, artifact: 'docs/proof/STAGE_8_PREVIEW_FORWARDING.json', command: 'npm run workspace:proof:stage8 -- --strict' },
  { stageKey: '9', numericStage: 9, artifact: 'docs/proof/STAGE_9_DEPLOYMENT_READINESS.json', command: 'npm run workspace:proof:stage9 -- --strict' },
  { stageKey: '10', numericStage: 10, artifact: 'docs/proof/STAGE_10_MULTI_WORKSPACE_STRESS.json', command: 'npm run workspace:proof:stage10 -- --strict' },
  { stageKey: '11', numericStage: 11, artifact: 'docs/proof/STAGE_11_REGRESSION_PROOF.json', command: 'npm run workspace:proof:stage11 -- --strict' }
];

export function collectProofHashes(rootDir) {
  const proofDir = path.join(rootDir, 'docs', 'proof');
  if (!fs.existsSync(proofDir)) return [];
  return fs.readdirSync(proofDir)
    .filter(name => name.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
    .map(name => {
      const filePath = path.join(proofDir, name);
      const payload = readJson(filePath);
      return {
        file: path.relative(rootDir, filePath),
        sha256: sha256File(filePath),
        generatedAt: payload?.generatedAt || null,
        pass: proofPass(payload)
      };
    });
}

export function buildMasterProofLedger(rootDir, extra = {}) {
  const proofHashes = collectProofHashes(rootDir);
  const hashByFile = new Map(proofHashes.map(item => [item.file, item]));
  const entries = CANONICAL_STAGE_SPECS.map(spec => {
    const filePath = path.join(rootDir, spec.artifact);
    const exists = fs.existsSync(filePath);
    const payload = exists ? readJson(filePath) : null;
    const hashEntry = hashByFile.get(spec.artifact) || null;
    return {
      stage: spec.stageKey,
      status: exists && proofPass(payload) ? 'pass' : 'blank',
      artifactPath: spec.artifact,
      generatedAt: payload?.generatedAt || null,
      command: payload?.proofCommand || spec.command,
      sha256: hashEntry?.sha256 || null,
      pass: exists ? proofPass(payload) : false
    };
  });

  const pass = entries.every(entry => entry.pass);
  const payload = {
    generatedAt: new Date().toISOString(),
    label: 'master-proof-ledger',
    canonicalRuntimePath: 'skyequanta.mjs',
    entries,
    proofArtifactHashes: proofHashes,
    pass,
    ...extra
  };
  return payload;
}
