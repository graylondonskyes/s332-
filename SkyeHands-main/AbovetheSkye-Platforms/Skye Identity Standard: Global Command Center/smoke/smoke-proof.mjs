import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSISLocalRuntime } from "../runtime/local-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing required file: ${rel}`);
  }
  return fs.readFileSync(full, "utf8");
}

function mustContain(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

async function main() {
  const index = read("index.html");
  const soc2 = read("SOC2CompanionPack.html");
  const proofStatus = read("PROOF_STATUS.md");

  mustContain(index, "SKYE Identity Standard", "SIS page identity");
  mustContain(index, "skyeidentitystandardcommandcenter.netlify.app", "hosted command center references");
  mustContain(index, 'id="boundary"', "index runtime boundary section");
  mustContain(index, "Engineer Preflight", "preflight lane copy");
  mustContain(soc2, "SS-SOC2-001 Companion Pack", "companion pack identity");
  mustContain(soc2, "browser localStorage", "local-only claim text");
  mustContain(soc2, 'id="local-proof"', "local proof section");
  mustContain(soc2, 'id="exportJson"', "local JSON export button");
  mustContain(soc2, 'id="exportPacket"', "local packet export button");
  mustContain(soc2, 'id="saveRuntimePacket"', "runtime packet export button");
  mustContain(soc2, 'id="runtimeStatus"', "runtime status shell");
  mustContain(soc2, 'id="controlList"', "local control checklist shell");
  mustContain(soc2, 'id="evidenceList"', "local evidence register shell");
  mustContain(soc2, "soc2-companion-local-proof", "local storage key");
  mustContain(soc2, "seedControls", "local template control seeding");
  mustContain(soc2, "saveRuntimePacket()", "runtime packet function");
  mustContain(soc2, "ss-soc2-001companionpack.netlify.app", "hosted companion pack reference");
  mustContain(proofStatus, "same-folder runtime", "runtime proof status scope");

  const tempDir = fs.mkdtempSync(path.join(root, "runtime", ".smoke-"));
  const packetsDir = path.join(tempDir, "data", "packets");
  const journalPath = path.join(tempDir, "data", "runtime-journal.json");

  let runtime = null;
  try {
    runtime = await createSISLocalRuntime({
      dataDir: path.join(tempDir, "data"),
      packetsDir,
      journalPath,
    });
    await new Promise((resolve, reject) => {
      runtime.server.once("error", reject);
      runtime.server.listen(0, "127.0.0.1", resolve);
    });

    const address = runtime.server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    const servedIndex = await fetch(`${baseUrl}/index.html`).then((res) => res.text());
    mustContain(servedIndex, "SKYE Identity Standard", "runtime-served index shell");

    const servedSoc2 = await fetch(`${baseUrl}/SOC2CompanionPack.html`).then((res) => res.text());
    mustContain(servedSoc2, "saveRuntimePacket", "runtime-served SOC2 shell");

    const health = await fetch(`${baseUrl}/health`).then((res) => res.json());
    if (!health.ok) {
      throw new Error("Runtime health endpoint did not report ok");
    }
    if (health.mode !== "same-folder-local-runtime") {
      throw new Error("Runtime health endpoint reported the wrong mode");
    }

    const packetResponse = await fetch(`${baseUrl}/api/runtime/packets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        packet: {
          packetType: "soc2-local-proof-packet",
          generatedAt: "2026-05-01T12:30:00.000Z",
          organization: "Acme Health UK",
          reviewWindow: "Q2 2026",
          reviewOwner: "Security and Trust",
          docs: {
            checklist: "ready",
            evidence: "in-progress",
            scorecard: "ready",
            exception: "blocked",
          },
          summary: {
            controls: 3,
            evidenceItems: 2,
            readyControls: 1,
            gapControls: 1,
          },
          controls: [
            { name: "CC-6.1 Access Reviews", status: "ready" },
            { name: "A1.2 Vendor Exceptions", status: "gap" },
          ],
          evidenceItems: [
            { title: "Access review export", control: "CC-6.1 Access Reviews" }
          ],
          notes: "Smoke proof packet save",
        },
      }),
    }).then((res) => res.json());
    if (!packetResponse.ok) {
      throw new Error("Runtime packet POST failed");
    }

    const status = await fetch(`${baseUrl}/api/runtime/status`).then((res) => res.json());
    if ((status.packets?.total || 0) < 1) {
      throw new Error("Runtime status did not include saved packets");
    }

    const packets = await fetch(`${baseUrl}/api/runtime/packets`).then((res) => res.json());
    if ((packets.total || 0) < 1) {
      throw new Error("Runtime packet listing did not include saved packet");
    }

    const fetchedPacket = await fetch(`${baseUrl}/api/runtime/packets/${encodeURIComponent(packetResponse.packet.packetId)}`).then((res) => res.json());
    if (!fetchedPacket.ok) {
      throw new Error("Runtime packet fetch by id failed");
    }
    if (fetchedPacket.packet.summary.controls !== 3) {
      throw new Error("Fetched runtime packet payload mismatch");
    }

    if (!fs.existsSync(journalPath)) {
      throw new Error("Runtime journal file was not written");
    }
    if (!fs.existsSync(path.join(root, packetResponse.packet.file))) {
      throw new Error("Runtime packet file was not written inside the folder");
    }

    console.log(JSON.stringify({
      ok: true,
      folder: "Skye Identity Standard: Global Command Center",
      status: "partial",
      proof: [
        "static-pages-present",
        "hosted-command-center-links-present",
        "local-companion-copy-present",
        "local-control-packet-present",
        "same-folder runtime served the local HTML shells",
        "same-folder runtime accepted and stored a local proof packet"
      ]
    }, null, 2));
  } finally {
    if (runtime && runtime.server.listening) await runtime.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

await main();
