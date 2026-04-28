# Audit-Ready Revenue + Profit Console (Client Tool)

This is an offline-first web app that helps a business become “audit-ready” by:
- tracking monthly revenue + expenses
- logging invoices (when applicable)
- logging bank deposits
- reconciling deposits to invoices or specific revenue entries
- generating a printable “Audit Readiness Pack” the client can save as PDF

## Deploy (Netlify Drop-ready)
1) Download/copy this folder.
2) Make sure `index.html` is at the root.
3) Drag & drop the folder into Netlify Drop.
4) Open the site.

No environment variables. No database required for the core app.

## Use (recommended weekly flow)
- Add revenue entries as sales occur
- Add expenses as they happen (type them: COGS vs OpEx)
- If invoicing: create invoice records and mark paid with payment reference
- Add bank deposits from statements/payouts
- Reconcile deposits weekly (or at least monthly)
- Build the Audit Readiness Pack monthly and “Print / Save as PDF”

## Data Storage
This app stores data locally on the device using browser storage.
To move data between devices or send to an advisor:
- Click **Export** to download a JSON file
- Click **Import** to load that JSON file on another device

## Sample data (stress test)
- Download `audit_console_stress_test_import.json` from the repo root (or from the Help card in-app).
- In the app, click **Import** (top right) and choose that file to instantly load a full dataset for testing.

## CSV Export
Each section has **Export CSV** for month-level exports:
- revenue
- expenses
- invoices
- deposits

## Audit Readiness Pack (PDF)
The app generates a printable report.
- Click **Build Pack**
- Then click **Print / Save as PDF**
- In the print dialog choose **Save as PDF**

## Notes
This system is designed to produce clean “proof trails”:
invoice → payment → deposit → books.
That is what makes revenue/profit auditable and trustworthy.
