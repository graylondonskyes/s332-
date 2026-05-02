import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAEFlowLocalRuntime } from "../runtime/local-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relPath) {
  const fullPath = path.join(root, relPath);
  assert(fs.existsSync(fullPath), `Missing required file: ${relPath}`);
  return fs.readFileSync(fullPath, "utf8");
}

async function main() {
  const indexHtml = read("index.html");
  const appJs = read("app.js");
  const manifest = read("manifest.webmanifest");
  const serviceWorker = read("sw.js");
  const runtimeModule = read("runtime/local-runtime.mjs");

  assert(indexHtml.includes("AE FLOW by Skyes Over London"), "index.html is missing the AE FLOW title");
  assert(indexHtml.includes("runtimeLaneStatus"), "index.html is missing the local runtime lane status surface");
  assert(indexHtml.includes("exportOpsJournalBtn"), "index.html is missing the recovery journal controls");

  assert(appJs.includes("probeRuntimeLane"), "app.js is missing runtime lane probing");
  assert(appJs.includes("saveRuntimeSnapshot"), "app.js is missing runtime snapshot writes");
  assert(appJs.includes("recordRecoveryEvent"), "app.js is missing recovery journal writes");

  assert(runtimeModule.includes("/api/runtime/status"), "local runtime module is missing the runtime status endpoint");
  assert(runtimeModule.includes("/api/runtime/snapshots"), "local runtime module is missing the snapshot endpoint");
  assert(manifest.includes("\"name\""), "manifest.webmanifest is missing app metadata");
  assert(serviceWorker.includes("fetch"), "sw.js is missing offline fetch handling");

  const tempDir = fs.mkdtempSync(path.join(root, "runtime", ".smoke-"));
  const journalPath = path.join(tempDir, "data", "ops-journal.json");
  const snapshotsDir = path.join(tempDir, "data", "snapshots");

  let runtime = null;
  try {
    runtime = await createAEFlowLocalRuntime({
      dataDir: path.join(tempDir, "data"),
      journalPath,
      snapshotsDir,
    });
    await new Promise((resolve, reject) => {
      runtime.server.once("error", reject);
      runtime.server.listen(0, "127.0.0.1", resolve);
    });

    const address = runtime.server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    const servedIndex = await fetch(`${baseUrl}/`).then((res) => res.text());
    assert(servedIndex.includes("AE FLOW by Skyes Over London"), "Runtime root did not serve AE FLOW shell");
    assert(servedIndex.includes("runtimeLaneStatus"), "Runtime root did not serve runtime lane shell");

    const servedAppJs = await fetch(`${baseUrl}/app.js`).then((res) => res.text());
    assert(servedAppJs.includes("probeRuntimeLane"), "Runtime did not serve updated browser script");

    const servedManifest = await fetch(`${baseUrl}/manifest.webmanifest`).then((res) => res.text());
    assert(servedManifest.includes("\"name\""), "Runtime did not serve manifest metadata");

    const health = await fetch(`${baseUrl}/health`).then((res) => res.json());
    assert(health.ok, "Health endpoint did not report ok");
    assert(health.mode === "same-folder-local-runtime", "Health endpoint reported the wrong runtime mode");

    const entryResponse = await fetch(`${baseUrl}/api/runtime/journal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "smoke-proof",
        detail: "Smoke proof journal write",
        createdAt: "2026-05-01T12:00:00.000Z",
        meta: { lane: "journal" },
      }),
    }).then((res) => res.json());
    assert(entryResponse.ok, "Journal POST failed");
    assert(entryResponse.entry.type === "smoke-proof", "Journal entry type mismatch");

    const snapshotResponse = await fetch(`${baseUrl}/api/runtime/snapshots`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: "smoke-browser-backup",
        createdAt: "2026-05-01T12:01:00.000Z",
        meta: { lane: "snapshot" },
        payload: {
          visits: [{ id: "visit_1" }],
          accounts: [{ id: "acct_1" }],
          deals: [{ id: "deal_1" }],
          handoff_log: [{ id: "handoff_1" }],
          settings: { depositPct: 0.4 },
        },
      }),
    }).then((res) => res.json());
    assert(snapshotResponse.ok, "Snapshot POST failed");
    assert(snapshotResponse.snapshot.reason === "smoke-browser-backup", "Snapshot reason mismatch");

    const status = await fetch(`${baseUrl}/api/runtime/status`).then((res) => res.json());
    assert(status.journal.total >= 2, "Runtime status did not include expected journal rows");
    assert(status.snapshots.total >= 1, "Runtime status did not include expected snapshot rows");

    const journal = await fetch(`${baseUrl}/api/runtime/journal`).then((res) => res.json());
    assert(journal.total >= 2, "Runtime journal listing did not include written rows");

    const snapshots = await fetch(`${baseUrl}/api/runtime/snapshots`).then((res) => res.json());
    assert(snapshots.total >= 1, "Runtime snapshot listing did not include saved snapshot");

    const snapshotId = snapshotResponse.snapshot.snapshotId;
    const fetchedSnapshot = await fetch(`${baseUrl}/api/runtime/snapshots/${encodeURIComponent(snapshotId)}`).then((res) => res.json());
    assert(fetchedSnapshot.ok, "Snapshot fetch by id failed");
    assert(fetchedSnapshot.snapshot.payload.accounts.length === 1, "Fetched snapshot payload mismatch");

    assert(fs.existsSync(journalPath), "Runtime journal file was not written");
    assert(fs.existsSync(path.join(root, snapshotResponse.snapshot.file)), "Snapshot file path was not rooted in AE-FlowPro");

    console.log(JSON.stringify({
      ok: true,
      platform: "AE-FlowPro",
      status: "pass",
      proof: [
        "same-folder local runtime served health and static shell",
        "same-folder local runtime served browser shell assets",
        "browser runtime journal contract accepted writes",
        "backup snapshot endpoint wrote a same-folder JSON artifact",
        "runtime status surfaced journal and snapshot history",
      ],
      runtimeFiles: {
        journalPath,
        snapshotFile: snapshotResponse.snapshot.file,
      },
      guardrails: [
        "proof covers local runtime and same-origin browser contract only",
        "no remote sync, team collaboration, or live deployment claimed",
      ],
    }, null, 2));
  } finally {
    if (runtime && runtime.server.listening) await runtime.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

await main();
