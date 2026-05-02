const { query } = require('./_db');
const { getAuthorizedGmail } = require('./_gmail');

const PEOPLE_API_BASE = 'https://people.googleapis.com/v1';
const PERSON_FIELDS = 'names,emailAddresses,phoneNumbers,organizations,photos,metadata,biographies';
const OTHER_CONTACT_READ_MASK = 'names,emailAddresses,phoneNumbers,organizations,photos,metadata';

async function peopleRequest(token, path, init = {}) {
  const url = path.startsWith('http') ? path : `${PEOPLE_API_BASE}${path}`;
  const headers = Object.assign({}, init.headers || {}, {
    Authorization: `Bearer ${token}`,
  });
  const res = await fetch(url, { ...init, headers });
  const contentType = String(res.headers.get('content-type') || '');
  if (!res.ok) {
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    const msg = data?.error?.message || data?.error_description || data?.error || text || `People API request failed (${res.status}).`;
    const err = new Error(msg);
    err.statusCode = res.status;
    throw err;
  }
  if (contentType.includes('application/json')) return await res.json();
  return await res.text();
}

function primaryEmail(person) {
  const items = Array.isArray(person?.emailAddresses) ? person.emailAddresses : [];
  const chosen = items.find((item) => item.metadata?.primary) || items[0] || null;
  return String(chosen?.value || '').trim().toLowerCase();
}

function primaryName(person) {
  const items = Array.isArray(person?.names) ? person.names : [];
  const chosen = items.find((item) => item.metadata?.primary) || items[0] || null;
  return String(chosen?.displayName || chosen?.unstructuredName || [chosen?.givenName || '', chosen?.familyName || ''].filter(Boolean).join(' ') || '').trim();
}

function primaryCompany(person) {
  const items = Array.isArray(person?.organizations) ? person.organizations : [];
  const chosen = items.find((item) => item.metadata?.primary) || items[0] || null;
  return String(chosen?.name || '').trim();
}

function primaryPhone(person) {
  const items = Array.isArray(person?.phoneNumbers) ? person.phoneNumbers : [];
  const chosen = items.find((item) => item.metadata?.primary) || items[0] || null;
  return String(chosen?.value || '').trim();
}

function primaryPhoto(person) {
  const items = Array.isArray(person?.photos) ? person.photos : [];
  const chosen = items.find((item) => item.metadata?.primary) || items[0] || null;
  return String(chosen?.url || '').trim();
}

function primaryBio(person) {
  const items = Array.isArray(person?.biographies) ? person.biographies : [];
  const chosen = items.find((item) => item.metadata?.primary) || items[0] || null;
  return String(chosen?.value || '').trim();
}

function contactSourceMetadata(person) {
  const sources = Array.isArray(person?.metadata?.sources) ? person.metadata.sources : [];
  const preferred = sources.find((src) => String(src?.type || '').toUpperCase() === 'CONTACT') || sources[0] || null;
  return preferred || null;
}

function personToRow(userId, person, source) {
  const email = primaryEmail(person);
  if (!email) return null;
  const sourceMeta = contactSourceMetadata(person);
  return {
    user_id: userId,
    email,
    full_name: primaryName(person) || null,
    company: primaryCompany(person) || null,
    phone: primaryPhone(person) || null,
    notes: primaryBio(person) || null,
    photo_url: primaryPhoto(person) || null,
    source,
    source_resource_name: String(person?.resourceName || '').trim() || null,
    source_etag: String(person?.etag || sourceMeta?.etag || '').trim() || null,
    source_metadata_json: sourceMeta ? JSON.stringify(sourceMeta) : null,
  };
}

