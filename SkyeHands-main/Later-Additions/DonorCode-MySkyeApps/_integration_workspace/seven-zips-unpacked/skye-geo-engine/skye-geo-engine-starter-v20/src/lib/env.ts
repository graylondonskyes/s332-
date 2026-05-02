import { AppError } from './errors.ts';

export type RuntimeEnv = {
  DB_MODE?: string;
  NEON_SQL_URL?: string;
  NEON_SQL_AUTH_TOKEN?: string;
  APP_BASE_URL?: string;
};

export type ResolvedEnv = {
  dbMode: 'memory' | 'neon-http';
  neonSqlUrl: string | null;
  neonSqlAuthToken: string | null;
  appBaseUrl: string | null;
};

export function resolveEnv(input: unknown): ResolvedEnv {
  const env = (input || {}) as RuntimeEnv;
  const requested = String(env.DB_MODE || '').trim().toLowerCase();
  const dbMode: 'memory' | 'neon-http' = requested === 'neon-http' ? 'neon-http' : 'memory';
  const neonSqlUrl = env.NEON_SQL_URL?.trim() || null;
  const neonSqlAuthToken = env.NEON_SQL_AUTH_TOKEN?.trim() || null;
  if (dbMode === 'neon-http' && !neonSqlUrl) {
    throw new AppError(500, 'missing_neon_sql_url', 'DB_MODE=neon-http requires NEON_SQL_URL.');
  }
  return {
    dbMode,
    neonSqlUrl,
    neonSqlAuthToken,
    appBaseUrl: env.APP_BASE_URL?.trim() || null
  };
}
