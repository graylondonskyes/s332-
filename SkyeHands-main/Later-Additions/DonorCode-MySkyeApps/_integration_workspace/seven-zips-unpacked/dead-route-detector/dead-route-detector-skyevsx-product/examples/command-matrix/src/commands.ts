import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand('matrix.runHealthy', () => 'ok'));
  vscode.commands.executeCommand('matrix.runHealthy');
  vscode.commands.executeCommand('matrix.executeGhost');
}
