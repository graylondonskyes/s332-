import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve(__dirname, "../.ms-playwright");
const require = createRequire(import.meta.url);
const { chromium } = require("../SuperIDEv2/node_modules/playwright");

const url = process.argv[2] || "http://127.0.0.1:4177/index.html";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const messages = [];

page.on("console", (message) => {
  if (["error", "warning"].includes(message.type())) messages.push(`${message.type()}: ${message.text()}`);
});
page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));

async function waitReady(target) {
  await target.waitForFunction(() => window.App && window.App.quill && document.querySelector("#editor-container"), null, { timeout: 30000 });
  await target.waitForFunction(() => document.querySelector('[data-super-push="1"]'), null, { timeout: 10000 });
}

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await waitReady(page);

const result = await page.evaluate(async () => {
  const originalDownloadBlob = window.App.downloadBlob.bind(window.App);
  const downloads = [];
  window.App.downloadBlob = async (blob, filename) => {
    downloads.push({ filename, blob, size: blob.size, type: blob.type });
    return originalDownloadBlob(blob, filename);
  };

  await window.App.createDoc(
    "Full Smoke SkyeDocxMax",
    "<h1>Full Smoke SkyeDocxMax</h1><p>Vault, export, import, and bridge proof.</p>",
    null
  );
  await new Promise((resolve) => setTimeout(resolve, 500));
  const originalDoc = window.App.getActiveDocRecord();
  if (!originalDoc) throw new Error("No active document after create.");

  window.App.customPrompt = async () => "Governance smoke note";
  await window.App.addCommentFromSelection();
  window.App.toggleSuggestionMode();
  window.App.quill.insertText(window.App.quill.getLength() - 1, " Suggested governance change.", "user");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  window.App.toggleSuggestionMode();
  await window.App.insertPageBreak();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  window.App.openMetadataModal();
  document.getElementById("meta-author").value = "SkyeDocxMax Smoke";
  document.getElementById("meta-classification").value = "confidential";
  document.getElementById("meta-tags").value = "standalone, governance, smoke";
  document.getElementById("meta-summary").value = "Governance controls smoke proof.";
  await window.App.saveMetadata();

  window.App.openTemplateModal();
  document.getElementById("template-select").value = "sop";
  document.getElementById("template-title").value = "Smoke Template SOP";
  await window.App.createFromTemplate();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await window.App.openDoc(originalDoc.id);
  await new Promise((resolve) => setTimeout(resolve, 500));

  window.App.openSuggestionLog();
  window.App.openVersionTimeline();
  const governanceDoc = await new Promise((resolve, reject) => {
    const open = indexedDB.open("SkyesDocsDB", 4);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("documents", "readonly");
      const req = tx.objectStore("documents").get(originalDoc.id);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    };
  });
  if (!governanceDoc?.comments?.length) throw new Error("Governance comment proof missing.");
  if (!governanceDoc?.suggestions?.length) throw new Error("Suggestion mode proof missing.");
  if (!governanceDoc?.versions?.length) throw new Error("Version timeline proof missing.");
  if (!String(governanceDoc?.content || "").includes("[PAGE BREAK]")) throw new Error("Page break proof missing.");
  if (governanceDoc?.meta?.classification !== "confidential") throw new Error("Metadata proof missing.");

  await window.App.exportSkyeFormat(originalDoc, "Full Smoke SkyeDocxMax", {
    passphrase: "full-smoke-passphrase",
    passphraseHint: "full smoke",
    enableFailsafe: true,
  });
  const skyeDownload = downloads.find((item) => item.filename.endsWith(".skye"));
  if (!skyeDownload) throw new Error("Secure .skye download was not captured.");

  const file = new File([skyeDownload.blob], skyeDownload.filename, { type: skyeDownload.blob.type });
  let wrongPassphraseFailed = false;
  try {
    const wrongPageFile = new File([skyeDownload.blob], skyeDownload.filename, { type: skyeDownload.blob.type });
    const wrongEnvelope = await window.App.tryReadSkyeSecureEnvelope(wrongPageFile);
    await window.SkyeSecure.decryptSkyePayload(wrongEnvelope.payload.primary, "wrong-passphrase");
  } catch {
    wrongPassphraseFailed = true;
  }
  window.App.customPrompt = async () => "full-smoke-passphrase";
  await window.App.processLocalDocFile(file);
  await new Promise((resolve) => setTimeout(resolve, 500));
  const importedDoc = window.App.getActiveDocRecord();
  if (!importedDoc || importedDoc.title !== "Full Smoke SkyeDocxMax") {
    throw new Error("Secure .skye import did not reopen the expected document.");
  }

  await window.App.exportHTMLZipFormat(importedDoc, "Full Smoke SkyeDocxMax");
  window.App.exportTXTFormat("Full Smoke SkyeDocxMax");

  const aiButton = [...document.querySelectorAll('[data-super-push="1"]')].find((button) => button.textContent.includes("AI Draft"));
  const chatButton = [...document.querySelectorAll('[data-super-push="1"]')].find((button) => button.textContent.includes("Push Chat"));
  const driveButton = [...document.querySelectorAll('[data-super-push="1"]')].find((button) => button.textContent.includes("Push Drive"));
  if (!aiButton || !chatButton || !driveButton) throw new Error("Expected bridge buttons are missing.");

  window.App.customPrompt = async (prompt, fallback = "") => {
    if (String(prompt).includes("channel")) return "smoke";
    if (String(prompt).includes("Topic")) return "standalone";
    return fallback || "smoke";
  };
  chatButton.click();
  driveButton.click();
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const outboxKeys = Object.keys(localStorage).filter((key) => key.startsWith("skyedocxmax.outbox."));
  const evidenceKeys = Object.keys(localStorage).filter((key) => key.startsWith("skyedocxmax.evidence."));
  const bridgeKeys = Object.keys(localStorage).filter((key) => key.startsWith("skyedocxmax.bridge."));
  const intentKeys = Object.keys(localStorage).filter((key) => key.startsWith("skyedocxmax.intents."));

  const allDocs = await new Promise((resolve, reject) => {
    const open = indexedDB.open("SkyesDocsDB", 4);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("documents", "readonly");
      const req = tx.objectStore("documents").getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || []);
    };
  });

  return {
    title: document.title,
    activeDocTitle: importedDoc.title,
    documentCount: allDocs.length,
    governance: {
      comments: governanceDoc.comments.length,
      suggestions: governanceDoc.suggestions.length,
      versions: governanceDoc.versions.length,
      classification: governanceDoc.meta?.classification || "",
      hasPageBreak: String(governanceDoc.content || "").includes("[PAGE BREAK]"),
      templateCreated: allDocs.some((doc) => doc.title === "Smoke Template SOP"),
      suggestionModalOpen: document.getElementById("suggestions-modal")?.style.display === "flex",
      timelineModalOpen: document.getElementById("timeline-modal")?.style.display === "flex",
    },
    downloads: downloads.map((item) => ({ filename: item.filename, size: item.size, type: item.type })),
    outboxKeys,
    evidenceKeys,
    bridgeKeys,
    intentKeys,
    hasRecoveryKit: Boolean(window.App.pendingRecoveryKit?.recoveryCode),
    wrongPassphraseFailed,
    serviceWorkerController: Boolean(navigator.serviceWorker?.controller),
  };
});

