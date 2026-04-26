# 03 — IN-PLACE UI AND CODE TOUCH MAP

This file is the exact map for where the actual build belongs **when code touch is authorized**.

## Actual files to touch
### AE FLOW
- `SkyeRoutexFlow/AE-FLOW/AE-Flow/index.html`

### Routex
- `SkyeRoutexFlow/SkyeRoutex/index.html`

## Files that should **not** become donor dumping grounds
- manifest files
- service worker files unless storage or offline caching truly requires an update
- icons / logos / branding assets
- readme files used as fake proof of implementation

## AE FLOW in-place surface targets
### Accounts surface
Use this for:
- readiness badges
- stale / revisit / cold flags
- last route result
- next planned action
- account heat / priority
- QR/account code presentation
- dossier layout

### Route builder surface
Use this for:
- territory filtering
- conflict warnings
- template loading
- location quality warnings
- route-ready-only and patch-needed segmentation
- route pack source selection

### Tasks / follow-up surface
Use this for:
- Routex-origin tasks
- reminder center
- due / overdue / upcoming grouping
- callback / revisit / collections / proposal queues

### Account docs / history surface
Use this for:
- Routex-linked proof summaries
- service summaries
- delivery confirmations
- route replay highlights
- voice-note linkage when supported

## Routex in-place surface targets
### Route list / route card surface
Use this for:
- scorecard
- route pack state
- day / multi-day grouping
- route replay launch
- pseudo-map launch

### Route detail surface
Use this for:
- economics audit
- timing totals
- materials and collections
- signatures and service summaries
- pack export/import actions
- trip-pack grouping

### Stop card / stop modal surface
Use this for:
- canonical outcome selector
- location quality label
- quick actions
- proof and signature collection
- service summary generation
- voice note capture if supported
- manual map-board directional text

### Settings / tools surface
Use this for:
- territory zones
- vehicle profiles
- inventory catalog
- backup / restore / merge preview
- storage health
- reminder center config
- route pack import

## Hard rule for donor plumbing
If a donor pattern is used, it must be **reimplemented in-place** inside the existing AE FLOW / Routex surfaces above.
No imported donor nav.
No imported donor identity.
No whole-screen transplant.
