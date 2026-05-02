const state = {
  lead: null,
  session: null,
  slots: [],
  appointment: null,
};

function appendMessage(role, text) {
  const chatLog = document.getElementById('chat-log');
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;
  wrapper.innerHTML = `
    <div class="role">${role === 'assistant' ? 'Setter' : 'Lead'}</div>
    <div class="bubble">${escapeHtml(text)}</div>
  `;
  chatLog.appendChild(wrapper);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderAssignment() {
  if (!state.lead) return;
  const card = document.getElementById('assignment-card');
  card.hidden = false;
  document.getElementById('assigned-owner').textContent = state.lead.assigned_owner || 'Scheduling Desk';
  document.getElementById('assigned-meta').textContent = `Lead owner: ${state.lead.assigned_owner || 'Scheduling Desk'} · Status: ${state.lead.qualification_status || 'new'}`;
}

function renderSlots(slots = []) {
  state.slots = slots;
  const shell = document.getElementById('slot-list');
  shell.innerHTML = '';
  if (!slots.length) {
    shell.innerHTML = '<div class="empty-state">No openings are loaded yet. Qualify the lead and ask for availability to surface live slots.</div>';
    return;
  }

  slots.forEach((slot) => {
    const item = document.createElement('div');
    item.className = 'slot-item';
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(slot.display)}</strong>
        <small>${escapeHtml(slot.timezone)}</small>
      </div>
      <button type="button">Book this slot</button>
    `;
    item.querySelector('button').addEventListener('click', () => bookSlot(slot.start, slot.timezone));
    shell.appendChild(item);
  });
}

function setStatus(text, type = '') {
  const status = document.getElementById('live-status');
  status.textContent = text;
  status.className = `status-pill ${type}`.trim();
}

async function startSession(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Phoenix';
  if (currentOrgSlug()) payload.org_slug = currentOrgSlug();
  setStatus('Starting appointment lane…', 'warn');
  try {
    const data = await api('/api/chat/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.lead = data.lead;
    state.session = data.session;
    document.getElementById('chat-pane').hidden = false;
    document.getElementById('lead-intake').querySelectorAll('input, select, textarea, button').forEach((el) => {
      el.disabled = true;
    });
    renderAssignment();
    appendMessage('assistant', data.assistant.text);
    renderSlots(data.assistant.suggested_slots || []);
    setStatus(
      data.assistant.suggested_slots?.length
        ? `Lead routed to ${data.lead.assigned_owner || 'Scheduling Desk'} and ready to book.`
        : `Lead routed to ${data.lead.assigned_owner || 'Scheduling Desk'}.`,
      data.assistant.suggested_slots?.length ? 'success' : 'warn'
    );
  } catch (error) {
    setStatus(error.message, 'warn');
  }
}

async function sendMessage(event) {
  event.preventDefault();
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message || !state.session) return;
  appendMessage('user', message);
  input.value = '';
  setStatus('Setter is responding…', 'warn');
  try {
    const data = await api('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify({ session_id: state.session.id, message }),
    });
    state.lead = data.lead;
    renderAssignment();
    appendMessage('assistant', data.assistant.text);
    renderSlots(data.assistant.suggested_slots || []);
    setStatus(
      data.assistant.suggested_slots?.length
        ? 'Openings are live. Pick one to book.'
        : 'Lead record updated.',
      data.assistant.suggested_slots?.length ? 'success' : 'warn'
    );
  } catch (error) {
    setStatus(error.message, 'warn');
  }
}

async function loadAvailability() {
  if (!state.lead) return;
  const preferred = document.getElementById('preferred-preview').value.trim();
  setStatus('Loading live availability…', 'warn');
  try {
    const data = await api(withOrg(`/api/availability?preferred=${encodeURIComponent(preferred)}&timezone=${encodeURIComponent(state.lead.timezone || 'America/Phoenix')}`));
    renderSlots(data.slots || []);
    setStatus(data.slots?.length ? 'Live openings loaded.' : 'No openings available in that window.', data.slots?.length ? 'success' : 'warn');
  } catch (error) {
    setStatus(error.message, 'warn');
  }
}

async function bookSlot(start, timezone) {
  if (!state.lead || !state.session) return;
  setStatus('Booking slot…', 'warn');
  try {
    const data = await api('/api/appointments', {
      method: 'POST',
      body: JSON.stringify({
        lead_id: state.lead.id,
        session_id: state.session.id,
        start,
        timezone,
        notes: 'Booked from live slot picker',
      }),
    });
    state.appointment = data.appointment;
    const icsUrl = data.ics_url || `/api/appointments/${data.appointment.id}/ics?code=${encodeURIComponent(data.appointment.confirmation_code || '')}`;
    const manageUrl = data.manage_url || `/manage/index.html?code=${encodeURIComponent(data.appointment.confirmation_code || '')}`;
    const config = window.publicConfig || {};
    const bookingNotice = escapeHtml((config.settings || {}).booking_notice || '');
    document.getElementById('appointment-confirmation').innerHTML = `
      <div class="kicker">
        <strong>Appointment confirmed</strong>
        <div style="margin-top:8px">${escapeHtml(formatDateTime(data.appointment.start_ts))} · Confirmation ${escapeHtml(data.appointment.confirmation_code)}</div>
        ${bookingNotice ? `<div style="margin-top:8px">${bookingNotice}</div>` : ''}
        <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap">
          <a class="button-link" href="${escapeHtml(icsUrl)}">Download calendar file</a>
          <a class="button-link secondary" href="${escapeHtml(manageUrl)}">Manage appointment</a>
        </div>
      </div>
    `;
    renderSlots([]);
    setStatus('Appointment booked and locked.', 'success');
    appendMessage('assistant', `You are confirmed for ${formatDateTime(data.appointment.start_ts)}. Confirmation code ${data.appointment.confirmation_code}.`);
  } catch (error) {
    setStatus(error.message, 'warn');
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const config = await loadPublicConfig();
  if (!(config.features || {}).outbound) {
    const reminderCard = document.getElementById('public-reminder-card');
    if (reminderCard) reminderCard.classList.add('hidden');
  }
  document.getElementById('lead-intake').addEventListener('submit', startSession);
  document.getElementById('chat-form').addEventListener('submit', sendMessage);
  document.getElementById('show-availability').addEventListener('click', loadAvailability);
  renderSlots([]);
});