await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
await waitReady(page);
const reloadResult = await page.evaluate(async () => {
  const docs = await new Promise((resolve, reject) => {
    const open = indexedDB.open("SkyesDocsDB", 4);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("documents", "readonly");
      const req = tx.objectStore("documents").getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || []);
    };
  });
  return {
    persisted: docs.some((doc) => doc.title === "Full Smoke SkyeDocxMax"),
    count: docs.length,
    serviceWorkerController: Boolean(navigator.serviceWorker?.controller),
  };
});

await browser.close();

if (!result.title.includes("SkyeDocxMax")) throw new Error(`Unexpected title: ${result.title}`);
if (result.activeDocTitle !== "Full Smoke SkyeDocxMax") throw new Error("Active document mismatch after import.");
if (!result.hasRecoveryKit) throw new Error("Failsafe recovery kit was not generated.");
if (!result.wrongPassphraseFailed) throw new Error("Wrong passphrase did not fail cleanly.");
if (!result.downloads.some((item) => item.filename.endsWith(".skye") && item.size > 0)) throw new Error("Missing .skye export proof.");
if (!result.downloads.some((item) => item.filename.endsWith("_HTML.zip") && item.size > 0)) throw new Error("Missing HTML ZIP export proof.");
if (!result.downloads.some((item) => item.filename.endsWith(".txt") && item.size > 0)) throw new Error("Missing TXT export proof.");
if (!result.governance?.comments) throw new Error("Governance comments proof missing.");
if (!result.governance?.suggestions) throw new Error("Governance suggestions proof missing.");
if (!result.governance?.versions) throw new Error("Governance timeline proof missing.");
if (!result.governance?.hasPageBreak) throw new Error("Governance page break proof missing.");
if (result.governance?.classification !== "confidential") throw new Error("Governance metadata proof missing.");
if (!result.governance?.templateCreated) throw new Error("Governance template proof missing.");
if (!result.outboxKeys.length) throw new Error("Cross-app local outbox proof missing.");
if (!result.evidenceKeys.length) throw new Error("Evidence localStorage proof missing.");
if (!result.bridgeKeys.length) throw new Error("Bridge localStorage proof missing.");
if (!result.intentKeys.length) throw new Error("Intent localStorage proof missing.");
if (!reloadResult.persisted) throw new Error("Document did not persist across reload.");

const severeMessages = messages.filter((message) => {
  return !message.includes("Failed to load resource") &&
    !message.includes("ERR_FAILED") &&
    !message.includes("404") &&
    !message.includes("net::ERR");
});
if (severeMessages.length) throw new Error(`Browser errors:\n${severeMessages.join("\n")}`);

console.log(JSON.stringify({ ok: true, result, reloadResult }, null, 2));
