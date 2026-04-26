// Neon serverless postgres client using the HTTP API.
// When NEON_DATABASE_URL is set, executes real SQL against the Neon branch.
// Falls back to a no-op client that returns empty result sets so the rest of
// the runtime degrades gracefully instead of throwing.

const https = require('node:https');
const url = require('node:url');

function parseNeonUrl(connectionString) {
  try {
    const parsed = new url.URL(connectionString);
    const host = parsed.hostname; // e.g. ep-xxx.us-east-2.aws.neon.tech
    const user = decodeURIComponent(parsed.username);
    const pass = decodeURIComponent(parsed.password);
    const database = parsed.pathname.slice(1);
    return { host, user, pass, database };
  } catch {
    return null;
  }
}

// Neon HTTP API: POST https://{host}/sql  with Basic auth
async function neonHttpQuery(connectionString, sqlText, params = []) {
  const conn = parseNeonUrl(connectionString);
  if (!conn) throw new Error('NEON_DATABASE_URL could not be parsed');

  const body = JSON.stringify({ query: sqlText, params });
  const credential = Buffer.from(`${conn.user}:${conn.pass}`).toString('base64');

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: conn.host,
        path: '/sql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'Authorization': `Basic ${credential}`,
          'Neon-Connection-String': connectionString
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            if (res.statusCode >= 400) {
              reject(new Error(`Neon HTTP ${res.statusCode}: ${parsed.message || raw}`));
            } else {
              resolve({ rows: parsed.rows || [], rowCount: parsed.rowCount || 0, fields: parsed.fields || [] });
            }
          } catch {
            reject(new Error(`Neon response parse error: ${raw.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const connectionString = String(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || '').trim();

async function query(sqlText, params = []) {
  if (!connectionString) {
    // No DB configured — degrade gracefully for local dev without Neon creds
    return { rows: [], rowCount: 0, fields: [], _noDatabaseConfigured: true };
  }
  return neonHttpQuery(connectionString, sqlText, params);
}

module.exports = { query };
