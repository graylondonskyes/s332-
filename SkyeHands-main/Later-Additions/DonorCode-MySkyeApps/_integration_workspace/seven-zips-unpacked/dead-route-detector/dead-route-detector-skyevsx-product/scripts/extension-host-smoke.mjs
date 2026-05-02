import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Module from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const productRoot = path.resolve(__dirname, '..');
const extensionRoot = path.join(productRoot, 'extensions', 'dead-route-detector-skyevsx');
const workspaceRoot = path.join(productRoot, 'examples', 'broken-ui');
const packageJson = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'package.json'), 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function runExtensionHostSmoke() {
  const commandMap = new Map();
  const state = {
    infoMessages: [],
    warningMessages: [],
    webviews: [],
    openedFiles: [],
    writtenFiles: [],
    refreshCount: 0,
    progressCalls: 0,
    selectionSet: false,
    revealCalled: false
  };

  class EventEmitter {
    constructor() {
      this.listeners = [];
      this.event = (listener) => {
        this.listeners.push(listener);
        return { dispose() {} };
      };
    }
    fire(value) {
      state.refreshCount += 1;
      for (const listener of this.listeners) listener(value);
    }
  }

  class TreeItem {
    constructor(label, collapsibleState) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  }

  class ThemeIcon {
    constructor(id) {
      this.id = id;
    }
  }

  class Range {
    constructor(startLine, startChar, endLine, endChar) {
      this.start = { line: startLine, character: startChar };
      this.end = { line: endLine, character: endChar };
    }
  }

  class Selection {
    constructor(start, end) {
      this.start = start;
      this.end = end;
      state.selectionSet = true;
    }
  }

  const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dead-route-detector-smoke-'));
  const exportPath = path.join(exportDir, 'dead-route-detector-report.json');

  const vscodeStub = {
    EventEmitter,
    TreeItem,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    ThemeIcon,
    Range,
    Selection,
    TextEditorRevealType: { InCenter: 0 },
    ProgressLocation: { Notification: 15 },
    ViewColumn: { One: 1 },
    Uri: { file: (fsPath) => ({ fsPath }) },
    window: {
      showWarningMessage(message) {
        state.warningMessages.push(message);
        return Promise.resolve(message);
      },
      showInformationMessage(message) {
        state.infoMessages.push(message);
        return Promise.resolve(message);
      },
      withProgress(_options, task) {
        state.progressCalls += 1;
        return Promise.resolve(task());
      },
      createTreeView(id, options) {
        state.treeViewId = id;
        state.treeProvider = options.treeDataProvider;
        return { dispose() {} };
      },
      createWebviewPanel(id, title) {
        const panel = { id, title, webview: { html: '' } };
        state.webviews.push(panel);
        return panel;
      },
      showSaveDialog() {
        return Promise.resolve({ fsPath: exportPath });
      },
      showTextDocument(doc) {
        state.openedFiles.push(doc.uri.fsPath);
        return Promise.resolve({
          set selection(_value) { state.selectionSet = true; },
          revealRange() { state.revealCalled = true; }
        });
      }
    },
    workspace: {
      workspaceFolders: [{ name: 'broken-ui', uri: { fsPath: workspaceRoot } }],
      getConfiguration() {
        return {
          get(key, fallback) {
            if (key === 'scanOnStartup') return false;
            if (key === 'exclude') return ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'out'];
            return fallback;
          }
        };
      },
      fs: {
        async writeFile(target, buffer) {
          fs.writeFileSync(target.fsPath, Buffer.from(buffer));
          state.writtenFiles.push(target.fsPath);
        }
      },
      openTextDocument(uri) {
        return Promise.resolve({ uri, getText: () => fs.readFileSync(uri.fsPath, 'utf8') });
      }
    },
    commands: {
      registerCommand(id, callback) {
        commandMap.set(id, callback);
        return { dispose() { commandMap.delete(id); } };
      }
    }
  };

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'vscode') return vscodeStub;
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const extensionModule = await import(pathToFileURL(path.join(extensionRoot, 'extension.js')).href + `?v=${Date.now()}`);
    const extension = extensionModule.default || extensionModule;
    const workspaceStateMap = new Map();
    const context = {
      extensionPath: extensionRoot,
      subscriptions: [],
      workspaceState: {
        get(key) { return workspaceStateMap.get(key); },
        async update(key, value) { workspaceStateMap.set(key, value); }
      }
    };

    extension.activate(context);

    const expectedCommands = packageJson.contributes.commands.map((item) => item.command);
    for (const command of expectedCommands) {
      assert(commandMap.has(command), `Missing registered command: ${command}`);
    }

    const report = await commandMap.get('deadRouteDetector.scanWorkspace')();
    assert(report.summary.deadRouteReferences === 4, `Expected 4 dead route references from extension host smoke, got ${report.summary.deadRouteReferences}`);
    assert(report.summary.placeholderControls === 2, `Expected 2 placeholder controls from extension host smoke, got ${report.summary.placeholderControls}`);
    assert(state.infoMessages.some((message) => /finished/.test(message)), 'Scan did not surface the completion message.');

    await commandMap.get('deadRouteDetector.openReport')();
    assert(state.webviews.length === 1, 'Open Report did not create a webview panel.');
    assert(state.webviews[0].webview.html.includes('Dead route references'), 'Report webview HTML missing dead route section.');

    await commandMap.get('deadRouteDetector.exportReport')();
    assert(fs.existsSync(exportPath), 'Export Report did not write the JSON file.');
    const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
    assert(exported.summary.deadRouteReferences === 4, 'Exported report summary is incorrect.');

    await commandMap.get('deadRouteDetector.refresh')();
    assert(state.refreshCount > 0, 'Refresh command did not trigger tree refresh.');

    await commandMap.get('deadRouteDetector.openIssue')(report.deadRouteReferences[0]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert(state.openedFiles.some((item) => item.endsWith(report.deadRouteReferences[0].file)), 'Open Finding did not open the expected file.');
    assert(state.selectionSet && state.revealCalled, 'Open Finding did not select and reveal the issue line.');

    return {
      status: 'pass',
      commandsVerified: expectedCommands,
      exportedPath: exportPath,
      summary: report.summary
    };
  } finally {
    Module._load = originalLoad;
  }
}

if (process.argv[1] === __filename) {
  runExtensionHostSmoke().then((result) => {
    console.log(JSON.stringify(result, null, 2));
  }).catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
