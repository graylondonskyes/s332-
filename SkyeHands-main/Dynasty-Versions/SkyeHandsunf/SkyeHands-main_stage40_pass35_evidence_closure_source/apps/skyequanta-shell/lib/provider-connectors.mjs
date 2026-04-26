import crypto from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';

import { maskValue } from './provider-redaction.mjs';
import { assertOutboundUrlAllowed, describeOutboundNetworkPolicy, getOutboundNetworkPolicy } from './network-policy.mjs';

function readString(value) {
  return String(value ?? '').trim();
}

const PROVIDER_DEFINITIONS = {
  neon: {
    provider: 'neon',
    label: 'Neon / Postgres',
    description: 'User-owned Postgres or Neon database lane for workspace data and runtime storage.',
    defaultCapabilities: ['database', 'storage'],
    defaultBindingRoles: ['primary_database', 'object_storage'],
    requiredFields: ['databaseUrl'],
    fields: [
      { key: 'databaseUrl', label: 'Database URL', secret: true, required: true, placeholder: 'postgresql://user:pass@host/db' },
      { key: 'projectId', label: 'Project ID', secret: false, required: false, placeholder: 'neon project id' },
      { key: 'databaseName', label: 'Database Name', secret: false, required: false, placeholder: 'app_db' },
      { key: 'connectionTimeoutMs', label: 'Connection Timeout Ms', secret: false, required: false, placeholder: '8000' }
    ],
    connectionChecks: [
      'Open a real Postgres wire-protocol connectivity probe against the user-owned database URL',
      'Authenticate over the provider-selected Postgres lane using the user-owned credentials only',
      'Run a minimal SELECT 1 health query without falling back to founder credentials'
    ]
  },
  cloudflare: {
    provider: 'cloudflare',
    label: 'Cloudflare',
    description: 'User-owned Cloudflare lane for Workers, R2, account-scoped runtime, and deploy surfaces.',
    defaultCapabilities: ['worker_runtime', 'object_storage', 'deploy', 'preview'],
    defaultBindingRoles: ['worker_deploy', 'object_storage', 'preview_deploy'],
    requiredFields: ['apiToken', 'accountId'],
    fields: [
      { key: 'apiToken', label: 'API Token', secret: true, required: true, placeholder: 'Cloudflare API token' },
      { key: 'accountId', label: 'Account ID', secret: false, required: true, placeholder: 'Cloudflare account id' },
      { key: 'zoneId', label: 'Zone ID', secret: false, required: false, placeholder: 'optional zone id' },
      { key: 'workerName', label: 'Worker Name', secret: false, required: false, placeholder: 'my-worker' },
      { key: 'r2Bucket', label: 'R2 Bucket', secret: false, required: false, placeholder: 'my-bucket' },
      { key: 'apiBaseUrl', label: 'API Base URL', secret: false, required: false, placeholder: 'https://api.cloudflare.com' }
    ],
    connectionChecks: [
      'Call the user-owned Cloudflare account API using the supplied bearer token only',
      'Probe worker or object-storage capability endpoints based on the selected action/binding',
      'Return only redacted account and capability posture in the execution summary'
    ]
  },
  netlify: {
    provider: 'netlify',
    label: 'Netlify',
    description: 'User-owned Netlify lane for site runtime, preview deploys, and site-scoped project surfaces.',
    defaultCapabilities: ['site_runtime', 'deploy', 'preview'],
    defaultBindingRoles: ['site_deploy', 'preview_deploy'],
    requiredFields: ['authToken', 'siteId'],
    fields: [
      { key: 'authToken', label: 'Auth Token', secret: true, required: true, placeholder: 'Netlify personal access token' },
      { key: 'siteId', label: 'Site ID', secret: false, required: true, placeholder: 'netlify site id' },
      { key: 'teamSlug', label: 'Team Slug', secret: false, required: false, placeholder: 'team slug' },
      { key: 'siteName', label: 'Site Name', secret: false, required: false, placeholder: 'site name' },
      { key: 'apiBaseUrl', label: 'API Base URL', secret: false, required: false, placeholder: 'https://api.netlify.com' }
    ],
    connectionChecks: [
      'Call the user-owned Netlify API using the supplied bearer token only',
      'Probe site runtime posture for the selected site using the bound site identifier',
      'Keep site and preview execution isolated from founder credentials'
    ]
  },
  github: {
    provider: 'github',
    label: 'GitHub',
    description: 'User-owned source-control lane for repo auth, PR work, push plans, and repo-scoped execution.',
    defaultCapabilities: ['scm'],
    defaultBindingRoles: ['scm_origin'],
    requiredFields: ['token', 'owner', 'repo'],
    fields: [
      { key: 'token', label: 'Token', secret: true, required: true, placeholder: 'GitHub token or installation token' },
      { key: 'owner', label: 'Owner', secret: false, required: true, placeholder: 'repo owner' },
      { key: 'repo', label: 'Repository', secret: false, required: true, placeholder: 'repo name' },
      { key: 'branch', label: 'Branch', secret: false, required: false, placeholder: 'main' },
      { key: 'installationId', label: 'Installation ID', secret: false, required: false, placeholder: 'optional installation id' },
      { key: 'apiBaseUrl', label: 'API Base URL', secret: false, required: false, placeholder: 'https://api.github.com' }
    ],
    connectionChecks: [
      'Call the user-owned GitHub API using the supplied bearer token only',
      'Probe repo access for the selected owner/repo pair using the bound user-owned credentials',
      'Keep repo execution in user-owned lane with no founder fallback'
    ]
  },
  env_bundle: {
    provider: 'env_bundle',
    label: 'Generic Env Bundle',
    description: 'User-owned generic bundle for custom runtime variables, connector keys, and mixed provider contracts.',
    defaultCapabilities: ['runtime'],
    defaultBindingRoles: ['runtime_env'],
    requiredFields: ['env'],
    fields: [
      { key: 'bundleName', label: 'Bundle Name', secret: false, required: false, placeholder: 'custom bundle' },
      { key: 'env', label: 'Env JSON', secret: true, required: true, multiline: true, placeholder: '{"API_KEY":"value"}' }
    ],
    connectionChecks: [
      'Validate env bundle contains at least one variable',
      'Prepare action-specific minimum projection from bundle contents',
      'Mask all values in previews and execution summaries'
    ]
  }
};

