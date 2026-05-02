(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const runtimeConfig = globalThis.__SKYEGATE_RUNTIME__ || globalThis.__KAIXU_RUNTIME__ || {};
  const runtimeAuth = { token: "" };
  const store = {
    get token() {
      return runtimeAuth.token ||
        String(
          runtimeConfig.userToken ||
          runtimeConfig.sessionToken ||
          runtimeConfig.authToken ||
          runtimeConfig.bearerToken ||
          runtimeConfig.auth?.token ||
          runtimeConfig.auth?.bearerToken ||
          ""
        ).trim();
    },
    set token(v) { runtimeAuth.token = String(v || "").trim(); },
    get apiBase() { return (localStorage.getItem("SKYGATE_USER_API_BASE") || "").trim(); },
    set apiBase(v) { localStorage.setItem("SKYGATE_USER_API_BASE", String(v || "").trim()); }
  };

  function clearLegacyUserToken() {
    try { sessionStorage.removeItem("SKYGATE_USER_TOKEN"); } catch {}
    try { localStorage.removeItem("SKYGATE_USER_TOKEN"); } catch {}
  }

  function apiUrl(path) {
    const base = String(store.apiBase || "").replace(/\/+$/, "");
    return base ? `${base}${path}` : path;
  }
  function money(cents) { return "$" + (Math.round(Number(cents || 0)) / 100).toFixed(2); }
  function monthKeyUTC() { return new Date().toISOString().slice(0, 7); }
  function esc(v) { return String(v || "").replace(/[&<>'"]/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;" }[c])); }
  function usd(n) { return "$" + Number(n || 0).toFixed(4); }

  const toast = $("#userToast");
  function showToast(msg, ok = true) {
    if (!toast) return;
    toast.textContent = msg;
    toast.className = "toast " + (ok ? "good" : "bad");
    toast.style.display = "block";
    setTimeout(() => (toast.style.display = "none"), 4500);
  }

  function setAuthUI(isAuthed) {
    $("#userLoginView").style.display = isAuthed ? "none" : "block";
    $("#userAppView").style.display = isAuthed ? "block" : "none";
    $("#userLogoutBtn").style.display = isAuthed ? "inline-flex" : "none";
  }

  async function apiUser(path, { method = "GET", body = null } = {}) {
    const token = store.token;
    if (!token) throw new Error("Not logged in");
    const headers = { authorization: `Bearer ${token}` };
    if (body !== null) headers["content-type"] = "application/json";
    const res = await fetch(apiUrl(path), { method, headers, body: body !== null ? JSON.stringify(body) : undefined });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    return ct.includes("application/json") ? res.json() : res;
  }

  async function downloadUserExport(type) {
    const token = store.token;
    const month = ($("#userMonth")?.value || monthKeyUTC()).trim();
    const res = await fetch(apiUrl(`/.netlify/functions/user-export?type=${encodeURIComponent(type)}&month=${encodeURIComponent(month)}`), {
      headers: { authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `skygate-${type}-${month}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function switchTab(name) {
    $$(".user-tab").forEach((btn) => btn.classList.toggle("active", btn.dataset.userTab === name));
    $$(".user-panel").forEach((panel) => { panel.style.display = "none"; });
    const active = $(`#user-tab-${name}`);
    if (active) active.style.display = "block";
  }

  async function loadOverview() {
    const month = ($("#userMonth")?.value || monthKeyUTC()).trim();
    const [summary, events] = await Promise.all([
      apiUser(`/.netlify/functions/user-summary?month=${encodeURIComponent(month)}`),
      apiUser(`/.netlify/functions/user-events?month=${encodeURIComponent(month)}&limit=200`)
    ]);
    $("#userPlan").textContent = summary.customer?.plan_name || "—";
    $("#userSpent").textContent = money(summary.month?.customer_spent_cents || 0);
    $("#userRemaining").textContent = money(summary.month?.customer_remaining_cents || 0);
    $("#userKeySpent").textContent = money(summary.month?.key_spent_cents || 0);

    const tbody = $("#userProviderSummaryTable tbody");
    tbody.innerHTML = (events.summary_by_provider || []).map((row) => `
      <tr>
        <td>${esc(row.provider)}</td>
        <td>${esc(row.calls)}</td>
        <td>${money(row.cost_cents)}</td>
        <td>${esc(row.input_tokens)}</td>
        <td>${esc(row.output_tokens)}</td>
      </tr>
    `).join("") || `<tr><td colspan="5" class="muted small">No provider activity this month.</td></tr>`;

    renderEvents(events.events || []);
  }

  async function loadPricing() {
    const month = ($("#userMonth")?.value || monthKeyUTC()).trim();
    const data = await apiUser(`/.netlify/functions/user-pricing?month=${encodeURIComponent(month)}`);
    $("#userPricingSource").textContent = data.pricing_source || "pricing/pricing.json";
    $("#userPricingProviderPolicy").textContent = data.access_policy?.providers?.source || "open";
    $("#userPricingModelPolicy").textContent = data.access_policy?.models?.source || "open";
    $("#userPricingCalls").textContent = String(data.month_rollup?.key_calls || 0);

    const tbody = $("#userPricingTable tbody");
    tbody.innerHTML = (data.ai_pricing || []).map((row) => `
      <tr>
        <td>${esc(row.provider)}</td>
        <td>${esc(row.model)}</td>
        <td>${row.allowed ? "yes" : "no"}</td>
        <td>${usd(row.input_per_1m_usd)}</td>
        <td>${usd(row.output_per_1m_usd)}</td>
        <td>${row.used_this_month ? esc(row.used_this_month_calls) : "0"}</td>
        <td>${money(row.used_this_month_cost_cents || 0)}</td>
      </tr>
    `).join("") || `<tr><td colspan="7" class="muted small">No pricing rows found.</td></tr>`;

    $("#userPushPricingJson").textContent = data.push_pricing
      ? JSON.stringify(data.push_pricing, null, 2)
      : "No push pricing configured for this customer.";
  }

  function renderEvents(events) {
    const tbody = $("#userEventsTable tbody");
    tbody.innerHTML = events.map((row) => `
      <tr>
        <td>${esc(row.created_at)}</td>
        <td>${esc(row.provider)}</td>
        <td>${esc(row.model)}</td>
        <td>${esc(row.input_tokens)}</td>
        <td>${esc(row.output_tokens)}</td>
        <td>${money(row.cost_cents)}</td>
        <td>${esc(row.install_id || "—")}</td>
      </tr>
    `).join("") || `<tr><td colspan="7" class="muted small">No events.</td></tr>`;
  }

  async function loadBilling() {
    const month = ($("#userMonth")?.value || monthKeyUTC()).trim();
    const data = await apiUser(`/.netlify/functions/user-invoices?month=${encodeURIComponent(month)}`);
    const snap = data?.snapshot || {};
    const totals = snap?.totals || {};
    const topups = Array.isArray(snap?.topups) ? snap.topups.reduce((sum, row) => sum + Number(row.amount_cents || 0), 0) : 0;
    $("#userInvoiceAiSpend").textContent = money(totals.spent_cents || 0);
    $("#userInvoicePushSpend").textContent = money(totals.push_total_cents || 0);
    $("#userInvoiceTopups").textContent = money(topups);
    $("#userInvoiceGrandTotal").textContent = money(totals.grand_total_cents || 0);
    $("#userInvoiceProviderBreakdown").textContent = Array.isArray(snap?.providers) && snap.providers.length
      ? JSON.stringify(snap.providers, null, 2)
      : "No provider breakdown available for this month.";
    $("#userInvoiceJson").textContent = JSON.stringify(data, null, 2);
  }

  async function loadDevices() {
    const data = await apiUser("/.netlify/functions/user-devices");
    const tbody = $("#userDevicesTable tbody");
    tbody.innerHTML = (data.devices || []).map((row) => `
      <tr>
        <td>${esc(row.install_id)}</td>
        <td>${esc(row.last_seen_at || row.created_at || "—")}</td>
        <td>${row.revoked_at ? "yes" : "no"}</td>
        <td><button class="btn ghost user-device-toggle" data-install-id="${esc(row.install_id)}" data-revoked="${row.revoked_at ? "1" : "0"}">${row.revoked_at ? "Restore" : "Revoke"}</button></td>
      </tr>
    `).join("") || `<tr><td colspan="4" class="muted small">No devices.</td></tr>`;

    $$(".user-device-toggle").forEach((btn) => btn.addEventListener("click", async () => {
      try {
        await apiUser("/.netlify/functions/user-devices", {
          method: "PATCH",
          body: { install_id: btn.dataset.installId, revoked: btn.dataset.revoked !== "1" }
        });
        showToast("Device updated.", true);
        await loadDevices();
      } catch (error) {
        showToast(error.message, false);
      }
    }));
  }

  async function loadVoice() {
    const data = await apiUser("/.netlify/functions/user-voice-summary");
    $("#userVoiceRate").textContent = "$" + Number(data.voice?.pricing?.usd_per_minute_est || 0).toFixed(4);
    const tbody = $("#userVoiceTable tbody");
    tbody.innerHTML = (data.voice?.numbers || []).map((row) => `
      <tr>
        <td>${esc(row.phone_number)}</td>
        <td>${esc(row.provider)}</td>
        <td>${row.is_active ? "yes" : "no"}</td>
        <td>${esc(row.default_llm_provider || "—")}</td>
        <td>${esc(row.default_llm_model || "—")}</td>
        <td>${esc(row.locale || "—")}</td>
      </tr>
    `).join("") || `<tr><td colspan="6" class="muted small">No voice numbers configured.</td></tr>`;
  }

  async function loadAll() {
    await Promise.all([loadOverview(), loadPricing(), loadBilling(), loadDevices(), loadVoice()]);
  }

  $("#userLoginBtn")?.addEventListener("click", async () => {
    const token = ($("#userToken")?.value || "").trim();
    if (!token) return showToast("Enter a session token or runtime lane grant.", false);
    store.token = token;
    store.apiBase = ($("#userApiBase")?.value || "").trim();
    try {
      await loadAll();
      setAuthUI(true);
      showToast("User dashboard ready.", true);
      $("#userToken").value = "";
    } catch (error) {
      store.token = "";
      showToast(error.message, false);
      setAuthUI(false);
    }
  });

  $("#userLogoutBtn")?.addEventListener("click", () => {
    store.token = "";
    clearLegacyUserToken();
    setAuthUI(false);
    showToast("Logged out.", true);
  });

  $("#userRefreshOverview")?.addEventListener("click", () => loadOverview().catch((e) => showToast(e.message, false)));
  $("#userRefreshEvents")?.addEventListener("click", async () => {
    const month = ($("#userMonth")?.value || monthKeyUTC()).trim();
    const data = await apiUser(`/.netlify/functions/user-events?month=${encodeURIComponent(month)}&limit=200`);
    renderEvents(data.events || []);
  });
  $("#userRefreshBilling")?.addEventListener("click", () => loadBilling().catch((e) => showToast(e.message, false)));
  $("#userRefreshPricing")?.addEventListener("click", () => loadPricing().catch((e) => showToast(e.message, false)));
  $("#userRefreshDevices")?.addEventListener("click", () => loadDevices().catch((e) => showToast(e.message, false)));
  $("#userRefreshVoice")?.addEventListener("click", () => loadVoice().catch((e) => showToast(e.message, false)));
  $("#userExportEvents")?.addEventListener("click", () => downloadUserExport("events").catch((e) => showToast(e.message, false)));
  $("#userExportSummary")?.addEventListener("click", () => downloadUserExport("summary").catch((e) => showToast(e.message, false)));
  $("#userExportInvoice")?.addEventListener("click", () => downloadUserExport("invoice").catch((e) => showToast(e.message, false)));
  $("#userTopupBtn")?.addEventListener("click", async () => {
    try {
      const amount_cents = parseInt(($("#userTopupCents")?.value || "").trim(), 10);
      const month = ($("#userMonth")?.value || monthKeyUTC()).trim();
      const data = await apiUser("/.netlify/functions/user-topup-checkout", { method: "POST", body: { amount_cents, month } });
      if (data?.url) window.location.href = data.url;
    } catch (error) {
      showToast(error.message, false);
    }
  });

  $$(".user-tab").forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.userTab)));

  (function boot() {
    clearLegacyUserToken();
    const m = $("#userMonth");
    if (m && !m.value) m.value = monthKeyUTC();
    $("#userApiBase").value = store.apiBase || "";
    if (store.token) {
      setAuthUI(true);
      loadAll().catch(() => {
        store.token = "";
        setAuthUI(false);
      });
    } else {
      setAuthUI(false);
    }
  })();
})();
