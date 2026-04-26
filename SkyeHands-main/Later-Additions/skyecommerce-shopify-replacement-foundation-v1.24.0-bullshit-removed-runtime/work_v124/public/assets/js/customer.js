let sessionCustomer = null;

function currentSlug() {
  return new URLSearchParams(location.search).get('slug') || document.getElementById('customer-store-slug')?.value || '';
}

function collect(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  data.slug = currentSlug();
  return data;
}

function fillProfile(customer = {}) {
  const form = document.getElementById('customer-profile-form');
  if (!form) return;
  const address = customer.defaultAddress || {};
  for (const [key, value] of Object.entries({
    firstName: customer.firstName || '',
    lastName: customer.lastName || '',
    phone: customer.phone || '',
    marketingOptIn: String(Boolean(customer.marketingOptIn)),
    countryCode: address.countryCode || 'US',
    stateCode: address.stateCode || '',
    address1: address.address1 || '',
    address2: address.address2 || '',
    city: address.city || '',
    postalCode: address.postalCode || ''
  })) {
    const field = form.elements.namedItem(key);
    if (field) field.value = value;
  }
}

function renderSession(customer) {
  const box = document.getElementById('customer-session-box');
  if (!customer) {
    box.innerHTML = '<p class="small">No customer signed in for this store yet.</p>';
    return;
  }
  box.innerHTML = `
    <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml([customer.firstName, customer.lastName].filter(Boolean).join(' ') || customer.email)}</strong><div class="small">${window.SKYECOM.escapeHtml(customer.email)}</div></div><span>${window.SKYECOM.escapeHtml(customer.merchantSlug || currentSlug())}</span></div>
  `;
}

function renderSavedCarts(carts = []) {
  const root = document.getElementById('saved-cart-list');
  root.innerHTML = carts.map((cart) => `
    <div class="timeline-item">
      <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(cart.note || 'Saved cart')}</strong><div class="small">${window.SKYECOM.escapeHtml(cart.updatedAt)}</div></div><span>${(cart.cart.items || []).length} items</span></div>
      <div class="button-row"><a class="ghost-button" href="../store/index.html?slug=${encodeURIComponent(currentSlug())}&cart=${encodeURIComponent(cart.id)}">Open in store</a><button class="ghost-button" data-delete-cart="${cart.id}" type="button">Delete</button></div>
    </div>
  `).join('') || '<p class="small">No saved carts yet. Save one from the storefront.</p>';
  root.querySelectorAll('[data-delete-cart]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await window.SKYECOM.api(`/api/customers/carts/${encodeURIComponent(button.getAttribute('data-delete-cart'))}?slug=${encodeURIComponent(currentSlug())}`, { method: 'DELETE' });
        await refresh();
      } catch (error) {
        window.SKYECOM.status('customer-auth-status', error.message, 'bad');
      }
    });
  });
}

function renderOrders(orders = []) {
  const root = document.getElementById('customer-order-list');
  root.innerHTML = orders.map((order) => `
    <div class="list-item">
      <div><strong>${window.SKYECOM.escapeHtml(order.orderNumber)}</strong><div class="small">${window.SKYECOM.escapeHtml(order.status)} · ${window.SKYECOM.escapeHtml(order.paymentStatus)} · ${window.SKYECOM.escapeHtml(order.createdAt)}</div></div>
      <div class="button-row"><strong>${window.SKYECOM.money(order.totalCents, order.currency)}</strong><button class="ghost-button" type="button" data-open-order="${order.id}">Open</button></div>
    </div>
  `).join('') || '<p class="small">No orders tied to this customer yet.</p>';
  root.querySelectorAll('[data-open-order]').forEach((button) => button.addEventListener('click', () => openOrder(button.getAttribute('data-open-order'))));
}

async function submitReturnRequest(orderId, form) {
  const data = new FormData(form);
  const lines = [];
  form.querySelectorAll('[data-return-line]').forEach((row) => {
    const productId = row.getAttribute('data-product-id');
    const title = row.getAttribute('data-title') || '';
    const quantity = Number(row.querySelector('input')?.value || 0);
    if (productId && quantity > 0) lines.push({ productId, title, quantity });
  });
  await window.SKYECOM.api(`/api/customers/orders/${encodeURIComponent(orderId)}/returns?slug=${encodeURIComponent(currentSlug())}`, {
    method: 'POST',
    body: JSON.stringify({
      reason: data.get('reason') || '',
      customerNote: data.get('customerNote') || '',
      resolutionType: data.get('resolutionType') || 'refund',
      restockItems: data.get('restockItems') || 'true',
      items: lines
    })
  });
}

