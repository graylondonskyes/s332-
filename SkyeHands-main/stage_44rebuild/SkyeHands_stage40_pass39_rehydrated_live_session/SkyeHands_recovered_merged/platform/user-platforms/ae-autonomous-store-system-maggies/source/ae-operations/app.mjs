import { loadState } from '../shared/core/browser-state.mjs';
import { buildAeRosterView } from '../shared/core/autonomous-store.mjs';

const app = document.querySelector('#app');
const state = await loadState();
const view = buildAeRosterView(state);

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

app.innerHTML = `
  <div class="panel">
    <span class="pill">AE command visibility</span>
    <h1>Merchant Launch Readiness</h1>
    <p class="muted">Readiness score ${view.readiness.score} · Status ${view.readiness.status}</p>
  </div>
  <div class="grid">
    ${view.merchantRows.map((row) => `
      <div class="card">
        <h2>${esc(row.storeName)}</h2>
        <p class="muted">Assigned AE: ${esc(row.assignedAe)}</p>
        <p>Assignment status: ${esc(row.assignmentStatus)}</p>
        <p>Published inventory: ${esc(row.publishedInventory)}</p>
        <p>Bookings: ${esc(row.bookingCount)}</p>
        <p>Route packets: ${esc(row.routePacketCount)}</p>
      </div>`).join('')}
  </div>
  <div class="panel">
    <h2>AE Roster View</h2>
    <div class="grid">
      ${view.aeRows.map((row) => `
        <div class="card">
          <strong>${esc(row.name)}</strong>
          <p class="muted">${esc(row.title)}</p>
          <p>Lane: ${esc(row.lane)}</p>
          <p>Status: ${esc(row.status)}</p>
          <p>Assigned merchants: ${esc(row.assignedMerchantCount)}</p>
        </div>`).join('')}
    </div>
  </div>`;
