let leadCache = [];
let appointmentCache = [];
let orgCache = [];
let repCache = [];
let manualSlotCache = [];
let selectedLeadId = null;
let selectedLeadIds = new Set();
let authUser = null;
let pageConfig = { features: {} };
let leadFilters = { query: '', status: '', source: '', rep: '', tag: '' };
let serviceCache = [];
let packageCache = [];
let quoteCache = [];
let membershipCache = [];
let escalationCache = [];
let savedViewCache = [];
let playbookCache = [];
let documentCache = [];
let artifactCache = [];
let orgPresetCache = [];
let artifactSelection = new Set();
let artifactShowDeleted = false;

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

function formatMoneyFromCents(cents) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: (pageConfig.settings?.currency || 'USD') }).format((Number(cents || 0)) / 100);
}

function usdToCents(value) {
  return Math.max(0, Math.round(Number(value || 0) * 100));
}

function voiceModeLabel(value) {
  if (value === 'voice-webhook') return 'provider';
  return value || 'disabled';
}

function selectedOrgId() {
  const value = byId('org-filter').value;
  return value ? Number(value) : null;
}

function scopePath(path) {
  const orgId = selectedOrgId();
  if (!orgId) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}org_id=${encodeURIComponent(orgId)}`;
}

function can(role) {
  const rank = { viewer: 1, manager: 2, admin: 3 };
  return (rank[authUser?.role || 'viewer'] || 0) >= (rank[role] || 0);
}

function applyFeatureVisibility() {
  const features = pageConfig.features || {};
  setHidden('voice-actions-shell', !features.voice);
  setHidden('voice-history-panel', !features.voice);
  setHidden('voice-summary-card', !features.voice);
  setHidden('calendar-panel', !features.calendar);
  setHidden('calendar-summary-card', !features.calendar);
  setHidden('manual-outbound-panel', !features.outbound);
  setHidden('inbox-panel', !features.inbound);
  setHidden('inbound-summary-card', !features.inbound);
  setHidden('outbound-panel', !features.outbound);
  setHidden('outbound-summary-card', !features.outbound);
  setHidden('outbound-sent-summary-card', !features.outbound);
  const overview = byId('overview-title');
  if (overview) {
    const parts = ['lead intake', 'booking'];
    if (features.outbound) parts.push('reminders');
    if (features.voice) parts.push('voice');
    if (features.calendar) parts.push('calendar sync');
    overview.textContent = `Live pipeline and working controls${parts.length ? ' · ' + parts.join(' · ') : ''}`;
  }
  const appointmentsTitle = byId('appointments-title');
  if (appointmentsTitle) {
    appointmentsTitle.textContent = features.calendar ? 'Book, move, cancel, and sync' : 'Book, move, and cancel';
  }
}

function populateOutboundChannels() {
  const select = byId('manual-outbound-channel');
  if (!select) return;
  const channels = (pageConfig.features && pageConfig.features.outbound_channels) || [];
  const prior = select.value;
  select.innerHTML = '';
  channels.forEach((channel) => {
    const option = document.createElement('option');
    option.value = channel;
    option.textContent = channel === 'sms' ? 'SMS' : 'Email';
    select.appendChild(option);
  });
  if (!channels.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No delivery configured';
    select.appendChild(option);
    select.disabled = true;
    return;
  }
  select.disabled = false;
  if (prior && channels.includes(prior)) select.value = prior;
}

function renderAuthPill() {
  const el = byId('auth-pill');
  el.textContent = authUser ? `${authUser.display_name} · ${authUser.role}` : 'Not logged in';
  el.className = `status-pill ${authUser?.role === 'admin' ? 'success' : authUser?.role === 'manager' ? 'warn' : ''}`.trim();
  if (byId('queue-reminders')) byId('queue-reminders').disabled = !can('manager');
  if (byId('dispatch-outbound')) byId('dispatch-outbound').disabled = !can('manager');
  if (byId('sync-calendars')) byId('sync-calendars').disabled = !can('manager');
  if (byId('voice-followup')) byId('voice-followup').disabled = !can('manager');
  if (byId('voice-reminder')) byId('voice-reminder').disabled = !can('manager');
  if (byId('save-settings')) byId('save-settings').disabled = !can('admin');
  if (byId('org-create-submit')) byId('org-create-submit').disabled = !can('admin');
  if (byId('rep-create-submit')) byId('rep-create-submit').disabled = !can('admin');
  if (byId('rep-save-submit')) byId('rep-save-submit').disabled = !can('admin');
  if (byId('save-lead')) byId('save-lead').disabled = !can('manager');
  if (byId('create-lead')) byId('create-lead').disabled = !can('manager');
  if (byId('manual-book')) byId('manual-book').disabled = !can('manager');
  if (byId('refresh-manual-slots')) byId('refresh-manual-slots').disabled = !can('manager');
  if (byId('manual-outbound-queue')) byId('manual-outbound-queue').disabled = !can('manager');
  if (byId('manual-outbound-send')) byId('manual-outbound-send').disabled = !can('manager');
}

function renderOrgFilter(orgs) {
  orgCache = orgs;
  const select = byId('org-filter');
  const prior = select.value;
  select.innerHTML = '<option value="">All desks</option>';
  orgs.forEach((org) => {
    const option = document.createElement('option');
    option.value = org.id;
    option.textContent = org.name;
    select.appendChild(option);
  });
  if (prior && [...select.options].some((opt) => opt.value === prior)) {
    select.value = prior;
  }
}

function syncOrgPresetSummary() {
  const shell = byId('org-preset-summary');
  const slug = byId('org-create-preset')?.value || '';
  if (!shell) return;
  const preset = orgPresetCache.find((item) => item.slug === slug);
  if (!preset) {
    shell.innerHTML = '<strong>No preset selected</strong><span>Choose a preset pack to preview the services, packages, playbooks, and rep templates that will be seeded into the new desk.</span>';
    return;
  }
  shell.innerHTML = `<strong>${escapeHtml(preset.name || preset.slug || 'Preset pack')}</strong><span>${escapeHtml(preset.description || '')}</span><span>${escapeHtml(String(preset.service_count || 0))} services · ${escapeHtml(String(preset.package_count || 0))} packages · ${escapeHtml(String(preset.playbook_count || 0))} playbooks · ${escapeHtml(String(preset.rep_count || 0))} preset reps</span><span>${escapeHtml((preset.service_names || []).slice(0, 2).join(' · ') || 'Services seed when this pack is applied.')}</span>`;
}

function renderOrgPresets(presets = []) {
  orgPresetCache = presets || [];
  const createSelect = byId('org-create-preset');
  const readinessSelect = byId('readiness-preset-select');
  if (createSelect) {
    const prior = createSelect.value;
    createSelect.innerHTML = '<option value="">None</option>';
    orgPresetCache.forEach((preset) => {
      const option = document.createElement('option');
      option.value = preset.slug;
      option.textContent = `${preset.name}${preset.description ? ` · ${preset.description}` : ''}`;
      createSelect.appendChild(option);
    });
    if (prior && [...createSelect.options].some((opt) => opt.value === prior)) createSelect.value = prior;
  }
  if (readinessSelect) {
    const prior = readinessSelect.value;
    readinessSelect.innerHTML = '';
    orgPresetCache.forEach((preset) => {
      const option = document.createElement('option');
      option.value = preset.slug;
      option.textContent = `${preset.name}${preset.description ? ` · ${preset.description}` : ''}`;
      readinessSelect.appendChild(option);
    });
    if (!readinessSelect.options.length) readinessSelect.innerHTML = '<option value="">No presets available</option>';
    if (prior && [...readinessSelect.options].some((opt) => opt.value === prior)) readinessSelect.value = prior;
    if (!readinessSelect.value && readinessSelect.options.length) readinessSelect.value = readinessSelect.options[0].value;
  }
  syncOrgPresetSummary();
}

function renderOrgReadiness(readiness) {
  const shell = byId('org-readiness-shell');
  if (!shell) return;
  if (!readiness || !readiness.org) {
    shell.innerHTML = '<div class="empty-state">Choose a desk to inspect rollout readiness.</div>';
    return;
  }
  const items = readiness.items || [];
  shell.innerHTML = `
    <div class="mini-grid">
      <div class="mini-card"><strong>${escapeHtml(String(readiness.percent_complete || 0))}%</strong><span>Ready</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(readiness.completed_count || 0))}/${escapeHtml(String(readiness.total_count || 0))}</strong><span>Checklist items</span></div>
      <div class="mini-card"><strong>${escapeHtml(String((readiness.counts || {}).services || 0))}</strong><span>Services</span></div>
      <div class="mini-card"><strong>${escapeHtml(String((readiness.counts || {}).reps || 0))}</strong><span>Reps</span></div>
    </div>
    <div class="stack">
      ${items.map((item) => `<div class="mini-card"><strong>${item.done ? '✅' : '•'} ${escapeHtml(item.label || '')}</strong><span>${escapeHtml(item.detail || '')}</span></div>`).join('')}
    </div>
    ${(readiness.next_steps || []).length ? `<div class="mini-card"><strong>Next focus</strong><span>${escapeHtml((readiness.next_steps || []).join(' · '))}</span></div>` : '<div class="mini-card"><strong>Desk is staged cleanly</strong><span>No rollout blockers are currently open in the readiness checklist.</span></div>'}
  `;
}

function renderOrgOnboardingPlan(plan) {
  const shell = byId('org-onboarding-plan-shell');
  if (!shell) return;
  if (!plan || !plan.org) {
    shell.innerHTML = '<div class="empty-state">Choose a desk to inspect the onboarding plan.</div>';
    return;
  }
  const stages = plan.stages || [];
  shell.innerHTML = `
    <div class="mini-card">
      <strong>${escapeHtml((plan.org || {}).name || 'Desk onboarding plan')}</strong>
      <span>${escapeHtml(plan.summary_text || '')}</span>
      <span>${escapeHtml(((plan.preset || {}).name || 'Preset'))}${(plan.preset || {}).description ? ` · ${escapeHtml((plan.preset || {}).description || '')}` : ''}</span>
    </div>
    ${stages.map((stage) => `
      <div class="mini-card">
        <strong>${stage.complete ? '✅' : '•'} ${escapeHtml(stage.title || '')}</strong>
        <span>${escapeHtml(stage.description || '')}</span>
        <span>${escapeHtml(String(stage.done_count || 0))}/${escapeHtml(String(stage.total_count || 0))} tasks · ${escapeHtml(String(stage.percent_complete || 0))}% complete</span>
        ${(stage.next_actions || []).length ? `<span>Next actions: ${escapeHtml((stage.next_actions || []).join(' · '))}</span>` : '<span>This stage is staged cleanly.</span>'}
        ${stage.preset_hint ? `<span>${escapeHtml(stage.preset_hint)}</span>` : ''}
        <div class="stack" style="margin-top:8px">
          ${(stage.tasks || []).map((task) => `<div class="mini-card"><strong>${task.done ? '✅' : '•'} ${escapeHtml(task.label || '')}</strong><span>${escapeHtml(task.detail || '')}</span></div>`).join('')}
        </div>
      </div>
    `).join('')}
  `;
}

function renderSummary(summary) {
  byId('lead-count').textContent = summary.lead_count;
  byId('qualified-count').textContent = summary.qualified_count;
  byId('booked-count').textContent = summary.booked_count;
  byId('cancelled-count').textContent = summary.cancelled_count;
  if (byId('inbound-message-count')) byId('inbound-message-count').textContent = summary.inbound_message_count || 0;
  if (byId('queued-outbound-count')) byId('queued-outbound-count').textContent = summary.queued_outbound_count;
  if (byId('sent-outbound-count')) byId('sent-outbound-count').textContent = summary.sent_outbound_count;
  if (byId('voice-call-count')) byId('voice-call-count').textContent = summary.voice_call_count;
  if (byId('calendar-link-count')) byId('calendar-link-count').textContent = summary.calendar_link_count;
  if (byId('invoiced-total')) byId('invoiced-total').textContent = formatMoneyFromCents(summary.invoiced_cents || 0);
  if (byId('paid-total')) byId('paid-total').textContent = formatMoneyFromCents(summary.paid_cents || 0);
  if (byId('outstanding-total')) byId('outstanding-total').textContent = formatMoneyFromCents(summary.outstanding_cents || 0);
}

function parseTagCsv(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function currentLeadIdList() {
  return [...selectedLeadIds].map((item) => Number(item)).filter(Boolean);
}

function renderLeadSelectionSummary() {
  const total = currentLeadIdList().length;
  const summary = byId('lead-selection-summary');
  if (summary) summary.textContent = total ? `${total} lead${total === 1 ? '' : 's'} selected.` : 'No leads selected.';
}

function populateLeadFilterControls(leads) {
  const sourceSelect = byId('lead-source-filter');
  const repSelect = byId('lead-rep-filter');
  const bulkRep = byId('bulk-rep');
  if (sourceSelect) {
    const prior = sourceSelect.value;
    const values = [...new Set((leads || []).map((lead) => String(lead.source || '').trim()).filter(Boolean))].sort();
    sourceSelect.innerHTML = '<option value="">All sources</option>' + values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    if (values.includes(prior)) sourceSelect.value = prior;
  }
  const repOptions = ['<option value="">All reps</option>']
    .concat((repCache || []).map((rep) => `<option value="${rep.id}">${escapeHtml(rep.name || 'Rep')}</option>`));
  if (repSelect) {
    const prior = repSelect.value;
    repSelect.innerHTML = repOptions.join('');
    if ([...repSelect.options].some((opt) => opt.value === prior)) repSelect.value = prior;
  }
  if (bulkRep) {
    const prior = bulkRep.value;
    bulkRep.innerHTML = ['<option value="">Bulk assign rep…</option>']
      .concat((repCache || []).map((rep) => `<option value="${rep.id}">${escapeHtml(rep.name || 'Rep')}</option>`))
      .join('');
    if ([...bulkRep.options].some((opt) => opt.value === prior)) bulkRep.value = prior;
  }
}

function currentLeadFilters() {
  return {
    query: (byId('lead-search')?.value || '').trim().toLowerCase(),
    status: (byId('lead-status-filter')?.value || '').trim().toLowerCase(),
    source: (byId('lead-source-filter')?.value || '').trim().toLowerCase(),
    rep: (byId('lead-rep-filter')?.value || '').trim(),
    tag: (byId('lead-tag-filter')?.value || '').trim().toLowerCase(),
  };
}

function filteredLeads(leads) {
  const filters = currentLeadFilters();
  leadFilters = filters;
  const requiredTags = parseTagCsv(filters.tag).map((item) => item.toLowerCase());
  return (leads || []).filter((lead) => {
    const tags = (lead.tags || []).map((item) => String(item || '').trim()).filter(Boolean);
    const haystack = [lead.name, lead.email, lead.phone, lead.business_name, lead.service_interest, lead.assigned_owner, lead.source, tags.join(' ')]
      .map((item) => String(item || '').toLowerCase())
      .join(' ');
    const queryOk = !filters.query || haystack.includes(filters.query);
    const statusOk = !filters.status || String(lead.qualification_status || '').toLowerCase() === filters.status;
    const sourceOk = !filters.source || String(lead.source || '').toLowerCase() === filters.source;
    const repOk = !filters.rep || String(lead.assigned_rep_id || '') === filters.rep;
    const tagOk = !requiredTags.length || requiredTags.every((tag) => tags.map((item) => item.toLowerCase()).includes(tag));
    return queryOk && statusOk && sourceOk && repOk && tagOk;
  });
}

function renderLeads(leads) {
  leadCache = leads;
  selectedLeadIds = new Set(currentLeadIdList().filter((id) => leadCache.some((lead) => lead.id === id)));
  populateLeadFilterControls(leads);
  const visibleLeads = filteredLeads(leads);
  const tbody = byId('leads-tbody');
  tbody.innerHTML = '';
  if (!visibleLeads.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">${leadCache.length ? 'No leads match the current filter.' : 'No leads yet.'}</div></td></tr>`;
    renderLeadSelectionSummary();
    return;
  }
  visibleLeads.forEach((lead) => {
    const tr = document.createElement('tr');
    const tags = (lead.tags || []).map((item) => String(item || '').trim()).filter(Boolean);
    tr.innerHTML = `
      <td><input type="checkbox" data-select-lead="${lead.id}" ${selectedLeadIds.has(lead.id) ? 'checked' : ''} /></td>
      <td><button class="secondary" type="button" data-open-lead="${lead.id}">Open</button></td>
      <td>
        <strong>${escapeHtml(lead.name || '—')}</strong>
        <div class="footer-note">${escapeHtml(lead.source || '—')}</div>
      </td>
      <td>${escapeHtml(lead.assigned_owner || '—')}</td>
      <td>
        <div>${escapeHtml(lead.service_interest || '—')}</div>
        ${tags.length ? `<div class="footer-note">${escapeHtml(tags.join(', '))}</div>` : ''}
      </td>
      <td>${escapeHtml(lead.qualification_status || 'new')}</td>
      <td>${escapeHtml(lead.urgency || '—')}</td>
      <td>${escapeHtml(lead.email || lead.phone || '—')}</td>
    `;
    tr.querySelector('[data-open-lead]').addEventListener('click', () => loadTranscript(lead.id));
    tr.querySelector('[data-select-lead]').addEventListener('change', (event) => {
      if (event.target.checked) selectedLeadIds.add(lead.id);
      else selectedLeadIds.delete(lead.id);
      renderLeadSelectionSummary();
      const master = byId('lead-select-all');
      if (master) master.checked = visibleLeads.length > 0 && visibleLeads.every((item) => selectedLeadIds.has(item.id));
    });
    tbody.appendChild(tr);
  });
  const master = byId('lead-select-all');
  if (master) {
    master.checked = visibleLeads.length > 0 && visibleLeads.every((item) => selectedLeadIds.has(item.id));
  }
  renderLeadSelectionSummary();
}

function renderAppointments(appointments) {
  appointmentCache = appointments;
  const tbody = byId('appointments-tbody');
  tbody.innerHTML = '';
  if (!appointments.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">No appointments yet.</div></td></tr>';
    return;
  }
  appointments.forEach((appt) => {
    const lead = leadCache.find((item) => item.id === appt.lead_id) || {};
    const icsUrl = `/api/appointments/${appt.id}/ics`;
    const actions = [
      '<button class="secondary" type="button" data-action="move">Move +1 Day</button>',
      '<a class="secondary button-link" data-action="ics" href="' + icsUrl + '">Calendar file</a>',
      featureEnabled('calendar') ? '<button class="secondary" type="button" data-action="sync">Sync</button>' : '',
      '<button class="secondary" type="button" data-action="confirm">Confirm</button>',
      '<button class="secondary" type="button" data-action="complete">Done</button>',
      '<button class="secondary" type="button" data-action="no-show">No-show</button>',
      '<button class="danger" type="button" data-action="cancel">Cancel</button>',
    ].filter(Boolean).join('');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(lead.name || 'Lead')}</td>
      <td>${escapeHtml(lead.assigned_owner || '—')}</td>
      <td>${escapeHtml(formatDateTime(appt.start_ts))}</td>
      <td>${escapeHtml(appt.status || 'booked')}</td>
      <td>${escapeHtml(appt.timezone || '')}</td>
      <td>${escapeHtml(appt.confirmation_code || '')}</td>
      <td>
        <div style="display:flex; gap:8px; flex-wrap:wrap">
          ${actions}
        </div>
      </td>
    `;
    const managerDisabled = !can('manager');
    tr.querySelector('[data-action="move"]').disabled = managerDisabled || ['cancelled', 'completed', 'no_show'].includes(appt.status);
    tr.querySelector('[data-action="cancel"]').disabled = managerDisabled || ['cancelled', 'completed'].includes(appt.status);
    tr.querySelector('[data-action="confirm"]').disabled = managerDisabled || ['confirmed', 'cancelled', 'completed', 'no_show'].includes(appt.status);
    tr.querySelector('[data-action="complete"]').disabled = managerDisabled || ['completed', 'cancelled', 'no_show'].includes(appt.status);
    tr.querySelector('[data-action="no-show"]').disabled = managerDisabled || ['completed', 'cancelled', 'no_show'].includes(appt.status);
    tr.querySelector('[data-action="move"]').addEventListener('click', () => rescheduleOneDay(appt.id, appt.start_ts, appt.timezone));
    tr.querySelector('[data-action="cancel"]').addEventListener('click', () => cancelAppointment(appt.id));
    tr.querySelector('[data-action="confirm"]').addEventListener('click', () => updateAppointmentStatus(appt.id, 'confirmed'));
    tr.querySelector('[data-action="complete"]').addEventListener('click', () => updateAppointmentStatus(appt.id, 'completed'));
    tr.querySelector('[data-action="no-show"]').addEventListener('click', () => updateAppointmentStatus(appt.id, 'no_show'));
    const icsLink = tr.querySelector('[data-action="ics"]');
    if (icsLink) {
      if (!can('viewer')) icsLink.classList.add('disabled');
    }
    const syncButton = tr.querySelector('[data-action="sync"]');
    if (syncButton) {
      syncButton.disabled = managerDisabled;
      syncButton.addEventListener('click', () => syncOneAppointment(appt.id));
    }
    tbody.appendChild(tr);
  });
}

function renderLeadRepOptions(reps) {
  const select = byId('lead-assigned-rep');
  if (!select) return;
  const prior = select.value;
  select.innerHTML = '<option value="">Auto-assign</option>';
  (reps || []).forEach((rep) => {
    const option = document.createElement('option');
    option.value = String(rep.id);
    option.textContent = `${rep.name} · ${rep.role || 'setter'}`;
    select.appendChild(option);
  });
  if (prior && [...select.options].some((option) => option.value === prior)) select.value = prior;
}

function renderRepEditorOptions(reps) {
  const select = byId('rep-editor-select');
  if (!select) return;
  const prior = select.value;
  select.innerHTML = '<option value="">Create new rep</option>';
  (reps || []).forEach((rep) => {
    const option = document.createElement('option');
    option.value = String(rep.id);
    option.textContent = `${rep.name} · ${rep.role || 'setter'}`;
    select.appendChild(option);
  });
  if (prior && [...select.options].some((option) => option.value === prior)) {
    select.value = prior;
    fillRepEditorForm(Number(prior));
  }
}

function renderReps(reps, analytics = {}) {
  repCache = reps || [];
  renderLeadRepOptions(repCache);
  renderRepEditorOptions(repCache);
  const shell = byId('rep-board');
  shell.innerHTML = '';
  if (!reps.length) {
    shell.innerHTML = '<div class="empty-state">No active reps found.</div>';
  } else {
    reps.forEach((rep) => {
      const load = analytics.rep_load?.[rep.name] || 0;
      const commissionPct = Number(rep.commission_rate_bps || 0) / 100;
      const item = document.createElement('div');
      item.className = 'mini-card';
      item.innerHTML = `
        <strong>${escapeHtml(rep.name)}</strong>
        <span>${escapeHtml(rep.role || 'setter')} · active leads ${escapeHtml(load)} · ${escapeHtml(commissionPct.toFixed(2))}% commission</span>
      `;
      shell.appendChild(item);
    });
  }

  const cards = [
    `<div class="mini-card"><strong>${escapeHtml(analytics.booked_rate || 0)}%</strong><span>Lead → booked rate</span></div>`,
    `<div class="mini-card"><strong>${escapeHtml(analytics.qualification_rate || 0)}%</strong><span>Lead → qualified rate</span></div>`,
    `<div class="mini-card"><strong>${escapeHtml(analytics.cancellation_rate || 0)}%</strong><span>Cancellation rate</span></div>`,
  ];
  if (featureEnabled('voice')) {
    cards.push(`<div class="mini-card"><strong>${escapeHtml(analytics.voice_call_count || 0)}</strong><span>Voice calls</span></div>`);
  }
  byId('analytics-board').innerHTML = cards.join('');
}

function renderRepScorecards(scorecards) {
  const shell = byId('rep-scorecards-shell');
  if (!shell) return;
  shell.innerHTML = '';
  if (!scorecards || !scorecards.length) {
    shell.innerHTML = '<div class="empty-state">No rep scorecards yet.</div>';
    return;
  }
  scorecards.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'transcript-card';
    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap">
        <strong>${escapeHtml(item.name)}</strong>
        <span class="status-pill">${escapeHtml(item.role || 'setter')}</span>
      </div>
      <div class="mini-grid" style="margin-top:12px">
        <div class="mini-card"><strong>${escapeHtml(item.assigned_leads || 0)}</strong><span>Assigned leads</span></div>
        <div class="mini-card"><strong>${escapeHtml(item.booked_appointments || 0)}</strong><span>Booked</span></div>
        <div class="mini-card"><strong>${escapeHtml(item.completed_appointments || 0)}</strong><span>Completed</span></div>
        <div class="mini-card"><strong>${escapeHtml(item.lead_to_booked_rate || 0)}%</strong><span>Lead → booked</span></div>
        <div class="mini-card"><strong>${escapeHtml(formatMoneyFromCents(item.paid_cents || 0))}</strong><span>Paid revenue</span></div>
        <div class="mini-card"><strong>${escapeHtml(formatMoneyFromCents(item.estimated_commission_cents || 0))}</strong><span>Commission est.</span></div>
      </div>
      <div style="margin-top:10px; color:var(--muted)">Target ${escapeHtml(formatMoneyFromCents(item.target_monthly_cents || 0))} · attainment ${escapeHtml(item.target_attainment_pct || 0)}% · outstanding ${escapeHtml(formatMoneyFromCents(item.outstanding_cents || 0))}</div>
    `;
    shell.appendChild(card);
  });
}

