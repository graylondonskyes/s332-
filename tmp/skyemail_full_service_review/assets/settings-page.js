(async function(){
  const boot = await SMV.withBoot('settings', 'Settings', 'Profile, aliases, signatures, and vacation responder');
  if(!boot) return;
  const statusEl = qs('#statusText');
  let settings = null;
  function note(msg, kind=''){ setStatus(statusEl, msg, kind); }
  function toDateTimeLocal(value){
    if(!value) return '';
    const d = new Date(Number(value));
    if(!Number.isFinite(d.getTime())) return '';
    const pad = (n)=> String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function renderAliases(list){
    const el = qs('#aliasList');
    if(!el) return;
    if(!list.length){ el.innerHTML = '<div class="empty">No send-as aliases returned by Gmail yet.</div>'; return; }
    el.innerHTML = list.map((item)=>`
      <div class="alias-card">
        <div><b>${safe(item.displayName || item.sendAsEmail)}</b></div>
        <div class="mini">${safe(item.sendAsEmail)} • ${safe(item.verificationStatus || 'accepted')}</div>
        <div class="contact-meta" style="margin-top:8px">
          ${item.isPrimary ? '<span class="chip">Primary</span>' : ''}
          ${item.isDefault ? '<span class="chip">Default</span>' : ''}
          ${item.treatAsAlias ? '<span class="chip">Alias</span>' : ''}
        </div>
      </div>`).join('');
  }
  async function load(){
    try{
      settings = await apiFetch('/mail-settings-get');
      qs('#display_name').value = settings.profile?.display_name || settings.gmail?.sendAs?.displayName || '';
      qs('#profile_title').value = settings.profile?.profile_title || '';
      qs('#profile_company').value = settings.profile?.profile_company || 'Skyes Over London LC';
      qs('#profile_phone').value = settings.profile?.profile_phone || '(480) 469-5416';
      qs('#profile_website').value = settings.profile?.profile_website || 'https://SOLEnterprises.org';
      qs('#signature_text').value = settings.profile?.signature_text || '';
      qs('#signature_html').value = settings.profile?.signature_html || settings.gmail?.sendAs?.signature || '';
      qs('#preferred_from_alias').innerHTML = (settings.gmail?.aliases || []).map((item)=>`<option value="${safe(item.sendAsEmail)}">${safe(item.displayName || item.sendAsEmail)} • ${safe(item.sendAsEmail)}</option>`).join('') || '<option value="">Primary mailbox</option>';
      if(settings.profile?.preferred_from_alias) qs('#preferred_from_alias').value = settings.profile.preferred_from_alias;
      qs('#gmailStatus').textContent = settings.gmail?.connected ? `Connected mailbox • ${settings.gmail.google_email}` : 'No Google mailbox connected';
      qs('#scopeStatus').textContent = settings.gmail?.signature_scope_ready ? 'Mailbox settings scope is ready.' : (settings.gmail?.scope_note || 'Reconnect Google to grant mailbox settings access.');
      qs('#contactsScope').textContent = settings.gmail?.connected ? `Contacts sync ${settings.gmail.contacts_last_sync_at ? `ready • last sync ${fmtDate(settings.gmail.contacts_last_sync_at)}` : 'ready • never synced yet'}` : 'Connect Google before syncing contacts.';
      renderAliases(settings.gmail?.aliases || []);
      const vacation = settings.gmail?.vacation || {};
      qs('#vacation_enabled').checked = !!vacation.enableAutoReply;
      qs('#vacation_subject').value = vacation.responseSubject || '';
      qs('#vacation_response_text').value = vacation.responseBodyPlainText || '';
      qs('#vacation_response_html').value = vacation.responseBodyHtml || '';
      qs('#vacation_restrict_contacts').checked = !!vacation.restrictToContacts;
      qs('#vacation_restrict_domain').checked = !!vacation.restrictToDomain;
      qs('#vacation_start').value = toDateTimeLocal(vacation.startTime);
      qs('#vacation_end').value = toDateTimeLocal(vacation.endTime);
      note('Settings loaded.', 'ok');
    }catch(err){ note(err.message || 'Settings load failed.', 'danger'); }
  }
  async function save(syncGmail){
    try{
      const payload = {
        display_name: qs('#display_name').value.trim(),
        profile_title: qs('#profile_title').value.trim(),
        profile_company: qs('#profile_company').value.trim(),
        profile_phone: qs('#profile_phone').value.trim(),
        profile_website: qs('#profile_website').value.trim(),
        signature_text: qs('#signature_text').value,
        signature_html: qs('#signature_html').value,
        preferred_from_alias: qs('#preferred_from_alias').value.trim(),
        sync_gmail: !!syncGmail,
        sync_vacation: !!syncGmail,
        vacation_enabled: qs('#vacation_enabled').checked,
        vacation_subject: qs('#vacation_subject').value,
        vacation_response_text: qs('#vacation_response_text').value,
        vacation_response_html: qs('#vacation_response_html').value,
        vacation_restrict_contacts: qs('#vacation_restrict_contacts').checked,
        vacation_restrict_domain: qs('#vacation_restrict_domain').checked,
        vacation_start: qs('#vacation_start').value,
        vacation_end: qs('#vacation_end').value,
      };
      const data = await apiFetch('/mail-settings-save', { method:'POST', body: JSON.stringify(payload) });
      if(data.gmail_error){ note(`Settings saved, but Google sync failed: ${data.gmail_error}`, 'danger'); }
      else note(syncGmail ? 'Settings, signature, and vacation responder synced.' : 'Settings saved.', 'ok');
      await load();
    }catch(err){ note(err.message || 'Settings save failed.', 'danger'); }
  }
  qs('#saveBtn').onclick = ()=> save(false);
  qs('#syncBtn').onclick = ()=> save(true);
  qs('#connectBtn').onclick = ()=> SMV.connectGoogle('/settings.html');
  qs('#disconnectBtn').onclick = async ()=> { if(!confirm('Disconnect the Google mailbox from this account?')) return; try{ await SMV.disconnectGoogle(); await load(); note('Mailbox disconnected.', 'ok'); }catch(err){ note(err.message || 'Disconnect failed.', 'danger'); } };
  qs('#watchBtn').onclick = async ()=> { try{ const data = await SMV.enableWatch(); note(`Push watch active until ${fmtDate(data.watch?.expiration || '')}.`, 'ok'); }catch(err){ note(err.message || 'Push watch failed.', 'danger'); } };
  await load();
})();
