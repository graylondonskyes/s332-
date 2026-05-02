const jwt = require('jsonwebtoken');
const { query } = require('./_db');
const { requireEnv, sealSecret, openSecret } = require('./_utils');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/contacts.other.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid'
];

function getRedirectUri() {
  const explicit = String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();
  if (explicit) return explicit;
  const base = requireEnv('PUBLIC_BASE_URL').replace(/\/$/, '');
  return `${base}/.netlify/functions/google-oauth-callback`;
}

function getGoogleClientConfig() {
  return {
    clientId: requireEnv('GOOGLE_CLIENT_ID'),
    clientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
    redirectUri: getRedirectUri(),
  };
}

function getWatchConfig() {
  const topicName = String(process.env.GMAIL_PUBSUB_TOPIC_NAME || '').trim();
  if (!topicName) return null;
  const labelIds = String(process.env.GMAIL_WATCH_LABEL_IDS || 'INBOX')
    .split(',')
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  const labelFilterBehavior = String(process.env.GMAIL_WATCH_LABEL_FILTER_BEHAVIOR || 'INCLUDE').trim().toUpperCase();
  return {
    topicName,
    labelIds,
    labelFilterBehavior: labelIds.length ? labelFilterBehavior : undefined,
  };
}

function createOAuthState(payload) {
  const secret = requireEnv('JWT_SECRET');
  return jwt.sign({ t: 'google-oauth', ...payload }, secret, { expiresIn: '10m' });
}

function readOAuthState(token) {
  const secret = requireEnv('JWT_SECRET');
  const decoded = jwt.verify(String(token || ''), secret);
  if (!decoded || decoded.t !== 'google-oauth') throw new Error('Invalid OAuth state.');
  return decoded;
}

function buildGoogleAuthUrl({ state }) {
  const { clientId, redirectUri } = getGoogleClientConfig();
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
  url.searchParams.set('state', state);
  return url.toString();
}

async function exchangeGoogleCode(code) {
  const { clientId, clientSecret, redirectUri } = getGoogleClientConfig();
  const body = new URLSearchParams({
    code: String(code || ''),
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data.error_description || data.error || `Google token exchange failed (${res.status}).`);
  return data;
}

async function refreshGoogleAccessToken(refreshToken) {
  const { clientId, clientSecret } = getGoogleClientConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: String(refreshToken || ''),
    grant_type: 'refresh_token',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data.error_description || data.error || `Google token refresh failed (${res.status}).`);
  return data;
}

async function gmailRequest(token, path, init = {}) {
  const url = path.startsWith('http') ? path : `${GMAIL_API_BASE}${path}`;
  const headers = Object.assign({}, init.headers || {}, {
    Authorization: `Bearer ${token}`,
  });
  const res = await fetch(url, { ...init, headers });
  const contentType = String(res.headers.get('content-type') || '');
  if (!res.ok) {
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    const msg = data?.error?.message || data?.error_description || data?.error || text || `Gmail API request failed (${res.status}).`;
    const err = new Error(msg);
    err.statusCode = res.status;
    throw err;
  }
  if (contentType.includes('application/json')) return await res.json();
  return await res.arrayBuffer();
}

async function fetchGmailProfile(accessToken) {
  return await gmailRequest(accessToken, '/profile');
}

async function saveGoogleMailbox(userId, mailbox) {
  const accessEnc = sealSecret(String(mailbox.access_token || ''));
  const refreshEnc = sealSecret(String(mailbox.refresh_token || ''));
  await query(
    `insert into google_mailboxes (
       user_id, google_email, from_name, access_token_enc, refresh_token_enc, token_type,
       scope, expires_at, history_id, connected_at, updated_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
     on conflict (user_id)
     do update set
       google_email=excluded.google_email,
       from_name=excluded.from_name,
       access_token_enc=excluded.access_token_enc,
       refresh_token_enc=excluded.refresh_token_enc,
       token_type=excluded.token_type,
       scope=excluded.scope,
       expires_at=excluded.expires_at,
       history_id=coalesce(excluded.history_id, google_mailboxes.history_id),
       updated_at=now()`,
    [
      userId,
      mailbox.google_email,
      mailbox.from_name || null,
      accessEnc,
      refreshEnc,
      mailbox.token_type || 'Bearer',
      mailbox.scope || null,
      mailbox.expires_at || null,
      mailbox.history_id || null,
    ]
  );
}