function renderSourceAttribution(rows) {
  const shell = byId('source-attribution-shell');
  if (!shell) return;
  shell.innerHTML = '';
  if (!rows || !rows.length) {
    shell.innerHTML = '<div class="empty-state">No source attribution data yet.</div>';
    return;
  }
  rows.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'transcript-card';
    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap">
        <strong>${escapeHtml(item.source || 'unknown')}</strong>
        <span class="status-pill">${escapeHtml(item.lead_to_booked_rate || 0)}% booked</span>
      </div>
      <div class="mini-grid" style="margin-top:12px">
        <div class="mini-card"><strong>${escapeHtml(item.lead_count || 0)}</strong><span>Leads</span></div>
        <div class="mini-card"><strong>${escapeHtml(item.booked_count || 0)}</strong><span>Booked</span></div>
        <div class="mini-card"><strong>${escapeHtml(item.completed_count || 0)}</strong><span>Completed</span></div>
        <div class="mini-card"><strong>${escapeHtml(formatMoneyFromCents(item.paid_cents || 0))}</strong><span>Paid</span></div>
      </div>
      <div style="margin-top:10px; color:var(--muted)">Qualified ${escapeHtml(item.qualified_count || 0)} · outstanding ${escapeHtml(formatMoneyFromCents(item.outstanding_cents || 0))} · lead → completed ${escapeHtml(item.lead_to_completed_rate || 0)}%</div>
    `;
    shell.appendChild(card);
  });
}

function renderRiskBoard(items) {
  const shell = byId('risk-board');
  shell.innerHTML = '';
  if (!items.length) {
    shell.innerHTML = '<div class="empty-state">No risk board data yet.</div>';
    return;
  }
  items.slice(0, 8).forEach((item) => {
    const card = document.createElement('div');
    card.className = 'transcript-card';
    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap">
        <strong>${escapeHtml(item.name)}</strong>
        <span class="status-pill ${item.label === 'high' ? 'warn' : item.label === 'medium' ? '' : 'success'}">${escapeHtml(item.label)} risk · ${escapeHtml(item.score)}</span>
      </div>
      <div style="margin-top:8px; color:var(--muted)">${escapeHtml(item.assigned_owner || '—')} · ${escapeHtml(item.service_interest || '—')}</div>
      <div style="margin-top:10px; line-height:1.55">${escapeHtml((item.reasons || []).join(' · ') || 'No risk reasons.')}</div>
    `;
    shell.appendChild(card);
  });
}

function renderOutbound(messages) {
  const tbody = byId('outbound-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!messages.length) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">No outbound messages yet.</div></td></tr>';
    return;
  }
  messages.forEach((msg) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(msg.id)}</td>
      <td>${escapeHtml(msg.channel)}</td>
      <td>${escapeHtml(msg.recipient)}</td>
      <td>${escapeHtml(msg.status)}</td>
      <td>${escapeHtml(msg.transport || '—')}</td>
      <td>${escapeHtml(msg.created_at || '')}</td>
      <td style="max-width:420px">${escapeHtml(msg.body || '')}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderVoiceCalls(calls) {
  const tbody = byId('voice-calls-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!calls.length) {
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state">No voice calls yet.</div></td></tr>';
    return;
  }
  calls.forEach((call) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(call.id)}</td>
      <td>${escapeHtml(call.direction || '')}</td>
      <td>${escapeHtml(call.purpose || '')}</td>
      <td>${escapeHtml(call.status || '')}</td>
      <td>${escapeHtml(voiceModeLabel(call.provider))}</td>
      <td>${escapeHtml(call.to_number || '')}</td>
      <td>${escapeHtml(call.outcome || '')}</td>
      <td style="max-width:420px">${escapeHtml(call.transcript || '')}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderCalendarStatus(data) {
  const shell = byId('calendar-status');
  if (!shell) return;
  shell.innerHTML = '';
  const providers = (data.providers || []).filter((item) => item.configured);
  if (!providers.length) {
    shell.innerHTML = '<div class="empty-state">No connected calendars.</div>';
    return;
  }
  providers.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'mini-card';
    card.innerHTML = `
      <strong>${escapeHtml(item.provider)}</strong>
      <span>calendar ${escapeHtml(item.calendar_id)} · links ${escapeHtml(item.synced_event_count)}</span>
    `;
    shell.appendChild(card);
  });
}


