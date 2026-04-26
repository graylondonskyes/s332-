# SkyeQuantaCore artifact manifest spec

The ship-candidate run emits `dist/ship-candidate/ARTIFACT_MANIFEST.json`.

## Required fields

- `generatedAt`: ISO timestamp for the manifest run
- `algorithm`: hashing algorithm, currently `sha256`
- `items`: array of packaged output records

## Item schema

Each item contains:

- `path`: repo-relative artifact path
- `sizeBytes`: file size in bytes
- `sha256`: lowercase hex digest

## Required artifact classes

A green Section 8 packaging run must include hashes for:

- the packaged operator handoff archive
- the machine-readable deployment readiness report
- the canonical Stage 9 deployment readiness proof artifact
- the mode template outputs for deploy, dev, and proof operation