async function loadGoogleMailbox(userId) {
  const res = await query(
    `select user_id, google_email, from_name, access_token_enc, refresh_token_enc, token_type,
            scope, expires_at, history_id, connected_at, updated_at,
            watch_topic, watch_expiration, watch_status, watch_last_error,
            push_enabled, sync_version, last_notification_history_id,
            last_notification_at, last_sync_at, full_sync_required,
            contacts_last_sync_at, contacts_last_sync_count, contacts_sync_error
       from google_mailboxes
      where user_id=$1
      limit 1`,
    [userId]
  );
  if (!res.rows.length) return null;
  const row = res.rows[0];
  return {
    user_id: row.user_id,
    google_email: row.google_email,
    from_name: row.from_name || '',
    access_token: openSecret(row.access_token_enc),
    refresh_token: openSecret(row.refresh_token_enc),
    token_type: row.token_type || 'Bearer',
    scope: row.scope || '',
    expires_at: row.expires_at,
    history_id: row.history_id || null,
    connected_at: row.connected_at,
    updated_at: row.updated_at,
    watch_topic: row.watch_topic || null,
    watch_expiration: row.watch_expiration || null,
    watch_status: row.watch_status || 'inactive',
    watch_last_error: row.watch_last_error || null,
    push_enabled: Boolean(row.push_enabled),
    sync_version: Number(row.sync_version || 0),
    last_notification_history_id: row.last_notification_history_id || null,
    last_notification_at: row.last_notification_at || null,
    last_sync_at: row.last_sync_at || null,
    full_sync_required: Boolean(row.full_sync_required),
    contacts_last_sync_at: row.contacts_last_sync_at || null,
    contacts_last_sync_count: Number(row.contacts_last_sync_count || 0),
    contacts_sync_error: row.contacts_sync_error || null,
  };
}

async function updateGoogleTokens(userId, patch) {
  const sets = [];
  const vals = [];
  let idx = 1;
  if (Object.prototype.hasOwnProperty.call(patch, 'access_token')) {
    sets.push(`access_token_enc=$${idx++}`);
    vals.push(sealSecret(String(patch.access_token || '')));
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'refresh_token')) {
    sets.push(`refresh_token_enc=$${idx++}`);
    vals.push(sealSecret(String(patch.refresh_token || '')));
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'expires_at')) {
    sets.push(`expires_at=$${idx++}`);
    vals.push(patch.expires_at || null);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'history_id')) {
    sets.push(`history_id=$${idx++}`);
    vals.push(patch.history_id || null);
  }
  if (!sets.length) return;
  sets.push(`updated_at=now()`);
  vals.push(userId);
  await query(`update google_mailboxes set ${sets.join(', ')} where user_id=$${idx}`, vals);
}

async function updateGoogleMailboxState(userId, patch = {}) {
  const sets = [];
  const vals = [];
  let idx = 1;
  const simpleFields = {
    history_id: 'history_id',
    watch_topic: 'watch_topic',
    watch_expiration: 'watch_expiration',
    watch_status: 'watch_status',
    watch_last_error: 'watch_last_error',
    push_enabled: 'push_enabled',
    last_notification_history_id: 'last_notification_history_id',
    last_notification_at: 'last_notification_at',
    last_sync_at: 'last_sync_at',
    full_sync_required: 'full_sync_required',
  };
  for (const [key, column] of Object.entries(simpleFields)) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      sets.push(`${column}=$${idx++}`);
      vals.push(patch[key]);
    }
  }
  if (patch.sync_version_inc) {
    sets.push(`sync_version=coalesce(sync_version,0)+${Number(patch.sync_version_inc) > 0 ? Number(patch.sync_version_inc) : 1}`);
  }
  if (!sets.length) return;
  sets.push(`updated_at=now()`);
  vals.push(userId);
  await query(`update google_mailboxes set ${sets.join(', ')} where user_id=$${idx}`, vals);
}

