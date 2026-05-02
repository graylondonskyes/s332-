(function () {
  const stateUrl = '/v1/state';
  const localStateUrl = './runtime/store.json';
  const e2eUrl = '/v1/e2e/run';
  const proofRunsUrl = '/v1/proof-runs';
  let currentState = null;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const money = (value) => `$${Number(value || 0).toLocaleString()}`;

  function toast(message) {
    const node = $('#toast');
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { node.hidden = true; }, 3800);
  }

  async function apiJson(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.json();
  }

  function isEndpointMissing(error) {
    return /404|Failed to fetch|NetworkError|Load failed/i.test(String(error?.message || error));
  }

  async function loadState() {
    try {
      const store = await apiJson(stateUrl);
      store.__stateSource = 'runtime-route';
      return store;
    } catch (error) {
      const store = await apiJson(localStateUrl);
      store.__stateSource = 'local-store-fallback';
      store.__stateSourceError = error.message;
      return store;
    }
  }

  function latest(list) {
    return Array.isArray(list) && list.length ? list[list.length - 1] : null;
  }

  function renderMetrics(store) {
    const quality = latest(store.qualityGate.runs);
    const cert = latest(store.valuation.certificationRuns);
    const metrics = [
      ['Donors Forged', quality?.scannedDonorCount || store.workspaces[0]?.donorPlatformIds?.length || 0],
      ['Quality Findings', quality?.totalFindings || 0],
      ['Certified Assets', cert?.summary?.assetCount || 0],
      ['Portfolio Value', money(cert?.summary?.issuedTechnicalValueTotal || 0)]
    ];
    $('#metrics').innerHTML = metrics.map(([label, value]) => `
      <article class="metric"><span>${label}</span><strong>${value}</strong></article>
    `).join('');
  }

  function renderHero(store) {
    const workspace = latest(store.workspaces) || {};
    const cert = latest(store.valuation.certificationRuns);
    const sourceLabel = store.__stateSource === 'local-store-fallback'
      ? 'local runtime snapshot'
      : 'runtime route';
    $('#workspaceName').textContent = workspace.name || 'SkyeForgeMax Workspace';
    $('#workspaceStatus').textContent = `${store.brand?.tagline || 'Runtime ready'} · ${store.auditEvents.length} audit events captured · source: ${sourceLabel}`;
    $('#portfolioCert').textContent = cert?.summary?.portfolioCertification || 'Pending';
  }

  function renderFlow(store) {
    const proofFlow = {
      envSet: latest(store.sovereign.envSets)?.envSetId,
      intake: latest(store.intake.submissions)?.submissionId,
      project: latest(store.aeCentral.projects)?.projectId,
      contentPlan: latest(store.aeCentral.contentPlans)?.contentPlanId,
      publishPayload: latest(store.aeCentral.publishPayloads)?.publishPayloadId,
      assistant: latest(store.roleAssistant.messages)?.messageId,
      qualityGate: latest(store.qualityGate.runs)?.qualityRunId,
      valuation: latest(store.valuation.certificationRuns)?.certificationRunId,
      handoff: latest(store.sovereign.handoffPackages)?.handoffPackageId,
      dashboard: latest(store.houseCommand.dashboards)?.dashboardId
    };
    $('#flowGrid').innerHTML = Object.entries(proofFlow).map(([label, value]) => `
      <div class="flow-step"><strong>${label}</strong><code>${value || 'pending'}</code></div>
    `).join('');
  }

  function renderHouse(store) {
    const dashboard = latest(store.houseCommand.dashboards);
    const widgets = dashboard?.widgets || {};
    const items = [
      ['Intake Inbox', widgets.intakeInbox?.count || 0],
      ['AE Projects', widgets.growth?.projects || 0],
      ['Publish Payloads', widgets.growth?.publishPayloads || 0],
      ['Assistant Messages', widgets.assistant?.messages || 0],
      ['Quality Findings', widgets.quality?.totalFindings || 0],
      ['Env Sets', widgets.envVault?.envSetCount || 0]
    ];
    $('#houseWidgets').innerHTML = items.map(([label, value]) => `
      <div class="widget"><strong>${value}</strong><span>${label}</span></div>
    `).join('');
  }

  function renderModules(store) {
    const quality = latest(store.qualityGate.runs);
    const byPlatform = new Map((quality?.results || []).map((result) => [result.platformId, result]));
    const platforms = store.workspaces[0]?.donorPlatformIds || [];
    $('#moduleGrid').innerHTML = platforms.map((platformId) => {
      const result = byPlatform.get(platformId);
      return `
        <div class="module">
          <strong>${platformId}</strong>
          <p>${result?.name || 'Integrated module'}</p>
          <code>${result ? `${result.summary.filesScanned} files · ${result.summary.totalFindings} findings` : 'awaiting scan'}</code>
        </div>
      `;
    }).join('');
  }

  function renderQuality(store) {
    const quality = latest(store.qualityGate.runs);
    $('#qualityRows').innerHTML = (quality?.results || []).map((result) => `
      <tr>
        <td>${result.name}</td>
        <td>${result.summary.filesScanned}</td>
        <td>${result.summary.routesDeclared}</td>
        <td>${result.summary.totalFindings}</td>
        <td><code>${result.artifacts.markdown}</code></td>
      </tr>
    `).join('');
  }

  function renderValuation(store) {
    const cert = latest(store.valuation.certificationRuns);
    $('#valuationRows').innerHTML = (cert?.assets || []).map((asset) => `
      <tr>
        <td>${asset.name}</td>
        <td>${asset.certification}</td>
        <td>${asset.readinessScore}</td>
        <td>${asset.repairPriority}</td>
        <td>${money(asset.issuedTechnicalValue)}</td>
      </tr>
    `).join('');
  }

  function renderBindings(store) {
    const bindings = store.sovereign.providerBindings || [];
    $('#bindingList').innerHTML = bindings.map((binding) => {
      const missing = binding.requiredVars.filter((key) => !binding.presentVars.includes(key));
      return `
        <div class="binding">
          <div class="binding-head">
            <strong>${binding.provider}</strong>
            <span class="status">${binding.status}</span>
          </div>
          <code>${missing.length ? missing.join(', ') : 'live-ready'}</code>
        </div>
      `;
    }).join('');
    $('#liveVarMini').innerHTML = bindings.map((binding) => `
      <div class="mini-var"><span>${binding.provider}</span><strong>${binding.status === 'live-ready' ? 'Ready' : 'Missing'}</strong></div>
    `).join('');
  }

  function renderAudit(store) {
    $('#auditList').innerHTML = store.auditEvents.slice().reverse().map((event) => `
      <li><strong>${event.action}</strong><span>${event.entityType || 'runtime'} · ${event.at}</span></li>
    `).join('');
  }

  function render(store) {
    currentState = store;
    renderHero(store);
    renderMetrics(store);
    renderFlow(store);
    renderHouse(store);
    renderModules(store);
    renderQuality(store);
    renderValuation(store);
    renderBindings(store);
    renderAudit(store);
  }

  async function refresh() {
    render(await loadState());
  }

  async function runE2E() {
    toast('Forging full end-to-end run...');
    try {
      await apiJson(e2eUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reset: true })
      });
      await refresh();
      toast('SkyeForgeMax e2e run completed.');
    } catch (error) {
      if (currentState?.__stateSource === 'local-store-fallback' && isEndpointMissing(error)) {
        throw new Error('Local snapshot mode found no /v1/e2e/run endpoint.');
      }
      throw error;
    }
  }

  async function inspectProofRuns() {
    try {
      const proofRuns = await apiJson(proofRunsUrl);
      const summary = proofRuns.lastRunId
        ? `Latest proof ${proofRuns.lastRunId} at ${proofRuns.lastRunAt || 'unknown time'}.`
        : 'No local proof runs recorded yet.';
      toast(summary);
    } catch (error) {
      if (currentState?.__stateSource === 'local-store-fallback' && isEndpointMissing(error)) {
        toast('Local snapshot mode found no /v1/proof-runs endpoint.');
        return;
      }
      toast(error.message);
    }
  }

  $$('.nav-item').forEach((button) => {
    button.addEventListener('click', () => {
      $$('.nav-item').forEach((item) => item.classList.remove('active'));
      $$('.view').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      $(`[data-panel="${button.dataset.view}"]`)?.classList.add('active');
    });
  });

  $('[data-refresh]').addEventListener('click', () => refresh().then(() => {
    const mode = currentState?.__stateSource === 'local-store-fallback' ? ' from local snapshot.' : '.';
    toast(`Runtime state refreshed${mode}`);
  }).catch((error) => toast(error.message)));
  $('[data-run-e2e]').addEventListener('click', () => runE2E().catch((error) => toast(error.message)));
  document.querySelector('a[href="/v1/proof-runs"]')?.addEventListener('click', (event) => {
    if (location.origin.startsWith('http')) return;
    event.preventDefault();
    inspectProofRuns();
  });

  refresh().catch((error) => {
    toast(`Unable to load runtime state: ${error.message}`);
    console.error(error);
  });
})();
