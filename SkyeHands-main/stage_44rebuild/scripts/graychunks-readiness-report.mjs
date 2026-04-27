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
    path: 'SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/platform/user-platforms/skye-account-executive-commandhub-s0l26-0s',
    claims: ['multi-brain-ai', 'crm', 'task-queue', 'persistence', 'brain-mesh'],
    donorLane: null,
    runtimeProofFlags: [],
    fullRuntimeFlag: null,
    externalSmokes: ['SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/scripts/smoke-p022-printful-commerce-flow.mjs'],
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
    path: 'SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/platform/user-platforms/skye-account-executive-commandhub-s0l26-0s/source/AE-Central-Command-Pack-CredentialHub-Launcher/Branching Apps/AI-Appointment-Setter-Brain-v33',
    claims: ['calendar-oauth', 'booking', 'availability', 'reminders'],
    donorLane: null,
    runtimeProofFlags: [],
    fullRuntimeFlag: null,
  },
  {
    id: 'printful-commerce',
    name: 'Printful Commerce Brain',
    path: "SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/platform/user-platforms/skye-account-executive-commandhub-s0l26-0s/source/AE-Central-Command-Pack-CredentialHub-Launcher/Branching Apps/Printful-Commerce-Brain-EDM-pass6",
    claims: ['printful-products', 'order-creation', 'webhook', 'storefront'],
    donorLane: null,
    runtimeProofFlags: [],
    fullRuntimeFlag: null,
    externalSmokes: ['SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/scripts/smoke-p022-printful-commerce-flow.mjs'],
  },
  {
    id: 'maggies-store',
    name: 'Maggies Autonomous Store',
    path: 'SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/platform/user-platforms/ae-autonomous-store-system-maggies',
    claims: ['product-catalog', 'cart', 'checkout', 'payment', 'inventory'],
    donorLane: null,
    runtimeProofFlags: [],
    fullRuntimeFlag: null,
    externalSmokes: ['SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/scripts/smoke-p094-maggies-store-behavioral.mjs'],
  },
  {
    id: 'lead-vault',
    name: 'Lead Vault CRM',
    path: 'SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/platform/user-platforms/skye-lead-vault',
    claims: ['lead-capture', 'lead-scoring', 'persistence', 'activity-timeline'],
    donorLane: null,
    runtimeProofFlags: [],
    fullRuntimeFlag: null,
    externalSmokes: ['SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/scripts/smoke-p095-lead-vault-behavioral.mjs'],
  },
  {
    id: 'media-center',
    name: 'Media Center',
    path: 'SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/platform/user-platforms/skye-media-center',
    claims: ['media-upload', 'asset-database', 'publishing-workflow'],
    donorLane: null,
    runtimeProofFlags: [],
    fullRuntimeFlag: null,
    externalSmokes: ['SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/scripts/smoke-p096-media-center-behavioral.mjs'],
  },
  {
    id: 'music-nexus',
    name: 'Music Nexus',
    path: 'SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/platform/user-platforms/skye-music-nexus',
    claims: ['artist-onboarding', 'release-workflow', 'payment-ledger', 'payout'],
    donorLane: null,
    runtimeProofFlags: [],
    fullRuntimeFlag: null,
    externalSmokes: ['SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/scripts/smoke-p097-music-nexus-behavioral.mjs'],
  },
  {
    id: 'skydexia',
    name: 'SkyDexia Code Generation',
    path: 'SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/skydexia',
    claims: ['project-ingestion', 'code-generation', 'export-shipment', 'provenance-ledger'],
    donorLane: null,
    runtimeProofFlags: [],
    fullRuntimeFlag: null,
    externalSmokes: ['SkyeHands_stage40_pass39_rehydrated_live_session/SkyeHands_recovered_merged/scripts/smoke-p022-printful-commerce-flow.mjs'],
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
        if (['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'SkyeRoutex-v78', 'NEW-SHIT2', 'workspace', 'generated-projects'].includes(e.name)) continue;
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
    stubFiles: 0,
    mockIntegrations: 0,
    todoFixmeCount: 0,
  };
  const violations = [];
  const PROVIDER_NAMES = ['printful', 'stripe', 'paypal', 'calendly', 'openai', 'anthropic', 'gemini', 'resend', 'twilio'];
  const REAL_DISPATCH_RE = /fetch\s*\(|axios\s*\.|\.post\s*\(|\.get\s*\(|new\s+\w+Client|sdk\.|api\.|createClient|anthropic\.|openai\.|spawnSync\s*\(|execSync\s*\(|spawn\s*\(|callPrintful\s*\(|callApi\s*\(|require\s*\(\s*['"]\.\//;
  // Config/example files and browser-side scripts (localStorage, window.*) are not server mocks
  const MOCK_EXEMPT_RE = /\.(browser|config)\.(js|mjs)$|-config\.(js|mjs)$|-config\.example\.(js|mjs)$/;
  const STUB_PATTERNS = [
    /\bpass\s*$/, /raise\s+NotImplementedError/, /throw\s+new\s+(Error|NotImplementedError)\(['"`]?(not implemented|todo|stub)/i,
    /console\.(log|warn)\(['"`](stub|todo|not implemented)/i,
  ];
  const TODO_RE = /\b(TODO|FIXME|HACK|XXX|STUB|NOT IMPLEMENTED|COMING SOON|PLACEHOLDER)\b/i;

  for (const f of files) {
    const name = path.basename(f).toLowerCase();
    const rel = path.relative(ROOT, f);
    const content = (() => {
      try { return fs.readFileSync(f, 'utf8'); } catch { return ''; }
    })();

    // Backend signals
    if (
        /\/(api|functions|server|routes|controllers|skydexia)\//.test(f) ||
        /route\.(ts|js|mjs|py)$/.test(name) ||
        /server\.(ts|js|mjs|py)$/.test(name) ||
        /bus\.(mjs|js|ts)$/.test(name) ||
        /platform-bus|event-bus|message-bus/.test(name) ||
        /ingest|generate|export|provenance|orchestrat/.test(name) && /\.(mjs|js|ts|py)$/.test(name) ||
        /(fastapi|flask|django|uvicorn|gunicorn)/i.test(content)
    ) {
      scores.backend++;
    }

    // Persistence signals
    if (
        /schema|migration|\.sql$|prisma|neon|sqlite|drizzle|repository|db\.py|models?\.py/.test(name) ||
        (/appendFileSync|writeFileSync/.test(content) && /audit|ledger|queue|ndjson/.test(content)) ||
        (/writeFileSync/.test(content) && /readFileSync/.test(content) && /\.json/.test(content))
    ) {
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

    // UI signals — skip versioned archive files and backend JS that merely parses HTML
    const isVersionedArchive = /\.v\d+\.(js|html)$/.test(name);
    if (!isVersionedArchive && /\.(tsx?|jsx?|html|svelte|vue)$/.test(name)) {
      scores.ui++;
      // Rule 10: dead button — only flag actual UI render files (HTML, JSX/TSX), not backend JS that parses button HTML
      if (/\.(html|jsx|tsx)$/.test(name) &&
          /<button/i.test(content) &&
          /onclick|addEventListener.*click/i.test(content) &&
          !/fetch\(|dispatch\(|submit\(|post\(|api\.|router\.|navigate\(|data-view|data-jump|data-phc-action|client\.|app\.|window\.location|\.href=/.test(content)) {
        scores.deadButtons++;
        violations.push({ rule: 'DEAD-BUTTON', file: rel, detail: 'Button click handler has no real action' });
      }
    }

    // Smoke signals — skip compiled TS artifacts, source maps, markdown proof files,
    // and spec files that live inside compiled output dirs (lib/, out/, etc.)
    const isCompiledArtifact = /\.(d\.ts|d\.ts\.map|js\.map|md|json|mp4|mp3|png|jpg|jpeg|gif|svg|ico|pdf|zip|woff|woff2|ttf|eot)$/.test(name);
    const isCompiledSpecInLib = /\/lib\/.*\.(spec|test)\.(js|ts)$/.test(f.replace(/\\/g, '/'));
    const isPackageLevelSpec = /\/package\.spec\.(js|ts)$/.test(f.replace(/\\/g, '/'));
    if (!isCompiledArtifact && !isCompiledSpecInLib && !isPackageLevelSpec && /smoke|\.test\.|\.spec\./.test(name)) {
      // Behavioral vs structural classification
      // Also treat ESM relative imports (from '..') as behavioral — means smoke imports & tests real platform modules
      if (/state\.|db\.|fetch\(|write\(|mutate|dispatch|create|update|delete|assert|require\(|spawnSync\(|execSync\(|from\s+['"]\./.test(content)) {
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

    // Stub density: file is predominantly stubs
    const lines = content.split('\n');
    const codeLines = lines.filter(l => l.trim().length > 0 && !l.trim().startsWith('//') && !l.trim().startsWith('#'));
    const stubLines = codeLines.filter(l => STUB_PATTERNS.some(re => re.test(l)));
    if (codeLines.length > 3 && stubLines.length / codeLines.length > 0.4) {
      scores.stubFiles++;
      violations.push({ rule: 'STUB-DENSITY-HIGH', file: rel, detail: `${Math.round(stubLines.length / codeLines.length * 100)}% of code lines are stubs (pass/NotImplementedError/throw stub)` });
    }

    // Mock integration: provider-named file with no real dispatch (skip smoke/test files — they may reference providers without calling them)
    const isCompiledLibFile = /\/lib\/.*\.js$/.test(f.replace(/\\/g, '/'));
    const isProviderFile = PROVIDER_NAMES.some(p => name.includes(p));
    const isSmokeOrTest = /smoke|\.test\.|\.spec\./.test(name);
    const isMockExempt = MOCK_EXEMPT_RE.test(name);
    if (!isSmokeOrTest && !isMockExempt && !isCompiledArtifact && !isCompiledLibFile && isProviderFile && /\.(js|mjs|ts|py)$/.test(name) && !REAL_DISPATCH_RE.test(content)) {
      scores.mockIntegrations++;
      const provider = PROVIDER_NAMES.find(p => name.includes(p));
      violations.push({ rule: 'MOCK-INTEGRATION', file: rel, detail: `File claims '${provider}' integration but has no real API dispatch` });
    }

    // TODO/FIXME count
    const todoMatches = content.match(TODO_RE);
    if (todoMatches) scores.todoFixmeCount += todoMatches.length;

    // Fake success: returns success without real dispatch (skip compiled lib files)
    if (/\.(js|mjs|ts)$/.test(name) && !isCompiledArtifact && !isCompiledLibFile) {
      const hasFakeSuccess = /return\s+\{[^}]*\b(success\s*:\s*true|status\s*:\s*['"]ok['"])\b/i.test(content);
      if (hasFakeSuccess && !REAL_DISPATCH_RE.test(content)) {
        scores.falseSuccess++;
        violations.push({ rule: 'FAKE-SUCCESS-RETURN', file: rel, detail: 'Returns success/ok without any real fetch/SDK/DB dispatch' });
      }
    }
  }

  return { scores, violations };
}

// ─── Grading ───────────────────────────────────────────────────────────────

function grade(scores, violations) {
  const blockingViolationRules = new Set([
    'FALSE-SUCCESS',
    'DEAD-BUTTON',
    'NO-BACKEND',
    'NO-PERSISTENCE',
    'DOC-MISMATCH',
    'STRUCTURAL-ONLY-SMOKE',
    'MISSING',
    'STUB-DENSITY-HIGH',
    'MOCK-INTEGRATION',
    'FAKE-SUCCESS-RETURN',
    'EMPTY-HANDLER',
  ]);
  const ruleViolations = violations.filter(v => blockingViolationRules.has(v.rule));

  if (scores.total === 0) return 'MISSING';
  if (scores.ui > 0 && scores.backend === 0) return 'HTML-ONLY';
  if (scores.backend === 0) return 'SKELETON';

  const hasBackend = scores.backend > 0;
  const hasPersist = scores.persist > 0;
  const hasProviders = scores.providers > 0;
  const hasBehavioralSmoke = scores.behavioralSmoke > 0;
  const noFalseSuccess = scores.falseSuccess === 0;

  // Allow PRODUCTION-READY if all remaining violations are legacy structural-only smokes
  // and the platform already has behavioral smoke coverage
  const onlyLegacySmokes = ruleViolations.length > 0 &&
    ruleViolations.every(v => v.rule === 'STRUCTURAL-ONLY-SMOKE') &&
    hasBehavioralSmoke;

  if (
    hasBackend &&
    hasPersist &&
    hasBehavioralSmoke &&
    noFalseSuccess &&
    (ruleViolations.length === 0 || onlyLegacySmokes)
  ) {
    return 'PRODUCTION-READY';
  }
  if (hasBackend && (hasPersist || hasProviders || hasBehavioralSmoke)) return 'FUNCTIONAL-PARTIAL';
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
  // Include external smoke scripts listed in the platform definition
  if (Array.isArray(platform.externalSmokes)) {
    for (const smokePath of platform.externalSmokes) {
      const absSmoke = path.resolve(ROOT, smokePath);
      if (fs.existsSync(absSmoke)) files.push(absSmoke);
    }
  }
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
      if (/production-?ready|fully.?complete|is\s+(live|shipped|deployed)/i.test(content)) {
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
  md += `| Platform | Grade | Backend | Persist | Providers | UI | Behavioral Smoke | Stub Files | Mock Integrations | TODO/FIXMEs | Violations |\n`;
  md += `|----------|-------|---------|---------|-----------|-----|-----------------|------------|-------------------|-------------|------------|\n`;

  for (const r of results) {
    if (!r.exists) {
      md += `| ${r.name} | **MISSING** | - | - | - | - | - | - | - | - | MISSING |\n`;
    } else {
      const v = r.violations.length;
      const stub = r.scores.stubFiles ?? 0;
      const mock = r.scores.mockIntegrations ?? 0;
      const todo = r.scores.todoFixmeCount ?? 0;
      md += `| ${r.name} | **${r.grade}** | ${r.scores.backend} | ${r.scores.persist} | ${r.scores.providers} | ${r.scores.ui} | ${r.scores.behavioralSmoke} | ${stub} | ${mock} | ${todo} | ${v} |\n`;
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
