const { verifyAuth, json } = require('./_utils');
const { query } = require('./_db');
const { loadGoogleMailbox, getAuthorizedGmail, gmailRequest } = require('./_gmail');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') return json(405, { error: 'Method not allowed.' });
    const auth = verifyAuth(event);
    const prefRes = await query(`select display_name, profile_title, profile_phone, profile_company, profile_website, signature_text, signature_html, preferred_from_alias, updated_at from user_preferences where user_id=$1 limit 1`, [auth.sub]);
    const prefs = prefRes.rows[0] || null;
    const mailbox = await loadGoogleMailbox(auth.sub);
    let gmail = { connected:false, signature_scope_ready:false, sendAs:null, aliases: [], vacation: null, scope_note:null };
    if (mailbox) {
      gmail.connected = true;
      gmail.google_email = mailbox.google_email;
      gmail.scope = mailbox.scope || '';
      gmail.contacts_last_sync_at = mailbox.contacts_last_sync_at || null;
      gmail.contacts_last_sync_count = Number(mailbox.contacts_last_sync_count || 0);
      gmail.contacts_sync_error = mailbox.contacts_sync_error || null;
      try {
        const { accessToken } = await getAuthorizedGmail(auth.sub);
        const [sendAsRes, vacationRes] = await Promise.all([
          gmailRequest(accessToken, '/settings/sendAs'),
          gmailRequest(accessToken, '/settings/vacation').catch(() => null),
        ]);
        const aliases = Array.isArray(sendAsRes.sendAs) ? sendAsRes.sendAs.map((item)=>({
          sendAsEmail: item.sendAsEmail,
          displayName: item.displayName || '',
          replyToAddress: item.replyToAddress || '',
          signature: item.signature || '',
          isPrimary: !!item.isPrimary,
          isDefault: !!item.isDefault,
          treatAsAlias: !!item.treatAsAlias,
          verificationStatus: item.verificationStatus || null,
          smtpMsa: item.smtpMsa || null,
        })) : [];
        const primary = aliases.find((item)=> String(item.sendAsEmail || '').toLowerCase() === String(mailbox.google_email || '').toLowerCase()) || aliases.find((item)=> item.isDefault) || aliases[0] || null;
        gmail.signature_scope_ready = true;
        gmail.aliases = aliases;
        gmail.sendAs = primary;
        gmail.vacation = vacationRes ? {
          enableAutoReply: !!vacationRes.enableAutoReply,
          responseSubject: vacationRes.responseSubject || '',
          responseBodyPlainText: vacationRes.responseBodyPlainText || '',
          responseBodyHtml: vacationRes.responseBodyHtml || '',
          restrictToContacts: !!vacationRes.restrictToContacts,
          restrictToDomain: !!vacationRes.restrictToDomain,
          startTime: vacationRes.startTime || null,
          endTime: vacationRes.endTime || null,
        } : null;
      } catch (err) {
        gmail.signature_scope_ready = false;
        gmail.scope_note = err.message || 'Mailbox settings not available yet.';
      }
    }
    return json(200, {
      ok:true,
      profile: prefs ? {
        display_name: prefs.display_name || '',
        profile_title: prefs.profile_title || '',
        profile_phone: prefs.profile_phone || '',
        profile_company: prefs.profile_company || '',
        profile_website: prefs.profile_website || '',
        signature_text: prefs.signature_text || '',
        signature_html: prefs.signature_html || '',
        preferred_from_alias: prefs.preferred_from_alias || '',
        updated_at: prefs.updated_at || null,
      } : null,
      gmail,
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
