#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const providerContractPath = path.join(root, 'skydexia', 'providers', 'provider-var-contract.json');
const matrixPath = path.join(root, 'skydexia', 'donors', 'compatibility-matrix.json');
const generatedRoot = path.join(root, 'skydexia', 'generated-projects');
const outPath = path.join(root, 'skydexia', 'proofs', 'diagnostics.json');

const diagnostics = [];
if (!fs.existsSync(providerContractPath)) diagnostics.push({ code: 'CONTRACT_MISSING', severity: 'high', path: path.relative(root, providerContractPath) });
if (!fs.existsSync(matrixPath)) diagnostics.push({ code: 'MATRIX_MISSING', severity: 'high', path: path.relative(root, matrixPath) });

const matrix = fs.existsSync(matrixPath)
  ? JSON.parse(fs.readFileSync(matrixPath, 'utf8')).matrix || []
  : [];
const contractVars = fs.existsSync(providerContractPath)
  ? new Set((JSON.parse(fs.readFileSync(providerContractPath, 'utf8')).vars || []).map((v) => v.providerVar))
  : new Set();

for (const donor of matrix) {
  for (const required of donor.providerVars || []) {
    if (!contractVars.has(required)) {
      diagnostics.push({
        code: 'CONTRACT_VAR_GAP',
        severity: 'high',
        donorId: donor.donorId,
        requiredVar: required,
        message: `Provider var ${required} missing in contract` 
      });
    }
  }
}

if (fs.existsSync(generatedRoot)) {
  const projects = fs.readdirSync(generatedRoot, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  for (const project of projects) {
    const runtimePath = path.join(generatedRoot, project, 'config', 'donor-runtime.json');
    const smokePath = path.join(generatedRoot, project, 'scripts', 'smoke.sh');
    if (!fs.existsSync(runtimePath)) diagnostics.push({ code: 'RUNTIME_CONFIG_MISSING', severity: 'high', project, path: path.relative(root, runtimePath) });
    if (!fs.existsSync(smokePath)) diagnostics.push({ code: 'SMOKE_SCRIPT_MISSING', severity: 'high', project, path: path.relative(root, smokePath) });
  }
}

const report = {
  version: 1,
  checkedAt: new Date().toISOString(),
  totalDiagnostics: diagnostics.length,
  status: diagnostics.length === 0 ? 'PASS' : 'FAIL',
  diagnostics
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, outPath), status: report.status, totalDiagnostics: report.totalDiagnostics }, null, 2));
if (diagnostics.length) process.exit(1);
