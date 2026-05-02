(() => {
  const config = window.PRINTFUL_EMBED_CONFIG || {};

  const state = {
    runtime: null,
    catalog: null,
    selectedProduct: null,
    selectedVariant: null,
    selectedMethod: 'print',
    selectedPlacement: null,
    quote: null,
    designMaker: null,
    externalProductId: null,
    templateId: null,
    designerLoaded: false,
    localLogoDataUrl: null,
    savedSessions: [],
    cart: [],
    lastPacket: null,
    lastCartPacket: null,
    productFilter: '',
  };

  function qs(selector) {
    return document.querySelector(selector);
  }

  function qsa(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function setText(selector, text) {
    const node = qs(selector);
    if (node) node.textContent = text;
  }

  function setHtml(selector, html) {
    const node = qs(selector);
    if (node) node.innerHTML = html;
  }

  function setStatus(text) {
    setText('#pf-status-text', text);
  }

  function setModeText(text) {
    setText('#pf-mode-text', text);
  }

  function setTemplateText(text) {
    setText('#pf-template-text', text);
  }

  function setSessionText(text) {
    setText('#pf-session-text', text);
  }

  function toggleDisabled(selector, disabled) {
    const node = qs(selector);
    if (node) node.disabled = disabled;
  }

  function show(selector, shouldShow) {
    const node = qs(selector);
    if (!node) return;
    node.hidden = !shouldShow;
    if (shouldShow) node.classList.remove('is-hidden');
    else node.classList.add('is-hidden');
  }

  function currency(value) {
    const code = state.catalog?.brand?.currency || 'USD';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(Number(value || 0));
    } catch {
      return `$${Number(value || 0).toFixed(2)}`;
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function makeSessionId() {
    const productKey = String(state.selectedProduct?.key || 'product').replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
    const rand = Math.random().toString(36).slice(2, 10);
    return `${productKey}-${Date.now()}-${rand}`;
  }

  function draftKey() {
    return 'printful-pod-draft-v5';
  }

  function storageKey() {
    return 'printful-pod-sessions-v5';
  }

  function cartStorageKey() {
    return 'printful-pod-cart-v1';
  }

  function adminInboxKey() {
    return 'printful-pod-admin-inbox-v1';
  }

  function adminLastArtifactKey() {
    return 'printful-pod-admin-last-artifact-v1';
  }

  async function getJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      ...options,
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Invalid JSON response from ${url}`);
    }

    if (!response.ok || !data.ok) {
      throw new Error(data.error || `Request failed for ${url}`);
    }
    return data;
  }

  async function postJson(url, payload) {
    return getJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
  }

  function applyBranding() {
    setText('#pf-brand-title', config.heroTitle || `Design with ${config.brandName || 'your brand'}`);
    setText('#pf-brand-copy', config.heroCopy || 'Upload your artwork, customize the product, and submit the order from this page.');
    setText('#pf-brand-pill', `${config.brandName || 'Your brand'} pricing control`);
  }

  async function bootRuntime() {
    const data = await getJson('/.netlify/functions/printful-runtime-status');
    state.runtime = data.runtime;
    state.catalog = data.catalog;

    setModeText(state.runtime.printfulReady ? 'Live designer available' : 'Intake mode');
    setText('#pf-runtime-help', state.runtime.printfulReady
      ? 'Printful is configured. You can launch the designer, save a template, generate mockups, and create a live order.'
      : 'Printful is not configured yet. Intake mode stays usable now and captures order requests into Netlify Forms while proof packets still export.'
    );

    const confirmNode = qs('#pf-confirm');
    if (confirmNode) confirmNode.checked = Boolean(config.submitDirectDefault || state.runtime.orderConfirmDefault);
  }

  function getProducts() {
    return Array.isArray(state.catalog?.products) ? state.catalog.products.filter((product) => product.enabled !== false) : [];
  }

  function filteredProducts() {
    const products = getProducts();
    const term = state.productFilter.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => {
      const haystack = [product.title, product.description, ...(product.methods || []), ...(product.placements || []).map((item) => item.label)]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  function getSelectedVariantByValue(raw) {
    if (!state.selectedProduct) return null;
    return (state.selectedProduct.variants || []).find((variant) => {
      return String(variant.key) === String(raw) || String(variant.variantId ?? '') === String(raw);
    }) || null;
  }

  function getSelectedPlacementByValue(raw) {
    if (!state.selectedProduct) return null;
    const placements = Array.isArray(state.selectedProduct.placements) && state.selectedProduct.placements.length
      ? state.selectedProduct.placements
      : (state.selectedProduct.previewPlacement ? [{ key: 'default', label: 'Default', ...state.selectedProduct.previewPlacement }] : []);
    return placements.find((placement) => String(placement.key) === String(raw)) || placements[0] || null;
  }

  function selectedPlacement() {
    if (!state.selectedPlacement) {
      state.selectedPlacement = getSelectedPlacementByValue('');
    }
    return state.selectedPlacement;
  }

  function getPreviewTransform() {
    return {
      top: Number(qs('#pf-logo-top')?.value || 0),
      left: Number(qs('#pf-logo-left')?.value || 0),
      width: Number(qs('#pf-logo-width')?.value || 0),
      rotate: Number(qs('#pf-logo-rotate')?.value || 0),
      height: selectedPlacement()?.height || 22,
    };
  }

  function syncProofSlidersFromPlacement(placement) {
    if (!placement) return;
    const fields = {
      '#pf-logo-top': placement.top ?? 0,
      '#pf-logo-left': placement.left ?? 0,
      '#pf-logo-width': placement.width ?? 24,
      '#pf-logo-rotate': placement.rotate ?? 0,
    };
    Object.entries(fields).forEach(([selector, value]) => {
      const node = qs(selector);
      if (node) node.value = String(value);
    });
  }

  function renderProducts() {
    const products = filteredProducts();
    if (!products.length) {
      setHtml('#pf-product-list', '<p class="pf-help-text">No matching storefront products were found. Edit config/storefront-products.json or clear the search.</p>');
      return;
    }

    if (!state.selectedProduct || !products.some((product) => product.key === state.selectedProduct?.key)) {
      state.selectedProduct = products[0];
    }

    const html = products.map((product) => {
      const tiers = Array.isArray(product.quantityTiers) ? product.quantityTiers : [];
      const tierText = tiers.length ? `${currency(tiers[0].retailPrice)} start` : currency(product.variants?.[0]?.retailPrice || 0);
      const methods = Array.isArray(product.methods) ? product.methods.join(' · ') : 'print';
      return `
        <button class="pf-product-card ${state.selectedProduct?.key === product.key ? 'is-active' : ''}" type="button" data-product-key="${product.key}">
          <img src="${product.previewImage || ''}" alt="${product.title}">
          <h3>${product.title}</h3>
          <p>${product.description || ''}</p>
          <div class="pf-product-meta">
            <span>${tierText}</span>
            <span>${methods}</span>
          </div>
        </button>
      `;
    }).join('');
    setHtml('#pf-product-list', html);

    qsa('[data-product-key]').forEach((node) => {
      node.addEventListener('click', () => {
        const key = node.getAttribute('data-product-key');
        const productsNow = filteredProducts();
        state.selectedProduct = productsNow.find((product) => product.key === key) || productsNow[0];
        state.templateId = null;
        state.externalProductId = null;
        state.designerLoaded = false;
        state.selectedPlacement = null;
        destroyDesignerFrame();
        renderProducts();
        populateVariants();
        populateMethods();
        populatePlacements();
        renderPreview();
        refreshQuote();
        renderSavedSessions();
        saveDraft();
        setStatus('Product changed');
      });
    });
  }

  function populateVariants() {
    const select = qs('#pf-variant-select');
    if (!select) return;

    const variants = Array.isArray(state.selectedProduct?.variants) ? state.selectedProduct.variants : [];
    select.innerHTML = '';
    if (!variants.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No variants defined';
      select.appendChild(option);
      select.disabled = true;
      state.selectedVariant = null;
      return;
    }

    variants.forEach((variant, index) => {
      const option = document.createElement('option');
      option.value = variant.key || String(variant.variantId ?? index);
      option.textContent = variant.label || `${variant.color || ''} ${variant.size || ''}`.trim();
      select.appendChild(option);
    });
    select.disabled = false;

    const currentValue = state.selectedVariant?.key;
    const matching = variants.find((variant) => variant.key === currentValue) || variants[0];
    state.selectedVariant = matching;
    select.value = matching.key;
  }

  function populateMethods() {
    const select = qs('#pf-method-select');
    if (!select) return;

    const methods = Array.isArray(state.selectedProduct?.methods) && state.selectedProduct.methods.length
      ? state.selectedProduct.methods
      : Object.keys(state.catalog?.pricingDefaults?.methods || { print: {} });

    select.innerHTML = '';
    methods.forEach((method) => {
      const option = document.createElement('option');
      option.value = method;
      option.textContent = state.catalog?.pricingDefaults?.methods?.[method]?.label || method;
      select.appendChild(option);
    });

    if (!methods.includes(state.selectedMethod)) state.selectedMethod = methods[0] || 'print';
    select.value = state.selectedMethod;
  }

  function populatePlacements() {
    const select = qs('#pf-placement-select');
    if (!select) return;

    const placements = Array.isArray(state.selectedProduct?.placements) && state.selectedProduct.placements.length
      ? state.selectedProduct.placements
      : (state.selectedProduct?.previewPlacement ? [{ key: 'default', label: 'Default', ...state.selectedProduct.previewPlacement }] : []);

    select.innerHTML = '';
    placements.forEach((placement) => {
      const option = document.createElement('option');
      option.value = placement.key;
      option.textContent = placement.label || placement.key;
      select.appendChild(option);
    });

    const currentValue = state.selectedPlacement?.key;
    state.selectedPlacement = placements.find((placement) => placement.key === currentValue) || placements[0] || null;
    if (state.selectedPlacement) {
      select.value = state.selectedPlacement.key;
      syncProofSlidersFromPlacement(state.selectedPlacement);
    }
  }

  function applyPreviewPlacement() {
    const logoNode = qs('#pf-preview-logo');
    if (!logoNode) return;

    const transform = getPreviewTransform();
    logoNode.style.top = `${transform.top}%`;
    logoNode.style.left = `${transform.left}%`;
    logoNode.style.width = `${transform.width}%`;
    logoNode.style.height = `${transform.height}%`;
    logoNode.style.transform = `rotate(${transform.rotate}deg)`;
  }

  function renderPreviewText() {
    const container = qs('#pf-preview-text');
    const line1 = qs('#pf-preview-text-line-1');
    const line2 = qs('#pf-preview-text-line-2');
    const line1Value = qs('#pf-text-line-1')?.value?.trim() || '';
    const line2Value = qs('#pf-text-line-2')?.value?.trim() || '';
    const color = qs('#pf-text-color')?.value || '#ffffff';

    if (line1) line1.textContent = line1Value;
    if (line2) line2.textContent = line2Value;
    if (container) {
      container.style.color = color;
      container.classList.toggle('is-hidden', !line1Value && !line2Value);
    }
  }

  function renderPreview() {
    const base = qs('#pf-preview-base');
    const logo = qs('#pf-preview-logo');
    if (base) {
      base.src = state.selectedProduct?.previewImage || '';
      base.alt = state.selectedProduct?.title || 'Product preview';
    }
    if (logo) {
      if (state.localLogoDataUrl) {
        logo.src = state.localLogoDataUrl;
        logo.hidden = false;
      } else {
        logo.hidden = true;
        logo.removeAttribute('src');
      }
    }
    applyPreviewPlacement();
    renderPreviewText();
  }

  async function refreshQuote() {
    if (!state.selectedProduct || !state.selectedVariant) return;
    try {
      const quantity = Number(qs('#pf-quantity')?.value || 1);
      const extraLogoCount = Number(qs('#pf-logo-count')?.value || 1);
      const rush = Boolean(qs('#pf-rush')?.checked);
      const shippingSpeed = qs('#pf-shipping')?.value || 'STANDARD';

      const data = await postJson('/.netlify/functions/printful-quote', {
        productKey: state.selectedProduct.key,
        variantKey: state.selectedVariant.key,
        quantity,
        extraLogoCount,
        rush,
        shippingSpeed,
        printMethod: state.selectedMethod,
        placementKey: state.selectedPlacement?.key,
      });

      state.quote = data.quote;
      setText('#pf-unit-price', currency(state.quote.unitRetail));
      setText('#pf-subtotal', currency(state.quote.subtotal));
      setText('#pf-setup-fee', currency(state.quote.setupFee));
      setText('#pf-logos-fee', currency(state.quote.logosFeeTotal));
      setText('#pf-method-fee', currency(state.quote.methodFeeTotal));
      setText('#pf-digitize-fee', currency(state.quote.digitizeFee));
      setText('#pf-rush-fee', currency(state.quote.rushFee));
      setText('#pf-shipping-fee', currency(state.quote.shippingFee));
      setText('#pf-tax-fee', currency(state.quote.estimatedTax));
      setText('#pf-total', currency(state.quote.total));
      setText('#pf-deposit-due', currency(state.quote.depositDue));
      setText('#pf-balance-due', currency(state.quote.balanceDue));
      setText('#pf-quote-note', `${state.quote.productTitle} · ${state.quote.variantLabel} · ${state.quote.printMethodLabel} · tier starts at ${state.quote.quantityTierMin}`);
      setText('#pf-turnaround-note', `${state.quote.shippingLabel} · estimated turnaround ${state.quote.turnaroundLabel}`);
      saveDraft();
    } catch (error) {
      console.error(error);
      setStatus(error.message);
    }
  }

  function destroyDesignerFrame() {
    const mount = qs('#pf-designer');
    if (mount) mount.innerHTML = '';
    state.designMaker = null;
    state.designerLoaded = false;
    toggleDisabled('#pf-save-btn', true);
    toggleDisabled('#pf-mockup-btn', true);
    setTemplateText('Not saved yet');
  }

  async function createDesigner() {
    if (!state.runtime?.printfulReady) {
      throw new Error('Printful is not configured yet. Intake mode is active instead.');
    }
    if (!window.PFDesignMaker) {
      throw new Error('Printful embed.js has not loaded yet.');
    }
    if (!state.selectedProduct?.productId) {
      throw new Error('Set a real Printful productId for this product in storefront-products.json.');
    }
    if (!state.selectedVariant?.variantId) {
      throw new Error('Set a real numeric Printful variantId for this variant in storefront-products.json.');
    }

    destroyDesignerFrame();
    show('#pf-designer', true);

    state.externalProductId = makeSessionId();
    state.templateId = null;
    setSessionText(state.externalProductId);
    setStatus('Creating secure Printful session…');

    const nonceData = await postJson('/.netlify/functions/printful-create-nonce', {
      externalProductId: state.externalProductId,
    });

    state.designMaker = new window.PFDesignMaker({
      elemId: 'pf-designer',
      nonce: nonceData.nonce,
      externalProductId: state.externalProductId,
      initProduct: {
        productId: Number(state.selectedProduct.productId),
      },
      locale: config.locale || 'en_US',
      debug: Boolean(config.debug),
      featureConfig: config.featureConfig || {
        clipart_layers: false,
        file_layers: true,
        text_layers: true,
      },
      preselectedColors: state.selectedVariant.color ? [state.selectedVariant.color] : [],
      preselectedSizes: state.selectedVariant.size ? [state.selectedVariant.size] : [],
      allowOnlyOneColorToBeSelected: true,
      allowOnlyOneSizeToBeSelected: true,
      onIframeLoaded: () => {
        state.designerLoaded = true;
        toggleDisabled('#pf-save-btn', false);
        setStatus('Designer ready');
      },
      onTemplateSaved: (templateId) => {
        state.templateId = templateId;
        setTemplateText(String(templateId));
        setStatus('Design saved');
        toggleDisabled('#pf-order-btn', false);
        toggleDisabled('#pf-mockup-btn', false);
        persistCurrentSession();
      },
      onError: (error) => {
        console.error('[Printful EDM]', error);
        setStatus(`Designer error: ${String(error?.message || error)}`);
      },
      onDesignStatusUpdate: (payload) => {
        if (config.debug) console.log('[Printful EDM status]', payload);
      },
    });
  }

  function saveDesign() {
    if (!state.designMaker) return;
    setStatus('Saving design…');
    state.designMaker.sendMessage({ event: 'saveDesign' });
  }

  async function generateMockups() {
    if (!state.templateId) throw new Error('Save the design first.');
    setStatus('Starting mockup generation…');
    const data = await postJson('/.netlify/functions/printful-create-mockup-task', {
      productTemplateId: state.templateId,
      productKey: state.selectedProduct.key,
      variantKey: state.selectedVariant.key,
      format: 'jpg',
    });
    const taskKey = data?.result?.task_key;
    if (!taskKey) throw new Error('No mockup task key returned.');
    setStatus('Mockup task queued…');
    await pollMockupTask(taskKey);
  }

  async function pollMockupTask(taskKey) {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      const data = await getJson(`/.netlify/functions/printful-get-mockup-task?taskKey=${encodeURIComponent(taskKey)}`);
      const result = data.result || {};
      if (result.status === 'completed' || result.status === 'done') {
        renderMockups(result.mockups || result.files || []);
        setStatus('Mockups ready');
        return;
      }
      if (result.status === 'failed') {
        throw new Error('Mockup task failed.');
      }
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    throw new Error('Mockup task timed out.');
  }

  function renderMockups(files) {
    const gallery = qs('#pf-mockup-gallery');
    if (!gallery) return;
    const urls = (files || [])
      .map((entry) => entry.mockup_url || entry.url || entry.preview_url || null)
      .filter(Boolean);

    if (!urls.length) {
      gallery.innerHTML = '<p class="pf-help-text">No mockups returned yet.</p>';
      return;
    }

    gallery.innerHTML = urls.map((url) => `<img src="${url}" alt="Generated mockup">`).join('');
  }

  function loadSavedSessions() {
    try {
      const raw = localStorage.getItem(storageKey());
      state.savedSessions = raw ? JSON.parse(raw) : [];
    } catch {
      state.savedSessions = [];
    }
  }

  function saveSavedSessions() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(state.savedSessions.slice(0, 12)));
    } catch {}
  }

  function draftSnapshot() {
    return {
      productKey: state.selectedProduct?.key || '',
      variantKey: state.selectedVariant?.key || '',
      methodKey: state.selectedMethod,
      placementKey: state.selectedPlacement?.key || '',
      quantity: Number(qs('#pf-quantity')?.value || 1),
      extraLogoCount: Number(qs('#pf-logo-count')?.value || 1),
      rush: Boolean(qs('#pf-rush')?.checked),
      shipping: qs('#pf-shipping')?.value || 'STANDARD',
      eventDate: qs('#pf-event-date')?.value || '',
      textLine1: qs('#pf-text-line-1')?.value || '',
      textLine2: qs('#pf-text-line-2')?.value || '',
      textColor: qs('#pf-text-color')?.value || '#ffffff',
      designNotes: qs('#pf-design-notes')?.value || '',
      sizeBreakdown: qs('#pf-size-breakdown')?.value || '',
      customerNotes: qs('#pf-customer-notes')?.value || '',
      internalNotes: qs('#pf-internal-notes')?.value || '',
      recipient: buildRecipient(),
      localLogoDataUrl: state.localLogoDataUrl,
      previewTransform: getPreviewTransform(),
      externalProductId: state.externalProductId,
      templateId: state.templateId,
      quoteTotal: state.quote?.total || null,
      updatedAt: nowIso(),
    };
  }

  function saveDraft() {
    try {
      localStorage.setItem(draftKey(), JSON.stringify(draftSnapshot()));
    } catch {}
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(draftKey());
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function applyDraft(draft) {
    if (!draft) return;
    const product = getProducts().find((item) => item.key === draft.productKey);
    if (product) state.selectedProduct = product;

    populateVariants();
    populateMethods();
    populatePlacements();

    if (draft.variantKey) {
      const variant = (state.selectedProduct?.variants || []).find((item) => item.key === draft.variantKey);
      if (variant) {
        state.selectedVariant = variant;
        const variantSelect = qs('#pf-variant-select');
        if (variantSelect) variantSelect.value = variant.key;
      }
    }

    if (draft.methodKey) {
      state.selectedMethod = draft.methodKey;
      const methodSelect = qs('#pf-method-select');
      if (methodSelect) methodSelect.value = draft.methodKey;
    }

    if (draft.placementKey) {
      const placement = getSelectedPlacementByValue(draft.placementKey);
      if (placement) {
        state.selectedPlacement = placement;
        const placementSelect = qs('#pf-placement-select');
        if (placementSelect) placementSelect.value = placement.key;
      }
    }

    const scalarMap = {
      '#pf-quantity': draft.quantity,
      '#pf-logo-count': draft.extraLogoCount,
      '#pf-event-date': draft.eventDate,
      '#pf-text-line-1': draft.textLine1,
      '#pf-text-line-2': draft.textLine2,
      '#pf-text-color': draft.textColor,
      '#pf-design-notes': draft.designNotes,
      '#pf-size-breakdown': draft.sizeBreakdown,
      '#pf-customer-notes': draft.customerNotes,
      '#pf-internal-notes': draft.internalNotes,
      '#pf-shipping': draft.shipping,
      '#pf-rush': draft.rush,
      '#pf-name': draft.recipient?.name,
      '#pf-company': draft.recipient?.company,
      '#pf-email': draft.recipient?.email,
      '#pf-phone': draft.recipient?.phone,
      '#pf-address1': draft.recipient?.address1,
      '#pf-address2': draft.recipient?.address2,
      '#pf-city': draft.recipient?.city,
      '#pf-state': draft.recipient?.state_code,
      '#pf-zip': draft.recipient?.zip,
      '#pf-country': draft.recipient?.country_code,
    };

    Object.entries(scalarMap).forEach(([selector, value]) => {
      const node = qs(selector);
      if (!node || value == null) return;
      if (node.type === 'checkbox') node.checked = Boolean(value);
      else node.value = String(value);
    });

    if (draft.previewTransform) {
      const transformMap = {
        '#pf-logo-top': draft.previewTransform.top,
        '#pf-logo-left': draft.previewTransform.left,
        '#pf-logo-width': draft.previewTransform.width,
        '#pf-logo-rotate': draft.previewTransform.rotate,
      };
      Object.entries(transformMap).forEach(([selector, value]) => {
        const node = qs(selector);
        if (node && value != null) node.value = String(value);
      });
    }

    state.localLogoDataUrl = draft.localLogoDataUrl || null;
    state.externalProductId = draft.externalProductId || null;
    state.templateId = draft.templateId || null;
  }

  function persistCurrentSession() {
    if (!state.selectedProduct || !state.selectedVariant) return;
    const record = {
      id: state.externalProductId || makeSessionId(),
      templateId: state.templateId || null,
      productKey: state.selectedProduct.key,
      productTitle: state.selectedProduct.title,
      variantKey: state.selectedVariant.key,
      variantLabel: state.selectedVariant.label,
      methodKey: state.selectedMethod,
      placementKey: state.selectedPlacement?.key || null,
      quoteTotal: state.quote?.total ?? null,
      draft: draftSnapshot(),
      updatedAt: nowIso(),
    };
    if (!state.externalProductId) state.externalProductId = record.id;
    state.savedSessions = [record, ...state.savedSessions.filter((item) => item.id !== record.id)].slice(0, 12);
    saveSavedSessions();
    renderSavedSessions();
    saveDraft();
  }

  function renderSavedSessions() {
    const root = qs('#pf-saved-sessions');
    if (!root) return;
    if (!state.savedSessions.length) {
      root.innerHTML = '<p class="pf-help-text">No saved local sessions yet.</p>';
      return;
    }
    root.innerHTML = state.savedSessions.map((session) => `
      <article class="pf-session-card">
        <h3>${session.productTitle}</h3>
        <p class="pf-session-meta">${session.variantLabel} · ${session.methodKey || 'print'} · ${session.templateId ? `Template ${session.templateId}` : 'No template yet'} · ${new Date(session.updatedAt).toLocaleString()}</p>
        <div class="pf-session-actions">
          <button type="button" class="pf-btn" data-resume-session="${session.id}">Resume session</button>
          <button type="button" class="pf-btn" data-download-session="${session.id}">Download packet</button>
          <button type="button" class="pf-btn" data-remove-session="${session.id}">Remove</button>
        </div>
      </article>
    `).join('');

    qsa('[data-resume-session]').forEach((node) => {
      node.addEventListener('click', async () => {
        const id = node.getAttribute('data-resume-session');
        const session = state.savedSessions.find((item) => item.id === id);
        if (!session) return;
        applyDraft(session.draft);
        renderProducts();
        populateVariants();
        populateMethods();
        populatePlacements();
        renderPreview();
        await refreshQuote();
        setSessionText(session.id);
        setTemplateText(session.templateId ? String(session.templateId) : 'Not saved yet');
        setStatus('Session restored');
      });
    });

    qsa('[data-download-session]').forEach((node) => {
      node.addEventListener('click', async () => {
        const id = node.getAttribute('data-download-session');
        const session = state.savedSessions.find((item) => item.id === id);
        if (!session) return;
        applyDraft(session.draft);
        renderPreview();
        await refreshQuote();
        const packet = await buildOrderPacket({ silent: true });
        downloadPacket(packet);
      });
    });

    qsa('[data-remove-session]').forEach((node) => {
      node.addEventListener('click', () => {
        const id = node.getAttribute('data-remove-session');
        state.savedSessions = state.savedSessions.filter((item) => item.id !== id);
        saveSavedSessions();
        renderSavedSessions();
      });
    });
  }


  function makeCartItemId() {
    const rand = Math.random().toString(36).slice(2, 10);
    return `cart-${Date.now()}-${rand}`;
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem(cartStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      state.cart = Array.isArray(parsed) ? parsed : [];
    } catch {
      state.cart = [];
    }
  }

  function saveCart() {
    localStorage.setItem(cartStorageKey(), JSON.stringify(state.cart || []));
  }

  function localCartTotals() {
    return (state.cart || []).reduce((acc, item) => {
      const quote = item?.quote || {};
      acc.quantity += Number(quote.quantity || item.quantity || 0);
      acc.subtotal += Number(quote.subtotal || 0);
      acc.shippingFee += Number(quote.shippingFee || 0);
      acc.estimatedTax += Number(quote.estimatedTax || 0);
      acc.total += Number(quote.total || 0);
      acc.depositDue += Number(quote.depositDue || 0);
      return acc;
    }, {
      quantity: 0,
      subtotal: 0,
      shippingFee: 0,
      estimatedTax: 0,
      total: 0,
      depositDue: 0,
    });
  }

  function renderCart() {
    const root = qs('#pf-cart-list');
    if (!root) return;

    const cart = Array.isArray(state.cart) ? state.cart : [];
    if (!cart.length) {
      root.innerHTML = '<p class="pf-help-text">No staged items yet. Build a setup and add it to the cart.</p>';
      setText('#pf-cart-count', '0');
      setText('#pf-cart-quantity', '0');
      setText('#pf-cart-subtotal', currency(0));
      setText('#pf-cart-shipping-total', currency(0));
      setText('#pf-cart-tax-total', currency(0));
      setText('#pf-cart-total', currency(0));
      setText('#pf-cart-deposit', currency(0));
      setText('#pf-cart-note', 'Cart lane is empty.');
      return;
    }

    const totals = localCartTotals();
    root.innerHTML = cart.map((item, index) => `
      <article class="pf-cart-item">
        <div>
          <h3>${item.productTitle}</h3>
          <p class="pf-session-meta">${item.variantLabel} · ${item.printMethodLabel || item.printMethod} · ${item.quantity} unit(s) · ${item.quote?.shippingLabel || item.shippingSpeed || 'STANDARD'}</p>
          <p class="pf-help-text">${item.placementLabel || 'Default placement'}${item.eventDate ? ` · need-by ${item.eventDate}` : ''}</p>
        </div>
        <div class="pf-cart-item-side">
          <strong>${currency(item.quote?.total || 0)}</strong>
          <div class="pf-session-actions">
            <button type="button" class="pf-btn" data-load-cart-item="${item.id}">Load</button>
            <button type="button" class="pf-btn" data-remove-cart-item="${item.id}">Remove</button>
          </div>
        </div>
      </article>
    `).join('');

    setText('#pf-cart-count', String(cart.length));
    setText('#pf-cart-quantity', String(totals.quantity));
    setText('#pf-cart-subtotal', currency(totals.subtotal));
    setText('#pf-cart-shipping-total', currency(totals.shippingFee));
    setText('#pf-cart-tax-total', currency(totals.estimatedTax));
    setText('#pf-cart-total', currency(totals.total));
    setText('#pf-cart-deposit', currency(totals.depositDue));
    setText('#pf-cart-note', `${cart.length} staged item(s) ready for one approval bundle or one live order later.`);

    qsa('[data-load-cart-item]').forEach((node) => {
      node.addEventListener('click', async () => {
        const id = node.getAttribute('data-load-cart-item');
        const item = state.cart.find((entry) => entry.id === id);
        if (!item) return;
        applyDraft({
          productKey: item.productKey,
          variantKey: item.variantKey,
          methodKey: item.printMethod,
          placementKey: item.placementKey,
          quantity: item.quantity,
          logoCount: item.extraLogoCount,
          textLine1: item.textLine1,
          textLine2: item.textLine2,
          textColor: item.textColor,
          designNotes: item.designNotes,
          sizeBreakdown: item.sizeBreakdown,
          eventDate: item.eventDate,
          shipping: item.shippingSpeed,
          rush: item.rush,
          previewTransform: item.localPreviewTransform,
          recipient: buildRecipient(),
          externalProductId: item.externalProductId,
          templateId: item.templateId,
        });
        renderProducts();
        populateVariants();
        populateMethods();
        populatePlacements();
        renderPreview();
        await refreshQuote();
        setTemplateText(item.templateId ? String(item.templateId) : 'Not saved yet');
        setSessionText(item.externalProductId || 'Cart item loaded');
        setStatus('Cart item loaded into builder');
      });
    });

    qsa('[data-remove-cart-item]').forEach((node) => {
      node.addEventListener('click', () => {
        const id = node.getAttribute('data-remove-cart-item');
        state.cart = state.cart.filter((entry) => entry.id !== id);
        saveCart();
        renderCart();
        setStatus('Cart item removed');
      });
    });
  }

  function currentCartItemSnapshot() {
    if (!state.selectedProduct || !state.selectedVariant || !state.quote) return null;
    return {
      id: makeCartItemId(),
      addedAt: nowIso(),
      productKey: state.selectedProduct.key,
      productTitle: state.selectedProduct.title,
      variantKey: state.selectedVariant.key,
      variantLabel: state.selectedVariant.label,
      quantity: Number(qs('#pf-quantity')?.value || 1),
      extraLogoCount: Number(qs('#pf-logo-count')?.value || 1),
      rush: Boolean(qs('#pf-rush')?.checked),
      shippingSpeed: qs('#pf-shipping')?.value || 'STANDARD',
      printMethod: state.selectedMethod,
      printMethodLabel: state.quote?.printMethodLabel || state.selectedMethod,
      placementKey: state.selectedPlacement?.key || null,
      placementLabel: state.selectedPlacement?.label || null,
      eventDate: qs('#pf-event-date')?.value || '',
      externalProductId: state.externalProductId || null,
      templateId: state.templateId || null,
      localLogoAttached: Boolean(state.localLogoDataUrl),
      localPreviewTransform: getPreviewTransform(),
      textLine1: qs('#pf-text-line-1')?.value || '',
      textLine2: qs('#pf-text-line-2')?.value || '',
      textColor: qs('#pf-text-color')?.value || '#ffffff',
      designNotes: qs('#pf-design-notes')?.value || '',
      sizeBreakdown: qs('#pf-size-breakdown')?.value || '',
      quote: JSON.parse(JSON.stringify(state.quote || {})),
    };
  }

  async function addCurrentItemToCart() {
    if (!state.quote) await refreshQuote();
    const item = currentCartItemSnapshot();
    if (!item) throw new Error('Build a valid product setup first.');
    state.cart = [...state.cart, item];
    saveCart();
    renderCart();
    setStatus('Current setup added to cart');
  }

  function cartSummaryText(bundle) {
    return [
      `${bundle.itemCount || bundle.items?.length || 0} staged item(s)`,
      `${bundle.totalQuantity || bundle.totals?.quantity || 0} total units`,
      `Total ${currency(bundle.totals?.total || 0)}`,
      `Deposit ${currency(bundle.totals?.depositDue || 0)}`,
      bundle.logistics?.turnaroundLabel ? `Turnaround ${bundle.logistics.turnaroundLabel}` : '',
    ].filter(Boolean).join(' · ');
  }

  async function buildCartPacket({ silent = false } = {}) {
    const items = Array.isArray(state.cart) ? state.cart : [];
    if (!items.length) {
      throw new Error('Add at least one staged item to the cart first.');
    }
    const payload = {
      orderMode: state.runtime?.printfulReady && items.every((item) => item.templateId) ? 'live' : 'intake',
      recipient: buildRecipient(),
      eventDate: qs('#pf-event-date')?.value || '',
      customerNotes: qs('#pf-customer-notes')?.value || '',
      internalNotes: qs('#pf-internal-notes')?.value || '',
      items: items.map((item) => ({
        productKey: item.productKey,
        variantKey: item.variantKey,
        quantity: item.quantity,
        extraLogoCount: item.extraLogoCount,
        rush: item.rush,
        shippingSpeed: item.shippingSpeed,
        printMethod: item.printMethod,
        placementKey: item.placementKey,
        localLogoAttached: item.localLogoAttached,
        localPreviewTransform: item.localPreviewTransform,
        textLine1: item.textLine1,
        textLine2: item.textLine2,
        textColor: item.textColor,
        designNotes: item.designNotes,
        sizeBreakdown: item.sizeBreakdown,
        eventDate: item.eventDate,
        externalProductId: item.externalProductId,
        templateId: item.templateId,
      })),
    };

    const data = await postJson('/.netlify/functions/printful-build-cart-packet', payload);
    state.lastCartPacket = data.bundle;
    storeArtifactForAdmin(data.bundle, 'builder-cart');
    renderPacketPreview(data.bundle);
    if (!silent) setStatus('Cart bundle ready');
    return data.bundle;
  }

  function buildRecipient() {
    return {
      name: qs('#pf-name')?.value || '',
      company: qs('#pf-company')?.value || '',
      email: qs('#pf-email')?.value || '',
      address1: qs('#pf-address1')?.value || '',
      address2: qs('#pf-address2')?.value || '',
      city: qs('#pf-city')?.value || '',
      state_code: qs('#pf-state')?.value || '',
      zip: qs('#pf-zip')?.value || '',
      country_code: (qs('#pf-country')?.value || 'US').toUpperCase(),
      phone: qs('#pf-phone')?.value || '',
    };
  }

  async function buildOrderPacket({ silent = false } = {}) {
    if (!state.selectedProduct || !state.selectedVariant) {
      throw new Error('Choose a product and variant first.');
    }
    if (!state.quote) {
      await refreshQuote();
    }

    const payload = {
      orderMode: state.runtime?.printfulReady && state.templateId ? 'live' : 'intake',
      productKey: state.selectedProduct.key,
      variantKey: state.selectedVariant.key,
      quantity: Number(qs('#pf-quantity')?.value || 1),
      extraLogoCount: Number(qs('#pf-logo-count')?.value || 1),
      rush: Boolean(qs('#pf-rush')?.checked),
      shippingSpeed: qs('#pf-shipping')?.value || 'STANDARD',
      printMethod: state.selectedMethod,
      placementKey: state.selectedPlacement?.key || null,
      recipient: buildRecipient(),
      localLogoAttached: Boolean(state.localLogoDataUrl),
      localPreviewTransform: getPreviewTransform(),
      textLine1: qs('#pf-text-line-1')?.value || '',
      textLine2: qs('#pf-text-line-2')?.value || '',
      textColor: qs('#pf-text-color')?.value || '#ffffff',
      designNotes: qs('#pf-design-notes')?.value || '',
      sizeBreakdown: qs('#pf-size-breakdown')?.value || '',
      customerNotes: qs('#pf-customer-notes')?.value || '',
      internalNotes: qs('#pf-internal-notes')?.value || '',
      eventDate: qs('#pf-event-date')?.value || '',
      externalProductId: state.externalProductId || null,
      templateId: state.templateId || null,
    };

    const data = await postJson('/.netlify/functions/printful-build-order-packet', payload);
    state.lastPacket = data.packet;
    storeArtifactForAdmin(data.packet, 'builder-packet');
    renderPacketPreview(data.packet);
    if (!silent) setStatus('Order packet ready');
    persistCurrentSession();
    return data.packet;
  }

  function renderPacketPreview(packet) {
    const node = qs('#pf-packet-json');
    if (!node) return;
    node.textContent = JSON.stringify(packet, null, 2);
  }

  function downloadPacket(packet) {
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${packet.packetId || packet.bundleId || 'order-packet'}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function storeArtifactForAdmin(artifact, source = 'builder') {
    if (!artifact) return;
    try {
      const id = artifact.packetId || artifact.bundleId || `artifact-${Date.now()}`;
      const entry = {
        id,
        type: artifact.items ? 'bundle' : 'packet',
        createdAt: artifact.createdAt || nowIso(),
        source,
        artifact,
      };
      const raw = localStorage.getItem(adminInboxKey());
      const inbox = raw ? JSON.parse(raw) : [];
      const next = [entry, ...inbox.filter((item) => item.id !== id)].slice(0, 40);
      localStorage.setItem(adminInboxKey(), JSON.stringify(next));
      localStorage.setItem(adminLastArtifactKey(), JSON.stringify(entry));
    } catch {}
  }

  function packetSummaryText(packet) {
    return [
      packet.product.title,
      packet.product.variantLabel,
      packet.product.printMethodLabel,
      `${packet.pricing.quantity} units`,
      `Total ${currency(packet.pricing.total)}`,
      `Deposit ${currency(packet.pricing.depositDue)}`,
      `Turnaround ${packet.logistics.turnaroundLabel}`,
    ].join(' · ');
  }

  function artifactSummaryText(artifact) {
    if (artifact?.items && artifact?.totals) {
      return cartSummaryText(artifact);
    }
    return packetSummaryText(artifact);
  }

  async function submitIntakeRequest(packet) {
    const isBundle = Boolean(packet?.items && packet?.totals);
    const firstItem = isBundle ? packet.items?.[0] : packet.product;
    const params = new URLSearchParams();
    params.append('form-name', 'merch-intake');
    params.append('product_key', firstItem?.key || firstItem?.productKey || '');
    params.append('variant_key', firstItem?.variantKey || '');
    params.append('variant_label', firstItem?.variantLabel || '');
    params.append('customer_name', packet.customer?.name || '');
    params.append('customer_email', packet.customer?.email || '');
    params.append('packet_id', packet.packetId || packet.bundleId || '');
    params.append('order_mode', packet.orderMode || 'intake');
    params.append('quote_total', String(isBundle ? (packet.totals?.total || '') : (packet.pricing?.total || '')));
    params.append('packet_summary', artifactSummaryText(packet));
    params.append('intake_payload', JSON.stringify(packet));

    const response = await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error('Failed to submit intake request.');
    }
  }

  async function submitOrder(event) {
    event.preventDefault();

    const confirmNode = qs('#pf-confirm');
    const cartActive = Array.isArray(state.cart) && state.cart.length > 0;

    if (cartActive) {
      const bundle = await buildCartPacket({ silent: true });
      const cartLiveReady = Boolean(state.runtime?.printfulReady) && state.cart.every((item) => item.templateId || item.externalProductId);

      if (!cartLiveReady) {
        setStatus('Sending cart intake request…');
        await submitIntakeRequest(bundle);
        setStatus('Cart request captured');
        return;
      }

      setStatus('Creating live cart order…');
      const data = await postJson('/.netlify/functions/printful-create-order', {
        confirm: confirmNode ? confirmNode.checked : Boolean(config.submitDirectDefault),
        shipping: state.cart[0]?.shippingSpeed || 'STANDARD',
        recipient: bundle.customer,
        items: state.cart.map((item) => ({
          productKey: item.productKey,
          variantKey: item.variantKey,
          quantity: item.quantity,
          extraLogoCount: item.extraLogoCount,
          rush: item.rush,
          shippingSpeed: item.shippingSpeed,
          printMethod: item.printMethod,
          productTemplateId: item.templateId,
          externalProductId: item.externalProductId,
          itemName: `${item.productTitle} - ${item.variantLabel}`,
        })),
      });

      const orderId = data?.result?.id || 'created';
      const orderStatus = data?.result?.status || 'draft';
      setStatus(`Cart order ${orderId} created (${orderStatus})`);
      return;
    }

    if (!state.selectedProduct || !state.selectedVariant) {
      throw new Error('Choose a product and variant first.');
    }

    const packet = await buildOrderPacket({ silent: true });

    if (!state.runtime?.printfulReady || !state.templateId) {
      setStatus('Sending intake request…');
      await submitIntakeRequest(packet);
      setStatus('Order request captured');
      persistCurrentSession();
      return;
    }

    setStatus('Creating Printful order…');

    const data = await postJson('/.netlify/functions/printful-create-order', {
      externalProductId: state.externalProductId,
      productTemplateId: state.templateId,
      productKey: state.selectedProduct.key,
      variantKey: state.selectedVariant.key,
      quantity: packet.pricing.quantity,
      extraLogoCount: packet.pricing.extraLogoCount,
      rush: packet.pricing.rush,
      shipping: packet.pricing.shippingSpeed,
      confirm: confirmNode ? confirmNode.checked : Boolean(config.submitDirectDefault),
      itemName: `${state.selectedProduct.title} - ${state.selectedVariant.label}`,
      recipient: packet.customer,
    });

    const orderId = data?.result?.id || 'created';
    const orderStatus = data?.result?.status || 'draft';
    setStatus(`Order ${orderId} created (${orderStatus})`);
    persistCurrentSession();
  }

  function handleVariantChange() {
    const select = qs('#pf-variant-select');
    if (!select) return;
    state.selectedVariant = getSelectedVariantByValue(select.value);
    destroyDesignerFrame();
    refreshQuote();
    saveDraft();
    setStatus('Variant changed');
  }

  function handleMethodChange() {
    const select = qs('#pf-method-select');
    if (!select) return;
    state.selectedMethod = select.value;
    refreshQuote();
    saveDraft();
    setStatus('Print method changed');
  }

  function handlePlacementChange() {
    const select = qs('#pf-placement-select');
    if (!select) return;
    state.selectedPlacement = getSelectedPlacementByValue(select.value);
    syncProofSlidersFromPlacement(state.selectedPlacement);
    renderPreview();
    refreshQuote();
    saveDraft();
    setStatus('Placement changed');
  }

  function wireUpload() {
    qs('#pf-logo-upload')?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      state.localLogoDataUrl = dataUrl;
      renderPreview();
      saveDraft();
      setStatus('Local logo preview updated');
    });

    qs('#pf-clear-logo-btn')?.addEventListener('click', () => {
      state.localLogoDataUrl = null;
      const input = qs('#pf-logo-upload');
      if (input) input.value = '';
      renderPreview();
      saveDraft();
      setStatus('Local logo removed');
    });
  }

  function copySummary() {
    if (!state.lastPacket) {
      throw new Error('Create an order packet first.');
    }
    const text = packetSummaryText(state.lastPacket);
    navigator.clipboard.writeText(text).then(() => {
      setStatus('Summary copied');
    }).catch(() => {
      setStatus('Copy failed');
    });
  }

  function copyCartSummary() {
    if (!state.lastCartPacket) {
      throw new Error('Create a cart bundle first.');
    }
    const text = cartSummaryText(state.lastCartPacket);
    navigator.clipboard.writeText(text).then(() => {
      setStatus('Cart summary copied');
    }).catch(() => {
      setStatus('Copy failed');
    });
  }

  function bindDraftAutosave() {
    [
      '#pf-product-search',
      '#pf-quantity',
      '#pf-logo-count',
      '#pf-event-date',
      '#pf-rush',
      '#pf-shipping',
      '#pf-text-line-1',
      '#pf-text-line-2',
      '#pf-text-color',
      '#pf-design-notes',
      '#pf-size-breakdown',
      '#pf-customer-notes',
      '#pf-internal-notes',
      '#pf-name',
      '#pf-company',
      '#pf-email',
      '#pf-phone',
      '#pf-address1',
      '#pf-address2',
      '#pf-city',
      '#pf-state',
      '#pf-zip',
      '#pf-country',
      '#pf-logo-top',
      '#pf-logo-left',
      '#pf-logo-width',
      '#pf-logo-rotate',
    ].forEach((selector) => {
      qs(selector)?.addEventListener('input', () => {
        renderPreviewText();
        if (selector.startsWith('#pf-logo-')) renderPreview();
        saveDraft();
      });
    });
  }

  function wireEvents() {
    qs('#pf-start-btn')?.addEventListener('click', async () => {
      try {
        await createDesigner();
      } catch (error) {
        console.error(error);
        setStatus(error.message);
      }
    });

    qs('#pf-save-btn')?.addEventListener('click', () => {
      try {
        saveDesign();
      } catch (error) {
        console.error(error);
        setStatus(error.message);
      }
    });

    qs('#pf-mockup-btn')?.addEventListener('click', async () => {
      try {
        await generateMockups();
      } catch (error) {
        console.error(error);
        setStatus(error.message);
      }
    });

    qs('#pf-reset-btn')?.addEventListener('click', () => {
      state.externalProductId = null;
      state.templateId = null;
      destroyDesignerFrame();
      setSessionText('No active session');
      setTemplateText('Not saved yet');
      setStatus('Session reset');
      saveDraft();
    });

    qs('#pf-reset-proof-btn')?.addEventListener('click', () => {
      syncProofSlidersFromPlacement(selectedPlacement());
      renderPreview();
      saveDraft();
      setStatus('Proof placement reset');
    });

    qs('#pf-variant-select')?.addEventListener('change', handleVariantChange);
    qs('#pf-method-select')?.addEventListener('change', handleMethodChange);
    qs('#pf-placement-select')?.addEventListener('change', handlePlacementChange);
    qs('#pf-quantity')?.addEventListener('input', refreshQuote);
    qs('#pf-logo-count')?.addEventListener('input', refreshQuote);
    qs('#pf-rush')?.addEventListener('change', refreshQuote);
    qs('#pf-shipping')?.addEventListener('change', refreshQuote);
    qs('#pf-product-search')?.addEventListener('input', (event) => {
      state.productFilter = event.target.value || '';
      renderProducts();
      saveDraft();
    });

    ['#pf-text-line-1', '#pf-text-line-2', '#pf-text-color', '#pf-logo-top', '#pf-logo-left', '#pf-logo-width', '#pf-logo-rotate'].forEach((selector) => {
      qs(selector)?.addEventListener('input', () => {
        renderPreview();
        saveDraft();
      });
    });

    qs('#pf-download-packet-btn')?.addEventListener('click', async () => {
      try {
        const packet = await buildOrderPacket();
        downloadPacket(packet);
      } catch (error) {
        console.error(error);
        setStatus(error.message);
      }
    });

    qs('#pf-queue-packet-admin-btn')?.addEventListener('click', async () => {
      try {
        const packet = await buildOrderPacket({ silent: true });
        storeArtifactForAdmin(packet, 'builder-manual-queue');
        setStatus('Packet queued for admin board');
      } catch (error) {
        console.error(error);
        setStatus(error.message);
      }
    });

    qs('#pf-add-cart-btn')?.addEventListener('click', async () => {
      try {
        await addCurrentItemToCart();
      } catch (error) {
        console.error(error);
        setStatus(error.message);
      }
    });

    qs('#pf-download-cart-btn')?.addEventListener('click', async () => {
      try {
        const bundle = await buildCartPacket();
        downloadPacket(bundle);
      } catch (error) {
        console.error(error);
        setStatus(error.message);
      }
    });

    qs('#pf-copy-cart-btn')?.addEventListener('click', async () => {
      try {
        if (!state.lastCartPacket) await buildCartPacket({ silent: true });
        copyCartSummary();
      } catch (error) {
        console.error(error);
        setStatus(error.message);
      }
    });

    qs('#pf-clear-cart-btn')?.addEventListener('click', () => {
      state.cart = [];
      state.lastCartPacket = null;
      saveCart();
      renderCart();
      setStatus('Cart cleared');
    });

    qs('#pf-queue-cart-admin-btn')?.addEventListener('click', async () => {
      try {
        const bundle = await buildCartPacket({ silent: true });
        storeArtifactForAdmin(bundle, 'builder-cart-manual-queue');
        setStatus('Cart bundle queued for admin board');
      } catch (error) {
        console.error(error);
        setStatus(error.message);
      }
    });

    qs('#pf-copy-summary-btn')?.addEventListener('click', async () => {
      try {
        if (!state.lastPacket) await buildOrderPacket({ silent: true });
        copySummary();
      } catch (error) {
        console.error(error);
        setStatus(error.message);
      }
    });

    qs('#pf-order-form')?.addEventListener('submit', async (event) => {
      try {
        await submitOrder(event);
      } catch (error) {
        console.error(error);
        setStatus(error.message);
      }
    });

    wireUpload();
    bindDraftAutosave();
  }

  function registerServiceWorker() {
    if (!config.serviceWorker || !('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  async function boot() {
    try {
      applyBranding();
      await bootRuntime();
      loadSavedSessions();
      loadCart();
      renderProducts();
      populateVariants();
      populateMethods();
      populatePlacements();
      const draft = restoreDraft();
      if (draft) applyDraft(draft);
      renderProducts();
      populateVariants();
      populateMethods();
      populatePlacements();
      renderPreview();
      await refreshQuote();
      renderSavedSessions();
      renderCart();
      wireEvents();
      registerServiceWorker();
      setTemplateText(state.templateId ? String(state.templateId) : 'Not saved yet');
      setSessionText(state.externalProductId || 'No active session');
      setStatus('Ready');
    } catch (error) {
      console.error(error);
      setStatus(error.message);
    }
  }

  document.addEventListener('partials:ready', boot);
})();