const SCRAM_NONCE_BYTES = 18;
const DEFAULT_TIMEOUT_MS = 8000;
const PG_SSL_REQUEST_CODE = 80877103;

function ensureObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function normalizeEnvBundle(payload) {
  const env = ensureObject(payload?.env || {}, 'env_bundle.env');
  const normalized = {};
  for (const [key, value] of Object.entries(env)) {
    const envKey = readString(key).toUpperCase();
    if (!envKey) continue;
    normalized[envKey] = readString(value);
  }
  return normalized;
}

function looksLikeUuid(value) {
  return /^[a-f0-9-]{12,}$/i.test(readString(value));
}

function looksLikeGithubName(value) {
  return /^[A-Za-z0-9_.-]{1,100}$/.test(readString(value));
}

function looksLikeToken(value) {
  return readString(value).length >= 10;
}

function timeoutMs(value, fallback = DEFAULT_TIMEOUT_MS) {
  const parsed = Number.parseInt(readString(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function withTimeout(promise, ms, label = 'operation') {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms.`)), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeoutPromise]);
}

function joinUrl(baseUrl, pathname) {
  return new URL(pathname, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

async function fetchJson(url, options = {}, timeout = DEFAULT_TIMEOUT_MS, networkOptions = {}) {
  const networkPolicy = getOutboundNetworkPolicy(options?.env || process.env);
  assertOutboundUrlAllowed(url, networkPolicy, networkOptions);
  const response = await withTimeout(fetch(url, options), timeout, `fetch ${url}`);
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { ok: response.ok, status: response.status, text, json, headers: Object.fromEntries(response.headers.entries()) };
}

function buildJsonSummary(response) {
  return {
    status: response.status,
    ok: response.ok,
    hasJson: Boolean(response.json && typeof response.json === 'object'),
    jsonKeys: response.json && typeof response.json === 'object' ? Object.keys(response.json).slice(0, 12) : [],
    textPreview: response.text ? response.text.slice(0, 180) : ''
  };
}

function safeError(error) {
  return readString(error?.message || error) || 'unknown_error';
}

function getCloudflareBaseUrl(payload) { return readString(payload.apiBaseUrl) || 'https://api.cloudflare.com'; }
function getNetlifyBaseUrl(payload) { return readString(payload.apiBaseUrl) || 'https://api.netlify.com'; }
function getGitHubBaseUrl(payload) { return readString(payload.apiBaseUrl) || 'https://api.github.com'; }

export function normalizeProvider(provider) {
  const normalized = readString(provider).toLowerCase();
  const allowed = Object.keys(PROVIDER_DEFINITIONS);
  if (!allowed.includes(normalized)) {
    throw new Error(`Unsupported provider '${provider}'. Expected one of: ${allowed.join(', ')}.`);
  }
  return normalized;
}

function parsePostgresUrl(databaseUrl, fallbackDatabaseName = '') {
  const parsed = new URL(databaseUrl);
  const sslMode = readString(parsed.searchParams.get('sslmode')).toLowerCase() || 'require';
  return {
    raw: databaseUrl,
    host: parsed.hostname,
    port: Number.parseInt(parsed.port || '5432', 10),
    user: decodeURIComponent(parsed.username || ''),
    password: decodeURIComponent(parsed.password || ''),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '') || fallbackDatabaseName || 'postgres'),
    sslMode,
    tls: sslMode !== 'disable',
    rejectUnauthorized: ['verify-ca', 'verify-full'].includes(sslMode),
    servername: parsed.hostname
  };
}

function envForKeys(payload, mappings = []) {
  const env = {};
  for (const [payloadKey, envKey] of mappings) {
    const value = readString(payload[payloadKey]);
    if (value) env[envKey] = value;
  }
  return env;
}

function encodeCStringParts(parts = []) {
  const chunks = [];
  for (const part of parts) {
    chunks.push(Buffer.from(String(part), 'utf8'));
    chunks.push(Buffer.from([0]));
  }
  return Buffer.concat(chunks);
}

function buildStartupMessage(connection) {
  const body = encodeCStringParts(['user', connection.user, 'database', connection.database, 'client_encoding', 'UTF8']);
  const header = Buffer.allocUnsafe(8);
  header.writeInt32BE(body.length + 8, 0);
  header.writeInt32BE(196608, 4);
  return Buffer.concat([header, body]);
}

function buildSslRequest() {
  const buffer = Buffer.allocUnsafe(8);
  buffer.writeInt32BE(8, 0);
  buffer.writeInt32BE(PG_SSL_REQUEST_CODE, 4);
  return buffer;
}

function buildPasswordMessage(value) {
  const payload = Buffer.from(`${value}\0`, 'utf8');
  const header = Buffer.allocUnsafe(5);
  header.writeUInt8('p'.charCodeAt(0), 0);
  header.writeInt32BE(payload.length + 4, 1);
  return Buffer.concat([header, payload]);
}

function buildQueryMessage(sql) {
  const payload = Buffer.from(`${sql}\0`, 'utf8');
  const header = Buffer.allocUnsafe(5);
  header.writeUInt8('Q'.charCodeAt(0), 0);
  header.writeInt32BE(payload.length + 4, 1);
  return Buffer.concat([header, payload]);
}

function buildTerminateMessage() {
  const buffer = Buffer.allocUnsafe(5);
  buffer.writeUInt8('X'.charCodeAt(0), 0);
  buffer.writeInt32BE(4, 1);
  return buffer;
}

function buildSaslInitialResponse(mechanism, initialResponse) {
  const mech = Buffer.from(mechanism, 'utf8');
  const initial = Buffer.from(initialResponse, 'utf8');
  const header = Buffer.allocUnsafe(5);
  header.writeUInt8('p'.charCodeAt(0), 0);
  header.writeInt32BE(4 + mech.length + 1 + 4 + initial.length, 1);
  const respLength = Buffer.allocUnsafe(4);
  respLength.writeInt32BE(initial.length, 0);
  return Buffer.concat([header, mech, Buffer.from([0]), respLength, initial]);
}

function md5Hex(value) { return crypto.createHash('md5').update(value).digest('hex'); }
function xorBuffers(left, right) { const out = Buffer.allocUnsafe(left.length); for (let i=0;i<left.length;i++) out[i]=left[i]^right[i]; return out; }
function parseAuthFields(value) { return Object.fromEntries(String(value||'').split(',').map(segment => { const [key,...rest]=segment.split('='); return [key, rest.join('=')]; }).filter(([key])=>key)); }

function buildScramClientState(connection) {
  const username = connection.user.replace(/=/g, '=3D').replace(/,/g, '=2C');
  const clientNonce = crypto.randomBytes(SCRAM_NONCE_BYTES).toString('base64');
  const clientFirstBare = `n=${username},r=${clientNonce}`;
  const gs2Header = 'n,,';
  return { mechanism: 'SCRAM-SHA-256', clientNonce, gs2Header, clientFirstBare, initialResponse: `${gs2Header}${clientFirstBare}` };
}

function continueScram(state, serverFirstMessage, password) {
  const fields = parseAuthFields(serverFirstMessage);
  const iterations = Number.parseInt(fields.i || '0', 10);
  const salt = fields.s ? Buffer.from(fields.s, 'base64') : null;
  const nonce = fields.r || '';
  if (!salt || !iterations || !nonce.startsWith(state.clientNonce)) throw new Error('Invalid SCRAM challenge from postgres server.');
  const clientFinalWithoutProof = `c=${Buffer.from(state.gs2Header).toString('base64')},r=${nonce}`;
  const saltedPassword = crypto.pbkdf2Sync(Buffer.from(password, 'utf8'), salt, iterations, 32, 'sha256');
  const clientKey = crypto.createHmac('sha256', saltedPassword).update('Client Key').digest();
  const storedKey = crypto.createHash('sha256').update(clientKey).digest();
  const authMessage = `${state.clientFirstBare},${serverFirstMessage},${clientFinalWithoutProof}`;
  const clientSignature = crypto.createHmac('sha256', storedKey).update(authMessage).digest();
  const clientProof = xorBuffers(clientKey, clientSignature);
  const serverKey = crypto.createHmac('sha256', saltedPassword).update('Server Key').digest();
  const expectedServerSignature = crypto.createHmac('sha256', serverKey).update(authMessage).digest('base64');
  return { ...state, expectedServerSignature, clientFinalMessage: `${clientFinalWithoutProof},p=${Buffer.from(clientProof).toString('base64')}` };
}

function createMessageReader(socket) {
  let pending = Buffer.alloc(0);
  let waiter = null;
  let fatalError = null;
  let ended = false;
  const flush = () => {
    if (!waiter) return;
    if (fatalError) { const reject = waiter.reject; waiter = null; reject(fatalError); return; }
    if (ended && pending.length === 0) { const reject = waiter.reject; waiter = null; reject(new Error('Postgres socket ended before expected message arrived.')); return; }
    if (pending.length >= 5) {
      const length = pending.readInt32BE(1);
      const total = length + 1;
      if (pending.length >= total) {
        const frame = pending.subarray(0, total);
        pending = pending.subarray(total);
        const resolve = waiter.resolve; waiter = null;
        resolve({ type: String.fromCharCode(frame[0]), payload: frame.subarray(5) });
      }
    }
  };
  socket.on('data', chunk => { pending = Buffer.concat([pending, chunk]); flush(); });
  socket.on('error', error => { fatalError = error; flush(); });
  socket.on('end', () => { ended = true; flush(); });
  socket.on('close', () => { ended = true; flush(); });
  return async function nextMessage(timeout = DEFAULT_TIMEOUT_MS) {
    if (pending.length >= 5) {
      const length = pending.readInt32BE(1); const total = length + 1;
      if (pending.length >= total) {
        const frame = pending.subarray(0, total); pending = pending.subarray(total);
        return { type: String.fromCharCode(frame[0]), payload: frame.subarray(5) };
      }
    }
    return withTimeout(new Promise((resolve, reject) => { waiter = { resolve, reject }; flush(); }), timeout, 'postgres message read');
  };
}

function parseErrorResponse(payload) {
  const parts = []; let start = 0;
  while (start < payload.length) {
    const code = payload[start]; if (code === 0) break;
    let end = start + 1; while (end < payload.length && payload[end] !== 0) end += 1;
    parts.push(`${String.fromCharCode(code)}=${payload.subarray(start + 1, end).toString('utf8')}`);
    start = end + 1;
  }
  return parts.join('; ');
}

async function openPostgresSocket(connection, timeout) {
  const baseSocket = await withTimeout(new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: connection.host, port: connection.port }, () => resolve(socket));
    socket.once('error', reject);
  }), timeout, 'postgres tcp connect');
  if (!connection.tls) return baseSocket;
  await withTimeout(new Promise((resolve, reject) => baseSocket.write(buildSslRequest(), err => err ? reject(err) : resolve())), timeout, 'postgres ssl request');
  const sslResponse = await withTimeout(new Promise((resolve, reject) => {
    const onData = chunk => { cleanup(); resolve(chunk[0]); };
    const onError = error => { cleanup(); reject(error); };
    const onClose = () => { cleanup(); reject(new Error('Postgres socket closed during SSL negotiation.')); };
    const cleanup = () => { baseSocket.off('data', onData); baseSocket.off('error', onError); baseSocket.off('close', onClose); };
    baseSocket.on('data', onData); baseSocket.on('error', onError); baseSocket.on('close', onClose);
  }), timeout, 'postgres ssl negotiation');
  if (sslResponse !== 'S'.charCodeAt(0)) throw new Error('Postgres server refused SSL negotiation.');
  const secureSocket = tls.connect({ socket: baseSocket, servername: connection.servername, rejectUnauthorized: connection.rejectUnauthorized });
  await withTimeout(new Promise((resolve, reject) => { secureSocket.once('secureConnect', resolve); secureSocket.once('error', reject); }), timeout, 'postgres tls connect');
  return secureSocket;
}

async function authenticatePostgres(socket, nextMessage, connection, timeout) {
  let scramState = null;
  await withTimeout(new Promise((resolve, reject) => socket.write(buildStartupMessage(connection), err => err ? reject(err) : resolve())), timeout, 'postgres startup write');
  while (true) {
    const message = await nextMessage(timeout);
    if (message.type === 'R') {
      const code = message.payload.readInt32BE(0);
      if (code === 0) continue;
      if (code === 3) { await withTimeout(new Promise((resolve, reject) => socket.write(buildPasswordMessage(connection.password), err => err ? reject(err) : resolve())), timeout, 'postgres cleartext password'); continue; }
      if (code === 5) {
        const salt = message.payload.subarray(4, 8);
        const inner = md5Hex(`${connection.password}${connection.user}`);
        const final = `md5${md5Hex(Buffer.concat([Buffer.from(inner, 'utf8'), salt]))}`;
        await withTimeout(new Promise((resolve, reject) => socket.write(buildPasswordMessage(final), err => err ? reject(err) : resolve())), timeout, 'postgres md5 password');
        continue;
      }
      if (code === 10) {
        const mechs = []; let start = 4;
        while (start < message.payload.length) {
          let end = start; while (end < message.payload.length && message.payload[end] !== 0) end += 1;
          const mech = message.payload.subarray(start, end).toString('utf8'); if (!mech) break; mechs.push(mech); start = end + 1;
        }
        if (!mechs.includes('SCRAM-SHA-256')) throw new Error(`Unsupported postgres SASL mechanisms: ${mechs.join(', ')}`);
        scramState = buildScramClientState(connection);
        await withTimeout(new Promise((resolve, reject) => socket.write(buildSaslInitialResponse(scramState.mechanism, scramState.initialResponse), err => err ? reject(err) : resolve())), timeout, 'postgres sasl initial');
        continue;
      }
      if (code === 11) {
        if (!scramState) throw new Error('Received SCRAM continue without SCRAM state.');
        scramState = continueScram(scramState, message.payload.subarray(4).toString('utf8'), connection.password);
        await withTimeout(new Promise((resolve, reject) => socket.write(buildPasswordMessage(scramState.clientFinalMessage), err => err ? reject(err) : resolve())), timeout, 'postgres sasl final');
        continue;
      }
      if (code === 12) {
        if (!scramState) throw new Error('Received SCRAM final without SCRAM state.');
        const fields = parseAuthFields(message.payload.subarray(4).toString('utf8'));
        if (fields.v && fields.v !== scramState.expectedServerSignature) throw new Error('Postgres SCRAM server signature mismatch.');
        continue;
      }
      throw new Error(`Unsupported postgres authentication code ${code}.`);
    }
    if (message.type === 'S' || message.type === 'K') continue;
    if (message.type === 'Z') return;
    if (message.type === 'E') throw new Error(`Postgres startup error: ${parseErrorResponse(message.payload)}`);
  }
}

async function queryPostgresHealth(socket, nextMessage, timeout) {
  await withTimeout(new Promise((resolve, reject) => socket.write(buildQueryMessage('select 1 as skyehands_provider_probe'), err => err ? reject(err) : resolve())), timeout, 'postgres query write');
  let commandComplete = false; let sawReady = false; let sawRowData = false;
  while (!sawReady) {
    const message = await nextMessage(timeout);
    if (message.type === 'T' || message.type === 'D') { sawRowData = true; continue; }
    if (message.type === 'C') { commandComplete = true; continue; }
    if (message.type === 'Z') { sawReady = true; continue; }
    if (message.type === 'E') throw new Error(`Postgres query error: ${parseErrorResponse(message.payload)}`);
  }
  return { ok: commandComplete && sawReady, commandComplete, sawReady, sawRowData };
}

async function verifyPostgresConnection(payload = {}, options = {}) {
  const connection = parsePostgresUrl(readString(payload.databaseUrl), readString(payload.databaseName));
  const timeout = timeoutMs(payload.connectionTimeoutMs || options.timeoutMs);
  const socket = await openPostgresSocket(connection, timeout);
  const nextMessage = createMessageReader(socket);
  try {
    await authenticatePostgres(socket, nextMessage, connection, timeout);
    const query = await queryPostgresHealth(socket, nextMessage, timeout);
    try { socket.write(buildTerminateMessage()); } catch {}
    socket.end();
    return { ok: query.ok, mode: 'live_protocol_probe', provider: 'neon', summary: { host: connection.host, port: connection.port, database: connection.database, sslMode: connection.sslMode, authenticated: true, query } };
  } catch (error) {
    try { socket.destroy(); } catch {}
    throw error;
  }
}

async function verifyCloudflareConnection(payload = {}, options = {}) {
  const timeout = timeoutMs(options.timeoutMs);
  const baseUrl = getCloudflareBaseUrl(payload);
  const action = readString(options.action).toLowerCase();
  const capability = readString(options.capability).toLowerCase();
  const headers = { authorization: `Bearer ${readString(payload.apiToken)}`, 'content-type': 'application/json' };
  const accountPath = `/client/v4/accounts/${encodeURIComponent(readString(payload.accountId))}`;
  const accountResponse = await fetchJson(joinUrl(baseUrl, accountPath), { headers }, timeout, { provider: 'cloudflare' });
  if (!accountResponse.ok) throw new Error(`Cloudflare account probe failed with status ${accountResponse.status}.`);
  let capabilityPath = accountPath;
  if (action === 'object_storage' || capability === 'object_storage') {
    capabilityPath = payload.r2Bucket ? `/client/v4/accounts/${encodeURIComponent(readString(payload.accountId))}/r2/buckets/${encodeURIComponent(readString(payload.r2Bucket))}` : accountPath;
  } else if (action === 'worker_deploy' || capability === 'worker_runtime') {
    capabilityPath = `/client/v4/accounts/${encodeURIComponent(readString(payload.accountId))}/workers/subdomain`;
  } else if ((action === 'preview_deploy' || capability === 'preview') && payload.zoneId) {
    capabilityPath = `/client/v4/zones/${encodeURIComponent(readString(payload.zoneId))}`;
  }
  const capabilityResponse = capabilityPath === accountPath ? accountResponse : await fetchJson(joinUrl(baseUrl, capabilityPath), { headers }, timeout);
  if (!capabilityResponse.ok) throw new Error(`Cloudflare capability probe failed with status ${capabilityResponse.status}.`);
  return { ok: true, mode: 'live_http_probe', provider: 'cloudflare', summary: { baseUrl, accountPath, capabilityPath, accountStatus: accountResponse.status, capabilityStatus: capabilityResponse.status, accountResponse: buildJsonSummary(accountResponse), capabilityResponse: buildJsonSummary(capabilityResponse) } };
}

async function verifyNetlifyConnection(payload = {}, options = {}) {
  const timeout = timeoutMs(options.timeoutMs);
  const baseUrl = getNetlifyBaseUrl(payload);
  const headers = { authorization: `Bearer ${readString(payload.authToken)}`, 'content-type': 'application/json' };
  const sitePath = `/api/v1/sites/${encodeURIComponent(readString(payload.siteId))}`;
  const siteResponse = await fetchJson(joinUrl(baseUrl, sitePath), { headers }, timeout, { provider: 'netlify' });
  if (!siteResponse.ok) throw new Error(`Netlify site probe failed with status ${siteResponse.status}.`);
  return { ok: true, mode: 'live_http_probe', provider: 'netlify', summary: { baseUrl, sitePath, siteStatus: siteResponse.status, siteResponse: buildJsonSummary(siteResponse), teamSlug: readString(payload.teamSlug)||null, siteName: readString(payload.siteName)||null } };
}

async function verifyGitHubConnection(payload = {}, options = {}) {
  const timeout = timeoutMs(options.timeoutMs);
  const baseUrl = getGitHubBaseUrl(payload);
  const headers = { authorization: `Bearer ${readString(payload.token)}`, accept: 'application/vnd.github+json', 'user-agent': 'SkyeHands-ProviderProbe', 'content-type': 'application/json' };
  const repoPath = `/repos/${encodeURIComponent(readString(payload.owner))}/${encodeURIComponent(readString(payload.repo))}`;
  const repoResponse = await fetchJson(joinUrl(baseUrl, repoPath), { headers }, timeout, { provider: 'github' });
  if (!repoResponse.ok) throw new Error(`GitHub repo probe failed with status ${repoResponse.status}.`);
  return { ok: true, mode: 'live_http_probe', provider: 'github', summary: { baseUrl, repoPath, repoStatus: repoResponse.status, repoResponse: buildJsonSummary(repoResponse), branch: readString(payload.branch)||null, installationId: maskValue(payload.installationId || '') || null } };
}

async function verifyEnvBundleConnection(payload = {}, options = {}) {
  const env = buildProviderEnvProjection('env_bundle', payload, { capability: options.capability, action: options.action });
  return { ok: Object.keys(env).length > 0, mode: 'projection_probe', provider: 'env_bundle', summary: { envKeys: Object.keys(env).sort(), preview: Object.fromEntries(Object.entries(env).map(([k,v])=>[k, maskValue(v)])) } };
}

async function verifyProviderCapability(provider, payload = {}, options = {}) {
  switch (provider) {
    case 'neon': return verifyPostgresConnection(payload, options);
    case 'cloudflare': return verifyCloudflareConnection(payload, options);
    case 'netlify': return verifyNetlifyConnection(payload, options);
    case 'github': return verifyGitHubConnection(payload, options);
    case 'env_bundle': return verifyEnvBundleConnection(payload, options);
    default: throw new Error(`No provider verification driver is available for '${provider}'.`);
  }
}


async function discoverNeonResources(payload = {}, options = {}) {
  const verification = await verifyPostgresConnection(payload, options);
  const connection = parsePostgresUrl(readString(payload.databaseUrl), readString(payload.databaseName));
  return {
    ok: Boolean(verification.ok),
    mode: 'live_protocol_discovery',
    provider: 'neon',
    resources: {
      database: {
        host: connection.host,
        port: connection.port,
        database: connection.database,
        sslMode: connection.sslMode,
        authenticated: Boolean(verification.summary?.authenticated),
        query: verification.summary?.query || null
      }
    }
  };
}

async function discoverCloudflareResources(payload = {}, options = {}) {
  const timeout = timeoutMs(options.timeoutMs);
  const baseUrl = getCloudflareBaseUrl(payload);
  const headers = { authorization: `Bearer ${readString(payload.apiToken)}`, 'content-type': 'application/json' };
  const accountPath = `/client/v4/accounts/${encodeURIComponent(readString(payload.accountId))}`;
  const accountResponse = await fetchJson(joinUrl(baseUrl, accountPath), { headers }, timeout, { provider: 'cloudflare' });
  if (!accountResponse.ok) throw new Error(`Cloudflare account discovery failed with status ${accountResponse.status}.`);
  let workerResponse = null;
  let bucketResponse = null;
  let zoneResponse = null;
  if (readString(payload.workerName) || readString(payload.accountId)) {
    workerResponse = await fetchJson(joinUrl(baseUrl, `/client/v4/accounts/${encodeURIComponent(readString(payload.accountId))}/workers/subdomain`), { headers }, timeout, { provider: 'cloudflare' });
  }
  if (readString(payload.r2Bucket)) {
    bucketResponse = await fetchJson(joinUrl(baseUrl, `/client/v4/accounts/${encodeURIComponent(readString(payload.accountId))}/r2/buckets/${encodeURIComponent(readString(payload.r2Bucket))}`), { headers }, timeout, { provider: 'cloudflare' });
  }
  if (readString(payload.zoneId)) {
    zoneResponse = await fetchJson(joinUrl(baseUrl, `/client/v4/zones/${encodeURIComponent(readString(payload.zoneId))}`), { headers }, timeout, { provider: 'cloudflare' });
  }
  return {
    ok: true,
    mode: 'live_http_discovery',
    provider: 'cloudflare',
    resources: {
      account: { path: accountPath, status: accountResponse.status, summary: buildJsonSummary(accountResponse) },
      workerSubdomain: workerResponse ? { status: workerResponse.status, summary: buildJsonSummary(workerResponse) } : null,
      bucket: bucketResponse ? { status: bucketResponse.status, summary: buildJsonSummary(bucketResponse) } : null,
      zone: zoneResponse ? { status: zoneResponse.status, summary: buildJsonSummary(zoneResponse) } : null
    }
  };
}

async function discoverNetlifyResources(payload = {}, options = {}) {
  const timeout = timeoutMs(options.timeoutMs);
  const baseUrl = getNetlifyBaseUrl(payload);
  const headers = { authorization: `Bearer ${readString(payload.authToken)}`, 'content-type': 'application/json' };
  const sitePath = `/api/v1/sites/${encodeURIComponent(readString(payload.siteId))}`;
  const siteResponse = await fetchJson(joinUrl(baseUrl, sitePath), { headers }, timeout, { provider: 'netlify' });
  if (!siteResponse.ok) throw new Error(`Netlify site discovery failed with status ${siteResponse.status}.`);
  let deploysResponse = null;
  const deploysPath = `${sitePath}/deploys`;
  deploysResponse = await fetchJson(joinUrl(baseUrl, deploysPath), { headers }, timeout, { provider: 'netlify' });
  return {
    ok: true,
    mode: 'live_http_discovery',
    provider: 'netlify',
    resources: {
      site: { path: sitePath, status: siteResponse.status, summary: buildJsonSummary(siteResponse) },
      deploys: deploysResponse ? { path: deploysPath, status: deploysResponse.status, summary: buildJsonSummary(deploysResponse) } : null
    }
  };
}

async function discoverGitHubResources(payload = {}, options = {}) {
  const timeout = timeoutMs(options.timeoutMs);
  const baseUrl = getGitHubBaseUrl(payload);
  const headers = { authorization: `Bearer ${readString(payload.token)}`, accept: 'application/vnd.github+json', 'user-agent': 'SkyeHands-ProviderProbe', 'content-type': 'application/json' };
  const userPath = '/user';
  const repoPath = `/repos/${encodeURIComponent(readString(payload.owner))}/${encodeURIComponent(readString(payload.repo))}`;
  const branchPath = readString(payload.branch) ? `${repoPath}/branches/${encodeURIComponent(readString(payload.branch))}` : null;
  const userResponse = await fetchJson(joinUrl(baseUrl, userPath), { headers }, timeout, { provider: 'github' });
  const repoResponse = await fetchJson(joinUrl(baseUrl, repoPath), { headers }, timeout, { provider: 'github' });
  if (!repoResponse.ok) throw new Error(`GitHub repo discovery failed with status ${repoResponse.status}.`);
  const branchResponse = branchPath ? await fetchJson(joinUrl(baseUrl, branchPath), { headers }, timeout, { provider: 'github' }) : null;
  return {
    ok: true,
    mode: 'live_http_discovery',
    provider: 'github',
    resources: {
      user: userResponse.ok ? { path: userPath, status: userResponse.status, summary: buildJsonSummary(userResponse) } : null,
      repo: { path: repoPath, status: repoResponse.status, summary: buildJsonSummary(repoResponse) },
      branch: branchResponse ? { path: branchPath, status: branchResponse.status, summary: buildJsonSummary(branchResponse) } : null
    }
  };
}

async function discoverEnvBundleResources(payload = {}, options = {}) {
  const env = normalizeEnvBundle(payload);
  return {
    ok: Object.keys(env).length > 0,
    mode: 'projection_discovery',
    provider: 'env_bundle',
    resources: {
      envKeys: Object.keys(env).sort(),
      preview: Object.fromEntries(Object.entries(env).map(([key, value]) => [key, maskValue(value)]))
    }
  };
}

export async function discoverProviderResources(profile, payload = {}, options = {}) {
  const provider = normalizeProvider(profile?.provider || options.provider);
  const capabilities = Array.isArray(profile?.capabilities) && profile.capabilities.length ? profile.capabilities : inferProviderCapabilities(provider, payload);
  const accountHints = buildProviderAccountHints(provider, payload);
  let discovery = null;
  switch (provider) {
    case 'neon': discovery = await discoverNeonResources(payload, options); break;
    case 'cloudflare': discovery = await discoverCloudflareResources(payload, options); break;
    case 'netlify': discovery = await discoverNetlifyResources(payload, options); break;
    case 'github': discovery = await discoverGitHubResources(payload, options); break;
    case 'env_bundle': discovery = await discoverEnvBundleResources(payload, options); break;
    default: throw new Error(`No provider discovery driver is available for '${provider}'.`);
  }
  return {
    ok: Boolean(discovery?.ok),
    provider,
    capabilities,
    accountHints,
    discovery,
    suggestedBindingRoles: getProviderDefinition(provider).defaultBindingRoles || []
  };
}

export function getProviderDefinition(provider) { return PROVIDER_DEFINITIONS[normalizeProvider(provider)]; }

export function getProviderCatalog() {
  return {
    providers: Object.values(PROVIDER_DEFINITIONS).map(def => ({
      provider: def.provider,
      label: def.label,
      description: def.description,
      defaultCapabilities: [...def.defaultCapabilities],
      defaultBindingRoles: [...def.defaultBindingRoles],
      connectionChecks: [...def.connectionChecks],
      fields: def.fields.map(field => ({ key: field.key, label: field.label, secret: Boolean(field.secret), required: Boolean(field.required), multiline: Boolean(field.multiline), placeholder: field.placeholder || '' }))
    }))
  };
}

export function validateProviderPayload(provider, payload = {}) {
  const kind = normalizeProvider(provider);
  const source = ensureObject(payload, 'provider payload');
  const errors = [];
  const requireField = field => { const value = readString(source[field]); if (!value) errors.push(`Missing required field '${field}'.`); return value; };
  switch (kind) {
    case 'neon': {
      const databaseUrl = requireField('databaseUrl');
      if (databaseUrl && !/^postgres(ql)?:\/\//i.test(databaseUrl)) errors.push('neon.databaseUrl must look like a postgres connection string.');
      if (source.projectId && !looksLikeUuid(source.projectId) && readString(source.projectId).length < 6) errors.push('neon.projectId should look like a real project identifier.');
      break;
    }
    case 'cloudflare': {
      const apiToken = requireField('apiToken');
      const accountId = requireField('accountId');
      if (apiToken && !looksLikeToken(apiToken)) errors.push('cloudflare.apiToken is too short to be a real token.');
      if (accountId && readString(accountId).length < 8) errors.push('cloudflare.accountId looks too short.');
      break;
    }
    case 'netlify': {
      const authToken = requireField('authToken');
      const siteId = requireField('siteId');
      if (authToken && !looksLikeToken(authToken)) errors.push('netlify.authToken is too short to be a real token.');
      if (siteId && readString(siteId).length < 8) errors.push('netlify.siteId looks too short.');
      break;
    }
    case 'github': {
      const token = requireField('token');
      const owner = requireField('owner');
      const repo = requireField('repo');
      if (token && !looksLikeToken(token)) errors.push('github.token is too short to be a real token.');
      if (owner && !looksLikeGithubName(owner)) errors.push('github.owner contains invalid characters.');
      if (repo && !looksLikeGithubName(repo)) errors.push('github.repo contains invalid characters.');
      break;
    }
    case 'env_bundle': {
      const env = normalizeEnvBundle(source);
      if (!Object.keys(env).length) errors.push('env_bundle.env must contain at least one environment variable.');
      break;
    }
  }
  return { ok: errors.length === 0, provider: kind, errors };
}

export function inferProviderCapabilities(provider, payload = {}) {
  const kind = normalizeProvider(provider);
  const env = kind === 'env_bundle' ? normalizeEnvBundle(payload) : null;
  switch (kind) {
    case 'neon': return ['database', 'storage'];
    case 'cloudflare': return ['worker_runtime', 'object_storage', 'deploy', 'preview'];
    case 'netlify': return ['site_runtime', 'deploy', 'preview'];
    case 'github': return ['scm'];
    case 'env_bundle': {
      const capabilities = new Set(['runtime']);
      if (env.DATABASE_URL || env.POSTGRES_URL) capabilities.add('database');
      if (env.CLOUDFLARE_API_TOKEN) capabilities.add('worker_runtime');
      if (env.CLOUDFLARE_R2_BUCKET) capabilities.add('object_storage');
      if (env.NETLIFY_AUTH_TOKEN) capabilities.add('site_runtime');
      if (env.GITHUB_TOKEN) capabilities.add('scm');
      if (env.NETLIFY_AUTH_TOKEN || env.CLOUDFLARE_API_TOKEN) capabilities.add('deploy');
      if (env.NETLIFY_AUTH_TOKEN || env.CLOUDFLARE_API_TOKEN) capabilities.add('preview');
      return [...capabilities];
    }
    default: return [];
  }
}

export function buildProviderAccountHints(provider, payload = {}) {
  const kind = normalizeProvider(provider);
  switch (kind) {
    case 'neon': return { projectId: maskValue(payload.projectId || payload.project || ''), databaseName: readString(payload.databaseName || payload.database || '') || null, databaseUrl: maskValue(payload.databaseUrl || '', { visiblePrefix: 12, visibleSuffix: 8 }) };
    case 'cloudflare': return { accountId: maskValue(payload.accountId || ''), zoneId: maskValue(payload.zoneId || ''), workerName: readString(payload.workerName || '') || null, r2Bucket: readString(payload.r2Bucket || '') || null, apiBaseUrl: readString(payload.apiBaseUrl || '') || null };
    case 'netlify': return { siteId: maskValue(payload.siteId || ''), teamSlug: readString(payload.teamSlug || '') || null, siteName: readString(payload.siteName || '') || null, apiBaseUrl: readString(payload.apiBaseUrl || '') || null };
    case 'github': return { owner: readString(payload.owner || '') || null, repo: readString(payload.repo || '') || null, installationId: maskValue(payload.installationId || ''), branch: readString(payload.branch || '') || null, apiBaseUrl: readString(payload.apiBaseUrl || '') || null };
    case 'env_bundle': { const env = normalizeEnvBundle(payload); return { envKeys: Object.keys(env).sort(), labeledName: readString(payload.bundleName || payload.name || '') || null }; }
    default: return {};
  }
}

export function buildProviderEnvProjection(provider, payload = {}, options = {}) {
  const kind = normalizeProvider(provider);
  const capability = readString(options.capability).toLowerCase() || null;
  const action = readString(options.action).toLowerCase() || null;
  const env = {};
  if (kind === 'neon') {
    const wants = !capability || capability === 'database' || capability === 'storage' || action === 'db_connect' || action === 'provider_runtime_execution';
    if (wants) Object.assign(env, envForKeys(payload, [['databaseUrl','DATABASE_URL'],['projectId','NEON_PROJECT_ID'],['databaseName','NEON_DATABASE_NAME']]));
  }
  if (kind === 'cloudflare') {
    const wants = !capability || ['worker_runtime','object_storage','deploy','preview'].includes(capability) || ['worker_deploy','object_storage','preview_deploy','provider_runtime_execution'].includes(action);
    if (wants) {
      Object.assign(env, envForKeys(payload, [['apiToken','CLOUDFLARE_API_TOKEN'],['accountId','CLOUDFLARE_ACCOUNT_ID']]));
      if (action === 'worker_deploy' || capability === 'worker_runtime' || action === 'provider_runtime_execution') Object.assign(env, envForKeys(payload, [['workerName','CLOUDFLARE_WORKER_NAME']]));
      if (action === 'object_storage' || capability === 'object_storage') Object.assign(env, envForKeys(payload, [['r2Bucket','CLOUDFLARE_R2_BUCKET']]));
      if (action === 'preview_deploy' || capability === 'preview') Object.assign(env, envForKeys(payload, [['zoneId','CLOUDFLARE_ZONE_ID']]));
      if (payload.apiBaseUrl) Object.assign(env, envForKeys(payload, [['apiBaseUrl', 'CLOUDFLARE_API_BASE_URL']]));
    }
  }
  if (kind === 'netlify') {
    const wants = !capability || ['site_runtime','deploy','preview'].includes(capability) || ['site_deploy','preview_deploy','provider_runtime_execution'].includes(action);
    if (wants) {
      Object.assign(env, envForKeys(payload, [['authToken','NETLIFY_AUTH_TOKEN'],['siteId','NETLIFY_SITE_ID']]));
      if (action === 'site_deploy' || capability === 'site_runtime' || action === 'provider_runtime_execution') Object.assign(env, envForKeys(payload, [['teamSlug','NETLIFY_TEAM_SLUG'],['siteName','NETLIFY_SITE_NAME']]));
      if (payload.apiBaseUrl) Object.assign(env, envForKeys(payload, [['apiBaseUrl', 'NETLIFY_API_BASE_URL']]));
    }
  }
  if (kind === 'github') {
    const wants = !capability || capability === 'scm' || action === 'scm_sync' || action === 'provider_runtime_execution';
    if (wants) {
      Object.assign(env, envForKeys(payload, [['token','GITHUB_TOKEN'],['owner','GITHUB_OWNER'],['repo','GITHUB_REPO'],['branch','GITHUB_BRANCH']]));
      if (payload.apiBaseUrl) Object.assign(env, envForKeys(payload, [['apiBaseUrl', 'GITHUB_API_BASE_URL']]));
    }
  }
  if (kind === 'env_bundle') {
    const sourceEnv = normalizeEnvBundle(payload);
    if (!action || action === 'provider_runtime_execution' || !capability || capability === 'runtime') Object.assign(env, sourceEnv);
    else if (action === 'db_connect') { if (sourceEnv.DATABASE_URL) env.DATABASE_URL = sourceEnv.DATABASE_URL; if (sourceEnv.POSTGRES_URL) env.POSTGRES_URL = sourceEnv.POSTGRES_URL; }
    else if (action === 'worker_deploy') ['CLOUDFLARE_API_TOKEN','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_WORKER_NAME','CLOUDFLARE_R2_BUCKET','CLOUDFLARE_API_BASE_URL'].forEach(k => { if (sourceEnv[k]) env[k] = sourceEnv[k]; });
    else if (action === 'site_deploy' || action === 'preview_deploy') ['NETLIFY_AUTH_TOKEN','NETLIFY_SITE_ID','NETLIFY_TEAM_SLUG','NETLIFY_SITE_NAME','NETLIFY_API_BASE_URL'].forEach(k => { if (sourceEnv[k]) env[k] = sourceEnv[k]; });
    else if (action === 'scm_sync') ['GITHUB_TOKEN','GITHUB_OWNER','GITHUB_REPO','GITHUB_BRANCH','GITHUB_API_BASE_URL'].forEach(k => { if (sourceEnv[k]) env[k] = sourceEnv[k]; });
  }
  return env;
}

export function getProviderOutboundNetworkPolicy(env = process.env) {
  return describeOutboundNetworkPolicy(getOutboundNetworkPolicy(env));
}

export function buildProviderConnectionPlan(profile, payload = {}, options = {}) {
  const provider = normalizeProvider(profile?.provider || options.provider);
  const definition = getProviderDefinition(provider);
  const capability = readString(options.capability).toLowerCase() || null;
  const action = readString(options.action).toLowerCase() || null;
  let transport = 'protocol';
  let probeTarget = null;
  if (provider === 'neon') { const c = parsePostgresUrl(readString(payload.databaseUrl), readString(payload.databaseName)); transport = 'postgres'; probeTarget = `${c.host}:${c.port}/${c.database}`; }
  if (provider === 'cloudflare') { transport = 'https'; probeTarget = joinUrl(getCloudflareBaseUrl(payload), `/client/v4/accounts/${encodeURIComponent(readString(payload.accountId || 'account'))}`); }
  if (provider === 'netlify') { transport = 'https'; probeTarget = joinUrl(getNetlifyBaseUrl(payload), `/api/v1/sites/${encodeURIComponent(readString(payload.siteId || 'site'))}`); }
  if (provider === 'github') { transport = 'https'; probeTarget = joinUrl(getGitHubBaseUrl(payload), `/repos/${encodeURIComponent(readString(payload.owner || 'owner'))}/${encodeURIComponent(readString(payload.repo || 'repo'))}`); }
  if (provider === 'env_bundle') { transport = 'projection'; probeTarget = 'env_bundle_projection'; }
  return { provider, label: definition.label, mode: 'driver-plan', networkRequired: provider !== 'env_bundle', capability: capability || null, action: action || null, transport, probeTarget, checks: definition.connectionChecks.map((m, i) => ({ step: i + 1, message: m })) };
}

export function buildProviderRuntimeActionPlan(profile, payload = {}, options = {}) {
  const provider = normalizeProvider(profile?.provider || options.provider);
  const action = readString(options.action || 'provider_runtime_execution').toLowerCase() || 'provider_runtime_execution';
  const capability = readString(options.capability).toLowerCase() || null;
  const env = buildProviderEnvProjection(provider, payload, { capability, action });
  const alias = readString(profile?.alias || options.alias || provider);
  return { provider, alias, action, capability: capability || null, selectedLane: 'user-owned', founderFallback: false, envKeys: Object.keys(env).sort(), commandHints: { db_connect: 'Run a real provider-owned database connectivity probe against the projected database lane only.', worker_deploy: 'Run a real Cloudflare capability probe against the projected worker lane only.', site_deploy: 'Run a real Netlify site capability probe against the projected site lane only.', preview_deploy: 'Run a real preview/site capability probe against the projected preview lane only.', scm_sync: 'Run a real GitHub repo/auth capability probe against the projected SCM lane only.', object_storage: 'Run a real object-storage capability probe against the projected storage lane only.', provider_runtime_execution: 'Use the selected workspace-bound provider projection with no founder fallback.' }[action] || 'Use the selected provider projection for the requested workspace action.', preview: Object.fromEntries(Object.entries(env).map(([k, v]) => [k, maskValue(v)])) };
}

export async function testProviderConnection(profile, payload = {}, options = {}) {
  const provider = profile?.provider || options.provider;
  const validation = validateProviderPayload(provider, payload);
  const capabilities = Array.isArray(profile?.capabilities) && profile.capabilities.length ? profile.capabilities : inferProviderCapabilities(provider, payload);
  const projectedEnv = buildProviderEnvProjection(provider, payload, { capability: options.capability || null, action: options.action || null });
  const connectionPlan = buildProviderConnectionPlan(profile, payload, options);
  const actionPlan = buildProviderRuntimeActionPlan(profile, payload, options);
  if (!validation.ok) {
    return { ok: false, provider: validation.provider, mode: 'offline_validation_only', errors: validation.errors, capabilities, projectedEnvKeys: Object.keys(projectedEnv).sort(), accountHints: buildProviderAccountHints(validation.provider, payload), connectionPlan, actionPlan, credentialDiagnostics: { requiredFieldsPresent: false, malformedFieldCount: validation.errors.length } };
  }
  try {
    const verification = await verifyProviderCapability(validation.provider, payload, options);
    return { ok: Boolean(verification.ok), provider: validation.provider, mode: verification.mode, errors: [], capabilities, projectedEnvKeys: Object.keys(projectedEnv).sort(), accountHints: buildProviderAccountHints(validation.provider, payload), connectionPlan, actionPlan, verification, credentialDiagnostics: { requiredFieldsPresent: true, malformedFieldCount: 0 } };
  } catch (error) {
    return { ok: false, provider: validation.provider, mode: 'live_probe_failed', errors: [safeError(error)], capabilities, projectedEnvKeys: Object.keys(projectedEnv).sort(), accountHints: buildProviderAccountHints(validation.provider, payload), connectionPlan, actionPlan, verification: { ok: false, provider: validation.provider, mode: 'live_probe_failed', summary: { error: safeError(error) } }, credentialDiagnostics: { requiredFieldsPresent: true, malformedFieldCount: 0 } };
  }
}
