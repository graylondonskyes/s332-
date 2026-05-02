require('dotenv').config();
const axios = require('axios');

const baseURL = process.env.MCP_URL || 'http://127.0.0.1:3003';
const token = process.env.SKYE_TOKEN || process.env.MCP_API_TOKEN;

if (!token) {
  console.error('Set SKYE_TOKEN for Skyegate auth or MCP_API_TOKEN for local fallback auth.');
  process.exit(1);
}

const client = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    Authorization: `Bearer ${token}`
  }
});

async function main() {
  const ls = await client.get('/ls', { params: { path: process.env.MCP_LIST_PATH || '.' } });
  console.log('Repository entries:', ls.data.entries.slice(0, 10));

  const readPath = process.env.MCP_READ_PATH || 'README.md';
  const read = await client.get('/read', { params: { path: readPath } });
  console.log(`Read ${readPath}:`, read.data.content.slice(0, 400));

  if (process.env.MCP_WRITE_DEMO === '1') {
    const writePath = process.env.MCP_WRITE_PATH || 'mcp-ai-client-demo.txt';
    const endpoint = process.env.MCP_USE_DISPATCH === '1' ? '/dispatch-write' : '/write';
    const write = await client.post(endpoint, {
      path: writePath,
      content: `AI client demo update at ${new Date().toISOString()}\n`,
      title: `MCP AI client demo: ${writePath}`,
      body: 'Created by examples/ai-client.js using Skyegate-compatible auth.'
    });
    console.log('Write result:', write.data);
  }
}

main().catch(err => {
  if (err.response) {
    console.error('Request failed:', err.response.status, err.response.data);
  } else {
    console.error(err);
  }
  process.exit(1);
});
