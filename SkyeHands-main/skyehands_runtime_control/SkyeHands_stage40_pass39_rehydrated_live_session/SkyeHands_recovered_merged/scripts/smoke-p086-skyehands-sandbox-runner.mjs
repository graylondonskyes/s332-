#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const script = 'platform/user-platforms/skyehands-codex-real-platform/skyehands-sandbox-runner.mjs';
const result = spawnSync(process.execPath, [script, 'smoke'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
