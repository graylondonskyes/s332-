#!/usr/bin/env node
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const playwrightPath = path.resolve(root, '../SuperIDEv2/node_modules/playwright');
const { chromium } = createRequire(import.meta.url)(path.join(playwrightPath, 'index.js'));
const target = process.argv[2] || `file://${path.join(root, 'landing.html')}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('#skye3d', { timeout: 10000 });
await page.waitForTimeout(900);

const result = await page.evaluate(() => {
  const canvas = document.querySelector('#skye3d');
  const rect = canvas.getBoundingClientRect();
  let painted = false;
  try {
    const context = canvas.getContext('2d');
    if (context) {
      const xs = [.2, .35, .5, .65, .8];
      const ys = [.25, .4, .55, .7];
      painted = xs.some((xRatio) => ys.some((yRatio) => {
        const sample = context.getImageData(
          Math.max(0, Math.floor(canvas.width * xRatio)),
          Math.max(0, Math.floor(canvas.height * yRatio)),
          1,
          1
        ).data;
        return sample[0] + sample[1] + sample[2] + sample[3] > 0;
      }));
    } else {
      painted = canvas.width > 0 && canvas.height > 0;
    }
  } catch {
    painted = canvas.width > 0 && canvas.height > 0;
  }
  return {
    title: document.title,
    hasProductName: document.body.textContent.includes('SkyeWebCreatorMax'),
    hasThreeSignal: document.body.textContent.includes('Three.js'),
    hasOpenBuilderLink: Boolean(document.querySelector('a[href="./index.html"]')),
    canvasWidth: rect.width,
    canvasHeight: rect.height,
    painted,
  };
});

await browser.close();

const passed = result.title.includes('SkyeWebCreatorMax')
  && result.hasProductName
  && result.hasThreeSignal
  && result.hasOpenBuilderLink
  && result.canvasWidth >= 1000
  && result.canvasHeight >= 700
  && result.painted;

console.log(JSON.stringify({ passed, target, result }, null, 2));
if (!passed) process.exit(1);
