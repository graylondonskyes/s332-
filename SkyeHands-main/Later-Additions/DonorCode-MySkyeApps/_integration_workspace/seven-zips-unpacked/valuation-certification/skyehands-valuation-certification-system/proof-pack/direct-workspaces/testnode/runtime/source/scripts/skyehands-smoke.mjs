#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const runtimeTarget = path.join(root, "server.mjs");
const staticTarget = path.join(root, "public/index.html");

if (runtimeTarget && !fs.existsSync(runtimeTarget)) {
  console.error(`Missing runtime target: ${runtimeTarget}`);
  process.exit(1);
}

if (staticTarget) {
  const html = fs.readFileSync(staticTarget, 'utf8');
  if (!/<title>/i.test(html) && !/<!doctype/i.test(html)) {
    console.error('Static surface missing title or doctype proof.');
    process.exit(1);
  }
}

console.log('skyehands smoke ok');
