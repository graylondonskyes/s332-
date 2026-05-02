/**
 * Build-time DB initializer.
 * Runs during Netlify build to ensure schema exists.
 *
 * Priority for connection string:
 * 1) NETLIFY_DATABASE_URL (Netlify DB / Neon extension)
 * 2) NEON_DATABASE_URL
 * 3) DATABASE_URL
 */
const { Client } = require("pg");

const url = process.env.NETLIFY_DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

async function main() {
  if (!url) {
    console.log("[db-init] No database URL present. Skipping DB init.");
    return;
  }

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS intake_submissions (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      lane TEXT NOT NULL,
      name TEXT,
      email TEXT,
      phone TEXT,
      company TEXT,
      role TEXT,
      ip TEXT,
      user_agent TEXT,
      payload JSONB NOT NULL
    );
  `);

  await client.end();
  console.log("[db-init] Schema ensured: intake_submissions");
}

main().catch((err) => {
  console.error("[db-init] Failed:", err);
  process.exitCode = 0; // do not fail build; functions can still run forms-only mode
});
