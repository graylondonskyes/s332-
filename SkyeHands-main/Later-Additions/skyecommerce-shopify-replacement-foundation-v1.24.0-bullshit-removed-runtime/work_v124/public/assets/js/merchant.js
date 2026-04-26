const statusId = 'merchant-status';
let currentMerchant = null;
let cachedProducts = [];
let cachedOrders = [];
let cachedCollections = [];
let cachedPages = [];
let cachedNavigation = [];
let cachedReturns = [];
let cachedLocations = [];
let cachedAdjustments = [];
let cachedPayments = [];
let cachedNotifications = [];
let cachedNexusRules = [];
let cachedNexusRollups = [];
let cachedProviderConnections = [];

function fillForm(form, data = {}) {
  Object.entries(data).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (!field) return;
    if (Array.isArray(value)) field.value = value.join(', ');
    else if (typeof value === 'boolean') field.value = String(value);
    else field.value = value ?? '';
  });
}

function collectForm(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  return data;
}

async function validateAllProviderConnections() {
  try {
    const data = await window.SKYECOM.api('/api/provider-connections/validate-all', { method: 'POST', body: JSON.stringify({}) });
    window.SKYECOM.status('provider-status', `Validated ${data.summary?.passed || 0}/${data.summary?.total || 0} active provider connection health check(s).`, data.ok ? 'good' : 'bad');
  } catch (error) {
    window.SKYECOM.status('provider-status', error.message, 'bad');
  }
}

function renderProviderConnections(connections = []) {
  const root = document.getElementById('provider-connection-list');
  if (!root) return;
  root.innerHTML = connections.map((item) => {
    const title = window.SKYECOM.escapeHtml(item.name || item.provider);
    const detail = window.SKYECOM.escapeHtml(`${item.provider} · ${item.environment} · ${item.id}`);
    const state = item.active ? 'Active' : 'Off';
    return '<div class="timeline-item">'
      + '<div class="list-item"><div><strong>' + title + '</strong><div class="small">' + detail + '</div></div><span>' + state + '</span></div>'
      + '<div class="button-row"><button class="ghost-button" type="button" data-provider-validate="' + window.SKYECOM.escapeHtml(item.id) + '">Validate connection health</button><button class="ghost-button" type="button" data-provider-health="' + window.SKYECOM.escapeHtml(item.id) + '">Health</button></div>'
      + '</div>';
  }).join('') || '<p class="small">No provider connections yet.</p>';
  root.querySelectorAll('[data-provider-validate]').forEach((button) => button.addEventListener('click', () => validateProviderConnection(button.getAttribute('data-provider-validate'))));
  root.querySelectorAll('[data-provider-health]').forEach((button) => button.addEventListener('click', () => healthProviderConnection(button.getAttribute('data-provider-health'))));
  const validateAllButton = document.getElementById('provider-validate-all');
  if (validateAllButton) validateAllButton.onclick = () => validateAllProviderConnections();
}

async function validateProviderConnection(id) {
  try {
    const data = await window.SKYECOM.api(`/api/provider-connections/${encodeURIComponent(id)}/validate`, { method: 'POST', body: JSON.stringify({}) });
    window.SKYECOM.status('provider-status', `Connection health ${data.validation?.status || data.result?.status} · HTTP ${data.validation?.httpStatus || data.result?.httpStatus || 0}`, data.ok ? 'good' : 'bad');
  } catch (error) {
    window.SKYECOM.status('provider-status', error.message, 'bad');
  }
}

async function healthProviderConnection(id) {
  try {
    const data = await window.SKYECOM.api('/api/provider-connections/health', { method: 'POST', body: JSON.stringify({ connectionId: id }) });
    window.SKYECOM.status('provider-status', `Health ${data.result.status} · HTTP ${data.result.httpStatus}`, data.ok ? 'good' : 'bad');
  } catch (error) {
    window.SKYECOM.status('provider-status', error.message, 'bad');
  }
}

function renderProducts(products = []) {
  const root = document.getElementById('product-list');
  root.innerHTML = products.map((item) => `
    <div class="list-item">
      <div>
        <strong>${window.SKYECOM.escapeHtml(item.title)}</strong>
        <div class="small">${window.SKYECOM.escapeHtml(item.slug)} · ${window.SKYECOM.money(item.priceCents)} · inv ${item.inventoryOnHand}</div>
      </div>
      <div class="button-row"><button class="ghost-button" data-edit-product="${item.id}">Edit</button></div>
    </div>
  `).join('') || '<p class="small">No products yet.</p>';
  root.querySelectorAll('[data-edit-product]').forEach((button) => button.addEventListener('click', () => loadProductIntoEditor(button.getAttribute('data-edit-product'))));
}

function renderOrders(orders = []) {
  const root = document.getElementById('order-list');
  root.innerHTML = orders.map((item) => `
    <div class="list-item">
      <div>
        <strong>${window.SKYECOM.escapeHtml(item.orderNumber)}</strong>
        <div class="small">${window.SKYECOM.escapeHtml(item.customerName)} · ${window.SKYECOM.escapeHtml(item.status)} · ${window.SKYECOM.escapeHtml(item.paymentStatus)} · ${window.SKYECOM.escapeHtml(item.createdAt)}</div>
      </div>
      <div class="button-row"><strong>${window.SKYECOM.money(item.totalCents)}</strong><button class="ghost-button" data-manage-order="${item.id}">Manage</button></div>
    </div>
  `).join('') || '<p class="small">No orders yet.</p>';
  root.querySelectorAll('[data-manage-order]').forEach((button) => button.addEventListener('click', () => loadOrderDetail(button.getAttribute('data-manage-order'))));
}

function renderDiscounts(discountCodes = []) {
  const root = document.getElementById('discount-list');
  root.innerHTML = discountCodes.map((item) => `
    <div class="list-item">
      <div>
        <strong>${window.SKYECOM.escapeHtml(item.code)}</strong>
        <div class="small">${window.SKYECOM.escapeHtml(item.title || '')} · ${item.type === 'fixed' ? window.SKYECOM.money(item.amountCents) : `${(item.amountBps / 100).toFixed(2)}%`} · min ${window.SKYECOM.money(item.minimumSubtotalCents || 0)}</div>
      </div>
      <span>${item.active ? 'Active' : 'Inactive'}</span>
    </div>
  `).join('') || '<p class="small">No discount codes yet.</p>';
}

function renderImportJobs(jobs = []) {
  const root = document.getElementById('import-job-list');
  root.innerHTML = jobs.map((job) => `
    <div class="list-item">
      <div>
        <strong>${window.SKYECOM.escapeHtml(job.kind)}</strong>
        <div class="small">${window.SKYECOM.escapeHtml(job.status)} · ${window.SKYECOM.escapeHtml(job.sourceRef || 'inline')}</div>
      </div>
      <span>${window.SKYECOM.escapeHtml(job.createdAt)}</span>
    </div>
  `).join('') || '<p class="small">No import jobs yet.</p>';
}

function renderCollections(collections = []) {
  const root = document.getElementById('collection-list');
  root.innerHTML = collections.map((item) => `
    <div class="timeline-item">
      <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.title)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.slug)} · ${window.SKYECOM.escapeHtml(item.sortMode)} · ${item.productIds.length} products</div></div><span>${item.visible ? 'Visible' : 'Hidden'}</span></div>
      <div class="button-row"><button class="ghost-button" data-edit-collection="${item.id}" type="button">Edit</button></div>
    </div>
  `).join('') || '<p class="small">No collections yet.</p>';
  root.querySelectorAll('[data-edit-collection]').forEach((button) => button.addEventListener('click', () => loadCollectionIntoEditor(button.getAttribute('data-edit-collection'))));
}

function renderPages(pages = []) {
  const root = document.getElementById('page-list');
  root.innerHTML = pages.map((item) => `
    <div class="timeline-item">
      <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.title)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.slug)}</div></div><span>${item.visible ? 'Visible' : 'Hidden'}</span></div>
      <div class="button-row"><button class="ghost-button" data-edit-page="${item.id}" type="button">Edit</button></div>
    </div>
  `).join('') || '<p class="small">No content pages yet.</p>';
  root.querySelectorAll('[data-edit-page]').forEach((button) => button.addEventListener('click', () => loadPageIntoEditor(button.getAttribute('data-edit-page'))));
}

function renderNavigation(navigation = []) {
  const root = document.getElementById('navigation-list');
  root.innerHTML = navigation.map((item) => `
    <div class="timeline-item">
      <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.label)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.type)} · ${window.SKYECOM.escapeHtml(item.targetRef || item.href || 'home')}</div></div><span>#${item.position}</span></div>
      <div class="button-row"><button class="ghost-button" data-edit-navigation="${item.id}" type="button">Edit</button></div>
    </div>
  `).join('') || '<p class="small">No navigation links yet.</p>';
  root.querySelectorAll('[data-edit-navigation]').forEach((button) => button.addEventListener('click', () => loadNavigationIntoEditor(button.getAttribute('data-edit-navigation'))));
}

