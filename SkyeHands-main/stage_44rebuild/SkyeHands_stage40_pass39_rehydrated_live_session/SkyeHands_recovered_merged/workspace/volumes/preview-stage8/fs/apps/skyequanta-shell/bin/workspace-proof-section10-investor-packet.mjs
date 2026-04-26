#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStackConfig } from './config.mjs';
import { writeInvestorPacket } from '../lib/investor-packet.mjs';
import { writeJson } from '../lib/proof-ledger.mjs';
import { ensureRuntimeState } from '../lib/runtime.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';

const shellBinDir = path.dirname(fileURLToPath(import.meta.url));
const shellDir = path.resolve(shellBinDir, '..');
const rootDir = path.resolve(shellDir, '..', '..');

function hasText(filePath, snippets) {
  const text = fs.readFileSync(filePath, 'utf8');
  return snippets.every(snippet => text.includes(snippet));
}

function recordCheck(checks, pass, message, detail = null) {
  checks.push({ pass, message, detail });
  if (!pass) {
    throw new Error(message);
  }
}

function validateLinks(filePath, expectedTargets) {
  const text = fs.readFileSync(filePath, 'utf8');
  return expectedTargets.every(target => text.includes(target));
}

async function main() {
  const strict = process.argv.includes('--strict');
  const config = getStackConfig(process.env);
  ensureRuntimeState(config, process.env);
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section10-investor-packet.mjs');
  const built = writeInvestorPacket(rootDir);
  const checks = [];

  const requiredFiles = Object.entries(built.files);
  recordCheck(
    checks,
    requiredFiles.every(([, filePath]) => fs.existsSync(filePath)),
    'all required Section 10 investor/procurement packet files exist',
    Object.fromEntries(requiredFiles.map(([key, filePath]) => [key, path.relative(rootDir, filePath)]))
  );

  recordCheck(
    checks,
    hasText(built.files.deepScanReport, ['Deep Scan Report', built.config.productName, 'Stage 11 regression']),
    'DEEP_SCAN_REPORT.md contains product, package, and Stage 11 summary language',
    path.relative(rootDir, built.files.deepScanReport)
  );

  recordCheck(
    checks,
    validateLinks(built.files.procurementIndex, ['Deep Scan Report', 'Client handoff for procurement', 'Board investor one-pager', 'Current-build investor valuation memo', 'Category-of-one investor brief', 'Proof center']),
    'PROCUREMENT_PACKET_INDEX.md links the packet surfaces',
    path.relative(rootDir, built.files.procurementIndex)
  );

  recordCheck(
    checks,
    hasText(built.files.architectureOverview, ['Architecture overview', 'ide-core', 'agent-core', 'Remote executor', 'Gate', 'Snapshots & governance']),
    'architecture overview page covers shell, ide-core, agent-core, executor, gate, snapshots, and governance',
    path.relative(rootDir, built.files.architectureOverview)
  );

  recordCheck(
    checks,
    hasText(built.files.proofCenter, ['Proof Center', 'Proof ladder', 'Current hardening notes']),
    'proof center page links smoke/stage posture and hardening notes',
    path.relative(rootDir, built.files.proofCenter)
  );

  recordCheck(
    checks,
    hasText(built.files.valuationMemo, ["Current-build devil's-advocate code-floor valuation", '$9,600,000 USD', 'Investor raise posture for a pre-commercial category creator']),
    'valuation memo exists with code-floor, raise posture, and upside framing',
    path.relative(rootDir, built.files.valuationMemo)
  );

  recordCheck(
    checks,
    hasText(built.files.categoryBrief, ['Category thesis', 'Code-floor valuation', 'Raise posture', 'Strategic upside']),
    'category-of-one investor brief exists with category thesis and valuation stack',
    path.relative(rootDir, built.files.categoryBrief)
  );

  recordCheck(
    checks,
    hasText(built.files.pricingSpec, [built.config.productName, 'Package scope', 'Spec highlights']),
    'public pricing/spec page exists with product scope and spec language',
    path.relative(rootDir, built.files.pricingSpec)
  );

  recordCheck(
    checks,
    hasText(built.files.publicReadme, ['Public Surface', 'pricing-spec.html']),
    'public README documents the public-facing pricing/spec surface',
    path.relative(rootDir, built.files.publicReadme)
  );

  recordCheck(
    checks,
    hasText(built.files.datedSmokeReport, ['Investor Smoke Report', built.today, 'Stage 11 regression proof']),
    'dated investor-readable smoke report exists and carries the current report date',
    path.relative(rootDir, built.files.datedSmokeReport)
  );

  recordCheck(
    checks,
    hasText(built.files.procurementHandoff, ['Procurement handoff', 'Deep Scan Report', 'Current-Build Investor Valuation', 'Category-of-One Investor Brief', 'Public Pricing & Spec']),
    'client handoff for procurement page exists with packet navigation',
    path.relative(rootDir, built.files.procurementHandoff)
  );

  recordCheck(
    checks,
    hasText(built.files.boardOnePager, ['Board summary', built.config.companyName, 'Stage 9', 'Stage 11', 'Code-floor valuation', 'Raise posture']),
    'board investor one-pager exists with current board-level proof posture and valuation stack',
    path.relative(rootDir, built.files.boardOnePager)
  );

  recordCheck(
    checks,
    hasText(built.files.launchReadiness, ['Launch Readiness', 'Canonical runtime path', 'Deployment readiness']),
    'launch-readiness memo exists with canonical runtime and deployment status',
    path.relative(rootDir, built.files.launchReadiness)
  );

  recordCheck(
    checks,
    hasText(built.files.smokeContractMatrix, ['Smoke Contract Matrix', 'Stage 9 deployment readiness', 'Stage 11 regression proof']),
    'smoke contract matrix exists with stage-backed smoke mapping',
    path.relative(rootDir, built.files.smokeContractMatrix)
  );

  let payload = {
    generatedAt: new Date().toISOString(),
    pass: true,
    strict,
    proofCommand: 'npm run workspace:proof:section10 -- --strict',
    checks,
    packetFiles: Object.fromEntries(requiredFiles.map(([key, filePath]) => [key, path.relative(rootDir, filePath)]))
  };

  const proofFile = path.join(rootDir, 'docs', 'proof', 'SECTION_10_INVESTOR_PACKET.json');
  payload = writeProofJson(proofFile, payload, config, 'workspace-proof-section10-investor-packet.mjs');
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch(error => {
  let payload = {
    generatedAt: new Date().toISOString(),
    pass: false,
    proofCommand: 'npm run workspace:proof:section10 -- --strict',
    error: error.message
  };
  const proofFile = path.join(rootDir, 'docs', 'proof', 'SECTION_10_INVESTOR_PACKET.json');
  writeProofJson(proofFile, payload, config, 'workspace-proof-section10-investor-packet.mjs');
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
