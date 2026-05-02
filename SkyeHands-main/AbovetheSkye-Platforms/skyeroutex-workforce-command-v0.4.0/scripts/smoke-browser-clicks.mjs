import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { spawn } from 'child_process';

const root = process.cwd();
const repoRoot = path.resolve(root, '../..');
const proofDir = path.join(root, 'proof');
fs.mkdirSync(proofDir, { recursive: true });

const dbPath = path.join(root, 'data', 'browser-click-smoke-db.json');
if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { force: true });

function findPlaywrightPackage() {
  const candidates = [
    process.env.PLAYWRIGHT_PACKAGE_PATH,
    path.join(repoRoot, 'AbovetheSkye-Platforms/SuperIDEv2/node_modules/playwright'),
    path.join(repoRoot, 'node_modules/playwright'),
    path.join(root, 'node_modules/playwright')
  ].filter(Boolean);
  return candidates.find(p => fs.existsSync(path.join(p, 'package.json')));
}

const playwrightPath = findPlaywrightPackage();
if (!playwrightPath) {
  console.error('No local Playwright package found. Set PLAYWRIGHT_PACKAGE_PATH to run real browser click smoke.');
  process.exit(2);
}
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(repoRoot, '.ms-playwright');
const { chromium } = createRequire(import.meta.url)(path.join(playwrightPath, 'index.js'));

const port = 5887;
const env = { ...process.env, PORT: String(port), DATABASE_PATH: dbPath, SKYE_ADMIN_EMAIL: 'admin@clicks.internal.invalid', SKYE_ADMIN_PASSWORD: 'AdminClicks123!' };
const server = spawn('node', ['src/server.js'], { cwd: root, env, stdio: 'ignore' });

const proof = { started_at: new Date().toISOString(), playwright_path: playwrightPath, checks: [] };
const pass = (name, data = {}) => proof.checks.push({ status: 'PASS', name, data });
function assert(cond, msg, data) { if (!cond) { const e = new Error(msg); e.data = data; throw e; } }

