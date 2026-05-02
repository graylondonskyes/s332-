
const state = {
  leads: [],
  stats: {},
  selectedIds: new Set(),
  activeLeadId: null
};

const INTEGRATED_SUPPLIER_MOUNT = /\/ops\/music-nexus\/supplier-acquisition\/?$/i.test(window.location.pathname || "");
const INTEGRATED_API_BASE = "/api/commandhub/supplier-acquisition";

function normaliseIntegratedPath(input = "") {
  try {
    const parsed = new URL(String(input || ""), window.location.origin);
    return parsed.pathname + (parsed.search || "");
  } catch {
    return String(input || "");
  }
}

function buildIntegratedRequest(inputPath = "", options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const parsed = new URL(normaliseIntegratedPath(inputPath), window.location.origin);
  const pathname = parsed.pathname;
  const search = parsed.searchParams;
  const body = options.body && typeof options.body === "object" ? options.body : {};
  const jsonHeaders = { "content-type": "application/json" };
  if (pathname === "/api/health" && method === "GET") {
    return { url: `${INTEGRATED_API_BASE}?view=health`, options: { method: "GET" } };
  }
  if (pathname === "/api/prompt" && method === "GET") {
    return { url: `${INTEGRATED_API_BASE}?view=prompt`, options: { method: "GET" } };
  }
  if (pathname === "/api/prompt" && method === "PUT") {
    return { url: INTEGRATED_API_BASE, options: { method: "POST", headers: jsonHeaders, body: JSON.stringify({ action: "setPromptProfile", promptProfile: body.promptProfile || "" }) } };
  }
  if (pathname === "/api/leads" && method === "GET") {
    const params = new URLSearchParams({ view: "leads" });
    if (search.get("status")) params.set("status", search.get("status"));
    return { url: `${INTEGRATED_API_BASE}?${params.toString()}`, options: { method: "GET" } };
  }
  if (pathname === "/api/leads/next-draft-ready" && method === "GET") {
    return { url: `${INTEGRATED_API_BASE}?view=nextDraftReady`, options: { method: "GET" } };
  }
  if (pathname === "/api/leads/mark-contacted" && method === "POST") {
    return { url: INTEGRATED_API_BASE, options: { method: "POST", headers: jsonHeaders, body: JSON.stringify({ action: "markContacted", ids: body.ids || [], channel: body.channel || "manual" }) } };
  }
  if (pathname.startsWith("/api/leads/") && method === "GET") {
    const leadId = pathname.split("/").pop();
    return { url: `${INTEGRATED_API_BASE}?view=lead&id=${encodeURIComponent(leadId)}`, options: { method: "GET" } };
  }
  if (pathname.startsWith("/api/leads/") && method === "PATCH") {
    const leadId = pathname.split("/").pop();
    return { url: INTEGRATED_API_BASE, options: { method: "POST", headers: jsonHeaders, body: JSON.stringify({ action: "updateLead", leadId, status: body.status, notes: body.notes, contactEmail: body.contactEmail }) } };
  }
  if (pathname === "/api/diagnostics/url" && method === "POST") {
    return { url: INTEGRATED_API_BASE, options: { method: "POST", headers: jsonHeaders, body: JSON.stringify({ action: "inspectUrl", url: body.url || "" }) } };
  }
  if (pathname === "/api/pipeline/search" && method === "POST") {
    return { url: INTEGRATED_API_BASE, options: { method: "POST", headers: jsonHeaders, body: JSON.stringify(Object.assign({ action: "runSearchPipeline" }, body || {})) } };
  }
  if (pathname === "/api/pipeline/search-html" && method === "POST") {
    return { url: INTEGRATED_API_BASE, options: { method: "POST", headers: jsonHeaders, body: JSON.stringify(Object.assign({ action: "runSearchHtmlPipeline" }, body || {})) } };
  }
  if (pathname === "/api/pipeline/urls" && method === "POST") {
    return { url: INTEGRATED_API_BASE, options: { method: "POST", headers: jsonHeaders, body: JSON.stringify(Object.assign({ action: "runUrlPipeline" }, body || {})) } };
  }
  return { url: inputPath, options };
}

function supplierCsvExportUrl() {
  return INTEGRATED_SUPPLIER_MOUNT ? `${INTEGRATED_API_BASE}?view=exportCsv` : "/api/export.csv";
}

const $ = (id) => document.getElementById(id);

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(path, options = {}) {
  let config = { ...options };
  let url = path;
  if (INTEGRATED_SUPPLIER_MOUNT) {
    const mapped = buildIntegratedRequest(path, config);
    url = mapped.url;
    config = mapped.options || {};
  } else if (config.body && typeof config.body !== "string") {
    config.headers = { ...(config.headers || {}), "content-type": "application/json" };
    config.body = JSON.stringify(config.body);
  }
  const res = await fetch(url, config);
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data?.error || `Request failed: ${res.status}`);
  return data;
}