async function upsertContactRow(row) {
  const res = await query(
    `insert into mail_contacts (
       user_id, email, full_name, company, phone, notes, favorite,
       source, source_resource_name, source_etag, source_metadata_json,
       photo_url, created_at, updated_at
     ) values ($1,$2,$3,$4,$5,$6,false,$7,$8,$9,$10,$11,now(),now())
     on conflict (user_id, email)
     do update set
       full_name=coalesce(excluded.full_name, mail_contacts.full_name),
       company=coalesce(excluded.company, mail_contacts.company),
       phone=coalesce(excluded.phone, mail_contacts.phone),
       notes=case
         when mail_contacts.source='local' and coalesce(mail_contacts.notes,'') <> '' then mail_contacts.notes
         else coalesce(excluded.notes, mail_contacts.notes)
       end,
       source=excluded.source,
       source_resource_name=excluded.source_resource_name,
       source_etag=excluded.source_etag,
       source_metadata_json=excluded.source_metadata_json,
       photo_url=coalesce(excluded.photo_url, mail_contacts.photo_url),
       updated_at=now()
     returning id, email, full_name, company, phone, notes, favorite, source, source_resource_name, photo_url, last_used_at, created_at, updated_at`,
    [
      row.user_id,
      row.email,
      row.full_name,
      row.company,
      row.phone,
      row.notes,
      row.source,
      row.source_resource_name,
      row.source_etag,
      row.source_metadata_json,
      row.photo_url,
    ]
  );
  return res.rows[0] || null;
}

function splitName(fullName) {
  const raw = String(fullName || '').trim();
  if (!raw) return { givenName: '', familyName: '' };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { givenName: parts[0], familyName: '' };
  return { givenName: parts.shift(), familyName: parts.join(' ') };
}