function shouldRefreshAccessToken(expiresAt) {
  if (!expiresAt) return true;
  const ms = new Date(expiresAt).getTime();
  if (!Number.isFinite(ms)) return true;
  return ms - Date.now() < 90 * 1000;
}

async function getAuthorizedGmail(userId) {
  const mailbox = await loadGoogleMailbox(userId);
  if (!mailbox) {
    const err = new Error('Google mailbox is not connected for this user yet.');
    err.statusCode = 404;
    throw err;
  }
  let accessToken = mailbox.access_token;
  let expiresAt = mailbox.expires_at;
  if (!accessToken || shouldRefreshAccessToken(expiresAt)) {
    if (!mailbox.refresh_token) {
      const err = new Error('Google mailbox is missing a refresh token. Reconnect the mailbox.');
      err.statusCode = 400;
      throw err;
    }
    const refreshed = await refreshGoogleAccessToken(mailbox.refresh_token);
    accessToken = refreshed.access_token;
    expiresAt = refreshed.expires_in ? new Date(Date.now() + Number(refreshed.expires_in) * 1000).toISOString() : mailbox.expires_at;
    await updateGoogleTokens(userId, {
      access_token: accessToken,
      expires_at: expiresAt,
      refresh_token: refreshed.refresh_token || mailbox.refresh_token,
    });
    mailbox.access_token = accessToken;
    mailbox.expires_at = expiresAt;
    if (refreshed.refresh_token) mailbox.refresh_token = refreshed.refresh_token;
  }
  return { accessToken, mailbox };
}

function decodeBase64Url(input) {
  if (!input) return '';
  let value = String(input).replace(/-/g, '+').replace(/_/g, '/');
  while (value.length % 4) value += '=';
  return Buffer.from(value, 'base64').toString('utf8');
}

function encodeBase64Url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function headersToMap(headers = []) {
  const out = {};
  for (const h of headers) {
    const name = String(h?.name || '').toLowerCase();
    if (!name) continue;
    out[name] = String(h?.value || '');
  }
  return out;
}

function extractBodies(payload, out = { text: '', html: '', attachments: [] }) {
  if (!payload) return out;
  const mimeType = String(payload.mimeType || '');
  const body = payload.body || {};
  if (payload.filename && body.attachmentId) {
    out.attachments.push({
      filename: payload.filename,
      mime_type: mimeType || 'application/octet-stream',
      attachment_id: body.attachmentId,
      size: Number(body.size || 0),
      part_id: payload.partId || null,
    });
  }
  if (body.data) {
    const text = decodeBase64Url(body.data);
    if (mimeType === 'text/plain') out.text += text;
    if (mimeType === 'text/html') out.html += text;
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) extractBodies(part, out);
  }
  return out;
}

function parseMessageSummary(message) {
  const payload = message?.payload || {};
  const headers = headersToMap(payload.headers || []);
  const info = extractBodies(payload);
  const labelIds = Array.isArray(message?.labelIds) ? message.labelIds : [];
  return {
    id: message.id,
    thread_id: message.threadId,
    snippet: message.snippet || '',
    from: headers.from || '',
    to: headers.to || '',
    subject: headers.subject || '(no subject)',
    date: headers.date || '',
    history_id: message.historyId || null,
    internal_date: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null,
    labels: labelIds,
    unread: labelIds.includes('UNREAD'),
    starred: labelIds.includes('STARRED'),
    important: labelIds.includes('IMPORTANT'),
    has_attachments: info.attachments.length > 0,
  };
}