function renderLeadTimeline(items) {
  const shell = byId('lead-timeline-shell');
  if (!shell) return;
  shell.innerHTML = '';
  if (!items.length) {
    shell.innerHTML = '<div class="empty-state">No activity yet for this lead.</div>';
    return;
  }
  items.slice(0, 14).forEach((item) => {
    const card = document.createElement('div');
    card.className = 'transcript-card';
    const status = item.status ? `<span class="status-pill">${escapeHtml(item.status)}</span>` : '';
    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap">
        <strong>${escapeHtml(item.title || item.kind || 'Activity')}</strong>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
          ${status}
          <span style="color:var(--muted)">${escapeHtml(item.created_at || '')}</span>
        </div>
      </div>
      <div style="margin-top:8px; line-height:1.55">${escapeHtml(item.detail || '')}</div>
    `;
    shell.appendChild(card);
  });
}

async function loadLeadTimeline(leadId) {
  const shell = byId('lead-timeline-shell');
  if (!shell) return;
  if (!leadId) {
    shell.innerHTML = '<div class="empty-state">Open a lead to inspect activity.</div>';
    return;
  }
  shell.innerHTML = '<div class="empty-state">Loading activity…</div>';
  try {
    const data = await api(`/api/admin/leads/${leadId}/timeline`);
    renderLeadTimeline(data.timeline || []);
  } catch (error) {
    shell.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}


function clearLeadEditorForm() {
  selectedLeadId = null;
  byId('transcript-title').textContent = 'Transcript';
  byId('lead-name').value = '';
  byId('lead-email').value = '';
  byId('lead-phone').value = '';
  byId('lead-business').value = '';
  byId('lead-service').value = '';
  byId('lead-urgency').value = '';
  byId('lead-preferred').value = '';
  if (byId('lead-assigned-rep')) byId('lead-assigned-rep').value = '';
  byId('lead-qualification-status').value = 'new';
  if (byId('lead-source')) byId('lead-source').value = '';
  if (byId('lead-tags')) byId('lead-tags').value = '';
  byId('lead-notes').value = '';
  byId('lead-save-status').textContent = 'Lead form cleared.';
  renderManualSlots([]);
  byId('manual-booking-status').textContent = 'Pick or create a lead to book it.';
  if (byId('manual-outbound-recipient')) byId('manual-outbound-recipient').value = '';
  if (byId('manual-outbound-subject')) byId('manual-outbound-subject').value = '';
  if (byId('manual-outbound-body')) byId('manual-outbound-body').value = '';
  if (byId('manual-outbound-status')) byId('manual-outbound-status').textContent = 'Pick a lead to send a message.';
  if (byId('intake-status')) byId('intake-status').value = 'pending';
  if (byId('intake-budget')) byId('intake-budget').value = '';
  if (byId('intake-window')) byId('intake-window').value = '';
  if (byId('intake-need')) byId('intake-need').value = '';
  if (byId('intake-notes')) byId('intake-notes').value = '';
  if (byId('intake-waiver-text')) byId('intake-waiver-text').value = '';
  if (byId('intake-waiver-accepted')) byId('intake-waiver-accepted').checked = false;
  if (byId('intake-status-note')) byId('intake-status-note').textContent = 'Pick a lead to edit intake.';
  if (byId('billing-totals')) byId('billing-totals').innerHTML = '';
  if (byId('billing-invoices-tbody')) byId('billing-invoices-tbody').innerHTML = '<tr><td colspan="8"><div class="empty-state">Pick a lead to inspect billing.</div></td></tr>';
  if (byId('billing-payments-tbody')) byId('billing-payments-tbody').innerHTML = '<tr><td colspan="5"><div class="empty-state">Pick a lead to inspect payments.</div></td></tr>';
  if (byId('billing-commitments-tbody')) byId('billing-commitments-tbody').innerHTML = '<tr><td colspan="8"><div class="empty-state">Pick a lead to inspect payment commitments.</div></td></tr>';
  if (byId('payment-invoice-select')) byId('payment-invoice-select').innerHTML = '<option value="">Pick a lead first</option>';
  if (byId('invoice-status-note')) byId('invoice-status-note').textContent = 'Pick a lead to create invoices.';
  if (byId('payment-status-note')) byId('payment-status-note').textContent = 'Pick a lead to record payments.';
  documentCache = [];
  artifactCache = [];
  if (byId('lead-documents-shell')) byId('lead-documents-shell').innerHTML = '<div class="empty-state">Pick a lead to inspect documents.</div>';
  if (byId('lead-artifacts-shell')) byId('lead-artifacts-shell').innerHTML = '<div class="empty-state">Pick a lead to inspect proof artifacts.</div>';
  if (byId('document-id')) byId('document-id').value = '';
  if (byId('document-title')) byId('document-title').value = '';
  if (byId('document-kind')) byId('document-kind').value = 'document';
  if (byId('document-required')) byId('document-required').checked = false;
  if (byId('document-status')) byId('document-status').value = 'pending';
  if (byId('document-body')) byId('document-body').value = '';
  if (byId('document-status-note')) byId('document-status-note').textContent = 'Pick a lead to manage portal documents.';
  if (byId('artifact-category')) byId('artifact-category').value = '';
  if (byId('artifact-file')) byId('artifact-file').value = '';
  if (byId('artifact-visible')) byId('artifact-visible').checked = true;
  if (byId('artifact-notes')) byId('artifact-notes').value = '';
  if (byId('artifact-status-note')) byId('artifact-status-note').textContent = 'Pick a lead to manage proof artifacts.';
  if (byId('artifact-select-visible')) byId('artifact-select-visible').checked = false;
  renderLeadTimeline([]);
}

function fillLeadEditor(lead) {
  if (!lead || !lead.id) return;
  byId('lead-name').value = lead.name || '';
  byId('lead-email').value = lead.email || '';
  byId('lead-phone').value = lead.phone || '';
  byId('lead-business').value = lead.business_name || '';
  byId('lead-service').value = lead.service_interest || '';
  byId('lead-urgency').value = lead.urgency || '';
  byId('lead-preferred').value = lead.preferred_schedule || '';
  if (byId('lead-assigned-rep')) byId('lead-assigned-rep').value = lead.assigned_rep_id ? String(lead.assigned_rep_id) : '';
  byId('lead-qualification-status').value = lead.qualification_status || 'new';
  if (byId('lead-source')) byId('lead-source').value = lead.source || '';
  if (byId('lead-tags')) byId('lead-tags').value = (lead.tags || []).join(', ');
  byId('lead-notes').value = lead.notes || '';
  byId('lead-save-status').textContent = `Selected lead #${lead.id}.`;
  if (byId('manual-outbound-channel')) {
    const channel = byId('manual-outbound-channel').value || 'email';
    byId('manual-outbound-recipient').value = channel === 'sms' ? (lead.phone || '') : (lead.email || '');
  }
}

function leadPayloadFromForm() {
  return {
    name: byId('lead-name').value.trim(),
    email: byId('lead-email').value.trim(),
    phone: byId('lead-phone').value.trim(),
    business_name: byId('lead-business').value.trim(),
    service_interest: byId('lead-service').value.trim(),
    urgency: byId('lead-urgency').value.trim(),
    preferred_schedule: byId('lead-preferred').value.trim(),
    assigned_rep_id: Number(byId('lead-assigned-rep')?.value || 0) || null,
    qualification_status: byId('lead-qualification-status').value.trim() || 'new',
    source: byId('lead-source')?.value.trim() || 'admin',
    tags: parseTagCsv(byId('lead-tags')?.value || ''),
    notes: byId('lead-notes').value.trim(),
    timezone: pageConfig.business_timezone || 'America/Phoenix',
  };
}

function clearRepEditorForm() {
  if (byId('rep-editor-select')) byId('rep-editor-select').value = '';
  if (byId('rep-editor-name')) byId('rep-editor-name').value = '';
  if (byId('rep-editor-email')) byId('rep-editor-email').value = '';
  if (byId('rep-editor-phone')) byId('rep-editor-phone').value = '';
  if (byId('rep-editor-role')) byId('rep-editor-role').value = 'setter';
  if (byId('rep-editor-sort-order')) byId('rep-editor-sort-order').value = '0';
  if (byId('rep-editor-commission')) byId('rep-editor-commission').value = '10';
  if (byId('rep-editor-target')) byId('rep-editor-target').value = '0';
  if (byId('rep-editor-notes')) byId('rep-editor-notes').value = '';
  if (byId('rep-editor-active')) byId('rep-editor-active').checked = true;
  if (byId('rep-editor-status')) byId('rep-editor-status').textContent = 'Rep form cleared.';
}

function fillRepEditorForm(repId) {
  const rep = repCache.find((item) => item.id === repId);
  if (!rep) {
    clearRepEditorForm();
    return;
  }
  if (byId('rep-editor-select')) byId('rep-editor-select').value = String(rep.id);
  if (byId('rep-editor-name')) byId('rep-editor-name').value = rep.name || '';
  if (byId('rep-editor-email')) byId('rep-editor-email').value = rep.email || '';
  if (byId('rep-editor-phone')) byId('rep-editor-phone').value = rep.phone || '';
  if (byId('rep-editor-role')) byId('rep-editor-role').value = rep.role || 'setter';
  if (byId('rep-editor-sort-order')) byId('rep-editor-sort-order').value = String(rep.sort_order || 0);
  if (byId('rep-editor-commission')) byId('rep-editor-commission').value = String((Number(rep.commission_rate_bps || 0) / 100).toFixed(2));
  if (byId('rep-editor-target')) byId('rep-editor-target').value = String(Number(rep.target_monthly_cents || 0) / 100);
  if (byId('rep-editor-notes')) byId('rep-editor-notes').value = rep.payout_notes || '';
  if (byId('rep-editor-active')) byId('rep-editor-active').checked = !!Number(rep.is_active ?? 1);
  if (byId('rep-editor-status')) byId('rep-editor-status').textContent = `Selected rep #${rep.id}.`;
}

function repPayloadFromForm() {
  return {
    org_id: selectedOrgId(),
    name: byId('rep-editor-name').value.trim(),
    email: byId('rep-editor-email').value.trim(),
    phone: byId('rep-editor-phone').value.trim(),
    role: byId('rep-editor-role').value.trim() || 'setter',
    sort_order: Number(byId('rep-editor-sort-order').value || 0),
    commission_rate_bps: Math.max(0, Math.round(Number(byId('rep-editor-commission').value || 0) * 100)),
    target_monthly_cents: usdToCents(byId('rep-editor-target').value),
    payout_notes: byId('rep-editor-notes').value.trim(),
    is_active: !!byId('rep-editor-active').checked,
  };
}


function renderIntake(packet) {
  if (!packet) return;
  if (byId('intake-status')) byId('intake-status').value = packet.status || 'pending';
  if (byId('intake-budget')) byId('intake-budget').value = packet.budget_range || '';
  if (byId('intake-window')) byId('intake-window').value = packet.decision_window || '';
  if (byId('intake-need')) byId('intake-need').value = packet.business_need || '';
  if (byId('intake-notes')) byId('intake-notes').value = packet.intake_notes || '';
  if (byId('intake-waiver-text')) byId('intake-waiver-text').value = packet.waiver_text || '';
  if (byId('intake-waiver-accepted')) byId('intake-waiver-accepted').checked = !!Number(packet.waiver_accepted || 0);
  if (byId('intake-status-note')) {
    byId('intake-status-note').textContent = packet.waiver_accepted_at ? `Waiver accepted ${packet.waiver_accepted_at}` : 'Intake packet ready.';
  }
}

function renderMemberships(memberships = []) {
  membershipCache = memberships || [];
  const shell = byId('memberships-shell');
  if (!shell) return;
  shell.innerHTML = membershipCache.length ? membershipCache.map((membership) => `
    <div class="mini-card">
      <strong>${escapeHtml(membership.title || '')}</strong>
      <span>${escapeHtml(formatMoneyFromCents(membership.amount_cents || 0))} every ${escapeHtml(String(membership.interval_days || 0))} days · ${escapeHtml(membership.status || '')}</span>
      <span>Next invoice: ${escapeHtml(membership.next_invoice_ts || 'not scheduled')}</span>
      <span>Recent invoices: ${escapeHtml(String(membership.recent_invoice_count || 0))}</span>
      ${membership.notes ? `<div class="footer-note">${escapeHtml(membership.notes)}</div>` : ''}
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px">
        ${String(membership.status || '') === 'paused' ? `<button type="button" class="secondary" data-membership-action="resume" data-membership-id="${membership.id}">Resume</button>` : `<button type="button" class="secondary" data-membership-action="pause" data-membership-id="${membership.id}">Pause</button>`}
        ${String(membership.status || '') === 'cancelled' ? '' : `<button type="button" class="secondary" data-membership-action="generate_now" data-membership-id="${membership.id}">Bill now</button><button type="button" class="secondary" data-membership-action="skip_cycle" data-membership-id="${membership.id}">Skip cycle</button><button type="button" class="danger" data-membership-action="cancel" data-membership-id="${membership.id}">Cancel</button>`}
      </div>
    </div>
  `).join('') : '<div class="empty-state">No recurring memberships yet.</div>';
  shell.querySelectorAll('[data-membership-action]').forEach((button) => {
    button.addEventListener('click', () => runMembershipAction(Number(button.dataset.membershipId), button.dataset.membershipAction));
  });
}

function renderBilling(billing) {
  const totals = billing?.totals || {};
  if (byId('billing-totals')) {
    byId('billing-totals').innerHTML = `
      <div class="mini-card"><strong>${formatMoneyFromCents(totals.invoiced_cents || 0)}</strong><span>Invoiced</span></div>
      <div class="mini-card"><strong>${formatMoneyFromCents(totals.paid_cents || 0)}</strong><span>Paid</span></div>
      <div class="mini-card"><strong>${formatMoneyFromCents(totals.outstanding_cents || 0)}</strong><span>Outstanding</span></div>
    `;
  }
  const invoices = billing?.invoices || [];
  const tbody = byId('billing-invoices-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    if (!invoices.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state">No invoices yet for this lead.</div></td></tr>';
    } else {
      invoices.forEach((invoice) => {
        const tr = document.createElement('tr');
        const canAct = !['void', 'written_off'].includes(String(invoice.status || '')) && Number(invoice.amount_cents || 0) > 0;
        tr.innerHTML = `
          <td>${escapeHtml(invoice.invoice_code || invoice.id)}</td>
          <td>${escapeHtml(invoice.kind || '')}</td>
          <td>${escapeHtml(invoice.description || '')}</td>
          <td>${escapeHtml(invoice.status || '')}</td>
          <td>${escapeHtml(formatMoneyFromCents(invoice.amount_cents || 0))}</td>
          <td>${escapeHtml(formatMoneyFromCents(invoice.balance_cents || 0))}</td>
          <td>${escapeHtml(invoice.notes || '')}</td>
          <td>
            <div style="display:flex; gap:6px; flex-wrap:wrap">
              ${canAct ? `<button type="button" class="secondary" data-invoice-action="mark_sent" data-invoice-id="${invoice.id}">Mark sent</button>
              <button type="button" class="secondary" data-invoice-action="mark_paid" data-invoice-id="${invoice.id}">Mark paid</button>
              <button type="button" class="secondary" data-invoice-action="write_off" data-invoice-id="${invoice.id}">Write off</button>
              <button type="button" class="danger" data-invoice-action="void" data-invoice-id="${invoice.id}">Void</button>
              <button type="button" class="secondary" data-invoice-credit="${invoice.id}">Credit</button>` : `<button type="button" class="secondary" data-invoice-action="reopen" data-invoice-id="${invoice.id}">Reopen</button>`}
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
      tbody.querySelectorAll('[data-invoice-action]').forEach((button) => {
        button.addEventListener('click', () => applyInvoiceAction(button.getAttribute('data-invoice-id'), button.getAttribute('data-invoice-action')));
      });
      tbody.querySelectorAll('[data-invoice-credit]').forEach((button) => {
        button.addEventListener('click', () => createCreditMemo(button.getAttribute('data-invoice-credit')));
      });
    }
  }
  const paymentsTbody = byId('billing-payments-tbody');
  if (paymentsTbody) {
    paymentsTbody.innerHTML = '';
    const payments = billing?.payments || [];
    if (!payments.length) {
      paymentsTbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">No payments recorded yet.</div></td></tr>';
    } else {
      payments.forEach((payment) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(String(payment.id || ''))}</td>
          <td>${escapeHtml(formatMoneyFromCents(payment.amount_cents || 0))}</td>
          <td>${escapeHtml(payment.method || '')}</td>
          <td>${escapeHtml(payment.reference || '')}</td>
          <td>${escapeHtml(payment.created_at || '')}</td>
        `;
        paymentsTbody.appendChild(tr);
      });
    }
  }
  const select = byId('payment-invoice-select');
  if (select) {
    const prior = select.value;
    select.innerHTML = '';
    const payableInvoices = invoices.filter((invoice) => Number(invoice.balance_cents || 0) > 0 && !['void', 'written_off'].includes(String(invoice.status || '')));
    if (!payableInvoices.length) {
      select.innerHTML = '<option value="">No invoices available</option>';
    } else {
      payableInvoices.forEach((invoice) => {
        const option = document.createElement('option');
        option.value = String(invoice.id);
        option.textContent = `${invoice.invoice_code || invoice.id} · ${formatMoneyFromCents(invoice.balance_cents || 0)} due`;
        select.appendChild(option);
      });
      if (prior && payableInvoices.some((item) => String(item.id) === prior)) select.value = prior;
    }
  }
}

async function loadLeadCommercials(leadId) {
  if (!leadId) {
    renderIntake(null);
    renderBilling({ invoices: [], payments: [], totals: {} });
    renderDocuments([]);
    renderArtifacts([]);
    return;
  }
  try {
    const [intakeData, billingData, documentData] = await Promise.all([
      api(`/api/admin/leads/${leadId}/intake`),
      api(`/api/admin/leads/${leadId}/billing`),
      api(`/api/admin/leads/${leadId}/documents`),
    ]);
    renderIntake(intakeData.intake || {});
    renderBilling(billingData.billing || {});
    renderDocuments(documentData.documents || []);
    await loadLeadArtifacts(leadId);
  } catch (error) {
    if (byId('intake-status-note')) byId('intake-status-note').textContent = error.message;
    if (byId('invoice-status-note')) byId('invoice-status-note').textContent = error.message;
    if (byId('document-status-note')) byId('document-status-note').textContent = error.message;
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = error.message;
  }
}

async function saveIntake(event) {
  event.preventDefault();
  if (!selectedLeadId) {
    byId('intake-status-note').textContent = 'Pick a lead first.';
    return;
  }
  try {
    const payload = {
      status: byId('intake-status').value,
      budget_range: byId('intake-budget').value.trim(),
      decision_window: byId('intake-window').value.trim(),
      business_need: byId('intake-need').value.trim(),
      intake_notes: byId('intake-notes').value.trim(),
      waiver_text: byId('intake-waiver-text').value.trim(),
      waiver_accepted: byId('intake-waiver-accepted').checked,
    };
    const data = await api(`/api/admin/leads/${selectedLeadId}/intake`, { method: 'POST', body: JSON.stringify(payload) });
    renderIntake(data.intake || {});
    byId('intake-status-note').textContent = 'Intake packet saved.';
    await refreshAdmin();
  } catch (error) {
    byId('intake-status-note').textContent = error.message;
  }
}

async function createInvoiceForLead(event) {
  event.preventDefault();
  if (!selectedLeadId) {
    byId('invoice-status-note').textContent = 'Pick a lead first.';
    return;
  }
  try {
    const activeAppt = appointmentCache.find((appt) => appt.lead_id === selectedLeadId && ['booked', 'confirmed'].includes(appt.status));
    const payload = {
      appointment_id: activeAppt?.id || null,
      kind: byId('invoice-kind').value,
      description: byId('invoice-description').value.trim(),
      amount_cents: usdToCents(byId('invoice-amount').value),
      balance_cents: usdToCents(byId('invoice-balance').value || byId('invoice-amount').value),
      status: byId('invoice-status').value,
      due_ts: byId('invoice-due').value.trim(),
      notes: byId('invoice-notes').value.trim(),
      currency: byId('settings-currency')?.value.trim() || 'USD',
    };
    const data = await api(`/api/admin/leads/${selectedLeadId}/invoices`, { method: 'POST', body: JSON.stringify(payload) });
    renderBilling(data.billing || {});
    byId('invoice-status-note').textContent = `Invoice ${data.invoice?.invoice_code || data.invoice?.id || ''} created.`;
    byId('invoice-description').value = '';
    byId('invoice-amount').value = '';
    byId('invoice-balance').value = '';
    byId('invoice-due').value = '';
    byId('invoice-notes').value = '';
    await refreshAdmin();
  } catch (error) {
    byId('invoice-status-note').textContent = error.message;
  }
}

async function recordLeadPayment(event) {
  event.preventDefault();
  const invoiceId = byId('payment-invoice-select')?.value || '';
  if (!invoiceId) {
    byId('payment-status-note').textContent = 'Pick an invoice first.';
    return;
  }
  try {
    const payload = {
      amount_cents: usdToCents(byId('payment-amount').value),
      method: byId('payment-method').value.trim(),
      reference: byId('payment-reference').value.trim(),
      notes: byId('payment-notes').value.trim(),
    };
    const data = await api(`/api/admin/invoices/${invoiceId}/payments`, { method: 'POST', body: JSON.stringify(payload) });
    renderBilling(data.billing || {});
    byId('payment-status-note').textContent = `Payment ${data.payment?.id || ''} recorded.`;
    byId('payment-amount').value = '';
    byId('payment-reference').value = '';
    byId('payment-notes').value = '';
    await refreshAdmin();
  } catch (error) {
    byId('payment-status-note').textContent = error.message;
  }
}


async function applyInvoiceAction(invoiceId, action) {
  if (!invoiceId) return;
  const note = window.prompt(`Optional note for ${action.replace('_', ' ')}:`) || '';
  try {
    const data = await api(`/api/admin/invoices/${invoiceId}/lifecycle`, { method: 'POST', body: JSON.stringify({ action, note }) });
    renderBilling(data.billing || {});
    if (byId('invoice-status-note')) byId('invoice-status-note').textContent = `Invoice ${action.replace('_', ' ')} applied.`;
    await refreshAdmin();
  } catch (error) {
    if (byId('invoice-status-note')) byId('invoice-status-note').textContent = error.message;
  }
}

async function createCreditMemo(invoiceId) {
  if (!invoiceId) return;
  const rawAmount = window.prompt('Credit amount in dollars:', '0.00');
  if (rawAmount === null) return;
  const amountCents = usdToCents(rawAmount);
  if (!amountCents) {
    if (byId('invoice-status-note')) byId('invoice-status-note').textContent = 'Enter a credit amount greater than zero.';
    return;
  }
  const note = window.prompt('Optional credit memo note:') || '';
  try {
    const data = await api(`/api/admin/invoices/${invoiceId}/credit`, { method: 'POST', body: JSON.stringify({ amount_cents: amountCents, note }) });
    renderBilling(data.billing || {});
    if (byId('invoice-status-note')) byId('invoice-status-note').textContent = `Credit memo ${data.credit_invoice?.invoice_code || data.credit_invoice?.id || ''} created.`;
    await refreshAdmin();
  } catch (error) {
    if (byId('invoice-status-note')) byId('invoice-status-note').textContent = error.message;
  }
}

function clearDocumentForm() {
  if (byId('document-id')) byId('document-id').value = '';
  if (byId('document-title')) byId('document-title').value = '';
  if (byId('document-kind')) byId('document-kind').value = 'document';
  if (byId('document-required')) byId('document-required').checked = false;
  if (byId('document-status')) byId('document-status').value = 'pending';
  if (byId('document-body')) byId('document-body').value = '';
}

function fillDocumentForm(documentRecord) {
  if (!documentRecord) {
    clearDocumentForm();
    return;
  }
  if (byId('document-id')) byId('document-id').value = String(documentRecord.id || '');
  if (byId('document-title')) byId('document-title').value = documentRecord.title || '';
  if (byId('document-kind')) byId('document-kind').value = documentRecord.kind || 'document';
  if (byId('document-required')) byId('document-required').checked = !!Number(documentRecord.required || 0);
  if (byId('document-status')) byId('document-status').value = documentRecord.status || 'pending';
  if (byId('document-body')) byId('document-body').value = documentRecord.body || '';
}

function renderDocuments(documents = []) {
  documentCache = documents || [];
  const shell = byId('lead-documents-shell');
  if (!shell) return;
  shell.innerHTML = documentCache.length ? documentCache.map((doc) => `
    <div class="stack" style="padding:12px; border:1px solid rgba(255,255,255,0.08); border-radius:16px">
      <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:flex-start">
        <div class="stack" style="gap:6px">
          <strong>${escapeHtml(doc.title || '')}</strong>
          <span>${escapeHtml(doc.kind || '')} · ${escapeHtml(doc.status || '')} · ${Number(doc.required || 0) ? 'required' : 'optional'}</span>
          <span>${escapeHtml(doc.signed_at ? `Signed by ${doc.signed_name || 'client'} on ${doc.signed_at}` : 'Not signed yet')}</span>
        </div>
        <button type="button" class="secondary" data-load-document="${doc.id}">Load</button>
      </div>
      <div class="footer-note">${escapeHtml(doc.body || '').slice(0, 220)}${(doc.body || '').length > 220 ? '…' : ''}</div>
    </div>
  `).join('') : '<div class="empty-state">No portal documents yet.</div>';
  shell.querySelectorAll('[data-load-document]').forEach((button) => {
    button.addEventListener('click', () => {
      const doc = documentCache.find((item) => String(item.id) === String(button.getAttribute('data-load-document')));
      fillDocumentForm(doc || null);
      if (byId('document-status-note')) byId('document-status-note').textContent = doc ? `Loaded ${doc.title}.` : 'Document loaded.';
    });
  });
}

async function saveDocument(event) {
  event.preventDefault();
  if (!selectedLeadId) {
    if (byId('document-status-note')) byId('document-status-note').textContent = 'Pick a lead first.';
    return;
  }
  const documentId = byId('document-id')?.value || '';
  const payload = {
    title: byId('document-title')?.value.trim() || '',
    kind: byId('document-kind')?.value || 'document',
    required: !!byId('document-required')?.checked,
    status: byId('document-status')?.value || 'pending',
    body: byId('document-body')?.value.trim() || '',
  };
  try {
    const data = documentId
      ? await api(`/api/admin/documents/${documentId}`, { method: 'POST', body: JSON.stringify(payload) })
      : await api(`/api/admin/leads/${selectedLeadId}/documents`, { method: 'POST', body: JSON.stringify(payload) });
    renderDocuments(data.documents || []);
    clearDocumentForm();
    if (byId('document-status-note')) byId('document-status-note').textContent = documentId ? 'Document updated.' : 'Document created.';
    await refreshAdmin();
  } catch (error) {
    if (byId('document-status-note')) byId('document-status-note').textContent = error.message;
  }
}

function formatArtifactBytes(value) {
  const size = Number(value || 0);
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function renderArtifacts(artifacts = []) {
  artifactCache = artifacts || [];
  artifactSelection = new Set([...artifactSelection].filter((id) => artifactCache.some((item) => Number(item.id) === Number(id))));
  const shell = byId('lead-artifacts-shell');
  if (!shell) return;
  shell.innerHTML = artifactCache.length ? artifactCache.map((artifact) => {
    const versions = artifact.versions || [];
    const deleted = String(artifact.status || '') === 'deleted';
    const checked = artifactSelection.has(Number(artifact.id)) ? 'checked' : '';
    return `
    <div class="stack" style="padding:12px; border:1px solid rgba(255,255,255,0.08); border-radius:16px; opacity:${deleted ? '0.78' : '1'}">
      <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:flex-start">
        <div class="stack" style="gap:6px">
          <label style="display:flex; gap:8px; align-items:center"><input type="checkbox" data-artifact-select="${artifact.id}" ${checked} /> <strong>${escapeHtml(artifact.filename || '')}</strong></label>
          <span>${escapeHtml(artifact.category || 'artifact')} · ${escapeHtml(formatArtifactBytes(artifact.size_bytes || 0))} · ${Number(artifact.visible_to_client || 0) ? 'client-visible' : 'internal-only'} · ${escapeHtml(artifact.status || 'active')}</span>
          <span>Version ${escapeHtml(String(artifact.version_number || 1))}${versions.length > 1 ? ` of ${escapeHtml(String(versions.length))}` : ''}</span>
          ${artifact.notes ? `<span>${escapeHtml(artifact.notes)}</span>` : ''}
          ${versions.length > 1 ? `<details><summary>Version history</summary><div class="stack" style="margin-top:8px">${versions.map((version) => `<div class="mini-card"><strong>v${escapeHtml(String(version.version_number || 1))}</strong><span>${escapeHtml(version.filename || '')}</span><span>${escapeHtml(version.status || 'active')} · ${escapeHtml(version.created_at || '')}</span><a class="button-link secondary" href="/api/admin/artifacts/${version.id}/download">Download</a></div>`).join('')}</div></details>` : ''}
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-start">
          <a class="button-link secondary" href="/api/admin/artifacts/${artifact.id}/download">Download</a>
          ${deleted ? `<button type="button" class="secondary" data-artifact-restore="${artifact.id}">Restore</button>` : `<button type="button" class="secondary" data-artifact-toggle="${artifact.id}">${Number(artifact.visible_to_client || 0) ? 'Make internal' : 'Show to client'}</button><button type="button" class="secondary" data-artifact-replace="${artifact.id}">Replace file</button><button type="button" class="danger" data-artifact-delete="${artifact.id}">Delete</button>`}
        </div>
      </div>
    </div>
  `;
  }).join('') : '<div class="empty-state">No proof artifacts yet.</div>';
  shell.querySelectorAll('[data-artifact-select]').forEach((input) => input.addEventListener('change', () => {
    const artifactId = Number(input.getAttribute('data-artifact-select') || 0);
    if (input.checked) artifactSelection.add(artifactId);
    else artifactSelection.delete(artifactId);
    syncArtifactSelectionControls();
  }));
  shell.querySelectorAll('[data-artifact-toggle]').forEach((button) => button.addEventListener('click', () => toggleArtifactVisibility(Number(button.dataset.artifactToggle))));
  shell.querySelectorAll('[data-artifact-replace]').forEach((button) => button.addEventListener('click', () => replaceArtifactFile(Number(button.dataset.artifactReplace))));
  shell.querySelectorAll('[data-artifact-delete]').forEach((button) => button.addEventListener('click', () => deleteArtifactItem(Number(button.dataset.artifactDelete))));
  shell.querySelectorAll('[data-artifact-restore]').forEach((button) => button.addEventListener('click', () => restoreArtifactItem(Number(button.dataset.artifactRestore))));
  syncArtifactSelectionControls();
}

function syncArtifactSelectionControls() {
  const selectVisible = byId('artifact-select-visible');
  const visibleIds = artifactCache.map((item) => Number(item.id)).filter(Boolean);
  if (selectVisible) selectVisible.checked = !!visibleIds.length && visibleIds.every((id) => artifactSelection.has(id));
}

async function loadLeadArtifacts(leadId) {
  if (!leadId) {
    artifactCache = [];
    artifactSelection = new Set();
    renderArtifacts([]);
    return;
  }
  const data = await api(`/api/admin/leads/${leadId}/artifacts?include_deleted=${artifactShowDeleted ? 1 : 0}`);
  renderArtifacts(data.artifacts || []);
}

async function runArtifactBatchAction() {
  const action = byId('artifact-batch-action')?.value || '';
  const artifact_ids = [...artifactSelection].map((item) => Number(item)).filter(Boolean);
  if (!action) {
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = 'Pick a batch action first.';
    return;
  }
  if (!artifact_ids.length) {
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = 'Pick at least one artifact first.';
    return;
  }
  try {
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = 'Running artifact batch action…';
    const data = await api('/api/admin/artifacts/batch', { method: 'POST', body: JSON.stringify({ action, artifact_ids, lead_id: selectedLeadId, include_deleted: artifactShowDeleted }) });
    await loadLeadArtifacts(selectedLeadId);
    artifactSelection = new Set();
    syncArtifactSelectionControls();
    const updatedCount = (data.updated || []).length;
    const errorCount = (data.errors || []).length;
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = `Batch action ${action} updated ${updatedCount} artifact${updatedCount === 1 ? '' : 's'}${errorCount ? ` with ${errorCount} issue${errorCount === 1 ? '' : 's'}` : ''}.`;
    await refreshAdmin();
  } catch (error) {
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = error.message;
  }
}

async function restoreArtifactItem(artifactId) {
  try {
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = 'Restoring artifact…';
    const data = await api(`/api/admin/artifacts/${artifactId}/restore`, { method: 'POST', body: JSON.stringify({ include_deleted: artifactShowDeleted }) });
    await loadLeadArtifacts(selectedLeadId);
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = 'Artifact restored to the live vault.';
    await refreshAdmin();
  } catch (error) {
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = error.message;
  }
}

async function fileInputToBase64(input) {
  const file = input?.files?.[0];
  if (!file) throw new Error('Pick a file first.');
  const content_b64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error('File could not be read.'));
    reader.readAsDataURL(file);
  });
  return { file, content_b64 };
}

async function uploadArtifact(event) {
  event.preventDefault();
  if (!selectedLeadId) {
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = 'Pick a lead first.';
    return;
  }
  try {
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = 'Uploading artifact…';
    const { file, content_b64 } = await fileInputToBase64(byId('artifact-file'));
    const data = await api(`/api/admin/leads/${selectedLeadId}/artifacts`, { method: 'POST', body: JSON.stringify({
      filename: file.name,
      mime_type: file.type || 'application/octet-stream',
      content_b64,
      category: byId('artifact-category')?.value.trim() || 'operator_upload',
      visible_to_client: !!byId('artifact-visible')?.checked,
      notes: byId('artifact-notes')?.value.trim() || '',
    }) });
    await loadLeadArtifacts(selectedLeadId);
    if (byId('artifact-file')) byId('artifact-file').value = '';
    if (byId('artifact-category')) byId('artifact-category').value = '';
    if (byId('artifact-notes')) byId('artifact-notes').value = '';
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = 'Artifact uploaded.';
    await refreshAdmin();
  } catch (error) {
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = error.message;
  }
}

async function toggleArtifactVisibility(artifactId) {
  const artifact = artifactCache.find((item) => Number(item.id) === Number(artifactId));
  if (!artifact) return;
  try {
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = 'Updating artifact visibility…';
    const data = await api(`/api/admin/artifacts/${artifactId}/update`, { method: 'POST', body: JSON.stringify({ visible_to_client: !Number(artifact.visible_to_client || 0) }) });
    await loadLeadArtifacts(selectedLeadId);
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = Number(data.artifact?.visible_to_client || 0) ? 'Artifact is now client-visible.' : 'Artifact is now internal-only.';
    await refreshAdmin();
  } catch (error) {
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = error.message;
  }
}

