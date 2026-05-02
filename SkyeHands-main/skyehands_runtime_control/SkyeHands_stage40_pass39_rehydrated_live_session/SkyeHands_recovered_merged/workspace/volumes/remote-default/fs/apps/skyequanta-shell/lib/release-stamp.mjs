import fs from 'node:fs';
import path from 'node:path';

import { buildMasterProofLedger, collectProofHashes, writeJson } from './proof-ledger.mjs';

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

export function buildReleaseStamp(config, options = {}) {
  const shellPackage = readJson(path.join(config.shellDir, 'package.json'), { name: 'skyequanta-shell', version: '0.0.0' });
  const rootPackage = readJson(path.join(config.rootDir, 'package.json'), { name: shellPackage.name || 'skyequanta-root', version: shellPackage.version || '0.0.0' });
  const ledger = buildMasterProofLedger(config.rootDir);
  const passingEntries = ledger.entries.filter(entry => entry.pass);
  const highest = passingEntries[passingEntries.length - 1] || null;
  const packetDocs = [
    'DEEP_SCAN_REPORT.md',
    'docs/PROCUREMENT_PACKET_INDEX.md',
    'docs/BOARD_INVESTOR_ONE_PAGER.html',
    'docs/ARCHITECTURE_OVERVIEW.html',
    'docs/PROOF_CENTER.html',
    'docs/LAUNCH_READINESS.md',
    'docs/SMOKE_CONTRACT_MATRIX.md',
    'client-handoff-for-procurement.html'
  ];
  return {
    generatedAt: new Date().toISOString(),
    companyName: config.companyName,
    productName: config.productName,
    rootPackage: {
      name: rootPackage.name,
      version: rootPackage.version
    },
    shellPackage: {
      name: shellPackage.name,
      version: shellPackage.version
    },
    releaseVersion: options.releaseVersion || rootPackage.version,
    highestPassingStage: highest ? highest.stage : null,
    proofArtifactCount: collectProofHashes(config.rootDir).length,
    packetDocs,
    canonicalCommands: {
      operatorStart: './skyequanta operator:start --json',
      doctor: './skyequanta doctor --mode deploy --probe-active --json',
      shipCandidate: 'npm run ship:candidate -- --strict --json'
    }
  };
}

export function writeReleaseStamp(config, destinationFile = path.join(config.rootDir, 'docs', 'VERSION_STAMP.json'), options = {}) {
  const stamp = buildReleaseStamp(config, options);
  writeJson(destinationFile, stamp);
  return stamp;
}