function renderReturns(returns = []) {
  const root = document.getElementById('return-list');
  root.innerHTML = returns.map((item) => `
    <div class="timeline-item">
      <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.orderNumber || item.orderId)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.customerName || '')} · ${window.SKYECOM.escapeHtml(item.reason || '')}</div></div><span>${window.SKYECOM.escapeHtml(item.status)}</span></div>
      <div class="list-item"><span>Requested</span><strong>${window.SKYECOM.money(item.requestedCents || 0)}</strong></div>
      <div class="button-row"><button class="ghost-button" data-manage-return="${item.id}" type="button">Manage</button></div>
    </div>
  `).join('') || '<p class="small">No returns yet.</p>';
  root.querySelectorAll('[data-manage-return]').forEach((button) => button.addEventListener('click', () => loadReturnDetail(button.getAttribute('data-manage-return'))));
}

function renderAnalytics(analytics = null) {
  const root = document.getElementById('analytics-summary');
  if (!root) return;
  if (!analytics) {
    root.innerHTML = '<p class="small">No analytics yet.</p>';
    return;
  }
  root.innerHTML = `
    <div class="card compact-card">
      <div class="eyebrow">Revenue</div>
      <div class="list-item"><span>Booked</span><strong>${window.SKYECOM.money(analytics.revenue?.bookedCents || 0)}</strong></div>
      <div class="list-item"><span>Collected</span><strong>${window.SKYECOM.money(analytics.revenue?.collectedCents || 0)}</strong></div>
      <div class="list-item"><span>AOV</span><strong>${window.SKYECOM.money(analytics.revenue?.averageOrderValueCents || 0)}</strong></div>
    </div>
    <div class="card compact-card">
      <div class="eyebrow">Operations</div>
      <div class="list-item"><span>Orders</span><strong>${analytics.counts?.orders || 0}</strong></div>
      <div class="list-item"><span>Open orders</span><strong>${analytics.counts?.openOrders || 0}</strong></div>
      <div class="list-item"><span>Open returns</span><strong>${analytics.counts?.openReturns || 0}</strong></div>
      <div class="list-item"><span>Customers</span><strong>${analytics.counts?.customers || 0}</strong></div>
    </div>
    <div class="card compact-card">
      <div class="eyebrow">Inventory</div>
      <div class="list-item"><span>Available units</span><strong>${analytics.inventory?.availableUnits || 0}</strong></div>
      <div class="list-item"><span>Locations</span><strong>${analytics.inventory?.locationsConfigured || 0}</strong></div>
      <div class="list-item"><span>Low stock</span><strong>${analytics.counts?.lowStockProducts || 0}</strong></div>
    </div>
    <div class="card compact-card">
      <div class="eyebrow">Top products</div>
      ${(analytics.topProducts || []).map((item) => `<div class="list-item"><span>${window.SKYECOM.escapeHtml(item.title)}</span><strong>${item.units}</strong></div>`).join('') || '<p class="small">No order history yet.</p>'}
    </div>
  `;
}

function renderNotifications(notifications = []) {
  const root = document.getElementById('notification-list');
  if (!root) return;
  root.innerHTML = notifications.slice(0, 12).map((item) => `
    <div class="timeline-item">
      <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.subject || item.templateKey)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.channel)} · ${window.SKYECOM.escapeHtml(item.recipient)}</div></div><span>${window.SKYECOM.escapeHtml(item.status)}</span></div>
      <div class="small">${window.SKYECOM.escapeHtml(item.bodyText || '')}</div>
    </div>
  `).join('') || '<p class="small">No notifications yet.</p>';
}

function renderNexusRules(rules = []) {
  const root = document.getElementById('nexus-rule-list');
  if (!root) return;
  root.innerHTML = rules.map((item) => `
    <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.label)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.countryCode)}-${window.SKYECOM.escapeHtml(item.stateCode || 'ALL')} · ${window.SKYECOM.money(item.thresholdCents || 0)} / ${item.thresholdOrders || 0} orders</div></div><span>${item.active ? 'Active' : 'Inactive'}</span></div>
  `).join('') || '<p class="small">No nexus rules yet.</p>';
}

function renderNexusRollups(rollups = []) {
  const root = document.getElementById('nexus-rollup-list');
  if (!root) return;
  root.innerHTML = rollups.map((item) => `
    <div class="timeline-item"><div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.countryCode)}-${window.SKYECOM.escapeHtml(item.stateCode || 'ALL')}</strong><div class="small">${item.orderCount} orders · ${window.SKYECOM.money(item.grossCents || 0)}</div></div><span>${item.thresholdMet ? 'Threshold met' : 'Tracking'}</span></div></div>
  `).join('') || '<p class="small">No nexus rollups yet.</p>';
}

function renderLocations(locations = []) {
  const root = document.getElementById('location-list');
  if (!root) return;
  root.innerHTML = locations.map((item) => `
    <div class="list-item">
      <div>
        <strong>${window.SKYECOM.escapeHtml(item.name)}</strong>
        <div class="small">${window.SKYECOM.escapeHtml(item.code)} · priority ${item.priority} ${item.isDefault ? '· default' : ''}</div>
      </div>
      <div class="button-row"><span>${item.active ? 'Active' : 'Inactive'}</span><button class="ghost-button" data-edit-location="${item.id}" type="button">Edit</button></div>
    </div>
  `).join('') || '<p class="small">No locations yet.</p>';
  root.querySelectorAll('[data-edit-location]').forEach((button) => button.addEventListener('click', () => loadLocationIntoEditor(button.getAttribute('data-edit-location'))));
}

function renderAdjustments(adjustments = []) {
  const root = document.getElementById('adjustment-list');
  if (!root) return;
  root.innerHTML = adjustments.slice(0, 8).map((item) => `
    <div class="timeline-item">
      <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.productTitle || item.productId)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.locationName || item.locationId)} · ${window.SKYECOM.escapeHtml(item.kind)}</div></div><strong>${item.delta > 0 ? '+' : ''}${item.delta}</strong></div>
      <div class="small">${window.SKYECOM.escapeHtml(item.note || item.reference || '')}</div>
    </div>
  `).join('') || '<p class="small">No inventory adjustments yet.</p>';
}

function loadProductIntoEditor(id) {
  const product = cachedProducts.find((item) => item.id === id);
  if (product) fillForm(document.getElementById('product-form'), product);
}

function loadCollectionIntoEditor(id) {
  const collection = cachedCollections.find((item) => item.id === id);
  if (!collection) return;
  fillForm(document.getElementById('collection-form'), { ...collection, productIds: collection.productIds.join(', ') });
}

function loadPageIntoEditor(id) {
  const page = cachedPages.find((item) => item.id === id);
  if (page) fillForm(document.getElementById('page-form'), page);
}

function loadNavigationIntoEditor(id) {
  const nav = cachedNavigation.find((item) => item.id === id);
  if (nav) fillForm(document.getElementById('navigation-form'), nav);
}

function loadLocationIntoEditor(id) {
  const location = cachedLocations.find((item) => item.id === id);
  if (location) fillForm(document.getElementById('location-form'), location);
}

async function loadReturnDetail(id) {
  try {
    const data = await window.SKYECOM.api(`/api/returns/${id}`);
    const returnRequest = data.returnRequest;
    fillForm(document.getElementById('return-update-form'), {
      returnId: returnRequest.id,
      status: returnRequest.status,
      resolutionType: returnRequest.resolutionType,
      approvedCents: returnRequest.approvedCents,
      refundReference: returnRequest.refundReference,
      merchantNote: returnRequest.merchantNote,
      restockItems: String(Boolean(returnRequest.restockItems))
    });
    document.getElementById('return-detail').innerHTML = `
      <div class="card compact-card">
        <div class="eyebrow">${window.SKYECOM.escapeHtml(returnRequest.orderNumber || returnRequest.orderId)}</div>
        <div class="list-item"><span>Status</span><strong>${window.SKYECOM.escapeHtml(returnRequest.status)}</strong></div>
        <div class="list-item"><span>Reason</span><strong>${window.SKYECOM.escapeHtml(returnRequest.reason || 'n/a')}</strong></div>
        <div class="list-item"><span>Requested</span><strong>${window.SKYECOM.money(returnRequest.requestedCents || 0)}</strong></div>
        <div class="list-item"><span>Approved</span><strong>${window.SKYECOM.money(returnRequest.approvedCents || 0)}</strong></div>
        <div class="small">${window.SKYECOM.escapeHtml(returnRequest.customerNote || '')}</div>
      </div>
      <div class="card compact-card">
        <div class="eyebrow">Lines</div>
        ${(returnRequest.items || []).map((item) => `<div class="list-item"><span>${window.SKYECOM.escapeHtml(item.title || item.productId)} × ${item.quantity}</span><strong>${window.SKYECOM.escapeHtml(item.productId)}</strong></div>`).join('') || '<p class="small">No lines.</p>'}
      </div>
    `;
    window.SKYECOM.status('merchant-publish-status', `Loaded return ${window.SKYECOM.escapeHtml(returnRequest.id)}.`, 'good');
  } catch (error) {
    window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
  }
}

