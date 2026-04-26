
(() => {
  const state = { pkg: null, timer: null };
  function qs(selector) { return document.querySelector(selector); }
  function setText(selector, text) { const node = qs(selector); if (node) node.textContent = text; }
  function params() { return new URLSearchParams(window.location.search); }
  function packageStoreKey() { return 'printful-pod-client-packages-v1'; }
  function currency(value) {
    const code = state.pkg?.brand?.currency || 'USD';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(Number(value || 0)); }
    catch { return `$${Number(value || 0).toFixed(2)}`; }
  }
  function getStore() { try { return JSON.parse(localStorage.getItem(packageStoreKey()) || '[]'); } catch { return []; } }
  function savePackage(pkg) {
    const store = getStore();
    const next = [pkg, ...store.filter((item) => item.packageId !== pkg.packageId)].slice(0, 50);
    localStorage.setItem(packageStoreKey(), JSON.stringify(next));
    localStorage.setItem('printful-pod-last-client-package-v1', JSON.stringify(pkg));
  }
  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Request failed');
    return data;
  }
  async function fetchPackageById(id) {
    const data = await request(`/.netlify/functions/printful-state-get?collection=clientPackages&id=${encodeURIComponent(id)}`);
    return data.record?.payload || null;
  }
  async function fetchLatestPackage() {
    const data = await request('/.netlify/functions/printful-state-list?collections=clientPackages');
    return data.collections?.clientPackages?.[0]?.payload || null;
  }
  function loadLocalLatest() {
    const id = params().get('id');
    const store = getStore();
    if (id) return store.find((item) => item.packageId === id) || null;
    try { const last = JSON.parse(localStorage.getItem('printful-pod-last-client-package-v1') || 'null'); if (last?.packageId) return last; } catch {}
    return store[0] || null;
  }
  function loadPackage(pkg) { state.pkg = pkg; savePackage(pkg); render(); }
  function renderHeader() {
    setText('#pf-status-package-id', state.pkg?.packageId || 'Waiting…');
    setText('#pf-status-current-status', state.pkg?.tracker?.currentStatus || 'Loading…');
    setText('#pf-status-tracking', state.pkg?.tracker?.trackingNumber || '—');
    setText('#pf-status-updated-at', state.pkg?.updatedAt ? new Date(state.pkg.updatedAt).toLocaleString() : (state.pkg?.tracker?.history?.slice(-1)[0]?.at ? new Date(state.pkg.tracker.history.slice(-1)[0].at).toLocaleString() : '—'));
  }
  function renderOverview() {
    const node = qs('#pf-status-overview'); if (!node) return;
    if (!state.pkg) { node.textContent = 'Load a package to track it.'; return; }
    node.innerHTML = `
      <div class="pf-admin-summary-grid">
        <div class="pf-admin-summary-card"><strong>Customer</strong><div>${state.pkg.customer?.name || '—'}</div><div>${state.pkg.customer?.company || ''}</div><div>${state.pkg.customer?.email || ''}</div></div>
        <div class="pf-admin-summary-card"><strong>Quote</strong><div>${state.pkg.quote?.itemCount || 0} line item(s)</div><div>${state.pkg.quote?.quantity || 0} total unit(s)</div><div>${state.pkg.quote?.turnaroundLabel || ''}</div></div>
        <div class="pf-admin-summary-card"><strong>Deposit</strong><div>${currency(state.pkg.quote?.totals?.depositDue || 0)}</div><div>Total ${currency(state.pkg.quote?.totals?.total || 0)}</div><div>${state.pkg.tracker?.currentStatus || ''}</div></div>
      </div>
    `;
  }
  function renderTimeline() {
    const node = qs('#pf-status-timeline'); if (!node) return;
    const history = state.pkg?.tracker?.history || [];
    if (!history.length) { node.innerHTML = '<p class="pf-help-text">No timeline data yet.</p>'; return; }
    node.innerHTML = history.slice().reverse().map((entry) => `
      <article class="pf-status-event">
        <div class="pf-status-event-dot"></div>
        <div class="pf-status-event-body">
          <strong>${entry.status || 'update'}</strong>
          <div class="pf-session-meta">${entry.at ? new Date(entry.at).toLocaleString() : '—'} · ${entry.actor || 'system'}</div>
          <div>${entry.note || ''}</div>
          ${entry.trackingNumber ? `<div>Tracking: ${entry.trackingNumber}</div>` : ''}
          ${entry.trackingUrl ? `<div><a class="pf-link" href="${entry.trackingUrl}" target="_blank" rel="noreferrer">Open tracking link</a></div>` : ''}
        </div>
      </article>
    `).join('');
  }
  function renderJson() { const node = qs('#pf-status-json'); if (node) node.textContent = JSON.stringify(state.pkg || {}, null, 2); }
  function render() { renderHeader(); renderOverview(); renderTimeline(); renderJson(); }
  function bindEvents() {
    qs('#pf-status-load-latest')?.addEventListener('click', async () => {
      const local = loadLocalLatest(); if (local) return loadPackage(local);
      try { const latest = await fetchLatestPackage(); if (latest) loadPackage(latest); } catch {}
    });
    qs('#pf-status-load-by-id')?.addEventListener('click', async () => {
      try {
        const id = (qs('#pf-status-package-id-input')?.value || '').trim() || params().get('id');
        if (!id) throw new Error('Enter a package id first.');
        const pkg = await fetchPackageById(id); if (!pkg) throw new Error('Package not found.'); loadPackage(pkg);
      } catch (error) { setText('#pf-status-package-id', error.message); }
    });
    qs('#pf-status-import-btn')?.addEventListener('click', () => { const raw = qs('#pf-status-import-json')?.value || ''; if (!raw.trim()) return; loadPackage(JSON.parse(raw)); });
    qs('#pf-status-file')?.addEventListener('change', (event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => loadPackage(JSON.parse(String(reader.result || '{}'))); reader.readAsText(file); });
    qs('#pf-status-download-package')?.addEventListener('click', () => { if (!state.pkg) return; const blob = new Blob([JSON.stringify(state.pkg, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${state.pkg.packageId}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); });
  }
  function startWatcher() {
    if (state.timer) window.clearInterval(state.timer);
    state.timer = window.setInterval(async () => {
      const id = state.pkg?.packageId; if (!id) return;
      try {
        const next = await fetchPackageById(id);
        if (next && JSON.stringify(next.tracker || {}) !== JSON.stringify(state.pkg.tracker || {})) { state.pkg = next; savePackage(next); render(); }
      } catch {
        const local = getStore().find((item) => item.packageId === id);
        if (local && JSON.stringify(local.tracker || {}) !== JSON.stringify(state.pkg.tracker || {})) { state.pkg = local; render(); }
      }
    }, 4000);
  }
  async function boot() {
    const id = params().get('id');
    if (id) {
      const pkg = await fetchPackageById(id).catch(() => null);
      if (pkg) loadPackage(pkg);
    }
    if (!state.pkg) {
      const local = loadLocalLatest();
      if (local) loadPackage(local);
    }
    render(); bindEvents(); startWatcher();
  }
  document.addEventListener('partials:ready', boot);
})();
