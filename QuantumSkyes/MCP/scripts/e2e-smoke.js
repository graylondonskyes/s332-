const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const express = require('express');
const axios = require('axios');

function listen(app, port) {
  return new Promise(resolve => {
    const server = app.listen(port, '127.0.0.1', () => resolve(server));
  });
}

function close(server) {
  return new Promise(resolve => server.close(resolve));
}

function runNode(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: __dirname + '/..',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...env }
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    child.stderr.on('data', chunk => { output += chunk.toString(); });
    child.on('exit', code => {
      if (code === 0) return resolve(output);
      const err = new Error(`node ${args.join(' ')} exited ${code}`);
      err.output = output;
      reject(err);
    });
  });
}

function mockSkyegate() {
  const app = express();
  app.use(express.json());
  app.post('/introspect', (req, res) => {
    if (req.body.token === 'skyegate-write') {
      return res.json({
        active: true,
        sub: 'user:e2e',
        org: 'skye-labs',
        roles: ['repo.write'],
        aud: ['mcp']
      });
    }
    if (req.body.token === 'skyegate-readonly') {
      return res.json({
        active: true,
        sub: 'user:readonly',
        org: 'skye-labs',
        roles: ['repo.read'],
        aud: ['mcp']
      });
    }
    return res.json({ active: false });
  });
  return app;
}

function mockBilling(state) {
  const app = express();
  app.use(express.json());
  app.post('/meter', (req, res) => {
    state.metered.push(req.body);
    if (req.body.metadata && req.body.metadata.path === 'quota-denied.txt') {
      return res.json({ allowed: false, reason: 'quota exhausted in e2e smoke' });
    }
    return res.json({ allowed: true, remaining: 41, usage_id: `usage-${state.metered.length}` });
  });
  return app;
}

function mockGitHub(state) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/repos/:owner/:repo', (req, res) => {
    state.github.push({ method: req.method, path: req.path });
    res.json({ default_branch: 'main' });
  });

  app.get('/repos/:owner/:repo/git/ref/:ref', (req, res) => {
    state.github.push({ method: req.method, path: req.path });
    const branch = req.params.ref.split('/').pop();
    res.json({ object: { sha: `${branch}-sha` } });
  });

  app.post('/repos/:owner/:repo/git/refs', (req, res) => {
    state.github.push({ method: req.method, path: req.path, body: req.body });
    res.status(201).json({ ref: req.body.ref, object: { sha: req.body.sha } });
  });

  app.get('/repos/:owner/:repo/contents/*', (req, res) => {
    state.github.push({ method: req.method, path: req.path, query: req.query });
    res.status(404).json({ message: 'Not Found' });
  });

  app.put('/repos/:owner/:repo/contents/*', (req, res) => {
    state.github.push({ method: req.method, path: req.path, body: req.body });
    res.json({
      content: { path: req.params[0], sha: 'content-sha' },
      commit: { sha: 'commit-sha', message: req.body.message }
    });
  });

  app.post('/repos/:owner/:repo/pulls', (req, res) => {
    state.github.push({ method: req.method, path: req.path, body: req.body });
    res.status(201).json({
      number: 13,
      html_url: 'https://example.invalid/skye/pr/13',
      title: req.body.title,
      body: req.body.body
    });
  });

  app.post('/repos/:owner/:repo/dispatches', (req, res) => {
    state.github.push({ method: req.method, path: req.path, body: req.body });
    res.status(204).end();
  });

  return app;
}

async function waitForHealth(baseURL) {
  const deadline = Date.now() + 10000;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      await axios.get(`${baseURL}/health`, { timeout: 500 });
      return;
    } catch (err) {
      lastErr = err;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw lastErr || new Error('MCP server did not become healthy');
}

