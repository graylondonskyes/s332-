# V64 DEPLOY GUIDE

## Static shell
- Publish the `SkyeRoutex/` folder as the site root.
- `netlify.toml` already points Netlify Functions at `netlify/functions`.

## What the functions do
- `phc-auth-login`: issues signed operator cloud sessions
- `phc-sync-state`: snapshot push/pull
- `phc-sync-frame`: replica frame ingest
- `phc-pos-ingest`: queued POS row intake
- `phc-webhook-square`: Square-style webhook queue intake
- `phc-job-drain`: server queue execution
- `phc-health`: revision and queue status

## Local smoke
Run:
- `npm run check:v64`

## Honest note
V64 ships the serverless lane in-repo. Production deployment still depends on your actual Netlify site and secrets.
