#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(runtimeRoot, '..');
const proofDir = path.join(runtimeRoot, '.skyequanta', 'proofs');
const outFile = path.join(proofDir, 'repo-clean.json');

const generatedDirsThatShouldStayOut = [
  'AbovetheSkye-Platforms/kAIxUGateway13/assets/Upgrades/SKyeverse-SkyeTokens-SkyeCOINS/Gate-Upgrades/GatewayUpgrades/GatewayUpgrades/sky-currency-additive-pack/node_modules',
  'AbovetheSkye-Platforms/SkyeGateFS13/assets/Upgrades/SKyeverse-SkyeTokens-SkyeCOINS/Gate-Upgrades/GatewayUpgrades/GatewayUpgrades/sky-currency-additive-pack/node_modules',
];

const presentGeneratedDirs = generatedDirsThatShouldStayOut
  .filter((relativePath) => fs.existsSync(path.join(repoRoot, relativePath)));

const result = {
  generatedAt: new Date().toISOString(),
  smoke: 'repo-clean',
  mode: 'safe-check-only',
  checks: {
    noGatewayAdditiveNodeModules: presentGeneratedDirs.length === 0,
  },
  presentGeneratedDirs,
};

result.passed = Object.values(result.checks).every(Boolean);

fs.mkdirSync(proofDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ...result, proof: path.relative(runtimeRoot, outFile) }, null, 2));

if (!result.passed) process.exit(1);
