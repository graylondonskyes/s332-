import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const skyeHandsRoot = path.resolve(repoRoot, '..', '..', '..', '..');
const browserRoot = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(skyeHandsRoot, '.ms-playwright');
const playwrightPackage = path.join(
  skyeHandsRoot,
  'Later-Additions',
  'DonorCode-MySkyeApps',
  'SuperIDEv3',
  'SuperIDEv3',
  'SuperIDEv2',
  'node_modules',
  'playwright'
);

if (!fs.existsSync(path.join(playwrightPackage, 'package.json'))) {
  throw new Error(`Playwright package not found at ${playwrightPackage}`);
}

process.env.PLAYWRIGHT_BROWSERS_PATH = browserRoot;
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(playwrightPackage, 'index.js'));

const baseUrl = process.argv[2] || 'http://127.0.0.1:8413';

async function withPage(browser, handler, options = {}) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();
  if (typeof options.block === 'function') {
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (options.block(url)) return route.abort();
      return route.continue();
    });
  }
  try {
    return await handler(page, context);
  } finally {
    await context.close();
  }
}

async function textContent(page, selector) {
  const handle = await page.locator(selector).first();
  return (await handle.textContent()) || '';
}

async function smokeState(page) {
  return page.evaluate(() => ({
    surface: document.body?.dataset.smokeSurface || '',
    ready: document.body?.dataset.smokeReady || '',
    mode: document.body?.dataset.runtimeMode || '',
    degradedBanner: Boolean(document.querySelector('[data-runtime-degraded], #runtime-degraded-banner, .runtime-degraded-banner'))
  }));
}

async function waitForSmokeReady(page, path) {
  await page.goto(`${baseUrl}${path}`, gotoOptions);
  await page.waitForFunction(() => document.body?.dataset.smokeReady === 'ready', null, { timeout: 12000 });
  return smokeState(page);
}

const browser = await chromium.launch({ headless: true });
const results = [];
const gotoOptions = { waitUntil: 'commit', timeout: 30000 };

try {
  await withPage(browser, async (page) => {
    await page.goto(`${baseUrl}/skAIxuide/login.html`, gotoOptions);
    await page.locator('#auth-status').waitFor({ state: 'attached' });
    const status = await textContent(page, '#auth-status');
    results.push({
      test: 'login-normal',
      ok: status.trim().length > 0,
      status: status.trim()
    });
  });

  await withPage(browser, async (page) => {
    await page.goto(`${baseUrl}/skAIxuide/login.html`, gotoOptions);
    await page.locator('#auth-status').waitFor({ state: 'attached' });
    await page.waitForTimeout(1000);
    const status = await textContent(page, '#auth-status');
    const help = await textContent(page, '#auth-help');
    results.push({
      test: 'login-degraded',
      ok: /did not load|unavailable/i.test(`${status} ${help}`),
      status: status.trim(),
      help: help.trim()
    });
  }, {
    block: (url) => url.includes('/vendor/netlify-identity/netlify-identity-widget.js')
  });

  await withPage(browser, async (page) => {
    const state = await waitForSmokeReady(page, '/index.html');
    const hasLauncherNav = await page.locator('#sidebar-links .sidebar-item').count();
    results.push({
      test: 'launcher-normal',
      ok: state.surface === 'launcher' && state.ready === 'ready' && /^(normal|degraded)$/.test(state.mode) && hasLauncherNav >= 4,
      state,
      nav_items: hasLauncherNav
    });
  });

  await withPage(browser, async (page) => {
    const state = await waitForSmokeReady(page, '/index.html');
    const hasLauncherNav = await page.locator('#sidebar-links .sidebar-item').count();
    results.push({
      test: 'launcher-degraded',
      ok: state.surface === 'launcher' && state.ready === 'ready' && state.mode === 'degraded' && hasLauncherNav >= 4,
      state,
      nav_items: hasLauncherNav
    });
  }, {
    block: (url) => url.includes('/vendor/three/three.min.js')
  });

  await withPage(browser, async (page) => {
    const state = await waitForSmokeReady(page, '/skAIxuide/index.html');
    const hasEditor = await page.locator('#code-editor').count();
    const hasFileTree = await page.locator('#file-tree').count();
    results.push({
      test: 'skaixuide-normal',
      ok: state.surface === 'skaixuide' && state.ready === 'ready' && state.mode === 'normal' && hasEditor === 1 && hasFileTree === 1,
      state,
      editor: hasEditor,
      file_tree: hasFileTree
    });
  });

  await withPage(browser, async (page) => {
    const state = await waitForSmokeReady(page, '/skAIxuide/index.html');
    const hasEditor = await page.locator('#code-editor').count();
    const hasFileTree = await page.locator('#file-tree').count();
    results.push({
      test: 'skaixuide-degraded',
      ok: state.surface === 'skaixuide' && state.ready === 'ready' && state.mode === 'degraded' && hasEditor === 1 && hasFileTree === 1,
      state,
      editor: hasEditor,
      file_tree: hasFileTree
    });
  }, {
    block: (url) => url.includes('/vendor/three/three.min.js')
  });
} finally {
  await browser.close();
}

const failures = results.filter((item) => !item.ok);
console.log(JSON.stringify({
  ok: failures.length === 0,
  base_url: baseUrl,
  results
}, null, 2));

if (failures.length) process.exit(1);
