function collect(form) { return Object.fromEntries(new FormData(form).entries()); }

async function refreshAe() {
  const [agents, merchants, bookings, packets] = await Promise.all([
    window.SKYECOM.api('/api/ae/roster'),
    window.SKYECOM.api('/api/ae/merchants'),
    window.SKYECOM.api('/api/ae/bookings'),
    window.SKYECOM.api('/api/ae/route-packets')
  ]);
  document.getElementById('agent-list').innerHTML = agents.agents.map((agent) => `<div class="list-item"><div><strong>${agent.display_name}</strong><div class="small">${agent.territory || 'No territory'}</div></div><span>${agent.email || ''}</span></div>`).join('') || '<p class="small">No agents yet.</p>';
  document.getElementById('merchant-list').innerHTML = merchants.merchants.map((merchant) => `<div class="list-item"><div><strong>${merchant.brandName}</strong><div class="small">${merchant.slug}</div></div><span>${merchant.email}</span></div>`).join('') || '<p class="small">No merchants yet.</p>';
  document.getElementById('booking-list').innerHTML = bookings.bookings.map((booking) => `<div class="list-item"><div><strong>${booking.booking_date}</strong><div class="small">${booking.location || 'No location'} · ${booking.status}</div></div><span>${booking.contact_name || ''}</span></div>`).join('') || '<p class="small">No bookings yet.</p>';
  const agentSelects = [document.getElementById('booking-agent'), document.getElementById('route-agent')];
  agentSelects.forEach((select) => {
    select.innerHTML = agents.agents.map((agent) => `<option value="${agent.id}">${agent.display_name}</option>`).join('');
  });
  document.getElementById('booking-merchant').innerHTML = merchants.merchants.map((merchant) => `<option value="${merchant.id}">${merchant.brandName}</option>`).join('');
  document.getElementById('route-output').innerHTML = packets.packets.slice(0, 3).map((packet) => `<div class="card"><div class="eyebrow">${packet.routeDate}</div><pre class="small">${JSON.stringify(packet.packet, null, 2)}</pre></div>`).join('') || '<p class="small">No route packets yet.</p>';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ae-login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/ae/login', { method: 'POST', body: JSON.stringify(collect(event.target)) });
      window.SKYECOM.status('ae-status', 'AE command unlocked.', 'good');
      await refreshAe();
    } catch (error) {
      window.SKYECOM.status('ae-status', error.message, 'bad');
    }
  });
  document.getElementById('agent-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/ae/roster', { method: 'POST', body: JSON.stringify(collect(event.target)) });
      window.SKYECOM.status('ae-status', 'Agent added.', 'good');
      event.target.reset();
      await refreshAe();
    } catch (error) {
      window.SKYECOM.status('ae-status', error.message, 'bad');
    }
  });
  document.getElementById('booking-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await window.SKYECOM.api('/api/ae/bookings', { method: 'POST', body: JSON.stringify(collect(event.target)) });
      window.SKYECOM.status('ae-status', 'Booking created.', 'good');
      await refreshAe();
    } catch (error) {
      window.SKYECOM.status('ae-status', error.message, 'bad');
    }
  });
  document.getElementById('route-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = await window.SKYECOM.api('/api/ae/route-packets/generate', { method: 'POST', body: JSON.stringify(collect(event.target)) });
      window.SKYECOM.status('ae-status', `Route packet generated with ${data.packet.stopCount} stops.`, 'good');
      await refreshAe();
    } catch (error) {
      window.SKYECOM.status('ae-status', error.message, 'bad');
    }
  });
});
