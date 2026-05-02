#!/usr/bin/env node
import path from 'node:path';
import { composeOrchestrationSnapshot } from '../lib/skydexia-orchestrator.mjs';

const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const args = process.argv.slice(2);
const ids = args.filter((item) => item.startsWith('cap=')).map((item) => item.slice(4));
const snapshot = composeOrchestrationSnapshot(rootDir, ids);
console.log(JSON.stringify(snapshot, null, 2));
if (!snapshot.ok) process.exit(1);
