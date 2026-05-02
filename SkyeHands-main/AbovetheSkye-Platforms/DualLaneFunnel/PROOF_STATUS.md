# DualLaneFunnel Proof Status

## Runnable Surface

This folder is a real deployable funnel surface with:

- `public/index.html` as the funnel home
- separate job seeker and employer intake pages
- a diagnostics page
- Netlify function entrypoints for health and optional intake persistence

## Proof Command

Run from this folder:

```bash
node smoke/smoke-proof.mjs
```

## What The Proof Actually Verifies

- the public pages for both lanes and diagnostics exist
- the frontend intake script posts to Netlify Forms and knows about the optional function lane
- the Netlify function files parse successfully

## What Is Still Not Proven Here

- deployed Netlify Forms capture
- deployed Neon writes
- deployed Netlify Blobs writes

The folder has a runnable app surface, but the enterprise persistence claims still depend on deployment-time infrastructure.
