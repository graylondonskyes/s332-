import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'app/page.tsx',
  'app/pricing/page.tsx',
  'app/signup/page.tsx',
  'app/login/page.tsx',
  'app/legal/terms/page.tsx',
  'app/legal/privacy/page.tsx',
  'app/legal/sms-terms/page.tsx',
  'app/(app)/walkthrough/page.tsx',
  'app/(app)/help/page.tsx',
  'app/(app)/dashboard/page.tsx',
  'app/(app)/leads/page.tsx',
  'app/(app)/templates/page.tsx',
  'app/(app)/automations/page.tsx',
  'app/(app)/billing/page.tsx',
  'app/(app)/risk-controls/page.tsx',
  'app/(app)/trust-center/page.tsx',
  'app/(app)/ui-readiness/page.tsx',
  'components/leads/create-lead-form.tsx',
  'components/leads/lead-status-form.tsx',
  'components/leads/add-note-form.tsx',
  'components/leads/retry-message-form.tsx',
  'components/templates/template-editor.tsx',
  'components/automations/rule-editor.tsx',
  'components/billing/checkout-button.tsx',
  'components/operations/action-forms.tsx'
];

const requiredCopy = [
  ['app/legal/sms-terms/page.tsx', ['STOP', 'START', 'Message and data rates may apply', 'consent', 'fair-use']],
  ['app/legal/terms/page.tsx', ['No guarantee of results', 'Billing and usage limits', 'Messaging use']],
  ['app/signup/page.tsx', ['Terms', 'Privacy Policy', 'SMS Terms']],
  ['app/(app)/onboarding/page.tsx', ['automated SMS requires customer consent', 'STOP/START', 'unlimited marketing-blast']]
];

const missing = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) missing.push(file);
}

const copyFailures = [];
for (const [file, needles] of requiredCopy) {
  const full = path.join(root, file);
  const text = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
  for (const needle of needles) {
    if (!text.includes(needle)) copyFailures.push(`${file} missing: ${needle}`);
  }
}

if (missing.length || copyFailures.length) {
  console.error('UI/legal contract proof failed.');
  if (missing.length) console.error('Missing files:', missing.join(', '));
  if (copyFailures.length) console.error('Copy failures:', copyFailures.join(' | '));
  process.exit(1);
}

console.log('UI/legal contract proof passed. Required pages, controls, and compliance copy anchors are present.');
