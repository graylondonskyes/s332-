import assert from 'node:assert/strict';
import { appFetch } from '../src/index.ts';

async function request(path, { method = 'GET', body } = {}) {
  const headers = new Headers({ 'x-org-id': 'truth_org' });
  if (body) headers.set('content-type', 'application/json');
  const response = await appFetch(new Request(`https://truth.local${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), { DB_MODE: 'memory' });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}

const capability = await request('/v1/capabilities');
assert.equal(capability.status, 200);
assert.equal(capability.data.ok, true);
assert.equal(capability.data.summary.modules >= 8, true);
assert.equal(capability.data.purpose.principles.length >= 4, true);
assert.equal(capability.data.modules.some((item) => item.id === 'truth'), true);

const walkthroughs = await request('/v1/walkthroughs');
assert.equal(walkthroughs.status, 200);
assert.equal(walkthroughs.data.ok, true);
assert.equal(walkthroughs.data.walkthroughs.length, capability.data.summary.modules);
assert.equal(walkthroughs.data.walkthroughs.every((item) => Array.isArray(item.steps) && item.steps.length >= 2), true);

const validation = await request('/v1/truth/validate', { method: 'POST', body: { mode: 'real-only' } });
assert.equal(validation.status, 200);
assert.equal(validation.data.ok, true);
assert.equal(validation.data.validation.ok, true);
assert.equal(validation.data.validation.checkedModules, capability.data.summary.modules);
assert.equal(validation.data.validation.issues.length, 0);
assert.equal(validation.data.validation.checkedRoutes >= 15, true);
assert.equal(validation.data.validation.checkedControls >= 15, true);

console.log(JSON.stringify({
  ok: true,
  checks: [
    'purpose narrative endpoint',
    'walkthrough endpoint',
    'no-theater validator endpoint'
  ],
  summary: {
    modules: capability.data.summary.modules,
    walkthroughSteps: capability.data.summary.walkthroughSteps,
    checkedRoutes: validation.data.validation.checkedRoutes,
    checkedControls: validation.data.validation.checkedControls
  }
}, null, 2));
