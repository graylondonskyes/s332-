# IndexedDB Schema

Database name: `SkyesDocsDB`

Current database version: `4`

Object stores:

- `documents`: key path `id`; stores document title, HTML content, folder id, versions, comments, suggestions, metadata, and timestamps.
- `folders`: key path `id`; stores folder names and timestamps.
- `assets`: key path `id`; stores embedded asset metadata and browser `Blob` values.

Migration policy:

- The app creates missing stores during `onupgradeneeded`.
- Future schema changes should increment `DB_VERSION`, add non-destructive migrations, and preserve existing document/content records.