async function waitForServer() {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/api/health`); if (r.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('server did not become ready');
}

async function login(page, email, password) {
  await page.locator('#login-form [name="email"]').fill(email);
  await page.locator('#login-form [name="password"]').fill(password);
  await page.locator('#login-form button[type="submit"]').scrollIntoViewIfNeeded();
  await page.locator('#login-form button[type="submit"]').click({ force: true });
  try {
    await page.waitForFunction(expected => JSON.parse(localStorage.getItem('skye_user') || 'null')?.email === expected, email, { timeout: 5000 });
  } catch (error) {
    const visible = await page.locator('#session-label').textContent().catch(() => '');
    const toast = await page.locator('#toast').textContent().catch(() => '');
    throw new Error(`login label did not update for ${email}; visible="${visible}" toast="${toast}"`);
  }
}

async function signup(page, { name, email, password, role, company }) {
  await page.locator('#signup-form [name="name"]').fill(name);
  await page.locator('#signup-form [name="email"]').fill(email);
  await page.locator('#signup-form [name="password"]').fill(password);
  await page.locator('#signup-form [name="role"]').selectOption(role);
  await page.locator('#signup-form [name="company_name"]').fill(company || 'Browser Click Provider Co');
  await page.locator('#signup-form [name="city"]').fill('Phoenix');
  await page.locator('#signup-form [name="state"]').fill('Arizona');
  const responsePromise = page.waitForResponse(res => res.url().includes('/api/auth/signup'), { timeout: 5000 });
  await page.locator('#signup-form button[type="submit"]').click();
  const response = await responsePromise;
  if (!response.ok()) throw new Error(`signup failed for ${email}: ${await response.text()}`);
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('dialog', async dialog => dialog.accept('Browser click proof completed.'));
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-form');
  pass('real_chromium_loaded_app');

  await login(page, 'admin@clicks.internal.invalid', 'AdminClicks123!');
  await page.locator('#market-form [name="city"]').fill('Phoenix');
  await page.locator('#market-form [name="state"]').fill('Arizona');
  await page.locator('#market-form button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelector('#market-select')?.options?.length > 0, null, { timeout: 5000 });
  pass('admin_created_market_from_ui');

  await signup(page, { name: 'Browser Provider', email: 'provider-clicks@example.test', password: 'Provider123!', role: 'provider', company: 'Browser Click Provider Co' });
  await signup(page, { name: 'Browser Contractor', email: 'contractor-clicks@example.test', password: 'Contractor123!', role: 'contractor' });
  pass('ui_created_provider_and_contractor_accounts');

  await login(page, 'provider-clicks@example.test', 'Provider123!');
  await page.waitForFunction(() => document.querySelector('#market-select')?.options?.length > 0, null, { timeout: 5000 });
  const title = `Browser Click Job ${Date.now()}`;
  await page.evaluate(t => {
    const form = document.querySelector('#job-form');
    form.elements.title.value = t;
    form.elements.category.value = 'event';
    form.elements.description.value = 'Browser click end-to-end job.';
    form.elements.location.value = 'Downtown Phoenix';
    form.elements.pay_amount_cents.value = '11100';
    form.elements.slots.value = '1';
    form.elements.acceptance_mode.value = 'single';
  }, title);
  await page.locator('#job-form button[type="submit"]').click();
  await page.waitForFunction(t => document.querySelector('#provider-jobs')?.textContent?.includes(t), title, { timeout: 7000 });
  pass('provider_posted_job_from_ui');

  await login(page, 'contractor-clicks@example.test', 'Contractor123!');
  await page.locator('#feed-form button[type="submit"]').click();
  await page.waitForFunction(t => document.querySelector('#contractor-feed')?.textContent?.includes(t), title, { timeout: 7000 });
  await page.locator('#contractor-feed button[data-apply]').first().click();
  await page.waitForTimeout(400);
  pass('contractor_applied_from_ui');

  await login(page, 'provider-clicks@example.test', 'Provider123!');
  await page.waitForFunction(t => document.querySelector('#provider-jobs')?.textContent?.includes(t), title, { timeout: 7000 });
  await page.locator('#provider-jobs button[data-applicants]').first().click();
  await page.waitForFunction(() => document.querySelector('#applicant-pool button[data-accept]'), null, { timeout: 5000 });
  await page.locator('#applicant-pool button[data-accept]').first().click();
  await page.waitForFunction(() => document.querySelector('#assignments')?.textContent?.includes('offered'), null, { timeout: 7000 });
  pass('provider_accepted_applicant_from_ui');

  await login(page, 'contractor-clicks@example.test', 'Contractor123!');
  for (const label of ['confirm', 'on-the-way', 'check-in', 'check-out']) {
    await page.waitForFunction(action => [...document.querySelectorAll('#assignments button[data-asg]')].some(b => b.dataset.asg.startsWith(action + ':')), label, { timeout: 7000 });
    await page.locator(`#assignments button[data-asg^="${label}:"]`).first().click();
    await page.waitForTimeout(300);
  }
  await page.waitForSelector('#assignments button[data-proof]', { timeout: 7000 });
  await page.locator('#assignments button[data-proof]').first().click();
  await page.waitForFunction(() => document.querySelector('#assignments')?.textContent?.includes('proof_submitted'), null, { timeout: 7000 });
  pass('contractor_completed_assignment_and_submitted_proof_from_ui');

  await login(page, 'provider-clicks@example.test', 'Provider123!');
  await page.locator('#btn-contractor-refresh').click();
  await page.waitForSelector('#assignments button[data-approve]', { timeout: 7000 });
  await page.locator('#assignments button[data-approve]').first().click();
  await page.waitForFunction(() => document.querySelector('#assignments')?.textContent?.includes('completed'), null, { timeout: 7000 });
  pass('provider_approved_assignment_from_ui');

  await login(page, 'admin@clicks.internal.invalid', 'AdminClicks123!');
  await page.locator('#btn-integrations').click();
  await page.waitForFunction(() => document.querySelector('#integrations')?.textContent?.includes('payment_provider'), null, { timeout: 7000 });
  pass('house_command_integration_status_clicked_from_ui');

  const backend = await page.evaluate(async () => {
    const session = localStorage.getItem('skye_session');
    const [assignments, payments, audits] = await Promise.all([
      fetch('/api/assignments', { headers: { 'x-skye-session': session } }).then(r => r.json()),
      fetch('/api/payments/ledger', { headers: { 'x-skye-session': session } }).then(r => r.json()),
      fetch('/api/admin/audit-events', { headers: { 'x-skye-session': session } }).then(r => r.json())
    ]);
    return { assignments: assignments.assignments?.length || 0, payoutEligible: payments.payments?.some(p => p.status === 'payout_eligible'), audits: audits.audit_events?.length || 0 };
  });
  assert(backend.assignments >= 1 && backend.payoutEligible && backend.audits >= 1, 'backend state missing after UI clicks', backend);
  pass('ui_clicks_produced_backend_state', backend);

  await browser.close();
  proof.completed_at = new Date().toISOString();
  proof.status = 'PASS';
} catch (err) {
  proof.failed_at = new Date().toISOString();
  proof.status = 'FAIL';
  proof.failure = err.message;
  proof.data = err.data || null;
  console.error(err);
  process.exitCode = 1;
} finally {
  const out = path.join(proofDir, `SMOKE_BROWSER_CLICKS_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  console.log(`Browser click proof written: ${out}`);
  try { process.kill(server.pid, 'SIGKILL'); } catch {}
  process.exit(process.exitCode || 0);
}