function setBusy(button, label, busy) {
  if (!button) return;
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? label : button.dataset.label;
}

function selectedIds() {
  return Array.from(state.selectedIds);
}

function renderStats(stats = {}) {
  state.stats = stats;
  $("statTotal").textContent = stats.total || 0;
  $("statNew").textContent = stats.new || 0;
  $("statReviewed").textContent = stats.reviewed || 0;
  $("statDraftReady").textContent = stats.draft_ready || 0;
  $("statContacted").textContent = stats.contacted || 0;
  $("statReplied").textContent = stats.replied || 0;
  $("statAccepted").textContent = stats.accepted || 0;
  $("statWithDrafts").textContent = stats.withDrafts || 0;
}

function renderLeadTable() {
  const tbody = $("leadsTableBody");
  const filter = $("statusFilter").value;
  const leads = state.leads.filter((lead) => !filter || lead.status === filter);
  $("leadCount").textContent = `${leads.length} leads`;
  tbody.innerHTML = leads.map((lead) => {
    const score = lead?.extracted?.fit_score ?? "—";
    const moq = lead?.extracted?.visible_moq || "—";
    const price = lead?.extracted?.visible_price_range || "—";
    const unitQuote = lead?.extracted?.unit_quote_possible || "—";
    const why = lead?.extracted?.reason_to_contact || "—";
    const hasDrafts = lead.drafts ? "ready" : "—";
    return `
      <tr>
        <td><input type="checkbox" data-select-id="${lead.id}" ${state.selectedIds.has(lead.id) ? "checked" : ""} /></td>
        <td>
          <div class="lead-title">${escapeHtml(lead.title || "Untitled lead")}</div>
          <div class="muted small-url">${escapeHtml(lead.url || "")}</div>
        </td>
        <td>${escapeHtml(String(score))}</td>
        <td>${escapeHtml(lead.status)}</td>
        <td>${escapeHtml(moq)}</td>
        <td>${escapeHtml(price)}</td>
        <td>${escapeHtml(unitQuote)}</td>
        <td>${escapeHtml(why)}</td>
        <td>${escapeHtml(hasDrafts)}</td>
        <td><button class="button secondary small" data-open-id="${lead.id}">Open</button></td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll("[data-select-id]").forEach((el) => {
    el.addEventListener("change", () => {
      const id = el.getAttribute("data-select-id");
      if (el.checked) state.selectedIds.add(id);
      else state.selectedIds.delete(id);
    });
  });

  tbody.querySelectorAll("[data-open-id]").forEach((el) => {
    el.addEventListener("click", () => openLead(el.getAttribute("data-open-id")));
  });
}

function renderDetail(lead) {
  state.activeLeadId = lead?.id || null;
  if (!lead) {
    $("emptyDetail").classList.remove("hidden");
    $("detailContent").classList.add("hidden");
    return;
  }

  $("emptyDetail").classList.add("hidden");
  $("detailContent").classList.remove("hidden");
  $("detailTitle").textContent = lead.title || "Untitled lead";
  $("detailUrl").textContent = lead.url || "";
  $("detailUrl").href = lead.url || "#";
  $("detailStatusSelect").value = lead.status || "new";
  $("detailEmail").value = lead.contactEmail || lead?.extracted?.contact_email || "";
  $("detailNotes").value = lead.notes || "";
  $("detailRawText").value = lead.rawText || "";
  $("detailExtracted").textContent = JSON.stringify(lead.extracted || {}, null, 2);
  $("draftAlibaba").value = lead?.drafts?.alibaba_opener || "";
  $("draftSubject").value = lead?.drafts?.email_subject || "";
  $("draftBody").value = lead?.drafts?.email_body || "";
  $("draftFollowup").value = lead?.drafts?.followup_1 || "";
  $("draftMoq").value = lead?.drafts?.moq_reply || "";
}

async function loadHealth() {
  const health = await api("/api/health");
  const badge = $("healthBadge");
  badge.textContent = health.openaiConfigured ? "OpenAI ready" : "OpenAI key missing";
  badge.classList.toggle("ok", Boolean(health.openaiConfigured));
  badge.classList.toggle("bad", !health.openaiConfigured);
  renderStats(health.stats || {});
}

async function loadPrompt() {
  const data = await api("/api/prompt");
  $("promptInput").value = data.promptProfile || "";
}

async function loadLeads() {
  const status = $("statusFilter").value;
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await api(`/api/leads${query}`);
  state.leads = data.leads || [];
  renderStats(data.stats || {});
  renderLeadTable();
  if (state.activeLeadId) {
    const active = state.leads.find((lead) => lead.id === state.activeLeadId);
    renderDetail(active || null);
  }
}

async function openLead(id) {
  const data = await api(`/api/leads/${id}`);
  renderDetail(data.lead);
}

function currentThreshold() {
  return Number($("minFitScoreInput").value || 55);
}

async function runPipeline(path, payload, button) {
  try {
    setBusy(button, "Running…", true);
    const data = await api(path, { method: "POST", body: { ...payload, minFitScore: currentThreshold() } });
    state.selectedIds = new Set((data.leads || []).filter((lead) => lead.status === "draft_ready").map((lead) => lead.id));
    await loadLeads();
    const drafted = state.leads.find((lead) => lead.status === "draft_ready");
    if (drafted) renderDetail(drafted);
    alert(`Batch finished. Created ${data.created}, extracted ${data.extractedCount}, drafted ${data.draftedCount}.`);
  } catch (error) {
    alert(error.message);
  } finally {
    setBusy(button, "Running…", false);
  }
}

async function runDiagnostics() {
  const button = $("diagnosticUrlBtn");
  try {
    setBusy(button, "Diagnosing…", true);
    const url = $("searchUrlInput").value.trim();
    const data = await api("/api/diagnostics/url", { method: "POST", body: { url } });
    $("diagnosticOutput").value = JSON.stringify(data.report, null, 2);
  } catch (error) {
    alert(error.message);
  } finally {
    setBusy(button, "Diagnosing…", false);
  }
}

async function savePrompt() {
  const button = $("savePromptBtn");
  try {
    setBusy(button, "Saving…", true);
    await api("/api/prompt", { method: "PUT", body: { promptProfile: $("promptInput").value } });
    alert("Prompt profile saved.");
  } catch (error) {
    alert(error.message);
  } finally {
    setBusy(button, "Saving…", false);
  }
}

async function markSelectedContacted() {
  const ids = selectedIds();
  if (!ids.length) return alert("Select at least one lead first.");
  try {
    await api("/api/leads/mark-contacted", { method: "POST", body: { ids, channel: "manual" } });
    await loadLeads();
    if (state.activeLeadId) await openLead(state.activeLeadId);
  } catch (error) {
    alert(error.message);
  }
}

async function saveLead() {
  if (!state.activeLeadId) return;
  try {
    const data = await api(`/api/leads/${state.activeLeadId}`, {
      method: "PATCH",
      body: {
        status: $("detailStatusSelect").value,
        notes: $("detailNotes").value,
        contactEmail: $("detailEmail").value
      }
    });
    const idx = state.leads.findIndex((lead) => lead.id === data.lead.id);
    if (idx >= 0) state.leads[idx] = data.lead;
    renderLeadTable();
    renderDetail(data.lead);
    renderStats(data.stats || state.stats);
  } catch (error) {
    alert(error.message);
  }
}

async function nextDraftReady() {
  const data = await api("/api/leads/next-draft-ready");
  if (!data.lead) return alert("No draft-ready lead available.");
  renderDetail(data.lead);
}

function exportCsv() {
  window.location.href = supplierCsvExportUrl();
}

function bindEvents() {
  $("runSearchPipelineBtn").addEventListener("click", () => {
    const searchUrl = $("searchUrlInput").value.trim();
    if (!searchUrl) return alert("Paste a search/results URL first.");
    runPipeline("/api/pipeline/search", { searchUrl }, $("runSearchPipelineBtn"));
  });

  $("runHtmlPipelineBtn").addEventListener("click", () => {
    const html = $("searchHtmlInput").value.trim();
    const baseUrl = $("searchHtmlBaseUrlInput").value.trim();
    if (!html) return alert("Paste the search page HTML first.");
    runPipeline("/api/pipeline/search-html", { html, baseUrl }, $("runHtmlPipelineBtn"));
  });

  $("runUrlPipelineBtn").addEventListener("click", () => {
    const urlsText = $("urlsInput").value.trim();
    if (!urlsText) return alert("Paste at least one supplier URL first.");
    runPipeline("/api/pipeline/urls", { urlsText }, $("runUrlPipelineBtn"));
  });

  $("diagnosticUrlBtn").addEventListener("click", runDiagnostics);
  $("savePromptBtn").addEventListener("click", savePrompt);
  $("markContactedBtn").addEventListener("click", markSelectedContacted);
  $("saveLeadBtn").addEventListener("click", saveLead);
  $("nextLeadBtn").addEventListener("click", nextDraftReady);
  $("exportBtn").addEventListener("click", exportCsv);
  $("statusFilter").addEventListener("change", loadLeads);

  document.querySelectorAll(".copy-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const targetId = button.getAttribute("data-copy-target");
      const text = $(targetId).value || "";
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied";
      setTimeout(() => { button.textContent = button.dataset.label || button.textContent; }, 900);
    });
    button.dataset.label = button.textContent;
  });
}

async function init() {
  bindEvents();
  await loadHealth();
  await loadPrompt();
  await loadLeads();
}

init().catch((error) => {
  console.error(error);
  alert(error.message);
});
