# NexusForge Studio

Offline-first “content + outreach” console (React + Vite). Stores everything locally in the browser (no Firebase/Supabase required).

What it does:
- Business Vault: store prospects/clients (accounts)
- Generator Lab: generate a blog brief + HTML skeleton + AI prompt pack
- Post Log: track draft/scheduled/published posts
- Email Forge: generate a 4-week follow-up email cadence
- Cluster Map: generate topic clusters + internal link map

## Run locally (simple)

1) Install Node.js (LTS) on the machine you use to build.
2) In this folder:

```bash
npm install
npm run dev
```

Then open the local URL printed in your terminal.

## Build for Netlify

```bash
npm run build
```

Deploy the `dist/` folder.

## Where to edit

- `src/App.jsx` — app shell + navigation
- `src/pages/*` — screens
- `src/lib/storage.js` — local save/load + export/import helpers
- `src/lib/templates.js` — the “generators” (briefs, emails, clusters)
- `src/index.css` — purple/gold theme utilities

## Clone for a new app

1) Copy this folder and rename it.
2) Change the title in `index.html` (this also changes the localStorage key).
3) Change `package.json` name.
4) Replace/add screens in `src/pages` and wire them into `NAV` inside `src/App.jsx`.

## Data

Everything is stored locally in the browser in a single state object. Use **Settings → Export JSON backup** to move data between machines.
