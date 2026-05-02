import assert from 'node:assert/strict';
import vm from 'node:vm';
import { appFetch } from '../src/index.ts';
import { renderApp } from '../src/ui/app.ts';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';

resetMemoryDbForTests();
resetPlatformStore();

const fixtureHtml = `<!doctype html><html lang="en"><head><title>Skye GEO Engine Fixture</title><meta name="description" content="Proof-backed AI search growth fixture page for DOM UI smoke." /><link rel="canonical" href="http://smoke.local/fixtures/source" /><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script></head><body><h1>Skye GEO Engine Fixture</h1><h2>Audit Evidence</h2><h2>Source Ledger</h2><p>This fixture page exists so the UI smoke can run a real audit, research ingest, brief, draft, publish, and bundle cycle.</p></body></html>`;

class FakeEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = !!init.bubbles;
    this.target = init.target || null;
  }
}

class FakeElement {
  constructor({ id, value = '', textContent = '', dataset = {} }) {
    this.id = id;
    this.value = value;
    this.textContent = textContent;
    this.dataset = { ...dataset };
    this.style = {};
    this.disabled = false;
    this.listeners = new Map();
  }

  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }

  dispatchEvent(event) {
    event.target = this;
    const callbacks = this.listeners.get(event.type) || [];
    for (const callback of callbacks) callback(event);
    return true;
  }

  click() {
    this.dispatchEvent(new FakeEvent('click', { target: this }));
  }
}

