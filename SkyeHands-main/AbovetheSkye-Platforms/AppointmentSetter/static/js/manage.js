const manageState = {
  code: '',
  record: null,
};

function formatMoneyManage(cents) {
  const currency = manageState.record?.settings?.currency || 'USD';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((Number(cents || 0)) / 100);
}

function formatBytesManage(value) {
  const size = Number(value || 0);
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

async function fileToBase64(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error('File could not be read.'));
    reader.readAsDataURL(file);
  });
}

function renderPaymentCommitments(commitments = [], invoices = []) {
  const shell = document.getElementById('manage-payment-commitments-shell');
  if (!shell) return;
  const invoiceMap = new Map((invoices || []).map((invoice) => [String(invoice.id), invoice]));
  shell.innerHTML = commitments.length ? commitments.map((commitment) => {
    const invoice = invoiceMap.get(String(commitment.invoice_id || '')) || null;
    const status = String(commitment.status || 'pending');
    const canCancel = ['pending', 'confirmed'].includes(status);
    const canReopen = status === 'cancelled';
    return `
      <div class="mini-card">
        <strong>${escapeHtml(commitment.requester_name || 'Payment handoff')}</strong>
        <span>${escapeHtml(formatMoneyManage(commitment.requested_amount_cents || 0))} via ${escapeHtml(commitment.method || 'payment')}</span>
        <span>Status: ${escapeHtml(status)}${commitment.planned_for_ts ? ` · ${escapeHtml(commitment.planned_for_ts)}` : ''}</span>
        ${invoice ? `<span>Invoice: ${escapeHtml(invoice.invoice_code || invoice.id)} · ${escapeHtml(formatMoneyManage(invoice.balance_cents || 0))} open when last loaded</span>` : ''}
        ${commitment.notes ? `<span>${escapeHtml(commitment.notes)}</span>` : ''}
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center">
          ${canCancel ? `<button type="button" class="secondary" data-commitment-action="cancel" data-commitment-id="${escapeHtml(String(commitment.id))}">Cancel this handoff</button>` : ''}
          ${canReopen ? `<button type="button" class="secondary" data-commitment-action="reopen" data-commitment-id="${escapeHtml(String(commitment.id))}">Reopen this handoff</button>` : ''}
        </div>
      </div>
    `;
  }).join('') : '<div class="empty-state">No payment handoffs have been submitted yet.</div>';
  shell.querySelectorAll('[data-commitment-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const commitmentId = Number(button.getAttribute('data-commitment-id') || 0);
      const action = String(button.getAttribute('data-commitment-action') || '');
      await applyPublicPaymentCommitmentAction(commitmentId, action);
    });
  });
}

