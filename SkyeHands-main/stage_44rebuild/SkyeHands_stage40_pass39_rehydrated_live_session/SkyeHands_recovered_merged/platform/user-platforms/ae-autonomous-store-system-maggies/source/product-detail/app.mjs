import { loadState, saveState } from '../shared/core/browser-state.mjs';
import { buildProductDetailView, createBookingAndRoutePacket } from '../shared/core/autonomous-store-extensions.mjs';

const app = document.querySelector('#app');
let state = await loadState();

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function persist() { state = saveState(state); render(); }

function getSelectedProductId() {
  const params = new URLSearchParams(globalThis.location.search);
  return params.get('id') || state.inventory.find((item) => item.status === 'published')?.id || '';
}

function render() {
  const productId = getSelectedProductId();
  const view = buildProductDetailView(state, productId);
  if (!view.product) {
    app.innerHTML = `<div class="panel"><h1>No published product selected.</h1><p class="muted">Publish an item from merchant admin, then reopen this lane.</p></div>`;
    return;
  }
  app.innerHTML = `
    <div class="grid">
      <div class="panel">
        <span class="pill">Product detail from published state</span>
        <h1>${esc(view.product.title)}</h1>
        <p class="muted">${esc(view.product.category)} · $${Number(view.product.price || 0).toFixed(2)} · Stock ${esc(view.product.stock)}</p>
        <p>${esc(view.product.description)}</p>
        <p class="muted">Delivery ${view.product.deliveryEligible ? 'enabled' : 'off'} · Pickup ${view.product.pickupEligible ? 'enabled' : 'off'}</p>
        <form id="fast-booking" class="stack">
          <input name="customerName" placeholder="Customer name" required>
          <input name="customerPhone" placeholder="Phone" required>
          <input name="address" placeholder="Delivery address" required>
          <button type="submit">Create Booking + Route Packet</button>
        </form>
      </div>
      <div class="stack">
        <div class="card">
          <h2>Related Inventory</h2>
          ${view.related.map((item) => `<p><a href="?id=${encodeURIComponent(item.id)}">${esc(item.title)}</a><br><span class="muted">${esc(item.category)} · $${Number(item.price || 0).toFixed(2)}</span></p>`).join('') || '<p class="muted">No related published items yet.</p>'}
        </div>
        <div class="card">
          <h2>Merchant</h2>
          <p><strong>${esc(view.merchant.storeName)}</strong></p>
          <p class="muted">${esc(view.merchant.contactEmail || '')}</p>
        </div>
      </div>
    </div>`;

  document.querySelector('#fast-booking').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    createBookingAndRoutePacket(state, {
      itemId: view.product.id,
      customerName: form.get('customerName'),
      customerPhone: form.get('customerPhone'),
      address: form.get('address'),
      requestedWindow: state.merchant.serviceWindows?.[0]?.label || 'Next available route window',
      notes: 'Created from product detail lane'
    });
    persist();
    alert('Booking and route packet created from product detail lane.');
  });
}

render();
