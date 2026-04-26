let snapshot = null;
let cart = new Map();
let customerSession = null;
let activeView = { type: 'home', target: '' };

function currentSlug() {
  const qs = new URLSearchParams(location.search).get('slug');
  if (qs) return qs;
  const match = location.pathname.match(/\/s\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

function currentSavedCartId() {
  return new URLSearchParams(location.search).get('cart') || '';
}

function currentCheckoutState() {
  const params = new URLSearchParams(location.search);
  return {
    status: params.get('checkout_status') || '',
    orderId: params.get('order') || '',
    access: params.get('access') || ''
  };
}

let checkoutActionState = null;

function checkoutActionButtons(actions = {}, payment = {}) {
  const buttons = [];
  if (actions.canRetry && actions.retryUrl) buttons.push(`<button type="button" id="retry-checkout-button" class="ghost-button">Retry ${window.SKYECOM.escapeHtml(payment.provider || 'checkout')}</button>`);
  if (actions.canCancel && actions.cancelUrl) buttons.push('<button type="button" id="cancel-checkout-button" class="ghost-button">Cancel order hold</button>');
  return buttons.length ? `<div class="button-row" style="margin-top:12px">${buttons.join('')}</div>` : '';
}

async function runCheckoutAction(kind = '') {
  if (!checkoutActionState) throw new Error('No public checkout action is available right now.');
  const actionUrl = kind === 'retry' ? checkoutActionState.actions?.retryUrl : checkoutActionState.actions?.cancelUrl;
  if (!actionUrl) throw new Error(`No ${kind} action is available for this order.`);
  const body = kind === 'retry' ? { provider: checkoutActionState.payment?.provider || '' } : {};
  const data = await window.SKYECOM.api(actionUrl, { method: 'POST', body: JSON.stringify(body) });
  if (kind === 'retry' && data.paymentSession?.checkoutUrl) {
    window.SKYECOM.status('store-status', `Retry session created for ${window.SKYECOM.escapeHtml(data.orderNumber || checkoutActionState.order?.orderNumber || '')}. Redirecting to ${window.SKYECOM.escapeHtml(data.paymentSession.provider || checkoutActionState.payment?.provider || 'provider')} checkout.`, 'good');
    window.location.href = data.paymentSession.checkoutUrl;
    return;
  }
  if (kind === 'cancel') {
    const orderNumber = data.order?.orderNumber || checkoutActionState?.order?.orderNumber || '';
    checkoutActionState = null;
    window.SKYECOM.status('store-status', `Order ${window.SKYECOM.escapeHtml(orderNumber)} canceled and inventory hold released.`, 'warn');
  }
}

function currentViewFromUrl() {
  const params = new URLSearchParams(location.search);
  if (params.get('product')) return { type: 'product', target: params.get('product') };
  if (params.get('page')) return { type: 'page', target: params.get('page') };
  if (params.get('collection')) return { type: 'collection', target: params.get('collection') };
  const productPath = location.pathname.match(/\/products\/([^/]+)\/?$/);
  if (productPath) return { type: 'product', target: decodeURIComponent(productPath[1]) };
  return { type: 'home', target: '' };
}

function persistView() {
  const params = new URLSearchParams(location.search);
  params.delete('page');
  params.delete('collection');
  params.delete('product');
  if (activeView.type === 'page' && activeView.target) params.set('page', activeView.target);
  if (activeView.type === 'collection' && activeView.target) params.set('collection', activeView.target);
  if (activeView.type === 'product' && activeView.target) params.set('product', activeView.target);
  history.replaceState({}, '', `${location.pathname}?${params.toString()}`);
}

function collectionBySlug(slug = '') {
  return (snapshot?.collections || []).find((item) => item.slug === slug) || null;
}

function pageBySlug(slug = '') {
  return (snapshot?.pages || []).find((item) => item.slug === slug) || null;
}

function productByRef(ref = '') {
  return (snapshot?.products || []).find((item) => item.slug === ref || item.id === ref) || null;
}

function productDetailUrl(product) {
  const slug = snapshot?.merchant?.slug || currentSlug();
  return `/s/${encodeURIComponent(slug)}/products/${encodeURIComponent(product.slug || product.id)}`;
}

function visibleProducts() {
  if (!snapshot) return [];
  const all = [...(snapshot.products || [])];
  if (activeView.type !== 'collection' || !activeView.target) return all;
  const collection = collectionBySlug(activeView.target);
  if (!collection) return all;
  const ids = new Set(collection.productIds || []);
  let filtered = all.filter((item) => ids.has(item.id));
  switch (collection.sortMode) {
    case 'alpha_asc': filtered.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'alpha_desc': filtered.sort((a, b) => b.title.localeCompare(a.title)); break;
    case 'price_asc': filtered.sort((a, b) => a.priceCents - b.priceCents); break;
    case 'price_desc': filtered.sort((a, b) => b.priceCents - a.priceCents); break;
    case 'newest': filtered = [...filtered].reverse(); break;
    default: break;
  }
  return filtered;
}

async function refreshQuote() {
  if (!snapshot) return;
  const payload = {
    slug: snapshot.merchant.slug,
    items: [...cart.values()].map((line) => ({ productId: line.productId, quantity: line.quantity })),
    location: {
      countryCode: document.querySelector('[name="countryCode"]').value || 'US',
      stateCode: document.querySelector('[name="stateCode"]').value || ''
    },
    shippingCode: document.querySelector('[name="shippingCode"]').value || '',
    discountCode: document.querySelector('[name="discountCode"]').value || ''
  };
  const root = document.getElementById('quote-box');
  if (!payload.items.length) {
    root.innerHTML = '<p class="small">Add products to see quote totals.</p>';
    return;
  }
  try {
    const data = await window.SKYECOM.api('/api/orders/quote', { method: 'POST', body: JSON.stringify(payload) });
    const quote = data.quote;
    root.innerHTML = `
      <div class="list-item"><span>Subtotal</span><strong>${window.SKYECOM.money(quote.subtotalCents, snapshot.merchant.currency)}</strong></div>
      <div class="list-item"><span>Discount ${window.SKYECOM.escapeHtml(quote.discountCode || '')}</span><strong>-${window.SKYECOM.money(quote.discountCents, snapshot.merchant.currency)}</strong></div>
      <div class="list-item"><span>Shipping</span><strong>${window.SKYECOM.money(quote.shippingCents, snapshot.merchant.currency)}</strong></div>
      <div class="list-item"><span>Tax</span><strong>${window.SKYECOM.money(quote.taxCents, snapshot.merchant.currency)}</strong></div>
      <div class="list-item"><span>Total</span><strong>${window.SKYECOM.money(quote.totalCents, snapshot.merchant.currency)}</strong></div>
    `;
  } catch (error) {
    root.innerHTML = `<p class="small">${window.SKYECOM.escapeHtml(error.message)}</p>`;
  }
}

function renderCart() {
  const root = document.getElementById('cart-lines');
  const lines = [...cart.values()];
  root.innerHTML = lines.map((line) => `<div class="list-item"><div><strong>${window.SKYECOM.escapeHtml(line.title)}</strong><div class="small">qty ${line.quantity}</div></div><span>${window.SKYECOM.money(line.quantity * line.unitPriceCents, snapshot?.merchant?.currency || 'USD')}</span></div>`).join('') || '<p class="small">No products selected.</p>';
  refreshQuote();
}

function addToCart(product) {
  const existing = cart.get(product.id) || { productId: product.id, title: product.title, quantity: 0, unitPriceCents: product.priceCents };
  existing.quantity += 1;
  cart.set(product.id, existing);
  renderCart();
}

function renderCustomerAccount() {
  const root = document.getElementById('customer-account-box');
  const portalLink = document.getElementById('customer-portal-link');
  const slug = snapshot?.merchant?.slug || currentSlug();
  if (portalLink) portalLink.href = `../customer/index.html?slug=${encodeURIComponent(slug)}`;
  if (!customerSession) {
    root.innerHTML = '<p class="small">No customer signed in for this store. Use the customer portal to save carts and track orders.</p>';
    return;
  }
  root.innerHTML = `
    <div class="list-item"><div><strong>${window.SKYECOM.escapeHtml([customerSession.firstName, customerSession.lastName].filter(Boolean).join(' ') || customerSession.email)}</strong><div class="small">${window.SKYECOM.escapeHtml(customerSession.email)}</div></div><span>Signed in</span></div>
  `;
  const address = customerSession.defaultAddress || {};
  if (address.countryCode || address.stateCode) {
    document.querySelector('[name="countryCode"]').value = address.countryCode || 'US';
    document.querySelector('[name="stateCode"]').value = address.stateCode || '';
  }
  const nameField = document.querySelector('[name="customerName"]');
  const emailField = document.querySelector('[name="customerEmail"]');
  if (nameField && !nameField.value) nameField.value = [customerSession.firstName, customerSession.lastName].filter(Boolean).join(' ') || '';
  if (emailField && !emailField.value) emailField.value = customerSession.email || '';
}

async function hydrateCustomerSession() {
  const slug = currentSlug();
  if (!slug) return;
  const data = await window.SKYECOM.api(`/api/customers/me?slug=${encodeURIComponent(slug)}`).catch(() => ({ ok: false }));
  customerSession = data.ok ? data.customer : null;
  renderCustomerAccount();
}

async function renderCheckoutReturnState() {
  if (!snapshot) return;
  const state = currentCheckoutState();
  if (!state.status || !state.orderId || !state.access) return;
  const statusPath = `/api/store/${encodeURIComponent(snapshot.merchant.slug)}/orders/${encodeURIComponent(state.orderId)}/status?access=${encodeURIComponent(state.access)}`;
  const pollUntil = Date.now() + 20000;
  let attempt = 0;
  while (true) {
    attempt += 1;
    const data = await window.SKYECOM.api(statusPath);
    const paymentStatus = data.order?.paymentStatus || '';
    const providerStatus = data.payment?.status || '';
    checkoutActionState = data;
    if (state.status === 'cancel') {
      window.SKYECOM.status('store-status', `Checkout canceled for ${window.SKYECOM.escapeHtml(data.order?.orderNumber || data.order?.id || state.orderId)}. Payment status: ${window.SKYECOM.escapeHtml(paymentStatus || 'cancelled')}.${checkoutActionButtons(data.actions, data.payment)}`, 'warn');
      return;
    }
    if (['paid', 'authorized'].includes(paymentStatus) || ['paid', 'authorized'].includes(providerStatus)) {
      checkoutActionState = null;
      window.SKYECOM.status('store-status', `Payment confirmed for ${window.SKYECOM.escapeHtml(data.order?.orderNumber || state.orderId)}.`, 'good');
      cart = new Map();
      renderCart();
      return;
    }
    if (['failed', 'voided', 'refunded'].includes(paymentStatus) || ['failed', 'voided'].includes(providerStatus)) {
      window.SKYECOM.status('store-status', `Checkout did not complete for ${window.SKYECOM.escapeHtml(data.order?.orderNumber || state.orderId)}. Current payment status: ${window.SKYECOM.escapeHtml(paymentStatus || providerStatus)}.${checkoutActionButtons(data.actions, data.payment)}`, 'bad');
      return;
    }
    if (Date.now() >= pollUntil || attempt >= 8) {
      window.SKYECOM.status('store-status', `Order ${window.SKYECOM.escapeHtml(data.order?.orderNumber || state.orderId)} is still awaiting provider confirmation. Current payment status: ${window.SKYECOM.escapeHtml(paymentStatus || providerStatus || 'pending_provider')}.${checkoutActionButtons(data.actions, data.payment)}`, 'warn');
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
}

async function restoreSavedCartIfPresent() {
  const cartId = currentSavedCartId();
  if (!cartId || !snapshot) return;
  try {
    const data = await window.SKYECOM.api(`/api/customers/carts/${encodeURIComponent(cartId)}?slug=${encodeURIComponent(snapshot.merchant.slug)}`);
    const saved = data.cart?.cart || {};
    cart = new Map();
    for (const entry of saved.items || []) {
      const product = snapshot.products.find((item) => item.id === entry.productId);
      if (!product) continue;
      cart.set(product.id, {
        productId: product.id,
        title: product.title,
        quantity: Math.max(1, Number(entry.quantity || 1) || 1),
        unitPriceCents: product.priceCents
      });
    }
    if (saved.location) {
      document.querySelector('[name="countryCode"]').value = saved.location.countryCode || 'US';
      document.querySelector('[name="stateCode"]').value = saved.location.stateCode || '';
    }
    if (saved.shippingCode) document.querySelector('[name="shippingCode"]').value = saved.shippingCode;
    if (saved.discountCode) document.querySelector('[name="discountCode"]').value = saved.discountCode;
    renderCart();
    window.SKYECOM.status('store-status', 'Saved cart restored into this storefront.', 'good');
  } catch (error) {
    window.SKYECOM.status('store-status', error.message, 'warn');
  }
}

function renderNavigation() {
  const root = document.getElementById('store-nav');
  const links = snapshot.navigation?.length ? snapshot.navigation : [
    { id: 'home', label: 'Home', type: 'home' },
    ...(snapshot.collections || []).map((item) => ({ id: `col-${item.id}`, label: item.title, type: 'collection', targetRef: item.slug })),
    ...(snapshot.pages || []).map((item) => ({ id: `page-${item.id}`, label: item.title, type: 'page', targetRef: item.slug }))
  ];
  root.innerHTML = links.map((item) => {
    if (item.type === 'external') return `<a class="ghost-button" href="${window.SKYECOM.escapeHtml(item.href)}" target="_blank" rel="noreferrer">${window.SKYECOM.escapeHtml(item.label)}</a>`;
    const active = (activeView.type === 'home' && item.type === 'home') || (activeView.type === item.type && activeView.target === item.targetRef);
    return `<button class="${active ? 'button' : 'ghost-button'}" type="button" data-nav-type="${window.SKYECOM.escapeHtml(item.type)}" data-nav-target="${window.SKYECOM.escapeHtml(item.targetRef || '')}">${window.SKYECOM.escapeHtml(item.label)}</button>`;
  }).join('');
  root.querySelectorAll('[data-nav-type]').forEach((button) => {
    button.addEventListener('click', () => {
      activeView = { type: button.getAttribute('data-nav-type'), target: button.getAttribute('data-nav-target') || '' };
      persistView();
      renderStore();
      renderCart();
    });
  });
}

function renderContext() {
  const root = document.getElementById('store-context');
  if (!snapshot) return;
  if (activeView.type === 'product') {
    const product = productByRef(activeView.target);
    if (product) {
      root.innerHTML = `
        <div class="timeline-item">
          <strong>${window.SKYECOM.escapeHtml(product.title)}</strong>
          <div class="small">${window.SKYECOM.money(product.priceCents, snapshot.merchant.currency)} · ${product.available ? 'Available' : 'Out of stock'}</div>
          <div>${product.descriptionHtml || window.SKYECOM.escapeHtml(product.shortDescription || '')}</div>
          ${(product.variants || []).length ? `<div class="small">Variants: ${(product.variants || []).map((variant) => window.SKYECOM.escapeHtml(variant.title || variant.sku || variant.id)).join(' · ')}</div>` : ''}
          ${(product.media || []).length ? `<div class="media-strip">${product.media.slice(0, 6).map((item) => `<img src="${window.SKYECOM.escapeHtml(item.url)}" alt="${window.SKYECOM.escapeHtml(item.alt || product.title)}">`).join('')}</div>` : ''}
          <div class="button-row"><button class="button" type="button" data-detail-add="${window.SKYECOM.escapeHtml(product.id)}" ${product.available ? '' : 'disabled'}>Add to order</button><button class="ghost-button" type="button" data-back-home>Back to products</button></div>
        </div>`;
      root.querySelector('[data-detail-add]')?.addEventListener('click', () => addToCart(product));
      root.querySelector('[data-back-home]')?.addEventListener('click', () => { activeView = { type: 'home', target: '' }; persistView(); renderStore(); });
      return;
    }
  }
  if (activeView.type === 'page') {
    const page = pageBySlug(activeView.target);
    if (page) {
      root.innerHTML = `<div class="timeline-item"><strong>${window.SKYECOM.escapeHtml(page.title)}</strong><div class="small">Custom content page</div><div>${page.bodyHtml}</div></div>`;
      return;
    }
  }
  if (activeView.type === 'collection') {
    const collection = collectionBySlug(activeView.target);
    if (collection) {
      root.innerHTML = `<div class="timeline-item"><strong>${window.SKYECOM.escapeHtml(collection.title)}</strong><div class="small">${window.SKYECOM.escapeHtml(collection.description || '')}</div><div class="small">${collection.productCount} products in this collection</div></div>`;
      return;
    }
  }
  root.innerHTML = `
    <div class="timeline-item">
      <strong>${window.SKYECOM.escapeHtml(snapshot.merchant.brandName)}</strong>
      <div class="small">${window.SKYECOM.escapeHtml(snapshot.theme.checkoutNote || '')}</div>
      <div class="small">Collections: ${(snapshot.collections || []).length} · Pages: ${(snapshot.pages || []).length}</div>
    </div>
  `;
}

function renderStore() {
  if (!snapshot) return;
  document.getElementById('store-title').textContent = snapshot.theme.heroTitle;
  document.getElementById('store-tagline').textContent = snapshot.theme.heroTagline;
  document.getElementById('store-slug-input').value = snapshot.merchant.slug;
  const banner = document.getElementById('store-banner');
  banner.style.background = snapshot.theme.surface;
  banner.style.color = snapshot.theme.text;
  banner.style.borderColor = snapshot.theme.accent;
  const promoRoot = document.getElementById('store-promos');
  promoRoot.innerHTML = (snapshot.discountCodes || []).map((code) => `
    <div class="list-item">
      <div>
        <strong>${window.SKYECOM.escapeHtml(code.code)}</strong>
        <div class="small">${window.SKYECOM.escapeHtml(code.title || '')}</div>
      </div>
      <span>${code.type === 'fixed' ? window.SKYECOM.money(code.amountCents, snapshot.merchant.currency) : `${(code.amountBps / 100).toFixed(2)}% off`}</span>
    </div>
  `).join('') || '<p class="small">No live promo codes published.</p>';
  renderNavigation();
  renderContext();
  const products = visibleProducts();
  const grid = document.getElementById('store-grid');
  grid.innerHTML = products.map((product) => `
    <article class="panel product-card">
      <div class="media">${product.heroImageUrl ? `<img src="${window.SKYECOM.escapeHtml(product.heroImageUrl)}" alt="${window.SKYECOM.escapeHtml(product.title)}">` : 'No image'}</div>
      <div class="eyebrow">${window.SKYECOM.escapeHtml(product.sku || 'Product')}</div>
      <h3>${window.SKYECOM.escapeHtml(product.title)}</h3>
      <p class="muted">${window.SKYECOM.escapeHtml(product.shortDescription || '')}</p>
      <div class="list-item"><span>${window.SKYECOM.money(product.priceCents, snapshot.merchant.currency)}</span><span>${product.available ? 'Available' : 'Out of stock'}</span></div>
      <div class="button-row"><button class="button" data-add="${product.id}" ${product.available ? '' : 'disabled'}>Add to order</button><a class="ghost-button" data-detail="${product.slug || product.id}" href="${productDetailUrl(product)}">Details</a></div>
    </article>
  `).join('') || '<p class="small">No products published for this view yet.</p>';
  grid.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => {
    const product = snapshot.products.find((item) => item.id === button.getAttribute('data-add'));
    if (product) addToCart(product);
  }));
  grid.querySelectorAll('[data-detail]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    activeView = { type: 'product', target: link.getAttribute('data-detail') || '' };
    persistView();
    renderStore();
  }));
}

