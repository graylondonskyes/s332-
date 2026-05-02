# Proof Status

- Status: `partial`
- Surface type: `local product shell + in-folder runtime subset`
- Proof command: `node smoke/smoke-proof.mjs`

## What this folder proves

- The folder contains a runnable local `index.html` shell for SkyeProfitConsole.
- The local page now includes an explicit runtime-boundary section that separates the shell from the hosted bookkeeping runtime.
- The local page links to an external hosted app and describes the product model and use cases.
- The local folder now includes a planning worksheet that can save either to browser storage or to the in-folder local runtime, derives profit and reconciliation metrics, and exports that snapshot as JSON or CSV.
- The local folder also includes a ledger lane for invoices, payments, deposits, and expenses, with derived cash-profit, open-invoice, unreconciled-deposit, collection-rate, and audit-flag metrics plus JSON/CSV export.
- The folder now includes `runtime/local-runtime.mjs`, a same-folder local HTTP runtime that serves the page, persists worksheet and ledger state into `runtime/store.json`, and exposes local proof endpoints for health, worksheet, ledger, metrics, and snapshot retrieval.

## What this folder does not prove yet

- This folder still does not contain the full hosted bookkeeping runtime it describes.
- The in-folder runtime is still single-operator local infrastructure; it does not provide multi-user sync, automated audit-pack generation, or hosted deployment behavior.
- This lane does not prove the external hosted app linked from the page.

## Current certification call

This folder is now a real local shell plus a real in-folder bookkeeping subset with its own local runtime. The proof lane certifies the worksheet, ledger, exports, runtime API, and runtime boundary inside this folder, not the hosted bookkeeping runtime.
