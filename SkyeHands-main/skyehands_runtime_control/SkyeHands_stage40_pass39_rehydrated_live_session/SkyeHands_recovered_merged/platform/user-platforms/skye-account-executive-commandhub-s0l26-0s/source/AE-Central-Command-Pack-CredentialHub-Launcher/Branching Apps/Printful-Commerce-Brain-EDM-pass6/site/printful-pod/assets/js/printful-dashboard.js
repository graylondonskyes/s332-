
(() => {
  const config = window.PRINTFUL_EMBED_CONFIG || {};
  const state = { runtime: null, storage: null, data: { incomingArtifacts: [], lockedOrders: [], clientPackages: [] } };
  function qs(selector) { return document.querySelector(selector); }
  function setText(selector, text) { const node = qs(selector); if (node) node.textContent = text; }
  function setHtml(selector, html) { const node = qs(selector); if (node) node.innerHTML = html; }
  function currency(value) {
    const code = state.runtime?.catalog?.brand?.currency || 'USD';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(Number(value || 0)); }
    catch { return `$${Number(value || 0).toFixed(2)}`; }
  }
  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Request failed');
    return data;
  }
  function setStatus(text) { setText('#pf-dashboard-status', text); }
  function statusCounts(packages) {
    return packages.reduce((acc, pkg) => {
      const key = String(pkg.payload?.tracker?.currentStatus || pkg.tracker?.currentStatus || 'quoted');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }
  function packagePayload(record) { return record?.payload || record || {}; }
  async function boot() {
    try {
      setText('#pf-dashboard-title', `${config.brandName || 'Your brand'} merch backend dashboard`);
      const runtimeData = await request('/.netlify/functions/printful-runtime-status');
      state.runtime = runtimeData.runtime;
      state.storage = runtimeData.runtime?.storage || null;
      const listData = await request('/.netlify/functions/printful-state-list');
      state.data = listData.collections || state.data;
      state.storage = listData.storage || state.storage;

      const artifacts = state.data.incomingArtifacts || [];
      const locked = state.data.lockedOrders || [];
      const packages = state.data.clientPackages || [];
      const packagePayloads = packages.map(packagePayload);
      const totalRevenue = packagePayloads.reduce((sum, pkg) => sum + Number(pkg.quote?.totals?.total || 0), 0);
      const totalDeposits = packagePayloads.reduce((sum, pkg) => sum + Number(pkg.quote?.totals?.depositDue || 0), 0);
      const totalUnits = packagePayloads.reduce((sum, pkg) => sum + Number(pkg.quote?.quantity || 0), 0);
      const counts = statusCounts(packages);

      setText('#pf-dashboard-runtime', state.runtime?.printfulReady ? 'Live Printful ready' : 'Intake-first mode');
      setText('#pf-dashboard-storage', state.storage?.mode || 'unknown');
      setText('#pf-dashboard-artifacts-count', String(artifacts.length + locked.length));
      setText('#pf-dashboard-packages-count', String(packages.length));

      setHtml('#pf-dashboard-metrics', `
        <div class="pf-admin-summary-card"><strong>Total package revenue</strong><div>${currency(totalRevenue)}</div><div>${packages.length} package(s)</div></div>
        <div class="pf-admin-summary-card"><strong>Total deposits</strong><div>${currency(totalDeposits)}</div><div>Collected when approved</div></div>
        <div class="pf-admin-summary-card"><strong>Total quoted units</strong><div>${totalUnits}</div><div>Across all packages</div></div>
      `);

      const statusEntries = Object.entries(counts);
      setHtml('#pf-dashboard-status-grid', statusEntries.length ? statusEntries.map(([key, count]) => `
        <div class="pf-admin-summary-card"><strong>${key}</strong><div>${count} package(s)</div><div>${packages.length ? Math.round((count / packages.length) * 100) : 0}% of packages</div></div>
      `).join('') : '<p class="pf-help-text">No package statuses yet.</p>');

      setHtml('#pf-dashboard-recent-packages', packages.length ? packages.slice(0, 8).map((record) => {
        const pkg = packagePayload(record);
        return `
          <article class="pf-session-card">
            <h3>${pkg.customer?.name || 'Client package'}</h3>
            <p class="pf-session-meta">${new Date(record.updatedAt || pkg.updatedAt || pkg.createdAt || Date.now()).toLocaleString()} · ${pkg.packageId}</p>
            <p class="pf-help-text">${pkg.quote?.itemCount || 0} line item(s) · ${pkg.quote?.quantity || 0} units · ${currency(pkg.quote?.totals?.total || 0)} · ${pkg.tracker?.currentStatus || 'quoted'}</p>
            <div class="pf-session-actions"><a class="pf-btn" href="./status.html?id=${encodeURIComponent(pkg.packageId)}">Open tracker</a><a class="pf-btn" href="./approve.html?id=${encodeURIComponent(pkg.packageId)}">Open approval</a></div>
          </article>
        `;
      }).join('') : '<p class="pf-help-text">No client packages are saved yet.</p>');

      const activity = packagePayloads.flatMap((pkg) => (pkg.tracker?.history || []).map((entry) => ({ ...entry, packageId: pkg.packageId, customer: pkg.customer?.name || 'Client' })))
        .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
        .slice(0, 12);
      setHtml('#pf-dashboard-activity', activity.length ? activity.map((entry) => `
        <article class="pf-status-event">
          <div class="pf-status-event-dot"></div>
          <div class="pf-status-event-body">
            <strong>${entry.status || 'update'} · ${entry.customer}</strong>
            <div class="pf-session-meta">${entry.at ? new Date(entry.at).toLocaleString() : '—'} · ${entry.packageId || 'package'}</div>
            <div>${entry.note || ''}</div>
          </div>
        </article>
      `).join('') : '<p class="pf-help-text">No recent activity yet.</p>');

      setStatus('Ready');
    } catch (error) {
      setStatus(error.message);
    }
  }
  document.addEventListener('partials:ready', boot);
})();
