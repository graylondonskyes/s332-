# SKYE GEO ENGINE — SMOKE PROOF PHASE A/B/C V2

As of 2026-04-07 (America/Phoenix)

## Command executed

```bash
npm run check
npm run smoke
```

## Result

Both commands passed in the local build container.

## Smoke assertions that passed

- workspace create
- project create
- persisted site audit
- persisted 30-day content plan
- persisted visibility prompt pack
- deduped research/source ledger
- article brief creation from stored source IDs
- article draft creation from stored brief
- publish payload persistence
- workspace history aggregation
- org-scope isolation rejection for a different org

## Smoke output snapshot

```json
{
  "ok": true,
  "workspaceId": "ws_5262e40994ff4fedaa3003409da6abbb",
  "projectId": "prj_ecdd44bbc65c49aab1895d8fba477d4e",
  "articleId": "article_2fb71478a5e64dab93aa3dc04a37f898",
  "checks": [
    "workspace create/list",
    "project create/list",
    "persisted audit run",
    "persisted content plan",
    "persisted visibility prompt pack",
    "deduped source ledger",
    "article brief generation",
    "article draft generation",
    "publish payload persistence",
    "workspace history aggregation",
    "org isolation rejection"
  ]
}
```

## What this proof means

This repo is no longer only a stateless starter shell.

It now has a real adapter-backed persistence layer in code, a route-level smoke path, workspace/project/job history, research normalization with dedupe, brief creation from persisted sources, deterministic article composition from stored briefs, and persisted publish-payload records.

## What this smoke does not claim

- real Neon credentials were not exercised in this local smoke
- live remote CMS publish calls were not exercised
- replay against external AI answer surfaces was not exercised
- backlink/distribution network ops were not exercised
- reseller/billing lanes were not exercised
