# AE Central Command Pack featuring the Credential Hub Launcher

Offline-first AE command shell with:
- Credential Hub Launcher landing page that links the built-in credential lanes, the AE Central Command Pack guide, the Connected Ops Pack guide, and bundled branch apps
- AE Command Pack page that merges the free field stack, intake stack, event stack, and closer-upgrade overview
- royal-blue-and-gold glass UI shell separated from the background stage
- custom background upload
- bundled founder + SkyDexia art presets
- contacts hub with CSV import/export
- relationship timeline per contact
- credentials vault
- projects
- notes
- backup / restore
- optional local access-code lock
- installable PWA
- dedicated Tutorial page + guided walkthrough overlay
- sitemap page for the full package layout

## Run locally for proper offline/PWA behavior
Use a real local server instead of opening `index.html` with `file://`.

### Python
```bash
python3 -m http.server 8080
```

Then open:
`http://localhost:8080`

## Files
- `index.html` — main app shell
- `pages/` — injected page partials, including Launcher, AE Command Pack, and Sitemap
- `assets/styles.css` — royal-blue-and-gold glass UI and layout styles
- `assets/app.js` — app logic
- `manifest.json` — PWA manifest
- `sw.js` — offline cache worker
- `assets/` — founder/logo artwork

- Connected Ops Pack editorial page for Skye Lead Vault and Skye Split Engine Ops
- Bundled connected apps: Skye Lead Vault and Skye Split Engine Ops

- Service Master Pack guide page for payment methodology, recurring revenue, AI-usage uplift, and offer selection
- Bundled Service Master Pack under Branching Apps/ae-service-pack-master


## Added additive branch app

- `Branching Apps/AE-Brain-Command-Site-v8-Additive/`
- Root directive: `BUILD_DIRECTIVE_AE_BRAIN_COMMAND_SITE.md`

## 0megaPhase packaged brain

- `Branching Apps/AI-Appointment-Setter-Brain-v33/`
- Root integration directive: `0megaPhase_Upgrade.md`
- Quick integration guide: `docs/0MEGAPHASE_UPGRADE_QUICKSTART.md`

This packaged donor is the next command brain under AE Command. It is included inside the pack so the appointment-setter runtime, admin desk, booking/autonomy lanes, deployment guides, smoke pack, and valuation docs are all present for the larger integrated build.


## AE Brain Live Lane

This pack now includes root-level Netlify functions for the AE Brain branch:
- `/.netlify/functions/ae-founder-login`
- `/.netlify/functions/ae-founder-me`
- `/.netlify/functions/ae-founder-logout`
- `/.netlify/functions/ae-branch-state`
- `/.netlify/functions/ae-brain-chat`
- `/.netlify/functions/ae-brain-health`

The AE branch uses one donor brain runtime replicated across 13 AE profiles by mapping each profile to `AE_OPENAI_KEY_01` through `AE_OPENAI_KEY_13` and applying the AE-specific system prompt server-side.


## AE Brain live lanes

This pack now includes root Netlify functions for `ae-brains`, `ae-usage-summary`, and `ae-audit-events` so AE roster overrides, health, usage, and audit activity can be read remotely by the AE branch app.


## Printful Commerce Brain

The full Printful EDM donor is now packaged under `Branching Apps/Printful-Commerce-Brain-EDM-pass6/` and the command shell now includes a root `0megaCommerce_Printful_Upgrade.md` directive plus an integrated Printful brain lane inside AE Command for initial merch/POD bridge management.
