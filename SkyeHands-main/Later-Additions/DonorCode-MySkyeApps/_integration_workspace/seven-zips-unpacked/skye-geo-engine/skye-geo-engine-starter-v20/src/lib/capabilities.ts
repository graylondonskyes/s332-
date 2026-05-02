export type CapabilityStep = {
  step: number;
  title: string;
  action: string;
  output: string;
  routes: string[];
  controls: string[];
};

export type CapabilityModule = {
  id: string;
  title: string;
  audience: string;
  purpose: string;
  outcome: string;
  routes: string[];
  controls: string[];
  smokeScripts: string[];
  proofPoints: string[];
  walkthrough: CapabilityStep[];
};

function createModules(): CapabilityModule[] {
  return [
    {
      id: 'foundation',
      title: 'Workspace foundation',
      audience: 'operators',
      purpose: 'Create the tenant context that every later audit, article, publish run, replay, and evidence export will attach to.',
      outcome: 'A real workspace and project ledger with history readback.',
      routes: ['GET /v1/workspaces', 'POST /v1/workspaces', 'GET /v1/projects', 'POST /v1/projects', 'GET /v1/history'],
      controls: ['create-workspace', 'list-workspaces', 'create-project', 'list-projects', 'run-history'],
      smokeScripts: ['scripts/smoke-api.mjs', 'scripts/smoke-browser-ui.mjs', 'scripts/smoke-real-browser.py'],
      proofPoints: ['workspace create', 'project create', 'history readback'],
      walkthrough: [
        { step: 1, title: 'Create workspace', action: 'Create an org-scoped workspace with brand and niche context.', output: 'A persisted workspace id.', routes: ['POST /v1/workspaces'], controls: ['create-workspace'] },
        { step: 2, title: 'Create project', action: 'Create a project inside that workspace so audits, articles, and publishes stay grouped.', output: 'A persisted project id.', routes: ['POST /v1/projects'], controls: ['create-project'] },
        { step: 3, title: 'Verify ledger', action: 'Load workspace history after work runs.', output: 'A joined record of projects, jobs, content, publish runs, visibility runs, and evidence.', routes: ['GET /v1/history'], controls: ['run-history'] }
      ]
    },
    {
      id: 'audit',
      title: 'Technical GEO audit',
      audience: 'operators and agencies',
      purpose: 'Inspect a live page for crawlability, metadata, schema, thin-content risk, and operator-grade readiness.',
      outcome: 'A persisted audit run with exportable evidence.',
      routes: ['POST /v1/audit/site', 'POST /v1/evidence/export'],
      controls: ['run-audit', 'export-audit'],
      smokeScripts: ['scripts/smoke-api.mjs', 'scripts/smoke-browser-ui.mjs'],
      proofPoints: ['live audit run', 'audit evidence export'],
      walkthrough: [
        { step: 1, title: 'Run audit', action: 'Submit a live target URL.', output: 'A scored audit result stored in history.', routes: ['POST /v1/audit/site'], controls: ['run-audit'] },
        { step: 2, title: 'Export evidence', action: 'Export the audit proof pack.', output: 'A stored evidence export record.', routes: ['POST /v1/evidence/export'], controls: ['export-audit'] }
      ]
    },
    {
      id: 'research',
      title: 'Research and source ledger',
      audience: 'operators and editorial teams',
      purpose: 'Normalize URLs and raw text into a deduped evidence ledger so later claims point to real sources.',
      outcome: 'A workspace-scoped source ledger with dedupe.',
      routes: ['GET /v1/research', 'POST /v1/research'],
      controls: ['run-research', 'list-research'],
      smokeScripts: ['scripts/smoke-api.mjs', 'scripts/smoke-browser-ui.mjs', 'scripts/smoke-real-browser.py'],
      proofPoints: ['source ingest', 'source dedupe', 'source listing'],
      walkthrough: [
        { step: 1, title: 'Ingest URLs', action: 'Fetch one or more pages.', output: 'Normalized source rows tied to the workspace.', routes: ['POST /v1/research'], controls: ['run-research'] },
        { step: 2, title: 'Ingest raw text', action: 'Capture manual findings in the same ledger.', output: 'The same dedupe logic applies to pasted evidence.', routes: ['POST /v1/research'], controls: ['run-research'] },
        { step: 3, title: 'Review ledger', action: 'List the stored sources.', output: 'Reusable source ids for briefs and claims.', routes: ['GET /v1/research'], controls: ['list-research'] }
      ]
    },
    {
      id: 'writing',
      title: 'Brief and article generation',
      audience: 'operators, agencies, and editorial teams',
      purpose: 'Convert the stored source ledger into briefs and long-form drafts with citations, FAQ, CTA, multilingual output, claim mapping, schema packs, internal-link plans, article review gates, and remediation packs that turn review findings into a stronger publish candidate.',
      outcome: 'Stored briefs, articles, enrichment packs, review packs, and remediation packs that carry proof metadata into publish handoff.',
      routes: ['GET /v1/articles/brief', 'POST /v1/articles/brief', 'GET /v1/articles/draft', 'POST /v1/articles/draft', 'GET /v1/articles/enrichments', 'POST /v1/articles/enrich', 'POST /v1/articles/enrich/export', 'GET /v1/articles/reviews', 'POST /v1/articles/review', 'POST /v1/articles/review/export', 'GET /v1/articles/remediations', 'POST /v1/articles/remediate', 'POST /v1/articles/remediate/export'],
      controls: ['run-brief', 'run-draft', 'list-drafts', 'run-article-enrich', 'list-article-enrichments', 'export-article-enrich', 'run-article-review', 'list-article-reviews', 'export-article-review', 'run-article-remediate', 'list-article-remediations', 'export-article-remediate'],
      smokeScripts: ['scripts/smoke-api.mjs', 'scripts/smoke-enrich.mjs', 'scripts/smoke-review.mjs', 'scripts/smoke-remediate.mjs', 'scripts/smoke-browser-ui.mjs', 'scripts/smoke-real-browser.py'],
      proofPoints: ['brief generation', 'draft generation', 'claim-to-source mapping', 'FAQ injection', 'schema graph generation', 'internal-link planning', 'article enrichment export', 'article review generation', 'article publish gate export', 'article remediation generation', 'article remediation export'],
      walkthrough: [
        { step: 1, title: 'Create brief', action: 'Select source ids and define the target keyword, audience, and goal.', output: 'A persisted brief record.', routes: ['POST /v1/articles/brief'], controls: ['run-brief'] },
        { step: 2, title: 'Create draft', action: 'Generate the article from the brief with language, tone, CTA, FAQ, and infographic prompt controls.', output: 'A persisted article record.', routes: ['POST /v1/articles/draft'], controls: ['run-draft'] },
        { step: 3, title: 'Generate enrichment pack', action: 'Turn the stored article into schema, internal-link, metadata, and FAQ carry-through output.', output: 'A persisted enrichment record and HTML pack.', routes: ['POST /v1/articles/enrich', 'POST /v1/articles/enrich/export'], controls: ['run-article-enrich', 'export-article-enrich'] },
        { step: 4, title: 'Run article review gate', action: 'Score the article for evidence coverage, SEO readiness, conversion readiness, and publish blockers.', output: 'A persisted review record and HTML review pack.', routes: ['POST /v1/articles/review', 'POST /v1/articles/review/export'], controls: ['run-article-review', 'export-article-review'] },
        { step: 5, title: 'Generate remediation candidate', action: 'Turn review findings into a stronger publish candidate with patched copy, FAQ expansion, and predicted review improvement.', output: 'A persisted remediation record and HTML remediation pack.', routes: ['POST /v1/articles/remediate', 'POST /v1/articles/remediate/export'], controls: ['run-article-remediate', 'export-article-remediate'] },
        { step: 6, title: 'Review writing outputs', action: 'List the current article inventory, enrichment history, review history, and remediation history.', output: 'A workspace-scoped draft, enrichment, review, and remediation list.', routes: ['GET /v1/articles/draft', 'GET /v1/articles/enrichments', 'GET /v1/articles/reviews', 'GET /v1/articles/remediations'], controls: ['list-drafts', 'list-article-enrichments', 'list-article-reviews', 'list-article-remediations'] }
      ]
    },
    {
      id: 'publishing',
      title: 'Publishing and reconciliation',
      audience: 'operators and agencies',
      purpose: 'Prepare payloads, execute publishes, retry failures, run scheduled jobs, and retain reconciliation evidence.',
      outcome: 'A publish ledger with prepared, queued, success, and failed states.',
      routes: ['GET /v1/publish/payload', 'POST /v1/publish/payload', 'POST /v1/publish/execute', 'POST /v1/publish/retry', 'GET /v1/publish/queue', 'POST /v1/publish/run-scheduled', 'POST /v1/publish/export'],
      controls: ['run-publish-payload', 'run-publish-execute', 'run-publish-retry', 'run-publish-queue', 'run-publish-scheduled', 'export-publish'],
      smokeScripts: ['scripts/smoke-publish.mjs', 'scripts/smoke-browser-ui.mjs', 'scripts/smoke-real-browser.py'],
      proofPoints: ['payload persistence', 'publish execute', 'publish retry', 'scheduled publish run', 'publish evidence export'],
      walkthrough: [
        { step: 1, title: 'Store payload', action: 'Create a publish run for the chosen platform.', output: 'A prepared publish run id.', routes: ['POST /v1/publish/payload'], controls: ['run-publish-payload'] },
        { step: 2, title: 'Execute publish', action: 'Send the article through the selected adapter.', output: 'A success or failed publish state with reconciliation data.', routes: ['POST /v1/publish/execute'], controls: ['run-publish-execute'] },
        { step: 3, title: 'Recover or schedule', action: 'Retry failed runs or process the schedule queue.', output: 'Updated publish history.', routes: ['POST /v1/publish/retry', 'POST /v1/publish/run-scheduled', 'GET /v1/publish/queue'], controls: ['run-publish-retry', 'run-publish-scheduled', 'run-publish-queue'] }
      ]
    },
    {
      id: 'visibility',
      title: 'Visibility replay and scoring',
      audience: 'operators, agencies, and analysts',
      purpose: 'Create replay prompts, score answer mentions and citations, and export evidence over time.',
      outcome: 'Prompt-pack and replay ledgers that quantify AI-surface visibility.',
      routes: ['GET /v1/visibility/prompt-pack', 'POST /v1/visibility/prompt-pack', 'POST /v1/visibility/replay', 'GET /v1/visibility/dashboard', 'POST /v1/visibility/export'],
      controls: ['run-prompts', 'run-replay', 'run-dashboard', 'export-visibility'],
      smokeScripts: ['scripts/smoke-replay.mjs', 'scripts/smoke-browser-ui.mjs'],
      proofPoints: ['prompt-pack generation', 'replay scoring', 'visibility dashboard', 'visibility export'],
      walkthrough: [
        { step: 1, title: 'Build prompt pack', action: 'Create the saved prompt set.', output: 'A persisted prompt-pack id.', routes: ['POST /v1/visibility/prompt-pack'], controls: ['run-prompts'] },
        { step: 2, title: 'Replay answer', action: 'Submit provider answers for scoring.', output: 'Mention-share, citation-share, and competitor-overlap scoring.', routes: ['POST /v1/visibility/replay'], controls: ['run-replay'] },
        { step: 3, title: 'Review dashboard', action: 'Load the summary view or export evidence.', output: 'Dashboard metrics and stored evidence.', routes: ['GET /v1/visibility/dashboard', 'POST /v1/visibility/export'], controls: ['run-dashboard', 'export-visibility'] }
      ]
    },
    {
      id: 'agency',
      title: 'Agency and reseller controls',
      audience: 'owners, admins, agencies, and resellers',
      purpose: 'Manage keys, white-label settings, seats, clients, usage, quotas, and invoices.',
      outcome: 'A real multi-tenant operator control surface.',
      routes: ['GET /v1/auth/keys', 'POST /v1/auth/keys', 'GET /v1/agency/settings', 'POST /v1/agency/settings', 'GET /v1/agency/seats', 'POST /v1/agency/seats', 'GET /v1/agency/clients', 'POST /v1/agency/clients', 'GET /v1/agency/usage', 'POST /v1/agency/invoices/export'],
      controls: ['create-auth-key', 'list-auth-keys', 'save-agency-settings', 'create-seat', 'create-client', 'show-agency-usage', 'export-invoice'],
      smokeScripts: ['scripts/smoke-agency.mjs'],
      proofPoints: ['api-key auth', 'white-label settings', 'seat management', 'client management', 'usage metering', 'invoice export'],
      walkthrough: [
        { step: 1, title: 'Create key', action: 'Issue an API key with a real role.', output: 'A secret that can authenticate later calls.', routes: ['POST /v1/auth/keys'], controls: ['create-auth-key'] },
        { step: 2, title: 'Save branding', action: 'Persist display name, logo, color, and domain settings.', output: 'A stored agency settings row.', routes: ['POST /v1/agency/settings'], controls: ['save-agency-settings'] },
        { step: 3, title: 'Manage seats and clients', action: 'Create seats and reseller clients, then inspect usage or export invoices.', output: 'Seat, client, usage, and invoice records.', routes: ['POST /v1/agency/seats', 'POST /v1/agency/clients', 'GET /v1/agency/usage', 'POST /v1/agency/invoices/export'], controls: ['create-seat', 'create-client', 'show-agency-usage', 'export-invoice'] }
      ]
    },
    {
      id: 'backlinks',
      title: 'Backlink and distribution network',
      audience: 'operators and distribution teams',
      purpose: 'Register partner sites, enforce quality policy, queue placements, reconcile live links, and view network health.',
      outcome: 'A distribution ledger with fraud and quality controls.',
      routes: ['GET /v1/backlinks/sites', 'POST /v1/backlinks/sites', 'GET /v1/backlinks/placements', 'POST /v1/backlinks/placements', 'POST /v1/backlinks/reconcile', 'GET /v1/backlinks/dashboard'],
      controls: ['create-backlink-site', 'list-backlink-sites', 'queue-backlink-placement', 'reconcile-backlink', 'show-backlink-dashboard'],
      smokeScripts: ['scripts/smoke-backlinks.mjs'],
      proofPoints: ['partner-site registry', 'placement queue', 'reconciliation', 'network dashboard'],
      walkthrough: [
        { step: 1, title: 'Register partner site', action: 'Add a site with traffic, keyword, DR, and policy inputs.', output: 'A scored partner-site record.', routes: ['POST /v1/backlinks/sites'], controls: ['create-backlink-site'] },
        { step: 2, title: 'Queue placement', action: 'Choose target URL, keyword, and anchors.', output: 'A queued placement with relevance and diversity scoring.', routes: ['POST /v1/backlinks/placements'], controls: ['queue-backlink-placement'] },
        { step: 3, title: 'Reconcile or review', action: 'Mark placements live and inspect network health.', output: 'Updated placement state and dashboard metrics.', routes: ['POST /v1/backlinks/reconcile', 'GET /v1/backlinks/dashboard'], controls: ['reconcile-backlink', 'show-backlink-dashboard'] }
      ]
    },
    {
      id: 'portability',
      title: 'Portability and proof retention',
      audience: 'operators and auditors',
      purpose: 'Export full workspace state, restore it into a new workspace, or clone it without child-id collisions.',
      outcome: 'A portable proof-grade workspace bundle.',
      routes: ['POST /v1/workspace-bundles/export', 'POST /v1/workspace-bundles/import', 'POST /v1/workspace-bundles/clone', 'GET /v1/evidence/exports'],
      controls: ['export-bundle', 'import-bundle', 'clone-bundle', 'list-evidence'],
      smokeScripts: ['scripts/smoke-bundles.mjs', 'scripts/smoke-browser-ui.mjs', 'scripts/smoke-real-browser.py'],
      proofPoints: ['bundle export', 'bundle import', 'workspace clone', 'evidence listing'],
      walkthrough: [
        { step: 1, title: 'Export bundle', action: 'Package the workspace history.', output: 'A JSON bundle with child records.', routes: ['POST /v1/workspace-bundles/export'], controls: ['export-bundle'] },
        { step: 2, title: 'Import bundle', action: 'Restore a bundle into a new workspace.', output: 'A new workspace with preserved history.', routes: ['POST /v1/workspace-bundles/import'], controls: ['import-bundle'] },
        { step: 3, title: 'Clone workspace', action: 'Copy the current workspace directly.', output: 'A new workspace id with remapped child ids.', routes: ['POST /v1/workspace-bundles/clone'], controls: ['clone-bundle'] }
      ]
    },

    {
      id: 'readiness',
      title: 'Readiness and contract-truth',
      audience: 'operators, buyers, and auditors',
      purpose: 'Generate a runtime-aware readiness map, a claim catalog, and a contract-truth export so the product can explain what is locally proved, what is conditional, and what is still blocked.',
      outcome: 'A persisted readiness run and contract pack that map claims to real routes, controls, smoke scripts, and live-runtime blockers.',
      routes: ['GET /v1/readiness/runs', 'POST /v1/readiness/run', 'GET /v1/claims/catalog', 'GET /v1/claims/evidence', 'POST /v1/contracts/export'],
      controls: ['run-readiness', 'list-readiness-runs', 'load-claim-catalog', 'load-claim-evidence', 'export-contract-pack'],
      smokeScripts: ['scripts/smoke-readiness.mjs', 'scripts/smoke-browser-ui.mjs', 'scripts/smoke-real-browser.py'],
      proofPoints: ['runtime-aware readiness map', 'claim catalog', 'claim evidence graph', 'contract-truth export', 'persisted readiness evidence'],
      walkthrough: [
        { step: 1, title: 'Run readiness', action: 'Generate a runtime-aware readiness run from the active workspace ledger and env mode.', output: 'A persisted readiness export plus module activation statuses.', routes: ['POST /v1/readiness/run'], controls: ['run-readiness'] },
        { step: 2, title: 'Inspect readiness history and claim catalog', action: 'Review persisted readiness runs, the claim catalog, and the claim evidence graph that ties each claim to exports, job types, and next proof actions.', output: 'A live claim catalog, claim evidence graph, and stored readiness evidence list.', routes: ['GET /v1/readiness/runs', 'GET /v1/claims/catalog', 'GET /v1/claims/evidence'], controls: ['list-readiness-runs', 'load-claim-catalog', 'load-claim-evidence'] },
        { step: 3, title: 'Export contract-truth pack', action: 'Export the readiness map, claim catalog, proof summary, and walkthrough summary as stored evidence.', output: 'A contract pack evidence record suitable for buyer-facing or operator-facing proof review.', routes: ['POST /v1/contracts/export'], controls: ['export-contract-pack'] }
      ]
    },

    {
      id: 'strategy',
      title: 'Competitive strategy and command center',
      audience: 'operators, founders, and agencies',
      purpose: 'Score the live workspace against a BabyLoveGrowth-class benchmark, prioritize the next actions, and export a persisted operator battle plan from the real proof graph.',
      outcome: 'A strategy scorecard, prioritized action queue, and weekly runbook generated from the real workspace ledger.',
      routes: ['GET /v1/strategy/scorecard', 'GET /v1/strategy/actions', 'POST /v1/strategy/export'],
      controls: ['load-strategy-scorecard', 'load-strategy-actions', 'export-strategy-pack'],
      smokeScripts: ['scripts/smoke-strategy.mjs', 'scripts/smoke-browser-ui.mjs', 'scripts/smoke-real-browser.py'],
      proofPoints: ['competitive scorecard', 'prioritized action plan', 'strategy export'],
      walkthrough: [
        { step: 1, title: 'Load scorecard', action: 'Score the current workspace across core, moat, proof, and scale lanes using the live readiness map and claim catalog.', output: 'A scored module-by-module competitive scorecard.', routes: ['GET /v1/strategy/scorecard'], controls: ['load-strategy-scorecard'] },
        { step: 2, title: 'Load prioritized actions', action: 'Generate the next operator actions needed to strengthen the moat, close proof gaps, or push partial modules to completion.', output: 'A prioritized action queue with routes, controls, blockers, and success conditions.', routes: ['GET /v1/strategy/actions'], controls: ['load-strategy-actions'] },
        { step: 3, title: 'Export strategy pack', action: 'Persist the scorecard, action queue, and weekly runbook as a strategy pack in the evidence ledger.', output: 'A stored strategy pack export record.', routes: ['POST /v1/strategy/export'], controls: ['export-strategy-pack'] }
      ]
    },
    {
      id: 'reporting',
      title: 'Report sites and proof matrix',
      audience: 'operators, clients, buyers, and auditors',
      purpose: 'Generate client-facing or investor-facing report sites, produce a workspace proof matrix, and score walkthrough completion from real workspace activity.',
      outcome: 'A detailed report surface and export lane tied to the actual workspace ledger.',
      routes: ['GET /v1/proof/matrix', 'GET /v1/walkthrough-runs', 'GET /v1/reports/summary', 'POST /v1/reports/site', 'POST /v1/reports/export', 'POST /v1/proof/site'],
      controls: ['load-proof-matrix', 'load-walkthrough-run', 'load-report-summary', 'generate-report-site', 'export-report-site', 'generate-proof-site'],
      smokeScripts: ['scripts/smoke-reporting.mjs', 'scripts/smoke-browser-ui.mjs', 'scripts/smoke-real-browser.py'],
      proofPoints: ['workspace proof matrix', 'workspace walkthrough completion', 'client-facing report site generation', 'proof site generation', 'report export'],
      walkthrough: [
        { step: 1, title: 'Load proof matrix', action: 'Generate the module-by-module proof matrix from the actual workspace history and capability graph.', output: 'A scored matrix for routes, controls, proof points, and observed workspace signals.', routes: ['GET /v1/proof/matrix'], controls: ['load-proof-matrix'] },
        { step: 2, title: 'Load walkthrough run', action: 'Generate per-module walkthrough progress using the current workspace ledger.', output: 'A progress readout showing which walkthrough steps are complete, partial, or still pending.', routes: ['GET /v1/walkthrough-runs'], controls: ['load-walkthrough-run'] },
        { step: 3, title: 'Generate report site', action: 'Build the client-facing or investor-facing report surface and optionally export it as stored evidence.', output: 'A detailed HTML report site and stored report export evidence.', routes: ['GET /v1/reports/summary', 'POST /v1/reports/site', 'POST /v1/reports/export'], controls: ['load-report-summary', 'generate-report-site', 'export-report-site'] },
        { step: 4, title: 'Generate proof site', action: 'Build an operator-grade proof site from runtime contracts and the claim evidence graph.', output: 'A proof-only HTML site and stored proof-site export evidence.', routes: ['POST /v1/proof/site'], controls: ['generate-proof-site'] }
      ]
    },

    {
      id: 'targets',
      title: 'Live target probes and proof blockers',
      audience: 'operators and launch owners',
      purpose: 'Probe Neon and CMS targets with real network requests, store the results, and make the gap between reachable targets and truly proved live execution impossible to ignore.',
      outcome: 'A stored target-probe ledger, a target-pack export, and a visible blocker map for live Neon and live CMS proof.',
      routes: ['GET /v1/targets/summary', 'GET /v1/targets/probes', 'POST /v1/targets/probe', 'POST /v1/targets/export'],
      controls: ['load-target-summary', 'list-target-probes', 'run-target-probe', 'export-target-pack'],
      smokeScripts: ['scripts/smoke-targets.mjs', 'scripts/smoke-browser-ui.mjs', 'scripts/smoke-real-browser.py'],
      proofPoints: ['target probe execution', 'target probe history', 'target-pack export'],
      walkthrough: [
        { step: 1, title: 'Load target summary', action: 'Read the current target-probe summary for the workspace.', output: 'A summary of reachable, blocked, unreachable, and remote targets.', routes: ['GET /v1/targets/summary'], controls: ['load-target-summary'] },
        { step: 2, title: 'Run target probe', action: 'Probe a provider or Neon target using a real HEAD/GET request and persist the result.', output: 'A stored target-probe evidence record.', routes: ['POST /v1/targets/probe'], controls: ['run-target-probe'] },
        { step: 3, title: 'Review and export target pack', action: 'List prior target probes and export the target-pack report.', output: 'A target-probe history list and a stored target-pack export.', routes: ['GET /v1/targets/probes', 'POST /v1/targets/export'], controls: ['list-target-probes', 'export-target-pack'] }
      ]
    },


    {
      id: 'release',
      title: 'Release gate and drift control',
      audience: 'operators, founders, and launch owners',
      purpose: 'Score whether the workspace is actually ready to ship, surface remaining proof drift, and export a release pack from the live ledger without pretending that local proof equals live proof.',
      outcome: 'A release gate, drift report, and release-pack export generated from real workspace evidence.',
      routes: ['GET /v1/release/gate', 'GET /v1/release/drift', 'POST /v1/release/export'],
      controls: ['load-release-gate', 'load-release-drift', 'export-release-pack'],
      smokeScripts: ['scripts/smoke-release.mjs', 'scripts/smoke-browser-ui.mjs', 'scripts/smoke-real-browser.py'],
      proofPoints: ['release gate', 'drift report', 'release-pack export'],
      walkthrough: [
        { step: 1, title: 'Load release gate', action: 'Score the current workspace against a ship/conditional/blocked gate using real evidence, proof depth, runtime blockers, and live-proof gaps.', output: 'A release gate with pass/warn/fail checks and a launch verdict.', routes: ['GET /v1/release/gate'], controls: ['load-release-gate'] },
        { step: 2, title: 'Inspect drift report', action: 'Read the proof drift list generated from pending modules, readiness blockers, and remaining live-proof gaps.', output: 'A drift report with severity, lane, routes, controls, and next actions.', routes: ['GET /v1/release/drift'], controls: ['load-release-drift'] },
        { step: 3, title: 'Export release pack', action: 'Persist the release gate, drift report, and weekly runbook as a stored evidence pack and HTML release site.', output: 'A release-pack export record and HTML site.', routes: ['POST /v1/release/export'], controls: ['export-release-pack'] }
      ]
    },

    {
      id: 'cutover',
      title: 'Cutover and live-proof handoff',
      audience: 'operators, launch owners, and founders',
      purpose: 'Turn release truth, target probes, publish evidence, and rollback evidence into a real cutover run and a handoff pack so launch readiness is explicit instead of implied.',
      outcome: 'A cutover summary, stored cutover runs, and a cutover pack export generated from the real workspace ledger.',
      routes: ['GET /v1/cutover/summary', 'GET /v1/cutover/runs', 'POST /v1/cutover/run', 'POST /v1/cutover/export'],
      controls: ['load-cutover-summary', 'list-cutover-runs', 'run-cutover', 'export-cutover-pack'],
      smokeScripts: ['scripts/smoke-cutover.mjs', 'scripts/smoke-browser-ui.mjs', 'scripts/smoke-real-browser.py'],
      proofPoints: ['cutover summary', 'cutover run', 'cutover-pack export'],
      walkthrough: [
        { step: 1, title: 'Load cutover summary', action: 'Read the latest cutover state for the workspace.', output: 'A current cutover summary and the latest run verdict.', routes: ['GET /v1/cutover/summary'], controls: ['load-cutover-summary'] },
        { step: 2, title: 'Run cutover', action: 'Generate a fresh cutover run from release, targets, publish evidence, readiness, and rollback evidence.', output: 'A stored cutover run with pass/warn/fail checks and handoff notes.', routes: ['POST /v1/cutover/run'], controls: ['run-cutover'] },
        { step: 3, title: 'Review and export cutover pack', action: 'List prior cutover runs and export the handoff pack.', output: 'A cutover-run history list and a stored cutover-pack export.', routes: ['GET /v1/cutover/runs', 'POST /v1/cutover/export'], controls: ['list-cutover-runs', 'export-cutover-pack'] }
      ]
    },


    {
      id: 'rollback',
      title: 'Rollback and recovery pack',
      audience: 'operators, launch owners, and incident responders',
      purpose: 'Turn bundle exports, cutover evidence, publish evidence, and target probes into a real rollback run so recovery readiness is explicit and exportable before a bad release forces guesswork.',
      outcome: 'A rollback summary, stored rollback runs, and a rollback pack export generated from the live workspace ledger.',
      routes: ['GET /v1/rollback/summary', 'GET /v1/rollback/runs', 'POST /v1/rollback/run', 'POST /v1/rollback/export'],
      controls: ['load-rollback-summary', 'list-rollback-runs', 'run-rollback', 'export-rollback-pack'],
      smokeScripts: ['scripts/smoke-rollback.mjs', 'scripts/smoke-browser-ui.mjs', 'scripts/smoke-real-browser.py'],
      proofPoints: ['rollback summary', 'rollback run', 'rollback-pack export'],
      walkthrough: [
        { step: 1, title: 'Load rollback summary', action: 'Read the latest rollback state for the workspace.', output: 'A current rollback summary and the latest verdict.', routes: ['GET /v1/rollback/summary'], controls: ['load-rollback-summary'] },
        { step: 2, title: 'Run rollback', action: 'Generate a fresh rollback run from bundle, cutover, publish, target, and release evidence.', output: 'A stored rollback run with restore steps and restore-point details.', routes: ['POST /v1/rollback/run'], controls: ['run-rollback'] },
        { step: 3, title: 'Review and export rollback pack', action: 'List prior rollback runs and export the rollback pack.', output: 'A rollback history list and a stored rollback-pack export.', routes: ['GET /v1/rollback/runs', 'POST /v1/rollback/export'], controls: ['list-rollback-runs', 'export-rollback-pack'] }
      ]
    },

    {
      id: 'truth',
      title: 'Purpose, walkthroughs, and no-theater validation',
      audience: 'operators, buyers, and auditors',
      purpose: 'Explain what the platform is for, show real module walkthroughs, validate that claims match the implemented surface, and expose runtime/provider contracts before anyone mistakes local proof for live proof.',
      outcome: 'A proof-backed purpose layer that does not describe fake capability and does not hide runtime contract blockers.',
      routes: ['GET /v1/capabilities', 'GET /v1/walkthroughs', 'POST /v1/truth/validate', 'GET /v1/runtime/contracts', 'POST /v1/providers/validate'],
      controls: ['load-purpose', 'load-walkthroughs', 'run-truth-validator', 'load-runtime-contracts', 'validate-provider-contract'],
      smokeScripts: ['scripts/smoke-truth.mjs', 'scripts/smoke-browser-ui.mjs', 'scripts/smoke-real-browser.py'],
      proofPoints: ['purpose narrative', 'module breakdowns', 'walkthrough registry', 'truth validator', 'runtime contract map', 'provider contract validation'],
      walkthrough: [
        { step: 1, title: 'Load purpose', action: 'Read the product purpose and real capability summary.', output: 'A manifest generated from the implemented module registry.', routes: ['GET /v1/capabilities'], controls: ['load-purpose'] },
        { step: 2, title: 'Load walkthroughs', action: 'Read step-by-step walkthroughs for each real module.', output: 'Per-module steps with routes, controls, and outputs.', routes: ['GET /v1/walkthroughs'], controls: ['load-walkthroughs'] },
        { step: 3, title: 'Validate truth', action: 'Run the no-theater validator against the UI and module registry.', output: 'A report listing missing controls, missing routes, or unsupported claims.', routes: ['POST /v1/truth/validate'], controls: ['run-truth-validator'] },
        { step: 4, title: 'Inspect runtime and provider contracts', action: 'Load runtime contracts and validate a provider target before executing publish flows.', output: 'A control-by-control requirement map plus provider target truth.', routes: ['GET /v1/runtime/contracts', 'POST /v1/providers/validate'], controls: ['load-runtime-contracts', 'validate-provider-contract'] }
      ]
    }
  ];
}

