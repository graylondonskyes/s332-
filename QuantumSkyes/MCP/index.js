require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const { requireAuth } = require('./lib/auth');
const GitHubClient = require('./lib/githubClient');
const { requireWriteAccess, meterWrite, skyegatePrAnnotation } = require('./lib/writePolicy');

const app = express();
app.use(bodyParser.json({ limit: '5mb' }));

const REPO_ROOT = process.env.REPO_ROOT || path.resolve(__dirname, '..', '..');

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/ls', requireAuth, async (req, res) => {
  try {
    const rel = req.query.path || '.';
    const full = path.resolve(REPO_ROOT, rel);
    const entries = await fs.readdir(full, { withFileTypes: true });
    const out = entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file', path: path.join(rel, e.name) }));
    res.json({ path: rel, entries: out });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/read', requireAuth, async (req, res) => {
  try {
    const rel = req.query.path;
    if (!rel) return res.status(400).json({ error: 'missing path' });
    const full = path.resolve(REPO_ROOT, rel);
    const data = await fs.readFile(full, 'utf8');
    res.json({ path: rel, content: data });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/write', requireAuth, async (req, res) => {
  try {
    const { path: relPath, content, branch, title, body } = req.body;
    if (!relPath || !content) return res.status(400).json({ error: 'missing path or content' });
    if (!requireWriteAccess(req, res)) return;

    const metering = await meterWrite(req, 'write_pr');
    const gh = await GitHubClient.fromEnv();
    if (!gh) return res.status(500).json({ error: 'GitHub client not configured (set GITHUB_TOKEN / REPO_OWNER / REPO_NAME)' });

    const branchName = branch || `mcp/auto-${Date.now()}`;
    const commitMessage = title || `MCP update: ${relPath}`;

    const result = await gh.createFileOnBranch({
      path: relPath,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch: branchName,
      message: commitMessage
    });

    if (!result) return res.status(500).json({ error: 'failed to create/update file' });

    let prBody = body || 'Automated change via MCP server';
    prBody += skyegatePrAnnotation(req.skye, metering);

    const pr = await gh.createPullRequest({
      head: branchName,
      title: title || `MCP: ${relPath}`,
      body: prBody
    });

    res.json({ branch: branchName, commit: result, pr });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || String(err), details: err.details });
  }
});

app.post('/dispatch-write', requireAuth, async (req, res) => {
  try {
    const { path: relPath, content, branch, title, body } = req.body;
    if (!relPath || !content) return res.status(400).json({ error: 'missing path or content' });
    if (!requireWriteAccess(req, res)) return;

    const metering = await meterWrite(req, 'dispatch_write_pr');
    const gh = await GitHubClient.fromEnv();
    if (!gh) return res.status(500).json({ error: 'GitHub client not configured (set GITHUB_TOKEN or GitHub App env plus REPO_OWNER / REPO_NAME)' });

    const prBody = `${body || 'Automated change via MCP repository_dispatch'}${skyegatePrAnnotation(req.skye, metering)}`;
    const payload = {
      path: relPath,
      content,
      branch: branch || `mcp/dispatch-${Date.now()}`,
      message: title || `MCP update: ${relPath}`,
      body: prBody
    };

    if (process.env.MCP_DISPATCH_SECRET) {
      payload.dispatch_secret = process.env.MCP_DISPATCH_SECRET;
    }

    const result = await gh.dispatchCreatePr(payload);
    res.json({ dispatched: true, result, payload: { ...payload, dispatch_secret: payload.dispatch_secret ? '[redacted]' : undefined } });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || String(err), details: err.details });
  }
});

const port = process.env.PORT || 3003;
app.listen(port, () => console.log(`MCP server listening on ${port}`));
