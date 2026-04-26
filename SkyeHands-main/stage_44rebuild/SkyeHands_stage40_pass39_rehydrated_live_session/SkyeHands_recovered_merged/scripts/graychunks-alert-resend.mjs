#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const findingsPath = path.join(root, 'skydexia', 'alerts', 'graychunks-findings.json');
const outPath = path.join(root, 'skydexia', 'alerts', 'graychunks-alert-dispatch.json');

if (!fs.existsSync(findingsPath)) {
  console.error('GrayChunks findings not found. Run scripts/graychunks-scan.mjs first.');
  process.exit(1);
}

const findings = JSON.parse(fs.readFileSync(findingsPath, 'utf8'));
const recipients = (process.env.GRAYCHUNKS_ALERT_RECIPIENTS || process.env.SKYDEXIA_ALERT_RECIPIENTS || 'ultimate-admin@skyehands.local')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

const subject = findings.issueCount > 0
  ? `[GrayChunks] ${findings.issueCount} issues detected in ${findings.scannedFiles} files`
  : '[GrayChunks] scan clean';

const bodyText = [
  `GrayChunks scan generatedAt: ${findings.generatedAt}`,
  `Scanned files: ${findings.scannedFiles}`,
  `Issue count: ${findings.issueCount}`,
  'Issue types:',
  ...Object.entries(findings.issuesByType || {}).map(([type, count]) => `- ${type}: ${count}`),
  '',
  'Top findings:',
  ...((findings.issues || []).slice(0, 20).map((issue) => `- ${issue.file}:${issue.line} | ${issue.type} | ${issue.message}`)),
  '',
  'Artifacts:',
  '- skydexia/alerts/graychunks-findings.json',
  '- GRAYCHUNKS_REPORT.md'
].join('\n');

const dryRun = process.env.GRAYCHUNKS_ALERT_DRY_RUN === '1';
let delivery = { status: 'SKIPPED_MISSING_VARS' };

if (dryRun) {
  delivery = { status: 'DRY_RUN', provider: 'resend', accepted: true };
} else {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.GRAYCHUNKS_ALERT_FROM || process.env.SKYDEXIA_ALERT_FROM;
  if (apiKey && fromEmail && recipients.length > 0) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipients,
        subject,
        text: bodyText
      })
    });

    const responseBody = await response.text();
    delivery = {
      status: response.ok ? 'DELIVERED' : 'FAILED',
      provider: 'resend',
      httpStatus: response.status,
      responseBody: responseBody.slice(0, 500)
    };

    if (!response.ok) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), recipients, subject, delivery }, null, 2)}\n`, 'utf8');
      console.error('Resend delivery failed.');
      process.exit(1);
    }
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  recipients,
  subject,
  issueCount: findings.issueCount,
  delivery
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: 'PASS', dispatch: path.relative(root, outPath).replace(/\\/g, '/'), delivery: payload.delivery.status }, null, 2));