function renderCommercials(record) {
  const intake = record.intake || {};
  const billing = record.billing || {};
  document.getElementById('manage-intake-budget').value = intake.budget_range || '';
  document.getElementById('manage-intake-window').value = intake.decision_window || '';
  document.getElementById('manage-intake-need').value = intake.business_need || '';
  document.getElementById('manage-intake-notes').value = intake.intake_notes || '';
  document.getElementById('manage-waiver-text').value = intake.waiver_text || '';
  document.getElementById('manage-waiver-accepted').checked = !!Number(intake.waiver_accepted || 0);
  const totals = billing.totals || {};
  const shell = document.getElementById('manage-billing-shell');
  const invoices = billing.invoices || [];
  const memberships = billing.memberships || [];
  const commitments = billing.payment_commitments || [];
  const instructions = record.settings?.payment_instructions || '';
  shell.innerHTML = `
    <div class="mini-grid">
      <div class="mini-card"><strong>${formatMoneyManage(totals.invoiced_cents || 0)}</strong><span>Invoiced</span></div>
      <div class="mini-card"><strong>${formatMoneyManage(totals.paid_cents || 0)}</strong><span>Paid</span></div>
      <div class="mini-card"><strong>${formatMoneyManage(totals.outstanding_cents || 0)}</strong><span>Outstanding</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(totals.active_membership_count || 0))}</strong><span>Active memberships</span></div>
    </div>
    ${instructions ? `<div class="mini-card"><strong>Payment instructions</strong><span>${escapeHtml(instructions)}</span></div>` : ''}
    ${memberships.length ? `<div class="stack">${memberships.map((membership) => `<div class="mini-card"><strong>${escapeHtml(membership.title || '')}</strong><span>${escapeHtml(formatMoneyManage(membership.amount_cents || 0))} every ${escapeHtml(String(membership.interval_days || 0))} days · ${escapeHtml(membership.status || '')}</span><span>Next invoice: ${escapeHtml(membership.next_invoice_ts || 'not scheduled')}</span></div>`).join('')}</div>` : ''}
    <div class="table-shell">
      <table>
        <thead>
          <tr><th>Invoice</th><th>Kind</th><th>Status</th><th>Amount</th><th>Balance</th></tr>
        </thead>
        <tbody>
          ${invoices.length ? invoices.map((invoice) => `
            <tr>
              <td>${escapeHtml(invoice.invoice_code || invoice.id)}</td>
              <td>${escapeHtml(invoice.kind || '')}</td>
              <td>${escapeHtml(invoice.status || '')}</td>
              <td>${escapeHtml(formatMoneyManage(invoice.amount_cents || 0))}</td>
              <td>${escapeHtml(formatMoneyManage(invoice.balance_cents || 0))}</td>
            </tr>
          `).join('') : '<tr><td colspan="5"><div class="empty-state">No billing records yet.</div></td></tr>'}
        </tbody>
      </table>
    </div>
  `;
  renderPaymentCommitments(commitments, invoices);
  const invoiceSelect = document.getElementById('manage-payment-commit-invoice');
  if (invoiceSelect) {
    const prior = invoiceSelect.value;
    const payableInvoices = invoices.filter((invoice) => Number(invoice.balance_cents || 0) > 0 && !['void', 'written_off'].includes(String(invoice.status || '')));
    invoiceSelect.innerHTML = payableInvoices.length ? payableInvoices.map((invoice) => `<option value="${escapeHtml(String(invoice.id))}">${escapeHtml(invoice.invoice_code || invoice.id)} · ${escapeHtml(formatMoneyManage(invoice.balance_cents || 0))} due</option>`).join('') : '<option value="">No invoice available</option>';
    if (prior && payableInvoices.some((item) => String(item.id) === prior)) invoiceSelect.value = prior;
    const activeInvoice = payableInvoices.find((item) => String(item.id) === String(invoiceSelect.value || '')) || payableInvoices[0];
    if (activeInvoice && !document.getElementById('manage-payment-commit-amount').value) {
      document.getElementById('manage-payment-commit-amount').value = ((Number(activeInvoice.balance_cents || 0)) / 100).toFixed(2);
    }
    invoiceSelect.onchange = () => {
      const next = payableInvoices.find((item) => String(item.id) === String(invoiceSelect.value || ''));
      if (next) document.getElementById('manage-payment-commit-amount').value = ((Number(next.balance_cents || 0)) / 100).toFixed(2);
    };
  }
}

async function applyPublicPaymentCommitmentAction(commitmentId, action) {
  if (!commitmentId || !action) return;
  const statusEl = document.getElementById('manage-payment-commit-status');
  const note = window.prompt(action === 'cancel' ? 'Add a note for the desk before cancelling this payment handoff (optional).' : 'Add a note for the desk before reopening this payment handoff (optional).', '') || '';
  statusEl.textContent = action === 'cancel' ? 'Cancelling payment handoff…' : 'Reopening payment handoff…';
  try {
    const record = await api('/api/public/payments/commitment-action', {
      method: 'POST',
      body: JSON.stringify({
        code: currentCode(),
        commitment_id: commitmentId,
        action,
        note,
      }),
    }, { redirectOn401: false });
    renderManage(record);
    statusEl.textContent = action === 'cancel' ? 'Payment handoff cancelled.' : 'Payment handoff reopened.';
  } catch (error) {
    statusEl.textContent = error.message;
  }
}

