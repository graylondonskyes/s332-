const state = {
  currentReport: null,
  currentSource: '',
  baselineReport: null,
  baselineSource: '',
  currentDiff: null,
  lastExportMeta: null,
  lastDiffExportMeta: null,
  smokeSteps: [],
  githubContext: null,
  baselineGithubContext: null
};

function byId(id) { return document.getElementById(id); }

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFetchImpl() {
  if (typeof window.__deadRouteDetectorFetch === 'function') {
    return window.__deadRouteDetectorFetch.bind(window);
  }
  return window.fetch.bind(window);
}

function getScanner() { return window.DeadRouteScanner; }
function getReportTools() { return window.DeadRouteReportTools; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

async function loadJson(url, options) {
  const response = await getFetchImpl()(url, options);
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.json();
}

async function loadText(url, options) {
  const response = await getFetchImpl()(url, options);
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.text();
}

function setStatus(message, badges = []) {
  byId('statusText').textContent = message;
  byId('statusBadges').innerHTML = badges.map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`).join('');
}

function commandIssueCount(report) {
  const summary = report.summary || {};
  return (summary.unregisteredContributedCommands || 0)
    + (summary.deadExecutedCommands || 0)
    + (summary.deadMenuCommands || 0)
    + (summary.deadKeybindingCommands || 0);
}

function renderTable(title, rows) {
  return `
    <section class="panel" style="margin-top:18px;">
      <h2>${escapeHtml(title)}</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item</th><th>Kind</th><th>Source</th></tr></thead>
          <tbody>
            ${rows.length ? rows.map((row) => `<tr><td>${escapeHtml(row.item)}</td><td>${escapeHtml(row.kind)}</td><td>${escapeHtml(row.source)}</td></tr>`).join('') : '<tr><td colspan="3">No findings in this section.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function githubContextBadges(context) {
  if (!context) return '';
  return `<div class="badges space-top">${Object.entries(context).map(([key, value]) => `<span class="badge">${escapeHtml(key)}: ${escapeHtml(value)}</span>`).join('')}</div>`;
}

function renderReport(report) {
  const host = byId('reportHost');
  if (!report) {
    host.innerHTML = '';
    return;
  }
  host.innerHTML = `
    <section class="panel" style="margin-top:18px;">
      <h2>Report summary</h2>
      <p class="lead">Workspace: <strong>${escapeHtml(report.workspaceName)}</strong> · Generated: ${escapeHtml(report.generatedAt)}</p>
      <div class="metric-grid">
        <article class="metric"><strong>${report.summary.deadRouteReferences}</strong><span>Dead route references</span></article>
        <article class="metric"><strong>${report.summary.orphanRoutes}</strong><span>Orphan routes</span></article>
        <article class="metric"><strong>${commandIssueCount(report)}</strong><span>Dead command findings</span></article>
        <article class="metric"><strong>${report.summary.placeholderControls}</strong><span>Placeholder controls</span></article>
      </div>
      <div class="badges space-top">
        ${(report.frameworkSignals || []).map((signal) => `<span class="badge">${escapeHtml(signal)}</span>`).join('') || '<span class="badge">no framework signals</span>'}
      </div>
      ${githubContextBadges(state.githubContext)}
    </section>
    ${renderTable('Dead route references', (report.deadRouteReferences || []).map((item) => ({ item: item.path, kind: item.kind, source: `${item.file}:${item.line || 1}` })))}
    ${renderTable('Orphan routes', (report.orphanRoutes || []).map((item) => ({ item: item.path, kind: item.sourceKind, source: `${item.file}:${item.line || 1}` })))}
    ${renderTable('Command issues', [
      ...((report.commands && report.commands.unregisteredContributed) || []),
      ...((report.commands && report.commands.deadExecuted) || []),
      ...((report.commands && report.commands.deadMenuCommands) || []),
      ...((report.commands && report.commands.deadKeybindingCommands) || [])
    ].map((item) => ({ item: item.command, kind: item.kind || 'command issue', source: `${item.file}:${item.line || 1}` })))}
    ${renderTable('Placeholder controls', (report.placeholderControls || []).map((item) => ({ item: item.rawValue, kind: item.kind, source: `${item.file}:${item.line || 1}` })))}
  `;
}

function renderDiff(diff) {
  const host = byId('diffHost');
  if (!diff) {
    host.innerHTML = '';
    return;
  }
  host.innerHTML = `
    <section class="panel" style="margin-top:18px;">
      <h2>Regression diff summary</h2>
      <p class="lead">Baseline: <strong>${escapeHtml(diff.baselineWorkspace)}</strong> → Candidate: <strong>${escapeHtml(diff.candidateWorkspace)}</strong></p>
      <div class="metric-grid">
        <article class="metric"><strong>${diff.addedIssueCount}</strong><span>Added issues</span></article>
        <article class="metric"><strong>${diff.resolvedIssueCount}</strong><span>Resolved issues</span></article>
        <article class="metric"><strong>${diff.baselineIssueCount}</strong><span>Baseline issue count</span></article>
        <article class="metric"><strong>${diff.candidateIssueCount}</strong><span>Candidate issue count</span></article>
      </div>
      ${githubContextBadges(state.baselineGithubContext)}
      ${githubContextBadges(state.githubContext)}
    </section>
    ${renderTable('Added issues', (diff.addedIssues || []).map((item) => ({ item: item.path || item.command || item.rawValue || item.kind || 'issue', kind: item.issueType, source: `${item.file}:${item.line || 1}` })))}
    ${renderTable('Resolved issues', (diff.resolvedIssues || []).map((item) => ({ item: item.path || item.command || item.rawValue || item.kind || 'issue', kind: item.issueType, source: `${item.file}:${item.line || 1}` })))}
  `;
}

function updateMeta() {
  byId('currentSource').textContent = state.currentSource || 'No report loaded.';
  byId('exportMeta').textContent = state.lastExportMeta
    ? `Report export ready: ${state.lastExportMeta.fileName} · ${state.lastExportMeta.bytes} bytes.`
    : 'Report export not generated yet.';
  byId('baselineSource').textContent = state.baselineSource || 'No baseline pinned.';
  byId('baselineMeta').textContent = state.baselineReport
    ? `Baseline summary: ${state.baselineReport.summary.deadRouteReferences} dead routes · ${state.baselineReport.summary.placeholderControls} placeholders.`
    : 'Pin the current report to enable regression compare.';
  byId('diffStatus').textContent = state.currentDiff
    ? `Regression diff ready: ${state.currentDiff.addedIssueCount} added · ${state.currentDiff.resolvedIssueCount} resolved.`
    : 'No comparison run yet.';
  byId('diffMeta').textContent = state.lastDiffExportMeta
    ? `Diff export ready: ${state.lastDiffExportMeta.fileName} · ${state.lastDiffExportMeta.bytes} bytes.`
    : 'Diff export not generated yet.';
  byId('exportReport').disabled = !state.currentReport;
  byId('exportReportMarkdown').disabled = !state.currentReport;
  byId('exportReportSarif').disabled = !state.currentReport;
  byId('exportReviewComment').disabled = !state.currentDiff;
  byId('pinBaseline').disabled = !state.currentReport;
  byId('compareBaseline').disabled = !(state.currentReport && state.baselineReport);
  byId('exportDiffJson').disabled = !state.currentDiff;
  byId('exportDiffMarkdown').disabled = !state.currentDiff;
}

function clearDiff() {
  state.currentDiff = null;
  state.lastDiffExportMeta = null;
  renderDiff(null);
  updateMeta();
}

function setCurrentReport(report, sourceLabel, githubContext = null) {
  state.currentReport = report;
  state.currentSource = sourceLabel;
  state.githubContext = githubContext;
  renderReport(report);
  clearDiff();
  updateMeta();
}

function normalizeGitHubInput(value) {
  return String(value || '').trim().replace(/\/$/, '');
}

function parseGitHubTarget(rawValue, refOverride, apiBase, token) {
  const value = normalizeGitHubInput(rawValue);
  if (!value) throw new Error('Enter a GitHub repository URL, pull request URL, or owner/repo value.');
  const safeApiBase = normalizeGitHubInput(apiBase || 'https://api.github.com');
  const tokenValue = String(token || '').trim();
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    const [owner, repo] = value.split('/');
    return { type: 'repo', owner, repo, ref: refOverride || '', apiBase: safeApiBase, token: tokenValue, source: value };
  }

  const url = new URL(value);
  if (!/github\.com$/i.test(url.hostname)) {
    throw new Error('GitHub target must point to github.com.');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) throw new Error('GitHub URL must include owner and repository.');
  const [owner, repo, third, fourth] = parts;
  if (third === 'pull' && fourth) {
    return { type: 'pull', owner, repo, pullNumber: fourth, ref: refOverride || '', apiBase: safeApiBase, token: tokenValue, source: value };
  }
  if (third === 'tree' && fourth) {
    return { type: 'repo', owner, repo, ref: refOverride || decodeURIComponent(fourth), apiBase: safeApiBase, token: tokenValue, source: value };
  }
  return { type: 'repo', owner, repo, ref: refOverride || '', apiBase: safeApiBase, token: tokenValue, source: value };
}

function githubHeaders(token) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function joinGithubApi(base, pathName, params = {}) {
  const url = new URL(pathName, `${base.replace(/\/$/, '')}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

function isTextCandidate(filePath) {
  const scanner = getScanner() || {};
  const textExtensions = Array.isArray(scanner.TEXT_EXTENSIONS)
    ? scanner.TEXT_EXTENSIONS
    : ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.html', '.htm', '.vue', '.svelte', '.astro', '.md', '.txt'];
  const dot = filePath.lastIndexOf('.');
  const ext = dot >= 0 ? filePath.slice(dot).toLowerCase() : '';
  return textExtensions.includes(ext);
}

function decodeGithubContent(content) {
  const cleaned = String(content || '').replace(/\n/g, '');
  const binary = atob(cleaned);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

async function fetchGithubFile(owner, repo, filePath, ref, apiBase, token) {
  const url = joinGithubApi(apiBase, `/repos/${owner}/${repo}/contents/${filePath}`, ref ? { ref } : {});
  const payload = await loadJson(url, { headers: githubHeaders(token) });
  if (typeof payload.content === 'string') return decodeGithubContent(payload.content);
  if (payload.download_url) return loadText(payload.download_url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  throw new Error(`Unable to load file contents for ${filePath}`);
}

async function collectRepoEntries(owner, repo, ref, apiBase, token, dirPath = '', entries = []) {
  const endpoint = dirPath ? `/repos/${owner}/${repo}/contents/${dirPath}` : `/repos/${owner}/${repo}/contents`;
  const payload = await loadJson(joinGithubApi(apiBase, endpoint, ref ? { ref } : {}), { headers: githubHeaders(token) });
  const items = Array.isArray(payload) ? payload : [payload];
  for (const item of items) {
    if (item.type === 'dir') {
      await collectRepoEntries(owner, repo, ref, apiBase, token, item.path, entries);
      continue;
    }
    if (item.type !== 'file' || !isTextCandidate(item.path)) continue;
    const text = await fetchGithubFile(owner, repo, item.path, ref, apiBase, token);
    entries.push({ path: item.path, text });
  }
  return entries;
}

async function collectPullRequestEntries(owner, repo, pullNumber, refOverride, apiBase, token) {
  const pull = await loadJson(joinGithubApi(apiBase, `/repos/${owner}/${repo}/pulls/${pullNumber}`), { headers: githubHeaders(token) });
  const headRef = refOverride || (pull.head && (pull.head.sha || pull.head.ref)) || '';
  const files = [];
  for (let page = 1; page <= 10; page += 1) {
    const payload = await loadJson(joinGithubApi(apiBase, `/repos/${owner}/${repo}/pulls/${pullNumber}/files`, { per_page: '100', page: String(page) }), { headers: githubHeaders(token) });
    if (!Array.isArray(payload) || !payload.length) break;
    files.push(...payload);
    if (payload.length < 100) break;
  }
  const entries = [];
  for (const item of files) {
    if (!item || item.status === 'removed' || !isTextCandidate(item.filename)) continue;
    const text = await fetchGithubFile(owner, repo, item.filename, headRef, apiBase, token);
    entries.push({ path: item.filename, text });
  }
  return { entries, headRef, changedFileCount: files.length };
}

async function scanGitHubTarget() {
  const target = parseGitHubTarget(
    byId('githubTarget')?.value || '',
    byId('githubRef')?.value || '',
    byId('githubApiBase')?.value || 'https://api.github.com',
    byId('githubToken')?.value || ''
  );
  const scanner = getScanner();
  if (!scanner || typeof scanner.scanWorkspaceEntries !== 'function') throw new Error('Scanner core did not load.');

  setStatus(`Scanning GitHub ${target.type === 'pull' ? 'pull request' : 'repository'}…`);
  let report;
  if (target.type === 'repo') {
    const entries = await collectRepoEntries(target.owner, target.repo, target.ref, target.apiBase, target.token);
    report = scanner.scanWorkspaceEntries(entries, {
      workspaceName: `${target.owner}/${target.repo}${target.ref ? `@${target.ref}` : ''}`,
      workspaceRoot: `${target.owner}/${target.repo}`
    });
    setCurrentReport(report, `GitHub repository scan (${target.owner}/${target.repo})`, {
      owner: target.owner,
      repo: target.repo,
      mode: 'repository',
      ref: target.ref || 'default'
    });
    setStatus('GitHub repository scan finished.', [
      `${entries.length} text files`,
      `${report.summary.deadRouteReferences} dead route references`,
      `${report.summary.placeholderControls} placeholder controls`
    ]);
  } else {
    const prResult = await collectPullRequestEntries(target.owner, target.repo, target.pullNumber, target.ref, target.apiBase, target.token);
    report = scanner.scanWorkspaceEntries(prResult.entries, {
      workspaceName: `${target.owner}/${target.repo}#PR-${target.pullNumber}`,
      workspaceRoot: `${target.owner}/${target.repo}`
    });
    setCurrentReport(report, `GitHub pull request scan (${target.owner}/${target.repo}#${target.pullNumber})`, {
      owner: target.owner,
      repo: target.repo,
      mode: 'pull request',
      pull: `#${target.pullNumber}`,
      ref: prResult.headRef || 'head'
    });
    setStatus('GitHub pull request scan finished.', [
      `${prResult.changedFileCount} changed files listed`,
      `${prResult.entries.length} text files scanned`,
      `${report.summary.deadRouteReferences} dead route references`
    ]);
  }
  state.smokeSteps.push(`scanGithub:${target.type}`);
  updateSmokeState({ lastAction: `scanGithub:${target.type}` });
  return report;
}

