const state = {
  currentReport: null,
  currentSource: '',
  baselineReport: null,
  baselineSource: '',
  currentDiff: null,
  lastExportMeta: null,
  lastDiffExportMeta: null,
  smokeSteps: []
};

function byId(id) {
  return document.getElementById(id);
}

function getFetchImpl() {
  if (typeof window.__deadRouteDetectorFetch === 'function') {
    return window.__deadRouteDetectorFetch.bind(window);
  }
  return window.fetch.bind(window);
}

function getScanner() {
  return window.DeadRouteScanner;
}

function getReportTools() {
  return window.DeadRouteReportTools;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readJsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function loadJson(url) {
  const response = await getFetchImpl()(url);
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.json();
}

function setStatus(message, badges = []) {
  byId('statusText').textContent = message;
  byId('statusBadges').innerHTML = badges.map((badge) => `<span class="badge">${escapeHtml(badge)}</span>`).join('');
}

function renderTable(title, items, columns) {
  const rows = items.length
    ? items.map((item) => `<tr>${columns.map((column) => `<td>${escapeHtml(column(item))}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${columns.length}" class="empty">No findings in this section.</td></tr>`;
  return `
    <section class="panel card">
      <h2>${escapeHtml(title)}</h2>
      <div class="table-wrap">
        <table>
          <thead><tr>${columns.map((column) => `<th>${escapeHtml(column.title)}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function commandIssueCount(report) {
  const summary = report.summary || {};
  return (summary.unregisteredContributedCommands || 0)
    + (summary.deadExecutedCommands || 0)
    + (summary.deadMenuCommands || 0)
    + (summary.deadKeybindingCommands || 0);
}

function renderReport(report) {
  const host = byId('reportHost');
  if (!report) {
    host.innerHTML = '';
    return;
  }
  host.innerHTML = `
    <section class="panel card">
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
    </section>
    ${renderTable('Dead route references', report.deadRouteReferences || [], [
      Object.assign((item) => item.path, { title: 'Path' }),
      Object.assign((item) => item.kind, { title: 'Kind' }),
      Object.assign((item) => `${item.file}:${item.line || 1}`, { title: 'Source' })
    ])}
    ${renderTable('Orphan routes', report.orphanRoutes || [], [
      Object.assign((item) => item.path, { title: 'Declared path' }),
      Object.assign((item) => item.sourceKind, { title: 'Source kind' }),
      Object.assign((item) => `${item.file}:${item.line || 1}`, { title: 'Source' })
    ])}
    ${renderTable('Command issues', [
      ...((report.commands && report.commands.unregisteredContributed) || []),
      ...((report.commands && report.commands.deadExecuted) || []),
      ...((report.commands && report.commands.deadMenuCommands) || []),
      ...((report.commands && report.commands.deadKeybindingCommands) || [])
    ], [
      Object.assign((item) => item.command, { title: 'Command' }),
      Object.assign((item) => item.kind || 'command issue', { title: 'Issue' }),
      Object.assign((item) => `${item.file}:${item.line || 1}`, { title: 'Source' })
    ])}
    ${renderTable('Placeholder controls', report.placeholderControls || [], [
      Object.assign((item) => item.rawValue, { title: 'Value' }),
      Object.assign((item) => item.kind, { title: 'Kind' }),
      Object.assign((item) => `${item.file}:${item.line || 1}`, { title: 'Source' })
    ])}
  `;
}

function diffIssueRow(issue) {
  return `${issue.issueType} · ${issue.path || issue.command || issue.rawValue || issue.kind || 'issue'} · ${issue.file}:${issue.line || 1}`;
}

function renderDiff(diff) {
  const host = byId('diffHost');
  if (!diff) {
    host.innerHTML = '';
    return;
  }
  host.innerHTML = `
    <section class="panel card">
      <h2>Regression diff summary</h2>
      <p class="lead">Baseline: <strong>${escapeHtml(diff.baselineWorkspace)}</strong> → Candidate: <strong>${escapeHtml(diff.candidateWorkspace)}</strong></p>
      <div class="metric-grid">
        <article class="metric"><strong>${diff.addedIssueCount}</strong><span>Added issues</span></article>
        <article class="metric"><strong>${diff.resolvedIssueCount}</strong><span>Resolved issues</span></article>
        <article class="metric"><strong>${diff.baselineIssueCount}</strong><span>Baseline issue count</span></article>
        <article class="metric"><strong>${diff.candidateIssueCount}</strong><span>Candidate issue count</span></article>
      </div>
      <div class="badges space-top">
        <span class="badge">added dead routes: ${diff.regressionSummary.added.deadRouteReferences}</span>
        <span class="badge">added placeholders: ${diff.regressionSummary.added.placeholderControls}</span>
        <span class="badge">added command findings: ${diff.regressionSummary.added.deadExecutedCommands + diff.regressionSummary.added.unregisteredContributedCommands + diff.regressionSummary.added.deadMenuCommands + diff.regressionSummary.added.deadKeybindingCommands}</span>
      </div>
    </section>
    ${renderTable('Added issues', diff.addedIssues || [], [
      Object.assign((item) => item.issueType, { title: 'Issue type' }),
      Object.assign((item) => item.path || item.command || item.rawValue || item.kind || 'issue', { title: 'Primary value' }),
      Object.assign((item) => `${item.file}:${item.line || 1}`, { title: 'Source' })
    ])}
    ${renderTable('Resolved issues', diff.resolvedIssues || [], [
      Object.assign((item) => item.issueType, { title: 'Issue type' }),
      Object.assign((item) => item.path || item.command || item.rawValue || item.kind || 'issue', { title: 'Primary value' }),
      Object.assign((item) => `${item.file}:${item.line || 1}`, { title: 'Source' })
    ])}
  `;
}

function updateButtons() {
  byId('exportReport').disabled = !state.currentReport;
  byId('exportReportMarkdown').disabled = !state.currentReport;
  byId('exportReportSarif').disabled = !state.currentReport;
  byId('pinBaseline').disabled = !state.currentReport;
  byId('compareBaseline').disabled = !(state.currentReport && state.baselineReport);
  byId('exportDiffJson').disabled = !state.currentDiff;
  byId('exportDiffMarkdown').disabled = !state.currentDiff;
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
  updateButtons();
}

function clearDiff() {
  state.currentDiff = null;
  state.lastDiffExportMeta = null;
  renderDiff(null);
  updateMeta();
}

function setCurrentReport(report, sourceLabel) {
  state.currentReport = report;
  state.currentSource = sourceLabel;
  renderReport(report);
  clearDiff();
  updateMeta();
}

function stripCommonRoot(entries) {
  const parts = entries
    .map((entry) => String(entry.path || '').split('/').filter(Boolean))
    .filter((segments) => segments.length);
  if (!parts.length) return entries;
  const first = parts[0][0];
  const shared = first && parts.every((segments) => segments[0] === first);
  if (!shared) return entries;
  return entries.map((entry) => {
    const segments = String(entry.path || '').split('/').filter(Boolean);
    return {
      ...entry,
      path: segments.slice(1).join('/') || (segments[segments.length - 1] || '')
    };
  });
}

async function filesToEntries(fileList) {
  const files = Array.from(fileList || []);
  const entries = [];
  for (const file of files) {
    const relativePath = file.webkitRelativePath || file.name;
    const text = await file.text();
    entries.push({ path: relativePath, text });
  }
  return stripCommonRoot(entries);
}

async function runScannerOnEntries(entries, workspaceName, sourceLabel) {
  const scanner = getScanner();
  if (!scanner || typeof scanner.scanWorkspaceEntries !== 'function') {
    throw new Error('Scanner core did not load.');
  }
  const report = scanner.scanWorkspaceEntries(entries, { workspaceName, workspaceRoot: workspaceName });
  setCurrentReport(report, sourceLabel);
  setStatus(`Scan finished for ${workspaceName}.`, [
    `${report.summary.filesScanned} files scanned`,
    `${report.summary.deadRouteReferences} dead route references`,
    `${report.summary.placeholderControls} placeholder controls`
  ]);
  return report;
}

async function runProofFixtureScan() {
  setStatus('Running included proof fixture…');
  const fixture = await loadJson('assets/proof-fixture.json');
  const report = await runScannerOnEntries(fixture.entries, fixture.workspaceName || 'proof-fixture', 'Included proof fixture scan');
  state.smokeSteps.push('runProofFixture');
  updateSmokeState({ lastAction: 'runProofFixture' });
  return report;
}

async function runSelectedFolderScan() {
  const input = byId('workspaceInput');
  if (!input || !input.files || !input.files.length) {
    setStatus('Choose a workspace folder first.');
    return null;
  }
  setStatus('Scanning selected folder…');
  const entries = await filesToEntries(input.files);
  const firstRaw = input.files[0]?.webkitRelativePath || input.files[0]?.name || 'selected-workspace';
  const workspaceName = firstRaw.includes('/') ? firstRaw.split('/')[0] : 'selected-workspace';
  const report = await runScannerOnEntries(entries, workspaceName, `Selected workspace folder (${workspaceName})`);
  state.smokeSteps.push('runWorkspaceScan');
  updateSmokeState({ lastAction: 'runWorkspaceScan' });
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


async function importBaselineReport() {
  const input = byId('baselineInput');
  if (!input || !input.files || !input.files.length) {
    setStatus('Choose a baseline report JSON first.');
    return null;
  }
  const file = input.files[0];
  const report = JSON.parse(await file.text());
  state.baselineReport = readJsonClone(report);
  state.baselineSource = `Imported baseline report (${file.name})`;
  state.lastDiffExportMeta = null;
  setStatus('Baseline report imported.', [file.name, `${report.summary.deadRouteReferences} baseline dead route references`]);
  state.smokeSteps.push('importBaseline');
  updateMeta();
  updateSmokeState({ lastAction: 'importBaseline', baselineSummary: report.summary, importedBaseline: file.name });
  return state.baselineReport;
}

function pinCurrentBaseline() {
  if (!state.currentReport) {
    setStatus('Load or scan a report first.');
    return null;
  }
  state.baselineReport = readJsonClone(state.currentReport);
  state.baselineSource = state.currentSource;
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
  if (!state.baselineReport || !state.currentReport) {
    setStatus('Pin a baseline and load a current report first.');
    return null;
  }
  const tools = getReportTools();
  state.currentDiff = tools.compareReports(state.baselineReport, state.currentReport);
  renderDiff(state.currentDiff);
  setStatus('Regression diff generated.', [
    `${state.currentDiff.addedIssueCount} added issues`,
    `${state.currentDiff.resolvedIssueCount} resolved issues`
  ]);
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

async function exportCurrentReport() {
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
  const tools = getReportTools();
  state.lastDiffExportMeta = downloadText(
    `${state.currentDiff.candidateWorkspace || 'dead-route-detector-diff'}-diff.md`,
    tools.renderDiffMarkdown(state.currentDiff),
    'text/markdown'
  );
  setStatus('Regression diff markdown exported.', [state.lastDiffExportMeta.fileName, `${state.lastDiffExportMeta.bytes} bytes`]);
  state.smokeSteps.push('exportDiffMarkdown');
  updateMeta();
  updateSmokeState({ lastAction: 'exportDiffMarkdown' });
  return state.lastDiffExportMeta;
}

function updateSmokeState(extra = {}) {
  const node = byId('smokeState');
  if (!node) return;
  node.textContent = JSON.stringify({
    status: extra.status || 'idle',
    smokeSteps: state.smokeSteps,
    source: state.currentSource,
    baselineSource: state.baselineSource,
    exportMeta: state.lastExportMeta,
    diffExportMeta: state.lastDiffExportMeta,
    summary: state.currentReport ? state.currentReport.summary : null,
    diff: state.currentDiff ? {
      addedIssueCount: state.currentDiff.addedIssueCount,
      resolvedIssueCount: state.currentDiff.resolvedIssueCount
    } : null,
    ...extra
  }, null, 2);
}

function setupPage() {
  byId('runProofFixture').addEventListener('click', () => runProofFixtureScan().catch((error) => setStatus(error.message)));
  byId('runWorkspaceScan').addEventListener('click', () => runSelectedFolderScan().catch((error) => setStatus(error.message)));
  byId('loadSampleReport').addEventListener('click', () => loadIncludedSampleReport().catch((error) => setStatus(error.message)));
  byId('baselineInput').addEventListener('change', () => importBaselineReport().catch((error) => setStatus(error.message)));
  byId('pinBaseline').addEventListener('click', () => pinCurrentBaseline());
  byId('compareBaseline').addEventListener('click', () => compareCurrentToBaseline());
  byId('exportReport').addEventListener('click', () => exportCurrentReport().catch((error) => setStatus(error.message)));
  byId('exportReportMarkdown').addEventListener('click', () => exportCurrentReportMarkdown());
  byId('exportReportSarif').addEventListener('click', () => exportCurrentReportSarif());
  byId('exportDiffJson').addEventListener('click', () => exportDiffJson());
  byId('exportDiffMarkdown').addEventListener('click', () => exportDiffMarkdown());

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  updateMeta();
  updateSmokeState();
}

setupPage();