async function openOrder(id) {
  const data = await window.SKYECOM.api(`/api/customers/orders/${encodeURIComponent(id)}?slug=${encodeURIComponent(currentSlug())}`);
  const order = data.order;
  document.getElementById('customer-order-detail').innerHTML = `
    <div class="panel compact-card">
      <div class="eyebrow">${window.SKYECOM.escapeHtml(order.orderNumber)}</div>
      <div class="list-item"><span>Status</span><strong>${window.SKYECOM.escapeHtml(order.status)}</strong></div>
      <div class="list-item"><span>Payment</span><strong>${window.SKYECOM.escapeHtml(order.paymentStatus)}</strong></div>
      <div class="list-item"><span>Total</span><strong>${window.SKYECOM.money(order.totalCents, order.currency)}</strong></div>
      <div class="eyebrow" style="margin-top:12px">Timeline</div>
      ${(order.events || []).map((event) => `<div class="timeline-item"><strong>${window.SKYECOM.escapeHtml(event.summary)}</strong><div class="small">${window.SKYECOM.escapeHtml(event.detail || '')}</div></div>`).join('') || '<p class="small">No timeline events.</p>'}
    </div>
    <div class="panel compact-card">
      <div class="eyebrow">Returns</div>
      ${(order.returns || []).map((item) => `<div class="timeline-item"><strong>${window.SKYECOM.escapeHtml(item.status)}</strong><div class="small">${window.SKYECOM.escapeHtml(item.reason || '')} · ${window.SKYECOM.money(item.requestedCents || 0, order.currency)}</div><div class="small">${window.SKYECOM.escapeHtml(item.customerNote || item.merchantNote || '')}</div></div>`).join('') || '<p class="small">No return requests yet.</p>'}
    </div>
    <form id="customer-return-form" class="panel compact-card">
      <div class="eyebrow">Request a return</div>
      <label>Reason<input name="reason" placeholder="Damaged / wrong item / no longer needed"></label>
      <label>Resolution<select name="resolutionType"><option value="refund">refund</option><option value="exchange">exchange</option><option value="store_credit">store_credit</option></select></label>
      <label>Restock items<select name="restockItems"><option value="true">true</option><option value="false">false</option></select></label>
      <label>Customer note<textarea name="customerNote"></textarea></label>
      <div class="eyebrow">Lines</div>
      ${(order.items || []).map((item) => `<div class="list-item" data-return-line data-product-id="${window.SKYECOM.escapeHtml(item.productId)}" data-title="${window.SKYECOM.escapeHtml(item.title)}"><span>${window.SKYECOM.escapeHtml(item.title)} · purchased ${item.quantity}</span><input type="number" min="0" max="${item.quantity}" value="0" style="max-width:90px"></div>`).join('') || '<p class="small">No order items.</p>'}
      <div class="button-row"><button type="submit">Submit return request</button></div>
    </form>
  `;
  document.getElementById('customer-return-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await submitReturnRequest(order.id, event.target);
      window.SKYECOM.status('customer-auth-status', 'Return request submitted.', 'good');
      await openOrder(order.id);
      await refresh();
    } catch (error) {
      window.SKYECOM.status('customer-auth-status', error.message, 'bad');
    }
  });
}

async function refresh() {
  const slug = currentSlug();
  document.getElementById('open-store-link').href = `../store/index.html?slug=${encodeURIComponent(slug)}`;
  const session = await window.SKYECOM.api(`/api/customers/me?slug=${encodeURIComponent(slug)}`).catch(() => ({ ok: false }));
  sessionCustomer = session.ok ? session.customer : null;
  renderSession(sessionCustomer);
  fillProfile(sessionCustomer || {});
  if (!sessionCustomer) {
    renderSavedCarts([]);
    renderOrders([]);
    document.getElementById('customer-order-detail').innerHTML = '';
    return;
  }
  const [orders, carts] = await Promise.all([
    window.SKYECOM.api(`/api/customers/orders?slug=${encodeURIComponent(slug)}`),
    window.SKYECOM.api(`/api/customers/carts?slug=${encodeURIComponent(slug)}`)
  ]);
  renderOrders(orders.orders || []);
  renderSavedCarts(carts.carts || []);
}

document.addEventListener('DOMContentLoaded', async () => {
  const slugField = document.getElementById('customer-store-slug');
  slugField.value = currentSlug();
  slugField.addEventListener('input', () => {
    const slug = currentSlug();
    history.replaceState({}, '', `?slug=${encodeURIComponent(slug)}`);
    refresh();
  });

  document.getElementById('customer-register-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/customers/register', { method: 'POST', body: JSON.stringify(collect(event.target)) });
      window.SKYECOM.status('customer-auth-status', 'Customer account created.', 'good');
      event.target.reset();
      await refresh();
    } catch (error) {
      window.SKYECOM.status('customer-auth-status', error.message, 'bad');
    }
  });

  document.getElementById('customer-login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/customers/login', { method: 'POST', body: JSON.stringify(collect(event.target)) });
      window.SKYECOM.status('customer-auth-status', 'Customer signed in.', 'good');
      event.target.reset();
      await refresh();
    } catch (error) {
      window.SKYECOM.status('customer-auth-status', error.message, 'bad');
    }
  });

  document.getElementById('customer-profile-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const payload = collect(event.target);
      payload.defaultAddress = {
        countryCode: payload.countryCode,
        stateCode: payload.stateCode,
        address1: payload.address1,
        address2: payload.address2,
        city: payload.city,
        postalCode: payload.postalCode
      };
      await window.SKYECOM.api(`/api/customers/profile?slug=${encodeURIComponent(currentSlug())}`, { method: 'PUT', body: JSON.stringify(payload) });
      window.SKYECOM.status('customer-auth-status', 'Profile saved.', 'good');
      await refresh();
    } catch (error) {
      window.SKYECOM.status('customer-auth-status', error.message, 'bad');
    }
  });

  document.getElementById('customer-logout').addEventListener('click', async () => {
    await window.SKYECOM.api('/api/customers/logout', { method: 'POST' });
    await refresh();
  });

  await refresh();
});
