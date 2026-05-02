import assert from 'node:assert/strict';
import { startTestServer } from './helpers/test-server.mjs';
import { launchChromiumCdp } from './helpers/chromium-cdp.mjs';
import { resetMemoryDbForTests } from '../src/lib/db.ts';
import { resetPlatformStore } from '../src/lib/platformStore.ts';

resetMemoryDbForTests();
resetPlatformStore();

const server = await startTestServer({ port: 8787, runtimeEnv: { DB_MODE: 'memory' } });
const browser = await launchChromiumCdp({ debuggingPort: 9333 });

try {
  const page = await browser.client.attachToNewPage(`${server.origin}/app?smoke=1`);
  const { sessionId } = page;

  const started = Date.now();
  let payload = null;
  while (Date.now() - started < 25000) {
    const result = await browser.client.send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.getElementById('browser-smoke-report');
        const controls = ['create-workspace','create-project','run-audit','run-research','create-brief','create-draft','execute-publish','run-replay','export-bundle','import-bundle','clone-bundle'];
        return {
          href: location.href,
          title: document.title,
          state: el?.dataset?.state || null,
          text: el?.textContent || '',
          controlsPresent: controls.every((id) => !!document.getElementById(id)),
          visibleSections: Array.from(document.querySelectorAll('section h2')).map((node) => node.textContent || '')
        };
      })()`,
      returnByValue: true,
      awaitPromise: true
    }, sessionId);
    payload = result?.result?.value || null;
    if (payload?.state === 'success' || payload?.state === 'error') break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  assert.ok(payload, 'Browser smoke did not produce a payload.');
  assert.equal(payload.controlsPresent, true, 'Expected operator controls to exist in the real browser DOM.');
  assert.equal(String(payload.href).includes('/app?smoke=1'), true, 'Browser did not land on the operator smoke page.');
  assert.ok(Array.isArray(payload.visibleSections) && payload.visibleSections.length >= 6, 'Expected visible operator sections in browser DOM.');
  assert.equal(payload.state, 'success', payload.text || 'Real browser smoke failed.');

  const report = JSON.parse(payload.text || '{}');
  assert.equal(report.ok, true);
  assert.ok(report.summary.workspaceId);
  assert.ok(report.summary.projectId);
  assert.ok(report.summary.publishRunId);
  assert.ok(report.summary.importedWorkspaceId);
  assert.ok(report.summary.clonedWorkspaceId);
  assert.equal(report.summary.publishStatus, 'success');

  console.log(JSON.stringify({
    ok: true,
    smoke: 'real-browser-ui',
    page: payload.href,
    controlsPresent: payload.controlsPresent,
    visibleSections: payload.visibleSections,
    summary: report.summary
  }, null, 2));
} finally {
  await browser.close();
  await server.close();
}
