import { loadState, saveState } from '../shared/core/browser-state.mjs';
import { createRoutePacket } from '../shared/core/autonomous-store.mjs';

const app = document.querySelector('#app');
let state = await loadState();

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function persist() { state = saveState(state); render(); }

function render() {
  const pending = state.bookings.filter((booking) => booking.routeStatus === 'pending');
  app.innerHTML = `
    <div class="panel">
      <span class="pill">Routex-ready delivery lane</span>
      <h1>Delivery Operations</h1>
      <p class="muted">Bookings waiting for dispatch: ${pending.length} · Route packets: ${state.routePackets.length}</p>
    </div>
    <div class="grid">
      <div class="panel">
        <h2>Bookings Awaiting Route Packets</h2>
        ${pending.map((booking) => `
          <div class="card" style="margin-top:10px">
            <strong>${esc(booking.customerName)}</strong>
            <p class="muted">${esc(booking.itemTitle)} · ${esc(booking.requestedWindow)}</p>
            <p>${esc(booking.address)}</p>
            <button data-route="${booking.id}">Generate Route Packet</button>
          </div>`).join('') || '<p class="muted">No pending bookings.</p>'}
      </div>
      <div class="panel">
        <h2>Route Packets</h2>
        ${state.routePackets.map((packet) => `
          <div class="card" style="margin-top:10px">
            <strong>${esc(packet.bookingLabel)}</strong>
            <p class="muted">${esc(packet.driverName)} · ${esc(packet.dispatchWindow)}</p>
            <span class="pill">${esc(packet.status)}</span>
          </div>`).join('') || '<p class="muted">No route packets yet.</p>'}
      </div>
    </div>`;

  document.querySelectorAll('[data-route]').forEach((button) => {
    button.onclick = () => {
      createRoutePacket(state, button.dataset.route, { driverName: 'RoutexFlow Dispatch', dispatchWindow: 'Next available route window' });
      persist();
    };
  });
}

render();
