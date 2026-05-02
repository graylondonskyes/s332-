import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { blankDb } from '../src/adapters/workforce-db.js';

export const DEFAULT_MIGRATION_VERSION = 'local-json-workforce-command-schema-v1';
export const DEFAULT_MIGRATION_NAME = 'Validate local JSON collections against SQL handoff schema';
export const POSTGRES_MIGRATION_VERSION = 'postgres-workforce-command-schema-v1';
export const POSTGRES_MIGRATION_NAME = 'Apply Workforce Command SQL schema and document store';

export function assertLocalJsonMigrationDriver(driver) {
  if (driver !== 'local-json') {
    throw new Error(`migrate-db supports DATABASE_DRIVER=local-json or postgres. ${driver} must provide its own production migration runner before boot.`);
  }
}

export function postgresUrl(env = process.env) {
  return env.DATABASE_URL || env.POSTGRES_URL || '';
}

export function assertPostgresMigrationConfig(env = process.env) {
  const url = postgresUrl(env);
  if (!url) {
    throw new Error('DATABASE_DRIVER=postgres requires DATABASE_URL or POSTGRES_URL before migrations can run.');
  }
  return url;
}

export function runPsql({ env = process.env, sql, args = [] }) {
  const url = assertPostgresMigrationConfig(env);
  const psqlBin = env.PSQL_BIN || 'psql';
  const wrapperArgs = env.PSQL_WRAPPER_SCRIPT ? [env.PSQL_WRAPPER_SCRIPT] : [];
  const baseArgs = ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--dbname', url];
  const cleanup = [];
  let finalArgs = baseArgs.concat(args);

  if (sql !== undefined) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skyeroutex-migrate-'));
    const file = path.join(dir, 'migration.sql');
    fs.writeFileSync(file, sql);
    cleanup.push(dir);
    finalArgs = baseArgs.concat(['--file', file], args);
  }

  const result = spawnSync(psqlBin, wrapperArgs.concat(finalArgs), { encoding: 'utf8', env: process.env });
  for (const dir of cleanup) fs.rmSync(dir, { recursive: true, force: true });

  if (result.error?.code === 'ENOENT') {
    throw new Error(`DATABASE_DRIVER=postgres requires the psql CLI. Could not execute ${psqlBin}. Install PostgreSQL client tools or set PSQL_BIN.`);
  }
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`psql command failed for DATABASE_DRIVER=postgres${detail ? `: ${detail}` : '.'}`);
  }
  return result.stdout || '';
}

export function parseSqlTables(sql) {
  const tables = new Set();
  const tablePattern = /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?["`[]?([a-zA-Z_][\w]*)["`\]]?/gi;
  let match;
  while ((match = tablePattern.exec(sql))) tables.add(match[1]);
  return [...tables].sort();
}

export function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function localJsonCollections(db = {}) {
  const merged = { ...blankDb(), ...db };
  return Object.keys(merged).filter((key) => Array.isArray(merged[key])).sort();
}

export function validateSqlCoverage({ sqlPath, db = {} }) {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const sqlTables = parseSqlTables(sql);
  const sqlTableSet = new Set(sqlTables);
  const localCollections = localJsonCollections(db);
  const missingTables = localCollections.filter((name) => !sqlTableSet.has(name));
  return {
    ok: missingTables.length === 0,
    schema_sha256: sha256(sql),
    sql_tables: sqlTables,
    local_collections: localCollections,
    missing_tables: missingTables
  };
}

export function applyLocalJsonMigration({ dbPath, sqlPath, version = DEFAULT_MIGRATION_VERSION, name = DEFAULT_MIGRATION_NAME }) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = { ...blankDb(), ...readJsonFile(dbPath, blankDb()) };
  const coverage = validateSqlCoverage({ sqlPath, db });
  if (!coverage.ok) {
    const missing = coverage.missing_tables.join(', ');
    throw new Error(`SQL handoff schema is missing local JSON collections: ${missing}`);
  }

  db.schema_migrations = Array.isArray(db.schema_migrations) ? db.schema_migrations : [];
  const existing = db.schema_migrations.find((migration) => migration.version === version);
  if (existing && existing.schema_sha256 !== coverage.schema_sha256) {
    throw new Error(`Migration version ${version} was already applied with a different SQL schema hash. Create a new migration version.`);
  }

  const record = {
    version,
    name,
    driver: 'local-json',
    schema_path: path.relative(process.cwd(), sqlPath),
    schema_sha256: coverage.schema_sha256,
    local_collections: coverage.local_collections,
    sql_tables: coverage.sql_tables,
    applied_at: existing?.applied_at || new Date().toISOString()
  };

  if (!existing) {
    db.schema_migrations.push(record);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    return { ...coverage, applied: true, record };
  }

  return { ...coverage, applied: false, record: existing };
}

export function postgresDocumentStoreSql() {
  return `
create table if not exists workforce_app_documents (
  id text primary key,
  document_json jsonb not null,
  updated_at timestamptz not null default now()
);
`;
}

export function postgresMigrationRecordSql({ version, name, sqlPath, schemaSha256, coverage }) {
  const quote = (value) => String(value).replace(/'/g, "''");
  return `
insert into schema_migrations (
  version,
  name,
  driver,
  schema_path,
  schema_sha256,
  local_collections_json,
  sql_tables_json,
  applied_at
)
values (
  '${quote(version)}',
  '${quote(name)}',
  'postgres',
  '${quote(path.relative(process.cwd(), sqlPath))}',
  '${quote(schemaSha256)}',
  '${quote(JSON.stringify(coverage.local_collections))}',
  '${quote(JSON.stringify(coverage.sql_tables.concat(['workforce_app_documents']).sort()))}',
  now()::text
)
on conflict (version) do update set
  name = excluded.name,
  driver = excluded.driver,
  schema_path = excluded.schema_path,
  schema_sha256 = excluded.schema_sha256,
  local_collections_json = excluded.local_collections_json,
  sql_tables_json = excluded.sql_tables_json;
`;
}

export function applyPostgresMigration({
  sqlPath,
  env = process.env,
  version = POSTGRES_MIGRATION_VERSION,
  name = POSTGRES_MIGRATION_NAME
}) {
  const coverage = validateSqlCoverage({ sqlPath });
  if (!coverage.ok) {
    const missing = coverage.missing_tables.join(', ');
    throw new Error(`SQL handoff schema is missing local JSON collections: ${missing}`);
  }
  assertPostgresMigrationConfig(env);
  const schema = fs.readFileSync(sqlPath, 'utf8');
  const schemaSha256 = coverage.schema_sha256;
  const sql = [
    'begin;',
    schema,
    postgresDocumentStoreSql(),
    postgresMigrationRecordSql({ version, name, sqlPath, schemaSha256, coverage }),
    'commit;'
  ].join('\n');
  runPsql({ env, sql });
  return { ...coverage, applied: true, driver: 'postgres', version };
}
