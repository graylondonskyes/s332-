const state = {
  token: localStorage.getItem("skyeCardToken") || "",
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const el = (id) => document.getElementById(id);

function setNotice(message, ready = false) {
  el("notice").textContent = message;
  el("statusPill").textContent = ready ? "Connected" : "Offline";
  el("statusPill").classList.toggle("ready", ready);
}

function headers() {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${state.token}`,
  };
}

function cents(value) {
  return money.format((Number(value || 0)) / 100);
}

function setBalances(summary) {
  const balances = summary?.balances || {};
  el("aiBalance").textContent = cents(balances.ai_usage?.available_cents);
  el("productBalance").textContent = cents(balances.product_credit?.available_cents);
  el("serviceBalance").textContent = cents(balances.service_credit?.available_cents);
  el("pushBalance").textContent = String(balances.pushes?.available_units || 0);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

async function refreshCard() {
  if (!state.token) {
    setNotice("Connect a SkyGate token to load balances and offers.");
    return;
  }
  const data = await api("/.netlify/functions/skye-cards");
  setBalances(data);
  setNotice(data.has_card ? "SkyeCard loaded." : "No active SkyeCard yet. Setup Dev Starter to begin.", true);
}

async function setupCard() {
  if (!state.token) return setNotice("Connect a SkyGate token first.");
  const data = await api("/.netlify/functions/skye-card-setup-checkout", {
    method: "POST",
    body: JSON.stringify({
      card_type: "dev_starter",
      success_url: window.location.href.split("#")[0] + "?skyecard=setup-success#dashboard",
      cancel_url: window.location.href.split("#")[0] + "?skyecard=setup-cancel#dashboard",
    }),
  });
  window.location.href = data.url;
}

async function applyMonthly() {
  if (!state.token) return setNotice("Connect a SkyGate token first.");
  const data = await api("/.netlify/functions/skye-cards", {
    method: "POST",
    body: JSON.stringify({ action: "monthly-benefits" }),
  });
  setBalances(data);
  setNotice(`Monthly benefits applied: ${data.credits_applied || 0} new ledger entries.`, true);
}

async function buyOffer(offerId) {
  if (!state.token) return setNotice("Connect a SkyGate token first.");
  const data = await api("/.netlify/functions/skye-card-offer-checkout", {
    method: "POST",
    body: JSON.stringify({
      offer_id: offerId,
      success_url: window.location.href.split("#")[0] + "?skyecard=offer-success#dashboard",
      cancel_url: window.location.href.split("#")[0] + "?skyecard=offer-cancel#offers",
    }),
  });
  window.location.href = data.url;
}

function wire() {
  el("tokenInput").value = state.token;
  el("saveTokenBtn").addEventListener("click", () => {
    state.token = el("tokenInput").value.trim().replace(/^Bearer\s+/i, "");
    localStorage.setItem("skyeCardToken", state.token);
    refreshCard().catch((error) => setNotice(error.message));
  });
  el("refreshBtn").addEventListener("click", () => refreshCard().catch((error) => setNotice(error.message)));
  el("setupCardBtn").addEventListener("click", () => setupCard().catch((error) => setNotice(error.message)));
  el("monthlyBtn").addEventListener("click", () => applyMonthly().catch((error) => setNotice(error.message)));
  document.querySelectorAll(".offer-btn").forEach((button) => {
    button.addEventListener("click", () => buyOffer(button.dataset.offer).catch((error) => setNotice(error.message)));
  });

  const params = new URLSearchParams(window.location.search);
  const result = params.get("skyecard");
  if (result === "setup-success") setNotice("Setup submitted. Stripe webhook will issue the card after confirmation.", true);
  if (result === "offer-success") setNotice("Offer checkout submitted. Stripe webhook will apply the ledger credit after confirmation.", true);
  if (state.token) refreshCard().catch((error) => setNotice(error.message));
}

wire();
