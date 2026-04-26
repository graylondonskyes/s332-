#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const script = 'platform/user-platforms/skyehands-codex-real-platform/skyehands-platform-db.mjs';
const result = spawnSync(process.execPath, [script, 'smoke', process.argv[2] || 'local'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
