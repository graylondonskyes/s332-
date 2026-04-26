import fs from 'node:fs';
import path from 'node:path';

import { getStackConfig } from './config.mjs';
import { listAuditEvents } from '../lib/governance-manager.mjs';
import { getProviderSovereigntySummary } from '../lib/provider-sovereignty.mjs';

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseArgs(argv) {
  const args = {
    format: 'json',
    output: null,
    limit: 1000,
    offset: 0,
    workspaceId: null,
    tenantId: null,
    startAt: null,
    endAt: null,
    json: false
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--format' && next) { args.format = String(next).trim().toLowerCase(); index += 1; continue; }
    if (token === '--output' && next) { args.output = String(next).trim(); index += 1; continue; }
    if (token === '--limit' && next) { args.limit = Number.parseInt(String(next), 10) || args.limit; index += 1; continue; }
    if (token === '--offset' && next) { args.offset = Number.parseInt(String(next), 10) || args.offset; index += 1; continue; }
    if (token === '--workspace' && next) { args.workspaceId = String(next).trim(); index += 1; continue; }
    if (token === '--tenant' && next) { args.tenantId = String(next).trim().toLowerCase(); index += 1; continue; }
    if (token === '--start-at' && next) { args.startAt = String(next).trim(); index += 1; continue; }
    if (token === '--end-at' && next) { args.endAt = String(next).trim(); index += 1; continue; }
    if (token === '--json') { args.json = true; }
  }

  return args;
}

function toCsvLine(values = []) {
  return values.map(value => {
    const normalized = String(value ?? '');
    if (/[,"\n]/.test(normalized)) {
      return `"${normalized.replaceAll('"', '""')}"`;
    }
    return normalized;
  }).join(',');
}

function serialize(result, format, sovereigntySummary) {
  const normalized = String(format || 'json').trim().toLowerCase();
  const events = Array.isArray(result?.events) ? result.events : [];
  if (normalized === 'csv') {
    const header = ['id', 'at', 'action', 'outcome', 'actorType', 'actorId', 'tenantId', 'workspaceId', 'sessionId', 'detail'];
    const rows = events.map(event => [
      event.id,
      event.at,
      event.action,
      event.outcome,
      event.actorType,
      event.actorId,
      event.tenantId,
      event.workspaceId || '',
      event.sessionId || '',
      JSON.stringify(event.detail || {})
    ]);
    return [toCsvLine(header), ...rows.map(toCsvLine)].join('\n');
  }

  if (normalized === 'ndjson') {
    return events.map(event => JSON.stringify(event)).join('\n');
  }

  return JSON.stringify({
    ok: true,
    format: 'json',
    providerSovereignty: sovereigntySummary,
    ...result
  }, null, 2);
}

function defaultExtension(format) {
  if (format === 'csv') return 'csv';
  if (format === 'ndjson') return 'ndjson';
  return 'json';
}

async function main() {
  const args = parseArgs(process.argv);
  const config = getStackConfig(process.env);
  const result = listAuditEvents(config, {
    limit: args.limit,
    offset: args.offset,
    workspaceId: args.workspaceId,
    tenantId: args.tenantId,
    startAt: args.startAt,
    endAt: args.endAt
  });
  const sovereigntySummary = getProviderSovereigntySummary(config, args.tenantId ? { tenantId: args.tenantId } : {});
  const body = serialize(result, args.format, sovereigntySummary);
  const output = args.output
    ? path.resolve(config.rootDir, args.output)
    : path.join(config.rootDir, 'docs', 'proof', `AUDIT_EXPORT.${defaultExtension(args.format)}`);
  ensureDirectory(path.dirname(output));
  fs.writeFileSync(output, body, 'utf8');

  const payload = {
    ok: true,
    format: args.format,
    output,
    count: Array.isArray(result.events) ? result.events.length : 0,
    total: result.total,
    workspaceId: args.workspaceId,
    tenantId: args.tenantId,
    providerSovereignty: sovereigntySummary
  };

  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`${payload.count} events exported to ${output}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