async function loadStore(slug) {
  if (!slug) return;
  const data = await window.SKYECOM.api(`/api/store/${encodeURIComponent(slug)}/bootstrap`);
  snapshot = data.snapshot;
  activeView = currentViewFromUrl();
  renderStore();
  await hydrateCustomerSession();
  await restoreSavedCartIfPresent();
  renderCart();
  await renderCheckoutReturnState();
}

document.addEventListener('DOMContentLoaded', async () => {
  document.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.id === 'retry-checkout-button') {
      event.preventDefault();
      try {
        await runCheckoutAction('retry');
      } catch (error) {
        window.SKYECOM.status('store-status', error.message, 'bad');
      }
    }
    if (target.id === 'cancel-checkout-button') {
      event.preventDefault();
      try {
        await runCheckoutAction('cancel');
      } catch (error) {
        window.SKYECOM.status('store-status', error.message, 'bad');
      }
    }
  });
  const slug = currentSlug();
  if (slug) loadStore(slug).catch((error) => window.SKYECOM.status('store-status', error.message, 'bad'));
  renderCart();
  ['countryCode', 'stateCode', 'shippingCode', 'discountCode'].forEach((name) => {
    document.querySelector(`[name="${name}"]`)?.addEventListener('input', () => refreshQuote());
  });
  document.getElementById('quote-refresh').addEventListener('click', async () => refreshQuote());
  document.getElementById('save-cart-button').addEventListener('click', async () => {
    try {
      if (!snapshot) throw new Error('Store is not loaded yet.');
      if (!customerSession) throw new Error('Sign in through the customer portal before saving a cart.');
      const items = [...cart.values()].map((line) => ({ productId: line.productId, quantity: line.quantity }));
      if (!items.length) throw new Error('Add products before saving a cart.');
      await window.SKYECOM.api(`/api/customers/carts?slug=${encodeURIComponent(snapshot.merchant.slug)}`, {
        method: 'POST',
        body: JSON.stringify({
          note: document.getElementById('save-cart-note').value || 'Saved storefront cart',
          items,
          location: {
            countryCode: document.querySelector('[name="countryCode"]').value || 'US',
            stateCode: document.querySelector('[name="stateCode"]').value || ''
          },
          shippingCode: document.querySelector('[name="shippingCode"]').value || '',
          discountCode: document.querySelector('[name="discountCode"]').value || ''
        })
      });
      window.SKYECOM.status('store-status', 'Cart saved to the customer portal.', 'good');
    } catch (error) {
      window.SKYECOM.status('store-status', error.message, 'warn');
    }
  });
  document.getElementById('store-order-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const fd = new FormData(event.target);
      const payload = Object.fromEntries(fd.entries());
      payload.slug = payload.slug || currentSlug();
      payload.items = [...cart.values()].map((line) => ({ productId: line.productId, quantity: line.quantity }));
      payload.location = { countryCode: payload.countryCode, stateCode: payload.stateCode };
      const data = await window.SKYECOM.api('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
      if (data.paymentSession?.checkoutUrl) {
        window.SKYECOM.status('store-status', `Order ${data.orderNumber} created. Redirecting to ${data.paymentSession.provider} checkout.`, 'good');
        window.location.href = data.paymentSession.checkoutUrl;
        return;
      }
      window.SKYECOM.status('store-status', `Order ${data.orderNumber} created. Payment status: ${data.paymentStatus}.`, 'good');
      cart = new Map();
      renderCart();
      await loadStore(payload.slug);
    } catch (error) {
      window.SKYECOM.status('store-status', error.message, 'bad');
    }
  });
});
