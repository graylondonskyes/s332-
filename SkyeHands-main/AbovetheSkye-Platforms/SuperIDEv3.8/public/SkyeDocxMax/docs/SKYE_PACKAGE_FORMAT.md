# SkyeDocxMax `.skye` Package Format

Format name: `skyedocxmax-package`
Format version: `1.0.0`

SkyeDocxMax exports private documents as encrypted `.skye` packages. The package is a JSON envelope encrypted with the bundled `_shared/skye/skyeSecure.js` runtime.

## Encryption

- Method: Web Crypto AES-GCM.
- KDF: PBKDF2 passphrase-derived key material.
- Salt: base64 encoded random bytes in the encrypted envelope.
- IV: base64 encoded random bytes in the encrypted envelope.
- Tamper detection: AES-GCM authentication fails decryption if the ciphertext, IV, salt, or authentication tag is modified.

## Plain Payload

The decrypted payload includes:

- `format`: `skyedocxmax-package`
- `version`: `1.0.0`
- `meta`: title, document id, timestamps, author/classification fields, and app id.
- `document`: sanitized editor HTML.
- `assets`: asset metadata and encoded asset payloads when present.
- `comments`: document comment records.
- `suggestions`: tracked suggestion records.
- `versions`: saved timeline snapshots.

## Recovery Kit

When requested, export also writes recovery metadata so the user has the needed document title and package context without exposing decrypted content.

## Compatibility

This release reads SkyeDocxMax packages and accepts legacy `SkyeDocxPro` app ids for migration. Unsupported package versions must fail visibly instead of silently importing.

