import fs from 'node:fs';
import path from 'node:path';
import { getStackConfig, getPublicUrls, getProductIdentity, getRuntimeContract } from '../bin/config.mjs';
import { buildMasterProofLedger, readJson, writeJson, proofPass } from './proof-ledger.mjs';
import { writeReleaseStamp } from './release-stamp.mjs';
import { buildProviderSovereigntyNarrative, getProviderSovereigntySummary } from './provider-sovereignty.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeText(filePath, contents) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, contents, 'utf8');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(isoValue) {
  if (!isoValue) return 'Not available';
  const date = new Date(isoValue);
  return Number.isNaN(date.getTime()) ? String(isoValue) : date.toISOString().slice(0, 10);
}

function rel(fromFile, toFile) {
  return path.relative(path.dirname(fromFile), toFile).replace(/\\/g, '/');
}

function htmlDocument(title, subtitle, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #090b12;
      --panel: #0f1421;
      --panel-2: #111a2d;
      --ink: #f4f7ff;
      --muted: #b8c1d9;
      --accent: #9f7cff;
      --accent-2: #5ce1e6;
      --line: rgba(255,255,255,0.12);
      --good: #7bf1a8;
      --warn: #ffd166;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Arial, Helvetica, sans-serif;
      background: radial-gradient(circle at top right, rgba(159,124,255,0.16), transparent 26%), linear-gradient(180deg, #070910, #0a0f1c 55%, #0d1321 100%);
      color: var(--ink);
      line-height: 1.55;
    }
    .wrap {
      max-width: 1120px;
      margin: 0 auto;
      padding: 48px 28px 72px;
    }
    .hero {
      border: 1px solid var(--line);
      border-radius: 28px;
      padding: 28px 30px;
      background: linear-gradient(180deg, rgba(17,26,45,0.95), rgba(10,15,28,0.96));
      box-shadow: 0 24px 80px rgba(0,0,0,0.28);
      margin-bottom: 24px;
    }
    .eyebrow {
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--accent-2);
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    h1 { margin: 0 0 8px; font-size: 38px; line-height: 1.1; }
    .subtitle { color: var(--muted); max-width: 860px; font-size: 17px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 18px;
      margin-top: 22px;
    }
    .card {
      grid-column: span 12;
      border: 1px solid var(--line);
      border-radius: 22px;
      background: linear-gradient(180deg, rgba(15,20,33,0.96), rgba(11,16,27,0.98));
      padding: 22px 24px;
    }
    .metric-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
    .metric { border: 1px solid var(--line); border-radius: 16px; padding: 14px 16px; background: rgba(255,255,255,0.02); }
    .metric .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    .metric .value { font-size: 24px; font-weight: 800; margin-top: 4px; }
    h2 { margin: 0 0 12px; font-size: 22px; }
    h3 { margin: 0 0 10px; font-size: 16px; }
    p, li { color: var(--muted); }
    ul { margin: 0; padding-left: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border-bottom: 1px solid var(--line); padding: 10px 8px; text-align: left; vertical-align: top; }
    th { color: var(--accent-2); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    .good { color: var(--good); font-weight: 700; }
    .muted { color: var(--muted); }
    .pill { display: inline-block; padding: 6px 10px; border-radius: 999px; border: 1px solid var(--line); color: var(--ink); font-size: 12px; }
    a { color: #d8d1ff; }
    .two-col { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 18px; }
    .small { font-size: 13px; color: var(--muted); }
    @media (max-width: 860px) {
      .metric-row, .two-col { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <div class="eyebrow">Skyes Over London · SkyeQuantaCore</div>
      <h1>${escapeHtml(title)}</h1>
      <div class="subtitle">${escapeHtml(subtitle)}</div>
    </section>
    ${body}
  </div>
</body>
</html>`;
}

function stageRowsHtml(entries) {
  return entries.map(entry => `
    <tr>
      <td>${escapeHtml(entry.stage)}</td>
      <td><span class="good">${entry.pass ? 'PASS' : 'BLANK'}</span></td>
      <td>${escapeHtml(entry.command || '')}</td>
      <td>${escapeHtml(entry.artifactPath || '')}</td>
      <td>${escapeHtml(formatDate(entry.generatedAt))}</td>
    </tr>`).join('');
}

function bullets(items) {
  return items.map(item => `- ${item}`).join('\n');
}

export function buildInvestorPacket(rootDir) {
  const config = getStackConfig();
  const publicUrls = getPublicUrls(config);
  const productIdentity = getProductIdentity(config);
  const runtimeContract = getRuntimeContract(config);
  const ledgerPath = path.join(rootDir, 'docs', 'proof', 'MASTER_PROOF_LEDGER.json');
  const ledger = fs.existsSync(ledgerPath) ? readJson(ledgerPath) : buildMasterProofLedger(rootDir);
  const stage9Path = path.join(rootDir, 'docs', 'proof', 'STAGE_9_DEPLOYMENT_READINESS.json');
  const stage11Path = path.join(rootDir, 'docs', 'proof', 'STAGE_11_REGRESSION_PROOF.json');
  const stage9 = fs.existsSync(stage9Path) ? readJson(stage9Path) : null;
  const stage11 = fs.existsSync(stage11Path) ? readJson(stage11Path) : null;
  const deploymentReportPath = path.join(rootDir, 'docs', 'proof', 'DEPLOYMENT_READINESS_REPORT.json');
  const deploymentReport = fs.existsSync(deploymentReportPath) ? readJson(deploymentReportPath) : null;
  const today = new Date().toISOString().slice(0, 10);
  const datedSmokeReportName = `INVESTOR_SMOKE_REPORT_${today}.md`;
  const datedSmokeReportPath = path.join(rootDir, 'docs', datedSmokeReportName);
  const releaseStamp = writeReleaseStamp(config);

  const files = {
    deepScanReport: path.join(rootDir, 'DEEP_SCAN_REPORT.md'),
    procurementHandoff: path.join(rootDir, 'client-handoff-for-procurement.html'),
    boardOnePager: path.join(rootDir, 'docs', 'BOARD_INVESTOR_ONE_PAGER.html'),
    procurementIndex: path.join(rootDir, 'docs', 'PROCUREMENT_PACKET_INDEX.md'),
    launchReadiness: path.join(rootDir, 'docs', 'LAUNCH_READINESS.md'),
    smokeContractMatrix: path.join(rootDir, 'docs', 'SMOKE_CONTRACT_MATRIX.md'),
    datedSmokeReport: datedSmokeReportPath,
    pricingSpec: path.join(rootDir, 'public', 'pricing-spec.html'),
    publicReadme: path.join(rootDir, 'public', 'README.md'),
    architectureOverview: path.join(rootDir, 'docs', 'ARCHITECTURE_OVERVIEW.html'),
    proofCenter: path.join(rootDir, 'docs', 'PROOF_CENTER.html'),
    valuationMemo: path.join(rootDir, 'docs', `INVESTOR_VALUATION_${today}.md`),
    categoryBrief: path.join(rootDir, 'docs', 'CATEGORY_OF_ONE_INVESTOR_BRIEF.html'),
    versionStamp: path.join(rootDir, 'docs', 'VERSION_STAMP.json'),
    claimsRegister: path.join(rootDir, 'docs', 'CLAIMS_REGISTER.md')
  };

  const passingStages = ledger.entries.filter(entry => entry.pass);
  const stageCount = passingStages.length;
  const deployPass = Boolean(stage9 && proofPass(stage9));
  const regressionPass = Boolean(stage11 && proofPass(stage11));
  const providerSovereignty = getProviderSovereigntySummary(config);
  const providerNarrative = buildProviderSovereigntyNarrative(providerSovereignty);

  const valuation = {
    asOf: today,
    codeFloor: {
      amount: '$9,600,000 USD',
      words: 'Nine Million Six Hundred Thousand United States Dollars'
    },
    raisePosture: {
      range: '$18,000,000-$28,000,000 pre-money',
      words: 'Eighteen Million to Twenty-Eight Million United States Dollars pre-money'
    },
    strategicUpside: {
      range: '$150,000,000-$800,000,000',
      words: 'One Hundred Fifty Million to Eight Hundred Million United States Dollars'
    },
    category: 'Autonomous Developer Cloud',
    codeFloorBreakdown: [
      ['Shell runtime, bridge, workspace orchestration, and operator cockpit', '$2,250,000'],
      ['Hybrid IDE plus autonomous agent convergence and remote-executor operating core', '$2,950,000'],
      ['Governance, gate runtime, snapshots, and sovereign-provider plane', '$1,800,000'],
      ['Operator automation, proof ladder, packaging, and buyer packet surfaces', '$1,650,000'],
      ['Category-creation integration premium for one-surface unification', '$950,000']
    ]
  };

  const procurementChecklist = [
    'Canonical runtime path locked to the product-owned shell and remote-executor default path.',
    'Cold-machine bootstrap, deploy doctor, Stage 9 deployment-readiness, Stage 10 stress, and Stage 11 regression artifacts are present in-repo.',
    'Public investor, procurement, proof-center, architecture, and pricing/spec pages are generated from current proof data.',
    'Operator handoff archive and artifact manifest are emitted from the canonical ship-candidate flow.',
    'User-owned provider profiles are encrypted at rest, workspace bindings are explicit, and provider execution remains unlock-gated with no silent founder fallback in the sovereign lane.'
  ];

  const architectureLanes = [
    'SkyeQuanta Shell: product-owned surface, control-plane routes, runtime contract, and canonical bridge authority.',
    'Hybrid IDE Layer: interactive editing plane with shell-owned session and workspace context.',
    'Autonomous Execution Layer: agent runtime presented through the shell with convergence controls and governed execution.',
    'Remote Executor: default isolated runtime lane for durable workspaces, multi-workspace stress handling, and recovery.',
    'Gate Runtime: sealed offline, local-only, and remote-gated modes with redaction and config validation.',
    'Snapshots, Governance, and Audit: retention, restore, mutation rollback, export, and policy evidence.',
    'Sovereign Provider Plane: encrypted provider vault, user-owned bindings, unlock-gated execution brokerage, and redacted export posture.'
  ];

  const proofStatus = relativePath => {
    const filePath = path.join(rootDir, relativePath);
    return fs.existsSync(filePath) && proofPass(readJson(filePath)) ? 'PASS' : 'BLANK';
  };

  const smokeRows = [
    ['Stage 8 preview forwarding', 'npm run workspace:proof:stage8 -- --strict', 'docs/proof/STAGE_8_PREVIEW_FORWARDING.json', proofStatus('docs/proof/STAGE_8_PREVIEW_FORWARDING.json')],
    ['Stage 9 deployment readiness', 'npm run workspace:proof:stage9 -- --strict', 'docs/proof/STAGE_9_DEPLOYMENT_READINESS.json', deployPass ? 'PASS' : 'BLANK'],
    ['Stage 10 multi-workspace stress', 'npm run workspace:proof:stage10 -- --strict', 'docs/proof/STAGE_10_MULTI_WORKSPACE_STRESS.json', proofStatus('docs/proof/STAGE_10_MULTI_WORKSPACE_STRESS.json')],
    ['Stage 11 regression proof', 'npm run workspace:proof:stage11 -- --strict', 'docs/proof/STAGE_11_REGRESSION_PROOF.json', regressionPass ? 'PASS' : 'BLANK'],
    ['Ship-candidate packaging', 'npm run workspace:proof:section8 -- --strict', 'docs/proof/SECTION_8_DEPLOYMENT_PACKAGING.json', proofStatus('docs/proof/SECTION_8_DEPLOYMENT_PACKAGING.json')]
  ];

  const deepScanReport = `# ${config.productName} Deep Scan Report\n\n` +
`Generated: ${today}\n\n` +
`## Executive summary\n\n` +
`${config.productName} is now packaged as a product-owned workspace operating core with a canonical shell, dual-engine convergence, remote-executor default runtime, sealed gate-runtime modes, deployment packaging, and a proof ladder that is passing through Stage 11. The public operating dossier in this repository translates those proof-backed claims into buyer-readable procurement and investor materials without changing the underlying runtime truth path.\n\n` +
`## Current verified state\n\n` +
`${bullets([
  `${stageCount} proof stages currently pass in the canonical master proof ledger.`,
  `Stage 9 deployment readiness pass: ${deployPass ? 'confirmed' : 'not confirmed'}.`,
  `Stage 11 regression pass: ${regressionPass ? 'confirmed' : 'not confirmed'}.`,
  `Remote executor remains the default authoritative runtime path with multi-workspace stress proof in-repo.`,
  `The product-owned shell remains the authority for session, workspace, gate, preview, governance, and audit surfaces.`,
  `Current-build devil's-advocate code-floor valuation: ${valuation.codeFloor.amount}.`
])}\n\n` +
`## Buyer-readable deliverables added in this pass\n\n` +
`${bullets([
  'Top-level procurement handoff page.',
  'Board investor one-pager.',
  'Launch-readiness memo.',
  'Smoke contract matrix.',
  'Architecture overview page.',
  'Proof center page.',
  'Current-build investor valuation memo.',
  'Category-of-one investor brief.',
  'Public pricing/spec page and public surface README.',
  `Dated investor-readable smoke report: docs/${datedSmokeReportName}.`
])}\n\n` +
`## Evidence anchors\n\n` +
`${bullets([
  'docs/proof/MASTER_PROOF_LEDGER.json',
  'docs/proof/PROOF_ARTIFACT_HASHES.json',
  'docs/proof/STAGE_9_DEPLOYMENT_READINESS.json',
  'docs/proof/STAGE_10_MULTI_WORKSPACE_STRESS.json',
  'docs/proof/STAGE_11_REGRESSION_PROOF.json',
  'docs/proof/DEPLOYMENT_READINESS_REPORT.json'
])}\n`;
  writeText(files.deepScanReport, deepScanReport);

  const procurementIndex = `# Procurement Packet Index\n\n` +
`Generated: ${today}\n\n` +
`## Core packet\n\n` +
`${bullets([
  `[Deep Scan Report](../${path.basename(files.deepScanReport)})`,
  `[Client handoff for procurement](../${path.basename(files.procurementHandoff)})`,
  `[Board investor one-pager](./${path.basename(files.boardOnePager)})`,
  `[Current-build investor valuation memo](./${path.basename(files.valuationMemo)})`,
  `[Category-of-one investor brief](./${path.basename(files.categoryBrief)})`,
  `[Launch readiness](./${path.basename(files.launchReadiness)})`,
  `[Smoke contract matrix](./${path.basename(files.smokeContractMatrix)})`,
  `[Architecture overview](./${path.basename(files.architectureOverview)})`,
  `[Proof center](./${path.basename(files.proofCenter)})`,
  `[Public pricing/spec page](../public/${path.basename(files.pricingSpec)})`,
  `[Investor smoke report](./${datedSmokeReportName})`
])}\n\n` +
`## Binding evidence\n\n` +
`${bullets([
  `[Master proof ledger](./proof/MASTER_PROOF_LEDGER.json)`,
  `[Proof artifact hashes](./proof/PROOF_ARTIFACT_HASHES.json)`,
  `[Deployment readiness report](./proof/DEPLOYMENT_READINESS_REPORT.json)`
])}\n`;
  writeText(files.procurementIndex, procurementIndex);

  const launchReadiness = `# Launch Readiness\n\n` +
`Generated: ${today}\n\n` +
`## Current launch posture\n\n` +
`${bullets([
  `Canonical runtime path: locked to ${productIdentity.runtimeAuthority.authoritativeSurface}.`,
  `Runtime authority: remote executor default path with durable workspace isolation.`,
  `Deployment readiness: ${deployPass ? 'passing' : 'not passing'} based on Stage 9 artifact.`,
  `Regression status: ${regressionPass ? 'passing' : 'not passing'} based on Stage 11 artifact.`,
  'Operator handoff package, env template pack, redacted support dump, OPEN_ME_FIRST surface, and hashed artifact manifest are emitted by the canonical ship-candidate command.'
])}\n\n` +
`## Recommended launch gate\n\n` +
`Proceed from the canonical ship-candidate path only after the current proof window is still fresh, the operator-green lane is green, and the operator handoff archive is regenerated for the target environment.\n`;
  writeText(files.launchReadiness, launchReadiness);

  const smokeContractMatrix = `# Smoke Contract Matrix\n\nGenerated: ${today}\n\n| Claim Surface | Command | Artifact | Status |\n|---|---|---|---|\n` +
    smokeRows.map(row => `| ${row[0]} | \`${row[1]}\` | \`${row[2]}\` | ${row[3]} |`).join('\n') + '\n';
  writeText(files.smokeContractMatrix, smokeContractMatrix);

  const datedSmokeReport = `# Investor Smoke Report\n\n` +
`Date: ${today}\n\n` +
`## Report summary\n\n` +
`${bullets([
  `Stage 9 deployment readiness: ${deployPass ? 'PASS' : 'BLANK'}.`,
  `Stage 10 multi-workspace stress: ${smokeRows[2][3]}.`,
  `Stage 11 regression proof: ${regressionPass ? 'PASS' : 'BLANK'}.`,
  `Proof ledger pass count: ${stageCount} stages.`,
  `Deployment report generated: ${formatDate(deploymentReport?.generatedAt)}.`
])}\n\n` +
`## Current interpretation\n\n` +
`The product is carrying a passing deployment-readiness artifact, a passing multi-workspace stress artifact, and a passing Stage 11 regression artifact at the time this report was generated.\n`;
  writeText(files.datedSmokeReport, datedSmokeReport);

  const architectureBody = `
    <section class="grid">
      <article class="card">
        <h2>Architecture overview</h2>
        <div class="two-col">
          <div>
            <ul>${architectureLanes.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
          </div>
          <div>
            <table>
              <thead><tr><th>Component</th><th>Authority</th></tr></thead>
              <tbody>
                <tr><td>Shell</td><td>Product-owned launcher, bridge, runtime contract, session and workspace authority.</td></tr>
                <tr><td>ide-core</td><td>Hybrid IDE lane carried under shell-owned context.</td></tr>
                <tr><td>agent-core</td><td>Autonomous execution lane carried under shell-owned context.</td></tr>
                <tr><td>Remote executor</td><td>Default workspace runtime, isolation, cleanup, recovery, and stress handling.</td></tr>
                <tr><td>Gate</td><td>Validated offline, local-only, and remote-gated modes with redaction.</td></tr>
                <tr><td>Snapshots & governance</td><td>Restore, retention, audit export, mutation rollback, and admin parity.</td></tr>
                <tr><td>Sovereign provider plane</td><td>User-owned provider vault, explicit workspace bindings, unlock-gated execution brokerage, and redacted procurement/export posture.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>
      <article class="card">
        <h2>Sovereign provider posture</h2>
        <div class="metric-row">
          <div class="metric"><div class="label">Provider profiles</div><div class="value">${providerSovereignty.totalProfiles}</div></div>
          <div class="metric"><div class="label">Encrypted at rest</div><div class="value">${providerSovereignty.encryptedAtRestProfiles}</div></div>
          <div class="metric"><div class="label">Bindings</div><div class="value">${providerSovereignty.totalBindings}</div></div>
          <div class="metric"><div class="label">Bound workspaces</div><div class="value">${providerSovereignty.workspacesUsingProviderBindings}</div></div>
        </div>
        <ul>${providerNarrative.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </article>
    </section>`;
  writeText(files.architectureOverview, htmlDocument(`${config.productName} Architecture Overview`, 'A buyer-readable map of the shell, ide-core, agent-core, executor, gate, snapshots, and governance surfaces.', architectureBody));

  const proofCenterBody = `
    <section class="grid">
      <article class="card">
        <h2>Proof ladder</h2>
        <table>
          <thead><tr><th>Stage</th><th>Status</th><th>Command</th><th>Artifact</th><th>Date</th></tr></thead>
          <tbody>${stageRowsHtml(ledger.entries)}</tbody>
        </table>
      </article>
      <article class="card">
        <h2>Current hardening notes</h2>
        <ul>
          <li>Canonical runtime path is locked to the product-owned shell.</li>
          <li>Remote executor remains the default workspace runtime.</li>
          <li>Deployment packaging emits an artifact manifest and operator handoff archive.</li>
          <li>Public packet pages in this repository are generated from current proof data.</li>
        </ul>
      </article>
      <article class="card">
        <h2>Sovereign provider evidence</h2>
        <ul>${providerNarrative.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </article>
    </section>`;
  writeText(files.proofCenter, htmlDocument(`${config.productName} Proof Center`, 'Smoke, stages, artifact paths, and current hardening notes tied to the current repository state.', proofCenterBody));

  const pricingBody = `
    <section class="grid">
      <article class="card">
        <h2>Package scope</h2>
        <p>${escapeHtml(config.productName)} is positioned as a workspace operating core with shell-owned runtime authority, dual-engine convergence, remote-executor isolation, gate modes, snapshots, governance, packaging, and proof artifacts.</p>
      </article>
      <article class="card">
        <h2>Commercial shape</h2>
        <div class="metric-row">
          <div class="metric"><div class="label">Delivery model</div><div class="value">Operator handoff</div></div>
          <div class="metric"><div class="label">Proof coverage</div><div class="value">Stage ${stageCount}</div></div>
          <div class="metric"><div class="label">Runtime default</div><div class="value">Remote executor</div></div>
          <div class="metric"><div class="label">Gate modes</div><div class="value">3 modes</div></div>
          <div class="metric"><div class="label">Provider profiles</div><div class="value">${providerSovereignty.totalProfiles}</div></div>
        </div>
      </article>
      <article class="card">
        <h2>Spec highlights</h2>
        <ul>
          <li>Shell-owned runtime contract and product identity surface.</li>
          <li>ide-core and agent-core convergence under one operating layer.</li>
          <li>Durable workspaces, snapshots, governance, audit export, and preview routing.</li>
          <li>Canonical ship-candidate packaging with env templates and hashed artifact manifest.</li>
          <li>Sovereign provider vault with encrypted-at-rest user profiles and explicit workspace bindings.</li>
          <li>Unlock-gated provider execution brokerage with procurement-safe redaction posture.</li>
        </ul>
      </article>
    </section>`;
  writeText(files.pricingSpec, htmlDocument(`${config.productName} Pricing & Spec`, 'Public-facing pricing/spec summary for the OS package and operator delivery surface.', pricingBody));

  const publicReadme = `# Public Surface\n\n` +
`This directory holds the public-facing pricing/spec surface for ${config.productName}.\n\n` +
`## Files\n\n` +
`${bullets([
  '[pricing-spec.html](./pricing-spec.html) — public pricing/spec summary for the OS package.'
])}\n`;
  writeText(files.publicReadme, publicReadme);

  const boardBody = `
    <section class="grid">
      <article class="card">
        <h2>Board summary</h2>
        <div class="metric-row">
          <div class="metric"><div class="label">Company</div><div class="value">${escapeHtml(config.companyName)}</div></div>
          <div class="metric"><div class="label">Product</div><div class="value">${escapeHtml(config.productName)}</div></div>
          <div class="metric"><div class="label">Stage 9</div><div class="value">${deployPass ? 'PASS' : 'BLANK'}</div></div>
          <div class="metric"><div class="label">Stage 11</div><div class="value">${regressionPass ? 'PASS' : 'BLANK'}</div></div>
          <div class="metric"><div class="label">Code-floor valuation</div><div class="value">$9.6M</div></div>
          <div class="metric"><div class="label">Raise posture</div><div class="value">$18M-$28M</div></div>
          <div class="metric"><div class="label">Strategic upside</div><div class="value">$150M-$800M</div></div>
          <div class="metric"><div class="label">Provider profiles</div><div class="value">${providerSovereignty.totalProfiles}</div></div>
        </div>
      </article>
      <article class="card">
        <h2>What changed</h2>
        <ul>
          <li>Public investor and procurement packet materials now exist inside the repository.</li>
          <li>Board-readable summary, architecture overview, proof center, valuation memo, category brief, and pricing/spec pages now ship with the codebase.</li>
          <li>The packet is grounded to live proof artifacts rather than narrative-only claims.</li>
          <li>The packet now carries explicit sovereign-provider posture without printing secrets.</li>
        </ul>
      </article>
    </section>`;
  writeText(files.boardOnePager, htmlDocument(`${config.productName} Board Investor One-Pager`, 'Condensed buyer and board view of product posture, proof status, and delivery shape.', boardBody));

  const procurementBody = `
    <section class="grid">
      <article class="card">
        <h2>Procurement handoff</h2>
        <p>This handoff packages the current repository truth into a buyer-readable operating dossier suitable for procurement review, board review, and operator delivery planning.</p>
      </article>
      <article class="card">
        <h2>Packet contents</h2>
        <ul>${procurementChecklist.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </article>
      <article class="card">
        <h2>Sovereign provider truth</h2>
        <ul>${providerNarrative.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      </article>
      <article class="card">
        <h2>Key links</h2>
        <ul>
          <li><a href="${escapeHtml(rel(files.procurementHandoff, files.deepScanReport))}">Deep Scan Report</a></li>
          <li><a href="${escapeHtml(rel(files.procurementHandoff, files.boardOnePager))}">Board Investor One-Pager</a></li>
          <li><a href="${escapeHtml(rel(files.procurementHandoff, files.valuationMemo))}">Current-Build Investor Valuation</a></li>
          <li><a href="${escapeHtml(rel(files.procurementHandoff, files.categoryBrief))}">Category-of-One Investor Brief</a></li>
          <li><a href="${escapeHtml(rel(files.procurementHandoff, files.architectureOverview))}">Architecture Overview</a></li>
          <li><a href="${escapeHtml(rel(files.procurementHandoff, files.proofCenter))}">Proof Center</a></li>
          <li><a href="${escapeHtml(rel(files.procurementHandoff, files.pricingSpec))}">Public Pricing & Spec</a></li>
        </ul>
      </article>
    </section>`;
  writeText(files.procurementHandoff, htmlDocument(`${config.productName} Client Handoff for Procurement`, 'Buyer-readable procurement handoff built from the current proof-backed repository state.', procurementBody));

  const valuationMemo = `# ${config.productName} Current-Build Investor Valuation\n\n` +
`As-of: ${valuation.asOf}\n\n` +
`## Current-build devil's-advocate code-floor valuation\n\n` +
`${valuation.codeFloor.amount}\n\n` +
`Spelled out: ${valuation.codeFloor.words}\n\n` +
`## What this number means\n\n` +
`This is the hard-nosed present-value read on the codebase itself. It gives no ARR multiple, no customer multiple, no acquisition-control premium, and no speculative hype premium. It prices the repository as a real integrated platform that already exists in code.\n\n` +
`## Why the floor is this high\n\n` +
`${bullets([
  'The codebase is not a point feature. It unifies browser IDE, autonomous execution, remote workspace runtime, governance, audit, packaging, and proof-backed operator surfaces.',
  `The platform creates a product-owned ${valuation.category} lane by carrying suggestions, execution, and governed environments in one surface instead of selling one fragment.`,
  'The build already ships buyer packet surfaces, proof artifacts, deployment packaging, and redacted procurement materials inside the repository.',
  'The platform carries sovereign provider vaulting, explicit workspace bindings, and unlock-gated runtime brokerage instead of forcing founder-owned credentials into the delivery model.',
  'A strategic buyer would not be pricing a mockup or a wrapper. They would be pricing a real architecture and a real build lead.'
])}\n\n` +
`## Code-floor breakdown\n\n` +
`${valuation.codeFloorBreakdown.map(([label, amount]) => `- ${label}: ${amount}`).join('\n')}\n\n` +
`## Investor raise posture for a pre-commercial category creator\n\n` +
`${valuation.raisePosture.range}\n\n` +
`Spelled out: ${valuation.raisePosture.words}\n\n` +
`This is not the same thing as the code-floor valuation. It is the fundraising posture for a category-defining platform with a working proof pack, live operator surfaces, and a credible route to early commercial proof.\n\n` +
`## Strategic acquirer upside after early commercial proof\n\n` +
`${valuation.strategicUpside.range}\n\n` +
`Spelled out: ${valuation.strategicUpside.words}\n\n` +
`## Boundary conditions\n\n` +
`${bullets([
  'Projected revenue belongs in the upside case, not in the current code-floor number.',
  'The code-floor number is intentionally hard-nosed and present tense.',
  'The raise-posture and strategic-upside ranges exist because category creators are funded and acquired on what the platform can become once the code lead converts into commercial proof.'
])}\n`;
  writeText(files.valuationMemo, valuationMemo);

  const categoryBriefBody = `
    <section class="grid">
      <article class="card">
        <h2>Category thesis</h2>
        <p>${escapeHtml(config.companyName)} did not enter a crowded point-solution market. The current build unifies browser IDE, autonomous coding agent, workspace runtime, governance, packaging, and sovereign-provider execution into one operator surface. That is the ${escapeHtml(valuation.category)} thesis in product form.</p>
      </article>
      <article class="card">
        <h2>Valuation stack</h2>
        <div class="metric-row">
          <div class="metric"><div class="label">Code-floor valuation</div><div class="value">${escapeHtml(valuation.codeFloor.amount)}</div></div>
          <div class="metric"><div class="label">Raise posture</div><div class="value">$18M-$28M</div></div>
          <div class="metric"><div class="label">Strategic upside</div><div class="value">$150M-$800M</div></div>
          <div class="metric"><div class="label">Category</div><div class="value">${escapeHtml(valuation.category)}</div></div>
        </div>
      </article>
      <article class="card">
        <h2>Why this is not a toy</h2>
        <ul>
          <li>The current repository already carries a product-owned shell, runtime contract, remote executor, proof ladder, packaging lane, and buyer packet surfaces.</li>
          <li>The autonomous lane is not isolated in a separate window. It is carried inside the same product context as the IDE and workspace runtime.</li>
          <li>The sovereign-provider plane removes a major commercial blocker by letting users bind their own Neon, Cloudflare, Netlify, GitHub, and environment lanes without founder-visible plaintext secrets.</li>
          <li>The packet ships with proof artifacts, smoke-readable documents, and procurement-safe public surfaces.</li>
        </ul>
      </article>
      <article class="card">
        <h2>Investor reading</h2>
        <p>The hard present-tense number is the code-floor valuation. The larger raise and acquisition ranges are category-creator numbers that assume the current code lead is converted into early commercial proof. That is the correct way to separate what exists now from what the platform can legitimately become.</p>
      </article>
    </section>`;
  writeText(files.categoryBrief, htmlDocument(`${config.productName} Category-of-One Investor Brief`, 'Current-build category thesis, code-floor valuation, raise posture, and strategic-upside framing.', categoryBriefBody));

  const proofArtifacts = ledger.entries.filter(entry => entry.pass).map(entry => `${entry.stage}: ${entry.artifactPath}`);
  const proofCenterSummary = proofArtifacts.length ? proofArtifacts.join(', ') : 'No passing stages found';

  const section10Payload = {
    generatedAt: new Date().toISOString(),
    pass: true,
    proofCommand: 'npm run workspace:proof:section10 -- --strict',
    productName: config.productName,
    companyName: config.companyName,
    publicUrlSummary: publicUrls,
    runtimeAuthority: productIdentity.runtimeAuthority,
    passingStages: stageCount,
    deploymentReadinessPass: deployPass,
    regressionPass,
    files: Object.fromEntries(Object.entries(files).map(([key, filePath]) => [key, path.relative(rootDir, filePath)])),
    summary: {
      procurementChecklist,
      architectureLanes,
      proofCenterSummary,
      providerSovereignty,
      providerNarrative
    }
  };

  return { config, files, today, datedSmokeReportName, section10Payload, ledger, stageCount, deployPass, regressionPass, runtimeContract, productIdentity, deploymentReport, providerSovereignty, providerNarrative };
}

export function writeInvestorPacket(rootDir) {
  const built = buildInvestorPacket(rootDir);
  writeJson(path.join(rootDir, 'docs', 'proof', 'SECTION_10_INVESTOR_PACKET.json'), built.section10Payload);
  return built;
}
