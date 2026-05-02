#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const script = path.join(repoRoot, 'platform/user-platforms/skyehands-codex-control-plane/skyehands-codex-control-plane.mjs');
const result = spawnSync(process.execPath, [script, 'smoke'], { cwd: repoRoot, stdio: 'inherit' });
process.exit(result.status ?? 1);
