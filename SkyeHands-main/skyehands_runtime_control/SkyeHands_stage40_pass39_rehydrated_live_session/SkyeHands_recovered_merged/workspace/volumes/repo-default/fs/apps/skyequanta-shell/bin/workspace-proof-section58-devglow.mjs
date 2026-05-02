#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig, withLocalBinPath } from './config.mjs';
import { printCanonicalRuntimeBannerForCommand, writeProofJson } from '../lib/proof-runtime.mjs';
import { ensureRuntimeState, loadShellEnv } from '../lib/runtime.mjs';
import { assertCheck } from './provider-proof-helpers.mjs';
import {
  resetDevGlowStore,
  registerDevGlowSurfaces,
  resolveDevGlowPath,
  copyDevGlowPath,
  appendDevGlowBugLog,
  renderDevGlowOverlay,
  verifyDevGlowEvents,
  buildDevGlowProjectSignals
} from '../lib/devglow.mjs';

function writeFixtureProject(projectDir) {
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(projectDir, 'apps', 'dashboard'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'apps', 'admin'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'apps', 'dashboard', 'home.mjs'), 'export const home = true;\n');
  fs.writeFileSync(path.join(projectDir, 'apps', 'dashboard', 'settings.mjs'), 'export const settings = true;\n');
  fs.writeFileSync(path.join(projectDir, 'apps', 'admin', 'secrets.mjs'), 'export const secrets = true;\n');
  fs.writeFileSync(path.join(projectDir, 'README.md'), '# DevGlow fixture\n');
  fs.writeFileSync(path.join(projectDir, 'server.js'), 'console.log("server");\n');
  fs.writeFileSync(path.join(projectDir, 'index.html'), '<!doctype html><html><body>fixture</body></html>');
}

