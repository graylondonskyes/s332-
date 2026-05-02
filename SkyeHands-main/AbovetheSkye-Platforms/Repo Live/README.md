Repo Live

This build exists as a static local browser tool for repo intake and proof-of-surface testing.

Current shape:
- no service worker
- inline module boot instead of external module boot files
- local brand asset usage
- WebContainers-oriented COOP/COEP headers (`require-corp` + `same-origin`)
- ZIP intake plus File System Access and legacy folder pickers
- local preset persistence and local run-report persistence

Deploy: Netlify Drop with this folder/zip. No env vars.

## Local Proof

Run from this folder:

```bash
node smoke/smoke-proof.mjs
```

This proof validates the file-intake UI, inline module boot surface, the required COOP/COEP headers, and the browser-rendered preset/report surfaces. It does not claim a live browser WebContainer session by itself.