async function replaceArtifactFile(artifactId) {
  const artifact = artifactCache.find((item) => Number(item.id) === Number(artifactId));
  if (!artifact) return;
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.addEventListener('change', async () => {
    if (!picker.files?.length) return;
    try {
      if (byId('artifact-status-note')) byId('artifact-status-note').textContent = 'Replacing artifact with a new live version…';
      const { file, content_b64 } = await fileInputToBase64(picker);
      const data = await api(`/api/admin/artifacts/${artifactId}/replace`, { method: 'POST', body: JSON.stringify({
        filename: file.name,
        mime_type: file.type || artifact.mime_type || 'application/octet-stream',
        content_b64,
        category: artifact.category || 'evidence',
        visible_to_client: !!Number(artifact.visible_to_client || 0),
        notes: artifact.notes || '',
      }) });
      await loadLeadArtifacts(selectedLeadId);
      if (byId('artifact-status-note')) byId('artifact-status-note').textContent = `Artifact replaced. Live version is now v${data.artifact?.version_number || '?'}.`;
      await refreshAdmin();
    } catch (error) {
      if (byId('artifact-status-note')) byId('artifact-status-note').textContent = error.message;
    }
  });
  picker.click();
}

async function deleteArtifactItem(artifactId) {
  const artifact = artifactCache.find((item) => Number(item.id) === Number(artifactId));
  if (!artifact) return;
  if (!window.confirm(`Delete ${artifact.filename || 'this artifact'} from the live vault?`)) return;
  try {
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = 'Deleting artifact…';
    const data = await api(`/api/admin/artifacts/${artifactId}/delete`, { method: 'POST', body: '{}' });
    await loadLeadArtifacts(selectedLeadId);
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = 'Artifact removed from the live vault.';
    await refreshAdmin();
  } catch (error) {
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = error.message;
  }
}

function renderManualSlots(slots) {
  manualSlotCache = slots || [];
  const select = byId('manual-slot-select');
  if (!select) return;
  select.innerHTML = '';
  if (!manualSlotCache.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = selectedLeadId ? 'No openings available yet' : 'Pick a lead first';
    select.appendChild(option);
    return;
  }
  manualSlotCache.forEach((slot, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${formatDateTime(slot.start)} · ${slot.timezone}`;
    select.appendChild(option);
  });
}

async function loadManualSlots(leadId) {
  const lead = leadCache.find((item) => item.id === leadId) || {};
  fillLeadEditor(lead);
  if (!leadId || !lead.id) {
    renderManualSlots([]);
    return;
  }
  byId('manual-booking-status').textContent = 'Loading openings…';
  const params = new URLSearchParams();
  params.set('days', '10');
  params.set('timezone', lead.timezone || pageConfig.business_timezone || 'America/Phoenix');
  if (lead.preferred_schedule) params.set('preferred', lead.preferred_schedule);
  if (lead.org_id) params.set('org_id', String(lead.org_id));
  try {
    const data = await api(`/api/availability?${params.toString()}`, {}, { redirectOn401: false });
    renderManualSlots(data.slots || []);
    byId('manual-booking-status').textContent = data.slots?.length ? 'Openings loaded.' : 'No openings available.';
  } catch (error) {
    renderManualSlots([]);
    byId('manual-booking-status').textContent = error.message;
  }
}

function manualOutboundPayload(sendNow = false) {
  const lead = leadCache.find((item) => item.id === selectedLeadId) || {};
  const channel = byId('manual-outbound-channel')?.value || '';
  if (!channel) {
    byId('manual-outbound-status').textContent = 'No delivery channel is configured.';
    return;
  }
  const recipient = byId('manual-outbound-recipient')?.value.trim() || (channel === 'sms' ? (lead.phone || '') : (lead.email || ''));
  return {
    lead_id: selectedLeadId,
    appointment_id: appointmentCache.find((appt) => appt.lead_id === selectedLeadId && ['booked', 'confirmed'].includes(appt.status))?.id || null,
    channel,
    recipient,
    subject: byId('manual-outbound-subject')?.value.trim() || '',
    body: byId('manual-outbound-body')?.value.trim() || '',
    send_now: !!sendNow,
  };
}

async function submitManualOutbound(sendNow = false) {
  if (!selectedLeadId) {
    byId('manual-outbound-status').textContent = 'Pick a lead first.';
    return;
  }
  try {
    const data = await api('/api/admin/outbound/manual', {
      method: 'POST',
      body: JSON.stringify(manualOutboundPayload(sendNow)),
    });
    byId('manual-outbound-status').textContent = `Message ${sendNow ? 'sent' : 'queued'} to ${data.message?.recipient || 'lead'}.`;
    if (byId('manual-outbound-body')) byId('manual-outbound-body').value = '';
    if (byId('manual-outbound-subject')) byId('manual-outbound-subject').value = '';
    await refreshAdmin();
    await loadLeadTimeline(selectedLeadId);
  } catch (error) {
    byId('manual-outbound-status').textContent = error.message;
  }
}


async function saveSelectedLead(event) {
  event.preventDefault();
  if (!selectedLeadId) {
    byId('lead-save-status').textContent = 'Open a lead first, or use Create new lead.';
    return;
  }
  try {
    const data = await api(`/api/admin/leads/${selectedLeadId}`, {
      method: 'POST',
      body: JSON.stringify(leadPayloadFromForm()),
    });
    byId('lead-save-status').textContent = 'Lead saved.';
    await refreshAdmin();
    fillLeadEditor(data.lead || {});
    await loadManualSlots(selectedLeadId);
  } catch (error) {
    byId('lead-save-status').textContent = error.message;
  }
}

async function createLeadFromForm() {
  if (!can('manager')) {
    byId('lead-save-status').textContent = 'Manager role required.';
    return;
  }
  try {
    const payload = leadPayloadFromForm();
    if (selectedOrgId()) payload.org_id = selectedOrgId();
    const data = await api('/api/admin/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    selectedLeadId = data.lead?.id || null;
    byId('lead-save-status').textContent = `Lead #${selectedLeadId} created.`;
    await refreshAdmin();
    if (selectedLeadId) {
      fillLeadEditor(data.lead || {});
      await loadTranscript(selectedLeadId);
    }
  } catch (error) {
    byId('lead-save-status').textContent = error.message;
  }
}

async function manualBookSelectedLead(event) {
  event.preventDefault();
  if (!selectedLeadId) {
    byId('manual-booking-status').textContent = 'Pick or create a lead first.';
    return;
  }
  const slot = manualSlotCache[Number(byId('manual-slot-select').value || 0)];
  if (!slot) {
    byId('manual-booking-status').textContent = 'Choose an opening first.';
    return;
  }
  try {
    const data = await api('/api/admin/appointments/manual', {
      method: 'POST',
      body: JSON.stringify({
        lead_id: selectedLeadId,
        start: slot.start,
        timezone: slot.timezone,
        notes: byId('manual-booking-notes').value.trim(),
      }),
    });
    byId('manual-booking-notes').value = '';
    byId('manual-booking-status').textContent = `Booked. Confirmation ${data.appointment?.confirmation_code || ''}`;
    await refreshAdmin();
    await loadTranscript(selectedLeadId);
    await loadManualSlots(selectedLeadId);
  } catch (error) {
    byId('manual-booking-status').textContent = error.message;
  }
}

async function updateAppointmentStatus(appointmentId, status) {
  try {
    await api(`/api/appointments/${appointmentId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    await refreshAdmin();
  } catch (error) {
    alert(error.message);
  }
}

async function loadTranscript(leadId) {
  selectedLeadId = leadId;
  renderQuotes(quoteCache || []);
  const lead = leadCache.find((item) => item.id === leadId) || {};
  fillLeadEditor(lead);
  byId('transcript-title').textContent = lead.name ? `${lead.name} · Transcript` : 'Transcript';
  const shell = byId('transcript-shell');
  shell.innerHTML = '<div class="empty-state">Loading transcript…</div>';
  await Promise.all([loadManualSlots(leadId), loadLeadTimeline(leadId), loadLeadCommercials(leadId)]);
  try {
    const data = await api(`/api/admin/conversations?lead_id=${leadId}`);
    if (!data.messages.length) {
      shell.innerHTML = '<div class="empty-state">No conversation found for this lead yet.</div>';
      return;
    }
    shell.innerHTML = data.messages.map((msg) => `
      <div class="transcript-card">
        <div class="role">${escapeHtml(msg.role)}</div>
        <div style="margin-top:8px; line-height:1.55">${escapeHtml(msg.text)}</div>
      </div>
    `).join('');
  } catch (error) {
    shell.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

async function rescheduleOneDay(appointmentId, startTs, timezone) {
  const date = new Date(startTs);
  date.setDate(date.getDate() + 1);
  try {
    await api(`/api/appointments/${appointmentId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ start: date.toISOString(), timezone }),
    });
    await refreshAdmin();
  } catch (error) {
    alert(error.message);
  }
}

async function cancelAppointment(appointmentId) {
  try {
    await api(`/api/appointments/${appointmentId}/cancel`, { method: 'POST', body: '{}' });
    await refreshAdmin();
  } catch (error) {
    alert(error.message);
  }
}

async function syncOneAppointment(appointmentId) {
  try {
    const data = await api('/api/admin/calendar/sync', { method: 'POST', body: JSON.stringify({ appointment_id: appointmentId }) });
    if (byId('calendar-sync-note')) byId('calendar-sync-note').textContent = `Synced appointment ${appointmentId}.`;
    await refreshAdmin();
    return data;
  } catch (error) {
    if (byId('calendar-sync-note')) byId('calendar-sync-note').textContent = error.message;
  }
}

async function queueReminders() {
  const payload = {};
  if (selectedOrgId()) payload.org_id = selectedOrgId();
  const data = await api('/api/reminders/queue', { method: 'POST', body: JSON.stringify(payload) });
  if (byId('outbound-status')) byId('outbound-status').textContent = `${data.queued.length} reminder message(s) queued.`;
  await refreshAdmin();
}

async function dispatchOutbound() {
  const payload = {};
  if (selectedOrgId()) payload.org_id = selectedOrgId();
  const data = await api('/api/outbound/dispatch', { method: 'POST', body: JSON.stringify(payload) });
  if (byId('outbound-status')) byId('outbound-status').textContent = `${data.messages.length} outbound message(s) dispatched.`;
  await refreshAdmin();
}

async function startVoice(purpose) {
  const leadId = selectedLeadId || leadCache[0]?.id;
  if (!leadId) {
    byId('voice-status').textContent = 'Pick a lead first.';
    return;
  }
  let appointmentId = null;
  if (purpose === 'reminder') {
    appointmentId = appointmentCache.find((appt) => appt.lead_id === leadId && appt.status === 'booked')?.id || null;
  }
  try {
    const data = await api('/api/voice/calls', {
      method: 'POST',
      body: JSON.stringify({ lead_id: leadId, purpose, appointment_id: appointmentId }),
    });
    byId('voice-status').textContent = `Voice call ${data.call.status} in ${voiceModeLabel(data.call.provider)} mode.`;
    await refreshAdmin();
    await loadTranscript(leadId);
  } catch (error) {
    byId('voice-status').textContent = error.message;
  }
}

async function syncCalendars() {
  const payload = {};
  if (selectedOrgId()) payload.org_id = selectedOrgId();
  try {
    const data = await api('/api/admin/calendar/sync', { method: 'POST', body: JSON.stringify(payload) });
    if (byId('calendar-sync-note')) byId('calendar-sync-note').textContent = `Synced ${data.results.length} appointment set(s).`;
    await refreshAdmin();
  } catch (error) {
    if (byId('calendar-sync-note')) byId('calendar-sync-note').textContent = error.message;
  }
}

function renderRuntime(runtimeRes) {
  byId('runtime-json').textContent = JSON.stringify(runtimeRes, null, 2);
}

