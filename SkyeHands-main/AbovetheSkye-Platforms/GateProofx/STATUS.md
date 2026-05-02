# GateProofx Status

- Classification: `partial`
- Runnable surface: single-page gateway export reader for uploaded CSV/NDJSON, local filtering, saved views, local import-history reload, quality checks, charting, and client-side re-export.
- Proof command: `node smoke/smoke-static-proof.mjs`
- What the proof covers: upload/filter/chart/export UI, saved-view and local import-history runtime helpers, quality-summary runtime helpers, CSV/NDJSON parsing hooks, and explicit archive-endpoint dependency markers.
- What it does not cover: live archive endpoint availability, admin token issuance, or any backlog features beyond the current page.
