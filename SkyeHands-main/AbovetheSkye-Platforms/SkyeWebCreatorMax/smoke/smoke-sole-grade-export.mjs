#!/usr/bin/env node
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const siteRoot = path.join(root, 'generated-sites/sole-skye-authority-platform');
const playwrightPath = path.resolve(root, '../SuperIDEv2/node_modules/playwright');
const { chromium } = createRequire(import.meta.url)(path.join(playwrightPath, 'index.js'));
const target = process.argv[2] || `file://${path.join(siteRoot, 'index.html')}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('#buildForm', { timeout: 10000 });
await page.click('[data-mode="forge"]');
await page.click('[data-panel="design"]');
await page.click('#runAudit');
await page.click('[data-open-gate]');
await page.fill('#gatePhrase', 'skyehands-founder-stack');
await page.click('#verifyGate');
await page.click('#closeGate');
await page.fill('input[name="project"]', 'Smoke SOLE-grade platform');
await page.selectOption('select[name="lane"]', 'Ops Console');
await page.click('button[type="submit"]');
await page.waitForTimeout(500);

const result = await page.evaluate(() => {
  const canvas = document.querySelector('#field');
  const rect = canvas.getBoundingClientRect();
  return {
    title: document.title,
    bodyLength: document.body.textContent.length,
    panels: document.querySelectorAll('.panel').length,
    cards: document.querySelectorAll('.card, .stack, .tile').length,
    modeText: document.querySelector('#sceneMode')?.textContent || '',
    readyState: document.querySelector('#readyState')?.textContent || '',
    formStatus: document.querySelector('#formStatus')?.textContent || '',
    terminalText: document.querySelector('#terminal')?.textContent || '',
    gateClosed: !document.querySelector('#gateOverlay')?.classList.contains('open'),
    gateStatus: document.querySelector('#gateStatus')?.textContent || '',
    canvasWidth: rect.width,
    canvasHeight: rect.height,
    deadAnchors: [...document.querySelectorAll('a')].filter((anchor) => !anchor.getAttribute('href')).length,
    missingHashTargets: [...document.querySelectorAll('a[href^="#"]')]
      .map((anchor) => anchor.getAttribute('href').slice(1))
      .filter((id) => id && !document.getElementById(id)).length,
  };
});

await browser.close();

const passed = result.title.includes('SOLE-Grade')
  && result.bodyLength > 4500
  && result.panels >= 4
  && result.cards >= 10
  && result.modeText.includes('Forge')
  && result.readyState === 'Verified'
  && result.formStatus.includes('Queued for AE review')
  && result.terminalText.includes('Local audit completed')
  && result.gateClosed
  && result.gateStatus.includes('Portal verified locally')
  && result.canvasWidth >= 1000
  && result.canvasHeight >= 700
  && result.deadAnchors === 0
  && result.missingHashTargets === 0;

console.log(JSON.stringify({ passed, target, result }, null, 2));
if (!passed) process.exit(1);
