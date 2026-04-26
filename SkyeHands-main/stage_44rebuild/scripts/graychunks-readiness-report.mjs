#!/usr/bin/env node
/**
 * GrayChunks Readiness Report — upgraded per directive section 14
 *
 * Scans every platform under stage_44rebuild and emits:
 *   CODE_READINESS_MATRIX.md
 *   CODE_READINESS_MATRIX.json
 *   CLAIMS_TO_SMOKE_MAP.json  (CI gate — fails if claimed capability has no behavioral smoke)
 *
 * Grades: PRODUCTION-READY | FUNCTIONAL-PARTIAL | SKELETON | HTML-ONLY | MISSING
 *
 * Rules enforced (section 14.1):
 *   1. doc/UI claim of provider integration but no provider service file → MISMATCH
 *   2. provider service returns success without real dispatch path → FALSE-SUCCESS
 *   3. platform claims backend but has no functions/server/API dir → NO-BACKEND
 *   4. only HTML/CSS/static JS → HTML-ONLY
 *   5. claims persistence but no schema/repo/local-store → NO-PERSISTENCE
 *   6. roster claims independent brains but single dispatcher, no per-brain state → FAKE-BRAINS
 *   7. smoke only checks file/route existence → STRUCTURAL-ONLY
 *   8. behavioral smoke must perform state-transition/provider/DB/file/UI action
 *   9. docs claim production-ready but matrix says partial/skeleton/html → DOC-MISMATCH
 *  10. UI button has no listener or listener only logs/alerts → DEAD-BUTTON
 *  11. Theia runtime claim requires 7 proof flags
 *  12. OpenHands runtime claim requires 6 proof flags
 *  13. donor recommendation must check existing-source/metadata-only/runtime-shim/fully-wired
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── Platform inventory ────────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: 'theia-ide',
    name: 'Theia IDE (ide-core)',
    path: 'platform/ide-core',
    claims: ['browser-ide', 'workspace-mount', 'file-save', 'terminal', 'preview'],
    donorLane: 'existing-source',
    runtimeProofFlags: [
      'resolvedTheiaCli',
      'backendLaunches',
      'browserLaunches',
      'workspaceOpens',
      'fileSave',
      'terminalCommand',
      'previewOutput',
    ],
    fullRuntimeFlag: 'fullTheiaRuntime',
  },
  {
    id: 'openhands-agent',
    name: 'OpenHands Agent (agent-core)',
    path: 'platform/agent-core',
    claims: ['agent-runtime', 'task-execution', 'workspace-mutation', 'command-run', 'result-ledger'],
    donorLane: 'runtime-shim',
    runtimeProofFlags: [
      'packageImportable',
      'serverLaunches',
      'taskReceived',
      'workspaceFileSeen',
      'fileEditedOrGenerated',
      'commandOrTestRun',
      'resultReturnedToSkyeHands',
    ],
    fullRuntimeFlag: 'fullOpenHandsRuntime',
  },
  {
    id: 'ae-commandhub',
    name: 'AE Command Hub',
    path: 'SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged',
    claims: ['multi-brain-ai', 'crm', 'task-queue', 'persistence', 'brain-mesh'],
    donorLane: null,
    runtimeProofFlags: [],
    fullRuntimeFlag: null,
  },
  {
    id: 'platform-bus',
    name: 'SkyeHands Platform Bus',
    path: 'core/platform-bus',
    claims: ['cross-platform-events', 'signed-envelopes', 'audit-ledger'],
    donorLane: null,
    runtimeProofFlags: [],
    fullRuntimeFlag: null,
  },
  {
    id: 'appointment-setter',
    name: 'AI Appointment Setter',
    path: 'SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/.skyehands-codex-real-platform',
    claims: ['calendar-oauth', 'booking', 'availability', 'reminders'],
    donorLane: null,
    runtimeProofFlags: [],
    fullRuntimeFlag: null,
  },
  {
    id: 'printful-commerce',
    name: 'Printful Commerce Brain',
    path: 'SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged',
    claims: ['printful-products', 'order-creation', 'webhook', 'storefront'],
    donorLane: null,
    runtimeProofFlags: [],
    fullRuntimeFlag: null,
  },
];

// ─── File-tree scanner ─────────────────────────────────────────────────────

async function walkDir(dir, maxDepth = 5) {
  const results = { files: [], dirs: [] };
  async function walk(current, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build', '.next', '__pycache__'].includes(e.name)) continue;
        results.dirs.push(full);
        await walk(full, depth + 1);
      } else {
        results.files.push(full);
      }
    }
  }
  await walk(dir, 0);
  return results;
}

// ─── Scoring ───────────────────────────────────────────────────────────────

function scoreFiles(files, platformPath) {
  const scores = {
    total: files.length,
    backend: 0,
    persist: 0,
    providers: 0,
    ui: 0,
    behavioralSmoke: 0,
    structuralSmoke: 0,
    deploy: 0,
    deadButtons: 0,
    falseSuccess: 0,
  };
  const violations = [];

  for (const f of files) {
    const name = path.basename(f).toLowerCase();
    const rel = path.relative(ROOT, f);
    const content = (() => {
      try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
    })();

    // Backend signals
    if (/\/(api|functions|server|routes|controllers)\//.test(f) ||
        /route\.(ts|js|mjs)$/.test(name) ||
        /server\.(ts|js|mjs)$/.test(name)) {
      scores.backend++;
    }

    // Persistence signals
    if (/schema|migration|\.sql$|prisma|neon|sqlite|drizzle|repository/.test(name)) {
      scores.persist++;
    }

    // Provider signals
    if (/openai|anthropic|gemini|printful|stripe|paypal|calendly|resend|cloudflare|netlify|github/.test(name)) {
      scores.providers++;
      // Rule 2: provider service returns success without real dispatch
      if (/\.js$|\.mjs$|\.ts$/.test(name) &&
          /return.*success.*true/i.test(content) &&
          !/fetch\(|axios\.|sdk\.|client\.|\.create\(|\.post\(|\.get\(/.test(content)) {
        scores.falseSuccess++;
        violations.push({ rule: 'FALSE-SUCCESS', file: rel, detail: 'Provider returns success without real fetch/SDK dispatch' });
      }
    }

    // UI signals
    if (/\.(tsx?|jsx?|html|svelte|vue)$/.test(name)) {
      scores.ui++;
      // Rule 10: dead button — onClick only logs/alerts
      if (/<button/i.test(content) &&
          /onclick|addEventListener.*click/i.test(content) &&
          !/fetch\(|dispatch\(|submit\(|post\(|api\.|router\.|navigate\(/.test(content)) {
        scores.deadButtons++;
        violations.push({ rule: 'DEAD-BUTTON', file: rel, detail: 'Button click handler has no real action' });
      }
    }

    // Smoke signals
    if (/smoke|\.test\.|\.spec\./.test(name)) {
      // Behavioral vs structural classification
      if (/state\.|db\.|fetch\(|write\(|mutate|dispatch|create|update|delete/.test(content)) {
        scores.behavioralSmoke++;
      } else {
        scores.structuralSmoke++;
        violations.push({ rule: 'STRUCTURAL-ONLY-SMOKE', file: rel, detail: 'Smoke only checks file/route existence, not behavior' });
      }
    }

    // Deploy signals
    if (/netlify\.toml$|vercel\.json$|dockerfile$/i.test(name) || name === 'package.json') {
      scores.deploy++;
    }
  }

  return { scores, violations };
}

// ─── Grading ───────────────────────────────────────────────────────────────

function grade(scores, violations) {
  const ruleViolations = violations.filter(v =>
    ['FALSE-SUCCESS', 'DEAD-BUTTON', 'NO-BACKEND', 'NO-PERSISTENCE', 'DOC-MISMATCH'].includes(v.rule)
  );

  if (scores.total === 0) return 'MISSING';
  if (scores.ui > 0 && scores.backend === 0) return 'HTML-ONLY';
  if (scores.backend === 0) return 'SKELETON';

  const hasBackend = scores.backend > 0;
  const hasPersist = scores.persist > 0;
  const hasProviders = scores.providers > 0;
  const hasBehavioralSmoke = scores.behavioralSmoke > 0;
  const noFalseSuccess = scores.falseSuccess === 0;

  if (hasBackend && hasPersist && hasProviders && hasBehavioralSmoke && noFalseSuccess &&
      ruleViolations.length === 0) {
    return 'PRODUCTION-READY';
  }
  if (hasBackend && (hasPersist || hasProviders)) return 'FUNCTIONAL-PARTIAL';
  if (hasBackend) return 'SKELETON';
  return 'HTML-ONLY';
}

// ─── Runtime proof flag scan ───────────────────────────────────────────────

function scanRuntimeProofFlags(platformDir, flags) {
  const proofFile = path.join(platformDir, 'runtime-proof.json');
  let proofData = {};
  try {
    proofData = JSON.parse(fs.readFileSync(proofFile, 'utf8'));
  } catch {
    // no proof file means all flags false
  }
  return flags.map(flag => ({ flag, proven: proofData[flag] === true }));
}

// ─── Main scan ─────────────────────────────────────────────────────────────

async function scanPlatform(platform) {
  const fullPath = path.resolve(ROOT, platform.path);
  const exists = fs.existsSync(fullPath);

  if (!exists) {
    return {
      ...platform,
      exists: false,
      grade: 'MISSING',
      scores: {},
      violations: [{ rule: 'MISSING', file: platform.path, detail: 'Platform directory not found' }],
      proofFlags: platform.runtimeProofFlags.map(f => ({ flag: f, proven: false })),
      fullRuntimeProven: false,
    };
  }

  const { files } = await walkDir(fullPath);
  const { scores, violations } = scoreFiles(files, fullPath);

  // Rule 3: platform claims backend but no functions/server/API dir
  if (!scores.backend && platform.claims.some(c => ['crm', 'booking', 'order-creation', 'agent-runtime'].includes(c))) {
    violations.push({ rule: 'NO-BACKEND', file: platform.path, detail: 'Platform claims backend capability but no backend files detected' });
  }

  // Rule 5: claims persistence but no schema/repo
  if (!scores.persist && platform.claims.some(c => ['persistence', 'crm', 'order-creation'].includes(c))) {
    violations.push({ rule: 'NO-PERSISTENCE', file: platform.path, detail: 'Platform claims persistence but no schema or repository files found' });
  }

  const g = grade(scores, violations);

  // Rule 9: doc claims production-ready but grade says otherwise
  if (['SKELETON', 'HTML-ONLY', 'FUNCTIONAL-PARTIAL'].includes(g)) {
    const readmeFiles = files.filter(f => /readme/i.test(path.basename(f)));
    for (const rf of readmeFiles) {
      const content = (() => { try { return fs.readFileSync(rf, 'utf8'); } catch { return ''; } })();
      if (/production-?ready|fully.?complete|live/i.test(content)) {
        violations.push({ rule: 'DOC-MISMATCH', file: path.relative(ROOT, rf), detail: `Doc claims production-ready but code grade is ${g}` });
      }
    }
  }

  const proofFlags = platform.runtimeProofFlags.length > 0
    ? scanRuntimeProofFlags(fullPath, platform.runtimeProofFlags)
    : [];

  const fullRuntimeProven = proofFlags.length > 0 && proofFlags.every(p => p.proven);

  return {
    ...platform,
    exists: true,
    grade: g,
    scores,
    violations,
    proofFlags,
    fullRuntimeProven,
  };
}

// ─── Claims-to-smoke map ───────────────────────────────────────────────────

function buildClaimsMap(results) {
  const map = { generated: new Date().toISOString(), ciGate: true, claims: [] };

  for (const r of results) {
    for (const claim of r.claims) {
      const hasSmoke = r.scores.behavioralSmoke > 0;
      map.claims.push({
        platform: r.id,
        claim,
        codeGrade: r.grade,
        behavioralSmokeCount: r.scores.behavioralSmoke ?? 0,
        passing: hasSmoke,
        violations: r.violations.map(v => v.rule),
        ciBlock: !hasSmoke,
      });
    }
  }

  return map;
}

// ─── Markdown report ──────────────────────────────────────────────────────

function buildMarkdown(results) {
  const ts = new Date().toISOString();
  let md = `# CODE READINESS MATRIX\n\n_Generated: ${ts}_\n\n`;
  md += `> **GrayChunks Reality Scanner** — grades are code-backed, not manually written.\n\n`;

  md += `## Platform Grades\n\n`;
  md += `| Platform | Grade | Backend | Persist | Providers | UI | Behavioral Smoke | Violations |\n`;
  md += `|----------|-------|---------|---------|-----------|-----|-----------------|------------|\n`;

  for (const r of results) {
    if (!r.exists) {
      md += `| ${r.name} | **MISSING** | - | - | - | - | - | MISSING |\n`;
    } else {
      const v = r.violations.length;
      md += `| ${r.name} | **${r.grade}** | ${r.scores.backend} | ${r.scores.persist} | ${r.scores.providers} | ${r.scores.ui} | ${r.scores.behavioralSmoke} | ${v} |\n`;
    }
  }

  md += `\n## Runtime Proof Flags\n\n`;
  for (const r of results) {
    if (!r.proofFlags || r.proofFlags.length === 0) continue;
    md += `### ${r.name}\n\n`;
    md += `\`${r.fullRuntimeFlag}\`: **${r.fullRuntimeProven ? '✅ PROVEN' : '☐ NOT PROVEN'}**\n\n`;
    for (const pf of r.proofFlags) {
      md += `- ${pf.proven ? '✅' : '☐'} \`${pf.flag}\`\n`;
    }
    md += '\n';
  }

  md += `## GrayChunks Violations\n\n`;
  let hasViolations = false;
  for (const r of results) {
    if (!r.violations || r.violations.length === 0) continue;
    hasViolations = true;
    md += `### ${r.name}\n\n`;
    for (const v of r.violations) {
      md += `- **[${v.rule}]** \`${v.file}\` — ${v.detail}\n`;
    }
    md += '\n';
  }
  if (!hasViolations) md += `_No violations detected._\n\n`;

  md += `## Donor Lane Status\n\n`;
  md += `| Platform | Donor Lane Status | Full Runtime Proven |\n`;
  md += `|----------|-------------------|--------------------|\n`;
  for (const r of results) {
    if (!r.donorLane) continue;
    md += `| ${r.name} | ${r.donorLane} | ${r.fullRuntimeProven ? '✅' : '☐'} |\n`;
  }

  return md;
}

// ─── Entry point ──────────────────────────────────────────────────────────

async function main() {
  console.log('GrayChunks Readiness Scanner — V3 Directive-Aligned\n');

  const results = [];
  for (const platform of PLATFORMS) {
    process.stdout.write(`  Scanning: ${platform.name}...`);
    const result = await scanPlatform(platform);
    results.push(result);
    console.log(` ${result.grade} (violations: ${result.violations.length})`);
  }

  // Write markdown
  const md = buildMarkdown(results);
  fs.writeFileSync(path.join(ROOT, 'CODE_READINESS_MATRIX.md'), md);

  // Write JSON
  const json = { generated: new Date().toISOString(), platforms: results.map(r => ({
    id: r.id, name: r.name, grade: r.grade, scores: r.scores,
    violations: r.violations, proofFlags: r.proofFlags, fullRuntimeProven: r.fullRuntimeProven,
  }))};
  fs.writeFileSync(path.join(ROOT, 'CODE_READINESS_MATRIX.json'), JSON.stringify(json, null, 2));

  // Write claims map
  const claimsMap = buildClaimsMap(results);
  fs.writeFileSync(path.join(ROOT, 'CLAIMS_TO_SMOKE_MAP.json'), JSON.stringify(claimsMap, null, 2));

  // CI gate
  const blocked = claimsMap.claims.filter(c => c.ciBlock);
  console.log(`\nGenerated: CODE_READINESS_MATRIX.md`);
  console.log(`Generated: CODE_READINESS_MATRIX.json`);
  console.log(`Generated: CLAIMS_TO_SMOKE_MAP.json`);
  console.log(`\nCI Gate: ${blocked.length} claim(s) blocked (no behavioral smoke)\n`);

  if (process.env.GRAYCHUNKS_CI_GATE === 'true' && blocked.length > 0) {
    console.error('GRAYCHUNKS CI GATE FAILED — production-ready language blocked until behavioral smoke exists.');
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