async function savePaymentCommitment(event) {
  event.preventDefault();
  const statusEl = document.getElementById('manage-payment-commit-status');
  statusEl.textContent = 'Sending payment handoff…';
  try {
    const record = await api('/api/public/payments/commit', {
      method: 'POST',
      body: JSON.stringify({
        code: currentCode(),
        invoice_id: Number(document.getElementById('manage-payment-commit-invoice').value || 0) || null,
        amount_cents: Math.round(Number(document.getElementById('manage-payment-commit-amount').value || 0) * 100),
        method: document.getElementById('manage-payment-commit-method').value || 'ach',
        planned_for_ts: document.getElementById('manage-payment-commit-when').value.trim(),
        requester_name: document.getElementById('manage-payment-commit-name').value.trim(),
        notes: document.getElementById('manage-payment-commit-notes').value.trim(),
      }),
    }, { redirectOn401: false });
    renderManage(record);
    statusEl.textContent = 'Payment handoff sent to the desk.';
    document.getElementById('manage-payment-commit-notes').value = '';
  } catch (error) {
    statusEl.textContent = error.message;
  }
}

function renderMemory(record) {
  const memory = record.memory || {};
  const shell = document.getElementById('manage-memory-shell');
  const preferences = memory.preferences || [];
  const objections = memory.objections || [];
  shell.innerHTML = `
    <div class="mini-card"><strong>${escapeHtml(memory.summary || 'No stored memory yet.')}</strong><span>Desk memory</span></div>
    <div class="mini-grid">
      <div class="mini-card"><strong>${escapeHtml(String(memory.booked_count || 0))}</strong><span>Booked</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(memory.completed_count || 0))}</strong><span>Completed</span></div>
      <div class="mini-card"><strong>${escapeHtml(String(memory.no_show_count || 0))}</strong><span>No-show</span></div>
      <div class="mini-card"><strong>${escapeHtml(formatMoneyManage(memory.outstanding_cents || 0))}</strong><span>Outstanding</span></div>
    </div>
    ${preferences.length ? `<div class="mini-card"><strong>Preferences</strong><span>${escapeHtml(preferences.join(' · '))}</span></div>` : ''}
    ${objections.length ? `<div class="mini-card"><strong>Recent objections</strong><span>${escapeHtml(objections.join(' · '))}</span></div>` : ''}
  `;
}

function quoteNotesValue(quoteCode) {
  const textarea = document.querySelector(`[data-quote-notes="${quoteCode}"]`);
  return textarea ? textarea.value.trim() : '';
}

function renderQuotes(record) {
  const quotes = record.quotes || [];
  const shell = document.getElementById('manage-quotes-shell');
  shell.innerHTML = quotes.length ? quotes.map((quote) => `
    <div class="mini-card">
      <strong>${escapeHtml(quote.title || 'Quote')}</strong>
      <span>${escapeHtml(quote.summary || '')}</span>
      <span>Status: ${escapeHtml(quote.status || '')}</span>
      <span>Total: ${escapeHtml(formatMoneyManage(quote.amount_cents || 0))}</span>
      <span>Deposit: ${escapeHtml(formatMoneyManage(quote.deposit_cents || 0))}</span>
      ${quote.terms_text ? `<div class="footer-note">${escapeHtml(quote.terms_text)}</div>` : ''}
      ${['draft','sent','needs_revision'].includes(String(quote.status || '')) ? `
        <label>Response notes
          <textarea data-quote-notes="${quote.quote_code}" placeholder="Questions, requested changes, or acceptance notes.">${escapeHtml(quote.acceptance_notes || '')}</textarea>
        </label>
        <div style="display:flex; gap:10px; flex-wrap:wrap">
          <button type="button" data-accept-quote="${quote.quote_code}">Accept this quote</button>
          <button type="button" class="secondary" data-request-quote="${quote.quote_code}">Request changes</button>
          <button type="button" class="danger" data-decline-quote="${quote.quote_code}">Decline</button>
        </div>` : `<div class="status-pill success">${escapeHtml(String(quote.status || '').toUpperCase())}</div>`}
      ${String(quote.status || '') === 'accepted' ? `<div class="footer-note">Accepted by ${escapeHtml(quote.accepted_name || 'Client')}${quote.accepted_title ? ` · ${escapeHtml(quote.accepted_title)}` : ''}${quote.accepted_company ? ` · ${escapeHtml(quote.accepted_company)}` : ''}</div><a class="button-link secondary" href="/api/public/quotes/${encodeURIComponent(quote.quote_code || '')}/receipt?code=${encodeURIComponent(currentCode())}">Download acceptance receipt</a>` : ''}
    </div>
  `).join('') : '<div class="empty-state">No quotes are attached yet.</div>';
  shell.querySelectorAll('[data-accept-quote]').forEach((button) => {
    button.addEventListener('click', () => respondToQuote(button.getAttribute('data-accept-quote'), 'accept'));
  });
  shell.querySelectorAll('[data-request-quote]').forEach((button) => {
    button.addEventListener('click', () => respondToQuote(button.getAttribute('data-request-quote'), 'request_changes'));
  });
  shell.querySelectorAll('[data-decline-quote]').forEach((button) => {
    button.addEventListener('click', () => respondToQuote(button.getAttribute('data-decline-quote'), 'decline'));
  });
}

