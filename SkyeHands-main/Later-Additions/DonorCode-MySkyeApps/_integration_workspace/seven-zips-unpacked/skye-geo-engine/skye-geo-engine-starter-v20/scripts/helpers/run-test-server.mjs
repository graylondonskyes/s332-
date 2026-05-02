import { startTestServer } from './test-server.mjs';

const port = Number(process.env.SKYE_TEST_SERVER_PORT || 8787);
const dbMode = process.env.DB_MODE || 'memory';

const server = await startTestServer({ port, runtimeEnv: { DB_MODE: dbMode } });
console.log(JSON.stringify({ ok: true, origin: server.origin, port }));

const close = async () => {
  try { await server.close(); } finally { process.exit(0); }
};

process.on('SIGINT', close);
process.on('SIGTERM', close);
process.stdin.resume();
