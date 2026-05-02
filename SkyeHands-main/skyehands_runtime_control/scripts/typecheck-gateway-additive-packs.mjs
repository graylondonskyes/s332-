#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runtimeRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(runtimeRoot, '..');
const proofDir = path.join(runtimeRoot, '.skyequanta', 'proofs');
const outFile = path.join(proofDir, 'gateway-additive-typecheck.json');

const packSuffix = 'assets/Upgrades/SKyeverse-SkyeTokens-SkyeCOINS/Gate-Upgrades/GatewayUpgrades/GatewayUpgrades/sky-currency-additive-pack';
const packs = [
  path.join(repoRoot, 'AbovetheSkye-Platforms', 'kAIxUGateway13', packSuffix),
  path.join(repoRoot, 'AbovetheSkye-Platforms', 'SkyeGateFS13', packSuffix),
];

const compilerCandidates = [
  path.join(repoRoot, 'AbovetheSkye-Platforms', 'SuperIDEv3.8', 'node_modules', 'typescript', 'bin', 'tsc'),
  path.join(repoRoot, 'AbovetheSkye-Platforms', 'SuperIDEv2', 'node_modules', 'typescript', 'bin', 'tsc'),
  path.join(runtimeRoot, '.netlify', 'plugins', 'node_modules', 'typescript', 'bin', 'tsc'),
];

const compiler = compilerCandidates.find((candidate) => fs.existsSync(candidate));

const results = packs.map((packRoot) => {
  if (!compiler) {
    return {
      packRoot: path.relative(repoRoot, packRoot),
      ok: false,
      status: null,
      stdout: '',
      stderr: 'No TypeScript compiler found in known workspace dependency locations.',
    };
  }

  const run = spawnSync(process.execPath, [compiler, '--noEmit'], {
    cwd: packRoot,
    encoding: 'utf8',
  });

  return {
    packRoot: path.relative(repoRoot, packRoot),
    ok: run.status === 0,
    status: run.status,
    stdout: run.stdout.trim(),
    stderr: run.stderr.trim(),
  };
});

const result = {
  generatedAt: new Date().toISOString(),
  smoke: 'gateway-additive-typecheck',
  compiler: compiler ? path.relative(repoRoot, compiler) : null,
  results,
  passed: results.every((item) => item.ok),
};

fs.mkdirSync(proofDir, { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ...result, proof: path.relative(runtimeRoot, outFile) }, null, 2));

if (!result.passed) process.exit(1);
