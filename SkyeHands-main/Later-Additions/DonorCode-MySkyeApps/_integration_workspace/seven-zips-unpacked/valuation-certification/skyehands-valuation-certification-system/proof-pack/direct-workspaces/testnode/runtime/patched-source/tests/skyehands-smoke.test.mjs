import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('package metadata is present', () => {
  assert.equal(fs.existsSync('package.json'), true);
});

test('project has a visible entry surface', () => {
  const hasHtml = fs.existsSync('index.html') || fs.existsSync('public/index.html');
  const hasRuntime = fs.existsSync('server.mjs') || fs.existsSync('server.js') || fs.existsSync('app.py') || fs.existsSync('main.py');
  assert.equal(hasHtml || hasRuntime, true);
});