async function loadIncludedSampleReport() {
  setStatus('Loading included sample report…');
  const report = await loadJson('assets/sample-report.json');
  setCurrentReport(report, 'Included sample report');
  setStatus('Included sample report loaded.', [`${report.summary.deadRouteReferences} dead route references shown`]);
  state.smokeSteps.push('loadSampleReport');
  updateSmokeState({ lastAction: 'loadSampleReport' });
  return report;
}

async function runProofFixtureScan() {
  setStatus('Running included proof fixture…');
  const fixture = await loadJson('assets/proof-fixture.json');
  const report = getScanner().scanWorkspaceEntries(fixture.entries, {
    workspaceName: fixture.workspaceName || 'proof-fixture',
    workspaceRoot: fixture.workspaceName || 'proof-fixture'
  });
  setCurrentReport(report, 'Included proof fixture scan');
  setStatus('Included proof fixture scan finished.', [`${report.summary.filesScanned} files`, `${report.summary.deadRouteReferences} dead route references`]);
  state.smokeSteps.push('runProofFixture');
  updateSmokeState({ lastAction: 'runProofFixture' });
  return report;
}


async function importBaselineReport() {
  const input = byId('baselineInput');
  if (!input || !input.files || !input.files.length) {
    setStatus('Choose a baseline report JSON first.');
    return null;
  }
  const file = input.files[0];
  const report = JSON.parse(await file.text());
  state.baselineReport = clone(report);
  state.baselineSource = `Imported baseline report (${file.name})`;
  state.lastDiffExportMeta = null;
  setStatus('Baseline report imported.', [file.name, `${report.summary.deadRouteReferences} baseline dead route references`]);
  state.smokeSteps.push('importBaseline');
  updateMeta();
  updateSmokeState({ lastAction: 'importBaseline', importedBaseline: file.name, baselineSummary: report.summary });
  return state.baselineReport;
}