export function getCapabilityRegistry(): CapabilityModule[] {
  return createModules();
}

export function buildPurposeNarrative(modules = getCapabilityRegistry()): { headline: string; summary: string; principles: string[]; moduleCount: number } {
  const principles = [
    'Every described capability must map to a real route and real UI control.',
    'Walkthroughs must describe what the product actually does now, not what it might do later.',
    'Evidence, publish history, visibility history, readiness truth, portability, and report exports are first-class operator surfaces.',
    'Anything not implemented stays out of the purpose copy and stays out of walkthrough claims.',
    'Report sites, readiness maps, and proof matrices must be generated from the real workspace ledger, not from demo-only copy.'
  ];
  const summary = `Skye GEO Engine is an operator-grade AI-search growth platform that joins workspace setup, technical audit, source-ledger research, proof-backed writing, execution-grade publishing, replay scoring, backlink operations, agency controls, and proof retention into one system. The purpose layer is generated from ${modules.length} implemented modules so the product explains only what the shipped surface can actually do, what is conditionally live, and what is still blocked.`;
  return {
    headline: 'Explain the product from the real capability graph, not from marketing fiction.',
    summary,
    principles,
    moduleCount: modules.length
  };
}

export function validateCapabilityRegistry(input: { appHtml: string; modules?: CapabilityModule[] }): {
  ok: boolean;
  checkedModules: number;
  checkedRoutes: number;
  checkedControls: number;
  issues: string[];
} {
  const modules = input.modules || getCapabilityRegistry();
  const issues: string[] = [];
  const seenRoutes = new Set<string>();
  const seenControls = new Set<string>();
  for (const module of modules) {
    if (!module.walkthrough.length) issues.push(`Module ${module.id} has no walkthrough steps.`);
    if (!module.purpose.trim()) issues.push(`Module ${module.id} has no purpose text.`);
    if (!module.outcome.trim()) issues.push(`Module ${module.id} has no outcome text.`);
    for (const route of module.routes) {
      seenRoutes.add(route);
      const routePath = route.split(' ').slice(1).join(' ');
      if (routePath && !input.appHtml.includes(routePath)) issues.push(`Missing UI route reference for ${route}.`);
    }
    for (const control of module.controls) {
      seenControls.add(control);
      if (!input.appHtml.includes(`id="${control}"`)) issues.push(`Missing UI control ${control}.`);
    }
    for (const step of module.walkthrough) {
      for (const route of step.routes) {
        seenRoutes.add(route);
        const routePath = route.split(' ').slice(1).join(' ');
        if (routePath && !input.appHtml.includes(routePath)) issues.push(`Walkthrough route ${route} missing for module ${module.id}.`);
      }
      for (const control of step.controls) {
        seenControls.add(control);
        if (!input.appHtml.includes(`id="${control}"`)) issues.push(`Walkthrough control ${control} missing for module ${module.id}.`);
      }
    }
  }
  return {
    ok: issues.length === 0,
    checkedModules: modules.length,
    checkedRoutes: seenRoutes.size,
    checkedControls: seenControls.size,
    issues
  };
}
