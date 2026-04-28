# SkyeDocxMax Package Format

## Secure `.skye`

Secure `.skye` files are binary envelopes serialized by `_shared/skye/skyeSecure.js`.

Envelope marker:

```txt
SKYESEC1
```

Envelope fields:

- `format`: `skye-secure-v1`
- `encrypted`: `true`
- `app`: `SkyeDocxMax`
- `alg`: `AES-256-GCM`
- `kdf`: `PBKDF2-SHA256`
- `iterations`: `150000`
- `hint`: optional passphrase hint
- `payload.primary`: encrypted document payload
- `payload.failsafe`: optional recovery-code encrypted payload
- `created_at`: ISO timestamp

Payload fields:

- `meta.app_id`
- `meta.app_version`
- `meta.workspace_id`
- `meta.document_id`
- `meta.title`
- `meta.updated_at`
- `state.content`
- `state.folder_id`
- `state.comments`
- `state.suggestions`
- `state.versions`
- `state.meta_fields`
- `assets[]`

Backward compatibility:

- Import accepts older donor payloads tagged `SkyeDocxPro`.