async function loadOrderDetail(id) {
  try {
    const data = await window.SKYECOM.api(`/api/orders/${id}`);
    const order = data.order;
    fillForm(document.getElementById('order-update-form'), {
      orderId: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentReference: order.paymentReference || '',
      note: order.notes || ''
    });
    fillForm(document.getElementById('fulfillment-form'), { orderId: order.id, status: 'queued' });
    fillForm(document.getElementById('payment-session-form'), { orderId: order.id, amountCents: order.totalCents, provider: 'stripe' });
    fillForm(document.getElementById('fulfillment-sync-form'), { orderId: order.id, eventType: 'order.fulfillment_sync' });
    fillForm(document.getElementById('routex-handoff-form'), { orderId: order.id, kind: 'delivery' });
    document.getElementById('order-detail-summary').innerHTML = `
      <div class="card compact-card">
        <div class="eyebrow">${window.SKYECOM.escapeHtml(order.orderNumber)}</div>
        <div class="list-item"><span>${window.SKYECOM.escapeHtml(order.customerName)}</span><strong>${window.SKYECOM.money(order.totalCents)}</strong></div>
        <div class="small">${window.SKYECOM.escapeHtml(order.customerEmail)} · ${window.SKYECOM.escapeHtml(order.status)} · ${window.SKYECOM.escapeHtml(order.paymentStatus)}</div>
        <div class="small">Discount: ${window.SKYECOM.escapeHtml(order.discountCode || 'none')} · Shipping: ${window.SKYECOM.money(order.shippingCents)}</div>
      </div>
      <div class="card compact-card">
        <div class="eyebrow">Items</div>
        ${order.items.map((item) => `<div class="list-item"><span>${window.SKYECOM.escapeHtml(item.title)} × ${item.quantity}</span><strong>${window.SKYECOM.money(item.unitPriceCents * item.quantity)}</strong></div>`).join('') || '<p class="small">No items</p>'}
      </div>
      <div class="card compact-card">
        <div class="eyebrow">Returns on this order</div>
        ${(order.returns || []).map((item) => `<div class="list-item"><span>${window.SKYECOM.escapeHtml(item.status)} · ${window.SKYECOM.escapeHtml(item.reason || '')}</span><button class="ghost-button" type="button" data-manage-return-inline="${item.id}">Open</button></div>`).join('') || '<p class="small">No returns yet.</p>'}
      </div>
      <div class="card compact-card">
        <div class="eyebrow">Inventory allocations</div>
        ${(order.allocations || []).map((item) => `<div class="list-item"><span>${window.SKYECOM.escapeHtml(item.locationName || item.locationCode || 'Legacy stock')}</span><strong>${item.quantity}</strong></div>`).join('') || '<p class="small">No location allocations recorded.</p>'}
      </div>
      <div class="card compact-card">
        <div class="eyebrow">Platform handoffs</div>
        ${(order.fulfillmentSyncJobs || []).map((item) => `<div class="list-item"><span>Fulfillment sync · ${window.SKYECOM.escapeHtml(item.status)}</span><strong>HTTP ${item.httpStatus || 0}</strong></div>`).join('') || '<p class="small">No fulfillment sync jobs on this order.</p>'}
        ${(order.routexHandoffs || []).map((item) => `<div class="list-item"><span>Routex · ${window.SKYECOM.escapeHtml(item.kind)}</span><strong>${window.SKYECOM.escapeHtml(item.status)}</strong></div>`).join('') || '<p class="small">No Routex handoffs on this order.</p>'}
      </div>
    `;
    document.getElementById('order-detail-summary').querySelectorAll('[data-manage-return-inline]').forEach((button) => button.addEventListener('click', () => loadReturnDetail(button.getAttribute('data-manage-return-inline'))));
    document.getElementById('order-event-list').innerHTML = order.events.map((event) => `
      <div class="timeline-item">
        <strong>${window.SKYECOM.escapeHtml(event.summary)}</strong>
        <div class="small">${window.SKYECOM.escapeHtml(event.createdAt)} · ${window.SKYECOM.escapeHtml(event.kind)}</div>
        <div class="small">${window.SKYECOM.escapeHtml(event.detail || '')}</div>
      </div>
    `).join('') || '<p class="small">No order events yet.</p>';
    document.getElementById('fulfillment-list').innerHTML = order.fulfillments.map((item) => `
      <div class="list-item">
        <div>
          <strong>${window.SKYECOM.escapeHtml(item.trackingNumber || item.note || 'Fulfillment')}</strong>
          <div class="small">${window.SKYECOM.escapeHtml(item.carrier || '')} ${window.SKYECOM.escapeHtml(item.service || '')} · ${window.SKYECOM.escapeHtml(item.status)}</div>
        </div>
        <span>${item.trackingUrl ? `<a href="${window.SKYECOM.escapeHtml(item.trackingUrl)}" target="_blank" rel="noreferrer">Track</a>` : ''}</span>
      </div>
    `).join('') || '<p class="small">No fulfillments yet.</p>';
    document.getElementById('payment-list').innerHTML = (order.payments || []).map((item) => `
      <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.provider)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.checkoutToken)} · ${window.SKYECOM.escapeHtml(item.providerReference || 'no ref')}</div></div><span>${window.SKYECOM.escapeHtml(item.status)}</span></div>
    `).join('') || '<p class="small">No payment sessions yet.</p>';
    document.getElementById('order-notification-list').innerHTML = (order.notifications || []).map((item) => `
      <div class="timeline-item"><strong>${window.SKYECOM.escapeHtml(item.subject || item.templateKey)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.channel)} · ${window.SKYECOM.escapeHtml(item.recipient)} · ${window.SKYECOM.escapeHtml(item.status)}</div></div>
    `).join('') || '<p class="small">No notifications tied to this order yet.</p>';
    window.SKYECOM.status('merchant-publish-status', `Loaded order ${window.SKYECOM.escapeHtml(order.orderNumber)} into the operations panel.`, 'good');
  } catch (error) {
    window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
  }
}

function renderVariants(products = []) {
  const root = document.getElementById('variant-list');
  if (!root) return;
  const variants = [];
  for (const product of products) for (const variant of product.variants || []) variants.push({ ...variant, productTitle: product.title, productId: product.id });
  root.innerHTML = variants.slice(0, 20).map((item) => `
    <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.productTitle)} · ${window.SKYECOM.escapeHtml(item.title)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.id)} · ${window.SKYECOM.escapeHtml(item.sku || '')} · ${window.SKYECOM.money(item.priceCents)} · inv ${item.inventoryOnHand}</div></div><span>${window.SKYECOM.escapeHtml(item.status || 'active')}</span></div>
  `).join('') || '<p class="small">No variants yet. Create variants from any product ID.</p>';
}

function renderCheckouts(checkouts = []) {
  const root = document.getElementById('checkout-list');
  if (!root) return;
  root.innerHTML = checkouts.slice(0, 20).map((item) => `
    <div class="timeline-item"><div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.customerEmail || item.id)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.id)} · ${window.SKYECOM.escapeHtml(item.status)} · ${window.SKYECOM.money(item.totalCents || 0)} · recoveries ${item.recoveryCount || 0}</div></div><button class="ghost-button" type="button" data-recover-checkout="${item.id}">Recover</button></div></div>
  `).join('') || '<p class="small">No checkout sessions yet.</p>';
  root.querySelectorAll('[data-recover-checkout]').forEach((button) => button.addEventListener('click', () => recoverCheckout(button.getAttribute('data-recover-checkout'))));
}

function renderGiftCards(giftCards = []) {
  const root = document.getElementById('gift-card-list');
  if (!root) return;
  root.innerHTML = giftCards.slice(0, 20).map((item) => `
    <div class="list-item"><div><strong>•••• ${window.SKYECOM.escapeHtml(item.codeLast4 || '')}</strong><div class="small">${window.SKYECOM.escapeHtml(item.customerEmail || 'unassigned')} · ${window.SKYECOM.money(item.balanceCents || 0)} remaining</div></div><span>${item.active ? 'Active' : 'Off'}</span></div>
  `).join('') || '<p class="small">No gift cards yet.</p>';
}

function renderWebhooks(endpoints = [], deliveries = []) {
  const root = document.getElementById('webhook-list');
  if (!root) return;
  const endpointHtml = endpoints.map((item) => `<div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.name)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.url)} · ${(item.events || []).map(window.SKYECOM.escapeHtml).join(', ')}</div></div><span>${item.active ? 'Active' : 'Off'}</span></div>`).join('') || '<p class="small">No webhook endpoints yet.</p>';
  const deliveryHtml = deliveries.slice(0, 8).map((item) => `<div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.eventType)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.id)} · attempts ${item.attemptCount}</div></div><span>${window.SKYECOM.escapeHtml(item.status)}</span></div>`).join('');
  root.innerHTML = endpointHtml + (deliveryHtml ? `<div class="eyebrow" style="margin-top:12px">Deliveries</div>${deliveryHtml}` : '');
}

