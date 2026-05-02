import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

export function blankDb() {
  return {
    users: [], sessions: [], admin_invites: [], markets: [], contractor_profiles: [], provider_profiles: [], crew_profiles: [], crew_members: [],
    jobs: [], job_applications: [], job_assignments: [], proof_items: [], proof_media: [], payment_ledger: [], ratings: [],
    provider_rosters: [], provider_blocks: [], disputes: [], dispute_evidence: [], notifications: [], autonomous_recommendations: [],
    route_jobs: [], route_stops: [], export_packets: [], audit_events: [], runtime_events: [], compliance_checks: [], integration_outbox: [], provider_webhooks: [],
    schema_migrations: []
  };
}

function databaseUrl(env) {
  return env.DATABASE_URL || env.POSTGRES_URL || '';
}

function assertPostgresConfig(env) {
  const url = databaseUrl(env);
  if (!url) {
    throw new Error('DATABASE_DRIVER=postgres requires DATABASE_URL or POSTGRES_URL. Refusing to boot without an explicit Postgres connection URL.');
  }
  return url;
}

function runPsql({ env, sql, args = [] }) {
  const url = assertPostgresConfig(env);
  const psqlBin = env.PSQL_BIN || 'psql';
  const wrapperArgs = env.PSQL_WRAPPER_SCRIPT ? [env.PSQL_WRAPPER_SCRIPT] : [];
  const baseArgs = ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--dbname', url];
  const cleanup = [];
  let finalArgs = baseArgs.concat(args);

  if (sql !== undefined) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skyeroutex-psql-'));
    const file = path.join(dir, 'command.sql');
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

function sqlDollarQuote(value) {
  const tag = `skyeroutex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  return `$${tag}$${value}$${tag}$`;
}

function postgresDatabaseAdapter({ env }) {
  assertPostgresConfig(env);
  return {
    driver: 'postgres',
    document_id: env.WORKFORCE_DOCUMENT_ID || 'default',
    load() {
      const id = this.document_id.replace(/'/g, "''");
      let output;
      try {
        output = runPsql({
          env,
          args: ['--tuples-only', '--no-align', '--command', `select document_json::text from workforce_app_documents where id = '${id}';`]
        }).trim();
      } catch (err) {
        if (String(err.message || '').includes('workforce_app_documents')) {
          throw new Error('Postgres workforce document table is missing. Run `npm run migrate` with DATABASE_DRIVER=postgres before booting.');
        }
        throw err;
      }
      if (!output) return blankDb();
      return { ...blankDb(), ...JSON.parse(output) };
    },
    save(db) {
      const id = this.document_id.replace(/'/g, "''");
      const documentJson = sqlDollarQuote(JSON.stringify({ ...blankDb(), ...db }));
      runPsql({
        env,
        sql: [
          'begin;',
          'insert into workforce_app_documents (id, document_json, updated_at)',
          `values ('${id}', ${documentJson}::jsonb, now())`,
          'on conflict (id) do update set document_json = excluded.document_json, updated_at = excluded.updated_at;',
          'commit;'
        ].join('\n')
      });
    },
    mutate(fn) {
      const db = this.load();
      const result = fn(db);
      this.save(db);
      return result;
    },
    status() {
      return { driver: this.driver, document_id: this.document_id };
    }
  };
}

function unsupportedDatabaseAdapter(driver) {
  throw new Error(`DATABASE_DRIVER=${driver} is unsupported. Use local-json or postgres.`);
}

function localJsonDatabaseAdapter({ dbPath }) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return {
    driver: 'local-json',
    path: dbPath,
    load() {
      if (!fs.existsSync(dbPath)) return blankDb();
      return { ...blankDb(), ...JSON.parse(fs.readFileSync(dbPath, 'utf8')) };
    },
    save(db) {
      fs.writeFileSync(dbPath, JSON.stringify({ ...blankDb(), ...db }, null, 2));
    },
    mutate(fn) {
      const db = this.load();
      const result = fn(db);
      this.save(db);
      return result;
    },
    status() {
      return { driver: this.driver, database_path: this.path };
    }
  };
}

export function createDatabaseAdapter({ root, env = process.env } = {}) {
  const driver = env.DATABASE_DRIVER || 'local-json';
  const dbPath = path.resolve(env.DATABASE_PATH || path.join(root, 'data', 'skyeroutex-db.json'));
  if (driver === 'local-json') return localJsonDatabaseAdapter({ dbPath });
  if (driver === 'postgres') return postgresDatabaseAdapter({ env });
  return unsupportedDatabaseAdapter(driver);
}