function renderAudit(events) {
  const tbody = byId('audit-tbody');
  tbody.innerHTML = '';
  if (!events.length) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">No audit events yet.</div></td></tr>';
    return;
  }
  events.forEach((event) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(event.created_at || '')}</td>
      <td>${escapeHtml(event.event_type || '')}</td>
      <td>${escapeHtml(event.actor_email || event.actor_role || 'system')}</td>
      <td>${escapeHtml(event.status || '')}</td>
      <td style="max-width:420px">${escapeHtml(event.detail || '')}</td>
    `;
    tbody.appendChild(tr);
  });
}


function renderInbox(messages) {
  const tbody = byId('inbox-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!messages.length) {
    tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state">No inbound replies have been captured yet.</div></td></tr>';
    return;
  }
  messages.forEach((msg) => {
    const lead = leadCache.find((item) => item.id === msg.lead_id) || {};
    const tr = document.createElement('tr');
    const threadStatus = String(msg.thread_status || 'open');
    const ownerName = msg.owner_name || 'Unclaimed';
    const threadActions = [];
    if (threadStatus === 'closed') {
      threadActions.push('<button class="secondary" type="button" data-action="reopen">Reopen</button>');
    } else {
      if (msg.owner_user_id) {
        threadActions.push('<button class="secondary" type="button" data-action="release">Release</button>');
      } else {
        threadActions.push('<button class="secondary" type="button" data-action="claim">Claim</button>');
      }
      threadActions.push('<button class="secondary" type="button" data-action="close">Close</button>');
    }
    tr.innerHTML = `
      <td><button class="secondary" type="button" data-action="open">Open</button></td>
      <td><button class="secondary" type="button" data-action="reply">Reply</button></td>
      <td>${escapeHtml(lead.name || `Lead #${msg.lead_id || '—'}`)}</td>
      <td>${escapeHtml(msg.channel || '')}</td>
      <td>${escapeHtml(msg.sender || '')}</td>
      <td>${escapeHtml(msg.action_taken || 'received')}</td>
      <td>${escapeHtml(ownerName)}</td>
      <td><div class="stack"><span>${escapeHtml(threadStatus)}</span><div style="display:flex; gap:6px; flex-wrap:wrap">${threadActions.join('')}</div></div></td>
      <td>${escapeHtml(msg.created_at || '')}</td>
      <td style="max-width:460px">${escapeHtml(msg.body || '')}</td>
    `;
    tr.querySelector('[data-action="open"]').addEventListener('click', async () => {
      if (msg.lead_id) {
        await loadTranscript(Number(msg.lead_id));
      }
    });
    tr.querySelector('[data-action="reply"]').addEventListener('click', async () => {
      if (msg.lead_id) {
        await loadTranscript(Number(msg.lead_id));
      }
      if (byId('manual-outbound-channel')) byId('manual-outbound-channel').value = msg.channel || 'email';
      if (byId('manual-outbound-recipient')) byId('manual-outbound-recipient').value = msg.sender || '';
      if (byId('manual-outbound-subject')) byId('manual-outbound-subject').value = msg.channel === 'email' ? `Re: ${msg.subject || 'Appointment update'}` : '';
      if (byId('manual-outbound-body')) {
        const quote = (msg.body || '').split('\n').slice(0, 8).join('\n');
        byId('manual-outbound-body').value = msg.channel === 'email'
          ? `Following up on your reply.\n\n> ${quote.replace(/\n/g, '\n> ')}`
          : `Following up on your reply: ${quote}`;
      }
      if (byId('manual-outbound-status')) byId('manual-outbound-status').textContent = 'Reply draft loaded from inbox.';
      byId('manual-outbound-body')?.focus();
    });
    tr.querySelectorAll('[data-action="claim"], [data-action="release"], [data-action="close"], [data-action="reopen"]').forEach((button) => {
      button.addEventListener('click', async () => {
        try {
          await api(`/api/admin/inbox/${msg.id}/${button.getAttribute('data-action')}`, { method: 'POST', body: JSON.stringify({}) });
          await refreshAdmin();
        } catch (error) {
          if (byId('inbox-status')) byId('inbox-status').textContent = error.message;
        }
      });
    });
    tbody.appendChild(tr);
  });
}

function renderSettings(settings) {
  if (!settings) return;
  byId('settings-support-email').value = settings.support_email || '';
  byId('settings-support-phone').value = settings.support_phone || '';
  byId('settings-timezone').value = settings.timezone || '';
  byId('settings-open-hour').value = settings.open_hour ?? 9;
  byId('settings-close-hour').value = settings.close_hour ?? 17;
  byId('settings-slot-minutes').value = settings.slot_minutes ?? 30;
  byId('settings-buffer-minutes').value = settings.buffer_minutes ?? 15;
  byId('settings-reminder-hours').value = settings.reminder_lead_hours ?? 24;
  if (byId('settings-autonomy-enabled')) byId('settings-autonomy-enabled').checked = Boolean(settings.autonomy_enabled);
  if (byId('settings-auto-followup-hours')) byId('settings-auto-followup-hours').value = settings.auto_followup_hours ?? 24;
  if (byId('settings-auto-noshow-minutes')) byId('settings-auto-noshow-minutes').value = settings.auto_noshow_minutes ?? 90;
  if (byId('settings-auto-invoice-hours')) byId('settings-auto-invoice-hours').value = settings.auto_invoice_followup_hours ?? 48;
  if (byId('settings-auto-intake-hours')) byId('settings-auto-intake-hours').value = settings.auto_intake_followup_hours ?? 24;
  byId('settings-booking-notice').value = settings.booking_notice || '';
  if (byId('settings-default-deposit')) byId('settings-default-deposit').value = Number(settings.default_deposit_cents || 0) / 100;
  if (byId('settings-default-service-price')) byId('settings-default-service-price').value = Number(settings.default_service_price_cents || 0) / 100;
  if (byId('settings-currency')) byId('settings-currency').value = settings.currency || 'USD';
  if (byId('settings-payment-instructions')) byId('settings-payment-instructions').value = settings.payment_instructions || '';
  pageConfig.settings = { ...(pageConfig.settings || {}), currency: settings.currency || 'USD' };
  const days = new Set((settings.operating_days || []).map((item) => Number(item)));
  document.querySelectorAll('.settings-day').forEach((box) => {
    box.checked = days.has(Number(box.value));
  });
  const status = byId('settings-status');
  if (status && settings.operating_hours) status.textContent = `Current hours: ${settings.operating_hours}`;
}

function selectedOperatingDays() {
  return [...document.querySelectorAll('.settings-day:checked')].map((box) => Number(box.value));
}

async function saveSettings(event) {
  event.preventDefault();
  if (!can('admin')) {
    byId('settings-status').textContent = 'Admin role required.';
    return;
  }
  const payload = {
    org_id: selectedOrgId(),
    support_email: byId('settings-support-email').value.trim(),
    support_phone: byId('settings-support-phone').value.trim(),
    timezone: byId('settings-timezone').value.trim(),
    open_hour: Number(byId('settings-open-hour').value || 9),
    close_hour: Number(byId('settings-close-hour').value || 17),
    slot_minutes: Number(byId('settings-slot-minutes').value || 30),
    buffer_minutes: Number(byId('settings-buffer-minutes').value || 15),
    reminder_lead_hours: Number(byId('settings-reminder-hours').value || 24),
    autonomy_enabled: Boolean(byId('settings-autonomy-enabled')?.checked),
    auto_followup_hours: Number(byId('settings-auto-followup-hours')?.value || 24),
    auto_noshow_minutes: Number(byId('settings-auto-noshow-minutes')?.value || 90),
    auto_invoice_followup_hours: Number(byId('settings-auto-invoice-hours')?.value || 48),
    auto_intake_followup_hours: Number(byId('settings-auto-intake-hours')?.value || 24),
    booking_notice: byId('settings-booking-notice').value.trim(),
    default_deposit_cents: usdToCents(byId('settings-default-deposit').value),
    default_service_price_cents: usdToCents(byId('settings-default-service-price').value),
    currency: byId('settings-currency').value.trim() || 'USD',
    payment_instructions: byId('settings-payment-instructions').value.trim(),
    operating_days: selectedOperatingDays(),
  };
  try {
    const data = await api('/api/admin/settings', { method: 'POST', body: JSON.stringify(payload) });
    const settings = { ...(data.settings || {}), support_email: payload.support_email, support_phone: payload.support_phone, timezone: payload.timezone, operating_hours: data.operating_hours || '', currency: payload.currency, default_deposit_cents: payload.default_deposit_cents, default_service_price_cents: payload.default_service_price_cents, payment_instructions: payload.payment_instructions };
    renderSettings(settings);
    byId('settings-status').textContent = 'Settings saved.';
    await refreshAdmin();
  } catch (error) {
    byId('settings-status').textContent = error.message;
  }
}

async function runAutonomy() {
  try {
    const payload = {};
    if (selectedOrgId()) payload.org_id = selectedOrgId();
    const data = await api('/api/admin/autonomy/run', { method: 'POST', body: JSON.stringify(payload) });
    const result = data.result || {};
    if (byId('outbound-status')) {
      byId('outbound-status').textContent = `Autonomy queued ${result.queued_count || 0} and dispatched ${result.dispatched_count || 0}.`;
    }
    await refreshAdmin();
  } catch (error) {
    if (byId('outbound-status')) byId('outbound-status').textContent = error.message;
  }
}

async function createDesk(event) {
  event.preventDefault();
  if (!can('admin')) {
    byId('org-create-status').textContent = 'Admin role required.';
    return;
  }
  const payload = {
    name: byId('org-create-name').value.trim(),
    slug: byId('org-create-slug').value.trim(),
    support_email: byId('org-create-email').value.trim(),
    support_phone: byId('org-create-phone').value.trim(),
    timezone: byId('org-create-timezone').value.trim() || 'America/Phoenix',
    currency: byId('org-create-currency').value.trim() || 'USD',
    preset_slug: byId('org-create-preset')?.value || '',
    apply_preset_reps: !!byId('org-seed-preset-reps')?.checked,
    seed_rep_name: byId('org-seed-rep-name')?.value.trim(),
    seed_rep_email: byId('org-seed-rep-email')?.value.trim(),
    seed_rep_phone: byId('org-seed-rep-phone')?.value.trim(),
    seed_rep_role: byId('org-seed-rep-role')?.value || 'admin',
    clone_from_org_id: Number(byId('org-create-clone-source')?.value || 0) || undefined,
    clone_settings: !!byId('org-clone-settings')?.checked,
    clone_services: !!byId('org-clone-services')?.checked,
    clone_packages: !!byId('org-clone-packages')?.checked,
    clone_playbooks: !!byId('org-clone-playbooks')?.checked,
    clone_reps: !!byId('org-clone-reps')?.checked,
  };
  try {
    const data = await api('/api/admin/orgs', { method: 'POST', body: JSON.stringify(payload) });
    renderOrgFilter(data.orgs || []);
    if (data.org?.id && byId('org-filter')) byId('org-filter').value = String(data.org.id);
    const cloneSummary = data.clone?.cloned;
    const presetSummary = data.preset?.applied;
    const parts = [`Created desk ${data.org.name}.`];
    if (cloneSummary) parts.push(`Cloned ${cloneSummary.services || 0} services, ${cloneSummary.packages || 0} packages, ${cloneSummary.playbooks || 0} playbooks, ${cloneSummary.reps || 0} reps.`);
    if (presetSummary) parts.push(`Preset added ${presetSummary.services || 0} services, ${presetSummary.packages || 0} packages, ${presetSummary.playbooks || 0} playbooks, and ${presetSummary.reps || 0} preset reps.`);
    if (data.seeded_rep?.id) parts.push(`Founding operator ${data.seeded_rep.name} seeded as ${data.seeded_rep.role}.`);
    byId('org-create-status').textContent = parts.join(' ');
    await refreshAdmin();
  } catch (error) {
    byId('org-create-status').textContent = error.message;
  }
}

async function createRep() {
  if (!can('admin')) {
    byId('rep-editor-status').textContent = 'Admin role required.';
    return;
  }
  try {
    const data = await api('/api/admin/reps', { method: 'POST', body: JSON.stringify(repPayloadFromForm()) });
    byId('rep-editor-status').textContent = `Created rep ${data.rep.name}.`;
    await refreshAdmin();
    if (byId('rep-editor-select')) byId('rep-editor-select').value = String(data.rep.id);
    fillRepEditorForm(Number(data.rep.id));
  } catch (error) {
    byId('rep-editor-status').textContent = error.message;
  }
}

async function saveRep(event) {
  event.preventDefault();
  if (!can('admin')) {
    byId('rep-editor-status').textContent = 'Admin role required.';
    return;
  }
  const repId = Number(byId('rep-editor-select')?.value || 0);
  if (!repId) {
    byId('rep-editor-status').textContent = 'Pick a rep first or use Create rep.';
    return;
  }
  try {
    const data = await api(`/api/admin/reps/${repId}`, { method: 'POST', body: JSON.stringify(repPayloadFromForm()) });
    byId('rep-editor-status').textContent = `Saved rep ${data.rep.name}.`;
    await refreshAdmin();
    fillRepEditorForm(repId);
  } catch (error) {
    byId('rep-editor-status').textContent = error.message;
  }
}

function renderServices(services = []) {
  serviceCache = services;
  const shell = byId('services-shell');
  if (shell) shell.innerHTML = services.length ? services.map((service) => `
    <div class="mini-card">
      <strong>${escapeHtml(service.name || '')}</strong>
      <span>${escapeHtml(service.description || '')}</span>
      <span>${escapeHtml(formatMoneyFromCents(service.base_price_cents || 0))} total · ${escapeHtml(formatMoneyFromCents(service.deposit_cents || 0))} deposit · ${escapeHtml(String(service.duration_minutes || 0))} min</span>
    </div>
  `).join('') : '<div class="empty-state">No services yet.</div>';
  const select = byId('quote-service-id');
  if (select) {
    const prior = select.value;
    select.innerHTML = '<option value="">No service</option>' + services.map((service) => `<option value="${service.id}">${escapeHtml(service.name || '')}</option>`).join('');
    if (prior) select.value = prior;
  }
}

function renderPackages(packages = []) {
  packageCache = packages;
  const shell = byId('packages-shell');
  if (shell) shell.innerHTML = packages.length ? packages.map((item) => `
    <div class="mini-card">
      <strong>${escapeHtml(item.name || '')}</strong>
      <span>${escapeHtml(item.description || '')}</span>
      <span>${escapeHtml(formatMoneyFromCents(item.total_price_cents || 0))} total · ${escapeHtml(formatMoneyFromCents(item.deposit_cents || 0))} deposit</span>
    </div>
  `).join('') : '<div class="empty-state">No packages yet.</div>';
  const select = byId('quote-package-id');
  if (select) {
    const prior = select.value;
    select.innerHTML = '<option value="">No package</option>' + packages.map((item) => `<option value="${item.id}">${escapeHtml(item.name || '')}</option>`).join('');
    if (prior) select.value = prior;
  }
}

function renderQuotes(quotes = []) {
  quoteCache = quotes;
  const shell = byId('quotes-shell');
  if (shell) shell.innerHTML = quotes.length ? quotes.slice(0, 20).map((quote) => `
    <div class="mini-card">
      <strong>${escapeHtml(quote.title || '')}</strong>
      <span>${escapeHtml(quote.quote_code || '')} · ${escapeHtml(quote.status || '')}</span>
      <span>${escapeHtml(formatMoneyFromCents(quote.amount_cents || 0))} total · ${escapeHtml(formatMoneyFromCents(quote.deposit_cents || 0))} deposit</span>
    </div>
  `).join('') : '<div class="empty-state">No quotes yet.</div>';
}

function renderSavedViews(views = []) {
  savedViewCache = views;
  const select = byId('saved-view-select');
  if (!select) return;
  const prior = select.value;
  select.innerHTML = '<option value="">Saved views</option>' + views.map((view) => `<option value="${view.id}">${escapeHtml(view.name || '')}</option>`).join('');
  if ([...select.options].some((opt) => opt.value === prior)) select.value = prior;
}

function fillPlaybookEditor(playbook) {
  if (!playbook) {
    if (byId('playbook-name')) byId('playbook-name').value = '';
    if (byId('playbook-channel')) byId('playbook-channel').value = 'email';
    if (byId('playbook-subject')) byId('playbook-subject').value = '';
    if (byId('playbook-body')) byId('playbook-body').value = '';
    if (byId('playbook-tags')) byId('playbook-tags').value = '';
    return;
  }
  if (byId('playbook-name')) byId('playbook-name').value = playbook.name || '';
  if (byId('playbook-channel')) byId('playbook-channel').value = playbook.channel || 'email';
  if (byId('playbook-subject')) byId('playbook-subject').value = playbook.subject_template || '';
  if (byId('playbook-body')) byId('playbook-body').value = playbook.body_template || '';
  if (byId('playbook-tags')) byId('playbook-tags').value = (playbook.tags || []).join(', ');
}

function renderPlaybooks(playbooks = []) {
  playbookCache = playbooks;
  const select = byId('playbook-select');
  if (!select) return;
  const prior = select.value;
  select.innerHTML = '<option value="">Outreach playbooks</option>' + playbooks.map((item) => `<option value="${item.id}">${escapeHtml(item.name || '')} · ${escapeHtml((item.channel || 'email').toUpperCase())}</option>`).join('');
  if ([...select.options].some((opt) => opt.value === prior)) select.value = prior;
  const active = playbookCache.find((item) => String(item.id) === String(select.value || ''));
  if (active) fillPlaybookEditor(active);
  else if (playbooks.length) fillPlaybookEditor(playbooks[0]);
  else fillPlaybookEditor(null);
}

function renderEscalations(items = []) {
  escalationCache = items;
  const shell = byId('escalations-shell');
  if (!shell) return;
  shell.innerHTML = items.length ? items.slice(0, 20).map((item) => `
    <div class="mini-card">
      <strong>${escapeHtml((item.priority || 'normal').toUpperCase())} · ${escapeHtml(item.reason || 'Escalation')}</strong>
      <span>${escapeHtml(item.summary || '')}</span>
      <span>Status: ${escapeHtml(item.status || '')}</span>
      ${item.status !== 'resolved' ? `<button type="button" data-resolve-escalation="${item.id}">Resolve</button>` : ''}
    </div>
  `).join('') : '<div class="empty-state">No open escalations.</div>';
  shell.querySelectorAll('[data-resolve-escalation]').forEach((button) => {
    button.addEventListener('click', () => resolveEscalation(Number(button.getAttribute('data-resolve-escalation') || 0)));
  });
}

async function createService(event) {
  event.preventDefault();
  try {
    const data = await api('/api/admin/services', { method: 'POST', body: JSON.stringify({
      org_id: selectedOrgId(),
      slug: byId('service-slug').value.trim(),
      name: byId('service-name').value.trim(),
      description: byId('service-description').value.trim(),
      base_price_cents: usdToCents(byId('service-price').value),
      deposit_cents: usdToCents(byId('service-deposit').value),
      duration_minutes: Number(byId('service-duration').value || 45),
      keywords: byId('service-keywords').value.split(',').map((item) => item.trim()).filter(Boolean),
    }) });
    byId('service-create-status').textContent = `Created service ${data.service.name}.`;
    renderServices(data.services || []);
  } catch (error) {
    byId('service-create-status').textContent = error.message;
  }
}

async function createPackage(event) {
  event.preventDefault();
  try {
    const data = await api('/api/admin/packages', { method: 'POST', body: JSON.stringify({
      org_id: selectedOrgId(),
      slug: byId('package-slug').value.trim(),
      name: byId('package-name').value.trim(),
      description: byId('package-description').value.trim(),
      total_price_cents: usdToCents(byId('package-price').value),
      deposit_cents: usdToCents(byId('package-deposit').value),
      included_service_slugs: byId('package-services').value.split(',').map((item) => item.trim()).filter(Boolean),
    }) });
    byId('package-create-status').textContent = `Created package ${data.package.name}.`;
    renderPackages(data.packages || []);
  } catch (error) {
    byId('package-create-status').textContent = error.message;
  }
}

async function createQuote(event) {
  event.preventDefault();
  if (!selectedLeadId) {
    byId('quote-create-status').textContent = 'Pick a lead first.';
    return;
  }
  try {
    const data = await api('/api/admin/quotes', { method: 'POST', body: JSON.stringify({
      lead_id: selectedLeadId,
      appointment_id: appointmentCache.find((item) => item.lead_id === selectedLeadId && ['booked','confirmed'].includes(item.status))?.id || null,
      service_id: Number(byId('quote-service-id').value || 0) || null,
      package_id: Number(byId('quote-package-id').value || 0) || null,
      title: byId('quote-title').value.trim(),
      summary: byId('quote-summary').value.trim(),
      amount_cents: usdToCents(byId('quote-amount').value),
      deposit_cents: usdToCents(byId('quote-deposit').value),
      terms_text: byId('quote-terms').value.trim(),
    }) });
    byId('quote-create-status').textContent = `Created quote ${data.quote.quote_code}.`;
    await refreshAdmin();
  } catch (error) {
    byId('quote-create-status').textContent = error.message;
  }
}

async function resolveEscalation(escalationId) {
  if (!escalationId) return;
  try {
    await api(`/api/admin/escalations/${escalationId}/resolve`, { method: 'POST', body: JSON.stringify({ status: 'resolved' }) });
    await refreshAdmin();
  } catch (error) {
    alert(error.message);
  }
}

function selectedPlaybook() {
  return playbookCache.find((item) => item.id === Number(byId('playbook-select')?.value || 0));
}

function savedViewPayload() {
  return {
    name: byId('saved-view-name')?.value.trim() || '',
    filters: currentLeadFilters(),
    org_id: selectedOrgId(),
  };
}

async function saveCurrentView() {
  const name = byId('saved-view-name')?.value.trim() || '';
  if (!name) {
    alert('Name the saved view first.');
    return;
  }
  await api('/api/admin/lead-views', { method: 'POST', body: JSON.stringify(savedViewPayload()) });
  await refreshAdmin();
  byId('saved-view-name').value = '';
}

function applySavedView() {
  const view = savedViewCache.find((item) => item.id === Number(byId('saved-view-select')?.value || 0));
  if (!view) return;
  const filters = view.filters || {};
  if (byId('lead-search')) byId('lead-search').value = filters.query || '';
  if (byId('lead-status-filter')) byId('lead-status-filter').value = filters.status || '';
  if (byId('lead-source-filter')) byId('lead-source-filter').value = filters.source || '';
  if (byId('lead-rep-filter')) byId('lead-rep-filter').value = filters.rep || '';
  if (byId('lead-tag-filter')) byId('lead-tag-filter').value = filters.tag || '';
  renderLeads(leadCache);
}

async function deleteSavedView() {
  const viewId = Number(byId('saved-view-select')?.value || 0);
  if (!viewId) return;
  await api(`/api/admin/lead-views/${viewId}/delete`, { method: 'POST', body: JSON.stringify({}) });
  await refreshAdmin();
}

function playbookPayload() {
  return {
    org_id: selectedOrgId(),
    name: byId('playbook-name')?.value.trim() || '',
    channel: byId('playbook-channel')?.value || 'email',
    subject_template: byId('playbook-subject')?.value.trim() || '',
    body_template: byId('playbook-body')?.value.trim() || '',
    tags: parseTagCsv(byId('playbook-tags')?.value || ''),
  };
}

function loadSelectedPlaybookIntoDraft() {
  const playbook = selectedPlaybook();
  if (!playbook) return;
  fillPlaybookEditor(playbook);
  if (byId('manual-outbound-channel')) byId('manual-outbound-channel').value = playbook.channel || 'email';
  if (byId('manual-outbound-subject')) byId('manual-outbound-subject').value = playbook.subject_template || '';
  if (byId('manual-outbound-body')) byId('manual-outbound-body').value = playbook.body_template || '';
  if (byId('playbook-status')) byId('playbook-status').textContent = `Loaded ${playbook.name}.`;
}

async function savePlaybook() {
  const payload = playbookPayload();
  if (!payload.name || !payload.body_template) {
    byId('playbook-status').textContent = 'Playbook name and body are required.';
    return;
  }
  const data = await api('/api/admin/playbooks', { method: 'POST', body: JSON.stringify(payload) });
  byId('playbook-status').textContent = `Saved playbook ${data.playbook.name}.`;
  await refreshAdmin();
  if (byId('playbook-select')) byId('playbook-select').value = String(data.playbook.id);
}

async function deleteSelectedPlaybook() {
  const playbookId = Number(byId('playbook-select')?.value || 0);
  if (!playbookId) return;
  await api(`/api/admin/playbooks/${playbookId}/delete`, { method: 'POST', body: JSON.stringify({}) });
  byId('playbook-status').textContent = 'Playbook deleted.';
  await refreshAdmin();
  fillPlaybookEditor(null);
}

async function useSelectedPlaybook(sendNow = false) {
  const playbook = selectedPlaybook();
  if (!playbook) {
    byId('playbook-status').textContent = 'Pick a playbook first.';
    return;
  }
  if (!selectedLeadId) {
    byId('playbook-status').textContent = 'Pick a lead first.';
    return;
  }
  const data = await api(`/api/admin/playbooks/${playbook.id}/queue`, {
    method: 'POST',
    body: JSON.stringify({
      lead_id: selectedLeadId,
      appointment_id: appointmentCache.find((appt) => appt.lead_id === selectedLeadId && ['booked', 'confirmed'].includes(appt.status))?.id || null,
      send_now: !!sendNow,
      subject_template: byId('playbook-subject')?.value.trim() || undefined,
      body_template: byId('playbook-body')?.value.trim() || undefined,
      channel: byId('playbook-channel')?.value || playbook.channel || 'email',
    }),
  });
  byId('playbook-status').textContent = `Playbook ${sendNow ? 'sent' : 'queued'} for ${data.message?.recipient || 'lead'}.`;
  await refreshAdmin();
  await loadLeadTimeline(selectedLeadId);
}

async function applyBulkUpdate() {
  const leadIds = currentLeadIdList();
  if (!leadIds.length) {
    byId('lead-selection-summary').textContent = 'Select at least one lead first.';
    return;
  }
  const payload = {
    lead_ids: leadIds,
    qualification_status: byId('bulk-status')?.value || undefined,
    assigned_rep_id: Number(byId('bulk-rep')?.value || 0) || undefined,
    source: byId('bulk-source')?.value.trim() || undefined,
    add_tags: parseTagCsv(byId('bulk-add-tags')?.value || ''),
    remove_tags: parseTagCsv(byId('bulk-remove-tags')?.value || ''),
    touch_last_contacted: true,
  };
  const data = await api('/api/admin/leads/bulk-update', { method: 'POST', body: JSON.stringify(payload) });
  byId('lead-selection-summary').textContent = `Updated ${data.updated_count || 0} lead${Number(data.updated_count || 0) === 1 ? '' : 's'}.`;
  if (byId('bulk-add-tags')) byId('bulk-add-tags').value = '';
  if (byId('bulk-remove-tags')) byId('bulk-remove-tags').value = '';
  if (byId('bulk-source')) byId('bulk-source').value = '';
  if (byId('bulk-status')) byId('bulk-status').value = '';
  if (byId('bulk-rep')) byId('bulk-rep').value = '';
  await refreshAdmin();
}


function renderAeBridgeSummary(payload) {
  const shell = byId('ae-bridge-summary-shell');
  if (!shell) return;
  const summary = payload?.summary || {};
  const recent = payload?.recent || [];
  shell.innerHTML = `
    <div class="mini-grid">
      <div class="mini-card"><strong>${escapeHtml(String(summary.ae_source_leads || 0))}</strong><span>AE-source leads</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.booked_or_confirmed || 0))}</strong><span>Booked or confirmed</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.returnable || 0))}</strong><span>Ready to export back</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.unqualified || 0))}</strong><span>Still unqualified</span></div>
    </div>
    <div class="stack" style="margin-top:16px">
      ${recent.length ? recent.map((item) => `<div class="mini-card"><strong>${escapeHtml(item.name || 'Lead')}</strong><span>${escapeHtml(item.business_name || 'No business')} · ${escapeHtml(item.qualification_status || 'new')} · ${escapeHtml(item.source || '')}</span><span>${escapeHtml(item.assigned_owner || 'Founder Desk')} · ${escapeHtml((item.tags || []).join(', ') || 'No tags')}</span></div>`).join('') : '<div class="empty-state">No AE bridge leads are currently in this desk.</div>'}
    </div>
  `;
}


function renderAeBridgeOpsDeck(data) {
  const shell = byId('ae-bridge-ops-shell');
  if (!shell) return;
  const summary = data?.summary || {};
  const coverage = data?.coverage || [];
  const conflicts = data?.conflicts || [];
  shell.innerHTML = `
    <div class="mini-grid">
      <div class="mini-card"><strong>${escapeHtml(String(summary.total_appointments || 0))}</strong><span>Total bridge appointments</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.scheduled || 0))}</strong><span>Scheduled</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.no_show_pressure || 0))}</strong><span>No-show pressure</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.conflicts || 0))}</strong><span>Conflicts</span></div>
    </div>
    <div class="stack">
      ${(coverage || []).slice(0, 6).map((row) => `<div class="mini-card"><strong>${escapeHtml(row.day || '')}</strong><span>${escapeHtml(String(row.count || 0))} bridge appointments · ${escapeHtml(row.window || 'coverage')}</span></div>`).join('') || '<div class="mini-card"><strong>No coverage rows</strong><span>No bridge appointments are scheduled yet.</span></div>'}
      ${(conflicts || []).slice(0, 4).map((row) => `<div class="mini-card"><strong>${escapeHtml(row.client_name || 'Lead')}</strong><span>${escapeHtml(row.reason || 'Conflict')}</span></div>`).join('')}
    </div>
  `;
}

async function refreshAeBridgeOpsDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/deck'));
    renderAeBridgeOpsDeck(data);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `AE bridge ops deck loaded · ${data.summary?.conflicts || 0} conflicts and ${data.summary?.no_show_pressure || 0} no-show pressure items.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

async function exportAeBridgeOpsDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/deck'));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ae-bridge-ops-deck.json';
    a.click();
    URL.revokeObjectURL(url);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `Exported bridge ops deck with ${data.summary?.total_appointments || 0} appointments.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

async function refreshAeBridgeSummary() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge'));
    renderAeBridgeSummary(data);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `AE bridge summary loaded · ${data.summary?.ae_source_leads || 0} AE-source leads in desk.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

async function importAeBridgePayload() {
  const input = byId('ae-bridge-file');
  const file = input?.files?.[0];
  if (!file) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = 'Choose an AE bridge JSON file first.';
    return;
  }
  try {
    const raw = await file.text();
    const payload = JSON.parse(raw);
    const data = await api(scopePath('/api/admin/ae-bridge'), { method: 'POST', body: JSON.stringify(payload) });
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `Imported ${data.imported?.created || 0} created and ${data.imported?.updated || 0} updated AE bridge leads.`;
    await refreshAdmin();
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

async function exportAeBridgePayload() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/export'));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ae-bridge-export.json';
    a.click();
    URL.revokeObjectURL(url);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `Exported ${data.summary?.returnable || 0} returnable lead outcomes.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}



function renderAeBridgeSyncDeck(data) {
  const shell = byId('ae-bridge-sync-shell');
  if (!shell) return;
  const summary = data?.summary || {};
  const rows = data?.rows || [];
  shell.innerHTML = `
    <div class="mini-grid">
      <div class="mini-card"><strong>${escapeHtml(String(summary.total || 0))}</strong><span>Total packets</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.inbound || 0))}</strong><span>Inbound packets</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.outbound || 0))}</strong><span>Outbound packets</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.return_ready || 0))}</strong><span>Return-ready outcomes</span></div>
    </div>
    <div class="mini-grid" style="margin-top:16px">
      ${rows.slice(0, 6).map((row) => `<div class="mini-card"><strong>${escapeHtml(row.client_name || 'Lead')}</strong><span>${escapeHtml(row.direction || 'bridge')} · ${escapeHtml(row.kind || 'packet')} · ${escapeHtml(row.status || 'queued')}</span><span>${escapeHtml(row.note || row.appointment_status || 'No detail')}</span></div>`).join('') || '<div class="empty-state">No AE bridge sync rows exist yet.</div>'}
    </div>`;
}

async function refreshAeBridgeSyncDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/sync'));
    renderAeBridgeSyncDeck(data);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `AE bridge sync deck loaded · ${data.summary?.total || 0} packets.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

