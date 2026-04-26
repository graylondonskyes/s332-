#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['platform/user-platforms/skyehands-codex-real-platform/skyehands-deploy-automation.mjs','smoke'], { stdio:'inherit' });
process.exit(result.status ?? 1);
