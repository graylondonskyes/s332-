require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');

const root = path.resolve(__dirname, '..');
const artifactPath = path.join(root, 'artifacts', 'live-e2e-proof.json');

function writeProof(proof) {
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify(proof, null, 2) + '\n');
}

function hasAny(names) {
  return names.some(name => Boolean(process.env[name]));
}

function missingLiveVars() {
  const missing = [];
  if (!process.env.SKYEGATE_INTROSPECT_URL) missing.push('SKYEGATE_INTROSPECT_URL');
  if (!process.env.SKYE_TOKEN) missing.push('SKYE_TOKEN');
  if (!process.env.REPO_OWNER) missing.push('REPO_OWNER');
  if (!process.env.REPO_NAME) missing.push('REPO_NAME');
  if (!hasAny(['GITHUB_TOKEN', 'GITHUB_APP_ID'])) missing.push('GITHUB_TOKEN or GitHub App env');
  if (process.env.GITHUB_APP_ID) {
    if (!process.env.GITHUB_APP_INSTALLATION_ID) missing.push('GITHUB_APP_INSTALLATION_ID');
    if (!hasAny(['GITHUB_APP_PRIVATE_KEY', 'GITHUB_APP_PRIVATE_KEY_BASE64'])) {
      missing.push('GITHUB_APP_PRIVATE_KEY or GITHUB_APP_PRIVATE_KEY_BASE64');
    }
  }
  return missing;
}

function spawnServer() {
  const port = process.env.PORT || '3003';
  const child = spawn(process.execPath, ['index.js'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: port }
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  return { child, output: () => output, baseURL: `http://127.0.0.1:${port}` };
}

async function waitForHealth(baseURL) {
  const deadline = Date.now() + Number(process.env.LIVE_E2E_START_TIMEOUT_MS || 10000);
  let lastErr;
  while (Date.now() < deadline) {
    try {
      await axios.get(`${baseURL}/health`, { timeout: 1000 });
      return;
    } catch (err) {
      lastErr = err;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  throw lastErr || new Error('MCP server did not become healthy');
}

async function runClient(baseURL) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['examples/ai-client.js'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MCP_URL: baseURL,
        MCP_WRITE_DEMO: '1',
        MCP_WRITE_PATH: process.env.LIVE_E2E_WRITE_PATH || `live-e2e-${Date.now()}.txt`,
        MCP_USE_DISPATCH: process.env.LIVE_E2E_USE_DISPATCH || '0'
      }
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk.toString(); });
    child.stderr.on('data', chunk => { output += chunk.toString(); });
    child.on('exit', code => {
      if (code === 0) return resolve(output);
      const err = new Error(`examples/ai-client.js exited ${code}`);
      err.output = output;
      reject(err);
    });
  });
}

async function main() {
  const missing = missingLiveVars();
  if (missing.length) {
    const proof = {
      ok: false,
      blocked: true,
      reason: 'missing live credentials',
      missing,
      checkedAt: new Date().toISOString()
    };
    writeProof(proof);
    console.error(JSON.stringify(proof, null, 2));
    process.exit(2);
  }

  const { child, output, baseURL } = spawnServer();
  try {
    await waitForHealth(baseURL);
    const clientOutput = await runClient(baseURL);
    const proof = {
      ok: true,
      blocked: false,
      mode: process.env.LIVE_E2E_USE_DISPATCH === '1' ? 'repository_dispatch' : 'direct_pr',
      baseURL,
      checkedAt: new Date().toISOString(),
      evidence: {
        clientOutput
      }
    };
    writeProof(proof);
    console.log(JSON.stringify(proof, null, 2));
  } catch (err) {
    const proof = {
      ok: false,
      blocked: false,
      reason: err.message,
      checkedAt: new Date().toISOString(),
      evidence: {
        clientOutput: err.output || '',
        serverOutput: output()
      }
    };
    writeProof(proof);
    console.error(JSON.stringify(proof, null, 2));
    process.exit(1);
  } finally {
    child.kill();
    if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve));
  }
}

main();
