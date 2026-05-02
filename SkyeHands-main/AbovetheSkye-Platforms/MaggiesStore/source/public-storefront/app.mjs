import { loadState, saveState } from '../shared/core/browser-state.mjs';
import { buildStorefrontView, createBooking } from '../shared/core/autonomous-store.mjs';

const app = document.querySelector('#app');
let state = await loadState();

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function persist() { state = saveState(state); render(); }

function render() {
  const view = buildStorefrontView(state);
  app.innerHTML = `
    <div class="hero">
      <span class="pill">Published inventory from managed state</span>
      <h1>${esc(view.merchant.storeName)}</h1>
      <p class="muted">This storefront is driven by the merchant-admin publish state. Published inventory appears here automatically when the admin lane changes state.</p>
      <p class="muted">Published items: ${view.metrics.publishedCount} · Bookings: ${view.metrics.bookingCount} · Route packets: ${view.metrics.routePacketCount}</p>
    </div>
    <div class="grid" style="margin-top:18px">
      ${view.publishedInventory.map((item) => `
        <div class="card">
          <span class="pill">${esc(item.category)}</span>
          <h2>${esc(item.title)}</h2>
          <p>${esc(item.description)}</p>
          <p><strong>$${Number(item.price || 0).toFixed(2)}</strong> · Stock ${esc(item.stock)}</p>
          <p class="muted">Delivery ${item.deliveryEligible ? 'enabled' : 'off'} · Pickup ${item.pickupEligible ? 'enabled' : 'off'}</p>
        </div>`).join('') || '<div class="card"><h2>No items are published yet.</h2><p>Use merchant admin to publish inventory into the storefront.</p></div>'}
    </div>
    <div class="panel" style="margin-top:18px">
      <h2>Book delivery or pickup</h2>
      <form id="booking-form" class="grid">
        <label>Name<input name="customerName" required></label>
        <label>Phone<input name="customerPhone" required></label>
        <label>Address<input name="address" required></label>
        <label>Requested Window<select name="requestedWindow">${view.merchant.serviceWindows.map((row) => `<option value="${esc(row.label)}">${esc(row.label)}</option>`).join('')}</select></label>
        <label>Item<select name="itemId">${view.publishedInventory.map((item) => `<option value="${item.id}">${esc(item.title)}</option>`).join('')}</select></label>
        <label>Notes<textarea name="notes" rows="3" placeholder="Optional instructions"></textarea></label>
        <button type="submit">Submit Booking</button>
      </form>
      <p class="muted">${esc(state.bookingSettings.orderNotice || '')}</p>
    </div>
    <div class="panel" style="margin-top:18px">
      <h2>Recent Booking Records</h2>
      ${state.bookings.map((booking) => `<div class="card" style="margin-top:10px"><strong>${esc(booking.customerName)}</strong><p class="muted">${esc(booking.itemTitle)} · ${esc(booking.requestedWindow)}</p><p>${esc(booking.address)}</p><span class="pill">${esc(booking.routeStatus)}</span></div>`).join('') || '<p class="muted">No bookings yet.</p>'}
    </div>`;

  const form = document.querySelector('#booking-form');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const payload = new FormData(event.currentTarget);
      createBooking(state, {
        customerName: payload.get('customerName'),
        customerPhone: payload.get('customerPhone'),
        address: payload.get('address'),
        requestedWindow: payload.get('requestedWindow'),
        itemId: payload.get('itemId'),
        notes: payload.get('notes')
      });
      persist();
      alert('Booking submitted into the shared booking lane.');
    });
  }
}

render();
