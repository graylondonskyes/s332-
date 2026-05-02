import fs from 'fs';
import path from 'path';
import { createDatabaseAdapter } from '../src/adapters/workforce-db.js';
import { applyLocalJsonMigration, applyPostgresMigration, assertLocalJsonMigrationDriver, validateSqlCoverage } from './migration-utils.mjs';

const root = process.cwd();
const proofDir = path.join(root, 'proof');
fs.mkdirSync(proofDir, { recursive: true });
const dbPath = path.join(root, 'data', 'migration-smoke-db.json');
const sqlPath = path.join(root, 'schema', 'workforce-command.sql');
if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { force: true });

function assert(cond, msg, data) {
  if (!cond) {
    const error = new Error(msg);
    error.data = data;
    throw error;
  }
}

const proof = { started_at: new Date().toISOString(), checks: [] };
const pass = (name, data = {}) => proof.checks.push({ status: 'PASS', name, data });

function createRecordingPsqlHarness() {
  const dir = fs.mkdtempSync(path.join(root, 'data', 'recording-psql-'));
  const bin = path.join(dir, 'psql.cjs');
  const statePath = path.join(dir, 'state.json');
  fs.writeFileSync(statePath, JSON.stringify({ calls: [], document: null }, null, 2));
  fs.writeFileSync(bin, `
const fs = require('fs');
const args = process.argv.slice(2);
const statePath = process.env.RECORDING_PSQL_STATE;
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
state.calls.push(args);
if (args.includes('--file')) {
  const file = args[args.indexOf('--file') + 1];
  const sql = fs.readFileSync(file, 'utf8');
  state.last_sql = sql;
  const match = sql.match(/values \\('default',\\s*(\\$[a-zA-Z0-9_]+\\$)([\\s\\S]*?)\\1::jsonb/i);
  if (match) state.document = match[2];
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  process.exit(0);
}
if (args.includes('--command')) {
  const command = args[args.indexOf('--command') + 1] || '';
  if (/select document_json::text from workforce_app_documents/i.test(command) && state.document) {
    process.stdout.write(state.document + '\\n');
  }
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  process.exit(0);
}
fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
`);
  return { dir, bin, statePath };
}

try {
  const check = validateSqlCoverage({ sqlPath });
  assert(check.ok, 'migration schema check failed', check);
  pass('sql_handoff_represents_local_json_collections', { collections: check.local_collections.length, tables: check.sql_tables.length });

  const first = applyLocalJsonMigration({ dbPath, sqlPath });
  assert(first.applied === true, 'migration apply failed', first);
  const dbAfterFirst = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  assert(dbAfterFirst.schema_migrations.length === 1, 'migration metadata was not recorded once', dbAfterFirst.schema_migrations);
  const record = dbAfterFirst.schema_migrations[0];
  assert(record.version && record.schema_sha256 && record.local_collections.includes('users') && record.local_collections.includes('schema_migrations'), 'migration metadata is incomplete', record);
  pass('local_json_migration_metadata_recorded', { version: record.version, collections: record.local_collections.length });

  const second = applyLocalJsonMigration({ dbPath, sqlPath });
  assert(second.applied === false, 'migration is not idempotent', second);
  const dbAfterSecond = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  assert(dbAfterSecond.schema_migrations.length === 1, 'idempotent migration duplicated metadata', dbAfterSecond.schema_migrations);
  pass('local_json_migration_is_idempotent');

  try {
    assertLocalJsonMigrationDriver('postgres');
    assert(false, 'production driver did not fail closed');
  } catch (err) {
    assert(err.message.includes('local-json or postgres'), 'unsupported driver failed with the wrong error', err.message);
  }
  pass('migration_fails_closed_for_unsupported_driver');

  try {
    createDatabaseAdapter({ root, env: { DATABASE_DRIVER: 'postgres' } });
    assert(false, 'postgres adapter accepted missing DATABASE_URL/POSTGRES_URL');
  } catch (err) {
    assert(err.message.includes('requires DATABASE_URL or POSTGRES_URL'), 'postgres adapter missing-url guard emitted wrong error', err.message);
  }
  pass('postgres_adapter_fails_closed_without_url');

  try {
    applyPostgresMigration({ sqlPath, env: { DATABASE_URL: 'postgres://example.invalid/skyeroutex', PSQL_BIN: path.join(root, 'missing-psql-bin') } });
    assert(false, 'postgres migration accepted missing psql CLI');
  } catch (err) {
    assert(err.message.includes('requires the psql CLI'), 'postgres migration missing-psql guard emitted wrong error', err.message);
  }
  pass('postgres_migration_fails_closed_without_psql');

  const harness = createRecordingPsqlHarness();
  process.env.RECORDING_PSQL_STATE = harness.statePath;
  const postgresEnv = { DATABASE_DRIVER: 'postgres', DATABASE_URL: 'postgres://migration-proof/skyeroutex', PSQL_BIN: process.execPath, PSQL_WRAPPER_SCRIPT: harness.bin };
  const pgMigration = applyPostgresMigration({ sqlPath, env: postgresEnv });
  assert(pgMigration.applied === true && pgMigration.driver === 'postgres', 'recorded postgres migration did not report applied', pgMigration);
  const harnessAfterMigration = JSON.parse(fs.readFileSync(harness.statePath, 'utf8'));
  assert(harnessAfterMigration.last_sql.includes('create table if not exists users'), 'postgres migration did not apply workforce SQL schema', harnessAfterMigration.last_sql);
  assert(harnessAfterMigration.last_sql.includes('create table if not exists workforce_app_documents'), 'postgres migration did not create document store table', harnessAfterMigration.last_sql);
  pass('postgres_migration_applies_schema_and_document_store_with_psql', { calls: harnessAfterMigration.calls.length });

  const pgDb = createDatabaseAdapter({ root, env: postgresEnv });
  pgDb.save({ ...check.local_collections.reduce((acc, key) => ({ ...acc, [key]: [] }), {}), users: [{ id: 'usr_recording', email: 'recording@example.test' }] });
  const loaded = pgDb.load();
  assert(loaded.users.some((user) => user.id === 'usr_recording'), 'postgres document adapter did not round-trip app document through psql harness', loaded.users);
  pass('postgres_document_adapter_round_trips_app_document');
  fs.rmSync(harness.dir, { recursive: true, force: true });
  delete process.env.RECORDING_PSQL_STATE;

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
  const out = path.join(proofDir, `SMOKE_MIGRATIONS_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(out, JSON.stringify(proof, null, 2));
  console.log(`Migration proof written: ${out}`);
  process.exit(process.exitCode || 0);
}