async function main() {
  const state = { metered: [], github: [] };
  const [skyegate, billing, github] = await Promise.all([
    listen(mockSkyegate(), 4301),
    listen(mockBilling(state), 4302),
    listen(mockGitHub(state), 4303)
  ]);

  const mcp = spawn(process.execPath, ['index.js'], {
    cwd: __dirname + '/..',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: '4300',
      MCP_API_TOKEN: 'local-mcp-token',
      REPO_ROOT: __dirname + '/..',
      SKYEGATE_INTROSPECT_URL: 'http://127.0.0.1:4301/introspect',
      SKYEGATE_AUD: 'mcp',
      SKYE_BILLING_METER_URL: 'http://127.0.0.1:4302/meter',
      GITHUB_API_BASE_URL: 'http://127.0.0.1:4303',
      GITHUB_TOKEN: 'mock-gh-token',
      REPO_OWNER: 'mock-owner',
      REPO_NAME: 'mock-repo',
      MCP_DISPATCH_SECRET: 'dispatch-secret-e2e'
    }
  });

  let mcpOutput = '';
  mcp.stdout.on('data', chunk => { mcpOutput += chunk.toString(); });
  mcp.stderr.on('data', chunk => { mcpOutput += chunk.toString(); });

  try {
    const baseURL = 'http://127.0.0.1:4300';
    await waitForHealth(baseURL);
    const client = axios.create({
      baseURL,
      timeout: 5000,
      headers: { Authorization: 'Bearer skyegate-write' }
    });

    const ls = await client.get('/ls', { params: { path: '.' } });
    assert(Array.isArray(ls.data.entries), 'ls should return entries');

    const read = await client.get('/read', { params: { path: 'README.md' } });
    assert(read.data.content.includes('QuantumSkyes MCP'), 'read should return README content');

    const write = await client.post('/write', {
      path: 'e2e-smoke.txt',
      content: 'hello from e2e smoke\n',
      title: 'E2E smoke write',
      body: 'Smoke proof body'
    });
    assert.strictEqual(write.data.branch.startsWith('mcp/auto-'), true);
    assert.strictEqual(write.data.pr.number, 13);
    assert(write.data.pr.body.includes('Requested via Skyegate user: user:e2e'));
    assert(write.data.pr.body.includes('Skyegate metering'));

    await assert.rejects(
      client.post('/write', {
        path: 'quota-denied.txt',
        content: 'no quota\n',
        title: 'Quota denied'
      }),
      err => err.response && err.response.status === 402
    );

    const readonly = axios.create({
      baseURL,
      timeout: 5000,
      headers: { Authorization: 'Bearer skyegate-readonly' }
    });
    await assert.rejects(
      readonly.post('/write', {
        path: 'readonly-denied.txt',
        content: 'no role\n',
        title: 'Readonly denied'
      }),
      err => err.response && err.response.status === 403
    );

    const dispatch = await client.post('/dispatch-write', {
      path: 'dispatch-smoke.txt',
      content: 'hello from dispatch\n',
      title: 'E2E dispatch write',
      body: 'Dispatch smoke body'
    });
    assert.strictEqual(dispatch.data.dispatched, true);

    const aiClientOutput = await runNode(['examples/ai-client.js'], {
      MCP_URL: baseURL,
      SKYE_TOKEN: 'skyegate-write',
      MCP_WRITE_DEMO: '1',
      MCP_USE_DISPATCH: '1',
      MCP_READ_PATH: 'README.md'
    });
    assert(aiClientOutput.includes('Repository entries:'), 'example AI client should list repo entries');
    assert(aiClientOutput.includes('Write result:'), 'example AI client should exercise write flow');

    assert(state.metered.some(item => item.action === 'write_pr'), 'billing should meter direct write');
    assert(state.metered.some(item => item.action === 'dispatch_write_pr'), 'billing should meter dispatch write');
    assert(state.github.some(item => item.path.endsWith('/pulls')), 'GitHub mock should receive PR create');
    assert(state.github.some(item => item.path.endsWith('/dispatches')), 'GitHub mock should receive dispatch event');

    const proof = {
      ok: true,
      checks: [
        'health',
        'Skyegate introspection',
        'repo listing',
        'file read',
        'role-gated write and PR creation',
        'billing quota rejection',
        'readonly role rejection',
        'repository_dispatch write',
        'example AI client read/write flow'
      ],
      meteringCalls: state.metered.length,
      githubCalls: state.github.length
    };
    const artifactPath = path.resolve(__dirname, '..', 'artifacts', 'e2e-smoke-proof.json');
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, JSON.stringify(proof, null, 2) + '\n');
    console.log(JSON.stringify(proof, null, 2));
  } finally {
    mcp.kill();
    await Promise.all([close(skyegate), close(billing), close(github)]);
    if (mcp.exitCode === null) {
      await new Promise(resolve => mcp.once('exit', resolve));
    }
    if (process.exitCode) {
      console.error(mcpOutput);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
