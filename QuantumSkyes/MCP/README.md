# QuantumSkyes MCP server (scaffold)

This folder contains a minimal MCP-style server scaffold that exposes simple repository operations to authorized clients.

Files added:

- `index.js` - Express server with `/ls`, `/read`, `/write`, `/dispatch-write` endpoints
- `lib/auth.js` - simple token-based auth middleware
- `lib/githubClient.js` - helper that uses `GITHUB_TOKEN` or a GitHub App token to create branches, commits, PRs, and dispatch events
- `lib/writePolicy.js` - Skyegate write authorization, metering, and PR annotation helpers
- `examples/ai-client.js` - example Skyegate-compatible AI client
- `.env.example` - example environment variables

Environment (copy `.env.example` -> `.env` and fill):

- `MCP_API_TOKEN` - token clients must present as `Authorization: Bearer <token>`
- `REPO_OWNER`, `REPO_NAME` - target repo for write/PR operations
- `REPO_ROOT` - local filesystem root to serve for `/ls` and `/read` (optional)
- `GITHUB_TOKEN` - optional personal/fine-grained token. If omitted, the server can mint a short-lived GitHub App installation token.
- `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, `GITHUB_APP_PRIVATE_KEY` - GitHub App credentials used to mint short-lived repo tokens.
- `GITHUB_APP_PRIVATE_KEY_BASE64` - alternative to `GITHUB_APP_PRIVATE_KEY` when it is easier to store the PEM as base64.

Skyegate integration

- `SKYEGATE_INTROSPECT_URL` - an introspection endpoint for Skyegate tokens (POST { token }). If set, the server will accept Skyegate tokens in `Authorization: Bearer <token>` or `x-skye-token` headers and will validate them before granting access.
- `SKYEGATE_AUD` - optional audience value that introspection must include (defaults to `mcp`).

When Skyegate introspection is enabled, the server will attach the introspection response to `req.skye` for downstream usage (for example to include user metadata in PR bodies or to enforce role-based write access).

Skyegate write metering

- `SKYE_BILLING_METER_URL` or `SKYEGATE_BILLING_URL` - optional billing/metering endpoint called before `/write` and `/dispatch-write`.
- `SKYE_BILLING_API_KEY` - optional bearer token for the metering endpoint.
- `SKYE_BILLING_TIMEOUT_MS` - optional timeout, default `3000`.

The metering endpoint receives `{ action, sub, org, aud, units, metadata }`. It may return quota metadata for PR annotation. Returning `{ allowed: false }`, `{ active: false }`, or `{ quota_exhausted: true }` rejects the write with HTTP 402.

Run locally:

```bash
cd QuantumSkyes/MCP
npm install
cp .env.example .env
# edit .env
npm start
```

Example AI client:

```bash
cd QuantumSkyes/MCP
SKYE_TOKEN=skyegate-token npm run client:example

# To demonstrate a write/PR flow:
SKYE_TOKEN=skyegate-token MCP_WRITE_DEMO=1 npm run client:example

# To trigger the GitHub Actions repository_dispatch flow instead of direct PR creation:
SKYE_TOKEN=skyegate-token MCP_WRITE_DEMO=1 MCP_USE_DISPATCH=1 npm run client:example
```

End-to-end proof commands:

```bash
# Full local proof with mock Skyegate, billing, and GitHub services.
npm run smoke:e2e

# Live proof. Requires real .env credentials and opens a real PR unless
# LIVE_E2E_USE_DISPATCH=1 is set.
npm run smoke:live
```

`npm run smoke:live` writes `artifacts/live-e2e-proof.json`. If credentials are missing, it records exactly which values are absent instead of silently skipping the live run.

Endpoints (authorized via `Authorization: Bearer <MCP_API_TOKEN>`):

- `GET /ls?path=path` - list directory entries
- `GET /read?path=path` - read file content
- `POST /write` - create/update file and open PR. JSON body: `{ "path": "file.txt", "content": "...", "branch": "optional-branch", "title": "PR title", "body": "PR body"}`
- `POST /dispatch-write` - validate auth/roles/metering, then trigger the `create-pr` GitHub Actions workflow through `repository_dispatch`.

GitHub App + Actions pattern (example)

Under `.github/workflows/create-pr.yml` (in this scaffold) is an example workflow that reacts to `repository_dispatch` events. The MCP server can trigger it through `/dispatch-write` using either `GITHUB_TOKEN` or a short-lived GitHub App installation token.

To use GitHub App auth:

1. Create a GitHub App with repository permissions for `contents: read/write`, `pull requests: read/write`, and `metadata: read`.
2. Install the app on the target repository.
3. Set `REPO_OWNER`, `REPO_NAME`, `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`, and either `GITHUB_APP_PRIVATE_KEY` or `GITHUB_APP_PRIVATE_KEY_BASE64`.
4. Leave `GITHUB_TOKEN` empty if you want the server to mint installation tokens on demand.

To secure the workflow trigger, add a repository secret named `MCP_DISPATCH_SECRET` and set the same value in the MCP server environment. The workflow validates the secret before it writes files or opens a PR.

Security notes (very important):

- Keep `MCP_API_TOKEN` secret and rotate regularly.
- Use scoped GitHub tokens (least privilege).
- Don't enable `REPO_ROOT` pointing to sensitive paths.
- Run the server behind an authenticated gateway and/or within a private network.

Customization ideas (specific & innovative)

- Use `req.skye` to annotate PRs with the requesting user's `sub` and `org` so PRs are traceable to your Skyegate identities.
- Enforce Skyegate role checks (e.g., `roles.includes('repo.write')`) before allowing `/write` actions.
- Implement usage metering by calling your Skyegate billing endpoints on each `/write` and rejecting if a user's quota is exhausted.
- Add an `/ai-propose` endpoint that accepts AI patches, runs quick lint/tests in a sandbox, and then opens a PR annotated with automated test results.
