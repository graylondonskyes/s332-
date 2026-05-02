# SkyDexia Donor Indexing & Provenance Pipeline

## Production Intent
This pipeline converts imported donor assets from `GiftsFromtheSkyes/` into reusable, smokeable template catalog entries with immutable provenance tracking.

## Runtime Steps
1. Import donor asset via `scripts/skydexia-knowledge-import.mjs` (creates artifact + metadata sidecar).
2. Build reusable template catalog via `scripts/skydexia-donor-index.mjs`.
3. Validate provenance completeness via `scripts/skydexia-provenance-audit.mjs`.

## Output Artifacts
- `skydexia/templates/donor-template-catalog.json`
- `skydexia/provenance/donor-provenance-ledger.json`

## Hard Constraints
- No template is cataloged without sidecar metadata.
- Every cataloged template must include provenance source, checksum, import date, and compatibility.
- Catalog entries are tagged `smokeable: true` and `extractionPolicy: validated-only` for safe downstream extraction.
