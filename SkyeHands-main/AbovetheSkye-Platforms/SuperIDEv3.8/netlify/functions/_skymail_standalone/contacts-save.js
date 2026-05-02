const { verifyAuth, parseJson, json } = require('./_utils');
const { query } = require('./_db');
const { loadGoogleMailbox } = require('./_gmail');
const { saveGoogleContact } = require('./_people');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') return json(405, { error: 'Method not allowed.' });
    const auth = verifyAuth(event);
    const body = parseJson(event);
    const id = String(body.id || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const fullName = String(body.full_name || '').trim();
    const company = String(body.company || '').trim();
    const phone = String(body.phone || '').trim();
    const notes = String(body.notes || '').trim();
    const favorite = Boolean(body.favorite);
    const syncGoogle = Boolean(body.sync_google);
    if (!email) return json(400, { error: 'Email is required.' });

    let existing = null;
    if (id) {
      const found = await query(`select id, email, full_name, company, phone, notes, favorite, source, source_resource_name, source_etag, source_metadata_json, photo_url from mail_contacts where user_id=$1 and id=$2 limit 1`, [auth.sub, id]);
      existing = found.rows[0] || null;
      if (!existing) return json(404, { error: 'Contact not found.' });
    }

    const mailbox = await loadGoogleMailbox(auth.sub);
    const shouldSyncGoogle = Boolean(mailbox) && (syncGoogle || ['google_contact','other_contact'].includes(String(existing?.source || '')));

    if (shouldSyncGoogle) {
      const saved = await saveGoogleContact(auth.sub, {
        email,
        full_name: fullName,
        company,
        phone,
        notes,
      }, { existingRow: existing });
      await query(`update mail_contacts set favorite=$3, updated_at=now() where user_id=$1 and id=$2`, [auth.sub, saved.id, favorite]);
      const refreshed = await query(`select id, email, full_name, company, phone, notes, favorite, source, source_resource_name, photo_url, last_used_at, created_at, updated_at from mail_contacts where user_id=$1 and id=$2 limit 1`, [auth.sub, saved.id]);
      return json(200, { ok:true, contact: refreshed.rows[0], synced_google:true });
    }

    if (id) {
      const res = await query(
        `update mail_contacts
            set email=$3,
                full_name=$4,
                company=$5,
                phone=$6,
                notes=$7,
                favorite=$8,
                updated_at=now()
          where user_id=$1 and id=$2
      returning id, email, full_name, company, phone, notes, favorite, source, source_resource_name, photo_url, last_used_at, created_at, updated_at`,
        [auth.sub, id, email, fullName || null, company || null, phone || null, notes || null, favorite]
      );
      if (!res.rows.length) return json(404, { error: 'Contact not found.' });
      return json(200, { ok:true, contact: res.rows[0], synced_google:false });
    }

    const upsert = await query(
      `insert into mail_contacts (user_id, email, full_name, company, phone, notes, favorite, source, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,'local',now(),now())
       on conflict (user_id, email)
       do update set full_name=excluded.full_name,
                     company=excluded.company,
                     phone=excluded.phone,
                     notes=excluded.notes,
                     favorite=excluded.favorite,
                     updated_at=now()
       returning id, email, full_name, company, phone, notes, favorite, source, source_resource_name, photo_url, last_used_at, created_at, updated_at`,
      [auth.sub, email, fullName || null, company || null, phone || null, notes || null, favorite]
    );
    return json(200, { ok:true, contact: upsert.rows[0], synced_google:false });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
