let authUser = null;
let pageConfig = { features: {} };

function byId(id) {
  return document.getElementById(id);
}

function setHidden(id, hidden) {
  const el = byId(id);
  if (el) el.classList.toggle('hidden', !!hidden);
}

function featureEnabled(name) {
  return !!(pageConfig.features || {})[name];
}

function applyFeatureVisibility() {
  setHidden('diag-outbound-panel', !featureEnabled('outbound'));
  setHidden('diag-voice-panel', !featureEnabled('voice'));
  setHidden('diag-calendar-panel', !featureEnabled('calendar'));
  const title = byId('diagnostics-title');
  if (title) {
    const parts = ['health', 'runtime'];
    if (featureEnabled('outbound')) parts.push('outbound');
    if (featureEnabled('voice')) parts.push('voice');
    if (featureEnabled('calendar')) parts.push('calendar');
    title.textContent = parts.join(' · ');
  }
}

function renderAuthPill() {
  const el = byId('diag-auth-pill');
  el.textContent = authUser ? `${authUser.display_name} · ${authUser.role}` : 'Not logged in';
  el.className = `status-pill ${authUser?.role === 'admin' ? 'success' : authUser?.role === 'manager' ? 'warn' : ''}`.trim();
}

async function refreshDiagnostics() {
  const [health, summary, reminders, analytics, outbound, voice, calendar, runtime, audit] = await Promise.all([
    api(withOrg('/api/health')),
    api(withOrg('/api/admin/summary')),
    api(withOrg('/api/reminders/preview')),
    api(withOrg('/api/admin/analytics')),
    featureEnabled('outbound') ? api(withOrg('/api/outbound/history?limit=20')) : Promise.resolve({ messages: [] }),
    featureEnabled('voice') ? api(withOrg('/api/admin/voice/calls?limit=20')) : Promise.resolve({ calls: [] }),
    featureEnabled('calendar') ? api(withOrg('/api/admin/calendar/status')) : Promise.resolve({ providers: [], links: [], logs: [] }),
    api(withOrg('/api/admin/runtime')),
    api(withOrg('/api/admin/audit?limit=50')),
  ]);

  byId('health-json').textContent = JSON.stringify(health, null, 2);
  byId('summary-json').textContent = JSON.stringify(summary.summary, null, 2);
  byId('analytics-json').textContent = JSON.stringify({
    analytics: analytics.analytics,
    risk_board: analytics.risk_board,
  }, null, 2);
  if (byId('outbound-json')) byId('outbound-json').textContent = JSON.stringify(outbound.messages, null, 2);
  if (byId('voice-json')) byId('voice-json').textContent = JSON.stringify(voice.calls, null, 2);
  if (byId('calendar-json')) byId('calendar-json').textContent = JSON.stringify(calendar, null, 2);
  byId('runtime-json').textContent = JSON.stringify(runtime, null, 2);
  byId('audit-json').textContent = JSON.stringify(audit.events || [], null, 2);

  const reminderShell = byId('reminder-shell');
  if (!reminders.reminders.length) {
    reminderShell.innerHTML = '<div class="empty-state">No reminders queued for the next 24 hours.</div>';
    return;
  }
  reminderShell.innerHTML = reminders.reminders.map((item) => `
    <div class="transcript-card">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap">
        <strong>${escapeHtml(item.lead_name)}</strong>
        <span class="status-pill">${escapeHtml(item.type)} · ${escapeHtml(item.channel)}</span>
      </div>
      <div style="margin-top:8px; color:var(--muted)">${escapeHtml(item.recipient || '')}</div>
      <div style="margin-top:10px; line-height:1.55">${escapeHtml(item.body || '')}</div>
    </div>
  `).join('');
}

window.addEventListener('DOMContentLoaded', async () => {
  pageConfig = await loadPublicConfig();
  applyFeatureVisibility();
  const me = await authMe();
  authUser = me.user;
  renderAuthPill();
  await refreshDiagnostics();
  byId('refresh-diagnostics').addEventListener('click', refreshDiagnostics);
  byId('logout-link').addEventListener('click', async (event) => {
    event.preventDefault();
    await logout();
  });
});
