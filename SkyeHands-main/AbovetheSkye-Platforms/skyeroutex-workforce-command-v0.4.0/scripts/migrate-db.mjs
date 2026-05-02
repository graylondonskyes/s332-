import path from 'path';
import {
  applyLocalJsonMigration,
  applyPostgresMigration,
  assertLocalJsonMigrationDriver,
  DEFAULT_MIGRATION_NAME,
  DEFAULT_MIGRATION_VERSION,
  POSTGRES_MIGRATION_NAME,
  POSTGRES_MIGRATION_VERSION,
  validateSqlCoverage
} from './migration-utils.mjs';

const root = process.cwd();
const driver = process.env.DATABASE_DRIVER || 'local-json';
const dbPath = path.resolve(process.env.DATABASE_PATH || path.join(root, 'data', 'skyeroutex-db.json'));
const sqlPath = path.resolve(process.env.WORKFORCE_SCHEMA_PATH || path.join(root, 'schema', 'workforce-command.sql'));
const version = process.env.MIGRATION_VERSION || DEFAULT_MIGRATION_VERSION;
const name = process.env.MIGRATION_NAME || DEFAULT_MIGRATION_NAME;

const checkOnly = process.argv.includes('--check');
let result;

if (driver === 'postgres') {
  result = checkOnly
    ? validateSqlCoverage({ sqlPath })
    : applyPostgresMigration({
        sqlPath,
        version: process.env.MIGRATION_VERSION || POSTGRES_MIGRATION_VERSION,
        name: process.env.MIGRATION_NAME || POSTGRES_MIGRATION_NAME
      });
} else {
  assertLocalJsonMigrationDriver(driver);
  result = checkOnly
    ? validateSqlCoverage({ sqlPath })
    : applyLocalJsonMigration({ dbPath, sqlPath, version, name });
}

if (!result.ok) {
  throw new Error(`SQL handoff schema is missing local JSON collections: ${result.missing_tables.join(', ')}`);
}

if (checkOnly) {
  console.log(`Migration check passed: ${result.local_collections.length} local collections represented in ${path.relative(root, sqlPath)}`);
} else {
  console.log(`${result.applied ? 'Migration applied' : 'Migration already current'}: ${result.version || version}`);
  if (driver === 'postgres') console.log('Database driver: postgres');
  else console.log(`Database path: ${dbPath}`);
  console.log(`SQL schema hash: ${result.schema_sha256}`);
}
