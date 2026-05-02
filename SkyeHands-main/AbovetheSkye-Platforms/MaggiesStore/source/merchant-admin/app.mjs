import { loadState, saveState, resetState } from '../shared/core/browser-state.mjs';
import { authenticateMerchant, upsertInventoryItem, deleteInventoryItem, setInventoryPublished, createRoutePacket } from '../shared/core/autonomous-store.mjs';

const app = document.querySelector('#app');
let state = await loadState();
let session = null;
let editingId = null;

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function persist() { state = saveState(state); render(); }

function loginView() {
  app.innerHTML = `
    <div class="panel" style="max-width:420px">
      <h2>Merchant Auth Shell</h2>
      <p class="muted">Demo credential: owner@maggies.local / 2468</p>
      <form id="login-form" class="grid">
        <label>Email<input name="email" type="email" required value="owner@maggies.local"></label>
        <label>PIN<input name="pin" type="password" required value="2468"></label>
        <button type="submit">Log In</button>
      </form>
    </div>`;
  document.querySelector('#login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextSession = authenticateMerchant(state, form.get('email'), form.get('pin'));
    if (!nextSession) return alert('Auth failed.');
    session = nextSession;
    render();
  });
}

function adminView() {
  const pendingBookings = state.bookings.filter((row) => row.routeStatus === 'pending');
  const formItem = editingId ? state.inventory.find((row) => row.id === editingId) : null;
  app.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <span class="pill">${esc(session.name)}</span>
        <span class="pill">Published ${state.inventory.filter((row) => row.status === 'published').length}</span>
        <span class="pill">Bookings ${state.bookings.length}</span>
        <span class="pill">Route Packets ${state.routePackets.length}</span>
      </div>
      <div class="row" style="width:auto">
        <button id="reset-seed" style="width:auto">Reset Seed</button>
        <button id="logout" style="width:auto">Log Out</button>
      </div>
    </div>
    <div class="two">
      <div>
        <div class="panel">
          <h2>${formItem ? 'Edit Inventory Item' : 'Create Inventory Item'}</h2>
          <form id="inventory-form" class="grid">
            <label>Title<input name="title" required value="${esc(formItem?.title || '')}"></label>
            <label>Category<input name="category" required value="${esc(formItem?.category || '')}"></label>
            <label>Description<textarea name="description" rows="4">${esc(formItem?.description || '')}</textarea></label>
            <div class="grid">
              <label>Price<input name="price" type="number" step="0.01" value="${esc(formItem?.price || '0')}"></label>
              <label>Stock<input name="stock" type="number" step="1" value="${esc(formItem?.stock || '0')}"></label>
            </div>
            <label>Image URL<input name="image" value="${esc(formItem?.image || '')}"></label>
            <label>Tags<input name="tags" value="${esc((formItem?.tags || []).join(', '))}"></label>
            <div class="grid">
              <label><input type="checkbox" name="featured" ${formItem?.featured ? 'checked' : ''}> Featured</label>
              <label><input type="checkbox" name="deliveryEligible" ${formItem?.deliveryEligible ?? true ? 'checked' : ''}> Delivery Eligible</label>
              <label><input type="checkbox" name="pickupEligible" ${formItem?.pickupEligible ?? true ? 'checked' : ''}> Pickup Eligible</label>
            </div>
            <div class="row"><button type="submit">${formItem ? 'Update Item' : 'Create Item'}</button><button type="button" id="clear-form">Clear</button></div>
          </form>
        </div>
        <div class="panel">
          <h2>Inventory CRUD + Publish Controls</h2>
          <table>
            <thead><tr><th>Item</th><th>Status</th><th>Stock</th><th>Actions</th></tr></thead>
            <tbody>${state.inventory.map((item) => `
              <tr>
                <td><strong>${esc(item.title)}</strong><br><span class="muted">${esc(item.category)}</span></td>
                <td>${esc(item.status)}</td>
                <td>${esc(item.stock)}</td>
                <td>
                  <div class="row">
                    <button data-edit="${item.id}" style="width:auto">Edit</button>
                    <button data-toggle="${item.id}" style="width:auto">${item.status === 'published' ? 'Unpublish' : 'Publish'}</button>
                    <button data-delete="${item.id}" style="width:auto">Delete</button>
                  </div>
                </td>
              </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
      <div>
        <div class="panel">
          <h2>Merchant Settings</h2>
          <p><strong>${esc(state.merchant.storeName)}</strong></p>
          <p class="muted">Delivery enabled: ${state.merchant.deliveryEnabled ? 'Yes' : 'No'} · Recurring windows: ${state.merchant.serviceWindows.length}</p>
          <p class="muted">Public storefront sync source: ${esc(state.sync.source)} · Last mutation: ${esc(state.sync.lastInventoryMutationAt || 'n/a')}</p>
        </div>
        <div class="panel">
          <h2>Incoming Booking Records</h2>
          ${state.bookings.length ? state.bookings.map((booking) => `
            <div class="panel" style="margin:10px 0 0 0;padding:12px">
              <strong>${esc(booking.customerName)}</strong>
              <p class="muted">${esc(booking.itemTitle)} · ${esc(booking.requestedWindow)}</p>
              <p>${esc(booking.address)}</p>
              <div class="row">
                <span class="pill">${esc(booking.status)}</span>
                <span class="pill">${esc(booking.routeStatus)}</span>
                ${booking.routeStatus === 'pending' ? `<button data-route="${booking.id}" style="width:auto">Generate Route Packet</button>` : ''}
              </div>
            </div>`).join('') : '<p class="muted">No bookings yet.</p>'}
        </div>
        <div class="panel">
          <h2>Dispatch Queue</h2>
          ${pendingBookings.length ? `<p>${pendingBookings.length} booking(s) waiting for route packet generation.</p>` : '<p class="muted">All current bookings have route packets.</p>'}
          ${state.routePackets.map((packet) => `<div class="panel" style="margin:10px 0 0 0;padding:12px"><strong>${esc(packet.bookingLabel)}</strong><p class="muted">${esc(packet.driverName)} · ${esc(packet.dispatchWindow)}</p><span class="pill">${esc(packet.status)}</span></div>`).join('')}
        </div>
      </div>
    </div>`;

  document.querySelector('#logout').onclick = () => { session = null; render(); };
  document.querySelector('#reset-seed').onclick = () => { state = resetState(); editingId = null; persist(); };
  document.querySelector('#clear-form').onclick = () => { editingId = null; render(); };

  document.querySelector('#inventory-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    upsertInventoryItem(state, {
      id: editingId,
      title: form.get('title'),
      category: form.get('category'),
      description: form.get('description'),
      price: form.get('price'),
      stock: form.get('stock'),
      image: form.get('image'),
      tags: form.get('tags'),
      featured: form.get('featured') === 'on',
      deliveryEligible: form.get('deliveryEligible') === 'on',
      pickupEligible: form.get('pickupEligible') === 'on'
    });
    editingId = null;
    persist();
  });

  document.querySelectorAll('[data-edit]').forEach((button) => button.onclick = () => { editingId = button.dataset.edit; render(); });
  document.querySelectorAll('[data-delete]').forEach((button) => button.onclick = () => { deleteInventoryItem(state, button.dataset.delete); persist(); });
  document.querySelectorAll('[data-toggle]').forEach((button) => button.onclick = () => {
    const item = state.inventory.find((row) => row.id === button.dataset.toggle);
    setInventoryPublished(state, item.id, item.status !== 'published');
    persist();
  });
  document.querySelectorAll('[data-route]').forEach((button) => button.onclick = () => { createRoutePacket(state, button.dataset.route, { driverName: 'RoutexFlow Dispatch', dispatchWindow: 'Next available window' }); persist(); });
}

function render() {
  if (!session) return loginView();
  return adminView();
}

render();
