#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const alertsDir = path.join(root, 'skydexia', 'alerts');
const deliveryPath = path.join(alertsDir, 'delivery-log.json');
const auditPath = path.join(alertsDir, 'audit-trail.json');

if (!fs.existsSync(deliveryPath)) {
  console.error('Missing delivery log for audit trail:', path.relative(root, deliveryPath));
  process.exit(1);
}

const delivery = JSON.parse(fs.readFileSync(deliveryPath, 'utf8'));
const acknowledge = process.env.SKYDEXIA_ACK_DELIVERIES === '1';

const records = (delivery.records || []).map((record) => ({
  deliveryId: record.deliveryId,
  status: record.status,
  deliveredAt: record.deliveredAt,
  acknowledged: acknowledge,
  acknowledgedAt: acknowledge ? new Date().toISOString() : null,
  recipients: record.recipients || []
}));

const audit = {
  version: 1,
  generatedAt: new Date().toISOString(),
  totalRecords: records.length,
  acknowledgedRecords: records.filter((r) => r.acknowledged).length,
  records
};

fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ output: path.relative(root, auditPath), totalRecords: records.length, acknowledged: audit.acknowledgedRecords }, null, 2));
