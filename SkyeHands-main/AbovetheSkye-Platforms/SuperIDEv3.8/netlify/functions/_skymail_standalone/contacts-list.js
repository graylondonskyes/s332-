const { verifyAuth, json } = require('./_utils');
const { query } = require('./_db');
const { loadGoogleMailbox, getAuthorizedGmail, gmailRequest, headersToMap } = require('./_gmail');

function emailOnly(value) {
  const s = String(value || '');
  const m = s.match(/<([^>]+)>/);
  if (m) return m[1].trim().toLowerCase();
  const plain = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return plain ? plain[0].trim().toLowerCase() : '';
}
function nameFromAddress(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const m = s.match(/^\s*"?([^"<]+?)"?\s*</);
  if (m) return m[1].trim();
  const email = emailOnly(s);
  return email ? email.split('@')[0] : s;
}
function splitAddresses(value) {
  return String(value || '').split(',').map((part)=>part.trim()).filter(Boolean);
}

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'GET').toUpperCase() !== 'GET') return json(405, { error: 'Method not allowed.' });
    const auth = verifyAuth(event);
    const qs = event.queryStringParameters || {};
    const q = `%${String(qs.q || '').trim().toLowerCase()}%`;
    const savedRes = await query(
      `select id, email, full_name, company, phone, notes, favorite, source, source_resource_name, photo_url, last_used_at, created_at, updated_at
         from mail_contacts
        where user_id=$1
          and (
            $2='%%' or
            lower(email) like $2 or
            lower(coalesce(full_name,'')) like $2 or
            lower(coalesce(company,'')) like $2 or
            lower(coalesce(notes,'')) like $2 or
            lower(coalesce(phone,'')) like $2
          )
        order by favorite desc, case when source='google_contact' then 0 when source='other_contact' then 1 else 2 end, coalesce(last_used_at, updated_at) desc nulls last, email asc`,
      [auth.sub, q]
    );
    const saved = savedRes.rows || [];
    const savedMap = new Map(saved.map((row)=>[String(row.email || '').toLowerCase(), row]));

    const recent = [];
    const mailbox = await loadGoogleMailbox(auth.sub);
    if (mailbox) {
      try {
        const { accessToken } = await getAuthorizedGmail(auth.sub);
        const list = await gmailRequest(accessToken, 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=25');
        const refs = Array.isArray(list.messages) ? list.messages : [];
        const seen = new Set(savedMap.keys());
        for (const ref of refs) {
          const detail = await gmailRequest(accessToken, `/messages/${encodeURIComponent(ref.id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc`);
          const headers = headersToMap(detail?.payload?.headers || []);
          const merged = [...splitAddresses(headers.from), ...splitAddresses(headers.to), ...splitAddresses(headers.cc)];
          for (const entry of merged) {
            const email = emailOnly(entry);
            if (!email || email === String(mailbox.google_email || '').toLowerCase() || seen.has(email)) continue;
            seen.add(email);
            recent.push({
              id: null,
              email,
              full_name: nameFromAddress(entry),
              company: '',
              phone: '',
              notes: '',
              favorite: false,
              source: 'recent_mail',
              source_resource_name: null,
              photo_url: '',
            });
            if (recent.length >= 20) break;
          }
          if (recent.length >= 20) break;
        }
      } catch (_err) {}
    }

    return json(200, {
      ok:true,
      saved,
      recent,
      sync: mailbox ? {
        connected: true,
        last_sync_at: mailbox.contacts_last_sync_at || null,
        last_sync_count: Number(mailbox.contacts_last_sync_count || 0),
        sync_error: mailbox.contacts_sync_error || null,
      } : { connected:false, last_sync_at:null, last_sync_count:0, sync_error:null }
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