async function exportAeBridgeSyncDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/sync'));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ae-bridge-sync-deck.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `Exported sync deck with ${data.summary?.total || 0} packets.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

function renderAeBridgeFulfillmentDeck(data) {
  const shell = byId('ae-bridge-fulfillment-shell');
  if (!shell) return;
  const summary = data?.summary || {};
  const rows = data?.rows || [];
  shell.innerHTML = `
    <div class="mini-grid">
      <div class="mini-card"><strong>${escapeHtml(String(summary.total || 0))}</strong><span>Total fulfillment packets</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.queued || 0))}</strong><span>Queued</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.in_progress || 0))}</strong><span>In progress</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.completed || 0))}</strong><span>Completed</span></div>
    </div>
    <div class="mini-grid" style="margin-top:16px">
      ${rows.slice(0, 6).map((row) => `<div class="mini-card"><strong>${escapeHtml(row.client_name || 'Lead')}</strong><span>${escapeHtml(row.status || 'queued')} · due ${escapeHtml(row.due_date || 'not set')}</span><span>${escapeHtml(row.owner || 'Founder Desk')} · ${escapeHtml(formatCurrency(row.amount || 0))}</span></div>`).join('') || '<div class="empty-state">No AE bridge fulfillment rows exist yet.</div>'}
    </div>`;
}

async function refreshAeBridgeFulfillmentDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/fulfillment'));
    renderAeBridgeFulfillmentDeck(data);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `AE bridge fulfillment deck loaded · ${data.summary?.total || 0} packets.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

async function exportAeBridgeFulfillmentDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/fulfillment'));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ae-bridge-fulfillment-deck.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `Exported fulfillment deck with ${data.summary?.total || 0} packets.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

function renderAeBridgeRevenueDeck(data) {
  const shell = byId('ae-bridge-revenue-shell');
  if (!shell) return;
  const summary = data?.summary || {};
  const rows = data?.rows || [];
  shell.innerHTML = `
    <div class="mini-grid">
      <div class="mini-card"><strong>${escapeHtml(String(summary.bookings || 0))}</strong><span>Bridge bookings</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.deposits_requested || 0))}</strong><span>Deposits requested</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.deposits_paid || 0))}</strong><span>Deposits paid</span></div>
      <div class="mini-card"><strong>${escapeHtml(formatCurrency(summary.deposit_collected_value || 0))}</strong><span>Collected value</span></div>
    </div>
    <div class="stack">
      ${rows.slice(0, 6).map((row) => `<div class="mini-card"><strong>${escapeHtml(row.client_name || 'Lead')}</strong><span>${escapeHtml(row.status || 'scheduled')} · ${escapeHtml(row.deposit_status || 'none')} ${escapeHtml(formatCurrency(row.deposit_amount || 0))}</span><span>Est ${escapeHtml(formatCurrency(row.estimated_value || 0))} · ${escapeHtml(row.assigned_owner || 'Founder Desk')}</span></div>`).join('') || '<div class="empty-state">No AE bridge revenue rows exist yet.</div>'}
    </div>
  `;
}

function renderAeBridgeCalendarDeck(data) {
  const shell = byId('ae-bridge-calendar-shell');
  if (!shell) return;
  const summary = data?.summary || {};
  const rows = data?.rows || [];
  const conflicts = data?.conflicts || [];
  shell.innerHTML = `
    <div class="mini-grid">
      <div class="mini-card"><strong>${escapeHtml(String(summary.total_capacity || 0))}</strong><span>Total capacity</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.total_scheduled || 0))}</strong><span>Scheduled</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.total_open_slots || 0))}</strong><span>Open slots</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.conflicts || 0))}</strong><span>Conflicts</span></div>
    </div>
    <div class="stack">
      ${rows.slice(0, 6).map((row) => `<div class="mini-card"><strong>${escapeHtml(row.day || '')}</strong><span>${escapeHtml(row.weekday || '')} · scheduled ${escapeHtml(String(row.scheduled || 0))}/${escapeHtml(String(row.capacity || 0))}</span><span>Open ${escapeHtml(String(row.open_slots || 0))} · Watch ${escapeHtml(String(row.watch || 0))}</span></div>`).join('') || '<div class="empty-state">No calendar bridge rows exist yet.</div>'}
      ${conflicts.slice(0, 3).map((row) => `<div class="mini-card"><strong>${escapeHtml(row.client_name || 'Lead')}</strong><span>${escapeHtml(row.reason || 'Conflict')}</span></div>`).join('')}
    </div>
  `;
}

async function refreshAeBridgeRevenueDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/revenue'));
    renderAeBridgeRevenueDeck(data);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `AE bridge revenue deck loaded · ${data.summary?.deposits_paid || 0} deposits paid.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

async function exportAeBridgeRevenueDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/revenue'));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ae-bridge-revenue-deck.json';
    a.click();
    URL.revokeObjectURL(url);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `Exported revenue deck with ${data.summary?.bookings || 0} bookings.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

async function refreshAeBridgeCalendarDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/calendar'));
    renderAeBridgeCalendarDeck(data);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `AE bridge calendar deck loaded · ${data.summary?.total_open_slots || 0} open slots.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

async function exportAeBridgeCalendarDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/calendar'));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ae-bridge-calendar-deck.json';
    a.click();
    URL.revokeObjectURL(url);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `Exported calendar deck with ${data.summary?.conflicts || 0} conflicts.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}


function renderAeBridgeSettlementDeck(data) {
  const shell = byId('ae-bridge-settlement-shell');
  if (!shell) return;
  const summary = data?.summary || {};
  const rows = data?.rows || [];
  shell.innerHTML = `
    <div class="mini-grid">
      <div class="mini-card"><strong>${escapeHtml(String(summary.draft || 0))}</strong><span>Draft</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.sent || 0))}</strong><span>Sent</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.paid || 0))}</strong><span>Paid</span></div>
      <div class="mini-card"><strong>${escapeHtml(formatCurrency(summary.collected_value || 0))}</strong><span>Collected value</span></div>
    </div>
    <div class="stack">
      ${rows.slice(0, 6).map((row) => `<div class="mini-card"><strong>${escapeHtml(row.client_name || 'Lead')}</strong><span>${escapeHtml(row.status || 'draft')} · ${escapeHtml(formatCurrency(row.amount || 0))}</span><span>${escapeHtml(row.appointment_status || 'scheduled')} · ${escapeHtml(row.assigned_owner || 'Founder Desk')}</span></div>`).join('') || '<div class="empty-state">No AE bridge settlement rows exist yet.</div>'}
    </div>
  `;
}

function renderAeBridgeFunnelDeck(data) {
  const shell = byId('ae-bridge-funnel-shell');
  if (!shell) return;
  const summary = data?.summary || {};
  const rows = data?.rows || [];
  shell.innerHTML = `
    <div class="mini-grid">
      <div class="mini-card"><strong>${escapeHtml(String(summary.handoffs || 0))}</strong><span>Handoffs</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.booked || 0))}</strong><span>Booked</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.settlements_paid || 0))}</strong><span>Settlements paid</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.paid_rate || 0))}%</strong><span>Paid rate</span></div>
    </div>
    <div class="stack">
      ${rows.slice(0, 6).map((row) => `<div class="mini-card"><strong>${escapeHtml(row.ae_name || 'AE')}</strong><span>handoffs ${escapeHtml(String(row.handoffs || 0))} · booked ${escapeHtml(String(row.booked || 0))}</span><span>paid ${escapeHtml(String(row.paid || 0))} · paid-rate ${escapeHtml(String(row.paid_rate || 0))}%</span></div>`).join('') || '<div class="empty-state">No AE bridge funnel rows exist yet.</div>'}
    </div>
  `;
}

async function refreshAeBridgeSettlementDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/settlements'));
    renderAeBridgeSettlementDeck(data);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `AE bridge settlement deck loaded · ${data.summary?.paid || 0} paid rows.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

async function exportAeBridgeSettlementDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/settlements'));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ae-bridge-settlement-deck.json';
    a.click();
    URL.revokeObjectURL(url);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `Exported settlement deck with ${data.summary?.paid || 0} paid rows.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

async function refreshAeBridgeFunnelDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/funnel'));
    renderAeBridgeFunnelDeck(data);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `AE bridge funnel deck loaded · ${data.summary?.paid_rate || 0}% paid rate.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

async function exportAeBridgeFunnelDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/funnel'));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ae-bridge-funnel-deck.json';
    a.click();
    URL.revokeObjectURL(url);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `Exported funnel deck with ${data.summary?.handoffs || 0} handoffs.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}



function renderAeBridgeProfitabilityDeck(data) {
  const shell = byId('ae-bridge-profitability-shell');
  if (!shell) return;
  const summary = data?.summary || {};
  const rows = data?.rows || [];
  shell.innerHTML = `
    <div class="mini-grid">
      <div class="mini-card"><strong>${escapeHtml(String(summary.total || 0))}</strong><span>Total rows</span></div>
      <div class="mini-card"><strong>${escapeHtml(formatCurrency(summary.collected || 0))}</strong><span>Collected</span></div>
      <div class="mini-card"><strong>${escapeHtml(formatCurrency(summary.delivery_reserve || 0))}</strong><span>Delivery reserve</span></div>
      <div class="mini-card"><strong>${escapeHtml(formatCurrency(summary.net_position || 0))}</strong><span>Net position</span></div>
    </div>
    <div class="stack">
      ${rows.slice(0, 6).map((row) => `<div class="mini-card"><strong>${escapeHtml(row.client_name || 'Lead')}</strong><span>${escapeHtml(row.fulfillment_status || 'not-opened')} · collected ${escapeHtml(formatCurrency(row.collected || 0))}</span><span>reserve ${escapeHtml(formatCurrency(row.delivery_reserve || 0))} · net ${escapeHtml(formatCurrency(row.net_position || 0))}</span></div>`).join('') || '<div class="empty-state">No AE bridge profitability rows exist yet.</div>'}
    </div>
  `;
}

function renderAeBridgeTemplateDeck(data) {
  const shell = byId('ae-bridge-template-shell');
  if (!shell) return;
  const summary = data?.summary || {};
  const rows = data?.rows || [];
  shell.innerHTML = `
    <div class="mini-grid">
      <div class="mini-card"><strong>${escapeHtml(String(summary.total || 0))}</strong><span>Total rows</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.service_launch || 0))}</strong><span>Service Launch</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.premium_whiteglove || 0))}</strong><span>Premium White-Glove</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(summary.local_growth_sprint || 0))}</strong><span>Local Growth Sprint</span></div>
    </div>
    <div class="stack">
      ${rows.slice(0, 6).map((row) => `<div class="mini-card"><strong>${escapeHtml(row.client_name || 'Lead')}</strong><span>${escapeHtml(row.template_id || 'service-launch')} · ${escapeHtml(formatCurrency(row.estimated_value || 0))}</span><span>${escapeHtml(row.reason || 'No reason')}</span></div>`).join('') || '<div class="empty-state">No AE bridge template rows exist yet.</div>'}
    </div>
  `;
}

async function refreshAeBridgeProfitabilityDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/profitability'));
    renderAeBridgeProfitabilityDeck(data);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `AE bridge profitability deck loaded · ${data.summary?.margin_watch || 0} margin-watch rows.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

async function exportAeBridgeProfitabilityDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/profitability'));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ae-bridge-profitability-deck.json';
    a.click();
    URL.revokeObjectURL(url);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `Exported profitability deck with ${data.summary?.total || 0} rows.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

async function refreshAeBridgeTemplateDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/templates'));
    renderAeBridgeTemplateDeck(data);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `AE bridge template deck loaded · ${data.summary?.premium_whiteglove || 0} premium template recommendations.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}

async function exportAeBridgeTemplateDeck() {
  try {
    const data = await api(scopePath('/api/admin/ae-bridge/templates'));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ae-bridge-template-deck.json';
    a.click();
    URL.revokeObjectURL(url);
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = `Exported template deck with ${data.summary?.total || 0} recommendations.`;
  } catch (error) {
    if (byId('ae-bridge-status')) byId('ae-bridge-status').textContent = error.message;
  }
}


async function refreshAdmin() {
  const activeOrgId = selectedOrgId() || (orgCache[0]?.id || 1);
  const selectedPreset = byId('readiness-preset-select')?.value || '';
  const requests = [
    api(scopePath('/api/admin/summary')),
    api(scopePath('/api/admin/reps')),
    api(scopePath('/api/admin/leads')),
    api(scopePath('/api/admin/appointments')),
    api(scopePath('/api/admin/analytics')),
    featureEnabled('inbound') ? api(scopePath('/api/admin/inbox')) : Promise.resolve({ messages: [] }),
    featureEnabled('outbound') ? api(scopePath('/api/outbound/history')) : Promise.resolve({ messages: [] }),
    featureEnabled('voice') ? api(scopePath('/api/admin/voice/calls')) : Promise.resolve({ calls: [] }),
    featureEnabled('calendar') ? api(scopePath('/api/admin/calendar/status')) : Promise.resolve({ providers: [], links: [], logs: [] }),
    api(scopePath('/api/admin/runtime')),
    api(scopePath('/api/admin/audit?limit=20')),
    api(scopePath('/api/admin/settings')),
    api(scopePath('/api/admin/services')),
    api(scopePath('/api/admin/packages')),
    api(scopePath('/api/admin/quotes')),
    api(scopePath('/api/admin/escalations')),
    api(scopePath('/api/admin/lead-views')),
    api(scopePath('/api/admin/playbooks')),
    api(scopePath('/api/admin/ae-bridge')),
    api(scopePath('/api/admin/ae-bridge/deck')),
    api(scopePath('/api/admin/ae-bridge/sync')),
    api(scopePath('/api/admin/ae-bridge/fulfillment')),
    api(scopePath('/api/admin/ae-bridge/revenue')),
    api(scopePath('/api/admin/ae-bridge/calendar')),
    api(scopePath('/api/admin/ae-bridge/settlements')),
    api(scopePath('/api/admin/ae-bridge/funnel')),
    api(scopePath('/api/admin/ae-bridge/profitability')),
    api(scopePath('/api/admin/ae-bridge/templates')),
    api(`/api/admin/orgs/${activeOrgId}/readiness`),
    api(`/api/admin/orgs/${activeOrgId}/onboarding-plan${selectedPreset ? `?preset_slug=${encodeURIComponent(selectedPreset)}` : ''}`),
  ];
  const [summaryData, repsData, leadsData, appointmentsData, analyticsData, inboxData, outboundData, voiceData, calendarData, runtimeData, auditData, settingsData, servicesData, packagesData, quotesData, escalationsData, viewsData, playbooksData, aeBridgeData, aeBridgeOpsData, aeBridgeSyncData, aeBridgeFulfillmentData, aeBridgeRevenueData, aeBridgeCalendarData, aeBridgeSettlementData, aeBridgeFunnelData, aeBridgeProfitabilityData, aeBridgeTemplateData, readinessData, onboardingPlanData] = await Promise.all(requests);
  renderSummary(summaryData.summary);
  renderLeads(leadsData.leads);
  renderAppointments(appointmentsData.appointments);
  renderReps(repsData.reps, analyticsData.analytics);
  renderRepScorecards(analyticsData.analytics?.rep_scorecards || []);
  renderSourceAttribution(analyticsData.analytics?.source_attribution || []);
  renderRiskBoard(analyticsData.risk_board || []);
  renderInbox(inboxData.messages || []);
  renderOutbound(outboundData.messages || []);
  renderVoiceCalls(voiceData.calls || []);
  renderCalendarStatus(calendarData);
  renderRuntime(runtimeData);
  renderAudit(auditData.events || []);
  renderSettings(settingsData.settings || {});
  renderServices(servicesData.services || []);
  renderPackages(packagesData.packages || []);
  renderQuotes(quotesData.quotes || []);
  renderEscalations(escalationsData.escalations || []);
  renderSavedViews(viewsData.views || []);
  renderPlaybooks(playbooksData.playbooks || []);
  renderAeBridgeSummary(aeBridgeData);
  renderAeBridgeOpsDeck(aeBridgeOpsData);
  renderAeBridgeSyncDeck(aeBridgeSyncData);
  renderAeBridgeFulfillmentDeck(aeBridgeFulfillmentData);
  renderAeBridgeRevenueDeck(aeBridgeRevenueData);
  renderAeBridgeCalendarDeck(aeBridgeCalendarData);
  renderAeBridgeSettlementDeck(aeBridgeSettlementData);
  renderAeBridgeFunnelDeck(aeBridgeFunnelData);
  renderAeBridgeProfitabilityDeck(aeBridgeProfitabilityData);
  renderAeBridgeTemplateDeck(aeBridgeTemplateData);
  renderOrgReadiness(readinessData.readiness || null);
  renderOrgOnboardingPlan(onboardingPlanData.plan || null);
  if (selectedLeadId && leadCache.some((item) => item.id === selectedLeadId)) {
    await loadTranscript(selectedLeadId);
  } else if (!selectedLeadId) {
    renderManualSlots([]);
    renderLeadTimeline([]);
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  pageConfig = await loadPublicConfig();
  applyFeatureVisibility();
  populateOutboundChannels();
  const me = await authMe();
  if (me.user?.must_change_password) {
    window.location.href = `/auth/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}&must_change=1`;
    return;
  }
  authUser = me.user;
  renderAuthPill();
  const [orgData, presetData] = await Promise.all([api('/api/admin/orgs'), api('/api/admin/org-presets')]);
  renderOrgFilter(orgData.orgs || []);
  renderOrgPresets(presetData.presets || []);
  const queryOrg = currentOrgSlug();
  if (queryOrg && orgCache.length) {
    const match = orgCache.find((org) => org.slug === queryOrg);
    if (match) byId('org-filter').value = String(match.id);
  }
  await refreshAdmin();
  byId('refresh-admin').addEventListener('click', refreshAdmin);
  byId('org-filter').addEventListener('change', refreshAdmin);
  if (byId('ae-bridge-refresh')) byId('ae-bridge-refresh').addEventListener('click', refreshAeBridgeSummary);
  if (byId('ae-bridge-import')) byId('ae-bridge-import').addEventListener('click', importAeBridgePayload);
  if (byId('ae-bridge-export')) byId('ae-bridge-export').addEventListener('click', exportAeBridgePayload);
  if (byId('ae-bridge-ops-refresh')) byId('ae-bridge-ops-refresh').addEventListener('click', refreshAeBridgeOpsDeck);
  if (byId('ae-bridge-ops-export')) byId('ae-bridge-ops-export').addEventListener('click', exportAeBridgeOpsDeck);
  if (byId('ae-bridge-sync-refresh')) byId('ae-bridge-sync-refresh').addEventListener('click', refreshAeBridgeSyncDeck);
  if (byId('ae-bridge-sync-export')) byId('ae-bridge-sync-export').addEventListener('click', exportAeBridgeSyncDeck);
  if (byId('ae-bridge-fulfillment-refresh')) byId('ae-bridge-fulfillment-refresh').addEventListener('click', refreshAeBridgeFulfillmentDeck);
  if (byId('ae-bridge-fulfillment-export')) byId('ae-bridge-fulfillment-export').addEventListener('click', exportAeBridgeFulfillmentDeck);
  if (byId('ae-bridge-revenue-refresh')) byId('ae-bridge-revenue-refresh').addEventListener('click', refreshAeBridgeRevenueDeck);
  if (byId('ae-bridge-revenue-export')) byId('ae-bridge-revenue-export').addEventListener('click', exportAeBridgeRevenueDeck);
  if (byId('ae-bridge-calendar-refresh')) byId('ae-bridge-calendar-refresh').addEventListener('click', refreshAeBridgeCalendarDeck);
  if (byId('ae-bridge-calendar-export')) byId('ae-bridge-calendar-export').addEventListener('click', exportAeBridgeCalendarDeck);
  if (byId('ae-bridge-settlement-refresh')) byId('ae-bridge-settlement-refresh').addEventListener('click', refreshAeBridgeSettlementDeck);
  if (byId('ae-bridge-settlement-export')) byId('ae-bridge-settlement-export').addEventListener('click', exportAeBridgeSettlementDeck);
  if (byId('ae-bridge-funnel-refresh')) byId('ae-bridge-funnel-refresh').addEventListener('click', refreshAeBridgeFunnelDeck);
  if (byId('ae-bridge-funnel-export')) byId('ae-bridge-funnel-export').addEventListener('click', exportAeBridgeFunnelDeck);
  if (byId('ae-bridge-profitability-refresh')) byId('ae-bridge-profitability-refresh').addEventListener('click', refreshAeBridgeProfitabilityDeck);
  if (byId('ae-bridge-profitability-export')) byId('ae-bridge-profitability-export').addEventListener('click', exportAeBridgeProfitabilityDeck);
  if (byId('ae-bridge-template-refresh')) byId('ae-bridge-template-refresh').addEventListener('click', refreshAeBridgeTemplateDeck);
  if (byId('ae-bridge-template-export')) byId('ae-bridge-template-export').addEventListener('click', exportAeBridgeTemplateDeck);
  if (byId('run-autonomy')) byId('run-autonomy').addEventListener('click', runAutonomy);
  if (byId('run-readiness-autofix')) byId('run-readiness-autofix').addEventListener('click', runReadinessAutofix);
  if (byId('download-onboarding-plan')) byId('download-onboarding-plan').addEventListener('click', downloadOnboardingPlan);
  if (byId('download-onboarding-runbook')) byId('download-onboarding-runbook').addEventListener('click', downloadOnboardingRunbook);
  if (byId('readiness-preset-select')) byId('readiness-preset-select').addEventListener('change', refreshAdmin);
  if (byId('queue-reminders')) byId('queue-reminders').addEventListener('click', queueReminders);
  if (byId('dispatch-outbound')) byId('dispatch-outbound').addEventListener('click', dispatchOutbound);
  if (byId('voice-followup')) byId('voice-followup').addEventListener('click', () => startVoice('followup'));
  if (byId('voice-reminder')) byId('voice-reminder').addEventListener('click', () => startVoice('reminder'));
  if (byId('sync-calendars')) byId('sync-calendars').addEventListener('click', syncCalendars);
  if (byId('settings-form')) byId('settings-form').addEventListener('submit', saveSettings);
  if (byId('org-create-form')) byId('org-create-form').addEventListener('submit', createDesk);
  if (byId('org-create-preset')) byId('org-create-preset').addEventListener('change', syncOrgPresetSummary);
  if (byId('rep-editor-form')) byId('rep-editor-form').addEventListener('submit', saveRep);
  if (byId('rep-create-submit')) byId('rep-create-submit').addEventListener('click', createRep);
  if (byId('rep-clear-submit')) byId('rep-clear-submit').addEventListener('click', clearRepEditorForm);
  if (byId('rep-editor-select')) byId('rep-editor-select').addEventListener('change', () => fillRepEditorForm(Number(byId('rep-editor-select').value || 0)));
  if (byId('lead-editor-form')) byId('lead-editor-form').addEventListener('submit', saveSelectedLead);
  if (byId('create-lead')) byId('create-lead').addEventListener('click', createLeadFromForm);
  if (byId('clear-lead')) byId('clear-lead').addEventListener('click', clearLeadEditorForm);
  if (byId('refresh-manual-slots')) byId('refresh-manual-slots').addEventListener('click', () => loadManualSlots(selectedLeadId));
  if (byId('manual-booking-form')) byId('manual-booking-form').addEventListener('submit', manualBookSelectedLead);
  if (byId('lead-search')) byId('lead-search').addEventListener('input', () => renderLeads(leadCache));
  if (byId('lead-status-filter')) byId('lead-status-filter').addEventListener('change', () => renderLeads(leadCache));
  if (byId('lead-source-filter')) byId('lead-source-filter').addEventListener('change', () => renderLeads(leadCache));
  if (byId('lead-rep-filter')) byId('lead-rep-filter').addEventListener('change', () => renderLeads(leadCache));
  if (byId('lead-tag-filter')) byId('lead-tag-filter').addEventListener('input', () => renderLeads(leadCache));
  if (byId('lead-select-all')) byId('lead-select-all').addEventListener('change', (event) => {
    const visibleIds = filteredLeads(leadCache).map((lead) => lead.id);
    if (event.target.checked) visibleIds.forEach((id) => selectedLeadIds.add(id));
    else visibleIds.forEach((id) => selectedLeadIds.delete(id));
    renderLeads(leadCache);
  });
  if (byId('saved-view-select')) byId('saved-view-select').addEventListener('change', applySavedView);
  if (byId('apply-saved-view')) byId('apply-saved-view').addEventListener('click', applySavedView);
  if (byId('save-saved-view')) byId('save-saved-view').addEventListener('click', saveCurrentView);
  if (byId('delete-saved-view')) byId('delete-saved-view').addEventListener('click', deleteSavedView);
  if (byId('apply-bulk-update')) byId('apply-bulk-update').addEventListener('click', applyBulkUpdate);
  if (byId('playbook-select')) byId('playbook-select').addEventListener('change', () => fillPlaybookEditor(selectedPlaybook()));
  if (byId('playbook-load')) byId('playbook-load').addEventListener('click', loadSelectedPlaybookIntoDraft);
  if (byId('playbook-queue')) byId('playbook-queue').addEventListener('click', () => useSelectedPlaybook(false));
  if (byId('playbook-send')) byId('playbook-send').addEventListener('click', () => useSelectedPlaybook(true));
  if (byId('playbook-save')) byId('playbook-save').addEventListener('click', savePlaybook);
  if (byId('playbook-delete')) byId('playbook-delete').addEventListener('click', deleteSelectedPlaybook);
  if (byId('manual-outbound-form')) byId('manual-outbound-form').addEventListener('submit', async (event) => { event.preventDefault(); await submitManualOutbound(false); });
  if (byId('service-create-form')) byId('service-create-form').addEventListener('submit', createService);
  if (byId('package-create-form')) byId('package-create-form').addEventListener('submit', createPackage);
  if (byId('quote-create-form')) byId('quote-create-form').addEventListener('submit', createQuote);
  if (byId('manual-outbound-send')) byId('manual-outbound-send').addEventListener('click', () => submitManualOutbound(true));
  if (byId('manual-outbound-channel')) byId('manual-outbound-channel').addEventListener('change', () => {
    const lead = leadCache.find((item) => item.id === selectedLeadId) || {};
    const channel = byId('manual-outbound-channel').value;
    byId('manual-outbound-recipient').value = channel === 'sms' ? (lead.phone || '') : (lead.email || '');
  });
  if (byId('intake-form')) byId('intake-form').addEventListener('submit', saveIntake);
  if (byId('invoice-form')) byId('invoice-form').addEventListener('submit', createInvoiceForLead);
  if (byId('payment-form')) byId('payment-form').addEventListener('submit', recordLeadPayment);
  if (byId('document-form')) byId('document-form').addEventListener('submit', saveDocument);
  if (byId('artifact-form')) byId('artifact-form').addEventListener('submit', uploadArtifact);
  if (byId('artifact-include-deleted')) byId('artifact-include-deleted').addEventListener('change', async (event) => { artifactShowDeleted = !!event.target.checked; if (selectedLeadId) await loadLeadArtifacts(selectedLeadId); });
  if (byId('artifact-select-visible')) byId('artifact-select-visible').addEventListener('change', (event) => {
    const visibleIds = artifactCache.map((item) => Number(item.id)).filter(Boolean);
    if (event.target.checked) visibleIds.forEach((id) => artifactSelection.add(id));
    else visibleIds.forEach((id) => artifactSelection.delete(id));
    renderArtifacts(artifactCache);
  });
  if (byId('artifact-batch-run')) byId('artifact-batch-run').addEventListener('click', runArtifactBatchAction);
  if (byId('artifact-export-pack')) byId('artifact-export-pack').addEventListener('click', exportArtifactPack);
  if (byId('document-clear')) byId('document-clear').addEventListener('click', () => { clearDocumentForm(); if (byId('document-status-note')) byId('document-status-note').textContent = 'Document form cleared.'; });
  byId('logout-link').addEventListener('click', async (event) => {
    event.preventDefault();
    await logout();
  });
});

let paymentPlanCache = [];

function clearServiceForm() {
  if (byId('service-id')) byId('service-id').value = '';
  if (byId('service-slug')) byId('service-slug').value = '';
  if (byId('service-name')) byId('service-name').value = '';
  if (byId('service-price')) byId('service-price').value = '';
  if (byId('service-deposit')) byId('service-deposit').value = '';
  if (byId('service-duration')) byId('service-duration').value = '45';
  if (byId('service-description')) byId('service-description').value = '';
  if (byId('service-keywords')) byId('service-keywords').value = '';
}

function fillServiceForm(service) {
  if (!service) return clearServiceForm();
  if (byId('service-id')) byId('service-id').value = String(service.id || '');
  if (byId('service-slug')) byId('service-slug').value = service.slug || '';
  if (byId('service-name')) byId('service-name').value = service.name || '';
  if (byId('service-price')) byId('service-price').value = ((Number(service.base_price_cents || 0)) / 100).toFixed(2);
  if (byId('service-deposit')) byId('service-deposit').value = ((Number(service.deposit_cents || 0)) / 100).toFixed(2);
  if (byId('service-duration')) byId('service-duration').value = String(service.duration_minutes || 45);
  if (byId('service-description')) byId('service-description').value = service.description || '';
  if (byId('service-keywords')) byId('service-keywords').value = ((service.metadata || {}).keywords || []).join(', ');
}

function clearPackageForm() {
  if (byId('package-id')) byId('package-id').value = '';
  if (byId('package-slug')) byId('package-slug').value = '';
  if (byId('package-name')) byId('package-name').value = '';
  if (byId('package-price')) byId('package-price').value = '';
  if (byId('package-deposit')) byId('package-deposit').value = '';
  if (byId('package-description')) byId('package-description').value = '';
  if (byId('package-services')) byId('package-services').value = '';
}

function fillPackageForm(item) {
  if (!item) return clearPackageForm();
  if (byId('package-id')) byId('package-id').value = String(item.id || '');
  if (byId('package-slug')) byId('package-slug').value = item.slug || '';
  if (byId('package-name')) byId('package-name').value = item.name || '';
  if (byId('package-price')) byId('package-price').value = ((Number(item.total_price_cents || 0)) / 100).toFixed(2);
  if (byId('package-deposit')) byId('package-deposit').value = ((Number(item.deposit_cents || 0)) / 100).toFixed(2);
  if (byId('package-description')) byId('package-description').value = item.description || '';
  if (byId('package-services')) byId('package-services').value = ((item.metadata || {}).included_service_slugs || []).join(', ');
}

function clearQuoteForm() {
  if (byId('quote-id')) byId('quote-id').value = '';
  if (byId('quote-service-id')) byId('quote-service-id').value = '';
  if (byId('quote-package-id')) byId('quote-package-id').value = '';
  if (byId('quote-title')) byId('quote-title').value = '';
  if (byId('quote-amount')) byId('quote-amount').value = '';
  if (byId('quote-deposit')) byId('quote-deposit').value = '';
  if (byId('quote-status')) byId('quote-status').value = 'draft';
  if (byId('quote-expires-at')) byId('quote-expires-at').value = '';
  if (byId('quote-summary')) byId('quote-summary').value = '';
  if (byId('quote-terms')) byId('quote-terms').value = '';
}

function fillQuoteForm(quote) {
  if (!quote) return clearQuoteForm();
  if (byId('quote-id')) byId('quote-id').value = String(quote.id || '');
  if (byId('quote-service-id')) byId('quote-service-id').value = String(quote.service_id || '');
  if (byId('quote-package-id')) byId('quote-package-id').value = String(quote.package_id || '');
  if (byId('quote-title')) byId('quote-title').value = quote.title || '';
  if (byId('quote-amount')) byId('quote-amount').value = ((Number(quote.amount_cents || 0)) / 100).toFixed(2);
  if (byId('quote-deposit')) byId('quote-deposit').value = ((Number(quote.deposit_cents || 0)) / 100).toFixed(2);
  if (byId('quote-status')) byId('quote-status').value = quote.status || 'draft';
  if (byId('quote-expires-at')) byId('quote-expires-at').value = quote.expires_at || '';
  if (byId('quote-summary')) byId('quote-summary').value = quote.summary || '';
  if (byId('quote-terms')) byId('quote-terms').value = quote.terms_text || '';
}

function currentLeadQuotes() {
  return (quoteCache || []).filter((quote) => !selectedLeadId || Number(quote.lead_id || 0) === Number(selectedLeadId));
}

function populatePlanQuoteOptions() {
  const select = byId('plan-quote-select');
  if (!select) return;
  const prior = select.value;
  const quotes = currentLeadQuotes();
  select.innerHTML = '<option value="">Optional quote</option>' + quotes.map((quote) => `<option value="${quote.id}">${escapeHtml(quote.title || quote.quote_code || 'Quote')} · ${escapeHtml(formatMoneyFromCents(quote.amount_cents || 0))}</option>`).join('');
  if ([...select.options].some((opt) => opt.value === prior)) select.value = prior;
}

function populateMembershipQuoteOptions() {
  const select = byId('membership-quote-select');
  if (!select) return;
  const prior = select.value;
  const quotes = currentLeadQuotes();
  select.innerHTML = '<option value="">Optional quote</option>' + quotes.map((quote) => `<option value="${quote.id}">${escapeHtml(quote.title || quote.quote_code || 'Quote')} · ${escapeHtml(formatMoneyFromCents(quote.amount_cents || 0))}</option>`).join('');
  if ([...select.options].some((opt) => opt.value === prior)) select.value = prior;
}

function renderServices(services = []) {
  serviceCache = services;
  const shell = byId('services-shell');
  if (shell) shell.innerHTML = services.length ? services.map((service) => `
    <div class="mini-card">
      <strong>${escapeHtml(service.name || '')}</strong>
      <span>${escapeHtml(service.slug || '')} · ${Number(service.active || 0) ? 'active' : 'inactive'}</span>
      <span>${escapeHtml(service.description || '')}</span>
      <span>${escapeHtml(formatMoneyFromCents(service.base_price_cents || 0))} total · ${escapeHtml(formatMoneyFromCents(service.deposit_cents || 0))} deposit · ${escapeHtml(String(service.duration_minutes || 0))} min</span>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px">
        <button type="button" class="secondary" data-load-service="${service.id}">Load</button>
        <button type="button" class="secondary" data-toggle-service="${service.id}" data-next-active="${Number(service.active || 0) ? 0 : 1}">${Number(service.active || 0) ? 'Deactivate' : 'Activate'}</button>
      </div>
    </div>
  `).join('') : '<div class="empty-state">No services yet.</div>';
  const select = byId('quote-service-id');
  if (select) {
    const prior = select.value;
    select.innerHTML = '<option value="">No service</option>' + services.map((service) => `<option value="${service.id}">${escapeHtml(service.name || '')}</option>`).join('');
    if (prior && [...select.options].some((opt) => opt.value === prior)) select.value = prior;
  }
  shell?.querySelectorAll('[data-load-service]').forEach((button) => {
    button.addEventListener('click', () => {
      fillServiceForm(serviceCache.find((item) => String(item.id) === String(button.dataset.loadService)) || null);
      if (byId('service-create-status')) byId('service-create-status').textContent = 'Service loaded for editing.';
    });
  });
  shell?.querySelectorAll('[data-toggle-service]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const current = serviceCache.find((item) => String(item.id) === String(button.dataset.toggleService));
        if (!current) return;
        const data = await api(`/api/admin/services/${current.id}`, { method: 'POST', body: JSON.stringify({ active: !!Number(button.dataset.nextActive) }) });
        renderServices(data.services || []);
        if (byId('service-create-status')) byId('service-create-status').textContent = `${current.name} ${Number(button.dataset.nextActive) ? 'activated' : 'deactivated'}.`;
      } catch (error) {
        if (byId('service-create-status')) byId('service-create-status').textContent = error.message;
      }
    });
  });
}

function renderPackages(packages = []) {
  packageCache = packages;
  const shell = byId('packages-shell');
  if (shell) shell.innerHTML = packages.length ? packages.map((item) => `
    <div class="mini-card">
      <strong>${escapeHtml(item.name || '')}</strong>
      <span>${escapeHtml(item.slug || '')} · ${Number(item.active || 0) ? 'active' : 'inactive'}</span>
      <span>${escapeHtml(item.description || '')}</span>
      <span>${escapeHtml(formatMoneyFromCents(item.total_price_cents || 0))} total · ${escapeHtml(formatMoneyFromCents(item.deposit_cents || 0))} deposit</span>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px">
        <button type="button" class="secondary" data-load-package="${item.id}">Load</button>
        <button type="button" class="secondary" data-toggle-package="${item.id}" data-next-active="${Number(item.active || 0) ? 0 : 1}">${Number(item.active || 0) ? 'Deactivate' : 'Activate'}</button>
      </div>
    </div>
  `).join('') : '<div class="empty-state">No packages yet.</div>';
  const select = byId('quote-package-id');
  if (select) {
    const prior = select.value;
    select.innerHTML = '<option value="">No package</option>' + packages.map((item) => `<option value="${item.id}">${escapeHtml(item.name || '')}</option>`).join('');
    if (prior && [...select.options].some((opt) => opt.value === prior)) select.value = prior;
  }
  shell?.querySelectorAll('[data-load-package]').forEach((button) => {
    button.addEventListener('click', () => {
      fillPackageForm(packageCache.find((item) => String(item.id) === String(button.dataset.loadPackage)) || null);
      if (byId('package-create-status')) byId('package-create-status').textContent = 'Package loaded for editing.';
    });
  });
  shell?.querySelectorAll('[data-toggle-package]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const current = packageCache.find((item) => String(item.id) === String(button.dataset.togglePackage));
        if (!current) return;
        const data = await api(`/api/admin/packages/${current.id}`, { method: 'POST', body: JSON.stringify({ active: !!Number(button.dataset.nextActive) }) });
        renderPackages(data.packages || []);
        if (byId('package-create-status')) byId('package-create-status').textContent = `${current.name} ${Number(button.dataset.nextActive) ? 'activated' : 'deactivated'}.`;
      } catch (error) {
        if (byId('package-create-status')) byId('package-create-status').textContent = error.message;
      }
    });
  });
}

async function runQuoteAction(quoteId, action, extras = {}) {
  try {
    const data = await api(`/api/admin/quotes/${quoteId}/action`, { method: 'POST', body: JSON.stringify({ action, ...extras }) });
    quoteCache = quoteCache.map((item) => item.id === Number(quoteId) ? (data.quote || item) : item);
    renderQuotes(quoteCache);
    if (byId('quote-create-status')) byId('quote-create-status').textContent = `Quote action complete: ${action}.`;
    await refreshAdmin();
  } catch (error) {
    if (byId('quote-create-status')) byId('quote-create-status').textContent = error.message;
  }
}

function renderQuotes(quotes = []) {
  quoteCache = quotes;
  const visible = selectedLeadId ? quotes.filter((quote) => Number(quote.lead_id || 0) === Number(selectedLeadId)) : quotes;
  const shell = byId('quotes-shell');
  if (shell) shell.innerHTML = visible.length ? visible.slice(0, 20).map((quote) => `
    <div class="mini-card">
      <strong>${escapeHtml(quote.title || '')}</strong>
      <span>${escapeHtml(quote.quote_code || '')} · ${escapeHtml(quote.status || '')}</span>
      <span>${escapeHtml(formatMoneyFromCents(quote.amount_cents || 0))} total · ${escapeHtml(formatMoneyFromCents(quote.deposit_cents || 0))} deposit</span>
      <div class="footer-note">${escapeHtml(quote.summary || '').slice(0, 180)}${(quote.summary || '').length > 180 ? '…' : ''}</div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px">
        <button type="button" class="secondary" data-load-quote="${quote.id}">Load</button>
        <button type="button" class="secondary" data-quote-action="send" data-quote-id="${quote.id}">Queue notice</button>
        <button type="button" class="secondary" data-quote-action="duplicate" data-quote-id="${quote.id}">Duplicate</button>
        ${['accepted', 'withdrawn', 'expired'].includes(String(quote.status || '')) ? `<button type="button" class="secondary" data-quote-action="reopen" data-quote-id="${quote.id}">Reopen</button>` : `<button type="button" class="secondary" data-quote-action="expire" data-quote-id="${quote.id}">Expire</button><button type="button" class="danger" data-quote-action="withdraw" data-quote-id="${quote.id}">Withdraw</button>`}
      </div>
    </div>
  `).join('') : `<div class="empty-state">${selectedLeadId ? 'No quotes yet for the selected lead.' : 'No quotes yet.'}</div>`;
  shell?.querySelectorAll('[data-load-quote]').forEach((button) => {
    button.addEventListener('click', () => {
      fillQuoteForm(quoteCache.find((item) => String(item.id) === String(button.dataset.loadQuote)) || null);
      if (byId('quote-create-status')) byId('quote-create-status').textContent = 'Quote loaded for editing.';
    });
  });
  shell?.querySelectorAll('[data-quote-action]').forEach((button) => {
    button.addEventListener('click', () => runQuoteAction(Number(button.dataset.quoteId), button.dataset.quoteAction, { notify_lead: button.dataset.quoteAction === 'send' }));
  });
  populatePlanQuoteOptions();
  populateMembershipQuoteOptions();
}

function renderPaymentPlans(plans = []) {
  paymentPlanCache = plans || [];
  const shell = byId('payment-plans-shell');
  if (!shell) return;
  shell.innerHTML = paymentPlanCache.length ? paymentPlanCache.map((plan) => `
    <div class="mini-card">
      <strong>${escapeHtml(plan.title || '')}</strong>
      <span>${escapeHtml(plan.status || '')} · ${escapeHtml(formatMoneyFromCents(plan.total_cents || 0))} total</span>
      <span>${escapeHtml(formatMoneyFromCents(plan.deposit_cents || 0))} deposit · ${escapeHtml(String(plan.installment_count || 0))} installments every ${escapeHtml(String(plan.interval_days || 0))} days</span>
      <span>${escapeHtml(formatMoneyFromCents(plan.outstanding_cents || 0))} still open across ${escapeHtml(String(plan.generated_invoice_count || 0))} invoices</span>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px">
        ${Number(plan.generated_invoice_count || 0) ? '' : `<button type="button" class="secondary" data-plan-generate="${plan.id}">Generate invoices</button>`}
        ${String(plan.status || '') === 'cancelled' ? '' : `<button type="button" class="danger" data-plan-cancel="${plan.id}">Cancel plan</button>`}
      </div>
    </div>
  `).join('') : '<div class="empty-state">No installment plans yet.</div>';
  shell.querySelectorAll('[data-plan-generate]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const data = await api(`/api/admin/payment-plans/${button.dataset.planGenerate}/generate`, { method: 'POST', body: JSON.stringify({ invoice_status: byId('plan-invoice-status')?.value || 'sent' }) });
        renderBilling(data.billing || {});
        if (byId('payment-plan-status-note')) byId('payment-plan-status-note').textContent = `Generated ${data.created_invoices?.length || 0} invoices.`;
        await refreshAdmin();
      } catch (error) {
        if (byId('payment-plan-status-note')) byId('payment-plan-status-note').textContent = error.message;
      }
    });
  });
  shell.querySelectorAll('[data-plan-cancel]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const data = await api(`/api/admin/payment-plans/${button.dataset.planCancel}/cancel`, { method: 'POST', body: JSON.stringify({}) });
        renderBilling(data.billing || {});
        if (byId('payment-plan-status-note')) byId('payment-plan-status-note').textContent = 'Plan cancelled.';
        await refreshAdmin();
      } catch (error) {
        if (byId('payment-plan-status-note')) byId('payment-plan-status-note').textContent = error.message;
      }
    });
  });
}

function renderBilling(billing) {
  const totals = billing?.totals || {};
  if (byId('billing-totals')) {
    byId('billing-totals').innerHTML = `
      <div class="mini-card"><strong>${formatMoneyFromCents(totals.invoiced_cents || 0)}</strong><span>Invoiced</span></div>
      <div class="mini-card"><strong>${formatMoneyFromCents(totals.paid_cents || 0)}</strong><span>Paid</span></div>
      <div class="mini-card"><strong>${formatMoneyFromCents(totals.outstanding_cents || 0)}</strong><span>Outstanding</span></div>
      <div class="mini-card"><strong>${formatMoneyFromCents(totals.committed_cents || 0)}</strong><span>Committed</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(totals.payment_plan_count || 0))}</strong><span>Payment plans</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(totals.active_membership_count || 0))}</strong><span>Active memberships</span></div>
    `;
  }
  const invoices = billing?.invoices || [];
  const tbody = byId('billing-invoices-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    if (!invoices.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state">No invoices yet for this lead.</div></td></tr>';
    } else {
      invoices.forEach((invoice) => {
        const tr = document.createElement('tr');
        const canAct = !['void', 'written_off'].includes(String(invoice.status || '')) && Number(invoice.amount_cents || 0) > 0;
        tr.innerHTML = `
          <td>${escapeHtml(invoice.invoice_code || invoice.id)}</td>
          <td>${escapeHtml(invoice.kind || '')}${Number(invoice.payment_plan_id || 0) ? `<div class="footer-note">Plan ${escapeHtml(String(invoice.payment_plan_id))} · ${escapeHtml(String(invoice.installment_number || 0))}/${escapeHtml(String(invoice.installment_count || 0))}</div>` : ''}</td>
          <td>${escapeHtml(invoice.description || '')}</td>
          <td>${escapeHtml(invoice.status || '')}</td>
          <td>${escapeHtml(formatMoneyFromCents(invoice.amount_cents || 0))}</td>
          <td>${escapeHtml(formatMoneyFromCents(invoice.balance_cents || 0))}</td>
          <td>${escapeHtml(invoice.notes || '')}</td>
          <td>
            <div style="display:flex; gap:6px; flex-wrap:wrap">
              ${canAct ? `<button type="button" class="secondary" data-invoice-action="mark_sent" data-invoice-id="${invoice.id}">Mark sent</button>
              <button type="button" class="secondary" data-invoice-action="mark_paid" data-invoice-id="${invoice.id}">Mark paid</button>
              <button type="button" class="secondary" data-invoice-action="write_off" data-invoice-id="${invoice.id}">Write off</button>
              <button type="button" class="danger" data-invoice-action="void" data-invoice-id="${invoice.id}">Void</button>
              <button type="button" class="secondary" data-invoice-credit="${invoice.id}">Credit</button>` : `<button type="button" class="secondary" data-invoice-action="reopen" data-invoice-id="${invoice.id}">Reopen</button>`}
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
      tbody.querySelectorAll('[data-invoice-action]').forEach((button) => {
        button.addEventListener('click', () => applyInvoiceAction(button.getAttribute('data-invoice-id'), button.getAttribute('data-invoice-action')));
      });
      tbody.querySelectorAll('[data-invoice-credit]').forEach((button) => {
        button.addEventListener('click', () => createCreditMemo(button.getAttribute('data-invoice-credit')));
      });
    }
  }
  const commitmentsTbody = byId('billing-commitments-tbody');
  if (commitmentsTbody) {
    commitmentsTbody.innerHTML = '';
    const commitments = billing?.payment_commitments || [];
    if (!commitments.length) {
      commitmentsTbody.innerHTML = '<tr><td colspan="8"><div class="empty-state">No payment commitments yet.</div></td></tr>';
    } else {
      commitments.forEach((commitment) => {
        const tr = document.createElement('tr');
        const invoiceCode = invoices.find((item) => Number(item.id || 0) === Number(commitment.invoice_id || 0))?.invoice_code || commitment.invoice_id || '';
        tr.innerHTML = `
          <td>${escapeHtml(String(commitment.id || ''))}</td>
          <td>${escapeHtml(String(invoiceCode || '—'))}</td>
          <td>${escapeHtml(formatMoneyFromCents(commitment.requested_amount_cents || 0))}</td>
          <td>${escapeHtml(commitment.method || '')}</td>
          <td>${escapeHtml(commitment.planned_for_ts || '')}</td>
          <td>${escapeHtml(commitment.status || '')}</td>
          <td>${escapeHtml(commitment.requester_name || '')}</td>
          <td><div style="display:flex; gap:6px; flex-wrap:wrap">${String(commitment.status || '') === 'cancelled' ? `<button type="button" class="secondary" data-commitment-action="reopen" data-commitment-id="${commitment.id}">Reopen</button>` : `${['pending', 'confirmed'].includes(String(commitment.status || '')) ? `<button type="button" class="secondary" data-commitment-action="confirm" data-commitment-id="${commitment.id}">Confirm</button>` : ''}${Number(commitment.invoice_id || 0) && ['pending', 'confirmed'].includes(String(commitment.status || '')) ? `<button type="button" class="secondary" data-commitment-action="mark_paid" data-commitment-id="${commitment.id}">Record payment</button>` : ''}${String(commitment.status || '') !== 'paid' ? `<button type="button" class="danger" data-commitment-action="cancel" data-commitment-id="${commitment.id}">Cancel</button>` : ''}`}</div></td>
        `;
        commitmentsTbody.appendChild(tr);
      });
      commitmentsTbody.querySelectorAll('[data-commitment-action]').forEach((button) => {
        button.addEventListener('click', () => applyPaymentCommitmentAction(button.getAttribute('data-commitment-id'), button.getAttribute('data-commitment-action')));
      });
    }
  }
  const paymentsTbody = byId('billing-payments-tbody');
  if (paymentsTbody) {
    paymentsTbody.innerHTML = '';
    const payments = billing?.payments || [];
    if (!payments.length) {
      paymentsTbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">No payments recorded yet.</div></td></tr>';
    } else {
      payments.forEach((payment) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(String(payment.id || ''))}</td>
          <td>${escapeHtml(formatMoneyFromCents(payment.amount_cents || 0))}</td>
          <td>${escapeHtml(payment.method || '')}</td>
          <td>${escapeHtml(payment.reference || '')}</td>
          <td>${escapeHtml(payment.created_at || '')}</td>
        `;
        paymentsTbody.appendChild(tr);
      });
    }
  }
  const select = byId('payment-invoice-select');
  if (select) {
    const prior = select.value;
    select.innerHTML = '';
    const payableInvoices = invoices.filter((invoice) => Number(invoice.balance_cents || 0) > 0 && !['void', 'written_off'].includes(String(invoice.status || '')));
    if (!payableInvoices.length) {
      select.innerHTML = '<option value="">No invoices available</option>';
    } else {
      payableInvoices.forEach((invoice) => {
        const option = document.createElement('option');
        option.value = String(invoice.id);
        option.textContent = `${invoice.invoice_code || invoice.id} · ${formatMoneyFromCents(invoice.balance_cents || 0)} due`;
        select.appendChild(option);
      });
      if (prior && payableInvoices.some((item) => String(item.id) === prior)) select.value = prior;
    }
  }
  renderPaymentPlans(billing?.payment_plans || []);
  renderMemberships(billing?.memberships || []);
  populatePlanQuoteOptions();
  populateMembershipQuoteOptions();
}

async function applyPaymentCommitmentAction(commitmentId, action) {
  if (!commitmentId) return;
  try {
    const data = await api(`/api/admin/payment-commitments/${commitmentId}/action`, { method: 'POST', body: JSON.stringify({ action }) });
    renderBilling(data.billing || {});
    const paymentText = data.payment ? ` Payment ${formatMoneyFromCents(data.payment.amount_cents || 0)} was recorded.` : '';
    if (byId('payment-status-note')) byId('payment-status-note').textContent = `Payment commitment ${action.replace('_', ' ')} applied.${paymentText}`;
  } catch (error) {
    if (byId('payment-status-note')) byId('payment-status-note').textContent = error.message;
  }
}

async function runReadinessAutofix() {
  const orgId = selectedOrgId() || (orgCache[0]?.id || 0);
  if (!orgId) return;
  const statusEl = byId('org-readiness-action-status');
  if (statusEl) statusEl.textContent = 'Running readiness autofix…';
  try {
    const data = await api(`/api/admin/orgs/${orgId}/autofix`, {
      method: 'POST',
      body: JSON.stringify({
        preset_slug: byId('readiness-preset-select')?.value || '',
        seed_reps: !!byId('readiness-seed-reps')?.checked,
      }),
    });
    const result = data.result || {};
    const before = (result.before || {}).percent_complete || 0;
    const after = (result.after || {}).percent_complete || 0;
    const skipped = (result.skipped || []).join(' · ');
    if (statusEl) statusEl.textContent = `Desk moved from ${before}% to ${after}% readiness.${skipped ? ` ${skipped}` : ''}`;
    await refreshAdmin();
  } catch (error) {
    if (statusEl) statusEl.textContent = error.message;
  }
}

async function downloadOnboardingPlan() {
  const orgId = selectedOrgId() || (orgCache[0]?.id || 0);
  if (!orgId) return;
  const statusEl = byId('org-readiness-action-status');
  if (statusEl) statusEl.textContent = 'Preparing onboarding plan download…';
  try {
    const presetSlug = byId('readiness-preset-select')?.value || '';
    const query = presetSlug ? `?preset_slug=${encodeURIComponent(presetSlug)}` : '';
    const response = await fetch(`/api/admin/orgs/${orgId}/onboarding-plan/download${query}`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Onboarding plan download failed.');
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `desk-onboarding-plan-${orgId}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    if (statusEl) statusEl.textContent = 'Onboarding plan download is ready.';
  } catch (error) {
    if (statusEl) statusEl.textContent = error.message;
  }
}


