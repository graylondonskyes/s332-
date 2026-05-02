import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const S3_DRIVERS = ['s3-compatible', 'r2'];

function safeFileName(name) {
  return String(name).replace(/[^a-z0-9_.-]+/gi, '_');
}

function unsupportedStorageAdapter(driver) {
  throw new Error(`STORAGE_DRIVER=${driver} is unsupported. Use local-json, s3-compatible, or r2.`);
}

function sha256Hex(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding);
}

function amzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function encodePathPart(part) {
  return encodeURIComponent(part).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalUri(pathname) {
  return pathname.split('/').map(encodePathPart).join('/').replace(/%2F/g, '/');
}

function canonicalQuery(searchParams) {
  return [...searchParams.entries()]
    .sort(([ak, av], [bk, bv]) => ak === bk ? av.localeCompare(bv) : ak.localeCompare(bk))
    .map(([key, value]) => `${encodePathPart(key)}=${encodePathPart(value)}`)
    .join('&');
}

function normalizeHeaderValue(value) {
  return String(value).trim().replace(/\s+/g, ' ');
}

function signingKey(secretAccessKey, dateStamp, region, service) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

export function signS3Request({ method, url, headers = {}, body = Buffer.alloc(0), accessKeyId, secretAccessKey, region, service = 's3', now = new Date() }) {
  const u = new URL(url);
  const payloadHash = headers['x-amz-content-sha256'] || headers['X-Amz-Content-Sha256'] || sha256Hex(body);
  const requestHeaders = { ...headers, host: u.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate(now) };
  const sortedHeaderNames = Object.keys(requestHeaders).map(k => k.toLowerCase()).sort();
  const canonicalHeaders = sortedHeaderNames.map(name => `${name}:${normalizeHeaderValue(requestHeaders[Object.keys(requestHeaders).find(k => k.toLowerCase() === name)])}\n`).join('');
  const signedHeaders = sortedHeaderNames.join(';');
  const dateStamp = requestHeaders['x-amz-date'].slice(0, 8);
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri(u.pathname || '/'),
    canonicalQuery(u.searchParams),
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', requestHeaders['x-amz-date'], scope, sha256Hex(canonicalRequest)].join('\n');
  const signature = hmac(signingKey(secretAccessKey, dateStamp, region, service), stringToSign, 'hex');
  return {
    headers: {
      ...requestHeaders,
      authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    },
    canonicalRequest,
    stringToSign,
    signature,
    signedHeaders
  };
}

function requireEnv(env, names) {
  const missing = names.filter(name => !env[name]);
  if (missing.length) throw new Error(`STORAGE_DRIVER=${env.STORAGE_DRIVER} requires ${missing.join(', ')}.`);
}

function s3Config(env) {
  requireEnv(env, ['STORAGE_ENDPOINT', 'STORAGE_BUCKET', 'STORAGE_REGION', 'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY']);
  return {
    endpoint: env.STORAGE_ENDPOINT.replace(/\/+$/, ''),
    bucket: env.STORAGE_BUCKET,
    region: env.STORAGE_REGION,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    prefix: String(env.STORAGE_PREFIX || '').replace(/^\/+|\/+$/g, ''),
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE !== '0'
  };
}

function objectKey(config, kind, name) {
  return [config.prefix, kind, safeFileName(name)].filter(Boolean).join('/');
}

function objectUrl(config, key) {
  const endpoint = new URL(config.endpoint);
  if (config.forcePathStyle) {
    endpoint.pathname = [endpoint.pathname.replace(/\/+$/g, ''), config.bucket, ...key.split('/').map(encodePathPart)].filter(Boolean).join('/');
    return endpoint.toString();
  }
  endpoint.hostname = `${config.bucket}.${endpoint.hostname}`;
  endpoint.pathname = [endpoint.pathname.replace(/\/+$/g, ''), ...key.split('/').map(encodePathPart)].filter(Boolean).join('/');
  return endpoint.toString();
}

async function s3Request(config, method, key, body, headers = {}) {
  const url = objectUrl(config, key);
  const raw = body ? Buffer.from(body) : Buffer.alloc(0);
  const signed = signS3Request({ method, url, headers, body: raw, accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, region: config.region });
  const res = await fetch(url, { method, headers: signed.headers, body: method === 'HEAD' ? undefined : raw });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Object storage ${method} ${key} failed with HTTP ${res.status}${text ? `: ${text.slice(0, 300)}` : ''}`);
  }
  return res;
}

function s3ProofStorageAdapter({ driver, env }) {
  const config = s3Config({ ...env, STORAGE_DRIVER: driver });
  return {
    driver,
    bucket: config.bucket,
    endpoint: config.endpoint,
    prefix: config.prefix,
    async putObject({ kind, name, body, contentType, metadata = {} }) {
      const raw = Buffer.from(body);
      const sha256 = sha256Hex(raw);
      const key = objectKey(config, kind, name);
      const headers = {
        'content-type': contentType || 'application/octet-stream',
        'content-length': String(raw.length),
        'x-amz-meta-sha256': sha256,
        ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [`x-amz-meta-${String(k).toLowerCase().replace(/[^a-z0-9-]+/g, '-')}`, String(v)]))
      };
      await s3Request(config, 'PUT', key, raw, headers);
      return { key, storage_path: `s3://${config.bucket}/${key}`, byte_size: raw.length, sha256 };
    },
    async headObject(key) {
      const res = await s3Request(config, 'HEAD', key, null);
      return {
        byte_size: Number(res.headers.get('content-length') || 0),
        sha256: res.headers.get('x-amz-meta-sha256') || null,
        etag: res.headers.get('etag') || null
      };
    },
    async storeProofMedia({ proofId, body, id, now }) {
      if (!body.media_base64) return null;
      const raw = Buffer.from(String(body.media_base64), 'base64');
      if (raw.length > 10 * 1024 * 1024) throw new Error('Proof media exceeds 10MB object-storage limit.');
      const ext = String(body.media_ext || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
      const put = await this.putObject({
        kind: 'proof-media',
        name: `${proofId}.${ext}`,
        body: raw,
        contentType: body.media_mime || 'application/octet-stream',
        metadata: { proof_id: proofId }
      });
      return {
        id: id('med'),
        proof_id: proofId,
        storage_driver: driver,
        storage_path: put.storage_path,
        object_key: put.key,
        bucket: config.bucket,
        byte_size: put.byte_size,
        sha256: put.sha256,
        mime_type: body.media_mime || 'application/octet-stream',
        created_at: now()
      };
    },
    async writeJsonExport(name, payload) {
      const raw = JSON.stringify(payload, null, 2);
      const put = await this.putObject({ kind: 'exports', name, body: raw, contentType: 'application/json; charset=utf-8' });
      return { path: put.storage_path, object_key: put.key, byte_size: put.byte_size, sha256: put.sha256 };
    },
    async verifyProofMedia(media) {
      if (!media?.object_key) return { ok: false, id: media?.id || null, reason: 'missing_object_key' };
      const head = await this.headObject(media.object_key);
      return {
        ok: head.byte_size === media.byte_size && head.sha256 === media.sha256,
        id: media.id,
        storage_path: media.storage_path,
        object_key: media.object_key,
        expected_bytes: media.byte_size,
        actual_bytes: head.byte_size,
        expected_sha256: media.sha256 || null,
        actual_sha256: head.sha256
      };
    },
    status() {
      return { driver: this.driver, bucket: this.bucket, endpoint: this.endpoint, prefix: this.prefix || null };
    }
  };
}

