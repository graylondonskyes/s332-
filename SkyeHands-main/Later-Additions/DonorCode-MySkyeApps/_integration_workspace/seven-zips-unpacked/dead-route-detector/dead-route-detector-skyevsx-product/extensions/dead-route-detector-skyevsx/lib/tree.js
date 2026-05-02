const vscode = require('vscode');

class FindingsNode {
  constructor(type, label, payload = null, children = []) {
    this.type = type;
    this.label = label;
    this.payload = payload;
    this.children = children;
  }
}

class FindingsTreeProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.report = null;
  }

  setReport(report) {
    this.report = report;
    this.refresh();
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    if (element.type === 'category') {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = new vscode.ThemeIcon('list-tree');
      return item;
    }
    const issue = element.payload;
    const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
    item.description = `${issue.file}:${issue.line || 1}`;
    item.tooltip = `${element.label}\n${item.description}`;
    item.command = {
      command: 'deadRouteDetector.openIssue',
      title: 'Open Finding',
      arguments: [issue]
    };
    if (element.type === 'deadRoute') item.iconPath = new vscode.ThemeIcon('warning');
    else if (element.type === 'orphanRoute') item.iconPath = new vscode.ThemeIcon('debug-disconnect');
    else if (element.type === 'deadCommand') item.iconPath = new vscode.ThemeIcon('symbol-event');
    else if (element.type === 'placeholder') item.iconPath = new vscode.ThemeIcon('circle-slash');
    else item.iconPath = new vscode.ThemeIcon('circle-outline');
    return item;
  }

  getChildren(element) {
    if (!this.report) {
      if (element) return [];
      return [new FindingsNode('category', 'Run “Scan Workspace” to populate findings.')];
    }

    if (!element) {
      return [
        this.makeCategory('Dead route references', 'deadRoute', this.report.deadRouteReferences, (item) => `${item.path} · ${item.kind}`),
        this.makeCategory('Orphan routes', 'orphanRoute', this.report.orphanRoutes, (item) => `${item.path} · declared only`),
        this.makeCategory('Dead commands', 'deadCommand', [
          ...this.report.commands.unregisteredContributed,
          ...this.report.commands.deadExecuted,
          ...this.report.commands.deadMenuCommands,
          ...this.report.commands.deadKeybindingCommands
        ], (item) => `${item.command} · ${item.kind || 'command issue'}`),
        this.makeCategory('Placeholder controls', 'placeholder', this.report.placeholderControls, (item) => `${item.rawValue} · ${item.kind}`)
      ];
    }

    return element.children;
  }

  makeCategory(title, issueType, items, formatter) {
    const children = items.map((item) => new FindingsNode(issueType, formatter(item), item));
    return new FindingsNode('category', `${title} (${items.length})`, null, children);
  }
}

module.exports = {
  FindingsTreeProvider
};
