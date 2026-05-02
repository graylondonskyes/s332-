const { Octokit } = require('@octokit/rest');
const jwt = require('jsonwebtoken');

function normalizePrivateKey(value) {
  if (!value) return null;
  if (value.includes('BEGIN')) return value.replace(/\\n/g, '\n');
  return Buffer.from(value, 'base64').toString('utf8');
}

async function createInstallationToken() {
  const appId = process.env.GITHUB_APP_ID;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const privateKey = normalizePrivateKey(process.env.GITHUB_APP_PRIVATE_KEY || process.env.GITHUB_APP_PRIVATE_KEY_BASE64);
  if (!appId || !installationId || !privateKey) return null;

  const now = Math.floor(Date.now() / 1000);
  const appJwt = jwt.sign(
    {
      iat: now - 60,
      exp: now + 9 * 60,
      iss: appId
    },
    privateKey,
    { algorithm: 'RS256' }
  );

  const appOctokit = new Octokit({ auth: appJwt });
  const { data } = await appOctokit.apps.createInstallationAccessToken({
    installation_id: installationId
  });
  return data.token;
}

class GitHubClient {
  constructor(octokit, owner, repo) {
    this.octokit = octokit;
    this.owner = owner;
    this.repo = repo;
  }

  static async fromEnv() {
    const token = process.env.GITHUB_TOKEN || await createInstallationToken();
    const owner = process.env.REPO_OWNER;
    const repo = process.env.REPO_NAME;
    if (!token || !owner || !repo) return null;
    const octokit = new Octokit({
      auth: token,
      baseUrl: process.env.GITHUB_API_BASE_URL || 'https://api.github.com'
    });
    return new GitHubClient(octokit, owner, repo);
  }

  async getDefaultBranch() {
    const { data } = await this.octokit.repos.get({ owner: this.owner, repo: this.repo });
    return data.default_branch;
  }

  async ensureBranch(branch) {
    const defaultBranch = await this.getDefaultBranch();
    const { data: refData } = await this.octokit.git.getRef({ owner: this.owner, repo: this.repo, ref: `heads/${defaultBranch}` });
    const sha = refData.object.sha;
    // try create ref
    try {
      await this.octokit.git.createRef({ owner: this.owner, repo: this.repo, ref: `refs/heads/${branch}`, sha });
    } catch (err) {
      // if already exists, ignore
    }
    return branch;
  }

  async createFileOnBranch({ path, content, branch, message }) {
    await this.ensureBranch(branch);
    const params = { owner: this.owner, repo: this.repo, path, message, content, branch };
    try {
      const existing = await this.octokit.repos.getContent({ owner: this.owner, repo: this.repo, path, ref: branch });
      if (!Array.isArray(existing.data) && existing.data.sha) params.sha = existing.data.sha;
    } catch (err) {
      if (err.status !== 404) throw err;
    }
    const resp = await this.octokit.repos.createOrUpdateFileContents(params);
    return resp.data;
  }

  async createPullRequest({ head, title, body }) {
    const base = await this.getDefaultBranch();
    const { data } = await this.octokit.pulls.create({ owner: this.owner, repo: this.repo, head, base, title, body });
    return data;
  }

  async dispatchCreatePr(payload) {
    const { data } = await this.octokit.repos.createDispatchEvent({
      owner: this.owner,
      repo: this.repo,
      event_type: 'create-pr',
      client_payload: payload
    });
    return data || { dispatched: true };
  }
}

module.exports = GitHubClient;
