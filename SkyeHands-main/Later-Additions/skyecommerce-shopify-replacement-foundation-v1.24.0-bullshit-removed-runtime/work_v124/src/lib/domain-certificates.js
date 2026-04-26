function text(value = '') { return String(value || '').trim(); }
function safeJson(value, fallback) { if (value && typeof value === 'object') return value; try { return JSON.parse(value || ''); } catch { return fallback; } }

export function buildCloudflareCustomHostnameRequest(domain = {}, options = {}) {
  const hostname = text(domain.hostname || domain.domain || '').toLowerCase();
  const zoneId = text(options.zoneId || '${CLOUDFLARE_ZONE_ID}');
  return {
    provider: 'cloudflare',
    action: 'custom_hostname_create',
    url: `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`,
    method: 'POST',
    requiredSecrets: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ZONE_ID'],
    body: {
      hostname,
      ssl: {
        method: 'txt',
        type: 'dv',
        settings: { http2: 'on', min_tls_version: '1.2', tls_1_3: 'on' }
      },
      custom_metadata: { merchantId: domain.merchantId || domain.merchant_id || '', domainId: domain.id || '' }
    }
  };
}

export function buildCloudflareCustomHostnameStatusRequest(externalHostnameId = '', options = {}) {
  const zoneId = text(options.zoneId || '${CLOUDFLARE_ZONE_ID}');
  return {
    provider: 'cloudflare',
    action: 'custom_hostname_status',
    url: `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${encodeURIComponent(text(externalHostnameId))}`,
    method: 'GET',
    requiredSecrets: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ZONE_ID']
  };
}

export function domainCertificateJobRecord(row = {}) {
  return {
    id: row.id || '',
    merchantId: row.merchant_id || row.merchantId || '',
    domainId: row.domain_id || row.domainId || '',
    provider: row.provider || 'cloudflare',
    externalHostnameId: row.external_hostname_id || row.externalHostnameId || '',
    status: row.status || 'pending',
    validationRecords: safeJson(row.validation_records_json || row.validationRecordsJson, []),
    result: safeJson(row.result_json || row.resultJson, {}),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || ''
  };
}

export function extractCloudflareCertificateResult(data = {}) {
  const result = data.result || data;
  const ssl = result.ssl || {};
  const records = [];
  const pushRecord = (item = {}) => {
    if (!item) return;
    const name = item.txt_name || item.name || item.cname_name || '';
    const value = item.txt_value || item.value || item.cname_target || '';
    if (name || value) records.push({ type: item.type || (item.txt_name ? 'TXT' : 'CNAME'), name, value });
  };
  if (Array.isArray(ssl.validation_records)) ssl.validation_records.forEach(pushRecord);
  pushRecord(ssl.validation_record);
  return {
    externalHostnameId: result.id || '',
    status: ssl.status || result.status || 'pending_validation',
    validationRecords: records,
    raw: data
  };
}


export function buildDnsTxtLookupRequest(recordName = '') {
  const name = text(recordName).replace(/\.$/, '');
  return {
    provider: 'dns',
    action: 'txt_lookup',
    url: `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
    method: 'GET',
    headers: { accept: 'application/dns-json' },
    recordName: name
  };
}

function normalizeTxtValue(value = '') {
  return text(value)
    .replace(/^TXT\s+/i, '')
    .replace(/^"|"$/g, '')
    .replace(/"\s+"/g, '')
    .trim();
}

function extractTxtAnswers(data = {}) {
  const answers = Array.isArray(data.Answer) ? data.Answer : [];
  return answers
    .filter((answer) => String(answer.type || '') === '16' || String(answer.type || '').toUpperCase() === 'TXT')
    .map((answer) => normalizeTxtValue(answer.data || answer.value || ''))
    .filter(Boolean);
}

export async function verifyDnsTxtRecord({ recordName = '', expectedValue = '' } = {}, env = {}, options = {}) {
  const expected = normalizeTxtValue(expectedValue);
  const spec = buildDnsTxtLookupRequest(recordName);
  if (!spec.recordName || !expected) {
    return { verified: false, status: 'invalid_request', recordName: spec.recordName, expectedValue: expected, answers: [], url: spec.url };
  }
  const fetcher = options.fetcher || fetch;
  const response = await fetcher(spec.url, { method: 'GET', headers: spec.headers });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  const answers = extractTxtAnswers(data);
  const verified = response.ok && answers.some((answer) => normalizeTxtValue(answer) === expected);
  return {
    verified,
    status: verified ? 'verified' : 'pending',
    httpStatus: response.status,
    recordName: spec.recordName,
    expectedValue: expected,
    answers,
    url: spec.url
  };
}

export async function executeCloudflareCertificateRequest(requestSpec = {}, env = {}, options = {}) {
  const token = env.CLOUDFLARE_API_TOKEN || env.vars?.CLOUDFLARE_API_TOKEN || '';
  const zoneId = env.CLOUDFLARE_ZONE_ID || env.vars?.CLOUDFLARE_ZONE_ID || '';
  const missing = [];
  if (!token) missing.push('CLOUDFLARE_API_TOKEN');
  if (!zoneId) missing.push('CLOUDFLARE_ZONE_ID');
  if (missing.length) {
    const error = new Error(`Missing Cloudflare secret(s): ${missing.join(', ')}`);
    error.code = 'CLOUDFLARE_SECRETS_MISSING';
    error.missing = missing;
    throw error;
  }
  const fetcher = options.fetcher || fetch;
  const url = requestSpec.url.replace('${CLOUDFLARE_ZONE_ID}', zoneId);
  const response = await fetcher(url, {
    method: requestSpec.method,
    headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'content-type': 'application/json' },
    body: requestSpec.method === 'GET' ? undefined : JSON.stringify(requestSpec.body || {})
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  const extracted = extractCloudflareCertificateResult(data);
  return { provider: 'cloudflare', action: requestSpec.action, status: response.ok ? 'executed' : 'failed', httpStatus: response.status, certificateStatus: extracted.status, ...extracted, status: response.ok ? 'executed' : 'failed' };
}
