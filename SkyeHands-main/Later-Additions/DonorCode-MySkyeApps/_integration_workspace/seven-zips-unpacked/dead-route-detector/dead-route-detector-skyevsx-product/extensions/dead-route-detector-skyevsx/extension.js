const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');
const { scanWorkspaceFromPath } = require('./lib/scanner');
const { FindingsTreeProvider } = require('./lib/tree');

function getWorkspaceRoot() {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder ? folder.uri.fsPath : null;
}

function openFileAtIssue(issue) {
  if (!issue || !issue.file) return;
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return;
  const fileUri = vscode.Uri.file(path.join(workspaceRoot, issue.file));
  vscode.workspace.openTextDocument(fileUri).then((doc) => {
    vscode.window.showTextDocument(doc, { preview: false }).then((editor) => {
      const line = Math.max((issue.line || 1) - 1, 0);
      const range = new vscode.Range(line, 0, line, 0);
      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    });
  });
}

function createWebviewHtml(context, report) {
  const cssPath = path.join(context.extensionPath, 'media', 'report.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const tableSection = (title, items, columns) => {
    const rows = items.length
      ? items.map((item) => `<tr>${columns.map((col) => `<td>${escapeHtml(col.render(item))}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${columns.length}" class="empty">No findings in this section.</td></tr>`;
    return `
      <section class="section panel">
        <h2>${escapeHtml(title)}</h2>
        <div class="table-wrap">
          <table>
            <thead><tr>${columns.map((col) => `<th>${escapeHtml(col.title)}</th>`).join('')}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  };

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>${css}</style>
    <title>Dead Route Detector Report</title>
  </head>
  <body>
    <main class="main">
      <section class="hero">
        <div class="panel">
          <div class="eyebrow">SkyeVSX · dead route detector</div>
          <h1>Shipped-looking controls deserve real wiring.</h1>
          <p class="sub">Workspace: <strong>${escapeHtml(report.workspaceName)}</strong><br/>Generated: ${escapeHtml(report.generatedAt)}</p>
          <div class="section">
            <h2>Framework signals</h2>
            <div class="inline-list">
              ${(report.frameworkSignals.length ? report.frameworkSignals : ['no specific framework signals']).map((item) => `<span class="badge">${escapeHtml(item)}</span>`).join('')}
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="metric-grid">
            <div class="metric"><strong>${report.summary.deadRouteReferences}</strong><span>Dead route references</span></div>
            <div class="metric"><strong>${report.summary.orphanRoutes}</strong><span>Orphan routes</span></div>
            <div class="metric"><strong>${report.summary.unregisteredContributedCommands + report.summary.deadExecutedCommands + report.summary.deadMenuCommands + report.summary.deadKeybindingCommands}</strong><span>Dead command findings</span></div>
            <div class="metric"><strong>${report.summary.placeholderControls}</strong><span>Placeholder controls</span></div>
          </div>
        </div>
      </section>
      ${tableSection('Dead route references', report.deadRouteReferences, [
        { title: 'Path', render: (item) => item.path },
        { title: 'Kind', render: (item) => item.kind },
        { title: 'File', render: (item) => item.file },
        { title: 'Line', render: (item) => item.line || 1 }
      ])}
      ${tableSection('Orphan routes', report.orphanRoutes, [
        { title: 'Declared path', render: (item) => item.path },
        { title: 'Source', render: (item) => item.sourceKind },
        { title: 'File', render: (item) => item.file },
        { title: 'Line', render: (item) => item.line || 1 }
      ])}
      ${tableSection('Command issues', [
        ...report.commands.unregisteredContributed,
        ...report.commands.deadExecuted,
        ...report.commands.deadMenuCommands,
        ...report.commands.deadKeybindingCommands
      ], [
        { title: 'Command', render: (item) => item.command },
        { title: 'Issue', render: (item) => item.kind || 'command issue' },
        { title: 'File', render: (item) => item.file },
        { title: 'Line', render: (item) => item.line || 1 }
      ])}
      ${tableSection('Placeholder controls', report.placeholderControls, [
        { title: 'Value', render: (item) => item.rawValue },
        { title: 'Kind', render: (item) => item.kind },
        { title: 'File', render: (item) => item.file },
        { title: 'Line', render: (item) => item.line || 1 }
      ])}
    </main>
  </body>
  </html>`;
}

async function runScan(context, treeProvider) {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('Dead Route Detector needs an open workspace folder.');
    return null;
  }

  const config = vscode.workspace.getConfiguration('deadRouteDetector');
  const exclude = config.get('exclude', []);

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Dead Route Detector scanning workspace',
    cancellable: false
  }, async () => {
    return new Promise((resolve) => setTimeout(resolve, 50));
  });

  const report = scanWorkspaceFromPath(workspaceRoot, {
    workspaceName: vscode.workspace.workspaceFolders?.[0]?.name,
    exclude
  });

  await context.workspaceState.update('deadRouteDetector.latestReport', report);
  treeProvider.setReport(report);
  const totalIssues = report.summary.deadRouteReferences
    + report.summary.orphanRoutes
    + report.summary.placeholderControls
    + report.summary.deadExecutedCommands
    + report.summary.unregisteredContributedCommands
    + report.summary.deadMenuCommands
    + report.summary.deadKeybindingCommands;

  vscode.window.showInformationMessage(`Dead Route Detector finished. ${totalIssues} findings surfaced.`);
  return report;
}

async function showReport(context, treeProvider) {
  const report = context.workspaceState.get('deadRouteDetector.latestReport') || await runScan(context, treeProvider);
  if (!report) return;
  const panel = vscode.window.createWebviewPanel(
    'deadRouteDetector.report',
    'Dead Route Detector Report',
    vscode.ViewColumn.One,
    { enableFindWidget: true }
  );
  panel.webview.html = createWebviewHtml(context, report);
}

async function exportReport(context, treeProvider) {
  const report = context.workspaceState.get('deadRouteDetector.latestReport') || await runScan(context, treeProvider);
  if (!report) return;
  const target = await vscode.window.showSaveDialog({
    filters: { JSON: ['json'] },
    saveLabel: 'Export Report JSON',
    defaultUri: vscode.Uri.file(path.join(getWorkspaceRoot() || '', 'dead-route-detector-report.json'))
  });
  if (!target) return;
  await vscode.workspace.fs.writeFile(target, Buffer.from(JSON.stringify(report, null, 2), 'utf8'));
  vscode.window.showInformationMessage(`Dead Route Detector exported ${path.basename(target.fsPath)}`);
}

function activate(context) {
  const treeProvider = new FindingsTreeProvider();
  const view = vscode.window.createTreeView('deadRouteDetector.sidebar', { treeDataProvider: treeProvider });
  context.subscriptions.push(view);

  const cachedReport = context.workspaceState.get('deadRouteDetector.latestReport');
  if (cachedReport) {
    treeProvider.setReport(cachedReport);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('deadRouteDetector.scanWorkspace', () => runScan(context, treeProvider)),
    vscode.commands.registerCommand('deadRouteDetector.openReport', () => showReport(context, treeProvider)),
    vscode.commands.registerCommand('deadRouteDetector.exportReport', () => exportReport(context, treeProvider)),
    vscode.commands.registerCommand('deadRouteDetector.refresh', () => treeProvider.refresh()),
    vscode.commands.registerCommand('deadRouteDetector.openIssue', (issue) => openFileAtIssue(issue))
  );

  const config = vscode.workspace.getConfiguration('deadRouteDetector');
  if (config.get('scanOnStartup') && getWorkspaceRoot()) {
    setTimeout(() => runScan(context, treeProvider), 600);
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
