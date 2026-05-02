import { buildPurposeNarrative, getCapabilityRegistry } from '../lib/capabilities.ts';

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function renderApp(): string {
  const modules = getCapabilityRegistry();
  const purpose = buildPurposeNarrative(modules);
  const overviewHtml = modules.map((module) => `<div style="padding:10px 0; border-top:1px solid rgba(255,255,255,.06);"><strong>${esc(module.title)}</strong><div style="color:var(--muted); font-size:13px; margin-top:4px;">${esc(module.purpose)}</div><div style="color:var(--muted); font-size:12px; margin-top:6px;">Routes: ${module.routes.length} · Controls: ${module.controls.length} · Walkthrough steps: ${module.walkthrough.length}</div></div>`).join('');
  const principleHtml = purpose.principles.map((item) => `<li>${esc(item)}</li>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Skye GEO Engine</title>
  <style>
    :root { color-scheme: dark; --bg:#07111f; --panel:#0f1b31; --line:#223557; --text:#f4f7fb; --muted:#9fb3cf; --accent:#8d7bff; }
    * { box-sizing:border-box; }
    body { margin:0; font-family: Inter, system-ui, sans-serif; background: radial-gradient(circle at top, #16274e 0%, #07111f 55%); color:var(--text); }
    .shell { max-width: 1580px; margin:0 auto; padding:24px; }
    h1,h2,h3,p { margin:0; }
    .hero { padding:24px; border:1px solid var(--line); border-radius:24px; background: rgba(10,18,34,.85); box-shadow: 0 12px 50px rgba(0,0,0,.3); }
    .hero p { color:var(--muted); margin-top:10px; max-width:1000px; }
    .grid { display:grid; grid-template-columns: repeat(auto-fit,minmax(320px,1fr)); gap:16px; margin-top:18px; }
    .card { padding:18px; border:1px solid var(--line); border-radius:22px; background: rgba(15,27,49,.92); min-height:280px; display:flex; flex-direction:column; gap:12px; }
    .card p { color:var(--muted); font-size:14px; }
    label { display:block; font-size:12px; color:var(--muted); margin-bottom:6px; }
    input, textarea, select { width:100%; background:#0a1528; color:var(--text); border:1px solid var(--line); border-radius:12px; padding:10px 12px; font:inherit; }
    textarea { min-height:92px; resize:vertical; }
    button { background:linear-gradient(135deg, #8d7bff, #4db8ff); color:white; border:none; border-radius:999px; padding:10px 14px; font-weight:700; cursor:pointer; margin-right:8px; margin-bottom:8px; }
    .status { min-height:20px; color:#9ad0ff; font-size:13px; }
    .result { background:#08111f; border:1px solid var(--line); border-radius:14px; padding:12px; min-height:120px; white-space:pre-wrap; overflow:auto; font-size:12px; }
    .toolbar { display:grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap:12px; margin-top:16px; margin-bottom:18px; }
    .footer { color:var(--muted); font-size:13px; padding:16px 4px 8px; }
    .mini-list { margin:0; padding-left:18px; color:var(--muted); font-size:13px; }
    .inline-code { font-family: ui-monospace, SFMono-Regular, monospace; color:#b9ccff; }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <h1>Skye GEO Engine · Operator Surface</h1>
      <p>${esc(purpose.summary)}</p>
      <div class="toolbar">
        <div><label>Org ID</label><input id="org-id" placeholder="set an org id" /></div>
        <div><label>Workspace ID</label><input id="workspace-id" placeholder="create a workspace first" /></div>
        <div><label>Project ID</label><input id="project-id" placeholder="create a project first" /></div>
        <div><label>API Key</label><input id="api-key" placeholder="optional x-api-key" /></div>
      </div>
    </section>

    <section class="grid">

      <article class="card">
        <h2>Purpose + real module map</h2>
        <p>${esc(purpose.headline)}</p>
        <ul class="mini-list">${principleHtml}</ul>
        <div class="result" style="min-height:220px">${overviewHtml}</div>
      </article>

      <article class="card">
        <h2>Walkthroughs + truth validator</h2>
        <p>Load the generated product purpose, inspect walkthroughs, and validate that the UI only describes real capability.</p>
        <div><label>Truth mode</label><input id="truth-mode" value="real-only" /></div>
        <div><label>Provider contract platform</label><select id="provider-contract-platform"><option value="wordpress">wordpress</option><option value="webflow">webflow</option><option value="shopify">shopify</option><option value="wix">wix</option><option value="ghost">ghost</option><option value="generic-api">generic-api</option><option value="neon-http">neon-http</option></select></div>
        <div><label>Provider contract target URL</label><input id="provider-contract-target" placeholder="https://cms-target.example" /></div>
        <div><button id="load-purpose">Load purpose</button><button id="load-walkthroughs">Load walkthroughs</button><button id="run-truth-validator">Validate claims</button><button id="load-runtime-contracts">Load runtime contracts</button><button id="validate-provider-contract">Validate provider contract</button></div>
        <div class="status" id="truth-status"></div>
        <div class="result" id="truth-result"></div>
      </article>

      <article class="card">
        <h2>Reports + proof matrix</h2>
        <p>Generate the workspace proof matrix, inspect walkthrough completion, and build a client-facing or investor-facing report site from the real ledger.</p>
        <div><label>Report audience</label><select id="report-audience"><option value="operator">operator</option><option value="client">client</option><option value="investor">investor</option></select></div>
        <div><button id="load-proof-matrix">Load proof matrix</button><button id="load-walkthrough-run">Load walkthrough run</button><button id="load-report-summary">Load report summary</button><button id="generate-report-site">Generate report site</button><button id="export-report-site">Export report site</button><button id="generate-proof-site">Generate proof site</button></div>
        <div class="status" id="report-status"></div>
        <div class="result" id="report-result"></div>
      </article>

      <article class="card">
        <h2>Readiness + claim catalog</h2>
        <p>Generate a runtime-aware readiness map, review stored readiness evidence, inspect the claim catalog, and export a contract-truth pack.</p>
        <div><button id="run-readiness">Run readiness</button><button id="list-readiness-runs">List readiness runs</button><button id="load-claim-catalog">Load claim catalog</button><button id="load-claim-evidence">Load claim evidence</button><button id="export-contract-pack">Export contract pack</button></div>
        <div class="status" id="readiness-status"></div>
        <div class="result" id="readiness-result"></div>
      </article>
      <article class="card">
        <h2>Strategy + command center</h2>
        <p>Score the workspace against a BabyLoveGrowth-class benchmark, inspect prioritized actions, and export a real operator strategy pack.</p>
        <div><button id="load-strategy-scorecard">Load scorecard</button><button id="load-strategy-actions">Load actions</button><button id="export-strategy-pack">Export strategy pack</button></div>
        <div class="status" id="strategy-status"></div>
        <div class="result" id="strategy-result"></div>
      </article>

      <article class="card">
        <h2>Release gate + drift control</h2>
        <p>Score the workspace for real ship readiness, inspect remaining proof drift, and export a release pack without pretending local proof equals live proof.</p>
        <div><button id="load-release-gate">Load release gate</button><button id="load-release-drift">Load drift report</button><button id="export-release-pack">Export release pack</button></div>
        <div class="status" id="release-status"></div>
        <div class="result" id="release-result"></div>
      </article>


      <article class="card">
        <h2>Live target probes</h2>
        <p>Probe Neon and provider targets with real network requests, store the result, and export a target pack without confusing reachable targets with actually proved live execution.</p>
        <div><label>Target probe platform</label><select id="target-platform"><option value="generic-api">generic-api</option><option value="wordpress">wordpress</option><option value="webflow">webflow</option><option value="shopify">shopify</option><option value="wix">wix</option><option value="ghost">ghost</option><option value="neon-http">neon-http</option></select></div>
        <div><label>Target probe URL</label><input id="target-probe-url" placeholder="paste Neon or provider target URL" /></div>
        <div><label>Target probe auth token</label><input id="target-probe-auth" placeholder="optional bearer token" /></div>
        <div><button id="load-target-summary">Load target summary</button><button id="list-target-probes">List target probes</button><button id="run-target-probe">Run target probe</button><button id="export-target-pack">Export target pack</button></div>
        <div class="status" id="targets-status"></div>
        <div class="result" id="targets-result"></div>
      </article>

      <article class="card">
        <h2>Cutover + live-proof handoff</h2>
        <p>Turn release truth, target probes, publish evidence, and rollback evidence into a real cutover run so launch readiness is explicit and exportable.</p>
        <div><button id="load-cutover-summary">Load cutover summary</button><button id="list-cutover-runs">List cutover runs</button><button id="run-cutover">Run cutover</button><button id="export-cutover-pack">Export cutover pack</button></div>
        <div class="status" id="cutover-status"></div>
        <div class="result" id="cutover-result"></div>
      </article>

      <article class="card">
        <h2>Rollback + recovery</h2>
        <p>Turn bundle exports, cutover evidence, publish history, and target probes into a real rollback run so recovery readiness is explicit and exportable.</p>
        <div><button id="load-rollback-summary">Load rollback summary</button><button id="list-rollback-runs">List rollback runs</button><button id="run-rollback">Run rollback</button><button id="export-rollback-pack">Export rollback pack</button></div>
        <div class="status" id="rollback-status"></div>
        <div class="result" id="rollback-result"></div>
      </article>

      <article class="card">
        <h2>Workspaces</h2>
        <p>Create and list org-scoped workspaces.</p>
        <div><label>Workspace name</label><input id="workspace-name" value="BabyLoveGrowth Takedown" /></div>
        <div><label>Brand</label><input id="workspace-brand" value="Skye GEO Engine" /></div>
        <div><label>Niche</label><input id="workspace-niche" value="AI search growth" /></div>
        <div><button id="create-workspace">Create workspace</button><button id="list-workspaces">List workspaces</button></div>
        <div class="status" id="workspace-status"></div>
        <div class="result" id="workspace-result"></div>
      </article>

      <article class="card">
        <h2>Projects</h2>
        <p>Create and list projects inside the current workspace.</p>
        <div><label>Project name</label><input id="project-name" value="Competitor mirror build" /></div>
        <div><label>Primary URL</label><input id="project-url" placeholder="https://your-site.com" /></div>
        <div><label>Audience</label><input id="project-audience" value="growth operators" /></div>
        <div><button id="create-project">Create project</button><button id="list-projects">List projects</button></div>
        <div class="status" id="project-status"></div>
        <div class="result" id="project-result"></div>
      </article>

      <article class="card">
        <h2>Audit</h2>
        <p>Run a live page audit and persist the result.</p>
        <div><label>Target URL</label><input id="audit-url" placeholder="https://your-site.com" /></div>
        <div><button id="run-audit">Run audit</button><button id="export-audit">Export audit evidence</button></div>
        <div class="status" id="audit-status"></div>
        <div class="result" id="audit-result"></div>
      </article>

      <article class="card">
        <h2>Content plan</h2>
        <p>Generate and store the 30-day content plan.</p>
        <div><label>Brand</label><input id="plan-brand" value="Skye GEO Engine" /></div>
        <div><label>Niche</label><input id="plan-niche" value="AI search growth" /></div>
        <div><label>Audience</label><input id="plan-audience" value="agencies and operators" /></div>
        <div><button id="run-plan">Create plan</button></div>
        <div class="status" id="plan-status"></div>
        <div class="result" id="plan-result"></div>
      </article>

      <article class="card">
        <h2>Visibility pack + replay</h2>
        <p>Create the replay prompt set, then score stored answers.</p>
        <div><label>Brand</label><input id="prompt-brand" value="Skye GEO Engine" /></div>
        <div><label>Niche</label><input id="prompt-niche" value="AI search growth" /></div>
        <div><label>Market</label><input id="prompt-market" value="US agencies" /></div>
        <div><label>Competitors (comma separated)</label><input id="prompt-competitors" value="BabyLoveGrowth, Search Atlas" /></div>
        <div><label>Prompt Pack ID</label><input id="prompt-pack-id" placeholder="filled after pack creation" /></div>
        <div><label>Replay answer text</label><textarea id="replay-answer">Paste a real replay answer from ChatGPT, Perplexity, Claude, or Gemini for scoring.</textarea></div>
        <div><button id="run-prompts">Build prompt pack</button><button id="run-replay">Replay answer</button><button id="run-dashboard">Visibility dashboard</button><button id="export-visibility">Export visibility evidence</button></div>
        <div class="status" id="prompt-status"></div>
        <div class="result" id="prompt-result"></div>
      </article>

      <article class="card">
        <h2>Research ingest</h2>
        <p>Normalize URLs or raw text into a deduped source ledger.</p>
        <div><label>URLs (one per line)</label><textarea id="research-urls">
</textarea></div>
        <div><label>Raw text (one per line)</label><textarea id="research-texts">GEO operators need source-ledger proof and automated publishing to beat thin AI SEO tools.</textarea></div>
        <div><button id="run-research">Ingest sources</button><button id="list-research">List sources</button></div>
        <div class="status" id="research-status"></div>
        <div class="result" id="research-result"></div>
      </article>

      <article class="card">
        <h2>Article brief + draft</h2>
        <p>Create a brief from persisted source IDs, then compose a stored draft with claim mapping.</p>
        <div><label>Source IDs (comma separated)</label><input id="brief-source-ids" placeholder="paste source ids after ingest" /></div>
        <div><label>Article title</label><input id="brief-title" value="How agencies win AI search with proof-backed operations" /></div>
        <div><label>Primary keyword</label><input id="brief-keyword" value="AI search growth platform" /></div>
        <div><label>Audience</label><input id="brief-audience" value="agency operators" /></div>
        <div><label>Goal</label><input id="brief-goal" value="increase qualified pipeline" /></div>
        <div><label>Brand</label><input id="brief-brand" value="Skye GEO Engine" /></div>
        <div><label>Language</label><input id="draft-language" value="English" /></div>
        <div><label>Tone</label><select id="draft-tone"><option value="operator">operator</option><option value="executive">executive</option><option value="technical">technical</option></select></div>
        <div><label>CTA</label><input id="draft-cta" value="Book a source-ledger growth audit and move into operator-grade publishing." /></div>
        <div><label>Brief ID</label><input id="brief-id" placeholder="filled after brief creation" /></div>
        <div><button id="run-brief">Create brief</button><button id="run-draft">Create draft</button><button id="list-drafts">List drafts</button></div>
        <div class="status" id="brief-status"></div>
        <div class="result" id="brief-result"></div>
      </article>

      <article class="card">
        <h2>Article enrichment pack</h2>
        <p>Turn a stored draft into schema JSON-LD, internal-link suggestions, metadata, and a publish-ready enrichment pack.</p>
        <div><label>Article ID</label><input id="enrich-article-id" placeholder="filled after draft creation" /></div>
        <div><button id="run-article-enrich">Generate enrichment</button><button id="list-article-enrichments">List enrichments</button><button id="export-article-enrich">Export enrichment pack</button></div>
        <div class="status" id="enrich-status"></div>
        <div class="result" id="enrich-result"></div>
      </article>

      <article class="card">
        <h2>Article review gate</h2>
        <p>Score the stored article for evidence coverage, SEO readiness, conversion readiness, and real publish blockers before sending anything to a CMS.</p>
        <div><label>Article ID</label><input id="review-article-id" placeholder="filled after draft creation" /></div>
        <div><button id="run-article-review">Generate review</button><button id="list-article-reviews">List reviews</button><button id="export-article-review">Export review pack</button></div>
        <div class="status" id="review-status"></div>
        <div class="result" id="review-result"></div>
      </article>

      <article class="card">
        <h2>Article remediation candidate</h2>
        <p>Turn the stored review findings into a stronger publish candidate with deeper source-backed copy, expanded FAQ coverage, and a predicted review score before CMS execution.</p>
        <div><label>Article ID</label><input id="remediate-article-id" placeholder="filled after draft creation" /></div>
        <div><button id="run-article-remediate">Generate remediation</button><button id="list-article-remediations">List remediations</button><button id="export-article-remediate">Export remediation pack</button></div>
        <div class="status" id="remediate-status"></div>
        <div class="result" id="remediate-result"></div>
      </article>

      <article class="card">
        <h2>Publish execute + retry</h2>
        <p>Build payloads, execute remote publish, retry failed runs, and export proof.</p>
        <div><label>Article ID</label><input id="publish-article-id" placeholder="filled after draft creation" /></div>
        <div><label>Publish Run ID</label><input id="publish-run-id" placeholder="filled after payload create" /></div>
        <div><label>Platform</label><select id="publish-platform"><option value="wordpress">wordpress</option><option value="webflow">webflow</option><option value="shopify">shopify</option><option value="wix">wix</option><option value="ghost">ghost</option><option value="generic-api">generic-api</option></select></div>
        <div><label>Target URL</label><input id="publish-target-url" placeholder="paste provider target URL" /></div>
        <div><label>Webflow Collection ID</label><input id="publish-collection-id" placeholder="paste webflow collection id" /></div>
        <div><label>Shopify Blog ID</label><input id="publish-blog-id" placeholder="paste shopify blog id" /></div>
        <div><label>Wix Member ID</label><input id="publish-member-id" placeholder="paste wix member id" /></div>
        <div><label>Ghost Accept-Version</label><input id="publish-ghost-version" value="v5.0" /></div>
        <div><label>Scheduled For (ISO)</label><input id="publish-scheduled-for" placeholder="2026-04-07T00:00:00.000Z" /></div>
        <div><button id="run-publish-payload">Store payload</button><button id="run-publish-execute">Execute publish</button><button id="run-publish-retry">Retry failed</button><button id="run-publish-queue">Queue</button><button id="run-publish-scheduled">Run scheduled</button><button id="export-publish">Export publish evidence</button></div>
        <div class="status" id="publish-status"></div>
        <div class="result" id="publish-result"></div>
      </article>



      <article class="card">
        <h2>Workspace bundles</h2>
        <p>Export a proof-grade workspace bundle, restore it into a fresh workspace, or clone the current workspace with full history remapping.</p>
        <div><label>Imported workspace name</label><input id="bundle-workspace-name" value="Restored Growth Workspace" /></div>
        <div><label>Bundle JSON</label><textarea id="bundle-json" placeholder="exported bundle appears here"></textarea></div>
        <div><button id="export-bundle">Export bundle</button><button id="import-bundle">Import bundle</button><button id="clone-bundle">Clone workspace</button></div>
        <div class="status" id="bundle-status"></div>
        <div class="result" id="bundle-result"></div>
      </article>

      <article class="card">
        <h2>Auth + agency</h2>
        <p>Create API keys, manage branding, seats, reseller clients, and invoice exports.</p>
        <div><label>Key label</label><input id="auth-key-label" value="Owner key" /></div>
        <div><label>Key role</label><select id="auth-key-role"><option value="owner">owner</option><option value="admin">admin</option><option value="editor">editor</option><option value="viewer">viewer</option></select></div>
        <div><label>Display name</label><input id="agency-display-name" value="Skye GEO Engine" /></div>
        <div><label>Logo URL</label><input id="agency-logo-url" placeholder="https://your-cdn.com/logo.png" /></div>
        <div><label>Primary color</label><input id="agency-primary-color" value="#8d7bff" /></div>
        <div><label>Custom domain</label><input id="agency-custom-domain" placeholder="paste custom domain" /></div>
        <div><label>Seat email</label><input id="seat-email" placeholder="operator@your-domain.com" /></div>
        <div><label>Seat role</label><select id="seat-role"><option value="admin">admin</option><option value="editor">editor</option><option value="viewer">viewer</option></select></div>
        <div><label>Client name</label><input id="client-name" value="Launch Partner" /></div>
        <div><label>Client email</label><input id="client-email" placeholder="client@your-domain.com" /></div>
        <div><button id="create-auth-key">Create API key</button><button id="list-auth-keys">List keys</button><button id="save-agency-settings">Save branding</button><button id="create-seat">Create seat</button><button id="create-client">Create client</button><button id="show-agency-usage">Usage</button><button id="export-invoice">Export invoice</button></div>
        <div class="status" id="agency-status"></div>
        <div class="result" id="agency-result"></div>
      </article>

      <article class="card">
        <h2>Backlink network ops</h2>
        <p>Register partner sites, queue placements with anchor diversity, reconcile live links, and review network health.</p>
        <div><label>Partner domain</label><input id="backlink-domain" value="authoritygrowth.com" /></div>
        <div><label>Partner name</label><input id="backlink-site-name" value="Authority Growth" /></div>
        <div><label>Topical tags (comma separated)</label><input id="backlink-tags" value="ai,search,growth,seo" /></div>
        <div><label>Owner fingerprint</label><input id="backlink-owner" value="owner-cluster-1" /></div>
        <div><label>Traffic / keywords / DR / sponsored ratio / outbound links</label><input id="backlink-metrics" value="180000|12000|68|0.12|22" /></div>
        <div><label>Partner Site IDs</label><input id="backlink-site-ids" placeholder="filled after site create" /></div>
        <div><label>Target URL</label><input id="backlink-target-url" placeholder="https://your-site.com/service" /></div>
        <div><label>Target keyword</label><input id="backlink-keyword" value="ai search growth platform" /></div>
        <div><label>Anchor options (comma separated)</label><input id="backlink-anchors" value="AI search growth platform,proof-backed GEO engine,operator-grade AI SEO" /></div>
        <div><label>Placement ID</label><input id="backlink-placement-id" placeholder="filled after placement queue" /></div>
        <div><label>Live URL</label><input id="backlink-live-url" value="https://authoritygrowth.com/posts/skye-geo-engine" /></div>
        <div><button id="create-backlink-site">Add site</button><button id="list-backlink-sites">List sites</button><button id="queue-backlink-placement">Queue placement</button><button id="reconcile-backlink">Reconcile live</button><button id="show-backlink-dashboard">Network dashboard</button></div>
        <div class="status" id="backlink-status"></div>
        <div class="result" id="backlink-result"></div>
      </article>

      <article class="card">
        <h2>Workspace history + evidence</h2>
        <p>Pull the full workspace ledger and list stored evidence exports.</p>
        <div><button id="run-history">Load history</button><button id="run-jobs">List jobs</button><button id="list-evidence">List evidence exports</button></div>
        <div class="status" id="history-status"></div>
        <div class="result" id="history-result"></div>
      </article>
    </section>

    <pre id="browser-smoke-report" data-state="idle" style="display:none; margin-top:16px; padding:12px; border:1px solid var(--line); border-radius:14px; background:#08111f; color:#9ad0ff; white-space:pre-wrap;"></pre>
    <section class="footer">Open items still blank until smoke-backed: live Neon proof and live provider publish proof. Target probes can prove reachability and blocker shape, but they do not upgrade local proof into live proof by themselves. The strategy, release-gate, walkthrough, runtime-contract, claim-evidence, proof-site, readiness, contract-truth, target-probe, proof matrix, article-review, article-remediation, and report surfaces are bound to the real capability registry and workspace ledger only.</section>
  </div>
<script>
function baseHeaders() {
  const headers = { 'content-type': 'application/json', 'x-org-id': document.getElementById('org-id').value || '' };
  const apiKey = document.getElementById('api-key').value.trim();
  if (apiKey) headers['x-api-key'] = apiKey;
  const workspaceId = document.getElementById('workspace-id').value.trim();
  const projectId = document.getElementById('project-id').value.trim();
  if (workspaceId) headers['x-workspace-id'] = workspaceId;
  if (projectId) headers['x-project-id'] = projectId;
  return headers;
}
async function send(path, method = 'GET', payload) {
  const response = await fetch(path, { method, headers: baseHeaders(), body: method === 'GET' ? undefined : JSON.stringify(payload || {}) });
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { ok:false, raw:text }; }
}
function show(target, data) { document.getElementById(target).textContent = JSON.stringify(data, null, 2); }
function status(target, value) { document.getElementById(target).textContent = value; }
function splitLines(id) { return document.getElementById(id).value.split('\\n').map((line) => line.trim()).filter(Boolean); }
function splitCsv(id) { return document.getElementById(id).value.split(',').map((line) => line.trim()).filter(Boolean); }
async function run(buttonId, statusId, resultId, fn) {
  const button = document.getElementById(buttonId); button.disabled = true; status(statusId, 'Working...');
  try { const data = await fn(); show(resultId, data); status(statusId, data.ok === false ? 'Failed.' : 'Done.'); return data; }
  catch (error) { show(resultId, { ok:false, error:String(error && error.message ? error.message : error) }); status(statusId, 'Failed.'); return null; }
  finally { button.disabled = false; }
}

document.getElementById('load-purpose').addEventListener('click', () => run('load-purpose','truth-status','truth-result', () => send('/v1/capabilities')));
document.getElementById('load-walkthroughs').addEventListener('click', () => run('load-walkthroughs','truth-status','truth-result', () => send('/v1/walkthroughs')));
document.getElementById('run-truth-validator').addEventListener('click', () => run('run-truth-validator','truth-status','truth-result', () => send('/v1/truth/validate','POST',{ mode: document.getElementById('truth-mode').value })));
document.getElementById('load-runtime-contracts').addEventListener('click', () => run('load-runtime-contracts','truth-status','truth-result', () => send('/v1/runtime/contracts')));
document.getElementById('validate-provider-contract').addEventListener('click', () => run('validate-provider-contract','truth-status','truth-result', () => send('/v1/providers/validate','POST',{ platform: document.getElementById('provider-contract-platform').value, targetUrl: document.getElementById('provider-contract-target').value || null })));
document.getElementById('load-proof-matrix').addEventListener('click', () => run('load-proof-matrix','report-status','report-result', () => send('/v1/proof/matrix')));
document.getElementById('load-walkthrough-run').addEventListener('click', () => run('load-walkthrough-run','report-status','report-result', () => send('/v1/walkthrough-runs')));
document.getElementById('load-report-summary').addEventListener('click', () => run('load-report-summary','report-status','report-result', () => send('/v1/reports/summary?audience=' + encodeURIComponent(document.getElementById('report-audience').value))));
document.getElementById('generate-report-site').addEventListener('click', () => run('generate-report-site','report-status','report-result', () => send('/v1/reports/site','POST',{ audience: document.getElementById('report-audience').value })));
document.getElementById('export-report-site').addEventListener('click', () => run('export-report-site','report-status','report-result', () => send('/v1/reports/export','POST',{ audience: document.getElementById('report-audience').value })));
document.getElementById('generate-proof-site').addEventListener('click', () => run('generate-proof-site','report-status','report-result', () => send('/v1/proof/site','POST', {})));
document.getElementById('run-readiness').addEventListener('click', () => run('run-readiness','readiness-status','readiness-result', () => send('/v1/readiness/run','POST', {})));
document.getElementById('list-readiness-runs').addEventListener('click', () => run('list-readiness-runs','readiness-status','readiness-result', () => send('/v1/readiness/runs')));
document.getElementById('load-claim-catalog').addEventListener('click', () => run('load-claim-catalog','readiness-status','readiness-result', () => send('/v1/claims/catalog')));
document.getElementById('load-claim-evidence').addEventListener('click', () => run('load-claim-evidence','readiness-status','readiness-result', () => send('/v1/claims/evidence')));
document.getElementById('export-contract-pack').addEventListener('click', () => run('export-contract-pack','readiness-status','readiness-result', () => send('/v1/contracts/export','POST', {})));
document.getElementById('load-strategy-scorecard').addEventListener('click', () => run('load-strategy-scorecard','strategy-status','strategy-result', () => send('/v1/strategy/scorecard')));
document.getElementById('load-strategy-actions').addEventListener('click', () => run('load-strategy-actions','strategy-status','strategy-result', () => send('/v1/strategy/actions')));
document.getElementById('export-strategy-pack').addEventListener('click', () => run('export-strategy-pack','strategy-status','strategy-result', () => send('/v1/strategy/export','POST', {})));
document.getElementById('load-release-gate').addEventListener('click', () => run('load-release-gate','release-status','release-result', () => send('/v1/release/gate')));
document.getElementById('load-release-drift').addEventListener('click', () => run('load-release-drift','release-status','release-result', () => send('/v1/release/drift')));
document.getElementById('export-release-pack').addEventListener('click', () => run('export-release-pack','release-status','release-result', () => send('/v1/release/export','POST', {})));
document.getElementById('load-target-summary').addEventListener('click', () => run('load-target-summary','targets-status','targets-result', () => send('/v1/targets/summary')));
document.getElementById('list-target-probes').addEventListener('click', () => run('list-target-probes','targets-status','targets-result', () => send('/v1/targets/probes')));
document.getElementById('run-target-probe').addEventListener('click', () => run('run-target-probe','targets-status','targets-result', () => send('/v1/targets/probe','POST',{ platform: document.getElementById('target-platform').value, targetUrl: document.getElementById('target-probe-url').value || null, collectionId: document.getElementById('publish-collection-id').value || null, blogId: document.getElementById('publish-blog-id').value || null, memberId: document.getElementById('publish-member-id').value || null, acceptVersion: document.getElementById('publish-ghost-version').value || null, authToken: document.getElementById('target-probe-auth').value || null })));
document.getElementById('export-target-pack').addEventListener('click', () => run('export-target-pack','targets-status','targets-result', () => send('/v1/targets/export','POST', {})));

document.getElementById('load-cutover-summary').addEventListener('click', () => run('load-cutover-summary','cutover-status','cutover-result', () => send('/v1/cutover/summary')));
document.getElementById('list-cutover-runs').addEventListener('click', () => run('list-cutover-runs','cutover-status','cutover-result', () => send('/v1/cutover/runs')));
document.getElementById('run-cutover').addEventListener('click', () => run('run-cutover','cutover-status','cutover-result', () => send('/v1/cutover/run','POST', {})));
document.getElementById('export-cutover-pack').addEventListener('click', () => run('export-cutover-pack','cutover-status','cutover-result', () => send('/v1/cutover/export','POST', {})));
document.getElementById('load-rollback-summary').addEventListener('click', () => run('load-rollback-summary','rollback-status','rollback-result', () => send('/v1/rollback/summary')));
document.getElementById('list-rollback-runs').addEventListener('click', () => run('list-rollback-runs','rollback-status','rollback-result', () => send('/v1/rollback/runs')));
document.getElementById('run-rollback').addEventListener('click', () => run('run-rollback','rollback-status','rollback-result', () => send('/v1/rollback/run','POST', {})));
document.getElementById('export-rollback-pack').addEventListener('click', () => run('export-rollback-pack','rollback-status','rollback-result', () => send('/v1/rollback/export','POST', {})));
document.getElementById('create-workspace').addEventListener('click', () => run('create-workspace','workspace-status','workspace-result', async () => {
  const data = await send('/v1/workspaces','POST',{ name: document.getElementById('workspace-name').value, brand: document.getElementById('workspace-brand').value, niche: document.getElementById('workspace-niche').value });
  if (data?.workspace?.id) document.getElementById('workspace-id').value = data.workspace.id; return data;
}));
document.getElementById('list-workspaces').addEventListener('click', () => run('list-workspaces','workspace-status','workspace-result', () => send('/v1/workspaces')));
document.getElementById('create-project').addEventListener('click', () => run('create-project','project-status','project-result', async () => {
  const data = await send('/v1/projects','POST',{ workspaceId: document.getElementById('workspace-id').value, name: document.getElementById('project-name').value, primaryUrl: document.getElementById('project-url').value, audience: document.getElementById('project-audience').value });
  if (data?.project?.id) document.getElementById('project-id').value = data.project.id; return data;
}));
document.getElementById('list-projects').addEventListener('click', () => run('list-projects','project-status','project-result', () => send('/v1/projects')));
document.getElementById('run-audit').addEventListener('click', () => run('run-audit','audit-status','audit-result', () => send('/v1/audit/site','POST',{ url: document.getElementById('audit-url').value })));
document.getElementById('export-audit').addEventListener('click', () => run('export-audit','audit-status','audit-result', () => send('/v1/evidence/export','POST',{ exportType:'audit' })));
document.getElementById('run-plan').addEventListener('click', () => run('run-plan','plan-status','plan-result', () => send('/v1/content/plan','POST',{ brand: document.getElementById('plan-brand').value, niche: document.getElementById('plan-niche').value, audience: document.getElementById('plan-audience').value })));
document.getElementById('run-prompts').addEventListener('click', () => run('run-prompts','prompt-status','prompt-result', async () => {
  const data = await send('/v1/visibility/prompt-pack','POST',{ brand: document.getElementById('prompt-brand').value, niche: document.getElementById('prompt-niche').value, market: document.getElementById('prompt-market').value, competitors: splitCsv('prompt-competitors') });
  if (data?.promptPack?.id) document.getElementById('prompt-pack-id').value = data.promptPack.id; return data;
}));
document.getElementById('run-replay').addEventListener('click', () => run('run-replay','prompt-status','prompt-result', () => send('/v1/visibility/replay','POST',{ promptPackId: document.getElementById('prompt-pack-id').value, answers:[{ provider:'ChatGPT', prompt:'What are the best AI search growth platforms?', answerText: document.getElementById('replay-answer').value }] })));
document.getElementById('run-dashboard').addEventListener('click', () => run('run-dashboard','prompt-status','prompt-result', () => send('/v1/visibility/dashboard')));
document.getElementById('export-visibility').addEventListener('click', () => run('export-visibility','prompt-status','prompt-result', () => send('/v1/visibility/export','POST',{})));
document.getElementById('run-research').addEventListener('click', () => run('run-research','research-status','research-result', async () => {
  const data = await send('/v1/research','POST',{ urls: splitLines('research-urls'), rawTexts: splitLines('research-texts') });
  const ids = [...(data.inserted || []), ...(data.deduped || [])].map((item) => item.id);
  if (ids.length) document.getElementById('brief-source-ids').value = ids.join(', '); return data;
}));
document.getElementById('list-research').addEventListener('click', () => run('list-research','research-status','research-result', () => send('/v1/research')));
document.getElementById('run-brief').addEventListener('click', () => run('run-brief','brief-status','brief-result', async () => {
  const data = await send('/v1/articles/brief','POST',{ title: document.getElementById('brief-title').value, primaryKeyword: document.getElementById('brief-keyword').value, audience: document.getElementById('brief-audience').value, goal: document.getElementById('brief-goal').value, brand: document.getElementById('brief-brand').value, sourceIds: splitCsv('brief-source-ids') });
  if (data?.brief?.id) document.getElementById('brief-id').value = data.brief.id; return data;
}));
document.getElementById('run-draft').addEventListener('click', () => run('run-draft','brief-status','brief-result', async () => {
  const data = await send('/v1/articles/draft','POST',{ briefId: document.getElementById('brief-id').value, brand: document.getElementById('brief-brand').value, language: document.getElementById('draft-language').value, tone: document.getElementById('draft-tone').value, callToAction: document.getElementById('draft-cta').value });
  if (data?.article?.id) { document.getElementById('publish-article-id').value = data.article.id; document.getElementById('enrich-article-id').value = data.article.id; document.getElementById('review-article-id').value = data.article.id; document.getElementById('remediate-article-id').value = data.article.id; }
  return data;
}));
document.getElementById('list-drafts').addEventListener('click', () => run('list-drafts','brief-status','brief-result', () => send('/v1/articles/draft')));
document.getElementById('run-article-enrich').addEventListener('click', () => run('run-article-enrich','enrich-status','enrich-result', () => send('/v1/articles/enrich','POST',{ articleId: document.getElementById('enrich-article-id').value || document.getElementById('publish-article-id').value })));
document.getElementById('list-article-enrichments').addEventListener('click', () => run('list-article-enrichments','enrich-status','enrich-result', () => send('/v1/articles/enrichments')));
document.getElementById('export-article-enrich').addEventListener('click', () => run('export-article-enrich','enrich-status','enrich-result', () => send('/v1/articles/enrich/export','POST',{ articleId: document.getElementById('enrich-article-id').value || document.getElementById('publish-article-id').value })));
document.getElementById('run-article-review').addEventListener('click', () => run('run-article-review','review-status','review-result', () => send('/v1/articles/review','POST',{ articleId: document.getElementById('review-article-id').value || document.getElementById('publish-article-id').value })));
document.getElementById('list-article-reviews').addEventListener('click', () => run('list-article-reviews','review-status','review-result', () => send('/v1/articles/reviews')));
document.getElementById('export-article-review').addEventListener('click', () => run('export-article-review','review-status','review-result', () => send('/v1/articles/review/export','POST',{ articleId: document.getElementById('review-article-id').value || document.getElementById('publish-article-id').value })));
document.getElementById('run-article-remediate').addEventListener('click', () => run('run-article-remediate','remediate-status','remediate-result', () => send('/v1/articles/remediate','POST',{ articleId: document.getElementById('remediate-article-id').value || document.getElementById('review-article-id').value || document.getElementById('publish-article-id').value })));
document.getElementById('list-article-remediations').addEventListener('click', () => run('list-article-remediations','remediate-status','remediate-result', () => send('/v1/articles/remediations')));
document.getElementById('export-article-remediate').addEventListener('click', () => run('export-article-remediate','remediate-status','remediate-result', () => send('/v1/articles/remediate/export','POST',{ articleId: document.getElementById('remediate-article-id').value || document.getElementById('review-article-id').value || document.getElementById('publish-article-id').value })));
document.getElementById('run-publish-payload').addEventListener('click', () => run('run-publish-payload','publish-status','publish-result', async () => {
  const data = await send('/v1/publish/payload','POST',{ platform: document.getElementById('publish-platform').value, articleId: document.getElementById('publish-article-id').value || undefined, scheduledFor: document.getElementById('publish-scheduled-for').value || undefined });
  if (data?.publishRun?.id) document.getElementById('publish-run-id').value = data.publishRun.id; return data;
}));
document.getElementById('run-publish-execute').addEventListener('click', () => run('run-publish-execute','publish-status','publish-result', () => send('/v1/publish/execute','POST',{ publishRunId: document.getElementById('publish-run-id').value, targetUrl: document.getElementById('publish-target-url').value, collectionId: document.getElementById('publish-collection-id').value, blogId: document.getElementById('publish-blog-id').value, memberId: document.getElementById('publish-member-id').value, acceptVersion: document.getElementById('publish-ghost-version').value })));
document.getElementById('run-publish-retry').addEventListener('click', () => run('run-publish-retry','publish-status','publish-result', () => send('/v1/publish/retry','POST',{ publishRunId: document.getElementById('publish-run-id').value, targetUrl: document.getElementById('publish-target-url').value, collectionId: document.getElementById('publish-collection-id').value, blogId: document.getElementById('publish-blog-id').value, memberId: document.getElementById('publish-member-id').value, acceptVersion: document.getElementById('publish-ghost-version').value })));
document.getElementById('run-publish-queue').addEventListener('click', () => run('run-publish-queue','publish-status','publish-result', () => send('/v1/publish/queue')));
document.getElementById('export-publish').addEventListener('click', () => run('export-publish','publish-status','publish-result', () => send('/v1/publish/export','POST',{})));
document.getElementById('run-history').addEventListener('click', () => run('run-history','history-status','history-result', () => send('/v1/history')));
document.getElementById('run-jobs').addEventListener('click', () => run('run-jobs','history-status','history-result', () => send('/v1/jobs')));
document.getElementById('list-evidence').addEventListener('click', () => run('list-evidence','history-status','history-result', () => send('/v1/evidence/exports')));

document.getElementById('run-publish-scheduled').addEventListener('click', () => run('run-publish-scheduled','publish-status','publish-result', () => send('/v1/publish/run-scheduled','POST',{ targetUrl: document.getElementById('publish-target-url').value, collectionId: document.getElementById('publish-collection-id').value, blogId: document.getElementById('publish-blog-id').value, memberId: document.getElementById('publish-member-id').value, acceptVersion: document.getElementById('publish-ghost-version').value })));

document.getElementById('export-bundle').addEventListener('click', () => run('export-bundle','bundle-status','bundle-result', async () => {
  const data = await send('/v1/workspace-bundles/export','POST',{});
  if (data?.bundle) document.getElementById('bundle-json').value = JSON.stringify(data.bundle, null, 2);
  return data;
}));
document.getElementById('import-bundle').addEventListener('click', () => run('import-bundle','bundle-status','bundle-result', async () => {
  const data = await send('/v1/workspace-bundles/import','POST',{ workspaceName: document.getElementById('bundle-workspace-name').value, bundleJson: document.getElementById('bundle-json').value });
  if (data?.workspace?.id) document.getElementById('workspace-id').value = data.workspace.id;
  return data;
}));
document.getElementById('clone-bundle').addEventListener('click', () => run('clone-bundle','bundle-status','bundle-result', async () => {
  const data = await send('/v1/workspace-bundles/clone','POST',{ sourceWorkspaceId: document.getElementById('workspace-id').value, workspaceName: document.getElementById('bundle-workspace-name').value + ' Clone' });
  return data;
}));
document.getElementById('create-auth-key').addEventListener('click', () => run('create-auth-key','agency-status','agency-result', async () => {
  const data = await send('/v1/auth/keys','POST',{ label: document.getElementById('auth-key-label').value, role: document.getElementById('auth-key-role').value });
  if (data?.secret) document.getElementById('api-key').value = data.secret; return data;
}));
document.getElementById('list-auth-keys').addEventListener('click', () => run('list-auth-keys','agency-status','agency-result', () => send('/v1/auth/keys')));
document.getElementById('save-agency-settings').addEventListener('click', () => run('save-agency-settings','agency-status','agency-result', () => send('/v1/agency/settings','POST',{ displayName: document.getElementById('agency-display-name').value, logoUrl: document.getElementById('agency-logo-url').value, primaryColor: document.getElementById('agency-primary-color').value, customDomain: document.getElementById('agency-custom-domain').value })));
document.getElementById('create-seat').addEventListener('click', () => run('create-seat','agency-status','agency-result', () => send('/v1/agency/seats','POST',{ email: document.getElementById('seat-email').value, role: document.getElementById('seat-role').value, status: 'active' })));
document.getElementById('create-client').addEventListener('click', () => run('create-client','agency-status','agency-result', () => send('/v1/agency/clients','POST',{ name: document.getElementById('client-name').value, contactEmail: document.getElementById('client-email').value, brandName: document.getElementById('client-name').value + ' Brand' })));
document.getElementById('show-agency-usage').addEventListener('click', () => run('show-agency-usage','agency-status','agency-result', () => send('/v1/agency/usage')));
document.getElementById('export-invoice').addEventListener('click', () => run('export-invoice','agency-status','agency-result', () => send('/v1/agency/invoices/export','POST',{})));
document.getElementById('create-backlink-site').addEventListener('click', () => run('create-backlink-site','backlink-status','backlink-result', async () => {
  const [monthlyTraffic, organicKeywords, domainRating, sponsoredRatio, outboundLinksPerMonth] = document.getElementById('backlink-metrics').value.split('|').map((item) => Number(item.trim() || 0));
  const data = await send('/v1/backlinks/sites','POST',{ domain: document.getElementById('backlink-domain').value, siteName: document.getElementById('backlink-site-name').value, topicalTags: splitCsv('backlink-tags'), ownerFingerprint: document.getElementById('backlink-owner').value, monthlyTraffic, organicKeywords, domainRating, sponsoredRatio, outboundLinksPerMonth });
  if (data?.site?.id) document.getElementById('backlink-site-ids').value = data.site.id; return data;
}));
document.getElementById('list-backlink-sites').addEventListener('click', () => run('list-backlink-sites','backlink-status','backlink-result', () => send('/v1/backlinks/sites')));
document.getElementById('queue-backlink-placement').addEventListener('click', () => run('queue-backlink-placement','backlink-status','backlink-result', async () => {
  const data = await send('/v1/backlinks/placements','POST',{ workspaceId: document.getElementById('workspace-id').value, partnerSiteIds: splitCsv('backlink-site-ids'), targetUrl: document.getElementById('backlink-target-url').value, targetKeyword: document.getElementById('backlink-keyword').value, targetTags: splitCsv('backlink-tags'), anchorOptions: splitCsv('backlink-anchors') });
  if (data?.queued?.[0]?.id) document.getElementById('backlink-placement-id').value = data.queued[0].id; return data;
}));
document.getElementById('reconcile-backlink').addEventListener('click', () => run('reconcile-backlink','backlink-status','backlink-result', () => send('/v1/backlinks/reconcile','POST',{ placementId: document.getElementById('backlink-placement-id').value, status: 'live', liveUrl: document.getElementById('backlink-live-url').value })));
document.getElementById('show-backlink-dashboard').addEventListener('click', () => run('show-backlink-dashboard','backlink-status','backlink-result', () => send('/v1/backlinks/dashboard')));

async function waitForUi(check, label, timeout = 12000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeout) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Timed out waiting for ' + label + (lastError ? ': ' + lastError : ''));
}
function parseResultJson(id) {
  const text = document.getElementById(id)?.textContent?.trim() || '';
  return text ? JSON.parse(text) : null;
}
function setFieldValue(id, value) {
  const el = document.getElementById(id);
  if (!el) throw new Error('Missing element ' + id);
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
async function runBrowserSmokeScenario() {
  const report = document.getElementById('browser-smoke-report');
  const params = new URLSearchParams(window.location.search);
  if (params.get('smoke') !== '1' || !report) return;
  report.style.display = 'block';
  report.dataset.state = 'running';
  report.textContent = JSON.stringify({ ok: false, state: 'running' }, null, 2);
  try {
    const origin = window.location.origin;
    setFieldValue('org-id', 'browser_org');
    setFieldValue('workspace-name', 'Browser Smoke Workspace');
    setFieldValue('workspace-brand', 'Skye GEO Engine');
    setFieldValue('workspace-niche', 'AI search growth');
    document.getElementById('create-workspace').click();
    const workspace = await waitForUi(() => parseResultJson('workspace-result')?.workspace, 'workspace result');

    setFieldValue('project-name', 'Browser Smoke Project');
    setFieldValue('project-url', origin + '/fixtures/source');
    setFieldValue('project-audience', 'operators');
    document.getElementById('create-project').click();
    const project = await waitForUi(() => parseResultJson('project-result')?.project, 'project result');

    setFieldValue('audit-url', origin + '/fixtures/source');
    document.getElementById('run-audit').click();
    const audit = await waitForUi(() => parseResultJson('audit-result')?.auditRun, 'audit result');

    setFieldValue('research-urls', origin + '/fixtures/source');
    setFieldValue('research-texts', 'Proof-backed operator workflows beat thin content tools.');
    document.getElementById('run-research').click();
    const research = await waitForUi(() => parseResultJson('research-result'), 'research result');
    const sourceIds = [...(research.inserted || []), ...(research.deduped || [])].map((item) => item.id).filter(Boolean);
    if (!sourceIds.length) throw new Error('Research flow returned zero source ids.');

    setFieldValue('brief-source-ids', sourceIds.join(', '));
    document.getElementById('run-brief').click();
    const brief = await waitForUi(() => parseResultJson('brief-result')?.brief, 'brief result');

    document.getElementById('run-draft').click();
    const article = await waitForUi(() => parseResultJson('brief-result')?.article, 'draft result');

    document.getElementById('run-article-enrich').click();
    const enrichmentPack = await waitForUi(() => parseResultJson('enrich-result')?.enrichmentPack, 'article enrichment');

    document.getElementById('export-article-enrich').click();
    const enrichmentPackHtml = await waitForUi(() => parseResultJson('enrich-result')?.enrichmentPackHtml, 'article enrichment export');

    document.getElementById('run-article-review').click();
    const articleReview = await waitForUi(() => parseResultJson('review-result')?.articleReview, 'article review');

    document.getElementById('export-article-review').click();
    const articleReviewHtml = await waitForUi(() => parseResultJson('review-result')?.articleReviewHtml, 'article review export');

    document.getElementById('run-article-remediate').click();
    const articleRemediation = await waitForUi(() => parseResultJson('remediate-result')?.articleRemediation, 'article remediation');

    document.getElementById('export-article-remediate').click();
    const articleRemediationHtml = await waitForUi(() => parseResultJson('remediate-result')?.articleRemediationHtml, 'article remediation export');

    setFieldValue('publish-platform', 'generic-api');
    setFieldValue('publish-target-url', origin + '/publisher.local/content/publish');
    document.getElementById('run-publish-payload').click();
    const publishPrepared = await waitForUi(() => { const run = parseResultJson('publish-result')?.publishRun; return run && run.status === 'prepared' ? run : null; }, 'publish payload');

    document.getElementById('run-publish-execute').click();
    const publishExecuted = await waitForUi(() => { const run = parseResultJson('publish-result')?.publishRun; return run && run.status === 'success' ? run : null; }, 'publish execute');

    setFieldValue('bundle-workspace-name', 'Browser Import Workspace');
    document.getElementById('export-bundle').click();
    const bundle = await waitForUi(() => parseResultJson('bundle-result')?.bundle, 'bundle export');
    if (!bundle?.history?.workspace?.id) throw new Error('Bundle export missing history workspace id.');

    document.getElementById('import-bundle').click();
    const imported = await waitForUi(() => { const item = parseResultJson('bundle-result')?.workspace; return item && item.id !== workspace.id ? item : null; }, 'bundle import');

    document.getElementById('clone-bundle').click();
    const cloned = await waitForUi(() => { const item = parseResultJson('bundle-result')?.workspace; return item && item.id !== imported.id ? item : null; }, 'bundle clone');

    setFieldValue('provider-contract-platform', 'generic-api');
    setFieldValue('provider-contract-target', origin + '/publisher.local/content/publish');
    document.getElementById('load-purpose').click();
    const purposePayload = await waitForUi(() => parseResultJson('truth-result')?.purpose, 'purpose result');

    document.getElementById('load-walkthroughs').click();
    const walkthroughs = await waitForUi(() => parseResultJson('truth-result')?.walkthroughs, 'walkthrough result');

    document.getElementById('run-truth-validator').click();
    const truthValidation = await waitForUi(() => parseResultJson('truth-result')?.validation, 'truth validation');

    document.getElementById('load-runtime-contracts').click();
    const runtimeContracts = await waitForUi(() => parseResultJson('truth-result')?.runtime, 'runtime contracts');

    document.getElementById('validate-provider-contract').click();
    const providerContract = await waitForUi(() => parseResultJson('truth-result')?.validation, 'provider contract validation');

    document.getElementById('run-readiness').click();
    const readinessRun = await waitForUi(() => parseResultJson('readiness-result')?.readinessRun, 'readiness run');

    document.getElementById('list-readiness-runs').click();
    const readinessItems = await waitForUi(() => { const items = parseResultJson('readiness-result')?.items; return Array.isArray(items) && items[0]?.exportType === 'readiness_run' ? items : null; }, 'readiness list');

    document.getElementById('load-claim-catalog').click();
    const claimCatalog = await waitForUi(() => { const items = parseResultJson('readiness-result')?.items; return Array.isArray(items) && items[0]?.moduleId ? items : null; }, 'claim catalog');

    document.getElementById('load-claim-evidence').click();
    const claimEvidence = await waitForUi(() => parseResultJson('readiness-result')?.claimEvidence, 'claim evidence');

    document.getElementById('export-contract-pack').click();
    const contractPack = await waitForUi(() => parseResultJson('readiness-result')?.contractPack, 'contract pack');

    document.getElementById('load-strategy-scorecard').click();
    const strategyScorecard = await waitForUi(() => parseResultJson('strategy-result')?.scorecard, 'strategy scorecard');

    document.getElementById('load-strategy-actions').click();
    const strategyActions = await waitForUi(() => { const item = parseResultJson('strategy-result'); return item?.actions?.length ? item : null; }, 'strategy actions');

    document.getElementById('export-strategy-pack').click();
    const strategyPack = await waitForUi(() => parseResultJson('strategy-result')?.strategyPack, 'strategy export');

    document.getElementById('load-release-gate').click();
    const releaseGate = await waitForUi(() => parseResultJson('release-result')?.gate, 'release gate');

    document.getElementById('load-release-drift').click();
    const releaseDrift = await waitForUi(() => parseResultJson('release-result')?.drift, 'release drift');

    setFieldValue('target-platform', 'generic-api');
    setFieldValue('target-probe-url', origin + '/publisher.local/content/publish');
    document.getElementById('load-target-summary').click();
    const targetSummaryBefore = await waitForUi(() => parseResultJson('targets-result')?.summary, 'target summary before');

    document.getElementById('run-target-probe').click();
    const targetProbe = await waitForUi(() => parseResultJson('targets-result')?.targetProbe, 'target probe');

    document.getElementById('list-target-probes').click();
    const targetProbeItems = await waitForUi(() => { const items = parseResultJson('targets-result')?.items; return Array.isArray(items) && items.length ? items : null; }, 'target probe list');

    document.getElementById('export-target-pack').click();
    const targetPack = await waitForUi(() => parseResultJson('targets-result')?.targetPack, 'target pack');

    document.getElementById('load-cutover-summary').click();
    const cutoverSummary = await waitForUi(() => parseResultJson('cutover-result')?.summary, 'cutover summary');

    document.getElementById('run-cutover').click();
    const cutoverRun = await waitForUi(() => parseResultJson('cutover-result')?.cutoverRun, 'cutover run');

    document.getElementById('list-cutover-runs').click();
    const cutoverItems = await waitForUi(() => { const items = parseResultJson('cutover-result')?.items; return Array.isArray(items) && items.length ? items : null; }, 'cutover runs');

    document.getElementById('export-cutover-pack').click();
    const cutoverPack = await waitForUi(() => parseResultJson('cutover-result')?.cutoverPack, 'cutover pack');

    document.getElementById('load-rollback-summary').click();
    const rollbackSummary = await waitForUi(() => parseResultJson('rollback-result')?.summary, 'rollback summary');

    document.getElementById('run-rollback').click();
    const rollbackRun = await waitForUi(() => parseResultJson('rollback-result')?.rollbackRun, 'rollback run');

    document.getElementById('list-rollback-runs').click();
    const rollbackItems = await waitForUi(() => { const items = parseResultJson('rollback-result')?.items; return Array.isArray(items) && items.length ? items : null; }, 'rollback runs');

    document.getElementById('export-rollback-pack').click();
    const rollbackPack = await waitForUi(() => parseResultJson('rollback-result')?.rollbackPack, 'rollback pack');

    document.getElementById('export-release-pack').click();
    const releasePack = await waitForUi(() => parseResultJson('release-result')?.releasePack, 'release export');

    document.getElementById('load-proof-matrix').click();
    const proofMatrix = await waitForUi(() => parseResultJson('report-result')?.matrix, 'proof matrix');

    document.getElementById('load-walkthrough-run').click();
    const walkthroughRun = await waitForUi(() => parseResultJson('report-result')?.walkthroughRun, 'workspace walkthrough run');

    document.getElementById('load-report-summary').click();
    const reportSummary = await waitForUi(() => parseResultJson('report-result')?.report, 'report summary');

    document.getElementById('generate-report-site').click();
    const reportSite = await waitForUi(() => { const item = parseResultJson('report-result'); return item?.html && item?.report ? item : null; }, 'report site');

    document.getElementById('export-report-site').click();
    const reportExport = await waitForUi(() => parseResultJson('report-result')?.exportRecord, 'report export');

    document.getElementById('generate-proof-site').click();
    const proofSitePayload = await waitForUi(() => { const item = parseResultJson('report-result'); return item?.html && item?.proofSite ? item : null; }, 'proof site');
    const proofSite = proofSitePayload.proofSite;

    document.getElementById('run-history').click();
    const history = await waitForUi(() => parseResultJson('history-result')?.history, 'history result');

    report.dataset.state = 'success';
    report.textContent = JSON.stringify({
      ok: true,
      checks: [
        'headless DOM-driven operator UI smoke',
        'workspace creation from UI',
        'project creation from UI',
        'audit from UI',
        'research/brief/draft from UI',
        'article enrichment from UI',
        'article review gate from UI',
        'article remediation candidate from UI',
        'generic publish execution from UI',
        'workspace bundle export/import/clone from UI',
        'workspace history readback from UI',
        'purpose manifest from UI',
        'walkthrough manifest from UI',
        'no-theater validator from UI',
        'runtime contracts from UI',
        'provider contract validation from UI',
        'readiness run from UI',
        'readiness history from UI',
        'claim catalog from UI',
        'claim evidence graph from UI',
        'contract pack export from UI',
        'proof matrix from UI',
        'workspace walkthrough completion from UI',
        'strategy scorecard from UI',
        'strategy action plan from UI',
        'strategy export from UI',
        'target probe summary from UI',
        'target probe execution from UI',
        'target pack export from UI',
        'cutover summary from UI',
        'cutover run from UI',
        'cutover pack export from UI',
        'rollback summary from UI',
        'rollback run from UI',
        'rollback pack export from UI',
        'release gate from UI',
        'release drift from UI',
        'release pack export from UI',
        'report site generation from UI',
        'report export from UI'
      ],
      summary: {
        workspaceId: workspace.id,
        projectId: project.id,
        auditRunId: audit.id,
        briefId: brief.id,
        articleId: article.id,
        enrichmentLinks: enrichmentPack.internalLinks?.length || 0,
        enrichmentHtmlLength: enrichmentPackHtml.length || 0,
        articleReviewScore: articleReview.overallScore || 0,
        articleReviewGate: articleReview.publishReadiness?.gate || 'blocked',
        articleReviewHtmlLength: articleReviewHtml.length || 0,
        articleRemediationScoreDelta: articleRemediation.scoreDelta || 0,
        articleRemediationPredictedScore: articleRemediation.predictedReview?.overallScore || 0,
        articleRemediationPredictedGate: articleRemediation.predictedReview?.publishReadiness?.gate || 'blocked',
        articleRemediationHtmlLength: articleRemediationHtml.length || 0,
        publishRunId: publishPrepared.id,
        publishStatus: publishExecuted.status,
        importedWorkspaceId: imported.id,
        clonedWorkspaceId: cloned.id,
        historyProjects: history.projects?.length || 0,
        historyPublishRuns: history.publishRuns?.length || 0,
        purposeModules: purposePayload.moduleCount || 0,
        walkthroughModules: walkthroughs.length || 0,
        truthIssues: truthValidation.issues?.length || 0,
        runtimeBlockedControls: runtimeContracts.summary?.blockedControls || 0,
        providerContractTruth: providerContract.executionTruth || 'blocked',
        readinessModules: readinessRun.summary?.modules || 0,
        readinessExports: readinessItems.length || 0,
        claimCatalogClaims: claimCatalog.length || 0,
        claimEvidenceClaims: claimEvidence.summary?.claims || 0,
        contractPackClaims: contractPack.claimCatalog?.length || 0,
        strategyScorecardModules: strategyScorecard.modules?.length || 0,
        strategyActions: strategyActions.actions?.length || 0,
        strategyPackActions: strategyPack.actions?.length || 0,
        targetSummaryBefore: targetSummaryBefore.summary?.probes || 0,
        targetProbeStatus: targetProbe.status || 'blocked',
        targetProbeItems: targetProbeItems.length || 0,
        targetPackActions: targetPack.nextActions?.length || 0,
        cutoverSummaryRuns: cutoverSummary.runs || 0,
        cutoverRunVerdict: cutoverRun.verdict || 'blocked',
        cutoverItems: cutoverItems.length || 0,
        cutoverPackVerdict: cutoverPack.run?.verdict || 'blocked',
        rollbackSummaryRuns: rollbackSummary.runs || 0,
        rollbackRunVerdict: rollbackRun.verdict || 'blocked',
        rollbackItems: rollbackItems.length || 0,
        rollbackPackVerdict: rollbackPack.run?.verdict || 'blocked',
        releaseGateVerdict: releaseGate.verdict || 'blocked',
        releaseDriftItems: releaseDrift.summary?.total || 0,
        releasePackVerdict: releasePack.gate?.verdict || 'blocked',
        releasePackExportId: parseResultJson('release-result')?.exportRecord?.id || null,
        proofMatrixModules: proofMatrix.summary?.modules || 0,
        walkthroughRunModules: walkthroughRun.summary?.modules || 0,
        reportAudience: reportSummary.audience || 'operator',
        reportExportId: reportExport.id || null,
        reportSiteLength: reportSite.html?.length || 0,
        proofSiteLength: proofSitePayload.html?.length || 0
      }
    }, null, 2);
  } catch (error) {
    report.dataset.state = 'error';
    report.textContent = JSON.stringify({ ok: false, error: String(error && error.message ? error.message : error) }, null, 2);
  }
}
runBrowserSmokeScenario();
</script>
</body>
</html>`;
}
