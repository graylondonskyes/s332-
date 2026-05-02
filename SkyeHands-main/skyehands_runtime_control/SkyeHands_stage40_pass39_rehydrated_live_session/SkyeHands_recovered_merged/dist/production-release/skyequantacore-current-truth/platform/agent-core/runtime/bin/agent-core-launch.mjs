#!/usr/bin/env node
import { createAgentCoreRuntime } from '../lib/server.mjs';

const runtime = createAgentCoreRuntime({
  host: process.env.AGENT_CORE_RUNTIME_HOST || '127.0.0.1',
  port: process.env.AGENT_CORE_RUNTIME_PORT || 8953
});

await runtime.listen();
console.log(JSON.stringify({ ok: true, host: runtime.host, port: runtime.port }));
