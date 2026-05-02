/* SkyePortal Vault — Local-first encrypted control plane
   - IndexedDB storage
   - Passphrase-derived AES-GCM key (PBKDF2)
   - Encrypted export/import
   - Netlify broker integration (mint token, deploy rules via Firebase Rules API)
*/

(function () {
  "use strict";

  // ---------- Utilities ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const nowISO = () => new Date().toISOString();

  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }

  function csvSplit(s) {
    return (s || "").split(",").map(x => x.trim()).filter(Boolean);
  }

  function toast(el, msg, ms = 2200) {
    el.textContent = msg;
    if (!msg) return;
    setTimeout(() => { if (el.textContent === msg) el.textContent = ""; }, ms);
  }

  // ---------- IndexedDB ----------
  const DB_NAME = "skyeportal_vault_db";
  const DB_VERSION = 1;

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
        if (!db.objectStoreNames.contains("rulesPacks")) db.createObjectStore("rulesPacks", { keyPath: "id" });
        if (!db.objectStoreNames.contains("apps")) db.createObjectStore("apps", { keyPath: "id" });
        if (!db.objectStoreNames.contains("envProfiles")) db.createObjectStore("envProfiles", { keyPath: "id" });
        if (!db.objectStoreNames.contains("audit")) db.createObjectStore("audit", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
    });
  }

  async function txGet(db, store, key) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, "readonly").objectStore(store).get(key);
      t.onsuccess = () => resolve(t.result || null);
      t.onerror = () => reject(t.error);
    });
  }

  async function txPut(db, store, value) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, "readwrite").objectStore(store).put(value);
      t.onsuccess = () => resolve(true);
      t.onerror = () => reject(t.error);
    });
  }

  async function txDel(db, store, key) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, "readwrite").objectStore(store).delete(key);
      t.onsuccess = () => resolve(true);
      t.onerror = () => reject(t.error);
    });
  }

  async function txAll(db, store) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, "readonly").objectStore(store).getAll();
      t.onsuccess = () => resolve(t.result || []);
      t.onerror = () => reject(t.error);
    });
  }

  // ---------- WebCrypto (AES-GCM + PBKDF2) ----------
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function b64uFromBytes(bytes) {
    let bin = "";
    bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function bytesFromB64u(s) {
    const b64 = (s || "").replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function deriveKey(passphrase, saltB64u) {
    const salt = saltB64u ? bytesFromB64u(saltB64u) : crypto.getRandomValues(new Uint8Array(16));
    const baseKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    const key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 250000,
        hash: "SHA-256"
      },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    return { key, saltB64u: b64uFromBytes(salt) };
  }

  async function encryptJson(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = enc.encode(JSON.stringify(obj));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
    return { iv: b64uFromBytes(iv), ct: b64uFromBytes(ct) };
  }

  async function decryptJson(key, payload) {
    const iv = bytesFromB64u(payload.iv);
    const ct = bytesFromB64u(payload.ct);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return JSON.parse(dec.decode(pt));
  }

  // ---------- State ----------
  const state = {
    db: null,
    unlocked: false,
    key: null,
    saltB64u: null,
    data: {
      projects: [],
      rulesPacks: [],
      apps: [],
      envProfiles: [],
      audit: []
    },
    broker: {
      baseUrl: "",
      appId: "vault-ui",
      jwt: ""
    }
  };

  // ---------- Audit ----------
  async function audit(action, details = {}) {
    const entry = {
      id: uid("audit"),
      ts: nowISO(),
      action,
      details
    };
    state.data.audit.unshift(entry);
    await txPut(state.db, "audit", entry);
    renderAudit();
  }

  // ---------- Unlock / Init ----------
  async function ensureMeta() {
    const meta = await txGet(state.db, "meta", "vault_meta");
    return meta || null;
  }

  async function setMeta(meta) {
    await txPut(state.db, "meta", { key: "vault_meta", ...meta });
  }

  async function unlockFlow(passphrase, mode) {
    const statusEl = $("#unlockStatus");
    toast(statusEl, "Working…");

    const meta = await ensureMeta();
    if (mode === "init") {
      if (meta && meta.saltB64u) {
        toast(statusEl, "Vault already exists. Choose Unlock existing.", 3500);
        return false;
      }
      const { key, saltB64u } = await deriveKey(passphrase, null);
      state.key = key;
      state.saltB64u = saltB64u;

      // seed empty encrypted blob
      const emptyPayload = await encryptJson(state.key, {
        projects: [],
        rulesPacks: [],
        apps: [],
        envProfiles: [],
        audit: []
      });

      await setMeta({ saltB64u, sealed: emptyPayload, createdAt: nowISO(), updatedAt: nowISO() });
      toast(statusEl, "Vault initialized ✅");
      await audit("vault:init", {});
      return await unlockExisting(passphrase);
    }

    if (!meta || !meta.saltB64u || !meta.sealed) {
      toast(statusEl, "No vault found. Choose Initialize new vault.", 3500);
      return false;
    }

    return await unlockExisting(passphrase);
  }

  async function unlockExisting(passphrase) {
    const statusEl = $("#unlockStatus");
    const meta = await ensureMeta();
    const { key, saltB64u } = await deriveKey(passphrase, meta.saltB64u);

    try {
      const decoded = await decryptJson(key, meta.sealed);
      state.key = key;
      state.saltB64u = saltB64u;
      state.data.projects = decoded.projects || [];
      state.data.rulesPacks = decoded.rulesPacks || [];
      state.data.apps = decoded.apps || [];
      state.data.envProfiles = decoded.envProfiles || [];
      state.data.audit = decoded.audit || [];
      state.unlocked = true;

      $("#unlock").classList.add("hidden");
      $("#shell").classList.remove("hidden");
      selectTab("dashboard");
      refreshAll();
      toast(statusEl, "Unlocked ✅");
      await audit("vault:unlock", {});
      return true;
    } catch (e) {
      console.error(e);
      toast(statusEl, "Wrong passphrase or corrupt vault ❌", 4000);
      return false;
    }
  }

  async function sealVault() {
    const meta = await ensureMeta();
    if (!state.key) return;

    const payload = await encryptJson(state.key, {
      projects: state.data.projects,
      rulesPacks: state.data.rulesPacks,
      apps: state.data.apps,
      envProfiles: state.data.envProfiles,
      audit: state.data.audit
    });

    await setMeta({
      saltB64u: state.saltB64u,
      sealed: payload,
      createdAt: meta?.createdAt || nowISO(),
      updatedAt: nowISO()
    });
  }

  async function lockVault() {
    await sealVault();
    state.unlocked = false;
    state.key = null;
    state.saltB64u = null;
    state.data = { projects: [], rulesPacks: [], apps: [], envProfiles: [], audit: [] };

    $("#shell").classList.add("hidden");
    $("#unlock").classList.remove("hidden");
    $("#passphrase").value = "";
    $("#unlockStatus").textContent = "";
  }

  // ---------- Rendering ----------
  function selectTab(tab) {
    $$(".nav__item").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    $$(".tab").forEach(t => t.classList.add("hidden"));
    const el = $("#tab_" + tab);
    if (el) el.classList.remove("hidden");
  }

  function refreshAll() {
    renderStats();
    renderProjects();
    renderRules();
    renderApps();
    renderEnv();
    renderAudit();
    syncSelects();
  }

  function renderStats() {
    $("#statProjects").textContent = String(state.data.projects.length);
    $("#statRules").textContent = String(state.data.rulesPacks.length);
    $("#statApps").textContent = String(state.data.apps.length);
    $("#statEnv").textContent = String(state.data.envProfiles.length);
  }

  function itemShell(title, metaLines, badges, actionsHtml) {
    const badgeHtml = (badges || []).map(b => `<span class="badge ${b.kind||""}">${escapeHtml(b.text)}</span>`).join("");
    const metaHtml = (metaLines || []).map(l => `<div class="item__meta">${escapeHtml(l)}</div>`).join("");
    return `
      <div class="item">
        <div class="item__top">
          <div>
            <div class="item__title">${escapeHtml(title)}</div>
            ${metaHtml}
            ${badgeHtml ? `<div class="badges">${badgeHtml}</div>` : ``}
          </div>
          <div class="item__actions">${actionsHtml || ""}</div>
        </div>
      </div>
    `;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderProjects() {
    const el = $("#projectsList");
    const list = state.data.projects.slice().sort((a,b) => (a.name||"").localeCompare(b.name||""));
    el.innerHTML = list.map(p => itemShell(
      `${p.name} (${p.env})`,
      [
        `projectId: ${p.projectId}`,
        `origins: ${(p.allowedOrigins||[]).join(", ") || "—"}`
      ],
      [{ text: "Firebase", kind: "badge--gold" }],
      `
        <button class="btn btn--ghost" data-act="editProject" data-id="${p.id}">Edit</button>
        <button class="btn btn--ghost" data-act="copyPublicConfig" data-id="${p.id}">Copy Public Config</button>
        <button class="btn btn--danger" data-act="delProject" data-id="${p.id}">Delete</button>
      `
    )).join("");

    el.querySelectorAll("button[data-act]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const act = btn.dataset.act;
        const id = btn.dataset.id;
        const p = state.data.projects.find(x => x.id === id);
        if (!p) return;
        if (act === "editProject") openProjectDialog(p);
        if (act === "copyPublicConfig") {
          await navigator.clipboard.writeText(JSON.stringify(p.publicConfig || {}, null, 2));
          await audit("project:copy_public_config", { projectId: p.projectId });
        }
        if (act === "delProject") {
          if (!confirm("Delete project?")) return;
          state.data.projects = state.data.projects.filter(x => x.id !== id);
          await txDel(state.db, "projects", id);
          await audit("project:delete", { projectId: p.projectId });
          await sealVault();
          refreshAll();
        }
      });
    });
  }

  function renderRules() {
    const el = $("#rulesList");
    const list = state.data.rulesPacks.slice().sort((a,b) => (a.name||"").localeCompare(b.name||""));
    el.innerHTML = list.map(r => itemShell(
      r.name,
      [
        `tags: ${(r.tags||[]).join(", ") || "—"}`,
        `updated: ${r.updatedAt || r.createdAt || "—"}`
      ],
      (r.tags||[]).slice(0,4).map(t => ({ text: t, kind: "badge--gold" })),
      `
        <button class="btn btn--ghost" data-act="editRules" data-id="${r.id}">Edit</button>
        <button class="btn btn--ghost" data-act="copyFirestore" data-id="${r.id}">Copy Firestore</button>
        <button class="btn btn--ghost" data-act="copyStorage" data-id="${r.id}">Copy Storage</button>
        <button class="btn btn--danger" data-act="delRules" data-id="${r.id}">Delete</button>
      `
    )).join("");

    el.querySelectorAll("button[data-act]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const act = btn.dataset.act;
        const id = btn.dataset.id;
        const r = state.data.rulesPacks.find(x => x.id === id);
        if (!r) return;
        if (act === "editRules") openRulesDialog(r);
        if (act === "copyFirestore") {
          await navigator.clipboard.writeText(r.firestoreRules || "");
          await audit("rules:copy_firestore", { pack: r.name });
        }
        if (act === "copyStorage") {
          await navigator.clipboard.writeText(r.storageRules || "");
          await audit("rules:copy_storage", { pack: r.name });
        }
        if (act === "delRules") {
          if (!confirm("Delete rules pack?")) return;
          state.data.rulesPacks = state.data.rulesPacks.filter(x => x.id !== id);
          await txDel(state.db, "rulesPacks", id);
          await audit("rules:delete", { pack: r.name });
          await sealVault();
          refreshAll();
        }
      });
    });
  }

  function renderApps() {
    const el = $("#appsList");
    const list = state.data.apps.slice().sort((a,b) => (a.name||"").localeCompare(b.name||""));
    el.innerHTML = list.map(a => itemShell(
      `${a.name}`,
      [
        `appId: ${a.appId}`,
        `defaultProject: ${a.defaultProjectId || "—"}`,
        `origins: ${(a.allowedOrigins||[]).join(", ") || "—"}`
      ],
      [{ text: "App Identity", kind: "badge--gold" }],
      `
        <button class="btn btn--ghost" data-act="editApp" data-id="${a.id}">Edit</button>
        <button class="btn btn--ghost" data-act="copyAppId" data-id="${a.id}">Copy App ID</button>
        <button class="btn btn--danger" data-act="delApp" data-id="${a.id}">Delete</button>
      `
    )).join("");

    el.querySelectorAll("button[data-act]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const act = btn.dataset.act;
        const id = btn.dataset.id;
        const a = state.data.apps.find(x => x.id === id);
        if (!a) return;

        if (act === "editApp") openAppDialog(a);
        if (act === "copyAppId") {
          await navigator.clipboard.writeText(a.appId);
          await audit("app:copy_appId", { appId: a.appId });
        }
        if (act === "delApp") {
          if (!confirm("Delete app?")) return;
          state.data.apps = state.data.apps.filter(x => x.id !== id);
          await txDel(state.db, "apps", id);
          await audit("app:delete", { appId: a.appId });
          await sealVault();
          refreshAll();
        }
      });
    });
  }

  function renderEnv() {
    const el = $("#envList");
    const list = state.data.envProfiles.slice().sort((a,b) => (a.name||"").localeCompare(b.name||""));
    el.innerHTML = list.map(e => {
      const app = state.data.apps.find(x => x.id === e.appId);
      const proj = state.data.projects.find(x => x.id === e.projectId);
      return itemShell(
        `${e.name} (${e.env})`,
        [
          `app: ${app?.name || "—"} (${app?.appId || "—"})`,
          `project: ${proj?.name || "—"} (${proj?.projectId || "—"})`
        ],
        [{ text: "Env Profile", kind: "badge--gold" }],
        `
          <button class="btn btn--ghost" data-act="editEnv" data-id="${e.id}">Edit</button>
          <button class="btn btn--ghost" data-act="exportEnv" data-id="${e.id}">Export</button>
          <button class="btn btn--danger" data-act="delEnv" data-id="${e.id}">Delete</button>
        `
      );
    }).join("");

    el.querySelectorAll("button[data-act]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const act = btn.dataset.act;
        const id = btn.dataset.id;
        const e = state.data.envProfiles.find(x => x.id === id);
        if (!e) return;

        if (act === "editEnv") openEnvDialog(e);
        if (act === "exportEnv") openEnvExport(e);
        if (act === "delEnv") {
          if (!confirm("Delete env profile?")) return;
          state.data.envProfiles = state.data.envProfiles.filter(x => x.id !== id);
          await txDel(state.db, "envProfiles", id);
          await audit("env:delete", { name: e.name });
          await sealVault();
          refreshAll();
        }
      });
    });
  }

  function renderAudit() {
    const el = $("#auditList");
    const list = state.data.audit || [];
    el.innerHTML = list.slice(0, 200).map(a => itemShell(
      a.action,
      [
        `ts: ${a.ts}`,
        `details: ${JSON.stringify(a.details || {})}`
      ],
      [{ text: "Audit", kind: "badge--gold" }],
      ``
    )).join("");
  }

  function syncSelects() {
    // Apps default project select
    const sDefault = $("#a_defaultProject");
    if (sDefault) {
      sDefault.innerHTML = `<option value="">—</option>` + state.data.projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.env)})</option>`).join("");
    }

    // Env dialog selects
    $("#e_app").innerHTML = state.data.apps.map(a => `<option value="${a.id}">${escapeHtml(a.name)} (${escapeHtml(a.appId)})</option>`).join("");
    $("#e_project").innerHTML = state.data.projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.env)})</option>`).join("");

    // Broker deploy selects
    $("#d_project").innerHTML = state.data.projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.env)})</option>`).join("");
    $("#d_pack").innerHTML = state.data.rulesPacks.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join("");
  }

  // ---------- Dialogs ----------
  let editingProjectId = null;
  function openProjectDialog(p = null) {
    editingProjectId = p?.id || null;
    $("#dlgProjectTitle").textContent = p ? "Edit Project" : "New Project";
    $("#p_name").value = p?.name || "";
    $("#p_env").value = p?.env || "prod";
    $("#p_projectId").value = p?.projectId || "";
    $("#p_origins").value = (p?.allowedOrigins || []).join(", ");
    $("#p_publicConfig").value = p?.publicConfig ? JSON.stringify(p.publicConfig, null, 2) : "";
    $("#p_notes").value = p?.notes || "";
    $("#dlgProject").showModal();
  }

  let editingRulesId = null;
  function openRulesDialog(r = null) {
    editingRulesId = r?.id || null;
    $("#dlgRulesTitle").textContent = r ? "Edit Rules Pack" : "New Rules Pack";
    $("#r_name").value = r?.name || "";
    $("#r_tags").value = (r?.tags || []).join(", ");
    $("#r_firestore").value = r?.firestoreRules || defaultFirestoreRules();
    $("#r_storage").value = r?.storageRules || defaultStorageRules();
    $("#dlgRules").showModal();
  }

  let editingAppId = null;
  function openAppDialog(a = null) {
    editingAppId = a?.id || null;
    $("#dlgAppTitle").textContent = a ? "Edit App" : "New App";
    $("#a_name").value = a?.name || "";
    $("#a_appId").value = a?.appId || "";
    $("#a_origins").value = (a?.allowedOrigins || []).join(", ");
    $("#a_defaultProject").value = a?.defaultProjectId || "";
    $("#a_notes").value = a?.notes || "";
    $("#dlgApp").showModal();
  }

  let editingEnvId = null;
  function openEnvDialog(e = null) {
    editingEnvId = e?.id || null;
    $("#dlgEnvTitle").textContent = e ? "Edit Env Profile" : "New Env Profile";
    $("#e_app").value = e?.appId || (state.data.apps[0]?.id || "");
    $("#e_project").value = e?.projectId || (state.data.projects[0]?.id || "");
    $("#e_name").value = e?.name || "";
    $("#e_env").value = e?.env || "prod";
    $("#e_public").value = e?.publicEnv ? JSON.stringify(e.publicEnv, null, 2) : "{}";
    $("#e_private").value = e?.privateEnv ? JSON.stringify(e.privateEnv, null, 2) : "{}";
    $("#dlgEnv").showModal();
  }

  async function openEnvExport(e) {
    const dlg = $("#dlgEnvExport");
    const netlify = envToNetlifyBlock(e.publicEnv || {});
    const dotenv = envToDotenv(e.publicEnv || {});
    $("#envNetlify").value = netlify;
    $("#envDotenv").value = dotenv;
    await audit("env:export_blocks", { name: e.name });
    dlg.showModal();
  }

  function envToNetlifyBlock(obj) {
    const lines = Object.entries(obj || {})
      .filter(([k,v]) => k && v !== undefined)
      .map(([k,v]) => `${k}=${String(v).replace(/\n/g, "\\n")}`);
    return lines.join("\n");
  }

  function envToDotenv(obj) {
    return envToNetlifyBlock(obj);
  }

  function defaultFirestoreRules() {
    return `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Baseline: require auth by default.
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;
  }

  function defaultStorageRules() {
    return `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Baseline: require auth by default.
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;
  }

  // ---------- Save actions ----------
  async function saveProject() {
    const name = $("#p_name").value.trim();
    const env = $("#p_env").value;
    const projectId = $("#p_projectId").value.trim();
    const allowedOrigins = csvSplit($("#p_origins").value);
    const publicConfig = safeJsonParse($("#p_publicConfig").value.trim() || "{}", {});
    const notes = $("#p_notes").value.trim();

    const obj = {
      id: editingProjectId || uid("proj"),
      name, env, projectId, allowedOrigins, publicConfig, notes,
      createdAt: editingProjectId ? (state.data.projects.find(x => x.id === editingProjectId)?.createdAt || nowISO()) : nowISO(),
      updatedAt: nowISO()
    };

    const existsIdx = state.data.projects.findIndex(x => x.id === obj.id);
    if (existsIdx >= 0) state.data.projects[existsIdx] = obj;
    else state.data.projects.push(obj);

    await txPut(state.db, "projects", obj);
    await audit(editingProjectId ? "project:update" : "project:create", { projectId });
    await sealVault();
    refreshAll();
  }

  async function saveRules() {
    const name = $("#r_name").value.trim();
    const tags = csvSplit($("#r_tags").value);
    const firestoreRules = $("#r_firestore").value;
    const storageRules = $("#r_storage").value;

    const obj = {
      id: editingRulesId || uid("rules"),
      name, tags, firestoreRules, storageRules,
      createdAt: editingRulesId ? (state.data.rulesPacks.find(x => x.id === editingRulesId)?.createdAt || nowISO()) : nowISO(),
      updatedAt: nowISO()
    };

    const idx = state.data.rulesPacks.findIndex(x => x.id === obj.id);
    if (idx >= 0) state.data.rulesPacks[idx] = obj;
    else state.data.rulesPacks.push(obj);

    await txPut(state.db, "rulesPacks", obj);
    await audit(editingRulesId ? "rules:update" : "rules:create", { pack: name });
    await sealVault();
    refreshAll();
  }

  async function saveApp() {
    const name = $("#a_name").value.trim();
    const appId = $("#a_appId").value.trim();
    const allowedOrigins = csvSplit($("#a_origins").value);
    const defaultProjectId = $("#a_defaultProject").value || "";
    const notes = $("#a_notes").value.trim();

    const obj = {
      id: editingAppId || uid("app"),
      name, appId, allowedOrigins, defaultProjectId, notes,
      createdAt: editingAppId ? (state.data.apps.find(x => x.id === editingAppId)?.createdAt || nowISO()) : nowISO(),
      updatedAt: nowISO()
    };

    const idx = state.data.apps.findIndex(x => x.id === obj.id);
    if (idx >= 0) state.data.apps[idx] = obj;
    else state.data.apps.push(obj);

    await txPut(state.db, "apps", obj);
    await audit(editingAppId ? "app:update" : "app:create", { appId });
    await sealVault();
    refreshAll();
  }

  async function saveEnv() {
    const appId = $("#e_app").value;
    const projectId = $("#e_project").value;
    const name = $("#e_name").value.trim();
    const env = $("#e_env").value;
    const publicEnv = safeJsonParse($("#e_public").value.trim() || "{}", {});
    const privateEnv = safeJsonParse($("#e_private").value.trim() || "{}", {});

    const obj = {
      id: editingEnvId || uid("env"),
      appId, projectId, name, env,
      publicEnv,
      privateEnv, // stored inside sealed vault; do not export as cleartext except vault export (encrypted)
      createdAt: editingEnvId ? (state.data.envProfiles.find(x => x.id === editingEnvId)?.createdAt || nowISO()) : nowISO(),
      updatedAt: nowISO()
    };

    const idx = state.data.envProfiles.findIndex(x => x.id === obj.id);
    if (idx >= 0) state.data.envProfiles[idx] = obj;
    else state.data.envProfiles.push(obj);

    await txPut(state.db, "envProfiles", obj);
    await audit(editingEnvId ? "env:update" : "env:create", { name });
    await sealVault();
    refreshAll();
  }

  // ---------- Export / Import ----------
  async function exportVault() {
    await sealVault();
    const meta = await ensureMeta();
    const payload = {
      kind: "skyeportal_vault_export",
      v: 1,
      exportedAt: nowISO(),
      saltB64u: meta.saltB64u,
      sealed: meta.sealed
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skyeportal-vault-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await audit("vault:export", {});
  }

  async function importVaultFile(file) {
    const txt = await file.text();
    const payload = safeJsonParse(txt, null);
    if (!payload || payload.kind !== "skyeportal_vault_export" || !payload.sealed || !payload.saltB64u) {
      alert("Invalid vault export file.");
      return;
    }
    await txPut(state.db, "meta", { key: "vault_meta", saltB64u: payload.saltB64u, sealed: payload.sealed, createdAt: nowISO(), updatedAt: nowISO() });
    await audit("vault:import", {});
    alert("Imported. Now unlock with the correct passphrase.");
    await lockVault();
  }

  // ---------- Broker Calls ----------
  async function mintToken() {
    const statusEl = $("#b_status");
    toast(statusEl, "Minting…");
    const baseUrl = $("#b_url").value.trim().replace(/\/$/, "");
    const appId = $("#b_appId").value.trim();
    const secret = $("#b_secret").value;
    const scopes = csvSplit($("#b_scopes").value);

    if (!baseUrl || !appId || !secret) {
      toast(statusEl, "Missing Broker URL / App ID / Secret", 3500);
      return;
    }

    const res = await fetch(`${baseUrl}/.netlify/functions/mint`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: secret, scopes })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(statusEl, `Mint failed: ${data.error || res.status}`, 4000);
      return;
    }

    state.broker.baseUrl = baseUrl;
    state.broker.appId = appId;
    state.broker.jwt = data.token;
    $("#b_jwt").value = data.token || "";
    toast(statusEl, `Token minted ✅ (exp ${data.expires_in}s)`, 3500);
    await audit("broker:mint", { appId, scopes });
  }

  async function testBroker() {
    const statusEl = $("#b_status");
    const baseUrl = $("#b_url").value.trim().replace(/\/$/, "");
    if (!baseUrl) return toast(statusEl, "Set Broker Base URL first", 3000);

    const res = await fetch(`${baseUrl}/.netlify/functions/config?app_id=vault-ui`, { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast(statusEl, `Broker config failed: ${data.error || res.status}`, 3500);
    toast(statusEl, `Broker reachable ✅`, 2500);
    await audit("broker:test", {});
  }

  async function deployRules() {
    const statusEl = $("#d_status");
    const resultEl = $("#d_result");
    resultEl.value = "";
    toast(statusEl, "Deploying…");

    const baseUrl = $("#b_url").value.trim().replace(/\/$/, "");
    const jwt = $("#b_jwt").value.trim();
    if (!baseUrl || !jwt) return toast(statusEl, "Mint token first", 3500);

    const projId = $("#d_project").value;
    const packId = $("#d_pack").value;
    const deployFirestore = $("#d_firestore").value === "yes";
    const deployStorage = $("#d_storage").value === "yes";

    const proj = state.data.projects.find(x => x.id === projId);
    const pack = state.data.rulesPacks.find(x => x.id === packId);
    if (!proj || !pack) return toast(statusEl, "Select project and rules pack", 3500);

    const body = {
      projectId: proj.projectId,
      firestoreRules: deployFirestore ? pack.firestoreRules : null,
      storageRules: deployStorage ? pack.storageRules : null,
      label: `vault-${pack.name}`.slice(0, 60)
    };

    const res = await fetch(`${baseUrl}/.netlify/functions/deployRules`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${jwt}`
      },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));
    resultEl.value = JSON.stringify(data, null, 2);

    if (!res.ok) {
      toast(statusEl, `Deploy failed: ${data.error || res.status}`, 4500);
      await audit("broker:deploy_rules_fail", { projectId: proj.projectId, pack: pack.name, error: data.error || res.status });
      return;
    }

    toast(statusEl, "Deployed ✅", 3500);
    await audit("broker:deploy_rules_ok", { projectId: proj.projectId, pack: pack.name, deployed: data.deployed || {} });
  }

  // ---------- Wiring ----------
  async function init() {
    state.db = await openDB();

    // Register SW
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }

    // Nav
    $$(".nav__item[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => selectTab(btn.dataset.tab));
    });

    // Goto shortcuts
    $$("[data-goto]").forEach(btn => {
      btn.addEventListener("click", () => selectTab(btn.dataset.goto));
    });

    // Unlock
    $("#btnUnlock").addEventListener("click", async () => {
      const pass = $("#passphrase").value;
      const mode = $("#mode").value;
      await unlockFlow(pass, mode);
    });

    // Lock
    $("#btnLock").addEventListener("click", lockVault);

    // Export/Import
    $("#btnExport").addEventListener("click", exportVault);
    $("#btnImport").addEventListener("click", () => $("#fileImport").click());
    $("#fileImport").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (file) await importVaultFile(file);
      e.target.value = "";
    });

    // Projects
    $("#btnAddProject").addEventListener("click", () => openProjectDialog(null));
    $("#btnSaveProject").addEventListener("click", async (e) => { e.preventDefault(); await saveProject(); });

    // Rules
    $("#btnAddRules").addEventListener("click", () => openRulesDialog(null));
    $("#btnSaveRules").addEventListener("click", async (e) => { e.preventDefault(); await saveRules(); });

    // Apps
    $("#btnAddApp").addEventListener("click", () => openAppDialog(null));
    $("#btnSaveApp").addEventListener("click", async (e) => { e.preventDefault(); await saveApp(); });

    // Env
    $("#btnAddEnv").addEventListener("click", () => openEnvDialog(null));
    $("#btnSaveEnv").addEventListener("click", async (e) => { e.preventDefault(); await saveEnv(); });

    // Broker
    $("#btnMint").addEventListener("click", mintToken);
    $("#btnDeploy").addEventListener("click", deployRules);
    $("#btnBrokerTest").addEventListener("click", testBroker);

    // Audit
    $("#btnClearAudit").addEventListener("click", async () => {
      if (!confirm("Clear audit log?")) return;
      // wipe store
      const items = await txAll(state.db, "audit");
      for (const it of items) await txDel(state.db, "audit", it.id);
      state.data.audit = [];
      await sealVault();
      renderAudit();
    });

    // Default tab button states
    selectTab("dashboard");
  }

  init().catch(console.error);
})();
