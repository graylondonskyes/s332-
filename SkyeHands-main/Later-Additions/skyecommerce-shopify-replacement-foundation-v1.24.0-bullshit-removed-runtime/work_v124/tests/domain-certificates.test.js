import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCloudflareCustomHostnameRequest, executeCloudflareCertificateRequest, extractCloudflareCertificateResult, verifyDnsTxtRecord } from '../src/lib/domain-certificates.js';

test('cloudflare custom hostname request and certificate result normalize validation records', async () => {
  const spec = buildCloudflareCustomHostnameRequest({ id: 'dom_1', merchantId: 'm1', hostname: 'store.example.com' }, { zoneId: 'zone_1' });
  assert.equal(spec.url, 'https://api.cloudflare.com/client/v4/zones/zone_1/custom_hostnames');
  assert.equal(spec.body.hostname, 'store.example.com');
  const parsed = extractCloudflareCertificateResult({ result: { id: 'host_1', ssl: { status: 'pending_validation', validation_records: [{ txt_name: '_acme-challenge.store.example.com', txt_value: 'abc' }] } } });
  assert.equal(parsed.externalHostnameId, 'host_1');
  assert.equal(parsed.validationRecords[0].type, 'TXT');
  const executed = await executeCloudflareCertificateRequest(spec, { CLOUDFLARE_API_TOKEN: 'cf', CLOUDFLARE_ZONE_ID: 'zone_1' }, { fetcher: async () => new Response(JSON.stringify({ result: { id: 'host_1', ssl: { status: 'active' } } }), { status: 200 }) });
  assert.equal(executed.status, 'executed');
});


test('live DNS TXT verification requires resolver-confirmed TXT answers', async () => {
  const pass = await verifyDnsTxtRecord({ recordName: '_skyecommerce.store.example.com', expectedValue: 'skyecommerce-domain=abc123' }, {}, {
    fetcher: async () => new Response(JSON.stringify({ Answer: [{ type: 16, data: '"skyecommerce-domain=abc123"' }] }), { status: 200 })
  });
  assert.equal(pass.verified, true);
  const fail = await verifyDnsTxtRecord({ recordName: '_skyecommerce.store.example.com', expectedValue: 'skyecommerce-domain=abc123' }, {}, {
    fetcher: async () => new Response(JSON.stringify({ Answer: [{ type: 16, data: '"wrong"' }] }), { status: 200 })
  });
  assert.equal(fail.verified, false);
});