function pinCurrentBaseline() {
  if (!state.currentReport) {
    setStatus('Load a report first.');
    return null;
  }
  state.baselineReport = clone(state.currentReport);
  state.baselineSource = state.currentSource;
  state.baselineGithubContext = state.githubContext ? clone(state.githubContext) : null;
  state.lastDiffExportMeta = null;
  setStatus('Current report pinned as baseline.', [
    state.baselineSource,
    `${state.baselineReport.summary.deadRouteReferences} baseline dead route references`
  ]);
  state.smokeSteps.push('pinBaseline');
  updateMeta();
  updateSmokeState({ lastAction: 'pinBaseline', baselineSummary: state.baselineReport.summary });
  return state.baselineReport;
}

function compareCurrentToBaseline() {
  if (!state.currentReport || !state.baselineReport) {
    setStatus('Pin a baseline and scan a current target first.');
    return null;
  }
  state.currentDiff = getReportTools().compareReports(state.baselineReport, state.currentReport);
  renderDiff(state.currentDiff);
  setStatus('Regression diff generated.', [`${state.currentDiff.addedIssueCount} added issues`, `${state.currentDiff.resolvedIssueCount} resolved issues`]);
  state.smokeSteps.push('compareBaseline');
  updateMeta();
  updateSmokeState({ lastAction: 'compareBaseline', diffSummary: state.currentDiff.regressionSummary });
  return state.currentDiff;
}

