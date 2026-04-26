
(() => {
  const state = { pkg: null };
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
  async function postJson(url, payload) {
    return request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) });
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
    setText('#pf-approve-package-id', state.pkg?.packageId || 'Waiting…');
    setText('#pf-approve-current-status', state.pkg?.tracker?.currentStatus || 'Loading…');
    setText('#pf-approve-valid-until', state.pkg?.expiresAt ? new Date(state.pkg.expiresAt).toLocaleString() : '—');
    setText('#pf-approve-support', state.pkg?.brand?.supportEmail || '—');
  }
  function renderSummary() {
    const node = qs('#pf-approve-summary'); if (!node) return;
    if (!state.pkg) { node.textContent = 'Load a package to review it.'; return; }
    node.innerHTML = `
      <div class="pf-admin-summary-grid">
        <div class="pf-admin-summary-card"><strong>Client</strong><div>${state.pkg.customer?.name || '—'}</div><div>${state.pkg.customer?.company || ''}</div><div>${state.pkg.customer?.email || ''}</div></div>
        <div class="pf-admin-summary-card"><strong>Scope</strong><div>${state.pkg.quote?.itemCount || 0} line item(s)</div><div>${state.pkg.quote?.quantity || 0} total unit(s)</div><div>${state.pkg.quote?.turnaroundLabel || ''}</div></div>
        <div class="pf-admin-summary-card"><strong>Total</strong><div>${currency(state.pkg.quote?.totals?.total || 0)}</div><div>${state.pkg.brand?.depositLabel || 'Deposit due'} ${currency(state.pkg.quote?.totals?.depositDue || 0)}</div><div>${state.pkg.tracker?.currentStatus || ''}</div></div>
      </div>
      <div class="pf-admin-line-list">${(state.pkg.quote?.items || []).map((item) => `<article class="pf-admin-line-item"><strong>${item.title || 'Item'} ${item.variantLabel ? `· ${item.variantLabel}` : ''}</strong><span>${item.quantity || 0} unit(s) · ${item.printMethodLabel || ''}</span><span>${currency(item.lineTotal || 0)}</span></article>`).join('')}</div>
    `;
  }
  function renderInvoice() {
    const node = qs('#pf-approve-invoice'); if (!node) return;
    if (!state.pkg) { node.textContent = 'Invoice details will render here.'; return; }
    node.innerHTML = `
      <div class="pf-admin-summary-grid">
        <div class="pf-admin-summary-card"><strong>Invoice</strong><div>${state.pkg.invoice?.invoiceId || '—'}</div><div>Issued ${state.pkg.invoice?.issueDate ? new Date(state.pkg.invoice.issueDate).toLocaleDateString() : '—'}</div><div>Due ${state.pkg.invoice?.dueDate ? new Date(state.pkg.invoice.dueDate).toLocaleDateString() : '—'}</div></div>
        <div class="pf-admin-summary-card"><strong>Deposit request</strong><div>${currency(state.pkg.invoice?.depositDue || 0)}</div><div>Balance ${currency(state.pkg.invoice?.balanceDue || 0)}</div><div>Total ${currency(state.pkg.invoice?.total || 0)}</div></div>
        <div class="pf-admin-summary-card"><strong>Payment instructions</strong><div>${state.pkg.invoice?.paymentInstructions || ''}</div></div>
      </div>
    `;
  }
  function renderJson() { const node = qs('#pf-approve-json'); if (node) node.textContent = JSON.stringify(state.pkg || {}, null, 2); }
  function render() { renderHeader(); renderSummary(); renderInvoice(); renderJson(); }
  function download(name, text, type = 'application/json') {
    const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function invoiceHtml(pkg) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${pkg.invoice?.invoiceId || ''}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#101623}h1,h2{margin:0 0 12px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #d5dbe8;padding:10px;text-align:left}.box{padding:16px;border:1px solid #d5dbe8;border-radius:10px;margin-top:18px}</style></head><body><h1>${pkg.brand?.name || 'Your Company'}</h1><p>${pkg.brand?.supportEmail || ''}</p><h2>Invoice ${pkg.invoice?.invoiceId || ''}</h2><p>Issue date: ${new Date(pkg.invoice?.issueDate || pkg.createdAt).toLocaleString()}<br>Due date: ${new Date(pkg.invoice?.dueDate || pkg.expiresAt).toLocaleString()}</p><table><thead><tr><th>Item</th><th>Quantity</th><th>Method</th><th>Line total</th></tr></thead><tbody>${(pkg.quote?.items || []).map((item) => `<tr><td>${item.title} ${item.variantLabel ? `· ${item.variantLabel}` : ''}</td><td>${item.quantity || 0}</td><td>${item.printMethodLabel || ''}</td><td>${currency(item.lineTotal || 0)}</td></tr>`).join('')}</tbody></table><div class="box"><strong>Total:</strong> ${currency(pkg.quote?.totals?.total || 0)}<br><strong>${pkg.brand?.depositLabel || 'Deposit due'}:</strong> ${currency(pkg.invoice?.depositDue || 0)}<br><strong>Balance due:</strong> ${currency(pkg.invoice?.balanceDue || 0)}</div><div class="box"><strong>Payment instructions:</strong><br>${pkg.invoice?.paymentInstructions || ''}</div></body></html>`;
  }
  async function postApprovalForm(pkg, approvalNote, approverName, approverEmail) {
    const body = new URLSearchParams();
    body.set('form-name', 'merch-approval'); body.set('package_id', pkg.packageId || ''); body.set('locked_order_id', pkg.lockedOrderId || ''); body.set('approver_name', approverName || ''); body.set('approver_email', approverEmail || ''); body.set('status', pkg.tracker?.currentStatus || 'approved'); body.set('approval_note', approvalNote || ''); body.set('approval_payload', JSON.stringify(pkg));
    try { await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }); } catch {}
  }
  async function approveCurrentPackage() {
    if (!state.pkg) throw new Error('Load a package first.');
    if (!qs('#pf-approve-checkbox')?.checked) throw new Error('Check the approval box first.');
    const approverName = qs('#pf-approve-name')?.value?.trim() || '';
    const approverEmail = qs('#pf-approve-email')?.value?.trim() || '';
    const approvalNote = qs('#pf-approve-note')?.value?.trim() || '';
    if (!approverName) throw new Error('Enter your full name first.');
    const data = await postJson('/.netlify/functions/printful-admin-update-status', { clientPackage: state.pkg, status: 'approved', actor: 'client', note: approvalNote || 'Client approved quote.', approvedBy: approverName, approvedEmail: approverEmail });
    state.pkg = data.clientPackage; savePackage(state.pkg); await postApprovalForm(state.pkg, approvalNote, approverName, approverEmail); render(); setText('#pf-approve-response', `Approved. Package ${state.pkg.packageId} was updated and saved.`);
  }
  function bindEvents() {
    qs('#pf-approve-load-latest')?.addEventListener('click', async () => {
      const local = loadLocalLatest(); if (local) return loadPackage(local);
      try { const latest = await fetchLatestPackage(); if (latest) loadPackage(latest); } catch (error) { setText('#pf-approve-response', error.message); }
    });
    qs('#pf-approve-load-by-id')?.addEventListener('click', async () => {
      try {
        const id = (qs('#pf-approve-package-id-input')?.value || '').trim() || params().get('id');
        if (!id) throw new Error('Enter a package id first.');
        const pkg = await fetchPackageById(id); if (!pkg) throw new Error('Package not found.'); loadPackage(pkg);
      } catch (error) { setText('#pf-approve-response', error.message); }
    });
    qs('#pf-approve-import-btn')?.addEventListener('click', () => { const raw = qs('#pf-approve-import-json')?.value || ''; if (!raw.trim()) return; loadPackage(JSON.parse(raw)); });
    qs('#pf-approve-file')?.addEventListener('change', (event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => loadPackage(JSON.parse(String(reader.result || '{}'))); reader.readAsText(file); });
    qs('#pf-approve-download-package')?.addEventListener('click', () => { if (!state.pkg) return; download(`${state.pkg.packageId}.json`, JSON.stringify(state.pkg, null, 2)); });
    qs('#pf-approve-download-invoice')?.addEventListener('click', () => { if (!state.pkg) return; download(`${state.pkg.invoice?.invoiceId || state.pkg.packageId}.html`, invoiceHtml(state.pkg), 'text/html'); });
    qs('#pf-approve-submit')?.addEventListener('click', () => { approveCurrentPackage().catch((error) => setText('#pf-approve-response', error.message)); });
    qs('#pf-approve-open-status')?.addEventListener('click', () => { if (!state.pkg) return; window.location.href = `./status.html?id=${encodeURIComponent(state.pkg.packageId)}`; });
  }
  async function boot() {
    try {
      const id = params().get('id');
      if (id) {
        const pkg = await fetchPackageById(id).catch(() => null);
        if (pkg) loadPackage(pkg);
      }
      if (!state.pkg) {
        const local = loadLocalLatest();
        if (local) loadPackage(local);
      }
      render(); bindEvents();
    } catch (error) { setText('#pf-approve-response', error.message); }
  }
  document.addEventListener('partials:ready', boot);
})();
