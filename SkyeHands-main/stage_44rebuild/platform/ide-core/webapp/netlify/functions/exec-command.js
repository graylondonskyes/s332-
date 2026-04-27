'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const WORKSPACE_ROOT = process.env.SKYEHANDS_WORKSPACE_ROOT || '/tmp/skyehands-workspace';

const ALLOWED_COMMANDS = new Set([
  'node', 'npm', 'npx', 'yarn', 'pnpm',
  'git', 'ls', 'cat', 'pwd', 'echo',
  'mkdir', 'touch', 'cp', 'mv', 'rm',
  'grep', 'find', 'sed', 'awk', 'sort', 'head', 'tail', 'wc',
  'python3', 'python', 'pip3', 'pip',
  'bash', 'sh',
  'curl', 'wget',
  'netlify', 'vercel',
  'jest', 'vitest', 'mocha',
]);

const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//, />\s*\/dev\/sd/, /mkfs/, /dd\s+if/,
  /chmod\s+777\s+\//, /:\(\)\{.*fork\}/, /sudo\s+rm/,
];

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST required' }) };

  try {
    const { command, args = [], cwd: relCwd = '' } = JSON.parse(event.body || '{}');
    if (!command) return { statusCode: 400, headers, body: JSON.stringify({ error: 'command required' }) };

    const cmd = command.trim().split(/\s+/)[0];
    if (!ALLOWED_COMMANDS.has(cmd)) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: `Command '${cmd}' not in allowlist` }) };
    }

    const fullCmd = [command.trim(), ...args].join(' ');
    if (BLOCKED_PATTERNS.some(re => re.test(fullCmd))) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Command blocked by security policy' }) };
    }

    const cwdAbs = path.resolve(WORKSPACE_ROOT, relCwd);
    if (!cwdAbs.startsWith(WORKSPACE_ROOT)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'cwd outside workspace' }) };
    }
    if (!fs.existsSync(cwdAbs)) fs.mkdirSync(cwdAbs, { recursive: true });

    const result = spawnSync(cmd, [command.trim().slice(cmd.length).trim(), ...args].filter(Boolean), {
      cwd: cwdAbs,
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 512 * 1024,
      env: { ...process.env, HOME: WORKSPACE_ROOT, TERM: 'xterm-256color' },
    });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.status ?? -1,
        signal: result.signal || null,
        command: fullCmd,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