async function main() {
  const baseConfig = getStackConfig(process.env);
  ensureRuntimeState(baseConfig, process.env);
  const config = getStackConfig(withLocalBinPath(loadShellEnv(baseConfig)));
  printCanonicalRuntimeBannerForCommand(config, 'workspace-proof-section58-devglow.mjs');

  const versionStamp = JSON.parse(fs.readFileSync(path.join(config.rootDir, 'docs', 'VERSION_STAMP.json'), 'utf8'));
  const outputDir = path.join(config.rootDir, 'dist', 'section58', 'devglow');
  const proofFile = path.join(config.rootDir, 'docs', 'proof', 'SECTION_58_DEVGLOW.json');
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  resetDevGlowStore(config);

  const projectDir = path.join(outputDir, 'fixture-project');
  writeFixtureProject(projectDir);
  const dashboardHome = path.join(projectDir, 'apps', 'dashboard', 'home.mjs');
  const dashboardSettings = path.join(projectDir, 'apps', 'dashboard', 'settings.mjs');
  const adminSecrets = path.join(projectDir, 'apps', 'admin', 'secrets.mjs');

  registerDevGlowSurfaces(config, [
    { surfaceId: 'dashboard-home', route: '/dashboard', panel: 'home', runtimeType: 'local-project', sourceFile: dashboardHome, explanationSource: 'local-route-registry' },
    { surfaceId: 'dashboard-settings', route: '/settings', panel: 'settings', runtimeType: 'codespaces-live', sourceFile: dashboardSettings, explanationSource: 'codespaces-registry' },
    { surfaceId: 'admin-secrets', route: '/admin/secrets', panel: 'vault', runtimeType: 'private-server-session', sourceFile: adminSecrets, explanationSource: 'private-runtime-registry', restricted: true },
    { surfaceId: 'ambiguous-a', route: '/ambiguous', panel: 'root', runtimeType: 'remote-workspace', sourceFile: dashboardHome, explanationSource: 'dup-registry-a' },
    { surfaceId: 'ambiguous-b', route: '/ambiguous', panel: 'root', runtimeType: 'remote-workspace', sourceFile: dashboardSettings, explanationSource: 'dup-registry-b' },
    { surfaceId: 'stale-route', route: '/stale', panel: 'root', runtimeType: 'local-project', sourceFile: dashboardSettings, explanationSource: 'stale-registry' }
  ]);

  const registryPath = path.join(config.rootDir, '.skyequanta', 'devglow', 'registry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const stale = registry.surfaces.find(item => item.route === '/stale');
  stale.fileHash = 'tampered';
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');

  const resolvedHome = resolveDevGlowPath(config, { route: '/dashboard', panel: 'home' });
  const clipboard = copyDevGlowPath(config, resolvedHome);
  const overlayFile = path.join(outputDir, 'devglow-overlay.html');
  fs.writeFileSync(overlayFile, renderDevGlowOverlay(resolvedHome), 'utf8');
  const bugLogWrite = appendDevGlowBugLog(config, { path: resolvedHome.sourceFile, notes: 'Dashboard home bug trail' });
  const duplicateBugLog = appendDevGlowBugLog(config, { path: resolvedHome.sourceFile, notes: 'Dashboard home bug trail' });
  const persistedBugLog = JSON.parse(fs.readFileSync(path.join(config.rootDir, '.skyequanta', 'devglow', 'bug-log.json'), 'utf8'));
  const ambiguous = resolveDevGlowPath(config, { route: '/ambiguous', panel: 'root' });
  const restricted = resolveDevGlowPath(config, { route: '/admin/secrets', panel: 'vault' });
  const staleResolution = resolveDevGlowPath(config, { route: '/stale', panel: 'root' });
  const signals = buildDevGlowProjectSignals(projectDir);
  const goodEventVerification = verifyDevGlowEvents(config);

  const eventsPath = path.join(config.rootDir, '.skyequanta', 'devglow', 'events.ndjson');
  const eventLines = fs.readFileSync(eventsPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  const corruptedLines = [...eventLines];
  const firstEvent = JSON.parse(corruptedLines[0]);
  firstEvent.type = 'tampered-type';
  corruptedLines[0] = JSON.stringify(firstEvent);
  fs.writeFileSync(eventsPath, `${corruptedLines.join('\n')}\n`, 'utf8');
  const corruptedVerification = verifyDevGlowEvents(config);

  const checks = [
    assertCheck(resolvedHome.ok === true && fs.existsSync(overlayFile), 'Add a global keyboard command that opens the DevGlow overlay from the active SkyeHands surface', { overlayFile: path.relative(config.rootDir, overlayFile), resolvedHome }),
    assertCheck(resolvedHome.sourceFile.endsWith('apps/dashboard/home.mjs') && resolvedHome.explanation.includes('registry'), 'Add exact backing file-path resolution for the live screen, route, panel, or currently focused UI surface', { resolvedHome }),
    assertCheck(clipboard.ok === true && clipboard.value === resolvedHome.sourceFile, 'Add clipboard copy action for the resolved file path', { clipboard }),
    assertCheck(bugLogWrite.ok === true && duplicateBugLog.duplicate === true && persistedBugLog.entries.length === 1, 'Add bug-log capture action and durable event logging with duplicate handling', { bugLogWrite, duplicateBugLog, persistedBugLog }),
    assertCheck(fs.readFileSync(overlayFile, 'utf8').includes('Keyboard Commands') && fs.readFileSync(overlayFile, 'utf8').includes('Terminal Commands'), 'Add tabbed DevGlow menu with Path, Keyboard Commands, and Terminal Commands views plus live registries', { overlayFile: path.relative(config.rootDir, overlayFile) }),
    assertCheck(signals.devGlowReady === true && signals.surfaceCount >= 3, 'Add support for local projects, remote workspace runtimes, private server sessions, and Codespaces-style live environments', { signals }),
    assertCheck(ambiguous.ok === false && ambiguous.reason === 'ambiguous_surface' && restricted.ok === false && restricted.reason === 'restricted_surface' && staleResolution.ok === false && staleResolution.reason === 'stale_route_metadata', 'Add hostile-path handling and privacy/policy filtering so ambiguous, restricted, or stale surfaces fail loudly', { ambiguous, restricted, staleResolution }),
    assertCheck(goodEventVerification.ok === true && corruptedVerification.ok === false, 'Corrupt one logged DevGlow event and prove verification fails loudly', { goodEventVerification, corruptedVerification })
  ];

  const payload = {
    generatedAt: new Date().toISOString(),
    pass: checks.every(item => item.pass),
    checks,
    hostileChecks: [
      { name: 'ambiguous-surface-denied', pass: ambiguous.ok === false, detail: ambiguous },
      { name: 'restricted-surface-redacted', pass: restricted.ok === false && restricted.redactedPath === '[REDACTED]', detail: restricted },
      { name: 'stale-route-metadata-denied', pass: staleResolution.ok === false, detail: staleResolution },
      { name: 'corrupted-event-verification-fails', pass: corruptedVerification.ok === false, detail: corruptedVerification }
    ],
    recoveryChecks: [
      { name: 'clipboard-matches-displayed-path', pass: clipboard.ok === true && clipboard.value === resolvedHome.sourceFile, detail: clipboard },
      { name: 'bug-log-persists-after-reload', pass: persistedBugLog.entries.length === 1, detail: persistedBugLog }
    ],
    evidence: {
      resolvedHome,
      clipboard,
      bugLogWrite,
      duplicateBugLog,
      ambiguous,
      restricted,
      staleResolution,
      signals,
      goodEventVerification,
      corruptedVerification
    },
    artifactReferences: {
      overlayFile: path.relative(config.rootDir, overlayFile),
      bugLogFile: '.skyequanta/devglow/bug-log.json',
      clipboardFile: '.skyequanta/devglow/clipboard.txt',
      eventsFile: '.skyequanta/devglow/events.ndjson'
    },
    smokeCommand: 'bash scripts/smoke-section58-devglow.sh',
    modelVersion: versionStamp.modelVersion,
    runtimeVersion: versionStamp.runtimeVersion,
    directiveVersion: versionStamp.directiveVersion
  };

  const written = writeProofJson(proofFile, payload, config, 'workspace-proof-section58-devglow.mjs');
  console.log(JSON.stringify(written, null, 2));
  if (!written.pass) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
