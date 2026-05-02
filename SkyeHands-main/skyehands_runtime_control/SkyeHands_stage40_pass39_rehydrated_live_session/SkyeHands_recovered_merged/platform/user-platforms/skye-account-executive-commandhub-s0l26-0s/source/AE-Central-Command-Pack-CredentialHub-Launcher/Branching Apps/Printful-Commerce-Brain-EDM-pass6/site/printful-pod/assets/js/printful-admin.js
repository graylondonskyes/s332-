
(() => {
  const config = window.PRINTFUL_EMBED_CONFIG || {};
  const state = {
    runtime: null,
    storage: null,
    inbox: [],
    locked: [],
    packages: [],
    selectedArtifact: null,
    selectedLocked: null,
    selectedPackage: null,
    aeBridge: { leads: [], orders: [], sync: [], catalog: [], metrics: [], alerts: [], contractPackets: [], artPackets: [], profitability: [], replayQueue: [], presence: [], hardening: [], returns: [], incidents: [], exportedAt: '' },
  };

  function qs(selector) { return document.querySelector(selector); }
  function qsa(selector) { return Array.from(document.querySelectorAll(selector)); }
  function setText(selector, text) { const node = qs(selector); if (node) node.textContent = text; }
  function setHtml(selector, html) { const node = qs(selector); if (node) node.innerHTML = html; }
  function setStatus(text) { setText('#pf-admin-status', text); }
  function inboxKey() { return 'printful-pod-admin-inbox-v1'; }
  function lockedKey() { return 'printful-pod-admin-locked-v1'; }
  function builderPacketKey() { return 'printful-pod-admin-last-artifact-v1'; }
  function packageKey() { return 'printful-pod-client-packages-v1'; }
  function lastPackageKey() { return 'printful-pod-last-client-package-v1'; }

  function currency(value) {
    const code = state.selectedPackage?.brand?.currency || state.runtime?.catalog?.brand?.currency || 'USD';
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(Number(value || 0)); }
    catch { return `$${Number(value || 0).toFixed(2)}`; }
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

  function artifactId(artifact) {
    return artifact?.lockedOrderId || artifact?.bundleId || artifact?.packetId || `artifact-${Date.now()}`;
  }

  function summarizeArtifact(artifact) {
    if (artifact?.items && artifact?.totals) return `${artifact.itemCount || artifact.items.length} line item(s) · ${artifact.totals?.quantity || artifact.totalQuantity || 0} units · ${currency(artifact.totals?.total || 0)}`;
    if (artifact?.product && artifact?.pricing) return `${artifact.product.title || 'Product'} · ${artifact.product.variantLabel || ''} · ${artifact.pricing.quantity || 0} units · ${currency(artifact.pricing.total || 0)}`;
    return 'Artifact ready';
  }

  function getFilterTerm() { return (qs('#pf-admin-search')?.value || '').trim().toLowerCase(); }
  function getFilterType() { return qs('#pf-admin-filter-type')?.value || 'all'; }

  function loadStorage() {
    try { state.inbox = JSON.parse(localStorage.getItem(inboxKey()) || '[]'); } catch { state.inbox = []; }
    try { state.locked = JSON.parse(localStorage.getItem(lockedKey()) || '[]'); } catch { state.locked = []; }
    try { state.packages = JSON.parse(localStorage.getItem(packageKey()) || '[]'); } catch { state.packages = []; }
  }

  function saveInbox() {
    localStorage.setItem(inboxKey(), JSON.stringify(state.inbox.slice(0, 100)));
    setText('#pf-admin-queue-count', `${state.inbox.length} artifact(s)`);
  }
  function saveLocked() {
    localStorage.setItem(lockedKey(), JSON.stringify(state.locked.slice(0, 100)));
    setText('#pf-admin-locked-count', `${state.locked.length} approval(s)`);
  }
  function savePackages() {
    localStorage.setItem(packageKey(), JSON.stringify(state.packages.slice(0, 100)));
    setText('#pf-admin-package-count', `${state.packages.length} client package(s)`);
    if (state.selectedPackage) localStorage.setItem(lastPackageKey(), JSON.stringify(state.selectedPackage));
  }

  function mergeRecord(list, record, keyField = 'id') {
    const key = record?.[keyField];
    if (!key) return list;
    return [record, ...list.filter((item) => item[keyField] !== key)];
  }

  function localIncomingRecord(artifact, source = 'manual-import') {
    return {
      id: artifactId(artifact),
      type: artifact.lockedOrderId ? 'locked' : (artifact.items ? 'bundle' : 'packet'),
      source,
      createdAt: artifact.createdAt || new Date().toISOString(),
      updatedAt: artifact.updatedAt || artifact.createdAt || new Date().toISOString(),
      artifact,
    };
  }

  async function persistBackend(collection, id, payload, meta = {}) {
    const data = await postJson('/.netlify/functions/printful-state-save', { collection, id, payload, meta });
    state.storage = data.storage || state.storage;
    updateStorageLabel();
    return data.record;
  }
  async function deleteBackend(collection, id) {
    const data = await postJson('/.netlify/functions/printful-state-delete', { collection, id });
    state.storage = data.storage || state.storage;
    updateStorageLabel();
  }

  function updateStorageLabel() {
    setText('#pf-admin-storage', state.storage?.mode || 'unknown');
  }

  async function syncBackend() {
    const data = await request('/.netlify/functions/printful-state-list');
    state.storage = data.storage || state.storage;
    updateStorageLabel();
    const collections = data.collections || {};
    const incoming = (collections.incomingArtifacts || []).map((record) => ({
      id: record.id,
      type: record.meta?.type || (record.payload?.items ? 'bundle' : 'packet'),
      source: record.meta?.source || 'backend-vault',
      createdAt: record.createdAt || record.payload?.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt || record.payload?.updatedAt || record.payload?.createdAt || new Date().toISOString(),
      artifact: record.payload,
    }));
    const locked = (collections.lockedOrders || []).map((record) => ({
      id: record.id,
      type: 'locked',
      source: record.meta?.source || 'backend-vault',
      createdAt: record.createdAt || record.payload?.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt || record.payload?.updatedAt || record.payload?.createdAt || new Date().toISOString(),
      artifact: record.payload,
    }));
    const packages = (collections.clientPackages || []).map((record) => record.payload);

    incoming.forEach((record) => { state.inbox = mergeRecord(state.inbox, record); });
    locked.forEach((record) => { state.locked = mergeRecord(state.locked, record); });
    packages.forEach((pkg) => { state.packages = mergeRecord(state.packages, pkg, 'packageId'); });

    saveInbox(); saveLocked(); savePackages();
    renderInbox(); renderLockedList(); renderPackages(); renderPackageSummary(); renderHistory();
  }

  async function pushInboxArtifact(artifact, source = 'manual-import', persist = true) {
    if (!artifact) return;
    const record = localIncomingRecord(artifact, source);
    if (record.type === 'locked') {
      state.locked = mergeRecord(state.locked, record);
      state.selectedLocked = record;
      saveLocked();
      renderLockedList();
    } else {
      state.inbox = mergeRecord(state.inbox, record);
      state.selectedArtifact = record;
      saveInbox();
      renderInbox();
    }
    if (persist) {
      try {
        await persistBackend('incomingArtifacts', record.id, record.artifact, { type: record.type, source: record.source });
      } catch (error) {
        setStatus(`Saved locally. Backend vault unavailable: ${error.message}`);
      }
    }
  }

  async function pushLocked(lockedOrder) {
    const record = localIncomingRecord(lockedOrder, 'admin-lock');
    record.type = 'locked';
    state.locked = mergeRecord(state.locked, record);
    state.selectedLocked = record;
    saveLocked();
    renderLockedList();
    renderJson(lockedOrder);
  }

  async function pushPackage(pkg) {
    if (!pkg?.packageId) return;
    state.packages = mergeRecord(state.packages, pkg, 'packageId');
    state.selectedPackage = pkg;
    savePackages();
    renderPackages();
    renderPackageSummary();
    renderHistory();
    renderJson(pkg);
  }

  function matchesFilter(record) {
    const type = getFilterType();
    if (type !== 'all' && record.type !== type) return false;
    const term = getFilterTerm();
    if (!term) return true;
    const customer = record.artifact?.customer || {};
    const productTitle = record.artifact?.product?.title || record.artifact?.items?.map((item) => item.product?.title || item.productTitle || '').join(' ');
    const haystack = [record.id, customer.name, customer.company, customer.email, productTitle, record.source].join(' ').toLowerCase();
    return haystack.includes(term);
  }

  function renderInbox() {
    const root = qs('#pf-admin-queue');
    if (!root) return;
    const rows = state.inbox.filter(matchesFilter);
    if (!rows.length) {
      root.innerHTML = '<p class="pf-help-text">No artifacts yet. Build a packet or bundle in the merch builder, import one here, or sync the backend vault.</p>';
      return;
    }
    root.innerHTML = rows.map((record) => `
      <article class="pf-session-card ${state.selectedArtifact?.id === record.id ? 'is-active' : ''}">
        <h3>${record.type === 'bundle' ? 'Cart bundle' : 'Order packet'}</h3>
        <p class="pf-session-meta">${new Date(record.updatedAt || record.createdAt).toLocaleString()} · ${record.source}</p>
        <p class="pf-help-text">${summarizeArtifact(record.artifact)}</p>
        <div class="pf-session-actions">
          <button type="button" class="pf-btn" data-open-artifact="${record.id}">Review</button>
          <button type="button" class="pf-btn" data-download-artifact="${record.id}">Download</button>
          <button type="button" class="pf-btn" data-delete-artifact="${record.id}">Remove</button>
        </div>
      </article>
    `).join('');
    qsa('[data-open-artifact]').forEach((node) => node.addEventListener('click', () => {
      const record = state.inbox.find((item) => item.id === node.getAttribute('data-open-artifact'));
      if (!record) return;
      state.selectedArtifact = record;
      renderSelection(); renderInbox(); renderJson(record.artifact); setStatus('Artifact loaded for review');
    }));
    qsa('[data-download-artifact]').forEach((node) => node.addEventListener('click', () => {
      const record = state.inbox.find((item) => item.id === node.getAttribute('data-download-artifact'));
      if (!record) return;
      downloadJson(record.artifact, `${record.id}.json`);
    }));
    qsa('[data-delete-artifact]').forEach((node) => node.addEventListener('click', async () => {
      const id = node.getAttribute('data-delete-artifact');
      state.inbox = state.inbox.filter((item) => item.id !== id);
      saveInbox(); renderInbox();
      try { await deleteBackend('incomingArtifacts', id); } catch {}
      setStatus('Artifact removed');
    }));
  }

  function renderLockedList() {
    const root = qs('#pf-admin-locked-list');
    if (!root) return;
    const rows = state.locked.filter(matchesFilter);
    if (!rows.length) {
      root.innerHTML = '<p class="pf-help-text">No locked approvals yet.</p>';
      return;
    }
    root.innerHTML = rows.map((record) => `
      <article class="pf-session-card ${state.selectedLocked?.id === record.id ? 'is-active' : ''}">
        <h3>Locked approval</h3>
        <p class="pf-session-meta">${new Date(record.updatedAt || record.createdAt).toLocaleString()}</p>
        <p class="pf-help-text">${summarizeArtifact(record.artifact)}</p>
        <div class="pf-session-actions">
          <button type="button" class="pf-btn" data-open-locked="${record.id}">Open</button>
          <button type="button" class="pf-btn" data-download-locked-item="${record.id}">Download</button>
          <button type="button" class="pf-btn" data-delete-locked="${record.id}">Remove</button>
        </div>
      </article>
    `).join('');
    qsa('[data-open-locked]').forEach((node) => node.addEventListener('click', () => {
      const record = state.locked.find((item) => item.id === node.getAttribute('data-open-locked'));
      if (!record) return;
      state.selectedLocked = record;
      renderLockedList(); renderJson(record.artifact); renderPackageSummary(); renderHistory(); setStatus('Locked approval loaded');
    }));
    qsa('[data-download-locked-item]').forEach((node) => node.addEventListener('click', () => {
      const record = state.locked.find((item) => item.id === node.getAttribute('data-download-locked-item'));
      if (!record) return;
      downloadJson(record.artifact, `${record.id}.json`);
    }));
    qsa('[data-delete-locked]').forEach((node) => node.addEventListener('click', async () => {
      const id = node.getAttribute('data-delete-locked');
      state.locked = state.locked.filter((item) => item.id !== id);
      saveLocked(); renderLockedList();
      try { await deleteBackend('lockedOrders', id); } catch {}
      setStatus('Locked approval removed');
    }));
  }

  function renderSelection() {
    const node = qs('#pf-admin-selection');
    if (!node) return;
    const artifact = state.selectedArtifact?.artifact;
    if (!artifact) { node.innerHTML = 'Select a packet or bundle to review.'; return; }
    const customer = artifact.customer || {};
    const totals = artifact.totals || artifact.pricing || {};
    const items = artifact.items || [artifact];
    node.innerHTML = `
      <div class="pf-admin-summary-grid">
        <div class="pf-admin-summary-card"><strong>Customer</strong><div>${customer.name || 'No name yet'}</div><div>${customer.company || ''}</div><div>${customer.email || ''}</div></div>
        <div class="pf-admin-summary-card"><strong>Scope</strong><div>${items.length} line item(s)</div><div>${artifact.totalQuantity || totals.quantity || artifact.pricing?.quantity || 0} total unit(s)</div><div>${artifact.logistics?.turnaroundLabel || ''}</div></div>
        <div class="pf-admin-summary-card"><strong>Retail</strong><div>Total ${currency(totals.total || 0)}</div><div>Deposit ${currency(totals.depositDue || 0)}</div><div>${artifact.orderMode || 'intake'} mode</div></div>
      </div>
      <div class="pf-admin-line-list">${items.map((item) => {
        const product = item.product || {};
        const pricing = item.pricing || artifact.pricing || {};
        return `<article class="pf-admin-line-item"><strong>${product.title || 'Product'} · ${product.variantLabel || ''}</strong><span>${pricing.quantity || 0} units · ${product.printMethodLabel || product.printMethod || ''}</span><span>${currency(pricing.total || 0)}</span></article>`;
      }).join('')}</div>
    `;
  }

  function renderPackageSummary() {
    const node = qs('#pf-admin-package-summary');
    if (!node) return;
    const pkg = state.selectedPackage;
    if (!pkg) {
      node.innerHTML = state.selectedLocked?.artifact ? 'Build a client package from the open locked order.' : 'Open a locked order, then build a client package.';
      return;
    }
    node.innerHTML = `
      <div class="pf-admin-summary-grid">
        <div class="pf-admin-summary-card"><strong>Package</strong><div>${pkg.packageId}</div><div>${new Date(pkg.createdAt).toLocaleString()}</div><div>${pkg.brand?.supportEmail || ''}</div></div>
        <div class="pf-admin-summary-card"><strong>Approval lane</strong><div>${pkg.quote?.itemCount || 0} line item(s)</div><div>Total ${currency(pkg.quote?.totals?.total || 0)}</div><div>${pkg.tracker?.currentStatus || ''}</div></div>
        <div class="pf-admin-summary-card"><strong>Invoice</strong><div>${pkg.invoice?.invoiceId || '—'}</div><div>${pkg.brand?.depositLabel || 'Deposit due'} ${currency(pkg.invoice?.depositDue || 0)}</div><div>Due ${pkg.invoice?.dueDate ? new Date(pkg.invoice.dueDate).toLocaleString() : '—'}</div></div>
      </div>
    `;
  }

  function renderPackages() {
    const root = qs('#pf-admin-packages');
    if (!root) return;
    if (!state.packages.length) {
      root.innerHTML = '<p class="pf-help-text">No client packages built yet.</p>';
      return;
    }
    root.innerHTML = state.packages.map((pkg) => `
      <article class="pf-session-card ${state.selectedPackage?.packageId === pkg.packageId ? 'is-active' : ''}">
        <h3>Client package</h3>
        <p class="pf-session-meta">${new Date(pkg.updatedAt || pkg.createdAt).toLocaleString()} · ${pkg.packageId}</p>
        <p class="pf-help-text">${pkg.customer?.name || 'Client'} · ${pkg.quote?.itemCount || 0} line item(s) · ${currency(pkg.quote?.totals?.total || 0)} · ${pkg.tracker?.currentStatus || 'quoted'}</p>
        <div class="pf-session-actions">
          <button type="button" class="pf-btn" data-open-package="${pkg.packageId}">Open</button>
          <button type="button" class="pf-btn" data-download-package="${pkg.packageId}">Download</button>
          <button type="button" class="pf-btn" data-delete-package="${pkg.packageId}">Remove</button>
        </div>
      </article>
    `).join('');
    qsa('[data-open-package]').forEach((node) => node.addEventListener('click', () => {
      const pkg = state.packages.find((item) => item.packageId === node.getAttribute('data-open-package'));
      if (!pkg) return;
      state.selectedPackage = pkg; savePackages(); renderPackages(); renderPackageSummary(); renderHistory(); renderJson(pkg); setStatus('Client package opened');
    }));
    qsa('[data-download-package]').forEach((node) => node.addEventListener('click', () => {
      const pkg = state.packages.find((item) => item.packageId === node.getAttribute('data-download-package')); if (!pkg) return; downloadJson(pkg, `${pkg.packageId}.json`);
    }));
    qsa('[data-delete-package]').forEach((node) => node.addEventListener('click', async () => {
      const id = node.getAttribute('data-delete-package');
      state.packages = state.packages.filter((item) => item.packageId !== id);
      if (state.selectedPackage?.packageId === id) state.selectedPackage = state.packages[0] || null;
      savePackages(); renderPackages(); renderPackageSummary(); renderHistory();
      try { await deleteBackend('clientPackages', id); } catch {}
      setStatus('Client package removed');
    }));
  }

  function renderHistory() {
    const root = qs('#pf-admin-history');
    if (!root) return;
    const pkg = state.selectedPackage;
    if (!pkg?.tracker?.history?.length) { root.innerHTML = '<p class="pf-help-text">No status history yet.</p>'; return; }
    root.innerHTML = pkg.tracker.history.slice().reverse().map((entry) => `
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

  function renderJson(payload) {
    const node = qs('#pf-admin-json'); if (node) node.textContent = JSON.stringify(payload || {}, null, 2);
  }

  function getOverrides() {
    return {
      status: qs('#pf-admin-order-status')?.value || 'quoted',
      discountAmount: Number(qs('#pf-admin-discount')?.value || 0),
      shippingFeeOverride: qs('#pf-admin-shipping')?.value,
      taxOverride: qs('#pf-admin-tax')?.value,
      depositPercentOverride: qs('#pf-admin-deposit')?.value,
      expiresAt: qs('#pf-admin-expires')?.value || '',
      operatorName: qs('#pf-admin-operator')?.value || '',
      internalReference: qs('#pf-admin-reference')?.value || '',
      approvalNotes: qs('#pf-admin-notes')?.value || '',
    };
  }

  function downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }

  function invoiceHtml(pkg) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${pkg.invoice?.invoiceId || ''}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#101623}h1,h2{margin:0 0 12px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #d5dbe8;padding:10px;text-align:left}.box{padding:16px;border:1px solid #d5dbe8;border-radius:10px;margin-top:18px}</style></head><body><h1>${pkg.brand?.name || 'Your Company'}</h1><p>${pkg.brand?.supportEmail || ''}</p><h2>Invoice ${pkg.invoice?.invoiceId || ''}</h2><p>Issue date: ${new Date(pkg.invoice?.issueDate || pkg.createdAt).toLocaleString()}<br>Due date: ${new Date(pkg.invoice?.dueDate || pkg.expiresAt).toLocaleString()}</p><table><thead><tr><th>Item</th><th>Quantity</th><th>Method</th><th>Line total</th></tr></thead><tbody>${(pkg.quote?.items || []).map((item) => `<tr><td>${item.title} ${item.variantLabel ? `· ${item.variantLabel}` : ''}</td><td>${item.quantity || 0}</td><td>${item.printMethodLabel || ''}</td><td>${currency(item.lineTotal || 0)}</td></tr>`).join('')}</tbody></table><div class="box"><strong>Total:</strong> ${currency(pkg.quote?.totals?.total || 0)}<br><strong>${pkg.brand?.depositLabel || 'Deposit due'}:</strong> ${currency(pkg.invoice?.depositDue || 0)}<br><strong>Balance due:</strong> ${currency(pkg.invoice?.balanceDue || 0)}</div><div class="box"><strong>Payment instructions:</strong><br>${pkg.invoice?.paymentInstructions || ''}</div></body></html>`;
  }
  function downloadInvoice(pkg) {
    const blob = new Blob([invoiceHtml(pkg)], { type: 'text/html' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${pkg.invoice?.invoiceId || pkg.packageId}.html`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }

  async function bootRuntime() {
    const data = await request('/.netlify/functions/printful-runtime-status');
    state.runtime = data.runtime; state.storage = data.runtime?.storage || state.storage;
    setText('#pf-admin-runtime', data.runtime?.printfulReady ? 'Live Printful ready' : 'Intake-first mode');
    updateStorageLabel();
  }

  async function lockSelectedArtifact() {
    if (!state.selectedArtifact?.artifact) throw new Error('Select an artifact first.');
    const data = await postJson('/.netlify/functions/printful-admin-lock-order', { source: state.selectedArtifact.artifact, status: qs('#pf-admin-order-status')?.value || 'quoted', overrides: getOverrides() });
    await pushLocked(data.lockedOrder); setStatus('Pricing locked'); return data.lockedOrder;
  }

  async function buildClientPackage() {
    const locked = state.selectedLocked?.artifact; if (!locked) throw new Error('Open a locked order first.');
    const data = await postJson('/.netlify/functions/printful-admin-build-client-package', { lockedOrder: locked });
    await pushPackage(data.clientPackage); setStatus('Client package built'); return data.clientPackage;
  }

  async function updateClientStatus() {
    const pkg = state.selectedPackage; if (!pkg) throw new Error('Open a client package first.');
    const data = await postJson('/.netlify/functions/printful-admin-update-status', { clientPackage: pkg, status: qs('#pf-admin-package-status')?.value || 'quoted', note: qs('#pf-admin-status-note')?.value || 'Status updated.', actor: qs('#pf-admin-operator')?.value || 'operator', trackingNumber: qs('#pf-admin-tracking-number')?.value || '', trackingUrl: qs('#pf-admin-tracking-url')?.value || '' });
    await pushPackage(data.clientPackage); setStatus('Tracker updated');
  }

  function copyLockedSummary() {
    const artifact = state.selectedLocked?.artifact; if (!artifact) throw new Error('Lock an order first.');
    const lines = [
      `Approval ${artifact.lockedOrderId}`,
      `${artifact.itemCount || artifact.items?.length || 0} line item(s)`,
      `Locked total ${currency(artifact.totals?.total || 0)}`,
      `Deposit due ${currency(artifact.totals?.depositDue || 0)}`,
      artifact.turnaround?.label ? `Turnaround ${artifact.turnaround.label}` : '',
      artifact.expiresAt ? `Valid until ${artifact.expiresAt}` : '',
    ].filter(Boolean).join(' · ');
    return navigator.clipboard.writeText(lines).then(() => setStatus('Client summary copied'));
  }

  function copyApprovalLink() {
    const pkg = state.selectedPackage; if (!pkg) throw new Error('Open a client package first.');
    const href = new URL(`./approve.html?id=${encodeURIComponent(pkg.packageId)}`, window.location.href).toString();
    return navigator.clipboard.writeText(href).then(() => setStatus('Approval link copied'));
  }

  async function promoteLockedOrder() {
    const artifact = state.selectedLocked?.artifact; if (!artifact) throw new Error('Open a locked order first.');
    const data = await postJson('/.netlify/functions/printful-admin-promote-order', { lockedOrder: artifact, confirm: true });
    renderJson(data.result || data); setStatus(`Promoted to live order ${data.result?.id || 'created'}`);
  }

  async function importLatestBuilderArtifact() {
    const raw = localStorage.getItem(builderPacketKey()); if (!raw) throw new Error('No builder artifact found in local storage yet.');
    const parsed = JSON.parse(raw); await pushInboxArtifact(parsed.artifact || parsed, 'builder-handoff'); setStatus('Latest builder artifact loaded');
  }

  async function importFromTextarea() {
    const raw = qs('#pf-admin-import-json')?.value || ''; if (!raw.trim()) throw new Error('Paste JSON first.');
    const parsed = JSON.parse(raw); await pushInboxArtifact(parsed.lockedOrder || parsed.bundle || parsed.packet || parsed, 'textarea-import'); setStatus('JSON imported');
  }

  function handleFileImport(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        await pushInboxArtifact(parsed.lockedOrder || parsed.bundle || parsed.packet || parsed, 'file-import');
        setStatus('File imported');
      } catch (error) { setStatus(error.message); }
    };
    reader.readAsText(file);
  }

  async function refreshBoard() {
    loadStorage(); renderInbox(); renderLockedList(); renderPackages(); renderPackageSummary(); renderHistory();
    try { await syncBackend(); setStatus('Board refreshed'); } catch (error) { setStatus(`Local refresh complete. Backend sync failed: ${error.message}`); }
  }

  function wireEvents() {
    qs('#pf-admin-refresh')?.addEventListener('click', () => { refreshBoard().catch((error) => setStatus(error.message)); });
    qs('#pf-admin-sync-backend')?.addEventListener('click', () => { syncBackend().then(() => setStatus('Backend vault synced')).catch((error) => setStatus(error.message)); });
    qs('#pf-admin-search')?.addEventListener('input', () => { renderInbox(); renderLockedList(); });
    qs('#pf-admin-filter-type')?.addEventListener('change', () => { renderInbox(); renderLockedList(); });
    qs('#pf-admin-load-builder')?.addEventListener('click', () => { importLatestBuilderArtifact().catch((error) => setStatus(error.message)); });
    qs('#pf-admin-import-btn')?.addEventListener('click', () => { importFromTextarea().catch((error) => setStatus(error.message)); });
    qs('#pf-admin-file')?.addEventListener('change', (event) => handleFileImport(event.target.files?.[0]));
    qs('#pf-admin-export-queue')?.addEventListener('click', () => { downloadJson({ inbox: state.inbox, locked: state.locked, packages: state.packages }, 'merch-admin-board-export.json'); setStatus('Board export downloaded'); });
    qs('#pf-admin-clear-queue')?.addEventListener('click', () => { state.inbox = []; saveInbox(); renderInbox(); setStatus('Inbox cleared'); });
    qs('#pf-admin-lock-btn')?.addEventListener('click', () => { lockSelectedArtifact().catch((error) => setStatus(error.message)); });
    qs('#pf-admin-download-locked')?.addEventListener('click', () => { try { const artifact = state.selectedLocked?.artifact; if (!artifact) throw new Error('Lock an order first.'); downloadJson(artifact, `${artifact.lockedOrderId}.json`); } catch (error) { setStatus(error.message); } });
    qs('#pf-admin-copy-summary')?.addEventListener('click', () => { copyLockedSummary().catch((error) => setStatus(error.message)); });
    qs('#pf-admin-promote')?.addEventListener('click', () => { promoteLockedOrder().catch((error) => setStatus(error.message)); });
    qs('#pf-admin-build-package')?.addEventListener('click', () => { buildClientPackage().catch((error) => setStatus(error.message)); });
    qs('#pf-admin-download-package')?.addEventListener('click', () => { try { const pkg = state.selectedPackage; if (!pkg) throw new Error('Open a client package first.'); downloadJson(pkg, `${pkg.packageId}.json`); } catch (error) { setStatus(error.message); } });
    qs('#pf-admin-download-invoice')?.addEventListener('click', () => { try { const pkg = state.selectedPackage; if (!pkg) throw new Error('Open a client package first.'); downloadInvoice(pkg); setStatus('Invoice HTML downloaded'); } catch (error) { setStatus(error.message); } });
    qs('#pf-admin-copy-approval-link')?.addEventListener('click', () => { copyApprovalLink().catch((error) => setStatus(error.message)); });
    qs('#pf-admin-open-approval')?.addEventListener('click', () => { if (!state.selectedPackage) return setStatus('Open a client package first.'); window.location.href = `./approve.html?id=${encodeURIComponent(state.selectedPackage.packageId)}`; });
    qs('#pf-admin-open-status')?.addEventListener('click', () => { if (!state.selectedPackage) return setStatus('Open a client package first.'); window.location.href = `./status.html?id=${encodeURIComponent(state.selectedPackage.packageId)}`; });
    qs('#pf-admin-update-status-btn')?.addEventListener('click', () => { updateClientStatus().catch((error) => setStatus(error.message)); });
  }

  async function boot() {
    try {
      setText('#pf-admin-title', `${config.brandName || 'Your brand'} merch admin board`);
      await bootRuntime();
      loadStorage();
      saveInbox(); saveLocked(); savePackages();
      renderInbox(); renderLockedList(); renderSelection(); renderPackages(); renderPackageSummary(); renderHistory();
      wireEvents();
      await syncBackend().catch(() => {});
      setStatus('Ready');
    } catch (error) { setStatus(error.message); }
  }

  document.addEventListener('partials:ready', boot);


  async function refreshAeBridge() {
    try {
      const data = await request('/.netlify/functions/printful-ae-bridge-export');
      state.aeBridge = {
        leads: Array.isArray(data.leads) ? data.leads : [],
        orders: Array.isArray(data.orders) ? data.orders : [],
        sync: Array.isArray(data.sync) ? data.sync : [],
        catalog: Array.isArray(data.catalog) ? data.catalog : [],
        metrics: Array.isArray(data.metrics) ? data.metrics : [],
        alerts: Array.isArray(data.alerts) ? data.alerts : [],
        contractPackets: Array.isArray(data.contractPackets) ? data.contractPackets : [],
        artPackets: Array.isArray(data.artPackets) ? data.artPackets : [],
        profitability: Array.isArray(data.profitability) ? data.profitability : [],
        replayQueue: Array.isArray(data.replayQueue) ? data.replayQueue : [],
        presence: Array.isArray(data.presence) ? data.presence : state.aeBridge.presence,
        hardening: Array.isArray(data.hardening) ? data.hardening : state.aeBridge.hardening,
        returns: Array.isArray(data.returns) ? data.returns : state.aeBridge.returns,
        incidents: Array.isArray(data.incidents) ? data.incidents : state.aeBridge.incidents,
        exportedAt: data.exportedAt || new Date().toISOString(),
      };
      renderAeBridge();
      renderAeBridgeContractDeck();
      renderAeBridgeArtDeck();
      renderAeBridgeProfitabilityDeck();
      setStatus('AE bridge refreshed');
    } catch (error) {
      setStatus(`AE bridge unavailable: ${error.message}`);
    }
  }

  function renderAeBridge() {
    const summary = qs('#pf-admin-ae-bridge-summary');
    const list = qs('#pf-admin-ae-bridge-list');
    if (summary) {
      summary.textContent = `${state.aeBridge.leads.length} lead(s) · ${state.aeBridge.orders.length} order(s) · ${state.aeBridge.sync.length} sync packet(s) · ${state.aeBridge.contractPackets.length} contract packet(s) · ${(state.aeBridge.presence || []).length} presence row(s) · ${(state.aeBridge.returns || []).length} return row(s)`;
    }
    if (!list) return;
    const rows = [...state.aeBridge.leads.map(item => ({ kind: 'lead', row: item })), ...state.aeBridge.orders.map(item => ({ kind: 'order', row: item }))]
      .sort((a, b) => String(b.row.updatedAt || b.row.createdAt || '').localeCompare(String(a.row.updatedAt || a.row.createdAt || '')));
    if (!rows.length) {
      list.innerHTML = '<p class="pf-help-text">No AE bridge records yet.</p>';
      return;
    }
    list.innerHTML = rows.map(({ kind, row }) => `
      <article class="pf-session-card">
        <h3>${kind === 'lead' ? 'AE merch lead' : 'AE merch order'}</h3>
        <p class="pf-session-meta">${new Date(row.updatedAt || row.createdAt).toLocaleString()} · ${row.clientName || 'No client'} · ${row.aeName || 'No AE'}</p>
        <p class="pf-help-text">${row.productLabel || row.productId || 'Product'} · ${row.status || row.productionStatus || 'queued'}</p>
        <div class="pf-session-actions">
          <button type="button" class="pf-btn" data-copy-ae-row="${row.id}">Copy JSON</button>
        </div>
      </article>
    `).join('');
    qsa('[data-copy-ae-row]').forEach((node) => node.addEventListener('click', async () => {
      const id = node.getAttribute('data-copy-ae-row');
      const row = state.aeBridge.leads.find((item) => item.id === id) || state.aeBridge.orders.find((item) => item.id === id);
      if (!row) return;
      await navigator.clipboard.writeText(JSON.stringify(row, null, 2)).catch(() => {});
      setStatus('AE bridge row copied');
    }));
  }


  async function refreshAeBridgeContractDeck() {
    try {
      const data = await request('/.netlify/functions/printful-ae-bridge-contract');
      state.aeBridge.contractPackets = Array.isArray(data.contractPackets) ? data.contractPackets : state.aeBridge.contractPackets;
      state.aeBridge.replayQueue = Array.isArray(data.replayQueue) ? data.replayQueue : state.aeBridge.replayQueue;
      renderAeBridgeContractDeck();
      setStatus('AE bridge contract deck refreshed');
    } catch (error) {
      setStatus(`AE bridge contract deck unavailable: ${error.message}`);
    }
  }

  function renderAeBridgeContractDeck() {
    const summary = qs('#pf-admin-ae-contract-summary');
    const list = qs('#pf-admin-ae-contract-list');
    if (summary) summary.textContent = `${state.aeBridge.contractPackets.length} contract packet(s) · ${state.aeBridge.replayQueue.length} replay queue row(s)`;
    if (!list) return;
    if (!state.aeBridge.contractPackets.length && !state.aeBridge.replayQueue.length) {
      list.innerHTML = '<p class="pf-help-text">No contract packets or replay rows yet.</p>';
      return;
    }
    const replayRows = (state.aeBridge.replayQueue || []).map((row) => `
      <article class="pf-session-card">
        <h3>Replay queue</h3>
        <p class="pf-session-meta">${new Date(row.createdAt || Date.now()).toLocaleString()} · ${row.status || 'queued'}</p>
        <p class="pf-help-text">${row.reason || 'Replay queue row'}</p>
      </article>
    `).join('');
    const packetRows = (state.aeBridge.contractPackets || []).slice(0, 20).map((row) => `
      <article class="pf-session-card">
        <h3>${row.kind || 'contract packet'}</h3>
        <p class="pf-session-meta">${new Date(row.at || Date.now()).toLocaleString()} · ${row.status || 'logged'}</p>
        <p class="pf-help-text">${row.message || 'Packet recorded'}</p>
      </article>
    `).join('');
    list.innerHTML = replayRows + packetRows;
  }

  async function refreshAeBridgeArtDeck() {
    try {
      const data = await request('/.netlify/functions/printful-ae-bridge-art-packets');
      state.aeBridge.artPackets = Array.isArray(data.artPackets) ? data.artPackets : state.aeBridge.artPackets;
      renderAeBridgeArtDeck();
      setStatus('AE bridge art deck refreshed');
    } catch (error) {
      setStatus(`AE bridge art deck unavailable: ${error.message}`);
    }
  }

  function renderAeBridgeArtDeck() {
    const summary = qs('#pf-admin-ae-art-summary');
    const list = qs('#pf-admin-ae-art-list');
    if (summary) summary.textContent = `${state.aeBridge.artPackets.length} art packet(s)`;
    if (!list) return;
    if (!state.aeBridge.artPackets.length) {
      list.innerHTML = '<p class="pf-help-text">No art packet rows yet.</p>';
      return;
    }
    list.innerHTML = state.aeBridge.artPackets.slice(0, 20).map((row) => `
      <article class="pf-session-card">
        <h3>${row.clientName || 'Client art packet'}</h3>
        <p class="pf-session-meta">${new Date(row.updatedAt || row.createdAt || Date.now()).toLocaleString()} · ${row.status || 'queued-review'}</p>
        <p class="pf-help-text">${row.productLabel || 'Product'} · revisions ${row.revisionCount || 0}</p>
      </article>
    `).join('');
  }

  async function refreshAeBridgeProfitabilityDeck() {
    try {
      const data = await request('/.netlify/functions/printful-ae-bridge-profitability');
      state.aeBridge.profitability = Array.isArray(data.profitability) ? data.profitability : state.aeBridge.profitability;
      state.aeBridge.orders = Array.isArray(data.orders) ? data.orders : state.aeBridge.orders;
      state.aeBridge.profitabilityTotals = data.totals || { amount: 0, collected: 0, net: 0 };
      renderAeBridgeProfitabilityDeck();
      setStatus('AE bridge profitability deck refreshed');
    } catch (error) {
      setStatus(`AE bridge profitability deck unavailable: ${error.message}`);
    }
  }

  function renderAeBridgeProfitabilityDeck() {
    const summary = qs('#pf-admin-ae-profitability-summary');
    const list = qs('#pf-admin-ae-profitability-list');
    const totals = state.aeBridge.profitabilityTotals || { amount: 0, collected: 0, net: 0 };
    if (summary) summary.textContent = `quoted ${currency(totals.amount || 0)} · collected ${currency(totals.collected || 0)} · net ${currency(totals.net || 0)}`;
    if (!list) return;
    const marginRows = (state.aeBridge.orders || []).filter((row) => Number(row.marginPct || 0) < 18).slice(0, 20);
    if (!marginRows.length) {
      list.innerHTML = '<p class="pf-help-text">No margin-watch rows yet.</p>';
      return;
    }
    list.innerHTML = marginRows.map((row) => `
      <article class="pf-session-card">
        <h3>${row.clientName || 'Client'}</h3>
        <p class="pf-session-meta">${row.productLabel || 'Product'} · margin ${Number(row.marginPct || 0).toFixed(1)}%</p>
        <p class="pf-help-text">Collected ${currency(row.collectedValue || 0)} · Net ${currency(row.netPosition || 0)}</p>
      </article>
    `).join('');
  }


  async function refreshAeBridgePresenceDeck() {
    try {
      const data = await request('/.netlify/functions/printful-ae-bridge-presence');
      state.aeBridge.presence = Array.isArray(data.presence) ? data.presence : state.aeBridge.presence;
      state.aeBridge.orders = Array.isArray(data.orders) ? data.orders : state.aeBridge.orders;
      renderAeBridgePresenceDeck();
      setStatus('AE bridge presence deck refreshed');
    } catch (error) {
      setStatus(`AE bridge presence deck unavailable: ${error.message}`);
    }
  }

  function renderAeBridgePresenceDeck() {
    const summary = qs('#pf-admin-ae-presence-summary');
    const list = qs('#pf-admin-ae-presence-list');
    const rows = Array.isArray(state.aeBridge.presence) ? state.aeBridge.presence : [];
    if (summary) summary.textContent = `${rows.length} presence row(s)`;
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = '<p class="pf-help-text">No presence rows yet.</p>';
      return;
    }
    list.innerHTML = rows.slice(0, 20).map((row) => `
      <article class="pf-session-card">
        <h3>${row.operatorName || row.clientName || 'Operator'}</h3>
        <p class="pf-session-meta">${row.role || row.status || 'active'} · ${new Date(row.touchedAt || row.createdAt || Date.now()).toLocaleString()}</p>
        <p class="pf-help-text">Claimed ${(Array.isArray(row.claimedOrderIds) ? row.claimedOrderIds.length : 0)} order(s)</p>
      </article>
    `).join('');
  }

  async function refreshAeBridgeHardeningDeck() {
    try {
      const data = await request('/.netlify/functions/printful-ae-bridge-hardening');
      state.aeBridge.hardening = Array.isArray(data.hardening) ? data.hardening : state.aeBridge.hardening;
      state.aeBridge.contractPackets = Array.isArray(data.contractPackets) ? data.contractPackets : state.aeBridge.contractPackets;
      state.aeBridge.replayQueue = Array.isArray(data.replayQueue) ? data.replayQueue : state.aeBridge.replayQueue;
      renderAeBridgeHardeningDeck();
      setStatus('AE bridge hardening deck refreshed');
    } catch (error) {
      setStatus(`AE bridge hardening deck unavailable: ${error.message}`);
    }
  }

  function renderAeBridgeHardeningDeck() {
    const summary = qs('#pf-admin-ae-hardening-summary');
    const list = qs('#pf-admin-ae-hardening-list');
    const rows = Array.isArray(state.aeBridge.hardening) ? state.aeBridge.hardening : [];
    const readyCount = rows.filter((row) => row.status === 'ready').length;
    if (summary) summary.textContent = `${readyCount}/${rows.length || 0} ready · replay ${(state.aeBridge.replayQueue || []).length}`;
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = '<p class="pf-help-text">No hardening rows yet.</p>';
      return;
    }
    list.innerHTML = rows.slice(0, 20).map((row) => `
      <article class="pf-session-card">
        <h3>${row.label || row.key || 'Hardening check'}</h3>
        <p class="pf-session-meta">${row.status || 'watch'} · ${new Date(row.checkedAt || Date.now()).toLocaleString()}</p>
        <p class="pf-help-text">${row.detail || ''}</p>
      </article>
    `).join('');
  }


  const __baseWireEvents = wireEvents;
  wireEvents = function() {
    __baseWireEvents();
    qs('#pf-admin-refresh-ae-bridge')?.addEventListener('click', () => refreshAeBridge());
    qs('#pf-admin-export-ae-bridge')?.addEventListener('click', () => {
      downloadJson({ exportedAt: state.aeBridge.exportedAt || new Date().toISOString(), leads: state.aeBridge.leads, orders: state.aeBridge.orders, sync: state.aeBridge.sync, contractPackets: state.aeBridge.contractPackets, artPackets: state.aeBridge.artPackets, profitability: state.aeBridge.profitability, returns: state.aeBridge.returns || [], incidents: state.aeBridge.incidents || [] }, 'printful-ae-bridge-export.json');
    });
    qs('#pf-admin-refresh-ae-presence')?.addEventListener('click', () => refreshAeBridgePresenceDeck());
    qs('#pf-admin-export-ae-presence')?.addEventListener('click', () => downloadJson({ exportedAt: state.aeBridge.exportedAt || new Date().toISOString(), presence: state.aeBridge.presence, orders: state.aeBridge.orders }, 'printful-ae-bridge-presence.json'));
    qs('#pf-admin-refresh-ae-hardening')?.addEventListener('click', () => refreshAeBridgeHardeningDeck());
    qs('#pf-admin-export-ae-hardening')?.addEventListener('click', () => downloadJson({ exportedAt: state.aeBridge.exportedAt || new Date().toISOString(), hardening: state.aeBridge.hardening, replayQueue: state.aeBridge.replayQueue, contractPackets: state.aeBridge.contractPackets }, 'printful-ae-bridge-hardening.json'));
    qs('#pf-admin-refresh-ae-contract')?.addEventListener('click', () => refreshAeBridgeContractDeck());
    qs('#pf-admin-export-ae-contract')?.addEventListener('click', () => downloadJson({ exportedAt: state.aeBridge.exportedAt || new Date().toISOString(), contractPackets: state.aeBridge.contractPackets, replayQueue: state.aeBridge.replayQueue }, 'printful-ae-bridge-contract.json'));
    qs('#pf-admin-refresh-ae-art')?.addEventListener('click', () => refreshAeBridgeArtDeck());
    qs('#pf-admin-export-ae-art')?.addEventListener('click', () => downloadJson({ exportedAt: state.aeBridge.exportedAt || new Date().toISOString(), artPackets: state.aeBridge.artPackets }, 'printful-ae-bridge-art-packets.json'));
    qs('#pf-admin-refresh-ae-profitability')?.addEventListener('click', () => refreshAeBridgeProfitabilityDeck());
    qs('#pf-admin-export-ae-profitability')?.addEventListener('click', () => downloadJson({ exportedAt: state.aeBridge.exportedAt || new Date().toISOString(), totals: state.aeBridge.profitabilityTotals || {}, orders: state.aeBridge.orders, profitability: state.aeBridge.profitability }, 'printful-ae-bridge-profitability.json'));
  };
  document.addEventListener('partials:ready', () => { setTimeout(() => { refreshAeBridge(); refreshAeBridgePresenceDeck(); refreshAeBridgeHardeningDeck(); refreshAeBridgeContractDeck(); refreshAeBridgeArtDeck(); refreshAeBridgeProfitabilityDeck(); }, 0); });

  async function refreshAeBridgeReturnsDeck() {
    try {
      const data = await request('/.netlify/functions/printful-ae-bridge-returns');
      state.aeBridge.returns = Array.isArray(data.returns) ? data.returns : state.aeBridge.returns;
      state.aeBridge.orders = Array.isArray(data.orders) ? data.orders : state.aeBridge.orders;
      renderAeBridgeReturnsDeck();
      setStatus('AE bridge returns deck refreshed');
    } catch (error) {
      setStatus(`AE bridge returns deck unavailable: ${error.message}`);
    }
  }

  function renderAeBridgeReturnsDeck() {
    const summary = qs('#pf-admin-ae-returns-summary');
    const list = qs('#pf-admin-ae-returns-list');
    const rows = Array.isArray(state.aeBridge.returns) ? state.aeBridge.returns : [];
    if (summary) summary.textContent = `${rows.length} return ticket(s)`;
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = '<p class="pf-help-text">No return ticket rows yet.</p>';
      return;
    }
    list.innerHTML = rows.slice(0, 20).map((row) => `
      <article class="pf-session-card">
        <h3>${row.clientName || 'Client return'}</h3>
        <p class="pf-session-meta">${row.reason || 'quality-issue'} · ${row.status || 'requested'} · ${new Date(row.updatedAt || row.createdAt || Date.now()).toLocaleString()}</p>
        <p class="pf-help-text">${row.productLabel || 'Product'} · refund ${(row.refundAmount || 0).toFixed ? row.refundAmount : 0} · replacement ${(row.replacementCost || 0).toFixed ? row.replacementCost : 0}</p>
      </article>
    `).join('');
  }

  async function refreshAeBridgeIncidentDeck() {
    try {
      const data = await request('/.netlify/functions/printful-ae-bridge-incidents');
      state.aeBridge.incidents = Array.isArray(data.incidents) ? data.incidents : state.aeBridge.incidents;
      state.aeBridge.orders = Array.isArray(data.orders) ? data.orders : state.aeBridge.orders;
      renderAeBridgeIncidentDeck();
      setStatus('AE bridge incident deck refreshed');
    } catch (error) {
      setStatus(`AE bridge incident deck unavailable: ${error.message}`);
    }
  }

  function renderAeBridgeIncidentDeck() {
    const summary = qs('#pf-admin-ae-incidents-summary');
    const list = qs('#pf-admin-ae-incidents-list');
    const rows = Array.isArray(state.aeBridge.incidents) ? state.aeBridge.incidents : [];
    const critical = rows.filter((row) => row.severity === 'critical').length;
    if (summary) summary.textContent = `${critical} critical · ${rows.length} incident row(s)`;
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = '<p class="pf-help-text">No incident or SLA rows yet.</p>';
      return;
    }
    list.innerHTML = rows.slice(0, 20).map((row) => `
      <article class="pf-session-card">
        <h3>${row.clientName || 'Client incident'}</h3>
        <p class="pf-session-meta">${row.type || 'incident'} · ${row.severity || 'watch'} · ${new Date(row.updatedAt || Date.now()).toLocaleString()}</p>
        <p class="pf-help-text">${row.detail || ''}</p>
      </article>
    `).join('');
  }

  const __v40BaseWireEvents = wireEvents;
  wireEvents = function() {
    __v40BaseWireEvents();
    qs('#pf-admin-refresh-ae-returns')?.addEventListener('click', () => refreshAeBridgeReturnsDeck());
    qs('#pf-admin-export-ae-returns')?.addEventListener('click', () => downloadJson({ exportedAt: state.aeBridge.exportedAt || new Date().toISOString(), returns: state.aeBridge.returns || [], orders: state.aeBridge.orders || [] }, 'printful-ae-bridge-returns.json'));
    qs('#pf-admin-refresh-ae-incidents')?.addEventListener('click', () => refreshAeBridgeIncidentDeck());
    qs('#pf-admin-export-ae-incidents')?.addEventListener('click', () => downloadJson({ exportedAt: state.aeBridge.exportedAt || new Date().toISOString(), incidents: state.aeBridge.incidents || [], orders: state.aeBridge.orders || [] }, 'printful-ae-bridge-incidents.json'));
  };

  document.addEventListener('partials:ready', () => {
    setTimeout(() => {
      refreshAeBridgeReturnsDeck();
      refreshAeBridgeIncidentDeck();
    }, 0);
  });

})();