function encodeHeaderWord(value) {
  const s = String(value || '');
  if (!s) return '';
  if (/^[\x20-\x7E]*$/.test(s)) return s.replace(/[\r\n]+/g, ' ');
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

function wrapBase64Mime(value) {
  return String(value || '').replace(/(.{1,76})/g, '$1\r\n').trim();
}

function buildRawMessage({ from, to, cc, bcc, subject, text, html, replyTo, threadHeaders = {}, attachments = [] }) {
  const safeAttachments = Array.isArray(attachments)
    ? attachments.filter((item) => item && item.filename && item.data_b64)
    : [];
  const mixedBoundary = `skye_mix_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const altBoundary = `skye_alt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const lines = [];
  lines.push(`From: ${from}`);
  if (to) lines.push(`To: ${to}`);
  if (cc) lines.push(`Cc: ${cc}`);
  if (bcc) lines.push(`Bcc: ${bcc}`);
  lines.push(`Subject: ${encodeHeaderWord(subject)}`);
  if (replyTo) lines.push(`Reply-To: ${replyTo}`);
  if (threadHeaders['in-reply-to']) lines.push(`In-Reply-To: ${threadHeaders['in-reply-to']}`);
  if (threadHeaders.references) lines.push(`References: ${threadHeaders.references}`);
  lines.push('MIME-Version: 1.0');

  const hasHtml = Boolean(html);
  const hasAttachments = safeAttachments.length > 0;

  if (hasAttachments) {
    lines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    lines.push('');
    if (hasHtml) {
      lines.push(`--${mixedBoundary}`);
      lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      lines.push('');
      lines.push(`--${altBoundary}`);
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(String(text || ''));
      lines.push(`--${altBoundary}`);
      lines.push('Content-Type: text/html; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(String(html || ''));
      lines.push(`--${altBoundary}--`);
    } else {
      lines.push(`--${mixedBoundary}`);
      lines.push('Content-Type: text/plain; charset="UTF-8"');
      lines.push('Content-Transfer-Encoding: 7bit');
      lines.push('');
      lines.push(String(text || ''));
    }

    for (const attachment of safeAttachments) {
      const mimeType = String(attachment.mime_type || 'application/octet-stream');
      const filename = String(attachment.filename || 'attachment.bin').replace(/[\r\n"]/g, ' ');
      lines.push(`--${mixedBoundary}`);
      lines.push(`Content-Type: ${mimeType}; name="${filename}"`);
      lines.push('Content-Transfer-Encoding: base64');
      lines.push(`Content-Disposition: attachment; filename="${filename}"`);
      lines.push('');
      lines.push(wrapBase64Mime(String(attachment.data_b64 || '').replace(/\s+/g, '')));
    }
    lines.push(`--${mixedBoundary}--`);
  } else if (hasHtml) {
    lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    lines.push('');
    lines.push(`--${altBoundary}`);
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push('Content-Transfer-Encoding: 7bit');
    lines.push('');
    lines.push(String(text || ''));
    lines.push(`--${altBoundary}`);
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push('Content-Transfer-Encoding: 7bit');
    lines.push('');
    lines.push(String(html || ''));
    lines.push(`--${altBoundary}--`);
  } else {
    lines.push('Content-Type: text/plain; charset="UTF-8"');
    lines.push('Content-Transfer-Encoding: 7bit');
    lines.push('');
    lines.push(String(text || ''));
  }
  return encodeBase64Url(lines.join('\r\n'));
}

async function enableGoogleWatch(userId) {
  const cfg = getWatchConfig();
  if (!cfg) {
    const err = new Error('Gmail push watch is not configured. Add GMAIL_PUBSUB_TOPIC_NAME first.');
    err.statusCode = 400;
    throw err;
  }
  const { accessToken } = await getAuthorizedGmail(userId);
  const payload = { topicName: cfg.topicName };
  if (cfg.labelIds?.length) payload.labelIds = cfg.labelIds;
  if (cfg.labelFilterBehavior && cfg.labelIds?.length) payload.labelFilterBehavior = cfg.labelFilterBehavior;

  const data = await gmailRequest(accessToken, '/watch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const watchExpiration = data.expiration ? new Date(Number(data.expiration)).toISOString() : null;
  await updateGoogleMailboxState(userId, {
    history_id: data.historyId || null,
    watch_topic: cfg.topicName,
    watch_expiration: watchExpiration,
    watch_status: 'active',
    watch_last_error: null,
    push_enabled: true,
    full_sync_required: false,
  });

  return {
    topic: cfg.topicName,
    labelIds: cfg.labelIds || [],
    labelFilterBehavior: cfg.labelFilterBehavior || null,
    historyId: data.historyId || null,
    expiration: watchExpiration,
  };
}

async function stopGoogleWatch(userId) {
  const mailbox = await loadGoogleMailbox(userId);
  if (!mailbox) return { stopped: false, connected: false };
  try {
    const { accessToken } = await getAuthorizedGmail(userId);
    await gmailRequest(accessToken, '/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch (err) {
    if (![400, 401, 403, 404].includes(Number(err.statusCode || 0))) throw err;
  }
  await updateGoogleMailboxState(userId, {
    watch_status: 'inactive',
    watch_expiration: null,
    watch_last_error: null,
    push_enabled: false,
  });
  return { stopped: true, connected: true };
}

function collectHistoryMessageIds(historyRows = []) {
  const ids = new Set();
  for (const row of historyRows) {
    const buckets = ['messagesAdded', 'messagesDeleted', 'labelsAdded', 'labelsRemoved', 'messages'];
    for (const bucket of buckets) {
      const list = Array.isArray(row?.[bucket]) ? row[bucket] : [];
      for (const item of list) {
        const msg = item?.message || item;
        const id = String(msg?.id || '').trim();
        if (id) ids.add(id);
      }
    }
  }
  return Array.from(ids);
}

async function syncMailboxHistory(userId, startHistoryId) {
  const { accessToken } = await getAuthorizedGmail(userId);
  let pageToken = '';
  let latestHistoryId = null;
  let pages = 0;
  const allHistory = [];
  do {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/history');
    url.searchParams.set('startHistoryId', String(startHistoryId));
    url.searchParams.set('maxResults', '100');
    url.searchParams.append('historyTypes', 'messageAdded');
    url.searchParams.append('historyTypes', 'messageDeleted');
    url.searchParams.append('historyTypes', 'labelAdded');
    url.searchParams.append('historyTypes', 'labelRemoved');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const page = await gmailRequest(accessToken, url.toString());
    if (Array.isArray(page.history)) allHistory.push(...page.history);
    latestHistoryId = page.historyId || latestHistoryId;
    pageToken = page.nextPageToken || '';
    pages += 1;
  } while (pageToken && pages < 5);

  const changedMessageIds = collectHistoryMessageIds(allHistory);
  const finalHistoryId = latestHistoryId || String(startHistoryId || '');

  await updateGoogleMailboxState(userId, {
    history_id: finalHistoryId || null,
    last_sync_at: new Date().toISOString(),
    full_sync_required: false,
  });

  return {
    latestHistoryId: finalHistoryId || null,
    changedMessageIds,
    changeCount: changedMessageIds.length,
    pages,
  };
}

async function touchMailboxAfterList(userId, latestHistoryId) {
  if (!latestHistoryId) return;
  await updateGoogleMailboxState(userId, {
    history_id: latestHistoryId,
    last_sync_at: new Date().toISOString(),
    full_sync_required: false,
  });
}

async function findGoogleMailboxUsersByEmail(googleEmail) {
  const email = String(googleEmail || '').trim().toLowerCase();
  if (!email) return [];
  const res = await query(
    `select user_id, google_email, history_id, watch_status, push_enabled, sync_version,
            watch_expiration, full_sync_required
       from google_mailboxes
      where lower(google_email)=lower($1)`,
    [email]
  );
  return res.rows || [];
}

async function listWatchRenewalCandidates(limit = 50) {
  const res = await query(
    `select user_id, google_email, watch_expiration, push_enabled, watch_status
       from google_mailboxes
      where push_enabled=true
        and (watch_expiration is null or watch_expiration < now() + interval '36 hours')
      order by watch_expiration asc nulls first
      limit $1`,
    [Math.max(1, Number(limit || 50))]
  );
  return res.rows || [];
}

module.exports = {
  GOOGLE_SCOPES,
  buildGoogleAuthUrl,
  createOAuthState,
  readOAuthState,
  exchangeGoogleCode,
  fetchGmailProfile,
  saveGoogleMailbox,
  loadGoogleMailbox,
  updateGoogleTokens,
  updateGoogleMailboxState,
  getAuthorizedGmail,
  gmailRequest,
  decodeBase64Url,
  headersToMap,
  extractBodies,
  parseMessageSummary,
  buildRawMessage,
  getRedirectUri,
  getWatchConfig,
  enableGoogleWatch,
  stopGoogleWatch,
  syncMailboxHistory,
  touchMailboxAfterList,
  findGoogleMailboxUsersByEmail,
  listWatchRenewalCandidates,
};
