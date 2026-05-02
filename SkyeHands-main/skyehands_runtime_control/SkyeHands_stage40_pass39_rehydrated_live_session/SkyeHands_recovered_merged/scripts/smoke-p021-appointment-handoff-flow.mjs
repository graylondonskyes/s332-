#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fnRoot = path.join(root, 'platform', 'user-platforms', 'skye-account-executive-commandhub-s0l26-0s', 'source', 'AE-Central-Command-Pack-CredentialHub-Launcher', 'netlify', 'functions');
const artifact = path.join(root, 'SMOKE_P021_APPOINTMENT_HANDOFF_FLOW.md');

const threads = require(path.join(fnRoot, 'ae-threads.js'));
const messages = require(path.join(fnRoot, 'ae-messages.js'));
const providers = require(path.join(fnRoot, '_shared', 'ae_providers.js'));
process.env.CALENDLY_TOKEN = process.env.CALENDLY_TOKEN || 'calendly-smoke-token';
if (!process.env.CALENDLY_TOKEN || process.env.CALENDLY_TOKEN === 'calendly-smoke-token') process.env.AE_PROVIDERS_DRY_RUN = '1';

const thread = JSON.parse((await threads.handler({ httpMethod: 'POST', body: JSON.stringify({ clientId: 'p021-client', subject: 'Appointment Handoff' }) })).body);
const message = JSON.parse((await messages.handler({ httpMethod: 'POST', body: JSON.stringify({ threadId: thread.thread.id, author: 'ae', content: 'handoff initiated' }) })).body);
const booking = await providers.executeProviderAction('calendly', { eventTypeUri: 'evt_appointment', inviteeEmail: 'book@example.com' });
const pass = Boolean(thread.ok && message.ok && booking.ok);
fs.writeFileSync(artifact, `# P021 Smoke Proof — Appointment Handoff Flow\n\nStatus: ${pass ? 'PASS' : 'FAIL'}\n- thread: ${thread.thread.id}\n- message: ${message.message.id}\n- bookingProvider: ${booking.provider}\n`, 'utf8');
console.log(JSON.stringify({ pass, artifact: path.relative(root, artifact) }, null, 2));
if (!pass) process.exit(1);