function renderRiskAssessments(assessments = []) {
  const root = document.getElementById('risk-list');
  if (!root) return;
  root.innerHTML = assessments.slice(0, 20).map((item) => `
    <div class="timeline-item"><div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.decision)}</strong><div class="small">score ${item.score} · order ${window.SKYECOM.escapeHtml(item.orderId || '')}</div></div><span>${window.SKYECOM.escapeHtml((item.reasons || []).join(', '))}</span></div></div>
  `).join('') || '<p class="small">No risk assessments yet.</p>';
}

function renderAuditEvents(events = []) {
  const root = document.getElementById('audit-list');
  if (!root) return;
  root.innerHTML = events.slice(0, 20).map((item) => `
    <div class="timeline-item"><strong>${window.SKYECOM.escapeHtml(item.event_type || item.eventType)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.summary || '')} · ${window.SKYECOM.escapeHtml(item.created_at || item.createdAt || '')}</div></div>
  `).join('') || '<p class="small">No audit events yet.</p>';
}

async function recoverCheckout(id) {
  try {
    await window.SKYECOM.api(`/api/checkouts/${id}/recover`, { method: 'POST' });
    window.SKYECOM.status('merchant-publish-status', 'Checkout recovery queued.', 'good');
    await refreshMerchantState();
  } catch (error) {
    window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
  }
}

function renderWorkflows(rules = [], runs = []) {
  const root = document.getElementById('workflow-list');
  if (!root) return;
  root.innerHTML = `
    <div class="eyebrow">Rules</div>
    ${rules.slice(0, 12).map((item) => `<div class="timeline-item"><div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.name)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.triggerEvent)} · ${item.actions.length} actions · ${item.conditions.length} conditions</div></div><span>${item.active ? 'Active' : 'Off'}</span></div></div>`).join('') || '<p class="small">No workflow rules yet.</p>'}
    <div class="eyebrow" style="margin-top:14px">Recent runs</div>
    ${runs.slice(0, 8).map((item) => `<div class="timeline-item"><strong>${window.SKYECOM.escapeHtml(item.eventType)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.status)} · ${item.matched ? 'matched' : 'skipped'} · ${window.SKYECOM.escapeHtml(item.createdAt || '')}</div></div>`).join('') || '<p class="small">No workflow runs yet.</p>'}
  `;
}

function renderLoyalty(programs = [], ledger = []) {
  const root = document.getElementById('loyalty-list');
  if (!root) return;
  const earned = ledger.filter((item) => Number(item.pointsDelta || 0) > 0).reduce((sum, item) => sum + Number(item.pointsDelta || 0), 0);
  const spent = Math.abs(ledger.filter((item) => Number(item.pointsDelta || 0) < 0).reduce((sum, item) => sum + Number(item.pointsDelta || 0), 0));
  root.innerHTML = `
    <div class="list-item"><span>Ledger balance</span><strong>${Math.max(0, earned - spent)} pts</strong></div>
    ${programs.slice(0, 6).map((item) => `<div class="timeline-item"><strong>${window.SKYECOM.escapeHtml(item.name)}</strong><div class="small">Earn ${item.earnPointsPerDollar}/$ · redeem ${item.redeemCentsPerPoint}¢/point · min ${item.minimumRedeemPoints}</div></div>`).join('') || '<p class="small">No loyalty program yet.</p>'}
    <div class="eyebrow" style="margin-top:14px">Ledger</div>
    ${ledger.slice(0, 8).map((item) => `<div class="list-item"><span>${window.SKYECOM.escapeHtml(item.customerId || 'customer')} · ${window.SKYECOM.escapeHtml(item.reason)}</span><strong>${item.pointsDelta > 0 ? '+' : ''}${item.pointsDelta}</strong></div>`).join('') || '<p class="small">No loyalty ledger entries yet.</p>'}
  `;
}

function renderProductReviews(reviews = [], summary = {}) {
  const root = document.getElementById('review-list');
  if (!root) return;
  root.innerHTML = `
    <div class="list-item"><span>Approved average</span><strong>${Number(summary.averageRating || 0).toFixed(1)} ★</strong></div>
    <div class="list-item"><span>Total / pending</span><strong>${summary.totalCount || 0} / ${summary.pendingCount || 0}</strong></div>
    ${reviews.slice(0, 10).map((item) => `<div class="timeline-item"><div class="list-item"><div><strong>${'★'.repeat(Math.max(1, Math.min(5, Number(item.rating || 0))))} ${window.SKYECOM.escapeHtml(item.title || item.productTitle || item.productId)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.customerName || item.customerEmail || 'Customer')} · ${window.SKYECOM.escapeHtml(item.status)}</div></div><span>${window.SKYECOM.escapeHtml(item.source || '')}</span></div><div class="small">${window.SKYECOM.escapeHtml(item.body || '')}</div></div>`).join('') || '<p class="small">No reviews yet.</p>'}
  `;
}

function renderInventoryTransfers(transfers = []) {
  const root = document.getElementById('inventory-transfer-list');
  if (!root) return;
  root.innerHTML = transfers.slice(0, 12).map((item) => `
    <div class="timeline-item">
      <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.reference || item.id)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.fromLocationName || item.fromLocationId)} → ${window.SKYECOM.escapeHtml(item.toLocationName || item.toLocationId)} · ${item.unitCount} units</div></div><span>${window.SKYECOM.escapeHtml(item.status)}</span></div>
      ${item.status !== 'completed' && item.status !== 'cancelled' ? `<div class="button-row"><button class="ghost-button" type="button" data-complete-transfer="${window.SKYECOM.escapeHtml(item.id)}">Complete transfer</button></div>` : ''}
    </div>
  `).join('') || '<p class="small">No inventory transfers yet.</p>';
  root.querySelectorAll('[data-complete-transfer]').forEach((button) => button.addEventListener('click', () => completeInventoryTransfer(button.getAttribute('data-complete-transfer'))));
}

async function completeInventoryTransfer(id) {
  try {
    await window.SKYECOM.api(`/api/inventory-transfers/${id}/complete`, { method: 'POST' });
    window.SKYECOM.status('merchant-publish-status', 'Inventory transfer completed.', 'good');
    await refreshMerchantState();
  } catch (error) {
    window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
  }
}



function renderFulfillmentSyncJobs(jobs = []) {
  const root = document.getElementById('fulfillment-sync-list');
  if (!root) return;
  root.innerHTML = jobs.slice(0, 10).map((item) => `
    <div class="timeline-item">
      <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.orderId)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.target)} · HTTP ${item.httpStatus || 0}</div></div><span>${window.SKYECOM.escapeHtml(item.status)}</span></div>
      <div class="small">${window.SKYECOM.escapeHtml(item.error || item.createdAt || '')}</div>
    </div>
  `).join('') || '<p class="small">No fulfillment sync jobs yet.</p>';
}

function renderRoutexHandoffs(handoffs = []) {
  const root = document.getElementById('routex-handoff-list');
  if (!root) return;
  root.innerHTML = handoffs.slice(0, 10).map((item) => `
    <div class="timeline-item">
      <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.kind)} · ${window.SKYECOM.escapeHtml(item.routeDate || 'unscheduled')}</strong><div class="small">${window.SKYECOM.escapeHtml(item.orderId || item.returnId || '')} · ${window.SKYECOM.escapeHtml(item.externalRef || 'no external ref')}</div></div><span>${window.SKYECOM.escapeHtml(item.status)}</span></div>
      <div class="small">${window.SKYECOM.escapeHtml(item.error || item.createdAt || '')}</div>
    </div>
  `).join('') || '<p class="small">No Routex handoffs yet.</p>';
}

function renderWarehouseWorkOrders(workOrders = []) {
  const root = document.getElementById('warehouse-work-order-list');
  if (!root) return;
  root.innerHTML = workOrders.slice(0, 10).map((item) => `
    <div class="timeline-item">
      <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.orderId)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.priority)} · HTTP ${item.httpStatus || 0} · ${window.SKYECOM.escapeHtml(item.externalRef || 'no external ref')}</div></div><span>${window.SKYECOM.escapeHtml(item.status)}</span></div>
      <div class="small">${window.SKYECOM.escapeHtml(item.error || item.createdAt || '')}</div>
    </div>
  `).join('') || '<p class="small">No warehouse work orders yet.</p>';
}

