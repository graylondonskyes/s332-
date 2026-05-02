import http from 'http';
import crypto from 'crypto';
import { createProofStorageAdapter, signS3Request } from '../src/adapters/proof-storage.js';

function assert(cond, msg, data) {
  if (!cond) {
    const err = new Error(msg);
    err.data = data;
    throw err;
  }
}

function sha256(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

const objects = new Map();
const requests = [];
const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const key = decodeURIComponent(new URL(req.url, 'http://receiver.local').pathname.replace(/^\/[^/]+\//, ''));
  requests.push({ method: req.method, url: req.url, headers: req.headers, key, body_sha256: sha256(body) });

  if (req.method === 'PUT') {
    objects.set(key, {
      body,
      contentType: req.headers['content-type'],
      sha256: req.headers['x-amz-meta-sha256']
    });
    res.writeHead(200, { etag: `"${sha256(body).slice(0, 32)}"` });
    return res.end();
  }

  if (req.method === 'HEAD') {
    const object = objects.get(key);
    if (!object) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, {
      'content-length': String(object.body.length),
      'x-amz-meta-sha256': object.sha256,
      'content-type': object.contentType || 'application/octet-stream'
    });
    return res.end();
  }

  res.writeHead(405);
  res.end();
});

const proof = { started_at: new Date().toISOString(), checks: [] };
const pass = (name, data = {}) => proof.checks.push({ status: 'PASS', name, data });

try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}`;

  try {
    createProofStorageAdapter({ root: process.cwd(), env: { STORAGE_DRIVER: 's3-compatible' } });
    assert(false, 'missing S3 env was accepted');
  } catch (err) {
    assert(String(err.message).includes('STORAGE_ENDPOINT') && String(err.message).includes('STORAGE_SECRET_ACCESS_KEY'), 'required env error did not name missing keys', err.message);
    pass('required_env_validation_fails_closed');
  }

  const fixed = new Date('2026-05-01T00:00:00.000Z');
  const signedA = signS3Request({
    method: 'PUT',
    url: `${endpoint}/skye-proof/proof-media/prf_fixed.txt`,
    headers: { 'content-type': 'text/plain', 'x-amz-meta-sha256': sha256('fixed') },
    body: Buffer.from('fixed'),
    accessKeyId: 'AKIA_TEST',
    secretAccessKey: 'secret-test-key',
    region: 'auto',
    now: fixed
  });
  const signedB = signS3Request({
    method: 'PUT',
    url: `${endpoint}/skye-proof/proof-media/prf_fixed.txt`,
    headers: { 'content-type': 'text/plain', 'x-amz-meta-sha256': sha256('fixed') },
    body: Buffer.from('fixed'),
    accessKeyId: 'AKIA_TEST',
    secretAccessKey: 'secret-test-key',
    region: 'auto',
    now: fixed
  });
  assert(signedA.signature === signedB.signature && signedA.canonicalRequest === signedB.canonicalRequest, 'SigV4 signing was not deterministic');
  assert(signedA.headers.authorization.includes('Credential=AKIA_TEST/20260501/auto/s3/aws4_request'), 'SigV4 credential scope missing expected date/region/service', signedA.headers.authorization);
  pass('sigv4_signing_is_deterministic', { signature: signedA.signature, signed_headers: signedA.signedHeaders });

  const adapter = createProofStorageAdapter({
    root: process.cwd(),
    env: {
      STORAGE_DRIVER: 'r2',
      STORAGE_ENDPOINT: endpoint,
      STORAGE_BUCKET: 'skye-proof',
      STORAGE_REGION: 'auto',
      STORAGE_ACCESS_KEY_ID: 'AKIA_TEST',
      STORAGE_SECRET_ACCESS_KEY: 'secret-test-key',
      STORAGE_PREFIX: 'smoke'
    }
  });

  const media = await adapter.storeProofMedia({
    proofId: 'prf_smoke',
    body: { media_base64: Buffer.from('object proof smoke').toString('base64'), media_ext: 'txt', media_mime: 'text/plain' },
    id: prefix => `${prefix}_smoke`,
    now: () => '2026-05-01T00:00:00.000Z'
  });
  assert(media.storage_driver === 'r2' && media.object_key === 'smoke/proof-media/prf_smoke.txt', 'media object key/driver mismatch', media);
  assert(media.sha256 === sha256('object proof smoke') && media.byte_size === Buffer.byteLength('object proof smoke'), 'media hash/bytes mismatch', media);
  pass('proof_media_put_uses_object_storage', { object_key: media.object_key, sha256: media.sha256 });

  const integrity = await adapter.verifyProofMedia(media);
  assert(integrity.ok && integrity.actual_sha256 === media.sha256, 'HEAD integrity check failed', integrity);
  pass('head_integrity_verifies_bytes_and_sha256', integrity);

  const exported = await adapter.writeJsonExport('packet.json', { ok: true, at: 'fixed' });
  assert(exported.path === 's3://skye-proof/smoke/exports/packet.json' && exported.sha256, 'json export object write failed', exported);
  pass('json_export_put_uses_object_storage', exported);

  const putRequests = requests.filter(r => r.method === 'PUT');
  const headRequests = requests.filter(r => r.method === 'HEAD');
  assert(putRequests.length === 2 && headRequests.length === 1, 'unexpected receiver request count', requests);
  assert(putRequests.every(r => String(r.headers.authorization || '').startsWith('AWS4-HMAC-SHA256')), 'PUT request missing SigV4 authorization', putRequests);
  assert(headRequests[0].headers['x-amz-date'], 'HEAD request missing x-amz-date', headRequests[0]);
  pass('local_receiver_observed_signed_put_and_head', { request_count: requests.length });

  proof.completed_at = new Date().toISOString();
  proof.status = 'PASS';
  console.log(JSON.stringify(proof, null, 2));
} catch (err) {
  proof.failed_at = new Date().toISOString();
  proof.status = 'FAIL';
  proof.failure = err.message;
  proof.data = err.data || null;
  console.error(JSON.stringify(proof, null, 2));
  process.exitCode = 1;
} finally {
  await new Promise(resolve => server.close(resolve));
}