function downloadText(fileName, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return { fileName, bytes: blob.size };
}

function exportCurrentReportMarkdown() {
  if (!state.currentReport) {
    setStatus('No report loaded yet.');
    return null;
  }
  state.lastExportMeta = downloadText(
    `${state.currentReport.workspaceName || 'dead-route-detector-report'}.md`,
    getReportTools().renderReportMarkdown(state.currentReport),
    'text/markdown'
  );
  setStatus('Current report markdown exported.', [state.lastExportMeta.fileName, `${state.lastExportMeta.bytes} bytes`]);
  state.smokeSteps.push('exportReportMarkdown');
  updateMeta();
  updateSmokeState({ lastAction: 'exportReportMarkdown' });
  return state.lastExportMeta;
}

function exportCurrentReportSarif() {
  if (!state.currentReport) {
    setStatus('No report loaded yet.');
    return null;
  }
  state.lastExportMeta = downloadText(
    `${state.currentReport.workspaceName || 'dead-route-detector-report'}.sarif`,
    JSON.stringify(getReportTools().toSarif(state.currentReport), null, 2),
    'application/sarif+json'
  );
  setStatus('Current report SARIF exported.', [state.lastExportMeta.fileName, `${state.lastExportMeta.bytes} bytes`]);
  state.smokeSteps.push('exportReportSarif');
  updateMeta();
  updateSmokeState({ lastAction: 'exportReportSarif' });
  return state.lastExportMeta;
}