function renderShipmentEvents(events = []) {
  const root = document.getElementById('shipment-event-list');
  if (!root) return;
  root.innerHTML = events.slice(0, 12).map((item) => `
    <div class="timeline-item">
      <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.trackingNumber || item.labelId)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.orderId)} · ${window.SKYECOM.escapeHtml(item.eventTime || item.createdAt)}</div></div><span>${window.SKYECOM.escapeHtml(item.status)}</span></div>
      <div class="small">${window.SKYECOM.escapeHtml([item.location, item.detail].filter(Boolean).join(' · '))}</div>
    </div>
  `).join('') || '<p class="small">No shipment events yet.</p>';
}


function renderWarehouseOps(bins = [], pickLists = []) {
  const binRoot = document.getElementById('warehouse-bin-list');
  if (binRoot) binRoot.innerHTML = `<div class="eyebrow">Bins</div>${bins.slice(0, 10).map((item) => `<div class="timeline-item"><div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.code)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.label || item.locationId)}</div></div><span>${item.active ? 'active' : 'inactive'}</span></div></div>`).join('') || '<p class="small">No bins yet.</p>'}`;
  const pickRoot = document.getElementById('warehouse-pick-list-list');
  if (pickRoot) pickRoot.innerHTML = `<div class="eyebrow">Pick lists</div>${pickLists.slice(0, 10).map((item) => `<div class="timeline-item"><div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.orderId || item.id)}</strong><div class="small">${(item.lines || []).length} lines</div></div><span>${window.SKYECOM.escapeHtml(item.status)}</span></div></div>`).join('') || '<p class="small">No pick lists yet.</p>'}`;
}

function renderRoutexOps(drivers = [], vehicles = [], plans = [], pickups = []) {
  const driverRoot = document.getElementById('routex-driver-list');
  if (driverRoot) driverRoot.innerHTML = `<div class="eyebrow">Drivers</div>${drivers.slice(0, 8).map((item) => `<div class="list-item"><span>${window.SKYECOM.escapeHtml(item.name)}</span><strong>${window.SKYECOM.escapeHtml(item.status)}</strong></div>`).join('') || '<p class="small">No drivers yet.</p>'}`;
  const vehicleRoot = document.getElementById('routex-vehicle-list');
  if (vehicleRoot) vehicleRoot.innerHTML = `<div class="eyebrow">Vehicles</div>${vehicles.slice(0, 8).map((item) => `<div class="list-item"><span>${window.SKYECOM.escapeHtml(item.label)}</span><strong>${window.SKYECOM.escapeHtml(item.status)}</strong></div>`).join('') || '<p class="small">No vehicles yet.</p>'}`;
  const planRoot = document.getElementById('route-plan-list');
  if (planRoot) planRoot.innerHTML = `<div class="eyebrow">Plans</div>${plans.slice(0, 8).map((item) => { const stops = Array.isArray(item.stops) ? item.stops : []; const completed = stops.filter((stop) => ['delivered','failed','skipped','picked_up'].includes(String(stop.status || '').toLowerCase())).length; return `<div class="timeline-item"><div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.routeDate || item.id)}</strong><div class="small">${completed}/${stops.length} stops complete · ${window.SKYECOM.escapeHtml(item.id)}</div></div><span>${window.SKYECOM.escapeHtml(item.status)}</span></div></div>`; }).join('') || '<p class="small">No route plans yet.</p>'}`;
  const pickupRoot = document.getElementById('return-pickup-list');
  if (pickupRoot) pickupRoot.innerHTML = `<div class="eyebrow">Return pickups</div>${pickups.slice(0, 8).map((item) => `<div class="list-item"><span>${window.SKYECOM.escapeHtml(item.returnId || item.id)}</span><strong>${window.SKYECOM.escapeHtml(item.status)}</strong></div>`).join('') || '<p class="small">No return pickups yet.</p>'}`;
}

function renderMarketplaceOps(developers = [], reviews = [], settlements = []) {
  const developerRoot = document.getElementById('app-developer-list');
  if (developerRoot) developerRoot.innerHTML = `<div class="eyebrow">Developers</div>${developers.slice(0, 8).map((item) => `<div class="timeline-item"><div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.name)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.email)}</div></div><span>${window.SKYECOM.escapeHtml(item.status)}</span></div></div>`).join('') || '<p class="small">No developer accounts yet.</p>'}`;
  const reviewRoot = document.getElementById('app-review-list');
  if (reviewRoot) reviewRoot.innerHTML = `<div class="eyebrow">Reviews</div>${reviews.slice(0, 8).map((item) => `<div class="timeline-item"><div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(item.appId)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.developerId)}</div></div><span>${window.SKYECOM.escapeHtml(item.status)}</span></div><div class="small">${window.SKYECOM.escapeHtml(item.reviewerNotes || '')}</div></div>`).join('') || '<p class="small">No app reviews yet.</p>'}`;
  const settlementRoot = document.getElementById('app-settlement-list');
  if (settlementRoot) settlementRoot.innerHTML = `<div class="eyebrow">Settlements</div>${settlements.slice(0, 8).map((item) => `<div class="timeline-item"><div class="list-item"><div><strong>${window.SKYECOM.money(item.developerPayoutCents || 0, 'USD')}</strong><div class="small">${window.SKYECOM.escapeHtml(item.developerId)} · ${window.SKYECOM.escapeHtml(item.payoutReference || '')}</div></div><span>${window.SKYECOM.escapeHtml(item.status)}</span></div></div>`).join('') || '<p class="small">No settlements yet.</p>'}`;
}

function renderProductionReadiness(data = {}) {
  const root = document.getElementById('production-readiness-list');
  if (!root) return;
  const production = data.production || data.readiness?.production || {};
  const blockers = Array.isArray(production.blockers) ? production.blockers : [];
  const warnings = Array.isArray(production.warnings) ? production.warnings : [];
  const controls = production.controls || {};
  const providerRuntime = production.providerRuntime || {};
  const providerRows = (providerRuntime.providers || []).map((item) => `${item.provider}:${item.ready ? 'ready' : `missing(${(item.missingSecrets || []).join('|')})`}`).join(', ') || 'none';
  root.innerHTML =     '<div class="list-item"><strong>Production gate</strong><span>' + (production.ok ? 'PASS' : 'BLOCKED') + '</span></div>' +
    '<div class="list-item"><strong>Enforcement</strong><span>' + (production.enforced ? 'Enabled' : 'Disabled') + '</span></div>' +
    '<div class="list-item"><strong>Provider connection check mode</strong><span>' + (controls.providerPreviewRemoved ? 'Connection health only' : 'Blocked') + '</span></div>' +
    '<div class="list-item"><strong>Payments</strong><span>' + window.SKYECOM.escapeHtml((controls.paymentProviders || []).join(', ') || 'stripe, paypal') + '</span></div>' +
    '<div class="list-item"><strong>Carriers</strong><span>' + window.SKYECOM.escapeHtml((controls.carrierProviders || []).join(', ') || 'ups') + '</span></div>' +
    '<div class="list-item"><strong>Full-platform lanes</strong><span>' + ((controls.fulfillmentSyncRequiresHttpsSignedPost && controls.routexHandoffRequiresLiveIngest && controls.productDetailStorefrontRoutes && controls.warehouseWorkOrdersRequireSignedHttpsHandoff && controls.shipmentTrackingWebhookRequiresSignature) ? 'Enabled' : 'Partial') + '</span></div>' +
    '<div class="timeline-item"><strong>Active provider runtime</strong><div class="small">' + window.SKYECOM.escapeHtml(providerRows) + '</div></div>' +
    '<div class="timeline-item"><strong>Blockers</strong><div class="small">' + window.SKYECOM.escapeHtml(blockers.join(', ') || 'none') + '</div></div>' +
    '<div class="timeline-item"><strong>Warnings</strong><div class="small">' + window.SKYECOM.escapeHtml(warnings.join(', ') || 'none') + '</div></div>';
}

