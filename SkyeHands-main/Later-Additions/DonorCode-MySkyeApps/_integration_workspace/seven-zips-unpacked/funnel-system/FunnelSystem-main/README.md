# Skyes Over London • Dual‑Lane Funnel System (Netlify‑Ready)

This is the actual working funnel website with separate lanes:
- **Job Seekers**: `/jobseekers.html` (Netlify Form: `jobseekers-intake`)
- **Employers**: `/employers.html` (Netlify Form: `employers-intake`)

It is designed to run in two layers:

1) **Always on:** Netlify Forms captures every submission.
2) **Full stack:** Netlify Functions write the same submission into:
   - Netlify Blobs store: `sol-intake`
   - Postgres table: `intake_submissions`

## The part you were calling out (no manual Neon string)

You’re right: env vars don’t “self-create” from code.

This project is wired for **Netlify DB (powered by Neon)** so the database + env are created automatically when you build.

Netlify DB docs:
- Netlify DB automatically connects to functions and environment variables, and is powered by Neon.
- You can create a database using `npx netlify db init`.
- Or, with `@netlify/neon` installed, Netlify will automatically create a Neon DB + required env vars whenever you build (netlify dev/build or a Netlify deploy).

(See Netlify DB docs and Netlify’s DB announcement.) 

## Codespace setup (fast)

1) Put this repo into your Codespace.
2) Install deps:
```bash
npm install
```

3) Provision Netlify DB (recommended, no Neon connection strings):
```bash
npx netlify db init
```

4) Run locally with Netlify emulation:
```bash
npx netlify dev
```

## Netlify deploy (production)

Deploy via Git-connected Netlify site (recommended for Functions + DB):

- Publish: `public`
- Functions: `netlify/functions`
- Build command: `npm run build` (runs `scripts/db-init.js` to ensure schema)

Then:
- Submit a form
- Check Netlify → Forms (submission stored)
- Check `/diagnostics.html` for function/db/blob status

## Environment variables

### Preferred (auto with Netlify DB)
- `NETLIFY_DATABASE_URL` (created by Netlify DB / Neon extension)

### Fallbacks (only if you are NOT using Netlify DB)
- `NEON_DATABASE_URL`
- `DATABASE_URL`

## What “initialize at build” means here

Build runs `scripts/db-init.js` which creates the `intake_submissions` table (idempotent).
If DB env is not present, build does not fail (Forms-only mode still works).

## Files
- `public/` → UI, pages, assets
- `netlify/functions/intake.js` → writes to Blobs + Postgres
- `netlify/functions/health.js` → diagnostics
- `scripts/db-init.js` → build-time schema init
