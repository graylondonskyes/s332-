const { verifyAuth, parseJson, json } = require('./_utils');
const { query } = require('./_db');
const { deleteGoogleContact } = require('./_people');

exports.handler = async (event) => {
  try {
    if (String(event.httpMethod || 'POST').toUpperCase() !== 'POST') return json(405, { error: 'Method not allowed.' });
    const auth = verifyAuth(event);
    const body = parseJson(event);
    const id = String(body.id || '').trim();
    if (!id) return json(400, { error: 'id required.' });

    const found = await query(`select id, source, source_resource_name from mail_contacts where user_id=$1 and id=$2 limit 1`, [auth.sub, id]);
    const row = found.rows[0] || null;
    if (!row) return json(404, { error: 'Contact not found.' });

    if (String(row.source || '') === 'google_contact') {
      await deleteGoogleContact(auth.sub, row);
      return json(200, { ok:true, id, deleted_remote:true });
    }

    await query('delete from mail_contacts where user_id=$1 and id=$2', [auth.sub, id]);
    return json(200, {
      ok:true,
      id,
      deleted_remote:false,
      note: String(row.source || '') === 'other_contact'
        ? 'Other-contact mirror removed locally. A future Google sync may bring it back unless you convert it into a real contact first.'
        : null,
    });
  } catch (err) {
    return json(err.statusCode || 500, { error: err.message || 'Server error' });
  }
};
