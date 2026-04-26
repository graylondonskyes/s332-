#!/usr/bin/env node
/**
 * Directive 1.1 smoke:
 * Prove legacy structural-only checkmarks are quarantined and excluded from completion percentage.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LEGACY_REPORT = path.join(ROOT, 'LEGACY_CHECKMARK_REVALIDATION_REPORT.md');
const CLAIMS_MAP = path.join(ROOT, 'CLAIMS_TO_SMOKE_MAP.json');
const OUT = path.join(ROOT, '.skyequanta', 'proofs', 'legacy-checkmark-quarantine-smoke.json');

function parseQuarantinedClaims(md) {
  const rows = md.split('\n').filter((line) => line.trim().startsWith('|') && line.includes('|') && !line.includes('---'));
  return rows
    .map((line) => line.split('|').map((c) => c.trim()).filter(Boolean))
    .filter((cols) => cols.length >= 4)
    .map((cols) => ({
      claim: cols[0],
      originalProofType: cols[1],
      downgradeReason: cols[2],
      requiredSmoke: cols[3],
    }))
    .filter((x) => x.claim !== 'Claim');
}

function main() {
  const md = fs.readFileSync(LEGACY_REPORT, 'utf8');
  const claimsMap = JSON.parse(fs.readFileSync(CLAIMS_MAP, 'utf8'));

  const quarantined = parseQuarantinedClaims(md);
  const quarantinedCount = quarantined.length;

  const totalClaims = (claimsMap.claims || []).length;
  const reinstatedBehavioral = (claimsMap.claims || []).filter((c) => c.passing === true).length;
  const blockedClaims = (claimsMap.claims || []).filter((c) => c.passing !== true).length;

  const completionPct = totalClaims === 0 ? 0 : Math.round((reinstatedBehavioral / totalClaims) * 10000) / 100;
  const quarantinedExcludedFromNumerator = blockedClaims > 0 && reinstatedBehavioral < totalClaims;

  const result = {
    generatedAt: new Date().toISOString(),
    smoke: 'legacy-checkmark-quarantine',
    checks: {
      legacyReportPresent: fs.existsSync(LEGACY_REPORT),
      claimsMapPresent: fs.existsSync(CLAIMS_MAP),
      quarantinedClaimsDetected: quarantinedCount > 0,
      structuralClaimsBlockedDetected: blockedClaims > 0,
      quarantinedExcludedFromNumerator,
    },
    metrics: {
      quarantinedCount,
      totalClaims,
      reinstatedBehavioral,
      blockedClaims,
      completionPct,
    },
  };
  result.passed = Object.values(result.checks).every(Boolean);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));

  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exit(1);
}

main();
