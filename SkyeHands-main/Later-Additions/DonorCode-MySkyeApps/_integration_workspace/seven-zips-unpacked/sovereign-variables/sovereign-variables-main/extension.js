const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

function activate(context) {
  const disposable = vscode.commands.registerCommand('sovereignVariables.open', () => {
    openSovereignVariables(context);
  });
  context.subscriptions.push(disposable);
}

function openSovereignVariables(context) {
  const panel = vscode.window.createWebviewPanel(
    'sovereignVariables',
    'Sovereign Variables • Skyes Over London',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
    }
  );

  const icon = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
  panel.iconPath = { light: icon, dark: icon };
  panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

  panel.webview.onDidReceiveMessage(async (message) => {
    try {
      if (message?.type === 'saveFile') {
        const uri = await vscode.window.showSaveDialog({
          saveLabel: 'Save Sovereign Variables Export',
          defaultUri: vscode.Uri.joinPath(context.globalStorageUri, message.name || 'sovereign-export.skye'),
          filters: inferFilters(message?.name)
        });
        if (!uri) {
          return;
        }
        await vscode.workspace.fs.writeFile(uri, Uint8Array.from(message.bytes || []));
        panel.webview.postMessage({ type: 'savedFile', path: displayPath(uri) });
        return;
      }

      if (message?.type === 'openFile') {
        const uris = await vscode.window.showOpenDialog({
          openLabel: 'Import Sovereign Variables Package',
          canSelectMany: false,
          filters: {
            'Sovereign Variables • Skyes Over London': ['skye', 'json', 'env', 'txt']
          }
        });
        if (!uris || !uris[0]) {
          return;
        }
        const fileUri = uris[0];
        const bytes = await vscode.workspace.fs.readFile(fileUri);
        panel.webview.postMessage({
          type: 'openedFile',
          name: path.basename(fileUri.fsPath || fileUri.path),
          bytes: Array.from(bytes)
        });
      }
    } catch (error) {
      panel.webview.postMessage({ type: 'hostError', message: error instanceof Error ? error.message : String(error) });
    }
  });
}

function inferFilters(name) {
  const ext = String(name || '').toLowerCase().split('.').pop();
  switch (ext) {
    case 'env': return { 'Environment files': ['env'], 'All files': ['*'] };
    case 'json': return { 'JSON files': ['json'], 'All files': ['*'] };
    case 'txt': return { 'Text files': ['txt'], 'All files': ['*'] };
    case 'skye':
    default:
      return { 'Sovereign Variables packages': ['skye'], 'All files': ['*'] };
  }
}

function displayPath(uri) {
  try {
    return uri.fsPath || uri.path || uri.toString();
  } catch {
    return uri.toString();
  }
}

function getWebviewHtml(webview, extensionUri) {
  const appDir = vscode.Uri.joinPath(extensionUri, 'media', 'app');
  const appDirUri = webview.asWebviewUri(appDir).toString().replace(/\/?$/, '/');
  const indexPath = vscode.Uri.joinPath(appDir, 'index.html');
  let html = fs.readFileSync(indexPath.fsPath, 'utf8');

  const inject = `
  <base href="${appDirUri}">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: blob:; media-src ${webview.cspSource} data: blob:; font-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; connect-src ${webview.cspSource} https: http: data: blob:; frame-src ${webview.cspSource}; worker-src ${webview.cspSource} blob:;">
  <script>
    window.__SVS_EXTENSION_HOST__ = true;
    window.__SVS_VSCODE__ = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
  </script>`;

  html = html.replace('</head>', `${inject}\n</head>`);
  return html;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
