#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createAECentralCommandHubLocalRuntime } from "../runtime/local-runtime.mjs";

const root = path.resolve(process.cwd());
const launcherRoot = path.join(root, "AE-Central-Command-Pack-CredentialHub-Launcher");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relPath) {
  const fullPath = path.join(root, relPath);
  assert(fs.existsSync(fullPath), `Missing required file: ${relPath}`);
  return fs.readFileSync(fullPath, "utf8");
}

async function main() {
  const classification = read("ESTATE_CLASSIFICATION.md");
  const proofStatus = read("PROOF_STATUS.md");
  const indexHtml = read("AE-Central-Command-Pack-CredentialHub-Launcher/index.html");
  const manifest = read("AE-Central-Command-Pack-CredentialHub-Launcher/manifest.json");
  const serviceWorker = read("AE-Central-Command-Pack-CredentialHub-Launcher/sw.js");
  const appJs = read("AE-Central-Command-Pack-CredentialHub-Launcher/assets/app.js");
  const dashboardPage = read("AE-Central-Command-Pack-CredentialHub-Launcher/pages/dashboard.html");

  assert(classification.includes("working-shell"), "classification file is missing the working-shell label");
  assert(classification.includes("walkthrough-pack"), "classification file is missing the walkthrough-pack label");
  assert(proofStatus.includes("offline-first launcher shell"), "proof status is missing the launcher-shell scope");
  assert(proofStatus.includes("same-folder runtime"), "proof status is missing same-folder runtime scope");

  assert(indexHtml.includes("AE Central Command Pack featuring the Credential Hub Launcher"), "launcher title is missing");
  assert(indexHtml.includes("./manifest.json"), "launcher is missing manifest wiring");
  assert(indexHtml.includes("./assets/app.js"), "launcher is missing app script wiring");
  assert(indexHtml.includes("Walkthrough"), "launcher is missing the walkthrough entrypoint");
  assert(dashboardPage.includes('id="workspace-audit-summary"'), "dashboard is missing workspace audit summary shell");
  assert(dashboardPage.includes("Save Runtime Snapshot"), "dashboard is missing runtime snapshot control");
  assert(dashboardPage.includes('id="workspace-runtime-status"'), "dashboard is missing runtime status shell");

  assert(manifest.includes("\"name\""), "manifest is missing app metadata");
  assert(serviceWorker.includes("fetch"), "service worker is missing offline fetch handling");
  assert(appJs.includes("const CONNECTED_APPS = ["), "app.js is missing connected app registry");
  assert(appJs.includes("localStorage"), "app.js is missing local storage state");
  assert(appJs.includes("exportBackup"), "app.js is missing backup export");
  assert(appJs.includes("restoreBackup"), "app.js is missing backup restore");
  assert(appJs.includes("buildWorkspaceAudit"), "app.js is missing local workspace audit generation");
  assert(appJs.includes("exportWorkspaceAudit"), "app.js is missing local workspace audit export");
  assert(appJs.includes("saveWorkspaceAuditRuntimeSnapshot"), "app.js is missing runtime snapshot push");
  assert(appJs.includes("probeWorkspaceRuntime"), "app.js is missing runtime lane probing");
  assert(appJs.includes("navigator.serviceWorker.register('./sw.js')"), "app.js is missing service worker registration");

  const pageNames = [
    "launcher.html",
    "ae-command-pack.html",
    "credential-pack.html",
    "ops-pack.html",
    "service-pack.html",
    "dashboard.html",
    "sitemap.html",
    "tutorial.html",
    "contacts.html",
    "contact-view.html",
    "vault.html",
    "projects.html",
    "notes.html",
    "settings.html"
  ];

  for (const page of pageNames) {
    assert(fs.existsSync(path.join(launcherRoot, "pages", page)), `Missing launcher page partial: ${page}`);
  }

  const connectedAppsMatch = appJs.match(/const CONNECTED_APPS = (\[[\s\S]*?\n  \]);/);
  assert(connectedAppsMatch, "Unable to parse CONNECTED_APPS from app.js");
  const connectedApps = vm.runInNewContext(`(${connectedAppsMatch[1]})`, {});
  assert(Array.isArray(connectedApps) && connectedApps.length >= 10, "CONNECTED_APPS registry is unexpectedly small");

  const externalApps = connectedApps.filter((app) => app.type === "external");
  assert(externalApps.length >= 2, "Expected bundled external branch apps are missing from launcher registry");
  for (const app of externalApps) {
    assert(app.href, `External app ${app.id} is missing href`);
    const target = path.join(launcherRoot, app.href.replace(/^\.\//, ""));
    assert(fs.existsSync(target), `Bundled app target missing on disk: ${app.href}`);
  }

  const tempDir = fs.mkdtempSync(path.join(root, "runtime", ".smoke-"));
  const runtimeDataDir = path.join(tempDir, "data");
  const journalPath = path.join(runtimeDataDir, "runtime-journal.json");
  const auditDir = path.join(runtimeDataDir, "audit-snapshots");

  let runtime = null;
  try {
    runtime = await createAECentralCommandHubLocalRuntime({
      dataDir: runtimeDataDir,
      auditDir,
      journalPath,
    });
    await new Promise((resolve, reject) => {
      runtime.server.once("error", reject);
      runtime.server.listen(0, "127.0.0.1", resolve);
    });

    const address = runtime.server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    const shell = await fetch(`${baseUrl}/`).then((res) => res.text());
    assert(shell.includes("Credential Hub Launcher"), "runtime root did not serve launcher shell");

    const servedAppJs = await fetch(`${baseUrl}/AE-Central-Command-Pack-CredentialHub-Launcher/assets/app.js`).then((res) => res.text());
    assert(servedAppJs.includes("saveWorkspaceAuditRuntimeSnapshot"), "runtime did not serve updated app script");

    const health = await fetch(`${baseUrl}/health`).then((res) => res.json());
    assert(health.ok, "runtime health endpoint did not report ok");
    assert(health.mode === "same-folder-local-runtime", "runtime health endpoint reported the wrong mode");

    const snapshotResponse = await fetch(`${baseUrl}/api/runtime/audit-snapshots`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        audit: {
          generatedAt: "2026-05-01T12:20:00.000Z",
          currentPage: "dashboard",
          totals: {
            contacts: 2,
            credentials: 3,
            projects: 1,
            notes: 4,
            internalRoutes: 12,
            bundledApps: externalApps.length,
          },
          localSecurity: {
            lockEnabled: true,
            serviceWorkerCapable: true,
            browserOnline: false,
          },
          routes: pageNames.map((page) => ({ route: page.replace(/\.html$/, ""), page })),
          bundledApps: externalApps,
        },
      }),
    }).then((res) => res.json());
    assert(snapshotResponse.ok, "runtime audit snapshot POST failed");
    assert(snapshotResponse.snapshot.currentPage === "dashboard", "runtime audit snapshot current page mismatch");

    const status = await fetch(`${baseUrl}/api/runtime/status`).then((res) => res.json());
    assert(status.audits.total >= 1, "runtime status did not include the saved audit snapshot");

    const snapshots = await fetch(`${baseUrl}/api/runtime/audit-snapshots`).then((res) => res.json());
    assert(snapshots.total >= 1, "runtime audit snapshot listing did not include saved snapshot");

    const fetchedSnapshot = await fetch(`${baseUrl}/api/runtime/audit-snapshots/${encodeURIComponent(snapshotResponse.snapshot.snapshotId)}`).then((res) => res.json());
    assert(fetchedSnapshot.ok, "runtime audit snapshot fetch by id failed");
    assert(fetchedSnapshot.snapshot.totals.credentials === 3, "runtime audit snapshot payload mismatch");

    assert(fs.existsSync(journalPath), "runtime journal file was not written");
    assert(fs.existsSync(path.join(root, snapshotResponse.snapshot.file)), "runtime snapshot file was not written inside the folder");

    console.log(JSON.stringify({
      ok: true,
      app: "AE-Central-CommandHub",
      surface: "offline-first launcher shell plus bundled walkthrough target registry",
      verified: [
        "launcher shell exists with manifest, service worker, and app script",
        "built-in launcher page partials are present",
        "browser-local workspace audit and export lane exists in the dashboard",
        "same-folder runtime served the launcher shell and updated app script",
        "same-folder runtime accepted and stored a workspace audit snapshot",
        "bundled external branch-app targets referenced by the launcher exist on disk",
        "top-level classification explicitly separates working shell from walkthrough packs"
      ],
      not_proven: [
        "every nested branch app as a shipped product",
        "browser-driven end-to-end exercise of every launcher route",
        "independent production certification for the walkthrough/tutorial packs"
      ]
    }, null, 2));
  } finally {
    if (runtime && runtime.server.listening) await runtime.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

await main();
