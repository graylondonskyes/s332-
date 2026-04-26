#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function main() {
  const readiness = readJson('CODE_READINESS_MATRIX.json');
  const claimsMap = readJson('CLAIMS_TO_SMOKE_MAP.json');

  const violations = [];

  for (const platform of readiness.platforms ?? []) {
    const productionClaimed = platform.grade === 'PRODUCTION-READY';
    const hasBehavioralSmoke = (platform.scores?.behavioralSmoke ?? 0) > 0;
    const hasDocMismatch = (platform.violations ?? []).some(v => v.rule === 'DOC-MISMATCH');

    if (productionClaimed && !hasBehavioralSmoke) {
      violations.push({
        rule: 'PROD_WITHOUT_BEHAVIORAL_SMOKE',
        platform: platform.id,
        detail: 'Platform grade is PRODUCTION-READY but behavioralSmoke=0',
      });
    }

    if (productionClaimed && hasDocMismatch) {
      violations.push({
        rule: 'PROD_WITH_DOC_MISMATCH',
        platform: platform.id,
        detail: 'Platform has DOC-MISMATCH violation while claiming production readiness',
      });
    }
  }

  for (const claim of claimsMap.claims ?? []) {
    if (claim.codeGrade === 'PRODUCTION-READY' && !claim.passing) {
      violations.push({
        rule: 'CLAIM_WITHOUT_BEHAVIORAL_SMOKE',
        platform: claim.platform,
        claim: claim.claim,
        detail: 'Production-ready claim blocked by missing behavioral smoke',
      });
    }
  }

  const summary = {
    generated: new Date().toISOString(),
    gate: 'directive-release-honesty-gate',
    passed: violations.length === 0,
    checks: {
      readinessPlatforms: (readiness.platforms ?? []).length,
      claimsChecked: (claimsMap.claims ?? []).length,
    },
    violations,
  };

  const outFile = path.join(ROOT, 'DIRECTIVE_RELEASE_GATE_REPORT.json');
  fs.writeFileSync(outFile, JSON.stringify(summary, null, 2));

  if (violations.length > 0) {
    console.error(`Directive release gate FAILED with ${violations.length} violation(s).`);
    for (const v of violations.slice(0, 20)) {
      console.error(`- [${v.rule}] ${v.platform}${v.claim ? `/${v.claim}` : ''}: ${v.detail}`);
    }
    process.exit(1);
  }

  console.log('Directive release gate PASSED.');
  console.log(`Report: ${outFile}`);
}

main();
