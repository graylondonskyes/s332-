# Threat Model

Primary assets:

- Local document content.
- Encrypted `.skye` packages.
- IndexedDB vault state.
- Local bridge outbox/evidence records.

Main risks:

- Lost passphrase for encrypted packages.
- Browser profile data loss.
- Malicious imported HTML.
- Tampered encrypted packages.
- Missing live bridge routes being mistaken for successful remote delivery.

Mitigations in this build:

- AES-GCM encrypted package authentication.
- Visible wrong-passphrase and runtime failures.
- Sanitized rendered/imported HTML where DOMPurify is available.
- Local bridge records that make pending remote delivery explicit.
- Backup/export paths for vault recovery.