function renderArtifacts(record) {
  const artifacts = record.artifacts || [];
  const shell = document.getElementById('manage-artifacts-list');
  if (!shell) return;
  shell.innerHTML = artifacts.length ? artifacts.map((artifact) => `
    <div class="mini-card">
      <strong>${escapeHtml(artifact.filename || 'File')}</strong>
      <span>${escapeHtml(artifact.category || 'artifact')} · ${escapeHtml(formatBytesManage(artifact.size_bytes || 0))}</span>
      ${artifact.notes ? `<span>${escapeHtml(artifact.notes)}</span>` : ''}
      <a class="button-link" href="/api/public/artifacts/${artifact.id}/download?code=${encodeURIComponent(currentCode())}">Download</a>
    </div>
  `).join('') : '<div class="empty-state">No proof files are attached yet.</div>';
}

function renderDocuments(record) {
  const documents = record.documents || [];
  const shell = document.getElementById('manage-documents-list');
  const form = document.getElementById('manage-document-sign-form');
  shell.innerHTML = documents.length ? documents.map((doc) => `
    <div class="mini-card">
      <strong>${escapeHtml(doc.title || '')}</strong>
      <span>${escapeHtml(doc.body || '')}</span>
      <span>Status: ${escapeHtml(doc.status || '')}${doc.signed_name ? ` · Signed by ${escapeHtml(doc.signed_name)}` : ''}</span>
      ${doc.status !== 'signed' ? `<button type="button" data-sign-document="${doc.id}">Prepare signature</button>` : ''}
    </div>
  `).join('') : '<div class="empty-state">No documents are attached yet.</div>';
  shell.querySelectorAll('[data-sign-document]').forEach((button) => {
    button.addEventListener('click', () => {
      document.getElementById('manage-document-id').value = button.getAttribute('data-sign-document') || '';
      document.getElementById('manage-document-status').textContent = 'Signature target selected.';
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}

async function respondToQuote(quoteCode, action) {
  manageStatus(action === 'accept' ? 'Accepting quote…' : 'Sending quote response…');
  const endpoint = action === 'accept' ? '/api/public/quotes/accept' : '/api/public/quotes/respond';
  try {
    const record = await api(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        code: currentCode(),
        quote_code: quoteCode,
        accepted_name: document.getElementById('manage-quote-signer-name')?.value.trim() || document.getElementById('manage-document-signed-name').value.trim(),
        accepted_title: document.getElementById('manage-quote-signer-title')?.value.trim() || '',
        accepted_company: document.getElementById('manage-quote-signer-company')?.value.trim() || '',
        acceptance_signature: document.getElementById('manage-quote-signature')?.value.trim() || document.getElementById('manage-quote-signer-name')?.value.trim() || document.getElementById('manage-document-signed-name').value.trim(),
        acceptance_notes: quoteNotesValue(quoteCode),
        action,
      }),
    }, { redirectOn401: false });
    renderManage(record);
    if (action === 'accept' && record.invoice) {
      const invoiceSelect = document.getElementById('manage-payment-commit-invoice');
      if (invoiceSelect && [...invoiceSelect.options].some((option) => option.value === String(record.invoice.id))) {
        invoiceSelect.value = String(record.invoice.id);
        invoiceSelect.dispatchEvent(new Event('change'));
      }
      if (document.getElementById('manage-payment-commit-name') && !document.getElementById('manage-payment-commit-name').value.trim()) {
        document.getElementById('manage-payment-commit-name').value = document.getElementById('manage-document-signed-name').value.trim() || (manageState.record?.lead?.name || '');
      }
      const commercialShell = document.getElementById('manage-commercial-shell');
      if (commercialShell) commercialShell.scrollIntoView({ behavior: 'smooth', block: 'start' });
      manageStatus('Quote accepted. The deposit invoice is now staged in the payment handoff lane below.');
      const paymentStatus = document.getElementById('manage-payment-commit-status');
      if (paymentStatus) paymentStatus.textContent = 'Deposit invoice is ready. Send the payment plan to the desk when you know method and timing.';
    } else {
      manageStatus(action === 'accept' ? 'Quote accepted.' : (action === 'request_changes' ? 'Change request sent.' : 'Quote declined.'));
    }
  } catch (error) {
    manageStatus(error.message, true);
  }
}

async function uploadArtifact(event) {
  event.preventDefault();
  const fileInput = document.getElementById('manage-artifact-file');
  const file = fileInput?.files?.[0];
  if (!file) {
    document.getElementById('manage-artifact-status').textContent = 'Pick a file first.';
    return;
  }
  document.getElementById('manage-artifact-status').textContent = 'Uploading proof file…';
  try {
    const content_b64 = await fileToBase64(file);
    const record = await api('/api/public/artifacts/upload', {
      method: 'POST',
      body: JSON.stringify({
        code: currentCode(),
        filename: file.name,
        mime_type: file.type || 'application/octet-stream',
        content_b64,
        category: document.getElementById('manage-artifact-category').value.trim() || 'client_upload',
        notes: document.getElementById('manage-artifact-notes').value.trim(),
      }),
    }, { redirectOn401: false });
    renderManage(record);
    document.getElementById('manage-artifact-status').textContent = 'Proof file uploaded.';
    fileInput.value = '';
    document.getElementById('manage-artifact-notes').value = '';
  } catch (error) {
    document.getElementById('manage-artifact-status').textContent = error.message;
  }
}

async function signDocument(event) {
  event.preventDefault();
  const documentId = Number(document.getElementById('manage-document-id').value || 0);
  if (!documentId) {
    document.getElementById('manage-document-status').textContent = 'Pick a document first.';
    return;
  }
  try {
    const record = await api('/api/public/documents/sign', {
      method: 'POST',
      body: JSON.stringify({ code: currentCode(), document_id: documentId, signed_name: document.getElementById('manage-document-signed-name').value.trim() }),
    }, { redirectOn401: false });
    renderManage(record);
    document.getElementById('manage-document-status').textContent = 'Document signed.';
  } catch (error) {
    document.getElementById('manage-document-status').textContent = error.message;
  }
}

async function saveManageIntake(event) {
  event.preventDefault();
  if (!currentCode()) return;
  manageStatus('Saving intake packet…');
  try {
    const record = await api('/api/public/appointment/intake', {
      method: 'POST',
      body: JSON.stringify({
        code: currentCode(),
        budget_range: document.getElementById('manage-intake-budget').value.trim(),
        decision_window: document.getElementById('manage-intake-window').value.trim(),
        business_need: document.getElementById('manage-intake-need').value.trim(),
        intake_notes: document.getElementById('manage-intake-notes').value.trim(),
        waiver_accepted: document.getElementById('manage-waiver-accepted').checked,
        status: 'submitted',
      }),
    }, { redirectOn401: false });
    renderManage(record);
    document.getElementById('manage-intake-status').textContent = 'Intake packet saved.';
    manageStatus('Intake packet saved.');
  } catch (error) {
    document.getElementById('manage-intake-status').textContent = error.message;
    manageStatus(error.message, true);
  }
}

function manageStatus(text, bad = false) {
  const el = document.getElementById('manage-status');
  el.textContent = text;
  el.className = `footer-note ${bad ? 'warn' : ''}`.trim();
}

function currentCode() {
  return manageState.code || new URLSearchParams(window.location.search).get('code') || '';
}

function renderManage(record) {
  manageState.record = record;
  document.getElementById('manage-shell').classList.remove('hidden');
  document.getElementById('manage-commercial-shell').classList.remove('hidden');
  document.getElementById('manage-sales-shell').classList.remove('hidden');
  document.getElementById('manage-documents-shell').classList.remove('hidden');
  document.getElementById('manage-artifacts-shell').classList.remove('hidden');
  const appointment = record.appointment || {};
  const lead = record.lead || {};
  const notice = (window.publicConfig?.settings || {}).booking_notice || '';
  document.getElementById('manage-summary').innerHTML = `
    <div class="mini-card"><strong>${escapeHtml(lead.name || 'Lead')}</strong><span>${escapeHtml(lead.service_interest || 'Appointment')}</span></div>
    <div class="mini-card"><strong>${escapeHtml(formatDateTime(appointment.start_ts))}</strong><span>${escapeHtml(appointment.status || '')} · Confirmation ${escapeHtml(appointment.confirmation_code || '')}</span></div>
    <div class="mini-card"><strong>${escapeHtml(lead.email || lead.phone || 'No contact')}</strong><span>Contact on file</span></div>
    ${notice ? `<div class="mini-card"><strong>Booking note</strong><span>${escapeHtml(notice)}</span></div>` : ''}
  `;
  const ics = document.getElementById('manage-ics-link');
  ics.href = record.ics_url || '#';
  renderManageSlots(record.suggested_slots || []);
  renderCommercials(record);
  renderMemory(record);
  renderQuotes(record);
  renderArtifacts(record);
  renderDocuments(record);
}

function renderManageSlots(slots) {
  const shell = document.getElementById('manage-slot-list');
  shell.innerHTML = '';
  if (!slots.length) {
    shell.innerHTML = '<div class="empty-state">No alternate openings are available right now.</div>';
    return;
  }
  slots.forEach((slot) => {
    const item = document.createElement('div');
    item.className = 'slot-item';
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(slot.display)}</strong>
        <small>${escapeHtml(slot.timezone || '')}</small>
      </div>
      <button type="button">Move to this slot</button>
    `;
    item.querySelector('button').addEventListener('click', () => reschedulePublic(slot.start, slot.timezone));
    shell.appendChild(item);
  });
}

async function lookupAppointment(code) {
  manageState.code = (code || '').trim();
  if (!manageState.code) {
    manageStatus('Enter a confirmation code.', true);
    return;
  }
  manageStatus('Loading appointment…');
  try {
    const record = await api(`/api/public/appointment?code=${encodeURIComponent(manageState.code)}`, {}, { redirectOn401: false });
    renderManage(record);
    manageStatus('Appointment loaded.');
    const params = new URLSearchParams(window.location.search);
    params.set('code', manageState.code);
    history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  } catch (error) {
    document.getElementById('manage-shell').classList.add('hidden');
    document.getElementById('manage-commercial-shell').classList.add('hidden');
    document.getElementById('manage-sales-shell').classList.add('hidden');
    document.getElementById('manage-documents-shell').classList.add('hidden');
    document.getElementById('manage-artifacts-shell').classList.add('hidden');
    manageStatus(error.message, true);
  }
}

async function reschedulePublic(start, timezone) {
  manageStatus('Rescheduling…');
  try {
    const record = await api('/api/public/appointment/reschedule', {
      method: 'POST',
      body: JSON.stringify({ code: currentCode(), start, timezone }),
    }, { redirectOn401: false });
    renderManage(record);
    manageStatus('Appointment moved.');
  } catch (error) {
    manageStatus(error.message, true);
  }
}

async function cancelPublic() {
  if (!currentCode()) return;
  manageStatus('Cancelling…');
  try {
    const record = await api('/api/public/appointment/cancel', {
      method: 'POST',
      body: JSON.stringify({ code: currentCode() }),
    }, { redirectOn401: false });
    renderManage(record);
    manageStatus('Appointment cancelled.');
  } catch (error) {
    manageStatus(error.message, true);
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadPublicConfig();
  document.getElementById('manage-lookup-form').addEventListener('submit', (event) => {
    event.preventDefault();
    lookupAppointment(document.getElementById('manage-code').value);
  });
  document.getElementById('manage-intake-form').addEventListener('submit', saveManageIntake);
  document.getElementById('manage-document-sign-form').addEventListener('submit', signDocument);
  document.getElementById('manage-artifact-form').addEventListener('submit', uploadArtifact);
  document.getElementById('manage-payment-commit-form').addEventListener('submit', savePaymentCommitment);
  document.getElementById('manage-cancel').addEventListener('click', cancelPublic);
  const code = currentCode();
  if (code) {
    document.getElementById('manage-code').value = code;
    lookupAppointment(code);
  }
});
