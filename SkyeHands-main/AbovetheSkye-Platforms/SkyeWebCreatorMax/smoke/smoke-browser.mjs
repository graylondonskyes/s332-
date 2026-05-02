#!/usr/bin/env node
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const playwrightPath = path.resolve(root, '../SuperIDEv2/node_modules/playwright');
const { chromium } = createRequire(import.meta.url)(path.join(playwrightPath, 'index.js'));
const target = process.argv[2] || `file://${path.join(root, 'index.html')}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('#projectForm', { timeout: 10000 });
await page.fill('#templateSearch', 'SOLE');
await page.click('[data-template-id="sole-skye-authority-platform"]');
await page.click('#applyTemplate', { noWaitAfter: true });
await page.waitForFunction(() => {
  const doc = document.querySelector('#previewFrame')?.contentDocument;
  return doc?.querySelector('#sceneMode')?.textContent === 'Founder orbit'
    && doc?.querySelector('[data-mode="forge"]')
    && doc?.querySelector('#runAudit');
}, null, { timeout: 10000 });
await page.waitForTimeout(500);
const donorInteractionText = await page.evaluate(() => {
  const doc = document.querySelector('#previewFrame')?.contentDocument;
  doc?.querySelector('[data-mode="forge"]')?.click();
  doc?.querySelector('#runAudit')?.click();
  return `${doc?.querySelector('#sceneMode')?.textContent || ''} ${doc?.querySelector('#readyState')?.textContent || ''}`;
});
await page.fill('input[name="name"]', 'Browser Smoke Website');
await page.fill('textarea[name="brief"]', 'Build a browser-smoked client website with AE delivery handoff.');
await page.click('button[type="submit"]');
await page.click('#packageArtifact');

const result = await page.evaluate(() => ({
  title: document.title,
  hasProductName: document.body.textContent.includes('SkyeWebCreatorMax'),
  projectCount: JSON.parse(localStorage.getItem('skyewebcreatormax.projects.v1') || '[]').length,
  deliveryCount: JSON.parse(localStorage.getItem('skyewebcreatormax.delivery.v1') || '[]').length,
  fileCount: Object.keys(JSON.parse(localStorage.getItem('skyewebcreatormax.files.v1') || '{}')).length,
  templateRefsText: document.querySelector('#templateSourceRefs')?.textContent || '',
  donorTemplateId: JSON.parse(localStorage.getItem('skyewebcreatormax.projects.v1') || '[]')[0]?.donorTemplate?.id || '',
  donorInteractionText: window.__donorInteractionText || '',
  previewText: document.querySelector('#previewFrame')?.contentDocument?.body?.textContent || '',
  logText: document.querySelector('#eventLog')?.textContent || '',
}));

result.donorInteractionText = donorInteractionText;

await browser.close();

const passed = result.title === 'SkyeWebCreatorMax'
  && result.hasProductName
  && result.projectCount > 0
  && result.deliveryCount > 0
  && result.fileCount >= 4
  && result.templateRefsText.includes('sole-skye-visual-standard')
  && result.donorTemplateId === 'sole-skye-authority-platform'
  && result.donorInteractionText.includes('Forge')
  && result.donorInteractionText.includes('Verified')
  && result.previewText.includes('Web creation that does not downgrade the founder stack')
  && result.logText.includes('Queued generated website package');

console.log(JSON.stringify({ passed, target, result }, null, 2));
if (!passed) process.exit(1);