function decodeHtml(value) {
  return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function buildDocumentFromHtml(html, url) {
  const elements = new Map();
  const regex = /<([a-z0-9-]+)([^>]*\sid="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>|<([a-z0-9-]+)([^>]*\sid="([^"]+)"[^>]*)\s*\/?>/gi;
  let match;
  while ((match = regex.exec(html))) {
    const tag = match[1] || match[5];
    const attrs = match[2] || match[6] || '';
    const id = match[3] || match[7];
    const inner = match[4] || '';
    const valueMatch = attrs.match(/\svalue="([^"]*)"/i);
    const dataset = {};
    for (const dataMatch of attrs.matchAll(/\sdata-([a-z0-9-]+)="([^"]*)"/gi)) {
      const key = dataMatch[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      dataset[key] = decodeHtml(dataMatch[2]);
    }
    const text = tag === 'textarea' ? decodeHtml(inner) : '';
    elements.set(id, new FakeElement({ id, value: decodeHtml(valueMatch?.[1] || text || ''), textContent: '', dataset }));
  }
  return {
    readyState: 'complete',
    location: new URL(url),
    getElementById(id) {
      return elements.get(id) || null;
    }
  };
}

function wrapResponse(response, url) {
  return {
    url,
    status: response.status,
    ok: response.ok,
    headers: response.headers,
    text: () => response.text(),
    json: () => response.json(),
    arrayBuffer: () => response.arrayBuffer()
  };
}

async function localFetch(input, init = {}) {
  const request = input instanceof Request ? input : new Request(new URL(String(input), 'http://smoke.local').toString(), init);
  const url = new URL(request.url);
  if (url.pathname === '/fixtures/source') {
    return {
      url: request.url,
      status: 200,
      ok: true,
      headers: { get: (name) => name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null },
      text: async () => fixtureHtml
    };
  }
  if (url.pathname === '/robots.txt') {
    return { url: request.url, status: 200, ok: true, headers: { get: () => 'text/plain; charset=utf-8' }, text: async () => 'User-agent: *\nAllow: /' };
  }
  if (url.pathname === '/sitemap.xml') {
    return { url: request.url, status: 200, ok: true, headers: { get: () => 'application/xml; charset=utf-8' }, text: async () => '<urlset></urlset>' };
  }
  if (url.pathname === '/neon.local/sql') {
    return wrapResponse(new Response(JSON.stringify({ ok: true, service: 'neon-fixture' }), { status: 200, headers: { 'content-type': 'application/json' } }), request.url);
  }
  if (url.pathname === '/publisher.local/content/publish') {
    const bodyText = request.method === 'GET' ? '' : await request.text();
    const parsed = bodyText ? JSON.parse(bodyText) : {};
    const slug = parsed.slug || parsed.title?.toLowerCase?.().replace(/[^a-z0-9]+/g, '-') || 'published-entry';
    return wrapResponse(new Response(JSON.stringify({ ok: true, id: `generic_${slug}`, liveUrl: `${url.origin}/published/${slug}` }), { status: 200, headers: { 'content-type': 'application/json' } }), request.url);
  }
  return wrapResponse(await appFetch(request, { DB_MODE: 'memory' }), request.url);
}

const originalFetch = globalThis.fetch;
globalThis.fetch = localFetch;

const html = renderApp();
const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/i);
if (!scriptMatch) throw new Error('inline app script missing');
const inlineScript = scriptMatch[1];

const document = buildDocumentFromHtml(html, 'http://smoke.local/app?smoke=1');
const window = { location: document.location, document };
const context = vm.createContext({
  console,
  document,
  window,
  fetch: localFetch,
  Request,
  Response,
  Headers,
  URL,
  URLSearchParams,
  Event: FakeEvent,
  setTimeout,
  clearTimeout,
  Promise,
  JSON,
  globalThis: null
});
context.globalThis = context;
context.window.fetch = localFetch;
context.window.URLSearchParams = URLSearchParams;
context.window.Event = FakeEvent;
context.window.setTimeout = setTimeout;
context.window.clearTimeout = clearTimeout;

vm.runInContext(inlineScript, context, { timeout: 10000, filename: 'app-inline-ui.js' });

const reportEl = document.getElementById('browser-smoke-report');
assert.ok(reportEl, 'browser smoke report element missing');

const started = Date.now();
while (!['success', 'error'].includes(reportEl.dataset.state || '')) {
  if (Date.now() - started > 15000) throw new Error(`Timed out waiting for UI smoke report. Current: ${reportEl.textContent}`);
  await new Promise((resolve) => setTimeout(resolve, 100));
}

const report = JSON.parse(reportEl.textContent || '{}');
assert.equal(reportEl.dataset.state, 'success', report.error || 'UI smoke failed');
assert.equal(report.ok, true);
assert.ok(report.summary.workspaceId);
assert.ok(report.summary.projectId);
assert.ok(report.summary.auditRunId);
assert.ok(report.summary.articleId);
assert.equal(report.summary.enrichmentLinks >= 3, true);
assert.equal(report.summary.enrichmentHtmlLength > 500, true);
assert.equal(report.summary.articleReviewScore >= 1, true);
assert.equal(['ready','conditional','blocked'].includes(report.summary.articleReviewGate), true);
assert.equal(report.summary.articleReviewHtmlLength > 500, true);
assert.equal(report.summary.articleRemediationPredictedScore >= report.summary.articleReviewScore, true);
assert.equal(['ready','conditional','blocked'].includes(report.summary.articleRemediationPredictedGate), true);
assert.equal(report.summary.articleRemediationHtmlLength > 500, true);
assert.ok(report.summary.publishRunId);
assert.equal(report.summary.publishStatus, 'success');
assert.ok(report.summary.importedWorkspaceId);
assert.ok(report.summary.clonedWorkspaceId);
assert.equal(report.summary.historyProjects >= 1, true);
assert.equal(report.summary.historyPublishRuns >= 1, true);
assert.equal(report.summary.purposeModules >= 1, true);
assert.equal(report.summary.walkthroughModules >= 1, true);
assert.equal(report.summary.truthIssues, 0);
assert.equal(report.summary.runtimeBlockedControls, 0);
assert.equal(['local-proof-only','remote-target-ready','remote-proof-observed'].includes(report.summary.providerContractTruth), true);
assert.equal(report.summary.readinessModules >= 1, true);
assert.equal(report.summary.readinessExports >= 1, true);
assert.equal(report.summary.claimCatalogClaims >= 1, true);
assert.equal(report.summary.claimEvidenceClaims >= 1, true);
assert.equal(report.summary.contractPackClaims >= 1, true);
assert.equal(report.summary.strategyScorecardModules >= 1, true);
assert.equal(report.summary.strategyActions >= 1, true);
assert.equal(report.summary.strategyPackActions >= 1, true);
assert.equal(['conditional','blocked','ship-ready'].includes(report.summary.releaseGateVerdict), true);
assert.equal(report.summary.releaseDriftItems >= 1, true);
assert.equal(report.summary.targetProbeItems >= 1, true);
assert.equal(['reachable','blocked','unreachable'].includes(report.summary.targetProbeStatus), true);
assert.equal(['conditional','blocked','ship-ready'].includes(report.summary.releasePackVerdict), true);
assert.equal(report.summary.rollbackSummaryRuns >= 0, true);
assert.equal(['recoverable','conditional','blocked'].includes(report.summary.rollbackRunVerdict), true);
assert.equal(report.summary.rollbackItems >= 1, true);
assert.equal(['recoverable','conditional','blocked'].includes(report.summary.rollbackPackVerdict), true);
assert.ok(report.summary.releasePackExportId);
assert.equal(report.summary.proofMatrixModules >= 1, true);
assert.equal(report.summary.walkthroughRunModules >= 1, true);
assert.equal(report.summary.reportSiteLength > 500, true);
assert.ok(report.summary.reportExportId);
assert.equal(report.summary.proofSiteLength >= 1, true);

console.log(JSON.stringify(report, null, 2));
globalThis.fetch = originalFetch;
