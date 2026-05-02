#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function readJson(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return {}; }
}

const theia = readJson('platform/ide-core/runtime-proof.json');
const openhands = readJson('platform/agent-core/runtime-proof.json');

function missingFlags(proof, flags) {
  return flags.filter((flag) => proof?.[flag] !== true);
}

const theiaFlags = [
  'resolvedTheiaCli',
  'backendLaunches',
  'browserLaunches',
  'workspaceOpens',
  'fileSave',
  'terminalCommand',
  'previewOutput',
];

const openhandsFlags = [
  'packageImportable',
  'serverLaunches',
  'taskReceived',
  'workspaceFileSeen',
  'fileEditedOrGenerated',
  'commandOrTestRun',
  'resultReturnedToSkyeHands',
];

const missingTheia = missingFlags(theia, theiaFlags);
const missingOpenHands = missingFlags(openhands, openhandsFlags);
const fullTheiaRuntime = theia.fullTheiaRuntime === true && missingTheia.length === 0;
const fullOpenHandsRuntime = openhands.fullOpenHandsRuntime === true && missingOpenHands.length === 0;

const lines = [];
lines.push('# RUNTIME BLOCKERS REPORT');
lines.push('');
lines.push(`Generated: ${new Date().toISOString()}`);
lines.push('');
lines.push('## Theia Install Lane');
lines.push(`- installReady: ${theia.installReady === true ? '✅' : '☐'}`);
lines.push(`- blocker: ${theia.installBlockedReason || 'none'}`);
lines.push(`- runtimeRootUsed: ${theia.runtimeRootUsed || 'unknown'}`);
lines.push(`- action: cd ${theia.runtimeRootUsed || '<theia-root>'} && yarn install`);
lines.push('');
lines.push('## OpenHands Install Lane');
lines.push(`- installReady: ${openhands.installReady === true ? '✅' : '☐'}`);
lines.push(`- blocker: ${openhands.installBlockedReason || 'none'}`);
lines.push(`- runtimeRootUsed: ${openhands.runtimeRootUsed || 'unknown'}`);
lines.push(`- action: pip3 install openhands-ai OR cd ${openhands.runtimeRootUsed || '<agent-root>'} && pip3 install -e .`);
lines.push('');
lines.push('## Runtime Parity Flags');
lines.push(`- ${fullTheiaRuntime ? '✅' : '☐'} fullTheiaRuntime${fullTheiaRuntime ? '' : ` (missing flags: ${missingTheia.join(', ') || 'unknown'})`}`);
lines.push(`- ${fullOpenHandsRuntime ? '✅' : '☐'} fullOpenHandsRuntime${fullOpenHandsRuntime ? '' : ` (missing flags: ${missingOpenHands.join(', ') || 'unknown'})`}`);

fs.writeFileSync(path.join(ROOT, 'RUNTIME_BLOCKERS_REPORT.md'), `${lines.join('\n')}\n`);
console.log('Written: RUNTIME_BLOCKERS_REPORT.md');