async function refreshContenderState() {
  const [checkouts, giftCards, risk, webhooks, deliveries, audit, workflows, loyalty, reviews, transfers, fulfillmentSync, routex, warehouse, shipments, productionReadiness, warehouseBins, warehousePickLists, routeDrivers, routeVehicles, routePlans, returnPickups, appDevelopers, appReviews, appSettlements] = await Promise.all([
    window.SKYECOM.api('/api/checkouts').catch(() => ({ checkouts: [] })),
    window.SKYECOM.api('/api/gift-cards').catch(() => ({ giftCards: [] })),
    window.SKYECOM.api('/api/risk/assessments').catch(() => ({ assessments: [] })),
    window.SKYECOM.api('/api/webhooks/endpoints').catch(() => ({ endpoints: [] })),
    window.SKYECOM.api('/api/webhooks/deliveries').catch(() => ({ deliveries: [] })),
    window.SKYECOM.api('/api/audit-events').catch(() => ({ events: [] })),
    window.SKYECOM.api('/api/workflows/rules').catch(() => ({ rules: [], runs: [] })),
    window.SKYECOM.api('/api/loyalty/programs').catch(() => ({ programs: [], ledger: [] })),
    window.SKYECOM.api('/api/product-reviews').catch(() => ({ reviews: [], summary: {} })),
    window.SKYECOM.api('/api/inventory-transfers').catch(() => ({ transfers: [] })),
    window.SKYECOM.api('/api/fulfillment-sync/jobs').catch(() => ({ jobs: [] })),
    window.SKYECOM.api('/api/routex/handoffs').catch(() => ({ handoffs: [] })),
    window.SKYECOM.api('/api/warehouse/work-orders').catch(() => ({ workOrders: [] })),
    window.SKYECOM.api('/api/shipment-events').catch(() => ({ events: [] })),
    window.SKYECOM.api('/api/system/production-readiness').catch((error) => ({ production: { ok: false, blockers: [error.message || 'production_readiness_unavailable'], warnings: [], controls: {} } })),
    window.SKYECOM.api('/api/warehouse/bins').catch(() => ({ bins: [] })),
    window.SKYECOM.api('/api/warehouse/pick-lists').catch(() => ({ pickLists: [] })),
    window.SKYECOM.api('/api/routex/drivers').catch(() => ({ drivers: [] })),
    window.SKYECOM.api('/api/routex/vehicles').catch(() => ({ vehicles: [] })),
    window.SKYECOM.api('/api/routex/plans').catch(() => ({ plans: [] })),
    window.SKYECOM.api('/api/routex/return-pickups').catch(() => ({ pickups: [] })),
    window.SKYECOM.api('/api/app-developers').catch(() => ({ developers: [] })),
    window.SKYECOM.api('/api/app-reviews').catch(() => ({ reviews: [] })),
    window.SKYECOM.api('/api/app-settlements').catch(() => ({ settlements: [] }))
  ]);
  renderVariants(cachedProducts);
  renderCheckouts(checkouts.checkouts || []);
  renderGiftCards(giftCards.giftCards || []);
  renderRiskAssessments(risk.assessments || []);
  renderWebhooks(webhooks.endpoints || [], deliveries.deliveries || []);
  renderAuditEvents(audit.events || []);
  renderWorkflows(workflows.rules || [], workflows.runs || []);
  renderLoyalty(loyalty.programs || [], loyalty.ledger || []);
  renderProductReviews(reviews.reviews || [], reviews.summary || {});
  renderInventoryTransfers(transfers.transfers || []);
  renderFulfillmentSyncJobs(fulfillmentSync.jobs || []);
  renderRoutexHandoffs(routex.handoffs || []);
  renderWarehouseWorkOrders(warehouse.workOrders || []);
  renderShipmentEvents(shipments.events || []);
  renderWarehouseOps(warehouseBins.bins || [], warehousePickLists.pickLists || []);
  renderRoutexOps(routeDrivers.drivers || [], routeVehicles.vehicles || [], routePlans.plans || [], returnPickups.pickups || []);
  renderMarketplaceOps(appDevelopers.developers || [], appReviews.reviews || [], appSettlements.settlements || []);
  renderProductionReadiness(productionReadiness || {});
}

