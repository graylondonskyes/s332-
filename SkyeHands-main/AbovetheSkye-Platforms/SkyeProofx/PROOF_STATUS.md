# Proof Status

- Status: `partial`
- Surface type: `real standalone browser app`
- Proof command: `node smoke/smoke-proof.mjs`

## What this folder proves

- `index.html` contains a local browser vault workflow with Create, Open, and Verify lanes.
- The implementation includes WebCrypto usage for hashing and AES-GCM encryption.
- The folder includes PWA support files: `manifest.webmanifest` and `sw.js`.
- The local page now calls out its proof boundary more explicitly: browser-local crypto is in scope; sync/recovery/remote attestation are not.
- The local UI also exposes export and verification lanes for ledger CSV, proof-tile JSON, vault reopen, and original-file hash checks.
- The local UI now also keeps a browser-local receipt trail for vault builds, vault opens, decrypt actions, and verification runs, and it can export both that trail and the latest verification report as JSON.
- The verification lane now performs simple manifest diagnostics for duplicate receipt names and duplicate original-file hashes.

## What this folder does not prove yet

- No deployment proof beyond the local browser run in this folder.
- No remote attestation, recovery, third-party timestamping, or account-backed sync proof.

## Current certification call

This is a real local browser surface with meaningful in-folder behavior, and it now includes a browser-driven end-to-end local vault proof. It is still not certified here as a deployed or remotely attested product.
