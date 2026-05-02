# Skye Route & Dispatch Vault (Offline)

An installable, offline-first PWA for route planning + dispatch + proof-of-delivery capture.

## What it does
- Create routes (date, driver, vehicle) and add stops
- Assign order per stop and mark status (Pending / Arrived / Delivered / Failed)
- Capture proof-of-delivery photos per stop (stored locally in IndexedDB)
- Add notes + timestamps per stop
- Export route logs:
  - **CSV** for spreadsheets / payroll / ops
  - **JSON** for backups / migrations
- Optional lock screen PIN for basic on-device access control

## Offline & device-first
- Works without internet once installed.
- Data is stored **on the device** (localStorage + IndexedDB).  
  If the device is wiped, data is gone unless you export JSON regularly.

## Netlify drop deploy
1. Upload the entire folder to Netlify (or drag-drop the folder contents into an existing site)
2. Open the site URL
3. Install as an app:
   - Chrome/Edge: menu → **Install app**
   - Android: menu → **Add to Home screen**
   - iOS Safari: Share → **Add to Home Screen**

## Selling notes (recommended positioning)
- “Offline proof-of-delivery + route logs for independent courier fleets”
- Target buyers: small courier companies, gig drivers, field service, property maintenance, event logistics
- Add-ons you can upsell later: cloud sync, team accounts, map optimization, signatures, barcode scan, PDF manifests

## Branding
- Replace `assets/logo.png` and the PNGs in `/icons` with your brand marks.
- Update app name/colors in `manifest.webmanifest`.


## Platform House Circle · V59
- Added an integral hospitality/member/campaign/event lane directly into the Routex shell.
- New Platform House workspace can turn events, campaigns, and drops into Routex follow-up tasks or full route missions.
- Routex stop updates now write back into the Platform House timeline and shared venue records.
- Use `node PLATFORM_HOUSE_CIRCLE_SMOKE_V59.js` for the local smoke pass.
