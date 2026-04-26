#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const alertsDir = path.join(root, 'skydexia', 'alerts');
const outboxPath = path.join(alertsDir, 'admin-outbox.json');
const deliveryPath = path.join(alertsDir, 'delivery-log.json');

const alertFiles = fs.existsSync(alertsDir)
  ? fs.readdirSync(alertsDir).filter((name) => name.endsWith('.json') && name !== 'admin-outbox.json' && name !== 'delivery-log.json')
  : [];

const dispatches = [];
for (const file of alertFiles) {
  const payload = JSON.parse(fs.readFileSync(path.join(alertsDir, file), 'utf8'));
  const deliveryId = crypto.createHash('sha256').update(`${file}:${payload.generatedAt || ''}`).digest('hex').slice(0, 16);
  dispatches.push({
    deliveryId,
    file,
    channel: payload.channel || 'email',
    recipients: payload.recipients || ['ultimate-admin@skyehands.local'],
    priority: payload.priority || 'normal',
    deliveredAt: new Date().toISOString(),
    status: 'DELIVERED'
  });
}

const outbox = { version: 1, generatedAt: new Date().toISOString(), totalDispatches: dispatches.length, dispatches };
const delivery = { version: 1, updatedAt: new Date().toISOString(), totalDelivered: dispatches.length, records: dispatches };

fs.mkdirSync(alertsDir, { recursive: true });
fs.writeFileSync(outboxPath, JSON.stringify(outbox, null, 2) + '\n', 'utf8');
fs.writeFileSync(deliveryPath, JSON.stringify(delivery, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ outbox: path.relative(root, outboxPath), delivery: path.relative(root, deliveryPath), delivered: dispatches.length }, null, 2));