function buildPersonPayload(input) {
  const fullName = String(input.full_name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const company = String(input.company || '').trim();
  const phone = String(input.phone || '').trim();
  const notes = String(input.notes || '').trim();
  const { givenName, familyName } = splitName(fullName);
  const payload = {
    emailAddresses: email ? [{ value: email }] : [],
  };
  if (fullName) payload.names = [{ givenName: givenName || fullName, familyName: familyName || undefined }];
  if (company) payload.organizations = [{ name: company }];
  if (phone) payload.phoneNumbers = [{ value: phone }];
  if (notes) payload.biographies = [{ value: notes }];
  return payload;
}

async function fetchPeopleConnections(accessToken) {
  const people = [];
  let pageToken = '';
  let pages = 0;
  do {
    const url = new URL(`${PEOPLE_API_BASE}/people/me/connections`);
    url.searchParams.set('pageSize', '200');
    url.searchParams.set('personFields', PERSON_FIELDS);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const data = await peopleRequest(accessToken, url.toString());
    if (Array.isArray(data.connections)) people.push(...data.connections);
    pageToken = data.nextPageToken || '';
    pages += 1;
  } while (pageToken && pages < 10);
  return people;
}

async function fetchOtherContacts(accessToken) {
  const people = [];
  let pageToken = '';
  let pages = 0;
  do {
    const url = new URL(`${PEOPLE_API_BASE}/otherContacts`);
    url.searchParams.set('pageSize', '200');
    url.searchParams.set('readMask', OTHER_CONTACT_READ_MASK);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const data = await peopleRequest(accessToken, url.toString());
    if (Array.isArray(data.otherContacts)) people.push(...data.otherContacts);
    pageToken = data.nextPageToken || '';
    pages += 1;
  } while (pageToken && pages < 5);
  return people;
}

async function syncGoogleContacts(userId) {
  try {
    const { accessToken } = await getAuthorizedGmail(userId);
    const syncedRows = [];
    const seen = [];

    const connections = await fetchPeopleConnections(accessToken);
    for (const person of connections) {
      const row = personToRow(userId, person, 'google_contact');
      if (!row) continue;
      if (row.source_resource_name) seen.push(row.source_resource_name);
      const saved = await upsertContactRow(row);
      if (saved) syncedRows.push(saved);
    }

    const others = await fetchOtherContacts(accessToken);
    for (const person of others) {
      const row = personToRow(userId, person, 'other_contact');
      if (!row) continue;
      if (row.source_resource_name) seen.push(row.source_resource_name);
      const saved = await upsertContactRow(row);
      if (saved) syncedRows.push(saved);
    }

    const seenNames = Array.from(new Set(seen.filter(Boolean)));
    if (seenNames.length) {
      await query(
        `delete from mail_contacts
          where user_id=$1
            and source in ('google_contact','other_contact')
            and source_resource_name is not null
            and not (source_resource_name = any($2::text[]))`,
        [userId, seenNames]
      );
    }

    await query(
      `update google_mailboxes
          set contacts_last_sync_at=now(),
              contacts_last_sync_count=$2,
              contacts_sync_error=null,
              updated_at=now()
        where user_id=$1`,
      [userId, syncedRows.length]
    );

    return { synced_count: syncedRows.length };
  } catch (err) {
    await query(
      `update google_mailboxes
          set contacts_sync_error=$2,
              updated_at=now()
        where user_id=$1`,
      [userId, err.message || 'Contacts sync failed.']
    ).catch(()=>{});
    throw err;
  }
}

async function ensureGoogleContactWritable(accessToken, existingRow) {
  if (!existingRow) return existingRow;
  if (String(existingRow.source || '') !== 'other_contact' || !existingRow.source_resource_name) return existingRow;
  const resourceName = String(existingRow.source_resource_name);
  const copied = await peopleRequest(accessToken, `/${resourceName}:copyOtherContactToMyContactsGroup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      copyMask: 'names,emailAddresses,phoneNumbers',
      readMask: PERSON_FIELDS,
    }),
  });
  const src = contactSourceMetadata(copied);
  return {
    ...existingRow,
    source: 'google_contact',
    source_resource_name: copied.resourceName,
    source_etag: copied.etag || src?.etag || null,
    source_metadata_json: src ? JSON.stringify(src) : null,
  };
}

async function fetchCurrentPersonSource(accessToken, resourceName) {
  const data = await peopleRequest(accessToken, `/${resourceName}?personFields=metadata`);
  const src = contactSourceMetadata(data);
  return src ? JSON.stringify(src) : null;
}

async function saveGoogleContact(userId, input, options = {}) {
  const { accessToken } = await getAuthorizedGmail(userId);
  const payload = buildPersonPayload(input);
  let existingRow = options.existingRow || null;
  if (existingRow) existingRow = await ensureGoogleContactWritable(accessToken, existingRow);

  let person = null;
  if (existingRow && existingRow.source_resource_name) {
    let sourceMetaJson = existingRow.source_metadata_json || null;
    if (!sourceMetaJson) sourceMetaJson = await fetchCurrentPersonSource(accessToken, existingRow.source_resource_name);
    let sources = [];
    try { sources = sourceMetaJson ? [JSON.parse(sourceMetaJson)] : []; } catch { sources = []; }
    person = await peopleRequest(accessToken, `/${existingRow.source_resource_name}:updateContact?updatePersonFields=names,emailAddresses,phoneNumbers,organizations,biographies&personFields=${encodeURIComponent(PERSON_FIELDS)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceName: existingRow.source_resource_name,
        etag: existingRow.source_etag || undefined,
        metadata: sources.length ? { sources } : undefined,
        ...payload,
      }),
    });
  } else {
    person = await peopleRequest(accessToken, `/people:createContact?personFields=${encodeURIComponent(PERSON_FIELDS)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  const row = personToRow(userId, person, 'google_contact');
  if (!row) {
    const err = new Error('Google contact save succeeded but no primary email was returned.');
    err.statusCode = 500;
    throw err;
  }
  const saved = await upsertContactRow(row);
  return saved;
}

async function deleteGoogleContact(userId, row) {
  if (!row?.source_resource_name || String(row.source || '') !== 'google_contact') return { deleted_remote: false };
  const { accessToken } = await getAuthorizedGmail(userId);
  await peopleRequest(accessToken, `/${row.source_resource_name}:deleteContact`, { method: 'DELETE' });
  await query('delete from mail_contacts where user_id=$1 and id=$2', [userId, row.id]);
  return { deleted_remote: true };
}

module.exports = {
  peopleRequest,
  syncGoogleContacts,
  saveGoogleContact,
  deleteGoogleContact,
  personToRow,
  primaryEmail,
  primaryName,
};