async function refreshMerchantState() {
  const auth = await window.SKYECOM.api('/api/auth/me').catch(() => ({ ok: false }));
  if (!auth.ok || !auth.session?.merchant) return;
  currentMerchant = auth.session.merchant;
  fillForm(document.getElementById('merchant-profile-form'), currentMerchant);
  const storeLink = document.getElementById('store-slug-link');
  if (storeLink) {
    storeLink.setAttribute('href', `../store/index.html?slug=${currentMerchant.slug}`);
    storeLink.textContent = `Open ${currentMerchant.slug}`;
  }
  const [products, orders, discounts, jobs, collections, pages, navigation, returns, analytics, locations, adjustments, payments, notifications, nexusRules, nexusRollups, providerConnections] = await Promise.all([
    window.SKYECOM.api('/api/products'),
    window.SKYECOM.api('/api/orders'),
    window.SKYECOM.api('/api/discount-codes'),
    window.SKYECOM.api('/api/import-jobs'),
    window.SKYECOM.api('/api/collections'),
    window.SKYECOM.api('/api/pages'),
    window.SKYECOM.api('/api/navigation'),
    window.SKYECOM.api('/api/returns'),
    window.SKYECOM.api('/api/analytics/summary'),
    window.SKYECOM.api('/api/inventory/locations'),
    window.SKYECOM.api('/api/inventory/adjustments'),
    window.SKYECOM.api('/api/payments/transactions'),
    window.SKYECOM.api('/api/notifications'),
    window.SKYECOM.api('/api/tax-nexus/rules'),
    window.SKYECOM.api('/api/tax-nexus/rollups'),
    window.SKYECOM.api('/api/provider-connections')
  ]);
  cachedProducts = products.products || [];
  cachedOrders = orders.orders || [];
  cachedCollections = collections.collections || [];
  cachedPages = pages.pages || [];
  cachedNavigation = navigation.navigation || [];
  cachedReturns = returns.returns || [];
  cachedLocations = locations.locations || [];
  cachedAdjustments = adjustments.adjustments || [];
  cachedPayments = payments.transactions || [];
  cachedNotifications = notifications.notifications || [];
  cachedNexusRules = nexusRules.rules || [];
  cachedNexusRollups = nexusRollups.rollups || [];
  cachedProviderConnections = providerConnections.connections || [];
  renderProducts(cachedProducts);
  renderOrders(cachedOrders);
  renderDiscounts(discounts.discountCodes || []);
  renderImportJobs(jobs.jobs || []);
  renderCollections(cachedCollections);
  renderPages(cachedPages);
  renderNavigation(cachedNavigation);
  renderReturns(cachedReturns);
  renderAnalytics(analytics.analytics || null);
  renderLocations(cachedLocations);
  renderAdjustments(cachedAdjustments);
  renderNotifications(cachedNotifications);
  renderNexusRules(cachedNexusRules);
  renderNexusRollups(cachedNexusRollups);
  renderProviderConnections(cachedProviderConnections);
  await refreshContenderState();
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('register-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const payload = collectForm(event.target);
      await window.SKYECOM.api('/api/merchant/register', { method: 'POST', body: JSON.stringify(payload) });
      window.SKYECOM.status(statusId, 'Merchant created and session opened.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status(statusId, error.message, 'bad');
    }
  });

  document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/auth/login', { method: 'POST', body: JSON.stringify(collectForm(event.target)) });
      window.SKYECOM.status(statusId, 'Merchant login successful.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status(statusId, error.message, 'bad');
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await window.SKYECOM.api('/api/auth/logout', { method: 'POST' }).catch(() => null);
    window.SKYECOM.status(statusId, 'Logged out.', 'warn');
  });

  document.getElementById('save-merchant').addEventListener('click', async () => {
    try {
      await window.SKYECOM.api('/api/merchant', { method: 'PUT', body: JSON.stringify(collectForm(document.getElementById('merchant-profile-form'))) });
      window.SKYECOM.status('merchant-publish-status', 'Merchant profile saved.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  document.getElementById('publish-store').addEventListener('click', async () => {
    try {
      const data = await window.SKYECOM.api('/api/publish', { method: 'POST' });
      window.SKYECOM.status('merchant-publish-status', `Published snapshot. <a href="${data.previewUrl}" target="_blank" rel="noreferrer">Open public store</a>`, 'good');
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  document.getElementById('product-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const payload = collectForm(event.target);
      const id = payload.id;
      delete payload.id;
      await window.SKYECOM.api(id ? `/api/products/${id}` : '/api/products', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', `Product ${id ? 'updated' : 'created'}.`, 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  document.getElementById('shipping-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const payload = collectForm(event.target);
      payload.rates = JSON.parse(payload.rates);
      await window.SKYECOM.api('/api/shipping-profiles', { method: 'POST', body: JSON.stringify(payload) });
      window.SKYECOM.status('merchant-publish-status', 'Shipping profile added.', 'good');
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  document.getElementById('tax-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/tax-profiles', { method: 'POST', body: JSON.stringify(collectForm(event.target)) });
      window.SKYECOM.status('merchant-publish-status', 'Tax profile added.', 'good');
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  document.getElementById('tax-nexus-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/tax-nexus/rules', { method: 'POST', body: JSON.stringify(collectForm(event.target)) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', 'Tax nexus rule added.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  document.getElementById('provider-connection-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const payload = collectForm(event.target);
      payload.config = payload.config ? JSON.parse(payload.config) : {};
      await window.SKYECOM.api('/api/provider-connections', { method: 'POST', body: JSON.stringify(payload) });
      event.target.reset();
      window.SKYECOM.status('provider-status', 'Provider connection saved.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('provider-status', error.message, 'bad');
    }
  });

  document.getElementById('dispatch-notifications').addEventListener('click', async () => {
    try {
      const data = await window.SKYECOM.api('/api/notifications/dispatch', { method: 'POST', body: JSON.stringify({ limit: 25 }) });
      window.SKYECOM.status('merchant-publish-status', `Dispatched ${data.dispatched?.sent ?? data.dispatched} queued notifications.`, 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  document.getElementById('location-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const payload = collectForm(event.target);
      const id = payload.id;
      delete payload.id;
      await window.SKYECOM.api(id ? `/api/inventory/locations/${id}` : '/api/inventory/locations', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', `Inventory location ${id ? 'updated' : 'created'}.`, 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  document.getElementById('inventory-adjustment-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/inventory/adjustments', { method: 'POST', body: JSON.stringify(collectForm(event.target)) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', 'Inventory adjustment applied.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  document.getElementById('discount-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/discount-codes', { method: 'POST', body: JSON.stringify(collectForm(event.target)) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', 'Discount code created.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  document.getElementById('collection-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const payload = collectForm(event.target);
      const id = payload.id;
      delete payload.id;
      await window.SKYECOM.api(id ? `/api/collections/${id}` : '/api/collections', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', `Collection ${id ? 'updated' : 'created'}.`, 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  document.getElementById('page-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const payload = collectForm(event.target);
      const id = payload.id;
      delete payload.id;
      await window.SKYECOM.api(id ? `/api/pages/${id}` : '/api/pages', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', `Page ${id ? 'updated' : 'created'}.`, 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  document.getElementById('navigation-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const payload = collectForm(event.target);
      const id = payload.id;
      delete payload.id;
      await window.SKYECOM.api(id ? `/api/navigation/${id}` : '/api/navigation', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', `Navigation link ${id ? 'updated' : 'created'}.`, 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  document.getElementById('csv-import-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = await window.SKYECOM.api('/api/import/shopify/csv', { method: 'POST', body: JSON.stringify(collectForm(event.target)) });
      window.SKYECOM.status('import-status', `CSV import complete. ${data.imported} products applied.`, 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('import-status', error.message, 'bad');
    }
  });

  document.getElementById('scan-import-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = await window.SKYECOM.api('/api/import/scan-url', { method: 'POST', body: JSON.stringify(collectForm(event.target)) });
      window.SKYECOM.status('import-status', `URL scan complete. ${data.imported} products applied.`, 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('import-status', error.message, 'bad');
    }
  });

  document.getElementById('shopify-import-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = await window.SKYECOM.api('/api/import/shopify/graphql', { method: 'POST', body: JSON.stringify(collectForm(event.target)) });
      window.SKYECOM.status('import-status', `Shopify GraphQL import complete. ${data.imported} products applied.`, 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('import-status', error.message, 'bad');
    }
  });

  document.getElementById('order-update-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    if (!payload.orderId) return window.SKYECOM.status('merchant-publish-status', 'Load an order before updating it.', 'warn');
    try {
      await window.SKYECOM.api(`/api/orders/${payload.orderId}`, { method: 'PUT', body: JSON.stringify(payload) });
      window.SKYECOM.status('merchant-publish-status', 'Order lifecycle updated.', 'good');
      await refreshMerchantState();
      await loadOrderDetail(payload.orderId);
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  document.getElementById('fulfillment-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    if (!payload.orderId) return window.SKYECOM.status('merchant-publish-status', 'Load an order before creating fulfillment.', 'warn');
    try {
      await window.SKYECOM.api(`/api/orders/${payload.orderId}/fulfillments`, { method: 'POST', body: JSON.stringify(payload) });
      window.SKYECOM.status('merchant-publish-status', 'Fulfillment created and order marked fulfilled.', 'good');
      await refreshMerchantState();
      await loadOrderDetail(payload.orderId);
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  document.getElementById('payment-session-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    if (!payload.orderId) return window.SKYECOM.status('payment-session-status', 'Load an order before creating a payment session.', 'warn');
    try {
      const data = await window.SKYECOM.api(`/api/orders/${payload.orderId}/payments/session`, { method: 'POST', body: JSON.stringify(payload) });
      window.SKYECOM.status('payment-session-status', `Payment session created. <a href="${data.session.checkoutUrl}" target="_blank" rel="noreferrer">Open checkout</a>`, 'good');
      await refreshMerchantState();
      await loadOrderDetail(payload.orderId);
    } catch (error) {
      window.SKYECOM.status('payment-session-status', error.message, 'bad');
    }
  });

  document.getElementById('return-update-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    if (!payload.returnId) return window.SKYECOM.status('merchant-publish-status', 'Load a return before updating it.', 'warn');
    try {
      await window.SKYECOM.api(`/api/returns/${payload.returnId}`, { method: 'PUT', body: JSON.stringify(payload) });
      window.SKYECOM.status('merchant-publish-status', 'Return updated.', 'good');
      await refreshMerchantState();
      await loadReturnDetail(payload.returnId);
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });



  const productMediaIngestForm = document.getElementById('product-media-ingest-form');
  if (productMediaIngestForm) productMediaIngestForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    if (!payload.productId) return window.SKYECOM.status('product-media-status', 'Product ID is required.', 'warn');
    try {
      const data = await window.SKYECOM.api(`/api/products/${payload.productId}/media/ingest-url`, { method: 'POST', body: JSON.stringify({ sourceUrl: payload.sourceUrl }) });
      window.SKYECOM.status('product-media-status', `Visual ingestion complete. ${data.media?.length || 0} media records now attached.`, 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('product-media-status', error.message, 'bad');
    }
  });

  const fulfillmentSyncForm = document.getElementById('fulfillment-sync-form');
  if (fulfillmentSyncForm) fulfillmentSyncForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    if (!payload.orderId) return window.SKYECOM.status('fulfillment-sync-status', 'Order ID is required.', 'warn');
    try {
      const data = await window.SKYECOM.api(`/api/orders/${payload.orderId}/fulfillment-sync`, { method: 'POST', body: JSON.stringify(payload) });
      window.SKYECOM.status('fulfillment-sync-status', `Fulfillment sync ${data.job?.status || 'submitted'}.`, data.ok ? 'good' : 'warn');
      await refreshMerchantState();
      await loadOrderDetail(payload.orderId);
    } catch (error) {
      window.SKYECOM.status('fulfillment-sync-status', error.message, 'bad');
    }
  });

  const routexHandoffForm = document.getElementById('routex-handoff-form');
  if (routexHandoffForm) routexHandoffForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    if (!payload.orderId) return window.SKYECOM.status('routex-handoff-status', 'Order ID is required.', 'warn');
    try {
      const data = await window.SKYECOM.api(`/api/orders/${payload.orderId}/routex/dispatch`, { method: 'POST', body: JSON.stringify(payload) });
      window.SKYECOM.status('routex-handoff-status', `Routex handoff ${data.handoff?.status || 'submitted'}.`, data.ok ? 'good' : 'warn');
      await refreshMerchantState();
      await loadOrderDetail(payload.orderId);
    } catch (error) {
      window.SKYECOM.status('routex-handoff-status', error.message, 'bad');
    }
  });

  const warehouseWorkOrderForm = document.getElementById('warehouse-work-order-form');
  if (warehouseWorkOrderForm) warehouseWorkOrderForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    if (!payload.orderId) return window.SKYECOM.status('warehouse-work-order-status', 'Order ID is required.', 'warn');
    payload.requireCarrierLabel = payload.requireCarrierLabel !== 'false';
    if (!payload.dueAt) delete payload.dueAt;
    try {
      const data = await window.SKYECOM.api(`/api/orders/${payload.orderId}/warehouse-work-order`, { method: 'POST', body: JSON.stringify(payload) });
      window.SKYECOM.status('warehouse-work-order-status', `Warehouse work order ${data.workOrder?.status || 'submitted'}.`, data.ok ? 'good' : 'warn');
      await refreshMerchantState();
      await loadOrderDetail(payload.orderId);
    } catch (error) {
      window.SKYECOM.status('warehouse-work-order-status', error.message, 'bad');
    }
  });

  const warehouseBinForm = document.getElementById('warehouse-bin-form');
  if (warehouseBinForm) warehouseBinForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/warehouse/bins', { method: 'POST', body: JSON.stringify(collectForm(event.target)) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', 'Warehouse bin created.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const pickScanForm = document.getElementById('pick-scan-form');
  if (pickScanForm) pickScanForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    if (!payload.pickListId) return window.SKYECOM.status('merchant-publish-status', 'Pick list ID is required.', 'warn');
    const pickListId = payload.pickListId;
    delete payload.pickListId;
    payload.packed = payload.packed === 'true';
    try {
      await window.SKYECOM.api(`/api/warehouse/pick-lists/${pickListId}/scan`, { method: 'POST', body: JSON.stringify(payload) });
      window.SKYECOM.status('merchant-publish-status', 'Pick scan recorded.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const completePickList = document.getElementById('complete-pick-list');
  if (completePickList) completePickList.addEventListener('click', async () => {
    const form = document.getElementById('pick-scan-form');
    const pickListId = form?.querySelector('[name="pickListId"]')?.value || '';
    if (!pickListId) return window.SKYECOM.status('merchant-publish-status', 'Pick list ID is required.', 'warn');
    try {
      await window.SKYECOM.api(`/api/warehouse/pick-lists/${pickListId}/complete`, { method: 'POST' });
      window.SKYECOM.status('merchant-publish-status', 'Pick list completed.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const routexDriverForm = document.getElementById('routex-driver-form');
  if (routexDriverForm) routexDriverForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/routex/drivers', { method: 'POST', body: JSON.stringify(collectForm(event.target)) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', 'Routex driver created.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const routexVehicleForm = document.getElementById('routex-vehicle-form');
  if (routexVehicleForm) routexVehicleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/routex/vehicles', { method: 'POST', body: JSON.stringify(collectForm(event.target)) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', 'Routex vehicle created.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const routePlanForm = document.getElementById('route-plan-form');
  if (routePlanForm) routePlanForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    try {
      payload.stops = JSON.parse(payload.stops || '[]');
      await window.SKYECOM.api('/api/routex/plans', { method: 'POST', body: JSON.stringify(payload) });
      window.SKYECOM.status('merchant-publish-status', 'Routex plan created.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const routeStopEventForm = document.getElementById('route-stop-event-form');
  if (routeStopEventForm) routeStopEventForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    if (!payload.planId || !payload.stopId) return window.SKYECOM.status('route-stop-event-status', 'Plan ID and Stop ID are required.', 'warn');
    const planId = payload.planId;
    const stopId = payload.stopId;
    delete payload.planId;
    delete payload.stopId;
    try {
      await window.SKYECOM.api(`/api/routex/plans/${planId}/stops/${stopId}/event`, { method: 'POST', body: JSON.stringify(payload) });
      window.SKYECOM.status('route-stop-event-status', 'Route stop event recorded.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('route-stop-event-status', error.message, 'bad');
    }
  });

  const appDeveloperUpdateForm = document.getElementById('app-developer-update-form');
  if (appDeveloperUpdateForm) appDeveloperUpdateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    if (!payload.developerId) return window.SKYECOM.status('app-developer-update-status', 'Developer ID is required.', 'warn');
    const developerId = payload.developerId;
    delete payload.developerId;
    try {
      await window.SKYECOM.api(`/api/app-developers/${developerId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      window.SKYECOM.status('app-developer-update-status', 'Developer account updated.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('app-developer-update-status', error.message, 'bad');
    }
  });

  const appDeveloperForm = document.getElementById('app-developer-form');
  if (appDeveloperForm) appDeveloperForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/app-developers', { method: 'POST', body: JSON.stringify(collectForm(event.target)) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', 'Developer account created.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const appReviewUpdateForm = document.getElementById('app-review-update-form');
  if (appReviewUpdateForm) appReviewUpdateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    if (!payload.reviewId) return window.SKYECOM.status('merchant-publish-status', 'Review ID is required.', 'warn');
    const reviewId = payload.reviewId;
    delete payload.reviewId;
    try {
      await window.SKYECOM.api(`/api/app-reviews/${reviewId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      window.SKYECOM.status('merchant-publish-status', 'App review updated.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const appSettlementUpdateForm = document.getElementById('app-settlement-update-form');
  if (appSettlementUpdateForm) appSettlementUpdateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    if (!payload.settlementId) return window.SKYECOM.status('merchant-publish-status', 'Settlement ID is required.', 'warn');
    const settlementId = payload.settlementId;
    delete payload.settlementId;
    try {
      await window.SKYECOM.api(`/api/app-settlements/${settlementId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      window.SKYECOM.status('merchant-publish-status', 'Settlement updated.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const variantForm = document.getElementById('variant-form');
  if (variantForm) variantForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    if (!payload.productId) return window.SKYECOM.status('merchant-publish-status', 'Product ID is required for a variant.', 'warn');
    const productId = payload.productId;
    delete payload.productId;
    try {
      await window.SKYECOM.api(`/api/products/${productId}/variants`, { method: 'POST', body: JSON.stringify(payload) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', 'Variant created.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const giftCardForm = document.getElementById('gift-card-form');
  if (giftCardForm) giftCardForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/gift-cards', { method: 'POST', body: JSON.stringify(collectForm(event.target)) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', 'Gift card issued.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const webhookForm = document.getElementById('webhook-form');
  if (webhookForm) webhookForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    payload.events = String(payload.events || '').split(',').map((item) => item.trim()).filter(Boolean);
    try {
      await window.SKYECOM.api('/api/webhooks/endpoints', { method: 'POST', body: JSON.stringify(payload) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', 'Webhook endpoint created.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const testWebhook = document.getElementById('test-webhook');
  if (testWebhook) testWebhook.addEventListener('click', async () => {
    try {
      const data = await window.SKYECOM.api('/api/webhooks/test', { method: 'POST', body: JSON.stringify({ eventType: 'system.test' }) });
      window.SKYECOM.status('merchant-publish-status', `Webhook test queued: ${data.queued}`, 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const dispatchWebhooks = document.getElementById('dispatch-webhooks');
  if (dispatchWebhooks) dispatchWebhooks.addEventListener('click', async () => {
    try {
      const data = await window.SKYECOM.api('/api/webhooks/dispatch', { method: 'POST' });
      window.SKYECOM.status('merchant-publish-status', `Webhook dispatch attempted ${data.result.attempted}; delivered ${data.result.delivered}.`, data.ok ? 'good' : 'warn');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });


  const workflowForm = document.getElementById('workflow-form');
  if (workflowForm) workflowForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    try {
      payload.conditions = JSON.parse(payload.conditions || '[]');
      payload.actions = JSON.parse(payload.actions || '[]');
      await window.SKYECOM.api('/api/workflows/rules', { method: 'POST', body: JSON.stringify(payload) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', 'Workflow rule created.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const runWorkflowSmoke = document.getElementById('run-workflow-smoke');
  if (runWorkflowSmoke) runWorkflowSmoke.addEventListener('click', async () => {
    try {
      const data = await window.SKYECOM.api('/api/workflows/run', { method: 'POST', body: JSON.stringify({ eventType: 'order.created', payload: { order: { id: 'manual-check', orderNumber: 'MANUAL-CHECK', totalCents: 125000, customerEmail: currentMerchant?.email || '' } } }) });
      window.SKYECOM.status('merchant-publish-status', `Workflow check ran. Matched ${data.result.matchedCount}.`, data.result.matchedCount ? 'good' : 'warn');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const loyaltyProgramForm = document.getElementById('loyalty-program-form');
  if (loyaltyProgramForm) loyaltyProgramForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/loyalty/programs', { method: 'POST', body: JSON.stringify(collectForm(event.target)) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', 'Rewards program created.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const loyaltyLedgerForm = document.getElementById('loyalty-ledger-form');
  if (loyaltyLedgerForm) loyaltyLedgerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/loyalty/ledger', { method: 'POST', body: JSON.stringify(collectForm(event.target)) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', 'Rewards ledger updated.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const reviewForm = document.getElementById('review-form');
  if (reviewForm) reviewForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/product-reviews', { method: 'POST', body: JSON.stringify(collectForm(event.target)) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', 'Product review created.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });

  const inventoryTransferForm = document.getElementById('inventory-transfer-form');
  if (inventoryTransferForm) inventoryTransferForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = collectForm(event.target);
    try {
      payload.items = JSON.parse(payload.items || '[]');
      await window.SKYECOM.api('/api/inventory-transfers', { method: 'POST', body: JSON.stringify(payload) });
      event.target.reset();
      window.SKYECOM.status('merchant-publish-status', 'Inventory transfer created.', 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('merchant-publish-status', error.message, 'bad');
    }
  });



  const refreshProductionReadiness = document.getElementById('refresh-production-readiness');
  if (refreshProductionReadiness) refreshProductionReadiness.addEventListener('click', async () => {
    try {
      const data = await window.SKYECOM.api('/api/system/production-readiness');
      renderProductionReadiness(data);
      window.SKYECOM.status('production-readiness-status', data.ok ? 'Production readiness passed.' : 'Production readiness blocked.', data.ok ? 'good' : 'bad');
    } catch (error) {
      window.SKYECOM.status('production-readiness-status', error.message, 'bad');
    }
  });

  const runSystemQueues = document.getElementById('run-system-queues');
  if (runSystemQueues) runSystemQueues.addEventListener('click', async () => {
    const limitInput = document.getElementById('queue-run-limit');
    const limit = Number(limitInput?.value || 25);
    try {
      const data = await window.SKYECOM.api('/api/system/queues/run', { method: 'POST', body: JSON.stringify({ limit }) });
      const processedNotifications = data?.result?.notifications?.processed ?? 0;
      const processedWebhooks = data?.result?.webhooks?.processed ?? 0;
      window.SKYECOM.status('queue-run-status', `Queue worker finished. Notifications: ${processedNotifications}. Webhooks: ${processedWebhooks}.`, 'good');
      await refreshMerchantState();
    } catch (error) {
      window.SKYECOM.status('queue-run-status', error.message, 'bad');
    }
  });


  await refreshMerchantState().catch(() => null);
});