async function downloadOnboardingRunbook() {
  const orgId = selectedOrgId() || (orgCache[0]?.id || 0);
  if (!orgId) return;
  const statusEl = byId('org-readiness-action-status');
  if (statusEl) statusEl.textContent = 'Preparing onboarding runbook download…';
  try {
    const presetSlug = byId('readiness-preset-select')?.value || '';
    const query = presetSlug ? `?preset_slug=${encodeURIComponent(presetSlug)}` : '';
    const response = await fetch(`/api/admin/orgs/${orgId}/onboarding-runbook.md${query}`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Onboarding runbook download failed.');
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `desk-onboarding-runbook-${orgId}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    if (statusEl) statusEl.textContent = 'Onboarding runbook download is ready.';
  } catch (error) {
    if (statusEl) statusEl.textContent = error.message;
  }
}

async function exportArtifactPack() {
  if (!selectedLeadId) {
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = 'Pick a lead first.';
    return;
  }
  if (byId('artifact-status-note')) byId('artifact-status-note').textContent = 'Preparing proof pack export…';
  try {
    const query = artifactShowDeleted ? '?include_deleted=1' : '';
    const response = await fetch(`/api/admin/leads/${selectedLeadId}/artifacts/export${query}`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Proof pack export failed.');
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `lead-proof-pack-${selectedLeadId}.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = 'Proof pack export is ready.';
  } catch (error) {
    if (byId('artifact-status-note')) byId('artifact-status-note').textContent = error.message;
  }
}


async function createService(event) {
  event.preventDefault();
  const serviceId = Number(byId('service-id')?.value || 0);
  try {
    const payload = {
      org_id: selectedOrgId(),
      slug: byId('service-slug').value.trim(),
      name: byId('service-name').value.trim(),
      description: byId('service-description').value.trim(),
      base_price_cents: usdToCents(byId('service-price').value),
      deposit_cents: usdToCents(byId('service-deposit').value),
      duration_minutes: Number(byId('service-duration').value || 45),
      keywords: byId('service-keywords').value.split(',').map((item) => item.trim()).filter(Boolean),
    };
    const data = serviceId
      ? await api(`/api/admin/services/${serviceId}`, { method: 'POST', body: JSON.stringify(payload) })
      : await api('/api/admin/services', { method: 'POST', body: JSON.stringify(payload) });
    byId('service-create-status').textContent = `${serviceId ? 'Updated' : 'Created'} service ${data.service.name}.`;
    renderServices(data.services || []);
    clearServiceForm();
    await refreshAdmin();
  } catch (error) {
    byId('service-create-status').textContent = error.message;
  }
}

async function createPackage(event) {
  event.preventDefault();
  const packageId = Number(byId('package-id')?.value || 0);
  try {
    const payload = {
      org_id: selectedOrgId(),
      slug: byId('package-slug').value.trim(),
      name: byId('package-name').value.trim(),
      description: byId('package-description').value.trim(),
      total_price_cents: usdToCents(byId('package-price').value),
      deposit_cents: usdToCents(byId('package-deposit').value),
      included_service_slugs: byId('package-services').value.split(',').map((item) => item.trim()).filter(Boolean),
    };
    const data = packageId
      ? await api(`/api/admin/packages/${packageId}`, { method: 'POST', body: JSON.stringify(payload) })
      : await api('/api/admin/packages', { method: 'POST', body: JSON.stringify(payload) });
    byId('package-create-status').textContent = `${packageId ? 'Updated' : 'Created'} package ${data.package.name}.`;
    renderPackages(data.packages || []);
    clearPackageForm();
    await refreshAdmin();
  } catch (error) {
    byId('package-create-status').textContent = error.message;
  }
}

async function createQuote(event) {
  event.preventDefault();
  if (!selectedLeadId) {
    byId('quote-create-status').textContent = 'Pick a lead first.';
    return;
  }
  const quoteId = Number(byId('quote-id')?.value || 0);
  try {
    const payload = {
      lead_id: selectedLeadId,
      appointment_id: appointmentCache.find((item) => item.lead_id === selectedLeadId && ['booked','confirmed'].includes(item.status))?.id || null,
      service_id: Number(byId('quote-service-id').value || 0) || null,
      package_id: Number(byId('quote-package-id').value || 0) || null,
      title: byId('quote-title').value.trim(),
      summary: byId('quote-summary').value.trim(),
      amount_cents: usdToCents(byId('quote-amount').value),
      deposit_cents: usdToCents(byId('quote-deposit').value),
      status: byId('quote-status').value,
      expires_at: byId('quote-expires-at').value.trim(),
      terms_text: byId('quote-terms').value.trim(),
    };
    const data = quoteId
      ? await api(`/api/admin/quotes/${quoteId}`, { method: 'POST', body: JSON.stringify(payload) })
      : await api('/api/admin/quotes', { method: 'POST', body: JSON.stringify(payload) });
    byId('quote-create-status').textContent = `${quoteId ? 'Updated' : 'Created'} quote ${data.quote.quote_code || data.quote.id}.`;
    clearQuoteForm();
    await refreshAdmin();
  } catch (error) {
    byId('quote-create-status').textContent = error.message;
  }
}

async function createPaymentPlan(event) {
  event.preventDefault();
  if (!selectedLeadId) {
    if (byId('payment-plan-status-note')) byId('payment-plan-status-note').textContent = 'Pick a lead first.';
    return;
  }
  try {
    const selectedQuote = currentLeadQuotes().find((item) => String(item.id) === String(byId('plan-quote-select')?.value || '')) || null;
    const payload = {
      quote_id: selectedQuote?.id || null,
      appointment_id: appointmentCache.find((item) => item.lead_id === selectedLeadId && ['booked','confirmed'].includes(item.status))?.id || null,
      title: byId('plan-title')?.value.trim() || selectedQuote?.title || 'Installment plan',
      total_cents: usdToCents(byId('plan-total')?.value || 0),
      deposit_cents: usdToCents(byId('plan-deposit')?.value || 0),
      installment_count: Number(byId('plan-count')?.value || 1),
      interval_days: Number(byId('plan-interval')?.value || 30),
      first_due_ts: byId('plan-first-due')?.value.trim() || '',
      invoice_status: byId('plan-invoice-status')?.value || 'sent',
      notes: byId('plan-notes')?.value.trim() || '',
    };
    const data = await api(`/api/admin/leads/${selectedLeadId}/payment-plans`, { method: 'POST', body: JSON.stringify(payload) });
    renderBilling(data.billing || {});
    if (byId('payment-plan-status-note')) byId('payment-plan-status-note').textContent = `Created plan and generated ${data.created_invoices?.length || 0} invoices.`;
    if (byId('plan-title')) byId('plan-title').value = '';
    if (byId('plan-total')) byId('plan-total').value = '';
    if (byId('plan-deposit')) byId('plan-deposit').value = '';
    if (byId('plan-notes')) byId('plan-notes').value = '';
    await refreshAdmin();
  } catch (error) {
    if (byId('payment-plan-status-note')) byId('payment-plan-status-note').textContent = error.message;
  }
}

async function createMembership(event) {
  event.preventDefault();
  if (!selectedLeadId) {
    if (byId('membership-status-note')) byId('membership-status-note').textContent = 'Pick a lead first.';
    return;
  }
  try {
    const selectedQuote = currentLeadQuotes().find((item) => String(item.id) === String(byId('membership-quote-select')?.value || '')) || null;
    const payload = {
      quote_id: selectedQuote?.id || null,
      appointment_id: appointmentCache.find((item) => item.lead_id === selectedLeadId && ['booked','confirmed'].includes(item.status))?.id || null,
      title: byId('membership-title')?.value.trim() || selectedQuote?.title || 'Recurring membership',
      amount_cents: usdToCents(byId('membership-amount')?.value || 0),
      interval_days: Number(byId('membership-interval')?.value || 30),
      next_invoice_ts: byId('membership-next-invoice')?.value.trim() || '',
      start_mode: byId('membership-start-mode')?.value || 'wait',
      invoice_status: byId('membership-invoice-status')?.value || 'sent',
      notes: byId('membership-notes')?.value.trim() || '',
    };
    const data = await api(`/api/admin/leads/${selectedLeadId}/memberships`, { method: 'POST', body: JSON.stringify(payload) });
    renderBilling(data.billing || {});
    if (byId('membership-status-note')) byId('membership-status-note').textContent = data.invoice ? `Created recurring membership and generated invoice ${data.invoice.invoice_code || data.invoice.id}.` : 'Recurring membership created.';
    if (byId('membership-title')) byId('membership-title').value = '';
    if (byId('membership-amount')) byId('membership-amount').value = '';
    if (byId('membership-notes')) byId('membership-notes').value = '';
    await refreshAdmin();
  } catch (error) {
    if (byId('membership-status-note')) byId('membership-status-note').textContent = error.message;
  }
}

async function runMembershipAction(membershipId, action) {
  try {
    const data = await api(`/api/admin/memberships/${membershipId}/action`, { method: 'POST', body: JSON.stringify({ action, invoice_status: byId('membership-invoice-status')?.value || 'sent' }) });
    renderBilling(data.billing || {});
    if (byId('membership-status-note')) byId('membership-status-note').textContent = action === 'generate_now' ? `Membership billed${data.invoice ? ` with invoice ${data.invoice.invoice_code || data.invoice.id}` : ''}.` : `Membership action complete: ${action}.`;
    await refreshAdmin();
  } catch (error) {
    if (byId('membership-status-note')) byId('membership-status-note').textContent = error.message;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (byId('service-clear')) byId('service-clear').addEventListener('click', () => { clearServiceForm(); if (byId('service-create-status')) byId('service-create-status').textContent = 'Service form cleared.'; });
  if (byId('package-clear')) byId('package-clear').addEventListener('click', () => { clearPackageForm(); if (byId('package-create-status')) byId('package-create-status').textContent = 'Package form cleared.'; });
  if (byId('quote-clear')) byId('quote-clear').addEventListener('click', () => { clearQuoteForm(); if (byId('quote-create-status')) byId('quote-create-status').textContent = 'Quote form cleared.'; });
  if (byId('payment-plan-form')) byId('payment-plan-form').addEventListener('submit', createPaymentPlan);
  if (byId('membership-form')) byId('membership-form').addEventListener('submit', createMembership);
  if (byId('membership-run-due')) byId('membership-run-due').addEventListener('click', async () => {
    try {
      const data = await api('/api/admin/memberships/run', { method: 'POST', body: JSON.stringify({}) });
      if (byId('membership-status-note')) byId('membership-status-note').textContent = `Generated ${data.generated?.length || 0} due membership invoices.`;
      await refreshAdmin();
    } catch (error) {
      if (byId('membership-status-note')) byId('membership-status-note').textContent = error.message;
    }
  });
  if (byId('plan-quote-select')) byId('plan-quote-select').addEventListener('change', () => {
    const quote = currentLeadQuotes().find((item) => String(item.id) === String(byId('plan-quote-select').value || ''));
    if (!quote) return;
    if (byId('plan-title') && !byId('plan-title').value.trim()) byId('plan-title').value = `${quote.title || 'Quote'} plan`;
    if (byId('plan-total') && !byId('plan-total').value) byId('plan-total').value = ((Number(quote.amount_cents || 0)) / 100).toFixed(2);
    if (byId('plan-deposit') && !byId('plan-deposit').value) byId('plan-deposit').value = ((Number(quote.deposit_cents || 0)) / 100).toFixed(2);
  });
  if (byId('membership-quote-select')) byId('membership-quote-select').addEventListener('change', () => {
    const quote = currentLeadQuotes().find((item) => String(item.id) === String(byId('membership-quote-select').value || ''));
    if (!quote) return;
    if (byId('membership-title') && !byId('membership-title').value.trim()) byId('membership-title').value = `${quote.title || 'Quote'} membership`;
    if (byId('membership-amount') && !byId('membership-amount').value) byId('membership-amount').value = ((Number(quote.amount_cents || 0)) / 100).toFixed(2);
  });
});