function exportReviewComment() {
  if (!state.currentDiff) {
    setStatus('Run a comparison first.');
    return null;
  }
  state.lastDiffExportMeta = downloadText(
    `${state.currentDiff.candidateWorkspace || 'dead-route-detector-diff'}-review-comment.md`,
    getReportTools().renderPullRequestComment(state.currentDiff, state.githubContext || {}),
    'text/markdown'
  );
  setStatus('PR review comment markdown exported.', [state.lastDiffExportMeta.fileName, `${state.lastDiffExportMeta.bytes} bytes`]);
  state.smokeSteps.push('exportReviewComment');
  updateMeta();
  updateSmokeState({ lastAction: 'exportReviewComment' });
  return state.lastDiffExportMeta;
}

function exportCurrentReport() {
  if (!state.currentReport) {
    setStatus('No report loaded yet.');
    return null;
  }
  state.lastExportMeta = downloadText(
    `${state.currentReport.workspaceName || 'dead-route-detector-report'}.json`,
    JSON.stringify(state.currentReport, null, 2),
    'application/json'
  );
  setStatus('Current report exported.', [state.lastExportMeta.fileName, `${state.lastExportMeta.bytes} bytes`]);
  state.smokeSteps.push('exportReport');
  updateMeta();
  updateSmokeState({ lastAction: 'exportReport' });
  return state.lastExportMeta;
}

