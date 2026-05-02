const state = {
  token: sessionStorage.getItem("valleyVerifiedToken") || localStorage.getItem("valleyVerifiedToken") || "",
  contractors: [],
  jobs: [],
  fulfillments: [],
  session: null,
};

const el = (id) => document.getElementById(id);
if (localStorage.getItem("valleyVerifiedToken")) {
  sessionStorage.setItem("valleyVerifiedToken", localStorage.getItem("valleyVerifiedToken"));
  localStorage.removeItem("valleyVerifiedToken");
}
const notice = (message) => { el("notice").textContent = message; };
const sessionNotice = (message) => {
  const target = el("sessionNotice");
  if (target) target.textContent = message;
};

function authHeaders() {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${state.token}`,
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: options.method ? { ...authHeaders(), ...(options.headers || {}) } : (options.headers || {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function render() {
  el("jobsList").innerHTML = state.jobs.map((job) => `
    <div class="item">
      <strong>${job.title || "Untitled job"}</strong>
      <p>${job.company || ""} · ${job.type || "general"} · ${job.location || ""}</p>
      <small>${job.status} · ${job.id}</small>
      <button class="button secondary claim-btn" data-job="${job.id}" type="button">Claim with first contractor</button>
    </div>
  `).join("") || '<div class="item"><p>No open jobs yet.</p></div>';

  el("contractorsList").innerHTML = state.contractors.map((contractor) => `
    <div class="item">
      <strong>${contractor.name}</strong>
      <p>${contractor.email} · ${contractor.serviceArea || ""}</p>
      <small>${contractor.status} · ${contractor.id}</small>
    </div>
  `).join("") || '<div class="item"><p>No contractors loaded yet.</p></div>';

  el("fulfillmentsList").innerHTML = state.fulfillments.map((fulfillment) => `
    <div class="item">
      <strong>${fulfillment.company || "Company"} · ${fulfillment.status}</strong>
      <p>${fulfillment.contractor || ""} · ${fulfillment.procurement_status || ""} · ${fulfillment.payment_status || ""}</p>
      <small>${fulfillment.id}</small>
      <div class="board-head">
        <button class="button secondary fulfillment-btn" data-id="${fulfillment.id}" data-status="in_progress" type="button">Mark In Progress</button>
        <button class="button secondary fulfillment-btn" data-id="${fulfillment.id}" data-status="fulfilled" type="button">Mark Fulfilled</button>
      </div>
    </div>
  `).join("") || '<div class="item"><p>No fulfillments yet.</p></div>';

  document.querySelectorAll(".claim-btn").forEach((button) => {
    button.addEventListener("click", () => claimJob(button.dataset.job).catch((error) => notice(error.message)));
  });
  document.querySelectorAll(".fulfillment-btn").forEach((button) => {
    button.addEventListener("click", () => updateFulfillment(button.dataset.id, button.dataset.status).catch((error) => notice(error.message)));
  });
}

async function refresh() {
  const [jobs, contractors, fulfillment] = await Promise.all([
    api("/.netlify/functions/valley-jobs?status=all"),
    api("/.netlify/functions/valley-contractors?status=all"),
    api("/.netlify/functions/valley-fulfillment"),
  ]);
  state.jobs = jobs.jobs || [];
  state.contractors = contractors.contractors || [];
  state.fulfillments = fulfillment.fulfillments || [];
  render();
}

async function postJob() {
  const data = await api("/.netlify/functions/valley-jobs", {
    method: "POST",
    body: JSON.stringify({
      company: el("jobCompany").value,
      title: el("jobTitle").value,
      type: el("jobType").value,
      location: el("jobLocation").value,
      rate_cents: Number(el("jobRate").value || 0),
      description: el("jobDescription").value,
    }),
  });
  notice(`Posted ${data.job.id} into ValleyVerified, JobPing, AE Flow, and SkyeRoutex lanes.`);
  await refresh();
}

async function onboardContractor() {
  const data = await api("/.netlify/functions/valley-contractors", {
    method: "POST",
    body: JSON.stringify({
      name: el("contractorName").value,
      email: el("contractorEmail").value,
      serviceArea: el("contractorArea").value,
      skills: el("contractorSkills").value,
      status: el("contractorStatus").value,
      source: "valleyverified-dashboard",
    }),
  });
  notice(`Onboarded contractor ${data.contractor.id} into AE Contractor Network review.`);
  await refresh();
}

async function claimJob(jobId) {
  const contractor = state.contractors[0];
  if (!contractor) return notice("Onboard a contractor first.");
  const data = await api("/.netlify/functions/valley-claims", {
    method: "POST",
    body: JSON.stringify({ job_id: jobId, contractor_id: contractor.id }),
  });
  notice(`Claim accepted. Fulfillment ${data.fulfillment.id} is ready for SkyeRoutex work-order/payment state.`);
  await refresh();
}

async function updateFulfillment(fulfillmentId, status) {
  const data = await api("/.netlify/functions/valley-fulfillment", {
    method: "PUT",
    body: JSON.stringify({
      fulfillment_id: fulfillmentId,
      status,
      procurement_status: status === "fulfilled" ? "closed" : "in_motion",
      payment_status: status === "fulfilled" ? "ready_for_release" : "pending_skye_routex",
    }),
  });
  notice(`Fulfillment ${data.fulfillment.id} moved to ${data.fulfillment.status}.`);
  await refresh();
}

async function loginLocalOperator() {
  const data = await api("/.netlify/functions/valley-session", {
    method: "POST",
    body: JSON.stringify({
      email: el("operatorEmail").value,
      password: el("operatorPassword").value,
    }),
  });
  state.token = String(data.token || "").replace(/^Bearer\s+/i, "");
  state.session = data.operator || null;
  sessionStorage.setItem("valleyVerifiedToken", state.token);
  el("tokenInput").value = state.token;
  sessionNotice(`Operator session ready for ${data.operator?.email || "operator"} via ${data.operator?.mode || "local lane"}.`);
  await refresh();
}

async function refreshSession() {
  if (!state.token) {
    state.session = null;
    sessionNotice("No active operator session.");
    return;
  }
  const data = await api("/.netlify/functions/valley-session");
  state.session = data.claims || null;
  sessionNotice(data.authenticated ? `Session active for ${data.claims?.email || data.claims?.sub || "operator"}.` : "Session not authenticated.");
}

function wire() {
  el("tokenInput").value = state.token;
  el("tokenInput").addEventListener("change", () => {
    state.token = el("tokenInput").value.trim().replace(/^Bearer\s+/i, "");
    if (state.token) sessionStorage.setItem("valleyVerifiedToken", state.token);
    else sessionStorage.removeItem("valleyVerifiedToken");
  });
  el("operatorLoginBtn").addEventListener("click", () => loginLocalOperator().catch((error) => sessionNotice(error.message)));
  el("sessionRefreshBtn").addEventListener("click", () => refreshSession().catch((error) => sessionNotice(error.message)));
  el("refreshBtn").addEventListener("click", () => refresh().catch((error) => notice(error.message)));
  el("refreshFulfillmentBtn").addEventListener("click", () => refresh().catch((error) => notice(error.message)));
  el("postJobBtn").addEventListener("click", () => postJob().catch((error) => notice(error.message)));
  el("contractorBtn").addEventListener("click", () => onboardContractor().catch((error) => notice(error.message)));
  refresh().catch((error) => notice(error.message));
  refreshSession().catch(() => sessionNotice("Local operator login is available when configured."));
}

wire();
