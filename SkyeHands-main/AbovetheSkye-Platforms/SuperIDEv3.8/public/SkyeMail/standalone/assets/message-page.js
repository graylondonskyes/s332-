(async function(){
  const boot = await SMV.withBoot('dashboard', 'Message', 'Single-message review surface');
  if(!boot) return;
  const runtime = window.SMVRuntime || { href: (value) => value, apiUrl: (value) => value };
  const statusEl = qs('#statusText');
  const contentEl = qs('#messageContent');
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || '';
  function note(msg, kind=''){ setStatus(statusEl, msg, kind); }
  if(!id){ contentEl.innerHTML = '<div class="empty">Message id missing.</div>'; return; }
  try{
    const data = await apiFetch(`/gmail-get?id=${encodeURIComponent(id)}`);
    const m = data.message;
    qs('#pageTitle').textContent = m.headers.subject || '(no subject)';
    qs('#metaFrom').textContent = m.headers.from || '';
    qs('#metaTo').textContent = m.headers.to || '';
    qs('#metaDate').textContent = fmtDate(m.internal_date || m.headers.date || '');
    qs('#replyBtn').href = runtime.href('compose.html', {
      to: SMV.emailOnly(m.headers.from || ''),
      subject: /^Re:/i.test(m.headers.subject||'') ? m.headers.subject : `Re: ${m.headers.subject || ''}`,
      reply_message_id: m.id,
      reply_thread_id: m.thread_id || '',
    });
    qs('#threadBtn').href = runtime.href('thread.html', { id: m.thread_id || m.id });
    contentEl.innerHTML = `
      <div class="chiprow">
        ${m.labels.map((label)=>`<span class="chip">${safe(label)}</span>`).join('')}
      </div>
      <div class="message-body">${SMV.htmlMessage(m.body)}</div>
      ${m.attachments?.length ? `<div class="attachments">${m.attachments.map((a)=>`<a class="attachment" href="${runtime.apiUrl(`/gmail-attachment?id=${encodeURIComponent(m.id)}&attachmentId=${encodeURIComponent(a.attachment_id)}&filename=${encodeURIComponent(a.filename)}`)}">${safe(a.filename)} • ${safe(a.mime_type)}</a>`).join('')}</div>` : ''}`;
    if(m.labels.includes('UNREAD')){ await apiFetch('/gmail-modify', { method:'POST', body: JSON.stringify({ id: m.id, addLabelIds: [], removeLabelIds:['UNREAD'] }) }); }
    note('Message loaded.', 'ok');
  }catch(err){ contentEl.innerHTML = '<div class="empty">Message load failed.</div>'; note(err.message || 'Message load failed.', 'danger'); }
})();