function localProofStorageAdapter({ mediaRoot, exportRoot, driver }) {
  fs.mkdirSync(mediaRoot, { recursive: true });
  fs.mkdirSync(exportRoot, { recursive: true });
  return {
    driver,
    mediaRoot,
    exportRoot,
    storeProofMedia({ proofId, body, id, now }) {
      if (!body.media_base64) return null;
      const raw = Buffer.from(String(body.media_base64), 'base64');
      if (raw.length > 2 * 1024 * 1024) throw new Error('Proof media exceeds 2MB local limit.');
      const ext = String(body.media_ext || 'txt').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'txt';
      const file = path.join(mediaRoot, `${proofId}.${ext}`);
      fs.writeFileSync(file, raw);
      return {
        id: id('med'),
        proof_id: proofId,
        storage_driver: driver,
        storage_path: file,
        byte_size: raw.length,
        sha256: sha256Hex(raw),
        mime_type: body.media_mime || 'application/octet-stream',
        created_at: now()
      };
    },
    writeJsonExport(name, payload) {
      const file = path.join(exportRoot, safeFileName(name));
      const raw = JSON.stringify(payload, null, 2);
      fs.writeFileSync(file, raw);
      return { path: file, byte_size: Buffer.byteLength(raw), sha256: sha256Hex(raw) };
    },
    verifyProofMedia(media) {
      if (!media?.storage_path || !fs.existsSync(media.storage_path)) return { ok: false, id: media?.id || null, reason: 'missing_file' };
      const raw = fs.readFileSync(media.storage_path);
      const sha256 = sha256Hex(raw);
      return {
        ok: raw.length === media.byte_size && sha256 === media.sha256,
        id: media.id,
        storage_path: media.storage_path,
        expected_bytes: media.byte_size,
        actual_bytes: raw.length,
        expected_sha256: media.sha256 || null,
        actual_sha256: sha256
      };
    },
    status() {
      return { driver: this.driver, media_root: this.mediaRoot, export_root: this.exportRoot };
    }
  };
}

export function createProofStorageAdapter({ root, env = process.env } = {}) {
  const driver = env.STORAGE_DRIVER || 'local-json';
  const mediaRoot = path.resolve(env.MEDIA_ROOT || path.join(root, 'data', 'proof-media'));
  const exportRoot = path.resolve(env.EXPORT_ROOT || path.join(root, 'data', 'exports'));
  if (driver === 'local-json' || driver === 'local-files') return localProofStorageAdapter({ mediaRoot, exportRoot, driver });
  if (S3_DRIVERS.includes(driver)) return s3ProofStorageAdapter({ driver, env });
  return unsupportedStorageAdapter(driver);
}
