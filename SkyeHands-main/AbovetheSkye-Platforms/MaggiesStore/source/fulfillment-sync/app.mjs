import { loadState, saveState } from '../shared/core/browser-state.mjs';

const app = document.querySelector('#app');
let state = await loadState();

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function persist() { state = saveState(state); render(); }

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function statusPill(status) {
  const colors = {
    pending: '#78350f',
    dispatched: '#1e3a5f',
    delivered: '#064e3b',
    cancelled: '#4c1d95',
    'route-assigned': '#1c3a2a',
  };
  const bg = colors[status] || '#182449';
  return `<span class="pill" style="background:${bg}">${esc(status)}</span>`;
}

function buildFulfillmentRows() {
  const packets = state.routePackets || [];
  const bookings = state.bookings || [];

  return packets.map((packet) => {
    const booking = bookings.find((b) => b.id === packet.bookingId) || {};
    return { packet, booking };
  });
}

function advanceStatus(packetId) {
  const idx = state.routePackets.findIndex((p) => p.id === packetId);
  if (idx === -1) return;
  const flow = ['pending', 'route-assigned', 'dispatched', 'delivered'];
  const current = state.routePackets[idx].status || 'pending';
  const next = flow[flow.indexOf(current) + 1];
  if (!next) return;
  state.routePackets[idx].status = next;
  state.routePackets[idx].updatedAt = new Date().toISOString();

  // Mirror status back to the booking
  const booking = state.bookings.find((b) => b.id === state.routePackets[idx].bookingId);
  if (booking) {
    booking.routeStatus = next;
    if (next === 'delivered') booking.status = 'fulfilled';
  }

  persist();
}

function cancelPacket(packetId) {
  const idx = state.routePackets.findIndex((p) => p.id === packetId);
  if (idx === -1) return;
  state.routePackets[idx].status = 'cancelled';
  const booking = state.bookings.find((b) => b.id === state.routePackets[idx].bookingId);
  if (booking) { booking.routeStatus = 'cancelled'; booking.status = 'cancelled'; }
  persist();
}

function render() {
  const rows = buildFulfillmentRows();
  const pending = rows.filter((r) => !['delivered', 'cancelled'].includes(r.packet.status || 'pending'));
  const completed = rows.filter((r) => ['delivered', 'cancelled'].includes(r.packet.status || ''));

  const metrics = {
    total: rows.length,
    active: pending.length,
    delivered: rows.filter((r) => r.packet.status === 'delivered').length,
    cancelled: rows.filter((r) => r.packet.status === 'cancelled').length,
  };

  app.innerHTML = `
    <div class="panel">
      <span class="pill">Fulfillment Sync</span>
      <h1 style="margin:10px 0 6px">Route Packet Fulfillment Board</h1>
      <p class="muted">Track dispatch → delivery progression for all active route packets. Changes sync to bookings automatically.</p>
    </div>

    <div class="grid" style="margin:16px 0">
      <div class="card" style="text-align:center"><div style="font-size:28px;font-weight:700;color:#a78bfa">${metrics.total}</div><div class="muted">Total Packets</div></div>
      <div class="card" style="text-align:center"><div style="font-size:28px;font-weight:700;color:#60a5fa">${metrics.active}</div><div class="muted">In Transit</div></div>
      <div class="card" style="text-align:center"><div style="font-size:28px;font-weight:700;color:#6ee7b7">${metrics.delivered}</div><div class="muted">Delivered</div></div>
      <div class="card" style="text-align:center"><div style="font-size:28px;font-weight:700;color:#c4b5fd">${metrics.cancelled}</div><div class="muted">Cancelled</div></div>
    </div>

    <div class="panel" style="margin-bottom:16px">
      <h2 style="margin-bottom:14px">Active Fulfillments</h2>
      ${pending.length ? pending.map(({ packet, booking }) => {
        const flow = ['pending', 'route-assigned', 'dispatched', 'delivered'];
        const currentIdx = flow.indexOf(packet.status || 'pending');
        const canAdvance = currentIdx < flow.length - 1;
        return `
          <div class="card" style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
              <div>
                <strong>${esc(booking.customerName || 'Unknown Customer')}</strong>
                <span class="muted" style="margin-left:8px">${esc(booking.itemTitle || '')}</span>
                <div style="margin-top:6px">${statusPill(packet.status || 'pending')}</div>
              </div>
              <div style="text-align:right">
                <div class="muted" style="font-size:12px">Driver: ${esc(packet.driverName || '—')}</div>
                <div class="muted" style="font-size:12px">Window: ${esc(packet.dispatchWindow || '—')}</div>
                <div class="muted" style="font-size:12px">Created: ${fmtDate(packet.createdAt)}</div>
              </div>
            </div>
            <div style="margin-top:6px;color:#9fb0cf;font-size:13px">${esc(booking.address || '')}</div>
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
              <div style="display:flex;gap:4px;align-items:center">
                ${flow.map((s, i) => `<span style="padding:3px 8px;border-radius:4px;font-size:11px;background:${i <= currentIdx ? '#1e3a5f' : '#0d1322'};color:${i <= currentIdx ? '#60a5fa' : '#475569'}">${s}</span>`).join('<span style="color:#475569">›</span>')}
              </div>
              <div style="margin-left:auto;display:flex;gap:6px">
                ${canAdvance ? `<button data-advance="${esc(packet.id)}" style="width:auto;padding:6px 12px;font-size:12px;background:#1e3a5f">→ ${esc(flow[currentIdx + 1])}</button>` : ''}
                <button data-cancel="${esc(packet.id)}" style="width:auto;padding:6px 12px;font-size:12px;background:#4c1d95">Cancel</button>
              </div>
            </div>
          </div>`;
      }).join('') : '<p class="muted">No active fulfillments. Route packets appear here when created in Merchant Admin.</p>'}
    </div>

    ${completed.length ? `
    <div class="panel">
      <h2 style="margin-bottom:14px">Completed / Cancelled</h2>
      <table>
        <thead><tr><th>Customer</th><th>Item</th><th>Driver</th><th>Status</th><th>Updated</th></tr></thead>
        <tbody>
          ${completed.map(({ packet, booking }) => `
            <tr>
              <td>${esc(booking.customerName || '—')}</td>
              <td>${esc(booking.itemTitle || '—')}</td>
              <td>${esc(packet.driverName || '—')}</td>
              <td>${statusPill(packet.status)}</td>
              <td>${fmtDate(packet.updatedAt || packet.createdAt)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : ''}`;

  document.querySelectorAll('[data-advance]').forEach((btn) => {
    btn.onclick = () => advanceStatus(btn.dataset.advance);
  });
  document.querySelectorAll('[data-cancel]').forEach((btn) => {
    btn.onclick = () => {
      if (confirm('Cancel this route packet?')) cancelPacket(btn.dataset.cancel);
    };
  });
}

render();