function exportDiffJson() {
  if (!state.currentDiff) {
    setStatus('Run a comparison first.');
    return null;
  }
  state.lastDiffExportMeta = downloadText(
    `${state.currentDiff.candidateWorkspace || 'dead-route-detector-diff'}-diff.json`,
    JSON.stringify(state.currentDiff, null, 2),
    'application/json'
  );
  setStatus('Regression diff JSON exported.', [state.lastDiffExportMeta.fileName, `${state.lastDiffExportMeta.bytes} bytes`]);
  state.smokeSteps.push('exportDiffJson');
  updateMeta();
  updateSmokeState({ lastAction: 'exportDiffJson' });
  return state.lastDiffExportMeta;
}

function exportDiffMarkdown() {
  if (!state.currentDiff) {
    setStatus('Run a comparison first.');
    return null;
  }
  state.lastDiffExportMeta = downloadText(
    `${state.currentDiff.candidateWorkspace || 'dead-route-detector-diff'}-diff.md`,
    getReportTools().renderDiffMarkdown(state.currentDiff),
    'text/markdown'
  );
  setStatus('Regression diff markdown exported.', [state.lastDiffExportMeta.fileName, `${state.lastDiffExportMeta.bytes} bytes`]);
  state.smokeSteps.push('exportDiffMarkdown');
  updateMeta();
  updateSmokeState({ lastAction: 'exportDiffMarkdown' });
  return state.lastDiffExportMeta;
}

function updateSmokeState(extra = {}) {
  byId('smokeState').textContent = JSON.stringify({
    status: extra.status || 'idle',
    smokeSteps: state.smokeSteps,
    source: state.currentSource,
    baselineSource: state.baselineSource,
    githubContext: state.githubContext,
    baselineGithubContext: state.baselineGithubContext,
    exportMeta: state.lastExportMeta,
    diffExportMeta: state.lastDiffExportMeta,
    summary: state.currentReport ? state.currentReport.summary : null,
    diff: state.currentDiff ? { addedIssueCount: state.currentDiff.addedIssueCount, resolvedIssueCount: state.currentDiff.resolvedIssueCount } : null,
    ...extra
  }, null, 2);
}

function setup() {
  byId('runProofFixture').addEventListener('click', () => runProofFixtureScan().catch((error) => setStatus(error.message)));
  byId('loadSampleReport').addEventListener('click', () => loadIncludedSampleReport().catch((error) => setStatus(error.message)));
  byId('baselineInput').addEventListener('change', () => importBaselineReport().catch((error) => setStatus(error.message)));
  byId('exportReport').addEventListener('click', () => exportCurrentReport());
  byId('exportReportMarkdown').addEventListener('click', () => exportCurrentReportMarkdown());
  byId('exportReportSarif').addEventListener('click', () => exportCurrentReportSarif());
  byId('exportReviewComment').addEventListener('click', () => exportReviewComment());
  byId('scanGithubTarget').addEventListener('click', () => scanGitHubTarget().catch((error) => setStatus(error.message)));
  byId('pinBaseline').addEventListener('click', () => pinCurrentBaseline());
  byId('compareBaseline').addEventListener('click', () => compareCurrentToBaseline());
  byId('exportDiffJson').addEventListener('click', () => exportDiffJson());
  byId('exportDiffMarkdown').addEventListener('click', () => exportDiffMarkdown());
  updateMeta();
  updateSmokeState();
}

setup();
