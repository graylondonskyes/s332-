const { verifyAuth, parseJson, json } = require('./_utils');
const { query } = require('./_db');
const { loadGoogleMailbox, getAuthorizedGmail, gmailRequest } = require('./_gmail');

function toEpochMs(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? String(ms) : null;
}

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') return json(405, { error: 'Method not allowed.' });
    const auth = verifyAuth(event);
    const body = parseJson(event);
    const displayName = String(body.display_name || '').trim();
    const profileTitle = String(body.profile_title || '').trim();
    const profilePhone = String(body.profile_phone || '').trim();
    const profileCompany = String(body.profile_company || '').trim();
    const profileWebsite = String(body.profile_website || '').trim();
    const signatureText = String(body.signature_text || '').trim();
    const signatureHtml = String(body.signature_html || '').trim();
    const preferredFromAlias = String(body.preferred_from_alias || '').trim().toLowerCase();
    const syncGmail = Boolean(body.sync_gmail);
    const saveVacation = Boolean(body.sync_vacation);

    await query(
      `insert into user_preferences (user_id, display_name, profile_title, profile_phone, profile_company, profile_website, signature_text, signature_html, preferred_from_alias, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
       on conflict (user_id)
       do update set display_name=excluded.display_name,
                     profile_title=excluded.profile_title,
                     profile_phone=excluded.profile_phone,
                     profile_company=excluded.profile_company,
                     profile_website=excluded.profile_website,
                     signature_text=excluded.signature_text,
                     signature_html=excluded.signature_html,
                     preferred_from_alias=excluded.preferred_from_alias,
                     updated_at=now()`,
      [auth.sub, displayName || null, profileTitle || null, profilePhone || null, profileCompany || null, profileWebsite || null, signatureText || null, signatureHtml || null, preferredFromAlias || null]
    );

    let gmailUpdated = false;
    let gmailVacationUpdated = false;
    let gmailError = null;
    const mailbox = await loadGoogleMailbox(auth.sub);
    if (mailbox && displayName) {
      await query('update google_mailboxes set from_name=$2, updated_at=now() where user_id=$1', [auth.sub, displayName]);
    }
    if ((syncGmail || saveVacation) && mailbox) {
      try {
        const { accessToken } = await getAuthorizedGmail(auth.sub);
        const sendAsEmail = preferredFromAlias || mailbox.google_email;
        if (syncGmail) {
          const payload = {
            displayName: displayName || mailbox.from_name || mailbox.google_email.split('@')[0],
            signature: signatureHtml || (signatureText ? signatureText.replace(/\n/g, '<br/>') : ''),
          };
          await gmailRequest(accessToken, `/settings/sendAs/${encodeURIComponent(sendAsEmail)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          gmailUpdated = true;
        }
        if (saveVacation) {
          const vacationPayload = {
            enableAutoReply: Boolean(body.vacation_enabled),
            responseSubject: String(body.vacation_subject || '').trim(),
            responseBodyPlainText: String(body.vacation_response_text || '').trim(),
            responseBodyHtml: String(body.vacation_response_html || '').trim(),
            restrictToContacts: Boolean(body.vacation_restrict_contacts),
            restrictToDomain: Boolean(body.vacation_restrict_domain),
          };
          const startTime = toEpochMs(body.vacation_start);
          const endTime = toEpochMs(body.vacation_end);
          if (startTime) vacationPayload.startTime = startTime;
          if (endTime) vacationPayload.endTime = endTime;
          await gmailRequest(accessToken, `/settings/vacation`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(vacationPayload),
          });
          gmailVacationUpdated = true;
        }
      } catch (err) {
        gmailError = err.message || 'Gmail settings sync failed.';
      }
    }

    return json(200, { ok:true, gmail_updated: gmailUpdated, gmail_vacation_updated: gmailVacationUpdated, gmail_error: gmailError });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
